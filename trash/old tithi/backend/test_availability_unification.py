#!/usr/bin/env python3
"""
Test script for availability unification and enforcement.

This script tests the unified availability system to ensure:
1. Single source of truth (StaffAvailability)
2. Proper slot generation with service duration + buffers
3. Hard availability enforcement in booking creation
4. Booking enabled status based on staff availability
"""

import sys
import os
import uuid
from datetime import datetime, date, time, timedelta
from decimal import Decimal

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User
from app.models.business import StaffProfile, StaffAvailability, Service, Booking, Resource
from app.services.availability_unified import UnifiedAvailabilityService
from app.services.business_phase2 import BookingService


def setup_test_data():
    """Set up test data for availability testing."""
    app = create_app()
    
    with app.app_context():
        # Create test tenant
        tenant = Tenant(
            id=uuid.uuid4(),
            name="Test Availability Tenant",
            domain="test-availability.com",
            settings_json={"timezone": "UTC"}
        )
        db.session.add(tenant)
        
        # Create test user
        user = User(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            email="admin@test-availability.com",
            password_hash="test_hash",
            role="admin"
        )
        db.session.add(user)
        
        # Create test resource
        resource = Resource(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Test Staff Resource",
            resource_type="staff",
            tz="UTC"
        )
        db.session.add(resource)
        
        # Create test staff profile
        staff = StaffProfile(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            resource_id=resource.id,
            name="Test Staff Member",
            email="staff@test.com",
            is_active=True
        )
        db.session.add(staff)
        
        # Create test service
        service = Service(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Test Service",
            description="Test service for availability",
            duration_min=60,  # 1 hour
            price_cents=5000,  # $50.00
            category="test",
            active=True
        )
        db.session.add(service)
        
        # Create staff availability (Monday-Friday, 9 AM - 5 PM)
        for weekday in range(1, 6):  # Monday to Friday
            availability = StaffAvailability(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                staff_profile_id=staff.id,
                weekday=weekday,
                start_time=time(9, 0),  # 9:00 AM
                end_time=time(17, 0),   # 5:00 PM
                is_active=True
            )
            db.session.add(availability)
        
        db.session.commit()
        
        return tenant, user, staff, service, resource


def test_unified_availability_service():
    """Test the unified availability service."""
    print("Testing Unified Availability Service...")
    
    app = create_app()
    
    with app.app_context():
        tenant, user, staff, service, resource = setup_test_data()
        
        # Test service
        unified_service = UnifiedAvailabilityService()
        
        # Test slot generation
        start_date = datetime(2024, 1, 15, 0, 0)  # Monday
        end_date = datetime(2024, 1, 19, 23, 59)  # Friday
        
        slots = unified_service.get_available_slots(
            tenant.id, service.id, staff.id, start_date, end_date
        )
        
        print(f"Generated {len(slots)} slots")
        
        # Verify slots are within availability window
        for slot in slots[:5]:  # Check first 5 slots
            slot_start = datetime.fromisoformat(slot['start_at'])
            slot_end = datetime.fromisoformat(slot['end_at'])
            
            # Should be between 9 AM and 5 PM
            assert 9 <= slot_start.hour < 17, f"Slot {slot_start} outside availability window"
            assert slot['duration_minutes'] == 60, f"Wrong duration: {slot['duration_minutes']}"
            assert slot['staff_id'] == str(staff.id), f"Wrong staff ID: {slot['staff_id']}"
        
        print("✅ Slot generation working correctly")
        
        # Test booking enabled status
        status = unified_service.get_booking_enabled_status(tenant.id)
        assert status['booking_enabled'] == True, "Booking should be enabled"
        assert status['services_with_availability'] > 0, "Should have services with availability"
        assert status['staff_with_availability'] > 0, "Should have staff with availability"
        
        print("✅ Booking enabled status working correctly")
        
        # Test availability validation
        valid_start = datetime(2024, 1, 15, 10, 0)  # Monday 10 AM
        valid_end = datetime(2024, 1, 15, 11, 0)   # Monday 11 AM
        
        is_valid = unified_service.validate_booking_availability(
            tenant.id, service.id, staff.id, valid_start, valid_end
        )
        assert is_valid == True, "Valid booking should pass validation"
        
        # Test invalid booking (outside availability)
        invalid_start = datetime(2024, 1, 15, 6, 0)  # Monday 6 AM (before availability)
        invalid_end = datetime(2024, 1, 15, 7, 0)    # Monday 7 AM
        
        is_invalid = unified_service.validate_booking_availability(
            tenant.id, service.id, staff.id, invalid_start, invalid_end
        )
        assert is_invalid == False, "Invalid booking should fail validation"
        
        print("✅ Availability validation working correctly")


