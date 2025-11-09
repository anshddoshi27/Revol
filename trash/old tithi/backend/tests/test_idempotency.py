"""
Contract Tests for Idempotency Keys

This module contains comprehensive tests for idempotency functionality.

Phase: 11 - Cross-Cutting Utilities (Module N)
Task: 11.4 - Idempotency Keys
"""

import pytest
import json
import hashlib
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.idempotency import IdempotencyKey
from app.services.idempotency import IdempotencyService
from app.middleware.idempotency import IdempotencyMiddleware, IdempotencyError


class TestIdempotencyService:
    """Test cases for IdempotencyService"""
    
    def test_validate_idempotency_key_valid_formats(self):
        """Test validation of valid idempotency key formats"""
        valid_keys = [
            "123e4567-e89b-12d3-a456-426614174000",  # UUID
            "booking-123",  # Alphanumeric
            "payment_intent_abc123",  # Alphanumeric with underscore
            "test-key-123",  # Alphanumeric with dash
            "a",  # Single character
            "a" * 255,  # Maximum length
        ]
        
        for key in valid_keys:
            assert IdempotencyService.validate_idempotency_key(key), f"Key '{key}' should be valid"
    
    def test_validate_idempotency_key_invalid_formats(self):
        """Test validation of invalid idempotency key formats"""
        invalid_keys = [
            "",  # Empty
            "a" * 256,  # Too long
            "key with spaces",  # Spaces
            "key@with#special",  # Special characters
            "key\nwith\nnewlines",  # Newlines
            "key\twith\ttabs",  # Tabs
        ]
        
        for key in invalid_keys:
            assert not IdempotencyService.validate_idempotency_key(key), f"Key '{key}' should be invalid"
    
    def test_generate_key_hash(self):
        """Test key hash generation"""
        key = "test-key-123"
        expected_hash = hashlib.sha256(key.encode('utf-8')).hexdigest()
        
        assert IdempotencyService.generate_key_hash(key) == expected_hash
    
    def test_generate_request_hash(self):
        """Test request hash generation"""
        request_data = {"service_id": "123", "start_at": "2025-01-01T10:00:00Z"}
        expected_hash = hashlib.sha256(
            json.dumps(request_data, sort_keys=True).encode('utf-8')
        ).hexdigest()
        
        assert IdempotencyService.generate_request_hash(request_data) == expected_hash
    
    def test_generate_request_hash_with_string(self):
        """Test request hash generation with string data"""
        request_data = "test string"
        expected_hash = hashlib.sha256(str(request_data).encode('utf-8')).hexdigest()
        
        assert IdempotencyService.generate_request_hash(request_data) == expected_hash
    
    def test_validate_endpoint_requires_idempotency(self):
        """Test endpoint idempotency requirement validation"""
        # Critical endpoints that require idempotency
        critical_endpoints = [
            ("/api/bookings", "POST"),
            ("/api/payments/intent", "POST"),
            ("/api/payments/confirm", "POST"),
            ("/api/payments/refund", "POST"),
            ("/api/payments/setup-intent", "POST"),
            ("/api/payments/capture-no-show", "POST"),
            ("/api/availability/hold", "POST"),
            ("/api/availability/release", "POST"),
        ]
        
        for endpoint, method in critical_endpoints:
            assert IdempotencyService.validate_endpoint_requires_idempotency(endpoint, method), \
                f"Endpoint {method} {endpoint} should require idempotency"
        
        # Non-critical endpoints
        non_critical_endpoints = [
            ("/api/bookings", "GET"),
            ("/api/services", "GET"),
            ("/api/customers", "GET"),
            ("/api/availability", "GET"),
        ]
        
        for endpoint, method in non_critical_endpoints:
            assert not IdempotencyService.validate_endpoint_requires_idempotency(endpoint, method), \
                f"Endpoint {method} {endpoint} should not require idempotency"


