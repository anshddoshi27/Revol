"""
Payment API Blueprint

This module contains payment-related API endpoints for Stripe integration.
Implements PaymentIntents, SetupIntents, refunds, and no-show fee processing.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_smorest import Api, abort
from marshmallow import Schema, fields, validate
from typing import Dict, Any
import uuid
import logging

from ..services.financial import PaymentService, BillingService
from ..extensions import celery, db
from ..models.audit import WebhookEventInbox
from ..jobs.webhook_inbox_worker import process_webhook_event
from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, get_current_tenant_id, get_current_user_id

logger = logging.getLogger(__name__)

# Create blueprint
payment_bp = Blueprint('payment_api', __name__, url_prefix='/api/payments')

# Create API instance (will be initialized when app is available)
api = None

# Initialize services
payment_service = PaymentService()
billing_service = BillingService()

def init_api(app):
    """Initialize the API with the Flask app."""
    global api
    if api is None:
        api = Api(app)


# Request/Response Schemas
class PaymentIntentRequestSchema(Schema):
    """Schema for creating payment intents."""
    booking_id = fields.Str(required=True)
    amount_cents = fields.Int(required=True, validate=validate.Range(min=1))
    currency = fields.Str(load_default="USD", validate=validate.OneOf(["USD", "EUR", "GBP", "CAD"]))
    customer_id = fields.Str(allow_none=True)
    idempotency_key = fields.Str(allow_none=True)


class PaymentIntentResponseSchema(Schema):
    """Schema for payment intent responses."""
    id = fields.Str()
    booking_id = fields.Str()
    customer_id = fields.Str(allow_none=True)
    amount_cents = fields.Int()
    currency_code = fields.Str()
    status = fields.Str()
    method = fields.Str()
    provider_payment_id = fields.Str()
    client_secret = fields.Str()
    created_at = fields.DateTime()


class SetupIntentRequestSchema(Schema):
    """Schema for creating setup intents."""
    customer_id = fields.Str(required=True)
    idempotency_key = fields.Str(allow_none=True)


class SetupIntentResponseSchema(Schema):
    """Schema for setup intent responses."""
    id = fields.Str()
    customer_id = fields.Str()
    status = fields.Str()
    provider_setup_intent_id = fields.Str()
    client_secret = fields.Str()
    created_at = fields.DateTime()


class RefundRequestSchema(Schema):
    """Schema for processing refunds."""
    payment_id = fields.Str(required=True)
    amount_cents = fields.Int(required=True, validate=validate.Range(min=1))
    reason = fields.Str(required=True)
    refund_type = fields.Str(load_default="partial", validate=validate.OneOf(["full", "partial", "no_show_fee_only"]))


class CancellationRefundRequestSchema(Schema):
    """Schema for processing refunds tied to booking cancellation."""
    booking_id = fields.Str(required=True)
    reason = fields.Str(load_default="Booking cancelled")


class RefundResponseSchema(Schema):
    """Schema for refund responses."""
    id = fields.Str()
    payment_id = fields.Str()
    booking_id = fields.Str(allow_none=True)
    amount_cents = fields.Int()
    reason = fields.Str()
    refund_type = fields.Str()
    status = fields.Str()
    provider_refund_id = fields.Str()
    created_at = fields.DateTime()


class NoShowFeeRequestSchema(Schema):
    """Schema for capturing no-show fees."""
    booking_id = fields.Str(required=True)
    no_show_fee_cents = fields.Int(required=True, validate=validate.Range(min=1))


class PaymentMethodResponseSchema(Schema):
    """Schema for payment method responses."""
    id = fields.Str()
    customer_id = fields.Str()
    type = fields.Str()
    last4 = fields.Str(allow_none=True)
    exp_month = fields.Int(allow_none=True)
    exp_year = fields.Int(allow_none=True)
    brand = fields.Str(allow_none=True)
    is_default = fields.Bool()
    created_at = fields.DateTime()


# API Endpoints
@payment_bp.route('/intent', methods=['POST'])
@require_auth
def create_payment_intent():
    """Create a Stripe PaymentIntent for a booking."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Validate request data
        schema = PaymentIntentRequestSchema()
        data = schema.load(request.json)
        
        # Create payment intent
        payment = payment_service.create_payment_intent(
            tenant_id=tenant_id,
            booking_id=data['booking_id'],
            amount_cents=data['amount_cents'],
            currency=data['currency'],
            customer_id=data.get('customer_id'),
            idempotency_key=data.get('idempotency_key')
        )
        
        # Get client secret from Stripe
        import stripe
        stripe.api_key = payment_service._get_stripe_secret_key()
        stripe_intent = stripe.PaymentIntent.retrieve(payment.provider_payment_id)
        
        # Prepare response
        response_data = {
            'id': str(payment.id),
            'booking_id': str(payment.booking_id),
            'customer_id': str(payment.customer_id) if payment.customer_id else None,
            'amount_cents': payment.amount_cents,
            'currency_code': payment.currency_code,
            'status': payment.status,
            'method': payment.method,
            'provider_payment_id': payment.provider_payment_id,
            'client_secret': stripe_intent.client_secret,
            'created_at': payment.created_at.isoformat()
        }
        
        logger.info("Payment intent created", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'payment_id': str(payment.id),
            'booking_id': data['booking_id'],
            'amount_cents': data['amount_cents']
        })
        
        return jsonify(response_data), 201
        
    except TithiError as e:
        logger.error(f"Payment intent creation failed: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'Payment Intent Creation Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error creating payment intent: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/intent/<payment_id>/confirm', methods=['POST'])
@require_auth
def confirm_payment_intent(payment_id):
    """Confirm a Stripe PaymentIntent."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Confirm payment intent
        payment = payment_service.confirm_payment_intent(
            payment_id=payment_id,
            tenant_id=tenant_id
        )
        
        # Prepare response
        response_data = {
            'id': str(payment.id),
            'booking_id': str(payment.booking_id),
            'customer_id': str(payment.customer_id) if payment.customer_id else None,
            'amount_cents': payment.amount_cents,
            'currency_code': payment.currency_code,
            'status': payment.status,
            'method': payment.method,
            'provider_payment_id': payment.provider_payment_id,
            'created_at': payment.created_at.isoformat()
        }
        
        logger.info("Payment intent confirmed", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'payment_id': payment_id,
            'status': payment.status
        })
        
        return jsonify(response_data), 200
        
    except TithiError as e:
        logger.error(f"Payment intent confirmation failed: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'Payment Intent Confirmation Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error confirming payment intent: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/setup-intent', methods=['POST'])
@require_auth
def create_setup_intent():
    """Create a Stripe SetupIntent for card-on-file authorization."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Validate request data
        schema = SetupIntentRequestSchema()
        data = schema.load(request.json)
        
        # Create setup intent
        payment = payment_service.create_setup_intent(
            tenant_id=tenant_id,
            customer_id=data['customer_id'],
            idempotency_key=data.get('idempotency_key')
        )
        
        # Get client secret from Stripe
        import stripe
        stripe.api_key = payment_service._get_stripe_secret_key()
        stripe_setup_intent = stripe.SetupIntent.retrieve(payment.provider_setup_intent_id)
        
        # Prepare response
        response_data = {
            'id': str(payment.id),
            'customer_id': str(payment.customer_id),
            'status': payment.status,
            'provider_setup_intent_id': payment.provider_setup_intent_id,
            'client_secret': stripe_setup_intent.client_secret,
            'created_at': payment.created_at.isoformat()
        }
        
        logger.info("Setup intent created", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'payment_id': str(payment.id),
            'customer_id': data['customer_id']
        })
        
        return jsonify(response_data), 201
        
    except TithiError as e:
        logger.error(f"Setup intent creation failed: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'Setup Intent Creation Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error creating setup intent: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/refund', methods=['POST'])
@require_auth
def process_refund():
    """Process a refund for a payment."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Validate request data
        schema = RefundRequestSchema()
        data = schema.load(request.json)
        
        # Process refund
        refund = payment_service.process_refund(
            payment_id=data['payment_id'],
            tenant_id=tenant_id,
            amount_cents=data['amount_cents'],
            reason=data['reason'],
            refund_type=data['refund_type']
        )
        
        # Prepare response
        response_data = {
            'id': str(refund.id),
            'payment_id': str(refund.payment_id),
            'booking_id': str(refund.booking_id) if refund.booking_id else None,
            'amount_cents': refund.amount_cents,
            'reason': refund.reason,
            'refund_type': refund.refund_type,
            'status': refund.status,
            'provider_refund_id': refund.provider_refund_id,
            'created_at': refund.created_at.isoformat()
        }
        
        logger.info("Refund processed", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'refund_id': str(refund.id),
            'payment_id': data['payment_id'],
            'amount_cents': data['amount_cents']
        })
        
        return jsonify(response_data), 201
        
    except TithiError as e:
        logger.error(f"Refund processing failed: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'Refund Processing Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error processing refund: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/refund/cancellation', methods=['POST'])
@require_auth
def process_cancellation_refund():
    """
    Process refund for cancelled booking with policy enforcement.
    
    This endpoint processes refunds tied to booking cancellation, automatically
    calculating refund amounts based on cancellation policies and timing.
    
    Input: {booking_id, reason}
    Output: {refund_id}
    """
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Validate request data
        schema = CancellationRefundRequestSchema()
        data = schema.load(request.json)
        
        booking_id = data['booking_id']
        reason = data['reason']
        
        # Process refund with cancellation policy
        refund = payment_service.process_refund_with_cancellation_policy(
            booking_id=booking_id,
            tenant_id=tenant_id,
            reason=reason
        )
        
        # Prepare response
        response_data = {
            'id': str(refund.id),
            'payment_id': str(refund.payment_id),
            'booking_id': str(refund.booking_id) if refund.booking_id else None,
            'amount_cents': refund.amount_cents,
            'reason': refund.reason,
            'refund_type': refund.refund_type,
            'status': refund.status,
            'provider_refund_id': refund.provider_refund_id,
            'created_at': refund.created_at.isoformat()
        }
        
        logger.info("Cancellation refund processed", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'refund_id': str(refund.id),
            'booking_id': booking_id,
            'amount_cents': refund.amount_cents,
            'refund_type': refund.refund_type
        })
        
        return jsonify(response_data), 201
        
    except TithiError as e:
        logger.error(f"Cancellation refund processing failed: {e.message}", extra={
            'tenant_id': tenant_id if 'tenant_id' in locals() else None,
            'user_id': user_id if 'user_id' in locals() else None,
            'error_code': e.code,
            'error_message': e.message
        })
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'Cancellation Refund Processing Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error processing cancellation refund: {e}", extra={
            'tenant_id': tenant_id if 'tenant_id' in locals() else None,
            'user_id': user_id if 'user_id' in locals() else None
        })
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/no-show-fee', methods=['POST'])
@require_auth
def capture_no_show_fee():
    """Capture no-show fee using previously authorized SetupIntent."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Validate request data
        schema = NoShowFeeRequestSchema()
        data = schema.load(request.json)
        
        # Capture no-show fee
        payment = payment_service.capture_no_show_fee(
            booking_id=data['booking_id'],
            tenant_id=tenant_id,
            no_show_fee_cents=data['no_show_fee_cents']
        )
        
        # Prepare response
        response_data = {
            'id': str(payment.id),
            'booking_id': str(payment.booking_id),
            'customer_id': str(payment.customer_id) if payment.customer_id else None,
            'amount_cents': payment.amount_cents,
            'no_show_fee_cents': payment.no_show_fee_cents,
            'currency_code': payment.currency_code,
            'status': payment.status,
            'method': payment.method,
            'provider_payment_id': payment.provider_payment_id,
            'created_at': payment.created_at.isoformat()
        }
        
        logger.info("No-show fee captured", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'payment_id': str(payment.id),
            'booking_id': data['booking_id'],
            'amount_cents': data['no_show_fee_cents']
        })
        
        return jsonify(response_data), 201
        
    except TithiError as e:
        logger.error(f"No-show fee capture failed: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'No-Show Fee Capture Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error capturing no-show fee: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/methods/<customer_id>', methods=['GET'])
@require_auth
def get_payment_methods(customer_id):
    """Get all payment methods for a customer."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Get payment methods
        payment_methods = payment_service.get_payment_methods(
            tenant_id=tenant_id,
            customer_id=customer_id
        )
        
        # Prepare response
        response_data = []
        for pm in payment_methods:
            response_data.append({
                'id': str(pm.id),
                'customer_id': str(pm.customer_id),
                'type': pm.type,
                'last4': pm.last4,
                'exp_month': pm.exp_month,
                'exp_year': pm.exp_year,
                'brand': pm.brand,
                'is_default': pm.is_default,
                'created_at': pm.created_at.isoformat()
            })
        
        logger.info("Payment methods retrieved", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'customer_id': customer_id,
            'count': len(payment_methods)
        })
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logger.error(f"Unexpected error getting payment methods: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/methods/<payment_method_id>/default', methods=['POST'])
@require_auth
def set_default_payment_method(payment_method_id):
    """Set a payment method as default for a customer."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Set default payment method
        payment_method = payment_service.set_default_payment_method(
            tenant_id=tenant_id,
            payment_method_id=payment_method_id
        )
        
        # Prepare response
        response_data = {
            'id': str(payment_method.id),
            'customer_id': str(payment_method.customer_id),
            'type': payment_method.type,
            'last4': payment_method.last4,
            'exp_month': payment_method.exp_month,
            'exp_year': payment_method.exp_year,
            'brand': payment_method.brand,
            'is_default': payment_method.is_default,
            'created_at': payment_method.created_at.isoformat()
        }
        
        logger.info("Default payment method set", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'payment_method_id': payment_method_id,
            'customer_id': str(payment_method.customer_id)
        })
        
        return jsonify(response_data), 200
        
    except TithiError as e:
        logger.error(f"Setting default payment method failed: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/payment-error',
            'title': 'Setting Default Payment Method Failed',
            'detail': str(e),
            'status': 400,
            'code': e.error_code
        }), 400
    except Exception as e:
        logger.error(f"Unexpected error setting default payment method: {e}")
        return jsonify({
            'type': 'https://tithi.com/errors/internal-error',
            'title': 'Internal Server Error',
            'detail': 'An unexpected error occurred',
            'status': 500
        }), 500


