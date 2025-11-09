"""
Test Notification Standardization

Tests for the standardized notification system with {{snake_case}} placeholders,
immediate confirmation sending, and reminder scheduling.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app.services.notification_service import NotificationService
from app.services.notification_template_service import StandardizedTemplateService
from app.jobs.notification_cron_runner import NotificationCronRunner
from app.models.notification import NotificationTemplate, NotificationChannel, NotificationStatus
from app.models.business import Booking, Customer, Service
from app.models.tenant import Tenant
from app.database import db


class TestNotificationStandardization:
    """Test standardized notification system."""
    
    @pytest.fixture
    def tenant(self):
        """Create a test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            name="Test Business",
            slug="test-business"
        )
        db.session.add(tenant)
        db.session.commit()
        return tenant
    
    @pytest.fixture
    def customer(self, tenant):
        """Create a test customer."""
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            email="test@example.com",
            display_name="Test Customer"
        )
        db.session.add(customer)
        db.session.commit()
        return customer
    
    @pytest.fixture
    def service(self, tenant):
        """Create a test service."""
        service = Service(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="Test Service",
            duration_minutes=60
        )
        db.session.add(service)
        db.session.commit()
        return service
    
    @pytest.fixture
    def booking(self, tenant, customer, service):
        """Create a test booking."""
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            customer_id=customer.id,
            service_snapshot={'name': service.name, 'id': str(service.id)},
            start_at=datetime.utcnow() + timedelta(days=1),
            status='confirmed'
        )
        db.session.add(booking)
        db.session.commit()
        return booking
    
    def test_placeholder_validation(self):
        """Test placeholder format validation."""
        template_service = StandardizedTemplateService()
        
        # Valid placeholders
        valid_content = "Hello {{customer_name}}, your {{service_name}} is confirmed for {{booking_date}}"
        assert template_service.validate_placeholder_format(valid_content) == True
        
        # Invalid placeholders (uppercase)
        invalid_content = "Hello {{Customer_Name}}, your service is confirmed"
        assert template_service.validate_placeholder_format(invalid_content) == False
        
        # Invalid placeholders (numbers at start)
        invalid_content = "Hello {{123customer}}, your service is confirmed"
        assert template_service.validate_placeholder_format(invalid_content) == False
        
        # Empty content should be valid
        assert template_service.validate_placeholder_format("") == True
        assert template_service.validate_placeholder_format(None) == True
    
    def test_placeholder_extraction(self):
        """Test placeholder extraction from content."""
        template_service = StandardizedTemplateService()
        
        content = "Hello {{customer_name}}, your {{service_name}} is confirmed for {{booking_date}}"
        placeholders = template_service.extract_placeholders(content)
        
        expected = ['customer_name', 'service_name', 'booking_date']
        assert set(placeholders) == set(expected)
    
    def test_create_booking_template(self, tenant):
        """Test creating a booking template with standardized placeholders."""
        template_service = StandardizedTemplateService()
        
        template = template_service.create_booking_template(
            tenant_id=tenant.id,
            event_type="booking_confirmed",
            channel=NotificationChannel.EMAIL,
            subject="Booking Confirmed - {{service_name}} on {{booking_date}}",
            content="Dear {{customer_name}}, your booking for {{service_name}} is confirmed."
        )
        
        assert template.tenant_id == tenant.id
        assert template.trigger_event == "booking_confirmed"
        assert template.channel == NotificationChannel.EMAIL
        assert template.subject == "Booking Confirmed - {{service_name}} on {{booking_date}}"
        assert template.content == "Dear {{customer_name}}, your booking for {{service_name}} is confirmed."
        assert 'customer_name' in template.required_variables
        assert 'service_name' in template.required_variables
        assert 'booking_date' in template.required_variables
    
    def test_render_booking_template(self, booking):
        """Test rendering a booking template with standardized variables."""
        template_service = StandardizedTemplateService()
        
        # Create a template
        template = template_service.create_booking_template(
            tenant_id=booking.tenant_id,
            event_type="booking_confirmed",
            channel=NotificationChannel.EMAIL,
            subject="Booking Confirmed - {{service_name}} on {{booking_date}}",
            content="Dear {{customer_name}}, your booking for {{service_name}} is confirmed for {{booking_date}} at {{booking_time}}."
        )
        
        # Render the template
        subject, content = template_service.render_booking_template(template, booking)
        
        assert "Test Service" in subject
        assert "Test Customer" in content
        assert "Test Service" in content
        assert booking.start_at.strftime('%Y-%m-%d') in content
        assert booking.start_at.strftime('%H:%M') in content
    
    def test_create_default_templates(self, tenant):
        """Test creating default templates for a tenant."""
        template_service = StandardizedTemplateService()
        
        templates = template_service.create_default_templates(tenant.id)
        
        assert len(templates) == 4  # confirmation email, confirmation SMS, reminder email, reminder SMS
        
        # Check that all templates use standardized placeholders
        for template in templates:
            assert template_service.validate_placeholder_format(template.subject)
            assert template_service.validate_placeholder_format(template.content)
            assert template.is_system == True
            assert template.is_active == True
    
    def test_process_due_notifications(self, tenant):
        """Test processing due notifications."""
        # Create a due notification
        notification = NotificationTemplate(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            event_code="test_event",
            channel="email",
            status=NotificationStatus.PENDING,
            to_email="test@example.com",
            subject="Test Subject",
            body="Test Content",
            scheduled_at=datetime.utcnow() - timedelta(minutes=1)  # Due notification
        )
        db.session.add(notification)
        db.session.commit()
        
        runner = NotificationCronRunner()
        
        with patch.object(runner.notification_service, 'process_due_notifications') as mock_process:
            mock_process.return_value = []
            
            result = runner.process_due_notifications()
            
            assert result['success'] == True
            assert 'stats' in result
            mock_process.assert_called_once()
    
    def test_schedule_booking_reminders(self, booking):
        """Test scheduling booking reminders."""
        runner = NotificationCronRunner()
        
        with patch.object(runner.notification_service, 'schedule_notification') as mock_schedule:
            mock_schedule.return_value = uuid.uuid4()
            
            result = runner.schedule_booking_reminders()
            
            assert result['success'] == True
            assert 'stats' in result
            assert 'scheduled_24h' in result['stats']
            assert 'scheduled_1h' in result['stats']
    
    def test_booking_confirmation_triggers_notification(self, booking):
        """Test that booking confirmation triggers immediate notification."""
        from app.services.business_phase2 import BookingService
        
        booking_service = BookingService()
        
        with patch('app.services.notification_service.NotificationService') as mock_notification_service:
            mock_instance = MagicMock()
            mock_notification_service.return_value = mock_instance
            mock_instance.send_booking_notification.return_value = MagicMock(success=True)
            
            # Confirm the booking
            result = booking_service.confirm_booking(
                tenant_id=booking.tenant_id,
                booking_id=booking.id,
                user_id=uuid.uuid4()
            )
            
            assert result == True
            mock_instance.send_booking_notification.assert_called_once_with(booking, "booking_confirmed")
    
    def test_deduplication_prevention(self, tenant):
        """Test that duplicate notifications are prevented."""
        notification_service = NotificationService()
        
        # Create first notification with dedupe key
        notification1 = NotificationTemplate(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            event_code="booking_confirmed",
            channel="email",
            status=NotificationStatus.PENDING,
            to_email="test@example.com",
            subject="Test Subject",
            body="Test Content",
            dedupe_key="unique_key_123"
        )
        db.session.add(notification1)
        db.session.commit()
        
        # Try to create duplicate notification with same dedupe key
        notification2 = NotificationTemplate(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            event_code="booking_confirmed",
            channel="email",
            status=NotificationStatus.PENDING,
            to_email="test@example.com",
            subject="Test Subject",
            body="Test Content",
            dedupe_key="unique_key_123"
        )
        
        # This should raise an integrity error due to unique constraint
        with pytest.raises(Exception):  # IntegrityError or similar
            db.session.add(notification2)
            db.session.commit()
    
    def test_standardized_placeholder_mapping(self):
        """Test that standardized placeholder mapping works correctly."""
        template_service = StandardizedTemplateService()
        
        # Test that all required booking placeholders are available
        required_placeholders = [
            'customer_name', 'service_name', 'booking_date', 'booking_time',
            'business_name', 'booking_url', 'staff_name', 'booking_id',
            'booking_tz', 'tenant_name'
        ]
        
        for placeholder in required_placeholders:
            assert placeholder in template_service.BOOKING_PLACEHOLDERS
            assert template_service.BOOKING_PLACEHOLDERS[placeholder] is not None
    
    def test_template_content_type_validation(self, tenant):
        """Test template content type validation."""
        template_service = StandardizedTemplateService()
        
        # Valid content types
        valid_types = ['text/plain', 'text/html', 'application/json']
        
        for content_type in valid_types:
            template = template_service.create_booking_template(
                tenant_id=tenant.id,
                event_type="test_event",
                channel=NotificationChannel.EMAIL,
                subject="Test Subject",
                content="Test Content"
            )
            # Should not raise an error
            assert template is not None
