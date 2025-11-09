"""
Webhook Inbox Worker

Celery task to idempotently process webhook events from webhook_events_inbox.
"""

from datetime import datetime
import logging

from ..extensions import celery, db
from ..models.audit import WebhookEventInbox
from ..models.financial import Payment
from ..models.business import Booking
from ..services.business_phase2 import BookingService
from ..services.financial import PaymentService

logger = logging.getLogger(__name__)


@celery.task(name="app.jobs.webhook_inbox_worker.process_webhook_event")
def process_webhook_event(provider: str, event_id: str) -> bool:
    """Process a webhook event if not already processed. Idempotent."""
    inbox = WebhookEventInbox.query.filter_by(provider=provider, id=event_id).first()
    if inbox is None:
        # Nothing to process
        return False

    if inbox.processed_at is not None:
        return True

    payload = inbox.payload or {}

    # In dev/test we skip signature validation here; endpoint handles it.
    event_type = payload.get("type")
    event_data = payload.get("data", {}).get("object", {})

    try:
        if event_type == "payment_intent.succeeded":
            _handle_payment_succeeded(event_data)
        elif event_type == "payment_intent.payment_failed":
            _handle_payment_failed(event_data)
        elif event_type == "setup_intent.succeeded":
            _handle_setup_succeeded(event_data)
        else:
            logger.info(f"Unhandled webhook event type: {event_type}")

        inbox.processed_at = datetime.utcnow()
        db.session.add(inbox)
        db.session.commit()
        return True
        
    except Exception as e:
        logger.error(f"Error processing webhook event {event_id}: {str(e)}")
        db.session.rollback()
        return False


def _handle_payment_succeeded(event_data):
    """Handle payment_intent.succeeded webhook."""
    stripe_payment_intent_id = event_data.get("id")
    if not stripe_payment_intent_id:
        return
    
    # Find payment by Stripe PaymentIntent ID
    payment = Payment.query.filter_by(
        provider_payment_id=stripe_payment_intent_id
    ).first()
    
    if not payment:
        logger.warning(f"Payment not found for Stripe PaymentIntent: {stripe_payment_intent_id}")
        return
    
    # Update payment status
    payment.status = "succeeded"
    payment.provider_charge_id = event_data.get("latest_charge")
    payment.provider_metadata = event_data.get("metadata", {})
    
    # Confirm booking if it exists and is pending
    if payment.booking_id:
        booking = Booking.query.filter_by(
            id=payment.booking_id,
            tenant_id=payment.tenant_id
        ).first()
        
        if booking and booking.status == "pending":
            booking_service = BookingService()
            booking_service.confirm_booking(
                tenant_id=payment.tenant_id,
                booking_id=payment.booking_id,
                user_id=None,  # System action
                require_payment=False  # Payment already succeeded
            )
            logger.info(f"Booking {payment.booking_id} confirmed after payment success")
    
    db.session.commit()
    logger.info(f"Payment {payment.id} marked as succeeded")


def _handle_payment_failed(event_data):
    """Handle payment_intent.payment_failed webhook."""
    stripe_payment_intent_id = event_data.get("id")
    if not stripe_payment_intent_id:
        return
    
    # Find payment by Stripe PaymentIntent ID
    payment = Payment.query.filter_by(
        provider_payment_id=stripe_payment_intent_id
    ).first()
    
    if not payment:
        logger.warning(f"Payment not found for Stripe PaymentIntent: {stripe_payment_intent_id}")
        return
    
    # Update payment status
    payment.status = "failed"
    payment.provider_metadata = event_data.get("metadata", {})
    
    # Cancel booking if it exists and is pending
    if payment.booking_id:
        booking = Booking.query.filter_by(
            id=payment.booking_id,
            tenant_id=payment.tenant_id
        ).first()
        
        if booking and booking.status == "pending":
            booking.status = "failed"
            booking.updated_at = datetime.utcnow()
            logger.info(f"Booking {payment.booking_id} marked as failed after payment failure")
    
    db.session.commit()
    logger.info(f"Payment {payment.id} marked as failed")


def _handle_setup_succeeded(event_data):
    """Handle setup_intent.succeeded webhook."""
    stripe_setup_intent_id = event_data.get("id")
    if not stripe_setup_intent_id:
        return
    
    # Find payment by Stripe SetupIntent ID
    payment = Payment.query.filter_by(
        provider_setup_intent_id=stripe_setup_intent_id
    ).first()
    
    if not payment:
        logger.warning(f"Payment not found for Stripe SetupIntent: {stripe_setup_intent_id}")
        return
    
    # Update payment status for cash bookings
    payment.status = "succeeded"
    payment.provider_metadata = event_data.get("metadata", {})
    
    # For cash bookings, mark as pending_cash (not confirmed yet)
    if payment.booking_id:
        booking = Booking.query.filter_by(
            id=payment.booking_id,
            tenant_id=payment.tenant_id
        ).first()
        
        if booking and booking.status == "pending":
            # Cash bookings stay pending until service completion or no-show
            logger.info(f"Cash booking {payment.booking_id} setup intent succeeded")
    
    db.session.commit()
    logger.info(f"Setup intent {payment.id} marked as succeeded")


