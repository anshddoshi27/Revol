"""
Notification API Blueprint

This module provides REST API endpoints for notification management including SMS, email, and push notifications.
Aligned with Design Brief Module J - Notifications & Communication.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_smorest import abort
from marshmallow import Schema, fields, validate, validates_schema, ValidationError
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from ..services.notification import (
    NotificationTemplateService, NotificationService, 
    NotificationPreferenceService, NotificationQueueService
)
from ..exceptions import TithiError
from ..middleware.auth_middleware import require_auth
from ..middleware.auth_middleware import require_tenant


# Create blueprint
notification_bp = Blueprint('notification_api', __name__)


# Request/Response Schemas
class NotificationTemplateCreateSchema(Schema):
    """Schema for creating a notification template."""
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str(allow_none=True)
    channel = fields.Str(required=True, validate=validate.OneOf(['email', 'sms', 'push', 'webhook']))
    subject = fields.Str(allow_none=True, validate=validate.Length(max=500))
    content = fields.Str(required=True)
    content_type = fields.Str(load_default='text/plain', validate=validate.OneOf(['text/plain', 'text/html', 'application/json']))
    trigger_event = fields.Str(allow_none=True, validate=validate.Length(max=100))
    category = fields.Str(allow_none=True, validate=validate.Length(max=100))
    variables = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default={})
    required_variables = fields.List(fields.Str(), load_default=[])
    is_system = fields.Bool(load_default=False)
    metadata = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default={})


class NotificationTemplateResponseSchema(Schema):
    """Schema for notification template response."""
    id = fields.Str()
    name = fields.Str()
    description = fields.Str()
    channel = fields.Str()
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


class NotificationCreateSchema(Schema):
    """Schema for creating a notification."""
    channel = fields.Str(required=True, validate=validate.OneOf(['email', 'sms', 'push', 'webhook']))
    recipient_type = fields.Str(required=True, validate=validate.OneOf(['customer', 'staff', 'admin']))
    recipient_id = fields.Str(allow_none=True)
    recipient_email = fields.Email(allow_none=True)
    recipient_phone = fields.Str(allow_none=True, validate=validate.Length(max=20))
    recipient_name = fields.Str(allow_none=True, validate=validate.Length(max=255))
    subject = fields.Str(allow_none=True, validate=validate.Length(max=500))
    content = fields.Str(allow_none=True)
    content_type = fields.Str(load_default='text/plain', validate=validate.OneOf(['text/plain', 'text/html', 'application/json']))
    template_id = fields.Str(allow_none=True)
    template_variables = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default={})
    priority = fields.Str(load_default='normal', validate=validate.OneOf(['low', 'normal', 'high', 'urgent']))
    scheduled_at = fields.DateTime(allow_none=True)
    expires_at = fields.DateTime(allow_none=True)
    booking_id = fields.Str(allow_none=True)
    payment_id = fields.Str(allow_none=True)
    customer_id = fields.Str(allow_none=True)
    metadata = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default={})
    
    @validates_schema
    def validate_recipient_info(self, data, **kwargs):
        """Validate recipient information based on channel."""
        channel = data.get('channel')
        recipient_email = data.get('recipient_email')
        recipient_phone = data.get('recipient_phone')
        
        if channel == 'email' and not recipient_email:
            raise ValidationError('Email address is required for email notifications', 'recipient_email')
        
        if channel == 'sms' and not recipient_phone:
            raise ValidationError('Phone number is required for SMS notifications', 'recipient_phone')
    
    @validates_schema
    def validate_content_or_template(self, data, **kwargs):
        """Validate that either content or template_id is provided."""
        content = data.get('content')
        template_id = data.get('template_id')
        
        if not content and not template_id:
            raise ValidationError('Either content or template_id is required')


class NotificationResponseSchema(Schema):
    """Schema for notification response."""
    id = fields.Str()
    template_id = fields.Str(allow_none=True)
    channel = fields.Str()
    recipient_type = fields.Str()
    recipient_id = fields.Str(allow_none=True)
    recipient_email = fields.Str(allow_none=True)
    recipient_phone = fields.Str(allow_none=True)
    recipient_name = fields.Str(allow_none=True)
    subject = fields.Str(allow_none=True)
    content = fields.Str()
    content_type = fields.Str()
    priority = fields.Str()
    status = fields.Str()
    scheduled_at = fields.DateTime(allow_none=True)
    expires_at = fields.DateTime(allow_none=True)
    sent_at = fields.DateTime(allow_none=True)
    delivered_at = fields.DateTime(allow_none=True)
    failed_at = fields.DateTime(allow_none=True)
    failure_reason = fields.Str(allow_none=True)
    provider_message_id = fields.Str(allow_none=True)
    booking_id = fields.Str(allow_none=True)
    payment_id = fields.Str(allow_none=True)
    customer_id = fields.Str(allow_none=True)
    metadata = fields.Dict()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class NotificationPreferenceUpdateSchema(Schema):
    """Schema for updating notification preferences."""
    email_enabled = fields.Bool(allow_none=True)
    sms_enabled = fields.Bool(allow_none=True)
    push_enabled = fields.Bool(allow_none=True)
    booking_notifications = fields.Bool(allow_none=True)
    payment_notifications = fields.Bool(allow_none=True)
    promotion_notifications = fields.Bool(allow_none=True)
    system_notifications = fields.Bool(allow_none=True)
    marketing_notifications = fields.Bool(allow_none=True)
    digest_frequency = fields.Str(allow_none=True, validate=validate.OneOf(['immediate', 'daily', 'weekly', 'never']))
    quiet_hours_start = fields.Str(allow_none=True, validate=validate.Regexp(r'^[0-2][0-9]:[0-5][0-9]$'))
    quiet_hours_end = fields.Str(allow_none=True, validate=validate.Regexp(r'^[0-2][0-9]:[0-5][0-9]$'))


class NotificationPreferenceResponseSchema(Schema):
    """Schema for notification preference response."""
    id = fields.Str()
    user_type = fields.Str()
    user_id = fields.Str()
    email_enabled = fields.Bool()
    sms_enabled = fields.Bool()
    push_enabled = fields.Bool()
    booking_notifications = fields.Bool()
    payment_notifications = fields.Bool()
    promotion_notifications = fields.Bool()
    system_notifications = fields.Bool()
    marketing_notifications = fields.Bool()
    digest_frequency = fields.Str()
    quiet_hours_start = fields.Str(allow_none=True)
    quiet_hours_end = fields.Str(allow_none=True)
    metadata = fields.Dict()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


# Initialize services
template_service = NotificationTemplateService()
notification_service = NotificationService()
preference_service = NotificationPreferenceService()
queue_service = NotificationQueueService()


@notification_bp.route('/templates', methods=['POST'])
@require_auth
@require_tenant
def create_template():
    """Create a new notification template."""
    try:
        # Parse and validate request data
        schema = NotificationTemplateCreateSchema()
        data = schema.load(request.json)
        
        # Get tenant_id from context
        tenant_id = request.tenant_id
        
        # Create template
        template = template_service.create_template(
            tenant_id=tenant_id,
            name=data['name'],
            description=data.get('description'),
            channel=data['channel'],
            subject=data.get('subject'),
            content=data['content'],
            content_type=data['content_type'],
            trigger_event=data.get('trigger_event'),
            category=data.get('category'),
            variables=data['variables'],
            required_variables=data['required_variables'],
            is_system=data['is_system'],
            metadata=data['metadata']
        )
        
        # Return response
        response_schema = NotificationTemplateResponseSchema()
        return jsonify(response_schema.dump(template)), 201
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error creating template: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/templates/<template_id>', methods=['GET'])
@require_auth
@require_tenant
def get_template(template_id):
    """Get a notification template by ID."""
    try:
        tenant_id = request.tenant_id
        
        template = template_service.db.query(NotificationTemplate).filter(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.id == template_id
            )
        ).first()
        
        if not template:
            abort(404, message="Template not found")
        
        response_schema = NotificationTemplateResponseSchema()
        return jsonify(response_schema.dump(template))
        
    except Exception as e:
        current_app.logger.error(f"Error getting template: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/templates', methods=['GET'])
@require_auth
@require_tenant
def list_templates():
    """List notification templates."""
    try:
        tenant_id = request.tenant_id
        category = request.args.get('category')
        
        if category:
            templates = template_service.get_templates_by_category(tenant_id, category)
        else:
            templates = template_service.db.query(NotificationTemplate).filter(
                and_(
                    NotificationTemplate.tenant_id == tenant_id,
                    NotificationTemplate.is_active == True
                )
            ).all()
        
        response_schema = NotificationTemplateResponseSchema(many=True)
        return jsonify(response_schema.dump(templates))
        
    except Exception as e:
        current_app.logger.error(f"Error listing templates: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/notifications', methods=['POST'])
@require_auth
@require_tenant
def create_notification():
    """Create a new notification."""
    try:
        # Parse and validate request data
        schema = NotificationCreateSchema()
        data = schema.load(request.json)
        
        # Get tenant_id from context
        tenant_id = request.tenant_id
        
        # Create notification
        notification = notification_service.create_notification(
            tenant_id=tenant_id,
            channel=data['channel'],
            recipient_type=data['recipient_type'],
            recipient_id=data.get('recipient_id'),
            recipient_email=data.get('recipient_email'),
            recipient_phone=data.get('recipient_phone'),
            recipient_name=data.get('recipient_name'),
            subject=data.get('subject'),
            content=data.get('content'),
            content_type=data['content_type'],
            template_id=data.get('template_id'),
            template_variables=data['template_variables'],
            priority=data['priority'],
            scheduled_at=data.get('scheduled_at'),
            expires_at=data.get('expires_at'),
            booking_id=data.get('booking_id'),
            payment_id=data.get('payment_id'),
            customer_id=data.get('customer_id'),
            metadata=data['metadata']
        )
        
        # Return response
        response_schema = NotificationResponseSchema()
        return jsonify(response_schema.dump(notification)), 201
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error creating notification: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/notifications/<notification_id>', methods=['GET'])
@require_auth
@require_tenant
def get_notification(notification_id):
    """Get a notification by ID."""
    try:
        tenant_id = request.tenant_id
        
        notification = notification_service.db.query(Notification).filter(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.id == notification_id
            )
        ).first()
        
        if not notification:
            abort(404, message="Notification not found")
        
        response_schema = NotificationResponseSchema()
        return jsonify(response_schema.dump(notification))
        
    except Exception as e:
        current_app.logger.error(f"Error getting notification: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/notifications/<notification_id>/status', methods=['GET'])
@require_auth
@require_tenant
def get_notification_status(notification_id):
    """Get notification status and details."""
    try:
        status = notification_service.get_notification_status(notification_id)
        return jsonify(status)
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error getting notification status: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/notifications/<notification_id>/logs', methods=['GET'])
@require_auth
@require_tenant
def get_notification_logs(notification_id):
    """Get notification event logs."""
    try:
        logs = notification_service.get_notification_logs(notification_id)
        return jsonify({"logs": logs})
        
    except Exception as e:
        current_app.logger.error(f"Error getting notification logs: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/notifications/<notification_id>/send', methods=['POST'])
@require_auth
@require_tenant
def send_notification(notification_id):
    """Send a notification immediately."""
    try:
        success = notification_service.send_notification(notification_id)
        
        return jsonify({
            "success": success,
            "message": "Notification sent successfully" if success else "Notification send failed"
        })
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error sending notification: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/preferences', methods=['GET'])
@require_auth
@require_tenant
def get_preferences():
    """Get notification preferences for the current user."""
    try:
        tenant_id = request.tenant_id
        user_type = request.args.get('user_type', 'customer')
        user_id = request.args.get('user_id')
        
        if not user_id:
            abort(400, message="user_id is required")
        
        preferences = preference_service.get_preferences(tenant_id, user_type, user_id)
        
        response_schema = NotificationPreferenceResponseSchema()
        return jsonify(response_schema.dump(preferences))
        
    except Exception as e:
        current_app.logger.error(f"Error getting preferences: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/preferences', methods=['PUT'])
@require_auth
@require_tenant
def update_preferences():
    """Update notification preferences for the current user."""
    try:
        # Parse and validate request data
        schema = NotificationPreferenceUpdateSchema()
        data = schema.load(request.json)
        
        tenant_id = request.tenant_id
        user_type = request.args.get('user_type', 'customer')
        user_id = request.args.get('user_id')
        
        if not user_id:
            abort(400, message="user_id is required")
        
        # Update preferences
        preferences = preference_service.update_preferences(
            tenant_id, user_type, user_id, **data
        )
        
        response_schema = NotificationPreferenceResponseSchema()
        return jsonify(response_schema.dump(preferences))
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except Exception as e:
        current_app.logger.error(f"Error updating preferences: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/queue/process', methods=['POST'])
@require_auth
@require_tenant
def process_queue():
    """Process pending notifications from the queue."""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        result = queue_service.process_queue(limit)
        
        return jsonify(result)
        
    except Exception as e:
        current_app.logger.error(f"Error processing queue: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/queue/stats', methods=['GET'])
@require_auth
@require_tenant
def get_queue_stats():
    """Get notification queue statistics."""
    try:
        tenant_id = request.tenant_id
        
        # Get queue statistics
        total_queued = queue_service.db.query(NotificationQueue).filter(
            and_(
                NotificationQueue.tenant_id == tenant_id,
                NotificationQueue.status == "queued"
            )
        ).count()
        
        total_processing = queue_service.db.query(NotificationQueue).filter(
            and_(
                NotificationQueue.tenant_id == tenant_id,
                NotificationQueue.status == "processing"
            )
        ).count()
        
        total_failed = queue_service.db.query(NotificationQueue).filter(
            and_(
                NotificationQueue.tenant_id == tenant_id,
                NotificationQueue.status == "failed"
            )
        ).count()
        
        return jsonify({
            "queued": total_queued,
            "processing": total_processing,
            "failed": total_failed,
            "total": total_queued + total_processing + total_failed
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting queue stats: {str(e)}")
        abort(500, message="Internal server error")


@notification_bp.route('/templates/render', methods=['POST'])
@require_auth
@require_tenant
def render_template():
    """Render a template with variables for preview."""
    try:
        data = request.json
        template_id = data.get('template_id')
        variables = data.get('variables', {})
        
        if not template_id:
            abort(400, message="template_id is required")
        
        tenant_id = request.tenant_id
        
        # Get template
        template = template_service.db.query(NotificationTemplate).filter(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.id == template_id
            )
        ).first()
        
        if not template:
            abort(404, message="Template not found")
        
        # Render template
        rendered_subject, rendered_content = template_service.render_template(template, variables)
        
        return jsonify({
            "subject": rendered_subject,
            "content": rendered_content,
            "content_type": template.content_type
        })
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error rendering template: {str(e)}")
        abort(500, message="Internal server error")