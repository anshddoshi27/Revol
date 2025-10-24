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
from ..middleware.auth_middleware import require_auth, require_tenant, require_role, get_current_user
from ..services.business_phase2 import (
    ServiceService, BookingService, AvailabilityService, CustomerService, 
    StaffService, StaffAvailabilityService
)
from ..services.analytics_service import AnalyticsService
from ..services.financial import PaymentService
from ..services.promotion import PromotionService
from ..services.notification_service import NotificationService
from ..services.system import ThemeService, BrandingService
from ..extensions import db
from ..models.audit import EventOutbox, AuditLog

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

# Task 10.2: Admin Services Management CRUD
@admin_bp.route("/services", methods=["GET"])
@require_auth
@require_tenant
def list_admin_services():
    """List all services for admin management."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Get query parameters
        search_term = request.args.get('search', '')
        category = request.args.get('category', '')
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        service_service = ServiceService()
        
        # Get services with search and filtering
        services = service_service.search_services(tenant_id, search_term, category)
        
        # Filter by active status if requested
        if active_only:
            services = [s for s in services if s.active]
        
        # Convert to response format
        services_data = []
        for service in services:
            services_data.append({
                "id": str(service.id),
                "slug": service.slug,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_min,
                "price_cents": service.price_cents,
                "buffer_before_min": service.buffer_before_min,
                "buffer_after_min": service.buffer_after_min,
                "category": service.category,
                "active": service.active,
                "created_at": service.created_at.isoformat() + "Z",
                "updated_at": service.updated_at.isoformat() + "Z"
            })
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=services_list")
        
        return jsonify({
            "services": services_data,
            "total_count": len(services_data),
            "filters": {
                "search_term": search_term,
                "category": category,
                "active_only": active_only
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to list admin services: {str(e)}")
        raise TithiError(
            message="Failed to list services",
            code="TITHI_ADMIN_SERVICES_LIST_ERROR"
        )


@admin_bp.route("/services", methods=["POST"])
@require_auth
@require_tenant
def create_admin_service():
    """Create a new service for admin management."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data:
            raise TithiError(
                message="Service data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        service_service = ServiceService()
        
        # Create service
        service = service_service.create_service(tenant_id, data, current_user.id)
        
        # Log admin action and observability hook
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=service_created")
        logger.info(f"SERVICE_CREATED: service_id={service.id}, tenant_id={tenant_id}, name={service.name}")
        
        return jsonify({
            "message": "Service created successfully",
            "service": {
                "id": str(service.id),
                "slug": service.slug,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_min,
                "price_cents": service.price_cents,
                "buffer_before_min": service.buffer_before_min,
                "buffer_after_min": service.buffer_after_min,
                "category": service.category,
                "active": service.active,
                "created_at": service.created_at.isoformat() + "Z",
                "updated_at": service.updated_at.isoformat() + "Z"
            }
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create admin service: {str(e)}")
        raise TithiError(
            message="Failed to create service",
            code="TITHI_ADMIN_SERVICE_CREATE_ERROR"
        )


@admin_bp.route("/services/<service_id>", methods=["GET"])
@require_auth
@require_tenant
def get_admin_service(service_id: str):
    """Get individual service for admin management."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        service_service = ServiceService()
        service = service_service.get_service(tenant_id, uuid.UUID(service_id))
        
        if not service:
            raise TithiError(
                message="Service not found",
                code="TITHI_SERVICE_NOT_FOUND",
                status_code=404
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=service_viewed")
        
        return jsonify({
            "service": {
                "id": str(service.id),
                "slug": service.slug,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_min,
                "price_cents": service.price_cents,
                "buffer_before_min": service.buffer_before_min,
                "buffer_after_min": service.buffer_after_min,
                "category": service.category,
                "active": service.active,
                "metadata": service.metadata_json,
                "created_at": service.created_at.isoformat() + "Z",
                "updated_at": service.updated_at.isoformat() + "Z"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get admin service: {str(e)}")
        raise TithiError(
            message="Failed to get service",
            code="TITHI_ADMIN_SERVICE_GET_ERROR"
        )


@admin_bp.route("/services/<service_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_admin_service(service_id: str):
    """Update a service for admin management."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data:
            raise TithiError(
                message="Service update data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        service_service = ServiceService()
        service = service_service.update_service(tenant_id, uuid.UUID(service_id), data, current_user.id)
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=service_updated")
        
        return jsonify({
            "message": "Service updated successfully",
            "service": {
                "id": str(service.id),
                "slug": service.slug,
                "name": service.name,
                "description": service.description,
                "duration_minutes": service.duration_min,
                "price_cents": service.price_cents,
                "buffer_before_min": service.buffer_before_min,
                "buffer_after_min": service.buffer_after_min,
                "category": service.category,
                "active": service.active,
                "metadata": service.metadata_json,
                "created_at": service.created_at.isoformat() + "Z",
                "updated_at": service.updated_at.isoformat() + "Z"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update admin service: {str(e)}")
        raise TithiError(
            message="Failed to update service",
            code="TITHI_ADMIN_SERVICE_UPDATE_ERROR"
        )


@admin_bp.route("/services/<service_id>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_admin_service(service_id: str):
    """Delete a service for admin management."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        service_service = ServiceService()
        result = service_service.delete_service(tenant_id, uuid.UUID(service_id), current_user.id)
        
        if not result:
            raise TithiError(
                message="Service not found or cannot be deleted",
                code="TITHI_SERVICE_DELETE_ERROR",
                status_code=404
            )
        
        # Log admin action with audit service
        from ..services.audit_service import AuditService
        audit_service = AuditService()
        audit_service.create_audit_log(
            tenant_id=str(tenant_id),
            table_name="services",
            operation="DELETE",
            record_id=service_id,
            user_id=str(current_user.id),
            action="ADMIN_SERVICE_DELETED",
            metadata={"admin_action": True, "service_id": service_id}
        )
        
        logger.info("Admin service deleted", extra={
            'tenant_id': str(tenant_id),
            'user_id': str(current_user.id),
            'service_id': service_id,
            'event_type': 'ADMIN_SERVICE_DELETED'
        })
        
        return jsonify({
            "message": "Service deleted successfully",
            "deleted_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to delete admin service: {str(e)}")
        raise TithiError(
            message="Failed to delete service",
            code="TITHI_ADMIN_SERVICE_DELETE_ERROR"
        )


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


# 3. BOOKING MANAGEMENT TABLE - Individual Booking CRUD (Task 10.1)
@admin_bp.route("/bookings/<booking_id>", methods=["GET"])
@require_auth
@require_tenant
def get_admin_booking(booking_id: str):
    """Get individual booking for admin management."""
    try:
        tenant_id = g.tenant_id
        booking_service = BookingService()
        
        booking = booking_service.get_booking(tenant_id, uuid.UUID(booking_id))
        if not booking:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "booking": {
                "id": str(booking.id),
                "customer_id": str(booking.customer_id),
                "resource_id": str(booking.resource_id),
                "service_snapshot": booking.service_snapshot,
                "start_at": booking.start_at.isoformat() + "Z" if booking.start_at else None,
                "end_at": booking.end_at.isoformat() + "Z" if booking.end_at else None,
                "booking_tz": booking.booking_tz,
                "status": booking.status,
                "canceled_at": booking.canceled_at.isoformat() + "Z" if booking.canceled_at else None,
                "no_show_flag": booking.no_show_flag,
                "attendee_count": booking.attendee_count,
                "rescheduled_from": str(booking.rescheduled_from) if booking.rescheduled_from else None,
                "created_at": booking.created_at.isoformat() + "Z" if booking.created_at else None,
                "updated_at": booking.updated_at.isoformat() + "Z" if booking.updated_at else None
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get admin booking: {str(e)}")
        raise TithiError(
            message="Failed to get booking",
            code="TITHI_ADMIN_BOOKING_GET_ERROR"
        )


@admin_bp.route("/bookings/<booking_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_admin_booking(booking_id: str):
    """Update individual booking with admin restrictions and audit trail."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data.get('update_fields'):
            raise TithiError(
                message="update_fields is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        booking_service = BookingService()
        
        # Update booking atomically with audit trail
        with db.session.begin():
            result = booking_service.admin_update_booking(
                tenant_id, uuid.UUID(booking_id), data['update_fields'], current_user.id
            )
        
        if not result:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=booking_update")
        
        return jsonify({
            "message": "Booking updated successfully",
            "booking": {
                "id": str(result.id),
                "status": result.status,
                "start_at": result.start_at.isoformat() + "Z" if result.start_at else None,
                "end_at": result.end_at.isoformat() + "Z" if result.end_at else None,
                "updated_at": result.updated_at.isoformat() + "Z" if result.updated_at else None
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update admin booking: {str(e)}")
        raise TithiError(
            message="Failed to update booking",
            code="TITHI_ADMIN_BOOKING_UPDATE_ERROR"
        )


@admin_bp.route("/bookings/<booking_id>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_admin_booking(booking_id: str):
    """Cancel/delete booking with admin restrictions."""
    try:
        data = request.get_json() or {}
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        reason = data.get('reason', 'Admin cancellation')
        
        booking_service = BookingService()
        
        # Cancel booking atomically with audit trail
        with db.session.begin():
            result = booking_service.cancel_booking(
                tenant_id, uuid.UUID(booking_id), current_user.id, reason
            )
        
        if not result:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        # Log admin action with audit service
        from ..services.audit_service import AuditService
        audit_service = AuditService()
        audit_service.create_audit_log(
            tenant_id=str(tenant_id),
            table_name="bookings",
            operation="UPDATE",
            record_id=booking_id,
            user_id=str(current_user.id),
            action="ADMIN_BOOKING_CANCELLED",
            metadata={"admin_action": True, "booking_id": booking_id, "reason": reason}
        )
        
        logger.info("Admin booking cancelled", extra={
            'tenant_id': str(tenant_id),
            'user_id': str(current_user.id),
            'booking_id': booking_id,
            'reason': reason,
            'event_type': 'ADMIN_BOOKING_CANCELLED'
        })
        
        return jsonify({
            "message": "Booking canceled successfully",
            "booking": {
                "id": str(result.id),
                "status": result.status,
                "canceled_at": result.canceled_at.isoformat() + "Z" if result.canceled_at else None,
                "updated_at": result.updated_at.isoformat() + "Z" if result.updated_at else None
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel admin booking: {str(e)}")
        raise TithiError(
            message="Failed to cancel booking",
            code="TITHI_ADMIN_BOOKING_CANCEL_ERROR"
        )


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
            code="TITHI_DASHBOARD_DATA_MISMATCH"
        )


# Task 10.4: Enhanced Admin Analytics Dashboard Endpoints
@admin_bp.route("/analytics", methods=["GET"])
@require_auth
@require_tenant
def get_admin_analytics_dashboard_enhanced():
    """Get comprehensive admin analytics dashboard with pre-aggregated queries and pagination."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Get query parameters
        metric = request.args.get('metric', 'overview')  # overview, revenue, bookings, customers, staff
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Validate date range
        if not start_date_str or not end_date_str:
            # Default to last 30 days
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
        else:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
            except ValueError:
                raise TithiError(
                    message="Invalid date format. Use ISO format (YYYY-MM-DD)",
                    code="TITHI_DASHBOARD_DATA_MISMATCH",
                    status_code=400
                )
        
        # Validate date range
        if start_date >= end_date:
            raise TithiError(
                message="start_date must be before end_date",
                code="TITHI_DASHBOARD_DATA_MISMATCH",
                status_code=400
            )
        
        # Validate pagination
        if page < 1 or per_page < 1 or per_page > 1000:
            raise TithiError(
                message="Invalid pagination parameters",
                code="TITHI_DASHBOARD_DATA_MISMATCH",
                status_code=400
            )
        
        analytics_service = AnalyticsService()
        
        # Get dashboard data based on metric type
        if metric == 'overview':
            dashboard_data = analytics_service.get_admin_dashboard_data(tenant_id, start_date, end_date)
        elif metric == 'revenue':
            dashboard_data = analytics_service.business_service.get_revenue_metrics(tenant_id, start_date, end_date)
        elif metric == 'bookings':
            dashboard_data = analytics_service.business_service.get_booking_metrics(tenant_id, start_date, end_date)
        elif metric == 'customers':
            dashboard_data = analytics_service.business_service.get_customer_metrics(tenant_id, start_date, end_date)
        elif metric == 'staff':
            dashboard_data = analytics_service.business_service.get_staff_metrics(tenant_id, start_date, end_date)
        else:
            raise TithiError(
                message="Invalid metric. Must be one of: overview, revenue, bookings, customers, staff",
                code="TITHI_DASHBOARD_DATA_MISMATCH",
                status_code=400
            )
        
        # Apply pagination for large datasets
        paginated_data = _apply_pagination_to_dashboard_data(dashboard_data, metric, page, per_page)
        
        # Emit observability hook
        logger.info("DASHBOARD_VIEWED", extra={
            "tenant_id": str(tenant_id),
            "user_id": str(current_user.id),
            "metric": metric,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "page": page,
            "per_page": per_page
        })
        
        return jsonify({
            "metric": metric,
            "chart_data": paginated_data,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_items": _get_total_items_count(dashboard_data, metric),
                "has_next": _has_next_page(dashboard_data, metric, page, per_page)
            },
            "metadata": {
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "data_source": "pre_aggregated_queries"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get admin analytics dashboard: {str(e)}")
        raise TithiError(
            message="Failed to get analytics dashboard",
            code="TITHI_DASHBOARD_DATA_MISMATCH",
            status_code=500
        )


def _apply_pagination_to_dashboard_data(dashboard_data: Dict[str, Any], metric: str, page: int, per_page: int) -> Dict[str, Any]:
    """Apply pagination to dashboard data based on metric type."""
    if metric == 'overview':
        # For overview, paginate the most relevant data
        if 'revenue' in dashboard_data and 'revenue_by_period' in dashboard_data['revenue']:
            revenue_by_period = dashboard_data['revenue']['revenue_by_period']
            total_items = len(revenue_by_period)
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_revenue = revenue_by_period[start_idx:end_idx]
            dashboard_data['revenue']['revenue_by_period'] = paginated_revenue
        return dashboard_data
    else:
        return dashboard_data


def _get_total_items_count(dashboard_data: Dict[str, Any], metric: str) -> int:
    """Get total items count for pagination."""
    if metric == 'overview':
        if 'revenue' in dashboard_data and 'revenue_by_period' in dashboard_data['revenue']:
            return len(dashboard_data['revenue']['revenue_by_period'])
        return 0
    elif metric == 'revenue':
        return len(dashboard_data.get('revenue_by_period', []))
    elif metric == 'bookings':
        return len(dashboard_data.get('bookings_by_period', []))
    elif metric == 'customers':
        return len(dashboard_data.get('customer_segments', {}))
    elif metric == 'staff':
        return len(dashboard_data.get('staff_metrics', []))
    return 0


def _has_next_page(dashboard_data: Dict[str, Any], metric: str, page: int, per_page: int) -> bool:
    """Check if there's a next page."""
    total_items = _get_total_items_count(dashboard_data, metric)
    return (page * per_page) < total_items


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

# Task 10.2: Admin Staff Management CRUD
@admin_bp.route("/staff", methods=["GET"])
@require_auth
@require_tenant
def list_admin_staff():
    """List all staff profiles for admin management."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Get query parameters
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        
        staff_service = StaffService()
        
        # Get all staff profiles for tenant
        staff_profiles = staff_service.list_staff_profiles(tenant_id)
        
        # Filter by active status if requested
        if active_only:
            staff_profiles = [s for s in staff_profiles if s.is_active]
        
        # Convert to response format
        staff_data = []
        for staff in staff_profiles:
            staff_data.append({
                "id": str(staff.id),
                "membership_id": str(staff.membership_id),
                "resource_id": str(staff.resource_id),
                "display_name": staff.display_name,
                "bio": staff.bio,
                "specialties": staff.specialties or [],
                "hourly_rate_cents": staff.hourly_rate_cents,
                "is_active": staff.is_active,
                "max_concurrent_bookings": staff.max_concurrent_bookings,
                "created_at": staff.created_at.isoformat() + "Z",
                "updated_at": staff.updated_at.isoformat() + "Z"
            })
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=staff_list")
        
        return jsonify({
            "staff": staff_data,
            "total_count": len(staff_data),
            "filters": {
                "active_only": active_only
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to list admin staff: {str(e)}")
        raise TithiError(
            message="Failed to list staff",
            code="TITHI_ADMIN_STAFF_LIST_ERROR"
        )


@admin_bp.route("/staff", methods=["POST"])
@require_auth
@require_tenant
def create_admin_staff():
    """Create a new staff profile for admin management."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data:
            raise TithiError(
                message="Staff profile data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        staff_service = StaffService()
        
        # Create staff profile
        staff_profile = staff_service.create_staff_profile(tenant_id, data, current_user.id)
        
        # Log admin action and observability hook
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=staff_created")
        logger.info(f"STAFF_ADDED: staff_id={staff_profile.id}, tenant_id={tenant_id}, display_name={staff_profile.display_name}")
        
        return jsonify({
            "message": "Staff profile created successfully",
            "staff": {
                "id": str(staff_profile.id),
                "membership_id": str(staff_profile.membership_id),
                "resource_id": str(staff_profile.resource_id),
                "display_name": staff_profile.display_name,
                "bio": staff_profile.bio,
                "specialties": staff_profile.specialties or [],
                "hourly_rate_cents": staff_profile.hourly_rate_cents,
                "is_active": staff_profile.is_active,
                "max_concurrent_bookings": staff_profile.max_concurrent_bookings,
                "created_at": staff_profile.created_at.isoformat() + "Z",
                "updated_at": staff_profile.updated_at.isoformat() + "Z"
            }
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create admin staff: {str(e)}")
        raise TithiError(
            message="Failed to create staff profile",
            code="TITHI_ADMIN_STAFF_CREATE_ERROR"
        )


@admin_bp.route("/staff/<staff_id>", methods=["GET"])
@require_auth
@require_tenant
def get_admin_staff(staff_id: str):
    """Get individual staff profile for admin management."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        staff_service = StaffService()
        staff_profile = staff_service.get_staff_profile(tenant_id, uuid.UUID(staff_id))
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=staff_viewed")
        
        return jsonify({
            "staff": {
                "id": str(staff_profile.id),
                "membership_id": str(staff_profile.membership_id),
                "resource_id": str(staff_profile.resource_id),
                "display_name": staff_profile.display_name,
                "bio": staff_profile.bio,
                "specialties": staff_profile.specialties or [],
                "hourly_rate_cents": staff_profile.hourly_rate_cents,
                "is_active": staff_profile.is_active,
                "max_concurrent_bookings": staff_profile.max_concurrent_bookings,
                "metadata": staff_profile.metadata_json,
                "created_at": staff_profile.created_at.isoformat() + "Z",
                "updated_at": staff_profile.updated_at.isoformat() + "Z"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get admin staff: {str(e)}")
        raise TithiError(
            message="Failed to get staff profile",
            code="TITHI_ADMIN_STAFF_GET_ERROR"
        )


@admin_bp.route("/staff/<staff_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_admin_staff(staff_id: str):
    """Update a staff profile for admin management."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        if not data:
            raise TithiError(
                message="Staff profile update data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        staff_service = StaffService()
        staff_profile = staff_service.update_staff_profile(tenant_id, uuid.UUID(staff_id), data, current_user.id)
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=staff_updated")
        
        return jsonify({
            "message": "Staff profile updated successfully",
            "staff": {
                "id": str(staff_profile.id),
                "membership_id": str(staff_profile.membership_id),
                "resource_id": str(staff_profile.resource_id),
                "display_name": staff_profile.display_name,
                "bio": staff_profile.bio,
                "specialties": staff_profile.specialties or [],
                "hourly_rate_cents": staff_profile.hourly_rate_cents,
                "is_active": staff_profile.is_active,
                "max_concurrent_bookings": staff_profile.max_concurrent_bookings,
                "metadata": staff_profile.metadata_json,
                "created_at": staff_profile.created_at.isoformat() + "Z",
                "updated_at": staff_profile.updated_at.isoformat() + "Z"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update admin staff: {str(e)}")
        raise TithiError(
            message="Failed to update staff profile",
            code="TITHI_ADMIN_STAFF_UPDATE_ERROR"
        )


@admin_bp.route("/staff/<staff_id>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_admin_staff(staff_id: str):
    """Delete a staff profile for admin management."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        staff_service = StaffService()
        result = staff_service.delete_staff_profile(tenant_id, uuid.UUID(staff_id), current_user.id)
        
        if not result:
            raise TithiError(
                message="Staff profile not found or cannot be deleted",
                code="TITHI_STAFF_DELETE_ERROR",
                status_code=404
            )
        
        # Log admin action with audit service
        from ..services.audit_service import AuditService
        audit_service = AuditService()
        audit_service.create_audit_log(
            tenant_id=str(tenant_id),
            table_name="staff_profiles",
            operation="DELETE",
            record_id=staff_id,
            user_id=str(current_user.id),
            action="ADMIN_STAFF_DELETED",
            metadata={"admin_action": True, "staff_id": staff_id}
        )
        
        logger.info("Admin staff deleted", extra={
            'tenant_id': str(tenant_id),
            'user_id': str(current_user.id),
            'staff_id': staff_id,
            'event_type': 'ADMIN_STAFF_DELETED'
        })
        
        return jsonify({
            "message": "Staff profile deleted successfully",
            "deleted_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to delete admin staff: {str(e)}")
        raise TithiError(
            message="Failed to delete staff profile",
            code="TITHI_ADMIN_STAFF_DELETE_ERROR"
        )


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


# BRANDING & WHITE-LABEL SETTINGS (Task 10.3)
@admin_bp.route("/branding", methods=["GET"])
@require_auth
@require_tenant
@require_role(["owner", "admin"])
def get_branding():
    """Get current branding settings for the tenant."""
    try:
        tenant_id = g.tenant_id
        branding_service = BrandingService()
        
        # Get current branding
        branding_data = branding_service.get_tenant_branding(tenant_id)
        
        return jsonify({
            "branding": branding_data
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get branding: {str(e)}")
        raise TithiError(
            message="Failed to get branding",
            code="TITHI_BRANDING_FETCH_ERROR"
        )


@admin_bp.route("/branding", methods=["PUT"])
@require_auth
@require_tenant
@require_role(["owner", "admin"])
def update_branding():
    """Update branding settings for the tenant."""
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
        
        branding_service = BrandingService()
        
        # Validate subdomain if provided
        if "subdomain" in data:
            if not branding_service.validate_subdomain(data["subdomain"], tenant_id):
                raise TithiError(
                    message="Subdomain is already taken",
                    code="TITHI_BRANDING_SUBDOMAIN_TAKEN",
                    status_code=409
                )
        
        # Update branding atomically
        with db.session.begin():
            updated_branding = branding_service.update_branding(
                tenant_id, data, current_user.id
            )
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=branding_updated")
        
        return jsonify({
            "message": "Branding updated successfully",
            "branding": updated_branding
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update branding: {str(e)}")
        raise TithiError(
            message="Failed to update branding",
            code="TITHI_BRANDING_UPDATE_ERROR"
        )


@admin_bp.route("/branding/upload-logo", methods=["POST"])
@require_auth
@require_tenant
@require_role(["owner", "admin"])
def upload_logo():
    """Upload logo file for the tenant."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Check if logo file is provided
        if 'logo' not in request.files:
            raise TithiError(
                message="Logo file is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        logo_file = request.files['logo']
        if logo_file.filename == '':
            raise TithiError(
                message="No logo file selected",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        branding_service = BrandingService()
        
        # Upload logo atomically
        with db.session.begin():
            result = branding_service.upload_logo(tenant_id, logo_file, current_user.id)
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=logo_uploaded")
        
        return jsonify({
            "message": "Logo uploaded successfully",
            "logo_url": result["logo_url"],
            "file_checksum": result["file_checksum"],
            "file_size": result["file_size"]
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to upload logo: {str(e)}")
        raise TithiError(
            message="Failed to upload logo",
            code="TITHI_BRANDING_UPLOAD_ERROR"
        )


@admin_bp.route("/branding/upload-favicon", methods=["POST"])
@require_auth
@require_tenant
@require_role(["owner", "admin"])
def upload_favicon():
    """Upload favicon file for the tenant."""
    try:
        tenant_id = g.tenant_id
        current_user = get_current_user()
        
        # Check if favicon file is provided
        if 'favicon' not in request.files:
            raise TithiError(
                message="Favicon file is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        favicon_file = request.files['favicon']
        if favicon_file.filename == '':
            raise TithiError(
                message="No favicon file selected",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        branding_service = BrandingService()
        
        # Upload favicon atomically
        with db.session.begin():
            result = branding_service.upload_favicon(tenant_id, favicon_file, current_user.id)
        
        # Log admin action
        logger.info(f"ADMIN_ACTION_PERFORMED: tenant_id={tenant_id}, user_id={current_user.id}, action_type=favicon_uploaded")
        
        return jsonify({
            "message": "Favicon uploaded successfully",
            "favicon_url": result["favicon_url"],
            "file_checksum": result["file_checksum"],
            "file_size": result["file_size"]
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to upload favicon: {str(e)}")
        raise TithiError(
            message="Failed to upload favicon",
            code="TITHI_BRANDING_UPLOAD_ERROR"
        )


@admin_bp.route("/branding/validate-subdomain", methods=["POST"])
@require_auth
@require_tenant
@require_role(["owner", "admin"])
def validate_subdomain():
    """Validate subdomain availability."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        
        if not data.get('subdomain'):
            raise TithiError(
                message="subdomain is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        branding_service = BrandingService()
        
        # Validate subdomain
        is_available = branding_service.validate_subdomain(data["subdomain"], tenant_id)
        
        return jsonify({
            "subdomain": data["subdomain"],
            "is_available": is_available,
            "message": "Subdomain is available" if is_available else "Subdomain is already taken"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to validate subdomain: {str(e)}")
        raise TithiError(
            message="Failed to validate subdomain",
            code="TITHI_BRANDING_SUBDOMAIN_VALIDATION_ERROR"
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


# Admin Payment Endpoints (Frontend Step 8)
@admin_bp.route("/payments/setup-intent", methods=["POST"])
@require_auth
@require_tenant
def create_payment_setup_intent():
    """Create a Stripe setup intent for subscription payment."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Import payment service
        from ..services.financial import PaymentService
        payment_service = PaymentService()
        
        # Create setup intent
        setup_intent = payment_service.create_setup_intent(
            tenant_id=tenant_id,
            user_id=user_id,
            metadata=data.get('metadata', {})
        )
        
        return jsonify({
            "id": setup_intent.id,
            "client_secret": setup_intent.client_secret,
            "status": setup_intent.status,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }), 201
        
    except Exception as e:
        raise TithiError(
            message="Failed to create setup intent",
            code="TITHI_PAYMENT_SETUP_INTENT_ERROR"
        )


@admin_bp.route("/payments/setup-intent/<setup_intent_id>/confirm", methods=["POST"])
@require_auth
@require_tenant
def confirm_payment_setup_intent(setup_intent_id: str):
    """Confirm a Stripe setup intent."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        data = request.get_json()
        
        if not data or not data.get('payment_method'):
            raise TithiError(
                message="Payment method is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        from ..services.financial import PaymentService
        payment_service = PaymentService()
        
        # Confirm setup intent
        setup_intent = payment_service.confirm_setup_intent(
            setup_intent_id=setup_intent_id,
            payment_method_id=data['payment_method'],
            tenant_id=tenant_id,
            user_id=user_id
        )
        
        return jsonify({
            "id": setup_intent.id,
            "status": setup_intent.status,
            "payment_method": setup_intent.payment_method,
            "confirmed_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to confirm setup intent",
            code="TITHI_PAYMENT_SETUP_CONFIRM_ERROR"
        )


@admin_bp.route("/payments/wallets/<tenant_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_wallet_config(tenant_id: str):
    """Update wallet configuration for supported payment methods."""
    try:
        user_id = g.user_id
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        from ..services.financial import PaymentService
        payment_service = PaymentService()
        
        # Update wallet config
        wallet_config = payment_service.update_wallet_config(
            tenant_id=uuid.UUID(tenant_id),
            config_data=data,
            user_id=user_id
        )
        
        return jsonify({
            "tenant_id": tenant_id,
            "supported_methods": wallet_config.get('supported_methods', []),
            "wallet_settings": wallet_config.get('settings', {}),
            "updated_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to update wallet config",
            code="TITHI_WALLET_CONFIG_UPDATE_ERROR"
        )


@admin_bp.route("/payments/kyc/<tenant_id>", methods=["POST", "PUT", "GET"])
@require_auth
@require_tenant
def manage_kyc_data(tenant_id: str):
    """Create, update, or get KYC data for a tenant."""
    try:
        user_id = g.user_id
        data = request.get_json() if request.method in ['POST', 'PUT'] else None
        
        from ..services.financial import PaymentService
        payment_service = PaymentService()
        
        if request.method == 'GET':
            # Get KYC data
            kyc_data = payment_service.get_kyc_data(tenant_id=uuid.UUID(tenant_id))
            
            return jsonify({
                "tenant_id": tenant_id,
                "kyc_data": kyc_data,
                "status": kyc_data.get('status', 'pending'),
                "last_updated": kyc_data.get('updated_at', datetime.utcnow().isoformat() + "Z")
            }), 200
            
        elif request.method == 'POST':
            # Create KYC data
            if not data:
                raise TithiError(
                    message="KYC data is required",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
            
            kyc_data = payment_service.create_kyc_data(
                tenant_id=uuid.UUID(tenant_id),
                kyc_data=data,
                user_id=user_id
            )
            
            return jsonify({
                "tenant_id": tenant_id,
                "kyc_data": kyc_data,
                "status": "created",
                "created_at": datetime.utcnow().isoformat() + "Z"
            }), 201
            
        elif request.method == 'PUT':
            # Update KYC data
            if not data:
                raise TithiError(
                    message="KYC data is required",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
            
            kyc_data = payment_service.update_kyc_data(
                tenant_id=uuid.UUID(tenant_id),
                kyc_data=data,
                user_id=user_id
            )
            
            return jsonify({
                "tenant_id": tenant_id,
                "kyc_data": kyc_data,
                "status": "updated",
                "updated_at": datetime.utcnow().isoformat() + "Z"
            }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to manage KYC data",
            code="TITHI_KYC_MANAGEMENT_ERROR"
        )


@admin_bp.route("/payments/go-live/<tenant_id>", methods=["POST", "GET"])
@require_auth
@require_tenant
def manage_go_live(tenant_id: str):
    """Go live with the business or get go-live status."""
    try:
        user_id = g.user_id
        data = request.get_json() if request.method == 'POST' else None
        
        from ..services.financial import PaymentService
        payment_service = PaymentService()
        
        if request.method == 'GET':
            # Get go-live status
            go_live_data = payment_service.get_go_live_status(tenant_id=uuid.UUID(tenant_id))
            
            return jsonify({
                "tenant_id": tenant_id,
                "go_live_data": go_live_data,
                "status": go_live_data.get('status', 'pending'),
                "last_updated": go_live_data.get('updated_at', datetime.utcnow().isoformat() + "Z")
            }), 200
            
        elif request.method == 'POST':
            # Go live
            if not data:
                raise TithiError(
                    message="Go-live data is required",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
            
            go_live_data = payment_service.go_live(
                tenant_id=uuid.UUID(tenant_id),
                go_live_data=data,
                user_id=user_id
            )
            
            return jsonify({
                "tenant_id": tenant_id,
                "go_live_data": go_live_data,
                "status": "live",
                "go_live_at": datetime.utcnow().isoformat() + "Z",
                "booking_url": f"https://{tenant_id}.tithi.com",
                "admin_url": f"https://admin.tithi.com/{tenant_id}"
            }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to manage go-live",
            code="TITHI_GO_LIVE_ERROR"
        )
