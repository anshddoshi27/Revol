"""
SMS API Blueprint

This module provides REST API endpoints for SMS notifications.
Aligned with Task 7.2 requirements and TITHI_DATABASE_COMPREHENSIVE_REPORT.md.
"""

import uuid
from datetime import datetime
from flask import Blueprint, request, current_app
from flask_smorest import abort
from marshmallow import Schema, fields, validate, validates_schema, ValidationError
from sqlalchemy.exc import SQLAlchemyError

from ..services.sms_service import SMSService, SMSRequest, SMSErrorCode
from ..models.business import Customer
from ..models.core import Tenant
from ..middleware.auth_middleware import require_auth, get_current_tenant, get_current_user
from ..exceptions import TithiError


# Create blueprint
sms_bp = Blueprint('sms', __name__, url_prefix='/api/v1/notifications/sms')


class SMSSendSchema(Schema):
    """Schema for sending SMS."""
    customer_id = fields.UUID(required=False, allow_none=True)
    phone = fields.Str(required=True, validate=validate.Length(min=10, max=20))
    message = fields.Str(required=True, validate=validate.Length(min=1, max=1600))
    event_type = fields.Str(required=False, load_default="booking_reminder")
    scheduled_at = fields.DateTime(required=False, allow_none=True)
    metadata = fields.Dict(keys=fields.Str(), values=fields.Raw(), load_default=dict)
    
    @validates_schema
    def validate_phone(self, data, **kwargs):
        """Validate phone number format."""
        phone = data.get('phone', '')
        if not phone.startswith('+'):
            raise ValidationError('Phone number must start with +', field_name='phone')
        
        # Check if remaining characters are digits
        digits = phone[1:]
        if not digits.isdigit() or len(digits) < 10:
            raise ValidationError('Invalid phone number format', field_name='phone')


class SMSResponseSchema(Schema):
    """Schema for SMS response."""
    success = fields.Bool(required=True)
    delivery_id = fields.Str(required=False, allow_none=True)
    provider_message_id = fields.Str(required=False, allow_none=True)
    error_message = fields.Str(required=False, allow_none=True)
    error_code = fields.Str(required=False, allow_none=True)


class SMSStatusSchema(Schema):
    """Schema for SMS delivery status."""
    delivery_id = fields.Str(required=True)
    status = fields.Str(required=True)
    sent_at = fields.DateTime(required=False, allow_none=True)
    failed_at = fields.DateTime(required=False, allow_none=True)
    provider_message_id = fields.Str(required=False, allow_none=True)
    failure_reason = fields.Str(required=False, allow_none=True)


class BookingReminderSchema(Schema):
    """Schema for booking reminder SMS."""
    customer_id = fields.UUID(required=True)
    phone = fields.Str(required=True, validate=validate.Length(min=10, max=20))
    service_name = fields.Str(required=True)
    start_time = fields.Str(required=True)
    business_name = fields.Str(required=False, load_default="us")
    
    @validates_schema
    def validate_phone(self, data, **kwargs):
        """Validate phone number format."""
        phone = data.get('phone', '')
        if not phone.startswith('+'):
            raise ValidationError('Phone number must start with +', field_name='phone')


class CancellationSchema(Schema):
    """Schema for cancellation SMS."""
    customer_id = fields.UUID(required=True)
    phone = fields.Str(required=True, validate=validate.Length(min=10, max=20))
    service_name = fields.Str(required=True)
    business_name = fields.Str(required=False, load_default="us")


class PromotionSchema(Schema):
    """Schema for promotion SMS."""
    customer_id = fields.UUID(required=True)
    phone = fields.Str(required=True, validate=validate.Length(min=10, max=20))
    title = fields.Str(required=True)
    description = fields.Str(required=False, allow_none=True)
    business_name = fields.Str(required=False, load_default="us")


