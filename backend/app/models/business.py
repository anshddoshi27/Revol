"""
Business Models

This module contains business-related models for customers, services, resources, and bookings.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, UniqueConstraint, Date, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel, GlobalModel


class Customer(TenantModel):
    """Customer model representing a customer of a tenant."""
    
    __tablename__ = "customers"
    
    display_name = Column(String(255))
    email = Column(String(255))  # citext in DB
    phone = Column(String(50))
    marketing_opt_in = Column(Boolean, default=False)
    notification_preferences = Column(JSON, default={})
    is_first_time = Column(Boolean, default=True)
    pseudonymized_at = Column(DateTime)
    customer_first_booking_at = Column(DateTime)
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="customers")
    bookings = relationship("Booking", back_populates="customer")


class Service(TenantModel):
    """Service model representing a service offered by a tenant."""
    
    __tablename__ = "services"
    
    slug = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False, default="")
    description = Column(Text, default="")
    duration_min = Column(Integer, nullable=False, default=60)
    price_cents = Column(Integer, nullable=False, default=0)
    buffer_before_min = Column(Integer, nullable=False, default=0)
    buffer_after_min = Column(Integer, nullable=False, default=0)
    category = Column(String(255), default="")
    active = Column(Boolean, nullable=False, default=True)
    metadata_json = Column(JSON, default={})
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="services")
    booking_items = relationship("BookingItem", back_populates="service")


class Resource(TenantModel):
    """Resource model representing staff or equipment."""
    
    __tablename__ = "resources"
    
    type = Column(String(50), nullable=False)  # resource_type enum: staff, room
    tz = Column(String(50), nullable=False)
    capacity = Column(Integer, nullable=False)
    metadata_json = Column(JSON, default={})
    name = Column(String(255), nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="resources")
    booking_items = relationship("BookingItem", back_populates="resource")


class Booking(TenantModel):
    """Booking model representing a customer booking."""
    
    __tablename__ = "bookings"
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    client_generated_id = Column(String(255), nullable=False)
    service_snapshot = Column(JSON, nullable=False, default={})
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    booking_tz = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # booking_status enum
    canceled_at = Column(DateTime)
    no_show_flag = Column(Boolean, nullable=False, default=False)
    attendee_count = Column(Integer, nullable=False, default=1)
    rescheduled_from = Column(UUID(as_uuid=True), ForeignKey("bookings.id"))
    
    # Relationships
    tenant = relationship("Tenant", back_populates="bookings")
    customer = relationship("Customer", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking")
    booking_items = relationship("BookingItem", back_populates="booking")
    rescheduled_from_booking = relationship("Booking", remote_side="Booking.id")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'checked_in', 'completed', 'canceled', 'no_show', 'failed')",
            name="ck_booking_status"
        ),
    )


class CustomerMetrics(TenantModel):
    """Customer metrics model for denormalized analytics."""
    
    __tablename__ = "customer_metrics"
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    total_bookings_count = Column(Integer, nullable=False, default=0)
    first_booking_at = Column(DateTime)
    last_booking_at = Column(DateTime)
    total_spend_cents = Column(Integer, nullable=False, default=0)
    no_show_count = Column(Integer, nullable=False, default=0)
    canceled_count = Column(Integer, nullable=False, default=0)
    
    # Relationships
    customer = relationship("Customer")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("total_spend_cents >= 0", name="ck_total_spend_nonneg"),
        CheckConstraint("no_show_count >= 0", name="ck_no_show_nonneg"),
        CheckConstraint("canceled_count >= 0", name="ck_canceled_nonneg"),
        CheckConstraint("total_bookings_count >= 0", name="ck_bookings_nonneg"),
    )


class ServiceResource(TenantModel):
    """Service-Resource mapping model for many-to-many relationships."""
    
    __tablename__ = "service_resources"
    
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    
    # Relationships
    service = relationship("Service")
    resource = relationship("Resource")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("service_id", "resource_id", name="uq_service_resource"),
    )


class BookingItem(TenantModel):
    """Booking item model for multi-resource bookings."""
    
    __tablename__ = "booking_items"
    
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"))
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    buffer_before_min = Column(Integer, nullable=False, default=0)
    buffer_after_min = Column(Integer, nullable=False, default=0)
    price_cents = Column(Integer, nullable=False, default=0)
    
    # Relationships
    booking = relationship("Booking")
    resource = relationship("Resource")
    service = relationship("Service")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("start_at < end_at", name="ck_time_order"),
        CheckConstraint("buffer_before_min >= 0", name="ck_buffer_before_nonneg"),
        CheckConstraint("buffer_after_min >= 0", name="ck_buffer_after_nonneg"),
        CheckConstraint("price_cents >= 0", name="ck_price_nonneg"),
    )


class StaffProfile(TenantModel):
    """Staff profile model linking memberships to resources for team management."""
    
    __tablename__ = "staff_profiles"
    
    membership_id = Column(UUID(as_uuid=True), ForeignKey("memberships.id"), nullable=False)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    display_name = Column(String(255), nullable=False)
    bio = Column(Text)
    specialties = Column(ARRAY(String))
    hourly_rate_cents = Column(Integer)
    is_active = Column(Boolean, nullable=False, default=True)
    max_concurrent_bookings = Column(Integer, default=1)
    metadata_json = Column(JSON, default={})
    
    # Relationships
    membership = relationship("Membership")
    resource = relationship("Resource")
    work_schedules = relationship("WorkSchedule", back_populates="staff_profile")
    assignment_history = relationship("StaffAssignmentHistory", back_populates="staff_profile")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "resource_id", name="uq_staff_profile_resource"),
        CheckConstraint("hourly_rate_cents >= 0", name="ck_hourly_rate_nonneg"),
        CheckConstraint("max_concurrent_bookings > 0", name="ck_max_concurrent_positive"),
    )


class WorkSchedule(TenantModel):
    """Work schedule model for staff scheduling with RRULE support."""
    
    __tablename__ = "work_schedules"
    
    staff_profile_id = Column(UUID(as_uuid=True), ForeignKey("staff_profiles.id"), nullable=False)
    schedule_type = Column(String(20), nullable=False)  # schedule_type enum
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    work_hours = Column(JSON)  # Store work hours as JSON
    is_time_off = Column(Boolean, nullable=False, default=False)
    overrides_regular = Column(Boolean, nullable=False, default=False)
    rrule = Column(Text)  # iCalendar RRULE format
    reason = Column(Text)
    metadata_json = Column(JSON, default={})
    
    # Relationships
    staff_profile = relationship("StaffProfile", back_populates="work_schedules")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "schedule_type IN ('regular', 'override', 'time_off', 'holiday')",
            name="ck_schedule_type"
        ),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="ck_date_range"),
    )


class StaffAssignmentHistory(TenantModel):
    """Staff assignment history for audit tracking."""
    
    __tablename__ = "staff_assignment_history"
    
    staff_profile_id = Column(UUID(as_uuid=True), ForeignKey("staff_profiles.id"), nullable=False)
    change_type = Column(String(20), nullable=False)  # assignment_change_type enum
    old_values = Column(JSON)
    new_values = Column(JSON)
    reason = Column(Text)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Relationships
    staff_profile = relationship("StaffProfile", back_populates="assignment_history")
    changed_by_user = relationship("User")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "change_type IN ('assigned', 'unassigned', 'role_changed', 'rate_changed')",
            name="ck_change_type"
        ),
    )


class BookingHold(TenantModel):
    """Temporary booking holds with TTL for preventing double-booking."""
    
    __tablename__ = "booking_holds"
    
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"))
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    hold_until = Column(DateTime, nullable=False)
    hold_key = Column(String(255), nullable=False)
    metadata_json = Column(JSON, default={})
    
    # Relationships
    resource = relationship("Resource")
    service = relationship("Service")
    customer = relationship("Customer")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("start_at < end_at", name="ck_hold_time_order"),
        CheckConstraint("hold_until > start_at", name="ck_hold_until_after_start"),
        UniqueConstraint("tenant_id", "hold_key", name="uq_hold_key"),
    )


class WaitlistEntry(TenantModel):
    """Waitlist entries for unavailable booking slots."""
    
    __tablename__ = "waitlist_entries"
    
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"))
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    preferred_start_at = Column(DateTime)
    preferred_end_at = Column(DateTime)
    priority = Column(Integer, default=0)
    status = Column(String(20), nullable=False, default="waiting")  # waitlist_status enum
    notified_at = Column(DateTime)
    expires_at = Column(DateTime)
    metadata_json = Column(JSON, default={})
    
    # Relationships
    resource = relationship("Resource")
    service = relationship("Service")
    customer = relationship("Customer")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('waiting', 'notified', 'booked', 'expired', 'cancelled')",
            name="ck_waitlist_status"
        ),
        CheckConstraint("preferred_end_at IS NULL OR preferred_start_at IS NULL OR preferred_start_at < preferred_end_at", name="ck_preferred_time_order"),
    )


class AvailabilityCache(TenantModel):
    """Availability cache for performance optimization."""
    
    __tablename__ = "availability_cache"
    
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)
    date = Column(Date, nullable=False)
    availability_slots = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationships
    resource = relationship("Resource")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "resource_id", "date", name="uq_availability_cache"),
        CheckConstraint("expires_at > created_at", name="ck_cache_expires_after_created"),
    )
