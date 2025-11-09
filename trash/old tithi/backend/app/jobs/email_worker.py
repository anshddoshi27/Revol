"""
Email Worker

This module provides Celery tasks for processing email notifications asynchronously.
Implements Task 7.1: Email Notifications with async queue-based processing.

Aligned with Design Brief Module J - Notifications & Communication and Task 7.1 requirements.
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from celery import Celery
from celery.exceptions import Retry

from ..extensions import db, celery
from ..services.email_service import EmailService, EmailRequest, EmailPriority
from ..models.notification import Notification, NotificationLog
from ..models.audit import EventOutbox
from ..exceptions import TithiError

logger = logging.getLogger(__name__)


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_async(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Async task for sending emails.
    
    This task processes email notifications asynchronously with retry logic
    and proper error handling.
    
    Args:
        request_data: Email request data dictionary
        
    Returns:
        Dictionary with success status and details
    """
    try:
        logger.info(f"Processing email task: {self.request.id}")
        
        # Convert request data back to EmailRequest
        request = EmailRequest(
            tenant_id=uuid.UUID(request_data['tenant_id']),
            event_code=request_data['event_code'],
            recipient_email=request_data['recipient_email'],
            recipient_name=request_data.get('recipient_name'),
            subject=request_data.get('subject'),
            content=request_data.get('content'),
            template_id=uuid.UUID(request_data['template_id']) if request_data.get('template_id') else None,
            variables=request_data.get('variables', {}),
            priority=EmailPriority(request_data.get('priority', 'normal')),
            scheduled_at=datetime.fromisoformat(request_data['scheduled_at']) if request_data.get('scheduled_at') else None,
            expires_at=datetime.fromisoformat(request_data['expires_at']) if request_data.get('expires_at') else None,
            booking_id=uuid.UUID(request_data['booking_id']) if request_data.get('booking_id') else None,
            customer_id=uuid.UUID(request_data['customer_id']) if request_data.get('customer_id') else None,
            metadata=request_data.get('metadata', {})
        )
        
        # Send email
        email_service = EmailService()
        result = email_service.send_email(request)
        
        logger.info(f"Email task completed: {self.request.id}, success: {result.success}")
        
        return {
            "success": result.success,
            "notification_id": str(result.notification_id) if result.notification_id else None,
            "provider_message_id": result.provider_message_id,
            "error_message": result.error_message
        }
        
    except TithiError as e:
        logger.error(f"Email task failed with TithiError: {self.request.id}, error: {e.message}")
        # Don't retry TithiErrors (business logic errors)
        return {
            "success": False,
            "error_message": e.message,
            "error_code": e.error_code
        }
        
    except Exception as e:
        logger.error(f"Email task failed with exception: {self.request.id}, error: {str(e)}")
        
        # Retry with exponential backoff
        try:
            raise self.retry(countdown=60 * (2 ** self.request.retries))
        except Retry:
            # Max retries exceeded
            return {
                "success": False,
                "error_message": f"Email delivery failed after {self.max_retries} retries: {str(e)}"
            }


@celery.task(bind=True, max_retries=2)
def send_booking_email_async(self, booking_id: str, event_type: str) -> Dict[str, Any]:
    """
    Async task for sending booking-related emails.
    
    Args:
        booking_id: UUID string of the booking
        event_type: Type of booking event (confirmation, reminder, cancellation)
        
    Returns:
        Dictionary with success status and details
    """
    try:
        logger.info(f"Processing booking email task: {self.request.id}, booking: {booking_id}")
        
        # Get booking
        from ..models.business import Booking
        booking = Booking.query.get(uuid.UUID(booking_id))
        
        if not booking:
            return {
                "success": False,
                "error_message": "Booking not found"
            }
        
        # Send booking email
        email_service = EmailService()
        result = email_service.send_booking_email(booking, event_type)
        
        logger.info(f"Booking email task completed: {self.request.id}, success: {result.success}")
        
        return {
            "success": result.success,
            "notification_id": str(result.notification_id) if result.notification_id else None,
            "provider_message_id": result.provider_message_id,
            "error_message": result.error_message
        }
        
    except Exception as e:
        logger.error(f"Booking email task failed: {self.request.id}, error: {str(e)}")
        
        # Retry with exponential backoff
        try:
            raise self.retry(countdown=60 * (2 ** self.request.retries))
        except Retry:
            return {
                "success": False,
                "error_message": f"Booking email delivery failed after {self.max_retries} retries: {str(e)}"
            }


