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


# Note: AuditLog and EventOutbox models are defined in audit.py
# to avoid SQLAlchemy table definition conflicts


# Note: WebhookEventInbox model is defined in audit.py
# to avoid SQLAlchemy table definition conflicts
