"""
Task 9.2: Customer Analytics Contract Tests

This module provides comprehensive contract tests for Task 9.2 customer analytics
including churn calculation validation, retention metrics, and tenant isolation.

Contract Tests (Black-box): Given 10 customers, 2 inactive > 90d, When churn calculated, Then churn = 20%.
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta, date
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment
from app.services.analytics_service import AnalyticsService, BusinessMetricsService
from app.middleware.auth_middleware import get_current_user


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
        slug="test-tenant",
        tz="UTC"
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user(app):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name="Test User",
        primary_email="test@example.com"
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def test_membership(app, test_tenant, test_user):
    """Create test membership."""
    membership = Membership(
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role="owner"
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers."""
    return {
        'Authorization': f'Bearer {test_user.id}',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def test_customers_with_bookings(app, test_tenant):
    """Create test customers with various booking patterns for churn testing."""
    customers = []
    
    # Create 10 customers total
    for i in range(10):
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=test_tenant.id,
            display_name=f"Customer {i+1}",
            email=f"customer{i+1}@example.com",
            created_at=datetime.now() - timedelta(days=120)  # Created 120 days ago
        )
        db.session.add(customer)
        customers.append(customer)
    
    db.session.commit()
    
    # Create bookings for customers
    today = date.today()
    
    # 2 customers with no bookings in last 90 days (churned)
    for i in range(2):
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customers[i].id,
            resource_id=uuid.uuid4(),  # Mock resource
            client_generated_id=f"booking-{i+1}",
            service_snapshot={"name": "Test Service"},
            start_at=datetime.combine(today - timedelta(days=100), datetime.min.time()),
            end_at=datetime.combine(today - timedelta(days=100), datetime.min.time()) + timedelta(hours=1),
            booking_tz="UTC",
            status="completed"
        )
        db.session.add(booking)
    
    # 8 customers with bookings in last 90 days (active)
    for i in range(2, 10):
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customers[i].id,
            resource_id=uuid.uuid4(),  # Mock resource
            client_generated_id=f"booking-{i+1}",
            service_snapshot={"name": "Test Service"},
            start_at=datetime.combine(today - timedelta(days=30), datetime.min.time()),
            end_at=datetime.combine(today - timedelta(days=30), datetime.min.time()) + timedelta(hours=1),
            booking_tz="UTC",
            status="completed"
        )
        db.session.add(booking)
    
    db.session.commit()
    return customers