def test_booking_creation_with_availability():
    """Test booking creation with availability enforcement."""
    print("Testing Booking Creation with Availability Enforcement...")
    
    app = create_app()
    
    with app.app_context():
        tenant, user, staff, service, resource = setup_test_data()
        
        # Test service
        booking_service = BookingService()
        
        # Test valid booking
        valid_booking_data = {
            'customer_id': str(uuid.uuid4()),  # Mock customer
            'service_id': str(service.id),
            'resource_id': str(resource.id),
            'start_at': '2024-01-15T10:00:00Z',  # Monday 10 AM
            'end_at': '2024-01-15T11:00:00Z',   # Monday 11 AM
            'booking_tz': 'UTC'
        }
        
        try:
            booking = booking_service.create_booking(tenant.id, valid_booking_data, user.id)
            assert booking is not None, "Valid booking should be created"
            assert booking.status == 'pending', f"Booking status should be pending, got {booking.status}"
            print("✅ Valid booking creation working")
        except Exception as e:
            print(f"❌ Valid booking failed: {e}")
            raise
        
        # Test invalid booking (outside availability)
        invalid_booking_data = {
            'customer_id': str(uuid.uuid4()),
            'service_id': str(service.id),
            'resource_id': str(resource.id),
            'start_at': '2024-01-15T06:00:00Z',  # Monday 6 AM (before availability)
            'end_at': '2024-01-15T07:00:00Z',    # Monday 7 AM
            'booking_tz': 'UTC'
        }
        
        try:
            booking = booking_service.create_booking(tenant.id, invalid_booking_data, user.id)
            print("❌ Invalid booking should have been rejected")
            assert False, "Invalid booking should have been rejected"
        except ValueError as e:
            assert "not available" in str(e).lower(), f"Expected availability error, got: {e}"
            print("✅ Invalid booking correctly rejected")
        except Exception as e:
            print(f"❌ Unexpected error for invalid booking: {e}")
            raise
        
        # Test double booking prevention
        duplicate_booking_data = {
            'customer_id': str(uuid.uuid4()),
            'service_id': str(service.id),
            'resource_id': str(resource.id),
            'start_at': '2024-01-15T10:30:00Z',  # Overlaps with first booking
            'end_at': '2024-01-15T11:30:00Z',
            'booking_tz': 'UTC'
        }
        
        try:
            booking = booking_service.create_booking(tenant.id, duplicate_booking_data, user.id)
            print("❌ Overlapping booking should have been rejected")
            assert False, "Overlapping booking should have been rejected"
        except ValueError as e:
            assert "conflicts" in str(e).lower() or "not available" in str(e).lower(), f"Expected conflict error, got: {e}"
            print("✅ Overlapping booking correctly rejected")


def test_no_availability_scenario():
    """Test scenario where no staff availability is configured."""
    print("Testing No Availability Scenario...")
    
    app = create_app()
    
    with app.app_context():
        # Create tenant without staff availability
        tenant = Tenant(
            id=uuid.uuid4(),
            name="No Availability Tenant",
            domain="no-availability.com",
            settings_json={"timezone": "UTC"}
        )
        db.session.add(tenant)
        
        # Create service
        service = Service(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Test Service",
            description="Test service without availability",
            duration_min=60,
            price_cents=5000,
            category="test",
            active=True
        )
        db.session.add(service)
        
        db.session.commit()
        
        # Test unified service
        unified_service = UnifiedAvailabilityService()
        
        # Test booking enabled status
        status = unified_service.get_booking_enabled_status(tenant.id)
        assert status['booking_enabled'] == False, "Booking should be disabled without staff availability"
        assert status['services_with_availability'] == 0, "Should have no services with availability"
        assert status['staff_with_availability'] == 0, "Should have no staff with availability"
        
        print("✅ No availability scenario working correctly")


def main():
    """Run all availability tests."""
    print("🧪 Starting Availability Unification Tests")
    print("=" * 50)
    
    try:
        test_unified_availability_service()
        print()
        
        test_booking_creation_with_availability()
        print()
        
        test_no_availability_scenario()
        print()
        
        print("🎉 All availability tests passed!")
        print("✅ Availability unification is working correctly")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
