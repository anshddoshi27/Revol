"""
Test Checkout Endpoint

This module tests the /payments/checkout endpoint for Task 5.1: Stripe Integration.
Tests cover the complete checkout flow with proper validation and error handling.
"""

import pytest
import json
import uuid
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Booking, Service, Customer, Resource
from app.models.financial import Payment


class TestCheckoutEndpoint:
    """Test suite for the checkout endpoint."""
    
    @pytest.fixture
    def app(self):
        """Create test application."""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def test_tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon",
                tz="America/New_York"
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @pytest.fixture
    def test_user(self, app):
        """Create test user."""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                display_name="Test User",
                primary_email="test@example.com"
            )
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def test_membership(self, app, test_tenant, test_user):
        """Create test membership."""
        with app.app_context():
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                user_id=test_user.id,
                role="owner"
            )
            db.session.add(membership)
            db.session.commit()
            return membership
    
    @pytest.fixture
    def test_customer(self, app, test_tenant):
        """Create test customer."""
        with app.app_context():
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Test Customer",
                email="customer@example.com"
            )
            db.session.add(customer)
            db.session.commit()
            return customer
    
    @pytest.fixture
    def test_resource(self, app, test_tenant):
        """Create test resource."""
        with app.app_context():
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                name="Test Staff",
                type="staff",
                capacity=1,
                tz="America/New_York"
            )
            db.session.add(resource)
            db.session.commit()
            return resource
    
    @pytest.fixture
    def test_service(self, app, test_tenant):
        """Create test service."""
        with app.app_context():
            service = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                name="Test Service",
                description="A test service",
                duration_min=60,
                price_cents=5000,  # $50.00
                active=True
            )
            db.session.add(service)
            db.session.commit()
            return service
    
    @pytest.fixture
    def test_booking(self, app, test_tenant, test_customer, test_resource, test_service):
        """Create test booking."""
        with app.app_context():
            start_time = datetime.utcnow() + timedelta(days=1)
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=test_customer.id,
                resource_id=test_resource.id,
                service_id=test_service.id,
                start_at=start_time,
                end_at=start_time + timedelta(minutes=60),
                booking_tz="America/New_York",
                status="pending",
                client_generated_id="test-booking-123",
                service_snapshot={
                    "id": str(test_service.id),
                    "name": "Test Service",
                    "price_cents": 5000,
                    "duration_min": 60
                }
            )
            db.session.add(booking)
            db.session.commit()
            return booking
    
    def test_checkout_success(self, client, test_tenant, test_user, test_booking):
        """Test successful checkout creation."""
        with patch('app.blueprints.payment_api.payment_service') as mock_payment_service:
            # Mock the payment service
            mock_payment = MagicMock()
            mock_payment.id = uuid.uuid4()
            mock_payment.provider_payment_id = "pi_test_123"
            mock_payment.status = "requires_action"
            mock_payment.amount_cents = 5000
            mock_payment.currency_code = "USD"
            mock_payment.created_at = datetime.utcnow()
            
            mock_payment_service.create_payment_intent.return_value = mock_payment
            mock_payment_service._get_stripe_secret_key.return_value = "sk_test_123"
            
            # Mock Stripe API
            with patch('stripe.PaymentIntent.retrieve') as mock_stripe_retrieve:
                mock_stripe_intent = MagicMock()
                mock_stripe_intent.client_secret = "pi_test_123_secret_456"
                mock_stripe_retrieve.return_value = mock_stripe_intent
                
                # Mock JWT token
                with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
                     patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
                    
                    mock_tenant_id.return_value = str(test_tenant.id)
                    mock_user_id.return_value = str(test_user.id)
                    
                    # Make request
                    response = client.post('/api/payments/checkout', 
                                        json={
                                            'booking_id': str(test_booking.id),
                                            'payment_method': 'card'
                                        },
                                        headers={'Authorization': 'Bearer test-token'})
                    
                    # Assertions
                    assert response.status_code == 201
                    data = json.loads(response.data)
                    
                    assert 'payment_intent_id' in data
                    assert 'client_secret' in data
                    assert 'status' in data
                    assert 'amount_cents' in data
                    assert 'currency_code' in data
                    assert 'created_at' in data
                    
                    assert data['payment_intent_id'] == "pi_test_123"
                    assert data['client_secret'] == "pi_test_123_secret_456"
                    assert data['status'] == "requires_action"
                    assert data['amount_cents'] == 5000
                    assert data['currency_code'] == "USD"
    
    def test_checkout_booking_not_found(self, client, test_tenant, test_user):
        """Test checkout with non-existent booking."""
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
             patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
            
            mock_tenant_id.return_value = str(test_tenant.id)
            mock_user_id.return_value = str(test_user.id)
            
            # Make request with non-existent booking
            response = client.post('/api/payments/checkout', 
                                json={
                                    'booking_id': str(uuid.uuid4()),
                                    'payment_method': 'card'
                                },
                                headers={'Authorization': 'Bearer test-token'})
            
            # Assertions
            assert response.status_code == 404
            data = json.loads(response.data)
            assert data['error'] == 'TITHI_BOOKING_NOT_FOUND'
            assert 'Booking not found' in data['message']
    
    def test_checkout_invalid_booking_status(self, client, test_tenant, test_user, test_booking):
        """Test checkout with invalid booking status."""
        with app.app_context():
            # Update booking to invalid status
            test_booking.status = 'canceled'
            db.session.commit()
        
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
             patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
            
            mock_tenant_id.return_value = str(test_tenant.id)
            mock_user_id.return_value = str(test_user.id)
            
            # Make request
            response = client.post('/api/payments/checkout', 
                                json={
                                    'booking_id': str(test_booking.id),
                                    'payment_method': 'card'
                                },
                                headers={'Authorization': 'Bearer test-token'})
            
            # Assertions
            assert response.status_code == 400
            data = json.loads(response.data)
            assert data['error'] == 'TITHI_BOOKING_INVALID_STATUS'
            assert 'canceled' in data['message']
    
    def test_checkout_invalid_payment_method(self, client, test_tenant, test_user, test_booking):
        """Test checkout with invalid payment method."""
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
             patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
            
            mock_tenant_id.return_value = str(test_tenant.id)
            mock_user_id.return_value = str(test_user.id)
            
            # Make request with invalid payment method
            response = client.post('/api/payments/checkout', 
                                json={
                                    'booking_id': str(test_booking.id),
                                    'payment_method': 'invalid_method'
                                },
                                headers={'Authorization': 'Bearer test-token'})
            
            # Assertions
            assert response.status_code == 400
    
    def test_checkout_missing_booking_id(self, client, test_tenant, test_user):
        """Test checkout with missing booking_id."""
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
             patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
            
            mock_tenant_id.return_value = str(test_tenant.id)
            mock_user_id.return_value = str(test_user.id)
            
            # Make request without booking_id
            response = client.post('/api/payments/checkout', 
                                json={
                                    'payment_method': 'card'
                                },
                                headers={'Authorization': 'Bearer test-token'})
            
            # Assertions
            assert response.status_code == 400
    
    def test_checkout_missing_payment_method(self, client, test_tenant, test_user, test_booking):
        """Test checkout with missing payment_method."""
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
             patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
            
            mock_tenant_id.return_value = str(test_tenant.id)
            mock_user_id.return_value = str(test_user.id)
            
            # Make request without payment_method
            response = client.post('/api/payments/checkout', 
                                json={
                                    'booking_id': str(test_booking.id)
                                },
                                headers={'Authorization': 'Bearer test-token'})
            
            # Assertions
            assert response.status_code == 400
    
    def test_checkout_unauthorized(self, client, test_booking):
        """Test checkout without authentication."""
        # Make request without Authorization header
        response = client.post('/api/payments/checkout', 
                            json={
                                'booking_id': str(test_booking.id),
                                'payment_method': 'card'
                            })
        
        # Assertions
        assert response.status_code == 401
    
    def test_checkout_payment_service_error(self, client, test_tenant, test_user, test_booking):
        """Test checkout when payment service fails."""
        with patch('app.blueprints.payment_api.payment_service') as mock_payment_service:
            # Mock payment service to raise exception
            mock_payment_service.create_payment_intent.side_effect = Exception("Stripe API error")
            mock_payment_service._get_stripe_secret_key.return_value = "sk_test_123"
            
            with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant_id, \
                 patch('app.middleware.auth_middleware.get_current_user_id') as mock_user_id:
                
                mock_tenant_id.return_value = str(test_tenant.id)
                mock_user_id.return_value = str(test_user.id)
                
                # Make request
                response = client.post('/api/payments/checkout', 
                                    json={
                                        'booking_id': str(test_booking.id),
                                        'payment_method': 'card'
                                    },
                                    headers={'Authorization': 'Bearer test-token'})
                
                # Assertions
                assert response.status_code == 500
                data = json.loads(response.data)
                assert data['error'] == 'TITHI_CHECKOUT_FAILED'
                assert 'Failed to create checkout session' in data['message']


if __name__ == '__main__':
    pytest.main([__file__])
