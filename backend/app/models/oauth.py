"""
OAuth Models

This module contains OAuth provider integration models.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and migrations 0023_oauth_providers.sql.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel


class OAuthProvider(TenantModel):
    """OAuth provider model for third-party authentication integration."""
    
    __tablename__ = "oauth_providers"
    
    # Core OAuth fields
    provider_name = Column(String(50), nullable=False)  # google, facebook, apple, etc.
    provider_user_id = Column(String(255), nullable=False)  # External provider user ID
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # OAuth tokens (encrypted)
    access_token = Column(Text)  # Encrypted access token
    refresh_token = Column(Text)  # Encrypted refresh token
    token_expires_at = Column(DateTime)
    
    # Provider-specific data
    provider_data = Column(JSON, default={})  # Additional provider-specific information
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    last_sync_at = Column(DateTime)
    
    # Metadata
    metadata_json = Column(JSON, default={})
    
    # Relationships
    user = relationship("User")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("provider_name IN ('google', 'facebook', 'apple', 'microsoft', 'github')", name="ck_oauth_provider_name"),
        UniqueConstraint("tenant_id", "provider_name", "provider_user_id", name="uq_oauth_provider_user"),
        UniqueConstraint("tenant_id", "provider_name", "user_id", name="uq_oauth_provider_tenant_user"),
    )
