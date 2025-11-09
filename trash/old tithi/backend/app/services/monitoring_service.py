"""
Comprehensive Monitoring Service
Integrates metrics, health checks, and alerting for complete observability

Features:
- Metrics collection and analysis
- Health check monitoring
- Alerting integration
- Performance monitoring
- Business metrics tracking
- External service monitoring
"""

import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from flask import current_app
from ..middleware.metrics_middleware import get_metrics_middleware
from ..services.alerting_service import get_alerting_service, AlertType, AlertSeverity, Alert
from ..extensions import db

logger = logging.getLogger(__name__)


class MonitoringService:
    """Comprehensive monitoring service for observability."""
    
    def __init__(self, app=None):
        self.app = app
        self.metrics_middleware = get_metrics_middleware()
        self.alerting_service = get_alerting_service()
        self.monitoring_config = {}
        self.alert_thresholds = {}
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize monitoring service with Flask app."""
        self.monitoring_config = {
            'error_rate_threshold': app.config.get('MONITORING_ERROR_RATE_THRESHOLD', 5.0),
            'response_time_threshold': app.config.get('MONITORING_RESPONSE_TIME_THRESHOLD', 2.0),
            'cpu_threshold': app.config.get('MONITORING_CPU_THRESHOLD', 80.0),
            'memory_threshold': app.config.get('MONITORING_MEMORY_THRESHOLD', 85.0),
            'disk_threshold': app.config.get('MONITORING_DISK_THRESHOLD', 90.0),
            'no_show_rate_threshold': app.config.get('MONITORING_NO_SHOW_RATE_THRESHOLD', 20.0),
            'check_interval': app.config.get('MONITORING_CHECK_INTERVAL', 60),  # seconds
            'alert_cooldown': app.config.get('MONITORING_ALERT_COOLDOWN', 300)  # seconds
        }
        
        # Initialize alert thresholds
        self._initialize_alert_thresholds()
    
    def _initialize_alert_thresholds(self):
        """Initialize alert thresholds."""
        self.alert_thresholds = {
            'error_rate': {
                'warning': self.monitoring_config['error_rate_threshold'] * 0.7,
                'critical': self.monitoring_config['error_rate_threshold']
            },
            'response_time': {
                'warning': self.monitoring_config['response_time_threshold'] * 0.8,
                'critical': self.monitoring_config['response_time_threshold']
            },
            'cpu_usage': {
                'warning': self.monitoring_config['cpu_threshold'] * 0.8,
                'critical': self.monitoring_config['cpu_threshold']
            },
            'memory_usage': {
                'warning': self.monitoring_config['memory_threshold'] * 0.8,
                'critical': self.monitoring_config['memory_threshold']
            },
            'disk_usage': {
                'warning': self.monitoring_config['disk_threshold'] * 0.8,
                'critical': self.monitoring_config['disk_threshold']
            },
            'no_show_rate': {
                'warning': self.monitoring_config['no_show_rate_threshold'] * 0.8,
                'critical': self.monitoring_config['no_show_rate_threshold']
            }
        }
    
    def check_system_health(self) -> Dict[str, Any]:
        """Check overall system health and send alerts if needed."""
        try:
            health_status = {
                'timestamp': datetime.utcnow().isoformat(),
                'overall_status': 'healthy',
                'checks': {},
                'alerts_sent': []
            }
            
            # Check error rates
            error_check = self._check_error_rates()
            health_status['checks']['error_rates'] = error_check
            if error_check['status'] != 'healthy':
                health_status['alerts_sent'].append(self._send_error_rate_alert(error_check))
            
            # Check response times
            response_check = self._check_response_times()
            health_status['checks']['response_times'] = response_check
            if response_check['status'] != 'healthy':
                health_status['alerts_sent'].append(self._send_response_time_alert(response_check))
            
            # Check system resources
            resource_check = self._check_system_resources()
            health_status['checks']['system_resources'] = resource_check
            if resource_check['status'] != 'healthy':
                health_status['alerts_sent'].append(self._send_resource_alert(resource_check))
            
            # Check business metrics
            business_check = self._check_business_metrics()
            health_status['checks']['business_metrics'] = business_check
            if business_check['status'] != 'healthy':
                health_status['alerts_sent'].append(self._send_business_alert(business_check))
            
            # Check external services
            external_check = self._check_external_services()
            health_status['checks']['external_services'] = external_check
            if external_check['status'] != 'healthy':
                health_status['alerts_sent'].append(self._send_external_service_alert(external_check))
            
            # Determine overall status
            unhealthy_checks = [check for check in health_status['checks'].values() if check['status'] != 'healthy']
            if any(check['severity'] == 'critical' for check in unhealthy_checks):
                health_status['overall_status'] = 'critical'
            elif unhealthy_checks:
                health_status['overall_status'] = 'warning'
            
            return health_status
            
        except Exception as e:
            logger.error(f"System health check failed: {e}")
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'overall_status': 'error',
                'error': str(e)
            }
    
    def _check_error_rates(self) -> Dict[str, Any]:
        """Check application error rates."""
        try:
            # This would typically query metrics from Prometheus or a metrics store
            # For now, simulate error rate calculation
            error_rate = 2.5  # Would be calculated from actual metrics
            
            status = 'healthy'
            severity = 'low'
            
            if error_rate >= self.alert_thresholds['error_rate']['critical']:
                status = 'unhealthy'
                severity = 'critical'
            elif error_rate >= self.alert_thresholds['error_rate']['warning']:
                status = 'degraded'
                severity = 'warning'
            
            return {
                'status': status,
                'severity': severity,
                'error_rate': error_rate,
                'threshold': self.alert_thresholds['error_rate']['critical'],
                'message': f'Error rate: {error_rate:.2f}%'
            }
            
        except Exception as e:
            logger.error(f"Error rate check failed: {e}")
            return {
                'status': 'error',
                'severity': 'critical',
                'error': str(e)
            }
    
    def _check_response_times(self) -> Dict[str, Any]:
        """Check application response times."""
        try:
            # This would typically query metrics from Prometheus or a metrics store
            # For now, simulate response time calculation
            response_time_p95 = 1.2  # Would be calculated from actual metrics
            
            status = 'healthy'
            severity = 'low'
            
            if response_time_p95 >= self.alert_thresholds['response_time']['critical']:
                status = 'unhealthy'
                severity = 'critical'
            elif response_time_p95 >= self.alert_thresholds['response_time']['warning']:
                status = 'degraded'
                severity = 'warning'
            
            return {
                'status': status,
                'severity': severity,
                'response_time_p95': response_time_p95,
                'threshold': self.alert_thresholds['response_time']['critical'],
                'message': f'Response time P95: {response_time_p95:.2f}s'
            }
            
        except Exception as e:
            logger.error(f"Response time check failed: {e}")
            return {
                'status': 'error',
                'severity': 'critical',
                'error': str(e)
            }
    
    def _check_system_resources(self) -> Dict[str, Any]:
        """Check system resource usage."""
        try:
            import psutil
            
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory_percent = psutil.virtual_memory().percent
            disk_percent = psutil.disk_usage('/').percent
            
            # Determine overall status based on worst resource
            status = 'healthy'
            severity = 'low'
            
            if (cpu_percent >= self.alert_thresholds['cpu_usage']['critical'] or
                memory_percent >= self.alert_thresholds['memory_usage']['critical'] or
                disk_percent >= self.alert_thresholds['disk_usage']['critical']):
                status = 'unhealthy'
                severity = 'critical'
            elif (cpu_percent >= self.alert_thresholds['cpu_usage']['warning'] or
                  memory_percent >= self.alert_thresholds['memory_usage']['warning'] or
                  disk_percent >= self.alert_thresholds['disk_usage']['warning']):
                status = 'degraded'
                severity = 'warning'
            
            return {
                'status': status,
                'severity': severity,
                'cpu_percent': cpu_percent,
                'memory_percent': memory_percent,
                'disk_percent': disk_percent,
                'message': f'CPU: {cpu_percent:.1f}%, Memory: {memory_percent:.1f}%, Disk: {disk_percent:.1f}%'
            }
            
        except Exception as e:
            logger.error(f"System resource check failed: {e}")
            return {
                'status': 'error',
                'severity': 'critical',
                'error': str(e)
            }
    
    def _check_business_metrics(self) -> Dict[str, Any]:
        """Check business-specific metrics."""
        try:
            # Check no-show rates
            no_show_rate = self._calculate_no_show_rate()
            
            status = 'healthy'
            severity = 'low'
            
            if no_show_rate >= self.alert_thresholds['no_show_rate']['critical']:
                status = 'unhealthy'
                severity = 'critical'
            elif no_show_rate >= self.alert_thresholds['no_show_rate']['warning']:
                status = 'degraded'
                severity = 'warning'
            
            return {
                'status': status,
                'severity': severity,
                'no_show_rate': no_show_rate,
                'threshold': self.alert_thresholds['no_show_rate']['critical'],
                'message': f'No-show rate: {no_show_rate:.2f}%'
            }
            
        except Exception as e:
            logger.error(f"Business metrics check failed: {e}")
            return {
                'status': 'error',
                'severity': 'critical',
                'error': str(e)
            }
    
    def _check_external_services(self) -> Dict[str, Any]:
        """Check external service health."""
        try:
            # This would check actual external service health
            # For now, simulate service status
            services_status = {
                'stripe': 'healthy',
                'twilio': 'healthy',
                'sendgrid': 'degraded'
            }
            
            unhealthy_services = [service for service, status in services_status.items() if status != 'healthy']
            
            if any(status == 'unhealthy' for status in services_status.values()):
                overall_status = 'unhealthy'
                severity = 'critical'
            elif unhealthy_services:
                overall_status = 'degraded'
                severity = 'warning'
            else:
                overall_status = 'healthy'
                severity = 'low'
            
            return {
                'status': overall_status,
                'severity': severity,
                'services': services_status,
                'message': f'External services: {len(unhealthy_services)} issues'
            }
            
        except Exception as e:
            logger.error(f"External services check failed: {e}")
            return {
                'status': 'error',
                'severity': 'critical',
                'error': str(e)
            }
    
    def _calculate_no_show_rate(self) -> float:
        """Calculate current no-show rate."""
        try:
            # Calculate no-show rate for the last 24 hours
            yesterday = datetime.utcnow() - timedelta(days=1)
            
            total_bookings = db.session.execute(
                'SELECT COUNT(*) FROM bookings WHERE created_at >= :yesterday',
                {'yesterday': yesterday}
            ).scalar()
            
            no_show_bookings = db.session.execute(
                'SELECT COUNT(*) FROM bookings WHERE created_at >= :yesterday AND status = :status',
                {'yesterday': yesterday, 'status': 'no_show'}
            ).scalar()
            
            if total_bookings == 0:
                return 0.0
            
            return (no_show_bookings / total_bookings) * 100
            
        except Exception as e:
            logger.error(f"No-show rate calculation failed: {e}")
            return 0.0
    
    def _send_error_rate_alert(self, check_result: Dict[str, Any]) -> str:
        """Send error rate alert."""
        alert = Alert(
            alert_type=AlertType.ERROR_RATE,
            severity=AlertSeverity.HIGH if check_result['severity'] == 'critical' else AlertSeverity.MEDIUM,
            message=f"High error rate detected: {check_result['error_rate']:.2f}%",
            details=check_result
        )
        self.alerting_service.send_alert(alert)
        return f"Error rate alert sent: {check_result['error_rate']:.2f}%"
    
    def _send_response_time_alert(self, check_result: Dict[str, Any]) -> str:
        """Send response time alert."""
        alert = Alert(
            alert_type=AlertType.RESPONSE_TIME,
            severity=AlertSeverity.HIGH if check_result['severity'] == 'critical' else AlertSeverity.MEDIUM,
            message=f"Slow response time detected: {check_result['response_time_p95']:.2f}s",
            details=check_result
        )
        self.alerting_service.send_alert(alert)
        return f"Response time alert sent: {check_result['response_time_p95']:.2f}s"
    
    def _send_resource_alert(self, check_result: Dict[str, Any]) -> str:
        """Send resource usage alert."""
        alert = Alert(
            alert_type=AlertType.DATABASE_CONNECTION,  # Using generic alert type
            severity=AlertSeverity.HIGH if check_result['severity'] == 'critical' else AlertSeverity.MEDIUM,
            message=f"High resource usage: {check_result['message']}",
            details=check_result
        )
        self.alerting_service.send_alert(alert)
        return f"Resource alert sent: {check_result['message']}"
    
    def _send_business_alert(self, check_result: Dict[str, Any]) -> str:
        """Send business metrics alert."""
        alert = Alert(
            alert_type=AlertType.NO_SHOW_RATE,
            severity=AlertSeverity.HIGH if check_result['severity'] == 'critical' else AlertSeverity.MEDIUM,
            message=f"High no-show rate detected: {check_result['no_show_rate']:.2f}%",
            details=check_result
        )
        self.alerting_service.send_alert(alert)
        return f"No-show rate alert sent: {check_result['no_show_rate']:.2f}%"
    
    def _send_external_service_alert(self, check_result: Dict[str, Any]) -> str:
        """Send external service alert."""
        unhealthy_services = [service for service, status in check_result['services'].items() if status != 'healthy']
        
        alert = Alert(
            alert_type=AlertType.PROVIDER_OUTAGE,
            severity=AlertSeverity.HIGH if check_result['severity'] == 'critical' else AlertSeverity.MEDIUM,
            message=f"External service issues: {', '.join(unhealthy_services)}",
            details=check_result
        )
        self.alerting_service.send_alert(alert)
        return f"External service alert sent: {', '.join(unhealthy_services)}"
    
    def get_monitoring_dashboard_data(self) -> Dict[str, Any]:
        """Get data for monitoring dashboard."""
        try:
            # Get current metrics
            current_metrics = self._get_current_metrics()
            
            # Get health status
            health_status = self.check_system_health()
            
            # Get alert history
            alert_history = self.alerting_service.get_alert_history(limit=50)
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'metrics': current_metrics,
                'health': health_status,
                'alerts': [alert.to_dict() for alert in alert_history],
                'config': self.monitoring_config
            }
            
        except Exception as e:
            logger.error(f"Failed to get monitoring dashboard data: {e}")
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }
    
    def _get_current_metrics(self) -> Dict[str, Any]:
        """Get current system metrics."""
        try:
            import psutil
            
            return {
                'system': {
                    'cpu_percent': psutil.cpu_percent(),
                    'memory_percent': psutil.virtual_memory().percent,
                    'disk_percent': psutil.disk_usage('/').percent,
                    'load_average': psutil.getloadavg()
                },
                'application': {
                    'uptime_seconds': time.time() - getattr(current_app, 'start_time', time.time()),
                    'environment': current_app.config.get('ENV', 'development'),
                    'debug_mode': current_app.debug
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get current metrics: {e}")
            return {}


# Global monitoring service instance
monitoring_service = MonitoringService()


def get_monitoring_service():
    """Get the global monitoring service instance."""
    return monitoring_service
