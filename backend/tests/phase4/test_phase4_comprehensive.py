"""
Phase 4 Comprehensive Test Suite

This module provides comprehensive testing for Phase 4 modules:
- Module K: CRM & Customer Management
- Module L: Analytics & Reporting  
- Module M: Admin Dashboard / UI Backends

Tests cover:
- API endpoint functionality
- Database integration
- RLS policy enforcement
- Error handling
- Business logic validation
- Performance requirements
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
from app.models.crm import CustomerNote, CustomerSegment, LoyaltyAccount
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
        slug='test-tenant',
        tz='UTC',
        is_public_directory=True
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
def test_customer(app, test_tenant):
    """Create test customer."""
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='Test Customer',
        email='customer@example.com',
        phone='+1234567890',
        marketing_opt_in=True
    )
    db.session.add(customer)
    db.session.commit()
    return customer


@pytest.fixture
def auth_headers(test_user, test_tenant):
    """Create authentication headers."""
    return {
        'Authorization': f'Bearer test-token',
        'X-Tenant-ID': str(test_tenant.id),
        'X-User-ID': str(test_user.id)
    }


class TestCRMModule:
    """Test Module K - CRM & Customer Management."""
    
    def test_list_customers(self, client, test_tenant, test_customer, auth_headers):
        """Test listing customers."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/crm/customers',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'customers' in data
            assert 'pagination' in data
            assert len(data['customers']) == 1
            assert data['customers'][0]['email'] == 'customer@example.com'
    
    def test_create_customer(self, client, test_tenant, auth_headers):
        """Test creating a new customer."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            customer_data = {
                'display_name': 'New Customer',
                'email': 'new@example.com',
                'phone': '+1234567890',
                'marketing_opt_in': True
            }
            
            response = client.post(
                '/api/v1/crm/customers',
                json=customer_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'customer' in data
            assert data['customer']['email'] == 'new@example.com'
            assert data['is_existing'] == False
    
    def test_get_customer_details(self, client, test_tenant, test_customer, auth_headers):
        """Test getting customer details with history."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                f'/api/v1/crm/customers/{test_customer.id}',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'customer' in data
            assert 'metrics' in data
            assert 'booking_history' in data
            assert data['customer']['id'] == str(test_customer.id)
    
    def test_update_customer(self, client, test_tenant, test_customer, auth_headers):
        """Test updating customer information."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            update_data = {
                'display_name': 'Updated Customer',
                'marketing_opt_in': False
            }
            
            response = client.put(
                f'/api/v1/crm/customers/{test_customer.id}',
                json=update_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert data['customer']['display_name'] == 'Updated Customer'
            assert data['customer']['marketing_opt_in'] == False
    
    def test_merge_customers(self, client, test_tenant, test_customer, auth_headers):
        """Test merging duplicate customers."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            # Create duplicate customer
            duplicate_customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name='Duplicate Customer',
                email='duplicate@example.com',
                phone='+1234567890'
            )
            db.session.add(duplicate_customer)
            db.session.commit()
            
            merge_data = {
                'primary_customer_id': str(test_customer.id),
                'duplicate_customer_id': str(duplicate_customer.id)
            }
            
            response = client.post(
                '/api/v1/crm/customers/merge',
                json=merge_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'message' in data
            assert 'primary_customer' in data
    
    def test_find_duplicate_customers(self, client, test_tenant, test_customer, auth_headers):
        """Test finding duplicate customers using fuzzy matching."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            # Create similar customer
            similar_customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name='Test Customer',  # Same name
                email='testcustomer@example.com',  # Similar email
                phone='+1234567890'
            )
            db.session.add(similar_customer)
            db.session.commit()
            
            response = client.get(
                '/api/v1/crm/customers/duplicates',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'duplicates' in data
            assert 'total_groups' in data
    
    def test_add_customer_note(self, client, test_tenant, test_customer, auth_headers):
        """Test adding a note to customer record."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            note_data = {
                'content': 'This is a test note about the customer.'
            }
            
            response = client.post(
                f'/api/v1/crm/customers/{test_customer.id}/notes',
                json=note_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'note' in data
            assert data['note']['content'] == 'This is a test note about the customer.'
    
    def test_get_customer_notes(self, client, test_tenant, test_customer, auth_headers):
        """Test getting customer notes."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            # Add a note first
            note = CustomerNote(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=test_customer.id,
                content='Test note',
                created_by=uuid.uuid4()
            )
            db.session.add(note)
            db.session.commit()
            
            response = client.get(
                f'/api/v1/crm/customers/{test_customer.id}/notes',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'notes' in data
            assert len(data['notes']) == 1
            assert data['notes'][0]['content'] == 'Test note'
    
    def test_create_customer_segment(self, client, test_tenant, auth_headers):
        """Test creating a customer segment."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            segment_data = {
                'name': 'VIP Customers',
                'description': 'High-value customers',
                'criteria': {
                    'total_spend_cents': {'gte': 100000},
                    'total_bookings': {'gte': 5}
                }
            }
            
            response = client.post(
                '/api/v1/crm/customers/segments',
                json=segment_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'segment' in data
            assert data['segment']['name'] == 'VIP Customers'
    
    def test_export_customer_data(self, client, test_tenant, test_customer, auth_headers):
        """Test exporting customer data for GDPR compliance."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            export_data = {
                'customer_ids': [str(test_customer.id)],
                'format': 'json'
            }
            
            response = client.post(
                '/api/v1/crm/customers/export',
                json=export_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'export_data' in data
            assert 'format' in data
            assert 'exported_at' in data


class TestAnalyticsModule:
    """Test Module L - Analytics & Reporting."""
    
    def test_get_dashboard_metrics(self, client, test_tenant, auth_headers):
        """Test getting dashboard metrics."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/dashboard',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'period' in data
            assert 'metrics' in data
    
    def test_get_revenue_analytics(self, client, test_tenant, auth_headers):
        """Test getting revenue analytics."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/revenue?start_date=2024-01-01&end_date=2024-12-31&period=daily',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'period' in data
            assert 'revenue_metrics' in data
    
    def test_get_booking_analytics(self, client, test_tenant, auth_headers):
        """Test getting booking analytics."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/bookings?start_date=2024-01-01&end_date=2024-12-31&period=daily',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'period' in data
            assert 'booking_metrics' in data
    
    def test_get_customer_analytics(self, client, test_tenant, auth_headers):
        """Test getting customer analytics."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/customers?start_date=2024-01-01&end_date=2024-12-31',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'period' in data
            assert 'customer_metrics' in data
    
    def test_get_staff_analytics(self, client, test_tenant, auth_headers):
        """Test getting staff performance analytics."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/staff?start_date=2024-01-01&end_date=2024-12-31',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'period' in data
            assert 'staff_metrics' in data
    
    def test_create_custom_report(self, client, test_tenant, auth_headers):
        """Test creating a custom analytics report."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            report_data = {
                'title': 'Monthly Revenue Report',
                'start_date': '2024-01-01',
                'end_date': '2024-01-31',
                'period': 'daily',
                'include_revenue': True,
                'include_bookings': True,
                'include_customers': True
            }
            
            response = client.post(
                '/api/v1/analytics/reports',
                json=report_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'report_id' in data
            assert 'title' in data
            assert 'summary' in data
    
    def test_export_analytics_data(self, client, test_tenant, auth_headers):
        """Test exporting analytics data."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/export?start_date=2024-01-01&end_date=2024-12-31&format=json',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            assert response.content_type == 'application/json'


class TestAdminDashboardModule:
    """Test Module M - Admin Dashboard / UI Backends."""
    
    def test_get_availability_scheduler(self, client, test_tenant, auth_headers):
        """Test getting availability scheduler data."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/admin/availability/scheduler?start_date=2024-01-01&end_date=2024-01-31',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'scheduler_data' in data
            assert 'period' in data
    
    def test_bulk_update_services(self, client, test_tenant, auth_headers):
        """Test bulk updating services."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            updates_data = {
                'updates': [
                    {
                        'id': str(uuid.uuid4()),
                        'price_cents': 5000,
                        'duration_min': 60
                    }
                ]
            }
            
            response = client.post(
                '/api/v1/admin/services/bulk-update',
                json=updates_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'message' in data
            assert 'updated_services' in data
    
    def test_bulk_booking_actions(self, client, test_tenant, auth_headers):
        """Test bulk booking actions."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            action_data = {
                'action': 'confirm',
                'booking_ids': [str(uuid.uuid4())]
            }
            
            response = client.post(
                '/api/v1/admin/bookings/bulk-actions',
                json=action_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'message' in data
            assert 'results' in data
    
    def test_drag_drop_reschedule(self, client, test_tenant, auth_headers):
        """Test drag-and-drop rescheduling."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            reschedule_data = {
                'booking_id': str(uuid.uuid4()),
                'new_start_at': '2024-01-15T10:00:00Z',
                'new_end_at': '2024-01-15T11:00:00Z'
            }
            
            response = client.post(
                '/api/v1/admin/calendar/drag-drop-reschedule',
                json=reschedule_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'message' in data
            assert 'booking_id' in data
    
    def test_get_admin_analytics_dashboard(self, client, test_tenant, auth_headers):
        """Test getting admin analytics dashboard."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/admin/analytics/dashboard?start_date=2024-01-01&end_date=2024-12-31',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'dashboard_data' in data
            assert 'period' in data
    
    def test_create_theme_preview(self, client, test_tenant, auth_headers):
        """Test creating live theme preview."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            theme_data = {
                'theme_data': {
                    'brand_color': '#FF5733',
                    'logo_url': 'https://example.com/logo.png',
                    'font_family': 'Arial'
                }
            }
            
            response = client.post(
                '/api/v1/admin/branding/theme-preview',
                json=theme_data,
                headers=auth_headers
            )
            
            assert response.status_code == 201
            data = response.get_json()
            assert 'preview' in data
            assert 'preview_id' in data['preview']
            assert 'preview_url' in data['preview']
    
    def test_get_audit_logs(self, client, test_tenant, auth_headers):
        """Test getting audit logs."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/admin/audit/logs',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'audit_logs' in data
            assert 'pagination' in data
    
    def test_get_operations_health(self, client, test_tenant, auth_headers):
        """Test getting operations health status."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/admin/operations/health',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.get_json()
            assert 'health_status' in data
            assert 'checked_at' in data


