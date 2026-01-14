"""
Email Notification Service

This module provides comprehensive email notification functionality with SendGrid integration,
tenant branding, template management, and reliable delivery with retry logic.

Aligned with Task 7.1: Email Notifications requirements and Tithi's white-label architecture.
"""

import uuid
import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db, celery
from ..models.notification import Notification, NotificationTemplate, NotificationLog
from ..models.business import Booking, Customer, Service, StaffProfile
from ..models.core import Tenant
from ..models.system import Theme
from ..models.audit import EventOutbox
from .quota_service import QuotaService
from ..exceptions import TithiError

logger = logging.getLogger(__name__)


class EmailStatus(Enum):
    """Email delivery status."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"
    COMPLAINED = "complained"


class EmailPriority(Enum):
    """Email priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class EmailRequest:
    """Represents an email notification request."""
    tenant_id: uuid.UUID
    event_code: str
    recipient_email: str
    recipient_name: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    template_id: Optional[uuid.UUID] = None
    variables: Optional[Dict[str, Any]] = None
    priority: EmailPriority = EmailPriority.NORMAL
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    booking_id: Optional[uuid.UUID] = None
    customer_id: Optional[uuid.UUID] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class EmailResult:
    """Result of email delivery."""
    success: bool
    notification_id: Optional[uuid.UUID] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_after: Optional[datetime] = None


