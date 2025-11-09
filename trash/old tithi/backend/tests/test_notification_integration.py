"""
Comprehensive Test Suite for Notification Integration

This module tests the complete notification system including SMS, email, and push notifications.
Aligned with Design Brief Module J - Notifications & Communication.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.notification import (
    Notification, NotificationTemplate, NotificationPreference, 
    NotificationLog, NotificationQueue, NotificationChannel, 
    NotificationStatus, NotificationPriority
)
from app.services.notification import (
    NotificationTemplateService, NotificationService, 
    NotificationPreferenceService, NotificationQueueService
)
from app.exceptions import TithiError


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
def tenant_id():
    """Create test tenant ID."""
    return str(uuid.uuid4())


@pytest.fixture
def customer_id():
    """Create test customer ID."""
    return str(uuid.uuid4())


@pytest.fixture
def booking_id():
    """Create test booking ID."""
    return str(uuid.uuid4())


@pytest.fixture
def payment_id():
    """Create test payment ID."""
    return str(uuid.uuid4())


@pytest.fixture
def template_service():
    """Create template service."""
    return NotificationTemplateService()


@pytest.fixture
def notification_service():
    """Create notification service."""
    return NotificationService()


@pytest.fixture
def preference_service():
    """Create preference service."""
    return NotificationPreferenceService()


@pytest.fixture
def queue_service():
    """Create queue service."""
    return NotificationQueueService()


class TestNotificationTemplateService:
    """Test cases for NotificationTemplateService."""
    
    def test_create_template_success(self, app, template_service, tenant_id):
        """Test successful template creation."""
        with app.app_context():
            template = template_service.create_template(
                tenant_id=tenant_id,
                name="Booking Confirmation",
                description="Email template for booking confirmations",
                channel="email",
                subject="Booking Confirmed - {{booking_id}}",
                content="Hello {{customer_name}}, your booking for {{service_name}} on {{booking_date}} has been confirmed.",
                content_type="text/html",
                trigger_event="booking_confirmed",
                category="booking",
                variables={"customer_name": "string", "service_name": "string", "booking_date": "string"},
                required_variables=["customer_name", "service_name", "booking_date"]
            )
            
            assert template is not None
            assert template.name == "Booking Confirmation"
            assert template.channel == "email"
            assert template.subject == "Booking Confirmed - {{booking_id}}"
            assert template.content == "Hello {{customer_name}}, your booking for {{service_name}} on {{booking_date}} has been confirmed."
            assert template.content_type == "text/html"
            assert template.trigger_event == "booking_confirmed"
            assert template.category == "booking"
            assert template.is_active is True
            assert template.is_system is False
    
    def test_create_template_invalid_channel(self, app, template_service, tenant_id):
        """Test template creation with invalid channel fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                template_service.create_template(
                    tenant_id=tenant_id,
                    name="Test Template",
                    channel="invalid",
                    subject="Test Subject",
                    content="Test Content"
                )
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_INVALID_CHANNEL"
    
    def test_create_template_invalid_syntax(self, app, template_service, tenant_id):
        """Test template creation with invalid Jinja2 syntax fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                template_service.create_template(
                    tenant_id=tenant_id,
                    name="Test Template",
                    channel="email",
                    subject="Test Subject",
                    content="Hello {{customer_name"  # Missing closing brace
                )
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_INVALID_TEMPLATE"
    
    def test_get_template_by_name(self, app, template_service, tenant_id):
        """Test getting template by name."""
        with app.app_context():
            # Create template
            template = template_service.create_template(
                tenant_id=tenant_id,
                name="Test Template",
                channel="email",
                subject="Test Subject",
                content="Test Content"
            )
            
            # Get template by name
            found_template = template_service.get_template_by_name(tenant_id, "Test Template")
            
            assert found_template is not None
            assert found_template.id == template.id
            assert found_template.name == "Test Template"
    
    def test_get_template_by_trigger(self, app, template_service, tenant_id):
        """Test getting template by trigger event and channel."""
        with app.app_context():
            # Create template
            template = template_service.create_template(
                tenant_id=tenant_id,
                name="Booking Template",
                channel="email",
                subject="Booking Subject",
                content="Booking Content",
                trigger_event="booking_confirmed"
            )
            
            # Get template by trigger
            found_template = template_service.get_template_by_trigger(tenant_id, "booking_confirmed", "email")
            
            assert found_template is not None
            assert found_template.id == template.id
            assert found_template.trigger_event == "booking_confirmed"
    
    def test_render_template_success(self, app, template_service, tenant_id):
        """Test successful template rendering."""
        with app.app_context():
            # Create template
            template = template_service.create_template(
                tenant_id=tenant_id,
                name="Test Template",
                channel="email",
                subject="Hello {{name}}",
                content="Welcome {{name}}, your booking {{booking_id}} is confirmed.",
                required_variables=["name", "booking_id"]
            )
            
            # Render template
            variables = {"name": "John Doe", "booking_id": "BK123"}
            subject, content = template_service.render_template(template, variables)
            
            assert subject == "Hello John Doe"
            assert content == "Welcome John Doe, your booking BK123 is confirmed."
    
    def test_render_template_missing_variables(self, app, template_service, tenant_id):
        """Test template rendering with missing required variables fails."""
        with app.app_context():
            # Create template
            template = template_service.create_template(
                tenant_id=tenant_id,
                name="Test Template",
                channel="email",
                subject="Hello {{name}}",
                content="Welcome {{name}}",
                required_variables=["name", "email"]
            )
            
            # Try to render with missing variables
            with pytest.raises(TithiError) as exc_info:
                template_service.render_template(template, {"name": "John Doe"})
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_MISSING_VARIABLES"
            assert "email" in exc_info.value.message


class TestNotificationService:
    """Test cases for NotificationService."""
    
    def test_create_notification_success(self, app, notification_service, tenant_id, customer_id):
        """Test successful notification creation."""
        with app.app_context():
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                recipient_name="Test Customer",
                subject="Test Subject",
                content="Test notification content",
                priority="normal"
            )
            
            assert notification is not None
            assert notification.channel == "email"
            assert notification.recipient_type == "customer"
            assert notification.recipient_id == customer_id
            assert notification.recipient_email == "test@example.com"
            assert notification.recipient_name == "Test Customer"
            assert notification.subject == "Test Subject"
            assert notification.content == "Test notification content"
            assert notification.priority == "normal"
            assert notification.status == NotificationStatus.PENDING
    
    def test_create_notification_invalid_channel(self, app, notification_service, tenant_id):
        """Test notification creation with invalid channel fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                notification_service.create_notification(
                    tenant_id=tenant_id,
                    channel="invalid",
                    recipient_type="customer",
                    content="Test content"
                )
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_INVALID_CHANNEL"
    
    def test_create_notification_missing_email(self, app, notification_service, tenant_id):
        """Test email notification creation without email address fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                notification_service.create_notification(
                    tenant_id=tenant_id,
                    channel="email",
                    recipient_type="customer",
                    content="Test content"
                )
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_MISSING_EMAIL"
    
    def test_create_notification_missing_phone(self, app, notification_service, tenant_id):
        """Test SMS notification creation without phone number fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                notification_service.create_notification(
                    tenant_id=tenant_id,
                    channel="sms",
                    recipient_type="customer",
                    content="Test content"
                )
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_MISSING_PHONE"
    
    def test_create_notification_missing_content(self, app, notification_service, tenant_id):
        """Test notification creation without content fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                notification_service.create_notification(
                    tenant_id=tenant_id,
                    channel="email",
                    recipient_type="customer",
                    recipient_email="test@example.com"
                )
            
            assert exc_info.value.error_code == "TITHI_NOTIFICATION_MISSING_CONTENT"
    
    def test_create_notification_with_template(self, app, notification_service, template_service, tenant_id, customer_id):
        """Test notification creation with template."""
        with app.app_context():
            # Create template
            template = template_service.create_template(
                tenant_id=tenant_id,
                name="Test Template",
                channel="email",
                subject="Hello {{name}}",
                content="Welcome {{name}}, your booking {{booking_id}} is confirmed.",
                required_variables=["name", "booking_id"]
            )
            
            # Create notification with template
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                template_id=template.id,
                template_variables={"name": "John Doe", "booking_id": "BK123"}
            )
            
            assert notification is not None
            assert notification.template_id == template.id
            assert notification.subject == "Hello John Doe"
            assert notification.content == "Welcome John Doe, your booking BK123 is confirmed."
    
    def test_send_notification_success(self, app, notification_service, tenant_id, customer_id):
        """Test successful notification sending."""
        with app.app_context():
            # Create notification
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content"
            )
            
            # Mock the send methods
            with patch.object(notification_service, '_send_email') as mock_send_email:
                mock_send_email.return_value = (True, "email_123", {"status": "sent"})
                
                # Send notification
                success = notification_service.send_notification(notification.id)
                
                assert success is True
                mock_send_email.assert_called_once_with(notification)
                
                # Check notification status updated
                db.session.refresh(notification)
                assert notification.status == NotificationStatus.SENT
                assert notification.sent_at is not None
                assert notification.provider_message_id == "email_123"
    
    def test_send_notification_failed(self, app, notification_service, tenant_id, customer_id):
        """Test notification sending failure."""
        with app.app_context():
            # Create notification
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content"
            )
            
            # Mock the send method to fail
            with patch.object(notification_service, '_send_email') as mock_send_email:
                mock_send_email.return_value = (False, None, {"error": "Send failed"})
                
                # Send notification
                success = notification_service.send_notification(notification.id)
                
                assert success is False
                
                # Check notification status updated
                db.session.refresh(notification)
                assert notification.status == NotificationStatus.FAILED
                assert notification.failed_at is not None
                assert notification.failure_reason == "Send failed"
    
    def test_send_notification_expired(self, app, notification_service, tenant_id, customer_id):
        """Test sending expired notification fails."""
        with app.app_context():
            # Create expired notification
            past_time = datetime.utcnow() - timedelta(hours=1)
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content",
                expires_at=past_time
            )
            
            # Try to send expired notification
            success = notification_service.send_notification(notification.id)
            
            assert success is False
            
            # Check notification status updated
            db.session.refresh(notification)
            assert notification.status == NotificationStatus.FAILED
            assert "expired" in notification.failure_reason
    
    def test_get_notification_status(self, app, notification_service, tenant_id, customer_id):
        """Test getting notification status."""
        with app.app_context():
            # Create notification
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content"
            )
            
            # Get status
            status = notification_service.get_notification_status(notification.id)
            
            assert status["id"] == str(notification.id)
            assert status["status"] == "pending"
            assert status["channel"] == "email"
            assert status["recipient_type"] == "customer"
    
    def test_get_notification_logs(self, app, notification_service, tenant_id, customer_id):
        """Test getting notification logs."""
        with app.app_context():
            # Create notification
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content"
            )
            
            # Send notification to create logs
            with patch.object(notification_service, '_send_email') as mock_send_email:
                mock_send_email.return_value = (True, "email_123", {"status": "sent"})
                notification_service.send_notification(notification.id)
            
            # Get logs
            logs = notification_service.get_notification_logs(notification.id)
            
            assert len(logs) >= 1
            assert logs[0]["event_type"] == "sent"


class TestNotificationPreferenceService:
    """Test cases for NotificationPreferenceService."""
    
    def test_get_preferences_default(self, app, preference_service, tenant_id, customer_id):
        """Test getting default preferences."""
        with app.app_context():
            preferences = preference_service.get_preferences(tenant_id, "customer", customer_id)
            
            assert preferences is not None
            assert preferences.user_type == "customer"
            assert preferences.user_id == customer_id
            assert preferences.email_enabled is True
            assert preferences.sms_enabled is True
            assert preferences.push_enabled is True
            assert preferences.booking_notifications is True
            assert preferences.payment_notifications is True
            assert preferences.promotion_notifications is True
            assert preferences.system_notifications is True
            assert preferences.marketing_notifications is False
            assert preferences.digest_frequency == "immediate"
    
    def test_update_preferences(self, app, preference_service, tenant_id, customer_id):
        """Test updating preferences."""
        with app.app_context():
            # Update preferences
            preferences = preference_service.update_preferences(
                tenant_id, "customer", customer_id,
                email_enabled=False,
                marketing_notifications=True,
                digest_frequency="daily"
            )
            
            assert preferences.email_enabled is False
            assert preferences.marketing_notifications is True
            assert preferences.digest_frequency == "daily"
    
    def test_can_send_notification_allowed(self, app, preference_service, tenant_id, customer_id):
        """Test notification sending when allowed by preferences."""
        with app.app_context():
            can_send = preference_service.can_send_notification(
                tenant_id, "customer", customer_id, "email", "booking"
            )
            
            assert can_send is True
    
    def test_can_send_notification_disabled_channel(self, app, preference_service, tenant_id, customer_id):
        """Test notification sending when channel is disabled."""
        with app.app_context():
            # Disable email notifications
            preference_service.update_preferences(
                tenant_id, "customer", customer_id,
                email_enabled=False
            )
            
            can_send = preference_service.can_send_notification(
                tenant_id, "customer", customer_id, "email", "booking"
            )
            
            assert can_send is False
    
    def test_can_send_notification_disabled_category(self, app, preference_service, tenant_id, customer_id):
        """Test notification sending when category is disabled."""
        with app.app_context():
            # Disable booking notifications
            preference_service.update_preferences(
                tenant_id, "customer", customer_id,
                booking_notifications=False
            )
            
            can_send = preference_service.can_send_notification(
                tenant_id, "customer", customer_id, "email", "booking"
            )
            
            assert can_send is False


class TestNotificationQueueService:
    """Test cases for NotificationQueueService."""
    
    def test_process_notification_success(self, app, queue_service, notification_service, tenant_id, customer_id):
        """Test successful notification processing."""
        with app.app_context():
            # Create notification
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content"
            )
            
            # Get queue item
            queue_item = queue_service.db.query(NotificationQueue).filter(
                NotificationQueue.notification_id == notification.id
            ).first()
            
            assert queue_item is not None
            assert queue_item.status == "queued"
            
            # Mock the send method
            with patch.object(notification_service, 'send_notification') as mock_send:
                mock_send.return_value = True
                
                # Process notification
                success = queue_service.process_notification(queue_item)
                
                assert success is True
                
                # Check queue item status updated
                db.session.refresh(queue_item)
                assert queue_item.status == "completed"
                assert queue_item.processing_started_at is not None
                assert queue_item.processing_completed_at is not None
    
    def test_process_notification_failed(self, app, queue_service, notification_service, tenant_id, customer_id):
        """Test notification processing failure."""
        with app.app_context():
            # Create notification
            notification = notification_service.create_notification(
                tenant_id=tenant_id,
                channel="email",
                recipient_type="customer",
                recipient_id=customer_id,
                recipient_email="test@example.com",
                subject="Test Subject",
                content="Test notification content"
            )
            
            # Get queue item
            queue_item = queue_service.db.query(NotificationQueue).filter(
                NotificationQueue.notification_id == notification.id
            ).first()
            
            # Mock the send method to fail
            with patch.object(notification_service, 'send_notification') as mock_send:
                mock_send.return_value = False
                
                # Process notification
                success = queue_service.process_notification(queue_item)
                
                assert success is False
                
                # Check queue item status updated
                db.session.refresh(queue_item)
                assert queue_item.status == "failed"
                assert queue_item.error_message == "Notification send failed"
    
    def test_process_queue(self, app, queue_service, notification_service, tenant_id, customer_id):
        """Test processing notification queue."""
        with app.app_context():
            # Create multiple notifications
            for i in range(3):
                notification = notification_service.create_notification(
                    tenant_id=tenant_id,
                    channel="email",
                    recipient_type="customer",
                    recipient_id=customer_id,
                    recipient_email=f"test{i}@example.com",
                    subject=f"Test Subject {i}",
                    content=f"Test notification content {i}"
                )
            
            # Mock the send method
            with patch.object(notification_service, 'send_notification') as mock_send:
                mock_send.return_value = True
                
                # Process queue
                result = queue_service.process_queue(limit=10)
                
                assert result["processed"] == 3
                assert result["successful"] == 3
                assert result["failed"] == 0


class TestNotificationAPI:
    """Test cases for Notification API endpoints."""
    
    def test_create_template_api(self, client, app):
        """Test template creation via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.json = {
                        "name": "Test Template",
                        "description": "Test template description",
                        "channel": "email",
                        "subject": "Test Subject",
                        "content": "Test Content",
                        "content_type": "text/plain"
                    }
                    
                    response = client.post('/api/notifications/templates')
                    assert response.status_code == 201
                    
                    data = response.get_json()
                    assert data["name"] == "Test Template"
                    assert data["channel"] == "email"
                    assert data["subject"] == "Test Subject"
                    assert data["content"] == "Test Content"
    
    def test_create_notification_api(self, client, app):
        """Test notification creation via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.json = {
                        "channel": "email",
                        "recipient_type": "customer",
                        "recipient_email": "test@example.com",
                        "subject": "Test Subject",
                        "content": "Test notification content"
                    }
                    
                    response = client.post('/api/notifications/notifications')
                    assert response.status_code == 201
                    
                    data = response.get_json()
                    assert data["channel"] == "email"
                    assert data["recipient_type"] == "customer"
                    assert data["recipient_email"] == "test@example.com"
                    assert data["subject"] == "Test Subject"
                    assert data["content"] == "Test notification content"
    
    def test_get_preferences_api(self, client, app):
        """Test getting preferences via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.args = {"user_type": "customer", "user_id": str(uuid.uuid4())}
                    
                    response = client.get('/api/notifications/preferences')
                    assert response.status_code == 200
                    
                    data = response.get_json()
                    assert data["user_type"] == "customer"
                    assert data["email_enabled"] is True
                    assert data["sms_enabled"] is True
                    assert data["push_enabled"] is True


if __name__ == '__main__':
    pytest.main([__file__])
