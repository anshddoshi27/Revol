"""
Phase 2 API Endpoints Tests

Tests for staff management and availability API endpoints.
"""

import pytest
import uuid
import json
from datetime import datetime, date, timedelta

from app import create_app, db
from app.models import Tenant, User, Membership, Resource, Service, Customer, StaffProfile, WorkSchedule
from app.models.system import TithiError


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
        name="Test Salon",
        subdomain="test-salon",
        timezone="America/New_York",
        currency="USD",
        is_active=True
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user(app, test_tenant):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="admin@testsalon.com",
        password_hash="hashed_password",
        first_name="Admin",
        last_name="User",
        role="admin",
        is_active=True
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
        role="staff",
        is_active=True
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def test_resource(app, test_tenant):
    """Create test staff resource."""
    resource = Resource(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="John Doe - Stylist",
        type="staff",
        is_active=True
    )
    db.session.add(resource)
    db.session.commit()
    return resource


@pytest.fixture
def test_service(app, test_tenant):
    """Create test service."""
    service = Service(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Hair Cut",
        description="Professional hair cutting service",
        duration_minutes=60,
        price_cents=5000,
        is_active=True
    )
    db.session.add(service)
    db.session.commit()
    return service


@pytest.fixture
def test_customer(app, test_tenant):
    """Create test customer."""
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="customer@example.com",
        first_name="Jane",
        last_name="Doe",
        phone="+1234567890",
        is_active=True
    )
    db.session.add(customer)
    db.session.commit()
    return customer


