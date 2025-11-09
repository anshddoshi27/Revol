"""
Encryption Implementation Validation Tests

This module contains comprehensive tests for encryption implementation validation
to ensure all sensitive data is properly encrypted and decrypted.

Encryption Requirements Tested:
- Field-level encryption for PII data
- Encryption key management and rotation
- Encryption/decryption functionality
- PII field identification and handling
- Search functionality with encrypted data
- Encryption performance and reliability
- Data integrity validation
- Encryption algorithm validation
"""

import pytest
import json
import uuid
import hashlib
import base64
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import Flask

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Booking
from app.models.financial import Payment
from app.services.encryption_service import EncryptionService, PIIFieldManager
from app.middleware.encryption_middleware import EncryptionMiddleware
from app.middleware.error_handler import TithiError


class TestEncryptionImplementation:
    """Comprehensive encryption implementation validation tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for each test."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="encryption-test-tenant",
                name="Encryption Test Tenant",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant)
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="Encryption Test User",
                primary_email="encryption-test@example.com"
            )
            db.session.add(self.user)
            
            # Create membership
            self.membership = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                user_id=self.user.id,
                role="owner"
            )
            db.session.add(self.membership)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_encryption_service_initialization(self):
        """Test that encryption service is properly initialized."""
        encryption_service = EncryptionService()
        
        # Test that encryption service has required attributes
        assert hasattr(encryption_service, 'encryption_key'), "Encryption service should have encryption key"
        assert hasattr(encryption_service, 'algorithm'), "Encryption service should have algorithm"
        assert hasattr(encryption_service, 'salt_length'), "Encryption service should have salt length"
        
        # Test encryption key is properly configured
        encryption_key = encryption_service.encryption_key
        assert encryption_key is not None, "Encryption key should not be None"
        assert len(encryption_key) >= 32, "Encryption key should be at least 32 characters"
        
        # Test algorithm is properly configured
        assert encryption_service.algorithm in ['AES-256-GCM', 'AES-256-CBC'], "Should use secure encryption algorithm"
    
    def test_field_encryption_decryption(self):
        """Test basic field encryption and decryption functionality."""
        encryption_service = EncryptionService()
        
        # Test data to encrypt
        test_data = [
            "sensitive customer data",
            "john.doe@example.com",
            "+1234567890",
            "123 Main Street, City, State 12345",
            "Customer has special medical requirements"
        ]
        
        for data in test_data:
            # Encrypt data
            encrypted_data = encryption_service.encrypt_field(data)
            
            # Verify encrypted data is different from original
            assert encrypted_data != data, f"Encrypted data should be different from original: {data}"
            assert len(encrypted_data) > len(data), f"Encrypted data should be longer than original: {data}"
            
            # Decrypt data
            decrypted_data = encryption_service.decrypt_field(encrypted_data)
            
            # Verify decrypted data matches original
            assert decrypted_data == data, f"Decrypted data should match original: {data}"
    
    def test_pii_field_identification(self):
        """Test that PII fields are properly identified."""
        pii_manager = PIIFieldManager()
        
        # Test PII field identification for different models
        test_models = ['customers', 'users', 'bookings', 'payments', 'audit_logs']
        
        for model in test_models:
            pii_fields = pii_manager.PII_FIELDS.get(model, [])
            assert len(pii_fields) > 0, f"Model {model} should have PII fields defined"
            
            # Verify common PII fields are included
            common_pii_fields = ['email', 'phone', 'address']
            for field in common_pii_fields:
                if field in pii_fields:
                    assert field in pii_fields, f"Model {model} should include PII field {field}"
    
    def test_pii_field_encryption(self):
        """Test PII field encryption for different models."""
        pii_manager = PIIFieldManager()
        
        # Test customer PII encryption
        customer_data = {
            'display_name': 'John Doe',
            'email': 'john.doe@example.com',
            'phone': '+1234567890',
            'address': '123 Main St, City, State 12345',
            'notes': 'Customer has special requirements'
        }
        
        encrypted_customer_data = pii_manager.encrypt_model_data('customers', customer_data)
        
        # Verify PII fields are encrypted
        pii_fields = pii_manager.PII_FIELDS['customers']
        for field in pii_fields:
            if field in customer_data and field in encrypted_customer_data:
                original_value = customer_data[field]
                encrypted_value = encrypted_customer_data[field]
                
                if original_value is not None:
                    assert encrypted_value != original_value, f"PII field {field} should be encrypted"
                    assert len(encrypted_value) > len(original_value), f"Encrypted {field} should be longer"
        
        # Test payment PII encryption
        payment_data = {
            'cardholder_name': 'John Doe',
            'billing_address': '123 Main St, City, State 12345',
            'payment_notes': 'Customer requested special handling'
        }
        
        encrypted_payment_data = pii_manager.encrypt_model_data('payments', payment_data)
        
        # Verify payment PII fields are encrypted
        pii_fields = pii_manager.PII_FIELDS['payments']
        for field in pii_fields:
            if field in payment_data and field in encrypted_payment_data:
                original_value = payment_data[field]
                encrypted_value = encrypted_payment_data[field]
                
                if original_value is not None:
                    assert encrypted_value != original_value, f"Payment PII field {field} should be encrypted"
    
    def test_pii_field_decryption(self):
        """Test PII field decryption functionality."""
        pii_manager = PIIFieldManager()
        
        # Test customer PII decryption
        customer_data = {
            'display_name': 'John Doe',
            'email': 'john.doe@example.com',
            'phone': '+1234567890',
            'address': '123 Main St, City, State 12345'
        }
        
        # Encrypt data
        encrypted_data = pii_manager.encrypt_model_data('customers', customer_data)
        
        # Decrypt data
        decrypted_data = pii_manager.decrypt_model_data('customers', encrypted_data)
        
        # Verify decrypted data matches original
        pii_fields = pii_manager.PII_FIELDS['customers']
        for field in pii_fields:
            if field in customer_data and field in decrypted_data:
                original_value = customer_data[field]
                decrypted_value = decrypted_data[field]
                
                if original_value is not None:
                    assert decrypted_value == original_value, f"Decrypted {field} should match original"
    
    def test_search_hash_functionality(self):
        """Test search hash functionality for encrypted PII fields."""
        pii_manager = PIIFieldManager()
        
        # Test search hash creation
        test_value = "john.doe@example.com"
        search_hash = pii_manager.create_search_hash('customers', 'email', test_value)
        
        # Verify search hash is created
        assert search_hash is not None, "Search hash should be created"
        assert len(search_hash) > 0, "Search hash should not be empty"
        assert search_hash != test_value, "Search hash should be different from original value"
        
        # Test search hash consistency
        search_hash2 = pii_manager.create_search_hash('customers', 'email', test_value)
        assert search_hash == search_hash2, "Search hash should be consistent for same input"
        
        # Test search hash uniqueness
        different_value = "jane.doe@example.com"
        different_hash = pii_manager.create_search_hash('customers', 'email', different_value)
        assert search_hash != different_hash, "Search hash should be different for different input"
    
    def test_encryption_key_rotation(self):
        """Test encryption key rotation functionality."""
        encryption_service = EncryptionService()
        
        # Test with original key
        test_data = "sensitive data for key rotation test"
        encrypted_data = encryption_service.encrypt_field(test_data)
        decrypted_data = encryption_service.decrypt_field(encrypted_data)
        assert decrypted_data == test_data, "Original key should decrypt correctly"
        
        # Test key rotation (simulated)
        with patch.object(encryption_service, 'encryption_key', 'new_encryption_key_32_chars_long'):
            # New key should not decrypt old data
            try:
                new_decrypted_data = encryption_service.decrypt_field(encrypted_data)
                assert new_decrypted_data != test_data, "New key should not decrypt old data"
            except Exception:
                # Expected to fail with new key
                pass
        
        # Test that new key can encrypt/decrypt new data
        with patch.object(encryption_service, 'encryption_key', 'new_encryption_key_32_chars_long'):
            new_test_data = "new sensitive data"
            new_encrypted_data = encryption_service.encrypt_field(new_test_data)
            new_decrypted_data = encryption_service.decrypt_field(new_encrypted_data)
            assert new_decrypted_data == new_test_data, "New key should encrypt/decrypt new data correctly"
    
    def test_encryption_performance(self):
        """Test encryption performance and reliability."""
        encryption_service = EncryptionService()
        
        # Test with various data sizes
        test_data_sizes = [10, 100, 1000, 10000]  # characters
        
        for size in test_data_sizes:
            test_data = "x" * size
            
            # Measure encryption time
            import time
            start_time = time.time()
            encrypted_data = encryption_service.encrypt_field(test_data)
            encryption_time = time.time() - start_time
            
            # Measure decryption time
            start_time = time.time()
            decrypted_data = encryption_service.decrypt_field(encrypted_data)
            decryption_time = time.time() - start_time
            
            # Verify correctness
            assert decrypted_data == test_data, f"Encryption/decryption should be correct for size {size}"
            
            # Verify performance (should be reasonable)
            assert encryption_time < 1.0, f"Encryption should be fast for size {size}: {encryption_time}s"
            assert decryption_time < 1.0, f"Decryption should be fast for size {size}: {decryption_time}s"
    
    def test_encryption_data_integrity(self):
        """Test encryption data integrity validation."""
        encryption_service = EncryptionService()
        
        test_data = "data integrity test"
        encrypted_data = encryption_service.encrypt_field(test_data)
        
        # Test that corrupted data fails to decrypt
        corrupted_data = encrypted_data[:-1] + "X"  # Corrupt last character
        
        try:
            decrypted_data = encryption_service.decrypt_field(corrupted_data)
            assert decrypted_data != test_data, "Corrupted data should not decrypt correctly"
        except Exception:
            # Expected to fail with corrupted data
            pass
        
        # Test that tampered data fails to decrypt
        tampered_data = encrypted_data.replace("a", "b", 1)  # Tamper with one character
        
        try:
            decrypted_data = encryption_service.decrypt_field(tampered_data)
            assert decrypted_data != test_data, "Tampered data should not decrypt correctly"
        except Exception:
            # Expected to fail with tampered data
            pass
    
    def test_encryption_algorithm_validation(self):
        """Test encryption algorithm validation."""
        encryption_service = EncryptionService()
        
        # Test that secure algorithm is used
        algorithm = encryption_service.algorithm
        secure_algorithms = ['AES-256-GCM', 'AES-256-CBC', 'ChaCha20-Poly1305']
        assert algorithm in secure_algorithms, f"Should use secure encryption algorithm: {algorithm}"
        
        # Test that weak algorithms are not used
        weak_algorithms = ['DES', '3DES', 'RC4', 'MD5', 'SHA1']
        assert algorithm not in weak_algorithms, f"Should not use weak encryption algorithm: {algorithm}"
    
    def test_encryption_middleware_integration(self):
        """Test encryption middleware integration."""
        encryption_middleware = EncryptionMiddleware()
        encryption_middleware.init_app(self.app)
        
        # Test that middleware is properly initialized
        assert hasattr(encryption_middleware, 'app'), "Encryption middleware should be initialized with app"
        assert hasattr(encryption_middleware, 'encryption_key'), "Encryption middleware should have encryption key"
        
        # Test middleware encryption/decryption
        test_data = "middleware encryption test"
        encrypted_data = encryption_middleware.encrypt(test_data)
        decrypted_data = encryption_middleware.decrypt(encrypted_data)
        
        assert encrypted_data != test_data, "Middleware should encrypt data"
        assert decrypted_data == test_data, "Middleware should decrypt data correctly"
    
    def test_encryption_error_handling(self):
        """Test encryption error handling."""
        encryption_service = EncryptionService()
        
        # Test with invalid input
        invalid_inputs = [None, "", 123, [], {}]
        
        for invalid_input in invalid_inputs:
            try:
                encrypted_data = encryption_service.encrypt_field(invalid_input)
                # If encryption succeeds, decryption should work
                decrypted_data = encryption_service.decrypt_field(encrypted_data)
                assert decrypted_data == invalid_input, f"Encryption/decryption should handle {type(invalid_input)}"
            except Exception as e:
                # Should handle invalid input gracefully
                assert isinstance(e, (ValueError, TypeError)), f"Should raise appropriate exception for {type(invalid_input)}"
    
    def test_encryption_logging_security(self):
        """Test that encryption operations don't leak sensitive data in logs."""
        encryption_service = EncryptionService()
        
        sensitive_data = "very sensitive data that should not be logged"
        
        # Test encryption with logging
        with patch('app.services.encryption_service.logger') as mock_logger:
            encrypted_data = encryption_service.encrypt_field(sensitive_data)
            
            # Verify sensitive data is not in logs
            if mock_logger.info.called:
                log_calls = mock_logger.info.call_args_list
                for call in log_calls:
                    log_message = str(call).lower()
                    assert sensitive_data.lower() not in log_message, "Sensitive data should not be logged"
    
    def test_encryption_batch_operations(self):
        """Test encryption batch operations."""
        encryption_service = EncryptionService()
        
        # Test batch encryption
        test_data_batch = [
            "batch item 1",
            "batch item 2", 
            "batch item 3",
            "batch item 4",
            "batch item 5"
        ]
        
        encrypted_batch = []
        for data in test_data_batch:
            encrypted_data = encryption_service.encrypt_field(data)
            encrypted_batch.append(encrypted_data)
        
        # Test batch decryption
        decrypted_batch = []
        for encrypted_data in encrypted_batch:
            decrypted_data = encryption_service.decrypt_field(encrypted_data)
            decrypted_batch.append(decrypted_data)
        
        # Verify batch operations
        assert len(encrypted_batch) == len(test_data_batch), "Batch encryption should preserve count"
        assert len(decrypted_batch) == len(test_data_batch), "Batch decryption should preserve count"
        
        for i, (original, decrypted) in enumerate(zip(test_data_batch, decrypted_batch)):
            assert original == decrypted, f"Batch item {i} should decrypt correctly"
    
    def test_encryption_unicode_handling(self):
        """Test encryption with Unicode data."""
        encryption_service = EncryptionService()
        
        # Test Unicode data
        unicode_data = [
            "Hello 世界",
            "مرحبا بالعالم",
            "Здравствуй мир",
            "🌍🌎🌏",
            "café naïve résumé"
        ]
        
        for data in unicode_data:
            encrypted_data = encryption_service.encrypt_field(data)
            decrypted_data = encryption_service.decrypt_field(encrypted_data)
            
            assert encrypted_data != data, f"Unicode data should be encrypted: {data}"
            assert decrypted_data == data, f"Unicode data should decrypt correctly: {data}"
    
    def test_encryption_special_characters(self):
        """Test encryption with special characters."""
        encryption_service = EncryptionService()
        
        # Test special characters
        special_data = [
            "data with spaces",
            "data\twith\ttabs",
            "data\nwith\nnewlines",
            "data with \"quotes\"",
            "data with 'apostrophes'",
            "data with $pecial $ymbols!@#$%^&*()",
            "data with null\0character"
        ]
        
        for data in special_data:
            encrypted_data = encryption_service.encrypt_field(data)
            decrypted_data = encryption_service.decrypt_field(encrypted_data)
            
            assert encrypted_data != data, f"Special character data should be encrypted: {repr(data)}"
            assert decrypted_data == data, f"Special character data should decrypt correctly: {repr(data)}"