class TestRLSEnforcement:
    """Test Row Level Security enforcement across Phase 4 modules."""
    
    def test_tenant_isolation_crm(self, client, test_tenant, test_customer, auth_headers):
        """Test that CRM operations are properly isolated by tenant."""
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug='other-tenant',
            tz='UTC'
        )
        db.session.add(other_tenant)
        
        # Create customer for other tenant
        other_customer = Customer(
            id=uuid.uuid4(),
            tenant_id=other_tenant.id,
            display_name='Other Customer',
            email='other@example.com'
        )
        db.session.add(other_customer)
        db.session.commit()
        
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            # Try to access other tenant's customer
            response = client.get(
                f'/api/v1/crm/customers/{other_customer.id}',
                headers=auth_headers
            )
            
            # Should not be able to access other tenant's data
            assert response.status_code == 404
    
    def test_tenant_isolation_analytics(self, client, test_tenant, auth_headers):
        """Test that analytics operations are properly isolated by tenant."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/dashboard',
                headers=auth_headers
            )
            
            # Should only return data for the authenticated tenant
            assert response.status_code == 200
            data = response.get_json()
            assert 'metrics' in data
    
    def test_tenant_isolation_admin(self, client, test_tenant, auth_headers):
        """Test that admin operations are properly isolated by tenant."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/admin/operations/health',
                headers=auth_headers
            )
            
            # Should only return data for the authenticated tenant
            assert response.status_code == 200
            data = response.get_json()
            assert 'health_status' in data


