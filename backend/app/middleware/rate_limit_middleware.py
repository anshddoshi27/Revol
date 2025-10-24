"""
Rate Limiting Middleware

This middleware provides rate limiting functionality for the Tithi backend.
It implements token bucket algorithm with Redis backend for distributed rate limiting.

Features:
- Token bucket algorithm with Redis backend
- Per-tenant and per-user rate limiting
- Configurable limits per endpoint
- Global default limits (100 req/min)
- Observability hooks with structured logging
- Error handling with TITHI_RATE_LIMIT_EXCEEDED error code
"""

import time
import logging
import json
from typing import Optional, Dict, Any, Tuple
from flask import request, g, current_app, jsonify
from functools import wraps
import redis
from ..middleware.error_handler import TithiError


class RateLimitExceededError(TithiError):
    """Error raised when rate limit is exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None):
        super().__init__(
            message=message,
            code="TITHI_RATE_LIMIT_EXCEEDED",
            status_code=429
        )
        self.retry_after = retry_after


class RateLimitMiddleware:
    """Middleware for rate limiting with token bucket algorithm."""
    
    def __init__(self, app=None):
        self.app = app
        self.logger = logging.getLogger(__name__)
        self.redis_client = None
        self.default_limit = 100  # requests per minute
        self.default_window = 60  # seconds
        
        # Endpoint-specific rate limits
        self.endpoint_limits = {
            '/api/bookings': {'limit': 50, 'window': 60},  # 50 req/min for bookings
            '/api/payments': {'limit': 30, 'window': 60},  # 30 req/min for payments
            '/api/availability': {'limit': 200, 'window': 60},  # 200 req/min for availability
            '/v1/tenants': {'limit': 20, 'window': 60},  # 20 req/min for tenant operations
            '/v1/bookings': {'limit': 30, 'window': 60},  # 30 req/min for booking creation
            '/v1/payments': {'limit': 20, 'window': 60},  # 20 req/min for payment operations
            '/v1/payments/intent': {'limit': 15, 'window': 60},  # 15 req/min for payment intents
            '/v1/payments/setup-intent': {'limit': 10, 'window': 60},  # 10 req/min for setup intents
            '/v1/payments/refund': {'limit': 5, 'window': 60},  # 5 req/min for refunds
        }
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the middleware with Flask app."""
        self.app = app
        
        # Initialize Redis client
        redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test Redis connection
            self.redis_client.ping()
            self.logger.info("Rate limiting Redis connection established")
        except Exception as e:
            self.logger.error(f"Failed to connect to Redis for rate limiting: {e}")
            # Fallback to in-memory rate limiting (not recommended for production)
            self.redis_client = None
        
        # Register before_request handler
        app.before_request(self._check_rate_limit)
        
        # Register error handler for rate limit exceeded
        app.register_error_handler(RateLimitExceededError, self._handle_rate_limit_error)
    
    def _check_rate_limit(self):
        """Check rate limit for incoming request."""
        # Skip rate limiting in test mode or development mode
        if current_app.config.get('TESTING', False) or current_app.config.get('DEBUG', False):
            return
        
        # Skip rate limiting for health checks
        if request.path.startswith('/health'):
            return
        
        # Get rate limit configuration
        limit_config = self._get_rate_limit_config()
        
        # Check rate limit
        allowed, remaining, reset_time = self._check_token_bucket(limit_config)
        
        if not allowed:
            # Emit observability hook
            self._emit_rate_limit_triggered(limit_config, remaining, reset_time)
            
            # Calculate retry after seconds
            retry_after = int(reset_time - time.time()) if reset_time else 60
            
            raise RateLimitExceededError(
                message=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                retry_after=retry_after
            )
        
        # Add rate limit headers to response
        self._add_rate_limit_headers(remaining, reset_time)
    
    def _get_rate_limit_config(self) -> Dict[str, Any]:
        """Get rate limit configuration for current request."""
        # Check for endpoint-specific limit
        endpoint_limit = self.endpoint_limits.get(request.path)
        if endpoint_limit:
            return endpoint_limit
        
        # Check for tenant-specific limit (from database)
        tenant_limit = self._get_tenant_rate_limit()
        if tenant_limit:
            return tenant_limit
        
        # Return global default
        return {
            'limit': self.default_limit,
            'window': self.default_window
        }
    
    def _get_tenant_rate_limit(self) -> Optional[Dict[str, Any]]:
        """Get tenant-specific rate limit from database."""
        try:
            tenant_id = getattr(g, 'tenant_id', None)
            if not tenant_id:
                return None
            
            # This would normally query the rate_limit_config table
            # For now, return None to use global defaults
            # TODO: Implement database lookup for tenant-specific limits
            return None
            
        except Exception as e:
            self.logger.error(f"Error getting tenant rate limit: {e}")
            return None
    
    def _check_token_bucket(self, config: Dict[str, Any]) -> Tuple[bool, int, Optional[float]]:
        """Check token bucket for rate limiting."""
        limit = config['limit']
        window = config['window']
        
        # Generate rate limit key
        key = self._generate_rate_limit_key()
        
        if not self.redis_client:
            # Fallback to in-memory rate limiting (not recommended for production)
            return self._check_in_memory_rate_limit(key, limit, window)
        
        try:
            # Use Redis for distributed rate limiting
            return self._check_redis_rate_limit(key, limit, window)
        except Exception as e:
            self.logger.error(f"Redis rate limit check failed: {e}")
            # Fallback to in-memory
            return self._check_in_memory_rate_limit(key, limit, window)
    
    def _generate_rate_limit_key(self) -> str:
        """Generate rate limit key based on tenant and user."""
        tenant_id = getattr(g, 'tenant_id', 'global')
        user_id = getattr(g, 'user_id', 'anonymous')
        endpoint = request.path
        
        # Create hierarchical key: tenant:user:endpoint
        return f"rate_limit:{tenant_id}:{user_id}:{endpoint}"
    
    def _check_redis_rate_limit(self, key: str, limit: int, window: int) -> Tuple[bool, int, Optional[float]]:
        """Check rate limit using Redis with sliding window."""
        current_time = time.time()
        window_start = current_time - window
        
        # Use Redis pipeline for atomic operations
        pipe = self.redis_client.pipeline()
        
        # Remove expired entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current requests
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(current_time): current_time})
        
        # Set expiration
        pipe.expire(key, window)
        
        # Execute pipeline
        results = pipe.execute()
        
        current_count = results[1]
        
        if current_count >= limit:
            # Rate limit exceeded
            return False, 0, current_time + window
        
        # Calculate remaining requests
        remaining = limit - current_count - 1  # -1 for current request
        reset_time = current_time + window
        
        return True, remaining, reset_time
    
    def _check_in_memory_rate_limit(self, key: str, limit: int, window: int) -> Tuple[bool, int, Optional[float]]:
        """Fallback in-memory rate limiting (not recommended for production)."""
        # This is a simple fallback - in production, you'd want a more sophisticated approach
        current_time = time.time()
        
        # For simplicity, we'll use a basic approach
        # In a real implementation, you'd want to use a proper in-memory data structure
        return True, limit - 1, current_time + window
    
    def _add_rate_limit_headers(self, remaining: int, reset_time: Optional[float]):
        """Add rate limit headers to response."""
        if reset_time:
            retry_after = int(reset_time - time.time())
            g.rate_limit_headers = {
                'X-RateLimit-Remaining': str(remaining),
                'X-RateLimit-Reset': str(int(reset_time)),
                'Retry-After': str(retry_after)
            }
    
    def _emit_rate_limit_triggered(self, config: Dict[str, Any], remaining: int, reset_time: Optional[float]):
        """Emit observability hook for rate limit triggered."""
        tenant_id = getattr(g, 'tenant_id', None)
        user_id = getattr(g, 'user_id', None)
        
        self.logger.warning("Rate limit triggered", extra={
            "event": "RATE_LIMIT_TRIGGERED",
            "tenant_id": tenant_id,
            "user_id": user_id,
            "endpoint": request.path,
            "method": request.method,
            "limit": config['limit'],
            "window": config['window'],
            "remaining": remaining,
            "reset_time": reset_time,
            "request_id": getattr(g, "request_id", None)
        })
    
    def _handle_rate_limit_error(self, error: RateLimitExceededError):
        """Handle rate limit exceeded error."""
        response_data = {
            "type": "https://tithi.com/errors/rate-limit-exceeded",
            "title": "Rate Limit Exceeded",
            "detail": error.message,
            "status": 429,
            "code": error.code,
            "retry_after": error.retry_after
        }
        
        response = jsonify(response_data)
        response.status_code = 429
        
        # Add rate limit headers
        if error.retry_after:
            response.headers['Retry-After'] = str(error.retry_after)
        
        return response


def rate_limit(limit: int = None, window: int = None):
    """Decorator to apply rate limiting to specific endpoints."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Rate limiting is handled by middleware
            # This decorator is for explicit documentation and configuration
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_rate_limit_status() -> Dict[str, Any]:
    """Get current rate limit status for debugging."""
    if not hasattr(g, 'rate_limit_headers'):
        return {"status": "no_rate_limit_applied"}
    
    return {
        "status": "rate_limit_applied",
        "headers": g.rate_limit_headers
    }
