"""
Team Management Models

This module contains models for team members, staff management, and availability.
"""

import uuid
from datetime import datetime, time
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, JSON, UniqueConstraint, Time, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class TeamMember(TenantModel):
    """Team member model representing staff of a business."""
    
    __tablename__ = "team_members"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    role = Column(String(50), nullable=False, default="staff")  # owner, admin, staff
    bio = Column(Text)
    avatar_url = Column(String(500))
    specialties = Column(ARRAY(String), default=[])  # Array of specialties
    is_active = Column(Boolean, nullable=False, default=True)
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="team_members")
    availability = relationship("TeamMemberAvailability", back_populates="team_member", cascade="all, delete-orphan")
    service_assignments = relationship("TeamMemberService", back_populates="team_member", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="team_member")
    user = relationship("User", back_populates="team_members")


class TeamMemberAvailability(TenantModel):
    """Team member availability model for scheduling."""
    
    __tablename__ = "team_member_availability"
    
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Sunday, 6=Saturday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    team_member = relationship("TeamMember", back_populates="availability")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('team_member_id', 'day_of_week', 'start_time', name='unique_team_member_day_time'),
    )


class TeamMemberService(TenantModel):
    """Team member service assignments."""
    
    __tablename__ = "team_member_services"
    
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    is_primary = Column(Boolean, nullable=False, default=False)
    
    # Relationships
    team_member = relationship("TeamMember", back_populates="service_assignments")
    service = relationship("Service", back_populates="team_assignments")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('team_member_id', 'service_id', name='unique_team_member_service'),
    )


class ServiceCategory(TenantModel):
    """Service category model for organizing services."""
    
    __tablename__ = "service_categories"
    
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(7))  # Hex color code
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    deleted_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="service_categories")
    services = relationship("Service", back_populates="service_category")


class BusinessPolicy(TenantModel):
    """Business policies model for cancellation, no-show, etc."""
    
    __tablename__ = "business_policies"
    
    policy_type = Column(String(50), nullable=False)  # cancellation, no_show, refund, cash_payment
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="business_policies")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'policy_type', name='unique_tenant_policy_type'),
    )


