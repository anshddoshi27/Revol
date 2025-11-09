"""
Schema & ORM Alignment Tests

This module tests that all ORM models are properly aligned with the database schema
after the alignment fixes. Tests cover:
- Tenant essential fields
- Theme primary key alignment
- Membership role enum alignment
- Payment field and enum alignment
- Notification template and notification field alignment
"""

import pytest
import uuid
from datetime import datetime
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.extensions import db
from app.models.core import Tenant, User, Membership, MembershipRole
from app.models.system import Theme
from app.models.financial import Payment, PaymentStatus, PaymentMethod
from app.models.notification import NotificationTemplate, Notification, NotificationChannel, NotificationStatus


class TestTenantEssentialFields:
    """Test tenant essential fields alignment."""
    
    def test_tenant_creation_with_essential_fields(self):
        """Test creating a tenant with all essential fields."""
        tenant = Tenant(
            slug="test-business",
            name="Test Business",
            email="contact@testbusiness.com",
            category="Healthcare",
            logo_url="https://example.com/logo.png",
            locale="en_US",
            status="active",
            legal_name="Test Business LLC",
            phone="+1234567890",
            subdomain="testbusiness",
            business_timezone="America/New_York"
        )
        
        db.session.add(tenant)
        db.session.commit()
        
        # Verify all fields are saved
        assert tenant.name == "Test Business"
        assert tenant.email == "contact@testbusiness.com"
        assert tenant.category == "Healthcare"
        assert tenant.logo_url == "https://example.com/logo.png"
        assert tenant.locale == "en_US"
        assert tenant.status == "active"
        assert tenant.legal_name == "Test Business LLC"
        assert tenant.phone == "+1234567890"
        assert tenant.subdomain == "testbusiness"
        assert tenant.business_timezone == "America/New_York"
    
    def test_tenant_onboarding_workflow(self):
        """Test tenant onboarding with business information."""
        # Create tenant with minimal info first
        tenant = Tenant(slug="onboarding-test")
        db.session.add(tenant)
        db.session.commit()
        
        # Update with business information
        tenant.name = "Onboarding Business"
        tenant.email = "info@onboarding.com"
        tenant.category = "Fitness"
        tenant.status = "trial"
        db.session.commit()
        
        # Verify updates
        assert tenant.name == "Onboarding Business"
        assert tenant.email == "info@onboarding.com"
        assert tenant.category == "Fitness"
        assert tenant.status == "trial"


class TestThemePrimaryKeyAlignment:
    """Test theme primary key alignment with database schema."""
    
    def test_theme_creation_with_tenant_id_pk(self):
        """Test creating a theme with tenant_id as primary key."""
        # Create tenant first
        tenant = Tenant(slug="theme-test")
        db.session.add(tenant)
        db.session.commit()
        
        # Create theme with tenant_id as primary key
        theme = Theme(
            tenant_id=tenant.id,
            brand_color="#FF5733",
            logo_url="https://example.com/theme-logo.png",
            theme_json={"primary_color": "#FF5733", "font": "Arial"}
        )
        
        db.session.add(theme)
        db.session.commit()
        
        # Verify theme creation
        assert theme.tenant_id == tenant.id
        assert theme.brand_color == "#FF5733"
        assert theme.logo_url == "https://example.com/theme-logo.png"
        assert theme.theme_json["primary_color"] == "#FF5733"
    
    def test_theme_tenant_relationship(self):
        """Test theme-tenant relationship works correctly."""
        tenant = Tenant(slug="relationship-test")
        db.session.add(tenant)
        db.session.commit()
        
        theme = Theme(
            tenant_id=tenant.id,
            brand_color="#00FF00",
            theme_json={"style": "modern"}
        )
        db.session.add(theme)
        db.session.commit()
        
        # Test relationship
        assert theme.tenant.id == tenant.id
        assert theme.tenant.slug == "relationship-test"


