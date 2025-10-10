"""
Flask Extensions

This module initializes Flask extensions used throughout the application.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import redis
from typing import Optional
from celery import Celery
from app.middleware.sentry_middleware import init_sentry
from app.middleware.metrics_middleware import MetricsMiddleware
from app.middleware.enhanced_logging_middleware import EnhancedLoggingMiddleware

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
cors = CORS()

# Redis client (optional)
redis_client: Optional[redis.Redis] = None

# Celery instance (initialized lazily)
celery: Celery = Celery(__name__)

# Observability middleware
metrics_middleware = MetricsMiddleware()
enhanced_logging_middleware = EnhancedLoggingMiddleware()


def init_redis(app):
    """Initialize Redis client if configured."""
    global redis_client
    
    redis_url = app.config.get('REDIS_URL')
    if redis_url:
        try:
            redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            redis_client.ping()
            app.logger.info("Redis connection established")
        except Exception as e:
            app.logger.warning(f"Redis connection failed: {e}. Caching will be disabled.")
            redis_client = None
    else:
        app.logger.info("Redis not configured. Caching will be disabled.")


def get_redis():
    """Get Redis client instance."""
    return redis_client


def init_celery(app):
    """Bind Flask app config and context to Celery instance."""
    global celery
    celery.conf.update(
        broker_url=app.config.get('CELERY_BROKER_URL'),
        result_backend=app.config.get('CELERY_RESULT_BACKEND'),
        task_serializer='json',
        accept_content=['json'],
        result_serializer='json',
        timezone='UTC',
        enable_utc=True,
        task_routes={},
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask


def init_app(app):
    """Initialize all extensions with Flask app."""
    # Initialize core extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app)
    
    # Initialize Redis
    init_redis(app)
    
    # Initialize Celery
    init_celery(app)
    
    # Initialize observability stack
    init_sentry(app)
    metrics_middleware.init_app(app)
    enhanced_logging_middleware.init_app(app)
