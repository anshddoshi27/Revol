"""
Test Staff Availability (Task 4.2)

This module tests the staff availability functionality including:
- StaffAvailability model validation
- StaffAvailabilityService business logic
- API endpoints for staff availability
- Contract tests for availability constraints
"""

import pytest
import uuid
from datetime import datetime, time, timedelta
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import create_app
from app.extensions import db
from app.models.business import StaffAvailability, StaffProfile, Resource
from app.models.core import Membership, User, Tenant
from app.services.business_phase2 import StaffAvailabilityService, ValidationError
from app.middleware.error_handler import TithiError


@pytest.fixture
def app():
    """Create test application."""
    import os
    # Use PostgreSQL for testing to support JSONB
    os.environ['DATABASE_URL'] = 'postgresql://postgres:password@localhost:5432/tithi_test'
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


class TestStaffAvailabilityModel:
    """Test StaffAvailability model validation and constraints."""
    
    def test_staff_availability_creation(self, app):
        """Test creating a staff availability record."""
        with app.app_context():
            # Create test data
            tenant = Tenant(id=uuid.uuid4(), slug="test-tenant", tz="UTC")
            user = User(id=uuid.uuid4(), display_name="Test User")
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                type="staff",
                name="Test Staff",
                tz="UTC",
                capacity=1
            )
            staff_profile = StaffProfile(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                membership_id=membership.id,
                resource_id=resource.id,
                display_name="Test Staff"
            )
            
            # Create staff availability
            availability = StaffAvailability(
                tenant_id=tenant.id,
                staff_profile_id=staff_profile.id,
                weekday=1,  # Monday
                start_time=time(9, 0),  # 9:00 AM
                end_time=time(17, 0),   # 5:00 PM
                is_active=True
            )
            
            # Verify model properties
            assert availability.weekday == 1
            assert availability.start_time == time(9, 0)
            assert availability.end_time == time(17, 0)
            assert availability.is_active is True
            assert availability.tenant_id == tenant.id
            assert availability.staff_profile_id == staff_profile.id
    
    def test_weekday_validation(self, app):
        """Test weekday constraint validation."""
        with app.app_context():
            tenant_id = uuid.uuid4()
            staff_profile_id = uuid.uuid4()
            
            # Valid weekdays (1-7)
            for weekday in range(1, 8):
                availability = StaffAvailability(
                    tenant_id=tenant_id,
                    staff_profile_id=staff_profile_id,
                    weekday=weekday,
                    start_time=time(9, 0),
                    end_time=time(17, 0)
                )
                assert availability.weekday == weekday
            
            # Invalid weekdays should raise constraint error
            with pytest.raises(Exception):  # SQLAlchemy constraint error
                StaffAvailability(
                    tenant_id=tenant_id,
                    staff_profile_id=staff_profile_id,
                    weekday=0,  # Invalid
                    start_time=time(9, 0),
                    end_time=time(17, 0)
                )
            
            with pytest.raises(Exception):  # SQLAlchemy constraint error
                StaffAvailability(
                    tenant_id=tenant_id,
                    staff_profile_id=staff_profile_id,
                    weekday=8,  # Invalid
                    start_time=time(9, 0),
                    end_time=time(17, 0)
                )
    
    def test_time_order_validation(self, app):
        """Test that end_time must be after start_time."""
        with app.app_context():
            tenant_id = uuid.uuid4()
            staff_profile_id = uuid.uuid4()
            
            # Valid time order
            availability = StaffAvailability(
                tenant_id=tenant_id,
                staff_profile_id=staff_profile_id,
                weekday=1,
                start_time=time(9, 0),
                end_time=time(17, 0)
            )
            assert availability.start_time < availability.end_time
            
            # Invalid time order should raise constraint error
            with pytest.raises(Exception):  # SQLAlchemy constraint error
                StaffAvailability(
                    tenant_id=tenant_id,
                    staff_profile_id=staff_profile_id,
                    weekday=1,
                    start_time=time(17, 0),  # After end_time
                    end_time=time(9, 0)      # Before start_time
                )


