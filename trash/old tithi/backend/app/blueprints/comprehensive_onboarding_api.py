"""
Comprehensive Onboarding API Blueprint

This blueprint provides complete API endpoints for the 9-step onboarding process,
including business setup, team management, branding, services, availability, notifications,
policies, and go-live functionality.
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import logging
from datetime import datetime
from typing import Dict, Any

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.onboarding_service import OnboardingService
from ..services.booking_flow_service import BookingFlowService
from ..extensions import db

logger = logging.getLogger(__name__)

comprehensive_onboarding_bp = Blueprint("comprehensive_onboarding", __name__)


@comprehensive_onboarding_bp.route("/onboarding/step1/business-account", methods=["POST"])
@require_auth
def create_business_account():
    """
    Step 1: Create business account with basic information
    
    Request Body:
        - email: User email
        - password: User password
        - first_name: User first name
        - last_name: User last name
        - business_name: Business name
        - business_type: Type of business
        - business_description: Brief description
        - legal_name: Legal business name (DBA)
        - industry: Business industry
    
    Returns:
        - tenant_id: Created tenant ID
        - user_id: Created user ID
        - subdomain: Generated subdomain
        - status: Onboarding status
    """
    try:
        data = request.get_json()
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.create_business_account(data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Business account created successfully"
        }), 201
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to create business account: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step2/business-information", methods=["POST"])
@require_auth
@require_tenant
def setup_business_information():
    """
    Step 2: Setup business information and contact details
    
    Request Body:
        - subdomain: Custom subdomain
        - timezone: Business timezone
        - phone: Business phone
        - website: Business website
        - support_email: Support email
        - address: Business address object
        - social_links: Social media links object
    
    Returns:
        - tenant_id: Tenant ID
        - subdomain: Updated subdomain
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_business_information(tenant_id, data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Business information updated successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup business information: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step3/team-members", methods=["POST"])
@require_auth
@require_tenant
def setup_team_members():
    """
    Step 3: Setup team members and their roles
    
    Request Body:
        - team_members: Array of team member objects
            - name: Team member name
            - email: Team member email
            - phone: Team member phone
            - role: Team member role (owner, admin, staff)
            - bio: Team member bio
            - specialties: Array of specialties
    
    Returns:
        - tenant_id: Tenant ID
        - team_members: Created team members
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data or 'team_members' not in data:
            raise TithiError(
                message="Team members data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_team_members(tenant_id, data['team_members'])
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Team members setup successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup team members: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step4/branding", methods=["POST"])
@require_auth
@require_tenant
def setup_branding():
    """
    Step 4: Setup branding (logo and brand colors)
    
    Request Body:
        - logo_url: Logo URL (optional)
        - primary_color: Primary brand color hex code
        - secondary_color: Secondary brand color hex code
        - accent_color: Accent color hex code (optional)
        - font_family: Font family (optional)
        - layout_style: Layout style - modern, classic, minimal (optional)
    
    Returns:
        - tenant_id: Tenant ID
        - branding: Created branding settings
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Branding data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_branding(tenant_id, data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Branding setup successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup branding: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step5/services-categories", methods=["POST"])
@require_auth
@require_tenant
def setup_services_categories():
    """
    Step 5: Setup services and categories
    
    Request Body:
        - categories: Array of category objects
            - name: Category name
            - description: Category description
            - color: Category color
            - services: Array of service objects
                - name: Service name
                - description: Service description
                - duration: Service duration in minutes
                - price: Service price in cents
                - instructions: Pre-appointment instructions
    
    Returns:
        - tenant_id: Tenant ID
        - categories: Created categories
        - services: Created services
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data or 'categories' not in data:
            raise TithiError(
                message="Categories data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_services_and_categories(tenant_id, data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Services and categories setup successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup services and categories: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step6/availability", methods=["POST"])
@require_auth
@require_tenant
def setup_availability():
    """
    Step 6: Setup team member availability for services
    
    Request Body:
        - team_member_availability: Object mapping team_member_id to availability
            - day_of_week: Day of week (0-6)
            - start_time: Start time
            - end_time: End time
            - is_available: Boolean
    
    Returns:
        - tenant_id: Tenant ID
        - availability_records: Created availability records
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data or 'team_member_availability' not in data:
            raise TithiError(
                message="Availability data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_availability(tenant_id, data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Availability setup successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup availability: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step7/notifications", methods=["POST"])
@require_auth
@require_tenant
def setup_notification_templates():
    """
    Step 7: Setup notification templates and placeholders
    
    Request Body:
        - templates: Array of notification template objects
            - name: Template name
            - channel: email, sms, push
            - category: confirmation, reminder, follow_up, etc.
            - trigger_event: booking_created, 24h_reminder, etc.
            - subject: Email subject (for email)
            - content: Template content with placeholders
    
    Returns:
        - tenant_id: Tenant ID
        - templates: Created notification templates
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data or 'templates' not in data:
            raise TithiError(
                message="Notification templates data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_notification_templates(tenant_id, data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Notification templates setup successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup notification templates: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step8/policies-gift-cards", methods=["POST"])
@require_auth
@require_tenant
def setup_policies_gift_cards():
    """
    Step 8: Setup business policies and gift cards
    
    Request Body:
        - policies: Array of business policy objects
            - policy_type: cancellation, no_show, refund, cash_payment
            - title: Policy title
            - content: Policy content
        - gift_cards: Gift card configuration
            - denominations: Array of gift card amounts
            - expiry_days: Gift card expiry in days
    
    Returns:
        - tenant_id: Tenant ID
        - policies: Created business policies
        - status: Updated status
    """
    try:
        tenant_id = g.tenant_id
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Policies data is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        onboarding_service = OnboardingService()
        result = onboarding_service.setup_policies_and_gift_cards(tenant_id, data)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Policies and gift cards setup successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to setup policies and gift cards: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/step9/go-live", methods=["POST"])
@require_auth
@require_tenant
def go_live():
    """
    Step 9: Go live - activate the business
    
    Returns:
        - tenant_id: Tenant ID
        - status: Active status
        - booking_url: Generated booking URL
        - subdomain: Business subdomain
    """
    try:
        tenant_id = g.tenant_id
        
        onboarding_service = OnboardingService()
        result = onboarding_service.go_live(tenant_id)
        
        return jsonify({
            "success": True,
            "data": result,
            "message": "Business is now live!"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to go live: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@comprehensive_onboarding_bp.route("/onboarding/status", methods=["GET"])
@require_auth
@require_tenant
def get_onboarding_status():
    """
    Get current onboarding status and progress
    
    Returns:
        - tenant_id: Tenant ID
        - status: Current onboarding status
        - completed_steps: Array of completed steps
        - remaining_steps: Array of remaining steps
        - progress_percentage: Overall progress percentage
    """
    try:
        tenant_id = g.tenant_id
        
        # Get tenant information
        from ..models.core import Tenant
        tenant = Tenant.query.get(tenant_id)
        
        if not tenant:
            raise TithiError(
                message="Tenant not found",
                code="TITHI_TENANT_NOT_FOUND",
                status_code=404
            )
        
        # Define onboarding steps
        steps = [
            "business_account",
            "business_information", 
            "team_members",
            "branding",
            "services_categories",
            "availability",
            "notifications",
            "policies_gift_cards",
            "go_live"
        ]
        
        # Determine completed steps based on tenant status
        status_mapping = {
            "onboarding": [],
            "information_collected": ["business_account", "business_information"],
            "team_setup": ["business_account", "business_information", "team_members"],
            "branding_setup": ["business_account", "business_information", "team_members", "branding"],
            "services_setup": ["business_account", "business_information", "team_members", "branding", "services_categories"],
            "availability_setup": ["business_account", "business_information", "team_members", "branding", "services_categories", "availability"],
            "notifications_setup": ["business_account", "business_information", "team_members", "branding", "services_categories", "availability", "notifications"],
            "policies_setup": ["business_account", "business_information", "team_members", "branding", "services_categories", "availability", "notifications", "policies_gift_cards"],
            "active": steps
        }
        
        completed_steps = status_mapping.get(tenant.status, [])
        remaining_steps = [step for step in steps if step not in completed_steps]
        progress_percentage = int((len(completed_steps) / len(steps)) * 100)
        
        return jsonify({
            "success": True,
            "data": {
                "tenant_id": str(tenant.id),
                "status": tenant.status,
                "completed_steps": completed_steps,
                "remaining_steps": remaining_steps,
                "progress_percentage": progress_percentage,
                "subdomain": tenant.subdomain,
                "business_name": tenant.name
            }
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get onboarding status: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


