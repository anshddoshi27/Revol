"""
Promotions Models

This module contains promotion-related models for coupons, gift cards, and referrals.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and migrations 0010_promotions.sql.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class Coupon(TenantModel):
    """Coupon model for discount coupons and promotional codes."""
    
    __tablename__ = "coupons"
    
    # Core coupon fields
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False, default="")
    description = Column(Text)
    percent_off = Column(Integer)  # Percentage discount (1-100)
    amount_off_cents = Column(Integer)  # Fixed amount discount in cents
    minimum_amount_cents = Column(Integer, nullable=False, default=0)
    maximum_discount_cents = Column(Integer)
    
    # Usage limits
    usage_limit = Column(Integer)  # NULL = unlimited
    usage_count = Column(Integer, nullable=False, default=0)
    
    # Validity period
    starts_at = Column(DateTime)
    expires_at = Column(DateTime)
    
    # Status
    active = Column(Boolean, nullable=False, default=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    deleted_at = Column(DateTime)
    
    # Constraints
    __table_args__ = (
        CheckConstraint("percent_off IS NULL OR (percent_off BETWEEN 1 AND 100)", name="ck_coupon_percent_off"),
        CheckConstraint("amount_off_cents IS NULL OR amount_off_cents > 0", name="ck_coupon_amount_off"),
        CheckConstraint("(percent_off IS NOT NULL AND amount_off_cents IS NULL) OR (percent_off IS NULL AND amount_off_cents IS NOT NULL)", 
                       name="ck_coupon_discount_type_xor"),
        CheckConstraint("minimum_amount_cents >= 0", name="ck_coupon_minimum_amount"),
        CheckConstraint("maximum_discount_cents IS NULL OR maximum_discount_cents > 0", name="ck_coupon_maximum_discount"),
        CheckConstraint("usage_limit IS NULL OR usage_limit > 0", name="ck_coupon_usage_limit"),
        CheckConstraint("usage_count >= 0", name="ck_coupon_usage_count"),
        CheckConstraint("expires_at IS NULL OR expires_at > starts_at", name="ck_coupon_valid_period"),
        UniqueConstraint("tenant_id", "code", name="uq_coupon_code_tenant"),
    )


class GiftCard(TenantModel):
    """Gift card model for digital gift cards."""
    
    __tablename__ = "gift_cards"
    
    # Core gift card fields
    code = Column(String(50), nullable=False)
    initial_balance_cents = Column(Integer, nullable=False)
    current_balance_cents = Column(Integer, nullable=False)
    
    # Recipient information
    purchaser_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    recipient_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"))
    
    # Validity period
    expires_at = Column(DateTime)
    
    # Status
    active = Column(Boolean, nullable=False, default=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    purchaser_customer = relationship("Customer", foreign_keys=[purchaser_customer_id])
    recipient_customer = relationship("Customer", foreign_keys=[recipient_customer_id])
    transactions = relationship("GiftCardTransaction", back_populates="gift_card")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("initial_balance_cents > 0", name="ck_gift_card_initial_balance"),
        CheckConstraint("current_balance_cents >= 0", name="ck_gift_card_current_balance"),
        CheckConstraint("current_balance_cents <= initial_balance_cents", name="ck_gift_card_balance_not_exceed_initial"),
        UniqueConstraint("tenant_id", "code", name="uq_gift_card_code_tenant"),
    )


class GiftCardTransaction(TenantModel):
    """Gift card transaction model for tracking gift card usage."""
    
    __tablename__ = "gift_card_transactions"
    
    gift_card_id = Column(UUID(as_uuid=True), ForeignKey("gift_cards.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # purchase, redemption, refund
    amount_cents = Column(Integer, nullable=False)
    balance_after_cents = Column(Integer, nullable=False)
    
    # Related entities
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)
    
    # Description
    description = Column(Text, nullable=True)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    gift_card = relationship("GiftCard", back_populates="transactions")
    booking = relationship("Booking")
    payment = relationship("Payment")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("transaction_type IN ('purchase', 'redemption', 'refund')", name="ck_gift_card_transaction_type"),
        CheckConstraint("amount_cents > 0", name="ck_gift_card_transaction_amount_positive"),
        CheckConstraint("balance_after_cents >= 0", name="ck_gift_card_balance_after_non_negative"),
    )


class Referral(TenantModel):
    """Referral model for referral program tracking."""
    
    __tablename__ = "referrals"
    
    # Core referral fields
    code = Column(String(50), nullable=False)
    referrer_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    referred_customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    
    # Reward amounts
    reward_amount_cents = Column(Integer, nullable=False, default=0)
    referrer_reward_cents = Column(Integer, nullable=False, default=0)
    referred_reward_cents = Column(Integer, nullable=False, default=0)
    
    # Status and timing
    status = Column(String(20), nullable=False, default="pending")
    completed_at = Column(DateTime)
    expires_at = Column(DateTime)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    referrer_customer = relationship("Customer", foreign_keys=[referrer_customer_id])
    referred_customer = relationship("Customer", foreign_keys=[referred_customer_id])
    
    # Constraints
    __table_args__ = (
        CheckConstraint("reward_amount_cents >= 0", name="ck_referral_reward_amount"),
        CheckConstraint("referrer_reward_cents >= 0", name="ck_referral_referrer_reward"),
        CheckConstraint("referred_reward_cents >= 0", name="ck_referral_referred_reward"),
        CheckConstraint("status IN ('pending', 'completed', 'expired', 'cancelled')", name="ck_referral_status"),
        CheckConstraint("expires_at IS NULL OR expires_at > created_at", name="ck_referral_expires_future"),
        UniqueConstraint("tenant_id", "code", name="uq_referral_code_tenant"),
        UniqueConstraint("tenant_id", "referrer_customer_id", "referred_customer_id", name="uq_referral_customers"),
    )
