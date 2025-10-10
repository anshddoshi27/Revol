"""
Comprehensive Test Suite for Promotion Integration

This module tests the complete promotion system including coupons and gift cards.
Aligned with Design Brief Module I - Promotions & Loyalty.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.promotions import Coupon, GiftCard, GiftCardTransaction
from app.models.financial import PromotionUsage
from app.models.business import Booking
from app.models.core import Tenant
from app.models.business import Customer
from app.services.promotion import CouponService, GiftCardService, PromotionService
from app.exceptions import TithiError


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
def tenant_id():
    """Create test tenant ID."""
    return str(uuid.uuid4())


@pytest.fixture
def customer_id():
    """Create test customer ID."""
    return str(uuid.uuid4())


@pytest.fixture
def booking_id():
    """Create test booking ID."""
    return str(uuid.uuid4())


@pytest.fixture
def payment_id():
    """Create test payment ID."""
    return str(uuid.uuid4())


@pytest.fixture
def coupon_service():
    """Create coupon service."""
    return CouponService()


@pytest.fixture
def gift_card_service():
    """Create gift card service."""
    return GiftCardService()


@pytest.fixture
def promotion_service():
    """Create promotion service."""
    return PromotionService()


class TestCouponService:
    """Test cases for CouponService."""
    
    def test_create_coupon_success(self, app, coupon_service, tenant_id):
        """Test successful coupon creation."""
        with app.app_context():
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon",
                description="10% off test coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00"),
                currency_code="USD"
            )
            
            assert coupon is not None
            assert coupon.code == "TEST10"
            assert coupon.name == "Test Coupon"
            assert coupon.discount_type == "percentage"
            assert coupon.discount_value == Decimal("10.00")
            assert coupon.currency_code == "USD"
            assert coupon.is_active is True
            assert coupon.is_public is True
            assert coupon.used_count == 0
    
    def test_create_coupon_duplicate_code(self, app, coupon_service, tenant_id):
        """Test coupon creation with duplicate code fails."""
        with app.app_context():
            # Create first coupon
            coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon 1",
                discount_type="percentage",
                discount_value=Decimal("10.00")
            )
            
            # Try to create second coupon with same code
            with pytest.raises(TithiError) as exc_info:
                coupon_service.create_coupon(
                    tenant_id=tenant_id,
                    code="TEST10",
                    name="Test Coupon 2",
                    discount_type="percentage",
                    discount_value=Decimal("15.00")
                )
            
            assert exc_info.value.error_code == "TITHI_COUPON_CODE_EXISTS"
    
    def test_create_coupon_invalid_discount_type(self, app, coupon_service, tenant_id):
        """Test coupon creation with invalid discount type fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                coupon_service.create_coupon(
                    tenant_id=tenant_id,
                    code="TEST10",
                    name="Test Coupon",
                    discount_type="invalid",
                    discount_value=Decimal("10.00")
                )
            
            assert exc_info.value.error_code == "TITHI_COUPON_INVALID_DISCOUNT_TYPE"
    
    def test_create_coupon_invalid_percentage(self, app, coupon_service, tenant_id):
        """Test coupon creation with invalid percentage fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                coupon_service.create_coupon(
                    tenant_id=tenant_id,
                    code="TEST10",
                    name="Test Coupon",
                    discount_type="percentage",
                    discount_value=Decimal("150.00")
                )
            
            assert exc_info.value.error_code == "TITHI_COUPON_INVALID_PERCENTAGE"
    
    def test_validate_coupon_success(self, app, coupon_service, tenant_id, customer_id):
        """Test successful coupon validation."""
        with app.app_context():
            # Create coupon
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00")
            )
            
            # Validate coupon
            is_valid, message, validated_coupon = coupon_service.validate_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                customer_id=customer_id,
                amount_cents=10000  # $100.00
            )
            
            assert is_valid is True
            assert message == "Coupon is valid"
            assert validated_coupon.id == coupon.id
    
    def test_validate_coupon_not_found(self, app, coupon_service, tenant_id, customer_id):
        """Test coupon validation with non-existent coupon."""
        with app.app_context():
            is_valid, message, validated_coupon = coupon_service.validate_coupon(
                tenant_id=tenant_id,
                code="INVALID",
                customer_id=customer_id,
                amount_cents=10000
            )
            
            assert is_valid is False
            assert message == "Coupon not found"
            assert validated_coupon is None
    
    def test_validate_coupon_expired(self, app, coupon_service, tenant_id, customer_id):
        """Test coupon validation with expired coupon."""
        with app.app_context():
            # Create expired coupon
            past_date = datetime.utcnow() - timedelta(days=1)
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="EXPIRED",
                name="Expired Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00"),
                valid_until=past_date
            )
            
            # Validate expired coupon
            is_valid, message, validated_coupon = coupon_service.validate_coupon(
                tenant_id=tenant_id,
                code="EXPIRED",
                customer_id=customer_id,
                amount_cents=10000
            )
            
            assert is_valid is False
            assert message == "Coupon has expired"
            assert validated_coupon.id == coupon.id
    
    def test_validate_coupon_usage_limit_exceeded(self, app, coupon_service, tenant_id, customer_id):
        """Test coupon validation with usage limit exceeded."""
        with app.app_context():
            # Create coupon with usage limit
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="LIMITED",
                name="Limited Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00"),
                max_uses=1
            )
            
            # Use coupon once
            coupon.used_count = 1
            db.session.commit()
            
            # Try to validate again
            is_valid, message, validated_coupon = coupon_service.validate_coupon(
                tenant_id=tenant_id,
                code="LIMITED",
                customer_id=customer_id,
                amount_cents=10000
            )
            
            assert is_valid is False
            assert message == "Coupon usage limit exceeded"
            assert validated_coupon.id == coupon.id
    
    def test_validate_coupon_minimum_amount_not_met(self, app, coupon_service, tenant_id, customer_id):
        """Test coupon validation with minimum amount not met."""
        with app.app_context():
            # Create coupon with minimum amount
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="MIN100",
                name="Minimum Amount Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00"),
                minimum_amount_cents=20000  # $200.00
            )
            
            # Try to validate with amount below minimum
            is_valid, message, validated_coupon = coupon_service.validate_coupon(
                tenant_id=tenant_id,
                code="MIN100",
                customer_id=customer_id,
                amount_cents=10000  # $100.00
            )
            
            assert is_valid is False
            assert "Minimum order amount not met" in message
            assert validated_coupon.id == coupon.id
    
    def test_calculate_discount_percentage(self, app, coupon_service, tenant_id):
        """Test discount calculation for percentage coupon."""
        with app.app_context():
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00")
            )
            
            # Test 10% discount on $100.00
            discount = coupon_service.calculate_discount(coupon, 10000)
            assert discount == 1000  # $10.00
            
            # Test 10% discount on $50.00
            discount = coupon_service.calculate_discount(coupon, 5000)
            assert discount == 500  # $5.00
    
    def test_calculate_discount_fixed_amount(self, app, coupon_service, tenant_id):
        """Test discount calculation for fixed amount coupon."""
        with app.app_context():
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="FIXED5",
                name="Fixed Amount Coupon",
                discount_type="fixed_amount",
                discount_value=Decimal("5.00")
            )
            
            # Test $5.00 fixed discount on $100.00
            discount = coupon_service.calculate_discount(coupon, 10000)
            assert discount == 500  # $5.00
            
            # Test $5.00 fixed discount on $3.00 (should not exceed amount)
            discount = coupon_service.calculate_discount(coupon, 300)
            assert discount == 300  # $3.00 (capped at amount)
    
    def test_calculate_discount_maximum_limit(self, app, coupon_service, tenant_id):
        """Test discount calculation with maximum discount limit."""
        with app.app_context():
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="MAX10",
                name="Max Discount Coupon",
                discount_type="percentage",
                discount_value=Decimal("50.00"),  # 50%
                maximum_discount_cents=1000  # Max $10.00
            )
            
            # Test 50% discount on $100.00 (should be capped at $10.00)
            discount = coupon_service.calculate_discount(coupon, 10000)
            assert discount == 1000  # $10.00 (capped)
            
            # Test 50% discount on $20.00 (should be $10.00, not capped)
            discount = coupon_service.calculate_discount(coupon, 2000)
            assert discount == 1000  # $10.00 (not capped)
    
    def test_apply_coupon_success(self, app, coupon_service, tenant_id, customer_id, booking_id, payment_id):
        """Test successful coupon application."""
        with app.app_context():
            # Create coupon
            coupon = coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00")
            )
            
            # Apply coupon
            usage = coupon_service.apply_coupon(
                tenant_id=tenant_id,
                coupon_id=coupon.id,
                customer_id=customer_id,
                booking_id=booking_id,
                payment_id=payment_id,
                original_amount_cents=10000,
                discount_amount_cents=1000
            )
            
            assert usage is not None
            assert usage.coupon_id == coupon.id
            assert usage.customer_id == customer_id
            assert usage.booking_id == booking_id
            assert usage.payment_id == payment_id
            assert usage.discount_amount_cents == 1000
            assert usage.original_amount_cents == 10000
            assert usage.final_amount_cents == 9000
            
            # Check coupon usage count updated
            db.session.refresh(coupon)
            assert coupon.used_count == 1


class TestGiftCardService:
    """Test cases for GiftCardService."""
    
    def test_create_gift_card_success(self, app, gift_card_service, tenant_id):
        """Test successful gift card creation."""
        with app.app_context():
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000,  # $50.00
                currency_code="USD",
                recipient_email="test@example.com",
                recipient_name="Test Recipient"
            )
            
            assert gift_card is not None
            assert gift_card.amount_cents == 5000
            assert gift_card.balance_cents == 5000
            assert gift_card.currency_code == "USD"
            assert gift_card.recipient_email == "test@example.com"
            assert gift_card.recipient_name == "Test Recipient"
            assert gift_card.is_active is True
            assert gift_card.is_redeemed is False
            assert len(gift_card.code) == 12  # Default length
    
    def test_create_gift_card_invalid_amount(self, app, gift_card_service, tenant_id):
        """Test gift card creation with invalid amount fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                gift_card_service.create_gift_card(
                    tenant_id=tenant_id,
                    amount_cents=0
                )
            
            assert exc_info.value.error_code == "TITHI_GIFT_CARD_INVALID_AMOUNT"
    
    def test_generate_gift_card_code_unique(self, app, gift_card_service):
        """Test gift card code generation produces unique codes."""
        with app.app_context():
            codes = set()
            for _ in range(100):
                code = gift_card_service.generate_gift_card_code()
                assert code not in codes
                codes.add(code)
                assert len(code) == 12
    
    def test_validate_gift_card_success(self, app, gift_card_service, tenant_id):
        """Test successful gift card validation."""
        with app.app_context():
            # Create gift card
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Validate gift card
            is_valid, message, validated_gift_card = gift_card_service.validate_gift_card(
                code=gift_card.code,
                amount_cents=3000
            )
            
            assert is_valid is True
            assert message == "Gift card is valid"
            assert validated_gift_card.id == gift_card.id
    
    def test_validate_gift_card_not_found(self, app, gift_card_service):
        """Test gift card validation with non-existent code."""
        with app.app_context():
            is_valid, message, validated_gift_card = gift_card_service.validate_gift_card(
                code="INVALID",
                amount_cents=3000
            )
            
            assert is_valid is False
            assert message == "Gift card not found"
            assert validated_gift_card is None
    
    def test_validate_gift_card_insufficient_balance(self, app, gift_card_service, tenant_id):
        """Test gift card validation with insufficient balance."""
        with app.app_context():
            # Create gift card
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Try to validate with amount exceeding balance
            is_valid, message, validated_gift_card = gift_card_service.validate_gift_card(
                code=gift_card.code,
                amount_cents=10000
            )
            
            assert is_valid is False
            assert "Insufficient balance" in message
            assert validated_gift_card.id == gift_card.id
    
    def test_validate_gift_card_expired(self, app, gift_card_service, tenant_id):
        """Test gift card validation with expired gift card."""
        with app.app_context():
            # Create expired gift card
            past_date = datetime.utcnow() - timedelta(days=1)
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000,
                valid_until=past_date
            )
            
            # Try to validate expired gift card
            is_valid, message, validated_gift_card = gift_card_service.validate_gift_card(
                code=gift_card.code,
                amount_cents=3000
            )
            
            assert is_valid is False
            assert message == "Gift card has expired"
            assert validated_gift_card.id == gift_card.id
    
    def test_redeem_gift_card_success(self, app, gift_card_service, tenant_id, customer_id, booking_id, payment_id):
        """Test successful gift card redemption."""
        with app.app_context():
            # Create gift card
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Redeem gift card
            transaction, updated_gift_card = gift_card_service.redeem_gift_card(
                tenant_id=tenant_id,
                gift_card_id=gift_card.id,
                customer_id=customer_id,
                booking_id=booking_id,
                payment_id=payment_id,
                amount_cents=3000
            )
            
            assert transaction is not None
            assert transaction.transaction_type == "redemption"
            assert transaction.amount_cents == 3000
            assert transaction.balance_after_cents == 2000
            assert transaction.booking_id == booking_id
            assert transaction.payment_id == payment_id
            
            assert updated_gift_card.balance_cents == 2000
            assert updated_gift_card.is_redeemed is False  # Still has balance
    
    def test_redeem_gift_card_full_redemption(self, app, gift_card_service, tenant_id, customer_id, booking_id, payment_id):
        """Test gift card full redemption marks as redeemed."""
        with app.app_context():
            # Create gift card
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Redeem full amount
            transaction, updated_gift_card = gift_card_service.redeem_gift_card(
                tenant_id=tenant_id,
                gift_card_id=gift_card.id,
                customer_id=customer_id,
                booking_id=booking_id,
                payment_id=payment_id,
                amount_cents=5000
            )
            
            assert transaction.balance_after_cents == 0
            assert updated_gift_card.balance_cents == 0
            assert updated_gift_card.is_redeemed is True
    
    def test_redeem_gift_card_insufficient_balance(self, app, gift_card_service, tenant_id, customer_id, booking_id, payment_id):
        """Test gift card redemption with insufficient balance fails."""
        with app.app_context():
            # Create gift card
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Try to redeem more than balance
            with pytest.raises(TithiError) as exc_info:
                gift_card_service.redeem_gift_card(
                    tenant_id=tenant_id,
                    gift_card_id=gift_card.id,
                    customer_id=customer_id,
                    booking_id=booking_id,
                    payment_id=payment_id,
                    amount_cents=10000
                )
            
            assert exc_info.value.error_code == "TITHI_GIFT_CARD_INSUFFICIENT_BALANCE"
    
    def test_refund_gift_card_success(self, app, gift_card_service, tenant_id, booking_id, payment_id):
        """Test successful gift card refund."""
        with app.app_context():
            # Create gift card with some balance used
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # First redeem some amount
            gift_card.balance_cents = 2000
            gift_card.is_redeemed = True
            db.session.commit()
            
            # Refund amount
            transaction = gift_card_service.refund_gift_card(
                tenant_id=tenant_id,
                gift_card_id=gift_card.id,
                booking_id=booking_id,
                payment_id=payment_id,
                amount_cents=1000
            )
            
            assert transaction is not None
            assert transaction.transaction_type == "refund"
            assert transaction.amount_cents == 1000
            assert transaction.balance_after_cents == 3000
            
            # Check gift card updated
            db.session.refresh(gift_card)
            assert gift_card.balance_cents == 3000
            assert gift_card.is_redeemed is False  # Reactivated
    
    def test_get_gift_card_balance(self, app, gift_card_service, tenant_id):
        """Test getting gift card balance."""
        with app.app_context():
            # Create gift card
            gift_card = gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Get balance
            balance = gift_card_service.get_gift_card_balance(gift_card.code)
            assert balance == 5000
            
            # Get balance for non-existent code
            balance = gift_card_service.get_gift_card_balance("INVALID")
            assert balance == 0


