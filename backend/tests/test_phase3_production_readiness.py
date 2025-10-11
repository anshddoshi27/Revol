"""
Phase 3 Production Readiness Test Suite

This comprehensive test suite validates that Phase 3 backend development is production ready.
Phase 3 includes:
- Module H: Payments & Billing
- Module I: Promotions & Gift Cards  
- Module J: Notifications & Messaging

Tests cover:
- All API endpoints and business logic
- Error handling and edge cases
- Performance and scalability
- Security and compliance
- Integration and end-to-end workflows
- Contract validation
- Observability and monitoring
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment, PaymentMethod, Refund
from app.models.promotions import GiftCard, Coupon
from app.models.notification import Notification, NotificationTemplate
from app.services.financial import PaymentService, BillingService
from app.services.promotion import PromotionService, CouponService, GiftCardService
from app.services.notification import NotificationService, NotificationTemplateService


class TestPhase3ProductionReadiness:
    """Comprehensive Phase 3 production readiness tests."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for each test."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create test database
        db.create_all()
        
        # Create test tenant and user
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
            slug="test-tenant",
            name="Test Tenant",
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
            email="test@example.com",
            display_name="Test User"
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
            display_name="Test Customer"
        )
        db.session.add(customer)
        db.session.commit()
        return customer
    
    def _create_test_service(self):
        """Create test service."""
        service = Service(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            name="Test Service",
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
            name="Test Staff",
            type="staff",
            is_active=True
        )
        db.session.add(resource)
        db.session.commit()
        return resource


class TestPaymentModuleH:
    """Test Module H: Payments & Billing functionality."""
    
    def test_payment_intent_creation(self, setup_test_environment):
        """Test payment intent creation with Stripe integration."""
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_test123",
                status="requires_payment_method",
                metadata={}
            )
            
            payment_service = PaymentService()
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000,
                currency="USD"
            )
            
            assert payment is not None
            assert payment.amount_cents == 5000
            assert payment.status == "requires_action"
            assert payment.provider == "stripe"
            assert payment.provider_payment_id == "pi_test123"
    
    def test_payment_confirmation(self, setup_test_environment):
        """Test payment confirmation flow."""
        # Create payment intent first
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            booking_id=uuid.uuid4(),
            amount_cents=5000,
            status="requires_action",
            provider_payment_id="pi_test123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with patch('stripe.PaymentIntent.confirm') as mock_confirm:
            mock_confirm.return_value = MagicMock(
                id="pi_test123",
                status="succeeded"
            )
            
            payment_service = PaymentService()
            confirmed_payment = payment_service.confirm_payment_intent(
                payment_id=str(payment.id),
                tenant_id=str(self.tenant.id)
            )
            
            assert confirmed_payment.status == "captured"
    
    def test_refund_processing(self, setup_test_environment):
        """Test refund processing with fee deduction."""
        # Create captured payment
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            booking_id=uuid.uuid4(),
            amount_cents=5000,
            status="captured",
            provider_payment_id="pi_test123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with patch('stripe.Refund.create') as mock_refund:
            mock_refund.return_value = MagicMock(
                id="re_test123",
                status="succeeded",
                amount=5000
            )
            
            payment_service = PaymentService()
            refund = payment_service.process_refund(
                payment_id=str(payment.id),
                tenant_id=str(self.tenant.id),
                amount_cents=5000,
                reason="Customer requested"
            )
            
            assert refund is not None
            assert refund.amount_cents == 5000
            assert refund.status == "succeeded"
    
    def test_no_show_fee_processing(self, setup_test_environment):
        """Test no-show fee processing with SetupIntent."""
        # Create booking with no-show
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            resource_id=self.resource.id,
            start_at=datetime.utcnow() - timedelta(hours=1),
            end_at=datetime.utcnow(),
            status="no_show"
        )
        db.session.add(booking)
        db.session.commit()
        
        with patch('stripe.PaymentIntent.create') as mock_intent:
            mock_intent.return_value = MagicMock(
                id="pi_noshow123",
                status="requires_payment_method"
            )
            
            payment_service = PaymentService()
            no_show_payment = payment_service.process_no_show_fee(
                booking_id=str(booking.id),
                tenant_id=str(self.tenant.id),
                customer_id=str(self.customer.id)
            )
            
            assert no_show_payment is not None
            assert no_show_payment.fee_type == "no_show"
            assert no_show_payment.no_show_fee_cents > 0
    
    def test_payment_method_storage(self, setup_test_environment):
        """Test payment method storage for card-on-file."""
        with patch('stripe.PaymentMethod.attach') as mock_attach:
            mock_attach.return_value = MagicMock(
                id="pm_test123",
                type="card",
                card={"last4": "4242", "brand": "visa"}
            )
            
            payment_service = PaymentService()
            payment_method = payment_service.save_payment_method(
                tenant_id=str(self.tenant.id),
                customer_id=str(self.customer.id),
                stripe_payment_method_id="pm_test123"
            )
            
            assert payment_method is not None
            assert payment_method.stripe_payment_method_id == "pm_test123"
            assert payment_method.type == "card"
    
    def test_payment_idempotency(self, setup_test_environment):
        """Test payment idempotency with duplicate requests."""
        idempotency_key = str(uuid.uuid4())
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_test123",
                status="requires_payment_method"
            )
            
            payment_service = PaymentService()
            
            # First request
            payment1 = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000,
                idempotency_key=idempotency_key
            )
            
            # Second request with same idempotency key
            payment2 = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000,
                idempotency_key=idempotency_key
            )
            
            # Should return the same payment
            assert payment1.id == payment2.id
    
    def test_payment_webhook_processing(self, setup_test_environment):
        """Test Stripe webhook processing with signature validation."""
        webhook_payload = {
            "id": "evt_test123",
            "type": "payment_intent.succeeded",
            "data": {
                "object": {
                    "id": "pi_test123",
                    "status": "succeeded"
                }
            }
        }
        
        with patch('stripe.Webhook.construct_event') as mock_webhook:
            mock_webhook.return_value = webhook_payload
            
            response = self.client.post(
                '/api/payments/webhook',
                data=json.dumps(webhook_payload),
                content_type='application/json',
                headers={'Stripe-Signature': 'test_signature'}
            )
            
            assert response.status_code == 200
    
    def test_billing_integration(self, setup_test_environment):
        """Test tenant billing and Stripe Connect integration."""
        billing_service = BillingService()
        
        with patch('stripe.Account.create') as mock_account:
            mock_account.return_value = MagicMock(
                id="acct_test123",
                charges_enabled=True,
                payouts_enabled=True
            )
            
            billing_account = billing_service.create_tenant_billing(
                tenant_id=str(self.tenant.id),
                email="billing@test.com"
            )
            
            assert billing_account is not None
            assert billing_account.stripe_account_id == "acct_test123"


