"""
Feature Flag Service
Manages feature flags, canary deployments, and A/B testing
"""

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import structlog
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.feature_flag import FeatureFlag, FeatureFlagEvaluation, FeatureFlagMetric
from app.models.user import User
from app.models.tenant import Tenant
from app.extensions import db

logger = structlog.get_logger(__name__)


class FeatureFlagService:
    """Service for managing feature flags and canary deployments."""
    
    def __init__(self):
        self.cache = {}  # Simple in-memory cache for feature flags
        self.cache_ttl = 300  # 5 minutes
    
    def get_feature_flag(self, name: str, user_id: int, tenant_id: int) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Get feature flag status for a user.
        Returns: (enabled, variant, config)
        """
        try:
            # Check cache first
            cache_key = f"{name}_{user_id}_{tenant_id}"
            if cache_key in self.cache:
                cached_data, timestamp = self.cache[cache_key]
                if datetime.utcnow() - timestamp < timedelta(seconds=self.cache_ttl):
                    return cached_data
            
            # Query database
            feature_flag = db.session.query(FeatureFlag).filter(
                FeatureFlag.name == name,
                FeatureFlag.enabled == True
            ).first()
            
            if not feature_flag:
                result = (False, 'control', {})
            else:
                enabled = feature_flag.is_enabled_for_user(user_id, tenant_id)
                variant = feature_flag.get_variant_for_user(user_id, tenant_id)
                config = feature_flag.get_config_for_user(user_id, tenant_id)
                result = (enabled, variant, config)
            
            # Cache result
            self.cache[cache_key] = (result, datetime.utcnow())
            
            # Log evaluation
            self._log_evaluation(feature_flag, user_id, tenant_id, enabled, variant, config)
            
            return result
            
        except Exception as e:
            logger.error("Failed to get feature flag", error=str(e), name=name, user_id=user_id, tenant_id=tenant_id)
            return (False, 'control', {})
    
    def create_feature_flag(self, name: str, description: str, created_by: int, 
                           rollout_percentage: int = 0, **kwargs) -> FeatureFlag:
        """Create a new feature flag."""
        try:
            feature_flag = FeatureFlag(
                name=name,
                description=description,
                created_by=created_by,
                rollout_percentage=rollout_percentage,
                **kwargs
            )
            
            db.session.add(feature_flag)
            db.session.commit()
            
            logger.info("Feature flag created", name=name, created_by=created_by)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to create feature flag", error=str(e), name=name)
            raise
    
    def update_feature_flag(self, flag_id: int, **kwargs) -> FeatureFlag:
        """Update a feature flag."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            for key, value in kwargs.items():
                if hasattr(feature_flag, key):
                    setattr(feature_flag, key, value)
            
            db.session.commit()
            
            # Clear cache
            self._clear_cache_for_flag(feature_flag.name)
            
            logger.info("Feature flag updated", flag_id=flag_id, **kwargs)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to update feature flag", error=str(e), flag_id=flag_id)
            raise
    
    def enable_feature_flag(self, flag_id: int, approved_by: int) -> FeatureFlag:
        """Enable a feature flag with approval."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            feature_flag.enabled = True
            feature_flag.approved_by = approved_by
            
            db.session.commit()
            
            # Clear cache
            self._clear_cache_for_flag(feature_flag.name)
            
            logger.info("Feature flag enabled", flag_id=flag_id, approved_by=approved_by)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to enable feature flag", error=str(e), flag_id=flag_id)
            raise
    
    def disable_feature_flag(self, flag_id: int) -> FeatureFlag:
        """Disable a feature flag."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            feature_flag.enabled = False
            
            db.session.commit()
            
            # Clear cache
            self._clear_cache_for_flag(feature_flag.name)
            
            logger.info("Feature flag disabled", flag_id=flag_id)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to disable feature flag", error=str(e), flag_id=flag_id)
            raise
    
    def start_canary_deployment(self, flag_id: int, canary_percentage: int, 
                               duration_hours: int = 24) -> FeatureFlag:
        """Start a canary deployment."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            feature_flag.enabled = True
            feature_flag.canary_percentage = canary_percentage
            feature_flag.canary_duration_hours = duration_hours
            feature_flag.scheduled_start = datetime.utcnow()
            feature_flag.scheduled_end = datetime.utcnow() + timedelta(hours=duration_hours)
            
            db.session.commit()
            
            # Clear cache
            self._clear_cache_for_flag(feature_flag.name)
            
            logger.info("Canary deployment started", flag_id=flag_id, 
                       canary_percentage=canary_percentage, duration_hours=duration_hours)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to start canary deployment", error=str(e), flag_id=flag_id)
            raise
    
    def promote_canary_deployment(self, flag_id: int) -> FeatureFlag:
        """Promote canary deployment to full rollout."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            feature_flag.rollout_percentage = 100
            feature_flag.canary_percentage = 0
            
            db.session.commit()
            
            # Clear cache
            self._clear_cache_for_flag(feature_flag.name)
            
            logger.info("Canary deployment promoted", flag_id=flag_id)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to promote canary deployment", error=str(e), flag_id=flag_id)
            raise
    
    def rollback_canary_deployment(self, flag_id: int) -> FeatureFlag:
        """Rollback canary deployment."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            feature_flag.enabled = False
            feature_flag.canary_percentage = 0
            feature_flag.rollout_percentage = 0
                
                db.session.commit()
            
            # Clear cache
            self._clear_cache_for_flag(feature_flag.name)
            
            logger.info("Canary deployment rolled back", flag_id=flag_id)
            return feature_flag
            
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to rollback canary deployment", error=str(e), flag_id=flag_id)
            raise
    
    def get_feature_flag_metrics(self, flag_id: int, period_hours: int = 24) -> Dict[str, Any]:
        """Get metrics for a feature flag."""
        try:
            period_start = datetime.utcnow() - timedelta(hours=period_hours)
            
            # Get evaluations
            evaluations = db.session.query(FeatureFlagEvaluation).filter(
                FeatureFlagEvaluation.feature_flag_id == flag_id,
                FeatureFlagEvaluation.created_at >= period_start
            ).all()
            
            # Get metrics
            metrics = db.session.query(FeatureFlagMetric).filter(
                FeatureFlagMetric.feature_flag_id == flag_id,
                FeatureFlagMetric.period_start >= period_start
            ).all()
            
            # Calculate statistics
            total_evaluations = len(evaluations)
            enabled_evaluations = sum(1 for e in evaluations if e.enabled)
            variant_counts = {}
            for evaluation in evaluations:
                variant = evaluation.variant or 'control'
                variant_counts[variant] = variant_counts.get(variant, 0) + 1
            
            # Calculate success rates
            success_rates = {}
            for metric in metrics:
                if metric.metric_name not in success_rates:
                    success_rates[metric.metric_name] = {}
                success_rates[metric.metric_name][metric.variant] = metric.metric_value
            
            return {
                'total_evaluations': total_evaluations,
                'enabled_evaluations': enabled_evaluations,
                'enabled_percentage': (enabled_evaluations / total_evaluations * 100) if total_evaluations > 0 else 0,
                'variant_counts': variant_counts,
                'success_rates': success_rates,
                'period_hours': period_hours,
                'period_start': period_start.isoformat()
            }
            
        except Exception as e:
            logger.error("Failed to get feature flag metrics", error=str(e), flag_id=flag_id)
            return {}
    
    def check_canary_health(self, flag_id: int) -> Dict[str, Any]:
        """Check health of canary deployment."""
        try:
            feature_flag = db.session.query(FeatureFlag).get(flag_id)
            if not feature_flag:
                raise ValueError(f"Feature flag {flag_id} not found")
            
            metrics = self.get_feature_flag_metrics(flag_id, 1)  # Last hour
            
            # Check success rates against thresholds
            health_status = 'healthy'
            alerts = []
            
            for metric_name, rates in metrics.get('success_rates', {}).items():
                for variant, rate in rates.items():
                    if rate < feature_flag.auto_promote_threshold:
                        health_status = 'unhealthy'
                        alerts.append(f"{metric_name} for {variant} below threshold: {rate}% < {feature_flag.auto_promote_threshold}%")
            
            # Check if canary duration has expired
            if feature_flag.scheduled_end and datetime.utcnow() > feature_flag.scheduled_end:
                alerts.append("Canary deployment duration expired")
            
            return {
                'health_status': health_status,
                'alerts': alerts,
                'metrics': metrics,
                'canary_percentage': feature_flag.canary_percentage,
                'auto_promote_threshold': feature_flag.auto_promote_threshold
            }
            
        except Exception as e:
            logger.error("Failed to check canary health", error=str(e), flag_id=flag_id)
            return {'health_status': 'error', 'alerts': [str(e)]}
    
    def _log_evaluation(self, feature_flag: Optional[FeatureFlag], user_id: int, 
                       tenant_id: int, enabled: bool, variant: str, config: Dict[str, Any]):
        """Log feature flag evaluation."""
        try:
            if not feature_flag:
                return
            
            evaluation = FeatureFlagEvaluation(
                feature_flag_id=feature_flag.id,
                user_id=user_id,
                tenant_id=tenant_id,
                enabled=enabled,
                variant=variant,
                config_used=config
            )
            
            db.session.add(evaluation)
            db.session.commit()
            
        except Exception as e:
            logger.error("Failed to log feature flag evaluation", error=str(e))
            db.session.rollback()
    
    def _clear_cache_for_flag(self, flag_name: str):
        """Clear cache for a specific feature flag."""
        keys_to_remove = [key for key in self.cache.keys() if key.startswith(f"{flag_name}_")]
        for key in keys_to_remove:
            del self.cache[key]


# Global feature flag service instance
feature_flag_service = FeatureFlagService()