"""
Calendar Integration API Blueprint

This blueprint provides Google Calendar integration endpoints for staff scheduling
and two-way sync with work schedules.
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
from datetime import datetime, timedelta

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.calendar_integration import GoogleCalendarService, CalendarConflictResolver
from ..models.business import StaffProfile, WorkSchedule


calendar_bp = Blueprint("calendar", __name__)


@calendar_bp.route("/google/authorize", methods=["POST"])
@require_auth
@require_tenant
def authorize_google_calendar():
    """Get Google Calendar authorization URL."""
    try:
        data = request.get_json()
        redirect_uri = data.get('redirect_uri')
        
        if not redirect_uri:
            raise TithiError(
                message="redirect_uri is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        user_id = get_current_user()
        tenant_id = g.tenant_id
        
        calendar_service = GoogleCalendarService()
        auth_url = calendar_service.get_authorization_url(tenant_id, user_id, redirect_uri)
        
        return jsonify({
            "authorization_url": auth_url,
            "state": "google_calendar_auth"
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to generate authorization URL",
            code="TITHI_CALENDAR_AUTH_ERROR"
        )


@calendar_bp.route("/google/callback", methods=["POST"])
@require_auth
@require_tenant
def handle_google_callback():
    """Handle Google OAuth callback."""
    try:
        data = request.get_json()
        authorization_code = data.get('code')
        redirect_uri = data.get('redirect_uri')
        
        if not authorization_code or not redirect_uri:
            raise TithiError(
                message="code and redirect_uri are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        user_id = get_current_user()
        tenant_id = g.tenant_id
        
        calendar_service = GoogleCalendarService()
        success = calendar_service.handle_oauth_callback(
            tenant_id, user_id, authorization_code, redirect_uri
        )
        
        if success:
            return jsonify({
                "message": "Google Calendar connected successfully",
                "connected": True
            }), 200
        else:
            raise TithiError(
                message="Failed to connect Google Calendar",
                code="TITHI_CALENDAR_CONNECT_ERROR"
            )
        
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to handle OAuth callback",
            code="TITHI_CALENDAR_CALLBACK_ERROR"
        )


@calendar_bp.route("/staff/<staff_id>/sync-to-calendar", methods=["POST"])
@require_auth
@require_tenant
def sync_staff_to_calendar(staff_id: str):
    """Sync staff work schedule to Google Calendar."""
    try:
        tenant_id = g.tenant_id
        
        # Validate staff profile exists
        staff_profile = StaffProfile.query.filter_by(
            id=uuid.UUID(staff_id),
            tenant_id=tenant_id
        ).first()
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        calendar_service = GoogleCalendarService()
        result = calendar_service.sync_staff_schedule_to_calendar(
            uuid.UUID(staff_id), tenant_id
        )
        
        return jsonify({
            "success": result.success,
            "events_created": result.events_created,
            "events_updated": result.events_updated,
            "events_deleted": result.events_deleted,
            "conflicts_resolved": result.conflicts_resolved,
            "errors": result.errors or []
        }), 200 if result.success else 400
        
    except ValueError as e:
        raise TithiError(
            message="Invalid staff ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to sync staff schedule to calendar",
            code="TITHI_CALENDAR_SYNC_ERROR"
        )


@calendar_bp.route("/staff/<staff_id>/sync-from-calendar", methods=["POST"])
@require_auth
@require_tenant
def sync_calendar_to_staff(staff_id: str):
    """Sync Google Calendar events to staff work schedule."""
    try:
        data = request.get_json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if not start_date or not end_date:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Parse dates
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        tenant_id = g.tenant_id
        
        # Validate staff profile exists
        staff_profile = StaffProfile.query.filter_by(
            id=uuid.UUID(staff_id),
            tenant_id=tenant_id
        ).first()
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        calendar_service = GoogleCalendarService()
        result = calendar_service.sync_calendar_to_schedule(
            uuid.UUID(staff_id), tenant_id, start_dt, end_dt
        )
        
        return jsonify({
            "success": result.success,
            "events_created": result.events_created,
            "events_updated": result.events_updated,
            "events_deleted": result.events_deleted,
            "conflicts_resolved": result.conflicts_resolved,
            "errors": result.errors or []
        }), 200 if result.success else 400
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format or staff ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to sync calendar to staff schedule",
            code="TITHI_CALENDAR_SYNC_ERROR"
        )


@calendar_bp.route("/staff/<staff_id>/conflicts", methods=["GET"])
@require_auth
@require_tenant
def get_calendar_conflicts(staff_id: str):
    """Get conflicts between work schedule and calendar events."""
    try:
        tenant_id = g.tenant_id
        
        # Validate staff profile exists
        staff_profile = StaffProfile.query.filter_by(
            id=uuid.UUID(staff_id),
            tenant_id=tenant_id
        ).first()
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        # Get work schedules
        work_schedules = WorkSchedule.query.filter_by(
            staff_profile_id=uuid.UUID(staff_id),
            tenant_id=tenant_id
        ).all()
        
        # For now, return empty conflicts (in production, this would check actual calendar)
        conflicts = []
        
        return jsonify({
            "conflicts": conflicts,
            "total": len(conflicts)
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid staff ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get calendar conflicts",
            code="TITHI_CALENDAR_CONFLICTS_ERROR"
        )


@calendar_bp.route("/staff/<staff_id>/conflicts/resolve", methods=["POST"])
@require_auth
@require_tenant
def resolve_calendar_conflicts(staff_id: str):
    """Resolve conflicts between work schedule and calendar events."""
    try:
        data = request.get_json()
        resolution_strategy = data.get('strategy', 'calendar_priority')
        
        tenant_id = g.tenant_id
        
        # Validate staff profile exists
        staff_profile = StaffProfile.query.filter_by(
            id=uuid.UUID(staff_id),
            tenant_id=tenant_id
        ).first()
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        # Get conflicts (simplified for this example)
        conflicts = []
        
        # Resolve conflicts
        resolver = CalendarConflictResolver()
        resolved = resolver.resolve_conflicts(conflicts, resolution_strategy)
        
        return jsonify({
            "resolved": resolved,
            "total": len(resolved),
            "strategy": resolution_strategy
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid staff ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to resolve calendar conflicts",
            code="TITHI_CALENDAR_RESOLVE_ERROR"
        )


@calendar_bp.route("/booking/<booking_id>/create-event", methods=["POST"])
@require_auth
@require_tenant
def create_booking_calendar_event(booking_id: str):
    """Create a booking event in Google Calendar."""
    try:
        data = request.get_json()
        staff_id = data.get('staff_id')
        
        if not staff_id:
            raise TithiError(
                message="staff_id is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        tenant_id = g.tenant_id
        
        # Validate staff profile exists
        staff_profile = StaffProfile.query.filter_by(
            id=uuid.UUID(staff_id),
            tenant_id=tenant_id
        ).first()
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        calendar_service = GoogleCalendarService()
        success = calendar_service.create_booking_event(
            uuid.UUID(staff_id), tenant_id, data
        )
        
        if success:
            return jsonify({
                "message": "Booking event created in calendar",
                "created": True
            }), 200
        else:
            raise TithiError(
                message="Failed to create booking event in calendar",
                code="TITHI_CALENDAR_EVENT_CREATE_ERROR"
            )
        
    except ValueError as e:
        raise TithiError(
            message="Invalid ID format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to create booking calendar event",
            code="TITHI_CALENDAR_EVENT_ERROR"
        )


@calendar_bp.route("/status", methods=["GET"])
@require_auth
@require_tenant
def get_calendar_status():
    """Get calendar integration status for current user."""
    try:
        user_id = get_current_user()
        tenant_id = g.tenant_id
        
        # Check if user has Google Calendar connected
        # This is a simplified check - in production, check actual credentials
        connected = False
        
        return jsonify({
            "connected": connected,
            "provider": "google",
            "last_sync": None,
            "sync_enabled": False
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to get calendar status",
            code="TITHI_CALENDAR_STATUS_ERROR"
        )
