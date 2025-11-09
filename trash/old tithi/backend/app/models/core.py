"""
Core Models

This module contains core business models for tenants, users, and memberships.
"""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, UniqueConstraint, JSON, Numeric, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db


class MembershipRole(str, Enum):
    """Membership role enumeration."""
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"
    VIEWER = "viewer"


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
    
    # Essential business fields for onboarding
    name = Column(String(255))  # Business name
    email = Column(String(255))  # Business email
    category = Column(String(100))  # Business category
    logo_url = Column(String(500))  # Logo URL
    locale = Column(String(10), default="en_US")  # Locale
    status = Column(String(50), default="onboarding")  # Tenant status: onboarding, ready, active
    
    # Additional business information
    legal_name = Column(String(255))  # Legal business name (DBA)
    phone = Column(String(20))  # Business phone
    subdomain = Column(String(100))  # Custom subdomain
    business_timezone = Column(String(50), default="UTC")  # Business timezone
    
    # Business address and contact information
    address_json = Column(JSON, default={})  # Business address
    social_links_json = Column(JSON, default={})  # Social media links
    branding_json = Column(JSON, default={})  # Branding information (colors, fonts)
    policies_json = Column(JSON, default={})  # Custom policies (not overwritten by defaults)
    
    # Relationships
    users = relationship("User", secondary="memberships", back_populates="tenants", foreign_keys="[memberships.c.tenant_id, memberships.c.user_id]")
    customers = relationship("Customer", back_populates="tenant")
    services = relationship("Service", back_populates="tenant")
    resources = relationship("Resource", back_populates="tenant")
    bookings = relationship("Booking", back_populates="tenant")
    themes = relationship("Theme", back_populates="tenant")
    branding = relationship("Branding", back_populates="tenant")
    automations = relationship("Automation", back_populates="tenant")
    
    # New comprehensive relationships
    team_members = relationship("TeamMember", back_populates="tenant")
    service_categories = relationship("ServiceCategory", back_populates="tenant")
    business_policies = relationship("BusinessPolicy", back_populates="tenant")
    gift_cards = relationship("GiftCard", back_populates="tenant")
    coupons = relationship("Coupon", back_populates="tenant")
    referrals = relationship("Referral", back_populates="tenant")
    notification_templates = relationship("NotificationTemplate", back_populates="tenant")
    business_metrics = relationship("BusinessMetric", back_populates="tenant")
    customer_analytics = relationship("CustomerAnalytics", back_populates="tenant")
    service_analytics = relationship("ServiceAnalytics", back_populates="tenant")
    staff_analytics = relationship("StaffAnalytics", back_populates="tenant")
    revenue_analytics = relationship("RevenueAnalytics", back_populates="tenant")
    dashboard_widgets = relationship("DashboardWidget", back_populates="tenant")
    events = relationship("Event", back_populates="tenant")
    metrics = relationship("Metric", back_populates="tenant")
    
    # Onboarding and booking flow relationships
    onboarding_progress = relationship("OnboardingProgress", back_populates="tenant")
    onboarding_checklist = relationship("OnboardingChecklist", back_populates="tenant")
    business_branding = relationship("BusinessBranding", back_populates="tenant")
    gift_card_templates = relationship("GiftCardTemplate", back_populates="tenant")
    booking_sessions = relationship("BookingSession", back_populates="tenant")
    service_displays = relationship("ServiceDisplay", back_populates="tenant")
    availability_slots = relationship("AvailabilitySlot", back_populates="tenant")
    customer_booking_profiles = relationship("CustomerBookingProfile", back_populates="tenant")
    booking_flow_analytics = relationship("BookingFlowAnalytics", back_populates="tenant")
    booking_flow_configuration = relationship("BookingFlowConfiguration", back_populates="tenant")
    
    # Enhanced notification relationships
    notification_templates_enhanced = relationship("NotificationTemplateEnhanced", back_populates="tenant")
    notification_placeholders = relationship("NotificationPlaceholder", back_populates="tenant")
    notification_queue_enhanced = relationship("NotificationQueueEnhanced", back_populates="tenant")
    notification_automations = relationship("NotificationAutomation", back_populates="tenant")
    notification_analytics = relationship("NotificationAnalytics", back_populates="tenant")


class User(GlobalModel):
    """User model representing an individual user."""
    
    __tablename__ = "users"
    
    display_name = Column(String(255))
    primary_email = Column(String(255), unique=True)
    avatar_url = Column(String(500))
    
    # Auth fields
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255))
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    
    # Relationships
    tenants = relationship("Tenant", secondary="memberships", back_populates="users", foreign_keys="[memberships.c.tenant_id, memberships.c.user_id]")
    memberships = relationship("Membership", back_populates="user", overlaps="tenants,users")
    
    # New comprehensive relationships
    team_members = relationship("TeamMember", back_populates="user")
    dashboard_widgets = relationship("DashboardWidget", back_populates="user")
    events = relationship("Event", back_populates="user")


class Membership(TenantModel):
    """Membership model representing user-tenant relationships."""
    
    __tablename__ = "memberships"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(SQLEnum(MembershipRole), nullable=False)  # membership_role enum
    permissions_json = Column(JSON, default={})
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="memberships", overlaps="tenants,users")
    tenant = relationship("Tenant", overlaps="tenants,users")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),
    )
