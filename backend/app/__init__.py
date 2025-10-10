"""
Tithi Backend Application Factory

This module provides the Flask application factory pattern for creating
the Tithi backend application with proper configuration, extensions,
middleware, and blueprint registration.

Features:
- Environment-specific configuration
- Extension initialization
- Middleware registration
- Blueprint registration
- Error handling setup
- Database initialization
"""

import os
import logging
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .config import Config, get_config
from .extensions import db, migrate, cors, init_redis
from .middleware.error_handler import register_error_handlers
from .middleware.logging_middleware import LoggingMiddleware
from .middleware.tenant_middleware import TenantMiddleware
from .middleware.auth_middleware import AuthMiddleware
from .middleware.rate_limit_middleware import RateLimitMiddleware
from .middleware.idempotency import idempotency_middleware
from .middleware.sentry_middleware import init_sentry
from .services.alerting_service import AlertingService

# Import models to ensure they are registered with SQLAlchemy
from . import models  # noqa: F401

# Import all model modules to ensure they are registered
from .models import core, business, financial, system, analytics, automation  # noqa: F401


def create_app(config_name=None):
    """
    Create and configure Flask application.
    
    Args:
        config_name: Configuration name (development, testing, production)
    
    Returns:
        Configured Flask application
    """
    app = Flask(__name__)
    
    # Load configuration
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Initialize Sentry early (before other extensions)
    init_sentry(app)
    
    # Initialize extensions
    initialize_extensions(app)
    
    # Register middleware
    register_middleware(app)
    
    # Register blueprints
    register_blueprints(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Setup logging
    setup_logging(app)
    
    # Create API documentation
    create_api_documentation(app)
    
    # Initialize Celery when enabled
    from .extensions import init_celery
    enable_in_tests = os.environ.get("ENABLE_CELERY_IN_TESTS", "false").lower() in ["1", "true", "yes"]
    if not app.testing or enable_in_tests:
        init_celery(app)
    
    return app


def initialize_extensions(app: Flask) -> None:
    """Initialize Flask extensions."""
    
    # Alerting Service (Error Monitoring & Alerts - Task 11.5)
    alerting_service = AlertingService()
    alerting_service.init_app(app)
    app.alerting_service = alerting_service
    
    # Database
    db.init_app(app)
    migrate.init_app(app, db)
    
    # CORS
    cors.init_app(app, resources={
        r"/api/*": {"origins": "*"},
        r"/v1/*": {"origins": "*"},
        r"/health/*": {"origins": "*"}
    })
    
    # Redis
    init_redis(app)


def register_middleware(app: Flask) -> None:
    """Register custom middleware."""
    
    # Logging middleware
    app.wsgi_app = LoggingMiddleware(app.wsgi_app)
    
    # Tenant resolution middleware
    app.wsgi_app = TenantMiddleware(app.wsgi_app)
    
    # Rate limiting middleware
    rate_limit_middleware = RateLimitMiddleware()
    rate_limit_middleware.init_app(app)
    
    # Authentication middleware
    auth_middleware = AuthMiddleware()
    auth_middleware.init_app(app)
    
    # Idempotency middleware
    idempotency_middleware.init_app(app)


def register_blueprints(app: Flask) -> None:
    """Register application blueprints."""
    
    # Health check blueprint
    from .blueprints.health import health_bp
    app.register_blueprint(health_bp, url_prefix='/health')
    
    # Auth blueprint
    from .blueprints.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')
    
    # API v1 blueprint
    from .blueprints.api_v1 import api_v1_bp
    app.register_blueprint(api_v1_bp, url_prefix='/api/v1')
    
    # Public blueprint
    from .blueprints.public import public_bp
    app.register_blueprint(public_bp, url_prefix='/v1')
    
    # Calendar integration blueprint
    from .blueprints.calendar_api import calendar_bp
    app.register_blueprint(calendar_bp, url_prefix='/api/v1/calendar')
    
    # Enhanced notification blueprint
    from .blueprints.notification_api import notification_bp
    app.register_blueprint(notification_bp, url_prefix='/notifications')
    
    # Analytics blueprint
    from .blueprints.analytics_api import analytics_bp
    app.register_blueprint(analytics_bp, url_prefix='/api/v1/analytics')
    
    # Onboarding blueprint
    from .blueprints.onboarding import onboarding_bp
    app.register_blueprint(onboarding_bp, url_prefix='/onboarding')
    
    # Payment API blueprint
    from .blueprints.payment_api import payment_bp
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    
    from .blueprints.promotion_api import promotion_bp
    app.register_blueprint(promotion_bp, url_prefix='/api/promotions')
    
    # CRM API blueprint (Module K)
    from .blueprints.crm_api import crm_bp
    app.register_blueprint(crm_bp, url_prefix='/api/v1/crm')
    
    # Admin Dashboard API blueprint (Module M)
    from .blueprints.admin_dashboard_api import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/v1/admin')
    
    # Loyalty API blueprint (Task 6.2)
    from .blueprints.loyalty_api import loyalty_bp
    app.register_blueprint(loyalty_bp)
    
    # Email API blueprint (Task 7.1)
    from .blueprints.email_api import email_bp
    app.register_blueprint(email_bp, url_prefix='/api/v1')
    
    # SMS API blueprint (Task 7.2)
    from .blueprints.sms_api import sms_bp
    app.register_blueprint(sms_bp)
    
    # Automation API blueprint (Task 7.3)
    from .blueprints.automation_api import automation_bp
    app.register_blueprint(automation_bp, url_prefix='/api/v1')
    
    # Timezone API blueprint (Task 11.3)
    from .blueprints.timezone_api import timezone_bp
    app.register_blueprint(timezone_bp)
    
    # Idempotency API blueprint (Task 11.4)
    from .blueprints.idempotency_api import idempotency_bp
    app.register_blueprint(idempotency_bp)
    


def register_error_handlers(app: Flask) -> None:
    """Register global error handlers."""
    
    # Import the error handler registration function
    from .middleware.error_handler import register_error_handlers as register_custom_error_handlers
    
    # Register custom error handlers
    register_custom_error_handlers(app)
    
    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        """Handle HTTP exceptions with Problem+JSON format."""
        return jsonify({
            "type": "https://tithi.com/errors/http",
            "title": e.name,
            "detail": e.description,
            "status": e.code,
            "code": f"TITHI_HTTP_{e.code}"
        }), e.code
    
    @app.errorhandler(Exception)
    def handle_generic_exception(e):
        """Handle unexpected exceptions."""
        # Import here to avoid circular imports
        from flask import g
        from .middleware.sentry_middleware import capture_exception
        from .middleware.error_handler import emit_error_observability_hook
        
        # Emit observability hook
        emit_error_observability_hook(e, "TITHI_INTERNAL_ERROR", "critical")
        
        # Capture in Sentry
        capture_exception(e, 
                        error_code="TITHI_INTERNAL_ERROR",
                        error_type=type(e).__name__,
                        tenant_id=getattr(g, "tenant_id", None),
                        user_id=getattr(g, "user_id", None))
        
        app.logger.error("Unhandled exception", exc_info=True, extra={
            "error": str(e),
            "error_type": type(e).__name__,
            "tenant_id": getattr(g, "tenant_id", None),
            "user_id": getattr(g, "user_id", None),
            "request_id": getattr(g, "request_id", None)
        })
        
        return jsonify({
            "type": "https://tithi.com/errors/internal",
            "title": "Internal Server Error",
            "detail": "An unexpected error occurred",
            "status": 500,
            "code": "TITHI_INTERNAL_ERROR"
        }), 500


def setup_logging(app: Flask) -> None:
    """Setup application logging."""
    
    if not app.debug and not app.testing:
        # Configure production logging
        if not os.path.exists('logs'):
            os.mkdir('logs')
        
        file_handler = logging.FileHandler('logs/tithi.log')
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        
        app.logger.setLevel(logging.INFO)
        app.logger.info('Tithi backend startup')


def create_api_documentation(app: Flask) -> None:
    """Create API documentation using Flask-Smorest."""
    
    from flask_smorest import Api
    
    api = Api(
        app,
        spec_kwargs={
            "title": "Tithi Backend API",
            "version": "1.0.0",
            "description": "Multi-tenant salon booking platform API",
            "openapi_version": "3.0.2"
        }
    )
    app.api = api
