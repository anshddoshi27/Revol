"""
Booking Flow Models

This module contains models for the complete booking flow including
service selection, availability, customer data collection, and confirmation.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, Numeric, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel, GlobalModel


class BookingFlowStep(str, Enum):
    """Booking flow step enumeration."""
    SERVICE_SELECTION = "service_selection"
    TIME_SELECTION = "time_selection"
    CUSTOMER_INFO = "customer_info"
    PAYMENT = "payment"
    CONFIRMATION = "confirmation"


class BookingSession(TenantModel):
    """Tracks a customer's booking session through the flow."""
    
    __tablename__ = "booking_sessions"
    
    # Session tracking
    session_id = Column(String(255), nullable=False, unique=True)
    current_step = Column(SQLEnum(BookingFlowStep), nullable=False, default=BookingFlowStep.SERVICE_SELECTION)
    
    # Customer information (collected during flow)
    customer_email = Column(String(255))
    customer_phone = Column(String(20))
    customer_first_name = Column(String(100))
    customer_last_name = Column(String(100))
    
    # Selected service and time
    selected_service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"))
    selected_team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"))
    selected_start_time = Column(DateTime)
    selected_end_time = Column(DateTime)
    
    # Flow data
    flow_data = Column(JSON, default={})  # All data collected during flow
    special_requests = Column(Text)
    
    # Session management
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_activity_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_completed = Column(Boolean, nullable=False, default=False)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="booking_sessions")
    selected_service = relationship("Service")
    selected_team_member = relationship("TeamMember")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("expires_at > started_at", name="ck_booking_session_expires_after_start"),
        CheckConstraint("selected_start_time IS NULL OR selected_end_time IS NULL OR selected_end_time > selected_start_time", name="ck_booking_session_time_order"),
    )


class ServiceDisplay(TenantModel):
    """Service display configuration for booking flow."""
    
    __tablename__ = "service_displays"
    
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    
    # Display settings
    show_in_booking_flow = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, default=0)
    featured = Column(Boolean, nullable=False, default=False)
    
    # Display information
    display_name = Column(String(255))  # Override service name for display
    short_description = Column(Text)  # Short description for cards
    display_image_url = Column(String(500))
    
    # Booking settings
    requires_team_member_selection = Column(Boolean, nullable=False, default=True)
    allow_group_booking = Column(Boolean, nullable=False, default=False)
    max_group_size = Column(Integer, default=1)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="service_displays")
    service = relationship("Service")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("display_order >= 0", name="ck_service_display_order"),
        CheckConstraint("max_group_size > 0", name="ck_service_display_max_group_size"),
        UniqueConstraint("tenant_id", "service_id", name="uq_service_display_service"),
    )


class AvailabilitySlot(TenantModel):
    """Available time slots for booking."""
    
    __tablename__ = "availability_slots"
    
    # Slot identification
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    
    # Time information
    date = Column(DateTime, nullable=False)  # Date of the slot
    start_time = Column(DateTime, nullable=False)  # Start time of the slot
    end_time = Column(DateTime, nullable=False)  # End time of the slot
    
    # Availability status
    is_available = Column(Boolean, nullable=False, default=True)
    is_booked = Column(Boolean, nullable=False, default=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"))
    
    # Slot settings
    max_bookings = Column(Integer, default=1)
    current_bookings = Column(Integer, default=0)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="availability_slots")
    service = relationship("Service")
    team_member = relationship("TeamMember")
    booking = relationship("Booking")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_availability_slot_time_order"),
        CheckConstraint("max_bookings > 0", name="ck_availability_slot_max_bookings"),
        CheckConstraint("current_bookings >= 0", name="ck_availability_slot_current_bookings"),
        CheckConstraint("current_bookings <= max_bookings", name="ck_availability_slot_current_lte_max"),
        CheckConstraint("(is_booked = false AND booking_id IS NULL) OR (is_booked = true AND booking_id IS NOT NULL)", name="ck_availability_slot_booking_consistency"),
    )


