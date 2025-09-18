"""
System Services

This module contains system-related business logic services.
"""

from typing import Dict, Any
from ..extensions import db
from ..models.system import Theme, Branding


class ThemeService:
    """Service for theme-related business logic."""
    
    def create_theme(self, tenant_id: str, theme_data: Dict[str, Any]) -> Theme:
        """Create a new theme for a tenant."""
        theme_data['tenant_id'] = tenant_id
        theme = Theme(**theme_data)
        db.session.add(theme)
        db.session.commit()
        return theme


class BrandingService:
    """Service for branding-related business logic."""
    
    def create_branding(self, branding_data: Dict[str, Any]) -> Branding:
        """Create new branding."""
        branding = Branding(**branding_data)
        db.session.add(branding)
        db.session.commit()
        return branding
