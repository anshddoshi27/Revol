"""
Idempotency API Blueprint for Tithi Backend

This blueprint provides API endpoints for managing idempotency keys.

Phase: 11 - Cross-Cutting Utilities (Module N)
Task: 11.4 - Idempotency Keys
"""

import logging
from flask import Blueprint, request, jsonify, g
from flask_smorest import Api, abort
from marshmallow import Schema, fields, validate

from ..extensions import db
from ..models.idempotency import IdempotencyKey
from ..services.idempotency import IdempotencyService

logger = logging.getLogger(__name__)

# Create blueprint
idempotency_bp = Blueprint('idempotency', __name__, url_prefix='/api/idempotency')

# Schemas
class IdempotencyStatsSchema(Schema):
    """Schema for idempotency statistics"""
    total_keys = fields.Integer(required=True)
    active_keys = fields.Integer(required=True)
    expired_keys = fields.Integer(required=True)

class IdempotencyKeySchema(Schema):
    """Schema for idempotency key information"""
    id = fields.String(required=True)
    endpoint = fields.String(required=True)
    method = fields.String(required=True)
    response_status = fields.Integer(required=True)
    expires_at = fields.DateTime(required=True)
    created_at = fields.DateTime(required=True)

class ExtendExpirationSchema(Schema):
    """Schema for extending idempotency key expiration"""
    idempotency_key = fields.String(required=True, validate=validate.Length(min=1, max=255))
    endpoint = fields.String(required=True)
    method = fields.String(required=True, validate=validate.OneOf(['GET', 'POST', 'PUT', 'DELETE']))
    hours = fields.Integer(required=False, validate=validate.Range(min=1, max=168), load_default=24)

class CleanupResponseSchema(Schema):
    """Schema for cleanup response"""
    cleaned_count = fields.Integer(required=True)
    message = fields.String(required=True)


