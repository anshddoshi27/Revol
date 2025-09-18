"""
Onboarding Blueprint (Module C - Onboarding & Branding)

This blueprint provides the tenant onboarding wizard endpoints following the design brief Module C specifications.
It handles business registration, subdomain generation, branding controls, and theme management.

Design Brief Module C Endpoints:
- POST /v1/tenants: Create tenant + subdomain auto-generation
- PUT /v1/tenants/{id}/branding: Upload logo, colors, fonts (signed URLs storage)
- POST /v1/tenants/{id}/themes: Create versioned theme (draft)
- POST /v1/tenants/{id}/themes/{id}/publish: Set published theme
- POST /api/resolve-tenant?host=...: Tenant resolution by host
- POST /v1/tenants/{id}/domain: Connect custom domain (verify DNS, provision SSL)

Current Implementation:
- POST /onboarding/register: Register new business with subdomain generation
- GET /onboarding/check-subdomain/{subdomain}: Check subdomain availability

Features:
- Subdomain uniqueness validation
- Default branding and policy setup
- Idempotent registration
- Observability hooks
- Structured error handling
- White-label platform support
- Apple-quality UX foundation
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import re
import logging
from datetime import datetime
from ..middleware.error_handler import TithiError, TenantError
from ..middleware.auth_middleware import require_auth, get_current_user
from ..services.core import TenantService
from ..services.system import ThemeService
from ..models.core import Tenant, User, Membership
from ..extensions import db

# Configure logging
logger = logging.getLogger(__name__)

onboarding_bp = Blueprint("onboarding", __name__)


def generate_subdomain(business_name: str) -> str:
    """
    Generate a unique subdomain from business name.
    
    Args:
        business_name: The business name to convert to subdomain
        
    Returns:
        A valid subdomain string
    """
    # Convert to lowercase and replace spaces/special chars with hyphens
    subdomain = re.sub(r'[^a-z0-9]+', '-', business_name.lower())
    
    # Remove leading/trailing hyphens and limit length
    subdomain = subdomain.strip('-')[:50]
    
    # Ensure it starts with a letter
    if subdomain and not subdomain[0].isalpha():
        subdomain = 'biz-' + subdomain
    
    # Fallback if empty
    if not subdomain:
        subdomain = 'business'
    
    return subdomain


def ensure_unique_subdomain(base_subdomain: str, max_attempts: int = 10) -> str:
    """
    Ensure subdomain is unique by appending numbers if needed.
    
    Args:
        base_subdomain: The base subdomain to make unique
        max_attempts: Maximum attempts to find unique subdomain
        
    Returns:
        A unique subdomain string
        
    Raises:
        TithiError: If unable to generate unique subdomain
    """
    subdomain = base_subdomain
    
    for attempt in range(max_attempts):
        # Check if subdomain exists
        existing_tenant = Tenant.query.filter_by(slug=subdomain, deleted_at=None).first()
        
        if not existing_tenant:
            return subdomain
        
        # Try with number suffix
        subdomain = f"{base_subdomain}-{attempt + 1}"
    
    # If we've exhausted attempts, use UUID suffix
    subdomain = f"{base_subdomain}-{str(uuid.uuid4())[:8]}"
    
    # Final check
    existing_tenant = Tenant.query.filter_by(slug=subdomain, deleted_at=None).first()
    if existing_tenant:
        raise TithiError(
            message="Unable to generate unique subdomain",
            code="TITHI_TENANT_SUBDOMAIN_GENERATION_FAILED",
            status_code=500
        )
    
    return subdomain


def create_default_theme(tenant_id: str) -> None:
    """
    Create default theme for new tenant.
    
    Args:
        tenant_id: The tenant ID to create theme for
    """
    try:
        theme_service = ThemeService()
        default_theme = {
            "brand_color": "#000000",
            "logo_url": None,
            "theme_json": {
                "primary_color": "#000000",
                "secondary_color": "#ffffff",
                "accent_color": "#007bff",
                "font_family": "Inter, sans-serif",
                "border_radius": "8px",
                "button_style": "rounded"
            }
        }
        theme_service.create_theme(tenant_id, default_theme)
        logger.info(f"Created default theme for tenant {tenant_id}")
    except Exception as e:
        logger.error(f"Failed to create default theme for tenant {tenant_id}: {str(e)}")
        # Don't fail the entire registration for theme creation failure


def create_default_policies(tenant_id: str) -> None:
    """
    Create default policies for new tenant.
    
    Args:
        tenant_id: The tenant ID to create policies for
    """
    try:
        # Update tenant with default policies
        tenant = Tenant.query.get(tenant_id)
        if tenant:
            # Set default no-show fee percentage
            tenant.default_no_show_fee_percent = 3.00
            
            # Set default trust copy
            tenant.trust_copy_json = {
                "cancellation_policy": "Cancellations must be made at least 24 hours in advance.",
                "no_show_policy": "No-show appointments will be charged a 3% fee.",
                "rescheduling_policy": "Rescheduling is allowed up to 2 hours before your appointment.",
                "payment_policy": "Payment is required at the time of booking.",
                "refund_policy": "Refunds are available for cancellations made 24+ hours in advance."
            }
            
            # Set default billing configuration
            tenant.billing_json = {
                "currency": "USD",
                "timezone": "UTC",
                "business_hours": {
                    "monday": {"start": "09:00", "end": "17:00", "closed": False},
                    "tuesday": {"start": "09:00", "end": "17:00", "closed": False},
                    "wednesday": {"start": "09:00", "end": "17:00", "closed": False},
                    "thursday": {"start": "09:00", "end": "17:00", "closed": False},
                    "friday": {"start": "09:00", "end": "17:00", "closed": False},
                    "saturday": {"start": "10:00", "end": "16:00", "closed": False},
                    "sunday": {"start": "10:00", "end": "16:00", "closed": True}
                },
                "booking_advance_days": 30,
                "booking_buffer_minutes": 15
            }
            
            db.session.commit()
            logger.info(f"Created default policies for tenant {tenant_id}")
    except Exception as e:
        logger.error(f"Failed to create default policies for tenant {tenant_id}: {str(e)}")
        # Don't fail the entire registration for policy creation failure


@onboarding_bp.route("/register", methods=["POST"])
@require_auth
def register_business():
    """
    Register a new business with subdomain generation and default setup.
    
    Request Body:
        {
            "business_name": "string (required)",
            "category": "string (optional)",
            "logo": "string (optional, base64 or URL)",
            "policies": {
                "cancellation_policy": "string (optional)",
                "no_show_policy": "string (optional)",
                "rescheduling_policy": "string (optional)",
                "payment_policy": "string (optional)",
                "refund_policy": "string (optional)"
            },
            "owner_email": "string (required)",
            "owner_name": "string (required)",
            "timezone": "string (optional, default: UTC)",
            "currency": "string (optional, default: USD)",
            "locale": "string (optional, default: en_US)"
        }
    
    Returns:
        JSON response with tenant record and subdomain
    """
    try:
        data = request.get_json()
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate required fields
        required_fields = ["business_name", "owner_email", "owner_name"]
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            raise TithiError(
                message=f"Missing required fields: {', '.join(missing_fields)}",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Get current user
        current_user = get_current_user()
        if not current_user:
            raise TithiError(
                message="User not authenticated",
                code="TITHI_AUTH_ERROR",
                status_code=401
            )
        
        business_name = data["business_name"].strip()
        owner_email = data["owner_email"].strip().lower()
        owner_name = data["owner_name"].strip()
        
        # Validate business name
        if len(business_name) < 2:
            raise TithiError(
                message="Business name must be at least 2 characters long",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        if len(business_name) > 100:
            raise TithiError(
                message="Business name must be less than 100 characters",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, owner_email):
            raise TithiError(
                message="Invalid email format",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Check for idempotency - if tenant already exists with same email/subdomain
        base_subdomain = generate_subdomain(business_name)
        
        # Check if user already has a tenant with this subdomain
        existing_tenant = Tenant.query.filter_by(slug=base_subdomain, deleted_at=None).first()
        if existing_tenant:
            # Check if this is the same user trying to register again
            membership = Membership.query.filter_by(
                tenant_id=existing_tenant.id,
                user_id=current_user["id"]
            ).first()
            
            if membership and membership.role == "owner":
                # Idempotent case - return existing tenant
                logger.info(f"Idempotent registration for existing tenant {existing_tenant.id}")
                return jsonify({
                    "id": str(existing_tenant.id),
                    "business_name": existing_tenant.name,
                    "slug": existing_tenant.slug,
                    "subdomain": f"{existing_tenant.slug}.tithi.com",
                    "category": getattr(existing_tenant, 'category', data.get('category', '')),
                    "logo": getattr(existing_tenant, 'logo_url', data.get('logo')),
                    "timezone": existing_tenant.tz,
                    "currency": existing_tenant.billing_json.get('currency', 'USD'),
                    "locale": getattr(existing_tenant, 'locale', 'en_US'),
                    "status": "active",
                    "created_at": existing_tenant.created_at.isoformat() + "Z",
                    "updated_at": existing_tenant.updated_at.isoformat() + "Z",
                    "is_existing": True
                }), 200
        
        # Generate unique subdomain
        try:
            unique_subdomain = ensure_unique_subdomain(base_subdomain)
        except TithiError:
            raise
        except Exception as e:
            logger.error(f"Failed to generate unique subdomain: {str(e)}")
            raise TithiError(
                message="Failed to generate unique subdomain",
                code="TITHI_TENANT_SUBDOMAIN_GENERATION_FAILED",
                status_code=500
            )
        
        # Create tenant using service
        tenant_service = TenantService()
        tenant_data = {
            "name": business_name,
            "email": owner_email,
            "slug": unique_subdomain,
            "timezone": data.get("timezone", "UTC"),
            "currency": data.get("currency", "USD"),
            "description": data.get("description", ""),
            "locale": data.get("locale", "en_US"),
            "category": data.get("category", ""),
            "logo_url": data.get("logo")
        }
        
        # Create tenant
        tenant = tenant_service.create_tenant(tenant_data, current_user["id"])
        
        # Create default theme
        create_default_theme(str(tenant.id))
        
        # Create default policies
        create_default_policies(str(tenant.id))
        
        # Emit observability hook
        logger.info(f"TENANT_ONBOARDED: tenant_id={tenant.id}, subdomain={unique_subdomain}")
        
        # Return success response
        return jsonify({
            "id": str(tenant.id),
            "business_name": tenant.name,
            "slug": tenant.slug,
            "subdomain": f"{tenant.slug}.tithi.com",
            "category": getattr(tenant, 'category', data.get('category', '')),
            "logo": getattr(tenant, 'logo_url', data.get('logo')),
            "timezone": tenant.tz,
            "currency": tenant.billing_json.get('currency', 'USD'),
            "locale": getattr(tenant, 'locale', 'en_US'),
            "status": "active",
            "created_at": tenant.created_at.isoformat() + "Z",
            "updated_at": tenant.updated_at.isoformat() + "Z",
            "is_existing": False
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to register business: {str(e)}")
        raise TithiError(
            message="Failed to register business",
            code="TITHI_TENANT_REGISTRATION_ERROR"
        )


@onboarding_bp.route("/check-subdomain/<subdomain>", methods=["GET"])
@require_auth
def check_subdomain_availability(subdomain: str):
    """
    Check if a subdomain is available.
    
    Args:
        subdomain: The subdomain to check
        
    Returns:
        JSON response with availability status
    """
    try:
        # Validate subdomain format
        if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', subdomain):
            raise TithiError(
                message="Invalid subdomain format. Use lowercase letters, numbers, and hyphens only.",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        if len(subdomain) < 2 or len(subdomain) > 50:
            raise TithiError(
                message="Subdomain must be between 2 and 50 characters",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Check if subdomain exists
        existing_tenant = Tenant.query.filter_by(slug=subdomain, deleted_at=None).first()
        is_available = existing_tenant is None
        
        return jsonify({
            "subdomain": subdomain,
            "available": is_available,
            "suggested_url": f"{subdomain}.tithi.com" if is_available else None
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to check subdomain availability: {str(e)}")
        raise TithiError(
            message="Failed to check subdomain availability",
            code="TITHI_SUBDOMAIN_CHECK_ERROR"
        )
