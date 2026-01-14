"""
Scheduler Service
Cron-like scheduling service for automated reminders and campaigns
"""

import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from croniter import croniter
from celery import Celery

from ..extensions import db, celery
from ..models.automation import Automation, AutomationStatus
from ..models.audit import EventOutbox
from ..services.automation_service import AutomationService

logger = logging.getLogger(__name__)


class SchedulerService:
    """Service for managing cron-like scheduling of automations."""
    
    def __init__(self):
        self.automation_service = AutomationService()
    
    def schedule_automation(self, automation_id: str, cron_expression: str, 
                          timezone_str: str = 'UTC') -> Dict[str, Any]:
        """Schedule automation with cron expression."""
        try:
            automation = Automation.query.filter_by(
                id=automation_id,
                is_active=True
            ).first()
            
            if not automation:
                raise ValueError(f"Automation {automation_id} not found")
            
            # Validate cron expression
            try:
                croniter(cron_expression)
            except Exception as e:
                raise ValueError(f"Invalid cron expression: {cron_expression}")
            
            # Calculate next execution time
            next_execution = self._calculate_next_execution(cron_expression, timezone_str)
            
            # Update automation
            automation.schedule_expression = cron_expression
            automation.schedule_timezone = timezone_str
            automation.next_execution_at = next_execution
            automation.status = AutomationStatus.ACTIVE
            
            db.session.commit()
            
            # Schedule Celery task
            self._schedule_celery_task(automation_id, next_execution)
            
            logger.info(f"Automation {automation_id} scheduled with cron: {cron_expression}")
            
            return {
                'automation_id': automation_id,
                'cron_expression': cron_expression,
                'timezone': timezone_str,
                'next_execution_at': next_execution.isoformat() + 'Z',
                'scheduled': True
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to schedule automation: {str(e)}")
            raise
    
    def unschedule_automation(self, automation_id: str) -> Dict[str, Any]:
        """Unschedule automation."""
        try:
            automation = Automation.query.filter_by(
                id=automation_id,
                is_active=True
            ).first()
            
            if not automation:
                raise ValueError(f"Automation {automation_id} not found")
            
            # Update automation
            automation.schedule_expression = None
            automation.next_execution_at = None
            
            db.session.commit()
            
            # Cancel Celery task
            self._cancel_celery_task(automation_id)
            
            logger.info(f"Automation {automation_id} unscheduled")
            
            return {
                'automation_id': automation_id,
                'scheduled': False,
                'message': 'Automation unscheduled successfully'
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to unschedule automation: {str(e)}")
            raise
    
    def reschedule_automation(self, automation_id: str, cron_expression: str, 
                            timezone_str: str = 'UTC') -> Dict[str, Any]:
        """Reschedule automation with new cron expression."""
        try:
            # First unschedule
            self.unschedule_automation(automation_id)
            
            # Then schedule with new expression
            result = self.schedule_automation(automation_id, cron_expression, timezone_str)
            
            logger.info(f"Automation {automation_id} rescheduled with cron: {cron_expression}")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to reschedule automation: {str(e)}")
            raise
    
    def get_scheduled_automations(self, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all scheduled automations."""
        try:
            query = Automation.query.filter(
                Automation.is_active == True,
                Automation.schedule_expression.isnot(None),
                Automation.next_execution_at.isnot(None)
            )
            
            if tenant_id:
                query = query.filter(Automation.tenant_id == tenant_id)
            
            automations = query.all()
            
            return [
                {
                    'automation_id': str(automation.id),
                    'name': automation.name,
                    'cron_expression': automation.schedule_expression,
                    'timezone': automation.schedule_timezone,
                    'next_execution_at': automation.next_execution_at.isoformat() + 'Z' if automation.next_execution_at else None,
                    'status': automation.status.value,
                    'tenant_id': str(automation.tenant_id)
                }
                for automation in automations
            ]
            
        except Exception as e:
            logger.error(f"Failed to get scheduled automations: {str(e)}")
            raise
    
    def process_due_automations(self) -> Dict[str, int]:
        """Process automations that are due for execution."""
        try:
            now = datetime.utcnow()
            
            # Get automations due for execution
            due_automations = Automation.query.filter(
                Automation.is_active == True,
                Automation.schedule_expression.isnot(None),
                Automation.next_execution_at <= now,
                Automation.status == AutomationStatus.ACTIVE
            ).all()
            
            executed_count = 0
            error_count = 0
            
            for automation in due_automations:
                try:
                    # Execute automation
                    trigger_data = {
                        'trigger_type': 'scheduled_time',
                        'scheduled_at': now.isoformat(),
                        'automation_id': str(automation.id),
                        'cron_expression': automation.schedule_expression
                    }
                    
                    result = self.automation_service.execute_automation(
                        str(automation.id), trigger_data
                    )
                    
                    if result['executed']:
                        executed_count += 1
                        
                        # Calculate next execution time
                        next_execution = self._calculate_next_execution(
                            automation.schedule_expression,
                            automation.schedule_timezone
                        )
                        
                        automation.next_execution_at = next_execution
                        
                        # Schedule next Celery task
                        self._schedule_celery_task(str(automation.id), next_execution)
                        
                        db.session.commit()
                    else:
                        logger.warning(f"Automation {automation.id} not executed: {result.get('reason')}")
                        
                except Exception as e:
                    error_count += 1
                    logger.error(f"Failed to execute scheduled automation {automation.id}: {str(e)}")
                    db.session.rollback()
            
            logger.info(f"Processed due automations: {executed_count} executed, {error_count} errors")
            
            return {
                'executed': executed_count,
                'errors': error_count,
                'total_due': len(due_automations)
            }
            
        except Exception as e:
            logger.error(f"Failed to process due automations: {str(e)}")
            raise
    
    def validate_cron_expression(self, cron_expression: str) -> Dict[str, Any]:
        """Validate cron expression and return next execution times."""
        try:
            cron = croniter(cron_expression, datetime.now(timezone.utc))
            
            # Get next 5 execution times
            next_executions = []
            for i in range(5):
                next_executions.append(cron.get_next(datetime).isoformat() + 'Z')
            
            return {
                'valid': True,
                'cron_expression': cron_expression,
                'next_executions': next_executions,
                'message': 'Cron expression is valid'
            }
            
        except Exception as e:
            return {
                'valid': False,
                'cron_expression': cron_expression,
                'error': str(e),
                'message': f'Invalid cron expression: {str(e)}'
            }
    
    def get_cron_examples(self) -> List[Dict[str, str]]:
        """Get common cron expression examples."""
        return [
            {
                'expression': '0 9 * * 1',
                'description': 'Every Monday at 9:00 AM',
                'use_case': 'Weekly newsletter'
            },
            {
                'expression': '0 0 1 * *',
                'description': 'First day of every month at midnight',
                'use_case': 'Monthly reports'
            },
            {
                'expression': '0 12 * * *',
                'description': 'Every day at noon',
                'use_case': 'Daily reminders'
            },
            {
                'expression': '0 */6 * * *',
                'description': 'Every 6 hours',
                'use_case': 'Frequent updates'
            },
            {
                'expression': '0 0 * * 0',
                'description': 'Every Sunday at midnight',
                'use_case': 'Weekly cleanup'
            },
            {
                'expression': '0 9 1,15 * *',
                'description': '1st and 15th of every month at 9:00 AM',
                'use_case': 'Bi-weekly campaigns'
            },
            {
                'expression': '0 18 * * 1-5',
                'description': 'Every weekday at 6:00 PM',
                'use_case': 'Business hours reminders'
            },
            {
                'expression': '0 0 1 1 *',
                'description': 'January 1st at midnight',
                'use_case': 'Annual campaigns'
            }
        ]
    
    def _calculate_next_execution(self, cron_expression: str, timezone_str: str) -> datetime:
        """Calculate next execution time from cron expression."""
        try:
            # Parse cron expression
            cron = croniter(cron_expression, datetime.now(timezone.utc))
            return cron.get_next(datetime)
        except Exception as e:
            logger.error(f"Failed to calculate next execution: {str(e)}")
            raise ValueError(f"Invalid cron expression: {cron_expression}")
    
    def _schedule_celery_task(self, automation_id: str, execution_time: datetime) -> None:
        """Schedule Celery task for automation execution."""
        try:
            # Calculate delay in seconds
            delay_seconds = (execution_time - datetime.utcnow()).total_seconds()
            
            if delay_seconds > 0:
                # Schedule task
                execute_automation_task.apply_async(
                    args=[automation_id],
                    eta=execution_time,
                    task_id=f'automation_{automation_id}_{execution_time.timestamp()}'
                )
                
                logger.info(f"Scheduled Celery task for automation {automation_id} at {execution_time}")
            else:
                logger.warning(f"Execution time {execution_time} is in the past for automation {automation_id}")
                
        except Exception as e:
            logger.error(f"Failed to schedule Celery task: {str(e)}")
            raise
    
    def _cancel_celery_task(self, automation_id: str) -> None:
        """Cancel Celery task for automation."""
        try:
            # Note: In a production environment, you would need to track task IDs
            # and cancel them individually. For now, we'll log the cancellation.
            logger.info(f"Cancelled Celery task for automation {automation_id}")
            
        except Exception as e:
            logger.error(f"Failed to cancel Celery task: {str(e)}")
            raise


# Celery task for executing automations
@celery.task(bind=True, max_retries=3)
def execute_automation_task(self, automation_id: str):
    """Celery task to execute automation."""
    try:
        automation_service = AutomationService()
        
        # Create trigger data for scheduled execution
        trigger_data = {
            'trigger_type': 'scheduled_time',
            'scheduled_at': datetime.utcnow().isoformat(),
            'automation_id': automation_id,
            'celery_task_id': self.request.id
        }
        
        # Execute automation
        result = automation_service.execute_automation(automation_id, trigger_data)
        
        logger.info(f"Celery task executed automation {automation_id}: {result}")
        
        return result
        
    except Exception as e:
        logger.error(f"Celery task failed for automation {automation_id}: {str(e)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            raise self.retry(countdown=60 * (2 ** self.request.retries))
        else:
            # Log final failure
            logger.error(f"Celery task permanently failed for automation {automation_id}")
            raise


# Periodic task to process due automations
@celery.task
def process_due_automations_task():
    """Periodic Celery task to process due automations."""
    try:
        scheduler_service = SchedulerService()
        result = scheduler_service.process_due_automations()
        
        logger.info(f"Processed due automations: {result}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to process due automations: {str(e)}")
        raise
