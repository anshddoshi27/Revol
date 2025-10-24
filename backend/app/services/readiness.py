"""
Tenant Readiness Service

This service handles tenant go-live readiness validation and status management.
It ensures tenants are properly configured before allowing public booking access.
"""

from typing import Dict, List, Tuple, Optional
from ..models.core import Tenant
from ..models.business import Service, Resource
from ..models.financial import TenantBilling
from ..extensions import db
import logging

logger = logging.getLogger(__name__)


class TenantReadinessService:
    """Service for tenant readiness validation and status management."""
    
    def __init__(self):
        self.required_policies = [
            'cancellation_policy',
            'no_show_policy', 
            'rescheduling_policy',
            'payment_policy',
            'refund_policy'
        ]
    
    def check_tenant_readiness(self, tenant_id: str) -> Tuple[bool, Dict[str, any]]:
        """
        Check if a tenant is ready for go-live.
        
        Args:
            tenant_id: The tenant ID to check
            
        Returns:
            Tuple of (is_ready, requirements_dict)
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                return False, {"error": "Tenant not found"}
            
            requirements = {
                "stripe_connected": self._check_stripe_connection(tenant_id),
                "has_services": self._check_has_services(tenant_id),
                "has_availability": self._check_has_availability(tenant_id),
                "has_policies": self._check_has_policies(tenant),
                "has_business_info": self._check_has_business_info(tenant)
            }
            
            # Calculate overall readiness
            is_ready = all(requirements.values())
            
            # Get unmet requirements for admin UI
            unmet_requirements = self._get_unmet_requirements(requirements)
            
            return is_ready, {
                "is_ready": is_ready,
                "requirements": requirements,
                "unmet_requirements": unmet_requirements,
                "tenant_status": tenant.status
            }
            
        except Exception as e:
            logger.error(f"Error checking tenant readiness: {str(e)}")
            return False, {"error": str(e)}
    
    def _check_stripe_connection(self, tenant_id: str) -> bool:
        """Check if tenant has Stripe Connect set up."""
        try:
            billing = TenantBilling.query.filter_by(tenant_id=tenant_id).first()
            return billing and billing.stripe_connect_enabled and billing.stripe_connect_id
        except Exception as e:
            logger.error(f"Error checking Stripe connection: {str(e)}")
            return False
    
    def _check_has_services(self, tenant_id: str) -> bool:
        """Check if tenant has at least one active service."""
        try:
            service_count = Service.query.filter_by(
                tenant_id=tenant_id,
                is_active=True,
                deleted_at=None
            ).count()
            return service_count > 0
        except Exception as e:
            logger.error(f"Error checking services: {str(e)}")
            return False
    
    def _check_has_availability(self, tenant_id: str) -> bool:
        """Check if tenant has at least one availability window."""
        try:
            # Check for staff availability
            staff_count = Resource.query.filter_by(
                tenant_id=tenant_id,
                type='staff',
                is_active=True,
                deleted_at=None
            ).count()
            
            # For now, just check if there are staff members
            # In production, this would check actual availability windows
            return staff_count > 0
        except Exception as e:
            logger.error(f"Error checking availability: {str(e)}")
            return False
    
    def _check_has_policies(self, tenant: Tenant) -> bool:
        """Check if tenant has all required policies."""
        try:
            policies = tenant.trust_copy_json or {}
            
            # Check if all required policies are present and not empty
            for policy_key in self.required_policies:
                if not policies.get(policy_key) or not policies[policy_key].strip():
                    return False
            
            return True
        except Exception as e:
            logger.error(f"Error checking policies: {str(e)}")
            return False
    
    def _check_has_business_info(self, tenant: Tenant) -> bool:
        """Check if tenant has essential business information."""
        try:
            # Check for essential business fields
            essential_fields = [
                tenant.name,
                tenant.email,
                tenant.phone
            ]
            
            # All essential fields must be present
            return all(field and str(field).strip() for field in essential_fields)
        except Exception as e:
            logger.error(f"Error checking business info: {str(e)}")
            return False
    
    def _get_unmet_requirements(self, requirements: Dict[str, bool]) -> List[str]:
        """Get list of unmet requirements for admin UI."""
        unmet = []
        
        if not requirements.get("stripe_connected", False):
            unmet.append("Stripe Connect account not set up")
        
        if not requirements.get("has_services", False):
            unmet.append("No active services configured")
        
        if not requirements.get("has_availability", False):
            unmet.append("No staff availability configured")
        
        if not requirements.get("has_policies", False):
            unmet.append("Required policies not configured")
        
        if not requirements.get("has_business_info", False):
            unmet.append("Essential business information missing")
        
        return unmet
    
    def update_tenant_status(self, tenant_id: str) -> bool:
        """
        Update tenant status based on readiness.
        
        Args:
            tenant_id: The tenant ID to update
            
        Returns:
            True if status was updated, False otherwise
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                return False
            
            is_ready, _ = self.check_tenant_readiness(tenant_id)
            
            # Update status based on readiness
            if is_ready and tenant.status == "onboarding":
                tenant.status = "ready"
                db.session.commit()
                logger.info(f"Tenant {tenant_id} status updated to 'ready'")
                return True
            elif not is_ready and tenant.status == "ready":
                tenant.status = "onboarding"
                db.session.commit()
                logger.info(f"Tenant {tenant_id} status reverted to 'onboarding'")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error updating tenant status: {str(e)}")
            return False
    
    def get_go_live_requirements(self, tenant_id: str) -> Dict[str, any]:
        """
        Get go-live requirements for admin UI.
        
        Args:
            tenant_id: The tenant ID to get requirements for
            
        Returns:
            Dictionary with requirements and status
        """
        try:
            is_ready, requirements = self.check_tenant_readiness(tenant_id)
            
            return {
                "tenant_id": tenant_id,
                "is_ready": is_ready,
                "can_go_live": is_ready,
                "requirements": {
                    "stripe_connected": {
                        "met": requirements["requirements"]["stripe_connected"],
                        "description": "Stripe Connect account must be set up for payments"
                    },
                    "has_services": {
                        "met": requirements["requirements"]["has_services"],
                        "description": "At least one active service must be configured"
                    },
                    "has_availability": {
                        "met": requirements["requirements"]["has_availability"],
                        "description": "Staff availability must be configured"
                    },
                    "has_policies": {
                        "met": requirements["requirements"]["has_policies"],
                        "description": "All required policies must be configured"
                    },
                    "has_business_info": {
                        "met": requirements["requirements"]["has_business_info"],
                        "description": "Essential business information must be complete"
                    }
                },
                "unmet_requirements": requirements["unmet_requirements"],
                "tenant_status": requirements["tenant_status"]
            }
            
        except Exception as e:
            logger.error(f"Error getting go-live requirements: {str(e)}")
            return {
                "tenant_id": tenant_id,
                "is_ready": False,
                "can_go_live": False,
                "error": str(e)
            }
