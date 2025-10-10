"""
Automation Worker
Celery worker for processing automated reminders and campaigns
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List

from celery import Celery
from celery.schedules import crontab

from ..extensions import celery
from ..services.automation_service import AutomationService
from ..services.scheduler_service import SchedulerService
from ..models.automation import Automation, AutomationExecution, AutomationStatus
from ..models.business import Booking, Customer
from ..models.audit import EventOutbox

logger = logging.getLogger(__name__)


class AutomationWorker:
    """Worker for processing automation tasks."""
    
    def __init__(self):
        self.automation_service = AutomationService()
        self.scheduler_service = SchedulerService()
    
    def process_booking_trigger(self, booking_id: str, trigger_type: str) -> Dict[str, Any]:
        """Process booking-related automation triggers."""
        try:
            # Get booking details
            booking = Booking.query.get(booking_id)
            if not booking:
                logger.warning(f"Booking {booking_id} not found")
                return {'processed': False, 'reason': 'Booking not found'}
            
            # Find automations triggered by this event
            automations = Automation.query.filter(
                Automation.tenant_id == booking.tenant_id,
                Automation.trigger_type == trigger_type,
                Automation.status == AutomationStatus.ACTIVE,
                Automation.is_active == True
            ).all()
            
            processed_count = 0
            results = []
            
            for automation in automations:
                try:
                    # Create trigger data
                    trigger_data = {
                        'trigger_type': trigger_type,
                        'booking_id': str(booking.id),
                        'customer_id': str(booking.customer_id),
                        'tenant_id': str(booking.tenant_id),
                        'booking_start_at': booking.start_at.isoformat(),
                        'booking_end_at': booking.end_at.isoformat(),
                        'booking_status': booking.status,
                        'service_snapshot': booking.service_snapshot
                    }
                    
                    # Execute automation
                    result = self.automation_service.execute_automation(
                        str(automation.id), trigger_data
                    )
                    
                    results.append({
                        'automation_id': str(automation.id),
                        'automation_name': automation.name,
                        'result': result
                    })
                    
                    if result['executed']:
                        processed_count += 1
                        
                except Exception as e:
                    logger.error(f"Failed to execute automation {automation.id}: {str(e)}")
                    results.append({
                        'automation_id': str(automation.id),
                        'automation_name': automation.name,
                        'error': str(e)
                    })
            
            logger.info(f"Processed {processed_count} automations for booking {booking_id}")
            
            return {
                'processed': True,
                'processed_count': processed_count,
                'total_automations': len(automations),
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Failed to process booking trigger: {str(e)}")
            return {'processed': False, 'error': str(e)}
    
    def process_customer_trigger(self, customer_id: str, trigger_type: str) -> Dict[str, Any]:
        """Process customer-related automation triggers."""
        try:
            # Get customer details
            customer = Customer.query.get(customer_id)
            if not customer:
                logger.warning(f"Customer {customer_id} not found")
                return {'processed': False, 'reason': 'Customer not found'}
            
            # Find automations triggered by this event
            automations = Automation.query.filter(
                Automation.tenant_id == customer.tenant_id,
                Automation.trigger_type == trigger_type,
                Automation.status == AutomationStatus.ACTIVE,
                Automation.is_active == True
            ).all()
            
            processed_count = 0
            results = []
            
            for automation in automations:
                try:
                    # Create trigger data
                    trigger_data = {
                        'trigger_type': trigger_type,
                        'customer_id': str(customer.id),
                        'tenant_id': str(customer.tenant_id),
                        'customer_email': customer.email,
                        'customer_name': customer.display_name,
                        'customer_phone': customer.phone,
                        'customer_created_at': customer.created_at.isoformat()
                    }
                    
                    # Execute automation
                    result = self.automation_service.execute_automation(
                        str(automation.id), trigger_data
                    )
                    
                    results.append({
                        'automation_id': str(automation.id),
                        'automation_name': automation.name,
                        'result': result
                    })
                    
                    if result['executed']:
                        processed_count += 1
                        
                except Exception as e:
                    logger.error(f"Failed to execute automation {automation.id}: {str(e)}")
                    results.append({
                        'automation_id': str(automation.id),
                        'automation_name': automation.name,
                        'error': str(e)
                    })
            
            logger.info(f"Processed {processed_count} automations for customer {customer_id}")
            
            return {
                'processed': True,
                'processed_count': processed_count,
                'total_automations': len(automations),
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Failed to process customer trigger: {str(e)}")
            return {'processed': False, 'error': str(e)}
    
    def process_payment_trigger(self, payment_id: str, trigger_type: str) -> Dict[str, Any]:
        """Process payment-related automation triggers."""
        try:
            # Get payment details
            from ..models.financial import Payment
            payment = Payment.query.get(payment_id)
            if not payment:
                logger.warning(f"Payment {payment_id} not found")
                return {'processed': False, 'reason': 'Payment not found'}
            
            # Find automations triggered by this event
            automations = Automation.query.filter(
                Automation.tenant_id == payment.tenant_id,
                Automation.trigger_type == trigger_type,
                Automation.status == AutomationStatus.ACTIVE,
                Automation.is_active == True
            ).all()
            
            processed_count = 0
            results = []
            
            for automation in automations:
                try:
                    # Create trigger data
                    trigger_data = {
                        'trigger_type': trigger_type,
                        'payment_id': str(payment.id),
                        'booking_id': str(payment.booking_id) if payment.booking_id else None,
                        'customer_id': str(payment.customer_id) if payment.customer_id else None,
                        'tenant_id': str(payment.tenant_id),
                        'amount_cents': payment.amount_cents,
                        'payment_status': payment.status,
                        'payment_method': payment.method
                    }
                    
                    # Execute automation
                    result = self.automation_service.execute_automation(
                        str(automation.id), trigger_data
                    )
                    
                    results.append({
                        'automation_id': str(automation.id),
                        'automation_name': automation.name,
                        'result': result
                    })
                    
                    if result['executed']:
                        processed_count += 1
                        
                except Exception as e:
                    logger.error(f"Failed to execute automation {automation.id}: {str(e)}")
                    results.append({
                        'automation_id': str(automation.id),
                        'automation_name': automation.name,
                        'error': str(e)
                    })
            
            logger.info(f"Processed {processed_count} automations for payment {payment_id}")
            
            return {
                'processed': True,
                'processed_count': processed_count,
                'total_automations': len(automations),
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Failed to process payment trigger: {str(e)}")
            return {'processed': False, 'error': str(e)}
    
    def cleanup_old_executions(self, days_to_keep: int = 90) -> Dict[str, int]:
        """Clean up old automation executions."""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            # Count executions to be deleted
            old_executions = AutomationExecution.query.filter(
                AutomationExecution.created_at < cutoff_date
            ).count()
            
            # Delete old executions
            deleted_count = AutomationExecution.query.filter(
                AutomationExecution.created_at < cutoff_date
            ).delete()
            
            logger.info(f"Cleaned up {deleted_count} old automation executions")
            
            return {
                'deleted_count': deleted_count,
                'cutoff_date': cutoff_date.isoformat(),
                'days_kept': days_to_keep
            }
            
        except Exception as e:
            logger.error(f"Failed to cleanup old executions: {str(e)}")
            return {'deleted_count': 0, 'error': str(e)}


# Celery tasks
@celery.task
def process_booking_automation(booking_id: str, trigger_type: str):
    """Process booking-related automation triggers."""
    try:
        worker = AutomationWorker()
        result = worker.process_booking_trigger(booking_id, trigger_type)
        
        logger.info(f"Processed booking automation: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to process booking automation: {str(e)}")
        raise


@celery.task
def process_customer_automation(customer_id: str, trigger_type: str):
    """Process customer-related automation triggers."""
    try:
        worker = AutomationWorker()
        result = worker.process_customer_trigger(customer_id, trigger_type)
        
        logger.info(f"Processed customer automation: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to process customer automation: {str(e)}")
        raise


@celery.task
def process_payment_automation(payment_id: str, trigger_type: str):
    """Process payment-related automation triggers."""
    try:
        worker = AutomationWorker()
        result = worker.process_payment_trigger(payment_id, trigger_type)
        
        logger.info(f"Processed payment automation: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to process payment automation: {str(e)}")
        raise


@celery.task
def cleanup_automation_executions():
    """Clean up old automation executions."""
    try:
        worker = AutomationWorker()
        result = worker.cleanup_old_executions()
        
        logger.info(f"Cleaned up automation executions: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to cleanup automation executions: {str(e)}")
        raise


# Celery beat schedule configuration
celery.conf.beat_schedule = {
    'process-due-automations': {
        'task': 'app.jobs.automation_worker.process_due_automations_task',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
    'cleanup-automation-executions': {
        'task': 'app.jobs.automation_worker.cleanup_automation_executions',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
}

# Import the scheduler service task
from ..services.scheduler_service import process_due_automations_task