class TestCustomerAnalyticsTask92:
    """Test Task 9.2: Customer Analytics with churn and retention calculations."""
    
    def test_churn_calculation_contract_test(self, app, test_tenant, test_customers_with_bookings):
        """Contract test: Given 10 customers, 2 inactive > 90d, When churn calculated, Then churn = 20%."""
        with app.app_context():
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            metrics = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            # Verify churn calculation
            assert metrics['churn_rate'] == 20.0, f"Expected churn rate 20%, got {metrics['churn_rate']}%"
            assert metrics['churn_definition'] == '90_days_no_booking'
            assert metrics['customer_segments']['churned_customers'] == 2
            assert metrics['customer_segments']['active_customers'] == 8
            assert metrics['total_customers'] == 10
    
    def test_retention_rate_calculation(self, app, test_tenant, test_customers_with_bookings):
        """Test retention rate calculation."""
        with app.app_context():
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            metrics = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            # Verify retention calculation
            expected_retention = (8 / 10) * 100  # 8 active out of 10 total
            assert metrics['retention_rate'] == expected_retention
            assert metrics['customer_segments']['active_customers'] == 8
    
    def test_customer_segments_accuracy(self, app, test_tenant, test_customers_with_bookings):
        """Test customer segmentation accuracy."""
        with app.app_context():
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            metrics = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            segments = metrics['customer_segments']
            
            # Verify segment counts
            assert segments['churned_customers'] == 2
            assert segments['active_customers'] == 8
            assert segments['new_customers'] == 0  # All customers created before period
            assert segments['returning_customers'] == 8  # All active customers are returning
    
    def test_tenant_isolation(self, app, test_tenant, test_customers_with_bookings):
        """Test tenant isolation in customer analytics."""
        with app.app_context():
            # Create another tenant with customers
            other_tenant = Tenant(
                id=uuid.uuid4(),
                slug="other-tenant",
                tz="UTC"
            )
            db.session.add(other_tenant)
            
            other_customer = Customer(
                id=uuid.uuid4(),
                tenant_id=other_tenant.id,
                display_name="Other Customer",
                email="other@example.com"
            )
            db.session.add(other_customer)
            db.session.commit()
            
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            # Test first tenant
            metrics1 = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            # Test second tenant
            metrics2 = analytics_service.get_customer_metrics(
                other_tenant.id, start_date, end_date
            )
            
            # Verify isolation
            assert metrics1['total_customers'] == 10
            assert metrics2['total_customers'] == 1
            assert metrics1['churn_rate'] == 20.0
            assert metrics2['churn_rate'] == 0.0  # No bookings = no churn
    
    def test_api_endpoint_churn_calculation(self, client, test_tenant, test_customers_with_bookings, auth_headers):
        """Test API endpoint returns correct churn calculation."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            start_date = (date.today() - timedelta(days=30)).isoformat()
            end_date = date.today().isoformat()
            
            response = client.get(
                f'/api/v1/analytics/customers?start_date={start_date}&end_date={end_date}',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            
            assert 'customer_metrics' in data
            assert data['customer_metrics']['churn_rate'] == 20.0
            assert data['customer_metrics']['churn_definition'] == '90_days_no_booking'
            assert data['customer_metrics']['customer_segments']['churned_customers'] == 2
    
    def test_api_endpoint_date_validation(self, client, test_tenant, auth_headers):
        """Test API endpoint date validation."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            # Test missing dates
            response = client.get('/api/v1/analytics/customers', headers=auth_headers)
            assert response.status_code == 400
            data = response.get_json()
            assert data['code'] == 'TITHI_ANALYTICS_INVALID_DATE_RANGE'
            
            # Test invalid date range
            today = date.today().isoformat()
            response = client.get(
                f'/api/v1/analytics/customers?start_date={today}&end_date={today}',
                headers=auth_headers
            )
            assert response.status_code == 400
            data = response.get_json()
            assert data['code'] == 'TITHI_ANALYTICS_INVALID_DATE_RANGE'
    
    def test_observability_hook_emission(self, client, test_tenant, test_customers_with_bookings, auth_headers):
        """Test that observability hook ANALYTICS_CUSTOMERS_QUERIED is emitted."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            with patch('app.blueprints.analytics_api.logger') as mock_logger:
                start_date = (date.today() - timedelta(days=30)).isoformat()
                end_date = date.today().isoformat()
                
                response = client.get(
                    f'/api/v1/analytics/customers?start_date={start_date}&end_date={end_date}',
                    headers=auth_headers
                )
                
                assert response.status_code == 200
                
                # Verify observability hook was called
                mock_logger.info.assert_called_once()
                call_args = mock_logger.info.call_args
                assert call_args[0][0] == "ANALYTICS_CUSTOMERS_QUERIED"
                
                extra_data = call_args[1]['extra']
                assert 'tenant_id' in extra_data
                assert 'churn_rate' in extra_data
                assert 'retention_rate' in extra_data
                assert 'total_customers' in extra_data
                assert extra_data['churn_rate'] == 20.0
    
    def test_edge_case_no_customers(self, app, test_tenant):
        """Test edge case with no customers."""
        with app.app_context():
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            metrics = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            # Verify zero division handling
            assert metrics['total_customers'] == 0
            assert metrics['churn_rate'] == 0.0
            assert metrics['retention_rate'] == 0.0
            assert metrics['customer_segments']['churned_customers'] == 0
            assert metrics['customer_segments']['active_customers'] == 0
    
    def test_edge_case_all_customers_churned(self, app, test_tenant):
        """Test edge case where all customers are churned."""
        with app.app_context():
            # Create customers with old bookings only
            customers = []
            for i in range(5):
                customer = Customer(
                    id=uuid.uuid4(),
                    tenant_id=test_tenant.id,
                    display_name=f"Churned Customer {i+1}",
                    email=f"churned{i+1}@example.com",
                    created_at=datetime.now() - timedelta(days=120)
                )
                db.session.add(customer)
                customers.append(customer)
            
            db.session.commit()
            
            # Create old bookings (more than 90 days ago)
            today = date.today()
            for i, customer in enumerate(customers):
                booking = Booking(
                    id=uuid.uuid4(),
                    tenant_id=test_tenant.id,
                    customer_id=customer.id,
                    resource_id=uuid.uuid4(),
                    client_generated_id=f"old-booking-{i+1}",
                    service_snapshot={"name": "Test Service"},
                    start_at=datetime.combine(today - timedelta(days=100), datetime.min.time()),
                    end_at=datetime.combine(today - timedelta(days=100), datetime.min.time()) + timedelta(hours=1),
                    booking_tz="UTC",
                    status="completed"
                )
                db.session.add(booking)
            
            db.session.commit()
            
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            metrics = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            # Verify all customers are churned
            assert metrics['total_customers'] == 5
            assert metrics['churn_rate'] == 100.0
            assert metrics['retention_rate'] == 0.0
            assert metrics['customer_segments']['churned_customers'] == 5
            assert metrics['customer_segments']['active_customers'] == 0


class TestCustomerAnalyticsIntegration:
    """Integration tests for customer analytics with real database operations."""
    
    def test_customer_analytics_with_payments(self, app, test_tenant):
        """Test customer analytics with payment data for lifetime value calculation."""
        with app.app_context():
            # Create customer with bookings and payments
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Test Customer",
                email="test@example.com"
            )
            db.session.add(customer)
            db.session.commit()
            
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=customer.id,
                resource_id=uuid.uuid4(),
                client_generated_id="test-booking",
                service_snapshot={"name": "Test Service"},
                start_at=datetime.now(),
                end_at=datetime.now() + timedelta(hours=1),
                booking_tz="UTC",
                status="completed"
            )
            db.session.add(booking)
            db.session.commit()
            
            # Create payment
            payment = Payment(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                booking_id=booking.id,
                amount_cents=10000,  # $100
                currency="USD",
                status="captured"
            )
            db.session.add(payment)
            db.session.commit()
            
            analytics_service = BusinessMetricsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            metrics = analytics_service.get_customer_metrics(
                test_tenant.id, start_date, end_date
            )
            
            # Verify lifetime value calculation
            assert metrics['customer_lifetime_value'] == 10000
            assert metrics['total_customers'] == 1
            assert metrics['customer_segments']['active_customers'] == 1
