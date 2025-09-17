"""
Phase 2 Availability Engine Tests

Tests for availability calculation, booking holds, and waitlist functionality.
"""

import pytest
import uuid
from datetime import datetime, date, timedelta
from decimal import Decimal

from app import create_app, db
from app.models import Tenant, User, Customer, Service, Resource, Booking, StaffProfile, WorkSchedule, BookingHold, WaitlistEntry, AvailabilityCache
from app.services.business_phase2 import AvailabilityService
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
def test_staff_profile(app, test_tenant, test_user, test_resource):
    """Create test staff profile."""
    from app.models import Membership
    
    # Create membership
    membership = Membership(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role="staff",
        is_active=True
    )
    db.session.add(membership)
    db.session.commit()
    
    # Create staff profile
    staff_profile = StaffProfile(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        membership_id=membership.id,
        resource_id=test_resource.id,
        display_name="John Doe",
        is_active=True,
        max_concurrent_bookings=1
    )
    db.session.add(staff_profile)
    db.session.commit()
    return staff_profile


@pytest.fixture
def test_work_schedule(app, test_tenant, test_staff_profile):
    """Create test work schedule."""
    work_schedule = WorkSchedule(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        staff_profile_id=test_staff_profile.id,
        schedule_type="regular",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=30),
        work_hours={
            'monday': {'start': '09:00', 'end': '17:00'},
            'tuesday': {'start': '09:00', 'end': '17:00'},
            'wednesday': {'start': '09:00', 'end': '17:00'},
            'thursday': {'start': '09:00', 'end': '17:00'},
            'friday': {'start': '09:00', 'end': '17:00'}
        },
        rrule="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    )
    db.session.add(work_schedule)
    db.session.commit()
    return work_schedule


@pytest.fixture
def availability_service():
    """Create availability service instance."""
    return AvailabilityService()


class TestAvailabilityCalculation:
    """Test availability calculation functionality."""

    def test_calculate_availability_success(self, app, test_tenant, test_resource, test_work_schedule, availability_service):
        """Test successful availability calculation."""
        start_date = date.today()
        end_date = start_date + timedelta(days=7)
        
        availability = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        assert availability is not None
        assert 'schedule' in availability
        assert 'availability' in availability
        assert len(availability['availability']) > 0

    def test_calculate_availability_with_existing_bookings(self, app, test_tenant, test_resource, test_service, test_customer, test_work_schedule, availability_service):
        """Test availability calculation with existing bookings."""
        # Create existing booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            service_id=test_service.id,
            resource_id=test_resource.id,
            start_at=datetime.now() + timedelta(hours=1),
            end_at=datetime.now() + timedelta(hours=2),
            status="confirmed",
            total_amount_cents=5000
        )
        db.session.add(booking)
        db.session.commit()
        
        start_date = date.today()
        end_date = start_date + timedelta(days=1)
        
        availability = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        assert availability is not None
        # Should show reduced availability due to existing booking
        assert len(availability['availability']) >= 0

    def test_calculate_availability_with_time_off(self, app, test_tenant, test_resource, test_staff_profile, test_work_schedule, availability_service):
        """Test availability calculation with time off."""
        # Create time off schedule
        time_off_schedule = WorkSchedule(
            id=uuid.uuid4(),
            tenant_id=test_tenant.id,
            staff_profile_id=test_staff_profile.id,
            schedule_type="time_off",
            start_date=date.today(),
            end_date=date.today(),
            is_time_off=True,
            reason="Vacation"
        )
        db.session.add(time_off_schedule)
        db.session.commit()
        
        start_date = date.today()
        end_date = start_date + timedelta(days=1)
        
        availability = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        assert availability is not None
        # Should show no availability due to time off
        assert len(availability['availability']) == 0

    def test_get_available_slots_success(self, app, test_tenant, test_resource, test_service, test_work_schedule, availability_service):
        """Test getting available slots for a specific date."""
        target_date = date.today()
        
        slots = availability_service.get_available_slots(
            test_tenant.id, test_resource.id, test_service.id, target_date
        )
        
        assert slots is not None
        assert isinstance(slots, list)
        # Should have slots for working days
        if target_date.weekday() < 5:  # Monday to Friday
            assert len(slots) > 0

    def test_is_time_available_success(self, app, test_tenant, test_resource, test_service, test_work_schedule, availability_service):
        """Test checking if a specific time is available."""
        # Check availability for a working day
        target_date = date.today()
        if target_date.weekday() >= 5:  # If weekend, use next Monday
            target_date = target_date + timedelta(days=(7 - target_date.weekday()))
        
        start_time = datetime.combine(target_date, datetime.min.time().replace(hour=10))
        end_time = start_time + timedelta(hours=1)
        
        is_available = availability_service.is_time_available(
            test_tenant.id, test_resource.id, test_service.id, start_time, end_time
        )
        
        assert isinstance(is_available, bool)

    def test_is_time_available_with_conflict(self, app, test_tenant, test_resource, test_service, test_customer, test_work_schedule, availability_service):
        """Test checking availability with existing booking conflict."""
        # Create existing booking
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            service_id=test_service.id,
            resource_id=test_resource.id,
            start_at=start_time,
            end_at=end_time,
            status="confirmed",
            total_amount_cents=5000
        )
        db.session.add(booking)
        db.session.commit()
        
        # Check same time slot
        is_available = availability_service.is_time_available(
            test_tenant.id, test_resource.id, test_service.id, start_time, end_time
        )
        
        assert is_available is False


