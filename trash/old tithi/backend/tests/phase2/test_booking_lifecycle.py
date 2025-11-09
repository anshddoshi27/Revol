"""
Phase 2 Booking Lifecycle Tests (Module G)

Tests for booking creation, confirmation, cancellation, rescheduling, and no-show handling.
Validates idempotency, overlap prevention, payment requirements, and outbox events.
"""

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from flask import Flask
from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Service, Resource, Booking, Customer
from app.services.business import BookingService, AvailabilityService


class TestBookingCreation:
    """Test booking creation with idempotency and validation"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant(self, app):
        """Create test tenant"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)  # Ensure object is attached to session
            return tenant
    
    @pytest.fixture
    def owner(self, app, tenant):
        """Create owner user"""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                primary_email="owner@test.com",
                display_name="Test Owner"
            )
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            db.session.add_all([user, membership])
            db.session.commit()
            db.session.refresh(user)  # Ensure object is attached to session
            db.session.refresh(membership)
            return user
    
    @pytest.fixture
    def service(self, app, tenant, owner):
        """Create test service"""
        with app.app_context():
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="Haircut",
                slug="haircut",
                duration_min=30,
                price_cents=5000,
                buffer_before_min=5,
                buffer_after_min=10
            )
            db.session.add(service)
            db.session.commit()
            db.session.refresh(service)  # Ensure object is attached to session
            return service
    
    @pytest.fixture
    def staff(self, app, tenant, owner):
        """Create test staff resource"""
        with app.app_context():
            staff = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="John Doe",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(staff)
            db.session.commit()
            db.session.refresh(staff)  # Ensure object is attached to session
            return staff
    
    @pytest.fixture
    def customer(self, app, tenant):
        """Create test customer"""
        with app.app_context():
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                display_name="Jane Smith",
                email="jane@example.com",
                phone="+1234567890"
            )
            db.session.add(customer)
            db.session.commit()
            db.session.refresh(customer)  # Ensure object is attached to session
            return customer
    
    def test_booking_compose_endpoint(self, app, tenant, service, staff, customer, owner):
        """POST /api/bookings/compose validates and creates bookings"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create availability for staff
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 1,  # Monday
                    "start_min": 540,  # 9:00 AM
                    "end_min": 1020,   # 5:00 PM
                    "source": "manual"
                },
                owner.id
            )
            
            # Create booking
            booking_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T10:00:00Z",  # Monday 10:00 AM
                "end_at": "2025-01-06T10:30:00Z",    # Monday 10:30 AM
                "client_generated_id": str(uuid.uuid4()),
                "notes": "First time customer"
            }
            
            booking = booking_service.create_booking(tenant.id, booking_data, owner.id)
            
            assert booking is not None
            assert booking.tenant_id == tenant.id
            assert booking.service_snapshot.get('service_id') == str(service.id)
            assert booking.customer_id == customer.id
            assert booking.resource_id == staff.id
            assert booking.status == "pending"  # Requires payment
            assert booking.client_generated_id == booking_data["client_generated_id"]
    
    def test_booking_idempotency(self, app, tenant, service, staff, customer, owner):
        """Client-generated IDs ensure idempotency"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create availability
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 1,
                    "start_min": 540,
                    "end_min": 1020,
                    "source": "manual"
                },
                owner.id
            )
            
            client_id = str(uuid.uuid4())
            booking_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T10:00:00Z",
                "end_at": "2025-01-06T10:30:00Z",
                "client_generated_id": client_id
            }
            
            # Create first booking
            booking1 = booking_service.create_booking(tenant.id, booking_data, owner.id)
            
            # Attempt to create duplicate booking with same client ID
            booking2 = booking_service.create_booking(tenant.id, booking_data, owner.id)
            
            # Should return the same booking
            assert booking1.id == booking2.id
            assert booking1.client_generated_id == client_id
    
    def test_booking_overlap_prevention(self, app, tenant, service, staff, customer, owner):
        """GiST constraints prevent overlapping bookings"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create availability
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 1,
                    "start_min": 540,
                    "end_min": 1020,
                    "source": "manual"
                },
                owner.id
            )
            
            # Create first booking
            booking1_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T10:00:00Z",
                "end_at": "2025-01-06T10:30:00Z",
                "client_generated_id": str(uuid.uuid4()),
            }
            
            booking1 = booking_service.create_booking(tenant.id, booking1_data, owner.id)
            
            # Confirm first booking
            booking_service.confirm_booking(tenant.id, booking1.id, owner.id)
            
            # Attempt overlapping booking
            booking2_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T10:15:00Z",  # Overlaps with first booking
                "end_at": "2025-01-06T10:45:00Z",
                "client_generated_id": str(uuid.uuid4()),
            }
            
            with pytest.raises(ValueError, match="Booking time conflicts with existing booking"):
                booking_service.create_booking(tenant.id, booking2_data, owner.id)
    
    def test_booking_availability_validation(self, app, tenant, service, staff, customer, owner):
        """Bookings only created for available slots"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create limited availability (9 AM - 12 PM only)
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 0,  # Monday (2025-01-06 is a Monday)
                    "start_min": 540,  # 9:00 AM
                    "end_min": 720,    # 12:00 PM
                    "source": "manual"
                },
                owner.id
            )
            
            # Attempt booking outside availability
            booking_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T14:00:00Z",  # 2:00 PM - outside availability
                "end_at": "2025-01-06T14:30:00Z",
                "client_generated_id": str(uuid.uuid4())
            }
            
            with pytest.raises(ValueError, match="Selected time is not available"):
                booking_service.create_booking(tenant.id, booking_data, owner.id)
    
    def test_booking_payment_requirement(self, app, tenant, service, staff, customer, owner):
        """Bookings require full payment validation"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create availability
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 1,
                    "start_min": 540,
                    "end_min": 1020,
                    "source": "manual"
                },
                owner.id
            )
            
            booking_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T10:00:00Z",
                "end_at": "2025-01-06T10:30:00Z",
                "client_generated_id": str(uuid.uuid4())
            }
            
            # Create booking (should be pending)
            booking = booking_service.create_booking(tenant.id, booking_data, owner.id)
            assert booking.status == "pending"
            
            # Cannot confirm without payment
            with pytest.raises(ValueError, match="Payment required to confirm booking"):
                booking_service.confirm_booking(tenant.id, booking.id, owner.id, require_payment=True)
    
    def test_booking_customer_creation(self, app, tenant, service, staff, owner):
        """Customer profiles created automatically"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create availability
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 1,
                    "start_min": 540,
                    "end_min": 1020,
                    "source": "manual"
                },
                owner.id
            )
            
            # Create booking with new customer data
            booking_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer": {
                    "email": "new@example.com",
                    "phone": "+1234567890"
                },
                "start_at": "2025-01-06T10:00:00Z",
                "end_at": "2025-01-06T10:30:00Z",
                "client_generated_id": str(uuid.uuid4())
            }
            
            booking = booking_service.create_booking(tenant.id, booking_data, owner.id)
            
            # Customer should be created
            assert booking.customer_id is not None
            customer = db.session.get(Customer, booking.customer_id)
            assert customer is not None
            assert customer.display_name == "New Customer"
            assert customer.email == "new@example.com"


