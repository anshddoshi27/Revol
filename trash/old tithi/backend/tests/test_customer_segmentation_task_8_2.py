"""
Test Customer Segmentation (Task 8.2)

This test suite validates the customer segmentation functionality as specified in Task 8.2:
- Dynamic queries on booking + loyalty data
- Filterable by frequency, recency, spend
- Segments return expected customers
- Contract tests for spend > $1000 validation
- SEGMENT_CREATED observability hooks
- TITHI_SEGMENT_INVALID_CRITERIA error handling
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.business import Customer, CustomerMetrics, Booking
from app.models.financial import Payment
from app.models.core import Tenant, User, Membership
from app.services.business_phase2 import CustomerService
from app.middleware.error_handler import TithiError


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
        slug='test-tenant',
        tz='UTC'
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user(app):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name='Test User',
        primary_email='test@example.com'
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
        role='owner'
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def test_customers(app, test_tenant):
    """Create test customers with different metrics."""
    customers = []
    
    # Customer 1: High value customer (5 bookings, $2000 spend)
    customer1 = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='High Value Customer',
        email='highvalue@example.com',
        phone='+1234567890',
        marketing_opt_in=True,
        is_first_time=False,
        customer_first_booking_at=datetime.utcnow() - timedelta(days=90)
    )
    db.session.add(customer1)
    
    metrics1 = CustomerMetrics(
        tenant_id=test_tenant.id,
        customer_id=customer1.id,
        total_bookings_count=5,
        first_booking_at=datetime.utcnow() - timedelta(days=90),
        last_booking_at=datetime.utcnow() - timedelta(days=7),
        total_spend_cents=200000,  # $2000
        no_show_count=0,
        canceled_count=1
    )
    db.session.add(metrics1)
    customers.append(customer1)
    
    # Customer 2: Frequent customer (10 bookings, $1500 spend)
    customer2 = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='Frequent Customer',
        email='frequent@example.com',
        phone='+1234567891',
        marketing_opt_in=True,
        is_first_time=False,
        customer_first_booking_at=datetime.utcnow() - timedelta(days=120)
    )
    db.session.add(customer2)
    
    metrics2 = CustomerMetrics(
        tenant_id=test_tenant.id,
        customer_id=customer2.id,
        total_bookings_count=10,
        first_booking_at=datetime.utcnow() - timedelta(days=120),
        last_booking_at=datetime.utcnow() - timedelta(days=3),
        total_spend_cents=150000,  # $1500
        no_show_count=1,
        canceled_count=2
    )
    db.session.add(metrics2)
    customers.append(customer2)
    
    # Customer 3: Lapsed customer (2 bookings, $500 spend, last booking 60 days ago)
    customer3 = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='Lapsed Customer',
        email='lapsed@example.com',
        phone='+1234567892',
        marketing_opt_in=False,
        is_first_time=False,
        customer_first_booking_at=datetime.utcnow() - timedelta(days=150)
    )
    db.session.add(customer3)
    
    metrics3 = CustomerMetrics(
        tenant_id=test_tenant.id,
        customer_id=customer3.id,
        total_bookings_count=2,
        first_booking_at=datetime.utcnow() - timedelta(days=150),
        last_booking_at=datetime.utcnow() - timedelta(days=60),
        total_spend_cents=50000,  # $500
        no_show_count=0,
        canceled_count=0
    )
    db.session.add(metrics3)
    customers.append(customer3)
    
    # Customer 4: First-time customer (1 booking, $200 spend)
    customer4 = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='First Time Customer',
        email='firsttime@example.com',
        phone='+1234567893',
        marketing_opt_in=True,
        is_first_time=True,
        customer_first_booking_at=datetime.utcnow() - timedelta(days=5)
    )
    db.session.add(customer4)
    
    metrics4 = CustomerMetrics(
        tenant_id=test_tenant.id,
        customer_id=customer4.id,
        total_bookings_count=1,
        first_booking_at=datetime.utcnow() - timedelta(days=5),
        last_booking_at=datetime.utcnow() - timedelta(days=5),
        total_spend_cents=20000,  # $200
        no_show_count=0,
        canceled_count=0
    )
    db.session.add(metrics4)
    customers.append(customer4)
    
    db.session.commit()
    return customers


class TestCustomerSegmentationTask82:
    """Test customer segmentation functionality (Task 8.2)."""
    
    def test_get_customers_by_segment_frequency_criteria(self, app, test_tenant, test_customers):
        """Test segmentation by frequency criteria."""
        customer_service = CustomerService()
        
        # Test min_bookings criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'min_bookings': 5}
        )
        assert total == 2  # customer1 (5 bookings) and customer2 (10 bookings)
        assert len(customers) == 2
        
        # Test max_bookings criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'max_bookings': 3}
        )
        assert total == 2  # customer3 (2 bookings) and customer4 (1 booking)
        assert len(customers) == 2
        
        # Test range criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'min_bookings': 3, 'max_bookings': 8}
        )
        assert total == 1  # Only customer1 (5 bookings)
        assert len(customers) == 1
        assert customers[0].display_name == 'High Value Customer'
    
    def test_get_customers_by_segment_recency_criteria(self, app, test_tenant, test_customers):
        """Test segmentation by recency criteria."""
        customer_service = CustomerService()
        
        # Test days_since_last_booking criteria (customers who haven't booked in 30+ days)
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'days_since_last_booking': 30}
        )
        assert total == 1  # Only customer3 (last booking 60 days ago)
        assert len(customers) == 1
        assert customers[0].display_name == 'Lapsed Customer'
    
    def test_get_customers_by_segment_spend_criteria(self, app, test_tenant, test_customers):
        """Test segmentation by spend criteria."""
        customer_service = CustomerService()
        
        # Test min_spend_cents criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'min_spend_cents': 100000}  # $1000+
        )
        assert total == 2  # customer1 ($2000) and customer2 ($1500)
        assert len(customers) == 2
        
        # Test max_spend_cents criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'max_spend_cents': 100000}  # $1000 or less
        )
        assert total == 2  # customer3 ($500) and customer4 ($200)
        assert len(customers) == 2
    
    def test_get_customers_by_segment_customer_status_criteria(self, app, test_tenant, test_customers):
        """Test segmentation by customer status criteria."""
        customer_service = CustomerService()
        
        # Test is_first_time criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'is_first_time': True}
        )
        assert total == 1  # Only customer4
        assert len(customers) == 1
        assert customers[0].display_name == 'First Time Customer'
        
        # Test marketing_opt_in criteria
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'marketing_opt_in': True}
        )
        assert total == 3  # customer1, customer2, customer4
        assert len(customers) == 3
        
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'marketing_opt_in': False}
        )
        assert total == 1  # Only customer3
        assert len(customers) == 1
        assert customers[0].display_name == 'Lapsed Customer'
    
    def test_get_customers_by_segment_combined_criteria(self, app, test_tenant, test_customers):
        """Test segmentation with combined criteria."""
        customer_service = CustomerService()
        
        # Test combined criteria: frequent customers with high spend
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {
                'min_bookings': 5,
                'min_spend_cents': 150000,  # $1500+
                'marketing_opt_in': True
            }
        )
        assert total == 2  # customer1 and customer2
        assert len(customers) == 2
        
        # Test combined criteria: lapsed customers
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {
                'days_since_last_booking': 30,
                'max_spend_cents': 100000  # $1000 or less
            }
        )
        assert total == 1  # Only customer3
        assert len(customers) == 1
        assert customers[0].display_name == 'Lapsed Customer'
    
    def test_get_customers_by_segment_pagination(self, app, test_tenant, test_customers):
        """Test segmentation with pagination."""
        customer_service = CustomerService()
        
        # Test pagination
        customers_page1, total = customer_service.get_customers_by_segment(
            test_tenant.id, {}, page=1, per_page=2
        )
        assert total == 4  # All customers
        assert len(customers_page1) == 2  # First page
        
        customers_page2, total = customer_service.get_customers_by_segment(
            test_tenant.id, {}, page=2, per_page=2
        )
        assert total == 4  # All customers
        assert len(customers_page2) == 2  # Second page
    
    def test_get_customers_by_segment_tenant_isolation(self, app, test_tenant, test_customers):
        """Test tenant isolation in segmentation."""
        customer_service = CustomerService()
        
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug='other-tenant',
            tz='UTC'
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        # Test that segmentation only returns customers from the specified tenant
        customers, total = customer_service.get_customers_by_segment(
            other_tenant.id, {}
        )
        assert total == 0  # No customers for other tenant
        assert len(customers) == 0
        
        # Test original tenant still works
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {}
        )
        assert total == 4  # All customers for original tenant
        assert len(customers) == 4


class TestCustomerSegmentationAPITask82:
    """Test customer segmentation API endpoints (Task 8.2)."""
    
    def test_get_customer_segments_api(self, client, test_tenant, test_user, test_membership, test_customers):
        """Test GET /customers/segments API endpoint."""
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user, \
             patch('app.middleware.auth_middleware.get_current_tenant') as mock_tenant:
            
            mock_user.return_value = test_user
            mock_tenant.return_value = test_tenant
            
            # Test frequency criteria
            response = client.get('/api/v1/crm/customers/segments?min_bookings=5')
            assert response.status_code == 200
            
            data = response.get_json()
            assert 'customers' in data
            assert 'criteria' in data
            assert 'pagination' in data
            assert len(data['customers']) == 2  # customer1 and customer2
            assert data['criteria']['min_bookings'] == 5
            
            # Test spend criteria
            response = client.get('/api/v1/crm/customers/segments?min_spend_cents=100000')
            assert response.status_code == 200
            
            data = response.get_json()
            assert len(data['customers']) == 2  # customer1 and customer2
            assert data['criteria']['min_spend_cents'] == 100000
    
    def test_post_customer_segments_api(self, client, test_tenant, test_user, test_membership, test_customers):
        """Test POST /customers/segments API endpoint."""
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user, \
             patch('app.middleware.auth_middleware.get_current_tenant') as mock_tenant:
            
            mock_user.return_value = test_user
            mock_tenant.return_value = test_tenant
            
            # Test valid criteria
            criteria = {
                'min_spend_cents': 100000,  # $1000+
                'min_bookings': 3
            }
            
            response = client.post('/api/v1/crm/customers/segments', 
                                 json={'criteria': criteria})
            assert response.status_code == 200
            
            data = response.get_json()
            assert 'customers' in data
            assert 'criteria' in data
            assert 'pagination' in data
            assert len(data['customers']) == 2  # customer1 and customer2
            assert data['criteria'] == criteria
    
    def test_post_customer_segments_api_invalid_criteria(self, client, test_tenant, test_user, test_membership):
        """Test POST /customers/segments API with invalid criteria."""
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user, \
             patch('app.middleware.auth_middleware.get_current_tenant') as mock_tenant:
            
            mock_user.return_value = test_user
            mock_tenant.return_value = test_tenant
            
            # Test missing criteria
            response = client.post('/api/v1/crm/customers/segments', json={})
            assert response.status_code == 422
            
            data = response.get_json()
            assert data['code'] == 'TITHI_SEGMENT_INVALID_CRITERIA'
            
            # Test invalid criteria format
            response = client.post('/api/v1/crm/customers/segments', 
                                 json={'criteria': 'invalid'})
            assert response.status_code == 422
            
            data = response.get_json()
            assert data['code'] == 'TITHI_SEGMENT_INVALID_CRITERIA'
            
            # Test invalid criteria key
            response = client.post('/api/v1/crm/customers/segments', 
                                 json={'criteria': {'invalid_key': 100}})
            assert response.status_code == 422
            
            data = response.get_json()
            assert data['code'] == 'TITHI_SEGMENT_INVALID_CRITERIA'
            
            # Test invalid numeric value
            response = client.post('/api/v1/crm/customers/segments', 
                                 json={'criteria': {'min_spend_cents': -100}})
            assert response.status_code == 422
            
            data = response.get_json()
            assert data['code'] == 'TITHI_SEGMENT_INVALID_CRITERIA'
            
            # Test invalid boolean value
            response = client.post('/api/v1/crm/customers/segments', 
                                 json={'criteria': {'is_first_time': 'invalid'}})
            assert response.status_code == 422
            
            data = response.get_json()
            assert data['code'] == 'TITHI_SEGMENT_INVALID_CRITERIA'


class TestCustomerSegmentationContractTestsTask82:
    """Test customer segmentation contract tests (Task 8.2)."""
    
    def test_contract_test_spend_greater_than_1000(self, app, test_tenant, test_customers):
        """Contract test: Given tenant has 10 customers, When filter applied spend > $1000, Then only qualifying customers returned."""
        customer_service = CustomerService()
        
        # Apply filter for spend > $1000 (100000 cents)
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'min_spend_cents': 100001}  # > $1000
        )
        
        # Should return only customers with spend > $1000
        assert total == 2  # customer1 ($2000) and customer2 ($1500)
        assert len(customers) == 2
        
        # Verify all returned customers have spend > $1000
        for customer in customers:
            assert customer.metrics.total_spend_cents > 100000
    
    def test_contract_test_frequent_filter_returns_top_bookers(self, app, test_tenant, test_customers):
        """Contract test: Frequent filter → returns top bookers."""
        customer_service = CustomerService()
        
        # Apply filter for frequent customers (5+ bookings)
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'min_bookings': 5}
        )
        
        # Should return only frequent customers
        assert total == 2  # customer1 (5 bookings) and customer2 (10 bookings)
        assert len(customers) == 2
        
        # Verify all returned customers have 5+ bookings
        for customer in customers:
            assert customer.metrics.total_bookings_count >= 5
        
        # Verify customer2 (10 bookings) is included
        customer_names = [c.display_name for c in customers]
        assert 'Frequent Customer' in customer_names
        assert 'High Value Customer' in customer_names


class TestCustomerSegmentationObservabilityTask82:
    """Test customer segmentation observability hooks (Task 8.2)."""
    
    @patch('app.services.business_phase2.CustomerService._emit_event')
    def test_segment_created_observability_hook(self, mock_emit_event, app, test_tenant, test_customers):
        """Test SEGMENT_CREATED observability hook emission."""
        customer_service = CustomerService()
        
        # Create a segment
        criteria = {'min_spend_cents': 100000}
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, criteria
        )
        
        # Verify SEGMENT_CREATED event was emitted
        mock_emit_event.assert_called_once_with(
            test_tenant.id, 
            "SEGMENT_CREATED", 
            {
                "criteria": criteria,
                "customer_count": total,
                "page": 1,
                "per_page": 20
            }
        )
    
    @patch('app.services.business_phase2.CustomerService._emit_event')
    def test_segment_created_observability_hook_api(self, mock_emit_event, client, test_tenant, test_user, test_membership, test_customers):
        """Test SEGMENT_CREATED observability hook emission via API."""
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user, \
             patch('app.middleware.auth_middleware.get_current_tenant') as mock_tenant:
            
            mock_user.return_value = test_user
            mock_tenant.return_value = test_tenant
            
            # Create a segment via API
            criteria = {'min_spend_cents': 100000}
            response = client.post('/api/v1/crm/customers/segments', 
                                 json={'criteria': criteria})
            assert response.status_code == 200
            
            # Verify SEGMENT_CREATED event was emitted
            mock_emit_event.assert_called_once_with(
                test_tenant.id, 
                "SEGMENT_CREATED", 
                {
                    "criteria": criteria,
                    "customer_count": 2,  # customer1 and customer2
                    "page": 1,
                    "per_page": 20
                }
            )


class TestCustomerSegmentationNorthStarInvariantsTask82:
    """Test customer segmentation North-Star invariants (Task 8.2)."""
    
    def test_segments_reproducible(self, app, test_tenant, test_customers):
        """Test that segments are reproducible."""
        customer_service = CustomerService()
        
        criteria = {'min_spend_cents': 100000}
        
        # Run segmentation multiple times
        customers1, total1 = customer_service.get_customers_by_segment(
            test_tenant.id, criteria
        )
        customers2, total2 = customer_service.get_customers_by_segment(
            test_tenant.id, criteria
        )
        
        # Results should be identical
        assert total1 == total2
        assert len(customers1) == len(customers2)
        
        # Customer IDs should be identical
        ids1 = [str(c.id) for c in customers1]
        ids2 = [str(c.id) for c in customers2]
        assert set(ids1) == set(ids2)
    
    def test_segments_never_cross_tenants(self, app, test_tenant, test_customers):
        """Test that segments never cross tenants."""
        customer_service = CustomerService()
        
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug='other-tenant',
            tz='UTC'
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        # Create customer for other tenant
        other_customer = Customer(
            id=uuid.uuid4(),
            tenant_id=other_tenant.id,
            display_name='Other Tenant Customer',
            email='other@example.com',
            phone='+1234567899',
            marketing_opt_in=True,
            is_first_time=False
        )
        db.session.add(other_customer)
        
        other_metrics = CustomerMetrics(
            tenant_id=other_tenant.id,
            customer_id=other_customer.id,
            total_bookings_count=10,
            total_spend_cents=200000  # $2000
        )
        db.session.add(other_metrics)
        db.session.commit()
        
        # Test segmentation on original tenant
        customers, total = customer_service.get_customers_by_segment(
            test_tenant.id, {'min_spend_cents': 100000}
        )
        
        # Should only return customers from original tenant
        assert total == 2  # customer1 and customer2 from original tenant
        assert len(customers) == 2
        
        # Verify no customers from other tenant
        tenant_ids = [c.tenant_id for c in customers]
        assert all(tid == test_tenant.id for tid in tenant_ids)
        
        # Test segmentation on other tenant
        customers, total = customer_service.get_customers_by_segment(
            other_tenant.id, {'min_spend_cents': 100000}
        )
        
        # Should only return customer from other tenant
        assert total == 1
        assert len(customers) == 1
        assert customers[0].tenant_id == other_tenant.id
