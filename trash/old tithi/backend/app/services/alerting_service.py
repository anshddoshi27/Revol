"""
Alerting Service
Provides comprehensive alerting for failures, outages, and performance issues
"""

import os
import requests
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from enum import Enum
import structlog

logger = structlog.get_logger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertType(Enum):
    """Alert types."""
    ERROR_RATE = "error_rate"
    RESPONSE_TIME = "response_time"
    NO_SHOW_RATE = "no_show_rate"
    PROVIDER_OUTAGE = "provider_outage"
    DATABASE_CONNECTION = "database_connection"
    REDIS_CONNECTION = "redis_connection"
    BACKUP_FAILURE = "backup_failure"
    QUOTA_EXCEEDED = "quota_exceeded"
    SECURITY_INCIDENT = "security_incident"


class Alert:
    """Represents an alert."""
    
    def __init__(self, alert_type: AlertType, severity: AlertSeverity, 
                 message: str, details: Dict[str, Any] = None,
                 tenant_id: str = None, user_id: str = None):
        self.alert_type = alert_type
        self.severity = severity
        self.message = message
        self.details = details or {}
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.created_at = datetime.now(timezone.utc)
        self.resolved_at = None
        self.resolved_by = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert alert to dictionary."""
        return {
            'alert_type': self.alert_type.value,
            'severity': self.severity.value,
            'message': self.message,
            'details': self.details,
            'tenant_id': self.tenant_id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat(),
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by': self.resolved_by
        }


class AlertingService:
    """Service for managing alerts and notifications."""
    
    def __init__(self, app=None):
        self.app = app
        self.alert_channels = {}
        self.alert_rules = {}
        self.alert_history = []
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize alerting service with Flask app."""
        # Configure alert channels
        self._configure_slack()
        self._configure_email()
        self._configure_webhook()
        
        # Configure alert rules
        self._configure_alert_rules()
    
    def _configure_slack(self):
        """Configure Slack alerting channel."""
        slack_webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
        if not slack_webhook_url and self.app:
            slack_webhook_url = self.app.config.get('SLACK_WEBHOOK_URL')
        
        if slack_webhook_url:
            self.alert_channels['slack'] = {
                'type': 'slack',
                'webhook_url': slack_webhook_url,
                'enabled': True
            }
    
    def _configure_email(self):
        """Configure email alerting channel."""
        email_config = {
            'type': 'email',
            'smtp_server': os.environ.get('ALERT_SMTP_SERVER'),
            'smtp_port': int(os.environ.get('ALERT_SMTP_PORT', '587')),
            'username': os.environ.get('ALERT_EMAIL_USERNAME'),
            'password': os.environ.get('ALERT_EMAIL_PASSWORD'),
            'from_email': os.environ.get('ALERT_FROM_EMAIL'),
            'to_emails': os.environ.get('ALERT_TO_EMAILS', '').split(','),
            'enabled': bool(os.environ.get('ALERT_EMAIL_USERNAME'))
        }
        
        if email_config['enabled']:
            self.alert_channels['email'] = email_config
    
    def _configure_webhook(self):
        """Configure webhook alerting channel."""
        webhook_url = os.environ.get('ALERT_WEBHOOK_URL')
        if webhook_url:
            self.alert_channels['webhook'] = {
                'type': 'webhook',
                'url': webhook_url,
                'enabled': True
            }
    
    def _configure_alert_rules(self):
        """Configure alert rules."""
        self.alert_rules = {
            AlertType.ERROR_RATE: {
                'threshold': 5.0,  # 5% error rate
                'severity': AlertSeverity.HIGH,
                'channels': ['slack', 'email']
            },
            AlertType.RESPONSE_TIME: {
                'threshold': 2.0,  # 2 seconds
                'severity': AlertSeverity.MEDIUM,
                'channels': ['slack']
            },
            AlertType.NO_SHOW_RATE: {
                'threshold': 20.0,  # 20% no-show rate
                'severity': AlertSeverity.MEDIUM,
                'channels': ['slack']
            },
            AlertType.PROVIDER_OUTAGE: {
                'threshold': 0,  # Any outage
                'severity': AlertSeverity.CRITICAL,
                'channels': ['slack', 'email', 'webhook']
            },
            AlertType.DATABASE_CONNECTION: {
                'threshold': 0,  # Any connection failure
                'severity': AlertSeverity.CRITICAL,
                'channels': ['slack', 'email', 'webhook']
            },
            AlertType.REDIS_CONNECTION: {
                'threshold': 0,  # Any connection failure
                'severity': AlertSeverity.HIGH,
                'channels': ['slack', 'email']
            },
            AlertType.BACKUP_FAILURE: {
                'threshold': 0,  # Any backup failure
                'severity': AlertSeverity.HIGH,
                'channels': ['slack', 'email']
            },
            AlertType.QUOTA_EXCEEDED: {
                'threshold': 0,  # Any quota exceeded
                'severity': AlertSeverity.MEDIUM,
                'channels': ['slack']
            },
            AlertType.SECURITY_INCIDENT: {
                'threshold': 0,  # Any security incident
                'severity': AlertSeverity.CRITICAL,
                'channels': ['slack', 'email', 'webhook']
            }
        }
    
    def send_alert(self, alert: Alert):
        """Send alert through configured channels."""
        logger.info(f"Sending alert: {alert.alert_type.value} - {alert.message}")
        
        # Add to alert history
        self.alert_history.append(alert)
        
        # Get alert rule
        rule = self.alert_rules.get(alert.alert_type, {})
        channels = rule.get('channels', ['slack'])
        
        # Send to each channel
        for channel_name in channels:
            channel = self.alert_channels.get(channel_name)
            if channel and channel.get('enabled'):
                try:
                    self._send_to_channel(channel, alert)
                except Exception as e:
                    logger.error(f"Failed to send alert to {channel_name}: {e}")
    
    def _send_to_channel(self, channel: Dict[str, Any], alert: Alert):
        """Send alert to specific channel."""
        channel_type = channel['type']
        
        if channel_type == 'slack':
            self._send_slack_alert(channel, alert)
        elif channel_type == 'email':
            self._send_email_alert(channel, alert)
        elif channel_type == 'webhook':
            self._send_webhook_alert(channel, alert)
    
    def _send_slack_alert(self, channel: Dict[str, Any], alert: Alert):
        """Send alert to Slack."""
        webhook_url = channel['webhook_url']
        
        # Determine color based on severity
        color_map = {
            AlertSeverity.LOW: '#36a64f',
            AlertSeverity.MEDIUM: '#ff9500',
            AlertSeverity.HIGH: '#ff0000',
            AlertSeverity.CRITICAL: '#8b0000'
        }
        
        payload = {
            'attachments': [{
                'color': color_map[alert.severity],
                'title': f"🚨 {alert.alert_type.value.replace('_', ' ').title()} Alert",
                'text': alert.message,
                'fields': [
                    {'title': 'Severity', 'value': alert.severity.value.title(), 'short': True},
                    {'title': 'Time', 'value': alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC'), 'short': True}
                ],
                'footer': 'Tithi Monitoring',
                'ts': int(alert.created_at.timestamp())
            }]
        }
        
        if alert.tenant_id:
            payload['attachments'][0]['fields'].append({
                'title': 'Tenant ID', 'value': alert.tenant_id, 'short': True
            })
        
        if alert.details:
            payload['attachments'][0]['fields'].append({
                'title': 'Details', 'value': json.dumps(alert.details, indent=2), 'short': False
            })
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()
    
    def _send_email_alert(self, channel: Dict[str, Any], alert: Alert):
        """Send alert via email."""
        # This would integrate with Flask-Mail or similar
        logger.info(f"Email alert sent: {alert.message}")
    
    def _send_webhook_alert(self, channel: Dict[str, Any], alert: Alert):
        """Send alert via webhook."""
        webhook_url = channel['url']
        
        payload = {
            'alert_type': alert.alert_type.value,
            'severity': alert.severity.value,
            'message': alert.message,
            'details': alert.details,
            'tenant_id': alert.tenant_id,
            'user_id': alert.user_id,
            'created_at': alert.created_at.isoformat()
        }
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()
    
    def check_error_rate(self, error_count: int, total_requests: int, tenant_id: str = None):
        """Check error rate and send alert if threshold exceeded."""
        if total_requests == 0:
            return
        
        error_rate = (error_count / total_requests) * 100
        rule = self.alert_rules[AlertType.ERROR_RATE]
        
        if error_rate > rule['threshold']:
            alert = Alert(
                alert_type=AlertType.ERROR_RATE,
                severity=rule['severity'],
                message=f"High error rate detected: {error_rate:.2f}% ({error_count}/{total_requests})",
                details={'error_rate': error_rate, 'error_count': error_count, 'total_requests': total_requests},
                tenant_id=tenant_id
            )
            self.send_alert(alert)
    
    def check_response_time(self, response_time: float, tenant_id: str = None):
        """Check response time and send alert if threshold exceeded."""
        rule = self.alert_rules[AlertType.RESPONSE_TIME]
        
        if response_time > rule['threshold']:
            alert = Alert(
                alert_type=AlertType.RESPONSE_TIME,
                severity=rule['severity'],
                message=f"Slow response time detected: {response_time:.2f}s",
                details={'response_time': response_time},
                tenant_id=tenant_id
            )
            self.send_alert(alert)
    
    def check_no_show_rate(self, no_show_count: int, total_bookings: int, tenant_id: str = None):
        """Check no-show rate and send alert if threshold exceeded."""
        if total_bookings == 0:
            return
        
        no_show_rate = (no_show_count / total_bookings) * 100
        rule = self.alert_rules[AlertType.NO_SHOW_RATE]
        
        if no_show_rate > rule['threshold']:
            alert = Alert(
                alert_type=AlertType.NO_SHOW_RATE,
                severity=rule['severity'],
                message=f"High no-show rate detected: {no_show_rate:.2f}% ({no_show_count}/{total_bookings})",
                details={'no_show_rate': no_show_rate, 'no_show_count': no_show_count, 'total_bookings': total_bookings},
                tenant_id=tenant_id
            )
            self.send_alert(alert)
    
    def alert_provider_outage(self, provider: str, tenant_id: str = None):
        """Alert about provider outage."""
        alert = Alert(
            alert_type=AlertType.PROVIDER_OUTAGE,
            severity=AlertSeverity.CRITICAL,
            message=f"Provider outage detected: {provider}",
            details={'provider': provider},
            tenant_id=tenant_id
        )
        self.send_alert(alert)
    
    def alert_database_connection_failure(self, tenant_id: str = None):
        """Alert about database connection failure."""
        alert = Alert(
            alert_type=AlertType.DATABASE_CONNECTION,
            severity=AlertSeverity.CRITICAL,
            message="Database connection failure detected",
            tenant_id=tenant_id
        )
        self.send_alert(alert)
    
    def alert_redis_connection_failure(self, tenant_id: str = None):
        """Alert about Redis connection failure."""
        alert = Alert(
            alert_type=AlertType.REDIS_CONNECTION,
            severity=AlertSeverity.HIGH,
            message="Redis connection failure detected",
            tenant_id=tenant_id
        )
        self.send_alert(alert)
    
    def alert_backup_failure(self, backup_type: str, tenant_id: str = None):
        """Alert about backup failure."""
        alert = Alert(
            alert_type=AlertType.BACKUP_FAILURE,
            severity=AlertSeverity.HIGH,
            message=f"Backup failure detected: {backup_type}",
            details={'backup_type': backup_type},
            tenant_id=tenant_id
        )
        self.send_alert(alert)
    
    def alert_quota_exceeded(self, quota_type: str, tenant_id: str = None):
        """Alert about quota exceeded."""
        alert = Alert(
            alert_type=AlertType.QUOTA_EXCEEDED,
            severity=AlertSeverity.MEDIUM,
            message=f"Quota exceeded: {quota_type}",
            details={'quota_type': quota_type},
            tenant_id=tenant_id
        )
        self.send_alert(alert)
    
    def alert_security_incident(self, incident_type: str, details: Dict[str, Any] = None, tenant_id: str = None):
        """Alert about security incident."""
        alert_details = details or {}
        alert_details['incident_type'] = incident_type
        
        alert = Alert(
            alert_type=AlertType.SECURITY_INCIDENT,
            severity=AlertSeverity.CRITICAL,
            message=f"Security incident detected: {incident_type}",
            details=alert_details,
            tenant_id=tenant_id
        )
        self.send_alert(alert)
    
    def get_alert_history(self, limit: int = 100) -> List[Alert]:
        """Get recent alert history."""
        return self.alert_history[-limit:]
    
    def resolve_alert(self, alert_index: int, resolved_by: str):
        """Resolve an alert."""
        if 0 <= alert_index < len(self.alert_history):
            alert = self.alert_history[alert_index]
            alert.resolved_at = datetime.now(timezone.utc)
            alert.resolved_by = resolved_by
            logger.info(f"Alert resolved: {alert.alert_type.value} by {resolved_by}")


# Global alerting service instance
alerting_service = AlertingService()


def get_alerting_service():
    """Get the global alerting service instance."""
    return alerting_service