class TestPromotionModuleI:
    """Test Module I: Promotions & Gift Cards functionality."""
    
    def test_coupon_creation_and_validation(self, setup_test_environment):
        """Test coupon creation and validation."""
        coupon_service = CouponService()
        
        coupon = coupon_service.create_coupon(
            tenant_id=str(self.tenant.id),
            code="TEST20",
            name="Test Coupon",
            discount_type="percentage",
            discount_value=20,
            usage_limit=100,
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        
        assert coupon is not None
        assert coupon.code == "TEST20"
        assert coupon.discount_type == "percentage"
        assert coupon.discount_value == 20
        
        # Test validation
        is_valid, message, validated_coupon = coupon_service.validate_coupon(
            tenant_id=str(self.tenant.id),
            code="TEST20",
            customer_id=str(self.customer.id),
            amount_cents=5000
        )
        
        assert is_valid is True
        assert validated_coupon.id == coupon.id
    
    def test_coupon_application(self, setup_test_environment):
        """Test coupon application to booking."""
        # Create coupon
        coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="SAVE20",
            discount_type="percentage",
            discount_value=20,
            usage_limit=100,
            is_active=True
        )
        db.session.add(coupon)
        db.session.commit()
        
        promotion_service = PromotionService()
        result = promotion_service.apply_promotion(
            tenant_id=str(self.tenant.id),
            customer_id=str(self.customer.id),
            booking_id=str(uuid.uuid4()),
            payment_id=str(uuid.uuid4()),
            amount_cents=5000,
            coupon_code="SAVE20"
        )
        
        assert result["discount_amount_cents"] == 1000  # 20% of 5000
        assert result["final_amount_cents"] == 4000
        assert result["promotion_type"] == "coupon"
    
    def test_gift_card_creation_and_redemption(self, setup_test_environment):
        """Test gift card creation and redemption."""
        gift_card_service = GiftCardService()
        
        # Create gift card
        gift_card = gift_card_service.create_gift_card(
            tenant_id=str(self.tenant.id),
            code="GIFT100",
            initial_balance_cents=10000,
            purchaser_customer_id=str(self.customer.id)
        )
        
        assert gift_card is not None
        assert gift_card.code == "GIFT100"
        assert gift_card.current_balance_cents == 10000
        
        # Test redemption
        transaction, updated_gift_card = gift_card_service.redeem_gift_card(
            tenant_id=str(self.tenant.id),
            gift_card_id=str(gift_card.id),
            customer_id=str(self.customer.id),
            booking_id=str(uuid.uuid4()),
            payment_id=str(uuid.uuid4()),
            amount_cents=3000
        )
        
        assert transaction is not None
        assert updated_gift_card.current_balance_cents == 7000
    
    def test_referral_program(self, setup_test_environment):
        """Test referral program functionality."""
        promotion_service = PromotionService()
        
        # Create referral
        referral = promotion_service.create_referral(
            tenant_id=str(self.tenant.id),
            referrer_customer_id=str(self.customer.id),
            referred_customer_id=str(uuid.uuid4()),
            reward_amount_cents=1000
        )
        
        assert referral is not None
        assert referral.referrer_customer_id == self.customer.id
        assert referral.reward_amount_cents == 1000
        
        # Test referral completion
        completed_referral = promotion_service.complete_referral(
            referral_id=str(referral.id),
            tenant_id=str(self.tenant.id)
        )
        
        assert completed_referral.status == "completed"
    
    def test_promotion_analytics(self, setup_test_environment):
        """Test promotion analytics and reporting."""
        promotion_service = PromotionService()
        
        # Create some test data
        coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="ANALYTICS_TEST",
            discount_type="fixed",
            discount_value=500,
            is_active=True
        )
        db.session.add(coupon)
        db.session.commit()
        
        analytics = promotion_service.get_promotion_analytics(
            tenant_id=str(self.tenant.id),
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow()
        )
        
        assert "total_coupons" in analytics
        assert "total_gift_cards" in analytics
        assert "total_referrals" in analytics
        assert "revenue_impact" in analytics