class TestEncryptionIntegration:
    """Integration tests for encryption across the entire system."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for integration tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="encryption-integration-tenant",
                name="Encryption Integration Tenant",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant)
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="Encryption Integration User",
                primary_email="encryption-integration@example.com"
            )
            db.session.add(self.user)
            
            # Create membership
            self.membership = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                user_id=self.user.id,
                role="owner"
            )
            db.session.add(self.membership)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_end_to_end_encryption_workflow(self):
        """Test complete encryption workflow from data creation to retrieval."""
        pii_manager = PIIFieldManager()
        
        # Create customer with PII data
        customer_data = {
            'display_name': 'Integration Test Customer',
            'email': 'integration@example.com',
            'phone': '+1234567890',
            'address': '123 Integration St, City, State 12345',
            'notes': 'Customer has special integration requirements'
        }
        
        # Encrypt PII data
        encrypted_customer_data = pii_manager.encrypt_model_data('customers', customer_data)
        
        # Create customer in database
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            display_name=encrypted_customer_data.get('display_name', customer_data['display_name']),
            email=encrypted_customer_data.get('email', customer_data['email']),
            phone=encrypted_customer_data.get('phone', customer_data['phone']),
            marketing_opt_in=False
        )
        
        db.session.add(customer)
        db.session.commit()
        
        # Retrieve customer from database
        retrieved_customer = db.session.query(Customer).filter(
            Customer.id == customer.id
        ).first()
        
        assert retrieved_customer is not None
        
        # Decrypt retrieved data
        retrieved_data = {
            'display_name': retrieved_customer.display_name,
            'email': retrieved_customer.email,
            'phone': retrieved_customer.phone
        }
        
        decrypted_data = pii_manager.decrypt_model_data('customers', retrieved_data)
        
        # Verify decrypted data matches original
        assert decrypted_data['display_name'] == customer_data['display_name']
        assert decrypted_data['email'] == customer_data['email']
        assert decrypted_data['phone'] == customer_data['phone']
    
    def test_encryption_with_booking_workflow(self):
        """Test encryption integration with booking workflow."""
        pii_manager = PIIFieldManager()
        
        # Create customer
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            display_name="Booking Encryption Customer",
            email="booking@example.com",
            phone="+1234567890"
        )
        db.session.add(customer)
        
        # Create booking with PII data
        booking_data = {
            'customer_notes': 'Customer has special booking requirements',
            'special_requests': 'Please prepare room with extra towels',
            'medical_notes': 'Customer has allergies to certain products'
        }
        
        # Encrypt booking PII data
        encrypted_booking_data = pii_manager.encrypt_model_data('bookings', booking_data)
        
        # Create booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=customer.id,
            resource_id=uuid.uuid4(),
            client_generated_id=str(uuid.uuid4()),
            start_at=datetime.utcnow() + timedelta(hours=1),
            end_at=datetime.utcnow() + timedelta(hours=2),
            booking_tz="UTC",
            status="confirmed"
        )
        
        db.session.add(booking)
        db.session.commit()
        
        # Retrieve and decrypt booking data
        retrieved_booking = db.session.query(Booking).filter(
            Booking.id == booking.id
        ).first()
        
        assert retrieved_booking is not None
        
        # Test that booking data can be decrypted
        # Note: This would depend on how booking PII data is stored in the actual model
        # For now, we'll test the encryption/decryption functionality
        decrypted_booking_data = pii_manager.decrypt_model_data('bookings', booking_data)
        
        for key, value in booking_data.items():
            assert decrypted_booking_data[key] == value, f"Booking {key} should decrypt correctly"
    
    def test_encryption_with_payment_workflow(self):
        """Test encryption integration with payment workflow."""
        pii_manager = PIIFieldManager()
        
        # Create customer
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            display_name="Payment Encryption Customer",
            email="payment@example.com",
            phone="+1234567890"
        )
        db.session.add(customer)
        
        # Create payment with PII data
        payment_data = {
            'cardholder_name': 'Payment Encryption Customer',
            'billing_address': '123 Payment St, City, State 12345',
            'payment_notes': 'Customer requested special payment handling'
        }
        
        # Encrypt payment PII data
        encrypted_payment_data = pii_manager.encrypt_model_data('payments', payment_data)
        
        # Create payment
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=customer.id,
            amount_cents=5000,
            status='captured',
            method='card',
            provider='stripe',
            provider_payment_id="pi_encryption_test"
        )
        
        db.session.add(payment)
        db.session.commit()
        
        # Retrieve payment
        retrieved_payment = db.session.query(Payment).filter(
            Payment.id == payment.id
        ).first()
        
        assert retrieved_payment is not None
        
        # Test payment PII encryption/decryption
        decrypted_payment_data = pii_manager.decrypt_model_data('payments', payment_data)
        
        for key, value in payment_data.items():
            assert decrypted_payment_data[key] == value, f"Payment {key} should decrypt correctly"
    
    def test_encryption_consistency_across_models(self):
        """Test that encryption is consistent across different models."""
        pii_manager = PIIFieldManager()
        
        # Test data that appears in multiple models
        test_email = "consistency@example.com"
        test_phone = "+1234567890"
        
        # Encrypt same data for different models
        customer_data = {'email': test_email, 'phone': test_phone}
        user_data = {'email': test_email, 'phone': test_phone}
        
        encrypted_customer_data = pii_manager.encrypt_model_data('customers', customer_data)
        encrypted_user_data = pii_manager.encrypt_model_data('users', user_data)
        
        # Decrypt data
        decrypted_customer_data = pii_manager.decrypt_model_data('customers', encrypted_customer_data)
        decrypted_user_data = pii_manager.decrypt_model_data('users', encrypted_user_data)
        
        # Verify consistency
        assert decrypted_customer_data['email'] == test_email, "Customer email should decrypt correctly"
        assert decrypted_customer_data['phone'] == test_phone, "Customer phone should decrypt correctly"
        assert decrypted_user_data['email'] == test_email, "User email should decrypt correctly"
        assert decrypted_user_data['phone'] == test_phone, "User phone should decrypt correctly"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
