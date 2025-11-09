"""
Stripe Connect API Blueprint

Handles Stripe Connect onboarding and management for tenants.
"""

from flask import Blueprint, jsonify, request
from flask_smorest import Api, abort
import logging

from ..middleware.auth_middleware import require_auth, get_current_tenant_id, get_current_user_id
from ..middleware.error_handler import TithiError
from ..services.financial import BillingService
from ..extensions import db

logger = logging.getLogger(__name__)

stripe_connect_bp = Blueprint("stripe_connect", __name__)


@stripe_connect_bp.route('/setup', methods=['POST'])
@require_auth
def setup_stripe_connect():
    """Create Stripe Connect Express account for tenant."""
    try:
        tenant_id = get_current_tenant_id()
        user_id = get_current_user_id()
        
        data = request.get_json()
        email = data.get('email')
        business_name = data.get('business_name')
        
        if not email or not business_name:
            raise TithiError("Email and business_name are required", 
                           error_code="TITHI_MISSING_FIELDS", status_code=400)
        
        billing_service = BillingService()
        result = billing_service.create_stripe_connect_account(
            tenant_id=tenant_id,
            email=email,
            business_name=business_name
        )
        
        logger.info("Stripe Connect setup initiated", extra={
            'tenant_id': tenant_id,
            'user_id': user_id,
            'account_id': result['account_id']
        })
        
        return jsonify({
            'success': True,
            'account_id': result['account_id'],
            'onboarding_url': result['onboarding_url'],
            'message': 'Stripe Connect account created. Complete onboarding to start accepting payments.'
        }), 201
        
    except TithiError as e:
        logger.error(f"Stripe Connect setup failed: {e.message}")
        return jsonify({
            'success': False,
            'error': e.message,
            'error_code': e.error_code
        }), e.status_code
    except Exception as e:
        logger.error(f"Unexpected error in Stripe Connect setup: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@stripe_connect_bp.route('/status', methods=['GET'])
@require_auth
def get_stripe_connect_status():
    """Get Stripe Connect account status for tenant."""
    try:
        tenant_id = get_current_tenant_id()
        
        billing_service = BillingService()
        status = billing_service.check_stripe_connect_status(tenant_id)
        
        return jsonify({
            'success': True,
            'stripe_connect': status
        }), 200
        
    except Exception as e:
        logger.error(f"Error checking Stripe Connect status: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@stripe_connect_bp.route('/webhook/account', methods=['POST'])
def stripe_connect_webhook():
    """Handle Stripe Connect account webhooks."""
    try:
        import stripe
        
        # Get webhook signature
        sig_header = request.headers.get('Stripe-Signature')
        payload_bytes = request.get_data()
        
        # Verify webhook signature (in production)
        webhook_secret = request.headers.get('X-Webhook-Secret', 'whsec_test')
        
        try:
            event = stripe.Webhook.construct_event(
                payload_bytes, sig_header, webhook_secret
            )
        except Exception as e:
            logger.error(f"Webhook signature verification failed: {e}")
            return jsonify({'error': 'Invalid signature'}), 400
        
        event_type = event['type']
        event_data = event['data']['object']
        
        if event_type == 'account.updated':
            # Handle account updates
            account_id = event_data['id']
            charges_enabled = event_data.get('charges_enabled', False)
            payouts_enabled = event_data.get('payouts_enabled', False)
            
            # Update tenant billing status
            from ..models.financial import TenantBilling
            billing = TenantBilling.query.filter_by(
                stripe_account_id=account_id
            ).first()
            
            if billing:
                billing.stripe_connect_enabled = charges_enabled and payouts_enabled
                db.session.commit()
                
                logger.info("Stripe Connect account updated", extra={
                    'tenant_id': billing.tenant_id,
                    'account_id': account_id,
                    'charges_enabled': charges_enabled,
                    'payouts_enabled': payouts_enabled
                })
        
        return jsonify({'status': 'ok'}), 200
        
    except Exception as e:
        logger.error(f"Error processing Stripe Connect webhook: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
