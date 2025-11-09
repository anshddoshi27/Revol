"""
Automation Model
Supports automated reminders and scheduled campaigns with cron-like rules
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON, ForeignKey, Integer, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import BaseModel
import uuid
import enum


class AutomationStatus(enum.Enum):
    """Automation status enumeration."""
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class AutomationTrigger(enum.Enum):
    """Automation trigger types."""
    BOOKING_CREATED = "booking_created"
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_NO_SHOW = "booking_no_show"
    BOOKING_COMPLETED = "booking_completed"
    CUSTOMER_REGISTERED = "customer_registered"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_FAILED = "payment_failed"
    SCHEDULED_TIME = "scheduled_time"
    CUSTOM_EVENT = "custom_event"


class AutomationAction(enum.Enum):
    """Automation action types."""
    SEND_EMAIL = "send_email"
    SEND_SMS = "send_sms"
    SEND_PUSH = "send_push"
    CREATE_BOOKING = "create_booking"
    UPDATE_CUSTOMER = "update_customer"
    APPLY_DISCOUNT = "apply_discount"
    ADD_LOYALTY_POINTS = "add_loyalty_points"
    WEBHOOK_CALL = "webhook_call"
    CUSTOM_ACTION = "custom_action"


class Automation(BaseModel):
    """Automation model for scheduled reminders and campaigns."""
    
    __tablename__ = 'automations'
    
    # Basic automation information
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(Enum(AutomationStatus), default=AutomationStatus.ACTIVE, nullable=False)
    
    # Trigger configuration
    trigger_type = Column(Enum(AutomationTrigger), nullable=False)
    trigger_config = Column(JSON, default={})  # Trigger-specific configuration
    
    # Action configuration
    action_type = Column(Enum(AutomationAction), nullable=False)
    action_config = Column(JSON, default={})  # Action-specific configuration
    
    # Scheduling configuration
    schedule_expression = Column(String(255))  # Cron-like expression for scheduled_time triggers
    schedule_timezone = Column(String(50), default='UTC')
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    
    # Execution settings
    max_executions = Column(Integer)  # Maximum number of executions (None = unlimited)
    execution_count = Column(Integer, default=0, nullable=False)
    last_executed_at = Column(DateTime)
    next_execution_at = Column(DateTime)
    
    # Targeting and filtering
    target_audience = Column(JSON, default={})  # Customer segmentation, filters
    conditions = Column(JSON, default={})  # Additional conditions for execution
    
    # Rate limiting and throttling
    rate_limit_per_hour = Column(Integer, default=100)  # Max executions per hour
    rate_limit_per_day = Column(Integer, default=1000)  # Max executions per day
    
    # Metadata and tracking
    metadata_json = Column("metadata", JSON, default={})
    created_by = Column(String(255))  # User ID who created the automation
    tags = Column(JSON, default=[])  # Tags for organization
    
    # Relationships
    tenant_id = Column(String(255), ForeignKey('tenants.id'), nullable=False)
    tenant = relationship("Tenant", back_populates="automations")
    
    # Audit fields
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    
    def __repr__(self):
        return f"<Automation(id={self.id}, name='{self.name}', status='{self.status.value}')>"
    
    def to_dict(self):
        """Convert automation to dictionary for API responses."""
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'status': self.status.value,
            'trigger_type': self.trigger_type.value,
            'trigger_config': self.trigger_config,
            'action_type': self.action_type.value,
            'action_config': self.action_config,
            'schedule_expression': self.schedule_expression,
            'schedule_timezone': self.schedule_timezone,
            'start_date': self.start_date.isoformat() + 'Z' if self.start_date else None,
            'end_date': self.end_date.isoformat() + 'Z' if self.end_date else None,
            'max_executions': self.max_executions,
            'execution_count': self.execution_count,
            'last_executed_at': self.last_executed_at.isoformat() + 'Z' if self.last_executed_at else None,
            'next_execution_at': self.next_execution_at.isoformat() + 'Z' if self.next_execution_at else None,
            'target_audience': self.target_audience,
            'conditions': self.conditions,
            'rate_limit_per_hour': self.rate_limit_per_hour,
            'rate_limit_per_day': self.rate_limit_per_day,
            'metadata': self.metadata_json,
            'created_by': self.created_by,
            'tags': self.tags,
            'version': self.version,
            'created_at': self.created_at.isoformat() + 'Z',
            'updated_at': self.updated_at.isoformat() + 'Z'
        }


class AutomationExecution(BaseModel):
    """Automation execution log for tracking and debugging."""
    
    __tablename__ = 'automation_executions'
    
    # Reference to automation
    automation_id = Column(String(255), ForeignKey('automations.id'), nullable=False)
    automation = relationship("Automation")
    
    # Execution details
    trigger_data = Column(JSON, default={})  # Data that triggered the execution
    action_result = Column(JSON, default={})  # Result of the action execution
    execution_status = Column(String(50), default='pending')  # pending, running, completed, failed
    error_message = Column(Text)
    
    # Timing information
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_ms = Column(Integer)  # Execution duration in milliseconds
    
    # Context information
    tenant_id = Column(String(255), ForeignKey('tenants.id'), nullable=False)
    user_id = Column(String(255))  # User who triggered the execution (if applicable)
    customer_id = Column(String(255))  # Customer affected by the execution (if applicable)
    booking_id = Column(String(255))  # Booking affected by the execution (if applicable)
    
    # Retry information
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    
    def __repr__(self):
        return f"<AutomationExecution(id={self.id}, automation_id={self.automation_id}, status='{self.execution_status}')>"
    
    def to_dict(self):
        """Convert execution to dictionary for API responses."""
        return {
            'id': str(self.id),
            'automation_id': str(self.automation_id),
            'trigger_data': self.trigger_data,
            'action_result': self.action_result,
            'execution_status': self.execution_status,
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() + 'Z' if self.started_at else None,
            'completed_at': self.completed_at.isoformat() + 'Z' if self.completed_at else None,
            'duration_ms': self.duration_ms,
            'tenant_id': str(self.tenant_id),
            'user_id': str(self.user_id) if self.user_id else None,
            'customer_id': str(self.customer_id) if self.customer_id else None,
            'booking_id': str(self.booking_id) if self.booking_id else None,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'created_at': self.created_at.isoformat() + 'Z',
            'updated_at': self.updated_at.isoformat() + 'Z'
        }
