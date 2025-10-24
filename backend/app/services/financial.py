"""
Financial Services

This module contains financial-related business logic services for payments, refunds, and billing.
Implements Stripe integration with idempotency and replay protection.
"""

import uuid
import stripe
from typing import Dict, Any, Optional, List
from decimal import Decimal
from datetime import datetime, timedelta
from ..extensions import db
from ..models.financial import Payment, PaymentMethod, Refund, TenantBilling, Invoice
from ..models.business import Booking, Customer
from ..models.core import Tenant
from ..middleware.error_handler import TithiError
import logging

logger = logging.getLogger(__name__)


class PaymentService:
    """Service for payment-related business logic with Stripe integration."""
    
    def __init__(self):
        # Initialize Stripe with API key from config
        stripe.api_key = self._get_stripe_secret_key()
    
    def _get_stripe_secret_key(self) -> str:
        """Get Stripe secret key from configuration."""
        from ..config import Config
        return Config.STRIPE_SECRET_KEY
    
    def create_payment_intent(self, tenant_id: str, booking_id: str, amount_cents: int, 
                            currency: str = "USD", customer_id: Optional[str] = None,
                            idempotency_key: Optional[str] = None) -> Payment:
        """Create a Stripe PaymentIntent and store payment record."""
        
        # Generate idempotency key if not provided
        if not idempotency_key:
            idempotency_key = f"pi_{tenant_id}_{booking_id}_{uuid.uuid4()}"
        
        # Check for existing payment with same idempotency key
        existing_payment = Payment.query.filter_by(
            tenant_id=tenant_id,
            idempotency_key=idempotency_key
        ).first()
        
        if existing_payment:
            return existing_payment
        
        # Check if tenant has Stripe Connect setup
        billing_service = BillingService()
        billing = billing_service.get_tenant_billing(tenant_id)
        
        if not billing or not billing.stripe_connect_enabled:
            raise TithiError("Tenant must complete Stripe Connect setup before accepting payments", 
                           error_code="TITHI_STRIPE_CONNECT_REQUIRED")
        
        try:
            # Calculate application fee (platform fee)
            application_fee_cents = int(amount_cents * 0.03)  # 3% platform fee
            
            # Create Stripe PaymentIntent with Connect
            stripe_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=currency,
                application_fee_amount=application_fee_cents,
                transfer_data={
                    'destination': billing.stripe_account_id
                },
                metadata={
                    'tenant_id': tenant_id,
                    'booking_id': booking_id,
                    'idempotency_key': idempotency_key
                },
                idempotency_key=idempotency_key
            )
            
            # Create payment record
            payment = Payment(
                tenant_id=tenant_id,
                booking_id=booking_id,
                customer_id=customer_id,
                amount_cents=amount_cents,
                currency_code=currency,
                status='requires_action',
                method='card',
                provider='stripe',
                provider_payment_id=stripe_intent.id,
                application_fee_cents=application_fee_cents,
                idempotency_key=idempotency_key,
                provider_metadata=stripe_intent.metadata
            )
            
            db.session.add(payment)
            db.session.commit()
            
            # Emit observability hook
            logger.info("PAYMENT_INTENT_CREATED", extra={
                'tenant_id': tenant_id,
                'payment_id': str(payment.id),
                'booking_id': booking_id,
                'amount_cents': amount_cents,
                'stripe_payment_intent_id': stripe_intent.id,
                'application_fee_cents': application_fee_cents
            })
            
            return payment
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {e}")
            raise TithiError(f"Payment creation failed: {str(e)}", error_code="TITHI_PAYMENT_STRIPE_ERROR")
        except Exception as e:
            logger.error(f"Error creating payment intent: {e}")
            db.session.rollback()
            raise TithiError(f"Payment creation failed: {str(e)}", error_code="TITHI_PAYMENT_CREATION_ERROR")
    
    def confirm_payment_intent(self, payment_id: str, tenant_id: str) -> Payment:
        """Confirm a Stripe PaymentIntent and update payment status."""
        
        payment = Payment.query.filter_by(
            id=payment_id,
            tenant_id=tenant_id
        ).first()
        
        if not payment:
            raise TithiError("Payment not found", error_code="TITHI_PAYMENT_NOT_FOUND")
        
        if not payment.provider_payment_id:
            raise TithiError("No Stripe payment intent found", error_code="TITHI_PAYMENT_NO_STRIPE_INTENT")
        
        try:
            # Retrieve and confirm Stripe PaymentIntent
            stripe_intent = stripe.PaymentIntent.retrieve(payment.provider_payment_id)
            
            if stripe_intent.status == 'succeeded':
                payment.status = 'captured'
                payment.provider_charge_id = stripe_intent.latest_charge
            elif stripe_intent.status == 'requires_action':
                payment.status = 'requires_action'
            elif stripe_intent.status == 'canceled':
                payment.status = 'canceled'
            else:
                payment.status = 'failed'
            
            # Update provider metadata
            payment.provider_metadata = stripe_intent.metadata
            
            db.session.commit()
            
            # Emit observability hook
            logger.info("PAYMENT_CAPTURED", extra={
                'tenant_id': tenant_id,
                'payment_id': str(payment.id),
                'booking_id': str(payment.booking_id),
                'amount_cents': payment.amount_cents,
                'status': payment.status
            })
            
            return payment
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error confirming payment intent: {e}")
            raise TithiError(f"Payment confirmation failed: {str(e)}", error_code="TITHI_PAYMENT_STRIPE_ERROR")
        except Exception as e:
            logger.error(f"Error confirming payment intent: {e}")
            db.session.rollback()
            raise TithiError(f"Payment confirmation failed: {str(e)}", error_code="TITHI_PAYMENT_CONFIRMATION_ERROR")
    
    def create_setup_intent(self, tenant_id: str, customer_id: str, 
                          idempotency_key: Optional[str] = None) -> Payment:
        """Create a Stripe SetupIntent for card-on-file authorization."""
        
        if not idempotency_key:
            idempotency_key = f"si_{tenant_id}_{customer_id}_{uuid.uuid4()}"
        
        # Check for existing setup intent
        existing_payment = Payment.query.filter_by(
            tenant_id=tenant_id,
            idempotency_key=idempotency_key
        ).first()
        
        if existing_payment:
            return existing_payment
        
        try:
            # Create Stripe SetupIntent
            stripe_setup_intent = stripe.SetupIntent.create(
                customer=customer_id,
                payment_method_types=['card'],
                metadata={
                    'tenant_id': tenant_id,
                    'customer_id': customer_id,
                    'idempotency_key': idempotency_key
                },
                idempotency_key=idempotency_key
            )
            
            # Create payment record for setup intent
            payment = Payment(
                tenant_id=tenant_id,
                customer_id=customer_id,
                amount_cents=0,  # Setup intents have no amount
                currency_code='USD',
                status='requires_action',
                method='card',
                provider='stripe',
                provider_setup_intent_id=stripe_setup_intent.id,
                idempotency_key=idempotency_key,
                fee_type='setup',
                provider_metadata=stripe_setup_intent.metadata
            )
            
            db.session.add(payment)
            db.session.commit()
            
            return payment
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating setup intent: {e}")
            raise TithiError(f"Setup intent creation failed: {str(e)}", error_code="TITHI_PAYMENT_STRIPE_ERROR")
        except Exception as e:
            logger.error(f"Error creating setup intent: {e}")
            db.session.rollback()
            raise TithiError(f"Setup intent creation failed: {str(e)}", error_code="TITHI_PAYMENT_CREATION_ERROR")
    
    def capture_no_show_fee(self, booking_id: str, tenant_id: str, 
                           no_show_fee_cents: int) -> Payment:
        """Capture no-show fee using previously authorized SetupIntent."""
        
        booking = Booking.query.filter_by(
            id=booking_id,
            tenant_id=tenant_id
        ).first()
        
        if not booking:
            raise TithiError("Booking not found", error_code="TITHI_BOOKING_NOT_FOUND")
        
        # Find the customer's default payment method
        payment_method = PaymentMethod.query.filter_by(
            tenant_id=tenant_id,
            customer_id=booking.customer_id,
            is_default=True
        ).first()
        
        if not payment_method:
            raise TithiError("No payment method found for no-show fee", 
                           error_code="TITHI_PAYMENT_NO_METHOD")
        
        # Check if tenant has Stripe Connect setup
        billing_service = BillingService()
        billing = billing_service.get_tenant_billing(tenant_id)
        
        if not billing or not billing.stripe_connect_enabled:
            raise TithiError("Tenant must complete Stripe Connect setup before capturing fees", 
                           error_code="TITHI_STRIPE_CONNECT_REQUIRED")
        
        try:
            # Calculate application fee for no-show fee
            application_fee_cents = int(no_show_fee_cents * 0.03)  # 3% platform fee
            
            # Create PaymentIntent using the stored payment method with Connect
            stripe_intent = stripe.PaymentIntent.create(
                amount=no_show_fee_cents,
                currency='USD',
                customer=booking.customer_id,
                payment_method=payment_method.stripe_payment_method_id,
                confirmation_method='automatic',
                confirm=True,
                application_fee_amount=application_fee_cents,
                transfer_data={
                    'destination': billing.stripe_account_id
                },
                metadata={
                    'tenant_id': tenant_id,
                    'booking_id': booking_id,
                    'fee_type': 'no_show'
                }
            )
            
            # Create payment record for no-show fee
            payment = Payment(
                tenant_id=tenant_id,
                booking_id=booking_id,
                customer_id=booking.customer_id,
                amount_cents=no_show_fee_cents,
                currency_code='USD',
                status='captured' if stripe_intent.status == 'succeeded' else 'failed',
                method='card',
                provider='stripe',
                provider_payment_id=stripe_intent.id,
                application_fee_cents=application_fee_cents,
                no_show_fee_cents=no_show_fee_cents,
                fee_type='no_show',
                provider_metadata=stripe_intent.metadata
            )
            
            db.session.add(payment)
            
            # Update booking status to no_show
            booking.no_show_flag = True
            booking.status = 'no_show'
            booking.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            # Emit observability hook
            logger.info("NO_SHOW_FEE_CAPTURED", extra={
                'tenant_id': tenant_id,
                'payment_id': str(payment.id),
                'booking_id': booking_id,
                'amount_cents': no_show_fee_cents,
                'application_fee_cents': application_fee_cents
            })
            
            return payment
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error capturing no-show fee: {e}")
            raise TithiError(f"No-show fee capture failed: {str(e)}", error_code="TITHI_PAYMENT_STRIPE_ERROR")
        except Exception as e:
            logger.error(f"Error capturing no-show fee: {e}")
            db.session.rollback()
            raise TithiError(f"No-show fee capture failed: {str(e)}", error_code="TITHI_PAYMENT_CAPTURE_ERROR")
    
    def create_zero_total_payment(self, tenant_id: str, booking_id: str, 
                                 customer_id: str, promotion_type: str, 
                                 promotion_id: str, discount_amount_cents: int) -> Payment:
        """Create a zero-total payment for fully discounted bookings."""
        
        # Create payment record for zero-total booking
        payment = Payment(
            tenant_id=tenant_id,
            booking_id=booking_id,
            customer_id=customer_id,
            amount_cents=0,
            currency_code='USD',
            status='succeeded',  # No payment required
            method='promotion',
            provider='internal',
            fee_type='booking',
            provider_metadata={
                'promotion_type': promotion_type,
                'promotion_id': promotion_id,
                'discount_amount_cents': discount_amount_cents,
                'zero_total': True
            }
        )
        
        db.session.add(payment)
        db.session.commit()
        
        logger.info("ZERO_TOTAL_PAYMENT_CREATED", extra={
            'tenant_id': tenant_id,
            'payment_id': str(payment.id),
            'booking_id': booking_id,
            'promotion_type': promotion_type,
            'discount_amount_cents': discount_amount_cents
        })
        
        return payment
    
    def process_refund(self, payment_id: str, tenant_id: str, amount_cents: int,
                      reason: str, refund_type: str = "partial") -> Refund:
        """Process a refund for a payment."""
        
        payment = Payment.query.filter_by(
            id=payment_id,
            tenant_id=tenant_id
        ).first()
        
        if not payment:
            raise TithiError("Payment not found", error_code="TITHI_PAYMENT_NOT_FOUND")
        
        if not payment.provider_payment_id:
            raise TithiError("No Stripe payment intent found", error_code="TITHI_PAYMENT_NO_STRIPE_INTENT")
        
        if amount_cents > payment.amount_cents:
            raise TithiError("Refund amount exceeds payment amount", error_code="TITHI_REFUND_AMOUNT_EXCEEDED")
        
        try:
            # Create Stripe refund
            stripe_refund = stripe.Refund.create(
                payment_intent=payment.provider_payment_id,
                amount=amount_cents,
                reason='requested_by_customer',
                metadata={
                    'tenant_id': tenant_id,
                    'payment_id': payment_id,
                    'refund_type': refund_type,
                    'reason': reason
                }
            )
            
            # Create refund record
            refund = Refund(
                tenant_id=tenant_id,
                payment_id=payment_id,
                booking_id=payment.booking_id,
                amount_cents=amount_cents,
                reason=reason,
                refund_type=refund_type,
                provider='stripe',
                provider_refund_id=stripe_refund.id,
                status='succeeded' if stripe_refund.status == 'succeeded' else 'failed',
                provider_metadata=stripe_refund.metadata
            )
            
            db.session.add(refund)
            
            # Update payment status if full refund
            if refund_type == "full" and amount_cents == payment.amount_cents:
                payment.status = 'refunded'
            
            db.session.commit()
            
            # Emit observability hook
            logger.info("REFUND_ISSUED", extra={
                'tenant_id': tenant_id,
                'payment_id': payment_id,
                'refund_id': str(refund.id),
                'amount_cents': amount_cents,
                'refund_type': refund_type
            })
            
            return refund
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error processing refund: {e}")
            raise TithiError(f"Refund processing failed: {str(e)}", error_code="TITHI_PAYMENT_STRIPE_ERROR")
        except Exception as e:
            logger.error(f"Error processing refund: {e}")
            db.session.rollback()
            raise TithiError(f"Refund processing failed: {str(e)}", error_code="TITHI_REFUND_PROCESSING_ERROR")
    
    def process_refund_with_cancellation_policy(self, booking_id: str, tenant_id: str, 
                                              reason: str = "Booking cancelled") -> Refund:
        """Process refund for cancelled booking with policy enforcement."""
        
        # Get booking and validate cancellation
        booking = Booking.query.filter_by(
            id=booking_id,
            tenant_id=tenant_id
        ).first()
        
        if not booking:
            raise TithiError("Booking not found", error_code="TITHI_BOOKING_NOT_FOUND")
        
        if booking.status != 'canceled':
            raise TithiError("Booking must be cancelled before refund", error_code="TITHI_REFUND_POLICY_VIOLATION")
        
        if not booking.canceled_at:
            raise TithiError("Booking cancellation timestamp not found", error_code="TITHI_REFUND_POLICY_VIOLATION")
        
        # Get payment for this booking
        payment = Payment.query.filter_by(
            booking_id=booking_id,
            tenant_id=tenant_id,
            status='captured'
        ).first()
        
        if not payment:
            raise TithiError("No captured payment found for booking", error_code="TITHI_PAYMENT_NOT_FOUND")
        
        # Get tenant cancellation policy
        tenant = Tenant.query.filter_by(id=tenant_id).first()
        if not tenant:
            raise TithiError("Tenant not found", error_code="TITHI_TENANT_NOT_FOUND")
        
        # Calculate refund amount based on cancellation policy
        refund_amount_cents, refund_type = self._calculate_refund_amount(
            booking, payment, tenant
        )
        
        if refund_amount_cents <= 0:
            raise TithiError("No refund available based on cancellation policy", 
                           error_code="TITHI_REFUND_POLICY_VIOLATION")
        
        # Process the refund
        refund = self.process_refund(
            payment_id=str(payment.id),
            tenant_id=tenant_id,
            amount_cents=refund_amount_cents,
            reason=reason,
            refund_type=refund_type
        )
        
        # Emit observability hook for cancellation refund
        logger.info("REFUND_ISSUED", extra={
            'tenant_id': tenant_id,
            'booking_id': booking_id,
            'refund_id': str(refund.id),
            'amount_cents': refund_amount_cents,
            'refund_type': refund_type,
            'cancellation_policy_applied': True
        })
        
        return refund
    
    def _calculate_refund_amount(self, booking: Booking, payment: Payment, tenant: Tenant) -> tuple[int, str]:
        """Calculate refund amount based on cancellation policy."""
        
        # Default cancellation policy: 24 hours notice required
        cancellation_window_hours = 24
        
        # Check if tenant has custom cancellation policy
        if hasattr(tenant, 'trust_copy_json') and tenant.trust_copy_json:
            policy_data = tenant.trust_copy_json
            if isinstance(policy_data, dict):
                # Look for cancellation policy in trust_copy_json
                cancellation_policy = policy_data.get('cancellation_policy', '')
                if '24 hour' in cancellation_policy.lower():
                    cancellation_window_hours = 24
                elif '48 hour' in cancellation_policy.lower():
                    cancellation_window_hours = 48
                elif '72 hour' in cancellation_policy.lower():
                    cancellation_window_hours = 72
        
        # Calculate time difference between cancellation and booking start
        cancellation_time = booking.canceled_at
        booking_start = booking.start_at
        
        if not cancellation_time or not booking_start:
            # If we can't determine timing, apply no-show fee policy
            return self._apply_no_show_fee_policy(payment, tenant)
        
        # Calculate hours between cancellation and booking start
        time_diff = booking_start - cancellation_time
        hours_before_booking = time_diff.total_seconds() / 3600
        
        # Determine refund amount based on timing
        if hours_before_booking >= cancellation_window_hours:
            # Full refund - cancelled within policy window
            return payment.amount_cents, "full"
        elif hours_before_booking >= 0:
            # Partial refund - cancelled outside policy window
            return self._apply_no_show_fee_policy(payment, tenant)
        else:
            # No-show (cancelled after booking time) - apply no-show fee
            return self._apply_no_show_fee_policy(payment, tenant)
    
    def _apply_no_show_fee_policy(self, payment: Payment, tenant: Tenant) -> tuple[int, str]:
        """Apply no-show fee policy to calculate refund amount."""
        
        # Default no-show fee: 3% of payment amount
        no_show_fee_percent = 3.0
        
        # Check tenant's default no-show fee percentage
        if hasattr(tenant, 'default_no_show_fee_percent') and tenant.default_no_show_fee_percent:
            no_show_fee_percent = float(tenant.default_no_show_fee_percent)
        
        # Calculate no-show fee
        no_show_fee_cents = int(payment.amount_cents * (no_show_fee_percent / 100))
        
        # Refund amount is original payment minus no-show fee
        refund_amount_cents = payment.amount_cents - no_show_fee_cents
        
        return refund_amount_cents, "partial"
    
    def get_payment_methods(self, tenant_id: str, customer_id: str) -> List[PaymentMethod]:
        """Get all payment methods for a customer."""
        return PaymentMethod.query.filter_by(
            tenant_id=tenant_id,
            customer_id=customer_id
        ).all()
    
    def set_default_payment_method(self, tenant_id: str, payment_method_id: str) -> PaymentMethod:
        """Set a payment method as default for a customer."""
        
        payment_method = PaymentMethod.query.filter_by(
            id=payment_method_id,
            tenant_id=tenant_id
        ).first()
        
        if not payment_method:
            raise TithiError("Payment method not found", error_code="TITHI_PAYMENT_METHOD_NOT_FOUND")
        
        # Unset all other default payment methods for this customer
        PaymentMethod.query.filter_by(
            tenant_id=tenant_id,
            customer_id=payment_method.customer_id,
            is_default=True
        ).update({'is_default': False})
        
        # Set this one as default
        payment_method.is_default = True
        db.session.commit()
        
        return payment_method


