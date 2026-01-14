"""
Automation Service
Comprehensive service for managing automated reminders and campaigns
"""

import uuid
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy import and_, or_, func, text
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from croniter import croniter

from ..extensions import db
from ..models.automation import (
    Automation, AutomationExecution, AutomationStatus, 
    AutomationTrigger, AutomationAction
)
from ..models.business import Booking, Customer
from ..models.audit import EventOutbox
from ..services.notification_service import NotificationService
from ..services.quota_service import QuotaService
from ..middleware.error_handler import TithiError

logger = logging.getLogger(__name__)


class AutomationService:
    """Service for managing automations and scheduled campaigns."""
    
    def __init__(self):
        self.notification_service = NotificationService()
        self.quota_service = QuotaService()
    
    def create_automation(self, tenant_id: str, automation_data: Dict[str, Any], created_by: str) -> str:
        """Create a new automation."""
        try:
            # Validate automation data
            self._validate_automation_data(automation_data)
            
            # Parse schedule expression if provided
            next_execution_at = None
            if automation_data.get('schedule_expression'):
                next_execution_at = self._calculate_next_execution(
                    automation_data['schedule_expression'],
                    automation_data.get('schedule_timezone', 'UTC')
                )
            
            # Create automation record
            automation = Automation(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name=automation_data['name'],
                description=automation_data.get('description'),
                trigger_type=AutomationTrigger(automation_data['trigger_type']),
                trigger_config=automation_data.get('trigger_config', {}),
                action_type=AutomationAction(automation_data['action_type']),
                action_config=automation_data.get('action_config', {}),
                schedule_expression=automation_data.get('schedule_expression'),
                schedule_timezone=automation_data.get('schedule_timezone', 'UTC'),
                start_date=datetime.fromisoformat(automation_data['start_date'].replace('Z', '+00:00')) if automation_data.get('start_date') else None,
                end_date=datetime.fromisoformat(automation_data['end_date'].replace('Z', '+00:00')) if automation_data.get('end_date') else None,
                max_executions=automation_data.get('max_executions'),
                target_audience=automation_data.get('target_audience', {}),
                conditions=automation_data.get('conditions', {}),
                rate_limit_per_hour=automation_data.get('rate_limit_per_hour', 100),
                rate_limit_per_day=automation_data.get('rate_limit_per_day', 1000),
                metadata=automation_data.get('metadata', {}),
                created_by=created_by,
                tags=automation_data.get('tags', []),
                next_execution_at=next_execution_at
            )
            
            db.session.add(automation)
            db.session.commit()
            
            # Emit automation created event
            self._emit_automation_event(tenant_id, 'AUTOMATION_CREATED', {
                'automation_id': str(automation.id),
                'name': automation.name,
                'trigger_type': automation.trigger_type.value,
                'action_type': automation.action_type.value
            })
            
            logger.info(f"Automation created: {automation.id} for tenant {tenant_id}")
            return str(automation.id)
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to create automation: {str(e)}")
            raise TithiError(
                message=f"Failed to create automation: {str(e)}",
                code="TITHI_AUTOMATION_CREATE_ERROR"
            )
    
    def get_automation(self, tenant_id: str, automation_id: str) -> Dict[str, Any]:
        """Get automation by ID."""
        try:
            automation = Automation.query.filter_by(
                tenant_id=tenant_id,
                id=automation_id,
                is_active=True
            ).first()
            
            if not automation:
                raise TithiError(
                    message="Automation not found",
                    code="TITHI_AUTOMATION_NOT_FOUND",
                    status_code=404
                )
            
            return automation.to_dict()
            
        except TithiError:
            raise
        except Exception as e:
            logger.error(f"Failed to get automation: {str(e)}")
            raise TithiError(
                message="Failed to get automation",
                code="TITHI_AUTOMATION_GET_ERROR"
            )
    
    def list_automations(self, tenant_id: str, status: Optional[str] = None, 
                        trigger_type: Optional[str] = None, limit: int = 50, 
                        offset: int = 0) -> Dict[str, Any]:
        """List automations with filtering and pagination."""
        try:
            query = Automation.query.filter_by(tenant_id=tenant_id, is_active=True)
            
            if status:
                query = query.filter(Automation.status == AutomationStatus(status))
            
            if trigger_type:
                query = query.filter(Automation.trigger_type == AutomationTrigger(trigger_type))
            
            total_count = query.count()
            automations = query.order_by(Automation.created_at.desc()).offset(offset).limit(limit).all()
            
            return {
                'automations': [automation.to_dict() for automation in automations],
                'total_count': total_count,
                'limit': limit,
                'offset': offset
            }
            
        except Exception as e:
            logger.error(f"Failed to list automations: {str(e)}")
            raise TithiError(
                message="Failed to list automations",
                code="TITHI_AUTOMATION_LIST_ERROR"
            )
    
    def update_automation(self, tenant_id: str, automation_id: str, 
                          update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update automation."""
        try:
            automation = Automation.query.filter_by(
                tenant_id=tenant_id,
                id=automation_id,
                is_active=True
            ).first()
            
            if not automation:
                raise TithiError(
                    message="Automation not found",
                    code="TITHI_AUTOMATION_NOT_FOUND",
                    status_code=404
                )
            
            # Update fields
            if 'name' in update_data:
                automation.name = update_data['name']
            if 'description' in update_data:
                automation.description = update_data['description']
            if 'status' in update_data:
                automation.status = AutomationStatus(update_data['status'])
            if 'trigger_config' in update_data:
                automation.trigger_config = update_data['trigger_config']
            if 'action_config' in update_data:
                automation.action_config = update_data['action_config']
            if 'schedule_expression' in update_data:
                automation.schedule_expression = update_data['schedule_expression']
                # Recalculate next execution
                if update_data['schedule_expression']:
                    automation.next_execution_at = self._calculate_next_execution(
                        update_data['schedule_expression'],
                        automation.schedule_timezone
                    )
            if 'target_audience' in update_data:
                automation.target_audience = update_data['target_audience']
            if 'conditions' in update_data:
                automation.conditions = update_data['conditions']
            if 'metadata' in update_data:
                automation.metadata = update_data['metadata']
            if 'tags' in update_data:
                automation.tags = update_data['tags']
            
            automation.version += 1
            db.session.commit()
            
            # Emit automation updated event
            self._emit_automation_event(tenant_id, 'AUTOMATION_UPDATED', {
                'automation_id': str(automation.id),
                'version': automation.version
            })
            
            logger.info(f"Automation updated: {automation.id} for tenant {tenant_id}")
            return automation.to_dict()
            
        except TithiError:
            raise
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to update automation: {str(e)}")
            raise TithiError(
                message="Failed to update automation",
                code="TITHI_AUTOMATION_UPDATE_ERROR"
            )
    
    def cancel_automation(self, tenant_id: str, automation_id: str) -> Dict[str, Any]:
        """Cancel automation."""
        try:
            automation = Automation.query.filter_by(
                tenant_id=tenant_id,
                id=automation_id,
                is_active=True
            ).first()
            
            if not automation:
                raise TithiError(
                    message="Automation not found",
                    code="TITHI_AUTOMATION_NOT_FOUND",
                    status_code=404
                )
            
            automation.status = AutomationStatus.CANCELLED
            automation.next_execution_at = None
            db.session.commit()
            
            # Emit automation cancelled event
            self._emit_automation_event(tenant_id, 'AUTOMATION_CANCELLED', {
                'automation_id': str(automation.id)
            })
            
            logger.info(f"Automation cancelled: {automation.id} for tenant {tenant_id}")
            return automation.to_dict()
            
        except TithiError:
            raise
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to cancel automation: {str(e)}")
            raise TithiError(
                message="Failed to cancel automation",
                code="TITHI_AUTOMATION_CANCEL_ERROR"
            )
    
    def execute_automation(self, automation_id: str, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute automation with trigger data."""
        try:
            automation = Automation.query.filter_by(
                id=automation_id,
                is_active=True
            ).first()
            
            if not automation:
                raise TithiError(
                    message="Automation not found",
                    code="TITHI_AUTOMATION_NOT_FOUND",
                    status_code=404
                )
            
            # Check if automation should be executed
            if not self._should_execute_automation(automation, trigger_data):
                return {'executed': False, 'reason': 'Automation conditions not met'}
            
            # Check rate limits
            if not self._check_rate_limits(automation):
                return {'executed': False, 'reason': 'Rate limit exceeded'}
            
            # Create execution record
            execution = AutomationExecution(
                id=str(uuid.uuid4()),
                automation_id=automation.id,
                trigger_data=trigger_data,
                execution_status='running',
                tenant_id=automation.tenant_id,
                user_id=trigger_data.get('user_id'),
                customer_id=trigger_data.get('customer_id'),
                booking_id=trigger_data.get('booking_id'),
                started_at=datetime.utcnow()
            )
            
            db.session.add(execution)
            db.session.commit()
            
            # Execute the action
            action_result = self._execute_action(automation, trigger_data)
            
            # Update execution record
            execution.action_result = action_result
            execution.execution_status = 'completed'
            execution.completed_at = datetime.utcnow()
            execution.duration_ms = int((execution.completed_at - execution.started_at).total_seconds() * 1000)
            
            # Update automation execution count
            automation.execution_count += 1
            automation.last_executed_at = execution.completed_at
            
            # Check if automation should be completed
            if automation.max_executions and automation.execution_count >= automation.max_executions:
                automation.status = AutomationStatus.COMPLETED
                automation.next_execution_at = None
            
            db.session.commit()
            
            # Emit automation executed event
            self._emit_automation_event(automation.tenant_id, 'AUTOMATION_EXECUTED', {
                'automation_id': str(automation.id),
                'execution_id': str(execution.id),
                'action_result': action_result
            })
            
            logger.info(f"Automation executed: {automation.id}, execution: {execution.id}")
            return {
                'executed': True,
                'execution_id': str(execution.id),
                'action_result': action_result
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to execute automation: {str(e)}")
            raise TithiError(
                message=f"Failed to execute automation: {str(e)}",
                code="TITHI_AUTOMATION_EXECUTE_ERROR"
            )
    
    def get_automation_executions(self, tenant_id: str, automation_id: str, 
                                 limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Get automation execution history."""
        try:
            query = AutomationExecution.query.filter_by(
                tenant_id=tenant_id,
                automation_id=automation_id
            )
            
            total_count = query.count()
            executions = query.order_by(AutomationExecution.created_at.desc()).offset(offset).limit(limit).all()
            
            return {
                'executions': [execution.to_dict() for execution in executions],
                'total_count': total_count,
                'limit': limit,
                'offset': offset
            }
            
        except Exception as e:
            logger.error(f"Failed to get automation executions: {str(e)}")
            raise TithiError(
                message="Failed to get automation executions",
                code="TITHI_AUTOMATION_EXECUTIONS_ERROR"
            )
    
    def process_scheduled_automations(self) -> Dict[str, int]:
        """Process automations that are due for execution."""
        try:
            now = datetime.utcnow()
            
            # Get automations due for execution
            automations = Automation.query.filter(
                Automation.status == AutomationStatus.ACTIVE,
                Automation.next_execution_at <= now,
                Automation.is_active == True
            ).all()
            
            executed_count = 0
            error_count = 0
            
            for automation in automations:
                try:
                    # Execute automation with scheduled trigger
                    trigger_data = {
                        'trigger_type': 'scheduled_time',
                        'scheduled_at': now.isoformat(),
                        'automation_id': str(automation.id)
                    }
                    
                    result = self.execute_automation(str(automation.id), trigger_data)
                    
                    if result['executed']:
                        executed_count += 1
                        
                        # Calculate next execution time
                        if automation.schedule_expression:
                            automation.next_execution_at = self._calculate_next_execution(
                                automation.schedule_expression,
                                automation.schedule_timezone
                            )
                        else:
                            automation.next_execution_at = None
                        
                        db.session.commit()
                    else:
                        logger.warning(f"Automation {automation.id} not executed: {result.get('reason')}")
                        
                except Exception as e:
                    error_count += 1
                    logger.error(f"Failed to execute scheduled automation {automation.id}: {str(e)}")
                    db.session.rollback()
            
            logger.info(f"Processed scheduled automations: {executed_count} executed, {error_count} errors")
            return {
                'executed': executed_count,
                'errors': error_count,
                'total_processed': len(automations)
            }
            
        except Exception as e:
            logger.error(f"Failed to process scheduled automations: {str(e)}")
            raise TithiError(
                message="Failed to process scheduled automations",
                code="TITHI_AUTOMATION_SCHEDULE_PROCESS_ERROR"
            )
    
    def _validate_automation_data(self, data: Dict[str, Any]) -> None:
        """Validate automation data."""
        required_fields = ['name', 'trigger_type', 'action_type']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Validate trigger type
        try:
            AutomationTrigger(data['trigger_type'])
        except ValueError:
            raise TithiError(
                message=f"Invalid trigger type: {data['trigger_type']}",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate action type
        try:
            AutomationAction(data['action_type'])
        except ValueError:
            raise TithiError(
                message=f"Invalid action type: {data['action_type']}",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate schedule expression if provided
        if data.get('schedule_expression'):
            try:
                croniter(data['schedule_expression'])
            except Exception:
                raise TithiError(
                    message=f"Invalid schedule expression: {data['schedule_expression']}",
                    code="TITHI_AUTOMATION_SCHEDULE_INVALID",
                    status_code=400
                )
    
    def _calculate_next_execution(self, schedule_expression: str, timezone_str: str) -> datetime:
        """Calculate next execution time from cron expression."""
        try:
            # Parse cron expression
            cron = croniter(schedule_expression, datetime.now(timezone.utc))
            return cron.get_next(datetime)
        except Exception as e:
            logger.error(f"Failed to calculate next execution: {str(e)}")
            raise TithiError(
                message=f"Invalid schedule expression: {schedule_expression}",
                code="TITHI_AUTOMATION_SCHEDULE_INVALID"
            )
    
    def _should_execute_automation(self, automation: Automation, trigger_data: Dict[str, Any]) -> bool:
        """Check if automation should be executed based on conditions."""
        # Check date range
        now = datetime.utcnow()
        if automation.start_date and now < automation.start_date:
            return False
        if automation.end_date and now > automation.end_date:
            return False
        
        # Check conditions
        if automation.conditions:
            # Implement condition evaluation logic here
            # For now, return True (conditions met)
            pass
        
        return True
    
    def _check_rate_limits(self, automation: Automation) -> bool:
        """Check if automation is within rate limits."""
        now = datetime.utcnow()
        hour_ago = now - timedelta(hours=1)
        day_ago = now - timedelta(days=1)
        
        # Check hourly rate limit
        hourly_executions = AutomationExecution.query.filter(
            AutomationExecution.automation_id == automation.id,
            AutomationExecution.started_at >= hour_ago
        ).count()
        
        if hourly_executions >= automation.rate_limit_per_hour:
            return False
        
        # Check daily rate limit
        daily_executions = AutomationExecution.query.filter(
            AutomationExecution.automation_id == automation.id,
            AutomationExecution.started_at >= day_ago
        ).count()
        
        if daily_executions >= automation.rate_limit_per_day:
            return False
        
        return True
    
    def _execute_action(self, automation: Automation, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute automation action."""
        try:
            action_type = automation.action_type
            
            if action_type == AutomationAction.SEND_EMAIL:
                return self._execute_send_email(automation, trigger_data)
            elif action_type == AutomationAction.SEND_SMS:
                return self._execute_send_sms(automation, trigger_data)
            elif action_type == AutomationAction.SEND_PUSH:
                return self._execute_send_push(automation, trigger_data)
            elif action_type == AutomationAction.ADD_LOYALTY_POINTS:
                return self._execute_add_loyalty_points(automation, trigger_data)
            elif action_type == AutomationAction.WEBHOOK_CALL:
                return self._execute_webhook_call(automation, trigger_data)
            else:
                return {'status': 'not_implemented', 'message': f'Action type {action_type.value} not implemented'}
                
        except Exception as e:
            logger.error(f"Failed to execute action {automation.action_type.value}: {str(e)}")
            return {'status': 'error', 'message': str(e)}
    
    def _execute_send_email(self, automation: Automation, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute send email action."""
        try:
            action_config = automation.action_config
            recipient = action_config.get('recipient')
            subject = action_config.get('subject')
            template_id = action_config.get('template_id')
            
            if not recipient:
                return {'status': 'error', 'message': 'No recipient specified'}
            
            # Create notification request
            from ..services.notification_service import NotificationRequest, NotificationChannel, NotificationPriority
            
            request = NotificationRequest(
                tenant_id=automation.tenant_id,
                event_code='automation_email',
                channel=NotificationChannel.EMAIL,
                recipient=recipient,
                subject=subject,
                content=action_config.get('content', ''),
                template_id=template_id,
                priority=NotificationPriority.NORMAL,
                metadata={
                    'automation_id': str(automation.id),
                    'trigger_data': trigger_data
                }
            )
            
            # Send notification
            result = self.notification_service.send_immediate_notification(request)
            
            return {
                'status': 'success' if result.success else 'error',
                'message': result.error_message if not result.success else 'Email sent successfully',
                'notification_id': str(result.notification_id) if result.notification_id else None
            }
            
        except Exception as e:
            logger.error(f"Failed to execute send email: {str(e)}")
            return {'status': 'error', 'message': str(e)}
    
    def _execute_send_sms(self, automation: Automation, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute send SMS action."""
        try:
            action_config = automation.action_config
            recipient = action_config.get('recipient')
            content = action_config.get('content')
            
            if not recipient or not content:
                return {'status': 'error', 'message': 'Recipient and content required for SMS'}
            
            # Create notification request
            from ..services.notification_service import NotificationRequest, NotificationChannel, NotificationPriority
            
            request = NotificationRequest(
                tenant_id=automation.tenant_id,
                event_code='automation_sms',
                channel=NotificationChannel.SMS,
                recipient=recipient,
                content=content,
                priority=NotificationPriority.NORMAL,
                metadata={
                    'automation_id': str(automation.id),
                    'trigger_data': trigger_data
                }
            )
            
            # Send notification
            result = self.notification_service.send_immediate_notification(request)
            
            return {
                'status': 'success' if result.success else 'error',
                'message': result.error_message if not result.success else 'SMS sent successfully',
                'notification_id': str(result.notification_id) if result.notification_id else None
            }
            
        except Exception as e:
            logger.error(f"Failed to execute send SMS: {str(e)}")
            return {'status': 'error', 'message': str(e)}
    
    def _execute_send_push(self, automation: Automation, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute send push notification action."""
        # Placeholder for push notification implementation
        return {'status': 'not_implemented', 'message': 'Push notifications not implemented'}
    
    def _execute_add_loyalty_points(self, automation: Automation, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute add loyalty points action."""
        # Placeholder for loyalty points implementation
        return {'status': 'not_implemented', 'message': 'Loyalty points not implemented'}
    
    def _execute_webhook_call(self, automation: Automation, trigger_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute webhook call action."""
        # Placeholder for webhook implementation
        return {'status': 'not_implemented', 'message': 'Webhook calls not implemented'}
    
    def _emit_automation_event(self, tenant_id: str, event_code: str, payload: Dict[str, Any]) -> None:
        """Emit automation event to outbox."""
        try:
            event = EventOutbox(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                event_code=event_code,
                payload=payload,
                status='ready'
            )
            
            db.session.add(event)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to emit automation event: {str(e)}")
            db.session.rollback()
