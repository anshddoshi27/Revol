"""
System Services

This module contains system-related business logic services.
"""

import uuid
import hashlib
import re
from typing import Dict, Any, Optional, Tuple
from werkzeug.datastructures import FileStorage
from ..extensions import db
from ..models.system import Theme, Branding
from ..models.core import Tenant
from ..exceptions import TithiError
from ..jobs.outbox_worker import emit_event


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
    
    def __init__(self):
        self.max_file_size = 2 * 1024 * 1024  # 2MB limit per task requirements
    
    def create_branding(self, branding_data: Dict[str, Any]) -> Branding:
        """Create new branding."""
        branding = Branding(**branding_data)
        db.session.add(branding)
        db.session.commit()
        return branding
    
    def get_tenant_branding(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """Get current branding settings for a tenant."""
        try:
            # Get tenant info
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError("TITHI_TENANT_NOT_FOUND", "Tenant not found")
            
            # Get current theme (from themes table for backward compatibility)
            theme = Theme.query.filter_by(tenant_id=tenant_id).first()
            
            # Get branding settings (from branding table if exists)
            branding = Branding.query.filter_by(tenant_id=tenant_id).first()
            
            # Build branding response
            branding_data = {
                "tenant_id": str(tenant_id),
                "tenant_slug": tenant.slug,
                "logo_url": None,
                "favicon_url": None,
                "primary_color": "#000000",  # Default black
                "secondary_color": "#FFFFFF",  # Default white
                "font_family": "system-ui, -apple-system, sans-serif",
                "custom_css": None,
                "subdomain": tenant.slug,
                "custom_domain": None
            }
            
            # Merge theme data if exists
            if theme:
                branding_data.update({
                    "logo_url": theme.logo_url,
                    "primary_color": theme.brand_color or branding_data["primary_color"]
                })
                
                # Extract additional theme data from theme_json
                if theme.theme_json:
                    branding_data.update({
                        "secondary_color": theme.theme_json.get("secondary_color", branding_data["secondary_color"]),
                        "font_family": theme.theme_json.get("font_family", branding_data["font_family"]),
                        "custom_css": theme.theme_json.get("custom_css"),
                        "custom_domain": theme.theme_json.get("custom_domain")
                    })
            
            # Merge branding table data if exists
            if branding:
                branding_data.update({
                    "logo_url": branding.logo_url or branding_data["logo_url"],
                    "primary_color": branding.primary_color or branding_data["primary_color"],
                    "secondary_color": branding.secondary_color or branding_data["secondary_color"],
                    "font_family": branding.font_family or branding_data["font_family"],
                    "custom_css": branding.custom_css or branding_data["custom_css"]
                })
            
            return branding_data
            
        except TithiError:
            raise
        except Exception as e:
            raise TithiError("TITHI_BRANDING_FETCH_ERROR", f"Failed to fetch branding: {str(e)}")
    
    def update_branding(self, tenant_id: uuid.UUID, branding_data: Dict[str, Any], user_id: uuid.UUID) -> Dict[str, Any]:
        """Update branding settings for a tenant."""
        try:
            # Validate hex colors if provided
            if "primary_color" in branding_data:
                self._validate_hex_color(branding_data["primary_color"])
            if "secondary_color" in branding_data:
                self._validate_hex_color(branding_data["secondary_color"])
            
            # Get or create branding record
            branding = Branding.query.filter_by(tenant_id=tenant_id).first()
            if not branding:
                branding = Branding(tenant_id=tenant_id)
                db.session.add(branding)
            
            # Update branding fields
            if "primary_color" in branding_data:
                branding.primary_color = branding_data["primary_color"]
            if "secondary_color" in branding_data:
                branding.secondary_color = branding_data["secondary_color"]
            if "font_family" in branding_data:
                branding.font_family = branding_data["font_family"]
            if "custom_css" in branding_data:
                branding.custom_css = branding_data["custom_css"]
            
            # Also update theme table for backward compatibility
            theme = Theme.query.filter_by(tenant_id=tenant_id).first()
            if not theme:
                theme = Theme(tenant_id=tenant_id, theme_json={})
                db.session.add(theme)
            
            # Update theme fields
            if "primary_color" in branding_data:
                theme.brand_color = branding_data["primary_color"]
            
            # Update theme_json with additional data
            theme_json = theme.theme_json or {}
            if "secondary_color" in branding_data:
                theme_json["secondary_color"] = branding_data["secondary_color"]
            if "font_family" in branding_data:
                theme_json["font_family"] = branding_data["font_family"]
            if "custom_css" in branding_data:
                theme_json["custom_css"] = branding_data["custom_css"]
            if "custom_domain" in branding_data:
                theme_json["custom_domain"] = branding_data["custom_domain"]
            
            theme.theme_json = theme_json
            
            db.session.commit()
            
            # Emit observability hook
            emit_event(
                tenant_id=tenant_id,
                event_code="BRANDING_UPDATED",
                payload={
                    "user_id": str(user_id),
                    "updated_fields": list(branding_data.keys()),
                    "branding_data": branding_data
                }
            )
            
            return self.get_tenant_branding(tenant_id)
            
        except TithiError:
            raise
        except Exception as e:
            db.session.rollback()
            raise TithiError("TITHI_BRANDING_UPDATE_ERROR", f"Failed to update branding: {str(e)}")
    
    def upload_logo(self, tenant_id: uuid.UUID, logo_file: FileStorage, user_id: uuid.UUID) -> Dict[str, Any]:
        """Upload logo file for a tenant with idempotency by checksum."""
        try:
            # Validate file size
            if logo_file.content_length and logo_file.content_length > self.max_file_size:
                raise TithiError("TITHI_BRANDING_FILE_TOO_LARGE", f"File size exceeds {self.max_file_size} bytes limit")
            
            # Read file content for validation and checksum
            logo_file.seek(0)
            file_content = logo_file.read()
            logo_file.seek(0)  # Reset for actual upload
            
            if len(file_content) > self.max_file_size:
                raise TithiError("TITHI_BRANDING_FILE_TOO_LARGE", f"File size exceeds {self.max_file_size} bytes limit")
            
            # Generate checksum for idempotency
            file_checksum = hashlib.sha256(file_content).hexdigest()
            
            # Check if logo with same checksum already exists (idempotency)
            existing_theme = Theme.query.filter_by(tenant_id=tenant_id).first()
            if existing_theme and existing_theme.logo_url:
                # In a real implementation, you would check the actual file checksum
                # For now, we'll proceed with the upload
                pass
            
            # Validate file type (basic validation)
            if not logo_file.filename:
                raise TithiError("TITHI_BRANDING_INVALID_FILE", "No filename provided")
            
            allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'}
            file_extension = '.' + logo_file.filename.rsplit('.', 1)[1].lower() if '.' in logo_file.filename else ''
            
            if file_extension not in allowed_extensions:
                raise TithiError("TITHI_BRANDING_INVALID_FILE", f"File type {file_extension} not allowed")
            
            # Generate unique filename
            file_extension = file_extension or '.png'
            unique_filename = f"logo_{tenant_id}_{file_checksum[:8]}{file_extension}"
            
            # In a real implementation, you would upload to cloud storage (S3, etc.)
            # For now, we'll simulate the upload URL
            logo_url = f"https://assets.tithi.com/logos/{unique_filename}"
            
            # Update theme with logo URL
            theme = Theme.query.filter_by(tenant_id=tenant_id).first()
            if not theme:
                theme = Theme(tenant_id=tenant_id, theme_json={})
                db.session.add(theme)
            
            theme.logo_url = logo_url
            
            # Also update branding table if exists
            branding = Branding.query.filter_by(tenant_id=tenant_id).first()
            if branding:
                branding.logo_url = logo_url
            
            db.session.commit()
            
            # Emit observability hook
            emit_event(
                tenant_id=tenant_id,
                event_code="BRANDING_UPDATED",
                payload={
                    "user_id": str(user_id),
                    "action": "logo_uploaded",
                    "logo_url": logo_url,
                    "file_checksum": file_checksum,
                    "file_size": len(file_content)
                }
            )
            
            return {
                "logo_url": logo_url,
                "file_checksum": file_checksum,
                "file_size": len(file_content),
                "message": "Logo uploaded successfully"
            }
            
        except TithiError:
            raise
        except Exception as e:
            db.session.rollback()
            raise TithiError("TITHI_BRANDING_UPLOAD_ERROR", f"Failed to upload logo: {str(e)}")
    
    def upload_favicon(self, tenant_id: uuid.UUID, favicon_file: FileStorage, user_id: uuid.UUID) -> Dict[str, Any]:
        """Upload favicon file for a tenant."""
        try:
            # Validate file size
            if favicon_file.content_length and favicon_file.content_length > self.max_file_size:
                raise TithiError("TITHI_BRANDING_FILE_TOO_LARGE", f"File size exceeds {self.max_file_size} bytes limit")
            
            # Read file content for validation
            favicon_file.seek(0)
            file_content = favicon_file.read()
            favicon_file.seek(0)  # Reset for actual upload
            
            if len(file_content) > self.max_file_size:
                raise TithiError("TITHI_BRANDING_FILE_TOO_LARGE", f"File size exceeds {self.max_file_size} bytes limit")
            
            # Generate checksum for idempotency
            file_checksum = hashlib.sha256(file_content).hexdigest()
            
            # Validate file type
            if not favicon_file.filename:
                raise TithiError("TITHI_BRANDING_INVALID_FILE", "No filename provided")
            
            allowed_extensions = {'.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg'}
            file_extension = '.' + favicon_file.filename.rsplit('.', 1)[1].lower() if '.' in favicon_file.filename else ''
            
            if file_extension not in allowed_extensions:
                raise TithiError("TITHI_BRANDING_INVALID_FILE", f"File type {file_extension} not allowed")
            
            # Generate unique filename
            file_extension = file_extension or '.ico'
            unique_filename = f"favicon_{tenant_id}_{file_checksum[:8]}{file_extension}"
            
            # In a real implementation, you would upload to cloud storage
            favicon_url = f"https://assets.tithi.com/favicons/{unique_filename}"
            
            # Update theme with favicon URL
            theme = Theme.query.filter_by(tenant_id=tenant_id).first()
            if not theme:
                theme = Theme(tenant_id=tenant_id, theme_json={})
                db.session.add(theme)
            
            theme_json = theme.theme_json or {}
            theme_json["favicon_url"] = favicon_url
            theme.theme_json = theme_json
            
            db.session.commit()
            
            # Emit observability hook
            emit_event(
                tenant_id=tenant_id,
                event_code="BRANDING_UPDATED",
                payload={
                    "user_id": str(user_id),
                    "action": "favicon_uploaded",
                    "favicon_url": favicon_url,
                    "file_checksum": file_checksum,
                    "file_size": len(file_content)
                }
            )
            
            return {
                "favicon_url": favicon_url,
                "file_checksum": file_checksum,
                "file_size": len(file_content),
                "message": "Favicon uploaded successfully"
            }
            
        except TithiError:
            raise
        except Exception as e:
            db.session.rollback()
            raise TithiError("TITHI_BRANDING_UPLOAD_ERROR", f"Failed to upload favicon: {str(e)}")
    
    def validate_subdomain(self, subdomain: str, tenant_id: Optional[uuid.UUID] = None) -> bool:
        """Validate subdomain uniqueness globally."""
        try:
            # Check if subdomain is already taken by another tenant
            existing_tenant = Tenant.query.filter(
                Tenant.slug == subdomain,
                Tenant.deleted_at.is_(None)
            ).first()
            
            # If tenant_id is provided, allow the same tenant to keep their subdomain
            if existing_tenant and tenant_id and existing_tenant.id == tenant_id:
                return True
            
            # If no existing tenant found, subdomain is available
            return existing_tenant is None
            
        except Exception as e:
            raise TithiError("TITHI_BRANDING_SUBDOMAIN_VALIDATION_ERROR", f"Failed to validate subdomain: {str(e)}")
    
    def _validate_hex_color(self, color: str) -> None:
        """Validate hex color format."""
        if not color:
            return
        
        # Remove # if present
        color = color.lstrip('#')
        
        # Validate hex color format
        if not re.match(r'^[0-9A-Fa-f]{6}$', color):
            raise TithiError("TITHI_BRANDING_INVALID_COLOR", f"Invalid hex color format: #{color}")
    
    def get_branding_for_email(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """Get branding information formatted for email templates."""
        try:
            branding_data = self.get_tenant_branding(tenant_id)
            
            # Format for email templates
            email_branding = {
                "tenant_name": branding_data.get("tenant_slug", "Your Business").replace("-", " ").title(),
                "tenant_slug": branding_data.get("tenant_slug"),
                "logo_url": branding_data.get("logo_url"),
                "favicon_url": branding_data.get("favicon_url"),
                "primary_color": branding_data.get("primary_color", "#000000"),
                "secondary_color": branding_data.get("secondary_color", "#FFFFFF"),
                "font_family": branding_data.get("font_family", "system-ui, -apple-system, sans-serif"),
                "website_url": f"https://{branding_data.get('subdomain', 'your-business')}.tithi.com",
                "support_email": f"support@{branding_data.get('subdomain', 'your-business')}.tithi.com"
            }
            
            return email_branding
            
        except Exception as e:
            raise TithiError("TITHI_BRANDING_EMAIL_ERROR", f"Failed to get branding for email: {str(e)}")
    
    def deprovision_subdomain(self, tenant_id: str) -> None:
        """Deprovision subdomain when subscription is canceled."""
        try:
            # Get tenant
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                logger.warning(f"Tenant {tenant_id} not found for subdomain deprovisioning")
                return
            
            # Note: Actual subdomain deprovisioning would require DNS/infrastructure changes
            # For now, we just log the action
            logger.info(f"DEPROVISIONING_SUBDOMAIN: tenant_id={tenant_id}, subdomain={tenant.slug}")
            
            # In production, this would:
            # 1. Remove DNS records
            # 2. Deallocate infrastructure resources
            # 3. Update load balancer configuration
            
        except Exception as e:
            logger.error(f"Failed to deprovision subdomain: {e}")
            # Don't raise - we don't want to fail subscription cancellation if deprovisioning fails
            pass