"""
Financial Models

This module contains financial-related models for payments, invoices, refunds, and payment methods.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, Numeric, JSON, BigInteger, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class Payment(TenantModel):
    """Payment model representing a payment transaction with Stripe integration."""
    
    __tablename__ = "payments"
    
    # Core payment fields
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    status = Column(String(20), nullable=False, default="requires_action")
    method = Column(String(20), nullable=False, default="card")
    currency_code = Column(String(3), default="USD", nullable=False)
    amount_cents = Column(Integer, nullable=False, default=0)
    tip_cents = Column(Integer, nullable=False, default=0)
    tax_cents = Column(Integer, nullable=False, default=0)
    application_fee_cents = Column(Integer, nullable=False, default=0)
    no_show_fee_cents = Column(Integer, nullable=False, default=0)
    fee_type = Column(String(50), default="booking")
    
    # Related payment tracking
    related_payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)
    
    # Stripe integration
    provider = Column(String(50), nullable=False, default="stripe")
    provider_payment_id = Column(String(255))  # Stripe PaymentIntent ID
    provider_charge_id = Column(String(255))   # Stripe Charge ID
    provider_setup_intent_id = Column(String(255))  # Stripe SetupIntent ID
    provider_metadata = Column(JSONB, default={})
    
    # Idempotency and replay protection
    idempotency_key = Column(String(255), unique=True)
    backup_setup_intent_id = Column(String(255))
    
    # Consent and compliance
    explicit_consent_flag = Column(Boolean, nullable=False, default=False)
    royalty_applied = Column(Boolean, nullable=False, default=False)
    royalty_basis = Column(String(50), CheckConstraint("royalty_basis IN ('new_customer', 'referral', 'other')"))
    
    # Additional metadata
    metadata = Column(JSONB, default={})
    
    # Relationships
    booking = relationship("Booking", back_populates="payments")
    customer = relationship("Customer")
    related_payment = relationship("Payment", remote_side="Payment.id")
    refunds = relationship("Refund", back_populates="payment")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "status IN ('requires_action', 'authorized', 'captured', 'refunded', 'canceled', 'failed')",
            name="ck_payment_status"
        ),
        CheckConstraint(
            "method IN ('card', 'cash', 'apple_pay', 'paypal', 'other')",
            name="ck_payment_method"
        ),
        CheckConstraint("amount_cents >= 0", name="ck_payment_amount_positive"),
        CheckConstraint("tip_cents >= 0", name="ck_payment_tip_positive"),
        CheckConstraint("tax_cents >= 0", name="ck_payment_tax_positive"),
        CheckConstraint("application_fee_cents >= 0", name="ck_payment_app_fee_positive"),
        CheckConstraint("no_show_fee_cents >= 0", name="ck_payment_no_show_fee_positive"),
    )


class PaymentMethod(TenantModel):
    """Payment method model for storing customer payment methods."""
    
    __tablename__ = "payment_methods"
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    stripe_payment_method_id = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # card, bank_account, etc.
    last4 = Column(String(4))
    exp_month = Column(Integer)
    exp_year = Column(Integer)
    brand = Column(String(50))  # visa, mastercard, etc.
    is_default = Column(Boolean, nullable=False, default=False)
    
    # Relationships
    customer = relationship("Customer")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("exp_month IS NULL OR (exp_month >= 1 AND exp_month <= 12)", name="ck_exp_month"),
        CheckConstraint("exp_year IS NULL OR exp_year >= 2024", name="ck_exp_year"),
    )


class Refund(TenantModel):
    """Refund model representing a refund transaction."""
    
    __tablename__ = "refunds"
    
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    amount_cents = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    refund_type = Column(String(20), nullable=False, default="full")
    provider = Column(String(50), nullable=False, default="stripe")
    provider_refund_id = Column(String(255))
    provider_metadata = Column(JSONB, default={})
    status = Column(String(20), nullable=False, default="pending")
    idempotency_key = Column(String(255))
    metadata = Column(JSONB, default={})
    
    # Relationships
    payment = relationship("Payment", back_populates="refunds")
    booking = relationship("Booking")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_refund_amount_positive"),
        CheckConstraint(
            "refund_type IN ('full', 'partial', 'no_show_fee_only')",
            name="ck_refund_type"
        ),
        CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'canceled')",
            name="ck_refund_status"
        ),
    )


class TenantBilling(TenantModel):
    """Tenant billing configuration and Stripe Connect integration."""
    
    __tablename__ = "tenant_billing"
    
    stripe_account_id = Column(String(255))
    stripe_connect_enabled = Column(Boolean, nullable=False, default=False)
    stripe_connect_id = Column(String(255))
    billing_json = Column(JSONB, default={})
    default_no_show_fee_percent = Column(Numeric(5, 2), default=3.00)
    
    # Constraints
    __table_args__ = (
        CheckConstraint("default_no_show_fee_percent >= 0 AND default_no_show_fee_percent <= 100", 
                       name="ck_no_show_fee_percent"),
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
    
    # Constraints
    __table_args__ = (
        CheckConstraint("amount_cents >= 0", name="ck_invoice_amount_positive"),
    )


class Coupon(TenantModel):
    """Coupon model for discount coupons and promotional codes."""
    
    __tablename__ = "coupons"
    
    # Core coupon fields
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    discount_type = Column(String(20), nullable=False)  # percentage, fixed_amount
    discount_value = Column(Numeric(10, 2), nullable=False)
    currency_code = Column(String(3), default="USD")
    
    # Usage limits
    max_uses = Column(Integer, nullable=True)  # NULL = unlimited
    max_uses_per_customer = Column(Integer, nullable=False, default=1)
    used_count = Column(Integer, nullable=False, default=0)
    
    # Validity period
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=True)  # NULL = no expiration
    
    # Conditions
    minimum_amount_cents = Column(Integer, nullable=True)  # Minimum order amount
    maximum_discount_cents = Column(Integer, nullable=True)  # Maximum discount amount
    applicable_services = Column(JSONB, default=[])  # Service IDs this coupon applies to
    applicable_customers = Column(JSONB, default=[])  # Customer IDs this coupon applies to
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_public = Column(Boolean, nullable=False, default=True)  # Can be used by any customer
    
    # Metadata
    metadata = Column(JSONB, default={})
    
    # Constraints
    __table_args__ = (
        CheckConstraint("discount_type IN ('percentage', 'fixed_amount')", name="ck_coupon_discount_type"),
        CheckConstraint("discount_value > 0", name="ck_coupon_discount_positive"),
        CheckConstraint("max_uses IS NULL OR max_uses > 0", name="ck_coupon_max_uses"),
        CheckConstraint("max_uses_per_customer > 0", name="ck_coupon_max_uses_per_customer"),
        CheckConstraint("used_count >= 0", name="ck_coupon_used_count"),
        CheckConstraint("minimum_amount_cents IS NULL OR minimum_amount_cents >= 0", name="ck_coupon_min_amount"),
        CheckConstraint("maximum_discount_cents IS NULL OR maximum_discount_cents > 0", name="ck_coupon_max_discount"),
        CheckConstraint("valid_until IS NULL OR valid_until > valid_from", name="ck_coupon_valid_period"),
        UniqueConstraint("code", "tenant_id", name="uq_coupon_code_tenant"),
    )


class GiftCard(TenantModel):
    """Gift card model for digital gift cards."""
    
    __tablename__ = "gift_cards"
    
    # Core gift card fields
    code = Column(String(50), nullable=False, unique=True)
    amount_cents = Column(Integer, nullable=False)
    currency_code = Column(String(3), default="USD")
    balance_cents = Column(Integer, nullable=False)
    
    # Recipient information
    recipient_email = Column(String(255), nullable=True)
    recipient_name = Column(String(255), nullable=True)
    sender_name = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    
    # Validity period
    valid_from = Column(DateTime, nullable=False, default=func.now())
    valid_until = Column(DateTime, nullable=True)  # NULL = no expiration
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    is_redeemed = Column(Boolean, nullable=False, default=False)
    
    # Metadata
    metadata = Column(JSONB, default={})
    
    # Relationships
    transactions = relationship("GiftCardTransaction", back_populates="gift_card")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("amount_cents > 0", name="ck_gift_card_amount_positive"),
        CheckConstraint("balance_cents >= 0", name="ck_gift_card_balance_non_negative"),
        CheckConstraint("balance_cents <= amount_cents", name="ck_gift_card_balance_not_exceed_amount"),
        CheckConstraint("valid_until IS NULL OR valid_until > valid_from", name="ck_gift_card_valid_period"),
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
    metadata = Column(JSONB, default={})
    
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


class PromotionUsage(TenantModel):
    """Promotion usage tracking model for coupons and gift cards."""
    
    __tablename__ = "promotion_usage"
    
    # Promotion reference
    coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupons.id"), nullable=True)
    gift_card_id = Column(UUID(as_uuid=True), ForeignKey("gift_cards.id"), nullable=True)
    
    # Usage context
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)
    
    # Usage details
    discount_amount_cents = Column(Integer, nullable=False)
    original_amount_cents = Column(Integer, nullable=False)
    final_amount_cents = Column(Integer, nullable=False)
    
    # Metadata
    metadata = Column(JSONB, default={})
    
    # Relationships
    coupon = relationship("Coupon")
    gift_card = relationship("GiftCard")
    customer = relationship("Customer")
    booking = relationship("Booking")
    payment = relationship("Payment")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("(coupon_id IS NOT NULL AND gift_card_id IS NULL) OR (coupon_id IS NULL AND gift_card_id IS NOT NULL)", 
                       name="ck_promotion_usage_one_promotion"),
        CheckConstraint("discount_amount_cents >= 0", name="ck_promotion_usage_discount_positive"),
        CheckConstraint("original_amount_cents > 0", name="ck_promotion_usage_original_positive"),
        CheckConstraint("final_amount_cents >= 0", name="ck_promotion_usage_final_non_negative"),
        CheckConstraint("final_amount_cents == original_amount_cents - discount_amount_cents", 
                       name="ck_promotion_usage_amount_consistency"),
    )