@celery.task
def process_email_outbox():
    """
    Process email events from outbox.
    
    This task processes pending email events from the events_outbox table
    and sends them via the email service.
    """
    try:
        logger.info("Processing email outbox events")
        
        # Get ready email events from outbox
        ready_events = EventOutbox.query.filter_by(
            event_code='EMAIL_NOTIFICATION',
            status='ready'
        ).filter(
            EventOutbox.ready_at <= datetime.utcnow()
        ).limit(100).all()
        
        processed_count = 0
        failed_count = 0
        
        for event in ready_events:
            try:
                logger.info(f"Processing email outbox event: {event.id}")
                
                # Process email event
                request_data = event.payload
                
                # Queue email task
                send_email_async.delay(request_data)
                
                # Mark as delivered
                event.status = 'delivered'
                event.delivered_at = datetime.utcnow()
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Failed to process email outbox event {event.id}: {str(e)}")
                event.status = 'failed'
                event.failed_at = datetime.utcnow()
                event.error_message = str(e)
                failed_count += 1
        
        db.session.commit()
        
        logger.info(f"Processed {processed_count} email outbox events, {failed_count} failed")
        
        return {
            "processed": processed_count,
            "failed": failed_count,
            "total": len(ready_events)
        }
        
    except Exception as e:
        logger.error(f"Failed to process email outbox: {str(e)}")
        db.session.rollback()
        return {
            "processed": 0,
            "failed": 0,
            "error": str(e)
        }


@celery.task
def process_scheduled_emails():
    """
    Process scheduled email notifications.
    
    This task processes emails that are scheduled for future delivery.
    """
    try:
        logger.info("Processing scheduled email notifications")
        
        # Get scheduled notifications that are ready to send
        scheduled_notifications = Notification.query.filter(
            Notification.channel == 'email',
            Notification.status == 'pending',
            Notification.scheduled_at <= datetime.utcnow(),
            Notification.expires_at.is_(None) | (Notification.expires_at > datetime.utcnow())
        ).limit(100).all()
        
        processed_count = 0
        failed_count = 0
        
        for notification in scheduled_notifications:
            try:
                logger.info(f"Processing scheduled notification: {notification.id}")
                
                # Create email request
                request_data = {
                    'tenant_id': str(notification.tenant_id),
                    'event_code': 'scheduled_email',
                    'recipient_email': notification.recipient_email,
                    'recipient_name': notification.recipient_name,
                    'subject': notification.subject,
                    'content': notification.content,
                    'template_id': str(notification.template_id) if notification.template_id else None,
                    'priority': notification.priority,
                    'booking_id': str(notification.booking_id) if notification.booking_id else None,
                    'customer_id': str(notification.customer_id) if notification.customer_id else None,
                    'metadata': notification.metadata_json or {}
                }
                
                # Queue email task
                send_email_async.delay(request_data)
                
                # Update notification status
                notification.status = 'sent'
                notification.sent_at = datetime.utcnow()
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Failed to process scheduled notification {notification.id}: {str(e)}")
                notification.status = 'failed'
                notification.failed_at = datetime.utcnow()
                notification.failure_reason = str(e)
                failed_count += 1
        
        db.session.commit()
        
        logger.info(f"Processed {processed_count} scheduled notifications, {failed_count} failed")
        
        return {
            "processed": processed_count,
            "failed": failed_count,
            "total": len(scheduled_notifications)
        }
        
    except Exception as e:
        logger.error(f"Failed to process scheduled emails: {str(e)}")
        db.session.rollback()
        return {
            "processed": 0,
            "failed": 0,
            "error": str(e)
        }