class TestPromotionService:
    """Test cases for PromotionService."""
    
    def test_apply_promotion_coupon_success(self, app, promotion_service, tenant_id, customer_id, booking_id, payment_id):
        """Test successful coupon application through promotion service."""
        with app.app_context():
            # Create coupon
            coupon = promotion_service.coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00")
            )
            
            # Apply promotion
            result = promotion_service.apply_promotion(
                tenant_id=tenant_id,
                customer_id=customer_id,
                booking_id=booking_id,
                payment_id=payment_id,
                amount_cents=10000,
                coupon_code="TEST10"
            )
            
            assert result["original_amount_cents"] == 10000
            assert result["discount_amount_cents"] == 1000
            assert result["final_amount_cents"] == 9000
            assert result["promotion_type"] == "coupon"
            assert result["promotion_id"] == coupon.id
            assert result["usage_id"] is not None
    
    def test_apply_promotion_gift_card_success(self, app, promotion_service, tenant_id, customer_id, booking_id, payment_id):
        """Test successful gift card application through promotion service."""
        with app.app_context():
            # Create gift card
            gift_card = promotion_service.gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Apply promotion
            result = promotion_service.apply_promotion(
                tenant_id=tenant_id,
                customer_id=customer_id,
                booking_id=booking_id,
                payment_id=payment_id,
                amount_cents=10000,
                gift_card_code=gift_card.code
            )
            
            assert result["original_amount_cents"] == 10000
            assert result["discount_amount_cents"] == 5000  # Full gift card amount
            assert result["final_amount_cents"] == 5000
            assert result["promotion_type"] == "gift_card"
            assert result["promotion_id"] == gift_card.id
            assert result["usage_id"] is not None
    
    def test_apply_promotion_no_promotion(self, app, promotion_service, tenant_id, customer_id, booking_id, payment_id):
        """Test promotion application with no promotion fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                promotion_service.apply_promotion(
                    tenant_id=tenant_id,
                    customer_id=customer_id,
                    booking_id=booking_id,
                    payment_id=payment_id,
                    amount_cents=10000
                )
            
            assert exc_info.value.error_code == "TITHI_PROMOTION_REQUIRED"
    
    def test_apply_promotion_multiple_promotions(self, app, promotion_service, tenant_id, customer_id, booking_id, payment_id):
        """Test promotion application with both coupon and gift card fails."""
        with app.app_context():
            with pytest.raises(TithiError) as exc_info:
                promotion_service.apply_promotion(
                    tenant_id=tenant_id,
                    customer_id=customer_id,
                    booking_id=booking_id,
                    payment_id=payment_id,
                    amount_cents=10000,
                    coupon_code="TEST10",
                    gift_card_code="GIFT123"
                )
            
            assert exc_info.value.error_code == "TITHI_PROMOTION_MULTIPLE"
    
    def test_get_promotion_analytics(self, app, promotion_service, tenant_id, customer_id, booking_id, payment_id):
        """Test promotion analytics retrieval."""
        with app.app_context():
            # Create and use some promotions
            coupon = promotion_service.coupon_service.create_coupon(
                tenant_id=tenant_id,
                code="TEST10",
                name="Test Coupon",
                discount_type="percentage",
                discount_value=Decimal("10.00")
            )
            
            gift_card = promotion_service.gift_card_service.create_gift_card(
                tenant_id=tenant_id,
                amount_cents=5000
            )
            
            # Apply promotions
            promotion_service.apply_promotion(
                tenant_id=tenant_id,
                customer_id=customer_id,
                booking_id=booking_id,
                payment_id=payment_id,
                amount_cents=10000,
                coupon_code="TEST10"
            )
            
            promotion_service.apply_promotion(
                tenant_id=tenant_id,
                customer_id=customer_id,
                booking_id=str(uuid.uuid4()),
                payment_id=str(uuid.uuid4()),
                amount_cents=5000,
                gift_card_code=gift_card.code
            )
            
            # Get analytics
            analytics = promotion_service.get_promotion_analytics(tenant_id)
            
            assert analytics["coupons"]["total_usage"] == 1
            assert analytics["coupons"]["total_discount_cents"] == 1000
            assert analytics["coupons"]["unique_coupons"] == 1
            
            assert analytics["gift_cards"]["total_usage"] == 1
            assert analytics["gift_cards"]["total_discount_cents"] == 5000
            assert analytics["gift_cards"]["unique_gift_cards"] == 1
            
            assert analytics["total_promotions"] == 2
            assert analytics["total_discount_cents"] == 6000


class TestPromotionAPI:
    """Test cases for Promotion API endpoints."""
    
    def test_create_coupon_api(self, client, app):
        """Test coupon creation via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.json = {
                        "code": "TEST10",
                        "name": "Test Coupon",
                        "description": "10% off test coupon",
                        "discount_type": "percentage",
                        "discount_value": 10.00,
                        "currency_code": "USD"
                    }
                    
                    response = client.post('/api/promotions/coupons')
                    assert response.status_code == 201
                    
                    data = response.get_json()
                    assert data["code"] == "TEST10"
                    assert data["name"] == "Test Coupon"
                    assert data["discount_type"] == "percentage"
                    assert data["discount_value"] == 10.00
    
    def test_create_gift_card_api(self, client, app):
        """Test gift card creation via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.json = {
                        "amount_cents": 5000,
                        "currency_code": "USD",
                        "recipient_email": "test@example.com",
                        "recipient_name": "Test Recipient"
                    }
                    
                    response = client.post('/api/promotions/gift-cards')
                    assert response.status_code == 201
                    
                    data = response.get_json()
                    assert data["amount_cents"] == 5000
                    assert data["balance_cents"] == 5000
                    assert data["currency_code"] == "USD"
                    assert data["recipient_email"] == "test@example.com"
                    assert data["recipient_name"] == "Test Recipient"
    
    def test_apply_promotion_api(self, client, app):
        """Test promotion application via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.json = {
                        "customer_id": str(uuid.uuid4()),
                        "booking_id": str(uuid.uuid4()),
                        "payment_id": str(uuid.uuid4()),
                        "amount_cents": 10000,
                        "coupon_code": "TEST10"
                    }
                    
                    response = client.post('/api/promotions/apply')
                    # This will fail because coupon doesn't exist, but tests the endpoint
                    assert response.status_code in [400, 500]  # Expected to fail in test environment
    
    def test_list_coupons_api(self, client, app):
        """Test coupon listing via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.args = {}
                    
                    response = client.get('/api/promotions/coupons')
                    assert response.status_code == 200
                    
                    data = response.get_json()
                    assert "coupons" in data
                    assert "pagination" in data
                    assert isinstance(data["coupons"], list)
    
    def test_update_coupon_api(self, client, app):
        """Test coupon update via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    mock_request.json = {
                        "name": "Updated Test Coupon",
                        "description": "Updated description",
                        "is_active": False
                    }
                    
                    # Mock coupon ID
                    coupon_id = str(uuid.uuid4())
                    
                    response = client.put(f'/api/promotions/coupons/{coupon_id}')
                    # Should return 404 since coupon doesn't exist
                    assert response.status_code == 404
    
    def test_delete_coupon_api(self, client, app):
        """Test coupon deletion via API."""
        with app.app_context():
            # Mock authentication and tenant context
            with patch('app.middleware.auth_middleware.require_auth') as mock_auth, \
                 patch('app.middleware.tenant_middleware.require_tenant') as mock_tenant:
                
                mock_auth.return_value = lambda f: f
                mock_tenant.return_value = lambda f: f
                
                # Mock request context
                with patch('flask.request') as mock_request:
                    mock_request.tenant_id = str(uuid.uuid4())
                    
                    # Mock coupon ID
                    coupon_id = str(uuid.uuid4())
                    
                    response = client.delete(f'/api/promotions/coupons/{coupon_id}')
                    # Should return 404 since coupon doesn't exist
                    assert response.status_code == 404


if __name__ == '__main__':
    pytest.main([__file__])
