"""
Feature Flag Model
Supports canary deployments, A/B testing, and gradual feature rollouts
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import BaseModel


class FeatureFlag(BaseModel):
    """Feature flag configuration for canary deployments."""
    
    __tablename__ = 'feature_flags'
    
    # Basic flag information
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text)
    enabled = Column(Boolean, default=False, nullable=False)
    
    # Rollout configuration
    rollout_percentage = Column(Integer, default=0, nullable=False)  # 0-100
    rollout_strategy = Column(String(50), default='percentage', nullable=False)  # percentage, user_id, tenant_id, custom
    
    # Targeting rules
    target_tenants = Column(JSON)  # List of tenant IDs
    target_users = Column(JSON)   # List of user IDs
    target_conditions = Column(JSON)  # Custom targeting conditions
    
    # A/B testing configuration
    variant_a_percentage = Column(Integer, default=50, nullable=False)
    variant_b_percentage = Column(Integer, default=50, nullable=False)
    variant_a_config = Column(JSON)  # Configuration for variant A
    variant_b_config = Column(JSON)  # Configuration for variant B
    
    # Deployment configuration
    canary_percentage = Column(Integer, default=0, nullable=False)  # 0-100
    canary_duration_hours = Column(Integer, default=24, nullable=False)
    auto_promote_threshold = Column(Integer, default=95, nullable=False)  # Success rate threshold
    
    # Monitoring and metrics
    success_metrics = Column(JSON)  # Metrics to track for success
    failure_metrics = Column(JSON)  # Metrics to track for failures
    alert_thresholds = Column(JSON)  # Thresholds for automatic rollback
    
    # Lifecycle management
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    approved_by = Column(Integer, ForeignKey('users.id'))
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    
    # Relationships
    creator = relationship('User', foreign_keys=[created_by], backref='created_feature_flags')
    approver = relationship('User', foreign_keys=[approved_by], backref='approved_feature_flags')
    evaluations = relationship('FeatureFlagEvaluation', backref='feature_flag', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<FeatureFlag {self.name}: {self.enabled}>'
    
    def is_enabled_for_tenant(self, tenant_id: int) -> bool:
        """Check if feature flag is enabled for a specific tenant."""
        if not self.enabled:
            return False
        
        # Check tenant targeting
        if self.target_tenants:
            if tenant_id not in self.target_tenants:
                return False
        
        # Check rollout percentage
        if self.rollout_strategy == 'percentage':
            # Use tenant_id as seed for consistent rollout
            hash_value = hash(f"{self.name}_{tenant_id}") % 100
            return hash_value < self.rollout_percentage
        
        return True
    
    def is_enabled_for_user(self, user_id: int, tenant_id: int) -> bool:
        """Check if feature flag is enabled for a specific user."""
        if not self.is_enabled_for_tenant(tenant_id):
            return False
        
        # Check user targeting
        if self.target_users:
            if user_id not in self.target_users:
                return False
        
        # Check rollout percentage
        if self.rollout_strategy == 'percentage':
            hash_value = hash(f"{self.name}_{user_id}") % 100
            return hash_value < self.rollout_percentage
        
        return True
    
    def get_variant_for_user(self, user_id: int, tenant_id: int) -> str:
        """Get A/B test variant for a user."""
        if not self.is_enabled_for_user(user_id, tenant_id):
            return 'control'
        
        # Use user_id as seed for consistent variant assignment
        hash_value = hash(f"{self.name}_variant_{user_id}") % 100
        
        if hash_value < self.variant_a_percentage:
            return 'variant_a'
        else:
            return 'variant_b'
    
    def get_config_for_user(self, user_id: int, tenant_id: int) -> dict:
        """Get configuration for a user based on their variant."""
        variant = self.get_variant_for_user(user_id, tenant_id)
        
        if variant == 'variant_a':
            return self.variant_a_config or {}
        elif variant == 'variant_b':
            return self.variant_b_config or {}
        else:
            return {}


class FeatureFlagEvaluation(BaseModel):
    """Track feature flag evaluations and metrics."""
    
    __tablename__ = 'feature_flag_evaluations'
    
    # References
    feature_flag_id = Column(Integer, ForeignKey('feature_flags.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)
    
    # Evaluation details
    enabled = Column(Boolean, nullable=False)
    variant = Column(String(20))  # control, variant_a, variant_b
    config_used = Column(JSON)
    
    # Context
    request_id = Column(String(100))  # For tracing
    user_agent = Column(String(500))
    ip_address = Column(String(45))
    
    # Relationships
    user = relationship('User', backref='feature_flag_evaluations')
    tenant = relationship('Tenant', backref='feature_flag_evaluations')
    
    def __repr__(self):
        return f'<FeatureFlagEvaluation {self.feature_flag_id}: {self.enabled}>'


class FeatureFlagMetric(BaseModel):
    """Track metrics for feature flag performance."""
    
    __tablename__ = 'feature_flag_metrics'
    
    # References
    feature_flag_id = Column(Integer, ForeignKey('feature_flags.id'), nullable=False)
    
    # Metric details
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Integer, nullable=False)
    metric_type = Column(String(20), nullable=False)  # counter, gauge, histogram
    
    # Time period
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    
    # Context
    variant = Column(String(20))  # control, variant_a, variant_b
    tenant_id = Column(Integer, ForeignKey('tenants.id'))
    
    # Relationships
    tenant = relationship('Tenant', backref='feature_flag_metrics')
    
    def __repr__(self):
        return f'<FeatureFlagMetric {self.metric_name}: {self.metric_value}>'
