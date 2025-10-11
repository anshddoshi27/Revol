"""
Payment Integration Tests

This module contains comprehensive tests for the payment integration system.
Tests cover PaymentIntents, SetupIntents, refunds, no-show fees, and Stripe webhooks.
"""

import pytest
import uuid
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

from app import create_app
from app.extensions import db
from app.models.financial import Payment, PaymentMethod, Refund, TenantBilling
from app.models.business import Booking, Customer
from app.models.core import Tenant, User, Membership
from app.services.financial import PaymentService, BillingService
from app.middleware.error_handler import TithiError


@pytest.fixture
def app():
    """Create test application."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def tenant_data():
    """Create test tenant data."""
    tenant = Tenant(
        id=str(uuid.uuid4()),
        slug="test-salon",
        tz="America/New_York"
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def user_data():
    """Create test user data."""
    user = User(
        id=str(uuid.uuid4()),
        display_name="Test User",
        primary_email="test@example.com"
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def membership_data(tenant_data, user_data):
    """Create test membership data."""
    membership = Membership(
        id=str(uuid.uuid4()),
        tenant_id=tenant_data.id,
        user_id=user_data.id,
        role="owner"
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def customer_data(tenant_data):
    """Create test customer data."""
    customer = Customer(
        id=str(uuid.uuid4()),
        tenant_id=tenant_data.id,
        display_name="Test Customer",
        email="customer@example.com",
        phone="+1234567890"
    )
    db.session.add(customer)
    db.session.commit()
    return customer


@pytest.fixture
def booking_data(tenant_data, customer_data):
    """Create test booking data."""
    booking = Booking(
        id=str(uuid.uuid4()),
        tenant_id=tenant_data.id,
        customer_id=customer_data.id,
        resource_id=str(uuid.uuid4()),
        client_generated_id="test-booking-123",
        service_snapshot={"name": "Haircut", "price_cents": 5000},
        start_at=datetime.now() + timedelta(days=1),
        end_at=datetime.now() + timedelta(days=1, hours=1),
        booking_tz="America/New_York",
        status="pending"
    )
    db.session.add(booking)
    db.session.commit()
    return booking


@pytest.fixture
def payment_service():
    """Create payment service instance."""
    return PaymentService()


@pytest.fixture
def billing_service():
    """Create billing service instance."""
    return BillingService()


class TestPaymentService:
    """Test cases for PaymentService."""
    
    def test_create_payment_intent_success(self, payment_service, tenant_data, booking_data):
        """Test successful payment intent creation."""
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.id = "pi_test_123"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_intent
            
            # Create payment intent
            payment = payment_service.create_payment_intent(
                tenant_id=str(tenant_data.id),
                booking_id=str(booking_data.id),
                amount_cents=5000,
                currency="USD"
            )
            
            # Assertions
            assert payment is not None
            assert payment.tenant_id == tenant_data.id
            assert payment.booking_id == booking_data.id
            assert payment.amount_cents == 5000
            assert payment.currency_code == "USD"
            assert payment.status == "requires_action"
            assert payment.provider == "stripe"
            assert payment.provider_payment_id == "pi_test_123"
            
            # Verify Stripe was called correctly
            mock_create.assert_called_once()
            call_args = mock_create.call_args
            assert call_args[1]['amount'] == 5000
            assert call_args[1]['currency'] == "USD"
            assert call_args[1]['metadata']['tenant_id'] == str(tenant_data.id)
    
    def test_create_payment_intent_idempotency(self, payment_service, tenant_data, booking_data):
        """Test payment intent creation idempotency."""
        idempotency_key = "test-key-123"
        
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.id = "pi_test_123"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_intent
            
            # Create first payment intent
            payment1 = payment_service.create_payment_intent(
                tenant_id=str(tenant_data.id),
                booking_id=str(booking_data.id),
                amount_cents=5000,
                idempotency_key=idempotency_key
            )
            
            # Create second payment intent with same key
            payment2 = payment_service.create_payment_intent(
                tenant_id=str(tenant_data.id),
                booking_id=str(booking_data.id),
                amount_cents=5000,
                idempotency_key=idempotency_key
            )
            
            # Should return the same payment
            assert payment1.id == payment2.id
            assert payment1.idempotency_key == payment2.idempotency_key
    
    def test_create_payment_intent_stripe_error(self, payment_service, tenant_data, booking_data):
        """Test payment intent creation with Stripe error."""
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock Stripe error
            import stripe
            mock_create.side_effect = stripe.error.CardError(
                message="Your card was declined.",
                param="number",
                code="card_declined"
            )
            
            # Should raise TithiError
            with pytest.raises(TithiError) as exc_info:
                payment_service.create_payment_intent(
                    tenant_id=str(tenant_data.id),
                    booking_id=str(booking_data.id),
                    amount_cents=5000
                )
            
            assert "Payment creation failed" in str(exc_info.value)
            assert exc_info.value.error_code == "TITHI_PAYMENT_STRIPE_ERROR"
    
    def test_confirm_payment_intent_success(self, payment_service, tenant_data, booking_data):
        """Test successful payment intent confirmation."""
        # Create payment record first
        payment = Payment(
            tenant_id=tenant_data.id,
            booking_id=booking_data.id,
            amount_cents=5000,
            currency_code="USD",
            status="requires_action",
            provider="stripe",
            provider_payment_id="pi_test_123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with patch('stripe.PaymentIntent.retrieve') as mock_retrieve:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.status = "succeeded"
            mock_intent.latest_charge = "ch_test_123"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_retrieve.return_value = mock_intent
            
            # Confirm payment intent
            confirmed_payment = payment_service.confirm_payment_intent(
                payment_id=str(payment.id),
                tenant_id=str(tenant_data.id)
            )
            
            # Assertions
            assert confirmed_payment.status == "captured"
            assert confirmed_payment.provider_charge_id == "ch_test_123"
    
    def test_confirm_payment_intent_not_found(self, payment_service, tenant_data):
        """Test payment intent confirmation with non-existent payment."""
        with pytest.raises(TithiError) as exc_info:
            payment_service.confirm_payment_intent(
                payment_id=str(uuid.uuid4()),
                tenant_id=str(tenant_data.id)
            )
        
        assert "Payment not found" in str(exc_info.value)
        assert exc_info.value.error_code == "TITHI_PAYMENT_NOT_FOUND"
    
    def test_create_setup_intent_success(self, payment_service, tenant_data, customer_data):
        """Test successful setup intent creation."""
        with patch('stripe.SetupIntent.create') as mock_create:
            # Mock Stripe response
            mock_setup_intent = MagicMock()
            mock_setup_intent.id = "seti_test_123"
            mock_setup_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_setup_intent
            
            # Create setup intent
            payment = payment_service.create_setup_intent(
                tenant_id=str(tenant_data.id),
                customer_id=str(customer_data.id)
            )
            
            # Assertions
            assert payment is not None
            assert payment.tenant_id == tenant_data.id
            assert payment.customer_id == customer_data.id
            assert payment.amount_cents == 0  # Setup intents have no amount
            assert payment.fee_type == "setup"
            assert payment.provider_setup_intent_id == "seti_test_123"
    
    def test_capture_no_show_fee_success(self, payment_service, tenant_data, booking_data, customer_data):
        """Test successful no-show fee capture."""
        # Create payment method
        payment_method = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_123",
            type="card",
            last4="4242",
            exp_month=12,
            exp_year=2025,
            brand="visa",
            is_default=True
        )
        db.session.add(payment_method)
        db.session.commit()
        
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.status = "succeeded"
            mock_intent.id = "pi_no_show_123"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_intent
            
            # Capture no-show fee
            payment = payment_service.capture_no_show_fee(
                booking_id=str(booking_data.id),
                tenant_id=str(tenant_data.id),
                no_show_fee_cents=150  # 3% of $50
            )
            
            # Assertions
            assert payment is not None
            assert payment.tenant_id == tenant_data.id
            assert payment.booking_id == booking_data.id
            assert payment.amount_cents == 150
            assert payment.no_show_fee_cents == 150
            assert payment.fee_type == "no_show"
            assert payment.status == "captured"
    
    def test_capture_no_show_fee_no_payment_method(self, payment_service, tenant_data, booking_data):
        """Test no-show fee capture with no payment method."""
        with pytest.raises(TithiError) as exc_info:
            payment_service.capture_no_show_fee(
                booking_id=str(booking_data.id),
                tenant_id=str(tenant_data.id),
                no_show_fee_cents=150
            )
        
        assert "No payment method found" in str(exc_info.value)
        assert exc_info.value.error_code == "TITHI_PAYMENT_NO_METHOD"
    
    def test_process_refund_success(self, payment_service, tenant_data, booking_data):
        """Test successful refund processing."""
        # Create payment record first
        payment = Payment(
            tenant_id=tenant_data.id,
            booking_id=booking_data.id,
            amount_cents=5000,
            currency_code="USD",
            status="captured",
            provider="stripe",
            provider_payment_id="pi_test_123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with patch('stripe.Refund.create') as mock_create:
            # Mock Stripe response
            mock_refund = MagicMock()
            mock_refund.id = "re_test_123"
            mock_refund.status = "succeeded"
            mock_refund.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_refund
            
            # Process refund
            refund = payment_service.process_refund(
                payment_id=str(payment.id),
                tenant_id=str(tenant_data.id),
                amount_cents=2500,  # Partial refund
                reason="Customer requested",
                refund_type="partial"
            )
            
            # Assertions
            assert refund is not None
            assert refund.tenant_id == tenant_data.id
            assert refund.payment_id == payment.id
            assert refund.amount_cents == 2500
            assert refund.reason == "Customer requested"
            assert refund.refund_type == "partial"
            assert refund.status == "succeeded"
            assert refund.provider_refund_id == "re_test_123"
    
    def test_process_refund_amount_exceeded(self, payment_service, tenant_data, booking_data):
        """Test refund processing with amount exceeding payment."""
        # Create payment record first
        payment = Payment(
            tenant_id=tenant_data.id,
            booking_id=booking_data.id,
            amount_cents=5000,
            currency_code="USD",
            status="captured",
            provider="stripe",
            provider_payment_id="pi_test_123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with pytest.raises(TithiError) as exc_info:
            payment_service.process_refund(
                payment_id=str(payment.id),
                tenant_id=str(tenant_data.id),
                amount_cents=6000,  # More than payment amount
                reason="Customer requested"
            )
        
        assert "Refund amount exceeds payment amount" in str(exc_info.value)
        assert exc_info.value.error_code == "TITHI_REFUND_AMOUNT_EXCEEDED"
    
    def test_get_payment_methods(self, payment_service, tenant_data, customer_data):
        """Test getting payment methods for a customer."""
        # Create payment methods
        pm1 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_1",
            type="card",
            last4="4242",
            is_default=True
        )
        pm2 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_2",
            type="card",
            last4="5555",
            is_default=False
        )
        db.session.add_all([pm1, pm2])
        db.session.commit()
        
        # Get payment methods
        payment_methods = payment_service.get_payment_methods(
            tenant_id=str(tenant_data.id),
            customer_id=str(customer_data.id)
        )
        
        # Assertions
        assert len(payment_methods) == 2
        assert any(pm.is_default for pm in payment_methods)
        assert any(not pm.is_default for pm in payment_methods)
    
    def test_set_default_payment_method(self, payment_service, tenant_data, customer_data):
        """Test setting default payment method."""
        # Create payment methods
        pm1 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_1",
            type="card",
            last4="4242",
            is_default=True
        )
        pm2 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_2",
            type="card",
            last4="5555",
            is_default=False
        )
        db.session.add_all([pm1, pm2])
        db.session.commit()
        
        # Set pm2 as default
        updated_pm = payment_service.set_default_payment_method(
            tenant_id=str(tenant_data.id),
            payment_method_id=str(pm2.id)
        )
        
        # Assertions
        assert updated_pm.is_default == True
        assert updated_pm.id == pm2.id
        
        # Check that pm1 is no longer default
        db.session.refresh(pm1)
        assert pm1.is_default == False


class TestBillingService:
    """Test cases for BillingService."""
    
    def test_setup_stripe_connect_new(self, billing_service, tenant_data):
        """Test setting up Stripe Connect for new tenant."""
        stripe_account_id = "acct_test_123"
        
        billing = billing_service.setup_stripe_connect(
            tenant_id=str(tenant_data.id),
            stripe_account_id=stripe_account_id
        )
        
        # Assertions
        assert billing is not None
        assert billing.tenant_id == tenant_data.id
        assert billing.stripe_account_id == stripe_account_id
        assert billing.stripe_connect_enabled == True
    
    def test_setup_stripe_connect_existing(self, billing_service, tenant_data):
        """Test updating existing Stripe Connect configuration."""
        # Create existing billing record
        existing_billing = TenantBilling(
            tenant_id=tenant_data.id,
            stripe_account_id="acct_old_123",
            stripe_connect_enabled=False
        )
        db.session.add(existing_billing)
        db.session.commit()
        
        # Update with new account
        new_stripe_account_id = "acct_new_123"
        billing = billing_service.setup_stripe_connect(
            tenant_id=str(tenant_data.id),
            stripe_account_id=new_stripe_account_id
        )
        
        # Assertions
        assert billing.tenant_id == tenant_data.id
        assert billing.stripe_account_id == new_stripe_account_id
        assert billing.stripe_connect_enabled == True
        assert billing.id == existing_billing.id  # Same record updated
    
    def test_get_tenant_billing(self, billing_service, tenant_data):
        """Test getting tenant billing configuration."""
        # Create billing record
        billing = TenantBilling(
            tenant_id=tenant_data.id,
            stripe_account_id="acct_test_123",
            stripe_connect_enabled=True
        )
        db.session.add(billing)
        db.session.commit()
        
        # Get billing
        retrieved_billing = billing_service.get_tenant_billing(
            tenant_id=str(tenant_data.id)
        )
        
        # Assertions
        assert retrieved_billing is not None
        assert retrieved_billing.tenant_id == tenant_data.id
        assert retrieved_billing.stripe_account_id == "acct_test_123"
        assert retrieved_billing.stripe_connect_enabled == True


class TestPaymentAPI:
    """Test cases for Payment API endpoints."""
    
    def test_create_payment_intent_endpoint(self, client, tenant_data, booking_data):
        """Test payment intent creation endpoint."""
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.id = "pi_test_123"
            mock_intent.client_secret = "pi_test_123_secret"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_intent
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
                with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                    mock_tenant.return_value = str(tenant_data.id)
                    mock_user.return_value = str(uuid.uuid4())
                    
                    # Make request
                    response = client.post('/api/payments/intent', json={
                        'booking_id': str(booking_data.id),
                        'amount_cents': 5000,
                        'currency': 'USD'
                    })
                    
                    # Assertions
                    assert response.status_code == 201
                    data = response.get_json()
                    assert data['booking_id'] == str(booking_data.id)
                    assert data['amount_cents'] == 5000
                    assert data['currency_code'] == 'USD'
                    assert data['status'] == 'requires_action'
                    assert 'client_secret' in data
    
    def test_create_payment_intent_validation_error(self, client, tenant_data):
        """Test payment intent creation with validation error."""
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
            with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                mock_tenant.return_value = str(tenant_data.id)
                mock_user.return_value = str(uuid.uuid4())
                
                # Make request with invalid data
                response = client.post('/api/payments/intent', json={
                    'booking_id': str(uuid.uuid4()),
                    'amount_cents': -100,  # Invalid amount
                    'currency': 'USD'
                })
                
                # Should return validation error
                assert response.status_code == 400
    
    def test_confirm_payment_intent_endpoint(self, client, tenant_data, booking_data):
        """Test payment intent confirmation endpoint."""
        # Create payment record first
        payment = Payment(
            tenant_id=tenant_data.id,
            booking_id=booking_data.id,
            amount_cents=5000,
            currency_code="USD",
            status="requires_action",
            provider="stripe",
            provider_payment_id="pi_test_123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with patch('stripe.PaymentIntent.retrieve') as mock_retrieve:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.status = "succeeded"
            mock_intent.latest_charge = "ch_test_123"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_retrieve.return_value = mock_intent
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
                with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                    mock_tenant.return_value = str(tenant_data.id)
                    mock_user.return_value = str(uuid.uuid4())
                    
                    # Make request
                    response = client.post(f'/api/payments/intent/{payment.id}/confirm')
                    
                    # Assertions
                    assert response.status_code == 200
                    data = response.get_json()
                    assert data['status'] == 'captured'
    
    def test_create_setup_intent_endpoint(self, client, tenant_data, customer_data):
        """Test setup intent creation endpoint."""
        with patch('stripe.SetupIntent.create') as mock_create:
            # Mock Stripe response
            mock_setup_intent = MagicMock()
            mock_setup_intent.id = "seti_test_123"
            mock_setup_intent.client_secret = "seti_test_123_secret"
            mock_setup_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_setup_intent
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
                with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                    mock_tenant.return_value = str(tenant_data.id)
                    mock_user.return_value = str(uuid.uuid4())
                    
                    # Make request
                    response = client.post('/api/payments/setup-intent', json={
                        'customer_id': str(customer_data.id)
                    })
                    
                    # Assertions
                    assert response.status_code == 201
                    data = response.get_json()
                    assert data['customer_id'] == str(customer_data.id)
                    assert data['status'] == 'requires_action'
                    assert 'client_secret' in data
    
    def test_process_refund_endpoint(self, client, tenant_data, booking_data):
        """Test refund processing endpoint."""
        # Create payment record first
        payment = Payment(
            tenant_id=tenant_data.id,
            booking_id=booking_data.id,
            amount_cents=5000,
            currency_code="USD",
            status="captured",
            provider="stripe",
            provider_payment_id="pi_test_123"
        )
        db.session.add(payment)
        db.session.commit()
        
        with patch('stripe.Refund.create') as mock_create:
            # Mock Stripe response
            mock_refund = MagicMock()
            mock_refund.id = "re_test_123"
            mock_refund.status = "succeeded"
            mock_refund.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_refund
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
                with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                    mock_tenant.return_value = str(tenant_data.id)
                    mock_user.return_value = str(uuid.uuid4())
                    
                    # Make request
                    response = client.post('/api/payments/refund', json={
                        'payment_id': str(payment.id),
                        'amount_cents': 2500,
                        'reason': 'Customer requested',
                        'refund_type': 'partial'
                    })
                    
                    # Assertions
                    assert response.status_code == 201
                    data = response.get_json()
                    assert data['payment_id'] == str(payment.id)
                    assert data['amount_cents'] == 2500
                    assert data['reason'] == 'Customer requested'
                    assert data['refund_type'] == 'partial'
                    assert data['status'] == 'succeeded'
    
    def test_capture_no_show_fee_endpoint(self, client, tenant_data, booking_data, customer_data):
        """Test no-show fee capture endpoint."""
        # Create payment method
        payment_method = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_123",
            type="card",
            last4="4242",
            is_default=True
        )
        db.session.add(payment_method)
        db.session.commit()
        
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock Stripe response
            mock_intent = MagicMock()
            mock_intent.status = "succeeded"
            mock_intent.id = "pi_no_show_123"
            mock_intent.metadata = {"tenant_id": str(tenant_data.id)}
            mock_create.return_value = mock_intent
            
            # Mock authentication
            with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
                with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                    mock_tenant.return_value = str(tenant_data.id)
                    mock_user.return_value = str(uuid.uuid4())
                    
                    # Make request
                    response = client.post('/api/payments/no-show-fee', json={
                        'booking_id': str(booking_data.id),
                        'no_show_fee_cents': 150
                    })
                    
                    # Assertions
                    assert response.status_code == 201
                    data = response.get_json()
                    assert data['booking_id'] == str(booking_data.id)
                    assert data['amount_cents'] == 150
                    assert data['no_show_fee_cents'] == 150
                    assert data['status'] == 'captured'
    
    def test_get_payment_methods_endpoint(self, client, tenant_data, customer_data):
        """Test getting payment methods endpoint."""
        # Create payment methods
        pm1 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_1",
            type="card",
            last4="4242",
            is_default=True
        )
        pm2 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_2",
            type="card",
            last4="5555",
            is_default=False
        )
        db.session.add_all([pm1, pm2])
        db.session.commit()
        
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
            with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                mock_tenant.return_value = str(tenant_data.id)
                mock_user.return_value = str(uuid.uuid4())
                
                # Make request
                response = client.get(f'/api/payments/methods/{customer_data.id}')
                
                # Assertions
                assert response.status_code == 200
                data = response.get_json()
                assert len(data) == 2
                assert any(pm['is_default'] for pm in data)
                assert any(not pm['is_default'] for pm in data)
    
    def test_set_default_payment_method_endpoint(self, client, tenant_data, customer_data):
        """Test setting default payment method endpoint."""
        # Create payment methods
        pm1 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_1",
            type="card",
            last4="4242",
            is_default=True
        )
        pm2 = PaymentMethod(
            tenant_id=tenant_data.id,
            customer_id=customer_data.id,
            stripe_payment_method_id="pm_test_2",
            type="card",
            last4="5555",
            is_default=False
        )
        db.session.add_all([pm1, pm2])
        db.session.commit()
        
        # Mock authentication
        with patch('app.middleware.auth_middleware.get_current_tenant_id') as mock_tenant:
            with patch('app.middleware.auth_middleware.get_current_user_id') as mock_user:
                mock_tenant.return_value = str(tenant_data.id)
                mock_user.return_value = str(uuid.uuid4())
                
                # Make request
                response = client.post(f'/api/payments/methods/{pm2.id}/default')
                
                # Assertions
                assert response.status_code == 200
                data = response.get_json()
                assert data['id'] == str(pm2.id)
                assert data['is_default'] == True
    
    def test_stripe_webhook_endpoint(self, client):
        """Test Stripe webhook endpoint."""
        with patch('stripe.Webhook.construct_event') as mock_construct:
            # Mock webhook event
            mock_event = {
                'type': 'payment_intent.succeeded',
                'data': {
                    'object': {
                        'id': 'pi_test_123',
                        'amount': 5000
                    }
                }
            }
            mock_construct.return_value = mock_event
            
            # Mock webhook secret
            with patch('app.config.Config.STRIPE_WEBHOOK_SECRET', 'whsec_test_123'):
                # Make request
                response = client.post('/api/payments/webhook', 
                                     headers={'Stripe-Signature': 'test_signature'},
                                     data='{"test": "data"}')
                
                # Assertions
                assert response.status_code == 200
                data = response.get_json()
                assert data['status'] == 'success'


if __name__ == '__main__':
    pytest.main([__file__])