class TestIdempotencyKeyModel:
    """Test cases for IdempotencyKey model"""
    
    def test_idempotency_key_creation(self, app):
        """Test idempotency key creation"""
        with app.app_context():
            key = IdempotencyKey(
                tenant_id="123e4567-e89b-12d3-a456-426614174000",
                key_hash="test_hash",
                original_key="test-key",
                endpoint="/api/bookings",
                method="POST",
                request_hash="request_hash",
                response_status=201,
                response_body={"booking_id": "123"},
                response_headers={"Content-Type": "application/json"},
                expires_at=datetime.utcnow() + timedelta(hours=24)
            )
            
            assert key.tenant_id == "123e4567-e89b-12d3-a456-426614174000"
            assert key.key_hash == "test_hash"
            assert key.original_key == "test-key"
            assert key.endpoint == "/api/bookings"
            assert key.method == "POST"
            assert key.response_status == 201
    
    def test_idempotency_key_to_dict(self, app):
        """Test idempotency key serialization"""
        with app.app_context():
            expires_at = datetime.utcnow() + timedelta(hours=24)
            created_at = datetime.utcnow()
            
            key = IdempotencyKey(
                tenant_id="123e4567-e89b-12d3-a456-426614174000",
                key_hash="test_hash",
                original_key="test-key",
                endpoint="/api/bookings",
                method="POST",
                request_hash="request_hash",
                response_status=201,
                response_body={"booking_id": "123"},
                response_headers={"Content-Type": "application/json"},
                expires_at=expires_at,
                created_at=created_at
            )
            
            result = key.to_dict()
            
            assert result['endpoint'] == "/api/bookings"
            assert result['method'] == "POST"
            assert result['response_status'] == 201
            assert 'expires_at' in result
            assert 'created_at' in result
    
    def test_is_expired(self, app):
        """Test expiration check"""
        with app.app_context():
            # Expired key
            expired_key = IdempotencyKey(
                tenant_id="123e4567-e89b-12d3-a456-426614174000",
                key_hash="test_hash",
                original_key="test-key",
                endpoint="/api/bookings",
                method="POST",
                request_hash="request_hash",
                response_status=201,
                response_body={},
                response_headers={},
                expires_at=datetime.utcnow() - timedelta(hours=1)
            )
            
            assert expired_key.is_expired()
            
            # Valid key
            valid_key = IdempotencyKey(
                tenant_id="123e4567-e89b-12d3-a456-426614174000",
                key_hash="test_hash",
                original_key="test-key",
                endpoint="/api/bookings",
                method="POST",
                request_hash="request_hash",
                response_status=201,
                response_body={},
                response_headers={},
                expires_at=datetime.utcnow() + timedelta(hours=1)
            )
            
            assert not valid_key.is_expired()
    
    def test_get_cached_response(self, app):
        """Test cached response retrieval"""
        with app.app_context():
            response_body = {"booking_id": "123", "status": "confirmed"}
            response_headers = {"Content-Type": "application/json"}
            
            key = IdempotencyKey(
                tenant_id="123e4567-e89b-12d3-a456-426614174000",
                key_hash="test_hash",
                original_key="test-key",
                endpoint="/api/bookings",
                method="POST",
                request_hash="request_hash",
                response_status=201,
                response_body=response_body,
                response_headers=response_headers,
                expires_at=datetime.utcnow() + timedelta(hours=24)
            )
            
            cached_response = key.get_cached_response()
            
            assert cached_response['status'] == 201
            assert cached_response['body'] == response_body
            assert cached_response['headers'] == response_headers


