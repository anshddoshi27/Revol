"""
Analytics Models

This module contains analytics-related models for events and metrics.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class Event(TenantModel):
    """Event model representing a tracked event."""
    
    __tablename__ = "events"
    
    event_type = Column(String(100), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    properties = Column(JSON)
    
    # Relationships
    user = relationship("User")


class Metric(TenantModel):
    """Metric model representing a calculated metric."""
    
    __tablename__ = "metrics"
    
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Integer, nullable=False)
    metric_date = Column(DateTime, nullable=False)
    dimensions = Column(JSON)
    
    # Relationships
    tenant = relationship("Tenant")
