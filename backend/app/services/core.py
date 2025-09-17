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
            timezone=tenant_data.get("timezone", "UTC"),
            currency=tenant_data.get("currency", "USD"),
            description=tenant_data.get("description", ""),
            locale=tenant_data.get("locale", "en_US"),
            created_by=created_by
        )
        
        db.session.add(tenant)
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
            phone=user_data.get("phone")
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