class TestBookingStatusManagement:
    """Test booking status transitions and management"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant(self, app):
        """Create test tenant"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)  # Ensure object is attached to session
            return tenant
    
    @pytest.fixture
    def owner(self, app, tenant):
        """Create owner user"""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                primary_email="owner@test.com",
                display_name="Test Owner"
            )
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            db.session.add_all([user, membership])
            db.session.commit()
            db.session.refresh(user)  # Ensure object is attached to session
            db.session.refresh(membership)
            return user
    
    @pytest.fixture
    def confirmed_booking(self, app, tenant, owner):
        """Create confirmed booking for testing"""
        with app.app_context():
            # Create service
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="Haircut",
                slug="haircut",
                duration_min=30,
                price_cents=5000,
            )
            
            # Create customer
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                display_name="Jane Smith",
                email="jane@example.com"
            )
            
            # Create staff
            staff = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="John Doe",
                type="staff",
                tz="UTC",
                capacity=1
            )
            
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                customer_id=customer.id,
                resource_id=staff.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"service_id": str(service.id), "name": service.name},
                start_at=datetime.now(timezone.utc) + timedelta(days=1),
                end_at=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="confirmed"
            )
            
            db.session.add_all([service, customer, staff, booking])
            db.session.commit()
            db.session.refresh(booking)  # Ensure object is attached to session
            return booking
    
    def test_booking_confirmation(self, app, tenant, confirmed_booking, owner):
        """Confirm pending bookings"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create pending booking
            pending_booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                customer_id=confirmed_booking.customer_id,
                resource_id=confirmed_booking.resource_id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot=confirmed_booking.service_snapshot,
                start_at=datetime.now(timezone.utc) + timedelta(days=2),
                end_at=datetime.now(timezone.utc) + timedelta(days=2, hours=1),
                booking_tz="UTC",
                status="pending"
            )
            db.session.add(pending_booking)
            db.session.commit()
            
            # Confirm booking
            booking_service.confirm_booking(tenant.id, pending_booking.id, owner.id)
            
            # Verify status change
            updated_booking = db.session.get(Booking, pending_booking.id)
            assert updated_booking.status == "confirmed"
    
    def test_booking_cancellation(self, app, tenant, confirmed_booking, owner):
        """Cancel bookings with policy enforcement"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Cancel booking
            result = booking_service.cancel_booking(
                tenant.id, 
                confirmed_booking.id, 
                cancelled_by=owner.id,
                reason="Customer requested"
            )
            
            assert result is not None
            assert result.status == "canceled"
            
            # Verify status change
            updated_booking = db.session.get(Booking, confirmed_booking.id)
            assert updated_booking.status == "canceled"
    
    def test_booking_reschedule(self, app, tenant, confirmed_booking, owner):
        """Reschedule bookings to new available slots"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Create availability for new time
            availability_service = AvailabilityService()
            # Use a specific time within business hours
            new_start = datetime(2025, 1, 8, 10, 0, 0, tzinfo=timezone.utc)  # Wednesday 10:00 AM UTC
            new_end = new_start + timedelta(hours=1)
            
            # Create availability rule for the actual day we're rescheduling to
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": confirmed_booking.resource_id,
                    "day_of_week": new_start.weekday(),  # Use the actual weekday (2 = Wednesday)
                    "start_min": 540,  # 9:00 AM
                    "end_min": 1020,   # 5:00 PM
                    "source": "manual"
                },
                owner.id
            )

            # Reschedule booking
            result = booking_service.reschedule_booking(
                tenant.id,
                confirmed_booking.id,
                new_start.isoformat(),
                new_end.isoformat(),
                owner.id
            )
            
            assert result is not None
            assert result.start_at.replace(tzinfo=None) == new_start.replace(tzinfo=None)
            assert result.end_at.replace(tzinfo=None) == new_end.replace(tzinfo=None)
    
    def test_booking_no_show_handling(self, app, tenant, confirmed_booking, owner):
        """Mark no-shows and trigger fees"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Mark as no-show
            result = booking_service.mark_no_show(
                tenant.id,
                confirmed_booking.id,
                owner.id
            )
            
            assert result is not None
            assert result.status == "no_show"
            
            # Verify status change
            updated_booking = db.session.get(Booking, confirmed_booking.id)
            assert updated_booking.status == "no_show"
    
    def test_booking_status_precedence(self, app, tenant, confirmed_booking, owner):
        """Test booking status precedence rules"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Test precedence: canceled > no_show > completed > checked_in > confirmed > pending > failed
            statuses = ["pending", "confirmed", "checked_in", "completed", "no_show", "canceled", "failed"]
            
            for i, status in enumerate(statuses):
                booking = Booking(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    customer_id=confirmed_booking.customer_id,
                    resource_id=confirmed_booking.resource_id,
                    client_generated_id=str(uuid.uuid4()),
                    service_snapshot=confirmed_booking.service_snapshot,
                    start_at=datetime.now(timezone.utc) + timedelta(days=i+1),
                    end_at=datetime.now(timezone.utc) + timedelta(days=i+1, hours=1),
                    booking_tz="UTC",
                    status=status
                )
                db.session.add(booking)
            
            db.session.commit()
            
            # Test status precedence logic
            assert booking_service.get_status_precedence("canceled") > booking_service.get_status_precedence("no_show")
            assert booking_service.get_status_precedence("no_show") > booking_service.get_status_precedence("completed")
            assert booking_service.get_status_precedence("completed") > booking_service.get_status_precedence("checked_in")
            assert booking_service.get_status_precedence("checked_in") > booking_service.get_status_precedence("confirmed")
            assert booking_service.get_status_precedence("confirmed") > booking_service.get_status_precedence("pending")


class TestBookingBusinessLogic:
    """Test booking business logic and edge cases"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant(self, app):
        """Create test tenant"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)  # Ensure object is attached to session
            return tenant
    
    @pytest.fixture
    def owner(self, app, tenant):
        """Create owner user"""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                primary_email="owner@test.com",
                display_name="Test Owner"
            )
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            db.session.add_all([user, membership])
            db.session.commit()
            db.session.refresh(user)  # Ensure object is attached to session
            db.session.refresh(membership)
            return user
    
    def test_booking_outbox_events(self, app, tenant, owner):
        """Booking events emitted to outbox for notifications"""
        with app.app_context():
            # Objects are already attached to the session from fixtures
            
            booking_service = BookingService()
            
            # Mock event emission
            events_emitted = []
            
            def mock_emit_event(tenant_id, event_type, data):
                events_emitted.append((event_type, data))
            
            # Replace event emission with mock
            original_emit = getattr(booking_service, '_emit_event', None)
            booking_service._emit_event = mock_emit_event
            
            try:
                # Create test data
                service = Service(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    name="Haircut",
                    slug="haircut",
                    duration_min=30,
                    price_cents=5000,
                )
                
                customer = Customer(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    display_name="Jane Smith",
                    email="jane@example.com"
                )
                
                staff = Resource(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    name="John Doe",
                    type="staff",
                    tz="UTC",
                    capacity=1
                )
                
                db.session.add_all([service, customer, staff])
                db.session.commit()
                
                # Create availability
                availability_service = AvailabilityService()
                availability_service.create_availability_rule(
                    tenant.id,
                    {
                        "resource_id": staff.id,
                        "day_of_week": 1,
                        "start_min": 540,
                        "end_min": 1020,
                        "source": "manual"
                    },
                    owner.id
                )
                
                # Create booking
                booking_data = {
                    "service_id": service.id,
                    "resource_id": staff.id,
                    "customer_id": customer.id,
                    "start_at": "2025-01-06T10:00:00Z",
                    "end_at": "2025-01-06T10:30:00Z",
                    "client_generated_id": str(uuid.uuid4()),
  # Add payment amount
                }
                
                booking = booking_service.create_booking(tenant.id, booking_data, owner.id)
                
                # Confirm booking
                booking_service.confirm_booking(tenant.id, booking.id, owner.id)
                
                # Check events were emitted
                assert len(events_emitted) >= 2
                event_types = [event[0] for event in events_emitted]
                assert "BOOKING_CREATED" in event_types
                assert "BOOKING_CONFIRMED" in event_types
                
            finally:
                # Restore original emit function
                if original_emit:
                    booking_service._emit_event = original_emit
    
    def test_booking_audit_trail(self, app, tenant, owner):
        """All booking changes audited"""
        with app.app_context():
            # Objects are already attached to the session from fixtures

            booking_service = BookingService()

            # Create test booking
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="Haircut",
                slug="haircut",
                duration_min=30,
                price_cents=5000,
            )

            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                display_name="Jane Smith",
                email="jane@example.com"
            )

            staff = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="John Doe",
                type="staff",
                tz="UTC",
                capacity=1
            )

            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                customer_id=customer.id,
                resource_id=staff.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"service_id": str(service.id), "name": service.name},
                start_at=datetime.now(timezone.utc) + timedelta(days=1),
                end_at=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="confirmed"
            )

            db.session.add_all([service, customer, staff, booking])
            db.session.commit()

            # Cancel booking
            booking_service.cancel_booking(tenant.id, booking.id, owner.id, "Test cancellation")

            # Check audit log
            from app.models.system import AuditLog
            audit_logs = AuditLog.query.filter_by(
                tenant_id=tenant.id,
                table_name="booking",
                record_id=booking.id
            ).all()

            assert len(audit_logs) >= 1
            assert any(log.operation == "UPDATE" for log in audit_logs)
    
    def test_booking_partial_failure_handling(self, app, tenant, owner):
        """Outbox pattern handles partial failures"""
        with app.app_context():
            # Objects are already attached to the session from fixtures

            booking_service = BookingService()

            # Create test data
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="Haircut",
                slug="haircut",
                duration_min=30,
                price_cents=5000,
            )

            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                display_name="Jane Smith",
                email="jane@example.com"
            )

            staff = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="John Doe",
                type="staff",
                tz="UTC",
                capacity=1
            )

            db.session.add_all([service, customer, staff])
            db.session.commit()

            # Create availability
            availability_service = AvailabilityService()
            availability_service.create_availability_rule(
                tenant.id,
                {
                    "resource_id": staff.id,
                    "day_of_week": 1,
                    "start_min": 540,
                    "end_min": 1020,
                    "source": "manual"
                },
                owner.id
            )

            # Create booking (should succeed and create outbox event)
            booking_data = {
                "service_id": service.id,
                "resource_id": staff.id,
                "customer_id": customer.id,
                "start_at": "2025-01-06T10:00:00Z",
                "end_at": "2025-01-06T10:30:00Z",
                "client_generated_id": str(uuid.uuid4()),
            }

            booking = booking_service.create_booking(tenant.id, booking_data, owner.id)
            assert booking is not None
            assert booking.status == "pending"

            # Check that outbox event was created for reliable delivery
            from app.models.system import EventOutbox
            outbox_events = EventOutbox.query.filter_by(
                tenant_id=tenant.id,
                event_type="BOOKING_CREATED"
            ).all()

            assert len(outbox_events) >= 1
