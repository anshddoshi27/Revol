"""
Analytics and Metrics Models

This module contains models for business analytics, customer metrics, and performance tracking.
"""

import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, JSON, UniqueConstraint, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class BusinessMetric(TenantModel):
    """Business metrics model for tracking KPIs."""
    
    __tablename__ = "business_metrics"
    
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Numeric(15, 2), nullable=False)
    metric_date = Column(Date, nullable=False)
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="business_metrics")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'metric_name', 'metric_date', name='unique_tenant_metric_date'),
    )


class CustomerAnalytics(TenantModel):
    """Customer analytics model for tracking customer behavior."""
    
    __tablename__ = "customer_analytics"
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    total_bookings = Column(Integer, default=0)
    total_spent_cents = Column(Integer, default=0)
    last_booking_date = Column(Date)
    lifetime_value_cents = Column(Integer, default=0)
    retention_score = Column(Numeric(5, 2))  # 0-100 score
    churn_risk_score = Column(Numeric(5, 2))  # 0-100 score
    preferred_services = Column(JSON, default=[])  # Array of service IDs
    booking_frequency_days = Column(Integer)  # Average days between bookings
    last_activity_date = Column(Date)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="customer_analytics")
    customer = relationship("Customer", back_populates="analytics")


class ServiceAnalytics(TenantModel):
    """Service analytics model for tracking service performance."""
    
    __tablename__ = "service_analytics"
    
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=False)
    total_bookings = Column(Integer, default=0)
    total_revenue_cents = Column(Integer, default=0)
    average_rating = Column(Numeric(3, 2))  # 0-5 rating
    cancellation_rate = Column(Numeric(5, 2))  # Percentage
    no_show_rate = Column(Numeric(5, 2))  # Percentage
    popularity_score = Column(Integer, default=0)  # Calculated score
    last_booking_date = Column(Date)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="service_analytics")
    service = relationship("Service", back_populates="analytics")


class StaffAnalytics(TenantModel):
    """Staff analytics model for tracking team member performance."""
    
    __tablename__ = "staff_analytics"
    
    team_member_id = Column(UUID(as_uuid=True), ForeignKey("team_members.id"), nullable=False)
    total_bookings = Column(Integer, default=0)
    total_revenue_cents = Column(Integer, default=0)
    average_rating = Column(Numeric(3, 2))  # 0-5 rating
    utilization_rate = Column(Numeric(5, 2))  # Percentage of available time booked
    customer_retention_rate = Column(Numeric(5, 2))  # Percentage
    no_show_rate = Column(Numeric(5, 2))  # Percentage
    efficiency_score = Column(Integer, default=0)  # Calculated score
    
    # Relationships
    tenant = relationship("Tenant", back_populates="staff_analytics")
    team_member = relationship("TeamMember", back_populates="analytics")


class RevenueAnalytics(TenantModel):
    """Revenue analytics model for financial tracking."""
    
    __tablename__ = "revenue_analytics"
    
    revenue_date = Column(Date, nullable=False)
    total_revenue_cents = Column(Integer, default=0)
    cash_revenue_cents = Column(Integer, default=0)
    card_revenue_cents = Column(Integer, default=0)
    gift_card_revenue_cents = Column(Integer, default=0)
    refund_amount_cents = Column(Integer, default=0)
    net_revenue_cents = Column(Integer, default=0)
    transaction_count = Column(Integer, default=0)
    average_transaction_value_cents = Column(Integer, default=0)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="revenue_analytics")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'revenue_date', name='unique_tenant_revenue_date'),
    )


class DashboardWidget(TenantModel):
    """Dashboard widget model for customizable admin dashboard."""
    
    __tablename__ = "dashboard_widgets"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    widget_type = Column(String(50), nullable=False)  # revenue_chart, booking_calendar, etc.
    position_x = Column(Integer, nullable=False)
    position_y = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    configuration = Column(JSON, default={})
    is_visible = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="dashboard_widgets")
    user = relationship("User", back_populates="dashboard_widgets")


class Event(TenantModel):
    """Event model for tracking user actions and system events."""
    
    __tablename__ = "events"
    
    event_type = Column(String(100), nullable=False)
    event_name = Column(String(255), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    service_id = Column(UUID(as_uuid=True), ForeignKey("services.id"), nullable=True)
    metadata_json = Column(JSON, default={})
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(Text)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="events")
    user = relationship("User", back_populates="events")
    customer = relationship("Customer", back_populates="events")
    booking = relationship("Booking", back_populates="events")
    service = relationship("Service", back_populates="events")


class Metric(TenantModel):
    """Metric model for tracking various business metrics."""
    
    __tablename__ = "metrics"
    
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Numeric(15, 2), nullable=False)
    metric_unit = Column(String(20))  # count, percentage, currency, etc.
    metric_category = Column(String(50))  # revenue, bookings, customers, etc.
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    metadata_json = Column(JSON, default={})
    
    # Relationships
    tenant = relationship("Tenant", back_populates="metrics")