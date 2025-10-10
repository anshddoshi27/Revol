"""
Email Service Tests

This module provides comprehensive tests for the email notification service.
Tests cover SendGrid integration, tenant branding, template rendering, and error handling.

Aligned with Task 7.1: Email Notifications requirements.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from flask import Flask

from app.services.email_service import (
    EmailService, EmailRequest, EmailPriority, EmailResult,
    SendGridClient, TenantBrandingService, EmailTemplateService
)
from app.models.notification import Notification, NotificationTemplate, NotificationLog
from app.models.business import Booking, Customer, Service, StaffProfile
from app.models.core import Tenant, Theme
from app.exceptions import TithiError


class TestSendGridClient:
    """Test SendGrid client functionality."""
    
    def test_send_email_success(self):
        """Test successful email sending."""
        client = SendGridClient("test_key", "test@example.com", "Test Sender")
        
        with patch('requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 202
            mock_response.headers = {'X-Message-Id': 'test_message_id'}
            mock_post.return_value = mock_response
            
            result = client.send_email(
                to_email="recipient@example.com",
                to_name="Test Recipient",
                subject="Test Subject",
                html_content="<p>Test content</p>"
            )
            
            assert result["success"] is True
            assert result["message_id"] == "test_message_id"
            assert result["status_code"] == 202
    
    def test_send_email_failure(self):
        """Test email sending failure."""
        client = SendGridClient("test_key", "test@example.com", "Test Sender")
        
        with patch('requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 400
            mock_response.json.return_value = {
                "errors": [{"message": "Invalid email address"}]
            }
            mock_post.return_value = mock_response
            
            result = client.send_email(
                to_email="invalid@example.com",
                to_name="Test Recipient",
                subject="Test Subject",
                html_content="<p>Test content</p>"
            )
            
            assert result["success"] is False
            assert "Invalid email address" in result["error"]
            assert result["status_code"] == 400
    
    def test_send_email_with_template(self):
        """Test email sending with template."""
        client = SendGridClient("test_key", "test@example.com", "Test Sender")
        
        with patch('requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 202
            mock_response.headers = {'X-Message-Id': 'test_message_id'}
            mock_post.return_value = mock_response
            
            result = client.send_email(
                to_email="recipient@example.com",
                to_name="Test Recipient",
                subject="Test Subject",
                html_content="<p>Test content</p>",
                template_id="template_123",
                dynamic_template_data={"name": "Test User"}
            )
            
            assert result["success"] is True
            mock_post.assert_called_once()
            call_args = mock_post.call_args[1]['json']
            assert call_args['template_id'] == "template_123"
            assert call_args['personalizations'][0]['dynamic_template_data'] == {"name": "Test User"}


class TestTenantBrandingService:
    """Test tenant branding service."""
    
    def test_get_tenant_branding_with_theme(self):
        """Test getting tenant branding with theme."""
        # Mock tenant and theme
        tenant = Mock()
        tenant.slug = "test-salon"
        tenant.name = "Test Salon"
        
        theme = Mock()
        theme.brand_color = "#FF0000"
        theme.logo_url = "https://example.com/logo.png"
        theme.metadata_json = {
            "website_url": "https://testsalon.com",
            "support_email": "support@testsalon.com",
            "phone": "+1234567890",
            "address": "123 Main St"
        }
        
        with patch('app.services.email_service.Tenant.query') as mock_tenant_query, \
             patch('app.services.email_service.Theme.query') as mock_theme_query:
            
            mock_tenant_query.get.return_value = tenant
            mock_theme_query.filter_by.return_value.first.return_value = theme
            
            service = TenantBrandingService()
            branding = service.get_tenant_branding(uuid.uuid4())
            
            assert branding["tenant_name"] == "Test Salon"
            assert branding["tenant_slug"] == "test-salon"
            assert branding["primary_color"] == "#FF0000"
            assert branding["logo_url"] == "https://example.com/logo.png"
            assert branding["website_url"] == "https://testsalon.com"
            assert branding["support_email"] == "support@testsalon.com"
            assert branding["phone"] == "+1234567890"
            assert branding["address"] == "123 Main St"
    
    def test_get_tenant_branding_without_theme(self):
        """Test getting tenant branding without theme."""
        tenant = Mock()
        tenant.slug = "test-salon"
        
        with patch('app.services.email_service.Tenant.query') as mock_tenant_query, \
             patch('app.services.email_service.Theme.query') as mock_theme_query:
            
            mock_tenant_query.get.return_value = tenant
            mock_theme_query.filter_by.return_value.first.return_value = None
            
            service = TenantBrandingService()
            branding = service.get_tenant_branding(uuid.uuid4())
            
            assert branding["tenant_name"] == "Your Business"
            assert branding["tenant_slug"] == "test-salon"
            assert branding["primary_color"] == "#000000"
            assert branding["secondary_color"] == "#FFFFFF"
    
    def test_get_tenant_branding_tenant_not_found(self):
        """Test getting tenant branding when tenant not found."""
        with patch('app.services.email_service.Tenant.query') as mock_tenant_query:
            mock_tenant_query.get.return_value = None
            
            service = TenantBrandingService()
            
            with pytest.raises(TithiError) as exc_info:
                service.get_tenant_branding(uuid.uuid4())
            
            assert exc_info.value.error_code == "TITHI_TENANT_NOT_FOUND"
    
    def test_apply_branding_to_template(self):
        """Test applying branding to email template."""
        template_content = """
        <h1>{{tenant_name}}</h1>
        <p>Visit us at {{website_url}}</p>
        <p>Contact: {{support_email}}</p>
        """
        
        branding = {
            "tenant_name": "Test Salon",
            "website_url": "https://testsalon.com",
            "support_email": "support@testsalon.com"
        }
        
        service = TenantBrandingService()
        result = service.apply_branding_to_template(template_content, branding)
        
        assert "Test Salon" in result
        assert "https://testsalon.com" in result
        assert "support@testsalon.com" in result
        assert "{{tenant_name}}" not in result


class TestEmailTemplateService:
    """Test email template service."""
    
    def test_get_template(self):
        """Test getting email template."""
        template = Mock()
        template.content = "<p>Test template</p>"
        template.subject = "Test Subject"
        
        with patch('app.services.email_service.NotificationTemplate.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = template
            
            service = EmailTemplateService()
            result = service.get_template(uuid.uuid4(), "booking_confirmation")
            
            assert result == template
    
    def test_get_default_template(self):
        """Test getting default template."""
        service = EmailTemplateService()
        
        # Test booking confirmation template
        template = service.get_default_template("booking_confirmation")
        assert "Booking Confirmation" in template
        assert "{{customer_name}}" in template
        assert "{{service_name}}" in template
        
        # Test unknown event template
        template = service.get_default_template("unknown_event")
        assert "Notification" in template
    
    def test_render_template(self):
        """Test template rendering with variables and branding."""
        template_content = """
        <h1>{{tenant_name}}</h1>
        <p>Hello {{customer_name}},</p>
        <p>Your {{service_name}} appointment is confirmed.</p>
        """
        
        variables = {
            "customer_name": "John Doe",
            "service_name": "Haircut"
        }
        
        with patch('app.services.email_service.TenantBrandingService.get_tenant_branding') as mock_branding:
            mock_branding.return_value = {
                "tenant_name": "Test Salon",
                "primary_color": "#FF0000"
            }
            
            service = EmailTemplateService()
            subject, content = service.render_template(template_content, variables, uuid.uuid4())
            
            assert "Test Salon" in content
            assert "John Doe" in content
            assert "Haircut" in content
            assert "{{customer_name}}" not in content


class TestEmailService:
    """Test main email service."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        
        with self.app.app_context():
            from app.extensions import db
            db.init_app(self.app)
            db.create_all()
    
    def test_send_email_success(self):
        """Test successful email sending."""
        with self.app.app_context():
            with patch('app.services.email_service.SendGridClient') as mock_client_class, \
                 patch('app.services.email_service.QuotaService') as mock_quota_service:
                
                # Mock SendGrid client
                mock_client = Mock()
                mock_client.send_email.return_value = {
                    "success": True,
                    "message_id": "test_message_id"
                }
                mock_client_class.return_value = mock_client
                
                # Mock quota service
                mock_quota_service.return_value.check_and_increment.return_value = None
                
                # Mock template service
                with patch('app.services.email_service.EmailTemplateService.render_template') as mock_render:
                    mock_render.return_value = ("Test Subject", "<p>Test content</p>")
                    
                    service = EmailService()
                    request = EmailRequest(
                        tenant_id=uuid.uuid4(),
                        event_code="test_event",
                        recipient_email="test@example.com",
                        recipient_name="Test User"
                    )
                    
                    result = service.send_email(request)
                    
                    assert result.success is True
                    assert result.provider_message_id == "test_message_id"
                    assert result.notification_id is not None
    
    def test_send_email_quota_exceeded(self):
        """Test email sending with quota exceeded."""
        with self.app.app_context():
            with patch('app.services.email_service.QuotaService') as mock_quota_service:
                # Mock quota service to raise exception
                mock_quota_service.return_value.check_and_increment.side_effect = TithiError(
                    "TITHI_QUOTA_EXCEEDED", "Daily notification limit exceeded"
                )
                
                service = EmailService()
                request = EmailRequest(
                    tenant_id=uuid.uuid4(),
                    event_code="test_event",
                    recipient_email="test@example.com"
                )
                
                result = service.send_email(request)
                
                assert result.success is False
                assert "quota" in result.error_message.lower()
    
    def test_send_email_sendgrid_failure(self):
        """Test email sending with SendGrid failure."""
        with self.app.app_context():
            with patch('app.services.email_service.SendGridClient') as mock_client_class, \
                 patch('app.services.email_service.QuotaService') as mock_quota_service:
                
                # Mock SendGrid client to return failure
                mock_client = Mock()
                mock_client.send_email.return_value = {
                    "success": False,
                    "error": "SendGrid API error"
                }
                mock_client_class.return_value = mock_client
                
                # Mock quota service
                mock_quota_service.return_value.check_and_increment.return_value = None
                
                # Mock template service
                with patch('app.services.email_service.EmailTemplateService.render_template') as mock_render:
                    mock_render.return_value = ("Test Subject", "<p>Test content</p>")
                    
                    service = EmailService()
                    request = EmailRequest(
                        tenant_id=uuid.uuid4(),
                        event_code="test_event",
                        recipient_email="test@example.com"
                    )
                    
                    result = service.send_email(request)
                    
                    assert result.success is False
                    assert "SendGrid API error" in result.error_message
    
    def test_send_booking_email(self):
        """Test sending booking email."""
        with self.app.app_context():
            # Create test data
            tenant_id = uuid.uuid4()
            customer_id = uuid.uuid4()
            booking_id = uuid.uuid4()
            
            customer = Customer(
                id=customer_id,
                tenant_id=tenant_id,
                display_name="John Doe",
                email="john@example.com"
            )
            
            booking = Booking(
                id=booking_id,
                tenant_id=tenant_id,
                customer_id=customer_id,
                start_at=datetime.utcnow() + timedelta(days=1),
                booking_tz="UTC",
                service_snapshot={"name": "Haircut", "id": str(uuid.uuid4())},
                resource_id=uuid.uuid4()
            )
            
            with patch('app.services.email_service.Customer.query') as mock_customer_query, \
                 patch('app.services.email_service.StaffProfile.query') as mock_staff_query, \
                 patch('app.services.email_service.EmailService.send_email') as mock_send_email:
                
                mock_customer_query.get.return_value = customer
                mock_staff_query.filter_by.return_value.first.return_value = None
                mock_send_email.return_value = EmailResult(success=True)
                
                service = EmailService()
                result = service.send_booking_email(booking, "booking_confirmation")
                
                assert result.success is True
                mock_send_email.assert_called_once()
                
                # Check that the email request has correct variables
                call_args = mock_send_email.call_args[0][0]
                assert call_args.tenant_id == tenant_id
                assert call_args.event_code == "booking_confirmation"
                assert call_args.recipient_email == "john@example.com"
                assert call_args.variables["customer_name"] == "John Doe"
                assert call_args.variables["service_name"] == "Haircut"
    
    def test_send_booking_email_no_customer_email(self):
        """Test sending booking email when customer has no email."""
        with self.app.app_context():
            customer = Mock()
            customer.email = None
            
            booking = Mock()
            booking.customer_id = uuid.uuid4()
            
            with patch('app.services.email_service.Customer.query') as mock_customer_query:
                mock_customer_query.get.return_value = customer
                
                service = EmailService()
                result = service.send_booking_email(booking, "booking_confirmation")
                
                assert result.success is False
                assert "email not found" in result.error_message.lower()
    
    def test_get_email_stats(self):
        """Test getting email statistics."""
        with self.app.app_context():
            tenant_id = uuid.uuid4()
            
            # Create test notifications
            notification1 = Notification(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                channel="email",
                status="sent",
                created_at=datetime.utcnow()
            )
            
            notification2 = Notification(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                channel="email",
                status="failed",
                created_at=datetime.utcnow()
            )
            
            with patch('app.services.email_service.db.session.query') as mock_query:
                mock_query.return_value.filter.return_value.group_by.return_value.all.return_value = [
                    ("sent", 1),
                    ("failed", 1)
                ]
                
                service = EmailService()
                stats = service.get_email_stats(
                    tenant_id,
                    datetime.utcnow() - timedelta(days=30),
                    datetime.utcnow()
                )
                
                assert stats["total_sent"] == 1
                assert stats["total_failed"] == 1
                assert stats["delivery_rate"] == 0.5
                assert "sent" in stats["by_status"]
                assert "failed" in stats["by_status"]


