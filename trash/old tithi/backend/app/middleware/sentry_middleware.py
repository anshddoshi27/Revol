"""
Sentry Integration Middleware
Provides error tracking and performance monitoring
"""

import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from flask import request, g
import structlog

logger = structlog.get_logger(__name__)


def init_sentry(app):
    """Initialize Sentry SDK with Flask app."""
    if app.config.get('SENTRY_DSN'):
        sentry_sdk.init(
            dsn=app.config['SENTRY_DSN'],
            integrations=[
                FlaskIntegration(),
                SqlalchemyIntegration(),
                RedisIntegration(),
                CeleryIntegration(),
            ],
            traces_sample_rate=app.config.get('SENTRY_TRACES_SAMPLE_RATE', 0.1),
            profiles_sample_rate=app.config.get('SENTRY_PROFILES_SAMPLE_RATE', 0.1),
            environment=app.config.get('ENVIRONMENT', 'development'),
            release=app.config.get('RELEASE_VERSION', 'unknown'),
            before_send=before_send_filter,
            # Fix for Python 3.13 FrameLocalsProxy serialization issue
            max_breadcrumbs=50,
            attach_stacktrace=True,
            send_default_pii=False,
            # Disable problematic frame serialization
            include_local_variables=False,
        )
        
        # Set user context
        @app.before_request
        def set_sentry_context():
            if hasattr(g, 'current_user') and g.current_user:
                sentry_sdk.set_user({
                    'id': str(g.current_user.id),
                    'email': getattr(g.current_user, 'email', None),
                })
            
            if hasattr(g, 'current_tenant') and g.current_tenant:
                sentry_sdk.set_tag('tenant_id', str(g.current_tenant.id))
                sentry_sdk.set_context('tenant', {
                    'id': str(g.current_tenant.id),
                    'slug': g.current_tenant.slug,
                })


def before_send_filter(event, hint):
    """Filter sensitive data from Sentry events."""
    # Comprehensive PII field patterns (case-insensitive)
    # Note: email is handled separately in user context
    pii_patterns = [
        'password', 'passwd', 'pwd',
        'token', 'access_token', 'refresh_token', 'api_token',
        'secret', 'secret_key', 'private_key', 'api_key',
        'key', 'auth_key', 'session_key',
        'authorization', 'auth', 'bearer',
        'cookie', 'session', 'sessionid',
        'x-api-key', 'x-auth-token', 'x-access-token',
        'credit_card', 'card_number', 'cvv', 'cvc',
        'ssn', 'social_security', 'tax_id',
        'phone', 'mobile', 'telephone',
        'address', 'street', 'zip', 'postal',
        'name', 'first_name', 'last_name', 'full_name',
        'dob', 'date_of_birth', 'birth_date'
    ]
    
    # Recursive function to scrub nested data
    def scrub_data(data, patterns):
        if isinstance(data, dict):
            scrubbed = {}
            for key, value in data.items():
                # Check if key matches any PII pattern (case-insensitive)
                if any(pattern.lower() in key.lower() for pattern in patterns):
                    scrubbed[key] = '[REDACTED]'
                else:
                    scrubbed[key] = scrub_data(value, patterns)
            return scrubbed
        elif isinstance(data, list):
            return [scrub_data(item, patterns) for item in data]
        else:
            return data
    
    # Scrub request data
    if 'request' in event:
        if 'data' in event['request']:
            event['request']['data'] = scrub_data(event['request']['data'], pii_patterns)
        
        # Scrub headers (case-insensitive)
        if 'headers' in event['request']:
            scrubbed_headers = {}
            for header_name, header_value in event['request']['headers'].items():
                if any(pattern.lower() in header_name.lower() for pattern in pii_patterns):
                    scrubbed_headers[header_name] = '[REDACTED]'
                else:
                    scrubbed_headers[header_name] = header_value
            event['request']['headers'] = scrubbed_headers
    
    # Scrub user context
    if 'user' in event:
        user_data = event['user']
        if 'email' in user_data:
            user_data['email'] = '[REDACTED]'
        if 'username' in user_data:
            user_data['username'] = '[REDACTED]'
    
    # Scrub tags (but preserve tenant_id as it's not PII)
    if 'tags' in event:
        sensitive_tags = ['email', 'phone', 'user_id']
        for tag_name, tag_value in event['tags'].items():
            if tag_name.lower() in sensitive_tags:
                event['tags'][tag_name] = '[REDACTED]'
    
    return event


def capture_exception(exception, **kwargs):
    """Capture exception with additional context."""
    with sentry_sdk.push_scope() as scope:
        for key, value in kwargs.items():
            scope.set_extra(key, value)
        sentry_sdk.capture_exception(exception)


def capture_message(message, level='info', **kwargs):
    """Capture message with additional context."""
    with sentry_sdk.push_scope() as scope:
        for key, value in kwargs.items():
            scope.set_extra(key, value)
        sentry_sdk.capture_message(message, level=level)
