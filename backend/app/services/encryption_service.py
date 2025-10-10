"""
Field-Level Encryption Service
Provides encryption/decryption for sensitive PII data
"""

import os
import base64
import json
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Dict, Any, Optional, Union
import structlog

logger = structlog.get_logger(__name__)


class EncryptionService:
    """Service for field-level encryption of sensitive data."""
    
    def __init__(self):
        self.master_key = os.getenv('ENCRYPTION_MASTER_KEY')
        self.salt = os.getenv('ENCRYPTION_SALT', 'tithi_salt_2024').encode()
        
        if not self.master_key:
            raise ValueError("ENCRYPTION_MASTER_KEY environment variable is required")
        
        # Derive encryption key from master key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key.encode()))
        self.cipher = Fernet(key)
    
    def encrypt_field(self, data: Union[str, Dict, Any]) -> str:
        """Encrypt a field value."""
        try:
            # Convert to JSON string if not already string
            if isinstance(data, (dict, list)):
                data_str = json.dumps(data)
            else:
                data_str = str(data)
            
            # Encrypt the data
            encrypted_data = self.cipher.encrypt(data_str.encode())
            
            # Return base64 encoded encrypted data
            return base64.urlsafe_b64encode(encrypted_data).decode()
            
        except Exception as e:
            logger.error("Failed to encrypt field", error=str(e))
            raise
    
    def decrypt_field(self, encrypted_data: str) -> Union[str, Dict, Any]:
        """Decrypt a field value."""
        try:
            # Decode base64
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            
            # Decrypt the data
            decrypted_data = self.cipher.decrypt(encrypted_bytes)
            
            # Try to parse as JSON, fallback to string
            try:
                return json.loads(decrypted_data.decode())
            except json.JSONDecodeError:
                return decrypted_data.decode()
                
        except Exception as e:
            logger.error("Failed to decrypt field", error=str(e))
            raise
    
    def encrypt_pii_fields(self, data: Dict[str, Any], pii_fields: list) -> Dict[str, Any]:
        """Encrypt specified PII fields in a dictionary."""
        try:
            encrypted_data = data.copy()
            
            for field in pii_fields:
                if field in encrypted_data and encrypted_data[field] is not None:
                    encrypted_data[field] = self.encrypt_field(encrypted_data[field])
            
            return encrypted_data
            
        except Exception as e:
            logger.error("Failed to encrypt PII fields", error=str(e))
            raise
    
    def decrypt_pii_fields(self, data: Dict[str, Any], pii_fields: list) -> Dict[str, Any]:
        """Decrypt specified PII fields in a dictionary."""
        try:
            decrypted_data = data.copy()
            
            for field in pii_fields:
                if field in decrypted_data and decrypted_data[field] is not None:
                    decrypted_data[field] = self.decrypt_field(decrypted_data[field])
            
            return decrypted_data
            
        except Exception as e:
            logger.error("Failed to decrypt PII fields", error=str(e))
            raise
    
    def hash_field(self, data: str, salt: Optional[str] = None) -> str:
        """Create a one-way hash of a field (for searching)."""
        try:
            if salt is None:
                salt = self.salt.decode()
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt.encode(),
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(data.encode()))
            return key.decode()
            
        except Exception as e:
            logger.error("Failed to hash field", error=str(e))
            raise
    
    def verify_field(self, data: str, hashed_data: str, salt: Optional[str] = None) -> bool:
        """Verify a field against its hash."""
        try:
            computed_hash = self.hash_field(data, salt)
            return computed_hash == hashed_data
            
        except Exception as e:
            logger.error("Failed to verify field", error=str(e))
            return False


class PIIFieldManager:
    """Manager for PII field encryption/decryption."""
    
    # Define PII fields for each model
    PII_FIELDS = {
        'customers': [
            'email',
            'phone',
            'address',
            'emergency_contact_name',
            'emergency_contact_phone',
            'notes',
            'medical_conditions',
            'allergies'
        ],
        'users': [
            'email',
            'phone',
            'address'
        ],
        'bookings': [
            'customer_notes',
            'special_requests',
            'medical_notes'
        ],
        'payments': [
            'cardholder_name',
            'billing_address',
            'payment_notes'
        ],
        'audit_logs': [
            'old_values',
            'new_values',
            'ip_address',
            'user_agent'
        ]
    }
    
    def __init__(self):
        self.encryption_service = EncryptionService()
    
    def encrypt_model_data(self, model_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Encrypt PII fields for a specific model."""
        pii_fields = self.PII_FIELDS.get(model_name, [])
        return self.encryption_service.encrypt_pii_fields(data, pii_fields)
    
    def decrypt_model_data(self, model_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Decrypt PII fields for a specific model."""
        pii_fields = self.PII_FIELDS.get(model_name, [])
        return self.encryption_service.decrypt_pii_fields(data, pii_fields)
    
    def create_search_hash(self, model_name: str, field_name: str, value: str) -> str:
        """Create a searchable hash for a PII field."""
        if field_name not in self.PII_FIELDS.get(model_name, []):
            raise ValueError(f"Field {field_name} is not a PII field for model {model_name}")
        
        return self.encryption_service.hash_field(value)
    
    def search_by_hash(self, model_name: str, field_name: str, value: str) -> str:
        """Search for records by hashed PII field."""
        if field_name not in self.PII_FIELDS.get(model_name, []):
            raise ValueError(f"Field {field_name} is not a PII field for model {model_name}")
        
        return self.create_search_hash(model_name, field_name, value)


# Global encryption service instance
encryption_service = EncryptionService()
pii_field_manager = PIIFieldManager()
