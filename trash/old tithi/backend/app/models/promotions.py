"""
Promotions and Gift Cards Models

This module contains models for gift cards, coupons, and promotional campaigns.
"""

import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, JSON, UniqueConstraint, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class GiftCard(TenantModel):
    """Gift card model for digital gift cards."""
    
    __tablename__ = "gift_cards"
    
    code = Column(String(50), nullable=False, unique=True)
    amount_cents = Column(Integer, nullable=False)
    balance_cents = Column(Integer, nullable=False)
    expiry_date = Column(Date)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="gift_cards")
    transactions = relationship("GiftCardTransaction", back_populates="gift_card", cascade="all, delete-orphan")


class GiftCardTransaction(TenantModel):
    """Gift card transaction model for tracking usage."""
    
    __tablename__ = "gift_card_transactions"
    
    gift_card_id = Column(UUID(as_uuid=True), ForeignKey("gift_cards.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    transaction_type = Column(String(50), nullable=False)  # purchase, redemption, refund
    amount_cents = Column(Integer, nullable=False)
    
    # Relationships
    gift_card = relationship("GiftCard", back_populates="transactions")
    booking = relationship("Booking", back_populates="gift_card_transactions")


class Coupon(TenantModel):
    """Coupon model for promotional discounts."""
    
    __tablename__ = "coupons"
    
    code = Column(String(50), nullable=False)
    discount_type = Column(String(20), nullable=False)  # percentage, fixed_amount
    discount_value = Column(Numeric(10, 2), nullable=False)
    min_amount_cents = Column(Integer, default=0)
    max_discount_cents = Column(Integer)
    usage_limit = Column(Integer)
    used_count = Column(Integer, default=0)
    expiry_date = Column(Date)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="coupons")
    usages = relationship("CouponUsage", back_populates="coupon", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('tenant_id', 'code', name='unique_tenant_coupon_code'),
    )


class CouponUsage(TenantModel):
    """Coupon usage tracking."""
    
    __tablename__ = "coupon_usages"
    
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    discount_amount_cents = Column(Integer, nullable=False)
    
    # Relationships
    coupon = relationship("Coupon", back_populates="usages")
    booking = relationship("Booking", back_populates="coupon_usages")
    customer = relationship("Customer", back_populates="coupon_usages")


class Referral(TenantModel):
    """Referral program model."""
    
    __tablename__ = "referrals"
    
    referrer_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    referred_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    referral_code = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending, completed, expired
    reward_amount_cents = Column(Integer, default=0)
    completed_at = Column(DateTime)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="referrals")
    referrer_customer = relationship("Customer", foreign_keys=[referrer_customer_id], back_populates="referrals_made")
    referred_customer = relationship("Customer", foreign_keys=[referred_customer_id], back_populates="referrals_received")