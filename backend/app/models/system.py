"""
System Models

This module contains system-related models for themes, branding, configuration,
audit logging, and event outbox.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class Theme(TenantModel):
    """Theme model representing a tenant's theme configuration."""
    
    __tablename__ = "themes"
    
    brand_color = Column(String(7))  # Hex color
    logo_url = Column(String(500))
    theme_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="themes")


class Branding(TenantModel):
    """Branding model representing a tenant's branding configuration."""
    
    __tablename__ = "branding"
    
    logo_url = Column(String(500))
    primary_color = Column(String(7))  # Hex color
    secondary_color = Column(String(7))  # Hex color
    font_family = Column(String(100))
    custom_css = Column(Text)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="branding")


class AuditLog(TenantModel):
    """Audit log model for tracking all changes to entities."""
    
    __tablename__ = "audit_logs"
    
    table_name = Column(String(100), nullable=False)
    record_id = Column(UUID(as_uuid=True), nullable=False)
    operation = Column(String(20), nullable=False)  # CREATE, UPDATE, DELETE
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    old_data = Column(JSON, default={})
    new_data = Column(JSON, default={})
    # ip_address = Column(String(45))  # Not in DB schema
    # user_agent = Column(String(500))  # Not in DB schema
    
    # Relationships
    user = relationship("User")


class EventOutbox(TenantModel):
    """Event outbox model for reliable event delivery."""
    
    __tablename__ = "events_outbox"
    
    # Canonical schema alignment with DB (0013_audit_logs.sql)
    event_code = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False, default={})
    status = Column(String(20), nullable=False, default="ready")  # ready, delivered, failed
    ready_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    delivered_at = Column(DateTime)
    failed_at = Column(DateTime)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    last_attempt_at = Column(DateTime)
    error_message = Column(Text)
    key = Column(String(255))
    metadata_json = Column("metadata", JSON, default={})
    
    # Constraints
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('ready', 'delivered', 'failed')",
            name="ck_events_outbox_status"
        ),
    )

    # Deprecated compatibility aliases for simple test expectations
    @property
    def event_type(self):  # for legacy tests
        return self.event_code

    @property
    def retry_count(self):  # maps to attempts
        return self.attempts

    @property
    def max_retries(self):  # maps to max_attempts
        return self.max_attempts

    @property
    def next_retry_at(self):  # maps to ready_at
        return self.ready_at


class WebhookEventInbox(db.Model):
    """Inbox for inbound webhook events with idempotency via composite PK."""
    
    __tablename__ = "webhook_events_inbox"
    
    provider = Column(String(100), primary_key=True, nullable=False)
    id = Column(String(255), primary_key=True, nullable=False)
    payload = Column(JSON, nullable=False, default={})
    processed_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
