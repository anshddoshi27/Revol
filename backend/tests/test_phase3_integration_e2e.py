"""
Phase 3 End-to-End Integration Tests

This module contains comprehensive end-to-end integration tests for Phase 3 modules:
- Complete booking flow with payment and notifications
- Promotion application workflows
- Multi-tenant isolation verification
- Error handling and recovery scenarios
- Performance under realistic load
"""

import pytest
import json
import uuid
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from concurrent.futures import ThreadPoolExecutor, as_completed

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment, Coupon, GiftCard
from app.models.notification import Notification, NotificationTemplate
from app.services.financial import PaymentService, BillingService
from app.services.promotion import PromotionService
from app.services.notification import NotificationService


class TestPhase3EndToEndIntegration:
    """End-to-end integration tests for Phase 3 modules."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for E2E tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create test database
        db.create_all()
        
        # Create test data
        self.tenant = self._create_test_tenant()
        self.user = self._create_test_user()
        self.membership = self._create_test_membership()
        self.customer = self._create_test_customer()
        self.service = self._create_test_service()
        self.resource = self._create_test_resource()
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="e2e-test-tenant",
            name="E2E Test Tenant",
            timezone="UTC",
            is_active=True
        )
        db.session.add(tenant)
        db.session.commit()
        return tenant
    
    def _create_test_user(self):
        """Create test user."""
        user = User(
            id=uuid.uuid4(),
            email="e2e@example.com",
            display_name="E2E Test User"
        )
        db.session.add(user)
        db.session.commit()
        return user
    
    def _create_test_membership(self):
        """Create test membership."""
        membership = Membership(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            user_id=self.user.id,
            role="owner"
        )
        db.session.add(membership)
        db.session.commit()
        return membership
    
    def _create_test_customer(self):
        """Create test customer."""
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            email="customer@example.com",
            display_name="E2E Test Customer",
            phone="+1234567890",
            marketing_opt_in=True
        )
        db.session.add(customer)
        db.session.commit()
        return customer
    
    def _create_test_service(self):
        """Create test service."""
        service = Service(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="E2E Test Service",
            duration_minutes=60,
            price_cents=5000,
            is_active=True
        )
        db.session.add(service)
        db.session.commit()
        return service
    
    def _create_test_resource(self):
        """Create test resource."""
        resource = Resource(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="E2E Test Staff",
            type="staff",
            is_active=True
        )
        db.session.add(resource)
        db.session.commit()
        return resource
    
    def test_complete_booking_flow(self):
        """Test complete booking flow from creation to confirmation."""
        
        # Step 1: Create booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            resource_id=self.resource.id,
            service_id=self.service.id,
            start_at=datetime.utcnow() + timedelta(hours=1),
            end_at=datetime.utcnow() + timedelta(hours=2),
            status="pending"
        )
        db.session.add(booking)
        db.session.commit()
        
        # Step 2: Process payment
        with patch('stripe.PaymentIntent.create') as mock_stripe_create:
            with patch('stripe.PaymentIntent.confirm') as mock_stripe_confirm:
                mock_stripe_create.return_value = MagicMock(
                    id="pi_e2e_test",
                    status="requires_payment_method",
                    client_secret="pi_e2e_test_secret"
                )
                mock_stripe_confirm.return_value = MagicMock(
                    id="pi_e2e_test",
                    status="succeeded"
                )
                
                payment_service = PaymentService()
                
                # Create payment intent
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(booking.id),
                    amount_cents=5000
                )
                
                # Confirm payment
                confirmed_payment = payment_service.confirm_payment_intent(
                    payment_id=str(payment.id),
                    tenant_id=str(self.tenant.id)
                )
                
                assert confirmed_payment.status == "captured"
        
        # Step 3: Update booking status
        booking.status = "confirmed"
        db.session.commit()
        
        # Step 4: Send confirmation notification
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202,
                body="Message sent"
            )
            
            notification_service = NotificationService()
            notification = notification_service.send_notification(
                tenant_id=str(self.tenant.id),
                recipient_email=self.customer.email,
                channel="email",
                subject="Booking Confirmed",
                body=f"Your booking for {self.service.name} has been confirmed.",
                event_type="booking_confirmed"
            )
            
            assert notification is not None
            assert notification.status == "sent"
        
        # Step 5: Verify end-to-end state
        final_booking = db.session.query(Booking).filter(
            Booking.id == booking.id
        ).first()
        
        assert final_booking.status == "confirmed"
        assert final_booking.payments[0].status == "captured"
        assert final_booking.payments[0].amount_cents == 5000
        
        print("✅ Complete booking flow test passed")
    
    def test_promotion_application_workflow(self):
        """Test promotion application in booking workflow."""
        
        # Step 1: Create coupon
        coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="E2E20",
            discount_type="percentage",
            discount_value=20,
            is_active=True,
            usage_limit=100
        )
        db.session.add(coupon)
        db.session.commit()
        
        # Step 2: Create booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            resource_id=self.resource.id,
            service_id=self.service.id,
            start_at=datetime.utcnow() + timedelta(hours=1),
            end_at=datetime.utcnow() + timedelta(hours=2),
            status="pending"
        )
        db.session.add(booking)
        db.session.commit()
        
        # Step 3: Apply promotion
        promotion_service = PromotionService()
        promotion_result = promotion_service.apply_promotion(
            tenant_id=str(self.tenant.id),
            customer_id=str(self.customer.id),
            booking_id=str(booking.id),
            payment_id=str(uuid.uuid4()),
            amount_cents=5000,
            coupon_code="E2E20"
        )
        
        assert promotion_result["discount_amount_cents"] == 1000  # 20% of 5000
        assert promotion_result["final_amount_cents"] == 4000
        assert promotion_result["promotion_type"] == "coupon"
        
        # Step 4: Process payment with discount
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_discounted_test",
                status="succeeded"
            )
            
            payment_service = PaymentService()
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(booking.id),
                amount_cents=promotion_result["final_amount_cents"]
            )
            
            assert payment.amount_cents == 4000
        
        # Step 5: Verify coupon usage
        updated_coupon = db.session.query(Coupon).filter(
            Coupon.id == coupon.id
        ).first()
        
        assert updated_coupon.usage_count == 1
        
        print("✅ Promotion application workflow test passed")
    
    def test_gift_card_workflow(self):
        """Test gift card creation and redemption workflow."""
        
        # Step 1: Create gift card
        gift_card_service = PromotionService().gift_card_service
        gift_card = gift_card_service.create_gift_card(
            tenant_id=str(self.tenant.id),
            code="E2E_GIFT_100",
            initial_balance_cents=10000,
            purchaser_customer_id=str(self.customer.id)
        )
        
        assert gift_card.current_balance_cents == 10000
        
        # Step 2: Create booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            resource_id=self.resource.id,
            service_id=self.service.id,
            start_at=datetime.utcnow() + timedelta(hours=1),
            end_at=datetime.utcnow() + timedelta(hours=2),
            status="pending"
        )
        db.session.add(booking)
        db.session.commit()
        
        # Step 3: Redeem gift card
        transaction, updated_gift_card = gift_card_service.redeem_gift_card(
            tenant_id=str(self.tenant.id),
            gift_card_id=str(gift_card.id),
            customer_id=str(self.customer.id),
            booking_id=str(booking.id),
            payment_id=str(uuid.uuid4()),
            amount_cents=3000
        )
        
        assert transaction is not None
        assert updated_gift_card.current_balance_cents == 7000
        assert transaction.amount_cents == 3000
        
        # Step 4: Process remaining payment
        remaining_amount = 5000 - 3000  # Service price - gift card amount
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_remaining_test",
                status="succeeded"
            )
            
            payment_service = PaymentService()
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(booking.id),
                amount_cents=remaining_amount
            )
            
            assert payment.amount_cents == 2000
        
        print("✅ Gift card workflow test passed")
    
    def test_no_show_fee_workflow(self):
        """Test no-show fee processing workflow."""
        
        # Step 1: Create booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            resource_id=self.resource.id,
            service_id=self.service.id,
            start_at=datetime.utcnow() - timedelta(hours=1),  # Past booking
            end_at=datetime.utcnow(),
            status="no_show"
        )
        db.session.add(booking)
        db.session.commit()
        
        # Step 2: Process no-show fee
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_noshow_test",
                status="succeeded"
            )
            
            payment_service = PaymentService()
            no_show_payment = payment_service.process_no_show_fee(
                booking_id=str(booking.id),
                tenant_id=str(self.tenant.id),
                customer_id=str(self.customer.id)
            )
            
            assert no_show_payment.fee_type == "no_show"
            assert no_show_payment.no_show_fee_cents > 0
        
        # Step 3: Send no-show notification
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202
            )
            
            notification_service = NotificationService()
            notification = notification_service.send_notification(
                tenant_id=str(self.tenant.id),
                recipient_email=self.customer.email,
                channel="email",
                subject="No-Show Fee Charged",
                body="A no-show fee has been charged to your account.",
                event_type="no_show_fee_charged"
            )
            
            assert notification is not None
            assert notification.status == "sent"
        
        print("✅ No-show fee workflow test passed")
    
    def test_multi_tenant_isolation(self):
        """Test multi-tenant isolation across all Phase 3 modules."""
        
        # Create second tenant
        tenant2 = Tenant(
            id=uuid.uuid4(),
            slug="e2e-tenant-2",
            name="E2E Tenant 2",
            timezone="UTC",
            is_active=True
        )
        db.session.add(tenant2)
        
        user2 = User(
            id=uuid.uuid4(),
            email="tenant2@example.com",
            display_name="Tenant 2 User"
        )
        db.session.add(user2)
        
        membership2 = Membership(
            id=uuid.uuid4(),
            tenant_id=tenant2.id,
            user_id=user2.id,
            role="owner"
        )
        db.session.add(membership2)
        
        customer2 = Customer(
            id=uuid.uuid4(),
            tenant_id=tenant2.id,
            email="customer2@example.com",
            display_name="Tenant 2 Customer"
        )
        db.session.add(customer2)
        db.session.commit()
        
        # Test payment isolation
        payment1 = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            amount_cents=5000,
            status="captured"
        )
        db.session.add(payment1)
        
        payment2 = Payment(
            id=uuid.uuid4(),
            tenant_id=tenant2.id,
            amount_cents=10000,
            status="captured"
        )
        db.session.add(payment2)
        db.session.commit()
        
        # Verify tenant1 can only see their payments
        tenant1_payments = db.session.query(Payment).filter(
            Payment.tenant_id == self.tenant.id
        ).all()
        assert len(tenant1_payments) == 1
        assert tenant1_payments[0].amount_cents == 5000
        
        # Test promotion isolation
        coupon1 = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="TENANT1_COUPON",
            discount_type="percentage",
            discount_value=20
        )
        db.session.add(coupon1)
        
        coupon2 = Coupon(
            id=uuid.uuid4(),
            tenant_id=tenant2.id,
            code="TENANT2_COUPON",
            discount_type="percentage",
            discount_value=30
        )
        db.session.add(coupon2)
        db.session.commit()
        
        # Verify tenant1 cannot use tenant2's coupon
        promotion_service = PromotionService()
        is_valid, message, coupon = promotion_service.coupon_service.validate_coupon(
            tenant_id=str(self.tenant.id),
            code="TENANT2_COUPON",
            customer_id=str(self.customer.id),
            amount_cents=5000
        )
        assert is_valid is False
        
        # Test notification isolation
        notification1 = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            recipient_email="tenant1@example.com",
            channel="email",
            subject="Tenant 1 Notification",
            body="For tenant 1 only",
            status="sent"
        )
        db.session.add(notification1)
        
        notification2 = Notification(
            id=uuid.uuid4(),
            tenant_id=tenant2.id,
            recipient_email="tenant2@example.com",
            channel="email",
            subject="Tenant 2 Notification",
            body="For tenant 2 only",
            status="sent"
        )
        db.session.add(notification2)
        db.session.commit()
        
        # Verify tenant1 can only see their notifications
        tenant1_notifications = db.session.query(Notification).filter(
            Notification.tenant_id == self.tenant.id
        ).all()
        assert len(tenant1_notifications) == 1
        assert "tenant 1" in tenant1_notifications[0].body.lower()
        
        print("✅ Multi-tenant isolation test passed")
    
    def test_error_recovery_scenarios(self):
        """Test error recovery and resilience scenarios."""
        
        # Test payment failure recovery
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            # First attempt fails
            mock_stripe.side_effect = [
                Exception("Stripe temporarily unavailable"),
                MagicMock(id="pi_recovery_test", status="requires_payment_method")
            ]
            
            payment_service = PaymentService()
            
            # First attempt should fail
            with pytest.raises(Exception):
                payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
            
            # Second attempt should succeed
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
            
            assert payment is not None
        
        # Test notification retry mechanism
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            # First two attempts fail, third succeeds
            mock_sendgrid.return_value.send.side_effect = [
                Exception("SendGrid error"),
                Exception("SendGrid error"),
                MagicMock(status_code=202, body="Message sent")
            ]
            
            notification_service = NotificationService()
            
            # Should succeed after retries
            notification = notification_service.send_notification(
                tenant_id=str(self.tenant.id),
                recipient_email="test@example.com",
                channel="email",
                subject="Retry Test",
                body="This should succeed after retries",
                event_type="retry_test"
            )
            
            assert notification is not None
            assert notification.status == "sent"
        
        print("✅ Error recovery scenarios test passed")
    
    def test_concurrent_operations(self):
        """Test concurrent operations across Phase 3 modules."""
        
        def create_payment(amount_cents):
            """Create a payment."""
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.return_value = MagicMock(
                    id=f"pi_concurrent_{amount_cents}",
                    status="requires_payment_method"
                )
                
                payment_service = PaymentService()
                return payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=amount_cents
                )
        
        def send_notification(notification_id):
            """Send a notification."""
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                mock_sendgrid.return_value.send.return_value = MagicMock(
                    status_code=202
                )
                
                notification_service = NotificationService()
                return notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email=f"test{notification_id}@example.com",
                    channel="email",
                    subject=f"Concurrent Test {notification_id}",
                    body="Concurrent notification test",
                    event_type="concurrent_test"
                )
        
        def validate_coupon(coupon_code):
            """Validate a coupon."""
            promotion_service = PromotionService()
            return promotion_service.coupon_service.validate_coupon(
                tenant_id=str(self.tenant.id),
                code=coupon_code,
                customer_id=str(self.customer.id),
                amount_cents=5000
            )
        
        # Create test coupon
        coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="CONCURRENT_TEST",
            discount_type="percentage",
            discount_value=20,
            is_active=True
        )
        db.session.add(coupon)
        db.session.commit()
        
        # Run concurrent operations
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            
            # 5 concurrent payments
            for i in range(5):
                future = executor.submit(create_payment, 5000 + (i * 1000))
                futures.append(future)
            
            # 5 concurrent notifications
            for i in range(5):
                future = executor.submit(send_notification, i)
                futures.append(future)
            
            # 5 concurrent coupon validations
            for i in range(5):
                future = executor.submit(validate_coupon, "CONCURRENT_TEST")
                futures.append(future)
            
            # Collect results
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    print(f"Concurrent operation error: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Verify all operations completed
        assert len(results) == 15  # 5 payments + 5 notifications + 5 validations
        assert processing_time < 30.0  # Should complete within 30 seconds
        
        print(f"✅ Concurrent operations test passed ({len(results)} operations in {processing_time:.2f}s)")
    
    def test_data_consistency_under_load(self):
        """Test data consistency under load conditions."""
        
        # Create multiple customers and services
        customers = []
        services = []
        
        for i in range(10):
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                email=f"load_customer_{i}@example.com",
                display_name=f"Load Customer {i}"
            )
            customers.append(customer)
            db.session.add(customer)
            
            service = Service(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                name=f"Load Service {i}",
                duration_minutes=60,
                price_cents=5000 + (i * 1000),
                is_active=True
            )
            services.append(service)
            db.session.add(service)
        
        db.session.commit()
        
        def create_booking_and_payment(customer_id, service_id, amount_cents):
            """Create booking and payment atomically."""
            try:
                # Create booking
                booking = Booking(
                    id=uuid.uuid4(),
                    tenant_id=self.tenant.id,
                    customer_id=customer_id,
                    resource_id=self.resource.id,
                    service_id=service_id,
                    start_at=datetime.utcnow() + timedelta(hours=1),
                    end_at=datetime.utcnow() + timedelta(hours=2),
                    status="pending"
                )
                db.session.add(booking)
                
                # Create payment
                with patch('stripe.PaymentIntent.create') as mock_stripe:
                    mock_stripe.return_value = MagicMock(
                        id=f"pi_load_{amount_cents}",
                        status="requires_payment_method"
                    )
                    
                    payment_service = PaymentService()
                    payment = payment_service.create_payment_intent(
                        tenant_id=str(self.tenant.id),
                        booking_id=str(booking.id),
                        amount_cents=amount_cents
                    )
                
                db.session.commit()
                return booking, payment
                
            except Exception as e:
                db.session.rollback()
                raise e
        
        # Create bookings and payments concurrently
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            
            for i in range(20):
                customer = customers[i % len(customers)]
                service = services[i % len(services)]
                amount = 5000 + (i * 100)
                
                future = executor.submit(
                    create_booking_and_payment,
                    str(customer.id),
                    str(service.id),
                    amount
                )
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    print(f"Load test error: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Verify data consistency
        total_bookings = db.session.query(Booking).filter(
            Booking.tenant_id == self.tenant.id
        ).count()
        
        total_payments = db.session.query(Payment).filter(
            Payment.tenant_id == self.tenant.id
        ).count()
        
        # Should have equal number of bookings and payments
        assert total_bookings == total_payments
        assert total_bookings == len(results)
        assert processing_time < 60.0  # Should complete within 60 seconds
        
        print(f"✅ Data consistency under load test passed ({total_bookings} bookings/payments in {processing_time:.2f}s)")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
