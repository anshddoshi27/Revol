"""
Comprehensive Onboarding Service

This service handles the complete 9-step onboarding process for Tithi businesses.
It manages data collection, validation, and organization for all business setup steps.
"""

import uuid
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.core import Tenant, User, Membership
from ..models.team import TeamMember, TeamMemberAvailability, ServiceCategory, BusinessPolicy
from ..models.onboarding import BusinessBranding
from ..models.promotions import GiftCard, Coupon
from ..models.notifications import NotificationTemplate
from ..models.business import Service, Customer
from ..middleware.error_handler import TithiError

logger = logging.getLogger(__name__)


class OnboardingService:
    """Service for managing the complete business onboarding process."""
    
    def __init__(self):
        self.db = db
    
    def create_business_account(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 1: Create business account with basic information
        
        Args:
            user_data: Dictionary containing user and business information
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
            Dictionary with tenant_id and onboarding status
        """
        try:
            # Create user account
            user = User(
                email=user_data['email'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                display_name=f"{user_data['first_name']} {user_data['last_name']}"
            )
            # Note: Password hashing should be handled by auth service
            
            # Create tenant
            tenant = Tenant(
                name=user_data['business_name'],
                category=user_data['business_type'],
                legal_name=user_data.get('legal_name'),
                status='onboarding'
            )
            
            # Generate subdomain
            tenant.subdomain = self._generate_subdomain(user_data['business_name'])
            
            # Create membership
            membership = Membership(
                user_id=user.id,
                tenant_id=tenant.id,
                role='owner'
            )
            
            self.db.session.add_all([user, tenant, membership])
            self.db.session.commit()
            
            logger.info(f"Business account created for {user_data['business_name']}", extra={
                'tenant_id': str(tenant.id),
                'user_id': str(user.id)
            })
            
            return {
                'tenant_id': str(tenant.id),
                'user_id': str(user.id),
                'subdomain': tenant.subdomain,
                'status': 'onboarding'
            }
            
        except IntegrityError as e:
            self.db.session.rollback()
            raise TithiError(
                message="Business account already exists",
                code="TITHI_ACCOUNT_EXISTS",
                status_code=409
            )
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to create business account: {str(e)}")
            raise TithiError(
                message="Failed to create business account",
                code="TITHI_ACCOUNT_CREATION_ERROR"
            )
    
    def setup_business_information(self, tenant_id: str, business_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 2: Setup business information and contact details
        
        Args:
            tenant_id: Tenant ID
            business_data: Business information
                - subdomain: Custom subdomain
                - timezone: Business timezone
                - phone: Business phone
                - website: Business website
                - support_email: Support email
                - address: Business address dict
                - social_links: Social media links dict
        
        Returns:
            Updated tenant information
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            # Update tenant with business information
            tenant.subdomain = business_data.get('subdomain', tenant.subdomain)
            tenant.business_timezone = business_data.get('timezone', 'UTC')
            tenant.phone = business_data.get('phone')
            tenant.address_json = business_data.get('address', {})
            tenant.social_links_json = business_data.get('social_links', {})
            
            # Update status
            tenant.status = 'information_collected'
            
            self.db.session.commit()
            
            logger.info(f"Business information updated for tenant {tenant_id}")
            
            return {
                'tenant_id': str(tenant.id),
                'subdomain': tenant.subdomain,
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup business information: {str(e)}")
            raise TithiError(
                message="Failed to setup business information",
                code="TITHI_BUSINESS_INFO_ERROR"
            )
    
    def setup_team_members(self, tenant_id: str, team_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Step 3: Setup team members and their roles
        
        Args:
            tenant_id: Tenant ID
            team_data: List of team member information
                - name: Team member name
                - email: Team member email
                - phone: Team member phone
                - role: Team member role (owner, admin, staff)
                - bio: Team member bio
                - specialties: List of specialties
        
        Returns:
            List of created team members
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            created_members = []
            
            for member_data in team_data:
                team_member = TeamMember(
                    tenant_id=tenant_id,
                    name=member_data['name'],
                    email=member_data.get('email'),
                    phone=member_data.get('phone'),
                    role=member_data.get('role', 'staff'),
                    bio=member_data.get('bio'),
                    specialties=member_data.get('specialties', [])
                )
                
                self.db.session.add(team_member)
                created_members.append({
                    'id': str(team_member.id),
                    'name': team_member.name,
                    'role': team_member.role
                })
            
            # Update tenant status
            tenant.status = 'team_setup'
            
            self.db.session.commit()
            
            logger.info(f"Team members created for tenant {tenant_id}", extra={
                'member_count': len(created_members)
            })
            
            return {
                'tenant_id': str(tenant.id),
                'team_members': created_members,
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup team members: {str(e)}")
            raise TithiError(
                message="Failed to setup team members",
                code="TITHI_TEAM_SETUP_ERROR"
            )
    
    def setup_branding(self, tenant_id: str, branding_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 4: Setup branding (logo and brand colors)
        
        Args:
            tenant_id: Tenant ID
            branding_data: Branding information
                - logo_url: Logo URL (optional)
                - primary_color: Primary brand color hex code
                - secondary_color: Secondary brand color hex code
                - accent_color: Accent color hex code (optional)
                - font_family: Font family (optional)
                - layout_style: Layout style (optional)
        
        Returns:
            Created branding settings
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            # Get or create branding record
            branding = BusinessBranding.query.filter_by(tenant_id=tenant_id).first()
            if not branding:
                branding = BusinessBranding(tenant_id=tenant_id)
                self.db.session.add(branding)
            
            # Update branding fields
            if 'logo_url' in branding_data:
                branding.logo_url = branding_data['logo_url']
            if 'primary_color' in branding_data:
                branding.primary_color = branding_data['primary_color']
            if 'secondary_color' in branding_data:
                branding.secondary_color = branding_data['secondary_color']
            if 'accent_color' in branding_data:
                branding.accent_color = branding_data['accent_color']
            if 'font_family' in branding_data:
                branding.font_family = branding_data['font_family']
            if 'layout_style' in branding_data:
                branding.layout_style = branding_data['layout_style']
            
            # Update tenant status
            tenant.status = 'branding_setup'
            
            self.db.session.commit()
            
            logger.info(f"Branding setup completed for tenant {tenant_id}")
            
            return {
                'tenant_id': str(tenant.id),
                'branding': {
                    'logo_url': branding.logo_url,
                    'primary_color': branding.primary_color,
                    'secondary_color': branding.secondary_color,
                    'accent_color': branding.accent_color,
                    'font_family': branding.font_family,
                    'layout_style': branding.layout_style
                },
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup branding: {str(e)}")
            raise TithiError(
                message="Failed to setup branding",
                code="TITHI_BRANDING_SETUP_ERROR"
            )
    
    def setup_services_and_categories(self, tenant_id: str, services_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 5: Setup services and categories
        
        Args:
            tenant_id: Tenant ID
            services_data: Services and categories information
                - categories: List of category information
                    - name: Category name
                    - description: Category description
                    - color: Category color
                    - services: List of services in category
                        - name: Service name
                        - description: Service description
                        - duration: Service duration in minutes
                        - price: Service price in cents
                        - instructions: Pre-appointment instructions
        
        Returns:
            Created services and categories
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            created_categories = []
            created_services = []
            
            for category_data in services_data.get('categories', []):
                # Create category
                category = ServiceCategory(
                    tenant_id=tenant_id,
                    name=category_data['name'],
                    description=category_data.get('description'),
                    color=category_data.get('color')
                )
                
                self.db.session.add(category)
                self.db.session.flush()  # Get category ID
                
                created_categories.append({
                    'id': str(category.id),
                    'name': category.name
                })
                
                # Create services in category
                for service_data in category_data.get('services', []):
                    service = Service(
                        tenant_id=tenant_id,
                        category_id=category.id,
                        name=service_data['name'],
                        description=service_data.get('description'),
                        duration_min=service_data.get('duration', 60),
                        price_cents=service_data.get('price', 0),
                        instructions=service_data.get('instructions'),
                        slug=self._generate_service_slug(service_data['name'])
                    )
                    
                    self.db.session.add(service)
                    created_services.append({
                        'id': str(service.id),
                        'name': service.name,
                        'category_id': str(category.id)
                    })
            
            # Update tenant status
            tenant.status = 'services_setup'
            
            self.db.session.commit()
            
            logger.info(f"Services and categories created for tenant {tenant_id}", extra={
                'category_count': len(created_categories),
                'service_count': len(created_services)
            })
            
            return {
                'tenant_id': str(tenant.id),
                'categories': created_categories,
                'services': created_services,
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup services and categories: {str(e)}")
            raise TithiError(
                message="Failed to setup services and categories",
                code="TITHI_SERVICES_SETUP_ERROR"
            )
    
    def setup_availability(self, tenant_id: str, availability_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 6: Setup team member availability for services
        
        Args:
            tenant_id: Tenant ID
            availability_data: Availability information
                - team_member_availability: Dict mapping team_member_id to availability
                    - day_of_week: Day of week (0-6)
                    - start_time: Start time
                    - end_time: End time
                    - is_available: Boolean
        
        Returns:
            Created availability records
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            created_availability = []
            
            for team_member_id, availability_list in availability_data.get('team_member_availability', {}).items():
                for availability_item in availability_list:
                    availability = TeamMemberAvailability(
                        tenant_id=tenant_id,
                        team_member_id=team_member_id,
                        day_of_week=availability_item['day_of_week'],
                        start_time=availability_item['start_time'],
                        end_time=availability_item['end_time'],
                        is_available=availability_item.get('is_available', True)
                    )
                    
                    self.db.session.add(availability)
                    created_availability.append({
                        'team_member_id': team_member_id,
                        'day_of_week': availability_item['day_of_week'],
                        'start_time': str(availability_item['start_time']),
                        'end_time': str(availability_item['end_time'])
                    })
            
            # Update tenant status
            tenant.status = 'availability_setup'
            
            self.db.session.commit()
            
            logger.info(f"Availability setup completed for tenant {tenant_id}", extra={
                'availability_count': len(created_availability)
            })
            
            return {
                'tenant_id': str(tenant.id),
                'availability_records': created_availability,
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup availability: {str(e)}")
            raise TithiError(
                message="Failed to setup availability",
                code="TITHI_AVAILABILITY_SETUP_ERROR"
            )
    
    def setup_notification_templates(self, tenant_id: str, notification_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 7: Setup notification templates and placeholders
        
        Args:
            tenant_id: Tenant ID
            notification_data: Notification configuration
                - templates: List of notification templates
                    - name: Template name
                    - channel: email, sms, push
                    - category: confirmation, reminder, follow_up, etc.
                    - trigger_event: booking_created, 24h_reminder, etc.
                    - subject: Email subject (for email)
                    - content: Template content with placeholders
                    - placeholders: List of available placeholders
        
        Returns:
            Created notification templates
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            created_templates = []
            
            for template_data in notification_data.get('templates', []):
                template = NotificationTemplate(
                    tenant_id=tenant_id,
                    name=template_data['name'],
                    channel=template_data['channel'],
                    category=template_data['category'],
                    trigger_event=template_data['trigger_event'],
                    subject=template_data.get('subject'),
                    content=template_data['content']
                )
                
                self.db.session.add(template)
                self.db.session.flush()  # Get template ID
                
                created_templates.append({
                    'id': str(template.id),
                    'name': template.name,
                    'channel': template.channel,
                    'trigger_event': template.trigger_event
                })
            
            # Update tenant status
            tenant.status = 'notifications_setup'
            
            self.db.session.commit()
            
            logger.info(f"Notification templates created for tenant {tenant_id}", extra={
                'template_count': len(created_templates)
            })
            
            return {
                'tenant_id': str(tenant.id),
                'templates': created_templates,
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup notification templates: {str(e)}")
            raise TithiError(
                message="Failed to setup notification templates",
                code="TITHI_NOTIFICATIONS_SETUP_ERROR"
            )
    
    def setup_policies_and_gift_cards(self, tenant_id: str, policies_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 8: Setup business policies and gift cards
        
        Args:
            tenant_id: Tenant ID
            policies_data: Policies and gift card configuration
                - policies: List of business policies
                    - policy_type: cancellation, no_show, refund, cash_payment
                    - title: Policy title
                    - content: Policy content
                - gift_cards: Gift card configuration
                    - denominations: List of gift card amounts
                    - expiry_days: Gift card expiry in days
        
        Returns:
            Created policies and gift card configuration
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            created_policies = []
            
            # Create business policies
            for policy_data in policies_data.get('policies', []):
                policy = BusinessPolicy(
                    tenant_id=tenant_id,
                    policy_type=policy_data['policy_type'],
                    title=policy_data['title'],
                    content=policy_data['content']
                )
                
                self.db.session.add(policy)
                created_policies.append({
                    'id': str(policy.id),
                    'policy_type': policy.policy_type,
                    'title': policy.title
                })
            
            # Update tenant status
            tenant.status = 'policies_setup'
            
            self.db.session.commit()
            
            logger.info(f"Policies and gift cards setup completed for tenant {tenant_id}", extra={
                'policy_count': len(created_policies)
            })
            
            return {
                'tenant_id': str(tenant.id),
                'policies': created_policies,
                'status': tenant.status
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to setup policies and gift cards: {str(e)}")
            raise TithiError(
                message="Failed to setup policies and gift cards",
                code="TITHI_POLICIES_SETUP_ERROR"
            )
    
    def go_live(self, tenant_id: str) -> Dict[str, Any]:
        """
        Step 9: Go live - activate the business
        
        Args:
            tenant_id: Tenant ID
        
        Returns:
            Go live confirmation with booking URL
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            # Validate that all required setup is complete
            if not self._validate_onboarding_complete(tenant):
                raise TithiError(
                    message="Onboarding not complete",
                    code="TITHI_ONBOARDING_INCOMPLETE",
                    status_code=400
                )
            
            # Update tenant status to active
            tenant.status = 'active'
            
            self.db.session.commit()
            
            # Generate booking URL
            booking_url = f"https://{tenant.subdomain}.tithi.com"
            
            logger.info(f"Business went live for tenant {tenant_id}", extra={
                'booking_url': booking_url
            })
            
            return {
                'tenant_id': str(tenant.id),
                'status': 'active',
                'booking_url': booking_url,
                'subdomain': tenant.subdomain
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to go live: {str(e)}")
            raise TithiError(
                message="Failed to go live",
                code="TITHI_GO_LIVE_ERROR"
            )
    
    def _generate_subdomain(self, business_name: str) -> str:
        """Generate a unique subdomain from business name."""
        import re
        
        # Clean business name
        subdomain = re.sub(r'[^a-zA-Z0-9]', '', business_name.lower())
        subdomain = subdomain[:20]  # Limit length
        
        # Check if subdomain exists
        counter = 1
        original_subdomain = subdomain
        while Tenant.query.filter_by(subdomain=subdomain).first():
            subdomain = f"{original_subdomain}{counter}"
            counter += 1
        
        return subdomain
    
    def _generate_service_slug(self, service_name: str) -> str:
        """Generate a service slug from service name."""
        import re
        
        slug = re.sub(r'[^a-zA-Z0-9]', '-', service_name.lower())
        slug = re.sub(r'-+', '-', slug)  # Remove multiple dashes
        slug = slug.strip('-')
        
        return slug
    
    def _validate_onboarding_complete(self, tenant: Tenant) -> bool:
        """Validate that all required onboarding steps are complete."""
        required_checks = [
            tenant.name is not None,
            tenant.phone is not None,
            tenant.subdomain is not None,
            len(tenant.team_members) > 0,
            len(tenant.services) > 0,
            len(tenant.business_policies) > 0
        ]
        
        return all(required_checks)


