"""
Availability Models

This module contains availability-related models for scheduling and resource management.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and migrations 0007_availability.sql.
"""

import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class AvailabilityRule(TenantModel):
    """Availability rule model for recurring availability patterns."""
    
    __tablename__ = "availability_rules"
    
    # Core availability fields
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    dow = Column(Integer, nullable=False)  # Day of week (1=Monday, 7=Sunday)
    start_minute = Column(Integer, nullable=False)  # Minutes from midnight (0-1439)
    end_minute = Column(Integer, nullable=False)  # Minutes from midnight (0-1439)
    
    # Recurring pattern support
    rrule_json = Column(JSON, default={})  # iCalendar RRULE format
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    resource = relationship("Resource")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("dow BETWEEN 1 AND 7", name="ck_availability_rule_dow"),
        CheckConstraint("start_minute BETWEEN 0 AND 1439", name="ck_availability_rule_start_minute"),
        CheckConstraint("end_minute BETWEEN 0 AND 1439", name="ck_availability_rule_end_minute"),
        CheckConstraint("end_minute > start_minute", name="ck_availability_rule_time_order"),
    )


class AvailabilityException(TenantModel):
    """Availability exception model for specific date overrides and closures."""
    
    __tablename__ = "availability_exceptions"
    
    # Core exception fields
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_minute = Column(Integer)  # Minutes from midnight (0-1439), NULL = all day
    end_minute = Column(Integer)  # Minutes from midnight (0-1439), NULL = all day
    start_at = Column(DateTime)  # Specific datetime override
    end_at = Column(DateTime)  # Specific datetime override
    closed = Column(Boolean, nullable=False, default=True)
    
    # Exception details
    source = Column(String(50), nullable=False, default="manual")  # manual, holiday, maintenance, etc.
    description = Column(Text)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    resource = relationship("Resource")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("start_minute IS NULL OR (start_minute BETWEEN 0 AND 1439)", name="ck_availability_exception_start_minute"),
        CheckConstraint("end_minute IS NULL OR (end_minute BETWEEN 0 AND 1439)", name="ck_availability_exception_end_minute"),
        CheckConstraint("start_minute IS NULL OR end_minute IS NULL OR end_minute > start_minute", name="ck_availability_exception_time_order"),
        CheckConstraint("start_at IS NULL OR end_at IS NULL OR end_at > start_at", name="ck_availability_exception_datetime_order"),
        UniqueConstraint("tenant_id", "resource_id", "date", name="uq_availability_exception_resource_date"),
    )
