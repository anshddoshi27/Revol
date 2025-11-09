"""
Usage Models

This module contains usage tracking and quota management models.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and migrations 0012_usage_quotas.sql.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class UsageCounter(TenantModel):
    """Usage counter model for tracking tenant usage against quotas."""
    
    __tablename__ = "usage_counters"
    
    # Core usage fields
    quota_code = Column(String(100), nullable=False)
    counter_value = Column(Integer, nullable=False, default=0)
    reset_period = Column(String(20), nullable=False, default="monthly")  # daily, weekly, monthly, yearly
    reset_date = Column(DateTime, nullable=False)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Constraints
    __table_args__ = (
        CheckConstraint("counter_value >= 0", name="ck_usage_counter_value"),
        CheckConstraint("reset_period IN ('daily', 'weekly', 'monthly', 'yearly')", name="ck_usage_counter_reset_period"),
        UniqueConstraint("tenant_id", "quota_code", name="uq_usage_counter_tenant_quota"),
    )


class Quota(TenantModel):
    """Quota model for defining tenant usage limits."""
    
    __tablename__ = "quotas"
    
    # Core quota fields
    quota_code = Column(String(100), nullable=False)
    quota_name = Column(String(255), nullable=False)
    description = Column(Text)
    limit_value = Column(Integer, nullable=False)
    limit_type = Column(String(20), nullable=False, default="count")  # count, amount_cents, duration_minutes
    reset_period = Column(String(20), nullable=False, default="monthly")  # daily, weekly, monthly, yearly
    
    # Enforcement settings
    is_enforced = Column(Boolean, nullable=False, default=True)
    is_hard_limit = Column(Boolean, nullable=False, default=True)  # True = hard stop, False = soft warning
    grace_period_days = Column(Integer, nullable=False, default=0)
    
    # Status
    active = Column(Boolean, nullable=False, default=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Constraints
    __table_args__ = (
        CheckConstraint("limit_value > 0", name="ck_quota_limit_value"),
        CheckConstraint("limit_type IN ('count', 'amount_cents', 'duration_minutes')", name="ck_quota_limit_type"),
        CheckConstraint("reset_period IN ('daily', 'weekly', 'monthly', 'yearly')", name="ck_quota_reset_period"),
        CheckConstraint("grace_period_days >= 0", name="ck_quota_grace_period"),
        UniqueConstraint("tenant_id", "quota_code", name="uq_quota_tenant_code"),
    )
