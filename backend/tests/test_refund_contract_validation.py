"""
Contract Tests for Refund & Cancellation Fees (Task 5.2)

Black-box contract tests validating refund workflow tied to cancellation policies.
Tests the contract: Given cancellation < 24h, When refund requested, Then only partial refund issued.
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


class TestRefundContractValidation:
    """Contract tests for refund functionality"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant_with_24h_policy(self, app):
        """Create tenant with 24-hour cancellation policy"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="contract-test-salon",
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
    def customer(self, app, tenant_with_24h_policy):
        """Create test customer"""
        with app.app_context():
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant_with_24h_policy.id,
                display_name="Contract Test Customer",
                email="contract@test.com"
            )
            db.session.add(customer)
            db.session.commit()
            db.session.refresh(customer)
            return customer
    
    @pytest.fixture
    def service(self, app, tenant_with_24h_policy):
        """Create test service"""
        with app.app_context():
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant_with_24h_policy.id,
                name="Contract Test Service",
                slug="contract-test",
                duration_min=60,
                price_cents=10000,  # $100.00
                buffer_before_min=10,
                buffer_after_min=10
            )
            db.session.add(service)
            db.session.commit()
            db.session.refresh(service)
            return service
    
    @pytest.fixture
    def staff(self, app, tenant_with_24h_policy):
        """Create test staff resource"""
        with app.app_context():
            staff = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant_with_24h_policy.id,
                name="Contract Test Staff",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(staff)
            db.session.commit()
            db.session.refresh(staff)
            return staff
    
    def create_booking_with_payment(self, tenant, customer, service, staff, hours_before_booking=25):
        """Helper to create booking with payment"""
        booking_start = datetime.now(timezone.utc) + timedelta(hours=hours_before_booking)
        booking_end = booking_start + timedelta(hours=1)
        
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            customer_id=customer.id,
            resource_id=staff.id,
            client_generated_id=str(uuid.uuid4()),
            service_snapshot={"id": str(service.id), "price_cents": service.price_cents},
            start_at=booking_start,
            end_at=booking_end,
            booking_tz="UTC",
            status="confirmed"
        )
        db.session.add(booking)
        
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
            provider_payment_id="pi_contract_test_123",
            provider_charge_id="ch_contract_test_123"
        )
        db.session.add(payment)
        db.session.commit()
        db.session.refresh(booking)
        db.session.refresh(payment)
        return booking, payment
    
    def test_contract_cancellation_within_24h_full_refund(self, app, tenant_with_24h_policy, customer, service, staff):
        """Contract Test: Given cancellation >= 24h, When refund requested, Then full refund issued."""
        with app.app_context():
            # Create booking 25 hours in the future
            booking, payment = self.create_booking_with_payment(
                tenant_with_24h_policy, customer, service, staff, hours_before_booking=25
            )
            
            # Cancel booking 25 hours before start time (within policy)
            cancellation_time = booking.start_at - timedelta(hours=25)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant_with_24h_policy.id),
                reason="Contract test - within policy"
            )
            
            # Contract validation: Full refund should be issued
            assert refund is not None
            assert refund.amount_cents == payment.amount_cents  # Full refund
            assert refund.refund_type == "full"
            assert refund.status == "succeeded"
            assert refund.booking_id == booking.id
            assert refund.payment_id == payment.id
    
    def test_contract_cancellation_outside_24h_partial_refund(self, app, tenant_with_24h_policy, customer, service, staff):
        """Contract Test: Given cancellation < 24h, When refund requested, Then only partial refund issued."""
        with app.app_context():
            # Create booking 25 hours in the future
            booking, payment = self.create_booking_with_payment(
                tenant_with_24h_policy, customer, service, staff, hours_before_booking=25
            )
            
            # Cancel booking 12 hours before start time (outside policy)
            cancellation_time = booking.start_at - timedelta(hours=12)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant_with_24h_policy.id),
                reason="Contract test - outside policy"
            )
            
            # Contract validation: Only partial refund should be issued
            assert refund is not None
            assert refund.amount_cents < payment.amount_cents  # Partial refund
            assert refund.refund_type == "partial"
            assert refund.status == "succeeded"
            
            # Verify no-show fee was applied (3% of $100 = $3)
            expected_no_show_fee = int(payment.amount_cents * 0.03)  # 3% fee
            expected_refund_amount = payment.amount_cents - expected_no_show_fee
            assert refund.amount_cents == expected_refund_amount
    
    def test_contract_no_show_fee_calculation(self, app, tenant_with_24h_policy, customer, service, staff):
        """Contract Test: Verify no-show fee calculation is deterministic."""
        with app.app_context():
            # Create booking
            booking, payment = self.create_booking_with_payment(
                tenant_with_24h_policy, customer, service, staff, hours_before_booking=25
            )
            
            # Cancel booking outside policy window
            cancellation_time = booking.start_at - timedelta(hours=12)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            # Process refund
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant_with_24h_policy.id),
                reason="Contract test - no-show fee"
            )
            
            # Contract validation: No-show fee calculation should be deterministic
            # Original payment: $100.00 (10000 cents)
            # No-show fee: 3% = $3.00 (300 cents)
            # Refund amount: $97.00 (9700 cents)
            original_amount = 10000  # $100.00
            no_show_fee_percent = 3.0
            expected_no_show_fee = int(original_amount * (no_show_fee_percent / 100))  # 300 cents
            expected_refund_amount = original_amount - expected_no_show_fee  # 9700 cents
            
            assert refund.amount_cents == expected_refund_amount
            assert refund.amount_cents == 9700  # $97.00
    
    def test_contract_refund_idempotency(self, app, tenant_with_24h_policy, customer, service, staff):
        """Contract Test: Refund processing should be idempotent."""
        with app.app_context():
            # Create booking
            booking, payment = self.create_booking_with_payment(
                tenant_with_24h_policy, customer, service, staff, hours_before_booking=25
            )
            
            # Cancel booking
            cancellation_time = booking.start_at - timedelta(hours=25)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            payment_service = PaymentService()
            
            # Process first refund
            refund1 = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant_with_24h_policy.id),
                reason="First refund attempt"
            )
            
            # Contract validation: Second refund attempt should fail
            # (Payment status changed to 'refunded', so no captured payment found)
            from app.middleware.error_handler import TithiError
            
            with pytest.raises(TithiError) as exc_info:
                payment_service.process_refund_with_cancellation_policy(
                    booking_id=str(booking.id),
                    tenant_id=str(tenant_with_24h_policy.id),
                    reason="Second refund attempt"
                )
            
            # Should fail because payment is already refunded
            assert exc_info.value.error_code == "TITHI_PAYMENT_NOT_FOUND"
    
    def test_contract_policy_violation_enforcement(self, app, tenant_with_24h_policy, customer, service, staff):
        """Contract Test: Policy violations should be enforced."""
        with app.app_context():
            # Create booking
            booking, payment = self.create_booking_with_payment(
                tenant_with_24h_policy, customer, service, staff, hours_before_booking=25
            )
            
            # Don't cancel the booking - leave it as 'confirmed'
            payment_service = PaymentService()
            
            # Contract validation: Refund should fail for non-cancelled booking
            from app.middleware.error_handler import TithiError
            
            with pytest.raises(TithiError) as exc_info:
                payment_service.process_refund_with_cancellation_policy(
                    booking_id=str(booking.id),
                    tenant_id=str(tenant_with_24h_policy.id),
                    reason="Invalid refund request"
                )
            
            # Should fail with policy violation error
            assert exc_info.value.error_code == "TITHI_REFUND_POLICY_VIOLATION"
    
    def test_contract_observability_hooks(self, app, tenant_with_24h_policy, customer, service, staff, caplog):
        """Contract Test: Observability hooks should be emitted."""
        with app.app_context():
            # Create booking
            booking, payment = self.create_booking_with_payment(
                tenant_with_24h_policy, customer, service, staff, hours_before_booking=25
            )
            
            # Cancel booking
            cancellation_time = booking.start_at - timedelta(hours=25)
            booking.status = "canceled"
            booking.canceled_at = cancellation_time
            db.session.commit()
            
            payment_service = PaymentService()
            refund = payment_service.process_refund_with_cancellation_policy(
                booking_id=str(booking.id),
                tenant_id=str(tenant_with_24h_policy.id),
                reason="Contract test - observability"
            )
            
            # Contract validation: REFUND_ISSUED hook should be emitted
            assert refund is not None
            
            # Check that REFUND_ISSUED hook was emitted
            log_records = [record for record in caplog.records if record.message == "REFUND_ISSUED"]
            assert len(log_records) >= 1
            
            # Verify log contains required observability data
            log_extra = log_records[-1].__dict__
            assert log_extra.get('tenant_id') == str(tenant_with_24h_policy.id)
            assert log_extra.get('booking_id') == str(booking.id)
            assert log_extra.get('refund_id') == str(refund.id)
            assert log_extra.get('amount_cents') == refund.amount_cents
            assert log_extra.get('refund_type') == refund.refund_type
            assert log_extra.get('cancellation_policy_applied') == True
