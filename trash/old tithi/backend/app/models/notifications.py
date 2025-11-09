"""
Notification System Models

This module contains models for notification templates, placeholders, and automated messaging.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class NotificationTemplate(TenantModel):
    """Notification template model for automated messaging."""
    
    __tablename__ = "notification_templates"
    
    name = Column(String(255), nullable=False)
    channel = Column(String(20), nullable=False)  # email, sms, push
    category = Column(String(50), nullable=False)  # confirmation, reminder, follow_up, cancellation, reschedule
    trigger_event = Column(String(50), nullable=False)  # booking_created, booking_confirmed, 24h_reminder, 1h_reminder, etc.
    subject = Column(String(255))  # For email notifications
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="notification_templates")
    placeholders = relationship("NotificationPlaceholder", back_populates="template", cascade="all, delete-orphan")
    logs = relationship("NotificationLog", back_populates="template", cascade="all, delete-orphan")


class NotificationPlaceholder(TenantModel):
    """Notification placeholder model for dynamic content."""
    
    __tablename__ = "notification_placeholders"
    
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates.id"), nullable=False)
    placeholder_name = Column(String(100), nullable=False)  # customer_name, service_name, booking_date, etc.
    placeholder_value = Column(Text)  # The actual value when notification is sent
    
    # Relationships
    template = relationship("NotificationTemplate", back_populates="placeholders")


class NotificationLog(TenantModel):
    """Notification log model for tracking sent notifications."""
    
    __tablename__ = "notification_logs"
    
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    channel = Column(String(20), nullable=False)
    recipient = Column(String(255), nullable=False)  # email or phone
    subject = Column(String(255))
    content = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, sent, delivered, failed
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    error_message = Column(Text)
    
    # Relationships
    template = relationship("NotificationTemplate", back_populates="logs")
    customer = relationship("Customer", back_populates="notification_logs")
    booking = relationship("Booking", back_populates="notification_logs")


class NotificationPreference(TenantModel):
    """Customer notification preferences."""
    
    __tablename__ = "notification_preferences"
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    channel = Column(String(20), nullable=False)  # email, sms, push
    is_enabled = Column(Boolean, nullable=False, default=True)
    opt_in_date = Column(DateTime, default=datetime.utcnow)
    opt_out_date = Column(DateTime)
    
    # Relationships
    customer = relationship("Customer", back_populates="notification_preferences")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('customer_id', 'channel', name='unique_customer_channel_preference'),
    )


class NotificationQueue(TenantModel):
    """Notification queue model for processing notifications."""
    
    __tablename__ = "notification_queue"
    
    template_id = Column(UUID(as_uuid=True), ForeignKey("notification_templates.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    scheduled_for = Column(DateTime, nullable=False)
    priority = Column(Integer, default=0)  # Higher number = higher priority
    status = Column(String(20), nullable=False, default="queued")  # queued, processing, sent, failed
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    processed_at = Column(DateTime)
    
    # Relationships
    template = relationship("NotificationTemplate")
    customer = relationship("Customer")
    booking = relationship("Booking")


