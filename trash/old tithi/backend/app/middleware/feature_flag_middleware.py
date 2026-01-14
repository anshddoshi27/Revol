"""
Feature Flag Middleware
Automatically evaluates feature flags for requests and adds context
"""

from flask import request, g
import structlog
from app.services.feature_flag_service import feature_flag_service

logger = structlog.get_logger(__name__)


class FeatureFlagMiddleware:
    """Middleware for feature flag evaluation."""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the middleware with Flask app."""
        app.before_request(self.before_request)
        app.after_request(self.after_request)
    
    def before_request(self):
        """Evaluate feature flags before request processing."""
        try:
            # Get user and tenant from request context
            user_id = getattr(g, 'current_user_id', None)
            tenant_id = getattr(g, 'current_tenant_id', None)
            
            if not user_id or not tenant_id:
                return
            
            # Get all active feature flags
            active_flags = self._get_active_feature_flags()
            
            # Evaluate flags and store in request context
            g.feature_flags = {}
            g.feature_flag_context = {
                'user_id': user_id,
                'tenant_id': tenant_id,
                'request_id': getattr(g, 'request_id', None)
            }
            
            for flag_name in active_flags:
                enabled, variant, config = feature_flag_service.get_feature_flag(
                    flag_name, user_id, tenant_id
                )
                
                g.feature_flags[flag_name] = {
                    'enabled': enabled,
                    'variant': variant,
                    'config': config
                }
            
            logger.debug("Feature flags evaluated", 
                        user_id=user_id, 
                        tenant_id=tenant_id,
                        flags_count=len(g.feature_flags))
            
        except Exception as e:
            logger.error("Failed to evaluate feature flags", error=str(e))
            # Set empty feature flags on error
            g.feature_flags = {}
    
    def after_request(self, response):
        """Add feature flag headers to response."""
        try:
            if hasattr(g, 'feature_flags'):
                # Add feature flag information to response headers
                enabled_flags = [name for name, data in g.feature_flags.items() if data['enabled']]
                if enabled_flags:
                    response.headers['X-Feature-Flags'] = ','.join(enabled_flags)
                
                # Add variant information
                variants = {name: data['variant'] for name, data in g.feature_flags.items() 
                          if data['enabled'] and data['variant'] != 'control'}
                if variants:
                    variant_str = ','.join([f"{name}:{variant}" for name, variant in variants.items()])
                    response.headers['X-Feature-Variants'] = variant_str
            
            return response
            
        except Exception as e:
            logger.error("Failed to add feature flag headers", error=str(e))
            return response
    
    def _get_active_feature_flags(self):
        """Get list of active feature flag names."""
        # This would typically be cached and refreshed periodically
        # For now, return a hardcoded list of common flags
        return [
            'new_booking_flow',
            'enhanced_notifications',
            'advanced_analytics',
            'mobile_app_features',
            'payment_optimization',
            'loyalty_program',
            'promotion_engine',
            'multi_location_support'
        ]


# Helper functions for use in views
def is_feature_enabled(flag_name: str) -> bool:
    """Check if a feature flag is enabled for the current request."""
    if not hasattr(g, 'feature_flags'):
        return False
    
    flag_data = g.feature_flags.get(flag_name)
    return flag_data['enabled'] if flag_data else False


def get_feature_variant(flag_name: str) -> str:
    """Get the variant for a feature flag."""
    if not hasattr(g, 'feature_flags'):
        return 'control'
    
    flag_data = g.feature_flags.get(flag_name)
    return flag_data['variant'] if flag_data else 'control'


def get_feature_config(flag_name: str) -> dict:
    """Get the configuration for a feature flag."""
    if not hasattr(g, 'feature_flags'):
        return {}
    
    flag_data = g.feature_flags.get(flag_name)
    return flag_data['config'] if flag_data else {}


def require_feature(flag_name: str):
    """Decorator to require a feature flag for a view."""
    def decorator(f):
        def decorated_function(*args, **kwargs):
            if not is_feature_enabled(flag_name):
                from flask import abort
                abort(404)  # Feature not available
            return f(*args, **kwargs)
        decorated_function.__name__ = f.__name__
        return decorated_function
    return decorator