class TestEmailServiceIntegration:
    """Integration tests for email service."""
    
    def test_end_to_end_email_flow(self):
        """Test complete email flow from request to delivery."""
        with patch('app.services.email_service.SendGridClient') as mock_client_class, \
             patch('app.services.email_service.QuotaService') as mock_quota_service, \
             patch('app.services.email_service.EmailTemplateService.render_template') as mock_render:
            
            # Mock SendGrid success
            mock_client = Mock()
            mock_client.send_email.return_value = {
                "success": True,
                "message_id": "sg_test_123"
            }
            mock_client_class.return_value = mock_client
            
            # Mock quota service
            mock_quota_service.return_value.check_and_increment.return_value = None
            
            # Mock template rendering
            mock_render.return_value = ("Booking Confirmation", "<p>Your booking is confirmed!</p>")
            
            service = EmailService()
            request = EmailRequest(
                tenant_id=uuid.uuid4(),
                event_code="booking_confirmation",
                recipient_email="customer@example.com",
                recipient_name="John Doe",
                variables={
                    "customer_name": "John Doe",
                    "service_name": "Haircut",
                    "booking_date": "2025-01-28",
                    "booking_time": "10:00"
                }
            )
            
            result = service.send_email(request)
            
            assert result.success is True
            assert result.provider_message_id == "sg_test_123"
            assert result.notification_id is not None
            
            # Verify SendGrid was called with correct parameters
            mock_client.send_email.assert_called_once()
            call_args = mock_client.send_email.call_args
            assert call_args[1]['to_email'] == "customer@example.com"
            assert call_args[1]['to_name'] == "John Doe"
            assert call_args[1]['subject'] == "Booking Confirmation"
            assert "<p>Your booking is confirmed!</p>" in call_args[1]['html_content']