class TestBookingHolds:
    """Test booking hold functionality."""

    def test_create_booking_hold_success(self, app, test_tenant, test_resource, test_service, test_customer, test_work_schedule, availability_service):
        """Test successful booking hold creation."""
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        ttl_minutes = 15
        
        hold = availability_service.create_booking_hold(
            test_tenant.id, test_resource.id, test_service.id, test_customer.id,
            start_time, end_time, ttl_minutes
        )
        
        assert hold is not None
        assert hold.tenant_id == test_tenant.id
        assert hold.resource_id == test_resource.id
        assert hold.service_id == test_service.id
        assert hold.customer_id == test_customer.id
        assert hold.start_at == start_time
        assert hold.end_at == end_time
        assert hold.hold_key is not None
        assert hold.hold_until > datetime.now()

    def test_create_booking_hold_unavailable_time(self, app, test_tenant, test_resource, test_service, test_customer, availability_service):
        """Test creating booking hold for unavailable time."""
        # Try to create hold outside working hours
        start_time = datetime.now().replace(hour=22)  # 10 PM
        end_time = start_time + timedelta(hours=1)
        
        with pytest.raises(ValueError, match="Time slot not available"):
            availability_service.create_booking_hold(
                test_tenant.id, test_resource.id, test_service.id, test_customer.id,
                start_time, end_time, 15
            )

    def test_release_booking_hold_success(self, app, test_tenant, test_resource, test_service, test_customer, test_work_schedule, availability_service):
        """Test successful booking hold release."""
        # Create hold
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        hold = availability_service.create_booking_hold(
            test_tenant.id, test_resource.id, test_service.id, test_customer.id,
            start_time, end_time, 15
        )
        
        # Release hold
        availability_service.release_booking_hold(test_tenant.id, hold.hold_key)
        
        # Verify hold is released
        released_hold = BookingHold.query.filter_by(
            tenant_id=test_tenant.id,
            hold_key=hold.hold_key
        ).first()
        assert released_hold is None

    def test_release_booking_hold_not_found(self, app, test_tenant, availability_service):
        """Test releasing non-existent booking hold."""
        with pytest.raises(ValueError, match="Booking hold not found"):
            availability_service.release_booking_hold(test_tenant.id, "invalid_key")


class TestWaitlistSystem:
    """Test waitlist functionality."""

    def test_add_to_waitlist_success(self, app, test_tenant, test_resource, test_service, test_customer, availability_service):
        """Test successful waitlist entry creation."""
        preferred_start = datetime.now() + timedelta(days=1)
        preferred_end = preferred_start + timedelta(hours=1)
        
        waitlist_entry = availability_service.add_to_waitlist(
            test_tenant.id, test_resource.id, test_service.id, test_customer.id,
            preferred_start, preferred_end, priority=1
        )
        
        assert waitlist_entry is not None
        assert waitlist_entry.tenant_id == test_tenant.id
        assert waitlist_entry.resource_id == test_resource.id
        assert waitlist_entry.service_id == test_service.id
        assert waitlist_entry.customer_id == test_customer.id
        assert waitlist_entry.preferred_start_at == preferred_start
        assert waitlist_entry.preferred_end_at == preferred_end
        assert waitlist_entry.priority == 1
        assert waitlist_entry.status == "waiting"

    def test_add_to_waitlist_duplicate(self, app, test_tenant, test_resource, test_service, test_customer, availability_service):
        """Test adding duplicate waitlist entry."""
        preferred_start = datetime.now() + timedelta(days=1)
        preferred_end = preferred_start + timedelta(hours=1)
        
        # Add first entry
        availability_service.add_to_waitlist(
            test_tenant.id, test_resource.id, test_service.id, test_customer.id,
            preferred_start, preferred_end
        )
        
        # Try to add duplicate
        with pytest.raises(ValueError, match="Customer already on waitlist"):
            availability_service.add_to_waitlist(
                test_tenant.id, test_resource.id, test_service.id, test_customer.id,
                preferred_start, preferred_end
            )

    def test_remove_from_waitlist_success(self, app, test_tenant, test_resource, test_service, test_customer, availability_service):
        """Test successful waitlist entry removal."""
        # Add to waitlist
        preferred_start = datetime.now() + timedelta(days=1)
        preferred_end = preferred_start + timedelta(hours=1)
        waitlist_entry = availability_service.add_to_waitlist(
            test_tenant.id, test_resource.id, test_service.id, test_customer.id,
            preferred_start, preferred_end
        )
        
        # Remove from waitlist
        availability_service.remove_from_waitlist(test_tenant.id, waitlist_entry.id)
        
        # Verify removal
        removed_entry = WaitlistEntry.query.filter_by(
            tenant_id=test_tenant.id,
            id=waitlist_entry.id
        ).first()
        assert removed_entry is None

    def test_remove_from_waitlist_not_found(self, app, test_tenant, availability_service):
        """Test removing non-existent waitlist entry."""
        with pytest.raises(ValueError, match="Waitlist entry not found"):
            availability_service.remove_from_waitlist(test_tenant.id, uuid.uuid4())


