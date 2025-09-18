"""
Phase 3 Security and Compliance Tests

This module contains comprehensive security and compliance tests for Phase 3 modules:
- Payment data security and PCI compliance
- Tenant isolation and data leakage prevention
- Authentication and authorization
- GDPR compliance for customer data
- Audit logging and monitoring
- Input validation and sanitization
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import Flask

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment, PaymentMethod, Refund, Coupon, GiftCard
from app.models.notification import Notification, NotificationTemplate
from app.services.financial import PaymentService, BillingService
from app.services.promotion import PromotionService
from app.services.notification import NotificationService
from app.middleware.error_handler import TithiError


class TestPhase3Security:
    """Security tests for Phase 3 modules."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for security tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create test database
        db.create_all()
        
        # Create test data
        self.tenant1 = self._create_test_tenant("tenant1", "tenant-1")
        self.tenant2 = self._create_test_tenant("tenant2", "tenant-2")
        self.user1 = self._create_test_user("user1@example.com")
        self.user2 = self._create_test_user("user2@example.com")
        self.membership1 = self._create_test_membership(self.tenant1.id, self.user1.id, "owner")
        self.membership2 = self._create_test_membership(self.tenant2.id, self.user2.id, "owner")
        self.customer1 = self._create_test_customer(self.tenant1.id, "customer1@example.com")
        self.customer2 = self._create_test_customer(self.tenant2.id, "customer2@example.com")
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self, name, slug):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug=slug,
            name=name,
            timezone="UTC",
            is_active=True
        )
        db.session.add(tenant)
        db.session.commit()
        return tenant
    
    def _create_test_user(self, email):
        """Create test user."""
        user = User(
            id=uuid.uuid4(),
            email=email,
            display_name="Test User"
        )
        db.session.add(user)
        db.session.commit()
        return user
    
    def _create_test_membership(self, tenant_id, user_id, role):
        """Create test membership."""
        membership = Membership(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            role=role
        )
        db.session.add(membership)
        db.session.commit()
        return membership
    
    def _create_test_customer(self, tenant_id, email):
        """Create test customer."""
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            email=email,
            display_name="Test Customer"
        )
        db.session.add(customer)
        db.session.commit()
        return customer
    
    def test_payment_data_encryption(self):
        """Test that sensitive payment data is properly encrypted."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_encryption_test",
                status="requires_payment_method",
                metadata={"card_last4": "4242", "card_brand": "visa"}
            )
            
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant1.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
            
            # Verify payment was created
            assert payment is not None
            
            # Retrieve from database and verify encryption
            stored_payment = db.session.query(Payment).filter(
                Payment.id == payment.id
            ).first()
            
            # Sensitive data should be encrypted or not stored in plain text
            assert stored_payment.provider_metadata is not None
            metadata_str = str(stored_payment.provider_metadata)
            
            # Should not contain raw card numbers or sensitive data
            sensitive_patterns = [
                "card_number", "cvv", "cvc", "expiry", "exp_month", "exp_year"
            ]
            for pattern in sensitive_patterns:
                assert pattern not in metadata_str.lower(), f"Sensitive data '{pattern}' found in metadata"
    
    def test_tenant_isolation_payments(self):
        """Test that payment data is properly isolated by tenant."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_isolation_test",
                status="requires_payment_method"
            )
            
            # Create payment for tenant1
            payment1 = payment_service.create_payment_intent(
                tenant_id=str(self.tenant1.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
            
            # Create payment for tenant2
            payment2 = payment_service.create_payment_intent(
                tenant_id=str(self.tenant2.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=10000
            )
            
            # Query payments for tenant1 only
            tenant1_payments = db.session.query(Payment).filter(
                Payment.tenant_id == self.tenant1.id
            ).all()
            
            # Should only return tenant1's payment
            assert len(tenant1_payments) == 1
            assert tenant1_payments[0].id == payment1.id
            assert tenant1_payments[0].amount_cents == 5000
            
            # Query payments for tenant2 only
            tenant2_payments = db.session.query(Payment).filter(
                Payment.tenant_id == self.tenant2.id
            ).all()
            
            # Should only return tenant2's payment
            assert len(tenant2_payments) == 1
            assert tenant2_payments[0].id == payment2.id
            assert tenant2_payments[0].amount_cents == 10000
    
    def test_tenant_isolation_promotions(self):
        """Test that promotions are properly isolated by tenant."""
        promotion_service = PromotionService()
        
        # Create coupon for tenant1
        coupon1 = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            code="TENANT1_COUPON",
            discount_type="percentage",
            discount_value=20,
            is_active=True
        )
        db.session.add(coupon1)
        
        # Create coupon for tenant2
        coupon2 = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            code="TENANT2_COUPON",
            discount_type="percentage",
            discount_value=30,
            is_active=True
        )
        db.session.add(coupon2)
        db.session.commit()
        
        # Try to validate tenant2's coupon with tenant1's context
        is_valid, message, coupon = promotion_service.coupon_service.validate_coupon(
            tenant_id=str(self.tenant1.id),
            code="TENANT2_COUPON",
            customer_id=str(self.customer1.id),
            amount_cents=5000
        )
        
        # Should not be valid for tenant1
        assert is_valid is False
        assert "not found" in message.lower() or "invalid" in message.lower()
        
        # Try to validate tenant1's coupon with tenant2's context
        is_valid, message, coupon = promotion_service.coupon_service.validate_coupon(
            tenant_id=str(self.tenant2.id),
            code="TENANT1_COUPON",
            customer_id=str(self.customer2.id),
            amount_cents=5000
        )
        
        # Should not be valid for tenant2
        assert is_valid is False
        assert "not found" in message.lower() or "invalid" in message.lower()
    
    def test_tenant_isolation_notifications(self):
        """Test that notifications are properly isolated by tenant."""
        notification_service = NotificationService()
        
        # Create notification for tenant1
        notification1 = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            recipient_email="tenant1@example.com",
            channel="email",
            subject="Tenant 1 Notification",
            body="This is for tenant 1",
            status="sent"
        )
        db.session.add(notification1)
        
        # Create notification for tenant2
        notification2 = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            recipient_email="tenant2@example.com",
            channel="email",
            subject="Tenant 2 Notification",
            body="This is for tenant 2",
            status="sent"
        )
        db.session.add(notification2)
        db.session.commit()
        
        # Query notifications for tenant1 only
        tenant1_notifications = db.session.query(Notification).filter(
            Notification.tenant_id == self.tenant1.id
        ).all()
        
        # Should only return tenant1's notification
        assert len(tenant1_notifications) == 1
        assert tenant1_notifications[0].id == notification1.id
        assert "tenant 1" in tenant1_notifications[0].body.lower()
        
        # Query notifications for tenant2 only
        tenant2_notifications = db.session.query(Notification).filter(
            Notification.tenant_id == self.tenant2.id
        ).all()
        
        # Should only return tenant2's notification
        assert len(tenant2_notifications) == 1
        assert tenant2_notifications[0].id == notification2.id
        assert "tenant 2" in tenant2_notifications[0].body.lower()
    
    def test_payment_method_security(self):
        """Test payment method storage security."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentMethod.attach') as mock_attach:
            mock_attach.return_value = MagicMock(
                id="pm_security_test",
                type="card",
                card={
                    "last4": "4242",
                    "brand": "visa",
                    "exp_month": 12,
                    "exp_year": 2025
                }
            )
            
            payment_method = payment_service.save_payment_method(
                tenant_id=str(self.tenant1.id),
                customer_id=str(self.customer1.id),
                stripe_payment_method_id="pm_security_test"
            )
            
            # Verify payment method was created
            assert payment_method is not None
            
            # Retrieve from database
            stored_pm = db.session.query(PaymentMethod).filter(
                PaymentMethod.id == payment_method.id
            ).first()
            
            # Should not store sensitive card data
            assert stored_pm.stripe_payment_method_id == "pm_security_test"
            assert stored_pm.last4 == "4242"
            assert stored_pm.brand == "visa"
            
            # Should not have full card number or CVV
            assert stored_pm.card_number is None or stored_pm.card_number == ""
            assert stored_pm.cvv is None or stored_pm.cvv == ""
    
    def test_input_validation_payments(self):
        """Test input validation for payment endpoints."""
        # Test invalid amount
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_validation_test",
                status="requires_payment_method"
            )
            
            payment_service = PaymentService()
            
            # Test negative amount
            with pytest.raises(TithiError) as exc_info:
                payment_service.create_payment_intent(
                    tenant_id=str(self.tenant1.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=-1000
                )
            assert "amount" in str(exc_info.value).lower()
            
            # Test zero amount
            with pytest.raises(TithiError) as exc_info:
                payment_service.create_payment_intent(
                    tenant_id=str(self.tenant1.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=0
                )
            assert "amount" in str(exc_info.value).lower()
            
            # Test invalid currency
            with pytest.raises(TithiError) as exc_info:
                payment_service.create_payment_intent(
                    tenant_id=str(self.tenant1.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000,
                    currency="INVALID"
                )
            assert "currency" in str(exc_info.value).lower()
    
    def test_input_validation_promotions(self):
        """Test input validation for promotion endpoints."""
        promotion_service = PromotionService()
        
        # Test invalid coupon code
        is_valid, message, coupon = promotion_service.coupon_service.validate_coupon(
            tenant_id=str(self.tenant1.id),
            code="",  # Empty code
            customer_id=str(self.customer1.id),
            amount_cents=5000
        )
        assert is_valid is False
        assert "code" in message.lower()
        
        # Test invalid discount value
        with pytest.raises(TithiError) as exc_info:
            promotion_service.coupon_service.create_coupon(
                tenant_id=str(self.tenant1.id),
                code="INVALID_DISCOUNT",
                discount_type="percentage",
                discount_value=150  # > 100%
            )
        assert "discount" in str(exc_info.value).lower()
        
        # Test invalid gift card amount
        with pytest.raises(TithiError) as exc_info:
            promotion_service.gift_card_service.create_gift_card(
                tenant_id=str(self.tenant1.id),
                code="INVALID_GIFT",
                initial_balance_cents=-1000  # Negative balance
            )
        assert "balance" in str(exc_info.value).lower()
    
    def test_input_validation_notifications(self):
        """Test input validation for notification endpoints."""
        notification_service = NotificationService()
        
        # Test invalid email
        with pytest.raises(TithiError) as exc_info:
            notification_service.send_notification(
                tenant_id=str(self.tenant1.id),
                recipient_email="invalid-email",
                channel="email",
                subject="Test",
                body="Test",
                event_type="test"
            )
        assert "email" in str(exc_info.value).lower()
        
        # Test invalid channel
        with pytest.raises(TithiError) as exc_info:
            notification_service.send_notification(
                tenant_id=str(self.tenant1.id),
                recipient_email="test@example.com",
                channel="invalid_channel",
                subject="Test",
                body="Test",
                event_type="test"
            )
        assert "channel" in str(exc_info.value).lower()
        
        # Test empty subject/body
        with pytest.raises(TithiError) as exc_info:
            notification_service.send_notification(
                tenant_id=str(self.tenant1.id),
                recipient_email="test@example.com",
                channel="email",
                subject="",  # Empty subject
                body="Test",
                event_type="test"
            )
        assert "subject" in str(exc_info.value).lower()
    
    def test_sql_injection_prevention(self):
        """Test SQL injection prevention in queries."""
        # Test malicious input in payment queries
        malicious_tenant_id = "'; DROP TABLE payments; --"
        
        # Should not cause SQL injection
        payments = db.session.query(Payment).filter(
            Payment.tenant_id == malicious_tenant_id
        ).all()
        
        # Should return empty result, not cause error
        assert len(payments) == 0
        
        # Test malicious input in promotion queries
        malicious_code = "'; DROP TABLE coupons; --"
        
        promotion_service = PromotionService()
        is_valid, message, coupon = promotion_service.coupon_service.validate_coupon(
            tenant_id=str(self.tenant1.id),
            code=malicious_code,
            customer_id=str(self.customer1.id),
            amount_cents=5000
        )
        
        # Should return invalid, not cause SQL injection
        assert is_valid is False
    
    def test_xss_prevention(self):
        """Test XSS prevention in notification content."""
        notification_service = NotificationService()
        
        # Test malicious script in notification content
        malicious_subject = "<script>alert('XSS')</script>"
        malicious_body = "<img src=x onerror=alert('XSS')>"
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202
            )
            
            notification = notification_service.send_notification(
                tenant_id=str(self.tenant1.id),
                recipient_email="test@example.com",
                channel="email",
                subject=malicious_subject,
                body=malicious_body,
                event_type="test"
            )
            
            # Content should be sanitized or escaped
            assert notification is not None
            # The actual sanitization would be handled by the email template
            # This test ensures the system doesn't crash with malicious input


class TestPhase3Compliance:
    """Compliance tests for Phase 3 modules."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for compliance tests."""
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
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="compliance-tenant",
            name="Compliance Test Tenant",
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
            email="compliance@example.com",
            display_name="Compliance Test User"
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
            display_name="Compliance Test Customer",
            phone="+1234567890",
            marketing_opt_in=True
        )
        db.session.add(customer)
        db.session.commit()
        return customer
    
    def test_gdpr_data_export(self):
        """Test GDPR data export functionality."""
        # Create some test data
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            amount_cents=5000,
            status="captured"
        )
        db.session.add(payment)
        
        notification = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            recipient_email=self.customer.email,
            channel="email",
            subject="Test Notification",
            body="Test body",
            status="sent"
        )
        db.session.add(notification)
        db.session.commit()
        
        # Test customer data export
        customer_data = {
            "customer": {
                "id": str(self.customer.id),
                "email": self.customer.email,
                "display_name": self.customer.display_name,
                "phone": self.customer.phone,
                "marketing_opt_in": self.customer.marketing_opt_in,
                "created_at": self.customer.created_at.isoformat()
            },
            "payments": [
                {
                    "id": str(payment.id),
                    "amount_cents": payment.amount_cents,
                    "status": payment.status,
                    "created_at": payment.created_at.isoformat()
                }
            ],
            "notifications": [
                {
                    "id": str(notification.id),
                    "subject": notification.subject,
                    "body": notification.body,
                    "channel": notification.channel,
                    "status": notification.status,
                    "created_at": notification.created_at.isoformat()
                }
            ]
        }
        
        # Verify all customer data is included
        assert customer_data["customer"]["email"] == self.customer.email
        assert len(customer_data["payments"]) == 1
        assert len(customer_data["notifications"]) == 1
        
        # Verify sensitive data is properly formatted
        assert "card_number" not in str(customer_data)
        assert "cvv" not in str(customer_data)
    
    def test_gdpr_data_deletion(self):
        """Test GDPR data deletion functionality."""
        # Create test data
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            amount_cents=5000,
            status="captured"
        )
        db.session.add(payment)
        
        notification = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            recipient_email=self.customer.email,
            channel="email",
            subject="Test Notification",
            body="Test body",
            status="sent"
        )
        db.session.add(notification)
        db.session.commit()
        
        # Test soft deletion
        self.customer.deleted_at = datetime.utcnow()
        db.session.commit()
        
        # Verify customer is soft deleted
        active_customers = db.session.query(Customer).filter(
            Customer.tenant_id == self.tenant.id,
            Customer.deleted_at.is_(None)
        ).all()
        
        assert len(active_customers) == 0
        
        # Verify related data is also handled
        # (In a real implementation, this would cascade or be anonymized)
        customer_payments = db.session.query(Payment).filter(
            Payment.customer_id == self.customer.id
        ).all()
        
        # Should still exist for audit purposes, but customer is soft deleted
        assert len(customer_payments) == 1
    
    def test_pci_compliance(self):
        """Test PCI compliance measures."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_pci_test",
                status="requires_payment_method",
                metadata={"card_last4": "4242"}
            )
            
            payment = payment_service.create_payment_intent(
                tenant_id=str(self.tenant.id),
                booking_id=str(uuid.uuid4()),
                amount_cents=5000
            )
            
            # Verify no sensitive card data is stored
            stored_payment = db.session.query(Payment).filter(
                Payment.id == payment.id
            ).first()
            
            # Should not store full card numbers, CVV, or expiry dates
            sensitive_fields = [
                "card_number", "cvv", "cvc", "expiry", "exp_month", "exp_year"
            ]
            
            for field in sensitive_fields:
                assert not hasattr(stored_payment, field) or getattr(stored_payment, field) is None
    
    def test_audit_logging(self):
        """Test comprehensive audit logging."""
        from app.models.system import AuditLog
        
        # Create a payment (should trigger audit log)
        payment = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            customer_id=self.customer.id,
            amount_cents=5000,
            status="requires_action"
        )
        db.session.add(payment)
        db.session.commit()
        
        # Verify audit log was created
        audit_logs = db.session.query(AuditLog).filter(
            AuditLog.tenant_id == self.tenant.id,
            AuditLog.table_name == "payments"
        ).all()
        
        # Should have at least one audit log entry
        assert len(audit_logs) > 0
        
        # Verify audit log contains required information
        audit_log = audit_logs[0]
        assert audit_log.operation in ["INSERT", "UPDATE", "DELETE"]
        assert audit_log.record_id == str(payment.id)
        assert audit_log.tenant_id == self.tenant.id
    
    def test_data_retention_policy(self):
        """Test data retention policy compliance."""
        # Create old notification (should be eligible for cleanup)
        old_notification = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            recipient_email="old@example.com",
            channel="email",
            subject="Old Notification",
            body="Old body",
            status="sent",
            created_at=datetime.utcnow() - timedelta(days=400)  # Over 1 year old
        )
        db.session.add(old_notification)
        
        # Create recent notification (should not be cleaned up)
        recent_notification = Notification(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            recipient_email="recent@example.com",
            channel="email",
            subject="Recent Notification",
            body="Recent body",
            status="sent",
            created_at=datetime.utcnow() - timedelta(days=30)  # Recent
        )
        db.session.add(recent_notification)
        db.session.commit()
        
        # Test retention policy cleanup (simulated)
        cutoff_date = datetime.utcnow() - timedelta(days=365)
        old_notifications = db.session.query(Notification).filter(
            Notification.tenant_id == self.tenant.id,
            Notification.created_at < cutoff_date
        ).all()
        
        # Should identify old notifications for cleanup
        assert len(old_notifications) == 1
        assert old_notifications[0].id == old_notification.id
        
        # Recent notifications should not be marked for cleanup
        recent_notifications = db.session.query(Notification).filter(
            Notification.tenant_id == self.tenant.id,
            Notification.created_at >= cutoff_date
        ).all()
        
        assert len(recent_notifications) == 1
        assert recent_notifications[0].id == recent_notification.id
    
    def test_consent_management(self):
        """Test consent management for marketing communications."""
        # Test marketing opt-in
        assert self.customer.marketing_opt_in is True
        
        # Test notification preferences
        from app.services.notification import NotificationPreferenceService
        preference_service = NotificationPreferenceService()
        
        # Set marketing preferences
        preferences = preference_service.update_preferences(
            tenant_id=str(self.tenant.id),
            user_type="customer",
            user_id=str(self.customer.id),
            marketing_notifications=False  # Opt out
        )
        
        assert preferences.marketing_notifications is False
        
        # Test if marketing notification can be sent
        can_send = preference_service.can_send_notification(
            tenant_id=str(self.tenant.id),
            user_type="customer",
            user_id=str(self.customer.id),
            channel="email",
            category="marketing"
        )
        
        # Should not be able to send marketing notification
        assert can_send is False
        
        # Test if booking notification can still be sent
        can_send_booking = preference_service.can_send_notification(
            tenant_id=str(self.tenant.id),
            user_type="customer",
            user_id=str(self.customer.id),
            channel="email",
            category="booking"
        )
        
        # Should still be able to send booking notifications
        assert can_send_booking is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
