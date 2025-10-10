"""
Tithi Backend Middleware

This module contains custom middleware for the Tithi backend application.
Middleware provides cross-cutting concerns like logging, error handling,
tenant resolution, and request processing.

Middleware Components:
- LoggingMiddleware: Request/response logging with structured output
- ErrorHandler: Global error handling with Problem+JSON format
- TenantMiddleware: Tenant resolution and context setting
- AuthMiddleware: JWT authentication and authorization
- RateLimitMiddleware: Rate limiting and quota enforcement
"""

from .auth_middleware import AuthMiddleware, require_auth, require_tenant, require_role, get_current_user, get_current_tenant, is_authenticated, is_tenant_member
from .error_handler import TithiError, ValidationError, TenantError, AuthenticationError, AuthorizationError, BusinessLogicError, ExternalServiceError, register_error_handlers
from .logging_middleware import LoggingMiddleware
from .tenant_middleware import TenantMiddleware
from .audit_middleware import AuditMiddleware, AuditAction, audit_log_action
from .rate_limit_middleware import RateLimitMiddleware, RateLimitExceededError, rate_limit, get_rate_limit_status

__all__ = [
    'AuthMiddleware',
    'require_auth',
    'require_tenant', 
    'require_role',
    'get_current_user',
    'get_current_tenant',
    'is_authenticated',
    'is_tenant_member',
    'TithiError',
    'ValidationError',
    'TenantError',
    'AuthenticationError',
    'AuthorizationError',
    'BusinessLogicError',
    'ExternalServiceError',
    'register_error_handlers',
    'LoggingMiddleware',
    'TenantMiddleware',
    'AuditMiddleware',
    'AuditAction',
    'audit_log_action',
    'RateLimitMiddleware',
    'RateLimitExceededError',
    'rate_limit',
    'get_rate_limit_status'
]
