"""
Enhanced Notification Service

This module provides comprehensive notification functionality including
template management, multi-channel delivery, retry logic, and analytics.
"""

import uuid
import json
import smtplib
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models.notification import NotificationTemplate
from ..models.system import AuditLog, EventOutbox
from ..models.business import Booking, Customer, Service, StaffProfile
from ..models.core import Tenant
from .quota_service import QuotaService


class NotificationChannel(Enum):
    """Notification delivery channels."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"


class NotificationStatus(Enum):
    """Notification delivery status."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"
    UNSUBSCRIBED = "unsubscribed"


class NotificationPriority(Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


@dataclass
class NotificationRequest:
    """Represents a notification request."""
    tenant_id: uuid.UUID
    event_code: str
    channel: NotificationChannel
    recipient: str
    subject: Optional[str] = None
    content: Optional[str] = None
    template_id: Optional[uuid.UUID] = None
    variables: Optional[Dict[str, Any]] = None
    priority: NotificationPriority = NotificationPriority.NORMAL
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class NotificationResult:
    """Result of notification delivery."""
    success: bool
    notification_id: Optional[uuid.UUID] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    retry_after: Optional[datetime] = None


class NotificationTemplateService:
    """Service for managing notification templates."""
    
    def create_template(self, tenant_id: uuid.UUID, template_data: Dict[str, Any]) -> NotificationTemplate:
        """Create a new notification template."""
        try:
            template = NotificationTemplate(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                event_code=template_data['event_code'],
                channel=template_data['channel'],
                name=template_data['name'],
                subject=template_data.get('subject', ''),
                body=template_data['body'],
                is_active=template_data.get('is_active', True),
                metadata_json=template_data.get('metadata', {})
            )
            
            db.session.add(template)
            db.session.commit()
            
            return template
            
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create notification template: {str(e)}")
    
    def get_template(self, tenant_id: uuid.UUID, event_code: str, 
                    channel: NotificationChannel) -> Optional[NotificationTemplate]:
        """Get notification template for event and channel."""
        try:
            return NotificationTemplate.query.filter_by(
                tenant_id=tenant_id,
                event_code=event_code,
                channel=channel.value,
                is_active=True
            ).first()
            
        except Exception as e:
            raise Exception(f"Failed to get notification template: {str(e)}")
    
    def update_template(self, template_id: uuid.UUID, tenant_id: uuid.UUID, 
                      update_data: Dict[str, Any]) -> NotificationTemplate:
        """Update notification template."""
        try:
            template = NotificationTemplate.query.filter_by(
                id=template_id,
                tenant_id=tenant_id
            ).first()
            
            if not template:
                raise Exception("Template not found")
            
            # Update fields
            for field, value in update_data.items():
                if hasattr(template, field):
                    setattr(template, field, value)
            
            template.updated_at = datetime.utcnow()
            db.session.commit()
            
            return template
            
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update notification template: {str(e)}")
    
    def delete_template(self, template_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
        """Delete notification template."""
        try:
            template = NotificationTemplate.query.filter_by(
                id=template_id,
                tenant_id=tenant_id
            ).first()
            
            if not template:
                return False
            
            db.session.delete(template)
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to delete notification template: {str(e)}")


class NotificationDeliveryService:
    """Service for delivering notifications through various channels."""
    
    def __init__(self):
        self.email_config = self._get_email_config()
        self.sms_config = self._get_sms_config()
        self.push_config = self._get_push_config()
    
    def send_notification(self, request: NotificationRequest) -> NotificationResult:
        """Send notification through specified channel."""
        try:
            # Get template if not provided
            if not request.content and not request.template_id:
                template = NotificationTemplateService().get_template(
                    request.tenant_id, request.event_code, request.channel
                )
                if not template:
                    return NotificationResult(
                        success=False,
                        error_message="No template found for event and channel"
                    )
                request.template_id = template.id
                request.subject = template.subject
                request.content = template.body
            
            # Process template variables
            content = self._process_template(request.content, request.variables or {})
            subject = self._process_template(request.subject or "", request.variables or {})
            
            # Send based on channel
            if request.channel == NotificationChannel.EMAIL:
                return self._send_email(request, subject, content)
            elif request.channel == NotificationChannel.SMS:
                return self._send_sms(request, content)
            elif request.channel == NotificationChannel.PUSH:
                return self._send_push(request, subject, content)
            elif request.channel == NotificationChannel.WEBHOOK:
                return self._send_webhook(request, subject, content)
            else:
                return NotificationResult(
                    success=False,
                    error_message=f"Unsupported channel: {request.channel}"
                )
                
        except Exception as e:
            return NotificationResult(
                success=False,
                error_message=f"Failed to send notification: {str(e)}"
            )
    
    def _send_email(self, request: NotificationRequest, subject: str, content: str) -> NotificationResult:
        """Send email notification."""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_config['from_email']
            msg['To'] = request.recipient
            msg['Subject'] = subject
            
            # Add body
            msg.attach(MIMEText(content, 'html'))
            
            # Send email
            with smtplib.SMTP(self.email_config['smtp_host'], self.email_config['smtp_port']) as server:
                server.starttls()
                server.login(self.email_config['username'], self.email_config['password'])
                server.send_message(msg)
            
            return NotificationResult(
                success=True,
                provider_message_id=f"email_{uuid.uuid4()}"
            )
            
        except Exception as e:
            return NotificationResult(
                success=False,
                error_message=f"Email delivery failed: {str(e)}"
            )
    
    def _send_sms(self, request: NotificationRequest, content: str) -> NotificationResult:
        """Send SMS notification."""
        try:
            # Use Twilio or similar SMS service
            # This is a simplified implementation
            response = requests.post(
                self.sms_config['api_url'],
                json={
                    'to': request.recipient,
                    'message': content,
                    'from': self.sms_config['from_number']
                },
                headers={'Authorization': f"Bearer {self.sms_config['api_key']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return NotificationResult(
                    success=True,
                    provider_message_id=data.get('sid')
                )
            else:
                return NotificationResult(
                    success=False,
                    error_message=f"SMS delivery failed: {response.text}"
                )
                
        except Exception as e:
            return NotificationResult(
                success=False,
                error_message=f"SMS delivery failed: {str(e)}"
            )
    
    def _send_push(self, request: NotificationRequest, subject: str, content: str) -> NotificationResult:
        """Send push notification."""
        try:
            # Use Firebase Cloud Messaging or similar
            response = requests.post(
                self.push_config['api_url'],
                json={
                    'to': request.recipient,
                    'notification': {
                        'title': subject,
                        'body': content
                    },
                    'data': request.metadata or {}
                },
                headers={'Authorization': f"key={self.push_config['api_key']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                return NotificationResult(
                    success=True,
                    provider_message_id=data.get('message_id')
                )
            else:
                return NotificationResult(
                    success=False,
                    error_message=f"Push delivery failed: {response.text}"
                )
                
        except Exception as e:
            return NotificationResult(
                success=False,
                error_message=f"Push delivery failed: {str(e)}"
            )
    
    def _send_webhook(self, request: NotificationRequest, subject: str, content: str) -> NotificationResult:
        """Send webhook notification."""
        try:
            webhook_url = request.metadata.get('webhook_url') if request.metadata else None
            if not webhook_url:
                return NotificationResult(
                    success=False,
                    error_message="Webhook URL not provided"
                )
            
            payload = {
                'event_code': request.event_code,
                'subject': subject,
                'content': content,
                'recipient': request.recipient,
                'tenant_id': str(request.tenant_id),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            response = requests.post(
                webhook_url,
                json=payload,
                timeout=30
            )
            
            if response.status_code in [200, 201, 202]:
                return NotificationResult(
                    success=True,
                    provider_message_id=f"webhook_{uuid.uuid4()}"
                )
            else:
                return NotificationResult(
                    success=False,
                    error_message=f"Webhook delivery failed: {response.text}"
                )
                
        except Exception as e:
            return NotificationResult(
                success=False,
                error_message=f"Webhook delivery failed: {str(e)}"
            )
    
    def _process_template(self, template: str, variables: Dict[str, Any]) -> str:
        """Process template with variables."""
        try:
            # Simple template processing - in production, use a proper templating engine
            processed = template
            for key, value in variables.items():
                placeholder = f"{{{{{key}}}}}"
                processed = processed.replace(placeholder, str(value))
            return processed
        except Exception:
            return template
    
    def _get_email_config(self) -> Dict[str, str]:
        """Get email configuration."""
        return {
            'smtp_host': 'smtp.gmail.com',
            'smtp_port': 587,
            'username': 'your-email@gmail.com',
            'password': 'your-app-password',
            'from_email': 'noreply@tithi.com'
        }
    
    def _get_sms_config(self) -> Dict[str, str]:
        """Get SMS configuration."""
        return {
            'api_url': 'https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json',
            'api_key': 'your-twilio-api-key',
            'from_number': '+1234567890'
        }
    
    def _get_push_config(self) -> Dict[str, str]:
        """Get push notification configuration."""
        return {
            'api_url': 'https://fcm.googleapis.com/fcm/send',
            'api_key': 'your-fcm-server-key'
        }


class NotificationScheduler:
    """Service for scheduling and managing notification delivery."""
    
    def schedule_notification(self, request: NotificationRequest) -> uuid.UUID:
        """Schedule a notification for delivery."""
        try:
            # Create notification record
            notification = {
                'id': uuid.uuid4(),
                'tenant_id': request.tenant_id,
                'event_code': request.event_code,
                'channel': request.channel.value,
                'recipient': request.recipient,
                'subject': request.subject,
                'content': request.content,
                'template_id': request.template_id,
                'priority': request.priority.value,
                'scheduled_at': request.scheduled_at or datetime.utcnow(),
                'expires_at': request.expires_at,
                'status': NotificationStatus.PENDING.value,
                'metadata': request.metadata or {}
            }
            
            # Store in database (simplified - in production, use proper notification table)
            # For now, we'll use the event outbox
            event = EventOutbox(
                id=uuid.uuid4(),
                tenant_id=request.tenant_id,
                event_code='NOTIFICATION_SCHEDULED',
                payload=notification,
                status='ready'
            )
            
            db.session.add(event)
            db.session.commit()
            
            return notification['id']
            
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to schedule notification: {str(e)}")
    
    def process_scheduled_notifications(self) -> List[NotificationResult]:
        """Process all scheduled notifications."""
        results = []
        
        try:
            # Get pending notifications
            pending_events = EventOutbox.query.filter_by(
                event_code='NOTIFICATION_SCHEDULED',
                status='ready'
            ).filter(
                EventOutbox.ready_at <= datetime.utcnow()
            ).all()
            
            delivery_service = NotificationDeliveryService()
            
            for event in pending_events:
                try:
                    # Convert event payload to notification request
                    payload = event.payload
                    request = NotificationRequest(
                        tenant_id=payload['tenant_id'],
                        event_code=payload['event_code'],
                        channel=NotificationChannel(payload['channel']),
                        recipient=payload['recipient'],
                        subject=payload.get('subject'),
                        content=payload.get('content'),
                        template_id=payload.get('template_id'),
                        priority=NotificationPriority(payload.get('priority', 'normal')),
                        scheduled_at=payload.get('scheduled_at'),
                        expires_at=payload.get('expires_at'),
                        metadata=payload.get('metadata')
                    )
                    
                    # Send notification
                    result = delivery_service.send_notification(request)
                    result.notification_id = payload['id']
                    
                    # Update event status
                    if result.success:
                        event.status = 'delivered'
                        event.delivered_at = datetime.utcnow()
                    else:
                        event.status = 'failed'
                        event.failed_at = datetime.utcnow()
                        event.error_message = result.error_message
                    
                    results.append(result)
                    
                except Exception as e:
                    # Mark as failed
                    event.status = 'failed'
                    event.failed_at = datetime.utcnow()
                    event.error_message = str(e)
                    
                    results.append(NotificationResult(
                        success=False,
                        error_message=str(e)
                    ))
            
            db.session.commit()
            
        except Exception as e:
            db.session.rollback()
            print(f"Failed to process scheduled notifications: {str(e)}")
        
        return results


class NotificationAnalytics:
    """Service for notification analytics and reporting."""
    
    def get_delivery_stats(self, tenant_id: uuid.UUID, 
                          start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get notification delivery statistics."""
        try:
            # This is a simplified implementation
            # In production, query actual notification records
            
            stats = {
                'total_sent': 0,
                'total_delivered': 0,
                'total_failed': 0,
                'delivery_rate': 0.0,
                'by_channel': {
                    'email': {'sent': 0, 'delivered': 0, 'failed': 0},
                    'sms': {'sent': 0, 'delivered': 0, 'failed': 0},
                    'push': {'sent': 0, 'delivered': 0, 'failed': 0}
                },
                'by_event': {},
                'by_hour': {},
                'bounce_rate': 0.0,
                'unsubscribe_rate': 0.0
            }
            
            return stats
            
        except Exception as e:
            raise Exception(f"Failed to get delivery stats: {str(e)}")
    
    def get_template_performance(self, tenant_id: uuid.UUID, 
                               template_id: uuid.UUID) -> Dict[str, Any]:
        """Get template performance metrics."""
        try:
            # Simplified implementation
            performance = {
                'template_id': str(template_id),
                'total_sent': 0,
                'delivery_rate': 0.0,
                'open_rate': 0.0,
                'click_rate': 0.0,
                'unsubscribe_rate': 0.0,
                'bounce_rate': 0.0,
                'avg_delivery_time': 0.0
            }
            
            return performance
            
        except Exception as e:
            raise Exception(f"Failed to get template performance: {str(e)}")


class NotificationService:
    """Main notification service orchestrating all notification functionality."""
    
    def __init__(self):
        self.template_service = NotificationTemplateService()
        self.delivery_service = NotificationDeliveryService()
        self.scheduler = NotificationScheduler()
        self.analytics = NotificationAnalytics()
        self.quota_service = QuotaService()
    
    def send_immediate_notification(self, request: NotificationRequest) -> NotificationResult:
        """Send notification immediately."""
        # Quota enforcement
        try:
            self.quota_service.check_and_increment(request.tenant_id, 'notifications_daily', 1)
        except Exception as e:
            # Surface as error result; in HTTP, callers translate to Problem+JSON 403
            return NotificationResult(success=False, error_message=getattr(e, 'message', str(e)))
        return self.delivery_service.send_notification(request)
    
    def schedule_notification(self, request: NotificationRequest) -> uuid.UUID:
        """Schedule notification for later delivery."""
        # Quota enforcement
        self.quota_service.check_and_increment(request.tenant_id, 'notifications_daily', 1)
        return self.scheduler.schedule_notification(request)
    
    def send_booking_notification(self, booking: Booking, event_type: str) -> NotificationResult:
        """Send booking-related notification."""
        try:
            # Get customer and service info
            customer = Customer.query.get(booking.customer_id)
            service = Service.query.get(booking.service_snapshot.get('id'))
            
            # Prepare notification variables
            variables = {
                'customer_name': customer.display_name if customer else 'Customer',
                'service_name': service.name if service else 'Service',
                'booking_date': booking.start_at.strftime('%Y-%m-%d'),
                'booking_time': booking.start_at.strftime('%H:%M'),
                'booking_id': str(booking.id),
                'tenant_name': 'Your Business'  # Get from tenant
            }
            
            # Create notification request
            request = NotificationRequest(
                tenant_id=booking.tenant_id,
                event_code=event_type,
                channel=NotificationChannel.EMAIL,
                recipient=customer.email if customer else '',
                variables=variables,
                priority=NotificationPriority.HIGH if event_type == 'booking_confirmed' else NotificationPriority.NORMAL
            )
            
            return self.send_immediate_notification(request)
            
        except Exception as e:
            return NotificationResult(
                success=False,
                error_message=f"Failed to send booking notification: {str(e)}"
            )
    
    def process_all_scheduled(self) -> List[NotificationResult]:
        """Process all scheduled notifications."""
        return self.scheduler.process_scheduled_notifications()
    
    def get_analytics(self, tenant_id: uuid.UUID, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get notification analytics."""
        return self.analytics.get_delivery_stats(tenant_id, start_date, end_date)
