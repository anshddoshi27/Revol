"""
Core Models

This module contains core business models for tenants, users, and memberships.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, UniqueConstraint, JSON, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db


class BaseModel(db.Model):
    """Base model with common fields."""
    
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class GlobalModel(BaseModel):
    """Global model for entities that exist across all tenants."""
    
    __abstract__ = True


class TenantModel(BaseModel):
    """Tenant-scoped model for entities that belong to a specific tenant."""
    
    __abstract__ = True
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)


class Tenant(GlobalModel):
    """Tenant model representing a business/organization."""
    
    __tablename__ = "tenants"
    
    slug = Column(String(100), unique=True, nullable=False)
    tz = Column(String(50), default="UTC")
    trust_copy_json = Column(JSON, default={})
    is_public_directory = Column(Boolean, default=False)
    public_blurb = Column(Text)
    billing_json = Column(JSON, default={})
    default_no_show_fee_percent = Column(Numeric(5, 2), default=3.00)
    deleted_at = Column(DateTime)
    
    # Additional fields for onboarding
    name = Column(String(255))  # Business name
    email = Column(String(255))  # Business email
    category = Column(String(100))  # Business category
    logo_url = Column(String(500))  # Logo URL
    locale = Column(String(10), default="en_US")  # Locale
    status = Column(String(50), default="active")  # Tenant status
    
    # Relationships
    users = relationship("User", secondary="memberships", back_populates="tenants", foreign_keys="[memberships.c.tenant_id, memberships.c.user_id]")
    customers = relationship("Customer", back_populates="tenant")
    services = relationship("Service", back_populates="tenant")
    resources = relationship("Resource", back_populates="tenant")
    bookings = relationship("Booking", back_populates="tenant")
    themes = relationship("Theme", back_populates="tenant")
    branding = relationship("Branding", back_populates="tenant")


class User(GlobalModel):
    """User model representing an individual user."""
    
    __tablename__ = "users"
    
    display_name = Column(String(255))
    primary_email = Column(String(255), unique=True)
    avatar_url = Column(String(500))
    
    # Relationships
    tenants = relationship("Tenant", secondary="memberships", back_populates="users", foreign_keys="[memberships.c.tenant_id, memberships.c.user_id]")
    memberships = relationship("Membership", back_populates="user", overlaps="tenants,users")


class Membership(TenantModel):
    """Membership model representing user-tenant relationships."""
    
    __tablename__ = "memberships"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(50), nullable=False)  # Should be membership_role enum
    permissions_json = Column(JSON, default={})
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="memberships", overlaps="tenants,users")
    tenant = relationship("Tenant", overlaps="tenants,users")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),
    )