class InvoiceService:
    """Service for invoice-related business logic."""
    
    def create_invoice(self, invoice_data: Dict[str, Any]) -> Invoice:
        """Create a new invoice."""
        invoice = Invoice(**invoice_data)
        db.session.add(invoice)
        db.session.commit()
        return invoice


class BillingService:
    """Service for tenant billing and Stripe Connect integration."""
    
    def setup_stripe_connect(self, tenant_id: str, stripe_account_id: str) -> TenantBilling:
        """Setup Stripe Connect for a tenant."""
        
        billing = TenantBilling.query.filter_by(tenant_id=tenant_id).first()
        
        if not billing:
            billing = TenantBilling(
                tenant_id=tenant_id,
                stripe_account_id=stripe_account_id,
                stripe_connect_enabled=True
            )
            db.session.add(billing)
        else:
            billing.stripe_account_id = stripe_account_id
            billing.stripe_connect_enabled = True
        
        db.session.commit()
        return billing
    
    def get_tenant_billing(self, tenant_id: str) -> Optional[TenantBilling]:
        """Get tenant billing configuration."""
        return TenantBilling.query.filter_by(tenant_id=tenant_id).first()
    
    def create_stripe_connect_account(self, tenant_id: str, email: str, business_name: str) -> Dict[str, Any]:
        """Create Stripe Connect Express account for tenant."""
        import stripe
        
        try:
            # Create Stripe Connect Express account
            account = stripe.Account.create(
                type='express',
                country='US',  # Default to US, can be made configurable
                email=email,
                business_profile={
                    'name': business_name,
                    'url': f"https://{business_name.lower().replace(' ', '')}.tithi.app"  # Example subdomain
                },
                capabilities={
                    'card_payments': {'requested': True},
                    'transfers': {'requested': True}
                }
            )
            
            # Create account link for onboarding
            account_link = stripe.AccountLink.create(
                account=account.id,
                refresh_url=f"https://app.tithi.com/onboarding/stripe/refresh?tenant_id={tenant_id}",
                return_url=f"https://app.tithi.com/onboarding/stripe/return?tenant_id={tenant_id}",
                type='account_onboarding'
            )
            
            # Store account ID in database
            billing = self.setup_stripe_connect(tenant_id, account.id)
            
            return {
                'account_id': account.id,
                'onboarding_url': account_link.url,
                'billing_id': str(billing.id)
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe Connect account creation failed: {e}")
            raise TithiError(f"Stripe Connect setup failed: {str(e)}", error_code="TITHI_STRIPE_CONNECT_ERROR")
    
    def check_stripe_connect_status(self, tenant_id: str) -> Dict[str, Any]:
        """Check Stripe Connect account status and requirements."""
        billing = self.get_tenant_billing(tenant_id)
        if not billing or not billing.stripe_account_id:
            return {
                'connected': False,
                'ready_for_payouts': False,
                'requirements': []
            }
        
        import stripe
        
        try:
            account = stripe.Account.retrieve(billing.stripe_account_id)
            
            return {
                'connected': True,
                'ready_for_payouts': account.charges_enabled and account.payouts_enabled,
                'requirements': account.requirements.currently_due or [],
                'charges_enabled': account.charges_enabled,
                'payouts_enabled': account.payouts_enabled
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Error checking Stripe Connect status: {e}")
            return {
                'connected': False,
                'ready_for_payouts': False,
                'requirements': []
            }