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
import sentry_sdk
from .sentry_middleware import capture_exception


def emit_error_observability_hook(error: Exception, error_code: str, severity: str = "error"):
    """Emit ERROR_REPORTED observability hook for monitoring."""
    try:
        # Emit structured log for observability
        current_app.logger.info("ERROR_REPORTED", extra={
            "event_type": "ERROR_REPORTED",
            "error_code": error_code,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "severity": severity,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None),
            "request_id": getattr(g, "request_id", None),
            "url": request.url if request else None,
            "method": request.method if request else None
        })
        
        # Send alert if critical, high, or medium error
        if hasattr(current_app, 'alerting_service') and severity in ['critical', 'high', 'medium']:
            from ..services.alerting_service import AlertType, AlertSeverity, Alert
            alerting_service = current_app.alerting_service
            
            severity_map = {
                'critical': AlertSeverity.CRITICAL,
                'high': AlertSeverity.HIGH,
                'medium': AlertSeverity.MEDIUM,
                'low': AlertSeverity.LOW
            }
            
            alert = Alert(
                alert_type=AlertType.ERROR_RATE,
                severity=severity_map.get(severity, AlertSeverity.MEDIUM),
                message=f"Error reported: {error_code} - {str(error)}",
                details={
                    'error_code': error_code,
                    'error_type': type(error).__name__,
                    'error_message': str(error),
                    'url': request.url if request else None,
                    'method': request.method if request else None
                },
                tenant_id=getattr(g, "tenant_id", None),
                user_id=getattr(g, "user_id", None)
            )
            alerting_service.send_alert(alert)
            
    except Exception as e:
        # Don't let observability hook failures break error handling
        current_app.logger.error(f"Failed to emit error observability hook: {e}")


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
        # Determine severity based on status code
        severity = "critical" if error.status_code >= 500 else "high" if error.status_code >= 400 else "medium"
        
        # Emit observability hook
        emit_error_observability_hook(error, error.code, severity)
        
        # Capture in Sentry for server errors
        if error.status_code >= 500:
            capture_exception(error, 
                           error_code=error.code,
                           status_code=error.status_code,
                           tenant_id=getattr(g, "tenant_id", None),
                           user_id=getattr(g, "user_id", None))
        
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
        
        # Emit observability hook for alerting
        emit_error_observability_hook(error, error.code, "medium")
        
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
        # Emit observability hook for external service errors
        emit_error_observability_hook(error, error.code, "high")
        
        app.logger.error(f"External service error: {error.code}", extra={
            "error_code": error.code,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None)
        })
        
        return jsonify(error.to_dict()), error.status_code
