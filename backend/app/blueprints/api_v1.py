"""
API v1 Blueprint

This blueprint provides the core API endpoints for authenticated users.
It includes endpoints for tenant management, bookings, payments, and
other business logic operations.

Endpoints:
- GET /api/v1/tenants: List user's tenants
- GET /api/v1/tenants/{id}: Get tenant details
- POST /api/v1/tenants: Create new tenant
- PUT /api/v1/tenants/{id}: Update tenant
- DELETE /api/v1/tenants/{id}: Delete tenant

Features:
- JWT authentication required
- Tenant-scoped operations
- RLS enforcement
- Structured error handling
- OpenAPI documentation
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
from datetime import datetime
from ..middleware.error_handler import TithiError, TenantError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.core import TenantService
from ..services.business_phase2 import ServiceService, BookingService, AvailabilityService, CustomerService, StaffService, StaffAvailabilityService, ValidationError
from ..models.core import Tenant


api_v1_bp = Blueprint("api_v1", __name__)


@api_v1_bp.route("/tenants", methods=["GET"])
@require_auth
def list_tenants():
    """
    List user's tenants.
    
    Returns:
        JSON response with list of tenants
    """
    try:
        # TODO: Implement tenant listing logic
        # This is a placeholder implementation
        
        tenants = [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "SalonX",
                "slug": "salonx",
                "status": "active",
                "timezone": "UTC",
                "currency": "USD",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z"
            }
        ]
        
        return jsonify({
            "tenants": tenants,
            "total": len(tenants)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list tenants",
            code="TITHI_TENANT_LIST_ERROR"
        )


@api_v1_bp.route("/tenants/<tenant_id>", methods=["GET"])
@require_auth
def get_tenant(tenant_id: str):
    """
    Get tenant details.
    
    Args:
        tenant_id: Tenant UUID
    
    Returns:
        JSON response with tenant details
    """
    try:
        # TODO: Implement tenant retrieval logic
        # This is a placeholder implementation
        
        if tenant_id != "550e8400-e29b-41d4-a716-446655440000":
            raise TenantError(
                message="Tenant not found",
                code="TITHI_TENANT_NOT_FOUND",
                status_code=404
            )
        
        tenant = {
            "id": tenant_id,
            "name": "SalonX",
            "slug": "salonx",
            "status": "active",
            "timezone": "UTC",
            "currency": "USD",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        
        return jsonify(tenant), 200
        
    except TenantError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get tenant",
            code="TITHI_TENANT_GET_ERROR"
        )


@api_v1_bp.route("/tenants", methods=["POST"])
@require_auth
def create_tenant():
    """
    Create new tenant.
    
    Returns:
        JSON response with created tenant
    """
    try:
        data = request.get_json()
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate required fields
        required_fields = ["name", "email"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            raise TithiError(
                message=f"Missing required fields: {', '.join(missing_fields)}",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Get current user
        current_user = get_current_user()
        if not current_user:
            raise TithiError(
                message="User not authenticated",
                code="TITHI_AUTH_ERROR",
                status_code=401
            )
        
        # Create tenant using service
        tenant_service = TenantService()
        tenant_data = {
            "name": data["name"],
            "email": data["email"],
            "slug": data.get("slug"),
            "timezone": data.get("timezone", "UTC"),
            "currency": data.get("currency", "USD"),
            "description": data.get("description", ""),
            "locale": data.get("locale", "en_US")
        }
        tenant = tenant_service.create_tenant(tenant_data, current_user["id"])
        
        return jsonify({
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "email": tenant.email,
            "status": tenant.status,
            "timezone": tenant.timezone,
            "currency": tenant.currency,
            "description": tenant.description,
            "locale": tenant.locale,
            "created_at": tenant.created_at.isoformat() + "Z",
            "updated_at": tenant.updated_at.isoformat() + "Z"
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to create tenant",
            code="TITHI_TENANT_CREATE_ERROR"
        )


@api_v1_bp.route("/tenants/<tenant_id>", methods=["PUT"])
@require_auth
def update_tenant(tenant_id: str):
    """
    Update tenant.
    
    Args:
        tenant_id: Tenant UUID
    
    Returns:
        JSON response with updated tenant
    """
    try:
        # TODO: Implement tenant update logic
        # This is a placeholder implementation
        
        data = request.get_json()
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Placeholder update
        tenant = {
            "id": tenant_id,
            "name": data.get("name", "Updated Salon"),
            "slug": data.get("slug", "updated-salon"),
            "status": "active",
            "timezone": data.get("timezone", "UTC"),
            "currency": data.get("currency", "USD"),
            "updated_at": "2024-01-01T00:00:00Z"
        }
        
        return jsonify(tenant), 200
        
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to update tenant",
            code="TITHI_TENANT_UPDATE_ERROR"
        )


@api_v1_bp.route("/tenants/<tenant_id>", methods=["DELETE"])
@require_auth
def delete_tenant(tenant_id: str):
    """
    Delete tenant.
    
    Args:
        tenant_id: Tenant UUID
    
    Returns:
        JSON response confirming deletion
    """
    try:
        # TODO: Implement tenant deletion logic
        # This is a placeholder implementation
        
        return jsonify({
            "message": "Tenant deleted successfully",
            "tenant_id": tenant_id
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to delete tenant",
            code="TITHI_TENANT_DELETE_ERROR"
        )


# ============================================================================
# PHASE 2 ENDPOINTS - Core Booking System
# ============================================================================

# Services & Catalog (Module D)
@api_v1_bp.route("/services", methods=["GET"])
@require_auth
@require_tenant
def list_services():
    """List services for the current tenant."""
    try:
        tenant_id = g.tenant_id
        service_service = ServiceService()
        services = service_service.get_services(tenant_id)
        
        return jsonify({
            "services": [{
                "id": str(service.id),
                "name": service.name,
                "description": service.description,
                "duration_min": service.duration_min,
                "price_cents": service.price_cents,
                "currency": getattr(service, 'currency', 'USD'),
                "category": service.category,
                "active": service.active,
                "created_at": service.created_at.isoformat() + "Z",
                "updated_at": service.updated_at.isoformat() + "Z"
            } for service in services],
            "total": len(services)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list services",
            code="TITHI_SERVICE_LIST_ERROR"
        )


@api_v1_bp.route("/services", methods=["POST"])
@require_auth
@require_tenant
def create_service():
    """Create a new service."""
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
        
        service_service = ServiceService()
        service = service_service.create_service(tenant_id, data, user_id)
        
        return jsonify({
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "duration_min": service.duration_min,
            "price_cents": service.price_cents,
            "currency": getattr(service, 'currency', 'USD'),
            "category": service.category,
            "active": service.active,
            "created_at": service.created_at.isoformat() + "Z",
            "updated_at": service.updated_at.isoformat() + "Z"
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except Exception as e:
        raise TithiError(
            message="Failed to create service",
            code="TITHI_SERVICE_CREATE_ERROR"
        )


@api_v1_bp.route("/services/<service_id>", methods=["GET"])
@require_auth
@require_tenant
def get_service(service_id: str):
    """Get a specific service."""
    try:
        tenant_id = g.tenant_id
        service_service = ServiceService()
        service = service_service.get_service(tenant_id, uuid.UUID(service_id))
        
        if not service:
            raise TithiError(
                message="Service not found",
                code="TITHI_SERVICE_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "duration_min": service.duration_min,
            "price_cents": service.price_cents,
            "currency": getattr(service, 'currency', 'USD'),
            "category": service.category,
            "active": service.active,
            "created_at": service.created_at.isoformat() + "Z",
            "updated_at": service.updated_at.isoformat() + "Z"
        }), 200
        
    except ValueError:
        raise TithiError(
            message="Invalid service ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get service",
            code="TITHI_SERVICE_GET_ERROR"
        )


@api_v1_bp.route("/services/<service_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_service(service_id: str):
    """Update a service."""
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
        
        service_service = ServiceService()
        service = service_service.update_service(tenant_id, uuid.UUID(service_id), data, user_id)
        
        if not service:
            raise TithiError(
                message="Service not found",
                code="TITHI_SERVICE_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "id": str(service.id),
            "name": service.name,
            "description": service.description,
            "duration_min": service.duration_min,
            "price_cents": service.price_cents,
            "currency": getattr(service, 'currency', 'USD'),
            "category": service.category,
            "active": service.active,
            "created_at": service.created_at.isoformat() + "Z",
            "updated_at": service.updated_at.isoformat() + "Z"
        }), 200
        
    except ValueError as e:
        if "Invalid service ID" in str(e):
            raise TithiError(
                message="Invalid service ID",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to update service",
            code="TITHI_SERVICE_UPDATE_ERROR"
        )


@api_v1_bp.route("/services/<service_id>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_service(service_id: str):
    """Delete a service."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        service_service = ServiceService()
        
        success = service_service.delete_service(tenant_id, uuid.UUID(service_id), user_id)
        
        if not success:
            raise TithiError(
                message="Service not found",
                code="TITHI_SERVICE_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "message": "Service deleted successfully",
            "service_id": service_id
        }), 200
        
    except ValueError as e:
        if "Cannot delete service" in str(e):
            raise TithiError(
                message=str(e),
                code="TITHI_SERVICE_DELETE_ERROR",
                status_code=400
            )
        raise TithiError(
            message="Invalid service ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to delete service",
            code="TITHI_SERVICE_DELETE_ERROR"
        )


