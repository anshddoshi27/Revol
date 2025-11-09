"""
Notification Cron Runner

This module provides a cronable entrypoint for processing due notifications
and scheduled reminders (24h/1h).
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from ..services.notification_service import NotificationService
from ..services.notification_template_service import StandardizedTemplateService
from ..models.notification import Notification, NotificationStatus
from ..models.business import Booking
from ..models.tenant import Tenant


logger = logging.getLogger(__name__)


class NotificationCronRunner:
    """Cron runner for processing due notifications and scheduling reminders."""
    
    def __init__(self):
        self.notification_service = NotificationService()
        self.template_service = StandardizedTemplateService()
    
    def process_due_notifications(self) -> Dict[str, Any]:
        """
        Process all due notifications.
        
        This is the main cron entrypoint that should be called regularly
        (e.g., every minute) to process scheduled notifications.
        
        Returns:
            Dict with processing results and statistics
        """
        logger.info("Starting due notifications processing")
        
        try:
            results = self.notification_service.process_due_notifications()
            
            # Calculate statistics
            total_processed = len(results)
            successful = sum(1 for r in results if r.success)
            failed = total_processed - successful
            
            stats = {
                'processed': total_processed,
                'successful': successful,
                'failed': failed,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Processed {total_processed} notifications: {successful} successful, {failed} failed")
            
            return {
                'success': True,
                'stats': stats,
                'results': [{'success': r.success, 'error': r.error_message} for r in results]
            }
            
        except Exception as e:
            logger.error(f"Error processing due notifications: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def schedule_booking_reminders(self) -> Dict[str, Any]:
        """
        Schedule 24h and 1h reminders for confirmed bookings.
        
        This should be called daily to schedule reminders for upcoming bookings.
        
        Returns:
            Dict with scheduling results
        """
        logger.info("Starting booking reminder scheduling")
        
        try:
            # Get confirmed bookings that need reminders
            tomorrow = datetime.utcnow() + timedelta(days=1)
            day_after_tomorrow = datetime.utcnow() + timedelta(days=2)
            
            # 24h reminders (bookings tomorrow)
            bookings_24h = Booking.query.filter(
                Booking.status == 'confirmed',
                Booking.start_at >= tomorrow.replace(hour=0, minute=0, second=0, microsecond=0),
                Booking.start_at < day_after_tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
            ).all()
            
            # 1h reminders (bookings in the next 2 hours)
            now = datetime.utcnow()
            two_hours_from_now = now + timedelta(hours=2)
            
            bookings_1h = Booking.query.filter(
                Booking.status == 'confirmed',
                Booking.start_at >= now,
                Booking.start_at <= two_hours_from_now
            ).all()
            
            scheduled_24h = 0
            scheduled_1h = 0
            
            # Schedule 24h reminders
            for booking in bookings_24h:
                try:
                    # Check if reminder already scheduled
                    existing_reminder = Notification.query.filter_by(
                        tenant_id=booking.tenant_id,
                        event_code='reminder_24h',
                        channel='email',
                        dedupe_key=f"reminder_24h_{booking.id}"
                    ).first()
                    
                    if not existing_reminder:
                        # Schedule reminder for 24h before booking
                        reminder_time = booking.start_at - timedelta(hours=24)
                        
                        from ..services.notification_service import NotificationRequest, NotificationChannel, NotificationPriority
                        
                        request = NotificationRequest(
                            tenant_id=booking.tenant_id,
                            event_code='reminder_24h',
                            channel=NotificationChannel.EMAIL,
                            recipient='',  # Will be filled from customer
                            subject='',
                            content='',
                            scheduled_at=reminder_time,
                            priority=NotificationPriority.NORMAL,
                            metadata={'booking_id': str(booking.id)}
                        )
                        
                        # Create notification record
                        notification = Notification(
                            id=request.id if hasattr(request, 'id') else None,
                            tenant_id=booking.tenant_id,
                            event_code='reminder_24h',
                            channel='email',
                            status=NotificationStatus.PENDING,
                            to_email='',  # Will be filled from customer
                            scheduled_at=reminder_time,
                            dedupe_key=f"reminder_24h_{booking.id}",
                            metadata_json={'booking_id': str(booking.id)}
                        )
                        
                        from ..database import db
                        db.session.add(notification)
                        scheduled_24h += 1
                        
                except Exception as e:
                    logger.error(f"Error scheduling 24h reminder for booking {booking.id}: {str(e)}")
            
            # Schedule 1h reminders
            for booking in bookings_1h:
                try:
                    # Check if reminder already scheduled
                    existing_reminder = Notification.query.filter_by(
                        tenant_id=booking.tenant_id,
                        event_code='reminder_1h',
                        channel='sms',
                        dedupe_key=f"reminder_1h_{booking.id}"
                    ).first()
                    
                    if not existing_reminder:
                        # Schedule reminder for 1h before booking
                        reminder_time = booking.start_at - timedelta(hours=1)
                        
                        # Create notification record
                        notification = Notification(
                            tenant_id=booking.tenant_id,
                            event_code='reminder_1h',
                            channel='sms',
                            status=NotificationStatus.PENDING,
                            to_phone='',  # Will be filled from customer
                            scheduled_at=reminder_time,
                            dedupe_key=f"reminder_1h_{booking.id}",
                            metadata_json={'booking_id': str(booking.id)}
                        )
                        
                        db.session.add(notification)
                        scheduled_1h += 1
                        
                except Exception as e:
                    logger.error(f"Error scheduling 1h reminder for booking {booking.id}: {str(e)}")
            
            db.session.commit()
            
            stats = {
                'scheduled_24h': scheduled_24h,
                'scheduled_1h': scheduled_1h,
                'total_scheduled': scheduled_24h + scheduled_1h,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Scheduled {scheduled_24h} 24h reminders and {scheduled_1h} 1h reminders")
            
            return {
                'success': True,
                'stats': stats
            }
            
        except Exception as e:
            logger.error(f"Error scheduling booking reminders: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }


# Convenience functions for cron jobs
def process_due_notifications_cron() -> Dict[str, Any]:
    """Cron entrypoint for processing due notifications."""
    runner = NotificationCronRunner()
    return runner.process_due_notifications()


def schedule_booking_reminders_cron() -> Dict[str, Any]:
    """Cron entrypoint for scheduling booking reminders."""
    runner = NotificationCronRunner()
    return runner.schedule_booking_reminders()
