"""
Configuration Management

This module provides configuration classes for different environments
(development, testing, production) with proper environment variable
handling and validation.

Features:
- Environment-specific configurations
- Environment variable validation
- Secure defaults
- 12-factor app compliance
"""

import os
from typing import Optional


class Config:
    """Base configuration class."""
    
    # Basic Flask settings
    SECRET_KEY = os.environ.get("SECRET_KEY")
    DEBUG = False
    TESTING = False
    
    # Database settings
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URI")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # Redis settings
    REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    
    # Availability cache settings
    AVAILABILITY_CACHE_TTL = int(os.environ.get("AVAILABILITY_CACHE_TTL", "300"))  # 5 minutes
    AVAILABILITY_CACHE_PREFIX = "tithi:availability"
    BOOKING_HOLD_TTL = int(os.environ.get("BOOKING_HOLD_TTL", "900"))  # 15 minutes
    WAITLIST_NOTIFICATION_TTL = int(os.environ.get("WAITLIST_NOTIFICATION_TTL", "3600"))  # 1 hour
    
    # Celery settings
    CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    
    # External service settings
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
    
    # Logging settings
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    LOG_FORMAT = os.environ.get("LOG_FORMAT", "json")
    
    # Security settings
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", "3600"))
    SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET") or JWT_SECRET_KEY
    
    # External service settings
    STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")
    STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
    
    # Email settings
    MAIL_SERVER = os.environ.get("MAIL_SERVER")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() in ["true", "on", "1"]
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER")
    
    # SMS settings
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER")
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "svg", "webp"}
    
    # Rate limiting
    RATELIMIT_STORAGE_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/1")
    RATELIMIT_DEFAULT = "100 per minute"
    
    # CORS settings
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
    
    # Monitoring
    SENTRY_DSN = os.environ.get("SENTRY_DSN")
    
    @staticmethod
    def validate_required_config():
        """Validate that all required configuration is present."""
        required_vars = {
            "SECRET_KEY": Config.SECRET_KEY,
            "SQLALCHEMY_DATABASE_URI": Config.SQLALCHEMY_DATABASE_URI,
            "SUPABASE_URL": Config.SUPABASE_URL,
            "SUPABASE_KEY": Config.SUPABASE_KEY,
        }
        
        missing_vars = [var for var, value in required_vars.items() if not value]
        
        if missing_vars:
            raise ValueError(
                f"TITHI_BOOT_FAILURE: Configuration validation failed: "
                f"- Missing required environment variables: {', '.join(missing_vars)}"
            )


class DevelopmentConfig(Config):
    """Development configuration."""
    
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DEV_DATABASE_URL") or "sqlite:///dev.db"
    LOG_LEVEL = "DEBUG"


class TestingConfig(Config):
    """Testing configuration."""
    
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
    LOG_LEVEL = "WARNING"


class ProductionConfig(Config):
    """Production configuration."""
    
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    LOG_LEVEL = "INFO"
    
    @classmethod
    def init_app(cls, app):
        """Initialize production app."""
        Config.init_app(app)
        
        # Validate required configuration
        cls.validate_required_config()


class StagingConfig(ProductionConfig):
    """Staging configuration."""
    
    DEBUG = False
    LOG_LEVEL = "DEBUG"


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "staging": StagingConfig,
    "default": DevelopmentConfig
}


def get_config(config_name: Optional[str] = None):
    """
    Get configuration class by name.
    
    Args:
        config_name: Configuration name
        
    Returns:
        Configuration class
    """
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "default")
    
    return config.get(config_name, config["default"])
