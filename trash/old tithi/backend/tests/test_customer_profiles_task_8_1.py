"""
Test Suite for Task 8.1: Customer Profiles

This test suite validates the implementation of Task 8.1 requirements:
- Customer profiles CRUD endpoints
- Duplicate email/phone validation per tenant
- Customer profile retrieval with booking history
- TITHI_CUSTOMER_DUPLICATE error handling
- CUSTOMER_CREATED observability hooks
- Idempotency by email+tenant_id

Contract Tests (Black-box): Given customer email already exists, 
When another with same email added, Then system rejects with TITHI_CUSTOMER_DUPLICATE.
"""

import pytest
import uuid
import json
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.business import Customer, Booking
from app.models.core import Tenant, User, Membership
from app.services.business_phase2 import CustomerService
from app.middleware.error_handler import BusinessLogicError


@pytest.fixture
def app():
    """Create test application."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def test_tenant(app):
    """Create test tenant."""
    tenant = Tenant(
        id=uuid.uuid4(),
        slug="test-salon",
        tz="UTC",
        is_public_directory=True,
        created_at=datetime.utcnow()
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user(app):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name="Test Owner",
        primary_email="owner@testsalon.com",
        created_at=datetime.utcnow()
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def test_membership(app, test_tenant, test_user):
    """Create test membership."""
    membership = Membership(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role="owner",
        created_at=datetime.utcnow()
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers."""
    return {
        'Authorization': f'Bearer test-token-{test_user.id}',
        'Content-Type': 'application/json'
    }


