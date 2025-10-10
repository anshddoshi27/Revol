"""
Monitoring API Blueprint
Provides comprehensive monitoring endpoints for observability

Endpoints:
- GET /monitoring/dashboard: Monitoring dashboard data
- GET /monitoring/health: Comprehensive health status
- GET /monitoring/metrics: Current metrics
- GET /monitoring/alerts: Alert history and status
- GET /monitoring/performance: Performance metrics
- POST /monitoring/alerts/test: Test alerting system
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from flask import Blueprint, jsonify, request, current_app
from ..services.monitoring_service import get_monitoring_service
from ..services.alerting_service import get_alerting_service, AlertType, AlertSeverity, Alert
from ..middleware.metrics_middleware import get_metrics_middleware

monitoring_bp = Blueprint("monitoring", __name__, url_prefix="/monitoring")
logger = logging.getLogger(__name__)


@monitoring_bp.route("/dashboard", methods=["GET"])
def monitoring_dashboard():
    """
    Get comprehensive monitoring dashboard data.
    
    Returns:
        JSON response with dashboard data including metrics, health, and alerts
    """
    try:
        monitoring_service = get_monitoring_service()
        dashboard_data = monitoring_service.get_monitoring_dashboard_data()
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': dashboard_data
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get monitoring dashboard data: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/health", methods=["GET"])
def monitoring_health():
    """
    Get comprehensive system health status.
    
    Returns:
        JSON response with detailed health information
    """
    try:
        monitoring_service = get_monitoring_service()
        health_status = monitoring_service.check_system_health()
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': health_status
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get health status: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/metrics", methods=["GET"])
def monitoring_metrics():
    """
    Get current system metrics.
    
    Returns:
        JSON response with current metrics
    """
    try:
        metrics_middleware = get_metrics_middleware()
        
        # Get current metrics (this would typically come from Prometheus)
        metrics_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'system': {
                'cpu_percent': 0,  # Would be populated by actual metrics
                'memory_percent': 0,
                'disk_percent': 0,
                'load_average': [0, 0, 0]
            },
            'application': {
                'uptime_seconds': time.time() - getattr(current_app, 'start_time', time.time()),
                'environment': current_app.config.get('ENV', 'development'),
                'debug_mode': current_app.debug
            },
            'http': {
                'requests_per_second': 0,
                'response_time_p95': 0,
                'error_rate_percent': 0
            },
            'database': {
                'queries_per_second': 0,
                'connection_pool_size': 0,
                'active_connections': 0
            },
            'business': {
                'bookings_per_hour': 0,
                'payments_per_hour': 0,
                'no_show_rate_percent': 0
            }
        }
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': metrics_data
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/alerts", methods=["GET"])
def monitoring_alerts():
    """
    Get alert history and current alert status.
    
    Query Parameters:
        limit: Maximum number of alerts to return (default: 100)
        severity: Filter by severity level
        status: Filter by alert status
        
    Returns:
        JSON response with alert information
    """
    try:
        alerting_service = get_alerting_service()
        
        # Get query parameters
        limit = request.args.get('limit', 100, type=int)
        severity = request.args.get('severity')
        status = request.args.get('status')
        
        # Get alert history
        alerts = alerting_service.get_alert_history(limit=limit)
        
        # Filter alerts if requested
        if severity:
            alerts = [alert for alert in alerts if alert.severity.value == severity]
        
        if status:
            alerts = [alert for alert in alerts if alert.resolved_at is None if status == 'active' else alert.resolved_at is not None]
        
        # Convert to dictionary format
        alerts_data = [alert.to_dict() for alert in alerts]
        
        # Get alert summary
        alert_summary = {
            'total_alerts': len(alerts_data),
            'active_alerts': len([alert for alert in alerts_data if alert['resolved_at'] is None]),
            'resolved_alerts': len([alert for alert in alerts_data if alert['resolved_at'] is not None]),
            'critical_alerts': len([alert for alert in alerts_data if alert['severity'] == 'critical']),
            'warning_alerts': len([alert for alert in alerts_data if alert['severity'] == 'warning'])
        }
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {
                'alerts': alerts_data,
                'summary': alert_summary
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get alerts: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/performance", methods=["GET"])
def monitoring_performance():
    """
    Get performance metrics and analysis.
    
    Query Parameters:
        time_range: Time range for metrics (default: 1h)
        granularity: Data granularity (default: 1m)
        
    Returns:
        JSON response with performance metrics
    """
    try:
        # Get query parameters
        time_range = request.args.get('time_range', '1h')
        granularity = request.args.get('granularity', '1m')
        
        # This would typically query time-series data from Prometheus or InfluxDB
        # For now, return simulated performance data
        performance_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'time_range': time_range,
            'granularity': granularity,
            'metrics': {
                'response_time': {
                    'p50': 0.2,
                    'p95': 0.8,
                    'p99': 2.1,
                    'max': 5.0
                },
                'throughput': {
                    'requests_per_second': 150,
                    'requests_per_minute': 9000,
                    'requests_per_hour': 540000
                },
                'error_rates': {
                    '4xx_percent': 2.1,
                    '5xx_percent': 0.3,
                    'total_error_percent': 2.4
                },
                'resource_usage': {
                    'cpu_percent': 45.2,
                    'memory_percent': 67.8,
                    'disk_percent': 23.1
                },
                'business_metrics': {
                    'bookings_per_hour': 25,
                    'payments_per_hour': 23,
                    'no_show_rate_percent': 8.5
                }
            },
            'trends': {
                'response_time_trend': 'stable',
                'throughput_trend': 'increasing',
                'error_rate_trend': 'decreasing',
                'resource_usage_trend': 'stable'
            }
        }
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': performance_data
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/alerts/test", methods=["POST"])
def test_alerting():
    """
    Test the alerting system by sending a test alert.
    
    Request Body:
        alert_type: Type of alert to test
        severity: Severity level
        message: Test message
        
    Returns:
        JSON response with test result
    """
    try:
        data = request.get_json() or {}
        
        alert_type = data.get('alert_type', 'error_rate')
        severity = data.get('severity', 'warning')
        message = data.get('message', 'Test alert from monitoring API')
        
        # Create test alert
        alert = Alert(
            alert_type=AlertType.ERROR_RATE if alert_type == 'error_rate' else AlertType.RESPONSE_TIME,
            severity=AlertSeverity.WARNING if severity == 'warning' else AlertSeverity.CRITICAL,
            message=message,
            details={'test': True, 'timestamp': datetime.utcnow().isoformat()}
        )
        
        # Send test alert
        alerting_service = get_alerting_service()
        alerting_service.send_alert(alert)
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'message': 'Test alert sent successfully',
            'alert': alert.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to send test alert: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/config", methods=["GET"])
def monitoring_config():
    """
    Get monitoring configuration.
    
    Returns:
        JSON response with monitoring configuration
    """
    try:
        monitoring_service = get_monitoring_service()
        
        config_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'monitoring_config': monitoring_service.monitoring_config,
            'alert_thresholds': monitoring_service.alert_thresholds,
            'health_check_config': {
                'database': {'enabled': True, 'timeout': 5},
                'redis': {'enabled': True, 'timeout': 3},
                'celery': {'enabled': True, 'timeout': 5},
                'external_services': {
                    'stripe': {'enabled': True, 'timeout': 10},
                    'twilio': {'enabled': True, 'timeout': 10},
                    'sendgrid': {'enabled': True, 'timeout': 10}
                }
            }
        }
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': config_data
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get monitoring config: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500


@monitoring_bp.route("/status", methods=["GET"])
def monitoring_status():
    """
    Get overall monitoring system status.
    
    Returns:
        JSON response with monitoring system status
    """
    try:
        # Check if all monitoring components are working
        components_status = {
            'metrics_middleware': True,  # Would check actual status
            'alerting_service': True,    # Would check actual status
            'monitoring_service': True,  # Would check actual status
            'health_checks': True,      # Would check actual status
            'external_services': True   # Would check actual status
        }
        
        overall_status = 'healthy' if all(components_status.values()) else 'degraded'
        
        status_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'overall_status': overall_status,
            'components': components_status,
            'uptime': time.time() - getattr(current_app, 'start_time', time.time()),
            'version': '1.0.0',
            'environment': current_app.config.get('ENV', 'development')
        }
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat(),
            'data': status_data
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get monitoring status: {e}")
        return jsonify({
            'status': 'error',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500