# Bookings (Module G)
@api_v1_bp.route("/bookings", methods=["GET"])
@require_auth
@require_tenant
def list_bookings():
    """List bookings for the current tenant."""
    try:
        tenant_id = g.tenant_id
        booking_service = BookingService()
        
        # Get query parameters
        status = request.args.get('status')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Parse dates if provided
        start_dt = None
        end_dt = None
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        bookings = booking_service.get_bookings(tenant_id, status, start_dt, end_dt)
        
        return jsonify({
            "bookings": [{
                "id": str(booking.id),
                "customer_id": str(booking.customer_id),
                "resource_id": str(booking.resource_id),
                "start_at": booking.start_at.isoformat() + "Z",
                "end_at": booking.end_at.isoformat() + "Z",
                "status": booking.status,
                "attendee_count": booking.attendee_count,
                "total_amount_cents": getattr(booking, 'total_amount_cents', 0),
                "currency": getattr(booking, 'currency', 'USD'),
                "created_at": booking.created_at.isoformat() + "Z",
                "updated_at": booking.updated_at.isoformat() + "Z"
            } for booking in bookings],
            "total": len(bookings)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list bookings",
            code="TITHI_BOOKING_LIST_ERROR"
        )


@api_v1_bp.route("/bookings", methods=["POST"])
@require_auth
@require_tenant
def create_booking():
    """Create a new booking."""
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
        
        booking_service = BookingService()
        booking = booking_service.create_booking(tenant_id, data, user_id)
        
        return jsonify({
            "id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "resource_id": str(booking.resource_id),
            "start_at": booking.start_at.isoformat() + "Z",
            "end_at": booking.end_at.isoformat() + "Z",
            "status": booking.status,
            "attendee_count": booking.attendee_count,
            "total_amount_cents": getattr(booking, 'total_amount_cents', 0),
            "currency": getattr(booking, 'currency', 'USD'),
            "created_at": booking.created_at.isoformat() + "Z",
            "updated_at": booking.updated_at.isoformat() + "Z"
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except Exception as e:
        raise TithiError(
            message="Failed to create booking",
            code="TITHI_BOOKING_CREATE_ERROR"
        )


@api_v1_bp.route("/bookings/<booking_id>/confirm", methods=["POST"])
@require_auth
@require_tenant
def confirm_booking(booking_id: str):
    """Confirm a pending booking."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        booking_service = BookingService()
        
        success = booking_service.confirm_booking(tenant_id, uuid.UUID(booking_id), user_id)
        
        if not success:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "message": "Booking confirmed successfully",
            "booking_id": booking_id
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to confirm booking",
            code="TITHI_BOOKING_CONFIRM_ERROR"
        )


@api_v1_bp.route("/bookings/<booking_id>/cancel", methods=["POST"])
@require_auth
@require_tenant
def cancel_booking(booking_id: str):
    """Cancel a booking."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        data = request.get_json() or {}
        reason = data.get('reason')
        
        booking_service = BookingService()
        booking = booking_service.cancel_booking(tenant_id, uuid.UUID(booking_id), user_id, reason)
        
        if not booking:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "message": "Booking canceled successfully",
            "booking_id": booking_id,
            "status": booking.status
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to cancel booking",
            code="TITHI_BOOKING_CANCEL_ERROR"
        )


# Staff Management (Module E)
@api_v1_bp.route("/staff", methods=["GET"])
@require_auth
@require_tenant
def list_staff():
    """List staff profiles for the current tenant."""
    try:
        tenant_id = g.tenant_id
        staff_service = StaffService()
        
        # Get query parameters
        is_active = request.args.get('is_active')
        resource_id = request.args.get('resource_id')
        
        filters = {}
        if is_active is not None:
            filters['is_active'] = is_active.lower() == 'true'
        if resource_id:
            filters['resource_id'] = resource_id
        
        staff_profiles = staff_service.list_staff_profiles(tenant_id, filters)
        
        return jsonify({
            "staff": [{
                "id": str(profile.id),
                "membership_id": str(profile.membership_id),
                "resource_id": str(profile.resource_id),
                "display_name": profile.display_name,
                "bio": profile.bio,
                "specialties": profile.specialties or [],
                "hourly_rate_cents": profile.hourly_rate_cents,
                "is_active": profile.is_active,
                "max_concurrent_bookings": profile.max_concurrent_bookings,
                "created_at": profile.created_at.isoformat() + "Z",
                "updated_at": profile.updated_at.isoformat() + "Z"
            } for profile in staff_profiles],
            "total": len(staff_profiles)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list staff",
            code="TITHI_STAFF_LIST_ERROR"
        )


@api_v1_bp.route("/staff", methods=["POST"])
@require_auth
@require_tenant
def create_staff():
    """Create a new staff profile."""
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
        
        staff_service = StaffService()
        staff_profile = staff_service.create_staff_profile(tenant_id, data, user_id)
        
        return jsonify({
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
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except Exception as e:
        raise TithiError(
            message="Failed to create staff profile",
            code="TITHI_STAFF_CREATE_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>", methods=["GET"])
@require_auth
@require_tenant
def get_staff(staff_id: str):
    """Get a staff profile by ID."""
    try:
        tenant_id = g.tenant_id
        staff_service = StaffService()
        
        staff_profile = staff_service.get_staff_profile(tenant_id, uuid.UUID(staff_id))
        
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
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
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid staff ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get staff profile",
            code="TITHI_STAFF_GET_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_staff(staff_id: str):
    """Update a staff profile."""
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
        
        staff_service = StaffService()
        staff_profile = staff_service.update_staff_profile(tenant_id, uuid.UUID(staff_id), data, user_id)
        
        return jsonify({
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
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to update staff profile",
            code="TITHI_STAFF_UPDATE_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_staff(staff_id: str):
    """Delete a staff profile."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        staff_service = StaffService()
        success = staff_service.delete_staff_profile(tenant_id, uuid.UUID(staff_id), user_id)
        
        if not success:
            raise TithiError(
                message="Failed to delete staff profile",
                code="TITHI_STAFF_DELETE_ERROR",
                status_code=500
            )
        
        return jsonify({"message": "Staff profile deleted successfully"}), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid staff ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to delete staff profile",
            code="TITHI_STAFF_DELETE_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/schedules", methods=["GET"])
@require_auth
@require_tenant
def list_staff_schedules(staff_id: str):
    """List work schedules for a staff member."""
    try:
        tenant_id = g.tenant_id
        staff_service = StaffService()
        
        # Validate staff profile exists
        staff_profile = staff_service.get_staff_profile(tenant_id, uuid.UUID(staff_id))
        if not staff_profile:
            raise TithiError(
                message="Staff profile not found",
                code="TITHI_STAFF_NOT_FOUND",
                status_code=404
            )
        
        # Get schedules (simplified - in production would have dedicated method)
        from ..models.business import WorkSchedule
        schedules = WorkSchedule.query.filter_by(
            tenant_id=tenant_id,
            staff_profile_id=staff_id
        ).all()
        
        return jsonify({
            "schedules": [{
                "id": str(schedule.id),
                "schedule_type": schedule.schedule_type,
                "start_date": schedule.start_date.isoformat(),
                "end_date": schedule.end_date.isoformat() if schedule.end_date else None,
                "work_hours": schedule.work_hours,
                "is_time_off": schedule.is_time_off,
                "overrides_regular": schedule.overrides_regular,
                "rrule": schedule.rrule,
                "reason": schedule.reason,
                "created_at": schedule.created_at.isoformat() + "Z",
                "updated_at": schedule.updated_at.isoformat() + "Z"
            } for schedule in schedules],
            "total": len(schedules)
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid staff ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to list staff schedules",
            code="TITHI_STAFF_SCHEDULE_LIST_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/schedules", methods=["POST"])
@require_auth
@require_tenant
def create_staff_schedule(staff_id: str):
    """Create a work schedule for a staff member."""
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
        
        staff_service = StaffService()
        schedule = staff_service.create_work_schedule(tenant_id, uuid.UUID(staff_id), data, user_id)
        
        return jsonify({
            "id": str(schedule.id),
            "schedule_type": schedule.schedule_type,
            "start_date": schedule.start_date.isoformat(),
            "end_date": schedule.end_date.isoformat() if schedule.end_date else None,
            "work_hours": schedule.work_hours,
            "is_time_off": schedule.is_time_off,
            "overrides_regular": schedule.overrides_regular,
            "rrule": schedule.rrule,
            "reason": schedule.reason,
            "created_at": schedule.created_at.isoformat() + "Z",
            "updated_at": schedule.updated_at.isoformat() + "Z"
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to create staff schedule",
            code="TITHI_STAFF_SCHEDULE_CREATE_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/availability", methods=["GET"])
@require_auth
@require_tenant
def get_staff_availability(staff_id: str):
    """Get staff availability for a date range."""
    try:
        tenant_id = g.tenant_id
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            raise TithiError(
                message="start_date and end_date parameters are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        staff_service = StaffService()
        availability = staff_service.get_staff_availability(tenant_id, uuid.UUID(staff_id), start_dt, end_dt)
        
        return jsonify({
            "staff_id": staff_id,
            "availability": availability,
            "total": len(availability)
        }), 200
        
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
            message="Failed to get staff availability",
            code="TITHI_STAFF_AVAILABILITY_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/availability", methods=["POST"])
@require_auth
@require_tenant
def create_staff_availability(staff_id: str):
    """Create or update staff availability for a specific weekday."""
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
        
        # Validate required fields
        required_fields = ['weekday', 'start_time', 'end_time']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise TithiError(
                message=f"Missing required fields: {', '.join(missing_fields)}",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        staff_availability_service = StaffAvailabilityService()
        availability = staff_availability_service.create_availability(
            tenant_id=tenant_id,
            staff_profile_id=uuid.UUID(staff_id),
            availability_data=data,
            user_id=user_id
        )
        
        return jsonify({
            "id": str(availability.id),
            "staff_profile_id": str(availability.staff_profile_id),
            "weekday": availability.weekday,
            "start_time": availability.start_time.strftime('%H:%M'),
            "end_time": availability.end_time.strftime('%H:%M'),
            "is_active": availability.is_active,
            "created_at": availability.created_at.isoformat(),
            "updated_at": availability.updated_at.isoformat()
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message=f"Invalid data: {str(e)}",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except ValidationError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to create staff availability",
            code="TITHI_STAFF_AVAILABILITY_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/availability/<int:weekday>", methods=["PUT"])
@require_auth
@require_tenant
def update_staff_availability(staff_id: str, weekday: int):
    """Update staff availability for a specific weekday."""
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
        
        # Add weekday to data if not present
        if 'weekday' not in data:
            data['weekday'] = weekday
        
        staff_availability_service = StaffAvailabilityService()
        availability = staff_availability_service.create_availability(
            tenant_id=tenant_id,
            staff_profile_id=uuid.UUID(staff_id),
            availability_data=data,
            user_id=user_id
        )
        
        return jsonify({
            "id": str(availability.id),
            "staff_profile_id": str(availability.staff_profile_id),
            "weekday": availability.weekday,
            "start_time": availability.start_time.strftime('%H:%M'),
            "end_time": availability.end_time.strftime('%H:%M'),
            "is_active": availability.is_active,
            "created_at": availability.created_at.isoformat(),
            "updated_at": availability.updated_at.isoformat()
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message=f"Invalid data: {str(e)}",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except ValidationError as e:
        raise TithiError(
            message=str(e),
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to update staff availability",
            code="TITHI_STAFF_AVAILABILITY_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/availability/<int:weekday>", methods=["DELETE"])
@require_auth
@require_tenant
def delete_staff_availability(staff_id: str, weekday: int):
    """Delete staff availability for a specific weekday."""
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        staff_availability_service = StaffAvailabilityService()
        success = staff_availability_service.delete_availability(
            tenant_id=tenant_id,
            staff_profile_id=uuid.UUID(staff_id),
            weekday=weekday,
            user_id=user_id
        )
        
        if not success:
            raise TithiError(
                message="Staff availability not found",
                code="TITHI_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "message": "Staff availability deleted successfully",
            "staff_id": staff_id,
            "weekday": weekday
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message=f"Invalid staff ID: {str(e)}",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to delete staff availability",
            code="TITHI_STAFF_AVAILABILITY_ERROR"
        )


@api_v1_bp.route("/staff/<staff_id>/availability/slots", methods=["GET"])
@require_auth
@require_tenant
def get_staff_availability_slots(staff_id: str):
    """Get available time slots for a staff member within a date range."""
    try:
        tenant_id = g.tenant_id
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            raise TithiError(
                message="start_date and end_date parameters are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        staff_availability_service = StaffAvailabilityService()
        slots = staff_availability_service.get_available_slots(
            tenant_id=tenant_id,
            staff_profile_id=uuid.UUID(staff_id),
            start_date=start_dt,
            end_date=end_dt
        )
        
        return jsonify({
            "staff_id": staff_id,
            "slots": slots,
            "total": len(slots),
            "start_date": start_date,
            "end_date": end_date
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message=f"Invalid date format or staff ID: {str(e)}",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get staff availability slots",
            code="TITHI_STAFF_AVAILABILITY_ERROR"
        )


# Availability (Module F)
@api_v1_bp.route("/availability/<resource_id>/slots", methods=["GET"])
@require_auth
@require_tenant
def get_availability_slots(resource_id: str):
    """Get available time slots for a resource."""
    try:
        tenant_id = g.tenant_id
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            raise TithiError(
                message="start_date and end_date parameters are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        availability_service = AvailabilityService()
        slots = availability_service.get_available_slots(tenant_id, uuid.UUID(resource_id), start_dt, end_dt)
        
        return jsonify({
            "resource_id": resource_id,
            "slots": slots,
            "total": len(slots)
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format or resource ID",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get availability slots",
            code="TITHI_AVAILABILITY_ERROR"
        )
