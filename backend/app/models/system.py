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
    old_values = Column(JSON, default={})
    new_values = Column(JSON, default={})
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    
    # Relationships
    user = relationship("User")


class EventOutbox(TenantModel):
    """Event outbox model for reliable event delivery."""
    
    __tablename__ = "event_outbox"
    
    event_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, sent, failed
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime)
    error_message = Column(Text)
    
    # Constraints
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('pending', 'sent', 'failed')",
            name="ck_event_outbox_status"
        ),
    )