@celery.task
def retry_failed_emails():
    """
    Retry failed email notifications.
    
    This task retries emails that have failed but haven't exceeded max retries.
    """
    try:
        logger.info("Retrying failed email notifications")
        
        # Get failed notifications that can be retried
        failed_notifications = Notification.query.filter(
            Notification.channel == 'email',
            Notification.status == 'failed',
            Notification.retry_count < Notification.max_retries,
            Notification.failed_at <= datetime.utcnow() - timedelta(minutes=5)  # Wait 5 minutes before retry
        ).limit(50).all()
        
        retried_count = 0
        failed_count = 0
        
        for notification in failed_notifications:
            try:
                logger.info(f"Retrying failed notification: {notification.id}")
                
                # Create email request
                request_data = {
                    'tenant_id': str(notification.tenant_id),
                    'event_code': 'retry_email',
                    'recipient_email': notification.recipient_email,
                    'recipient_name': notification.recipient_name,
                    'subject': notification.subject,
                    'content': notification.content,
                    'template_id': str(notification.template_id) if notification.template_id else None,
                    'priority': notification.priority,
                    'booking_id': str(notification.booking_id) if notification.booking_id else None,
                    'customer_id': str(notification.customer_id) if notification.customer_id else None,
                    'metadata': notification.metadata_json or {}
                }
                
                # Queue email task
                send_email_async.delay(request_data)
                
                # Update retry count
                notification.retry_count += 1
                notification.status = 'pending'
                notification.failed_at = None
                notification.failure_reason = None
                
                retried_count += 1
                
            except Exception as e:
                logger.error(f"Failed to retry notification {notification.id}: {str(e)}")
                notification.failure_reason = str(e)
                failed_count += 1
        
        db.session.commit()
        
        logger.info(f"Retried {retried_count} notifications, {failed_count} failed")
        
        return {
            "retried": retried_count,
            "failed": failed_count,
            "total": len(failed_notifications)
        }
        
    except Exception as e:
        logger.error(f"Failed to retry emails: {str(e)}")
        db.session.rollback()
        return {
            "retried": 0,
            "failed": 0,
            "error": str(e)
        }


@celery.task
def cleanup_old_email_logs():
    """
    Cleanup old email logs and notifications.
    
    This task removes old email logs and notifications to maintain database performance.
    """
    try:
        logger.info("Cleaning up old email logs")
        
        # Delete logs older than 90 days
        cutoff_date = datetime.utcnow() - timedelta(days=90)
        
        # Delete old notification logs
        deleted_logs = NotificationLog.query.filter(
            NotificationLog.created_at < cutoff_date
        ).delete()
        
        # Delete old failed notifications (keep successful ones for analytics)
        deleted_notifications = Notification.query.filter(
            Notification.created_at < cutoff_date,
            Notification.status == 'failed',
            Notification.retry_count >= Notification.max_retries
        ).delete()
        
        db.session.commit()
        
        logger.info(f"Cleaned up {deleted_logs} logs and {deleted_notifications} notifications")
        
        return {
            "deleted_logs": deleted_logs,
            "deleted_notifications": deleted_notifications
        }
        
    except Exception as e:
        logger.error(f"Failed to cleanup email logs: {str(e)}")
        db.session.rollback()
        return {
            "deleted_logs": 0,
            "deleted_notifications": 0,
            "error": str(e)
        }


# Periodic tasks configuration
@celery.task
def email_maintenance_tasks():
    """
    Run all email maintenance tasks.
    
    This task runs all email-related maintenance tasks in sequence.
    """
    try:
        logger.info("Running email maintenance tasks")
        
        # Process outbox events
        outbox_result = process_email_outbox.delay()
        
        # Process scheduled emails
        scheduled_result = process_scheduled_emails.delay()
        
        # Retry failed emails
        retry_result = retry_failed_emails.delay()
        
        # Cleanup old logs
        cleanup_result = cleanup_old_email_logs.delay()
        
        logger.info("Email maintenance tasks queued")
        
        return {
            "outbox_queued": True,
            "scheduled_queued": True,
            "retry_queued": True,
            "cleanup_queued": True
        }
        
    except Exception as e:
        logger.error(f"Failed to queue email maintenance tasks: {str(e)}")
        return {
            "error": str(e)
        }
