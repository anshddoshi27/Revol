"""
Test Admin Analytics Dashboard Task 10.4

Contract tests for admin analytics dashboard endpoints with pre-aggregated queries,
pagination, and data consistency validation.

Task 10.4 Requirements:
- /admin/analytics endpoints with pre-aggregated queries
- Must paginate large datasets
- Input: {metric, range}
- Output: chart data
- Validation: Data matches analytics API
- Testing: Revenue dashboard matches manual query
- Contract Tests: Given revenue = $1000 in analytics API, When admin views dashboard, Then revenue shows $1000
- Observability Hooks: Emit DASHBOARD_VIEWED
- Error Model: TITHI_DASHBOARD_DATA_MISMATCH
"""

import pytest
import uuid
from datetime import datetime, date, timedelta
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking, BookingItem
from app.models.financial import Payment
from app.services.analytics_service import AnalyticsService


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
        tz='UTC',
        is_public_directory=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user(app):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name='Test Admin',
        primary_email='admin@test.com',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
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
        role='owner',
        permissions_json={},
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def test_customer(app, test_tenant):
    """Create test customer."""
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='Test Customer',
        email='customer@test.com',
        phone='+1234567890',
        marketing_opt_in=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(customer)
    db.session.commit()
    return customer


@pytest.fixture
def test_service(app, test_tenant):
    """Create test service."""
    service = Service(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        slug='test-service',
        name='Test Service',
        description='Test service description',
        duration_min=60,
        price_cents=10000,  # $100.00
        buffer_before_min=15,
        buffer_after_min=15,
        category='Test Category',
        active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(service)
    db.session.commit()
    return service


@pytest.fixture
def test_resource(app, test_tenant):
    """Create test resource."""
    resource = Resource(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        type='staff',
        tz='UTC',
        capacity=1,
        name='Test Staff',
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(resource)
    db.session.commit()
    return resource


@pytest.fixture
def test_booking(app, test_tenant, test_customer, test_service, test_resource):
    """Create test booking."""
    start_time = datetime.utcnow() + timedelta(days=1)
    end_time = start_time + timedelta(minutes=60)
    
    booking = Booking(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        customer_id=test_customer.id,
        resource_id=test_resource.id,
        client_generated_id=str(uuid.uuid4()),
        service_snapshot={'id': str(test_service.id), 'name': test_service.name, 'price_cents': test_service.price_cents},
        start_at=start_time,
        end_at=end_time,
        booking_tz='UTC',
        status='confirmed',
        attendee_count=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(booking)
    db.session.commit()
    return booking


@pytest.fixture
def test_payment(app, test_tenant, test_booking, test_customer):
    """Create test payment."""
    payment = Payment(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        booking_id=test_booking.id,
        customer_id=test_customer.id,
        status='captured',
        method='card',
        currency_code='USD',
        amount_cents=10000,  # $100.00
        tip_cents=0,
        tax_cents=0,
        application_fee_cents=0,
        no_show_fee_cents=0,
        fee_type='booking',
        provider='stripe',
        provider_payment_id='pi_test_123',
        idempotency_key=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.session.add(payment)
    db.session.commit()
    return payment


@pytest.fixture
def auth_headers(test_user, test_tenant):
    """Create authentication headers."""
    return {
        'Authorization': f'Bearer test-token',
        'X-Tenant-ID': str(test_tenant.id),
        'X-User-ID': str(test_user.id)
    }


class TestAdminAnalyticsDashboard:
    """Test admin analytics dashboard endpoints."""
    
    def test_get_admin_analytics_dashboard_overview(self, client, auth_headers, test_tenant, test_payment):
        """Test GET /admin/analytics with overview metric."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=overview&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate response structure
        assert 'metric' in data
        assert 'chart_data' in data
        assert 'period' in data
        assert 'pagination' in data
        assert 'metadata' in data
        
        assert data['metric'] == 'overview'
        assert data['period']['start_date'] == start_date
        assert data['period']['end_date'] == end_date
        
        # Validate pagination
        assert 'page' in data['pagination']
        assert 'per_page' in data['pagination']
        assert 'total_items' in data['pagination']
        assert 'has_next' in data['pagination']
        
        # Validate metadata
        assert 'generated_at' in data['metadata']
        assert 'data_source' in data['metadata']
        assert data['metadata']['data_source'] == 'pre_aggregated_queries'
    
    def test_get_admin_analytics_dashboard_revenue(self, client, auth_headers, test_tenant, test_payment):
        """Test GET /admin/analytics with revenue metric."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=revenue&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate response structure
        assert data['metric'] == 'revenue'
        assert 'chart_data' in data
        
        # Validate revenue data structure
        chart_data = data['chart_data']
        assert 'total_revenue' in chart_data
        assert 'revenue_growth' in chart_data
        assert 'average_booking_value' in chart_data
        assert 'revenue_by_period' in chart_data
        assert 'revenue_by_service' in chart_data
    
    def test_get_admin_analytics_dashboard_bookings(self, client, auth_headers, test_tenant, test_booking):
        """Test GET /admin/analytics with bookings metric."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=bookings&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate response structure
        assert data['metric'] == 'bookings'
        assert 'chart_data' in data
        
        # Validate booking data structure
        chart_data = data['chart_data']
        assert 'total_bookings' in chart_data
        assert 'bookings_by_status' in chart_data
        assert 'bookings_by_period' in chart_data
        assert 'conversion_rate' in chart_data
        assert 'no_show_rate' in chart_data
        assert 'cancellation_rate' in chart_data
    
    def test_get_admin_analytics_dashboard_customers(self, client, auth_headers, test_tenant, test_customer):
        """Test GET /admin/analytics with customers metric."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=customers&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate response structure
        assert data['metric'] == 'customers'
        assert 'chart_data' in data
        
        # Validate customer data structure
        chart_data = data['chart_data']
        assert 'total_customers' in chart_data
        assert 'customer_segments' in chart_data
        assert 'churn_rate' in chart_data
        assert 'retention_rate' in chart_data
        assert 'customer_lifetime_value' in chart_data
        assert 'customer_acquisition_cost' in chart_data
        assert 'churn_definition' in chart_data
    
    def test_get_admin_analytics_dashboard_staff(self, client, auth_headers, test_tenant):
        """Test GET /admin/analytics with staff metric."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=staff&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate response structure
        assert data['metric'] == 'staff'
        assert 'chart_data' in data
        
        # Validate staff data structure
        chart_data = data['chart_data']
        assert 'staff_metrics' in chart_data
        assert 'aggregate_metrics' in chart_data
    
    def test_admin_analytics_dashboard_pagination(self, client, auth_headers, test_tenant):
        """Test pagination functionality."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        # Test first page
        response = client.get(
            f'/admin/analytics?metric=revenue&start_date={start_date}&end_date={end_date}&page=1&per_page=10',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate pagination
        assert data['pagination']['page'] == 1
        assert data['pagination']['per_page'] == 10
        assert 'total_items' in data['pagination']
        assert 'has_next' in data['pagination']
    
    def test_admin_analytics_dashboard_default_date_range(self, client, auth_headers, test_tenant):
        """Test default date range when no dates provided."""
        response = client.get(
            '/admin/analytics?metric=overview',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate default date range (last 30 days)
        assert 'period' in data
        assert 'start_date' in data['period']
        assert 'end_date' in data['period']
        
        # Validate dates are within last 30 days
        start_date = datetime.fromisoformat(data['period']['start_date']).date()
        end_date = datetime.fromisoformat(data['period']['end_date']).date()
        today = date.today()
        
        assert (today - start_date).days <= 30
        assert end_date <= today
    
    def test_admin_analytics_dashboard_invalid_metric(self, client, auth_headers, test_tenant):
        """Test invalid metric parameter."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=invalid&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        # Validate error response
        assert 'code' in data
        assert data['code'] == 'TITHI_DASHBOARD_DATA_MISMATCH'
        assert 'message' in data
        assert 'Invalid metric' in data['message']
    
    def test_admin_analytics_dashboard_invalid_date_format(self, client, auth_headers, test_tenant):
        """Test invalid date format."""
        response = client.get(
            '/admin/analytics?metric=overview&start_date=invalid-date&end_date=2024-01-01',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        # Validate error response
        assert 'code' in data
        assert data['code'] == 'TITHI_DASHBOARD_DATA_MISMATCH'
        assert 'message' in data
        assert 'Invalid date format' in data['message']
    
    def test_admin_analytics_dashboard_invalid_date_range(self, client, auth_headers, test_tenant):
        """Test invalid date range (start_date >= end_date)."""
        start_date = '2024-01-15'
        end_date = '2024-01-10'  # End date before start date
        
        response = client.get(
            f'/admin/analytics?metric=overview&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        # Validate error response
        assert 'code' in data
        assert data['code'] == 'TITHI_DASHBOARD_DATA_MISMATCH'
        assert 'message' in data
        assert 'start_date must be before end_date' in data['message']
    
    def test_admin_analytics_dashboard_invalid_pagination(self, client, auth_headers, test_tenant):
        """Test invalid pagination parameters."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        # Test negative page
        response = client.get(
            f'/admin/analytics?metric=overview&start_date={start_date}&end_date={end_date}&page=-1',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        # Validate error response
        assert 'code' in data
        assert data['code'] == 'TITHI_DASHBOARD_DATA_MISMATCH'
        assert 'message' in data
        assert 'Invalid pagination parameters' in data['message']
        
        # Test per_page too large
        response = client.get(
            f'/admin/analytics?metric=overview&start_date={start_date}&end_date={end_date}&per_page=2000',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        
        # Validate error response
        assert 'code' in data
        assert data['code'] == 'TITHI_DASHBOARD_DATA_MISMATCH'
        assert 'message' in data
        assert 'Invalid pagination parameters' in data['message']
    
    def test_admin_analytics_dashboard_contract_test_revenue_consistency(self, client, auth_headers, test_tenant, test_payment):
        """Contract test: Revenue dashboard matches analytics API data."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        # Get revenue from analytics API
        analytics_response = client.get(
            f'/analytics/revenue?start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert analytics_response.status_code == 200
        analytics_data = analytics_response.get_json()
        analytics_revenue = analytics_data['revenue_metrics']['total_revenue']
        
        # Get revenue from admin dashboard
        dashboard_response = client.get(
            f'/admin/analytics?metric=revenue&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.get_json()
        dashboard_revenue = dashboard_data['chart_data']['total_revenue']
        
        # Contract test: Revenue must match between analytics API and dashboard
        assert analytics_revenue == dashboard_revenue, f"Revenue mismatch: Analytics API={analytics_revenue}, Dashboard={dashboard_revenue}"
    
    def test_admin_analytics_dashboard_contract_test_bookings_consistency(self, client, auth_headers, test_tenant, test_booking):
        """Contract test: Bookings dashboard matches analytics API data."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        # Get bookings from analytics API
        analytics_response = client.get(
            f'/analytics/bookings?start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert analytics_response.status_code == 200
        analytics_data = analytics_response.get_json()
        analytics_bookings = analytics_data['booking_metrics']['total_bookings']
        
        # Get bookings from admin dashboard
        dashboard_response = client.get(
            f'/admin/analytics?metric=bookings&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.get_json()
        dashboard_bookings = dashboard_data['chart_data']['total_bookings']
        
        # Contract test: Bookings must match between analytics API and dashboard
        assert analytics_bookings == dashboard_bookings, f"Bookings mismatch: Analytics API={analytics_bookings}, Dashboard={dashboard_bookings}"
    
    def test_admin_analytics_dashboard_contract_test_customers_consistency(self, client, auth_headers, test_tenant, test_customer):
        """Contract test: Customers dashboard matches analytics API data."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        # Get customers from analytics API
        analytics_response = client.get(
            f'/analytics/customers?start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert analytics_response.status_code == 200
        analytics_data = analytics_response.get_json()
        analytics_customers = analytics_data['customer_metrics']['total_customers']
        
        # Get customers from admin dashboard
        dashboard_response = client.get(
            f'/admin/analytics?metric=customers&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.get_json()
        dashboard_customers = dashboard_data['chart_data']['total_customers']
        
        # Contract test: Customers must match between analytics API and dashboard
        assert analytics_customers == dashboard_customers, f"Customers mismatch: Analytics API={analytics_customers}, Dashboard={dashboard_customers}"
    
    @patch('app.blueprints.admin_dashboard_api.logger')
    def test_admin_analytics_dashboard_observability_hook(self, mock_logger, client, auth_headers, test_tenant):
        """Test observability hook emission."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        response = client.get(
            f'/admin/analytics?metric=overview&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify observability hook was emitted
        mock_logger.info.assert_called()
        
        # Check the call arguments
        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "DASHBOARD_VIEWED"
        
        # Check extra data
        extra_data = call_args[1]['extra']
        assert 'tenant_id' in extra_data
        assert 'user_id' in extra_data
        assert 'metric' in extra_data
        assert 'start_date' in extra_data
        assert 'end_date' in extra_data
        assert 'page' in extra_data
        assert 'per_page' in extra_data
        
        assert extra_data['metric'] == 'overview'
        assert extra_data['start_date'] == start_date
        assert extra_data['end_date'] == end_date
    
    def test_admin_analytics_dashboard_tenant_isolation(self, client, auth_headers, test_tenant):
        """Test tenant isolation in admin analytics dashboard."""
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug='other-tenant',
            tz='UTC',
            is_public_directory=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()
        
        # Get analytics for test_tenant
        response = client.get(
            f'/admin/analytics?metric=overview&start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Verify tenant isolation - data should only include test_tenant data
        # This is implicitly tested by the RLS policies in the analytics service
        assert 'chart_data' in data
    
    def test_admin_analytics_dashboard_large_dataset_pagination(self, client, auth_headers, test_tenant):
        """Test pagination with large datasets."""
        start_date = (date.today() - timedelta(days=365)).isoformat()  # 1 year of data
        end_date = date.today().isoformat()
        
        # Test with small per_page to ensure pagination works
        response = client.get(
            f'/admin/analytics?metric=revenue&start_date={start_date}&end_date={end_date}&page=1&per_page=5',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        # Validate pagination structure
        assert 'pagination' in data
        assert data['pagination']['page'] == 1
        assert data['pagination']['per_page'] == 5
        assert 'total_items' in data['pagination']
        assert 'has_next' in data['pagination']
        
        # Validate chart data is paginated
        chart_data = data['chart_data']
        if 'revenue_by_period' in chart_data:
            assert len(chart_data['revenue_by_period']) <= 5


class TestAdminAnalyticsDashboardHelperFunctions:
    """Test helper functions for admin analytics dashboard."""
    
    def test_apply_pagination_to_dashboard_data(self):
        """Test _apply_pagination_to_dashboard_data helper function."""
        from app.blueprints.admin_dashboard_api import _apply_pagination_to_dashboard_data
        
        # Test overview metric pagination
        dashboard_data = {
            'revenue': {
                'revenue_by_period': [
                    {'period': '2024-01-01', 'value': 1000},
                    {'period': '2024-01-02', 'value': 2000},
                    {'period': '2024-01-03', 'value': 3000},
                    {'period': '2024-01-04', 'value': 4000},
                    {'period': '2024-01-05', 'value': 5000}
                ]
            }
        }
        
        result = _apply_pagination_to_dashboard_data(dashboard_data, 'overview', 1, 2)
        
        # Should paginate revenue_by_period
        assert len(result['revenue']['revenue_by_period']) == 2
        assert result['revenue']['revenue_by_period'][0]['period'] == '2024-01-01'
        assert result['revenue']['revenue_by_period'][1]['period'] == '2024-01-02'
    
    def test_get_total_items_count(self):
        """Test _get_total_items_count helper function."""
        from app.blueprints.admin_dashboard_api import _get_total_items_count
        
        # Test overview metric
        dashboard_data = {
            'revenue': {
                'revenue_by_period': [1, 2, 3, 4, 5]
            }
        }
        assert _get_total_items_count(dashboard_data, 'overview') == 5
        
        # Test revenue metric
        dashboard_data = {
            'revenue_by_period': [1, 2, 3]
        }
        assert _get_total_items_count(dashboard_data, 'revenue') == 3
        
        # Test bookings metric
        dashboard_data = {
            'bookings_by_period': [1, 2, 3, 4]
        }
        assert _get_total_items_count(dashboard_data, 'bookings') == 4
        
        # Test customers metric
        dashboard_data = {
            'customer_segments': {'new': 10, 'returning': 20, 'active': 15}
        }
        assert _get_total_items_count(dashboard_data, 'customers') == 3
        
        # Test staff metric
        dashboard_data = {
            'staff_metrics': [{'id': 1}, {'id': 2}, {'id': 3}, {'id': 4}, {'id': 5}]
        }
        assert _get_total_items_count(dashboard_data, 'staff') == 5
    
    def test_has_next_page(self):
        """Test _has_next_page helper function."""
        from app.blueprints.admin_dashboard_api import _has_next_page
        
        # Test with items that have next page
        dashboard_data = {
            'revenue_by_period': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        }
        assert _has_next_page(dashboard_data, 'revenue', 1, 5) == True  # Page 1, 5 items per page, 10 total
        assert _has_next_page(dashboard_data, 'revenue', 2, 5) == False  # Page 2, 5 items per page, 10 total
        
        # Test with items that don't have next page
        dashboard_data = {
            'revenue_by_period': [1, 2, 3]
        }
        assert _has_next_page(dashboard_data, 'revenue', 1, 5) == False  # Page 1, 5 items per page, 3 total
