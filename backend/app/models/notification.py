"""
Notification Models

This module contains notification-related models for SMS, email, and push notifications.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and Design Brief Module J.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum

from ..extensions import db
from .core import TenantModel


class NotificationChannel(str, Enum):
    """Notification channel types."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBHOOK = "webhook"


class NotificationStatus(str, Enum):
    """Notification status types."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    BOUNCED = "bounced"
    COMPLAINED = "complained"


class NotificationPriority(str, Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationTemplate(TenantModel):
    """Notification template model for reusable message templates."""
    
    __tablename__ = "notification_templates"
    
    # Core template fields
    name = Column(String(255), nullable=False)
    description = Column(Text)
    channel = Column(SQLEnum(NotificationChannel), nullable=False)
    subject = Column(String(500))  # For email notifications
    content = Column(Text, nullable=False)  # Template content with placeholders (standardized from body)
    content_type = Column(String(50), default="text/plain")  # text/plain, text/html, etc.
    
    # Template variables
    variables = Column(JSON, default={})  # Available template variables
    required_variables = Column(JSON, default=[])  # Required variables for this template
    
    # Usage context - standardized field names
    trigger_event = Column(String(100))  # Event that triggers this template (standardized from event_code)
    category = Column(String(100))  # Template category (booking, payment, etc.)
    
    # Status and settings
    is_active = Column(Boolean, nullable=False, default=True)
    is_system = Column(Boolean, nullable=False, default=False)  # System vs user-created templates
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    # Note: No direct notification relationship in DB schema
    
    # Constraints
    __table_args__ = (
        CheckConstraint("content_type IN ('text/plain', 'text/html', 'application/json')", name="ck_template_content_type"),
    )


class Notification(TenantModel):
    """Notification model for individual notification instances."""
    
    __tablename__ = "notifications"
    
    # Core notification fields
    event_code = Column(String(100), nullable=False)  # Event that triggers this notification
    channel = Column(SQLEnum(NotificationChannel), nullable=False)
    status = Column(SQLEnum(NotificationStatus), default=NotificationStatus.PENDING)
    
    # Recipient fields (matches DB schema)
    to_email = Column(String(255), nullable=True)
    to_phone = Column(String(20), nullable=True)
    target_json = Column(JSON, default={})  # Additional recipient data
    
    # Message content
    subject = Column(String(500))
    body = Column(Text, nullable=False)  # Message content (matches DB)
    content_type = Column(String(50), default="text/plain")
    
    # Delivery settings
    priority = Column(SQLEnum(NotificationPriority), default=NotificationPriority.NORMAL)
    scheduled_at = Column(DateTime, nullable=False, default=datetime.utcnow)  # For scheduled notifications
    expires_at = Column(DateTime, nullable=True)  # For expiring notifications
    
    # Status tracking (matches DB schema)
    sent_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    last_attempt_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    dedupe_key = Column(String(255), nullable=True)  # Deduplication key
    
    # Provider integration (matches DB schema)
    provider_message_id = Column(String(255), nullable=True)
    provider_metadata = Column(JSON, default={})
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    # Note: No direct template relationship in DB schema
    # booking = relationship("Booking")
    # payment = relationship("Payment")
    # customer = relationship("Customer")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="ck_notification_attempts_non_negative"),
        CheckConstraint("max_attempts > 0", name="ck_notification_max_attempts_positive"),
        CheckConstraint("attempts <= max_attempts", name="ck_notification_attempts_lte_max"),
        # Note: scheduled_at constraint removed for SQLite compatibility
        # In production with PostgreSQL, this would be: scheduled_at <= now() + interval '1 year'
    )


class NotificationPreference(TenantModel):
    """Notification preference model for user notification settings."""
    
    __tablename__ = "notification_preferences"
    
    # User identification
    user_type = Column(String(50), nullable=False)  # customer, staff, admin
    user_id = Column(UUID(as_uuid=True), nullable=False)
    
    # Channel preferences
    email_enabled = Column(Boolean, nullable=False, default=True)
    sms_enabled = Column(Boolean, nullable=False, default=True)
    push_enabled = Column(Boolean, nullable=False, default=True)
    
    # Category preferences
    booking_notifications = Column(Boolean, nullable=False, default=True)
    payment_notifications = Column(Boolean, nullable=False, default=True)
    promotion_notifications = Column(Boolean, nullable=False, default=True)
    system_notifications = Column(Boolean, nullable=False, default=True)
    marketing_notifications = Column(Boolean, nullable=False, default=False)
    
    # Frequency preferences
    digest_frequency = Column(String(20), default="immediate")  # immediate, daily, weekly, never
    quiet_hours_start = Column(String(5), nullable=True)  # HH:MM format
    quiet_hours_end = Column(String(5), nullable=True)  # HH:MM format
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Constraints
    __table_args__ = (
        CheckConstraint("user_type IN ('customer', 'staff', 'admin')", name="ck_preference_user_type"),
        CheckConstraint("digest_frequency IN ('immediate', 'daily', 'weekly', 'never')", name="ck_preference_digest_frequency"),
        # Note: Regex constraints removed for SQLite compatibility
        # quiet_hours_start and quiet_hours_end should be validated at application level
        UniqueConstraint("user_type", "user_id", "tenant_id", name="uq_preference_user_tenant"),
    )


class NotificationLog(TenantModel):
    """Notification log model for tracking notification events and analytics."""
    
    __tablename__ = "notification_logs"
    
    # Core log fields
    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # sent, delivered, failed, bounced, etc.
    event_timestamp = Column(DateTime, nullable=False, default=func.now())
    
    # Event details
    event_data = Column(JSON, default={})
    error_message = Column(Text, nullable=True)
    
    # Provider details
    provider = Column(String(50), nullable=True)
    provider_event_id = Column(String(255), nullable=True)
    provider_response = Column(JSON, default={})
    
    # Relationships
    notification = relationship("Notification")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("event_type IN ('sent', 'delivered', 'failed', 'bounced', 'complained', 'opened', 'clicked')", 
                       name="ck_log_event_type"),
    )


class NotificationQueue(TenantModel):
    """Notification queue model for managing notification processing queue."""
    
    __tablename__ = "notification_queue"
    
    # Queue fields
    notification_id = Column(UUID(as_uuid=True), ForeignKey("notifications.id"), nullable=False)
    priority = Column(SQLEnum(NotificationPriority), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    processing_started_at = Column(DateTime, nullable=True)
    processing_completed_at = Column(DateTime, nullable=True)
    
    # Processing status
    status = Column(String(20), nullable=False, default="queued")  # queued, processing, completed, failed
    worker_id = Column(String(100), nullable=True)  # ID of the worker processing this item
    error_message = Column(Text, nullable=True)
    
    # Retry settings
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    notification = relationship("Notification")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('queued', 'processing', 'completed', 'failed')", name="ck_queue_status"),
        CheckConstraint("retry_count >= 0", name="ck_queue_retry_count"),
        CheckConstraint("max_retries >= 0", name="ck_queue_max_retries"),
        CheckConstraint("scheduled_at >= created_at", name="ck_queue_scheduled_future"),
    )