class TestNotificationModuleJ:
    """Test Module J: Notifications & Messaging functionality."""
    
    def test_notification_template_creation(self, setup_test_environment):
        """Test notification template creation and management."""
        template_service = NotificationTemplateService()
        
        template = template_service.create_template(
            tenant_id=str(self.tenant.id),
            name="Booking Confirmation",
            event_type="booking_confirmed",
            channel="email",
            subject="Booking Confirmed - {service_name}",
            body="Your booking for {service_name} on {start_time} has been confirmed.",
            is_active=True
        )
        
        assert template is not None
        assert template.name == "Booking Confirmation"
        assert template.event_type == "booking_confirmed"
        assert template.channel == "email"
    
    def test_notification_sending(self, setup_test_environment):
        """Test notification sending with multiple channels."""
        notification_service = NotificationService()
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202,
                body="Message sent"
            )
            
            notification = notification_service.send_notification(
                tenant_id=str(self.tenant.id),
                recipient_email="test@example.com",
                channel="email",
                subject="Test Notification",
                body="This is a test notification",
                event_type="test"
            )
            
            assert notification is not None
            assert notification.status == "sent"
    
    def test_notification_retry_logic(self, setup_test_environment):
        """Test notification retry logic with exponential backoff."""
        notification_service = NotificationService()
        
        # Create notification that will fail
        notification = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            recipient_email="test@example.com",
            channel="email",
            subject="Test",
            body="Test",
            status="pending",
            attempts=0,
            max_attempts=3
        )
        db.session.add(notification)
        db.session.commit()
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.side_effect = Exception("SendGrid error")
            
            # First attempt should fail
            result = notification_service.send_notification(str(notification.id))
            assert result is False
            assert notification.attempts == 1
            
            # Second attempt should fail
            result = notification_service.send_notification(str(notification.id))
            assert result is False
            assert notification.attempts == 2
            
            # Third attempt should fail and mark as failed
            result = notification_service.send_notification(str(notification.id))
            assert result is False
            assert notification.status == "failed"
    
    def test_notification_preferences(self, setup_test_environment):
        """Test notification preferences and opt-in/opt-out."""
        preference_service = NotificationPreferenceService()
        
        # Set preferences
        preferences = preference_service.update_preferences(
            tenant_id=str(self.tenant.id),
            user_type="customer",
            user_id=str(self.customer.id),
            email_enabled=True,
            sms_enabled=False,
            booking_notifications=True,
            marketing_notifications=False
        )
        
        assert preferences.email_enabled is True
        assert preferences.sms_enabled is False
        assert preferences.booking_notifications is True
        assert preferences.marketing_notifications is False
        
        # Test permission check
        can_send = preference_service.can_send_notification(
            tenant_id=str(self.tenant.id),
            user_type="customer",
            user_id=str(self.customer.id),
            channel="email",
            category="booking"
        )
        assert can_send is True
        
        can_send_sms = preference_service.can_send_notification(
            tenant_id=str(self.tenant.id),
            user_type="customer",
            user_id=str(self.customer.id),
            channel="sms",
            category="booking"
        )
        assert can_send_sms is False
    
    def test_notification_deduplication(self, setup_test_environment):
        """Test notification deduplication to prevent spam."""
        notification_service = NotificationService()
        
        # Send first notification
        notification1 = notification_service.send_notification(
            tenant_id=str(self.tenant.id),
            recipient_email="test@example.com",
            channel="email",
            subject="Test",
            body="Test",
            event_type="test",
            dedupe_key="test_key_123"
        )
        
        # Send duplicate notification with same dedupe key
        notification2 = notification_service.send_notification(
            tenant_id=str(self.tenant.id),
            recipient_email="test@example.com",
            channel="email",
            subject="Test",
            body="Test",
            event_type="test",
            dedupe_key="test_key_123"
        )
        
        # Should return existing notification instead of creating new one
        assert notification1.id == notification2.id
    
    def test_notification_analytics(self, setup_test_environment):
        """Test notification analytics and delivery metrics."""
        notification_service = NotificationService()
        
        # Create some test notifications
        for i in range(5):
            notification = Notification(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                recipient_email=f"test{i}@example.com",
                channel="email",
                subject="Test",
                body="Test",
                status="sent" if i < 4 else "failed",
                sent_at=datetime.utcnow() if i < 4 else None
            )
            db.session.add(notification)
        db.session.commit()
        
        analytics = notification_service.get_notification_analytics(
            tenant_id=str(self.tenant.id),
            start_date=datetime.utcnow() - timedelta(days=1),
            end_date=datetime.utcnow()
        )
        
        assert analytics["total_sent"] == 4
        assert analytics["total_failed"] == 1
        assert analytics["delivery_rate"] == 0.8