class TestCustomerProfilesTask81:
    """Test suite for Task 8.1: Customer Profiles implementation."""

    def test_create_customer_success(self, app, client, test_tenant, auth_headers):
        """Test successful customer creation."""
        with app.app_context():
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                # Test data (Task 8.1: Input: {name, email, phone})
                customer_data = {
                    "name": "John Doe",
                    "email": "john@example.com",
                    "phone": "+1234567890"
                }
                
                response = client.post(
                    '/api/v1/crm/customers',
                    data=json.dumps(customer_data),
                    headers=auth_headers
                )
                
                assert response.status_code == 201
                data = response.get_json()
                
                # Verify response structure (Task 8.1: Output: customer_id)
                assert "customer_id" in data
                assert "customer" in data
                assert data["customer"]["display_name"] == "John Doe"
                assert data["customer"]["email"] == "john@example.com"
                assert data["customer"]["phone"] == "+1234567890"
                assert data["customer"]["is_first_time"] is True

    def test_create_customer_duplicate_email(self, app, client, test_tenant, auth_headers):
        """Test duplicate email rejection (Task 8.1 contract test)."""
        with app.app_context():
            # Create first customer
            customer1 = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Jane Doe",
                email="jane@example.com",
                phone="+0987654321",
                created_at=datetime.utcnow()
            )
            db.session.add(customer1)
            db.session.commit()
            
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                # Try to create customer with same email
                customer_data = {
                    "name": "Jane Smith",
                    "email": "jane@example.com",  # Same email
                    "phone": "+1111111111"
                }
                
                response = client.post(
                    '/api/v1/crm/customers',
                    data=json.dumps(customer_data),
                    headers=auth_headers
                )
                
                # Should reject with TITHI_CUSTOMER_DUPLICATE (Task 8.1 requirement)
                assert response.status_code == 409
                data = response.get_json()
                assert data["code"] == "TITHI_CUSTOMER_DUPLICATE"
                assert "already exists" in data["detail"]

    def test_create_customer_duplicate_phone(self, app, client, test_tenant, auth_headers):
        """Test duplicate phone rejection (Task 8.1 constraint)."""
        with app.app_context():
            # Create first customer
            customer1 = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Bob Smith",
                email="bob@example.com",
                phone="+5555555555",
                created_at=datetime.utcnow()
            )
            db.session.add(customer1)
            db.session.commit()
            
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                # Try to create customer with same phone
                customer_data = {
                    "name": "Bob Johnson",
                    "email": "bob.johnson@example.com",
                    "phone": "+5555555555"  # Same phone
                }
                
                response = client.post(
                    '/api/v1/crm/customers',
                    data=json.dumps(customer_data),
                    headers=auth_headers
                )
                
                # Should reject with TITHI_CUSTOMER_DUPLICATE
                assert response.status_code == 409
                data = response.get_json()
                assert data["code"] == "TITHI_CUSTOMER_DUPLICATE"
                assert "already exists" in data["detail"]

    def test_get_customer_profile_with_history(self, app, client, test_tenant, auth_headers):
        """Test customer profile retrieval with booking history (Task 8.1 requirement)."""
        with app.app_context():
            # Create customer
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Alice Johnson",
                email="alice@example.com",
                phone="+3333333333",
                created_at=datetime.utcnow()
            )
            db.session.add(customer)
            
            # Create sample booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=customer.id,
                resource_id=uuid.uuid4(),
                client_generated_id="test-booking-1",
                service_snapshot={"name": "Haircut", "price_cents": 5000},
                start_at=datetime.utcnow(),
                end_at=datetime.utcnow(),
                booking_tz="UTC",
                status="completed",
                created_at=datetime.utcnow()
            )
            db.session.add(booking)
            db.session.commit()
            
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                response = client.get(
                    f'/api/v1/crm/customers/{customer.id}',
                    headers=auth_headers
                )
                
                assert response.status_code == 200
                data = response.get_json()
                
                # Verify customer profile
                assert "customer" in data
                assert data["customer"]["id"] == str(customer.id)
                assert data["customer"]["display_name"] == "Alice Johnson"
                assert data["customer"]["email"] == "alice@example.com"
                
                # Verify booking history (Task 8.1: Testing: Profile retrieved with booking history)
                assert "booking_history" in data
                assert len(data["booking_history"]) == 1
                assert data["booking_history"][0]["id"] == str(booking.id)
                assert data["booking_history"][0]["status"] == "completed"
                
                # Verify metrics
                assert "metrics" in data

    def test_customer_service_duplicate_validation(self, app, test_tenant):
        """Test CustomerService duplicate validation directly."""
        with app.app_context():
            customer_service = CustomerService()
            
            # Create first customer
            customer_data1 = {
                "display_name": "Test Customer 1",
                "email": "test1@example.com",
                "phone": "+1111111111"
            }
            customer1 = customer_service.create_customer(test_tenant.id, customer_data1)
            assert customer1 is not None
            
            # Try to create duplicate email
            customer_data2 = {
                "display_name": "Test Customer 2",
                "email": "test1@example.com",  # Same email
                "phone": "+2222222222"
            }
            
            with pytest.raises(BusinessLogicError) as exc_info:
                customer_service.create_customer(test_tenant.id, customer_data2)
            
            assert exc_info.value.code == "TITHI_CUSTOMER_DUPLICATE"
            assert "already exists" in exc_info.value.message

    def test_customer_service_idempotency(self, app, test_tenant):
        """Test idempotency by email+tenant_id (Task 8.1 requirement)."""
        with app.app_context():
            customer_service = CustomerService()
            
            customer_data = {
                "display_name": "Idempotent Customer",
                "email": "idempotent@example.com",
                "phone": "+4444444444"
            }
            
            # Create customer first time
            customer1 = customer_service.create_customer(test_tenant.id, customer_data)
            assert customer1 is not None
            
            # Try to create same customer again - should fail with duplicate
            with pytest.raises(BusinessLogicError) as exc_info:
                customer_service.create_customer(test_tenant.id, customer_data)
            
            assert exc_info.value.code == "TITHI_CUSTOMER_DUPLICATE"

    def test_customer_service_observability_hooks(self, app, test_tenant):
        """Test CUSTOMER_CREATED observability hook (Task 8.1 requirement)."""
        with app.app_context():
            customer_service = CustomerService()
            
            # Mock the _emit_event method to verify it's called
            with patch.object(customer_service, '_emit_event') as mock_emit:
                customer_data = {
                    "display_name": "Observable Customer",
                    "email": "observable@example.com",
                    "phone": "+5555555555"
                }
                
                customer = customer_service.create_customer(test_tenant.id, customer_data)
                
                # Verify CUSTOMER_CREATED event was emitted
                mock_emit.assert_called_once()
                call_args = mock_emit.call_args
                assert call_args[0][0] == test_tenant.id  # tenant_id
                assert call_args[0][1] == "CUSTOMER_CREATED"  # event_code
                assert "customer_id" in call_args[0][2]  # payload
                assert call_args[0][2]["email"] == "observable@example.com"

    def test_customer_tenant_isolation(self, app, test_tenant):
        """Test tenant isolation (Task 8.1: Customer identity must remain unique within tenant)."""
        with app.app_context():
            # Create second tenant
            tenant2 = Tenant(
                id=uuid.uuid4(),
                slug="test-salon-2",
                tz="UTC",
                is_public_directory=True,
                created_at=datetime.utcnow()
            )
            db.session.add(tenant2)
            db.session.commit()
            
            customer_service = CustomerService()
            
            # Create customer in first tenant
            customer_data = {
                "display_name": "Isolated Customer",
                "email": "isolated@example.com",
                "phone": "+6666666666"
            }
            customer1 = customer_service.create_customer(test_tenant.id, customer_data)
            
            # Create customer with same email in second tenant - should succeed
            customer2 = customer_service.create_customer(tenant2.id, customer_data)
            
            # Both customers should exist
            assert customer1 is not None
            assert customer2 is not None
            assert customer1.id != customer2.id
            assert customer1.tenant_id != customer2.tenant_id

    def test_customer_validation_required_fields(self, app, client, test_tenant, auth_headers):
        """Test validation of required fields."""
        with app.app_context():
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                # Try to create customer without email or phone
                customer_data = {
                    "name": "Invalid Customer"
                }
                
                response = client.post(
                    '/api/v1/crm/customers',
                    data=json.dumps(customer_data),
                    headers=auth_headers
                )
                
                assert response.status_code == 400
                data = response.get_json()
                assert data["code"] == "TITHI_VALIDATION_ERROR"

    def test_customer_update(self, app, client, test_tenant, auth_headers):
        """Test customer update functionality."""
        with app.app_context():
            # Create customer
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Update Test Customer",
                email="update@example.com",
                phone="+7777777777",
                created_at=datetime.utcnow()
            )
            db.session.add(customer)
            db.session.commit()
            
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                # Update customer
                update_data = {
                    "display_name": "Updated Customer Name",
                    "marketing_opt_in": True
                }
                
                response = client.put(
                    f'/api/v1/crm/customers/{customer.id}',
                    data=json.dumps(update_data),
                    headers=auth_headers
                )
                
                assert response.status_code == 200
                data = response.get_json()
                assert data["customer"]["display_name"] == "Updated Customer Name"
                assert data["customer"]["marketing_opt_in"] is True

    def test_customer_list(self, app, client, test_tenant, auth_headers):
        """Test customer listing functionality."""
        with app.app_context():
            # Create multiple customers
            for i in range(3):
                customer = Customer(
                    id=uuid.uuid4(),
                    tenant_id=test_tenant.id,
                    display_name=f"List Customer {i}",
                    email=f"list{i}@example.com",
                    phone=f"+888888888{i}",
                    created_at=datetime.utcnow()
                )
                db.session.add(customer)
            db.session.commit()
            
            # Mock tenant resolution
            with patch('app.middleware.tenant_middleware.g') as mock_g:
                mock_g.tenant_id = test_tenant.id
                mock_g.user_id = uuid.uuid4()
                
                response = client.get(
                    '/api/v1/crm/customers',
                    headers=auth_headers
                )
                
                assert response.status_code == 200
                data = response.get_json()
                assert "customers" in data
                assert "pagination" in data
                assert len(data["customers"]) == 3


if __name__ == "__main__":
    pytest.main([__file__])