@sms_bp.route('/send', methods=['POST'])
@require_auth
def send_sms():
    """
    Send SMS notification.
    
    Returns:
        JSON response with SMS delivery status
    """
    try:
        # Get request data
        data = request.get_json()
        if not data:
            abort(400, message="Request data is required")
        
        # Validate data using schema
        schema = SMSSendSchema()
        try:
            sms_data = schema.load(data)
        except ValidationError as e:
            abort(400, message=f"Validation error: {e.messages}")
        tenant = get_current_tenant()
        user = get_current_user()
        
        # Create SMS request
        sms_request = SMSRequest(
            tenant_id=tenant.id,
            customer_id=sms_data.get('customer_id'),
            phone=sms_data['phone'],
            message=sms_data['message'],
            event_type=sms_data.get('event_type', 'booking_reminder'),
            scheduled_at=sms_data.get('scheduled_at'),
            metadata=sms_data.get('metadata', {})
        )
        
        # Send SMS
        sms_service = SMSService()
        result = sms_service.send_sms(sms_request)
        
        # Handle errors
        if not result.success:
            if result.error_code == SMSErrorCode.SMS_OPT_OUT:
                abort(403, message="Customer has opted out of SMS notifications")
            elif result.error_code == SMSErrorCode.SMS_INVALID_PHONE:
                abort(400, message="Invalid phone number format")
            elif result.error_code == SMSErrorCode.SMS_PROVIDER_ERROR:
                abort(502, message="SMS provider error")
            else:
                abort(500, message="SMS delivery failed")
        
        return {
            "success": result.success,
            "delivery_id": result.delivery_id,
            "provider_message_id": result.provider_message_id
        }
        
    except ValidationError as e:
        abort(400, message=str(e))
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in send_sms: {str(e)}")
        abort(500, message="Internal server error")
    except Exception as e:
        current_app.logger.error(f"Unexpected error in send_sms: {str(e)}")
        abort(500, message="Internal server error")


@sms_bp.route('/booking-reminder', methods=['POST'])
@require_auth
def send_booking_reminder():
    """
    Send booking reminder SMS.
    
    Returns:
        SMS delivery result
    """
    try:
        # Get request data
        data = request.get_json()
        if not data:
            abort(400, message="Request data is required")
        
        # Validate data using schema
        schema = BookingReminderSchema()
        try:
            reminder_data = schema.load(data)
        except ValidationError as e:
            abort(400, message=f"Validation error: {e.messages}")
        
        tenant = get_current_tenant()
        
        # Prepare booking details
        booking_details = {
            'service_name': reminder_data['service_name'],
            'start_time': reminder_data['start_time'],
            'business_name': reminder_data.get('business_name', 'us')
        }
        
        # Send booking reminder
        sms_service = SMSService()
        result = sms_service.send_booking_reminder(
            tenant_id=tenant.id,
            customer_id=reminder_data['customer_id'],
            phone=reminder_data['phone'],
            booking_details=booking_details
        )
        
        # Handle errors
        if not result.success:
            if result.error_code == SMSErrorCode.SMS_OPT_OUT:
                abort(403, message="Customer has opted out of SMS notifications")
            elif result.error_code == SMSErrorCode.SMS_INVALID_PHONE:
                abort(400, message="Invalid phone number format")
            else:
                abort(500, message="SMS delivery failed")
        
        return {
            "success": result.success,
            "delivery_id": result.delivery_id,
            "provider_message_id": result.provider_message_id
        }
        
    except ValidationError as e:
        abort(400, message=str(e))
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in send_booking_reminder: {str(e)}")
        abort(500, message="Internal server error")
    except Exception as e:
        current_app.logger.error(f"Unexpected error in send_booking_reminder: {str(e)}")
        abort(500, message="Internal server error")


