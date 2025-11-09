"""
Enhanced Notification Models

This module contains enhanced notification models with proper placeholder
management and template system for the Tithi platform.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, UniqueConstraint, Enum as SQLEnum, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel, GlobalModel


class NotificationTrigger(str, Enum):
    """Notification trigger enumeration."""
    BOOKING_CREATED = "booking_created"
    BOOKING_CONFIRMED = "booking_confirmed"
    BOOKING_CANCELLED = "booking_cancelled"
    BOOKING_RESCHEDULED = "booking_rescheduled"
    BOOKING_COMPLETED = "booking_completed"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_FAILED = "payment_failed"
    REMINDER_24_HOUR = "reminder_24_hour"
    REMINDER_1_HOUR = "reminder_1_hour"
    NO_SHOW = "no_show"
    FOLLOW_UP = "follow_up"


class NotificationCategory(str, Enum):
    """Notification category enumeration."""
    CONFIRMATION = "confirmation"
    REMINDER = "reminder"
    FOLLOW_UP = "follow_up"
    CANCELLATION = "cancellation"
    RESCHEDULE = "reschedule"
    PAYMENT = "payment"
    MARKETING = "marketing"
    SYSTEM = "system"


class NotificationTemplateEnhanced(TenantModel):
    """Enhanced notification template with placeholder management."""
    
    __tablename__ = "notification_templates_enhanced"
    
    # Core template fields
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_event = Column(SQLEnum(NotificationTrigger), nullable=False)
    category = Column(SQLEnum(NotificationCategory), nullable=False)
    
    # Template content
    subject_template = Column(String(500))  # Email subject template
    content_template = Column(Text, nullable=False)  # Message content template
    content_type = Column(String(50), default="text/plain")  # text/plain, text/html
    
    # Placeholder management
    available_placeholders = Column(JSON, default=[])  # List of available placeholders
    required_placeholders = Column(JSON, default=[])  # List of required placeholders
    placeholder_examples = Column(JSON, default={})  # Examples for each placeholder
    
    # Template settings
    is_active = Column(Boolean, nullable=False, default=True)
    is_system_template = Column(Boolean, nullable=False, default=False)
    priority = Column(Integer, default=0)  # Higher number = higher priority
    
    # Timing settings
    send_immediately = Column(Boolean, nullable=False, default=True)
    delay_minutes = Column(Integer, default=0)  # Delay before sending
    send_time_hour = Column(Integer)  # Hour of day to send (0-23)
    send_time_minute = Column(Integer)  # Minute of hour to send (0-59)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_templates_enhanced")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("content_type IN ('text/plain', 'text/html', 'application/json')", name="ck_template_enhanced_content_type"),
        CheckConstraint("priority >= 0", name="ck_template_enhanced_priority"),
        CheckConstraint("delay_minutes >= 0", name="ck_template_enhanced_delay"),
        CheckConstraint("send_time_hour IS NULL OR (send_time_hour >= 0 AND send_time_hour <= 23)", name="ck_template_enhanced_send_hour"),
        CheckConstraint("send_time_minute IS NULL OR (send_time_minute >= 0 AND send_time_minute <= 59)", name="ck_template_enhanced_send_minute"),
    )


class NotificationPlaceholder(TenantModel):
    """Available placeholders for notification templates."""
    
    __tablename__ = "notification_placeholders"
    
    # Placeholder definition
    placeholder_name = Column(String(100), nullable=False)  # e.g., "CUSTOMER_NAME"
    display_name = Column(String(255), nullable=False)  # e.g., "Customer Name"
    description = Column(Text)
    
    # Placeholder type and source
    placeholder_type = Column(String(50), nullable=False)  # customer, booking, service, business, system
    data_source = Column(String(100), nullable=False)  # Where to get the data from
    data_field = Column(String(100), nullable=False)  # Which field to use
    
    # Formatting options
    format_string = Column(String(100))  # Python format string for the value
    default_value = Column(String(255))  # Default value if not available
    is_required = Column(Boolean, nullable=False, default=False)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_placeholders")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("placeholder_type IN ('customer', 'booking', 'service', 'business', 'system')", name="ck_placeholder_type"),
        CheckConstraint("usage_count >= 0", name="ck_placeholder_usage_count"),
        UniqueConstraint("tenant_id", "placeholder_name", name="uq_notification_placeholder_name"),
    )


class NotificationQueueEnhanced(TenantModel):
    """Enhanced notification queue with better processing."""
    
    __tablename__ = "notification_queue_enhanced"
    
    # Notification details
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates_enhanced.id"), nullable=False)
    trigger_event = Column(SQLEnum(NotificationTrigger), nullable=False)
    category = Column(SQLEnum(NotificationCategory), nullable=False)
    
    # Recipient information
    recipient_email = Column(String(255))
    recipient_phone = Column(String(20))
    recipient_name = Column(String(255))
    
    # Message content (processed with placeholders)
    subject = Column(String(500))
    content = Column(Text, nullable=False)
    content_type = Column(String(50), default="text/plain")
    
    # Placeholder data
    placeholder_data = Column(JSON, default={})  # Data used to fill placeholders
    
    # Scheduling
    scheduled_at = Column(DateTime, nullable=False)
    priority = Column(Integer, default=0)
    
    # Processing status
    status = Column(String(20), nullable=False, default="pending")  # pending, processing, sent, failed, cancelled
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    last_attempt_at = Column(DateTime)
    error_message = Column(Text)
    
    # Delivery tracking
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    opened_at = Column(DateTime)
    clicked_at = Column(DateTime)
    
    # Provider information
    provider = Column(String(50), default="internal")  # internal, twilio, sendgrid, etc.
    provider_message_id = Column(String(255))
    provider_response = Column(JSON, default={})
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_queue_enhanced")
    template = relationship("NotificationTemplateEnhanced")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')", name="ck_queue_enhanced_status"),
        CheckConstraint("attempts >= 0", name="ck_queue_enhanced_attempts"),
        CheckConstraint("max_attempts > 0", name="ck_queue_enhanced_max_attempts"),
        CheckConstraint("attempts <= max_attempts", name="ck_queue_enhanced_attempts_lte_max"),
        CheckConstraint("priority >= 0", name="ck_queue_enhanced_priority"),
        CheckConstraint("content_type IN ('text/plain', 'text/html', 'application/json')", name="ck_queue_enhanced_content_type"),
    )


class NotificationAutomation(TenantModel):
    """Automation rules for notification sending."""
    
    __tablename__ = "notification_automations"
    
    # Automation definition
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_event = Column(SQLEnum(NotificationTrigger), nullable=False)
    category = Column(SQLEnum(NotificationCategory), nullable=False)
    
    # Template assignment
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates_enhanced.id"), nullable=False)
    
    # Automation settings
    is_active = Column(Boolean, nullable=False, default=True)
    send_immediately = Column(Boolean, nullable=False, default=True)
    delay_minutes = Column(Integer, default=0)
    send_time_hour = Column(Integer)
    send_time_minute = Column(Integer)
    
    # Conditions
    conditions_json = Column(JSON, default={})  # Conditions for sending
    recipient_filters_json = Column(JSON, default={})  # Who should receive this
    
    # Usage tracking
    total_sent = Column(Integer, default=0)
    last_sent_at = Column(DateTime)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_automations")
    template = relationship("NotificationTemplateEnhanced")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("delay_minutes >= 0", name="ck_automation_delay"),
        CheckConstraint("send_time_hour IS NULL OR (send_time_hour >= 0 AND send_time_hour <= 23)", name="ck_automation_send_hour"),
        CheckConstraint("send_time_minute IS NULL OR (send_time_minute >= 0 AND send_time_minute <= 59)", name="ck_automation_send_minute"),
        CheckConstraint("total_sent >= 0", name="ck_automation_total_sent"),
    )


class NotificationAnalytics(TenantModel):
    """Analytics for notification performance."""
    
    __tablename__ = "notification_analytics"
    
    # Period information
    date = Column(DateTime, nullable=False)
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    
    # Template performance
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates_enhanced.id"))
    trigger_event = Column(SQLEnum(NotificationTrigger))
    category = Column(SQLEnum(NotificationCategory))
    
    # Volume metrics
    total_sent = Column(Integer, default=0)
    total_delivered = Column(Integer, default=0)
    total_opened = Column(Integer, default=0)
    total_clicked = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    
    # Performance metrics
    delivery_rate = Column(Numeric(5, 2), default=0.00)
    open_rate = Column(Numeric(5, 2), default=0.00)
    click_rate = Column(Numeric(5, 2), default=0.00)
    failure_rate = Column(Numeric(5, 2), default=0.00)
    
    # Channel breakdown
    email_sent = Column(Integer, default=0)
    sms_sent = Column(Integer, default=0)
    push_sent = Column(Integer, default=0)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_analytics")
    template = relationship("NotificationTemplateEnhanced")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("period_type IN ('daily', 'weekly', 'monthly')", name="ck_notification_analytics_period"),
        CheckConstraint("total_sent >= 0", name="ck_notification_analytics_total_sent"),
        CheckConstraint("total_delivered >= 0", name="ck_notification_analytics_total_delivered"),
        CheckConstraint("total_opened >= 0", name="ck_notification_analytics_total_opened"),
        CheckConstraint("total_clicked >= 0", name="ck_notification_analytics_total_clicked"),
        CheckConstraint("total_failed >= 0", name="ck_notification_analytics_total_failed"),
        CheckConstraint("delivery_rate >= 0 AND delivery_rate <= 100", name="ck_notification_analytics_delivery_rate"),
        CheckConstraint("open_rate >= 0 AND open_rate <= 100", name="ck_notification_analytics_open_rate"),
        CheckConstraint("click_rate >= 0 AND click_rate <= 100", name="ck_notification_analytics_click_rate"),
        CheckConstraint("failure_rate >= 0 AND failure_rate <= 100", name="ck_notification_analytics_failure_rate"),
        CheckConstraint("email_sent >= 0", name="ck_notification_analytics_email_sent"),
        CheckConstraint("sms_sent >= 0", name="ck_notification_analytics_sms_sent"),
        CheckConstraint("push_sent >= 0", name="ck_notification_analytics_push_sent"),
        UniqueConstraint("tenant_id", "date", "period_type", "template_id", name="uq_notification_analytics_period"),
    )
