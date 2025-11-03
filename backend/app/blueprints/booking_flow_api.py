"""
Booking Flow API Blueprint

This blueprint provides comprehensive API endpoints for the customer booking flow,
including service selection, availability checking, customer data collection,
payment processing, and booking confirmation.
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import logging
from datetime import datetime
from typing import Dict, Any

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.booking_flow_service import BookingFlowService
from ..extensions import db

logger = logging.getLogger(__name__)

booking_flow_bp = Blueprint("booking_flow", __name__)


@booking_flow_bp.route("/booking/tenant-data/<tenant_id>", methods=["GET"])
def get_tenant_booking_data(tenant_id):
    """
    Get all data needed for the booking flow for a tenant.
    This is a public endpoint that doesn't require authentication.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        Complete booking flow data including:
        - business_info: Business information
        - categories: Service categories with services
        - team_members: Available team members
        - policies: Business policies
        - booking_url: Booking URL
    """
    try:
        booking_flow_service = BookingFlowService()
        data = booking_flow_service.get_tenant_booking_data(tenant_id)
        
        return jsonify({
            "success": True,
            "data": data
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get tenant booking data: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@booking_flow_bp.route("/booking/availability", methods=["POST"])
def check_availability():
    """
    Check availability for a service within a date range.
    
    Request Body:
        - tenant_id: Tenant ID
        - service_id: Service ID
        - start_date: Start date for availability check (ISO format)
        - end_date: End date for availability check (ISO format)
        - team_member_id: Optional specific team member ID
    
    Returns:
        Array of available time slots with:
        - start_time: Slot start time
        - end_time: Slot end time
        - team_member_id: Team member ID
        - team_member_name: Team member name
        - service_id: Service ID
        - service_name: Service name
        - duration_minutes: Service duration
        - price_cents: Service price
    """
    try:
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        required_fields = ['tenant_id', 'service_id', 'start_date', 'end_date']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        booking_flow_service = BookingFlowService()
        availability = booking_flow_service.check_availability(
            tenant_id=data['tenant_id'],
            service_id=data['service_id'],
            start_date=datetime.fromisoformat(data['start_date']),
            end_date=datetime.fromisoformat(data['end_date']),
            team_member_id=data.get('team_member_id')
        )
        
        return jsonify({
            "success": True,
            "data": {
                "available_slots": availability,
                "total_slots": len(availability)
            }
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to check availability: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@booking_flow_bp.route("/booking/create", methods=["POST"])
def create_booking():
    """
    Create a new booking with customer information and payment.
    
    Request Body:
        - tenant_id: Tenant ID
        - service_id: Service ID
        - team_member_id: Team member ID
        - start_time: Booking start time (ISO format)
        - customer_info: Customer information object
            - name: Customer name
            - email: Customer email
            - phone: Customer phone
            - marketing_opt_in: Marketing opt-in boolean
        - payment_method: Payment method object
        - gift_card_code: Optional gift card code
        - coupon_code: Optional coupon code
        - special_requests: Optional special requests
    
    Returns:
        Booking confirmation with:
        - booking_id: Created booking ID
        - status: Booking status
        - payment_status: Payment status
        - total_amount_cents: Total amount
        - currency: Currency
        - start_time: Booking start time
        - end_time: Booking end time
        - service_name: Service name
        - team_member_name: Team member name
        - customer_name: Customer name
        - confirmation_number: Confirmation number
    """
    try:
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        required_fields = ['tenant_id', 'service_id', 'team_member_id', 'start_time', 'customer_info']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Validate customer info
        customer_info = data['customer_info']
        required_customer_fields = ['name', 'email']
        for field in required_customer_fields:
            if field not in customer_info:
                raise TithiError(
                    message=f"Missing required customer field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        booking_flow_service = BookingFlowService()
        booking = booking_flow_service.create_booking(
            tenant_id=data['tenant_id'],
            booking_data=data
        )
        
        return jsonify({
            "success": True,
            "data": booking,
            "message": "Booking created successfully"
        }), 201
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to create booking: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@booking_flow_bp.route("/booking/confirm/<booking_id>", methods=["POST"])
def confirm_booking(booking_id):
    """
    Confirm a booking (admin action).
    
    Args:
        booking_id: Booking ID to confirm
    
    Returns:
        Updated booking information
    """
    try:
        from ..models.business import Booking
        
        booking = Booking.query.get(booking_id)
        if not booking:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        # Update booking status
        booking.status = 'confirmed'
        booking.payment_status = 'paid'
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": {
                "booking_id": str(booking.id),
                "status": booking.status,
                "payment_status": booking.payment_status,
                "confirmed_at": datetime.utcnow().isoformat()
            },
            "message": "Booking confirmed successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to confirm booking: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@booking_flow_bp.route("/booking/<booking_id>", methods=["GET"])
def get_booking_details(booking_id):
    """
    Get booking details by ID.
    
    Args:
        booking_id: Booking ID
    
    Returns:
        Complete booking information
    """
    try:
        from ..models.business import Booking
        
        booking = Booking.query.get(booking_id)
        if not booking:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        return jsonify({
            "success": True,
            "data": {
                "booking_id": str(booking.id),
                "customer_id": str(booking.customer_id),
                "service_id": str(booking.resource_id),
                "start_time": booking.start_at.isoformat(),
                "end_time": booking.end_at.isoformat(),
                "status": booking.status,
                "payment_status": getattr(booking, 'payment_status', 'pending'),
                "total_amount_cents": booking.total_amount_cents,
                "currency": booking.currency,
                "attendee_count": booking.attendee_count,
                "confirmation_number": booking.client_generated_id,
                "created_at": booking.created_at.isoformat(),
                "updated_at": booking.updated_at.isoformat()
            }
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get booking details: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@booking_flow_bp.route("/booking/cancel/<booking_id>", methods=["POST"])
def cancel_booking(booking_id):
    """
    Cancel a booking.
    
    Args:
        booking_id: Booking ID to cancel
    
    Request Body:
        - reason: Cancellation reason (optional)
    
    Returns:
        Updated booking information
    """
    try:
        from ..models.business import Booking
        
        booking = Booking.query.get(booking_id)
        if not booking:
            raise TithiError(
                message="Booking not found",
                code="TITHI_BOOKING_NOT_FOUND",
                status_code=404
            )
        
        data = request.get_json() or {}
        
        # Update booking status
        booking.status = 'cancelled'
        booking.metadata = booking.metadata or {}
        booking.metadata['cancellation_reason'] = data.get('reason', 'No reason provided')
        booking.metadata['cancelled_at'] = datetime.utcnow().isoformat()
        
        db.session.commit()
        
        return jsonify({
            "success": True,
            "data": {
                "booking_id": str(booking.id),
                "status": booking.status,
                "cancelled_at": booking.metadata['cancelled_at']
            },
            "message": "Booking cancelled successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to cancel booking: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