@sms_bp.route('/cancellation', methods=['POST'])
@require_auth
def send_cancellation_notification():
    """
    Send booking cancellation SMS.
    
    Returns:
        SMS delivery result
    """
    try:
        # Get request data
        data = request.get_json()
        if not data:
            abort(400, message="Request data is required")
        
        # Validate data using schema
        schema = CancellationSchema()
        try:
            cancellation_data = schema.load(data)
        except ValidationError as e:
            abort(400, message=f"Validation error: {e.messages}")
        
        tenant = get_current_tenant()
        
        # Prepare booking details
        booking_details = {
            'service_name': cancellation_data['service_name'],
            'business_name': cancellation_data.get('business_name', 'us')
        }
        
        # Send cancellation notification
        sms_service = SMSService()
        result = sms_service.send_cancellation_notification(
            tenant_id=tenant.id,
            customer_id=cancellation_data['customer_id'],
            phone=cancellation_data['phone'],
            booking_details=booking_details
        )
        
        # Handle errors
        if not result.success:
            if result.error_code == SMSErrorCode.SMS_OPT_OUT:
                abort(403, message="Customer has opted out of SMS notifications")
            elif result.error_code == SMSErrorCode.SMS_INVALID_PHONE:
                abort(400, message="Invalid phone number format")
            else:
                abort(500, message="SMS delivery failed")
        
        return {
            "success": result.success,
            "delivery_id": result.delivery_id,
            "provider_message_id": result.provider_message_id
        }
        
    except ValidationError as e:
        abort(400, message=str(e))
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in send_cancellation_notification: {str(e)}")
        abort(500, message="Internal server error")
    except Exception as e:
        current_app.logger.error(f"Unexpected error in send_cancellation_notification: {str(e)}")
        abort(500, message="Internal server error")


@sms_bp.route('/promotion', methods=['POST'])
@require_auth
def send_promotion_sms():
    """
    Send promotion SMS (requires explicit opt-in).
    
    Returns:
        SMS delivery result
    """
    try:
        # Get request data
        data = request.get_json()
        if not data:
            abort(400, message="Request data is required")
        
        # Validate data using schema
        schema = PromotionSchema()
        try:
            promotion_data = schema.load(data)
        except ValidationError as e:
            abort(400, message=f"Validation error: {e.messages}")
        
        tenant = get_current_tenant()
        
        # Prepare promotion details
        promotion_details = {
            'title': promotion_data['title'],
            'description': promotion_data.get('description'),
            'business_name': promotion_data.get('business_name', 'us')
        }
        
        # Send promotion SMS
        sms_service = SMSService()
        result = sms_service.send_promotion_sms(
            tenant_id=tenant.id,
            customer_id=promotion_data['customer_id'],
            phone=promotion_data['phone'],
            promotion_details=promotion_details
        )
        
        # Handle errors
        if not result.success:
            if result.error_code == SMSErrorCode.SMS_OPT_OUT:
                abort(403, message="Customer has opted out of SMS notifications")
            elif result.error_code == SMSErrorCode.SMS_INVALID_PHONE:
                abort(400, message="Invalid phone number format")
            else:
                abort(500, message="SMS delivery failed")
        
        return {
            "success": result.success,
            "delivery_id": result.delivery_id,
            "provider_message_id": result.provider_message_id
        }
        
    except ValidationError as e:
        abort(400, message=str(e))
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in send_promotion_sms: {str(e)}")
        abort(500, message="Internal server error")
    except Exception as e:
        current_app.logger.error(f"Unexpected error in send_promotion_sms: {str(e)}")
        abort(500, message="Internal server error")


@sms_bp.route('/status/<delivery_id>', methods=['GET'])
@require_auth
def get_sms_status(delivery_id):
    """
    Get SMS delivery status.
    
    Args:
        delivery_id: SMS delivery ID
        
    Returns:
        SMS delivery status
    """
    try:
        sms_service = SMSService()
        status = sms_service.get_sms_delivery_status(delivery_id)
        
        if not status:
            abort(404, message="SMS delivery not found")
        
        return status
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in get_sms_status: {str(e)}")
        abort(500, message="Internal server error")
    except Exception as e:
        current_app.logger.error(f"Unexpected error in get_sms_status: {str(e)}")
        abort(500, message="Internal server error")