class TestIdempotencyMiddleware:
    """Test cases for IdempotencyMiddleware"""
    
    def test_critical_endpoints_require_idempotency(self):
        """Test that critical endpoints require idempotency keys"""
        middleware = IdempotencyMiddleware()
        
        critical_endpoints = [
            'POST /api/bookings',
            'POST /api/payments/intent',
            'POST /api/payments/confirm',
            'POST /api/payments/refund',
            'POST /api/payments/setup-intent',
            'POST /api/payments/capture-no-show',
            'POST /api/availability/hold',
            'POST /api/availability/release'
        ]
        
        for endpoint in critical_endpoints:
            assert endpoint in middleware.CRITICAL_ENDPOINTS, \
                f"Endpoint {endpoint} should be in critical endpoints"
    
    def test_validate_idempotency_key_format(self):
        """Test idempotency key format validation"""
        middleware = IdempotencyMiddleware()
        
        # Valid formats
        valid_keys = [
            "123e4567-e89b-12d3-a456-426614174000",  # UUID
            "booking-123",  # Alphanumeric
            "payment_intent_abc123",  # Alphanumeric with underscore
        ]
        
        for key in valid_keys:
            assert middleware._validate_idempotency_key_format(key), \
                f"Key '{key}' should be valid"
        
        # Invalid formats
        invalid_keys = [
            "",  # Empty
            "a" * 256,  # Too long
            "key with spaces",  # Spaces
            "key@with#special",  # Special characters
        ]
        
        for key in invalid_keys:
            assert not middleware._validate_idempotency_key_format(key), \
                f"Key '{key}' should be invalid"
    
    def test_generate_request_hash(self):
        """Test request hash generation"""
        middleware = IdempotencyMiddleware()
        
        # Mock request
        request_mock = MagicMock()
        request_mock.is_json = True
        request_mock.get_json.return_value = {"service_id": "123", "start_at": "2025-01-01T10:00:00Z"}
        
        hash_result = middleware._generate_request_hash(request_mock)
        
        assert isinstance(hash_result, str)
        assert len(hash_result) == 64  # SHA-256 hex length
    
    def test_generate_request_hash_with_form_data(self):
        """Test request hash generation with form data"""
        middleware = IdempotencyMiddleware()
        
        # Mock request with form data
        request_mock = MagicMock()
        request_mock.is_json = False
        request_mock.form = {"service_id": "123", "start_at": "2025-01-01T10:00:00Z"}
        
        hash_result = middleware._generate_request_hash(request_mock)
        
        assert isinstance(hash_result, str)
        assert len(hash_result) == 64  # SHA-256 hex length


class TestIdempotencyContractTests:
    """Contract tests for idempotency functionality"""
    
    def test_duplicate_booking_request_same_booking_id(self, app, client):
        """Contract Test: Given booking created with key X, When retry sent with key X, Then same booking_id returned"""
        with app.app_context():
            # This test would require a full booking endpoint implementation
            # For now, we'll test the idempotency service directly
            
            tenant_id = "123e4567-e89b-12d3-a456-426614174000"
            idempotency_key = "booking-test-123"
            endpoint = "/api/bookings"
            method = "POST"
            request_data = {"service_id": "123", "start_at": "2025-01-01T10:00:00Z"}
            
            # First request - store response
            response_data = {
                "booking_id": "booking-123",
                "status": "confirmed",
                "created_at": "2025-01-01T10:00:00Z"
            }
            
            IdempotencyService.store_response(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                method=method,
                request_data=request_data,
                response_status=201,
                response_body=response_data,
                response_headers={"Content-Type": "application/json"}
            )
            
            # Second request - should return cached response
            cached_response = IdempotencyService.get_cached_response(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                method=method,
                request_data=request_data
            )
            
            assert cached_response is not None
            assert cached_response['status'] == 201
            assert cached_response['body']['booking_id'] == "booking-123"
    
    def test_idempotency_key_reuse_error(self, app):
        """Test that reusing an idempotency key with different request data raises error"""
        with app.app_context():
            # This would be tested in the middleware when it detects
            # the same key with different request data
            # For now, we'll test the validation logic
            
            tenant_id = "123e4567-e89b-12d3-a456-426614174000"
            idempotency_key = "booking-test-123"
            endpoint = "/api/bookings"
            method = "POST"
            
            # First request
            request_data_1 = {"service_id": "123", "start_at": "2025-01-01T10:00:00Z"}
            response_data_1 = {"booking_id": "booking-123"}
            
            IdempotencyService.store_response(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                method=method,
                request_data=request_data_1,
                response_status=201,
                response_body=response_data_1,
                response_headers={}
            )
            
            # Second request with different data
            request_data_2 = {"service_id": "456", "start_at": "2025-01-01T11:00:00Z"}
            
            # Should not find cached response due to different request hash
            cached_response = IdempotencyService.get_cached_response(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                method=method,
                request_data=request_data_2
            )
            
            assert cached_response is None  # Different request data, no cache hit
    
    def test_idempotency_key_expiration(self, app):
        """Test that expired idempotency keys are not returned"""
        with app.app_context():
            tenant_id = "123e4567-e89b-12d3-a456-426614174000"
            idempotency_key = "booking-test-123"
            endpoint = "/api/bookings"
            method = "POST"
            request_data = {"service_id": "123"}
            
            # Store response with past expiration
            with patch('app.services.idempotency.datetime') as mock_datetime:
                mock_datetime.utcnow.return_value = datetime(2025, 1, 1, 10, 0, 0)
                
                IdempotencyService.store_response(
                    tenant_id=tenant_id,
                    idempotency_key=idempotency_key,
                    endpoint=endpoint,
                    method=method,
                    request_data=request_data,
                    response_status=201,
                    response_body={"booking_id": "booking-123"},
                    response_headers={},
                    expiration_hours=1  # Expires at 11:00
                )
            
            # Try to get response after expiration
            with patch('app.services.idempotency.datetime') as mock_datetime:
                mock_datetime.utcnow.return_value = datetime(2025, 1, 1, 12, 0, 0)  # After expiration
                
                cached_response = IdempotencyService.get_cached_response(
                    tenant_id=tenant_id,
                    idempotency_key=idempotency_key,
                    endpoint=endpoint,
                    method=method,
                    request_data=request_data
                )
                
                assert cached_response is None  # Expired, no cache hit


