"""
Notification Service

This module provides comprehensive notification management including SMS, email, and push notifications.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and Design Brief Module J.
"""

import uuid
import re
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import and_, or_, func, desc
from sqlalchemy.orm import Session
from jinja2 import Template, TemplateError

from ..extensions import db
from ..models.notification import (
    Notification, NotificationTemplate, NotificationPreference, 
    NotificationLog, NotificationQueue, NotificationChannel, 
    NotificationStatus, NotificationPriority
)
from ..exceptions import TithiError


class NotificationTemplateService:
    """Service for managing notification templates."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
    
    def create_template(
        self,
        tenant_id: str,
        name: str,
        description: str,
        channel: str,
        subject: str,
        content: str,
        content_type: str = "text/plain",
        trigger_event: str = None,
        category: str = None,
        variables: Dict[str, Any] = None,
        required_variables: List[str] = None,
        is_system: bool = False,
        metadata: Dict[str, Any] = None
    ) -> NotificationTemplate:
        """Create a new notification template."""
        
        # Validate channel
        if channel not in [c.value for c in NotificationChannel]:
            raise TithiError("TITHI_NOTIFICATION_INVALID_CHANNEL", "Invalid notification channel")
        
        # Validate content type
        valid_content_types = ['text/plain', 'text/html', 'application/json']
        if content_type not in valid_content_types:
            raise TithiError("TITHI_NOTIFICATION_INVALID_CONTENT_TYPE", "Invalid content type")
        
        # Validate template content
        try:
            Template(content)
        except TemplateError as e:
            raise TithiError("TITHI_NOTIFICATION_INVALID_TEMPLATE", f"Invalid template syntax: {str(e)}")
        
        # Create template
        template = NotificationTemplate(
            tenant_id=tenant_id,
            name=name,
            description=description,
            channel=channel,
            subject=subject,
            content=content,
            content_type=content_type,
            trigger_event=trigger_event,
            category=category,
            variables=variables or {},
            required_variables=required_variables or [],
            is_system=is_system,
            metadata=metadata or {}
        )
        
        self.db.add(template)
        self.db.commit()
        
        # Emit log
        print(f"NOTIFICATION_TEMPLATE_CREATED: tenant_id={tenant_id}, template_id={template.id}, name={name}")
        
        return template
    
    def get_template_by_name(self, tenant_id: str, name: str) -> Optional[NotificationTemplate]:
        """Get a template by name."""
        return self.db.query(NotificationTemplate).filter(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.name == name,
                NotificationTemplate.is_active == True
            )
        ).first()
    
    def get_template_by_trigger(self, tenant_id: str, trigger_event: str, channel: str) -> Optional[NotificationTemplate]:
        """Get a template by trigger event and channel."""
        return self.db.query(NotificationTemplate).filter(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.trigger_event == trigger_event,
                NotificationTemplate.channel == channel,
                NotificationTemplate.is_active == True
            )
        ).first()
    
    def render_template(
        self,
        template: NotificationTemplate,
        variables: Dict[str, Any]
    ) -> Tuple[str, str]:
        """Render a template with variables."""
        
        # Check required variables
        missing_variables = set(template.required_variables) - set(variables.keys())
        if missing_variables:
            raise TithiError("TITHI_NOTIFICATION_MISSING_VARIABLES", 
                            f"Missing required variables: {', '.join(missing_variables)}")
        
        try:
            # Render subject
            subject_template = Template(template.subject or "")
            rendered_subject = subject_template.render(**variables)
            
            # Render content
            content_template = Template(template.content)
            rendered_content = content_template.render(**variables)
            
            return rendered_subject, rendered_content
            
        except TemplateError as e:
            raise TithiError("TITHI_NOTIFICATION_TEMPLATE_RENDER_ERROR", f"Template rendering failed: {str(e)}")
    
    def get_templates_by_category(self, tenant_id: str, category: str) -> List[NotificationTemplate]:
        """Get all templates in a category."""
        return self.db.query(NotificationTemplate).filter(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.category == category,
                NotificationTemplate.is_active == True
            )
        ).all()


class NotificationService:
    """Service for managing notifications."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
        self.template_service = NotificationTemplateService(db_session)
    
    def create_notification(
        self,
        tenant_id: str,
        channel: str,
        recipient_type: str,
        recipient_id: str = None,
        recipient_email: str = None,
        recipient_phone: str = None,
        recipient_name: str = None,
        subject: str = None,
        content: str = None,
        content_type: str = "text/plain",
        template_id: str = None,
        template_variables: Dict[str, Any] = None,
        priority: str = "normal",
        scheduled_at: datetime = None,
        expires_at: datetime = None,
        booking_id: str = None,
        payment_id: str = None,
        customer_id: str = None,
        metadata: Dict[str, Any] = None
    ) -> Notification:
        """Create a new notification."""
        
        # Validate channel
        if channel not in [c.value for c in NotificationChannel]:
            raise TithiError("TITHI_NOTIFICATION_INVALID_CHANNEL", "Invalid notification channel")
        
        # Validate recipient type
        valid_recipient_types = ['customer', 'staff', 'admin']
        if recipient_type not in valid_recipient_types:
            raise TithiError("TITHI_NOTIFICATION_INVALID_RECIPIENT_TYPE", "Invalid recipient type")
        
        # Validate priority
        if priority not in [p.value for p in NotificationPriority]:
            raise TithiError("TITHI_NOTIFICATION_INVALID_PRIORITY", "Invalid notification priority")
        
        # Handle template-based notification
        if template_id:
            template = self.db.query(NotificationTemplate).filter(
                and_(
                    NotificationTemplate.tenant_id == tenant_id,
                    NotificationTemplate.id == template_id,
                    NotificationTemplate.is_active == True
                )
            ).first()
            
            if not template:
                raise TithiError("TITHI_NOTIFICATION_TEMPLATE_NOT_FOUND", "Template not found")
            
            # Render template
            rendered_subject, rendered_content = self.template_service.render_template(
                template, template_variables or {}
            )
            
            subject = rendered_subject
            content = rendered_content
            content_type = template.content_type
        
        # Validate required fields
        if not content:
            raise TithiError("TITHI_NOTIFICATION_MISSING_CONTENT", "Notification content is required")
        
        # Validate recipient information based on channel
        if channel == "email" and not recipient_email:
            raise TithiError("TITHI_NOTIFICATION_MISSING_EMAIL", "Email address is required for email notifications")
        
        if channel == "sms" and not recipient_phone:
            raise TithiError("TITHI_NOTIFICATION_MISSING_PHONE", "Phone number is required for SMS notifications")
        
        # Create notification
        notification = Notification(
            tenant_id=tenant_id,
            template_id=template_id,
            channel=channel,
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            recipient_phone=recipient_phone,
            recipient_name=recipient_name,
            subject=subject,
            content=content,
            content_type=content_type,
            priority=priority,
            scheduled_at=scheduled_at,
            expires_at=expires_at,
            booking_id=booking_id,
            payment_id=payment_id,
            customer_id=customer_id,
            metadata=metadata or {}
        )
        
        self.db.add(notification)
        self.db.commit()
        
        # Add to queue if not scheduled
        if not scheduled_at or scheduled_at <= datetime.utcnow():
            self._add_to_queue(notification)
        
        # Emit log
        print(f"NOTIFICATION_CREATED: tenant_id={tenant_id}, notification_id={notification.id}, channel={channel}")
        
        return notification
    
    def _add_to_queue(self, notification: Notification):
        """Add notification to processing queue."""
        queue_item = NotificationQueue(
            tenant_id=notification.tenant_id,
            notification_id=notification.id,
            priority=notification.priority,
            scheduled_at=notification.scheduled_at or datetime.utcnow()
        )
        
        self.db.add(queue_item)
        self.db.commit()
    
    def send_notification(self, notification_id: str) -> bool:
        """Send a notification."""
        
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id
        ).first()
        
        if not notification:
            raise TithiError("TITHI_NOTIFICATION_NOT_FOUND", "Notification not found")
        
        if notification.status != NotificationStatus.PENDING:
            raise TithiError("TITHI_NOTIFICATION_ALREADY_SENT", "Notification already processed")
        
        try:
            # Check if notification has expired
            if notification.expires_at and notification.expires_at < datetime.utcnow():
                self._update_notification_status(notification, NotificationStatus.FAILED, "Notification expired")
                return False
            
            # Send based on channel
            success = False
            provider_message_id = None
            provider_response = {}
            
            if notification.channel == NotificationChannel.EMAIL:
                success, provider_message_id, provider_response = self._send_email(notification)
            elif notification.channel == NotificationChannel.SMS:
                success, provider_message_id, provider_response = self._send_sms(notification)
            elif notification.channel == NotificationChannel.PUSH:
                success, provider_message_id, provider_response = self._send_push(notification)
            elif notification.channel == NotificationChannel.WEBHOOK:
                success, provider_message_id, provider_response = self._send_webhook(notification)
            
            if success:
                self._update_notification_status(notification, NotificationStatus.SENT, provider_message_id=provider_message_id, provider_response=provider_response)
                self._log_notification_event(notification, "sent", {"provider_message_id": provider_message_id})
            else:
                self._update_notification_status(notification, NotificationStatus.FAILED, "Send failed")
                self._log_notification_event(notification, "failed", {"error": "Send failed"})
            
            return success
            
        except Exception as e:
            self._update_notification_status(notification, NotificationStatus.FAILED, str(e))
            self._log_notification_event(notification, "failed", {"error": str(e)})
            return False
    
    def _send_email(self, notification: Notification) -> Tuple[bool, str, Dict[str, Any]]:
        """Send email notification."""
        # TODO: Integrate with SendGrid or similar email service
        # For now, simulate email sending
        print(f"Sending email to {notification.recipient_email}: {notification.subject}")
        
        # Simulate success
        return True, f"email_{uuid.uuid4()}", {"status": "sent", "provider": "sendgrid"}
    
    def _send_sms(self, notification: Notification) -> Tuple[bool, str, Dict[str, Any]]:
        """Send SMS notification."""
        # TODO: Integrate with Twilio or similar SMS service
        # For now, simulate SMS sending
        print(f"Sending SMS to {notification.recipient_phone}: {notification.content}")
        
        # Simulate success
        return True, f"sms_{uuid.uuid4()}", {"status": "sent", "provider": "twilio"}
    
    def _send_push(self, notification: Notification) -> Tuple[bool, str, Dict[str, Any]]:
        """Send push notification."""
        # TODO: Integrate with Firebase or similar push service
        # For now, simulate push sending
        print(f"Sending push notification to {notification.recipient_id}: {notification.content}")
        
        # Simulate success
        return True, f"push_{uuid.uuid4()}", {"status": "sent", "provider": "firebase"}
    
    def _send_webhook(self, notification: Notification) -> Tuple[bool, str, Dict[str, Any]]:
        """Send webhook notification."""
        # TODO: Implement webhook sending
        # For now, simulate webhook sending
        print(f"Sending webhook to {notification.recipient_id}: {notification.content}")
        
        # Simulate success
        return True, f"webhook_{uuid.uuid4()}", {"status": "sent", "provider": "webhook"}
    
    def _update_notification_status(
        self, 
        notification: Notification, 
        status: NotificationStatus, 
        failure_reason: str = None,
        provider_message_id: str = None,
        provider_response: Dict[str, Any] = None
    ):
        """Update notification status."""
        notification.status = status
        
        if status == NotificationStatus.SENT:
            notification.sent_at = datetime.utcnow()
        elif status == NotificationStatus.DELIVERED:
            notification.delivered_at = datetime.utcnow()
        elif status == NotificationStatus.FAILED:
            notification.failed_at = datetime.utcnow()
            notification.failure_reason = failure_reason
        
        if provider_message_id:
            notification.provider_message_id = provider_message_id
        
        if provider_response:
            notification.provider_response = provider_response
        
        self.db.commit()
    
    def _log_notification_event(self, notification: Notification, event_type: str, event_data: Dict[str, Any]):
        """Log notification event."""
        log_entry = NotificationLog(
            tenant_id=notification.tenant_id,
            notification_id=notification.id,
            event_type=event_type,
            event_data=event_data
        )
        
        self.db.add(log_entry)
        self.db.commit()
    
    def get_notification_status(self, notification_id: str) -> Dict[str, Any]:
        """Get notification status and details."""
        notification = self.db.query(Notification).filter(
            Notification.id == notification_id
        ).first()
        
        if not notification:
            raise TithiError("TITHI_NOTIFICATION_NOT_FOUND", "Notification not found")
        
        return {
            "id": str(notification.id),
            "status": notification.status.value,
            "channel": notification.channel.value,
            "recipient_type": notification.recipient_type,
            "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
            "delivered_at": notification.delivered_at.isoformat() if notification.delivered_at else None,
            "failed_at": notification.failed_at.isoformat() if notification.failed_at else None,
            "failure_reason": notification.failure_reason,
            "provider_message_id": notification.provider_message_id
        }
    
    def get_notification_logs(self, notification_id: str) -> List[Dict[str, Any]]:
        """Get notification event logs."""
        logs = self.db.query(NotificationLog).filter(
            NotificationLog.notification_id == notification_id
        ).order_by(NotificationLog.event_timestamp.desc()).all()
        
        return [
            {
                "event_type": log.event_type,
                "event_timestamp": log.event_timestamp.isoformat(),
                "event_data": log.event_data,
                "error_message": log.error_message,
                "provider": log.provider,
                "provider_event_id": log.provider_event_id
            }
            for log in logs
        ]


