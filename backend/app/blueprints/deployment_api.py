"""
Deployment API
Endpoints for managing deployments and rollbacks
"""

from flask import Blueprint, request, jsonify, g
from app.services.deployment_service import deployment_service
from app.middleware.auth_middleware import require_auth, require_role
from app.middleware.tenant_middleware import require_tenant
import structlog

logger = structlog.get_logger(__name__)

deployment_bp = Blueprint('deployment', __name__, url_prefix='/api/v1/deployments')


@deployment_bp.route('/', methods=['POST'])
@require_auth
@require_role('admin')
@require_tenant
def create_deployment():
    """Create a new deployment."""
    try:
        data = request.get_json()
        
        if not data or 'version' not in data:
            return jsonify({'error': 'Version is required'}), 400
        
        version = data['version']
        config = data.get('config', {})
        
        # Start blue-green deployment
        result = deployment_service.start_blue_green_deployment(version, config)
        
        if result['status'] == 'failed':
            return jsonify({'error': result['error']}), 500
        
        return jsonify({
            'deployment_id': result['deployment_id'],
            'status': result['status'],
            'environment': result['environment'],
            'version': result['version']
        }), 201
        
    except Exception as e:
        logger.error("Failed to create deployment", error=str(e))
        return jsonify({'error': 'Internal server error'}), 500


@deployment_bp.route('/<int:deployment_id>/rollback', methods=['POST'])
@require_auth
@require_role('admin')
@require_tenant
def rollback_deployment(deployment_id):
    """Rollback a deployment."""
    try:
        result = deployment_service.rollback_deployment(deployment_id)
        
        if result['status'] == 'failed':
            return jsonify({'error': result['error']}), 500
        
        return jsonify({
            'rollback_id': result['rollback_id'],
            'status': result['status'],
            'environment': result['environment'],
            'version': result['version']
        }), 200
        
    except Exception as e:
        logger.error("Failed to rollback deployment", error=str(e), deployment_id=deployment_id)
        return jsonify({'error': 'Internal server error'}), 500


@deployment_bp.route('/<int:deployment_id>', methods=['GET'])
@require_auth
@require_role('admin')
@require_tenant
def get_deployment_status(deployment_id):
    """Get deployment status."""
    try:
        result = deployment_service.get_deployment_status(deployment_id)
        return jsonify(result), 200
        
    except Exception as e:
        logger.error("Failed to get deployment status", error=str(e), deployment_id=deployment_id)
        return jsonify({'error': 'Internal server error'}), 500


@deployment_bp.route('/', methods=['GET'])
@require_auth
@require_role('admin')
@require_tenant
def list_deployments():
    """List recent deployments."""
    try:
        limit = request.args.get('limit', 10, type=int)
        result = deployment_service.list_deployments(limit)
        return jsonify(result), 200
        
    except Exception as e:
        logger.error("Failed to list deployments", error=str(e))
        return jsonify({'error': 'Internal server error'}), 500


@deployment_bp.route('/health', methods=['GET'])
def deployment_health():
    """Check deployment system health."""
    try:
        # Get current environment
        current_env = deployment_service._get_current_environment()
        
        # Run health check
        health_result = deployment_service._run_health_checks(current_env)
        
        return jsonify({
            'status': 'healthy' if health_result['success'] else 'unhealthy',
            'environment': current_env,
            'health_check': health_result
        }), 200
        
    except Exception as e:
        logger.error("Failed to check deployment health", error=str(e))
        return jsonify({'error': 'Internal server error'}), 500
