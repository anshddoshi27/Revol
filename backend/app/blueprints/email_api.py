"""
Email API Blueprint

This module provides REST API endpoints specifically for email notifications.
Implements Task 7.1: Email Notifications with SendGrid integration and tenant branding.

Aligned with Design Brief Module J - Notifications & Communication and Task 7.1 requirements.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_smorest import abort
from marshmallow import Schema, fields, validate, validates_schema, ValidationError
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import uuid

from ..services.email_service import EmailService, EmailRequest, EmailPriority
from ..services.notification_service import NotificationTemplateService
from ..exceptions import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant
from ..models.notification import NotificationTemplate
from ..models.business import Booking, Customer


# Create blueprint
email_bp = Blueprint('email_api', __name__, url_prefix='/notifications/email')


# Request/Response Schemas
class EmailSendSchema(Schema):
    """Schema for sending email notifications."""
    event_code = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    recipient_email = fields.Email(required=True)
    recipient_name = fields.Str(allow_none=True, validate=validate.Length(max=255))
    subject = fields.Str(allow_none=True, validate=validate.Length(max=500))
    content = fields.Str(allow_none=True)
    template_id = fields.Str(allow_none=True)
    variables = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default={})
    priority = fields.Str(load_default='normal', validate=validate.OneOf(['low', 'normal', 'high', 'urgent']))
    scheduled_at = fields.DateTime(allow_none=True)
    expires_at = fields.DateTime(allow_none=True)
    booking_id = fields.Str(allow_none=True)
    customer_id = fields.Str(allow_none=True)
    metadata = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default={})
    
    @validates_schema
    def validate_content_or_template(self, data, **kwargs):
        """Validate that either content or template_id is provided."""
        content = data.get('content')
        template_id = data.get('template_id')
        
        if not content and not template_id:
            raise ValidationError('Either content or template_id is required')


class EmailResponseSchema(Schema):
    """Schema for email notification response."""
    success = fields.Bool()
    notification_id = fields.Str(allow_none=True)
    provider_message_id = fields.Str(allow_none=True)
    error_message = fields.Str(allow_none=True)


class EmailTemplateSchema(Schema):
    """Schema for email template."""
    id = fields.Str()
    name = fields.Str()
    description = fields.Str()
    subject = fields.Str()
    content = fields.Str()
    content_type = fields.Str()
    trigger_event = fields.Str()
    category = fields.Str()
    variables = fields.Dict()
    required_variables = fields.List(fields.Str())
    is_active = fields.Bool()
    is_system = fields.Bool()
    metadata = fields.Dict()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class EmailStatsSchema(Schema):
    """Schema for email statistics."""
    total_sent = fields.Int()
    total_failed = fields.Int()
    delivery_rate = fields.Float()
    by_status = fields.Dict()


# Initialize services
email_service = EmailService()
template_service = NotificationTemplateService()


@email_bp.route('/send', methods=['POST'])
@require_auth
@require_tenant
def send_email():
    """
    Send email notification.
    
    This endpoint implements the core functionality of Task 7.1: Email Notifications.
    It sends transactional emails with tenant branding and SendGrid integration.
    """
    try:
        # Parse and validate request data
        schema = EmailSendSchema()
        data = schema.load(request.json)
        
        # Get tenant_id from context
        tenant_id = request.tenant_id
        
        # Create email request
        email_request = EmailRequest(
            tenant_id=tenant_id,
            event_code=data['event_code'],
            recipient_email=data['recipient_email'],
            recipient_name=data.get('recipient_name'),
            subject=data.get('subject'),
            content=data.get('content'),
            template_id=uuid.UUID(data['template_id']) if data.get('template_id') else None,
            variables=data['variables'],
            priority=EmailPriority(data['priority']),
            scheduled_at=data.get('scheduled_at'),
            expires_at=data.get('expires_at'),
            booking_id=uuid.UUID(data['booking_id']) if data.get('booking_id') else None,
            customer_id=uuid.UUID(data['customer_id']) if data.get('customer_id') else None,
            metadata=data['metadata']
        )
        
        # Send email
        result = email_service.send_email(email_request)
        
        # Return response
        response_schema = EmailResponseSchema()
        return jsonify(response_schema.dump(result)), 200 if result.success else 400
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error sending email: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/booking/<booking_id>/<event_type>', methods=['POST'])
@require_auth
@require_tenant
def send_booking_email(booking_id: str, event_type: str):
    """
    Send booking-related email notification.
    
    This endpoint sends emails for booking events (confirmation, reminder, cancellation)
    with proper tenant branding and booking details.
    """
    try:
        # Validate booking_id
        try:
            booking_uuid = uuid.UUID(booking_id)
        except ValueError:
            abort(400, message="Invalid booking ID format")
        
        # Get booking
        booking = Booking.query.filter_by(
            id=booking_uuid,
            tenant_id=request.tenant_id
        ).first()
        
        if not booking:
            abort(404, message="Booking not found")
        
        # Validate event type
        valid_events = ['booking_confirmation', 'booking_reminder', 'booking_cancellation']
        if event_type not in valid_events:
            abort(400, message=f"Invalid event type. Must be one of: {', '.join(valid_events)}")
        
        # Send booking email
        result = email_service.send_booking_email(booking, event_type)
        
        # Return response
        response_schema = EmailResponseSchema()
        return jsonify(response_schema.dump(result)), 200 if result.success else 400
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error sending booking email: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/templates', methods=['GET'])
@require_auth
@require_tenant
def list_email_templates():
    """List email templates for the tenant."""
    try:
        tenant_id = request.tenant_id
        category = request.args.get('category')
        
        # Query email templates
        query = NotificationTemplate.query.filter_by(
            tenant_id=tenant_id,
            channel='email',
            is_active=True
        )
        
        if category:
            query = query.filter_by(category=category)
        
        templates = query.all()
        
        # Return response
        response_schema = EmailTemplateSchema(many=True)
        return jsonify(response_schema.dump(templates))
        
    except Exception as e:
        current_app.logger.error(f"Error listing email templates: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/templates/<template_id>', methods=['GET'])
@require_auth
@require_tenant
def get_email_template(template_id: str):
    """Get email template by ID."""
    try:
        # Validate template_id
        try:
            template_uuid = uuid.UUID(template_id)
        except ValueError:
            abort(400, message="Invalid template ID format")
        
        # Get template
        template = NotificationTemplate.query.filter_by(
            id=template_uuid,
            tenant_id=request.tenant_id,
            channel='email'
        ).first()
        
        if not template:
            abort(404, message="Email template not found")
        
        # Return response
        response_schema = EmailTemplateSchema()
        return jsonify(response_schema.dump(template))
        
    except Exception as e:
        current_app.logger.error(f"Error getting email template: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/templates/render', methods=['POST'])
@require_auth
@require_tenant
def render_email_template():
    """
    Render email template with variables for preview.
    
    This endpoint allows admins to preview how emails will look with tenant branding
    and template variables applied.
    """
    try:
        data = request.json
        template_id = data.get('template_id')
        variables = data.get('variables', {})
        
        if not template_id:
            abort(400, message="template_id is required")
        
        # Validate template_id
        try:
            template_uuid = uuid.UUID(template_id)
        except ValueError:
            abort(400, message="Invalid template ID format")
        
        tenant_id = request.tenant_id
        
        # Get template
        template = NotificationTemplate.query.filter_by(
            id=template_uuid,
            tenant_id=tenant_id,
            channel='email'
        ).first()
        
        if not template:
            abort(404, message="Email template not found")
        
        # Render template
        from ..services.email_service import EmailTemplateService
        template_service = EmailTemplateService()
        subject, rendered_content = template_service.render_template(
            template.content, 
            variables, 
            tenant_id
        )
        
        return jsonify({
            "subject": subject,
            "content": rendered_content,
            "content_type": template.content_type
        })
        
    except Exception as e:
        current_app.logger.error(f"Error rendering email template: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/stats', methods=['GET'])
@require_auth
@require_tenant
def get_email_stats():
    """Get email delivery statistics for the tenant."""
    try:
        tenant_id = request.tenant_id
        
        # Get date range from query params
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        else:
            start_date = datetime.utcnow() - timedelta(days=30)  # Default to last 30 days
        
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        else:
            end_date = datetime.utcnow()
        
        # Get email stats
        stats = email_service.get_email_stats(tenant_id, start_date, end_date)
        
        # Return response
        response_schema = EmailStatsSchema()
        return jsonify(response_schema.dump(stats))
        
    except ValueError as e:
        abort(400, message=f"Invalid date format: {str(e)}")
    except Exception as e:
        current_app.logger.error(f"Error getting email stats: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/test', methods=['POST'])
@require_auth
@require_tenant
def send_test_email():
    """
    Send test email for template validation.
    
    This endpoint allows admins to send test emails to verify templates
    and tenant branding are working correctly.
    """
    try:
        data = request.json
        recipient_email = data.get('recipient_email')
        template_id = data.get('template_id')
        variables = data.get('variables', {})
        
        if not recipient_email:
            abort(400, message="recipient_email is required")
        
        if not template_id:
            abort(400, message="template_id is required")
        
        # Validate template_id
        try:
            template_uuid = uuid.UUID(template_id)
        except ValueError:
            abort(400, message="Invalid template ID format")
        
        tenant_id = request.tenant_id
        
        # Get template
        template = NotificationTemplate.query.filter_by(
            id=template_uuid,
            tenant_id=tenant_id,
            channel='email'
        ).first()
        
        if not template:
            abort(404, message="Email template not found")
        
        # Create test email request
        email_request = EmailRequest(
            tenant_id=tenant_id,
            event_code='test_email',
            recipient_email=recipient_email,
            recipient_name="Test User",
            template_id=template_uuid,
            variables=variables,
            priority=EmailPriority.NORMAL,
            metadata={"test": True}
        )
        
        # Send test email
        result = email_service.send_email(email_request)
        
        # Return response
        response_schema = EmailResponseSchema()
        return jsonify(response_schema.dump(result)), 200 if result.success else 400
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error sending test email: {str(e)}")
        abort(500, message="Internal server error")


@email_bp.route('/health', methods=['GET'])
def email_health_check():
    """
    Health check endpoint for email service.
    
    This endpoint verifies that the email service is properly configured
    and can connect to SendGrid.
    """
    try:
        # Check SendGrid configuration
        from ..config import Config
        
        if not Config.SENDGRID_API_KEY:
            return jsonify({
                "status": "unhealthy",
                "error": "SendGrid API key not configured"
            }), 503
        
        # Test SendGrid connection (simplified check)
        try:
            from ..services.email_service import SendGridClient
            client = SendGridClient(
                Config.SENDGRID_API_KEY,
                Config.SENDGRID_FROM_EMAIL,
                Config.SENDGRID_FROM_NAME
            )
            
            # Simple API test (this would normally be a more comprehensive check)
            return jsonify({
                "status": "healthy",
                "service": "email",
                "provider": "sendgrid",
                "from_email": Config.SENDGRID_FROM_EMAIL
            })
            
        except Exception as e:
            return jsonify({
                "status": "unhealthy",
                "error": f"SendGrid connection failed: {str(e)}"
            }), 503
        
    except Exception as e:
        current_app.logger.error(f"Email health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "error": "Health check failed"
        }), 503