@idempotency_bp.route('/stats', methods=['GET'])
def get_idempotency_stats():
    """
    Get idempotency key statistics for the current tenant.
    
    Returns:
        JSON: Statistics about idempotency keys
    """
    try:
        stats = IdempotencyService.get_tenant_stats(g.current_tenant_id)
        
        logger.info(
            "IDEMPOTENCY_STATS_REQUESTED",
            extra={
                'tenant_id': g.current_tenant_id,
                'user_id': g.current_user_id,
                'total_keys': stats['total_keys'],
                'active_keys': stats['active_keys']
            }
        )
        
        return jsonify({
            'success': True,
            'data': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get idempotency stats: {e}")
        abort(500, message="Failed to get idempotency statistics")


@idempotency_bp.route('/keys', methods=['GET'])
def list_idempotency_keys():
    """
    List idempotency keys for the current tenant.
    
    Query Parameters:
        - limit: Maximum number of keys to return (default: 50)
        - offset: Number of keys to skip (default: 0)
        - endpoint: Filter by endpoint
        - method: Filter by HTTP method
        - expired: Filter by expiration status (true/false)
    
    Returns:
        JSON: List of idempotency keys
    """
    try:
        # Parse query parameters
        limit = min(int(request.args.get('limit', 50)), 100)  # Cap at 100
        offset = int(request.args.get('offset', 0))
        endpoint_filter = request.args.get('endpoint')
        method_filter = request.args.get('method')
        expired_filter = request.args.get('expired')
        
        # Build query
        query = IdempotencyKey.query.filter_by(tenant_id=g.current_tenant_id)
        
        if endpoint_filter:
            query = query.filter(IdempotencyKey.endpoint.ilike(f'%{endpoint_filter}%'))
        
        if method_filter:
            query = query.filter(IdempotencyKey.method == method_filter.upper())
        
        if expired_filter is not None:
            if expired_filter.lower() == 'true':
                query = query.filter(IdempotencyKey.expires_at < db.func.now())
            elif expired_filter.lower() == 'false':
                query = query.filter(IdempotencyKey.expires_at >= db.func.now())
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        keys = query.order_by(IdempotencyKey.created_at.desc()).offset(offset).limit(limit).all()
        
        # Serialize results
        result = {
            'keys': [key.to_dict() for key in keys],
            'pagination': {
                'total': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total_count
            }
        }
        
        logger.info(
            "IDEMPOTENCY_KEYS_LISTED",
            extra={
                'tenant_id': g.current_tenant_id,
                'user_id': g.current_user_id,
                'total_count': total_count,
                'returned_count': len(keys)
            }
        )
        
        return jsonify({
            'success': True,
            'data': result
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to list idempotency keys: {e}")
        abort(500, message="Failed to list idempotency keys")


@idempotency_bp.route('/extend', methods=['POST'])
def extend_key_expiration():
    """
    Extend the expiration time of an idempotency key.
    
    Body:
        JSON: ExtendExpirationSchema
        
    Returns:
        JSON: Success status
    """
    try:
        data = request.get_json()
        if not data:
            abort(400, message="Request body is required")
        
        # Validate input
        schema = ExtendExpirationSchema()
        try:
            validated_data = schema.load(data)
        except Exception as e:
            abort(400, message=f"Invalid input: {e}")
        
        # Validate idempotency key format
        if not IdempotencyService.validate_idempotency_key(validated_data['idempotency_key']):
            abort(400, message="Invalid idempotency key format")
        
        # Extend expiration
        success = IdempotencyService.extend_key_expiration(
            tenant_id=g.current_tenant_id,
            idempotency_key=validated_data['idempotency_key'],
            endpoint=validated_data['endpoint'],
            method=validated_data['method'],
            request_data={},  # Empty for extension
            hours=validated_data.get('hours', 24)
        )
        
        if not success:
            abort(404, message="Idempotency key not found")
        
        logger.info(
            "IDEMPOTENCY_KEY_EXTENDED",
            extra={
                'tenant_id': g.current_tenant_id,
                'user_id': g.current_user_id,
                'idempotency_key': validated_data['idempotency_key'][:8] + '...',
                'endpoint': validated_data['endpoint'],
                'hours': validated_data.get('hours', 24)
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Idempotency key expiration extended successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to extend key expiration: {e}")
        abort(500, message="Failed to extend key expiration")


@idempotency_bp.route('/cleanup', methods=['POST'])
def cleanup_expired_keys():
    """
    Clean up expired idempotency keys for the current tenant.
    
    Returns:
        JSON: Cleanup results
    """
    try:
        cleaned_count = IdempotencyService.cleanup_expired_keys()
        
        logger.info(
            "IDEMPOTENCY_KEYS_CLEANED",
            extra={
                'tenant_id': g.current_tenant_id,
                'user_id': g.current_user_id,
                'cleaned_count': cleaned_count
            }
        )
        
        return jsonify({
            'success': True,
            'data': {
                'cleaned_count': cleaned_count,
                'message': f'Cleaned up {cleaned_count} expired idempotency keys'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired keys: {e}")
        abort(500, message="Failed to cleanup expired keys")


@idempotency_bp.route('/validate', methods=['POST'])
def validate_idempotency_key():
    """
    Validate an idempotency key format.
    
    Body:
        JSON: {"idempotency_key": "string"}
        
    Returns:
        JSON: Validation result
    """
    try:
        data = request.get_json()
        if not data or 'idempotency_key' not in data:
            abort(400, message="idempotency_key is required")
        
        idempotency_key = data['idempotency_key']
        is_valid = IdempotencyService.validate_idempotency_key(idempotency_key)
        
        return jsonify({
            'success': True,
            'data': {
                'is_valid': is_valid,
                'key_length': len(idempotency_key),
                'message': 'Valid idempotency key format' if is_valid else 'Invalid idempotency key format'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to validate idempotency key: {e}")
        abort(500, message="Failed to validate idempotency key")


@idempotency_bp.route('/health', methods=['GET'])
def health_check():
    """
    Health check endpoint for idempotency service.
    
    Returns:
        JSON: Service health status
    """
    try:
        # Check database connectivity
        db.session.execute('SELECT 1')
        
        # Get basic stats
        stats = IdempotencyService.get_tenant_stats(g.current_tenant_id if hasattr(g, 'current_tenant_id') else None)
        
        return jsonify({
            'success': True,
            'status': 'healthy',
            'data': {
                'service': 'idempotency',
                'database': 'connected',
                'stats': stats
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Idempotency service health check failed: {e}")
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e)
        }), 500