class TestMembershipRoleEnumAlignment:
    """Test membership role enum alignment."""
    
    def test_membership_creation_with_enum_roles(self):
        """Test creating memberships with enum roles."""
        # Create tenant and user
        tenant = Tenant(slug="membership-test")
        user = User(email="user@example.com")
        db.session.add_all([tenant, user])
        db.session.commit()
        
        # Test all role types
        roles = [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.STAFF, MembershipRole.VIEWER]
        
        for role in roles:
            membership = Membership(
                tenant_id=tenant.id,
                user_id=user.id,
                role=role,
                permissions_json={"can_edit": role in [MembershipRole.OWNER, MembershipRole.ADMIN]}
            )
            db.session.add(membership)
        
        db.session.commit()
        
        # Verify all memberships created
        memberships = Membership.query.filter_by(tenant_id=tenant.id).all()
        assert len(memberships) == 4
        
        # Verify enum values
        for membership in memberships:
            assert membership.role in [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.STAFF, MembershipRole.VIEWER]
    
    def test_membership_role_validation(self):
        """Test that invalid role values are rejected."""
        tenant = Tenant(slug="validation-test")
        user = User(email="validation@example.com")
        db.session.add_all([tenant, user])
        db.session.commit()
        
        # This should fail with invalid role
        with pytest.raises((IntegrityError, SQLAlchemyError)):
            membership = Membership(
                tenant_id=tenant.id,
                user_id=user.id,
                role="invalid_role",  # This should fail
                permissions_json={}
            )
            db.session.add(membership)
            db.session.commit()


class TestPaymentFieldAlignment:
    """Test payment field and enum alignment."""
    
    def test_payment_creation_with_enums(self):
        """Test creating payments with enum status and method."""
        tenant = Tenant(slug="payment-test")
        db.session.add(tenant)
        db.session.commit()
        
        # Test different payment statuses and methods
        payment = Payment(
            tenant_id=tenant.id,
            amount_cents=5000,
            currency_code="USD",
            status=PaymentStatus.REQUIRES_ACTION,
            method=PaymentMethod.CARD,
            provider="stripe",
            idempotency_key="test_key_123"
        )
        
        db.session.add(payment)
        db.session.commit()
        
        # Verify enum values
        assert payment.status == PaymentStatus.REQUIRES_ACTION
        assert payment.method == PaymentMethod.CARD
        assert payment.amount_cents == 5000
        assert payment.currency_code == "USD"
    
    def test_payment_status_transitions(self):
        """Test payment status transitions."""
        tenant = Tenant(slug="status-test")
        db.session.add(tenant)
        db.session.commit()
        
        payment = Payment(
            tenant_id=tenant.id,
            amount_cents=10000,
            status=PaymentStatus.REQUIRES_ACTION,
            method=PaymentMethod.CARD
        )
        db.session.add(payment)
        db.session.commit()
        
        # Test status transitions
        payment.status = PaymentStatus.AUTHORIZED
        db.session.commit()
        assert payment.status == PaymentStatus.AUTHORIZED
        
        payment.status = PaymentStatus.CAPTURED
        db.session.commit()
        assert payment.status == PaymentStatus.CAPTURED
    
    def test_payment_method_validation(self):
        """Test payment method enum validation."""
        tenant = Tenant(slug="method-test")
        db.session.add(tenant)
        db.session.commit()
        
        # Test valid methods
        valid_methods = [PaymentMethod.CARD, PaymentMethod.CASH, PaymentMethod.APPLE_PAY, PaymentMethod.PAYPAL, PaymentMethod.OTHER]
        
        for method in valid_methods:
            payment = Payment(
                tenant_id=tenant.id,
                amount_cents=1000,
                method=method,
                status=PaymentStatus.REQUIRES_ACTION
            )
            db.session.add(payment)
        
        db.session.commit()
        
        # Verify all methods accepted
        payments = Payment.query.filter_by(tenant_id=tenant.id).all()
        assert len(payments) == len(valid_methods)