@payment_bp.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events: validate, upsert inbox row, enqueue processor."""
    try:
        import stripe
        # Signature header and payload
        sig_header = request.headers.get('Stripe-Signature')
        payload_bytes = request.get_data()

        webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET')
        dev_bypass = request.headers.get('X-Debug-Bypass', 'false').lower() in ['1', 'true', 'yes']

        event = None
        if webhook_secret:
            try:
                stripe.api_key = payment_service._get_stripe_secret_key()
                event = stripe.Webhook.construct_event(payload_bytes, sig_header, webhook_secret)
            except Exception as e:
                logger.error(f"Webhook signature validation failed: {e}")
                return jsonify({'error': 'Invalid signature'}), 400
        else:
            if current_app.config.get('ENV') == 'production' and not dev_bypass:
                return jsonify({'error': 'Signature required'}), 400
            if not dev_bypass:
                return jsonify({'error': 'Missing signature; set X-Debug-Bypass: true in dev'}), 400
            # Accept raw JSON in dev bypass
            event = request.get_json(silent=True) or {}

        event_id = (event.get('id') if isinstance(event, dict) else None) or ''
        if not event_id:
            return jsonify({'error': 'Invalid event payload'}), 400

        # Upsert into webhook_events_inbox; on conflict no-op
        existing = WebhookEventInbox.query.filter_by(provider='stripe', id=event_id).first()
        if existing is None:
            inbox = WebhookEventInbox(provider='stripe', id=event_id, payload=event)
            db.session.add(inbox)
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()

        # Enqueue processing task (idempotent)
        process_webhook_event.delay('stripe', event_id)

        return jsonify({'status': 'ok'}), 200

    except Exception as e:
        logger.error(f"Unexpected error handling webhook: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Request/Response Schemas for Checkout
class CheckoutRequestSchema(Schema):
    """Schema for checkout requests."""
    booking_id = fields.Str(required=True, validate=validate.Length(min=1))
    payment_method = fields.Str(required=True, validate=validate.OneOf(['card', 'apple_pay', 'google_pay', 'paypal']))
    customer_id = fields.Str(required=False, allow_none=True)
    idempotency_key = fields.Str(required=False, allow_none=True)


class CheckoutResponseSchema(Schema):
    """Schema for checkout responses."""
    payment_intent_id = fields.Str()
    client_secret = fields.Str()
    status = fields.Str()
    amount_cents = fields.Int()
    currency_code = fields.Str()
    created_at = fields.DateTime()


@payment_bp.route('/checkout', methods=['POST'])
@require_auth
def create_checkout():
    """
    Create a Stripe checkout session for a booking.
    
    This endpoint creates a PaymentIntent for a booking and returns the client secret
    needed to complete the payment on the frontend.
    
    Input: {booking_id, payment_method}
    Output: {payment_intent_id}
    """
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        # Validate request data
        schema = CheckoutRequestSchema()
        data = schema.load(request.json)
        
        booking_id = data['booking_id']
        payment_method = data['payment_method']
        customer_id = data.get('customer_id')
        idempotency_key = data.get('idempotency_key') or str(uuid.uuid4())
        
        # Validate booking exists and belongs to tenant
        from ..models.business import Booking
        booking = Booking.query.filter_by(
            id=booking_id,
            tenant_id=tenant_id
        ).first()
        
        if not booking:
            logger.warning("Booking not found for checkout", extra={
                'tenant_id': tenant_id,
                'user_id': user_id,
                'booking_id': booking_id
            })
            raise TithiError("TITHI_BOOKING_NOT_FOUND", "Booking not found", 404)
        
        # Check if booking is in a valid state for payment
        if booking.status not in ['pending', 'confirmed']:
            logger.warning("Invalid booking status for checkout", extra={
                'tenant_id': tenant_id,
                'user_id': user_id,
                'booking_id': booking_id,
                'booking_status': booking.status
            })
            raise TithiError("TITHI_BOOKING_INVALID_STATUS", 
                           f"Booking status '{booking.status}' is not valid for payment", 400)
        
        # Calculate total amount from booking
        # For now, we'll use a simple calculation - in production this would be more complex
        total_amount_cents = 0
        
        # Get service price from booking
        if hasattr(booking, 'service_snapshot') and booking.service_snapshot:
            service_data = booking.service_snapshot
            if isinstance(service_data, dict) and 'price_cents' in service_data:
                total_amount_cents = service_data['price_cents']
            else:
                # Fallback: get from service directly
                from ..models.business import Service
                service = Service.query.filter_by(
                    id=booking.service_id,
                    tenant_id=tenant_id
                ).first()
                if service:
                    total_amount_cents = service.price_cents
        
        if total_amount_cents <= 0:
            logger.error("Invalid booking amount for checkout", extra={
                'tenant_id': tenant_id,
                'user_id': user_id,
                'booking_id': booking_id,
                'amount_cents': total_amount_cents
            })
            raise TithiError("TITHI_BOOKING_INVALID_AMOUNT", "Booking amount is invalid", 400)
        
        # Create payment intent
        payment = payment_service.create_payment_intent(
            tenant_id=tenant_id,
            booking_id=booking_id,
            amount_cents=total_amount_cents,
            currency="USD",
            customer_id=customer_id,
            idempotency_key=idempotency_key
        )
        
        # Get client secret from Stripe
        import stripe
        stripe.api_key = payment_service._get_stripe_secret_key()
        stripe_intent = stripe.PaymentIntent.retrieve(payment.provider_payment_id)
        
        # Prepare response
        response_data = {
            'payment_intent_id': payment.provider_payment_id,
            'client_secret': stripe_intent.client_secret,
            'status': payment.status,
            'amount_cents': payment.amount_cents,
            'currency_code': payment.currency_code,
            'created_at': payment.created_at.isoformat()
        }
        
        logger.info("Checkout created successfully", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'payment_id': str(payment.id),
            'booking_id': booking_id,
            'amount_cents': total_amount_cents,
            'payment_intent_id': payment.provider_payment_id
        })
        
        return jsonify(response_data), 201
        
    except TithiError as e:
        logger.error(f"Tithi error in checkout: {e.message}", extra={
            'tenant_id': tenant_id if 'tenant_id' in locals() else None,
            'user_id': user_id if 'user_id' in locals() else None,
            'error_code': e.code,
            'error_message': e.message
        })
        return jsonify({
            'error': e.code,
            'message': e.message
        }), e.status_code
        
    except Exception as e:
        logger.error(f"Unexpected error in checkout: {e}", extra={
            'tenant_id': tenant_id if 'tenant_id' in locals() else None,
            'user_id': user_id if 'user_id' in locals() else None
        })
        return jsonify({
            'error': 'TITHI_CHECKOUT_FAILED',
            'message': 'Failed to create checkout session'
        }), 500