class SendGridClient:
    """SendGrid API client for email delivery."""
    
    def __init__(self, api_key: str, from_email: str, from_name: str = "Tithi"):
        self.api_key = api_key
        self.from_email = from_email
        self.from_name = from_name
        self.base_url = "https://api.sendgrid.com/v3"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def send_email(self, to_email: str, to_name: str, subject: str, 
                   html_content: str, text_content: Optional[str] = None,
                   template_id: Optional[str] = None, 
                   dynamic_template_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send email via SendGrid API."""
        
        payload = {
            "personalizations": [{
                "to": [{"email": to_email, "name": to_name}],
                "subject": subject
            }],
            "from": {
                "email": self.from_email,
                "name": self.from_name
            },
            "reply_to": {
                "email": self.from_email,
                "name": self.from_name
            }
        }
        
        # Use template or content
        if template_id:
            payload["template_id"] = template_id
            if dynamic_template_data:
                payload["personalizations"][0]["dynamic_template_data"] = dynamic_template_data
        else:
            payload["content"] = []
            if html_content:
                payload["content"].append({
                    "type": "text/html",
                    "value": html_content
                })
            if text_content:
                payload["content"].append({
                    "type": "text/plain",
                    "value": text_content
                })
        
        # Add tracking settings
        payload["tracking_settings"] = {
            "click_tracking": {"enable": True},
            "open_tracking": {"enable": True},
            "subscription_tracking": {"enable": True}
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/mail/send",
                headers=self.headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 202:
                # Success - extract message ID from headers
                message_id = response.headers.get('X-Message-Id', f"sg_{uuid.uuid4()}")
                return {
                    "success": True,
                    "message_id": message_id,
                    "status_code": response.status_code
                }
            else:
                error_data = response.json() if response.content else {}
                return {
                    "success": False,
                    "error": error_data.get('errors', [{'message': 'Unknown error'}])[0].get('message'),
                    "status_code": response.status_code,
                    "response": error_data
                }
                
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"SendGrid API error: {str(e)}",
                "status_code": None
            }


class TenantBrandingService:
    """Service for managing tenant branding in emails."""
    
    def __init__(self):
        from .system import BrandingService
        self.branding_service = BrandingService()
    
    def get_tenant_branding(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """Get tenant branding information for email templates."""
        try:
            # Use the new BrandingService for consistent branding data
            branding_data = self.branding_service.get_branding_for_email(tenant_id)
            
            # Add additional fields for email templates
            branding_data.update({
                "phone": None,  # Could be added to branding data in future
                "address": None  # Could be added to branding data in future
            })
            
            return branding_data
            
        except Exception as e:
            logger.error(f"Failed to get tenant branding: {str(e)}")
            # Return default branding
            return {
                "tenant_name": "Your Business",
                "tenant_slug": "business",
                "primary_color": "#000000",
                "secondary_color": "#FFFFFF",
                "logo_url": None,
                "favicon_url": None,
                "website_url": "https://business.tithi.com",
                "support_email": "support@business.tithi.com",
                "phone": None,
                "address": None
            }
    
    def apply_branding_to_template(self, template_content: str, branding: Dict[str, Any]) -> str:
        """Apply tenant branding to email template."""
        try:
            # Replace branding placeholders
            branded_content = template_content
            
            # Replace common placeholders
            replacements = {
                "{{tenant_name}}": branding["tenant_name"],
                "{{tenant_slug}}": branding["tenant_slug"],
                "{{primary_color}}": branding["primary_color"],
                "{{secondary_color}}": branding["secondary_color"],
                "{{logo_url}}": branding["logo_url"] or "",
                "{{website_url}}": branding["website_url"],
                "{{support_email}}": branding["support_email"],
                "{{phone}}": branding["phone"] or "",
                "{{address}}": branding["address"] or ""
            }
            
            for placeholder, value in replacements.items():
                branded_content = branded_content.replace(placeholder, str(value))
            
            return branded_content
            
        except Exception as e:
            logger.error(f"Failed to apply branding to template: {str(e)}")
            return template_content


class EmailTemplateService:
    """Service for managing email templates."""
    
    def __init__(self):
        self.branding_service = TenantBrandingService()
    
    def get_template(self, tenant_id: uuid.UUID, event_code: str) -> Optional[NotificationTemplate]:
        """Get email template for event."""
        try:
            return NotificationTemplate.query.filter_by(
                tenant_id=tenant_id,
                trigger_event=event_code,
                channel="email",
                is_active=True
            ).first()
        except Exception as e:
            logger.error(f"Failed to get email template: {str(e)}")
            return None
    
    def get_default_template(self, event_code: str) -> str:
        """Get default email template for event."""
        templates = {
            "booking_confirmation": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: {{primary_color}}; color: {{secondary_color}}; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { background-color: {{primary_color}}; color: {{secondary_color}}; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
        .logo { max-width: 200px; height: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {% if logo_url %}<img src="{{logo_url}}" alt="{{tenant_name}}" class="logo">{% endif %}
            <h1>{{tenant_name}}</h1>
        </div>
        <div class="content">
            <h2>Booking Confirmation</h2>
            <p>Dear {{customer_name}},</p>
            <p>Your booking has been confirmed! Here are the details:</p>
            <ul>
                <li><strong>Service:</strong> {{service_name}}</li>
                <li><strong>Date:</strong> {{booking_date}}</li>
                <li><strong>Time:</strong> {{booking_time}}</li>
                <li><strong>Staff:</strong> {{staff_name}}</li>
                <li><strong>Booking ID:</strong> {{booking_id}}</li>
            </ul>
            <p>We look forward to seeing you!</p>
            <p>If you need to make any changes, please contact us at {{support_email}} or {{phone}}.</p>
        </div>
        <div class="footer">
            <p>{{tenant_name}}<br>
            {{address}}<br>
            {{website_url}}</p>
        </div>
    </div>
</body>
</html>
            """,
            "booking_reminder": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: {{primary_color}}; color: {{secondary_color}}; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .logo { max-width: 200px; height: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {% if logo_url %}<img src="{{logo_url}}" alt="{{tenant_name}}" class="logo">{% endif %}
            <h1>{{tenant_name}}</h1>
        </div>
        <div class="content">
            <h2>Booking Reminder</h2>
            <p>Dear {{customer_name}},</p>
            <p>This is a friendly reminder about your upcoming appointment:</p>
            <ul>
                <li><strong>Service:</strong> {{service_name}}</li>
                <li><strong>Date:</strong> {{booking_date}}</li>
                <li><strong>Time:</strong> {{booking_time}}</li>
                <li><strong>Staff:</strong> {{staff_name}}</li>
            </ul>
            <p>We look forward to seeing you soon!</p>
            <p>If you need to reschedule or cancel, please contact us at {{support_email}} or {{phone}}.</p>
        </div>
        <div class="footer">
            <p>{{tenant_name}}<br>
            {{address}}<br>
            {{website_url}}</p>
        </div>
    </div>
</body>
</html>
            """,
            "booking_cancellation": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Cancelled</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: {{primary_color}}; color: {{secondary_color}}; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .logo { max-width: 200px; height: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {% if logo_url %}<img src="{{logo_url}}" alt="{{tenant_name}}" class="logo">{% endif %}
            <h1>{{tenant_name}}</h1>
        </div>
        <div class="content">
            <h2>Booking Cancelled</h2>
            <p>Dear {{customer_name}},</p>
            <p>Your booking has been cancelled:</p>
            <ul>
                <li><strong>Service:</strong> {{service_name}}</li>
                <li><strong>Date:</strong> {{booking_date}}</li>
                <li><strong>Time:</strong> {{booking_time}}</li>
                <li><strong>Staff:</strong> {{staff_name}}</li>
            </ul>
            <p>We're sorry for any inconvenience. If you'd like to reschedule, please contact us at {{support_email}} or {{phone}}.</p>
        </div>
        <div class="footer">
            <p>{{tenant_name}}<br>
            {{address}}<br>
            {{website_url}}</p>
        </div>
    </div>
</body>
</html>
            """,
            "payment_confirmation": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: {{primary_color}}; color: {{secondary_color}}; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .logo { max-width: 200px; height: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {% if logo_url %}<img src="{{logo_url}}" alt="{{tenant_name}}" class="logo">{% endif %}
            <h1>{{tenant_name}}</h1>
        </div>
        <div class="content">
            <h2>Payment Confirmation</h2>
            <p>Dear {{customer_name}},</p>
            <p>Your payment has been processed successfully:</p>
            <ul>
                <li><strong>Amount:</strong> {{payment_amount}}</li>
                <li><strong>Service:</strong> {{service_name}}</li>
                <li><strong>Date:</strong> {{booking_date}}</li>
                <li><strong>Time:</strong> {{booking_time}}</li>
                <li><strong>Transaction ID:</strong> {{transaction_id}}</li>
            </ul>
            <p>Thank you for your business!</p>
        </div>
        <div class="footer">
            <p>{{tenant_name}}<br>
            {{address}}<br>
            {{website_url}}</p>
        </div>
    </div>
</body>
</html>
            """
        }
        
        return templates.get(event_code, """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: {{primary_color}}; color: {{secondary_color}}; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .logo { max-width: 200px; height: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            {% if logo_url %}<img src="{{logo_url}}" alt="{{tenant_name}}" class="logo">{% endif %}
            <h1>{{tenant_name}}</h1>
        </div>
        <div class="content">
            <h2>Notification</h2>
            <p>{{content}}</p>
        </div>
        <div class="footer">
            <p>{{tenant_name}}<br>
            {{address}}<br>
            {{website_url}}</p>
        </div>
    </div>
</body>
</html>
        """)
    
    def render_template(self, template_content: str, variables: Dict[str, Any], 
                       tenant_id: uuid.UUID) -> Tuple[str, str]:
        """Render email template with variables and branding."""
        try:
            # Get tenant branding
            branding = self.branding_service.get_tenant_branding(tenant_id)
            
            # Apply branding to template
            branded_content = self.branding_service.apply_branding_to_template(template_content, branding)
            
            # Merge variables with branding
            all_variables = {**branding, **variables}
            
            # Simple template processing (replace {{variable}} with values)
            rendered_content = branded_content
            for key, value in all_variables.items():
                placeholder = f"{{{{{key}}}}}"
                rendered_content = rendered_content.replace(placeholder, str(value))
            
            # Extract subject if present
            subject = all_variables.get('subject', 'Notification from ' + branding['tenant_name'])
            
            return subject, rendered_content
            
        except Exception as e:
            logger.error(f"Failed to render template: {str(e)}")
            # Return fallback content
            branding = self.branding_service.get_tenant_branding(tenant_id)
            return f"Notification from {branding['tenant_name']}", template_content


class EmailService:
    """Main email service orchestrating all email functionality."""
    
    def __init__(self):
        self.template_service = EmailTemplateService()
        self.branding_service = TenantBrandingService()
        self.quota_service = QuotaService()
        self._sendgrid_client = None
    
    def _get_sendgrid_client(self) -> SendGridClient:
        """Get SendGrid client instance."""
        if not self._sendgrid_client:
            from ..config import Config
            api_key = Config.SENDGRID_API_KEY
            from_email = Config.SENDGRID_FROM_EMAIL
            from_name = Config.SENDGRID_FROM_NAME or "Tithi"
            
            if not api_key:
                raise TithiError("TITHI_EMAIL_CONFIG_MISSING", "SendGrid API key not configured")
            
            self._sendgrid_client = SendGridClient(api_key, from_email, from_name)
        
        return self._sendgrid_client
    
    def send_email(self, request: EmailRequest) -> EmailResult:
        """Send email notification."""
        try:
            # Quota enforcement
            self.quota_service.check_and_increment(request.tenant_id, 'notifications_daily', 1)
            
            # Create notification record
            notification = self._create_notification_record(request)
            
            # Get template and render content
            subject, html_content = self._prepare_email_content(request, notification.id)
            
            # Send via SendGrid
            sendgrid_client = self._get_sendgrid_client()
            result = sendgrid_client.send_email(
                to_email=request.recipient_email,
                to_name=request.recipient_name or "Customer",
                subject=subject,
                html_content=html_content
            )
            
            # Update notification status
            if result["success"]:
                notification.status = EmailStatus.SENT.value
                notification.sent_at = datetime.utcnow()
                notification.provider_message_id = result["message_id"]
                notification.provider = "sendgrid"
                
                # Log success
                self._log_notification_event(notification.id, "sent", {
                    "provider_message_id": result["message_id"],
                    "provider": "sendgrid"
                })
                
                db.session.commit()
                
                return EmailResult(
                    success=True,
                    notification_id=notification.id,
                    provider_message_id=result["message_id"]
                )
            else:
                # Handle failure
                notification.status = EmailStatus.FAILED.value
                notification.failed_at = datetime.utcnow()
                notification.failure_reason = result["error"]
                notification.provider = "sendgrid"
                
                # Log failure
                self._log_notification_event(notification.id, "failed", {
                    "error": result["error"],
                    "provider": "sendgrid"
                })
                
                db.session.commit()
                
                return EmailResult(
                    success=False,
                    notification_id=notification.id,
                    error_message=result["error"]
                )
                
        except TithiError:
            raise
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return EmailResult(
                success=False,
                error_message=f"Email delivery failed: {str(e)}"
            )
    
    def send_booking_email(self, booking: Booking, event_type: str) -> EmailResult:
        """Send booking-related email notification."""
        try:
            # Get customer and service info
            customer = Customer.query.get(booking.customer_id)
            if not customer or not customer.email:
                return EmailResult(
                    success=False,
                    error_message="Customer email not found"
                )
            
            # Get service info from snapshot
            service_snapshot = booking.service_snapshot or {}
            service_name = service_snapshot.get('name', 'Service')
            
            # Get staff info
            staff_name = "Staff Member"
            if booking.resource_id:
                staff_profile = StaffProfile.query.filter_by(
                    tenant_id=booking.tenant_id,
                    resource_id=booking.resource_id
                ).first()
                if staff_profile:
                    staff_name = staff_profile.display_name
            
            # Prepare email variables
            variables = {
                "customer_name": customer.display_name or "Customer",
                "service_name": service_name,
                "staff_name": staff_name,
                "booking_date": booking.start_at.strftime('%Y-%m-%d'),
                "booking_time": booking.start_at.strftime('%H:%M'),
                "booking_id": str(booking.id),
                "booking_tz": booking.booking_tz or "UTC"
            }
            
            # Create email request
            request = EmailRequest(
                tenant_id=booking.tenant_id,
                event_code=event_type,
                recipient_email=customer.email,
                recipient_name=customer.display_name,
                variables=variables,
                priority=EmailPriority.HIGH if event_type == "booking_confirmation" else EmailPriority.NORMAL,
                booking_id=booking.id,
                customer_id=customer.id
            )
            
            return self.send_email(request)
            
        except Exception as e:
            logger.error(f"Failed to send booking email: {str(e)}")
            return EmailResult(
                success=False,
                error_message=f"Failed to send booking email: {str(e)}"
            )
    
    def _create_notification_record(self, request: EmailRequest) -> Notification:
        """Create notification record in database."""
        notification = Notification(
            id=uuid.uuid4(),
            tenant_id=request.tenant_id,
            template_id=request.template_id,
            channel="email",
            recipient_type="customer",
            recipient_email=request.recipient_email,
            recipient_name=request.recipient_name,
            subject=request.subject,
            content=request.content or "",
            content_type="text/html",
            priority=request.priority.value,
            scheduled_at=request.scheduled_at,
            expires_at=request.expires_at,
            status=EmailStatus.PENDING.value,
            booking_id=request.booking_id,
            customer_id=request.customer_id,
            metadata_json=request.metadata or {}
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return notification
    
    def _prepare_email_content(self, request: EmailRequest, notification_id: uuid.UUID) -> Tuple[str, str]:
        """Prepare email content with template and branding."""
        # Get template
        template = self.template_service.get_template(request.tenant_id, request.event_code)
        
        if template:
            template_content = template.content
            subject_template = template.subject or "Notification from {{tenant_name}}"
        else:
            # Use default template
            template_content = self.template_service.get_default_template(request.event_code)
            subject_template = "Notification from {{tenant_name}}"
        
        # Render template with variables
        subject, html_content = self.template_service.render_template(
            template_content, 
            request.variables or {}, 
            request.tenant_id
        )
        
        # Update notification with rendered content
        notification = Notification.query.get(notification_id)
        if notification:
            notification.subject = subject
            notification.content = html_content
            db.session.commit()
        
        return subject, html_content
    
    def _log_notification_event(self, notification_id: uuid.UUID, event_type: str, event_data: Dict[str, Any]):
        """Log notification event for analytics."""
        try:
            log = NotificationLog(
                id=uuid.uuid4(),
                notification_id=notification_id,
                event_type=event_type,
                event_data=event_data,
                provider=event_data.get('provider'),
                provider_event_id=event_data.get('provider_message_id')
            )
            
            db.session.add(log)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to log notification event: {str(e)}")
    
    def get_email_stats(self, tenant_id: uuid.UUID, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get email delivery statistics."""
        try:
            stats = db.session.query(
                Notification.status,
                db.func.count(Notification.id).label('count')
            ).filter(
                Notification.tenant_id == tenant_id,
                Notification.channel == "email",
                Notification.created_at >= start_date,
                Notification.created_at <= end_date
            ).group_by(Notification.status).all()
            
            total_sent = sum(count for status, count in stats if status in ['sent', 'delivered'])
            total_failed = sum(count for status, count in stats if status == 'failed')
            
            return {
                "total_sent": total_sent,
                "total_failed": total_failed,
                "delivery_rate": (total_sent / (total_sent + total_failed)) if (total_sent + total_failed) > 0 else 0,
                "by_status": {status: count for status, count in stats}
            }
            
        except Exception as e:
            logger.error(f"Failed to get email stats: {str(e)}")
            return {"total_sent": 0, "total_failed": 0, "delivery_rate": 0, "by_status": {}}


# Celery tasks for async email processing
@celery.task(bind=True, max_retries=3)
def send_email_async(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Async task for sending emails."""
    try:
        # Convert request data back to EmailRequest
        request = EmailRequest(
            tenant_id=uuid.UUID(request_data['tenant_id']),
            event_code=request_data['event_code'],
            recipient_email=request_data['recipient_email'],
            recipient_name=request_data.get('recipient_name'),
            subject=request_data.get('subject'),
            content=request_data.get('content'),
            template_id=uuid.UUID(request_data['template_id']) if request_data.get('template_id') else None,
            variables=request_data.get('variables'),
            priority=EmailPriority(request_data.get('priority', 'normal')),
            scheduled_at=datetime.fromisoformat(request_data['scheduled_at']) if request_data.get('scheduled_at') else None,
            expires_at=datetime.fromisoformat(request_data['expires_at']) if request_data.get('expires_at') else None,
            booking_id=uuid.UUID(request_data['booking_id']) if request_data.get('booking_id') else None,
            customer_id=uuid.UUID(request_data['customer_id']) if request_data.get('customer_id') else None,
            metadata=request_data.get('metadata')
        )
        
        # Send email
        email_service = EmailService()
        result = email_service.send_email(request)
        
        return {
            "success": result.success,
            "notification_id": str(result.notification_id) if result.notification_id else None,
            "provider_message_id": result.provider_message_id,
            "error_message": result.error_message
        }
        
    except Exception as e:
        logger.error(f"Email async task failed: {str(e)}")
        # Retry with exponential backoff
        raise self.retry(countdown=60 * (2 ** self.request.retries))


@celery.task
def process_email_outbox():
    """Process email events from outbox."""
    try:
        # Get ready email events from outbox
        ready_events = EventOutbox.query.filter_by(
            event_code='EMAIL_NOTIFICATION',
            status='ready'
        ).filter(
            EventOutbox.ready_at <= datetime.utcnow()
        ).limit(100).all()
        
        processed_count = 0
        
        for event in ready_events:
            try:
                # Process email event
                request_data = event.payload
                send_email_async.delay(request_data)
                
                # Mark as delivered
                event.status = 'delivered'
                event.delivered_at = datetime.utcnow()
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Failed to process email outbox event {event.id}: {str(e)}")
                event.status = 'failed'
                event.failed_at = datetime.utcnow()
                event.error_message = str(e)
        
        db.session.commit()
        
        logger.info(f"Processed {processed_count} email outbox events")
        
        return {"processed": processed_count}
        
    except Exception as e:
        logger.error(f"Failed to process email outbox: {str(e)}")
        db.session.rollback()
        return {"processed": 0, "error": str(e)}
