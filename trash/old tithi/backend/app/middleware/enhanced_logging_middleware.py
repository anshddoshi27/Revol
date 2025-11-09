"""
Enhanced Structured Logging Middleware
Provides comprehensive logging with tenant context and request tracing
"""

import structlog
import uuid
import time
from flask import request, g, has_request_context
from datetime import datetime
import json


def configure_structlog():
    """Configure structured logging."""
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            add_request_context,
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def add_request_context(logger, method_name, event_dict):
    """Add request context to log entries."""
    if has_request_context():
        event_dict['request_id'] = getattr(g, 'request_id', None)
        event_dict['tenant_id'] = getattr(g, 'tenant_id', None)
        event_dict['user_id'] = getattr(g, 'user_id', None)
        event_dict['endpoint'] = request.endpoint
        event_dict['method'] = request.method
        event_dict['path'] = request.path
        event_dict['remote_addr'] = request.remote_addr
        event_dict['user_agent'] = request.headers.get('User-Agent', '')
    
    return event_dict


class EnhancedLoggingMiddleware:
    """Enhanced logging middleware with request tracing."""
    
    def __init__(self, app=None):
        self.app = app
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize enhanced logging middleware."""
        configure_structlog()
        
        app.before_request(self.before_request)
        app.after_request(self.after_request)
        
        # Configure Flask logging
        app.logger = structlog.get_logger('tithi')
    
    def before_request(self):
        """Set up request context and tracing."""
        # Generate request ID
        g.request_id = str(uuid.uuid4())
        g.start_time = time.time()
        
        # Log request start
        logger = structlog.get_logger('tithi.request')
        logger.info(
            'Request started',
            request_id=g.request_id,
            method=request.method,
            path=request.path,
            remote_addr=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')
        )
    
    def after_request(self, response):
        """Log request completion."""
        # Calculate duration
        duration = time.time() - g.start_time
        
        # Log request completion
        logger = structlog.get_logger('tithi.request')
        logger.info(
            'Request completed',
            request_id=g.request_id,
            status_code=response.status_code,
            duration_ms=duration * 1000,
            content_length=response.content_length
        )
        
        return response


def get_logger(name: str = 'tithi'):
    """Get structured logger instance."""
    return structlog.get_logger(name)


def log_business_event(event_type: str, **kwargs):
    """Log business event with structured data."""
    logger = structlog.get_logger('tithi.business')
    logger.info(
        f'Business event: {event_type}',
        event_type=event_type,
        **kwargs
    )


def log_security_event(event_type: str, **kwargs):
    """Log security event with structured data."""
    logger = structlog.get_logger('tithi.security')
    logger.warning(
        f'Security event: {event_type}',
        event_type=event_type,
        **kwargs
    )


def log_performance_event(event_type: str, duration_ms: float, **kwargs):
    """Log performance event with structured data."""
    logger = structlog.get_logger('tithi.performance')
    logger.info(
        f'Performance event: {event_type}',
        event_type=event_type,
        duration_ms=duration_ms,
        **kwargs
    )
