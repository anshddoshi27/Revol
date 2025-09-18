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
        
        try:
            # Create Stripe PaymentIntent
            stripe_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=currency,
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
                'stripe_payment_intent_id': stripe_intent.id
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
        
        try:
            # Create PaymentIntent using the stored payment method
            stripe_intent = stripe.PaymentIntent.create(
                amount=no_show_fee_cents,
                currency='USD',
                customer=booking.customer_id,
                payment_method=payment_method.stripe_payment_method_id,
                confirmation_method='automatic',
                confirm=True,
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
                no_show_fee_cents=no_show_fee_cents,
                fee_type='no_show',
                provider_metadata=stripe_intent.metadata
            )
            
            db.session.add(payment)
            db.session.commit()
            
            # Emit observability hook
            logger.info("NO_SHOW_FEE_CAPTURED", extra={
                'tenant_id': tenant_id,
                'payment_id': str(payment.id),
                'booking_id': booking_id,
                'amount_cents': no_show_fee_cents
            })
            
            return payment
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error capturing no-show fee: {e}")
            raise TithiError(f"No-show fee capture failed: {str(e)}", error_code="TITHI_PAYMENT_STRIPE_ERROR")
        except Exception as e:
            logger.error(f"Error capturing no-show fee: {e}")
            db.session.rollback()
            raise TithiError(f"No-show fee capture failed: {str(e)}", error_code="TITHI_PAYMENT_CAPTURE_ERROR")
    
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
            logger.info("PAYMENT_REFUNDED", extra={
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
