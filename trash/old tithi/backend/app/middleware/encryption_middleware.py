"""
Encryption Middleware
Automatically encrypts/decrypts PII fields in API requests and responses
"""

from flask import request, g, jsonify
import structlog
from app.services.encryption_service import pii_field_manager
from app.models.base import BaseModel

logger = structlog.get_logger(__name__)


class EncryptionMiddleware:
    """Middleware for automatic PII field encryption/decryption."""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the middleware with Flask app."""
        app.before_request(self.before_request)
        app.after_request(self.after_request)
    
    def before_request(self):
        """Decrypt PII fields in incoming requests."""
        try:
            # Only process JSON requests
            if not request.is_json:
                return
            
            # Get model name from request context
            model_name = getattr(g, 'current_model', None)
            if not model_name:
                return
            
            # Decrypt PII fields in request data
            if request.json:
                decrypted_data = pii_field_manager.decrypt_model_data(model_name, request.json)
                request.json.update(decrypted_data)
            
            logger.debug("PII fields decrypted for request", 
                        model_name=model_name,
                        endpoint=request.endpoint)
            
        except Exception as e:
            logger.error("Failed to decrypt PII fields", error=str(e))
            # Continue processing even if decryption fails
    
    def after_request(self, response):
        """Encrypt PII fields in outgoing responses."""
        try:
            # Only process JSON responses
            if not response.is_json:
                return response
            
            # Get model name from request context
            model_name = getattr(g, 'current_model', None)
            if not model_name:
                return response
            
            # Get response data
            response_data = response.get_json()
            if not response_data:
                return response
            
            # Encrypt PII fields in response data
            if isinstance(response_data, dict):
                encrypted_data = pii_field_manager.encrypt_model_data(model_name, response_data)
                response.set_data(jsonify(encrypted_data).get_data())
            elif isinstance(response_data, list):
                encrypted_list = []
                for item in response_data:
                    if isinstance(item, dict):
                        encrypted_item = pii_field_manager.encrypt_model_data(model_name, item)
                        encrypted_list.append(encrypted_item)
                    else:
                        encrypted_list.append(item)
                response.set_data(jsonify(encrypted_list).get_data())
            
            logger.debug("PII fields encrypted for response", 
                        model_name=model_name,
                        endpoint=request.endpoint)
            
            return response
            
        except Exception as e:
            logger.error("Failed to encrypt PII fields", error=str(e))
            return response


class EncryptedModelMixin:
    """Mixin for models that need automatic PII encryption."""
    
    def to_dict(self, encrypt_pii=True):
        """Convert model to dictionary with optional PII encryption."""
        data = super().to_dict()
        
        if encrypt_pii:
            model_name = self.__class__.__name__.lower()
            data = pii_field_manager.encrypt_model_data(model_name, data)
        
        return data
    
    @classmethod
    def from_dict(cls, data, decrypt_pii=True):
        """Create model from dictionary with optional PII decryption."""
        if decrypt_pii:
            model_name = cls.__name__.lower()
            data = pii_field_manager.decrypt_model_data(model_name, data)
        
        return super().from_dict(data)
    
    def save(self, encrypt_pii=True):
        """Save model with optional PII encryption."""
        if encrypt_pii:
            model_name = self.__class__.__name__.lower()
            data = self.to_dict(encrypt_pii=False)
            encrypted_data = pii_field_manager.encrypt_model_data(model_name, data)
            
            # Update model attributes with encrypted data
            for key, value in encrypted_data.items():
                if hasattr(self, key):
                    setattr(self, key, value)
        
        return super().save()
    
    @classmethod
    def search_by_pii(cls, field_name, value):
        """Search for records by PII field using hash."""
        model_name = cls.__name__.lower()
        search_hash = pii_field_manager.create_search_hash(model_name, field_name, value)
        
        # This would need to be implemented based on your database setup
        # For now, return a placeholder
        return cls.query.filter(getattr(cls, f"{field_name}_hash") == search_hash).all()


# Helper functions for use in views
def encrypt_pii_data(model_name: str, data: dict) -> dict:
    """Encrypt PII data for a specific model."""
    return pii_field_manager.encrypt_model_data(model_name, data)


def decrypt_pii_data(model_name: str, data: dict) -> dict:
    """Decrypt PII data for a specific model."""
    return pii_field_manager.decrypt_model_data(model_name, data)


def create_pii_search_hash(model_name: str, field_name: str, value: str) -> str:
    """Create a searchable hash for PII field."""
    return pii_field_manager.create_search_hash(model_name, field_name, value)