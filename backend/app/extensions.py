"""
Flask Extensions

This module initializes Flask extensions used throughout the application.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import redis
from typing import Optional

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
cors = CORS()

# Redis client (optional)
redis_client: Optional[redis.Redis] = None


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
