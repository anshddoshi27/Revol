"""
Enhanced Notification API Blueprint

This blueprint provides comprehensive notification management endpoints including
template management, multi-channel delivery, scheduling, and analytics.
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
from datetime import datetime, timedelta

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.notification_service import (
    NotificationService, NotificationRequest, NotificationChannel, 
    NotificationPriority, NotificationTemplateService
)
from ..models.system import NotificationTemplate, NotificationEventType


notification_bp = Blueprint("notifications", __name__)


# Template Management Endpoints

@notification_bp.route("/templates", methods=["GET"])
@require_auth
@require_tenant
def list_notification_templates():
    """List notification templates for the current tenant."""
    try:
        tenant_id = g.tenant_id
        event_code = request.args.get('event_code')
        channel = request.args.get('channel')
        
        query = NotificationTemplate.query.filter_by(tenant_id=tenant_id)
        
        if event_code:
            query = query.filter_by(event_code=event_code)
        if channel:
            query = query.filter_by(channel=channel)
        
        templates = query.all()
        
        return jsonify({
            "templates": [{
                "id": str(template.id),
                "event_code": template.event_code,
                "channel": template.channel,
                "name": template.name,
                "subject": template.subject,
                "body": template.body,
                "is_active": template.is_active,
                "created_at": template.created_at.isoformat() + "Z",
                "updated_at": template.updated_at.isoformat() + "Z"
            } for template in templates],
            "total": len(templates)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list notification templates",
            code="TITHI_NOTIFICATION_TEMPLATE_LIST_ERROR"
        )


@notification_bp.route("/templates", methods=["POST"])
@require_auth
@require_tenant
def create_notification_template():
    """Create a new notification template."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['event_code', 'channel', 'name', 'body']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Validate channel
        try:
            channel = NotificationChannel(data['channel'])
        except ValueError:
            raise TithiError(
                message="Invalid channel",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        tenant_id = g.tenant_id
        template_service = NotificationTemplateService()
        
        template = template_service.create_template(tenant_id, data)
        
        return jsonify({
            "id": str(template.id),
            "event_code": template.event_code,
            "channel": template.channel,
            "name": template.name,
            "subject": template.subject,
            "body": template.body,
            "is_active": template.is_active,
            "created_at": template.created_at.isoformat() + "Z"
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to create notification template",
            code="TITHI_NOTIFICATION_TEMPLATE_CREATE_ERROR"
        )


@notification_bp.route("/templates/<template_id>", methods=["GET"])
@require_auth
@require_tenant
def get_notification_template(template_id: str):
    """Get a specific notification template."""
    try:
        tenant_id = g.tenant_id
        
        template = NotificationTemplate.query.filter_by(
            id=uuid.UUID(template_id),
            tenant_id=tenant_id
        ).first()
        
        if not template:
            raise TithiError(
                message="Template not found",
                code="TITHI_NOTIFICATION_TEMPLATE_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "id": str(template.id),
            "event_code": template.event_code,
            "channel": template.channel,
            "name": template.name,
            "subject": template.subject,
            "body": template.body,
            "is_active": template.is_active,
            "metadata": template.metadata_json,
            "created_at": template.created_at.isoformat() + "Z",
            "updated_at": template.updated_at.isoformat() + "Z"
        }), 200
        
    except ValueError:
        raise TithiError(
            message="Invalid template ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get notification template",
            code="TITHI_NOTIFICATION_TEMPLATE_GET_ERROR"
        )


@notification_bp.route("/templates/<template_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_notification_template(template_id: str):
    """Update a notification template."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        
        template_service = NotificationTemplateService()
        template = template_service.update_template(
            uuid.UUID(template_id), tenant_id, data
        )
        
        return jsonify({
            "id": str(template.id),
            "event_code": template.event_code,
            "channel": template.channel,
            "name": template.name,
            "subject": template.subject,
            "body": template.body,
            "is_active": template.is_active,
            "updated_at": template.updated_at.isoformat() + "Z"
        }), 200
        
    except ValueError:
        raise TithiError(
            message="Invalid template ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to update notification template",
            code="TITHI_NOTIFICATION_TEMPLATE_UPDATE_ERROR"
        )


@notification_bp.route("/templates/<template_id>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_notification_template(template_id: str):
    """Delete a notification template."""
    try:
        tenant_id = g.tenant_id
        
        template_service = NotificationTemplateService()
        success = template_service.delete_template(
            uuid.UUID(template_id), tenant_id
        )
        
        if success:
            return jsonify({"message": "Template deleted successfully"}), 200
        else:
            raise TithiError(
                message="Template not found",
                code="TITHI_NOTIFICATION_TEMPLATE_NOT_FOUND",
                status_code=404
            )
        
    except ValueError:
        raise TithiError(
            message="Invalid template ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to delete notification template",
            code="TITHI_NOTIFICATION_TEMPLATE_DELETE_ERROR"
        )


# Notification Sending Endpoints

@notification_bp.route("/send", methods=["POST"])
@require_auth
@require_tenant
def send_notification():
    """Send a notification immediately."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['event_code', 'channel', 'recipient']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Validate channel
        try:
            channel = NotificationChannel(data['channel'])
        except ValueError:
            raise TithiError(
                message="Invalid channel",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate priority
        priority = NotificationPriority.NORMAL
        if 'priority' in data:
            try:
                priority = NotificationPriority(data['priority'])
            except ValueError:
                raise TithiError(
                    message="Invalid priority",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Create notification request
        request = NotificationRequest(
            tenant_id=g.tenant_id,
            event_code=data['event_code'],
            channel=channel,
            recipient=data['recipient'],
            subject=data.get('subject'),
            content=data.get('content'),
            template_id=uuid.UUID(data['template_id']) if data.get('template_id') else None,
            variables=data.get('variables', {}),
            priority=priority,
            scheduled_at=datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00')) if data.get('scheduled_at') else None,
            expires_at=datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00')) if data.get('expires_at') else None,
            metadata=data.get('metadata', {})
        )
        
        # Send notification
        notification_service = NotificationService()
        result = notification_service.send_immediate_notification(request)
        
        if result.success:
            return jsonify({
                "success": True,
                "notification_id": str(result.notification_id) if result.notification_id else None,
                "provider_message_id": result.provider_message_id,
                "message": "Notification sent successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": result.error_message,
                "retry_after": result.retry_after.isoformat() + "Z" if result.retry_after else None
            }), 400
        
    except ValueError as e:
        raise TithiError(
            message="Invalid data format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to send notification",
            code="TITHI_NOTIFICATION_SEND_ERROR"
        )


@notification_bp.route("/schedule", methods=["POST"])
@require_auth
@require_tenant
def schedule_notification():
    """Schedule a notification for later delivery."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['event_code', 'channel', 'recipient', 'scheduled_at']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Validate channel
        try:
            channel = NotificationChannel(data['channel'])
        except ValueError:
            raise TithiError(
                message="Invalid channel",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate priority
        priority = NotificationPriority.NORMAL
        if 'priority' in data:
            try:
                priority = NotificationPriority(data['priority'])
            except ValueError:
                raise TithiError(
                    message="Invalid priority",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Parse scheduled time
        scheduled_at = datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00'))
        
        # Create notification request
        request = NotificationRequest(
            tenant_id=g.tenant_id,
            event_code=data['event_code'],
            channel=channel,
            recipient=data['recipient'],
            subject=data.get('subject'),
            content=data.get('content'),
            template_id=uuid.UUID(data['template_id']) if data.get('template_id') else None,
            variables=data.get('variables', {}),
            priority=priority,
            scheduled_at=scheduled_at,
            expires_at=datetime.fromisoformat(data['expires_at'].replace('Z', '+00:00')) if data.get('expires_at') else None,
            metadata=data.get('metadata', {})
        )
        
        # Schedule notification
        notification_service = NotificationService()
        notification_id = notification_service.schedule_notification(request)
        
        return jsonify({
            "notification_id": str(notification_id),
            "scheduled_at": scheduled_at.isoformat() + "Z",
            "message": "Notification scheduled successfully"
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message="Invalid data format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to schedule notification",
            code="TITHI_NOTIFICATION_SCHEDULE_ERROR"
        )


@notification_bp.route("/process-scheduled", methods=["POST"])
@require_auth
@require_tenant
def process_scheduled_notifications():
    """Process all scheduled notifications."""
    try:
        notification_service = NotificationService()
        results = notification_service.process_all_scheduled()
        
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        
        return jsonify({
            "processed": len(results),
            "successful": successful,
            "failed": failed,
            "results": [{
                "success": r.success,
                "notification_id": str(r.notification_id) if r.notification_id else None,
                "error": r.error_message
            } for r in results]
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to process scheduled notifications",
            code="TITHI_NOTIFICATION_PROCESS_ERROR"
        )


# Analytics Endpoints

@notification_bp.route("/analytics", methods=["GET"])
@require_auth
@require_tenant
def get_notification_analytics():
    """Get notification analytics and statistics."""
    try:
        # Get date range
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to last 30 days
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
        
        tenant_id = g.tenant_id
        notification_service = NotificationService()
        
        analytics = notification_service.get_analytics(tenant_id, start_date, end_date)
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat() + "Z",
                "end_date": end_date.isoformat() + "Z"
            },
            "analytics": analytics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except Exception as e:
        raise TithiError(
            message="Failed to get notification analytics",
            code="TITHI_NOTIFICATION_ANALYTICS_ERROR"
        )


@notification_bp.route("/templates/<template_id>/performance", methods=["GET"])
@require_auth
@require_tenant
def get_template_performance(template_id: str):
    """Get template performance metrics."""
    try:
        tenant_id = g.tenant_id
        
        # Validate template exists
        template = NotificationTemplate.query.filter_by(
            id=uuid.UUID(template_id),
            tenant_id=tenant_id
        ).first()
        
        if not template:
            raise TithiError(
                message="Template not found",
                code="TITHI_NOTIFICATION_TEMPLATE_NOT_FOUND",
                status_code=404
            )
        
        notification_service = NotificationService()
        performance = notification_service.analytics.get_template_performance(
            tenant_id, uuid.UUID(template_id)
        )
        
        return jsonify({
            "template_id": template_id,
            "performance": performance
        }), 200
        
    except ValueError:
        raise TithiError(
            message="Invalid template ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get template performance",
            code="TITHI_NOTIFICATION_TEMPLATE_PERFORMANCE_ERROR"
        )


# Event Types Management

@notification_bp.route("/event-types", methods=["GET"])
@require_auth
@require_tenant
def list_event_types():
    """List available notification event types."""
    try:
        event_types = NotificationEventType.query.all()
        
        return jsonify({
            "event_types": [{
                "code": event_type.code,
                "description": event_type.description
            } for event_type in event_types],
            "total": len(event_types)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list event types",
            code="TITHI_NOTIFICATION_EVENT_TYPES_ERROR"
        )


@notification_bp.route("/channels", methods=["GET"])
@require_auth
@require_tenant
def list_channels():
    """List available notification channels."""
    try:
        channels = [
            {"value": channel.value, "label": channel.value.title()}
            for channel in NotificationChannel
        ]
        
        return jsonify({
            "channels": channels,
            "total": len(channels)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list channels",
            code="TITHI_NOTIFICATION_CHANNELS_ERROR"
        )


@notification_bp.route("/priorities", methods=["GET"])
@require_auth
@require_tenant
def list_priorities():
    """List available notification priorities."""
    try:
        priorities = [
            {"value": priority.value, "label": priority.value.title()}
            for priority in NotificationPriority
        ]
        
        return jsonify({
            "priorities": priorities,
            "total": len(priorities)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list priorities",
            code="TITHI_NOTIFICATION_PRIORITIES_ERROR"
        )
