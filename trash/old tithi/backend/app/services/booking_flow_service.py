"""
Comprehensive Booking Flow Service

This service handles the complete customer booking flow from service selection
to payment confirmation, including availability checking, customer data collection,
and booking creation.
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..extensions import db
from ..models.core import Tenant
from ..models.business import Service, Customer, Booking
from ..models.team import TeamMember, TeamMemberAvailability, ServiceCategory, TeamMemberService
from ..models.promotions import GiftCard, Coupon, CouponUsage
from ..models.financial import Payment
from ..services.financial import PaymentService
from ..middleware.error_handler import TithiError

logger = logging.getLogger(__name__)


class BookingFlowService:
    """Service for managing the complete customer booking flow."""
    
    def __init__(self):
        self.db = db
    
    def get_tenant_booking_data(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get all data needed for the booking flow for a tenant.
        This includes business info, services, categories, and policies.
        
        Args:
            tenant_id: Tenant ID
        
        Returns:
            Complete booking flow data
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            # Get business information
            business_info = {
                'name': tenant.name,
                'description': tenant.public_blurb,
                'phone': tenant.phone,
                'email': tenant.email,
                'address': tenant.address_json,
                'social_links': tenant.social_links_json,
                'branding': tenant.branding_json,
                'policies': tenant.policies_json
            }
            
            # Get service categories with services
            categories = []
            for category in tenant.service_categories:
                if category.is_active and not category.deleted_at:
                    services = []
                    for service in category.services:
                        if service.active and not service.deleted_at:
                            services.append({
                                'id': str(service.id),
                                'name': service.name,
                                'description': service.description,
                                'short_description': service.short_description,
                                'duration_minutes': service.duration_min,
                                'price_cents': service.price_cents,
                                'instructions': service.instructions,
                                'image_url': service.image_url,
                                'is_featured': service.is_featured,
                                'requires_team_member_selection': service.requires_team_member_selection,
                                'allow_group_booking': service.allow_group_booking,
                                'max_group_size': service.max_group_size
                            })
                    
                    if services:  # Only include categories with active services
                        categories.append({
                            'id': str(category.id),
                            'name': category.name,
                            'description': category.description,
                            'color': category.color,
                            'services': services
                        })
            
            # Get team members
            team_members = []
            for member in tenant.team_members:
                if member.is_active and not member.deleted_at:
                    team_members.append({
                        'id': str(member.id),
                        'name': member.name,
                        'bio': member.bio,
                        'specialties': member.specialties,
                        'avatar_url': member.avatar_url
                    })
            
            # Get business policies
            policies = []
            for policy in tenant.business_policies:
                if policy.is_active:
                    policies.append({
                        'type': policy.policy_type,
                        'title': policy.title,
                        'content': policy.content
                    })
            
            return {
                'business_info': business_info,
                'categories': categories,
                'team_members': team_members,
                'policies': policies,
                'booking_url': f"https://{tenant.subdomain}.tithi.com"
            }
            
        except Exception as e:
            logger.error(f"Failed to get tenant booking data: {str(e)}")
            raise TithiError(
                message="Failed to get booking data",
                code="TITHI_BOOKING_DATA_ERROR"
            )
    
    def check_availability(self, tenant_id: str, service_id: str, 
                         start_date: datetime, end_date: datetime,
                         team_member_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Check availability for a service within a date range.
        
        Args:
            tenant_id: Tenant ID
            service_id: Service ID
            start_date: Start date for availability check
            end_date: End date for availability check
            team_member_id: Optional specific team member
        
        Returns:
            List of available time slots
        """
        try:
            service = Service.query.filter_by(
                id=service_id, 
                tenant_id=tenant_id, 
                active=True
            ).first()
            
            if not service:
                raise TithiError(
                    message="Service not found",
                    code="TITHI_SERVICE_NOT_FOUND",
                    status_code=404
                )
            
            # Get team members who can perform this service
            if team_member_id:
                team_members = [TeamMember.query.get(team_member_id)]
            else:
                team_members = service.team_assignments
                team_members = [tm.team_member for tm in team_members if tm.team_member.is_active]
            
            available_slots = []
            
            # Check availability for each day in the range
            current_date = start_date.date()
            end_date_only = end_date.date()
            
            while current_date <= end_date_only:
                day_of_week = current_date.weekday() + 1  # Monday = 1, Sunday = 7
                if day_of_week == 7:
                    day_of_week = 0  # Convert Sunday to 0
                
                # Get availability for this day
                for team_member in team_members:
                    availability = TeamMemberAvailability.query.filter_by(
                        tenant_id=tenant_id,
                        team_member_id=team_member.id,
                        day_of_week=day_of_week,
                        is_available=True
                    ).all()
                    
                    for avail in availability:
                        # Generate time slots for this availability period
                        slots = self._generate_time_slots(
                            current_date, 
                            avail.start_time, 
                            avail.end_time,
                            service.duration_min
                        )
                        
                        for slot in slots:
                            # Check if slot is not in the past
                            if slot['start_time'] > datetime.now():
                                available_slots.append({
                                    'start_time': slot['start_time'].isoformat(),
                                    'end_time': slot['end_time'].isoformat(),
                                    'team_member_id': str(team_member.id),
                                    'team_member_name': team_member.name,
                                    'service_id': str(service.id),
                                    'service_name': service.name,
                                    'duration_minutes': service.duration_min,
                                    'price_cents': service.price_cents
                                })
                
                current_date += timedelta(days=1)
            
            # Sort by start time
            available_slots.sort(key=lambda x: x['start_time'])
            
            return available_slots
            
        except Exception as e:
            logger.error(f"Failed to check availability: {str(e)}")
            raise TithiError(
                message="Failed to check availability",
                code="TITHI_AVAILABILITY_ERROR"
            )
    
    def create_booking(self, tenant_id: str, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new booking with customer information and payment.
        
        Args:
            tenant_id: Tenant ID
            booking_data: Booking information
                - service_id: Service ID
                - team_member_id: Team member ID
                - start_time: Booking start time
                - customer_info: Customer information
                - payment_method: Payment method
                - gift_card_code: Optional gift card code
                - coupon_code: Optional coupon code
                - special_requests: Special requests
        
        Returns:
            Created booking information
        """
        try:
            # Validate service exists and is active
            service = Service.query.filter_by(
                id=booking_data['service_id'],
                tenant_id=tenant_id,
                active=True
            ).first()
            
            if not service:
                raise TithiError(
                    message="Service not found",
                    code="TITHI_SERVICE_NOT_FOUND",
                    status_code=404
                )
            
            # Validate team member exists and can perform service
            team_member = TeamMember.query.filter_by(
                id=booking_data['team_member_id'],
                tenant_id=tenant_id,
                is_active=True
            ).first()
            
            if not team_member:
                raise TithiError(
                    message="Team member not found",
                    code="TITHI_TEAM_MEMBER_NOT_FOUND",
                    status_code=404
                )
            
            # Check if team member can perform this service
            service_assignment = TeamMemberService.query.filter_by(
                team_member_id=team_member.id,
                service_id=service.id
            ).first()
            
            if not service_assignment:
                raise TithiError(
                    message="Team member cannot perform this service",
                    code="TITHI_SERVICE_ASSIGNMENT_ERROR",
                    status_code=400
                )
            
            # Create or find customer
            customer = self._create_or_find_customer(tenant_id, booking_data['customer_info'])
            self.db.session.flush()  # Ensure customer has an ID
            
            # Calculate pricing
            pricing = self._calculate_booking_pricing(
                service, 
                booking_data.get('gift_card_code'),
                booking_data.get('coupon_code')
            )
            
            # Create booking
            booking = Booking(
                tenant_id=tenant_id,
                customer_id=customer.id,
                resource_id=team_member.id,  # Using team member as resource
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={
                    'service_id': str(service.id),
                    'service_name': service.name,
                    'duration_minutes': service.duration_min,
                    'price_cents': service.price_cents,
                    'instructions': service.instructions
                },
                start_at=datetime.fromisoformat(booking_data['start_time'].replace('Z', '+00:00')),
                end_at=datetime.fromisoformat(booking_data['start_time'].replace('Z', '+00:00')) + timedelta(minutes=service.duration_min),
                status='pending',
                attendee_count=1,
                total_amount_cents=pricing['total_cents'],
                currency='USD',
                metadata={
                    'special_requests': booking_data.get('special_requests'),
                    'gift_card_code': booking_data.get('gift_card_code'),
                    'coupon_code': booking_data.get('coupon_code'),
                    'pricing_breakdown': pricing
                }
            )
            
            self.db.session.add(booking)
            self.db.session.flush()  # Get booking ID
            
            # Process payment - creates SetupIntent to save card for off-session charging
            payment_result = self._process_payment(booking, booking_data.get('payment_method'))
            
            # Booking starts as 'pending' - no charge has occurred yet
            # Status changes when admin presses Completed/No-Show/Cancelled button
            booking.status = 'pending'
            booking.payment_status = 'pending'
            
            self.db.session.commit()
            
            # Send confirmation notifications
            self._send_booking_confirmation(booking)
            
            logger.info(f"Booking created successfully", extra={
                'booking_id': str(booking.id),
                'tenant_id': tenant_id,
                'customer_id': str(customer.id),
                'status': 'pending'
            })
            
            return {
                'booking_id': str(booking.id),
                'status': 'pending',  # Always pending until admin action
                'payment_status': 'pending',
                'total_amount_cents': booking.total_amount_cents,
                'currency': booking.currency,
                'start_time': booking.start_at.isoformat(),
                'end_time': booking.end_at.isoformat(),
                'service_name': service.name,
                'team_member_name': team_member.name,
                'customer_name': customer.display_name,
                'confirmation_number': booking.client_generated_id,
                # Return SetupIntent info for frontend Stripe Elements
                'setup_intent_client_secret': payment_result.get('setup_intent_client_secret'),
                'payment_id': payment_result.get('payment_id')
            }
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to create booking: {str(e)}")
            raise TithiError(
                message="Failed to create booking",
                code="TITHI_BOOKING_CREATION_ERROR"
            )
    
    def _create_or_find_customer(self, tenant_id: str, customer_info: Dict[str, Any]) -> Customer:
        """Create or find existing customer."""
        # Check if customer already exists
        existing_customer = Customer.query.filter_by(
            tenant_id=tenant_id,
            email=customer_info['email']
        ).first()
        
        if existing_customer:
            # Update customer information
            existing_customer.display_name = customer_info.get('name', existing_customer.display_name)
            existing_customer.phone = customer_info.get('phone', existing_customer.phone)
            existing_customer.marketing_opt_in = customer_info.get('marketing_opt_in', existing_customer.marketing_opt_in)
            return existing_customer
        
        # Create new customer
        customer = Customer(
            tenant_id=tenant_id,
            display_name=customer_info['name'],
            email=customer_info['email'],
            phone=customer_info.get('phone'),
            marketing_opt_in=customer_info.get('marketing_opt_in', False),
            is_first_time=True
        )
        
        self.db.session.add(customer)
        return customer
    
    def _calculate_booking_pricing(self, service: Service, gift_card_code: Optional[str], 
                                 coupon_code: Optional[str]) -> Dict[str, Any]:
        """Calculate booking pricing with discounts."""
        base_price = service.price_cents
        discount_amount = 0
        gift_card_amount = 0
        coupon_discount = 0
        
        # Apply gift card discount
        if gift_card_code:
            gift_card = GiftCard.query.filter_by(
                code=gift_card_code,
                is_active=True
            ).first()
            
            if gift_card and gift_card.balance_cents > 0:
                gift_card_amount = min(gift_card.balance_cents, base_price)
                discount_amount += gift_card_amount
        
        # Apply coupon discount
        if coupon_code:
            coupon = Coupon.query.filter_by(
                code=coupon_code,
                is_active=True
            ).first()
            
            if coupon and coupon.used_count < (coupon.usage_limit or float('inf')):
                if coupon.discount_type == 'percentage':
                    coupon_discount = int(base_price * (coupon.discount_value / 100))
                else:  # fixed_amount
                    coupon_discount = int(coupon.discount_value * 100)  # Convert to cents
                
                # Apply minimum amount check
                if base_price >= coupon.min_amount_cents:
                    coupon_discount = min(coupon_discount, base_price - gift_card_amount)
                    discount_amount += coupon_discount
        
        total_amount = max(0, base_price - discount_amount)
        
        return {
            'base_price_cents': base_price,
            'gift_card_discount_cents': gift_card_amount,
            'coupon_discount_cents': coupon_discount,
            'total_discount_cents': discount_amount,
            'total_cents': total_amount
        }
    
    def _process_payment(self, booking: Booking, payment_method: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process payment for booking by creating SetupIntent.
        Per frontend logistics: we save card at checkout, no charge yet.
        Actual charge happens when admin presses Completed/No-Show/Cancelled button.
        """
        try:
            payment_service = PaymentService()
            
            # Create SetupIntent to save card for off-session use
            # This allows us to charge later when admin marks booking complete/no-show/cancelled
            # Get customer object for SetupIntent creation
            customer = Customer.query.get(booking.customer_id)
            if not customer:
                raise TithiError("Customer not found", code="TITHI_CUSTOMER_NOT_FOUND")
            
            setup_intent = payment_service.create_setup_intent(
                tenant_id=booking.tenant_id,
                db_customer=customer,
                idempotency_key=f"si_{booking.tenant_id}_{booking.id}_{uuid.uuid4()}"
            )
            
            # Return setup intent client secret for frontend Stripe Elements
            return {
                'success': True,
                'payment_id': str(setup_intent.id),
                'setup_intent_client_secret': self._get_stripe_setup_intent_client_secret(setup_intent),
                'amount_cents': booking.total_amount_cents,
                'payment_status': 'pending',  # No charge yet
                'capture_method': 'off_session'  # Will charge later via admin buttons
            }
        except Exception as e:
            logger.error(f"Failed to create setup intent: {str(e)}")
            raise TithiError(
                message=f"Payment setup failed: {str(e)}",
                code="TITHI_PAYMENT_SETUP_ERROR"
            )
    
    def _get_stripe_setup_intent_client_secret(self, payment: Payment) -> str:
        """Get Stripe SetupIntent client secret from payment record."""
        if not payment.provider_setup_intent_id:
            raise TithiError("No setup intent ID found", code="TITHI_PAYMENT_NO_SETUP_INTENT")
        
        try:
            import stripe
            payment_service = PaymentService()
            stripe.api_key = payment_service._get_stripe_secret_key()
            setup_intent = stripe.SetupIntent.retrieve(payment.provider_setup_intent_id)
            return setup_intent.client_secret
        except Exception as e:
            logger.error(f"Failed to retrieve setup intent client secret: {str(e)}")
            raise TithiError(
                message="Failed to get payment setup secret",
                code="TITHI_PAYMENT_SECRET_ERROR"
            )
    
    def _send_booking_confirmation(self, booking: Booking):
        """Send booking confirmation notifications."""
        # This would integrate with notification service
        # For now, just log the confirmation
        logger.info(f"Booking confirmation sent for booking {booking.id}")
    
    def _generate_time_slots(self, date, start_time, end_time, duration_minutes):
        """Generate time slots for a given availability period."""
        slots = []
        current_time = datetime.combine(date, start_time)
        end_datetime = datetime.combine(date, end_time)
        
        while current_time + timedelta(minutes=duration_minutes) <= end_datetime:
            slots.append({
                'start_time': current_time,
                'end_time': current_time + timedelta(minutes=duration_minutes)
            })
            current_time += timedelta(minutes=30)  # 30-minute intervals
        
        return slots


