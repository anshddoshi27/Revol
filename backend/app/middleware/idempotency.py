"""
Idempotency Middleware for Tithi Backend

This middleware implements idempotency for critical endpoints (bookings, payments)
by caching responses based on idempotency keys provided by clients.

Phase: 11 - Cross-Cutting Utilities (Module N)
Task: 11.4 - Idempotency Keys
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from flask import request, g, current_app
from werkzeug.exceptions import Conflict

from ..extensions import db

logger = logging.getLogger(__name__)


class IdempotencyError(Exception):
    """Error raised when idempotency key validation fails"""
    def __init__(self, message, details=None):
        self.message = message
        self.details = details
        self.error_code = "TITHI_IDEMPOTENCY_REUSE_ERROR"
        self.status_code = 409
        super().__init__(message)


class IdempotencyMiddleware:
    """
    Middleware for handling idempotency keys on critical endpoints.
    
    This middleware:
    1. Extracts idempotency key from request headers
    2. Validates the key against cached responses
    3. Returns cached response if valid key exists
    4. Stores new response for future idempotent requests
    """
    
    # Default expiration time for idempotency keys (24 hours)
    DEFAULT_EXPIRATION_HOURS = 24
    
    # Critical endpoints that require idempotency
    CRITICAL_ENDPOINTS = {
        'POST /api/bookings',
        'POST /api/payments/intent',
        'POST /api/payments/confirm',
        'POST /api/payments/refund',
        'POST /api/payments/setup-intent',
        'POST /api/payments/capture-no-show',
        'POST /api/availability/hold',
        'POST /api/availability/release'
    }
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the middleware with Flask app"""
        app.before_request(self.before_request)
        app.after_request(self.after_request)
    
    def before_request(self):
        """Process request before handling"""
        # Only process critical endpoints
        endpoint_key = f"{request.method} {request.endpoint}"
        if endpoint_key not in self.CRITICAL_ENDPOINTS:
            return
        
        # Extract idempotency key from headers
        idempotency_key = request.headers.get('Idempotency-Key')
        if not idempotency_key:
            # For critical endpoints, idempotency key is required
            raise IdempotencyError(
                "Idempotency-Key header is required for this endpoint",
                details="Critical endpoints require idempotency keys for reliable retries"
            )
        
        # Validate idempotency key format
        if not self._validate_idempotency_key_format(idempotency_key):
            raise IdempotencyError(
                "Invalid idempotency key format",
                details="Idempotency key must be a valid UUID or alphanumeric string"
            )
        
        # Generate request hash for validation
        request_hash = self._generate_request_hash(request)
        
        # Check for existing cached response
        cached_response = self._get_cached_response(
            idempotency_key, endpoint_key, request_hash
        )
        
        if cached_response:
            # Return cached response
            logger.info(
                "IDEMPOTENCY_KEY_USED",
                extra={
                    'idempotency_key': idempotency_key[:8] + '...',  # Truncated for security
                    'endpoint': endpoint_key,
                    'tenant_id': getattr(g, 'current_tenant_id', None),
                    'user_id': getattr(g, 'current_user_id', None),
                    'cached_status': cached_response['status']
                }
            )
            
            # Set response data for after_request to skip processing
            g.idempotency_cached_response = cached_response
            g.idempotency_key = idempotency_key
            g.idempotency_endpoint = endpoint_key
            g.idempotency_request_hash = request_hash
            return
        
        # Store idempotency context for after_request
        g.idempotency_key = idempotency_key
        g.idempotency_endpoint = endpoint_key
        g.idempotency_request_hash = request_hash
        g.idempotency_cached_response = None
    
    def after_request(self, response):
        """Process response after handling"""
        # Only process if we have idempotency context
        if not hasattr(g, 'idempotency_key'):
            return response
        
        # If we returned a cached response, don't store it again
        if hasattr(g, 'idempotency_cached_response') and g.idempotency_cached_response:
            return response
        
        # Store the response for future idempotent requests
        self._store_response(
            g.idempotency_key,
            g.idempotency_endpoint,
            g.idempotency_request_hash,
            response
        )
        
        return response
    
    def _validate_idempotency_key_format(self, key: str) -> bool:
        """Validate idempotency key format"""
        if not key or len(key) < 1 or len(key) > 255:
            return False
        
        # Allow UUIDs, alphanumeric strings, and common patterns
        import re
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        alphanumeric_pattern = r'^[a-zA-Z0-9_-]+$'
        
        return bool(re.match(uuid_pattern, key, re.IGNORECASE) or 
                   re.match(alphanumeric_pattern, key))
    
    def _generate_request_hash(self, request) -> str:
        """Generate hash of request body for validation"""
        try:
            # Get request data
            if request.is_json:
                data = request.get_json() or {}
            elif request.form:
                data = dict(request.form)
            else:
                data = request.get_data(as_text=True) or ""
            
            # Create deterministic hash
            data_str = json.dumps(data, sort_keys=True) if isinstance(data, dict) else str(data)
            return hashlib.sha256(data_str.encode('utf-8')).hexdigest()
        except Exception as e:
            logger.warning(f"Failed to generate request hash: {e}")
            return hashlib.sha256(str(request.get_data()).encode('utf-8')).hexdigest()
    
    def _get_cached_response(self, idempotency_key: str, endpoint: str, request_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached response for idempotency key"""
        try:
            from ..models.idempotency import IdempotencyKey
            
            # Generate key hash for lookup
            key_hash = hashlib.sha256(idempotency_key.encode('utf-8')).hexdigest()
            
            # Query database for cached response
            cached_key = IdempotencyKey.query.filter_by(
                tenant_id=g.current_tenant_id,
                key_hash=key_hash,
                endpoint=endpoint,
                method=request.method,
                request_hash=request_hash
            ).first()
            
            if cached_key and cached_key.expires_at > datetime.utcnow():
                return {
                    'status': cached_key.response_status,
                    'body': cached_key.response_body,
                    'headers': cached_key.response_headers
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get cached response: {e}")
            return None
    
    def _store_response(self, idempotency_key: str, endpoint: str, request_hash: str, response):
        """Store response for future idempotent requests"""
        try:
            from ..models.idempotency import IdempotencyKey
            
            # Generate key hash for storage
            key_hash = hashlib.sha256(idempotency_key.encode('utf-8')).hexdigest()
            
            # Calculate expiration time
            expires_at = datetime.utcnow() + timedelta(hours=self.DEFAULT_EXPIRATION_HOURS)
            
            # Extract response data
            response_body = {}
            try:
                if response.is_json:
                    response_body = response.get_json() or {}
            except Exception:
                response_body = {'message': 'Non-JSON response'}
            
            response_headers = dict(response.headers)
            
            # Store in database
            idempotency_record = IdempotencyKey(
                tenant_id=g.current_tenant_id,
                key_hash=key_hash,
                original_key=idempotency_key,
                endpoint=endpoint,
                method=request.method,
                request_hash=request_hash,
                response_status=response.status_code,
                response_body=response_body,
                response_headers=response_headers,
                expires_at=expires_at
            )
            
            db.session.add(idempotency_record)
            db.session.commit()
            
            logger.info(
                "IDEMPOTENCY_KEY_STORED",
                extra={
                    'idempotency_key': idempotency_key[:8] + '...',  # Truncated for security
                    'endpoint': endpoint,
                    'tenant_id': g.current_tenant_id,
                    'user_id': getattr(g, 'current_user_id', None),
                    'response_status': response.status_code,
                    'expires_at': expires_at.isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to store idempotency response: {e}")
            # Don't raise exception to avoid breaking the main request
    
    @classmethod
    def cleanup_expired_keys(cls):
        """Clean up expired idempotency keys"""
        try:
            from ..models.idempotency import IdempotencyKey
            
            # Delete expired keys
            expired_count = IdempotencyKey.query.filter(
                IdempotencyKey.expires_at < datetime.utcnow()
            ).delete()
            
            db.session.commit()
            
            logger.info(f"Cleaned up {expired_count} expired idempotency keys")
            return expired_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired idempotency keys: {e}")
            return 0


# Global middleware instance
idempotency_middleware = IdempotencyMiddleware()
