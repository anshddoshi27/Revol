"""
Financial Models

This module contains financial-related models for payments, invoices, and refunds.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class Payment(TenantModel):
    """Payment model representing a payment transaction."""
    
    __tablename__ = "payments"
    
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(20), nullable=False, default="pending")
    payment_method = Column(String(50))
    external_id = Column(String(255))  # Stripe payment intent ID
    
    # Relationships
    booking = relationship("Booking")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')",
            name="ck_payment_status"
        ),
    )


class Invoice(TenantModel):
    """Invoice model representing a billing invoice."""
    
    __tablename__ = "invoices"
    
    invoice_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(20), nullable=False, default="draft")
    due_date = Column(DateTime)
    
    # Relationships
    customer = relationship("Customer")


class Refund(TenantModel):
    """Refund model representing a refund transaction."""
    
    __tablename__ = "refunds"
    
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    reason = Column(Text)
    status = Column(String(20), nullable=False, default="pending")
    external_id = Column(String(255))  # Stripe refund ID
    
    # Relationships
    payment = relationship("Payment")
