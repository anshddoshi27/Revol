"""
CRM Models

This module contains database models for CRM functionality including
customer notes, segments, loyalty programs, and customer management.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship

from .core import TenantModel


class CustomerNote(TenantModel):
    """Customer notes and interactions."""
    __tablename__ = 'customer_notes'
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey('customers.id'), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    
    # Relationships
    customer = relationship("Customer", back_populates="notes")
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'customer_id': str(self.customer_id),
            'content': self.content,
            'created_by': str(self.created_by),
            'created_at': self.created_at.isoformat() + "Z",
            'updated_at': self.updated_at.isoformat() + "Z"
        }


class CustomerSegment(TenantModel):
    """Customer segments for targeting and analytics."""
    __tablename__ = 'customer_segments'
    
    name = Column(String(255), nullable=False)
    description = Column(Text, default='')
    criteria = Column(JSON, nullable=False, default={})
    customer_count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    memberships = relationship("CustomerSegmentMembership", back_populates="segment")
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'name': self.name,
            'description': self.description,
            'criteria': self.criteria,
            'customer_count': self.customer_count,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() + "Z",
            'updated_at': self.updated_at.isoformat() + "Z"
        }


class LoyaltyAccount(TenantModel):
    """Customer loyalty accounts for points tracking."""
    __tablename__ = 'loyalty_accounts'
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey('customers.id'), nullable=False, index=True)
    points_balance = Column(Integer, nullable=False, default=0)
    total_earned = Column(Integer, nullable=False, default=0)
    total_redeemed = Column(Integer, nullable=False, default=0)
    tier = Column(String(50), default='bronze')
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Relationships
    customer = relationship("Customer", back_populates="loyalty_accounts")
    transactions = relationship("LoyaltyTransaction", back_populates="loyalty_account")
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'customer_id': str(self.customer_id),
            'points_balance': self.points_balance,
            'total_earned': self.total_earned,
            'total_redeemed': self.total_redeemed,
            'tier': self.tier,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() + "Z",
            'updated_at': self.updated_at.isoformat() + "Z"
        }


class LoyaltyTransaction(TenantModel):
    """Loyalty points transactions."""
    __tablename__ = 'loyalty_transactions'
    
    loyalty_account_id = Column(UUID(as_uuid=True), ForeignKey('loyalty_accounts.id'), nullable=False, index=True)
    transaction_type = Column(String(50), nullable=False)
    points = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    reference_type = Column(String(50))  # 'booking', 'referral', 'promotion', etc.
    reference_id = Column(UUID(as_uuid=True))
    expires_at = Column(DateTime)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')",
            name='loyalty_transactions_type_check'
        ),
    )
    
    # Relationships
    loyalty_account = relationship("LoyaltyAccount", back_populates="transactions")
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'loyalty_account_id': str(self.loyalty_account_id),
            'transaction_type': self.transaction_type,
            'points': self.points,
            'description': self.description,
            'reference_type': self.reference_type,
            'reference_id': str(self.reference_id) if self.reference_id else None,
            'expires_at': self.expires_at.isoformat() + "Z" if self.expires_at else None,
            'created_at': self.created_at.isoformat() + "Z"
        }


class CustomerSegmentMembership(TenantModel):
    """Many-to-many relationship between customers and segments."""
    __tablename__ = 'customer_segment_memberships'
    
    customer_id = Column(UUID(as_uuid=True), ForeignKey('customers.id'), nullable=False, index=True)
    segment_id = Column(UUID(as_uuid=True), ForeignKey('customer_segments.id'), nullable=False, index=True)
    added_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    customer = relationship("Customer", back_populates="segment_memberships")
    segment = relationship("CustomerSegment", back_populates="memberships")
    
    def to_dict(self):
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'customer_id': str(self.customer_id),
            'segment_id': str(self.segment_id),
            'added_at': self.added_at.isoformat() + "Z"
        }