"""
Phase 3 Contract Validation Tests

This module contains comprehensive contract validation tests for Phase 3 API endpoints:
- Payment API contracts
- Promotion API contracts  
- Notification API contracts
- Request/Response schema validation
- Error response format validation
- API versioning compliance
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import Flask

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment
from app.models.promotions import Coupon, GiftCard
from app.models.notification import Notification


class TestPhase3ContractValidation:
    """Contract validation tests for Phase 3 API endpoints."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for contract tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create test database
        db.create_all()
        
        # Create test data
        self.tenant = self._create_test_tenant()
        self.user = self._create_test_user()
        self.membership = self._create_test_membership()
        self.customer = self._create_test_customer()
        self.service = self._create_test_service()
        self.resource = self._create_test_resource()
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="contract-test-tenant",
            tz="UTC",
            is_public_directory=False
        )
        db.session.add(tenant)
        db.session.commit()
        return tenant
    
    def _create_test_user(self):
        """Create test user."""
        user = User(
            id=uuid.uuid4(),
            primary_email="contract@example.com",
            display_name="Contract Test User"
        )
        db.session.add(user)
        db.session.commit()
        return user
    
    def _create_test_membership(self):
        """Create test membership."""
        membership = Membership(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            user_id=self.user.id,
            role="owner"
        )
        db.session.add(membership)
        db.session.commit()
        return membership
    
    def _create_test_customer(self):
        """Create test customer."""
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            email="customer@example.com",
            display_name="Contract Test Customer"
        )
        db.session.add(customer)
        db.session.commit()
        return customer
    
    def _create_test_service(self):
        """Create test service."""
        service = Service(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Contract Test Service",
            duration_minutes=60,
            price_cents=5000,
            is_active=True
        )
        db.session.add(service)
        db.session.commit()
        return service
    
    def _create_test_resource(self):
        """Create test resource."""
        resource = Resource(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Contract Test Staff",
            type="staff",
            is_active=True
        )
        db.session.add(resource)
        db.session.commit()
        return resource
    
    def test_payment_api_contracts(self):
        """Test payment API endpoint contracts."""
        
        # Test payment intent creation endpoint
        response = self.client.post('/api/payments/intent', json={
            'booking_id': str(uuid.uuid4()),
            'amount_cents': 5000,
            'currency': 'USD',
            'customer_id': str(self.customer.id)
        })
        
        # Should return 401 without auth, but structure should be correct
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test payment confirmation endpoint
        response = self.client.post('/api/payments/confirm', json={
            'payment_id': str(uuid.uuid4()),
            'payment_method_id': 'pm_test123'
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test refund endpoint
        response = self.client.post('/api/payments/refund', json={
            'payment_id': str(uuid.uuid4()),
            'amount_cents': 2500,
            'reason': 'Customer requested'
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test no-show fee endpoint
        response = self.client.post('/api/payments/no-show-fee', json={
            'booking_id': str(uuid.uuid4()),
            'customer_id': str(self.customer.id)
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
    
    def test_payment_api_request_validation(self):
        """Test payment API request validation."""
        
        # Test missing required fields
        response = self.client.post('/api/payments/intent', json={})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test invalid amount
        response = self.client.post('/api/payments/intent', json={
            'booking_id': str(uuid.uuid4()),
            'amount_cents': -1000,  # Invalid negative amount
            'currency': 'USD'
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'amount' in str(data).lower()
        
        # Test invalid currency
        response = self.client.post('/api/payments/intent', json={
            'booking_id': str(uuid.uuid4()),
            'amount_cents': 5000,
            'currency': 'INVALID'  # Invalid currency
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'currency' in str(data).lower()
        
        # Test invalid UUID format
        response = self.client.post('/api/payments/intent', json={
            'booking_id': 'invalid-uuid',
            'amount_cents': 5000,
            'currency': 'USD'
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'booking_id' in str(data).lower() or 'uuid' in str(data).lower()
    
    def test_payment_api_response_format(self):
        """Test payment API response format."""
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_contract_test",
                status="requires_payment_method",
                client_secret="pi_contract_test_secret",
                metadata={}
            )
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id', return_value=str(self.tenant.id)):
                with patch('app.middleware.auth_middleware.get_current_user_id', return_value=str(self.user.id)):
                    
                    response = self.client.post('/api/payments/intent', json={
                        'booking_id': str(uuid.uuid4()),
                        'amount_cents': 5000,
                        'currency': 'USD'
                    })
                    
                    if response.status_code == 200:
                        data = json.loads(response.data)
                        
                        # Verify response structure
                        assert 'payment_id' in data
                        assert 'client_secret' in data
                        assert 'status' in data
                        assert 'amount_cents' in data
                        assert 'currency' in data
                        
                        # Verify data types
                        assert isinstance(data['payment_id'], str)
                        assert isinstance(data['client_secret'], str)
                        assert isinstance(data['status'], str)
                        assert isinstance(data['amount_cents'], int)
                        assert isinstance(data['currency'], str)
    
    def test_promotion_api_contracts(self):
        """Test promotion API endpoint contracts."""
        
        # Test coupon validation endpoint
        response = self.client.post('/api/promotions/validate', json={
            'code': 'TEST20',
            'amount_cents': 5000,
            'customer_id': str(self.customer.id)
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test coupon application endpoint
        response = self.client.post('/api/promotions/apply', json={
            'code': 'TEST20',
            'booking_id': str(uuid.uuid4()),
            'payment_id': str(uuid.uuid4()),
            'amount_cents': 5000
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test gift card creation endpoint
        response = self.client.post('/api/promotions/gift-cards', json={
            'code': 'GIFT100',
            'initial_balance_cents': 10000,
            'purchaser_customer_id': str(self.customer.id)
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test gift card redemption endpoint
        response = self.client.post('/api/promotions/gift-cards/redeem', json={
            'code': 'GIFT100',
            'booking_id': str(uuid.uuid4()),
            'payment_id': str(uuid.uuid4()),
            'amount_cents': 5000
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
    
    def test_promotion_api_request_validation(self):
        """Test promotion API request validation."""
        
        # Test missing required fields
        response = self.client.post('/api/promotions/validate', json={})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test invalid coupon code format
        response = self.client.post('/api/promotions/validate', json={
            'code': '',  # Empty code
            'amount_cents': 5000
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'code' in str(data).lower()
        
        # Test invalid amount
        response = self.client.post('/api/promotions/validate', json={
            'code': 'TEST20',
            'amount_cents': -1000  # Negative amount
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'amount' in str(data).lower()
        
        # Test invalid gift card balance
        response = self.client.post('/api/promotions/gift-cards', json={
            'code': 'GIFT100',
            'initial_balance_cents': -1000  # Negative balance
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'balance' in str(data).lower()
    
    def test_promotion_api_response_format(self):
        """Test promotion API response format."""
        
        # Create test coupon
        coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="CONTRACT_TEST",
            discount_type="percentage",
            discount_value=20,
            is_active=True
        )
        db.session.add(coupon)
        db.session.commit()
        
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_tenant_id', return_value=str(self.tenant.id)):
            with patch('app.middleware.auth_middleware.get_current_user_id', return_value=str(self.user.id)):
                
                response = self.client.post('/api/promotions/validate', json={
                    'code': 'CONTRACT_TEST',
                    'amount_cents': 5000,
                    'customer_id': str(self.customer.id)
                })
                
                if response.status_code == 200:
                    data = json.loads(response.data)
                    
                    # Verify response structure
                    assert 'is_valid' in data
                    assert 'discount_amount_cents' in data
                    assert 'final_amount_cents' in data
                    
                    # Verify data types
                    assert isinstance(data['is_valid'], bool)
                    assert isinstance(data['discount_amount_cents'], int)
                    assert isinstance(data['final_amount_cents'], int)
    
    def test_notification_api_contracts(self):
        """Test notification API endpoint contracts."""
        
        # Test notification sending endpoint
        response = self.client.post('/api/notifications/send', json={
            'recipient_email': 'test@example.com',
            'channel': 'email',
            'subject': 'Test Notification',
            'body': 'Test body',
            'event_type': 'test'
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test notification template creation endpoint
        response = self.client.post('/api/notifications/templates', json={
            'name': 'Test Template',
            'event_type': 'booking_confirmed',
            'channel': 'email',
            'subject': 'Booking Confirmed',
            'body': 'Your booking has been confirmed.'
        })
        
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test notification preferences endpoint
        response = self.client.get('/api/notifications/preferences')
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test notification history endpoint
        response = self.client.get('/api/notifications/history')
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
    
    def test_notification_api_request_validation(self):
        """Test notification API request validation."""
        
        # Test missing required fields
        response = self.client.post('/api/notifications/send', json={})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
        
        # Test invalid email format
        response = self.client.post('/api/notifications/send', json={
            'recipient_email': 'invalid-email',
            'channel': 'email',
            'subject': 'Test',
            'body': 'Test'
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'email' in str(data).lower()
        
        # Test invalid channel
        response = self.client.post('/api/notifications/send', json={
            'recipient_email': 'test@example.com',
            'channel': 'invalid_channel',
            'subject': 'Test',
            'body': 'Test'
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'channel' in str(data).lower()
        
        # Test empty subject/body
        response = self.client.post('/api/notifications/send', json={
            'recipient_email': 'test@example.com',
            'channel': 'email',
            'subject': '',  # Empty subject
            'body': 'Test'
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'subject' in str(data).lower()
    
    def test_notification_api_response_format(self):
        """Test notification API response format."""
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202,
                body="Message sent"
            )
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id', return_value=str(self.tenant.id)):
                with patch('app.middleware.auth_middleware.get_current_user_id', return_value=str(self.user.id)):
                    
                    response = self.client.post('/api/notifications/send', json={
                        'recipient_email': 'test@example.com',
                        'channel': 'email',
                        'subject': 'Test Notification',
                        'body': 'Test body',
                        'event_type': 'test'
                    })
                    
                    if response.status_code == 200:
                        data = json.loads(response.data)
                        
                        # Verify response structure
                        assert 'notification_id' in data
                        assert 'status' in data
                        assert 'sent_at' in data
                        
                        # Verify data types
                        assert isinstance(data['notification_id'], str)
                        assert isinstance(data['status'], str)
                        assert isinstance(data['sent_at'], str)
    
    def test_error_response_format(self):
        """Test error response format consistency."""
        
        # Test 400 Bad Request
        response = self.client.post('/api/payments/intent', json={
            'invalid_field': 'test'
        })
        assert response.status_code == 400
        data = json.loads(response.data)
        self._validate_error_response(data, 400)
        
        # Test 401 Unauthorized
        response = self.client.get('/api/payments/history')
        assert response.status_code == 401
        data = json.loads(response.data)
        self._validate_error_response(data, 401)
        
        # Test 404 Not Found
        response = self.client.get('/api/payments/invalid-endpoint')
        assert response.status_code == 404
        data = json.loads(response.data)
        self._validate_error_response(data, 404)
        
        # Test 422 Validation Error
        response = self.client.post('/api/payments/intent', json={
            'booking_id': str(uuid.uuid4()),
            'amount_cents': 'invalid_amount',  # Wrong type
            'currency': 'USD'
        })
        assert response.status_code == 422
        data = json.loads(response.data)
        self._validate_error_response(data, 422)
    
    def _validate_error_response(self, data, expected_status):
        """Validate error response format."""
        # Should follow Problem+JSON format
        assert 'type' in data or 'error' in data
        assert 'title' in data or 'message' in data
        assert 'status' in data or 'code' in data
        
        # Status should match expected
        if 'status' in data:
            assert data['status'] == expected_status
        elif 'code' in data:
            assert data['code'] == expected_status
    
    def test_api_versioning(self):
        """Test API versioning compliance."""
        
        # Test v1 API endpoints
        v1_endpoints = [
            '/api/v1/payments/intent',
            '/api/v1/promotions/validate',
            '/api/v1/notifications/send'
        ]
        
        for endpoint in v1_endpoints:
            response = self.client.post(endpoint, json={})
            # Should return 401 (unauthorized) or 400 (bad request), not 404
            assert response.status_code in [400, 401, 422]
    
    def test_content_type_validation(self):
        """Test content type validation."""
        
        # Test with invalid content type
        response = self.client.post(
            '/api/payments/intent',
            data='{"booking_id": "test"}',
            content_type='text/plain'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'content-type' in str(data).lower() or 'json' in str(data).lower()
        
        # Test with missing content type
        response = self.client.post(
            '/api/payments/intent',
            data='{"booking_id": "test"}'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'content-type' in str(data).lower() or 'json' in str(data).lower()
    
    def test_request_size_limits(self):
        """Test request size limits."""
        
        # Test with oversized request
        large_data = {
            'booking_id': str(uuid.uuid4()),
            'amount_cents': 5000,
            'currency': 'USD',
            'large_field': 'x' * 10000  # Large field
        }
        
        response = self.client.post('/api/payments/intent', json=large_data)
        # Should either process or return 413 (Payload Too Large)
        assert response.status_code in [400, 401, 413]
    
    def test_cors_headers(self):
        """Test CORS headers for API endpoints."""
        
        # Test preflight request
        response = self.client.options('/api/payments/intent')
        assert response.status_code == 200
        
        # Check CORS headers
        assert 'Access-Control-Allow-Origin' in response.headers
        assert 'Access-Control-Allow-Methods' in response.headers
        assert 'Access-Control-Allow-Headers' in response.headers
    
    def test_rate_limiting_headers(self):
        """Test rate limiting headers."""
        
        # Make multiple requests to test rate limiting
        for i in range(10):
            response = self.client.post('/api/payments/intent', json={
                'booking_id': str(uuid.uuid4()),
                'amount_cents': 5000,
                'currency': 'USD'
            })
            
            # Check for rate limiting headers
            if 'X-RateLimit-Limit' in response.headers:
                assert 'X-RateLimit-Remaining' in response.headers
                assert 'X-RateLimit-Reset' in response.headers
                break
    
    def test_pagination_contracts(self):
        """Test pagination contract compliance."""
        
        # Test list endpoints with pagination
        list_endpoints = [
            '/api/notifications/history',
            '/api/promotions/coupons',
            '/api/payments/history'
        ]
        
        for endpoint in list_endpoints:
            response = self.client.get(f"{endpoint}?page=1&per_page=10")
            
            if response.status_code == 200:
                data = json.loads(response.data)
                
                # Should have pagination metadata
                assert 'page' in data or 'pagination' in data
                assert 'total' in data or 'count' in data
                assert 'per_page' in data or 'limit' in data
    
    def test_webhook_contracts(self):
        """Test webhook endpoint contracts."""
        
        # Test Stripe webhook endpoint
        webhook_payload = {
            "id": "evt_contract_test",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_contract_test",
                    "status": "succeeded"
                }
            }
        }
        
        response = self.client.post(
            '/api/payments/webhook',
            data=json.dumps(webhook_payload),
            content_type='application/json',
            headers={'Stripe-Signature': 'test_signature'}
        )
        
        # Should return 200 or 400 (signature validation)
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = json.loads(response.data)
            assert 'status' in data or 'message' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
