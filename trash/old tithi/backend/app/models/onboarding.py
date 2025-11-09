"""
Onboarding Models

This module contains models for the complete onboarding flow including
business setup, team management, services, availability, and branding.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, Numeric, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel, GlobalModel


class OnboardingStep(str, Enum):
    """Onboarding step enumeration."""
    BUSINESS_INFO = "business_info"
    TEAM_SETUP = "team_setup"
    SERVICES_CATEGORIES = "services_categories"
    AVAILABILITY = "availability"
    NOTIFICATIONS = "notifications"
    POLICIES = "policies"
    GIFT_CARDS = "gift_cards"
    PAYMENT_SETUP = "payment_setup"
    GO_LIVE = "go_live"


class OnboardingProgress(TenantModel):
    """Tracks onboarding progress for each tenant."""
    
    __tablename__ = "onboarding_progress"
    
    # Current step tracking
    current_step = Column(SQLEnum(OnboardingStep), nullable=False, default=OnboardingStep.BUSINESS_INFO)
    completed_steps = Column(JSON, default=[])  # Array of completed steps
    step_data = Column(JSON, default={})  # Data collected in each step
    
    # Progress tracking
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime)
    last_activity_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="onboarding_progress")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", name="uq_onboarding_progress_tenant"),
    )


class ServiceCategory(TenantModel):
    """Service category model for organizing services."""
    
    __tablename__ = "service_categories"
    
    # Core category fields
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(7))  # Hex color code
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="service_categories")
    services = relationship("Service", back_populates="category")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_category_color_hex"),
    )


class TeamMember(TenantModel):
    """Enhanced team member model for staff management."""
    
    __tablename__ = "team_members"
    
    # Core team member fields
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    role = Column(String(50), nullable=False)  # owner, admin, staff
    bio = Column(Text)
    specialties = Column(JSON, default=[])  # Array of specialties
    hourly_rate_cents = Column(Integer)
    
    # Status and permissions
    is_active = Column(Boolean, nullable=False, default=True)
    permissions_json = Column(JSON, default={})
    
    # Profile information
    profile_image_url = Column(String(500))
    display_name = Column(String(255))
    
    # Availability settings
    max_concurrent_bookings = Column(Integer, default=1)
    buffer_time_minutes = Column(Integer, default=0)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="team_members")
    availability = relationship("TeamMemberAvailability", back_populates="team_member")
    service_assignments = relationship("ServiceTeamAssignment", back_populates="team_member")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("hourly_rate_cents IS NULL OR hourly_rate_cents >= 0", name="ck_team_member_rate_non_negative"),
        CheckConstraint("max_concurrent_bookings > 0", name="ck_team_member_max_bookings_positive"),
        CheckConstraint("buffer_time_minutes >= 0", name="ck_team_member_buffer_non_negative"),
        CheckConstraint("role IN ('owner', 'admin', 'staff')", name="ck_team_member_role"),
    )


class TeamMemberAvailability(TenantModel):
    """Team member availability for specific time slots."""
    
    __tablename__ = "team_member_availability"
    
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    
    # Time slot information
    day_of_week = Column(Integer, nullable=False)  # 1=Monday, 7=Sunday
    start_time = Column(String(5), nullable=False)  # HH:MM format
    end_time = Column(String(5), nullable=False)  # HH:MM format
    
    # Availability settings
    is_available = Column(Boolean, nullable=False, default=True)
    max_bookings = Column(Integer, default=1)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    team_member = relationship("TeamMember", back_populates="availability")
    service = relationship("Service")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="ck_availability_day_of_week"),
        CheckConstraint("start_time ~ '^[0-2][0-9]:[0-5][0-9]$'", name="ck_availability_start_time_format"),
        CheckConstraint("end_time ~ '^[0-2][0-9]:[0-5][0-9]$'", name="ck_availability_end_time_format"),
        CheckConstraint("max_bookings > 0", name="ck_availability_max_bookings_positive"),
        UniqueConstraint("tenant_id", "team_member_id", "service_id", "day_of_week", "start_time", name="uq_team_member_availability"),
    )


class ServiceTeamAssignment(TenantModel):
    """Assignment of team members to specific services."""
    
    __tablename__ = "service_team_assignments"
    
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    
    # Assignment settings
    is_primary = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    service = relationship("Service")
    team_member = relationship("TeamMember", back_populates="service_assignments")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "service_id", "team_member_id", name="uq_service_team_assignment"),
    )


class BusinessBranding(TenantModel):
    """Business branding and customization settings."""
    
    __tablename__ = "business_branding"
    
    # Branding fields
    primary_color = Column(String(7))  # Hex color
    secondary_color = Column(String(7))  # Hex color
    accent_color = Column(String(7))  # Hex color
    logo_url = Column(String(500))
    favicon_url = Column(String(500))
    
    # Typography
    font_family = Column(String(100))
    font_size = Column(String(20))
    font_weight = Column(String(20))
    
    # Layout and styling
    layout_style = Column(String(50), default="modern")  # modern, classic, minimal
    button_style = Column(String(50), default="rounded")  # rounded, square, pill
    color_scheme = Column(String(50), default="light")  # light, dark, auto
    
    # Custom CSS
    custom_css = Column(Text)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="business_branding")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_branding_primary_color"),
        CheckConstraint("secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_branding_secondary_color"),
        CheckConstraint("accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'", name="ck_branding_accent_color"),
        CheckConstraint("layout_style IN ('modern', 'classic', 'minimal')", name="ck_branding_layout_style"),
        CheckConstraint("button_style IN ('rounded', 'square', 'pill')", name="ck_branding_button_style"),
        CheckConstraint("color_scheme IN ('light', 'dark', 'auto')", name="ck_branding_color_scheme"),
        UniqueConstraint("tenant_id", name="uq_business_branding_tenant"),
    )


class BusinessPolicy(TenantModel):
    """Business policies and terms."""
    
    __tablename__ = "business_policies"
    
    # Policy fields
    cancellation_policy = Column(Text)
    no_show_policy = Column(Text)
    no_show_fee_percent = Column(Numeric(5, 2), default=3.00)
    no_show_fee_flat_cents = Column(Integer)
    refund_policy = Column(Text)
    cash_payment_policy = Column(Text)
    
    # Policy settings
    cancellation_hours_required = Column(Integer, default=24)
    no_show_fee_type = Column(String(20), default="percentage")  # percentage, flat
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="business_policies")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("no_show_fee_percent IS NULL OR (no_show_fee_percent >= 0 AND no_show_fee_percent <= 100)", name="ck_policy_no_show_fee_percent"),
        CheckConstraint("no_show_fee_flat_cents IS NULL OR no_show_fee_flat_cents >= 0", name="ck_policy_no_show_fee_flat"),
        CheckConstraint("cancellation_hours_required >= 0", name="ck_policy_cancellation_hours"),
        CheckConstraint("no_show_fee_type IN ('percentage', 'flat')", name="ck_policy_no_show_fee_type"),
        UniqueConstraint("tenant_id", name="uq_business_policies_tenant"),
    )


class GiftCardTemplate(TenantModel):
    """Gift card templates for creating gift cards."""
    
    __tablename__ = "gift_card_templates"
    
    # Template fields
    name = Column(String(255), nullable=False)
    description = Column(Text)
    amount_cents = Column(Integer)  # Fixed amount
    percentage_discount = Column(Integer)  # Percentage discount
    is_percentage = Column(Boolean, nullable=False, default=False)
    
    # Validity settings
    expires_days = Column(Integer, default=365)  # Days until expiration
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Usage settings
    usage_limit = Column(Integer)  # NULL = unlimited
    usage_count = Column(Integer, nullable=False, default=0)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="gift_card_templates")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("amount_cents IS NULL OR amount_cents > 0", name="ck_gift_card_template_amount"),
        CheckConstraint("percentage_discount IS NULL OR (percentage_discount BETWEEN 1 AND 100)", name="ck_gift_card_template_percentage"),
        CheckConstraint("(is_percentage = true AND percentage_discount IS NOT NULL AND amount_cents IS NULL) OR (is_percentage = false AND amount_cents IS NOT NULL AND percentage_discount IS NULL)", name="ck_gift_card_template_discount_type"),
        CheckConstraint("expires_days > 0", name="ck_gift_card_template_expires_days"),
        CheckConstraint("usage_limit IS NULL OR usage_limit > 0", name="ck_gift_card_template_usage_limit"),
        CheckConstraint("usage_count >= 0", name="ck_gift_card_template_usage_count"),
    )


class OnboardingChecklist(TenantModel):
    """Onboarding checklist items for tracking completion."""
    
    __tablename__ = "onboarding_checklist"
    
    # Checklist item
    item_name = Column(String(255), nullable=False)
    description = Column(Text)
    step = Column(SQLEnum(OnboardingStep), nullable=False)
    
    # Completion tracking
    is_completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime)
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Priority and ordering
    priority = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="onboarding_checklist")
    completed_by_user = relationship("User")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("priority >= 0", name="ck_checklist_priority"),
        CheckConstraint("sort_order >= 0", name="ck_checklist_sort_order"),
    )
