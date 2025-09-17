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

# Import models to ensure they are registered with SQLAlchemy
from . import models  # noqa: F401

# Import all model modules to ensure they are registered
from .models import core, business, financial, system, analytics  # noqa: F401


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
    
    return app


def initialize_extensions(app: Flask) -> None:
    """Initialize Flask extensions."""
    
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
    
    # Authentication middleware
    auth_middleware = AuthMiddleware()
    auth_middleware.init_app(app)


def register_blueprints(app: Flask) -> None:
    """Register application blueprints."""
    
    # Health check blueprint
    from .blueprints.health import health_bp
    app.register_blueprint(health_bp, url_prefix='/health')
    
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
    app.register_blueprint(notification_bp, url_prefix='/api/v1/notifications')
    
    # Analytics blueprint
    from .blueprints.analytics_api import analytics_bp
    app.register_blueprint(analytics_bp, url_prefix='/api/v1/analytics')


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
        app.logger.error("Unhandled exception", exc_info=True, extra={
            "error": str(e),
            "error_type": type(e).__name__
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
