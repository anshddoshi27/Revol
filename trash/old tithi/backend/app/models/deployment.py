"""
Deployment Model
Tracks deployment history and rollback information
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import BaseModel


class Deployment(BaseModel):
    """Deployment tracking model."""
    
    __tablename__ = 'deployments'
    
    # Deployment information
    version = Column(String(50), nullable=False, index=True)
    environment = Column(String(20), nullable=False)  # blue, green
    status = Column(String(20), nullable=False, default='in_progress')  # in_progress, completed, failed, rolled_back
    
    # Configuration
    config = Column(JSON)  # Deployment configuration
    
    # Timing
    started_at = Column(DateTime, nullable=False, default=func.now())
    completed_at = Column(DateTime)
    
    # Error handling
    error_message = Column(Text)
    
    # Rollback information
    parent_deployment_id = Column(Integer, ForeignKey('deployments.id'))
    rolled_back_at = Column(DateTime)
    
    # Relationships
    parent_deployment = relationship('Deployment', remote_side=[id], backref='child_deployments')
    
    def __repr__(self):
        return f'<Deployment {self.version}: {self.status}>'
    
    @property
    def duration(self):
        """Get deployment duration."""
        if self.completed_at and self.started_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
    
    @property
    def is_successful(self):
        """Check if deployment was successful."""
        return self.status == 'completed'
    
    @property
    def is_failed(self):
        """Check if deployment failed."""
        return self.status == 'failed'
    
    @property
    def is_rolled_back(self):
        """Check if deployment was rolled back."""
        return self.status == 'rolled_back'
