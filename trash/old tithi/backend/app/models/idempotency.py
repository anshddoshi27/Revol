"""
IdempotencyKey Model for Tithi Backend

This model represents idempotency keys used for critical endpoint idempotency.

Phase: 11 - Cross-Cutting Utilities (Module N)
Task: 11.4 - Idempotency Keys
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship

from ..extensions import db


class IdempotencyKey(db.Model):
    """
    Model for storing idempotency keys and their cached responses.
    
    This model ensures that critical endpoints can be safely retried
    by returning the same response for identical requests.
    """
    
    __tablename__ = 'idempotency_keys'
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=db.func.gen_random_uuid())
    
    # Tenant isolation
    tenant_id = Column(UUID(as_uuid=True), db.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    
    # Idempotency key data
    key_hash = Column(Text, nullable=False, comment='SHA-256 hash of the idempotency key')
    original_key = Column(Text, nullable=False, comment='Original idempotency key (for debugging)')
    
    # Request identification
    endpoint = Column(String(255), nullable=False, comment='The endpoint that was called')
    method = Column(String(10), nullable=False, comment='HTTP method (GET, POST, PUT, DELETE)')
    request_hash = Column(Text, nullable=False, comment='SHA-256 hash of request body for validation')
    
    # Cached response data
    response_status = Column(Integer, nullable=False, comment='HTTP status code of the response')
    response_body = Column(JSON, nullable=False, default={}, comment='Cached response body')
    response_headers = Column(JSON, nullable=False, default={}, comment='Cached response headers')
    
    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=False, comment='When this idempotency key expires')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=db.func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=db.func.now(), onupdate=db.func.now())
    
    # Relationships
    tenant = relationship('Tenant', backref='idempotency_keys')
    
    def __repr__(self):
        return f'<IdempotencyKey {self.id}: {self.endpoint} ({self.method})>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary"""
        return {
            'id': str(self.id),
            'tenant_id': str(self.tenant_id),
            'endpoint': self.endpoint,
            'method': self.method,
            'response_status': self.response_status,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def find_by_key(cls, tenant_id: str, key_hash: str, endpoint: str, method: str, request_hash: str) -> Optional['IdempotencyKey']:
        """Find idempotency key by lookup criteria"""
        return cls.query.filter_by(
            tenant_id=tenant_id,
            key_hash=key_hash,
            endpoint=endpoint,
            method=method,
            request_hash=request_hash
        ).first()
    
    @classmethod
    def find_valid_by_key(cls, tenant_id: str, key_hash: str, endpoint: str, method: str, request_hash: str) -> Optional['IdempotencyKey']:
        """Find valid (non-expired) idempotency key by lookup criteria"""
        return cls.query.filter_by(
            tenant_id=tenant_id,
            key_hash=key_hash,
            endpoint=endpoint,
            method=method,
            request_hash=request_hash
        ).filter(
            cls.expires_at > datetime.utcnow()
        ).first()
    
    @classmethod
    def cleanup_expired(cls) -> int:
        """Clean up expired idempotency keys"""
        expired_count = cls.query.filter(
            cls.expires_at < datetime.utcnow()
        ).delete()
        
        db.session.commit()
        return expired_count
    
    @classmethod
    def get_stats_for_tenant(cls, tenant_id: str) -> Dict[str, Any]:
        """Get idempotency key statistics for a tenant"""
        total_keys = cls.query.filter_by(tenant_id=tenant_id).count()
        expired_keys = cls.query.filter_by(tenant_id=tenant_id).filter(
            cls.expires_at < datetime.utcnow()
        ).count()
        active_keys = total_keys - expired_keys
        
        return {
            'total_keys': total_keys,
            'active_keys': active_keys,
            'expired_keys': expired_keys
        }
    
    def is_expired(self) -> bool:
        """Check if this idempotency key is expired"""
        return self.expires_at < datetime.utcnow()
    
    def extend_expiration(self, hours: int = 24):
        """Extend the expiration time of this idempotency key"""
        self.expires_at = datetime.utcnow() + timedelta(hours=hours)
        db.session.commit()
    
    def get_cached_response(self) -> Dict[str, Any]:
        """Get the cached response data"""
        return {
            'status': self.response_status,
            'body': self.response_body,
            'headers': self.response_headers
        }