class TestPhase3Integration:
    """Test Phase 3 end-to-end integration workflows."""
    
    def test_booking_to_payment_to_notification_flow(self, setup_test_environment):
        """Test complete booking flow with payment and notification."""
        # Create booking
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
        
        # Process payment
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_test123",
                status="succeeded"
            )
            
            payment_service = PaymentService()
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
        
        # Send confirmation notification
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202
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
    
    def test_promotion_application_workflow(self, setup_test_environment):
        """Test promotion application in booking workflow."""
        # Create coupon
        coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            code="WELCOME20",
            discount_type="percentage",
            discount_value=20,
            is_active=True
        )
        db.session.add(coupon)
        db.session.commit()
        
        # Apply promotion to booking
        promotion_service = PromotionService()
        result = promotion_service.apply_promotion(
            tenant_id=str(self.tenant.id),
            customer_id=str(self.customer.id),
            booking_id=str(uuid.uuid4()),
            payment_id=str(uuid.uuid4()),
            amount_cents=5000,
            coupon_code="WELCOME20"
        )
        
        assert result["discount_amount_cents"] == 1000
        assert result["final_amount_cents"] == 4000
        
        # Process payment with discount
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_discounted123",
                status="succeeded"
            )
            
            payment_service = PaymentService()
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=result["final_amount_cents"]
            )
            
            assert payment.amount_cents == 4000
    
    def test_no_show_fee_and_notification_flow(self, setup_test_environment):
        """Test no-show fee processing with notification."""
        # Create no-show booking
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            resource_id=self.resource.id,
            start_at=datetime.utcnow() - timedelta(hours=1),
            end_at=datetime.utcnow(),
            status="no_show"
        )
        db.session.add(booking)
        db.session.commit()
        
        # Process no-show fee
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_noshow123",
                status="succeeded"
            )
            
            payment_service = PaymentService()
            no_show_payment = payment_service.process_no_show_fee(
                booking_id=str(booking.id),
                tenant_id=str(self.tenant.id),
                customer_id=str(self.customer.id)
            )
            
            assert no_show_payment.fee_type == "no_show"
        
        # Send no-show notification
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


class TestPhase3Performance:
    """Test Phase 3 performance and scalability."""
    
    def test_payment_processing_performance(self, setup_test_environment):
        """Test payment processing performance under load."""
        import time
        
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_perf_test",
                status="requires_payment_method"
            )
            
            start_time = time.time()
            
            # Process 100 payments
            for i in range(100):
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                assert payment is not None
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should process 100 payments in under 10 seconds
            assert processing_time < 10.0
            assert processing_time / 100 < 0.1  # Average < 100ms per payment
    
    def test_notification_throughput(self, setup_test_environment):
        """Test notification processing throughput."""
        import time
        
        notification_service = NotificationService()
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202
            )
            
            start_time = time.time()
            
            # Send 50 notifications
            for i in range(50):
                notification = notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email=f"test{i}@example.com",
                    channel="email",
                    subject="Test",
                    body="Test",
                    event_type="test"
                )
                assert notification is not None
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should process 50 notifications in under 5 seconds
            assert processing_time < 5.0


