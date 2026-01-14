"""
Core Services

This module contains core business logic services for tenants and users.
"""

import uuid
from typing import Dict, Any, Optional
from ..extensions import db
from ..models.core import Tenant, User, Membership


class TenantService:
    """Service for tenant-related business logic."""
    
    def create_tenant(self, tenant_data: Dict[str, Any], created_by: str) -> Tenant:
        """Create a new tenant."""
        tenant = Tenant(
            name=tenant_data["name"],
            email=tenant_data["email"],
            slug=tenant_data.get("slug"),
            tz=tenant_data.get("timezone", "UTC"),
            category=tenant_data.get("category", ""),
            logo_url=tenant_data.get("logo_url"),
            locale=tenant_data.get("locale", "en_US"),
            status="onboarding",
            legal_name=tenant_data.get("legal_name"),
            phone=tenant_data.get("phone"),
            business_timezone=tenant_data.get("timezone", "UTC"),
            address_json=tenant_data.get("address", {}),
            social_links_json=tenant_data.get("socials", {}),
            branding_json=tenant_data.get("branding", {}),
            policies_json=tenant_data.get("policies", {})
        )
        
        db.session.add(tenant)
        db.session.commit()
        
        # Create membership for the creator
        membership = Membership(
            tenant_id=tenant.id,
            user_id=created_by,
            role="owner"
        )
        db.session.add(membership)
        db.session.commit()
        
        return tenant
    
    def get_tenant_by_id(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID."""
        return Tenant.query.get(tenant_id)
    
    def get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        """Get tenant by slug."""
        return Tenant.query.filter_by(slug=slug).first()


class UserService:
    """Service for user-related business logic."""
    
    def create_user(self, user_data: Dict[str, Any]) -> User:
        """Create a new user."""
        user = User(
            email=user_data["email"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            phone=user_data.get("phone"),
            password_hash=user_data.get("password_hash")
        )
        
        db.session.add(user)
        db.session.commit()
        
        return user
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        return User.query.get(user_id)
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return User.query.filter_by(email=email).first()