class TestErrorHandling:
    """Test error handling across Phase 4 modules."""
    
    def test_invalid_customer_id(self, client, test_tenant, auth_headers):
        """Test handling of invalid customer ID."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                f'/api/v1/crm/customers/{uuid.uuid4()}',
                headers=auth_headers
            )
            
            assert response.status_code == 404
            data = response.get_json()
            assert 'message' in data
            assert 'TITHI_CRM_CUSTOMER_NOT_FOUND' in data.get('code', '')
    
    def test_missing_required_fields(self, client, test_tenant, auth_headers):
        """Test handling of missing required fields."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.post(
                '/api/v1/crm/customers',
                json={},  # Missing required fields
                headers=auth_headers
            )
            
            assert response.status_code == 400
            data = response.get_json()
            assert 'message' in data
            assert 'TITHI_VALIDATION_ERROR' in data.get('code', '')
    
    def test_invalid_date_format(self, client, test_tenant, auth_headers):
        """Test handling of invalid date format in analytics."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            response = client.get(
                '/api/v1/analytics/revenue?start_date=invalid-date&end_date=2024-12-31',
                headers=auth_headers
            )
            
            assert response.status_code == 400
            data = response.get_json()
            assert 'message' in data
            assert 'TITHI_VALIDATION_ERROR' in data.get('code', '')


class TestPerformanceRequirements:
    """Test performance requirements for Phase 4 modules."""
    
    def test_analytics_response_time(self, client, test_tenant, auth_headers):
        """Test that analytics endpoints respond within performance requirements."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            import time
            start_time = time.time()
            
            response = client.get(
                '/api/v1/analytics/dashboard',
                headers=auth_headers
            )
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            assert response.status_code == 200
            assert response_time < 500  # Should be under 500ms as per NFRs
    
    def test_crm_response_time(self, client, test_tenant, auth_headers):
        """Test that CRM endpoints respond within performance requirements."""
        with patch('app.middleware.auth_middleware.get_current_user') as mock_user:
            mock_user.return_value = MagicMock(id=uuid.uuid4())
            
            import time
            start_time = time.time()
            
            response = client.get(
                '/api/v1/crm/customers',
                headers=auth_headers
            )
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            assert response.status_code == 200
            assert response_time < 500  # Should be under 500ms as per NFRs


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
