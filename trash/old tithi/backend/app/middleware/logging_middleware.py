"""
Logging Middleware

This middleware provides structured logging for all HTTP requests and responses.
It captures request metadata, processing time, and error information for
observability and debugging purposes.

Features:
- Structured JSON logging
- Request/response correlation IDs
- Performance metrics
- Error tracking
- Tenant context logging
"""

import time
import uuid
import logging
from typing import Dict, Any
from flask import request, g, current_app
from werkzeug.wsgi import ClosingIterator


class LoggingMiddleware:
    """Middleware for structured request/response logging."""
    
    def __init__(self, app):
        self.app = app
        self.logger = logging.getLogger(__name__)
    
    def __call__(self, environ, start_response):
        """Process request and response with logging."""
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Start timing
        start_time = time.time()
        
        # Log request
        self._log_request(environ, request_id)
        
        # Process request
        def new_start_response(status, response_headers, exc_info=None):
            # Calculate processing time
            processing_time = time.time() - start_time
            
            # Log response
            self._log_response(status, response_headers, processing_time, request_id)
            
            return start_response(status, response_headers, exc_info)
        
        # Process the request
        return ClosingIterator(
            self.app(environ, new_start_response),
            self._cleanup
        )
    
    def _log_request(self, environ, request_id: str):
        """Log incoming request."""
        request_data = {
            "request_id": request_id,
            "method": environ.get("REQUEST_METHOD"),
            "path": environ.get("PATH_INFO"),
            "query_string": environ.get("QUERY_STRING"),
            "user_agent": environ.get("HTTP_USER_AGENT"),
            "remote_addr": environ.get("REMOTE_ADDR"),
            "content_length": environ.get("CONTENT_LENGTH"),
            "content_type": environ.get("CONTENT_TYPE")
        }
        
        # Add tenant context if available (only if in app context)
        try:
            if hasattr(g, "tenant_id"):
                request_data["tenant_id"] = str(g.tenant_id)
            
            if hasattr(g, "user_id"):
                request_data["user_id"] = str(g.user_id)
        except RuntimeError:
            # Working outside of application context, skip tenant context
            pass
        
        self.logger.info("Request received", extra=request_data)
    
    def _log_response(self, status: str, response_headers: list, processing_time: float, request_id: str):
        """Log outgoing response."""
        status_code = int(status.split()[0])
        
        response_data = {
            "request_id": request_id,
            "status_code": status_code,
            "processing_time_ms": round(processing_time * 1000, 2),
            "content_length": self._get_content_length(response_headers)
        }
        
        # Add tenant context if available (only if in app context)
        try:
            if hasattr(g, "tenant_id"):
                response_data["tenant_id"] = str(g.tenant_id)
            
            if hasattr(g, "user_id"):
                response_data["user_id"] = str(g.user_id)
        except RuntimeError:
            # Working outside of application context, skip tenant context
            pass
        
        # Log level based on status code
        if status_code >= 500:
            self.logger.error("Request completed with server error", extra=response_data)
        elif status_code >= 400:
            self.logger.warning("Request completed with client error", extra=response_data)
        else:
            self.logger.info("Request completed successfully", extra=response_data)
    
    def _get_content_length(self, response_headers: list) -> int:
        """Extract content length from response headers."""
        for header, value in response_headers:
            if header.lower() == "content-length":
                try:
                    return int(value)
                except ValueError:
                    return 0
        return 0
    
    def _cleanup(self):
        """Cleanup after request processing."""
        # Remove request context - handle Flask context properly
        try:
            if hasattr(g, "request_id"):
                delattr(g, "request_id")
        except RuntimeError:
            # Ignore context errors during cleanup
            pass