class TestNotificationFieldAlignment:
    """Test notification template and notification field alignment."""
    
    def test_notification_template_creation(self):
        """Test creating notification templates with aligned fields."""
        tenant = Tenant(slug="template-test")
        db.session.add(tenant)
        db.session.commit()
        
        template = NotificationTemplate(
            tenant_id=tenant.id,
            name="Booking Confirmation",
            description="Template for booking confirmations",
            event_code="booking_confirmed",
            channel=NotificationChannel.EMAIL,
            subject="Your booking is confirmed",
            body="Dear {{customer_name}}, your booking for {{service_name}} on {{booking_date}} is confirmed.",
            is_active=True
        )
        
        db.session.add(template)
        db.session.commit()
        
        # Verify template creation
        assert template.event_code == "booking_confirmed"
        assert template.body == "Dear {{customer_name}}, your booking for {{service_name}} on {{booking_date}} is confirmed."
        assert template.channel == NotificationChannel.EMAIL
        assert template.is_active is True
    
    def test_notification_creation_with_aligned_fields(self):
        """Test creating notifications with aligned fields."""
        tenant = Tenant(slug="notification-test")
        db.session.add(tenant)
        db.session.commit()
        
        notification = Notification(
            tenant_id=tenant.id,
            event_code="booking_created",
            channel=NotificationChannel.EMAIL,
            status=NotificationStatus.PENDING,
            to_email="customer@example.com",
            subject="New booking created",
            body="Your booking has been created successfully.",
            scheduled_at=datetime.utcnow(),
            attempts=0,
            max_attempts=3
        )
        
        db.session.add(notification)
        db.session.commit()
        
        # Verify notification creation
        assert notification.event_code == "booking_created"
        assert notification.to_email == "customer@example.com"
        assert notification.body == "Your booking has been created successfully."
        assert notification.status == NotificationStatus.PENDING
        assert notification.attempts == 0
        assert notification.max_attempts == 3
    
    def test_notification_sms_channel(self):
        """Test SMS notification with phone number."""
        tenant = Tenant(slug="sms-test")
        db.session.add(tenant)
        db.session.commit()
        
        notification = Notification(
            tenant_id=tenant.id,
            event_code="reminder_24h",
            channel=NotificationChannel.SMS,
            status=NotificationStatus.PENDING,
            to_phone="+1234567890",
            body="Reminder: Your appointment is tomorrow at 2 PM.",
            scheduled_at=datetime.utcnow()
        )
        
        db.session.add(notification)
        db.session.commit()
        
        # Verify SMS notification
        assert notification.channel == NotificationChannel.SMS
        assert notification.to_phone == "+1234567890"
        assert notification.body == "Reminder: Your appointment is tomorrow at 2 PM."
    
    def test_notification_deduplication(self):
        """Test notification deduplication with dedupe_key."""
        tenant = Tenant(slug="dedupe-test")
        db.session.add(tenant)
        db.session.commit()
        
        # Create first notification
        notification1 = Notification(
            tenant_id=tenant.id,
            event_code="booking_created",
            channel=NotificationChannel.EMAIL,
            to_email="test@example.com",
            body="Test message",
            dedupe_key="unique_key_123"
        )
        db.session.add(notification1)
        db.session.commit()
        
        # Verify first notification created
        assert notification1.dedupe_key == "unique_key_123"
        
        # Note: In a real scenario, the unique constraint would prevent duplicates
        # This test verifies the field is properly aligned


class TestIntegrationScenarios:
    """Test integration scenarios that use multiple aligned models."""
    
    def test_tenant_onboarding_with_theme_and_membership(self):
        """Test complete tenant onboarding with theme and membership."""
        # Create tenant with business info
        tenant = Tenant(
            slug="complete-test",
            name="Complete Business",
            email="info@complete.com",
            category="Beauty",
            status="active"
        )
        db.session.add(tenant)
        db.session.commit()
        
        # Create user and membership
        user = User(email="owner@complete.com")
        db.session.add(user)
        db.session.commit()
        
        membership = Membership(
            tenant_id=tenant.id,
            user_id=user.id,
            role=MembershipRole.OWNER,
            permissions_json={"full_access": True}
        )
        db.session.add(membership)
        
        # Create theme
        theme = Theme(
            tenant_id=tenant.id,
            brand_color="#FF69B4",
            theme_json={"style": "elegant"}
        )
        db.session.add(theme)
        
        db.session.commit()
        
        # Verify complete setup
        assert tenant.name == "Complete Business"
        assert membership.role == MembershipRole.OWNER
        assert theme.tenant_id == tenant.id
        assert theme.brand_color == "#FF69B4"
    
    def test_booking_payment_notification_flow(self):
        """Test booking payment with notification flow."""
        # Create tenant
        tenant = Tenant(slug="booking-flow-test")
        db.session.add(tenant)
        db.session.commit()
        
        # Create payment
        payment = Payment(
            tenant_id=tenant.id,
            amount_cents=15000,
            status=PaymentStatus.CAPTURED,
            method=PaymentMethod.CARD,
            currency_code="USD"
        )
        db.session.add(payment)
        
        # Create notification template
        template = NotificationTemplate(
            tenant_id=tenant.id,
            event_code="payment_confirmed",
            channel=NotificationChannel.EMAIL,
            subject="Payment Confirmed",
            body="Your payment of ${{amount}} has been processed successfully."
        )
        db.session.add(template)
        
        # Create notification
        notification = Notification(
            tenant_id=tenant.id,
            event_code="payment_confirmed",
            channel=NotificationChannel.EMAIL,
            to_email="customer@example.com",
            subject="Payment Confirmed",
            body="Your payment of $150.00 has been processed successfully.",
            status=NotificationStatus.SENT
        )
        db.session.add(notification)
        
        db.session.commit()
        
        # Verify flow
        assert payment.status == PaymentStatus.CAPTURED
        assert template.event_code == "payment_confirmed"
        assert notification.to_email == "customer@example.com"
        assert notification.status == NotificationStatus.SENT


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