@pytest.fixture
def test_staff_profile(app, test_tenant, test_membership, test_resource):
    """Create test staff profile."""
    staff_profile = StaffProfile(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        membership_id=test_membership.id,
        resource_id=test_resource.id,
        display_name="John Doe",
        bio="Experienced stylist",
        specialties=["hair_cutting", "coloring"],
        hourly_rate_cents=5000,
        is_active=True,
        max_concurrent_bookings=3
    )
    db.session.add(staff_profile)
    db.session.commit()
    return staff_profile


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers."""
    return {
        'Authorization': f'Bearer {test_user.id}',
        'Content-Type': 'application/json'
    }


class TestStaffManagementAPI:
    """Test staff management API endpoints."""

    def test_list_staff_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful staff listing."""
        response = client.get(
            f'/api/v1/tenants/{test_tenant.id}/staff',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'staff' in data
        assert 'total' in data
        assert len(data['staff']) == 1
        assert data['staff'][0]['display_name'] == 'John Doe'

    def test_list_staff_with_filters(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test staff listing with filters."""
        # Test active filter
        response = client.get(
            f'/api/v1/tenants/{test_tenant.id}/staff?is_active=true',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['staff']) == 1
        assert data['staff'][0]['is_active'] is True

    def test_create_staff_success(self, client, test_tenant, test_membership, test_resource, auth_headers):
        """Test successful staff creation."""
        staff_data = {
            'membership_id': str(test_membership.id),
            'resource_id': str(test_resource.id),
            'display_name': 'Jane Smith',
            'bio': 'Professional stylist',
            'specialties': ['hair_cutting', 'styling'],
            'hourly_rate_cents': 6000,
            'is_active': True,
            'max_concurrent_bookings': 2
        }
        
        response = client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff',
            data=json.dumps(staff_data),
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['display_name'] == 'Jane Smith'
        assert data['bio'] == 'Professional stylist'
        assert data['specialties'] == ['hair_cutting', 'styling']
        assert data['hourly_rate_cents'] == 6000

    def test_create_staff_validation_error(self, client, test_tenant, auth_headers):
        """Test staff creation with validation error."""
        staff_data = {
            'display_name': 'Jane Smith'
            # Missing required fields
        }
        
        response = client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff',
            data=json.dumps(staff_data),
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_get_staff_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful staff retrieval."""
        response = client.get(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['id'] == str(test_staff_profile.id)
        assert data['display_name'] == 'John Doe'

    def test_get_staff_not_found(self, client, test_tenant, auth_headers):
        """Test staff retrieval for non-existent staff."""
        response = client.get(
            f'/api/v1/tenants/{test_tenant.id}/staff/{uuid.uuid4()}',
            headers=auth_headers
        )
        
        assert response.status_code == 404

    def test_update_staff_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful staff update."""
        update_data = {
            'display_name': 'John Smith',
            'hourly_rate_cents': 7000,
            'specialties': ['hair_cutting', 'balayage']
        }
        
        response = client.put(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}',
            data=json.dumps(update_data),
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['display_name'] == 'John Smith'
        assert data['hourly_rate_cents'] == 7000
        assert data['specialties'] == ['hair_cutting', 'balayage']

    def test_delete_staff_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful staff deletion."""
        response = client.delete(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 204

    def test_delete_staff_not_found(self, client, test_tenant, auth_headers):
        """Test staff deletion for non-existent staff."""
        response = client.delete(
            f'/api/v1/tenants/{test_tenant.id}/staff/{uuid.uuid4()}',
            headers=auth_headers
        )
        
        assert response.status_code == 404


class TestWorkScheduleAPI:
    """Test work schedule API endpoints."""

    def test_create_work_schedule_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful work schedule creation."""
        schedule_data = {
            'schedule_type': 'regular',
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'work_hours': {
                'monday': {'start': '09:00', 'end': '17:00'},
                'tuesday': {'start': '09:00', 'end': '17:00'},
                'wednesday': {'start': '09:00', 'end': '17:00'},
                'thursday': {'start': '09:00', 'end': '17:00'},
                'friday': {'start': '09:00', 'end': '17:00'}
            },
            'rrule': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
        }
        
        response = client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}/schedules',
            data=json.dumps(schedule_data),
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['schedule_type'] == 'regular'
        assert data['start_date'] == '2024-01-01'
        assert data['end_date'] == '2024-12-31'

    def test_create_time_off_schedule(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test creating time off schedule."""
        schedule_data = {
            'schedule_type': 'time_off',
            'start_date': '2024-06-15',
            'end_date': '2024-06-20',
            'is_time_off': True,
            'reason': 'Vacation'
        }
        
        response = client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}/schedules',
            data=json.dumps(schedule_data),
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['schedule_type'] == 'time_off'
        assert data['is_time_off'] is True
        assert data['reason'] == 'Vacation'

    def test_list_work_schedules_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful work schedule listing."""
        # Create a work schedule first
        schedule_data = {
            'schedule_type': 'regular',
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'work_hours': {
                'monday': {'start': '09:00', 'end': '17:00'}
            }
        }
        
        client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}/schedules',
            data=json.dumps(schedule_data),
            headers=auth_headers
        )
        
        # List schedules
        response = client.get(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}/schedules',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'schedules' in data
        assert len(data['schedules']) == 1

    def test_get_staff_availability_success(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test successful staff availability retrieval."""
        # Create a work schedule first
        schedule_data = {
            'schedule_type': 'regular',
            'start_date': '2024-01-01',
            'end_date': '2024-12-31',
            'work_hours': {
                'monday': {'start': '09:00', 'end': '17:00'},
                'tuesday': {'start': '09:00', 'end': '17:00'},
                'wednesday': {'start': '09:00', 'end': '17:00'},
                'thursday': {'start': '09:00', 'end': '17:00'},
                'friday': {'start': '09:00', 'end': '17:00'}
            }
        }
        
        client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}/schedules',
            data=json.dumps(schedule_data),
            headers=auth_headers
        )
        
        # Get availability
        start_date = date.today().strftime('%Y-%m-%d')
        end_date = (date.today() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        response = client.get(
            f'/api/v1/tenants/{test_tenant.id}/staff/{test_staff_profile.id}/availability?start_date={start_date}&end_date={end_date}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'availability' in data
        assert 'schedule' in data


class TestAvailabilityAPI:
    """Test availability API endpoints."""

    def test_get_availability_success(self, client, test_tenant, test_resource, test_service, auth_headers):
        """Test successful availability retrieval."""
        response = client.get(
            f'/api/v1/availability/{test_resource.id}/slots?service_id={test_service.id}&date={date.today().strftime("%Y-%m-%d")}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'slots' in data

    def test_create_booking_hold_success(self, client, test_tenant, test_resource, test_service, test_customer, auth_headers):
        """Test successful booking hold creation."""
        hold_data = {
            'resource_id': str(test_resource.id),
            'service_id': str(test_service.id),
            'customer_id': str(test_customer.id),
            'start_at': (datetime.now() + timedelta(hours=1)).isoformat(),
            'end_at': (datetime.now() + timedelta(hours=2)).isoformat(),
            'ttl_minutes': 15
        }
        
        response = client.post(
            f'/api/v1/availability/hold',
            data=json.dumps(hold_data),
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'hold_key' in data
        assert 'expires_at' in data

    def test_release_booking_hold_success(self, client, test_tenant, test_resource, test_service, test_customer, auth_headers):
        """Test successful booking hold release."""
        # Create hold first
        hold_data = {
            'resource_id': str(test_resource.id),
            'service_id': str(test_service.id),
            'customer_id': str(test_customer.id),
            'start_at': (datetime.now() + timedelta(hours=1)).isoformat(),
            'end_at': (datetime.now() + timedelta(hours=2)).isoformat(),
            'ttl_minutes': 15
        }
        
        create_response = client.post(
            f'/api/v1/availability/hold',
            data=json.dumps(hold_data),
            headers=auth_headers
        )
        
        hold_key = create_response.get_json()['hold_key']
        
        # Release hold
        response = client.delete(
            f'/api/v1/availability/hold/{hold_key}',
            headers=auth_headers
        )
        
        assert response.status_code == 204

    def test_add_to_waitlist_success(self, client, test_tenant, test_resource, test_service, test_customer, auth_headers):
        """Test successful waitlist entry creation."""
        waitlist_data = {
            'resource_id': str(test_resource.id),
            'service_id': str(test_service.id),
            'customer_id': str(test_customer.id),
            'preferred_start_at': (datetime.now() + timedelta(days=1)).isoformat(),
            'preferred_end_at': (datetime.now() + timedelta(days=1, hours=1)).isoformat(),
            'priority': 1
        }
        
        response = client.post(
            f'/api/v1/availability/waitlist',
            data=json.dumps(waitlist_data),
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.get_json()
        assert 'waitlist_entry_id' in data
        assert data['status'] == 'waiting'

    def test_remove_from_waitlist_success(self, client, test_tenant, test_resource, test_service, test_customer, auth_headers):
        """Test successful waitlist entry removal."""
        # Add to waitlist first
        waitlist_data = {
            'resource_id': str(test_resource.id),
            'service_id': str(test_service.id),
            'customer_id': str(test_customer.id),
            'preferred_start_at': (datetime.now() + timedelta(days=1)).isoformat(),
            'preferred_end_at': (datetime.now() + timedelta(days=1, hours=1)).isoformat()
        }
        
        create_response = client.post(
            f'/api/v1/availability/waitlist',
            data=json.dumps(waitlist_data),
            headers=auth_headers
        )
        
        waitlist_entry_id = create_response.get_json()['waitlist_entry_id']
        
        # Remove from waitlist
        response = client.delete(
            f'/api/v1/availability/waitlist/{waitlist_entry_id}',
            headers=auth_headers
        )
        
        assert response.status_code == 204

    def test_list_waitlist_entries_success(self, client, test_tenant, test_resource, test_service, test_customer, auth_headers):
        """Test successful waitlist entry listing."""
        # Add to waitlist first
        waitlist_data = {
            'resource_id': str(test_resource.id),
            'service_id': str(test_service.id),
            'customer_id': str(test_customer.id),
            'preferred_start_at': (datetime.now() + timedelta(days=1)).isoformat(),
            'preferred_end_at': (datetime.now() + timedelta(days=1, hours=1)).isoformat()
        }
        
        client.post(
            f'/api/v1/availability/waitlist',
            data=json.dumps(waitlist_data),
            headers=auth_headers
        )
        
        # List waitlist entries
        response = client.get(
            f'/api/v1/availability/waitlist?resource_id={test_resource.id}',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'waitlist_entries' in data
        assert len(data['waitlist_entries']) == 1


class TestAPIErrorHandling:
    """Test API error handling."""

    def test_unauthorized_access(self, client, test_tenant):
        """Test unauthorized access to protected endpoints."""
        response = client.get(f'/api/v1/tenants/{test_tenant.id}/staff')
        assert response.status_code == 401

    def test_invalid_tenant_access(self, client, auth_headers):
        """Test access with invalid tenant ID."""
        response = client.get(
            f'/api/v1/tenants/{uuid.uuid4()}/staff',
            headers=auth_headers
        )
        assert response.status_code == 404

    def test_malformed_json(self, client, test_tenant, auth_headers):
        """Test handling of malformed JSON."""
        response = client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff',
            data='{"invalid": json}',
            headers=auth_headers
        )
        assert response.status_code == 400

    def test_missing_required_fields(self, client, test_tenant, auth_headers):
        """Test handling of missing required fields."""
        staff_data = {
            'display_name': 'John Doe'
            # Missing required fields
        }
        
        response = client.post(
            f'/api/v1/tenants/{test_tenant.id}/staff',
            data=json.dumps(staff_data),
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
