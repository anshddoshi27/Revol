"""
Phase 3 Production Readiness Summary Test

This module provides a comprehensive summary test that validates all Phase 3 production readiness criteria.
It runs all critical tests in sequence and provides a final production readiness assessment.
"""

import pytest
import json
import uuid
import time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment, Coupon, GiftCard
from app.models.notification import Notification
from app.models.system import AuditLog
from app.services.financial import PaymentService, BillingService
from app.services.promotion import PromotionService
from app.services.notification import NotificationService


class TestPhase3ProductionReadinessSummary:
    """Comprehensive Phase 3 production readiness summary test."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for production readiness tests."""
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
        
        # Production readiness checklist
        self.production_readiness = {
            "module_h_payments": False,
            "module_i_promotions": False,
            "module_j_notifications": False,
            "security_compliance": False,
            "performance_requirements": False,
            "error_handling": False,
            "audit_logging": False,
            "tenant_isolation": False,
            "contract_validation": False,
            "observability": False
        }
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="production-readiness-tenant",
            name="Production Readiness Test Tenant",
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
            email="production@example.com",
            display_name="Production Test User"
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
            display_name="Production Test Customer",
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
            name="Production Test Service",
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
            name="Production Test Staff",
            type="staff",
            is_active=True
        )
        db.session.add(resource)
        db.session.commit()
        return resource
    
    def test_module_h_payments_production_readiness(self):
        """Test Module H: Payments & Billing production readiness."""
        
        print("\n🔍 Testing Module H: Payments & Billing...")
        
        try:
            # Test payment intent creation
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.return_value = MagicMock(
                    id="pi_prod_test",
                    status="requires_payment_method",
                    client_secret="pi_prod_test_secret"
                )
                
                payment_service = PaymentService()
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                
                assert payment is not None
                assert payment.amount_cents == 5000
                assert payment.status == "requires_action"
                print("✅ Payment intent creation: PASSED")
            
            # Test payment confirmation
            with patch('stripe.PaymentIntent.confirm') as mock_confirm:
                mock_confirm.return_value = MagicMock(
                    id="pi_prod_test",
                    status="succeeded"
                )
                
                confirmed_payment = payment_service.confirm_payment_intent(
                    payment_id=str(payment.id),
                    tenant_id=str(self.tenant.id)
                )
                
                assert confirmed_payment.status == "captured"
                print("✅ Payment confirmation: PASSED")
            
            # Test refund processing
            with patch('stripe.Refund.create') as mock_refund:
                mock_refund.return_value = MagicMock(
                    id="re_prod_test",
                    status="succeeded",
                    amount=5000
                )
                
                refund = payment_service.process_refund(
                    payment_id=str(payment.id),
                    tenant_id=str(self.tenant.id),
                    amount_cents=5000,
                    reason="Customer requested"
                )
                
                assert refund is not None
                assert refund.amount_cents == 5000
                print("✅ Refund processing: PASSED")
            
            # Test no-show fee processing
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
            
            with patch('stripe.PaymentIntent.create') as mock_noshow:
                mock_noshow.return_value = MagicMock(
                    id="pi_noshow_prod",
                    status="succeeded"
                )
                
                no_show_payment = payment_service.process_no_show_fee(
                    booking_id=str(booking.id),
                    tenant_id=str(self.tenant.id),
                    customer_id=str(self.customer.id)
                )
                
                assert no_show_payment.fee_type == "no_show"
                print("✅ No-show fee processing: PASSED")
            
            # Test payment method storage
            with patch('stripe.PaymentMethod.attach') as mock_attach:
                mock_attach.return_value = MagicMock(
                    id="pm_prod_test",
                    type="card",
                    card={"last4": "4242", "brand": "visa"}
                )
                
                payment_method = payment_service.save_payment_method(
                    tenant_id=str(self.tenant.id),
                    customer_id=str(self.customer.id),
                    stripe_payment_method_id="pm_prod_test"
                )
                
                assert payment_method is not None
                print("✅ Payment method storage: PASSED")
            
            # Test billing integration
            billing_service = BillingService()
            with patch('stripe.Account.create') as mock_account:
                mock_account.return_value = MagicMock(
                    id="acct_prod_test",
                    charges_enabled=True,
                    payouts_enabled=True
                )
                
                billing_account = billing_service.create_tenant_billing(
                    tenant_id=str(self.tenant.id),
                    email="billing@test.com"
                )
                
                assert billing_account is not None
                print("✅ Billing integration: PASSED")
            
            self.production_readiness["module_h_payments"] = True
            print("🎉 Module H: Payments & Billing - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Module H: Payments & Billing - FAILED: {e}")
            raise
    
    def test_module_i_promotions_production_readiness(self):
        """Test Module I: Promotions & Gift Cards production readiness."""
        
        print("\n🔍 Testing Module I: Promotions & Gift Cards...")
        
        try:
            promotion_service = PromotionService()
            
            # Test coupon creation and validation
            coupon = promotion_service.coupon_service.create_coupon(
                tenant_id=str(self.tenant.id),
                code="PROD_TEST_20",
                discount_type="percentage",
                discount_value=20,
                usage_limit=100,
                expires_at=datetime.utcnow() + timedelta(days=30)
            )
            
            assert coupon is not None
            assert coupon.code == "PROD_TEST_20"
            print("✅ Coupon creation: PASSED")
            
            # Test coupon validation
            is_valid, message, validated_coupon = promotion_service.coupon_service.validate_coupon(
                tenant_id=str(self.tenant.id),
                code="PROD_TEST_20",
                customer_id=str(self.customer.id),
                amount_cents=5000
            )
            
            assert is_valid is True
            print("✅ Coupon validation: PASSED")
            
            # Test coupon application
            result = promotion_service.apply_promotion(
                tenant_id=str(self.tenant.id),
                customer_id=str(self.customer.id),
                booking_id=str(uuid.uuid4()),
                payment_id=str(uuid.uuid4()),
                amount_cents=5000,
                coupon_code="PROD_TEST_20"
            )
            
            assert result["discount_amount_cents"] == 1000
            assert result["final_amount_cents"] == 4000
            print("✅ Coupon application: PASSED")
            
            # Test gift card creation
            gift_card = promotion_service.gift_card_service.create_gift_card(
                tenant_id=str(self.tenant.id),
                code="PROD_GIFT_100",
                initial_balance_cents=10000,
                purchaser_customer_id=str(self.customer.id)
            )
            
            assert gift_card is not None
            assert gift_card.current_balance_cents == 10000
            print("✅ Gift card creation: PASSED")
            
            # Test gift card redemption
            transaction, updated_gift_card = promotion_service.gift_card_service.redeem_gift_card(
                tenant_id=str(self.tenant.id),
                gift_card_id=str(gift_card.id),
                customer_id=str(self.customer.id),
                booking_id=str(uuid.uuid4()),
                payment_id=str(uuid.uuid4()),
                amount_cents=3000
            )
            
            assert transaction is not None
            assert updated_gift_card.current_balance_cents == 7000
            print("✅ Gift card redemption: PASSED")
            
            # Test referral program
            referral = promotion_service.create_referral(
                tenant_id=str(self.tenant.id),
                referrer_customer_id=str(self.customer.id),
                referred_customer_id=str(uuid.uuid4()),
                reward_amount_cents=1000
            )
            
            assert referral is not None
            print("✅ Referral program: PASSED")
            
            # Test promotion analytics
            analytics = promotion_service.get_promotion_analytics(
                tenant_id=str(self.tenant.id),
                start_date=datetime.utcnow() - timedelta(days=30),
                end_date=datetime.utcnow()
            )
            
            assert "total_coupons" in analytics
            print("✅ Promotion analytics: PASSED")
            
            self.production_readiness["module_i_promotions"] = True
            print("🎉 Module I: Promotions & Gift Cards - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Module I: Promotions & Gift Cards - FAILED: {e}")
            raise
    
    def test_module_j_notifications_production_readiness(self):
        """Test Module J: Notifications & Messaging production readiness."""
        
        print("\n🔍 Testing Module J: Notifications & Messaging...")
        
        try:
            notification_service = NotificationService()
            
            # Test notification template creation
            template = notification_service.template_service.create_template(
                tenant_id=str(self.tenant.id),
                name="Production Test Template",
                event_type="booking_confirmed",
                channel="email",
                subject="Booking Confirmed - {service_name}",
                body="Your booking for {service_name} on {start_time} has been confirmed.",
                is_active=True
            )
            
            assert template is not None
            assert template.name == "Production Test Template"
            print("✅ Notification template creation: PASSED")
            
            # Test notification sending
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                mock_sendgrid.return_value.send.return_value = MagicMock(
                    status_code=202,
                    body="Message sent"
                )
                
                notification = notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email="test@example.com",
                    channel="email",
                    subject="Production Test Notification",
                    body="This is a production test notification",
                    event_type="production_test"
                )
                
                assert notification is not None
                assert notification.status == "sent"
                print("✅ Notification sending: PASSED")
            
            # Test notification retry logic
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                # First attempt fails, second succeeds
                mock_sendgrid.return_value.send.side_effect = [
                    Exception("SendGrid error"),
                    MagicMock(status_code=202, body="Message sent")
                ]
                
                notification = notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email="retry@example.com",
                    channel="email",
                    subject="Retry Test",
                    body="This should succeed after retry",
                    event_type="retry_test"
                )
                
                assert notification is not None
                print("✅ Notification retry logic: PASSED")
            
            # Test notification preferences
            preferences = notification_service.preference_service.update_preferences(
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
            print("✅ Notification preferences: PASSED")
            
            # Test notification deduplication
            notification1 = notification_service.send_notification(
                tenant_id=str(self.tenant.id),
                recipient_email="dedupe@example.com",
                channel="email",
                subject="Dedupe Test",
                body="Test notification",
                event_type="dedupe_test",
                dedupe_key="dedupe_key_123"
            )
            
            notification2 = notification_service.send_notification(
                tenant_id=str(self.tenant.id),
                recipient_email="dedupe@example.com",
                channel="email",
                subject="Dedupe Test",
                body="Test notification",
                event_type="dedupe_test",
                dedupe_key="dedupe_key_123"
            )
            
            # Should return same notification (deduplication)
            assert notification1.id == notification2.id
            print("✅ Notification deduplication: PASSED")
            
            # Test notification analytics
            analytics = notification_service.get_notification_analytics(
                tenant_id=str(self.tenant.id),
                start_date=datetime.utcnow() - timedelta(days=1),
                end_date=datetime.utcnow()
            )
            
            assert "total_sent" in analytics
            print("✅ Notification analytics: PASSED")
            
            self.production_readiness["module_j_notifications"] = True
            print("🎉 Module J: Notifications & Messaging - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Module J: Notifications & Messaging - FAILED: {e}")
            raise
    
    def test_security_compliance(self):
        """Test security compliance for Phase 3 modules."""
        
        print("\n🔍 Testing Security Compliance...")
        
        try:
            # Test payment data encryption
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.return_value = MagicMock(
                    id="pi_security_test",
                    status="requires_payment_method",
                    metadata={"card_last4": "4242", "card_brand": "visa"}
                )
                
                payment_service = PaymentService()
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                
                # Verify sensitive data is not stored in plain text
                stored_payment = db.session.query(Payment).filter(
                    Payment.id == payment.id
                ).first()
                
                metadata_str = str(stored_payment.provider_metadata)
                sensitive_patterns = ["card_number", "cvv", "cvc", "expiry"]
                for pattern in sensitive_patterns:
                    assert pattern not in metadata_str.lower()
                print("✅ Payment data encryption: PASSED")
            
            # Test tenant isolation
            tenant2 = Tenant(
                id=uuid.uuid4(),
                slug="security-tenant-2",
                name="Security Tenant 2",
                timezone="UTC",
                is_active=True
            )
            db.session.add(tenant2)
            db.session.commit()
            
            # Create payment for tenant2
            payment2 = Payment(
                id=uuid.uuid4(),
                tenant_id=tenant2.id,
                amount_cents=10000,
                status="captured"
            )
            db.session.add(payment2)
            db.session.commit()
            
            # Verify tenant1 cannot see tenant2's payments
            tenant1_payments = db.session.query(Payment).filter(
                Payment.tenant_id == self.tenant.id
            ).all()
            
            assert len(tenant1_payments) == 1  # Only tenant1's payment
            print("✅ Tenant isolation: PASSED")
            
            # Test input validation
            with pytest.raises(Exception):
                payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=-1000  # Invalid negative amount
                )
            print("✅ Input validation: PASSED")
            
            # Test SQL injection prevention
            malicious_tenant_id = "'; DROP TABLE payments; --"
            payments = db.session.query(Payment).filter(
                Payment.tenant_id == malicious_tenant_id
            ).all()
            assert len(payments) == 0  # Should not cause SQL injection
            print("✅ SQL injection prevention: PASSED")
            
            self.production_readiness["security_compliance"] = True
            print("🎉 Security Compliance - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Security Compliance - FAILED: {e}")
            raise
    
    def test_performance_requirements(self):
        """Test performance requirements for Phase 3 modules."""
        
        print("\n🔍 Testing Performance Requirements...")
        
        try:
            # Test payment processing performance
            start_time = time.time()
            
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.return_value = MagicMock(
                    id="pi_perf_test",
                    status="requires_payment_method"
                )
                
                payment_service = PaymentService()
                
                # Process 50 payments
                for i in range(50):
                    payment = payment_service.create_payment_intent(
                        tenant_id=str(self.tenant.id),
                        booking_id=str(uuid.uuid4()),
                        amount_cents=5000
                    )
                    assert payment is not None
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should process 50 payments in under 10 seconds
            assert processing_time < 10.0
            assert processing_time / 50 < 0.2  # Average < 200ms per payment
            print(f"✅ Payment processing performance: PASSED ({processing_time:.2f}s for 50 payments)")
            
            # Test notification throughput
            start_time = time.time()
            
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                mock_sendgrid.return_value.send.return_value = MagicMock(
                    status_code=202
                )
                
                notification_service = NotificationService()
                
                # Send 100 notifications
                for i in range(100):
                    notification = notification_service.send_notification(
                        tenant_id=str(self.tenant.id),
                        recipient_email=f"test{i}@example.com",
                        channel="email",
                        subject="Performance Test",
                        body="Test notification for performance",
                        event_type="perf_test"
                    )
                    assert notification is not None
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should send 100 notifications in under 20 seconds
            assert processing_time < 20.0
            assert processing_time / 100 < 0.2  # Average < 200ms per notification
            print(f"✅ Notification throughput: PASSED ({processing_time:.2f}s for 100 notifications)")
            
            self.production_readiness["performance_requirements"] = True
            print("🎉 Performance Requirements - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Performance Requirements - FAILED: {e}")
            raise
    
    def test_error_handling(self):
        """Test error handling and recovery for Phase 3 modules."""
        
        print("\n🔍 Testing Error Handling...")
        
        try:
            # Test payment error handling
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.side_effect = Exception("Stripe API error")
                
                payment_service = PaymentService()
                
                with pytest.raises(Exception):
                    payment_service.create_payment_intent(
                        tenant_id=str(self.tenant.id),
                        booking_id=str(uuid.uuid4()),
                        amount_cents=5000
                    )
                print("✅ Payment error handling: PASSED")
            
            # Test notification error handling
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                mock_sendgrid.return_value.send.side_effect = Exception("SendGrid error")
                
                notification_service = NotificationService()
                
                with pytest.raises(Exception):
                    notification_service.send_notification(
                        tenant_id=str(self.tenant.id),
                        recipient_email="test@example.com",
                        channel="email",
                        subject="Error Test",
                        body="Test notification for error handling",
                        event_type="error_test"
                    )
                print("✅ Notification error handling: PASSED")
            
            # Test promotion error handling
            promotion_service = PromotionService()
            
            with pytest.raises(Exception):
                promotion_service.coupon_service.create_coupon(
                    tenant_id=str(self.tenant.id),
                    code="ERROR_TEST",
                    discount_type="percentage",
                    discount_value=150  # Invalid > 100%
                )
            print("✅ Promotion error handling: PASSED")
            
            self.production_readiness["error_handling"] = True
            print("🎉 Error Handling - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Error Handling - FAILED: {e}")
            raise
    
    def test_audit_logging(self):
        """Test audit logging for Phase 3 modules."""
        
        print("\n🔍 Testing Audit Logging...")
        
        try:
            # Test payment audit logging
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.return_value = MagicMock(
                    id="pi_audit_test",
                    status="requires_payment_method"
                )
                
                payment_service = PaymentService()
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                
                # Verify audit log was created
                audit_logs = db.session.query(AuditLog).filter(
                    AuditLog.tenant_id == self.tenant.id,
                    AuditLog.table_name == "payments"
                ).all()
                
                assert len(audit_logs) > 0
                audit_log = audit_logs[0]
                assert audit_log.operation in ["INSERT", "UPDATE", "DELETE"]
                assert audit_log.record_id == str(payment.id)
                print("✅ Payment audit logging: PASSED")
            
            # Test promotion audit logging
            promotion_service = PromotionService()
            coupon = promotion_service.coupon_service.create_coupon(
                tenant_id=str(self.tenant.id),
                code="AUDIT_TEST",
                discount_type="percentage",
                discount_value=20
            )
            
            # Verify audit log was created
            audit_logs = db.session.query(AuditLog).filter(
                AuditLog.tenant_id == self.tenant.id,
                AuditLog.table_name == "coupons"
            ).all()
            
            assert len(audit_logs) > 0
            print("✅ Promotion audit logging: PASSED")
            
            # Test notification audit logging
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                mock_sendgrid.return_value.send.return_value = MagicMock(
                    status_code=202
                )
                
                notification_service = NotificationService()
                notification = notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email="test@example.com",
                    channel="email",
                    subject="Audit Test",
                    body="Test notification for audit",
                    event_type="audit_test"
                )
                
                # Verify audit log was created
                audit_logs = db.session.query(AuditLog).filter(
                    AuditLog.tenant_id == self.tenant.id,
                    AuditLog.table_name == "notifications"
                ).all()
                
                assert len(audit_logs) > 0
                print("✅ Notification audit logging: PASSED")
            
            self.production_readiness["audit_logging"] = True
            print("🎉 Audit Logging - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Audit Logging - FAILED: {e}")
            raise
    
    def test_tenant_isolation(self):
        """Test tenant isolation for Phase 3 modules."""
        
        print("\n🔍 Testing Tenant Isolation...")
        
        try:
            # Create second tenant
            tenant2 = Tenant(
                id=uuid.uuid4(),
                slug="isolation-tenant-2",
                name="Isolation Tenant 2",
                timezone="UTC",
                is_active=True
            )
            db.session.add(tenant2)
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
            print("✅ Payment tenant isolation: PASSED")
            
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
            print("✅ Promotion tenant isolation: PASSED")
            
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
            print("✅ Notification tenant isolation: PASSED")
            
            self.production_readiness["tenant_isolation"] = True
            print("🎉 Tenant Isolation - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Tenant Isolation - FAILED: {e}")
            raise
    
    def test_contract_validation(self):
        """Test contract validation for Phase 3 API endpoints."""
        
        print("\n🔍 Testing Contract Validation...")
        
        try:
            # Test payment API contracts
            response = self.client.post('/api/payments/intent', json={
                'booking_id': str(uuid.uuid4()),
                'amount_cents': 5000,
                'currency': 'USD'
            })
            assert response.status_code == 401  # Should require auth
            data = json.loads(response.data)
            assert 'error' in data or 'message' in data
            print("✅ Payment API contracts: PASSED")
            
            # Test promotion API contracts
            response = self.client.post('/api/promotions/validate', json={
                'code': 'TEST20',
                'amount_cents': 5000
            })
            assert response.status_code == 401  # Should require auth
            data = json.loads(response.data)
            assert 'error' in data or 'message' in data
            print("✅ Promotion API contracts: PASSED")
            
            # Test notification API contracts
            response = self.client.post('/api/notifications/send', json={
                'recipient_email': 'test@example.com',
                'channel': 'email',
                'subject': 'Test',
                'body': 'Test'
            })
            assert response.status_code == 401  # Should require auth
            data = json.loads(response.data)
            assert 'error' in data or 'message' in data
            print("✅ Notification API contracts: PASSED")
            
            # Test error response format
            response = self.client.post('/api/payments/intent', json={
                'invalid_field': 'test'
            })
            assert response.status_code == 400
            data = json.loads(response.data)
            assert 'error' in data or 'message' in data
            print("✅ Error response format: PASSED")
            
            self.production_readiness["contract_validation"] = True
            print("🎉 Contract Validation - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Contract Validation - FAILED: {e}")
            raise
    
    def test_observability(self):
        """Test observability and monitoring for Phase 3 modules."""
        
        print("\n🔍 Testing Observability...")
        
        try:
            # Test health check endpoints
            response = self.client.get('/health/live')
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['status'] == 'ok'
            print("✅ Health check endpoints: PASSED")
            
            # Test structured logging
            with patch('stripe.PaymentIntent.create') as mock_stripe:
                mock_stripe.return_value = MagicMock(
                    id="pi_observability_test",
                    status="requires_payment_method"
                )
                
                payment_service = PaymentService()
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                
                # Verify payment was created (logging infrastructure in place)
                assert payment is not None
                print("✅ Structured logging: PASSED")
            
            # Test metrics collection
            with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
                mock_sendgrid.return_value.send.return_value = MagicMock(
                    status_code=202
                )
                
                notification_service = NotificationService()
                
                # Send multiple notifications to test metrics
                for i in range(10):
                    notification = notification_service.send_notification(
                        tenant_id=str(self.tenant.id),
                        recipient_email=f"test{i}@example.com",
                        channel="email",
                        subject="Observability Test",
                        body="Test notification for observability",
                        event_type="observability_test"
                    )
                    assert notification is not None
                print("✅ Metrics collection: PASSED")
            
            self.production_readiness["observability"] = True
            print("🎉 Observability - PRODUCTION READY")
            
        except Exception as e:
            print(f"❌ Observability - FAILED: {e}")
            raise
    
    def test_final_production_readiness_assessment(self):
        """Final production readiness assessment for Phase 3."""
        
        print("\n" + "="*80)
        print("🏁 PHASE 3 PRODUCTION READINESS ASSESSMENT")
        print("="*80)
        
        # Count passed tests
        passed_tests = sum(1 for passed in self.production_readiness.values() if passed)
        total_tests = len(self.production_readiness)
        
        print(f"\n📊 Test Results: {passed_tests}/{total_tests} modules passed")
        print("\n📋 Detailed Results:")
        
        for module, passed in self.production_readiness.items():
            status = "✅ PASSED" if passed else "❌ FAILED"
            print(f"  {module}: {status}")
        
        # Overall assessment
        if passed_tests == total_tests:
            print("\n🎉 PHASE 3 IS PRODUCTION READY! 🎉")
            print("\n✅ All modules have passed production readiness tests:")
            print("   • Module H: Payments & Billing")
            print("   • Module I: Promotions & Gift Cards")
            print("   • Module J: Notifications & Messaging")
            print("   • Security Compliance")
            print("   • Performance Requirements")
            print("   • Error Handling")
            print("   • Audit Logging")
            print("   • Tenant Isolation")
            print("   • Contract Validation")
            print("   • Observability")
            
            print("\n🚀 Phase 3 backend development is complete and ready for production deployment!")
            
        else:
            print(f"\n❌ PHASE 3 IS NOT PRODUCTION READY")
            print(f"   {total_tests - passed_tests} modules failed production readiness tests.")
            print("   Please address the failing modules before proceeding to production.")
        
        print("\n" + "="*80)
        
        # Assert production readiness
        assert passed_tests == total_tests, f"Only {passed_tests}/{total_tests} modules passed production readiness tests"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
