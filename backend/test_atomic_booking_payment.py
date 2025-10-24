"""
Comprehensive tests for atomic booking and payment flows.

Tests all the critical payment flows:
- Webhook processing for payment success/failure
- Stripe Connect onboarding and fund transfers
- Cash payments with SetupIntent and no-show fee capture
- Full-cover gift card enforcement
- Coupon validation with zero-total handling
- Booking creation idempotency
- Customer upsert and metrics tracking
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

from app.extensions import db
from app.models.business import Booking, Customer, CustomerMetrics
from app.models.financial import Payment, PaymentMethod, TenantBilling
from app.models.promotions import GiftCard, Coupon
from app.services.financial import PaymentService, BillingService
from app.services.business_phase2 import BookingService, CustomerService
from app.services.promotion import PromotionService
from app.jobs.webhook_inbox_worker import process_webhook_event
from app.middleware.error_handler import TithiError


class TestWebhookProcessing:
    """Test webhook processing for payment events."""
    
    def test_payment_succeeded_webhook(self, app, sample_tenant, sample_booking):
        """Test payment_intent.succeeded webhook updates booking status."""
        with app.app_context():
            # Create a pending booking with payment
            payment = Payment(
                id=uuid.uuid4(),
                tenant_id=sample_tenant.id,
                booking_id=sample_booking.id,
                customer_id=sample_booking.customer_id,
                amount_cents=5000,
                status='requires_action',
                provider_payment_id='pi_test_123',
                method='card'
            )
            db.session.add(payment)
            db.session.commit()
            
            # Mock webhook event data
            event_data = {
                'id': 'pi_test_123',
                'status': 'succeeded',
                'latest_charge': 'ch_test_123',
                'metadata': {'test': 'data'}
            }
            
            # Process webhook
            from app.jobs.webhook_inbox_worker import _handle_payment_succeeded
            _handle_payment_succeeded(event_data)
            
            # Verify payment status updated
            updated_payment = Payment.query.filter_by(provider_payment_id='pi_test_123').first()
            assert updated_payment.status == 'succeeded'
            assert updated_payment.provider_charge_id == 'ch_test_123'
            
            # Verify booking confirmed
            updated_booking = Booking.query.get(sample_booking.id)
            assert updated_booking.status == 'confirmed'
    
    def test_payment_failed_webhook(self, app, sample_tenant, sample_booking):
        """Test payment_intent.payment_failed webhook cancels booking."""
        with app.app_context():
            # Create a pending booking with payment
            payment = Payment(
                id=uuid.uuid4(),
                tenant_id=sample_tenant.id,
                booking_id=sample_booking.id,
                customer_id=sample_booking.customer_id,
                amount_cents=5000,
                status='requires_action',
                provider_payment_id='pi_test_456',
                method='card'
            )
            db.session.add(payment)
            db.session.commit()
            
            # Mock webhook event data
            event_data = {
                'id': 'pi_test_456',
                'status': 'payment_failed',
                'metadata': {'test': 'data'}
            }
            
            # Process webhook
            from app.jobs.webhook_inbox_worker import _handle_payment_failed
            _handle_payment_failed(event_data)
            
            # Verify payment status updated
            updated_payment = Payment.query.filter_by(provider_payment_id='pi_test_456').first()
            assert updated_payment.status == 'failed'
            
            # Verify booking failed
            updated_booking = Booking.query.get(sample_booking.id)
            assert updated_booking.status == 'failed'


class TestStripeConnect:
    """Test Stripe Connect onboarding and fund transfers."""
    
    @patch('app.services.financial.stripe')
    def test_create_stripe_connect_account(self, mock_stripe, app, sample_tenant):
        """Test Stripe Connect account creation."""
        with app.app_context():
            # Mock Stripe API responses
            mock_account = Mock()
            mock_account.id = 'acct_test_123'
            mock_stripe.Account.create.return_value = mock_account
            
            mock_account_link = Mock()
            mock_account_link.url = 'https://connect.stripe.com/setup/test'
            mock_stripe.AccountLink.create.return_value = mock_account_link
            
            billing_service = BillingService()
            result = billing_service.create_stripe_connect_account(
                tenant_id=str(sample_tenant.id),
                email='test@example.com',
                business_name='Test Business'
            )
            
            # Verify Stripe API calls
            mock_stripe.Account.create.assert_called_once()
            mock_stripe.AccountLink.create.assert_called_once()
            
            # Verify database record
            billing = TenantBilling.query.filter_by(tenant_id=sample_tenant.id).first()
            assert billing.stripe_account_id == 'acct_test_123'
            assert billing.stripe_connect_enabled == True
            
            # Verify response
            assert result['account_id'] == 'acct_test_123'
            assert 'onboarding_url' in result
    
    def test_payment_intent_with_connect(self, app, sample_tenant, sample_booking):
        """Test PaymentIntent creation with Stripe Connect."""
        with app.app_context():
            # Setup tenant billing
            billing = TenantBilling(
                tenant_id=sample_tenant.id,
                stripe_account_id='acct_test_123',
                stripe_connect_enabled=True
            )
            db.session.add(billing)
            db.session.commit()
            
            payment_service = PaymentService()
            
            with patch('app.services.financial.stripe') as mock_stripe:
                mock_intent = Mock()
                mock_intent.id = 'pi_test_connect_123'
                mock_stripe.PaymentIntent.create.return_value = mock_intent
                
                payment = payment_service.create_payment_intent(
                    tenant_id=str(sample_tenant.id),
                    booking_id=str(sample_booking.id),
                    amount_cents=5000
                )
                
                # Verify Stripe API call includes Connect parameters
                mock_stripe.PaymentIntent.create.assert_called_once()
                call_args = mock_stripe.PaymentIntent.create.call_args
                assert 'application_fee_amount' in call_args[1]
                assert 'transfer_data' in call_args[1]
                assert call_args[1]['transfer_data']['destination'] == 'acct_test_123'


class TestCashPayments:
    """Test cash payment flow with SetupIntent and no-show fees."""
    
    @patch('app.services.financial.stripe')
    def test_create_setup_intent(self, mock_stripe, app, sample_tenant, sample_customer):
        """Test SetupIntent creation for cash payments."""
        with app.app_context():
            mock_setup_intent = Mock()
            mock_setup_intent.id = 'seti_test_123'
            mock_stripe.SetupIntent.create.return_value = mock_setup_intent
            
            payment_service = PaymentService()
            payment = payment_service.create_setup_intent(
                tenant_id=str(sample_tenant.id),
                customer_id=str(sample_customer.id)
            )
            
            # Verify SetupIntent creation
            mock_stripe.SetupIntent.create.assert_called_once()
            call_args = mock_stripe.SetupIntent.create.call_args
            assert call_args[1]['customer'] == str(sample_customer.id)
            assert call_args[1]['usage'] == 'off_session'
            
            # Verify payment record
            assert payment.provider_setup_intent_id == 'seti_test_123'
            assert payment.method == 'cash'
            assert payment.amount_cents == 0
    
    @patch('app.services.financial.stripe')
    def test_capture_no_show_fee(self, mock_stripe, app, sample_tenant, sample_booking, sample_customer):
        """Test no-show fee capture using stored payment method."""
        with app.app_context():
            # Setup tenant billing
            billing = TenantBilling(
                tenant_id=sample_tenant.id,
                stripe_account_id='acct_test_123',
                stripe_connect_enabled=True
            )
            db.session.add(billing)
            
            # Create payment method
            payment_method = PaymentMethod(
                tenant_id=sample_tenant.id,
                customer_id=sample_booking.customer_id,
                stripe_payment_method_id='pm_test_123',
                type='card',
                is_default=True
            )
            db.session.add(payment_method)
            db.session.commit()
            
            # Mock Stripe API
            mock_intent = Mock()
            mock_intent.status = 'succeeded'
            mock_intent.id = 'pi_noshow_123'
            mock_stripe.PaymentIntent.create.return_value = mock_intent
            
            payment_service = PaymentService()
            payment = payment_service.capture_no_show_fee(
                booking_id=str(sample_booking.id),
                tenant_id=str(sample_tenant.id),
                no_show_fee_cents=2500
            )
            
            # Verify Stripe API call
            mock_stripe.PaymentIntent.create.assert_called_once()
            call_args = mock_stripe.PaymentIntent.create.call_args
            assert call_args[1]['amount'] == 2500
            assert call_args[1]['application_fee_amount'] > 0
            assert 'transfer_data' in call_args[1]
            
            # Verify payment record
            assert payment.no_show_fee_cents == 2500
            assert payment.fee_type == 'no_show'
            assert payment.status == 'captured'
            
            # Verify booking status updated
            updated_booking = Booking.query.get(sample_booking.id)
            assert updated_booking.no_show_flag == True
            assert updated_booking.status == 'no_show'


class TestGiftCardEnforcement:
    """Test full-cover gift card enforcement (V1 rule)."""
    
    def test_gift_card_full_coverage_success(self, app, sample_tenant, sample_customer):
        """Test gift card that fully covers amount succeeds."""
        with app.app_context():
            # Create gift card with sufficient balance
            gift_card = GiftCard(
                tenant_id=sample_tenant.id,
                code='GIFT123',
                balance_cents=10000,  # $100
                is_active=True,
                is_redeemed=False
            )
            db.session.add(gift_card)
            db.session.commit()
            
            promotion_service = PromotionService()
            result = promotion_service.apply_promotion(
                tenant_id=str(sample_tenant.id),
                customer_id=str(sample_customer.id),
                booking_id=str(uuid.uuid4()),
                payment_id=str(uuid.uuid4()),
                amount_cents=5000,  # $50
                gift_card_code='GIFT123'
            )
            
            # Verify full coverage
            assert result['final_amount_cents'] == 0
            assert result['zero_total'] == True
            assert result['discount_amount_cents'] == 5000
    
    def test_gift_card_insufficient_balance_fails(self, app, sample_tenant, sample_customer):
        """Test gift card with insufficient balance fails in V1."""
        with app.app_context():
            # Create gift card with insufficient balance
            gift_card = GiftCard(
                tenant_id=sample_tenant.id,
                code='GIFT456',
                balance_cents=2000,  # $20
                is_active=True,
                is_redeemed=False
            )
            db.session.add(gift_card)
            db.session.commit()
            
            promotion_service = PromotionService()
            
            with pytest.raises(TithiError) as exc_info:
                promotion_service.apply_promotion(
                    tenant_id=str(sample_tenant.id),
                    customer_id=str(sample_customer.id),
                    booking_id=str(uuid.uuid4()),
                    payment_id=str(uuid.uuid4()),
                    amount_cents=5000,  # $50
                    gift_card_code='GIFT456'
                )
            
            assert 'TITHI_GIFT_CARD_INSUFFICIENT' in str(exc_info.value)


class TestCouponZeroTotal:
    """Test coupon validation with zero-total handling."""
    
    def test_coupon_zero_total_handling(self, app, sample_tenant, sample_customer):
        """Test coupon that makes total zero."""
        with app.app_context():
            # Create 100% discount coupon
            coupon = Coupon(
                tenant_id=sample_tenant.id,
                code='FREE100',
                discount_type='percent',
                discount_value=100,
                is_active=True,
                usage_limit=10,
                usage_count=0
            )
            db.session.add(coupon)
            db.session.commit()
            
            promotion_service = PromotionService()
            result = promotion_service.apply_promotion(
                tenant_id=str(sample_tenant.id),
                customer_id=str(sample_customer.id),
                booking_id=str(uuid.uuid4()),
                payment_id=str(uuid.uuid4()),
                amount_cents=5000,
                coupon_code='FREE100'
            )
            
            # Verify zero total
            assert result['final_amount_cents'] == 0
            assert result['zero_total'] == True
            assert result['discount_amount_cents'] == 5000


class TestBookingIdempotency:
    """Test booking creation idempotency."""
    
    def test_booking_idempotency_same_client_id(self, app, sample_tenant, sample_customer):
        """Test that same client_generated_id returns existing booking."""
        with app.app_context():
            booking_service = BookingService()
            
            # Create first booking
            booking_data = {
                'customer_id': str(sample_customer.id),
                'service_id': str(uuid.uuid4()),
                'resource_id': str(uuid.uuid4()),
                'start_at': (datetime.utcnow() + timedelta(days=1)).isoformat(),
                'end_at': (datetime.utcnow() + timedelta(days=1, hours=1)).isoformat(),
                'client_generated_id': 'test_booking_123'
            }
            
            booking1 = booking_service.create_booking(
                tenant_id=sample_tenant.id,
                booking_data=booking_data,
                user_id=uuid.uuid4()
            )
            
            # Create second booking with same client_generated_id
            booking2 = booking_service.create_booking(
                tenant_id=sample_tenant.id,
                booking_data=booking_data,
                user_id=uuid.uuid4()
            )
            
            # Should return same booking
            assert booking1.id == booking2.id
    
    def test_booking_idempotency_auto_generated(self, app, sample_tenant, sample_customer):
        """Test that missing client_generated_id gets auto-generated."""
        with app.app_context():
            booking_service = BookingService()
            
            booking_data = {
                'customer_id': str(sample_customer.id),
                'service_id': str(uuid.uuid4()),
                'resource_id': str(uuid.uuid4()),
                'start_at': (datetime.utcnow() + timedelta(days=1)).isoformat(),
                'end_at': (datetime.utcnow() + timedelta(days=1, hours=1)).isoformat()
                # No client_generated_id provided
            }
            
            booking = booking_service.create_booking(
                tenant_id=sample_tenant.id,
                booking_data=booking_data,
                user_id=uuid.uuid4()
            )
            
            # Should have auto-generated client_generated_id
            assert booking.client_generated_id.startswith('booking_')


class TestCustomerUpsert:
    """Test customer upsert and metrics tracking."""
    
    def test_customer_upsert_existing(self, app, sample_tenant):
        """Test customer upsert updates existing customer."""
        with app.app_context():
            # Create existing customer
            existing_customer = Customer(
                tenant_id=sample_tenant.id,
                email='test@example.com',
                display_name='Old Name',
                phone='123-456-7890'
            )
            db.session.add(existing_customer)
            db.session.commit()
            
            customer_service = CustomerService()
            updated_customer = customer_service.upsert_customer(
                tenant_id=sample_tenant.id,
                customer_data={
                    'email': 'test@example.com',
                    'display_name': 'New Name',
                    'phone': '987-654-3210'
                }
            )
            
            # Should return same customer with updated data
            assert updated_customer.id == existing_customer.id
            assert updated_customer.display_name == 'New Name'
            assert updated_customer.phone == '987-654-3210'
    
    def test_customer_upsert_new(self, app, sample_tenant):
        """Test customer upsert creates new customer."""
        with app.app_context():
            customer_service = CustomerService()
            new_customer = customer_service.upsert_customer(
                tenant_id=sample_tenant.id,
                customer_data={
                    'email': 'new@example.com',
                    'display_name': 'New Customer'
                }
            )
            
            # Should create new customer
            assert new_customer.email == 'new@example.com'
            assert new_customer.display_name == 'New Customer'
    
    def test_customer_metrics_tracking(self, app, sample_tenant, sample_customer):
        """Test customer metrics are updated on booking creation."""
        with app.app_context():
            booking_service = BookingService()
            
            booking_data = {
                'customer_id': str(sample_customer.id),
                'service_id': str(uuid.uuid4()),
                'resource_id': str(uuid.uuid4()),
                'start_at': (datetime.utcnow() + timedelta(days=1)).isoformat(),
                'end_at': (datetime.utcnow() + timedelta(days=1, hours=1)).isoformat(),
                'service_snapshot': {'price_cents': 5000}
            }
            
            booking = booking_service.create_booking(
                tenant_id=sample_tenant.id,
                booking_data=booking_data,
                user_id=uuid.uuid4()
            )
            
            # Check customer metrics were created/updated
            metrics = CustomerMetrics.query.filter_by(
                tenant_id=sample_tenant.id,
                customer_id=sample_customer.id
            ).first()
            
            assert metrics is not None
            assert metrics.bookings_count == 1
            assert metrics.first_booking_at is not None
            assert metrics.last_booking_at is not None


class TestIntegrationScenarios:
    """Test complete integration scenarios."""
    
    @patch('app.services.financial.stripe')
    def test_complete_payment_flow(self, mock_stripe, app, sample_tenant, sample_customer):
        """Test complete payment flow from booking to confirmation."""
        with app.app_context():
            # Setup Stripe Connect
            billing = TenantBilling(
                tenant_id=sample_tenant.id,
                stripe_account_id='acct_test_123',
                stripe_connect_enabled=True
            )
            db.session.add(billing)
            db.session.commit()
            
            # Create booking
            booking_service = BookingService()
            booking_data = {
                'customer_id': str(sample_customer.id),
                'service_id': str(uuid.uuid4()),
                'resource_id': str(uuid.uuid4()),
                'start_at': (datetime.utcnow() + timedelta(days=1)).isoformat(),
                'end_at': (datetime.utcnow() + timedelta(days=1, hours=1)).isoformat(),
                'service_snapshot': {'price_cents': 5000}
            }
            
            booking = booking_service.create_booking(
                tenant_id=sample_tenant.id,
                booking_data=booking_data,
                user_id=uuid.uuid4()
            )
            
            # Create payment intent
            mock_intent = Mock()
            mock_intent.id = 'pi_test_123'
            mock_stripe.PaymentIntent.create.return_value = mock_intent
            
            payment_service = PaymentService()
            payment = payment_service.create_payment_intent(
                tenant_id=str(sample_tenant.id),
                booking_id=str(booking.id),
                amount_cents=5000
            )
            
            # Simulate payment success webhook
            event_data = {
                'id': 'pi_test_123',
                'status': 'succeeded',
                'latest_charge': 'ch_test_123'
            }
            
            from app.jobs.webhook_inbox_worker import _handle_payment_succeeded
            _handle_payment_succeeded(event_data)
            
            # Verify final state
            updated_booking = Booking.query.get(booking.id)
            assert updated_booking.status == 'confirmed'
            
            updated_payment = Payment.query.filter_by(booking_id=booking.id).first()
            assert updated_payment.status == 'succeeded'
            
            # Verify customer metrics
            metrics = CustomerMetrics.query.filter_by(
                tenant_id=sample_tenant.id,
                customer_id=sample_customer.id
            ).first()
            assert metrics.bookings_count == 1
            assert metrics.revenue_cents == 5000


# Fixtures for test data
@pytest.fixture
def sample_tenant():
    """Create a sample tenant for testing."""
    from app.models.core import Tenant
    tenant = Tenant(
        id=uuid.uuid4(),
        name='Test Tenant',
        slug='test-tenant',
        email='test@tenant.com'
    )
    return tenant

@pytest.fixture
def sample_customer(sample_tenant):
    """Create a sample customer for testing."""
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        email='customer@example.com',
        display_name='Test Customer'
    )
    return customer

@pytest.fixture
def sample_booking(sample_tenant, sample_customer):
    """Create a sample booking for testing."""
    booking = Booking(
        id=uuid.uuid4(),
        tenant_id=sample_tenant.id,
        customer_id=sample_customer.id,
        resource_id=uuid.uuid4(),
        client_generated_id='test_booking_123',
        service_snapshot={'price_cents': 5000},
        start_at=datetime.utcnow() + timedelta(days=1),
        end_at=datetime.utcnow() + timedelta(days=1, hours=1),
        booking_tz='UTC',
        status='pending'
    )
    return booking
