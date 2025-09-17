"""
Authentication Middleware

This middleware provides JWT authentication and authorization for the Tithi backend.
It integrates with Supabase for JWT validation and tenant context management.

Features:
- Supabase JWT validation
- Tenant context extraction
- User authentication
- Authorization checks
- Error handling for auth failures
"""

import jwt
import logging
from typing import Optional, Dict, Any
from flask import request, g, current_app, jsonify
from functools import wraps
from ..middleware.error_handler import AuthenticationError, AuthorizationError, TithiError


class AuthMiddleware:
    """Middleware for JWT authentication and authorization."""
    
    def __init__(self, app=None):
        self.app = app
        self.logger = logging.getLogger(__name__)
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the middleware with Flask app."""
        self.app = app
        app.before_request(self._authenticate_request)
    
    def _authenticate_request(self):
        """Authenticate incoming requests."""
        # Skip authentication in test mode
        if current_app.config.get('TESTING', False):
            # Set mock user context for tests only if not already set
            if not hasattr(g, 'user_id') or g.user_id is None:
                import uuid
                g.user_id = uuid.uuid4()
            if not hasattr(g, 'tenant_id') or g.tenant_id is None:
                import uuid
                g.tenant_id = uuid.uuid4()
            if not hasattr(g, 'user_email') or g.user_email is None:
                g.user_email = "test@example.com"
            if not hasattr(g, 'user_role') or g.user_role is None:
                g.user_role = "owner"
            return
        
        # Skip authentication for public endpoints
        if self._is_public_endpoint():
            return
        
        # Skip authentication for health checks
        if request.path.startswith('/health'):
            return
        
        # Extract and validate JWT token
        token = self._extract_token()
        if not token:
            raise AuthenticationError(
                message="Authentication required",
                code="TITHI_AUTH_TOKEN_MISSING"
            )
        
        try:
            # Validate JWT token
            payload = self._validate_token(token)
            
            # Extract user and tenant context
            g.user_id = payload.get('sub')
            g.tenant_id = payload.get('tenant_id')
            g.user_email = payload.get('email')
            g.user_role = payload.get('role', 'user')
            
            # Log authentication success
            self.logger.info("User authenticated", extra={
                "user_id": g.user_id,
                "tenant_id": g.tenant_id,
                "user_email": g.user_email,
                "request_id": getattr(g, "request_id", None)
            })
            
        except jwt.ExpiredSignatureError:
            raise AuthenticationError(
                message="Token has expired",
                code="TITHI_AUTH_TOKEN_EXPIRED"
            )
        except jwt.InvalidTokenError:
            raise AuthenticationError(
                message="Invalid token",
                code="TITHI_AUTH_TOKEN_INVALID"
            )
        except Exception as e:
            self.logger.error("Authentication error", exc_info=True, extra={
                "error": str(e),
                "request_id": getattr(g, "request_id", None)
            })
            raise AuthenticationError(
                message="Authentication failed",
                code="TITHI_AUTH_ERROR"
            )
    
    def _is_public_endpoint(self) -> bool:
        """Check if the current endpoint is public."""
        public_paths = [
            '/v1/b/',  # Public tenant pages
            '/health',  # Health checks
        ]
        
        return any(request.path.startswith(path) for path in public_paths)
    
    def _extract_token(self) -> Optional[str]:
        """Extract JWT token from request headers."""
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return None
        
        # Check for Bearer token format
        if auth_header.startswith('Bearer '):
            return auth_header[7:]
        
        return None
    
    def _validate_token(self, token: str) -> Dict[str, Any]:
        """Validate JWT token with Supabase."""
        try:
            # Get Supabase JWT secret from config
            jwt_secret = current_app.config.get('SUPABASE_JWT_SECRET')
            if not jwt_secret:
                # Fallback to regular JWT secret for development
                jwt_secret = current_app.config.get('JWT_SECRET_KEY')
            
            if not jwt_secret:
                raise TithiError(
                    message="JWT secret not configured",
                    code="TITHI_CONFIG_ERROR"
                )
            
            # Decode and validate token
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=['HS256'],
                options={
                    'verify_exp': True,
                    'verify_iat': True,
                    'verify_aud': False  # Supabase doesn't use audience
                }
            )
            
            # Validate required claims
            if not payload.get('sub'):
                raise jwt.InvalidTokenError("Missing user ID in token")
            
            return payload
            
        except jwt.ExpiredSignatureError:
            raise
        except jwt.InvalidTokenError:
            raise
        except Exception as e:
            self.logger.error("Token validation error", exc_info=True)
            raise jwt.InvalidTokenError(f"Token validation failed: {str(e)}")


def require_auth(f):
    """Decorator to require authentication for endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Authentication is handled by middleware
        # This decorator is for explicit documentation
        return f(*args, **kwargs)
    return decorated_function


def require_tenant(f):
    """Decorator to require tenant context for endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'tenant_id') or not g.tenant_id:
            raise AuthorizationError(
                message="Tenant context required",
                code="TITHI_AUTHZ_TENANT_REQUIRED"
            )
        return f(*args, **kwargs)
    return decorated_function


def require_role(required_role: str):
    """Decorator to require specific role for endpoints."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'user_role') or g.user_role != required_role:
                raise AuthorizationError(
                    message=f"Role '{required_role}' required",
                    code="TITHI_AUTHZ_ROLE_REQUIRED"
                )
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def get_current_user() -> Optional[Dict[str, Any]]:
    """Get current authenticated user information."""
    if not hasattr(g, 'user_id') or not g.user_id:
        return None
    
    return {
        'id': g.user_id,
        'email': getattr(g, 'user_email', None),
        'role': getattr(g, 'user_role', 'user'),
        'tenant_id': getattr(g, 'tenant_id', None)
    }


def get_current_tenant() -> Optional[str]:
    """Get current tenant ID."""
    return getattr(g, 'tenant_id', None)


def is_authenticated() -> bool:
    """Check if user is authenticated."""
    return hasattr(g, 'user_id') and g.user_id is not None


def is_tenant_member(tenant_id: str) -> bool:
    """Check if user is member of specific tenant."""
    return (is_authenticated() and 
            hasattr(g, 'tenant_id') and 
            g.tenant_id == tenant_id)