class NotificationPreferenceService:
    """Service for managing notification preferences."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
    
    def get_preferences(self, tenant_id: str, user_type: str, user_id: str) -> NotificationPreference:
        """Get notification preferences for a user."""
        preferences = self.db.query(NotificationPreference).filter(
            and_(
                NotificationPreference.tenant_id == tenant_id,
                NotificationPreference.user_type == user_type,
                NotificationPreference.user_id == user_id
            )
        ).first()
        
        if not preferences:
            # Create default preferences
            preferences = self.create_default_preferences(tenant_id, user_type, user_id)
        
        return preferences
    
    def create_default_preferences(
        self, 
        tenant_id: str, 
        user_type: str, 
        user_id: str
    ) -> NotificationPreference:
        """Create default notification preferences."""
        preferences = NotificationPreference(
            tenant_id=tenant_id,
            user_type=user_type,
            user_id=user_id,
            email_enabled=True,
            sms_enabled=True,
            push_enabled=True,
            booking_notifications=True,
            payment_notifications=True,
            promotion_notifications=True,
            system_notifications=True,
            marketing_notifications=False,
            digest_frequency="immediate"
        )
        
        self.db.add(preferences)
        self.db.commit()
        
        return preferences
    
    def update_preferences(
        self,
        tenant_id: str,
        user_type: str,
        user_id: str,
        **preferences_data
    ) -> NotificationPreference:
        """Update notification preferences."""
        preferences = self.get_preferences(tenant_id, user_type, user_id)
        
        # Update allowed fields
        allowed_fields = [
            'email_enabled', 'sms_enabled', 'push_enabled',
            'booking_notifications', 'payment_notifications', 'promotion_notifications',
            'system_notifications', 'marketing_notifications',
            'digest_frequency', 'quiet_hours_start', 'quiet_hours_end'
        ]
        
        for field, value in preferences_data.items():
            if field in allowed_fields and hasattr(preferences, field):
                setattr(preferences, field, value)
        
        self.db.commit()
        
        return preferences
    
    def can_send_notification(
        self,
        tenant_id: str,
        user_type: str,
        user_id: str,
        channel: str,
        category: str
    ) -> bool:
        """Check if notification can be sent based on preferences."""
        preferences = self.get_preferences(tenant_id, user_type, user_id)
        
        # Check channel preference
        if channel == "email" and not preferences.email_enabled:
            return False
        if channel == "sms" and not preferences.sms_enabled:
            return False
        if channel == "push" and not preferences.push_enabled:
            return False
        
        # Check category preference
        if category == "booking" and not preferences.booking_notifications:
            return False
        if category == "payment" and not preferences.payment_notifications:
            return False
        if category == "promotion" and not preferences.promotion_notifications:
            return False
        if category == "system" and not preferences.system_notifications:
            return False
        if category == "marketing" and not preferences.marketing_notifications:
            return False
        
        return True


class NotificationQueueService:
    """Service for managing notification queue."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
        self.notification_service = NotificationService(db_session)
    
    def get_pending_notifications(self, limit: int = 100) -> List[NotificationQueue]:
        """Get pending notifications from queue."""
        return self.db.query(NotificationQueue).filter(
            and_(
                NotificationQueue.status == "queued",
                NotificationQueue.scheduled_at <= datetime.utcnow()
            )
        ).order_by(
            NotificationQueue.priority.desc(),
            NotificationQueue.scheduled_at.asc()
        ).limit(limit).all()
    
    def process_notification(self, queue_item: NotificationQueue) -> bool:
        """Process a notification from the queue."""
        try:
            # Mark as processing
            queue_item.status = "processing"
            queue_item.processing_started_at = datetime.utcnow()
            self.db.commit()
            
            # Send notification
            success = self.notification_service.send_notification(str(queue_item.notification_id))
            
            if success:
                queue_item.status = "completed"
                queue_item.processing_completed_at = datetime.utcnow()
            else:
                queue_item.status = "failed"
                queue_item.error_message = "Notification send failed"
            
            self.db.commit()
            return success
            
        except Exception as e:
            queue_item.status = "failed"
            queue_item.error_message = str(e)
            queue_item.retry_count += 1
            
            # Schedule retry if under max retries
            if queue_item.retry_count < queue_item.max_retries:
                queue_item.status = "queued"
                queue_item.scheduled_at = datetime.utcnow() + timedelta(minutes=5 * queue_item.retry_count)
            
            self.db.commit()
            return False
    
    def process_queue(self, limit: int = 100) -> Dict[str, int]:
        """Process pending notifications from queue."""
        queue_items = self.get_pending_notifications(limit)
        
        processed = 0
        successful = 0
        failed = 0
        
        for queue_item in queue_items:
            processed += 1
            if self.process_notification(queue_item):
                successful += 1
            else:
                failed += 1
        
        return {
            "processed": processed,
            "successful": successful,
            "failed": failed
        }
