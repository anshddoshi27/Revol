"""
System Services

This module contains system-related business logic services.
"""

from typing import Dict, Any
from ..extensions import db
from ..models.system import Theme, Branding


class ThemeService:
    """Service for theme-related business logic."""
    
    def create_theme(self, theme_data: Dict[str, Any]) -> Theme:
        """Create a new theme."""
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