class CustomerBookingProfile(TenantModel):
    """Customer profile created during booking flow."""
    
    __tablename__ = "customer_booking_profiles"
    
    # Customer identification
    email = Column(String(255), nullable=False)
    phone = Column(String(20))
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    
    # Customer preferences
    marketing_opt_in = Column(Boolean, nullable=False, default=False)
    sms_opt_in = Column(Boolean, nullable=False, default=False)
    email_opt_in = Column(Boolean, nullable=False, default=True)
    
    # Customer data
    date_of_birth = Column(DateTime)
    gender = Column(String(20))
    address_json = Column(JSON, default={})
    preferences_json = Column(JSON, default={})
    
    # Booking history
    total_bookings = Column(Integer, default=0)
    first_booking_at = Column(DateTime)
    last_booking_at = Column(DateTime)
    
    # Status
    is_verified = Column(Boolean, nullable=False, default=False)
    verification_token = Column(String(255))
    verified_at = Column(DateTime)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="customer_booking_profiles")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("total_bookings >= 0", name="ck_customer_profile_total_bookings"),
        CheckConstraint("gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say')", name="ck_customer_profile_gender"),
        UniqueConstraint("tenant_id", "email", name="uq_customer_booking_profile_email"),
    )


class BookingFlowAnalytics(TenantModel):
    """Analytics for booking flow performance."""
    
    __tablename__ = "booking_flow_analytics"
    
    # Analytics period
    date = Column(DateTime, nullable=False)
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    
    # Flow metrics
    sessions_started = Column(Integer, default=0)
    sessions_completed = Column(Integer, default=0)
    sessions_abandoned = Column(Integer, default=0)
    
    # Step completion rates
    service_selection_completed = Column(Integer, default=0)
    time_selection_completed = Column(Integer, default=0)
    customer_info_completed = Column(Integer, default=0)
    payment_completed = Column(Integer, default=0)
    confirmation_completed = Column(Integer, default=0)
    
    # Conversion metrics
    conversion_rate = Column(Numeric(5, 2), default=0.00)
    average_session_duration_minutes = Column(Integer, default=0)
    
    # Service metrics
    most_popular_service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"))
    most_popular_team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"))
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="booking_flow_analytics")
    most_popular_service = relationship("Service")
    most_popular_team_member = relationship("TeamMember")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("period_type IN ('daily', 'weekly', 'monthly')", name="ck_booking_flow_analytics_period"),
        CheckConstraint("sessions_started >= 0", name="ck_booking_flow_analytics_sessions_started"),
        CheckConstraint("sessions_completed >= 0", name="ck_booking_flow_analytics_sessions_completed"),
        CheckConstraint("sessions_abandoned >= 0", name="ck_booking_flow_analytics_sessions_abandoned"),
        CheckConstraint("conversion_rate >= 0 AND conversion_rate <= 100", name="ck_booking_flow_analytics_conversion_rate"),
        CheckConstraint("average_session_duration_minutes >= 0", name="ck_booking_flow_analytics_duration"),
        UniqueConstraint("tenant_id", "date", "period_type", name="uq_booking_flow_analytics_period"),
    )


class BookingFlowConfiguration(TenantModel):
    """Configuration for booking flow behavior."""
    
    __tablename__ = "booking_flow_configurations"
    
    # Flow settings
    require_customer_info = Column(Boolean, nullable=False, default=True)
    require_payment = Column(Boolean, nullable=False, default=True)
    allow_guest_booking = Column(Boolean, nullable=False, default=False)
    
    # Display settings
    show_service_images = Column(Boolean, nullable=False, default=True)
    show_team_member_photos = Column(Boolean, nullable=False, default=True)
    show_pricing = Column(Boolean, nullable=False, default=True)
    
    # Booking settings
    allow_same_day_booking = Column(Boolean, nullable=False, default=True)
    minimum_advance_booking_hours = Column(Integer, default=2)
    maximum_advance_booking_days = Column(Integer, default=90)
    
    # Session settings
    session_timeout_minutes = Column(Integer, default=30)
    allow_session_extension = Column(Boolean, nullable=False, default=True)
    
    # Notification settings
    send_booking_confirmation = Column(Boolean, nullable=False, default=True)
    send_reminder_notifications = Column(Boolean, nullable=False, default=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="booking_flow_configuration")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("minimum_advance_booking_hours >= 0", name="ck_booking_flow_config_min_advance"),
        CheckConstraint("maximum_advance_booking_days > 0", name="ck_booking_flow_config_max_advance"),
        CheckConstraint("session_timeout_minutes > 0", name="ck_booking_flow_config_session_timeout"),
        UniqueConstraint("tenant_id", name="uq_booking_flow_configuration_tenant"),
    )
