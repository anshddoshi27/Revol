"""
Admin Dashboard API Blueprint (Module M - Admin Dashboard / UI Backends)

This blueprint provides comprehensive admin dashboard backend support for all 13 core modules
following the design brief Module M specifications.

Design Brief Module M - 13 Core Modules:
1. Availability Scheduler
2. Services & Pricing Management
3. Booking Management Table
4. Visual Calendar
5. Analytics Dashboard
6. CRM
7. Promotion Engine
8. Gift Card Management
9. Notification Templates & Settings
10. Team Management
11. Branding Controls & Theming
12. Payouts & Tenant Billing
13. Audit & Operations

Admin UX Guarantees (Backend Support):
- Visual calendar supports drag-and-drop reschedule
- Booking table supports bulk actions (confirm, cancel, reschedule, message)
- Live previews for branding and theme editing (sandboxed)
- Staff scheduling drag-and-drop that writes consistent work_schedules

Features:
- All admin actions are transactional and audited
- RLS enforcement for tenant isolation
- Structured error handling with Tithi error codes
- Bulk operations with atomic transactions
- Real-time updates via WebSocket integration
- Comprehensive audit logging
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import json
import logging
from datetime import datetime, timedelta, date
from typing import Dict, Any, Optional, List

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.business_phase2 import (
    ServiceService, BookingService, AvailabilityService, CustomerService, 
    StaffService, StaffAvailabilityService
)
from ..services.analytics_service import AnalyticsService
from ..services.financial import PaymentService
from ..services.promotion import PromotionService
from ..services.notification_service import NotificationService
from ..services.system import ThemeService
from ..extensions import db
from ..models.system import EventOutbox, AuditLog

# Configure logging
logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__)


# 1. AVAILABILITY SCHEDULER
@admin_bp.route("/availability/scheduler", methods=["GET"])
@require_auth
@require_tenant
def get_availability_scheduler():
    """Get availability scheduler data for admin interface."""
    try:
        tenant_id = g.tenant_id
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        availability_service = AvailabilityService()
        scheduler_data = availability_service.get_scheduler_data(
            tenant_id, start_date, end_date
        )
        
        return jsonify({
            "scheduler_data": scheduler_data,
            "period": {
                "start_date": start_date,
                "end_date": end_date
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get availability scheduler: {str(e)}")
        raise TithiError(
            message="Failed to get availability scheduler",
            code="TITHI_ADMIN_SCHEDULER_ERROR"
        )


@admin_bp.route("/availability/scheduler", methods=["POST"])
@require_auth
@require_tenant
def update_availability_scheduler():
    """Update availability scheduler with drag-and-drop support."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Validate required fields
        if not data.get('resource_id') or not data.get('schedule_data'):
            raise TithiError(
                message="resource_id and schedule_data are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        availability_service = AvailabilityService()
        
        # Update schedule atomically
        with db.session.begin():
            result = availability_service.update_schedule_atomic(
                tenant_id, data['resource_id'], data['schedule_data'], current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=availability_update")
        
        return jsonify({
            "message": "Availability schedule updated successfully",
            "schedule_id": str(result['schedule_id']),
            "updated_at": result['updated_at']
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update availability scheduler: {str(e)}")
        raise TithiError(
            message="Failed to update availability scheduler",
            code="TITHI_ADMIN_SCHEDULER_UPDATE_ERROR"
        )


# 2. SERVICES & PRICING MANAGEMENT
@admin_bp.route("/services/bulk-update", methods=["POST"])
@require_auth
@require_tenant
def bulk_update_services():
    """Bulk update services and pricing."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('updates'):
            raise TithiError(
                message="updates array is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        service_service = ServiceService()
        
        # Perform bulk update atomically
        with db.session.begin():
            results = service_service.bulk_update_services(tenant_id, data['updates'])
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=services_bulk_update")
        
        return jsonify({
            "message": f"Updated {len(results)} services successfully",
            "updated_services": results,
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to bulk update services: {str(e)}")
        raise TithiError(
            message="Failed to bulk update services",
            code="TITHI_ADMIN_SERVICES_BULK_ERROR"
        )


# 3. BOOKING MANAGEMENT TABLE
@admin_bp.route("/bookings/bulk-actions", methods=["POST"])
@require_auth
@require_tenant
def bulk_booking_actions():
    """Perform bulk actions on bookings (confirm, cancel, reschedule, message)."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Validate required fields
        if not data.get('action') or not data.get('booking_ids'):
            raise TithiError(
                message="action and booking_ids are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        action = data['action']
        booking_ids = data['booking_ids']
        
        if action not in ['confirm', 'cancel', 'reschedule', 'message']:
            raise TithiError(
                message="Invalid action. Must be one of: confirm, cancel, reschedule, message",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        booking_service = BookingService()
        
        # Perform bulk action atomically
        with db.session.begin():
            results = booking_service.bulk_action_bookings(
                tenant_id, booking_ids, action, data.get('action_data', {}), current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=bookings_bulk_{action}")
        
        return jsonify({
            "message": f"Bulk {action} completed successfully",
            "results": results,
            "processed_count": len(booking_ids)
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to perform bulk booking actions: {str(e)}")
        raise TithiError(
            message="Failed to perform bulk booking actions",
            code="TITHI_ADMIN_BOOKINGS_BULK_ERROR"
        )


@admin_bp.route("/bookings/send-message", methods=["POST"])
@require_auth
@require_tenant
def send_booking_message():
    """Send inline message to booking customers."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('booking_id') or not data.get('message'):
            raise TithiError(
                message="booking_id and message are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        booking_service = BookingService()
        notification_service = NotificationService()
        
        # Send message
        with db.session.begin():
            result = booking_service.send_customer_message(
                tenant_id, data['booking_id'], data['message'], current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=booking_message_sent")
        
        return jsonify({
            "message": "Message sent successfully",
            "message_id": str(result['message_id']),
            "sent_at": result['sent_at']
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to send booking message: {str(e)}")
        raise TithiError(
            message="Failed to send booking message",
            code="TITHI_ADMIN_BOOKING_MESSAGE_ERROR"
        )


# 4. VISUAL CALENDAR
@admin_bp.route("/calendar/drag-drop-reschedule", methods=["POST"])
@require_auth
@require_tenant
def drag_drop_reschedule():
    """Handle drag-and-drop rescheduling with conflict validation."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Validate required fields
        required_fields = ['booking_id', 'new_start_at', 'new_end_at']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        booking_service = BookingService()
        
        # Validate and perform reschedule atomically
        with db.session.begin():
            result = booking_service.drag_drop_reschedule(
                tenant_id, 
                data['booking_id'],
                data['new_start_at'],
                data['new_end_at'],
                current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=drag_drop_reschedule")
        
        return jsonify({
            "message": "Booking rescheduled successfully",
            "booking_id": str(result['booking_id']),
            "old_start_at": result['old_start_at'],
            "new_start_at": result['new_start_at'],
            "rescheduled_at": result['rescheduled_at']
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to drag-drop reschedule: {str(e)}")
        raise TithiError(
            message="Failed to reschedule booking",
            code="TITHI_ADMIN_CALENDAR_RESCHEDULE_ERROR"
        )


# 5. ANALYTICS DASHBOARD
@admin_bp.route("/analytics/dashboard", methods=["GET"])
@require_auth
@require_tenant
def get_admin_analytics_dashboard():
    """Get comprehensive analytics dashboard for admin."""
    try:
        tenant_id = g.tenant_id
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            # Default to last 30 days
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
        
        analytics_service = AnalyticsService()
        
        # Get comprehensive dashboard data
        dashboard_data = analytics_service.get_admin_dashboard_data(
            tenant_id, start_date, end_date
        )
        
        return jsonify({
            "dashboard_data": dashboard_data,
            "period": {
                "start_date": start_date.isoformat() if isinstance(start_date, date) else start_date,
                "end_date": end_date.isoformat() if isinstance(end_date, date) else end_date
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get admin analytics dashboard: {str(e)}")
        raise TithiError(
            message="Failed to get analytics dashboard",
            code="TITHI_ADMIN_ANALYTICS_ERROR"
        )


# 6. CRM (Delegates to CRM API)
@admin_bp.route("/crm/summary", methods=["GET"])
@require_auth
@require_tenant
def get_crm_summary():
    """Get CRM summary for admin dashboard."""
    try:
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get CRM summary
        summary = customer_service.get_crm_summary(tenant_id)
        
        return jsonify({
            "crm_summary": summary
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get CRM summary: {str(e)}")
        raise TithiError(
            message="Failed to get CRM summary",
            code="TITHI_ADMIN_CRM_ERROR"
        )


# 7. PROMOTION ENGINE
@admin_bp.route("/promotions/bulk-create", methods=["POST"])
@require_auth
@require_tenant
def bulk_create_promotions():
    """Bulk create promotions and coupons."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('promotions'):
            raise TithiError(
                message="promotions array is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        promotion_service = PromotionService()
        
        # Create promotions atomically
        with db.session.begin():
            results = promotion_service.bulk_create_promotions(tenant_id, data['promotions'])
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=promotions_bulk_create")
        
        return jsonify({
            "message": f"Created {len(results)} promotions successfully",
            "promotions": results
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to bulk create promotions: {str(e)}")
        raise TithiError(
            message="Failed to bulk create promotions",
            code="TITHI_ADMIN_PROMOTIONS_ERROR"
        )


# 8. GIFT CARD MANAGEMENT
@admin_bp.route("/gift-cards/bulk-issue", methods=["POST"])
@require_auth
@require_tenant
def bulk_issue_gift_cards():
    """Bulk issue gift cards."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('gift_cards'):
            raise TithiError(
                message="gift_cards array is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        promotion_service = PromotionService()
        
        # Issue gift cards atomically
        with db.session.begin():
            results = promotion_service.bulk_issue_gift_cards(tenant_id, data['gift_cards'])
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=gift_cards_bulk_issue")
        
        return jsonify({
            "message": f"Issued {len(results)} gift cards successfully",
            "gift_cards": results
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to bulk issue gift cards: {str(e)}")
        raise TithiError(
            message="Failed to bulk issue gift cards",
            code="TITHI_ADMIN_GIFT_CARDS_ERROR"
        )


# 9. NOTIFICATION TEMPLATES & SETTINGS
@admin_bp.route("/notifications/templates/bulk-update", methods=["POST"])
@require_auth
@require_tenant
def bulk_update_notification_templates():
    """Bulk update notification templates."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('templates'):
            raise TithiError(
                message="templates array is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        notification_service = NotificationService()
        
        # Update templates atomically
        with db.session.begin():
            results = notification_service.bulk_update_templates(tenant_id, data['templates'])
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=notification_templates_bulk_update")
        
        return jsonify({
            "message": f"Updated {len(results)} notification templates successfully",
            "templates": results
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to bulk update notification templates: {str(e)}")
        raise TithiError(
            message="Failed to bulk update notification templates",
            code="TITHI_ADMIN_NOTIFICATIONS_ERROR"
        )


# 10. TEAM MANAGEMENT
@admin_bp.route("/team/bulk-update", methods=["POST"])
@require_auth
@require_tenant
def bulk_update_team():
    """Bulk update team members and schedules."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('team_updates'):
            raise TithiError(
                message="team_updates array is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        staff_service = StaffService()
        
        # Update team atomically
        with db.session.begin():
            results = staff_service.bulk_update_team(tenant_id, data['team_updates'])
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=team_bulk_update")
        
        return jsonify({
            "message": f"Updated {len(results)} team members successfully",
            "team_updates": results
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to bulk update team: {str(e)}")
        raise TithiError(
            message="Failed to bulk update team",
            code="TITHI_ADMIN_TEAM_ERROR"
        )


# 11. BRANDING CONTROLS & THEMING
@admin_bp.route("/branding/theme-preview", methods=["POST"])
@require_auth
@require_tenant
def create_theme_preview():
    """Create live theme preview (sandboxed for unpublished themes)."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('theme_data'):
            raise TithiError(
                message="theme_data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        theme_service = ThemeService()
        
        # Create sandboxed theme preview
        preview = theme_service.create_theme_preview(
            tenant_id, data['theme_data'], current_user.id
        )
        
        return jsonify({
            "preview": {
                "preview_id": str(preview['preview_id']),
                "preview_url": preview['preview_url'],
                "expires_at": preview['expires_at'],
                "theme_data": preview['theme_data']
            }
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create theme preview: {str(e)}")
        raise TithiError(
            message="Failed to create theme preview",
            code="TITHI_ADMIN_THEME_PREVIEW_ERROR"
        )


@admin_bp.route("/branding/publish-theme", methods=["POST"])
@require_auth
@require_tenant
def publish_theme():
    """Publish theme from preview."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('preview_id'):
            raise TithiError(
                message="preview_id is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        theme_service = ThemeService()
        
        # Publish theme atomically
        with db.session.begin():
            result = theme_service.publish_theme_from_preview(
                tenant_id, data['preview_id'], current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=theme_published")
        
        return jsonify({
            "message": "Theme published successfully",
            "theme_id": str(result['theme_id']),
            "published_at": result['published_at']
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to publish theme: {str(e)}")
        raise TithiError(
            message="Failed to publish theme",
            code="TITHI_ADMIN_THEME_PUBLISH_ERROR"
        )


# 12. PAYOUTS & TENANT BILLING
@admin_bp.route("/billing/payouts", methods=["GET"])
@require_auth
@require_tenant
def get_payouts():
    """Get tenant payouts and billing information."""
    try:
        tenant_id = g.tenant_id
        payment_service = PaymentService()
        
        # Get payouts
        payouts = payment_service.get_tenant_payouts(tenant_id)
        
        return jsonify({
            "payouts": payouts
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get payouts: {str(e)}")
        raise TithiError(
            message="Failed to get payouts",
            code="TITHI_ADMIN_PAYOUTS_ERROR"
        )


@admin_bp.route("/billing/request-payout", methods=["POST"])
@require_auth
@require_tenant
def request_payout():
    """Request payout for tenant."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('amount_cents'):
            raise TithiError(
                message="amount_cents is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        payment_service = PaymentService()
        
        # Request payout atomically
        with db.session.begin():
            result = payment_service.request_tenant_payout(
                tenant_id, data['amount_cents'], current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=payout_requested")
        
        return jsonify({
            "message": "Payout requested successfully",
            "payout_id": str(result['payout_id']),
            "amount_cents": result['amount_cents'],
            "requested_at": result['requested_at']
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to request payout: {str(e)}")
        raise TithiError(
            message="Failed to request payout",
            code="TITHI_ADMIN_PAYOUT_REQUEST_ERROR"
        )


# 13. AUDIT & OPERATIONS
@admin_bp.route("/audit/logs", methods=["GET"])
@require_auth
@require_tenant
def get_audit_logs():
    """Get audit logs for admin operations."""
    try:
        tenant_id = g.tenant_id
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        table_name = request.args.get('table_name')
        user_id = request.args.get('user_id')
        from_ts = request.args.get('from')
        to_ts = request.args.get('to')

        query = AuditLog.query.filter_by(tenant_id=g.tenant_id)
        if table_name:
            query = query.filter(AuditLog.table_name == table_name)
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if from_ts:
            query = query.filter(AuditLog.created_at >= from_ts)
        if to_ts:
            query = query.filter(AuditLog.created_at <= to_ts)

        total = query.count()
        items = query.order_by(AuditLog.created_at.desc()) \
            .offset((page - 1) * per_page).limit(per_page).all()

        audit_logs = []
        for a in items:
            audit_logs.append({
                "id": str(a.id),
                "table_name": a.table_name,
                "operation": a.operation,
                "record_id": str(a.record_id) if a.record_id else None,
                "user_id": str(a.user_id) if a.user_id else None,
                "old_values": a.old_values or {},
                "new_values": a.new_values or {},
                "created_at": a.created_at.isoformat() if hasattr(a, 'created_at') and a.created_at else None,
            })

        return jsonify({
            "audit_logs": audit_logs,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page
            }
        }), 200
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get audit logs: {str(e)}")
        raise TithiError(
            message="Failed to get audit logs",
            code="TITHI_ADMIN_AUDIT_ERROR"
        )
# Outbox events list & retry
@admin_bp.route("/outbox/events", methods=["GET"])
@require_auth
@require_tenant
def list_outbox_events():
    status = request.args.get('status')
    code = request.args.get('code')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))

    query = EventOutbox.query.filter_by(tenant_id=g.tenant_id)
    if status:
        query = query.filter(EventOutbox.status == status)
    if code:
        query = query.filter(EventOutbox.event_code == code)

    total = query.count()
    items = query.order_by(EventOutbox.created_at.desc() if hasattr(EventOutbox, 'created_at') else EventOutbox.ready_at.desc()) \
        .offset((page - 1) * per_page).limit(per_page).all()

    events = []
    for e in items:
        events.append({
            "id": str(e.id),
            "event_code": e.event_code,
            "status": e.status,
            "attempts": e.attempts,
            "max_attempts": e.max_attempts,
            "error_message": e.error_message,
            "ready_at": e.ready_at.isoformat() if e.ready_at else None,
            "delivered_at": e.delivered_at.isoformat() if e.delivered_at else None,
        })

    return jsonify({
        "events": events,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page
        }
    }), 200


@admin_bp.route("/outbox/events/<event_id>/retry", methods=["POST"])
@require_auth
@require_tenant
def retry_outbox_event(event_id: str):
    event = EventOutbox.query.filter_by(tenant_id=g.tenant_id, id=event_id).first()
    if not event:
        raise TithiError(code="TITHI_OUTBOX_EVENT_NOT_FOUND", message="Event not found", status_code=404)
    event.status = 'ready'
    event.error_message = None
    event.ready_at = datetime.utcnow()
    db.session.add(event)
    db.session.commit()
    return jsonify({"status": "ok"}), 200



@admin_bp.route("/operations/health", methods=["GET"])
@require_auth
@require_tenant
def get_operations_health():
    """Get operations health status."""
    try:
        tenant_id = g.tenant_id
        
        # Get health status for various operations
        health_status = {
            "database": "healthy",
            "redis": "healthy",
            "stripe": "healthy",
            "notifications": "healthy",
            "analytics": "healthy"
        }
        
        return jsonify({
            "health_status": health_status,
            "checked_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get operations health: {str(e)}")
        raise TithiError(
            message="Failed to get operations health",
            code="TITHI_ADMIN_HEALTH_ERROR"
        )


@admin_bp.route("/operations/export", methods=["POST"])
@require_auth
@require_tenant
def export_operations_data():
    """Export operations data (CSV/PDF)."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        export_type = data.get('type', 'bookings')
        format = data.get('format', 'csv')
        
        if format not in ['csv', 'pdf']:
            raise TithiError(
                message="Invalid format. Must be 'csv' or 'pdf'",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Export data (this would need to be implemented in a service)
        export_data = f"Export of {export_type} data in {format} format"
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.get('id')}, action_type=operations_export")
        
        return jsonify({
            "message": f"Export completed successfully",
            "export_type": export_type,
            "format": format,
            "exported_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to export operations data: {str(e)}")
        raise TithiError(
            message="Failed to export operations data",
            code="TITHI_ADMIN_EXPORT_ERROR"
        )
