"""
Timezone API Blueprint

This module provides API endpoints for timezone management and conversion.
"""

import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_smorest import abort
from marshmallow import Schema, fields, validate
from sqlalchemy.orm import Session

from ..services.timezone_service import timezone_service
from ..middleware.auth_middleware import require_auth, require_role
from ..exceptions import TithiError
from ..extensions import db

logger = logging.getLogger(__name__)

# Create blueprint
timezone_bp = Blueprint('timezone', __name__, url_prefix='/api/v1/timezone')


# Schemas
class TimezoneConversionSchema(Schema):
    """Schema for timezone conversion requests."""
    datetime = fields.DateTime(required=True)
    tenant_id = fields.UUID(required=True)
    conversion_type = fields.String(
        required=True, 
        validate=validate.OneOf(['to_tenant', 'to_utc'])
    )


class TimezoneUpdateSchema(Schema):
    """Schema for timezone update requests."""
    timezone = fields.String(required=True)


class TimezoneValidationSchema(Schema):
    """Schema for timezone validation requests."""
    timezone = fields.String(required=True)


# Response schemas
class TimezoneConversionResponseSchema(Schema):
    """Schema for timezone conversion responses."""
    original_datetime = fields.DateTime()
    converted_datetime = fields.DateTime()
    conversion_type = fields.String()
    tenant_id = fields.UUID()
    timezone = fields.String()


class TimezoneUpdateResponseSchema(Schema):
    """Schema for timezone update responses."""
    tenant_id = fields.UUID()
    old_timezone = fields.String()
    new_timezone = fields.String()
    updated_at = fields.DateTime()


class TimezoneValidationResponseSchema(Schema):
    """Schema for timezone validation responses."""
    valid = fields.Boolean()
    timezone = fields.String()
    utc_offset = fields.String()
    dst_active = fields.Boolean()
    current_time = fields.String()
    utc_time = fields.String()


class TimezoneListResponseSchema(Schema):
    """Schema for timezone list responses."""
    timezones = fields.List(
        fields.Dict(keys=fields.String(), values=fields.String())
    )


@timezone_bp.route('/convert', methods=['POST'])
@require_auth
def convert_timezone():
    """
    Convert datetime between UTC and tenant timezone.
    
    POST /api/v1/timezone/convert
    """
    try:
        data = request.get_json()
        schema = TimezoneConversionSchema()
        
        try:
            validated_data = schema.load(data)
        except Exception as e:
            abort(400, message=f"Invalid request data: {str(e)}")
        
        tenant_id = str(validated_data['tenant_id'])
        datetime_to_convert = validated_data['datetime']
        conversion_type = validated_data['conversion_type']
        
        # Perform conversion
        if conversion_type == 'to_tenant':
            converted_datetime = timezone_service.convert_to_tenant_timezone(
                datetime_to_convert, tenant_id
            )
        else:  # to_utc
            converted_datetime = timezone_service.convert_to_utc(
                datetime_to_convert, tenant_id
            )
        
        # Get tenant timezone for response
        tenant_tz = timezone_service.get_tenant_timezone(tenant_id)
        
        response_data = {
            'original_datetime': datetime_to_convert.isoformat() + 'Z',
            'converted_datetime': converted_datetime.isoformat() + 'Z',
            'conversion_type': conversion_type,
            'tenant_id': tenant_id,
            'timezone': str(tenant_tz)
        }
        
        logger.info(f"Timezone conversion completed: {conversion_type} for tenant {tenant_id}")
        
        return jsonify(response_data), 200
        
    except TithiError as e:
        logger.error(f"Timezone conversion error: {str(e)}")
        abort(e.status_code, message=e.message, code=e.code)
    except Exception as e:
        logger.error(f"Unexpected error in timezone conversion: {str(e)}")
        abort(500, message="Internal server error")


@timezone_bp.route('/tenant/<tenant_id>', methods=['PUT'])
@require_auth
@require_role(['owner', 'admin'])
def update_tenant_timezone(tenant_id):
    """
    Update tenant timezone setting.
    
    PUT /api/v1/timezone/tenant/<tenant_id>
    """
    try:
        data = request.get_json()
        schema = TimezoneUpdateSchema()
        
        try:
            validated_data = schema.load(data)
        except Exception as e:
            abort(400, message=f"Invalid request data: {str(e)}")
        
        timezone_str = validated_data['timezone']
        
        # Update tenant timezone
        result = timezone_service.update_tenant_timezone(tenant_id, timezone_str)
        
        logger.info(f"Updated timezone for tenant {tenant_id} to {timezone_str}")
        
        return jsonify(result), 200
        
    except TithiError as e:
        logger.error(f"Timezone update error: {str(e)}")
        abort(e.status_code, message=e.message, code=e.code)
    except Exception as e:
        logger.error(f"Unexpected error in timezone update: {str(e)}")
        abort(500, message="Internal server error")


@timezone_bp.route('/validate', methods=['POST'])
@require_auth
def validate_timezone():
    """
    Validate a timezone string.
    
    POST /api/v1/timezone/validate
    """
    try:
        data = request.get_json()
        schema = TimezoneValidationSchema()
        
        try:
            validated_data = schema.load(data)
        except Exception as e:
            abort(400, message=f"Invalid request data: {str(e)}")
        
        timezone_str = validated_data['timezone']
        
        # Validate timezone
        result = timezone_service.validate_timezone(timezone_str)
        
        logger.info(f"Timezone validation completed for: {timezone_str}")
        
        return jsonify(result), 200
        
    except TithiError as e:
        logger.error(f"Timezone validation error: {str(e)}")
        abort(e.status_code, message=e.message, code=e.code)
    except Exception as e:
        logger.error(f"Unexpected error in timezone validation: {str(e)}")
        abort(500, message="Internal server error")


@timezone_bp.route('/available', methods=['GET'])
@require_auth
def get_available_timezones():
    """
    Get list of available timezones.
    
    GET /api/v1/timezone/available
    """
    try:
        timezones = timezone_service.get_available_timezones()
        
        response_data = {
            'timezones': timezones,
            'count': len(timezones)
        }
        
        logger.info(f"Retrieved {len(timezones)} available timezones")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Unexpected error getting available timezones: {str(e)}")
        abort(500, message="Internal server error")


@timezone_bp.route('/tenant/<tenant_id>/current', methods=['GET'])
@require_auth
def get_tenant_current_time(tenant_id):
    """
    Get current time in tenant timezone.
    
    GET /api/v1/timezone/tenant/<tenant_id>/current
    """
    try:
        # Get current UTC time
        now_utc = datetime.utcnow()
        
        # Convert to tenant timezone
        tenant_time = timezone_service.convert_to_tenant_timezone(now_utc, tenant_id)
        tenant_tz = timezone_service.get_tenant_timezone(tenant_id)
        
        response_data = {
            'tenant_id': tenant_id,
            'timezone': str(tenant_tz),
            'utc_time': now_utc.isoformat() + 'Z',
            'tenant_time': tenant_time.isoformat() + 'Z',
            'utc_offset': tenant_time.strftime('%z'),
            'dst_active': tenant_time.dst() != timezone_service._parse_timezone('UTC').localize(datetime(1970, 1, 1)).dst()
        }
        
        logger.info(f"Retrieved current time for tenant {tenant_id}")
        
        return jsonify(response_data), 200
        
    except TithiError as e:
        logger.error(f"Get tenant time error: {str(e)}")
        abort(e.status_code, message=e.message, code=e.code)
    except Exception as e:
        logger.error(f"Unexpected error getting tenant time: {str(e)}")
        abort(500, message="Internal server error")
