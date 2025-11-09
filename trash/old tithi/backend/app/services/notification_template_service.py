"""
Standardized Notification Template Service

This service enforces {{snake_case}} placeholder format and provides
consistent template rendering across the notification system.
"""

import re
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from jinja2 import Template, TemplateError

from ..models.notification import NotificationTemplate, NotificationChannel
from ..models.business import Booking, Customer, Service
from ..models.tenant import Tenant
from ..exceptions import TithiError


class StandardizedTemplateService:
    """Service for managing notification templates with standardized placeholders."""
    
    # Standardized placeholder mapping for booking events
    BOOKING_PLACEHOLDERS = {
        'customer_name': 'Customer display name',
        'service_name': 'Service name',
        'booking_date': 'Booking date (YYYY-MM-DD)',
        'booking_time': 'Booking time (HH:MM)',
        'business_name': 'Business/tenant name',
        'booking_url': 'Booking management URL',
        'staff_name': 'Staff member name',
        'booking_id': 'Booking ID',
        'booking_tz': 'Booking timezone',
        'tenant_name': 'Tenant name'
    }
    
    def __init__(self):
        self.placeholder_pattern = re.compile(r'\{\{([a-z][a-z0-9_]*)\}\}')
    
    def validate_placeholder_format(self, content: str) -> bool:
        """Validate that content uses {{snake_case}} placeholder format."""
        if not content:
            return True
        
        # Check for invalid placeholder formats
        invalid_patterns = [
            r'\{\{[A-Z]',  # Uppercase letters
            r'\{\{[^a-z]',  # Non-lowercase start
            r'\{\{[a-z0-9_]*[^a-z0-9_]\}',  # Invalid characters
            r'\{\{[^a-z0-9_]*\}\}',  # Invalid characters
        ]
        
        for pattern in invalid_patterns:
            if re.search(pattern, content):
                return False
        
        return True
    
    def extract_placeholders(self, content: str) -> List[str]:
        """Extract all placeholders from template content."""
        if not content:
            return []
        
        matches = self.placeholder_pattern.findall(content)
        return list(set(matches))  # Remove duplicates
    
    def create_booking_template(self, tenant_id: uuid.UUID, event_type: str, 
                               channel: NotificationChannel, 
                               subject: str, content: str) -> NotificationTemplate:
        """Create a booking notification template with standardized placeholders."""
        
        # Validate placeholder format
        if not self.validate_placeholder_format(subject):
            raise TithiError("TITHI_TEMPLATE_INVALID_PLACEHOLDER", 
                           "Subject contains invalid placeholder format. Use {{snake_case}}")
        
        if not self.validate_placeholder_format(content):
            raise TithiError("TITHI_TEMPLATE_INVALID_PLACEHOLDER", 
                           "Content contains invalid placeholder format. Use {{snake_case}}")
        
        # Extract required variables
        subject_placeholders = self.extract_placeholders(subject)
        content_placeholders = self.extract_placeholders(content)
        all_placeholders = list(set(subject_placeholders + content_placeholders))
        
        # Create template
        template = NotificationTemplate(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=f"booking_{event_type}_{channel.value}",
            description=f"Standardized template for {event_type} via {channel.value}",
            channel=channel,
            subject=subject,
            content=content,
            content_type="text/html" if channel == NotificationChannel.EMAIL else "text/plain",
            trigger_event=event_type,
            category="booking",
            variables={placeholder: self.BOOKING_PLACEHOLDERS.get(placeholder, f"Variable: {placeholder}") 
                     for placeholder in all_placeholders},
            required_variables=all_placeholders,
            is_active=True,
            is_system=True,
            metadata_json={"standardized": True, "version": "1.0"}
        )
        
        return template
    
    def render_booking_template(self, template: NotificationTemplate, booking: Booking) -> Tuple[str, str]:
        """Render a booking template with standardized variables."""
        
        # Get customer info
        customer = Customer.query.get(booking.customer_id)
        customer_name = customer.display_name if customer else "Customer"
        
        # Get service info from snapshot
        service_snapshot = booking.service_snapshot or {}
        service_name = service_snapshot.get('name', 'Service')
        
        # Get staff info
        staff_name = "Staff Member"
        if booking.resource_id:
            from ..models.business import StaffProfile
            staff_profile = StaffProfile.query.filter_by(
                tenant_id=booking.tenant_id,
                resource_id=booking.resource_id
            ).first()
            if staff_profile:
                staff_name = staff_profile.display_name
        
        # Get tenant info
        tenant = Tenant.query.get(booking.tenant_id)
        tenant_name = tenant.name if tenant else "Business"
        
        # Prepare standardized variables
        variables = {
            'customer_name': customer_name,
            'service_name': service_name,
            'booking_date': booking.start_at.strftime('%Y-%m-%d'),
            'booking_time': booking.start_at.strftime('%H:%M'),
            'business_name': tenant_name,
            'booking_url': f"/bookings/{booking.id}",  # Frontend URL
            'staff_name': staff_name,
            'booking_id': str(booking.id),
            'booking_tz': booking.booking_tz or "UTC",
            'tenant_name': tenant_name
        }
        
        # Render template
        try:
            subject_template = Template(template.subject or "")
            rendered_subject = subject_template.render(**variables)
            
            content_template = Template(template.content)
            rendered_content = content_template.render(**variables)
            
            return rendered_subject, rendered_content
            
        except TemplateError as e:
            raise TithiError("TITHI_TEMPLATE_RENDER_ERROR", f"Template rendering failed: {str(e)}")
    
    def create_default_templates(self, tenant_id: uuid.UUID) -> List[NotificationTemplate]:
        """Create default standardized templates for a tenant."""
        
        templates = []
        
        # Booking confirmation email template
        confirmation_email = self.create_booking_template(
            tenant_id=tenant_id,
            event_type="booking_confirmed",
            channel=NotificationChannel.EMAIL,
            subject="Booking Confirmed - {{service_name}} on {{booking_date}}",
            content="""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Booking Confirmed</title>
</head>
<body>
    <h2>Booking Confirmed</h2>
    <p>Dear {{customer_name}},</p>
    <p>Your booking has been confirmed! Here are the details:</p>
    <ul>
        <li><strong>Service:</strong> {{service_name}}</li>
        <li><strong>Date:</strong> {{booking_date}}</li>
        <li><strong>Time:</strong> {{booking_time}}</li>
        <li><strong>Staff:</strong> {{staff_name}}</li>
    </ul>
    <p>Thank you for choosing {{business_name}}!</p>
</body>
</html>
            """
        )
        templates.append(confirmation_email)
        
        # Booking confirmation SMS template
        confirmation_sms = self.create_booking_template(
            tenant_id=tenant_id,
            event_type="booking_confirmed",
            channel=NotificationChannel.SMS,
            subject="",  # SMS doesn't have subject
            content="Booking confirmed! {{service_name}} on {{booking_date}} at {{booking_time}}. Thank you for choosing {{business_name}}!"
        )
        templates.append(confirmation_sms)
        
        # 24h reminder email template
        reminder_24h_email = self.create_booking_template(
            tenant_id=tenant_id,
            event_type="reminder_24h",
            channel=NotificationChannel.EMAIL,
            subject="Reminder: {{service_name}} tomorrow at {{booking_time}}",
            content="""
Written in HTML, this template includes the following placeholders:
- {{customer_name}}
- {{service_name}}
- {{booking_date}}
- {{booking_time}}
- {{business_name}}
- {{staff_name}}
- {{booking_url}}
            """
        )
        templates.append(reminder_24h_email)
        
        # 1h reminder SMS template
        reminder_1h_sms = self.create_booking_template(
            tenant_id=tenant_id,
            event_type="reminder_1h",
            channel=NotificationChannel.SMS,
            subject="",
            content="Reminder: {{service_name}} in 1 hour at {{booking_time}}. See you soon at {{business_name}}!"
        )
        templates.append(reminder_1h_sms)
        
        return templates
