"""
Automation API Blueprint
RESTful API endpoints for automated reminders and campaigns
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.automation_service import AutomationService
from ..extensions import db
from ..models.audit import EventOutbox

# Configure logging
logger = logging.getLogger(__name__)

automation_bp = Blueprint("automation", __name__)


@automation_bp.route("/automations", methods=["POST"])
@require_auth
@require_tenant
def create_automation():
    """Create a new automation."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        automation_service = AutomationService()
        automation_id = automation_service.create_automation(
            tenant_id, data, str(current_user.id)
        )
        
        return jsonify({
            "automation_id": automation_id,
            "message": "Automation created successfully"
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create automation: {str(e)}")
        raise TithiError(
            message="Failed to create automation",
            code="TITHI_AUTOMATION_CREATE_ERROR"
        )


@automation_bp.route("/automations", methods=["GET"])
@require_auth
@require_tenant
def list_automations():
    """List automations with filtering and pagination."""
    try:
        tenant_id = g.tenant_id
        
        # Parse query parameters
        status = request.args.get('status')
        trigger_type = request.args.get('trigger_type')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        automation_service = AutomationService()
        result = automation_service.list_automations(
            tenant_id, status, trigger_type, limit, offset
        )
        
        return jsonify(result), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to list automations: {str(e)}")
        raise TithiError(
            message="Failed to list automations",
            code="TITHI_AUTOMATION_LIST_ERROR"
        )


@automation_bp.route("/automations/<automation_id>", methods=["GET"])
@require_auth
@require_tenant
def get_automation(automation_id: str):
    """Get automation by ID."""
    try:
        tenant_id = g.tenant_id
        
        automation_service = AutomationService()
        automation = automation_service.get_automation(tenant_id, automation_id)
        
        return jsonify(automation), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get automation: {str(e)}")
        raise TithiError(
            message="Failed to get automation",
            code="TITHI_AUTOMATION_GET_ERROR"
        )


@automation_bp.route("/automations/<automation_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_automation(automation_id: str):
    """Update automation."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        automation_service = AutomationService()
        automation = automation_service.update_automation(tenant_id, automation_id, data)
        
        return jsonify({
            "automation": automation,
            "message": "Automation updated successfully"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update automation: {str(e)}")
        raise TithiError(
            message="Failed to update automation",
            code="TITHI_AUTOMATION_UPDATE_ERROR"
        )


@automation_bp.route("/automations/<automation_id>/cancel", methods=["POST"])
@require_auth
@require_tenant
def cancel_automation(automation_id: str):
    """Cancel automation."""
    try:
        tenant_id = g.tenant_id
        
        automation_service = AutomationService()
        automation = automation_service.cancel_automation(tenant_id, automation_id)
        
        return jsonify({
            "automation": automation,
            "message": "Automation cancelled successfully"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel automation: {str(e)}")
        raise TithiError(
            message="Failed to cancel automation",
            code="TITHI_AUTOMATION_CANCEL_ERROR"
        )


@automation_bp.route("/automations/<automation_id>/execute", methods=["POST"])
@require_auth
@require_tenant
def execute_automation(automation_id: str):
    """Execute automation manually."""
    try:
        data = request.get_json() or {}
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Add user context to trigger data
        trigger_data = {
            **data,
            'user_id': str(current_user.id),
            'tenant_id': tenant_id,
            'executed_at': datetime.utcnow().isoformat()
        }
        
        automation_service = AutomationService()
        result = automation_service.execute_automation(automation_id, trigger_data)
        
        return jsonify({
            "result": result,
            "message": "Automation executed successfully" if result['executed'] else f"Automation not executed: {result.get('reason')}"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to execute automation: {str(e)}")
        raise TithiError(
            message="Failed to execute automation",
            code="TITHI_AUTOMATION_EXECUTE_ERROR"
        )


@automation_bp.route("/automations/<automation_id>/executions", methods=["GET"])
@require_auth
@require_tenant
def get_automation_executions(automation_id: str):
    """Get automation execution history."""
    try:
        tenant_id = g.tenant_id
        
        # Parse query parameters
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        
        automation_service = AutomationService()
        result = automation_service.get_automation_executions(
            tenant_id, automation_id, limit, offset
        )
        
        return jsonify(result), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get automation executions: {str(e)}")
        raise TithiError(
            message="Failed to get automation executions",
            code="TITHI_AUTOMATION_EXECUTIONS_ERROR"
        )


@automation_bp.route("/automations/process-scheduled", methods=["POST"])
@require_auth
@require_tenant
def process_scheduled_automations():
    """Process scheduled automations (admin endpoint)."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Check if user has admin permissions
        if not hasattr(current_user, 'role') or current_user.role not in ['owner', 'admin']:
            raise TithiError(
                message="Insufficient permissions",
                code="TITHI_PERMISSION_DENIED",
                status_code=403
            )
        
        automation_service = AutomationService()
        result = automation_service.process_scheduled_automations()
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=process_scheduled_automations")
        
        return jsonify({
            "result": result,
            "message": f"Processed {result['executed']} automations successfully"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to process scheduled automations: {str(e)}")
        raise TithiError(
            message="Failed to process scheduled automations",
            code="TITHI_AUTOMATION_SCHEDULE_PROCESS_ERROR"
        )


@automation_bp.route("/automations/templates", methods=["GET"])
@require_auth
@require_tenant
def get_automation_templates():
    """Get automation templates for common use cases."""
    try:
        templates = [
            {
                "id": "booking_reminder_24h",
                "name": "24-Hour Booking Reminder",
                "description": "Send reminder 24 hours before booking",
                "trigger_type": "booking_confirmed",
                "action_type": "send_email",
                "trigger_config": {
                    "delay_hours": 24
                },
                "action_config": {
                    "template_id": "booking_reminder_template",
                    "subject": "Reminder: Your appointment is tomorrow"
                },
                "schedule_expression": None
            },
            {
                "id": "booking_reminder_1h",
                "name": "1-Hour Booking Reminder",
                "description": "Send reminder 1 hour before booking",
                "trigger_type": "booking_confirmed",
                "action_type": "send_sms",
                "trigger_config": {
                    "delay_hours": 1
                },
                "action_config": {
                    "content": "Reminder: Your appointment is in 1 hour"
                },
                "schedule_expression": None
            },
            {
                "id": "welcome_email",
                "name": "Welcome Email",
                "description": "Send welcome email to new customers",
                "trigger_type": "customer_registered",
                "action_type": "send_email",
                "trigger_config": {},
                "action_config": {
                    "template_id": "welcome_template",
                    "subject": "Welcome to our service!"
                },
                "schedule_expression": None
            },
            {
                "id": "follow_up_campaign",
                "name": "Follow-up Campaign",
                "description": "Send follow-up emails to customers after booking completion",
                "trigger_type": "booking_completed",
                "action_type": "send_email",
                "trigger_config": {
                    "delay_hours": 24
                },
                "action_config": {
                    "template_id": "follow_up_template",
                    "subject": "How was your experience?"
                },
                "schedule_expression": None
            },
            {
                "id": "weekly_newsletter",
                "name": "Weekly Newsletter",
                "description": "Send weekly newsletter to all customers",
                "trigger_type": "scheduled_time",
                "action_type": "send_email",
                "trigger_config": {},
                "action_config": {
                    "template_id": "newsletter_template",
                    "subject": "Weekly Newsletter"
                },
                "schedule_expression": "0 9 * * 1"  # Every Monday at 9 AM
            }
        ]
        
        return jsonify({
            "templates": templates,
            "total_count": len(templates)
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get automation templates: {str(e)}")
        raise TithiError(
            message="Failed to get automation templates",
            code="TITHI_AUTOMATION_TEMPLATES_ERROR"
        )


@automation_bp.route("/automations/<automation_id>/test", methods=["POST"])
@require_auth
@require_tenant
def test_automation(automation_id: str):
    """Test automation with sample data."""
    try:
        data = request.get_json() or {}
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Add test context to trigger data
        trigger_data = {
            **data,
            'user_id': str(current_user.id),
            'tenant_id': tenant_id,
            'test_mode': True,
            'executed_at': datetime.utcnow().isoformat()
        }
        
        automation_service = AutomationService()
        result = automation_service.execute_automation(automation_id, trigger_data)
        
        return jsonify({
            "result": result,
            "message": "Automation test completed",
            "test_mode": True
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to test automation: {str(e)}")
        raise TithiError(
            message="Failed to test automation",
            code="TITHI_AUTOMATION_TEST_ERROR"
        )


@automation_bp.route("/automations/stats", methods=["GET"])
@require_auth
@require_tenant
def get_automation_stats():
    """Get automation statistics for the tenant."""
    try:
        tenant_id = g.tenant_id
        
        # Get basic statistics
        from ..models.automation import Automation, AutomationExecution, AutomationStatus
        
        total_automations = Automation.query.filter_by(
            tenant_id=tenant_id, is_active=True
        ).count()
        
        active_automations = Automation.query.filter_by(
            tenant_id=tenant_id, 
            is_active=True,
            status=AutomationStatus.ACTIVE
        ).count()
        
        total_executions = AutomationExecution.query.filter_by(
            tenant_id=tenant_id
        ).count()
        
        successful_executions = AutomationExecution.query.filter(
            AutomationExecution.tenant_id == tenant_id,
            AutomationExecution.execution_status == 'completed'
        ).count()
        
        # Get executions from last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_executions = AutomationExecution.query.filter(
            AutomationExecution.tenant_id == tenant_id,
            AutomationExecution.created_at >= thirty_days_ago
        ).count()
        
        success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
        
        stats = {
            "total_automations": total_automations,
            "active_automations": active_automations,
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "recent_executions_30d": recent_executions,
            "success_rate_percent": round(success_rate, 2)
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Failed to get automation stats: {str(e)}")
        raise TithiError(
            message="Failed to get automation stats",
            code="TITHI_AUTOMATION_STATS_ERROR"
        )