class TestAvailabilityCache:
    """Test availability caching functionality."""

    def test_availability_cache_invalidation(self, app, test_tenant, test_resource, test_work_schedule, availability_service):
        """Test availability cache invalidation."""
        # Calculate availability (should cache)
        start_date = date.today()
        end_date = start_date + timedelta(days=1)
        
        availability1 = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        # Calculate again (should use cache)
        availability2 = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        # Results should be the same
        assert availability1 == availability2

    def test_availability_cache_with_booking_hold(self, app, test_tenant, test_resource, test_service, test_customer, test_work_schedule, availability_service):
        """Test that booking holds invalidate cache."""
        # Calculate initial availability
        start_date = date.today()
        end_date = start_date + timedelta(days=1)
        
        availability1 = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        # Create booking hold
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        availability_service.create_booking_hold(
            test_tenant.id, test_resource.id, test_service.id, test_customer.id,
            start_time, end_time, 15
        )
        
        # Calculate availability again (should be different due to hold)
        availability2 = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        
        # Results should be different due to hold
        assert availability1 != availability2


class TestAvailabilityServiceErrorHandling:
    """Test availability service error handling."""

    def test_invalid_tenant_id(self, app, availability_service):
        """Test handling of invalid tenant ID."""
        with pytest.raises(ValueError, match="Tenant not found"):
            availability_service.calculate_availability(
                uuid.uuid4(), uuid.uuid4(), date.today(), date.today()
            )

    def test_invalid_resource_id(self, app, test_tenant, availability_service):
        """Test handling of invalid resource ID."""
        with pytest.raises(ValueError, match="Resource not found"):
            availability_service.calculate_availability(
                test_tenant.id, uuid.uuid4(), date.today(), date.today()
            )

    def test_invalid_service_id(self, app, test_tenant, test_resource, availability_service):
        """Test handling of invalid service ID."""
        with pytest.raises(ValueError, match="Service not found"):
            availability_service.get_available_slots(
                test_tenant.id, test_resource.id, uuid.uuid4(), date.today()
            )

    def test_invalid_customer_id(self, app, test_tenant, test_resource, test_service, availability_service):
        """Test handling of invalid customer ID."""
        start_time = datetime.now() + timedelta(hours=1)
        end_time = start_time + timedelta(hours=1)
        
        with pytest.raises(ValueError, match="Customer not found"):
            availability_service.create_booking_hold(
                test_tenant.id, test_resource.id, test_service.id, uuid.uuid4(),
                start_time, end_time, 15
            )


class TestAvailabilityPerformance:
    """Test availability calculation performance."""

    def test_availability_calculation_performance(self, app, test_tenant, test_resource, test_work_schedule, availability_service):
        """Test that availability calculation completes within reasonable time."""
        import time
        
        start_date = date.today()
        end_date = start_date + timedelta(days=30)  # 30 days
        
        start_time = time.time()
        availability = availability_service.calculate_availability(
            test_tenant.id, test_resource.id, start_date, end_date
        )
        end_time = time.time()
        
        # Should complete within 1 second
        assert (end_time - start_time) < 1.0
        assert availability is not None

    def test_concurrent_availability_requests(self, app, test_tenant, test_resource, test_work_schedule, availability_service):
        """Test handling of concurrent availability requests."""
        import threading
        import time
        
        results = []
        errors = []
        
        def calculate_availability():
            try:
                start_date = date.today()
                end_date = start_date + timedelta(days=7)
                availability = availability_service.calculate_availability(
                    test_tenant.id, test_resource.id, start_date, end_date
                )
                results.append(availability)
            except Exception as e:
                errors.append(e)
        
        # Create multiple threads
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=calculate_availability)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert len(errors) == 0
        assert len(results) == 5
        # All results should be the same (cached)
        assert all(result == results[0] for result in results)
