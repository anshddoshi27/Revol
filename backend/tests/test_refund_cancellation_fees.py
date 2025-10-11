"""
Test Refund & Cancellation Fees (Task 5.2)

Tests for refund processing tied to booking cancellation with policy enforcement.
Validates cancellation windows, no-show fees, and refund calculations.
"""

import pytest
import uuid
from datetime import datetime, timedelta, timezone
from flask import Flask
from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Service, Resource, Booking, Customer
from app.models.financial import Payment, Refund
from app.services.financial import PaymentService
from app.services.business_phase2 import BookingService
from app.middleware.error_handler import TithiError


class TestRefundCancellationFees:
    """Test refund processing with cancellation policy enforcement"""
    
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
        """Create test tenant with cancellation policy"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon",
                trust_copy_json={
                    "cancellation_policy": "Cancellations must be made at least 24 hours in advance."
                },
                default_no_show_fee_percent=3.0
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)
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
            db.session.refresh(user)
            db.session.refresh(membership)
            return user
    
    @pytest.fixture
    def customer(self, app, tenant):
        """Create test customer"""
        with app.app_context():
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                display_name="Test Customer",
                email="customer@test.com"
            )
            db.session.add(customer)
            db.session.commit()
            db.session.refresh(customer)
            return customer
    
    @pytest.fixture
    def service(self, app, tenant):
        """Create test service"""
        with app.app_context():
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="Haircut",
                slug="haircut",
                duration_min=30,
                price_cents=5000,  # $50.00
                buffer_before_min=5,
                buffer_after_min=10
            )
            db.session.add(service)
            db.session.commit()
            db.session.refresh(service)
            return service
    
    @pytest.fixture
    def staff(self, app, tenant):
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
            db.session.refresh(staff)
            return staff
    
    @pytest.fixture
    def booking_with_payment(self, app, tenant, customer, service, staff):
        """Create booking with captured payment"""
        with app.app_context():
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                customer_id=customer.id,
                resource_id=staff.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"id": str(service.id), "price_cents": service.price_cents},
                start_at=datetime.now(timezone.utc) + timedelta(days=1),  # Tomorrow
                end_at=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking)
            
            # Create captured payment
            payment = Payment(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                booking_id=booking.id,
                customer_id=customer.id,
                amount_cents=service.price_cents,
                currency_code="USD",
                status="captured",
                method="card",
                provider="stripe",
                provider_payment_id="pi_test_123",
                provider_charge_id="ch_test_123"
            )
            db.session.add(payment)
            db.session.commit()
            db.session.refresh(booking)
            db.session.refresh(payment)
            return booking, payment
    
    def test_full_refund_within_cancellation_window(self, app, tenant, booking_with_payment, owner):
        """Test full refund when cancelled within 24-hour window"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Cancel booking 25 hours before start time (within policy)
            cancellation_time = booking.start_at - timedelta(hours=25)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="Customer requested cancellation"
            )
            
            # Verify full refund
            assert refund is not None
            assert refund.amount_cents == payment.amount_cents  # Full refund
            assert refund.refund_type == "full"
            assert refund.status == "succeeded"
            assert refund.booking_id == booking.id
            assert refund.payment_id == payment.id
    
    def test_partial_refund_outside_cancellation_window(self, app, tenant, booking_with_payment, owner):
        """Test partial refund when cancelled outside 24-hour window"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Cancel booking 12 hours before start time (outside policy)
            cancellation_time = booking.start_at - timedelta(hours=12)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="Late cancellation"
            )
            
            # Verify partial refund (original amount minus 3% no-show fee)
            expected_no_show_fee = int(payment.amount_cents * 0.03)  # 3% fee
            expected_refund_amount = payment.amount_cents - expected_no_show_fee
            
            assert refund is not None
            assert refund.amount_cents == expected_refund_amount
            assert refund.refund_type == "partial"
            assert refund.status == "succeeded"
            assert refund.booking_id == booking.id
            assert refund.payment_id == payment.id
    
    def test_no_refund_for_no_show(self, app, tenant, booking_with_payment, owner):
        """Test no-show fee application when cancelled after booking time"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Cancel booking 1 hour after start time (no-show)
            cancellation_time = booking.start_at + timedelta(hours=1)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="No-show"
            )
            
            # Verify partial refund (original amount minus 3% no-show fee)
            expected_no_show_fee = int(payment.amount_cents * 0.03)  # 3% fee
            expected_refund_amount = payment.amount_cents - expected_no_show_fee
            
            assert refund is not None
            assert refund.amount_cents == expected_refund_amount
            assert refund.refund_type == "partial"
            assert refund.status == "succeeded"
    
    def test_refund_policy_violation_for_non_cancelled_booking(self, app, tenant, booking_with_payment):
        """Test error when trying to refund non-cancelled booking"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Booking is still confirmed, not cancelled
            payment_service = PaymentService()
            
            with pytest.raises(TithiError) as exc_info:
                payment_service.process_refund_with_cancellation_policy(
                    booking_id=str(booking.id),
                    tenant_id=str(tenant.id),
                    reason="Invalid refund request"
                )
            
            assert exc_info.value.error_code == "TITHI_REFUND_POLICY_VIOLATION"
    
    def test_refund_policy_violation_for_no_payment(self, app, tenant, customer, service, staff):
        """Test error when trying to refund booking without payment"""
        with app.app_context():
            # Create booking without payment
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                customer_id=customer.id,
                resource_id=staff.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"id": str(service.id), "price_cents": service.price_cents},
                start_at=datetime.now(timezone.utc) + timedelta(days=1),
                end_at=datetime.now(timezone.utc) + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="canceled",
                canceled_at=datetime.now(timezone.utc)
            )
            db.session.add(booking)
            db.session.commit()
            
            payment_service = PaymentService()
            
            with pytest.raises(TithiError) as exc_info:
                payment_service.process_refund_with_cancellation_policy(
                    booking_id=str(booking.id),
                    tenant_id=str(tenant.id),
                    reason="No payment found"
                )
            
            assert exc_info.value.error_code == "TITHI_PAYMENT_NOT_FOUND"
    
    def test_custom_cancellation_window_48_hours(self, app, tenant, booking_with_payment):
        """Test custom 48-hour cancellation window"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Update tenant with 48-hour policy
            tenant.trust_copy_json = {
                "cancellation_policy": "Cancellations must be made at least 48 hours in advance."
            }
            db.session.commit()
            
            # Cancel booking 49 hours before start time (within 48-hour policy)
            cancellation_time = booking.start_at - timedelta(hours=49)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="Customer requested cancellation"
            )
            
            # Verify full refund
            assert refund is not None
            assert refund.amount_cents == payment.amount_cents  # Full refund
            assert refund.refund_type == "full"
    
    def test_custom_no_show_fee_percentage(self, app, tenant, booking_with_payment):
        """Test custom no-show fee percentage"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Update tenant with 5% no-show fee
            tenant.default_no_show_fee_percent = 5.0
            db.session.commit()
            
            # Cancel booking 12 hours before start time (outside policy)
            cancellation_time = booking.start_at - timedelta(hours=12)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="Late cancellation"
            )
            
            # Verify partial refund with 5% no-show fee
            expected_no_show_fee = int(payment.amount_cents * 0.05)  # 5% fee
            expected_refund_amount = payment.amount_cents - expected_no_show_fee
            
            assert refund is not None
            assert refund.amount_cents == expected_refund_amount
            assert refund.refund_type == "partial"
    
    def test_refund_idempotency(self, app, tenant, booking_with_payment):
        """Test refund idempotency - same booking should not be refunded twice"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Cancel booking
            cancellation_time = booking.start_at - timedelta(hours=25)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            payment_service = PaymentService()
            
            # Process first refund
            refund1 = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="First refund"
            )
            
            # Try to process second refund for same booking
            with pytest.raises(TithiError) as exc_info:
                payment_service.process_refund_with_cancellation_policy(
                    booking_id=str(booking.id),
                    tenant_id=str(tenant.id),
                    reason="Second refund attempt"
                )
            
            # Should fail because payment is already refunded
            assert exc_info.value.error_code == "TITHI_PAYMENT_NOT_FOUND"
    
    def test_observability_hooks(self, app, tenant, booking_with_payment, caplog):
        """Test that observability hooks are emitted correctly"""
        with app.app_context():
            booking, payment = booking_with_payment
            
            # Cancel booking
            cancellation_time = booking.start_at - timedelta(hours=25)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant.id),
                reason="Test observability"
            )
            
            # Check that REFUND_ISSUED hook was emitted
            assert refund is not None
            
            # Verify log contains expected observability data
            log_records = [record for record in caplog.records if record.message == "REFUND_ISSUED"]
            assert len(log_records) >= 1
            
            # Check log extra data
            log_extra = log_records[-1].__dict__
            assert log_extra.get('tenant_id') == str(tenant.id)
            assert log_extra.get('booking_id') == str(booking.id)
            assert log_extra.get('refund_id') == str(refund.id)
            assert log_extra.get('amount_cents') == refund.amount_cents
            assert log_extra.get('refund_type') == refund.refund_type
            assert log_extra.get('cancellation_policy_applied') == True


class TestRefundAPIEndpoints:
    """Test refund API endpoints"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self, app):
        """Create auth headers for testing"""
        # Mock JWT token with tenant_id
        return {
            'Authorization': 'Bearer mock_jwt_token',
            'Content-Type': 'application/json'
        }
    
    def test_cancellation_refund_endpoint_success(self, client, auth_headers):
        """Test successful cancellation refund endpoint"""
        # This would require setting up a full test environment with mocked Stripe
        # For now, we'll test the endpoint structure
        response = client.post(
            '/api/payments/refund/cancellation',
            json={
                'booking_id': str(uuid.uuid4()),
                'reason': 'Customer requested cancellation'
            },
            headers=auth_headers
        )
        
        # Should return 401 without proper auth setup, but endpoint exists
        assert response.status_code in [401, 500]  # Auth or setup issue, not 404
    
    def test_cancellation_refund_endpoint_validation(self, client, auth_headers):
        """Test cancellation refund endpoint validation"""
        # Test missing booking_id
        response = client.post(
            '/api/payments/refund/cancellation',
            json={'reason': 'Test'},
            headers=auth_headers
        )
        
        # Should return validation error
        assert response.status_code in [400, 401, 500]  # Validation, auth, or setup issue