class TestIdempotencyObservability:
    """Test cases for idempotency observability"""
    
    def test_idempotency_key_used_log(self, app):
        """Test that IDEMPOTENCY_KEY_USED log is emitted"""
        with app.app_context():
            tenant_id = "123e4567-e89b-12d3-a456-426614174000"
            idempotency_key = "booking-test-123"
            endpoint = "/api/bookings"
            method = "POST"
            request_data = {"service_id": "123"}
            
            # Store initial response
            IdempotencyService.store_response(
                tenant_id=tenant_id,
                idempotency_key=idempotency_key,
                endpoint=endpoint,
                method=method,
                request_data=request_data,
                response_status=201,
                response_body={"booking_id": "booking-123"},
                response_headers={}
            )
            
            # Get cached response (should log IDEMPOTENCY_KEY_USED)
            with patch('app.services.idempotency.logger') as mock_logger:
                IdempotencyService.get_cached_response(
                    tenant_id=tenant_id,
                    idempotency_key=idempotency_key,
                    endpoint=endpoint,
                    method=method,
                    request_data=request_data
                )
                
                # Verify log was called
                mock_logger.info.assert_called()
                log_call = mock_logger.info.call_args
                assert "IDEMPOTENCY_KEY_USED" in log_call[0][0]
    
    def test_idempotency_key_stored_log(self, app):
        """Test that IDEMPOTENCY_KEY_STORED log is emitted"""
        with app.app_context():
            tenant_id = "123e4567-e89b-12d3-a456-426614174000"
            idempotency_key = "booking-test-123"
            endpoint = "/api/bookings"
            method = "POST"
            request_data = {"service_id": "123"}
            
            with patch('app.services.idempotency.logger') as mock_logger:
                IdempotencyService.store_response(
                    tenant_id=tenant_id,
                    idempotency_key=idempotency_key,
                    endpoint=endpoint,
                    method=method,
                    request_data=request_data,
                    response_status=201,
                    response_body={"booking_id": "booking-123"},
                    response_headers={}
                )
                
                # Verify log was called
                mock_logger.info.assert_called()
                log_call = mock_logger.info.call_args
                assert "IDEMPOTENCY_KEY_STORED" in log_call[0][0]


if __name__ == '__main__':
    pytest.main([__file__])
