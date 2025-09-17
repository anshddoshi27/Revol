"""
Error Handler Middleware

This module provides comprehensive error handling for the Tithi backend
with structured error responses following RFC 7807 (Problem+JSON) format.

Features:
- Custom exception classes
- Structured error responses
- Error logging and monitoring
- Tenant context in errors
- Consistent error codes
"""

import logging
from typing import Optional, Dict, Any, List
from flask import request, g, current_app, jsonify


class TithiError(Exception):
    """Base exception class for Tithi application errors."""
    
    def __init__(self, message: str, code: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for JSON response."""
        return {
            "type": f"https://tithi.com/errors/{self.code.lower()}",
            "title": self.__class__.__name__,
            "detail": self.message,
            "status": self.status_code,
            "code": self.code,
            "details": self.details,
            "instance": request.url if request else None,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        }


class ValidationError(TithiError):
    """Validation error for input validation failures."""
    
    def __init__(self, message: str, code: str = "TITHI_VALIDATION_ERROR", field_errors: Optional[List[Dict[str, str]]] = None):
        super().__init__(message, code, 400)
        self.field_errors = field_errors or []
        self.details = {"field_errors": self.field_errors}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert validation error to dictionary."""
        result = super().to_dict()
        result["details"]["field_errors"] = self.field_errors
        return result


class TenantError(TithiError):
    """Tenant-related error."""
    
    def __init__(self, message: str, code: str = "TITHI_TENANT_ERROR", status_code: int = 404):
        super().__init__(message, code, status_code)


class AuthenticationError(TithiError):
    """Authentication error."""
    
    def __init__(self, message: str, code: str = "TITHI_AUTH_ERROR", status_code: int = 401):
        super().__init__(message, code, status_code)


class AuthorizationError(TithiError):
    """Authorization error."""
    
    def __init__(self, message: str, code: str = "TITHI_AUTHZ_ERROR", status_code: int = 403):
        super().__init__(message, code, status_code)


class BusinessLogicError(TithiError):
    """Business logic error."""
    
    def __init__(self, message: str, code: str = "TITHI_BUSINESS_ERROR", status_code: int = 422):
        super().__init__(message, code, status_code)


class ExternalServiceError(TithiError):
    """External service error."""
    
    def __init__(self, message: str, code: str = "TITHI_EXTERNAL_ERROR", status_code: int = 502):
        super().__init__(message, code, status_code)


def register_error_handlers(app):
    """Register error handlers with Flask application."""
    
    @app.errorhandler(TithiError)
    def handle_tithi_error(error: TithiError):
        """Handle custom Tithi errors."""
        app.logger.error(f"Tithi error: {error.code}", extra={
            "error_code": error.code,
            "error_message": error.message,
            "status_code": error.status_code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None),
            "request_id": getattr(g, "request_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(ValidationError)
    def handle_validation_error(error: ValidationError):
        """Handle validation errors."""
        app.logger.warning(f"Validation error: {error.code}", extra={
            "error_code": error.code,
            "field_errors": error.field_errors,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(TenantError)
    def handle_tenant_error(error: TenantError):
        """Handle tenant errors."""
        app.logger.warning(f"Tenant error: {error.code}", extra={
            "error_code": error.code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(AuthenticationError)
    def handle_auth_error(error: AuthenticationError):
        """Handle authentication errors."""
        app.logger.warning(f"Authentication error: {error.code}", extra={
            "error_code": error.code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(AuthorizationError)
    def handle_authz_error(error: AuthorizationError):
        """Handle authorization errors."""
        app.logger.warning(f"Authorization error: {error.code}", extra={
            "error_code": error.code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(BusinessLogicError)
    def handle_business_error(error: BusinessLogicError):
        """Handle business logic errors."""
        app.logger.warning(f"Business logic error: {error.code}", extra={
            "error_code": error.code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
    
    @app.errorhandler(ExternalServiceError)
    def handle_external_error(error: ExternalServiceError):
        """Handle external service errors."""
        app.logger.error(f"External service error: {error.code}", extra={
            "error_code": error.code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