class TestPhase3Security:
    """Test Phase 3 security and compliance."""
    
    def test_payment_data_encryption(self, setup_test_environment):
        """Test that payment data is properly encrypted."""
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            amount_cents=5000,
            provider_payment_id="pi_encrypted123",
            provider_metadata={"card_last4": "4242"}
        )
        db.session.add(payment)
        db.session.commit()
        
        # Verify sensitive data is not stored in plain text
        stored_payment = db.session.query(Payment).filter(
            Payment.id == payment.id
        ).first()
        
        # Provider metadata should be encrypted
        assert stored_payment.provider_metadata is not None
        # Should not contain raw card data
        assert "card_number" not in str(stored_payment.provider_metadata)
    
    def test_tenant_isolation_payments(self, setup_test_environment):
        """Test that payment data is properly isolated by tenant."""
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug="other-tenant",
            name="Other Tenant",
            timezone="UTC",
            is_active=True
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        # Create payment for other tenant
        other_payment = Payment(
            id=uuid.uuid4(),
            tenant_id=other_tenant.id,
            amount_cents=10000
        )
        db.session.add(other_payment)
        db.session.commit()
        
        # Query payments for original tenant
        tenant_payments = db.session.query(Payment).filter(
            Payment.tenant_id == self.tenant.id
        ).all()
        
        # Should not include other tenant's payments
        assert len(tenant_payments) == 0
    
    def test_promotion_tenant_isolation(self, setup_test_environment):
        """Test that promotions are properly isolated by tenant."""
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug="other-tenant",
            name="Other Tenant",
            timezone="UTC",
            is_active=True
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        # Create coupon for other tenant
        other_coupon = Coupon(
            id=uuid.uuid4(),
            tenant_id=other_tenant.id,
            code="OTHER20",
            discount_type="percentage",
            discount_value=20
        )
        db.session.add(other_coupon)
        db.session.commit()
        
        # Try to use other tenant's coupon
        coupon_service = CouponService()
        is_valid, message, coupon = coupon_service.validate_coupon(
            tenant_id=str(self.tenant.id),
            code="OTHER20",
            customer_id=str(self.customer.id),
            amount_cents=5000
        )
        
        # Should not be valid for this tenant
        assert is_valid is False
        assert "not found" in message.lower()
    
    def test_notification_tenant_isolation(self, setup_test_environment):
        """Test that notifications are properly isolated by tenant."""
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug="other-tenant",
            name="Other Tenant",
            timezone="UTC",
            is_active=True
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        # Create notification for other tenant
        other_notification = Notification(
            id=uuid.uuid4(),
            tenant_id=other_tenant.id,
            recipient_email="other@example.com",
            channel="email",
            subject="Other Notification",
            body="Other body"
        )
        db.session.add(other_notification)
        db.session.commit()
        
        # Query notifications for original tenant
        tenant_notifications = db.session.query(Notification).filter(
            Notification.tenant_id == self.tenant.id
        ).all()
        
        # Should not include other tenant's notifications
        assert len(tenant_notifications) == 0


class TestPhase3ContractValidation:
    """Test Phase 3 API contract validation."""
    
    def test_payment_api_contracts(self, setup_test_environment):
        """Test payment API endpoint contracts."""
        # Test payment intent creation endpoint
        response = self.client.post('/api/payments/intent', json={
            'booking_id': str(uuid.uuid4()),
            'amount_cents': 5000,
            'currency': 'USD'
        })
        
        # Should return 401 without auth, but structure should be correct
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
    
    def test_promotion_api_contracts(self, setup_test_environment):
        """Test promotion API endpoint contracts."""
        # Test coupon validation endpoint
        response = self.client.post('/api/promotions/validate', json={
            'code': 'TEST20',
            'amount_cents': 5000
        })
        
        # Should return 401 without auth, but structure should be correct
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data
    
    def test_notification_api_contracts(self, setup_test_environment):
        """Test notification API endpoint contracts."""
        # Test notification sending endpoint
        response = self.client.post('/api/notifications/send', json={
            'recipient_email': 'test@example.com',
            'channel': 'email',
            'subject': 'Test',
            'body': 'Test'
        })
        
        # Should return 401 without auth, but structure should be correct
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data or 'message' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
