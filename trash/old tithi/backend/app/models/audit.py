"""
Audit Models

This module contains audit logging and event system models.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and migrations 0013_audit_logs.sql.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer, CheckConstraint, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from ..extensions import db
from .core import TenantModel, GlobalModel


class AuditLog(GlobalModel):
    """Audit log model for comprehensive audit trail."""
    
    __tablename__ = "audit_logs"
    
    # Core audit fields
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"))  # Nullable for system operations
    table_name = Column(String(100), nullable=False)
    operation = Column(String(20), nullable=False)  # INSERT, UPDATE, DELETE
    record_id = Column(UUID(as_uuid=True))
    old_data = Column(JSON)
    new_data = Column(JSON)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("operation IN ('INSERT', 'UPDATE', 'DELETE')", name="ck_audit_log_operation"),
    )


class EventOutbox(TenantModel):
    """Event outbox model for reliable event delivery."""
    
    __tablename__ = "events_outbox"
    
    # Core event fields
    event_code = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False, default={})
    status = Column(String(20), nullable=False, default="ready")  # ready, delivered, failed
    ready_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    delivered_at = Column(DateTime)
    failed_at = Column(DateTime)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    last_attempt_at = Column(DateTime)
    error_message = Column(Text)
    key = Column(String(255))
    metadata_json = Column(JSON, default={})
    
    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('ready', 'delivered', 'failed')", name="ck_events_outbox_status"),
        CheckConstraint("attempts >= 0", name="ck_events_outbox_attempts"),
        CheckConstraint("max_attempts >= 0", name="ck_events_outbox_max_attempts"),
    )


class WebhookEventInbox(GlobalModel):
    """Webhook event inbox model for inbound webhook events with idempotency."""
    
    __tablename__ = "webhook_events_inbox"
    
    # Core webhook fields
    provider = Column(String(100), nullable=False)
    provider_event_id = Column(String(255), nullable=False)
    payload = Column(JSON, nullable=False, default={})
    processed_at = Column(DateTime)
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("provider", "provider_event_id", name="uq_webhook_inbox_provider_event"),
    )