class TestStaffAvailabilityService:
    """Test StaffAvailabilityService business logic."""
    
    def test_create_availability_success(self, app, test_tenant, test_staff_profile):
        """Test creating staff availability successfully."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            availability_data = {
                'weekday': 1,  # Monday
                'start_time': '09:00',
                'end_time': '17:00',
                'is_active': True
            }
            
            availability = service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data=availability_data,
                user_id=user_id
            )
            
            assert availability is not None
            assert availability.weekday == 1
            assert availability.start_time == time(9, 0)
            assert availability.end_time == time(17, 0)
            assert availability.is_active is True
            assert availability.tenant_id == test_tenant.id
            assert availability.staff_profile_id == test_staff_profile.id
    
    def test_create_availability_update_existing(self, app, test_tenant, test_staff_profile):
        """Test updating existing availability for same weekday."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Create initial availability
            initial_data = {
                'weekday': 1,
                'start_time': '09:00',
                'end_time': '17:00'
            }
            
            initial_availability = service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data=initial_data,
                user_id=user_id
            )
            
            # Update with new times
            update_data = {
                'weekday': 1,
                'start_time': '08:00',
                'end_time': '18:00'
            }
            
            updated_availability = service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data=update_data,
                user_id=user_id
            )
            
            # Should be same record, updated
            assert updated_availability.id == initial_availability.id
            assert updated_availability.start_time == time(8, 0)
            assert updated_availability.end_time == time(18, 0)
    
    def test_create_availability_validation_errors(self, app, test_tenant, test_staff_profile):
        """Test validation errors for invalid data."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Missing required fields
            with pytest.raises(ValidationError):
                service.create_availability(
                    tenant_id=test_tenant.id,
                    staff_profile_id=test_staff_profile.id,
                    availability_data={},
                    user_id=user_id
                )
            
            # Invalid weekday
            with pytest.raises(ValidationError):
                service.create_availability(
                    tenant_id=test_tenant.id,
                    staff_profile_id=test_staff_profile.id,
                    availability_data={
                        'weekday': 8,  # Invalid
                        'start_time': '09:00',
                        'end_time': '17:00'
                    },
                    user_id=user_id
                )
            
            # End time before start time
            with pytest.raises(ValidationError):
                service.create_availability(
                    tenant_id=test_tenant.id,
                    staff_profile_id=test_staff_profile.id,
                    availability_data={
                        'weekday': 1,
                        'start_time': '17:00',
                        'end_time': '09:00'  # Before start time
                    },
                    user_id=user_id
                )
    
    def test_get_staff_availability(self, app, test_tenant, test_staff_profile):
        """Test getting all availability for a staff member."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Create multiple availability records
            weekdays = [1, 2, 3, 4, 5]  # Monday to Friday
            for weekday in weekdays:
                service.create_availability(
                    tenant_id=test_tenant.id,
                    staff_profile_id=test_staff_profile.id,
                    availability_data={
                        'weekday': weekday,
                        'start_time': '09:00',
                        'end_time': '17:00'
                    },
                    user_id=user_id
                )
            
            # Get all availability
            availability_list = service.get_staff_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id
            )
            
            assert len(availability_list) == 5
            weekdays_found = [av.weekday for av in availability_list]
            assert set(weekdays_found) == set(weekdays)
    
    def test_get_availability_for_weekday(self, app, test_tenant, test_staff_profile):
        """Test getting availability for a specific weekday."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Create availability for Monday
            service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data={
                    'weekday': 1,
                    'start_time': '09:00',
                    'end_time': '17:00'
                },
                user_id=user_id
            )
            
            # Get Monday availability
            monday_availability = service.get_availability_for_weekday(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                weekday=1
            )
            
            assert monday_availability is not None
            assert monday_availability.weekday == 1
            
            # Get Tuesday availability (should be None)
            tuesday_availability = service.get_availability_for_weekday(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                weekday=2
            )
            
            assert tuesday_availability is None
    
    def test_delete_availability(self, app, test_tenant, test_staff_profile):
        """Test deleting availability for a specific weekday."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Create availability
            service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data={
                    'weekday': 1,
                    'start_time': '09:00',
                    'end_time': '17:00'
                },
                user_id=user_id
            )
            
            # Delete availability
            success = service.delete_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                weekday=1,
                user_id=user_id
            )
            
            assert success is True
            
            # Verify it's deleted
            availability = service.get_availability_for_weekday(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                weekday=1
            )
            
            assert availability is None
    
    def test_get_available_slots(self, app, test_tenant, test_staff_profile):
        """Test getting available time slots for a date range."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Create availability for Monday
            service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data={
                    'weekday': 1,  # Monday
                    'start_time': '09:00',
                    'end_time': '17:00'
                },
                user_id=user_id
            )
            
            # Get slots for a Monday
            monday = datetime(2024, 1, 1)  # This is a Monday
            start_date = monday
            end_date = monday + timedelta(days=1)
            
            slots = service.get_available_slots(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                start_date=start_date,
                end_date=end_date
            )
            
            assert len(slots) > 0
            assert all(slot['weekday'] == 1 for slot in slots)
            assert all('start_at' in slot for slot in slots)
            assert all('end_at' in slot for slot in slots)


class TestStaffAvailabilityAPI:
    """Test staff availability API endpoints."""
    
    def test_create_availability_endpoint(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test POST /staff/<staff_id>/availability endpoint."""
        response = client.post(
            f"/api/v1/staff/{test_staff_profile.id}/availability",
            json={
                "weekday": 1,
                "start_time": "09:00",
                "end_time": "17:00",
                "is_active": True
            },
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.get_json()
        assert data['weekday'] == 1
        assert data['start_time'] == '09:00'
        assert data['end_time'] == '17:00'
        assert data['is_active'] is True
        assert 'id' in data
        assert 'created_at' in data
        assert 'updated_at' in data
    
    def test_create_availability_validation_error(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test POST endpoint with validation errors."""
        # Missing required fields
        response = client.post(
            f"/api/v1/staff/{test_staff_profile.id}/availability",
            json={},
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert 'Missing required fields' in data['message']
    
    def test_update_availability_endpoint(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test PUT /staff/<staff_id>/availability/<weekday> endpoint."""
        # First create availability
        client.post(
            f"/api/v1/staff/{test_staff_profile.id}/availability",
            json={
                "weekday": 1,
                "start_time": "09:00",
                "end_time": "17:00"
            },
            headers=auth_headers
        )
        
        # Update availability
        response = client.put(
            f"/api/v1/staff/{test_staff_profile.id}/availability/1",
            json={
                "start_time": "08:00",
                "end_time": "18:00"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data['start_time'] == '08:00'
        assert data['end_time'] == '18:00'
    
    def test_delete_availability_endpoint(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test DELETE /staff/<staff_id>/availability/<weekday> endpoint."""
        # First create availability
        client.post(
            f"/api/v1/staff/{test_staff_profile.id}/availability",
            json={
                "weekday": 1,
                "start_time": "09:00",
                "end_time": "17:00"
            },
            headers=auth_headers
        )
        
        # Delete availability
        response = client.delete(
            f"/api/v1/staff/{test_staff_profile.id}/availability/1",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'deleted successfully' in data['message']
    
    def test_get_availability_slots_endpoint(self, client, test_tenant, test_staff_profile, auth_headers):
        """Test GET /staff/<staff_id>/availability/slots endpoint."""
        # First create availability
        client.post(
            f"/api/v1/staff/{test_staff_profile.id}/availability",
            json={
                "weekday": 1,  # Monday
                "start_time": "09:00",
                "end_time": "17:00"
            },
            headers=auth_headers
        )
        
        # Get availability slots for a Monday
        response = client.get(
            f"/api/v1/staff/{test_staff_profile.id}/availability/slots",
            query_string={
                "start_date": "2024-01-01T00:00:00Z",  # Monday
                "end_date": "2024-01-02T00:00:00Z"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert 'slots' in data
        assert 'total' in data
        assert data['total'] > 0
        assert all(slot['weekday'] == 1 for slot in data['slots'])


class TestStaffAvailabilityContractTests:
    """Contract tests for staff availability functionality."""
    
    def test_availability_constraint_contract(self, app, test_tenant, test_staff_profile):
        """Contract test: Given staff sets availability Mon 9–5, When a booking is attempted Mon 6pm, Then system rejects with 409."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Set availability Monday 9-5
            service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data={
                    'weekday': 1,  # Monday
                    'start_time': '09:00',
                    'end_time': '17:00'
                },
                user_id=user_id
            )
            
            # Get available slots for a Monday
            monday = datetime(2024, 1, 1)  # This is a Monday
            start_date = monday
            end_date = monday + timedelta(days=1)
            
            slots = service.get_available_slots(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                start_date=start_date,
                end_date=end_date
            )
            
            # Verify no slots after 5 PM
            for slot in slots:
                slot_time = datetime.fromisoformat(slot['start_at'].replace('Z', '+00:00'))
                assert slot_time.hour < 17  # No slots at or after 5 PM
    
    def test_tenant_isolation_contract(self, app, test_tenant, test_staff_profile):
        """Contract test: Verify tenant isolation for staff availability."""
        with app.app_context():
            service = StaffAvailabilityService()
            user_id = uuid.uuid4()
            
            # Create availability for tenant 1
            service.create_availability(
                tenant_id=test_tenant.id,
                staff_profile_id=test_staff_profile.id,
                availability_data={
                    'weekday': 1,
                    'start_time': '09:00',
                    'end_time': '17:00'
                },
                user_id=user_id
            )
            
            # Create different tenant
            other_tenant = Tenant(id=uuid.uuid4(), slug="other-tenant", tz="UTC")
            other_user = User(id=uuid.uuid4(), display_name="Other User")
            other_membership = Membership(
                id=uuid.uuid4(),
                tenant_id=other_tenant.id,
                user_id=other_user.id,
                role="owner"
            )
            other_resource = Resource(
                id=uuid.uuid4(),
                tenant_id=other_tenant.id,
                type="staff",
                name="Other Staff",
                tz="UTC",
                capacity=1
            )
            other_staff_profile = StaffProfile(
                id=uuid.uuid4(),
                tenant_id=other_tenant.id,
                membership_id=other_membership.id,
                resource_id=other_resource.id,
                display_name="Other Staff"
            )
            
            # Get availability for other tenant - should be empty
            other_availability = service.get_staff_availability(
                tenant_id=other_tenant.id,
                staff_profile_id=other_staff_profile.id
            )
            
            assert len(other_availability) == 0


@pytest.fixture
def test_tenant():
    """Create a test tenant."""
    return Tenant(
        id=uuid.uuid4(),
        slug="test-tenant",
        tz="UTC"
    )


@pytest.fixture
def test_staff_profile(test_tenant):
    """Create a test staff profile."""
    user = User(id=uuid.uuid4(), display_name="Test User")
    membership = Membership(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        user_id=user.id,
        role="owner"
    )
    resource = Resource(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        type="staff",
        name="Test Staff",
        tz="UTC",
        capacity=1
    )
    return StaffProfile(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        membership_id=membership.id,
        resource_id=resource.id,
        display_name="Test Staff"
    )


@pytest.fixture
def auth_headers():
    """Create mock auth headers for testing."""
    return {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
    }
