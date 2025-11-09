"""
Custom Exceptions for Tithi Platform

This module contains custom exception classes used throughout the application.
"""


class TithiError(Exception):
    """Base exception class for Tithi platform errors."""
    
    def __init__(self, message: str, code: str = "TITHI_ERROR", status_code: int = 500, details: dict = None):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(TithiError):
    """Exception raised for validation errors."""
    
    def __init__(self, message: str, code: str = "TITHI_VALIDATION_ERROR", details: dict = None):
        super().__init__(message, code, 400, details)


class BusinessLogicError(TithiError):
    """Exception raised for business logic errors."""
    
    def __init__(self, message: str, code: str = "TITHI_BUSINESS_ERROR", details: dict = None):
        super().__init__(message, code, 400, details)


class DatabaseError(TithiError):
    """Exception raised for database errors."""
    
    def __init__(self, message: str, code: str = "TITHI_DATABASE_ERROR", details: dict = None):
        super().__init__(message, code, 500, details)


class AuthenticationError(TithiError):
    """Exception raised for authentication errors."""
    
    def __init__(self, message: str, code: str = "TITHI_AUTH_ERROR", details: dict = None):
        super().__init__(message, code, 401, details)


class AuthorizationError(TithiError):
    """Exception raised for authorization errors."""
    
    def __init__(self, message: str, code: str = "TITHI_AUTHORIZATION_ERROR", details: dict = None):
        super().__init__(message, code, 403, details)


class NotFoundError(TithiError):
    """Exception raised when a resource is not found."""
    
    def __init__(self, message: str, code: str = "TITHI_NOT_FOUND", details: dict = None):
        super().__init__(message, code, 404, details)


class ConflictError(TithiError):
    """Exception raised when there's a conflict with the current state."""
    
    def __init__(self, message: str, code: str = "TITHI_CONFLICT", details: dict = None):
        super().__init__(message, code, 409, details)