class TestEmailServiceErrorHandling:
    """Test error handling in email service."""
    
    def test_sendgrid_configuration_missing(self):
        """Test error when SendGrid configuration is missing."""
        with patch('app.services.email_service.Config.SENDGRID_API_KEY', None):
            service = EmailService()
            
            with pytest.raises(TithiError) as exc_info:
                service._get_sendgrid_client()
            
            assert exc_info.value.error_code == "TITHI_EMAIL_CONFIG_MISSING"
    
    def test_template_rendering_error(self):
        """Test error handling in template rendering."""
        with patch('app.services.email_service.EmailTemplateService.render_template') as mock_render:
            mock_render.side_effect = Exception("Template rendering failed")
            
            service = EmailService()
            request = EmailRequest(
                tenant_id=uuid.uuid4(),
                event_code="test_event",
                recipient_email="test@example.com"
            )
            
            result = service.send_email(request)
            
            assert result.success is False
            assert "failed" in result.error_message.lower()
    
    def test_database_error_handling(self):
        """Test error handling for database operations."""
        with patch('app.services.email_service.db.session.add') as mock_add:
            mock_add.side_effect = Exception("Database error")
            
            service = EmailService()
            request = EmailRequest(
                tenant_id=uuid.uuid4(),
                event_code="test_event",
                recipient_email="test@example.com"
            )
            
            result = service.send_email(request)
            
            assert result.success is False
            assert "failed" in result.error_message.lower()


if __name__ == "__main__":
    pytest.main([__file__])
