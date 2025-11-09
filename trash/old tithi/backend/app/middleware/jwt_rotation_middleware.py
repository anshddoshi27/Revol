"""
JWT Rotation Middleware
Provides automated JWT token rotation and validation
"""

import jwt
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from flask import request, g, current_app
import structlog

logger = structlog.get_logger(__name__)


class JWTRotationService:
    """Service for JWT token rotation and validation."""
    
    def __init__(self, app=None):
        self.app = app
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize JWT rotation service with Flask app."""
        self.secret_key = app.config.get('JWT_SECRET_KEY')
        self.algorithm = app.config.get('JWT_ALGORITHM', 'HS256')
        self.access_token_expires = app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 3600)
        self.refresh_token_expires = app.config.get('JWT_REFRESH_TOKEN_EXPIRES', 86400 * 7)  # 7 days
        self.rotation_threshold = app.config.get('JWT_ROTATION_THRESHOLD', 300)  # 5 minutes
    
    def generate_token_pair(self, user_id: str, tenant_id: str, roles: list) -> Dict[str, str]:
        """Generate access and refresh token pair."""
        now = datetime.utcnow()
        
        # Access token payload
        access_payload = {
            'user_id': user_id,
            'tenant_id': tenant_id,
            'roles': roles,
            'type': 'access',
            'iat': now,
            'exp': now + timedelta(seconds=self.access_token_expires),
            'jti': f"access_{user_id}_{int(now.timestamp())}"
        }
        
        # Refresh token payload
        refresh_payload = {
            'user_id': user_id,
            'tenant_id': tenant_id,
            'type': 'refresh',
            'iat': now,
            'exp': now + timedelta(seconds=self.refresh_token_expires),
            'jti': f"refresh_{user_id}_{int(now.timestamp())}"
        }
        
        access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm=self.algorithm)
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': self.access_token_expires
        }
    
    def validate_token(self, token: str, token_type: str = 'access') -> Optional[Dict[str, Any]]:
        """Validate JWT token and return payload."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Check token type
            if payload.get('type') != token_type:
                logger.warning(f"Invalid token type: expected {token_type}, got {payload.get('type')}")
                return None
            
            # Check expiration
            if payload.get('exp', 0) < time.time():
                logger.warning("Token has expired")
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
    
    def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """Generate new access token from refresh token."""
        payload = self.validate_token(refresh_token, 'refresh')
        if not payload:
            return None
        
        # Generate new token pair
        return self.generate_token_pair(
            payload['user_id'],
            payload['tenant_id'],
            payload.get('roles', [])
        )
    
    def should_rotate_token(self, token_payload: Dict[str, Any]) -> bool:
        """Check if token should be rotated based on time threshold."""
        iat = token_payload.get('iat', 0)
        exp = token_payload.get('exp', 0)
        
        # Calculate token age
        token_age = time.time() - iat
        token_lifetime = exp - iat
        
        # Rotate if token is close to expiration
        return token_age > (token_lifetime - self.rotation_threshold)
    
    def extract_token_from_request(self) -> Optional[str]:
        """Extract JWT token from request headers."""
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            return auth_header[7:]  # Remove 'Bearer ' prefix
        return None


# Global JWT rotation service instance
jwt_rotation_service = JWTRotationService()


def get_jwt_service():
    """Get the global JWT rotation service instance."""
    return jwt_rotation_service


def validate_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Convenience function to validate JWT token."""
    return jwt_rotation_service.validate_token(token)


def generate_token_pair(user_id: str, tenant_id: str, roles: list) -> Dict[str, str]:
    """Convenience function to generate token pair."""
    return jwt_rotation_service.generate_token_pair(user_id, tenant_id, roles)
