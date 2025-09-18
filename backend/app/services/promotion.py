"""
Promotion Service

This module provides comprehensive promotion management including coupons and gift cards.
Aligned with TITHI_DATABASE_COMPREHENSIVE_REPORT.md schema and Design Brief Module I.
"""

import uuid
import secrets
import string
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session

from ..extensions import db
from ..models.financial import Coupon, GiftCard, GiftCardTransaction, PromotionUsage
from ..models.business import Booking
from ..models.core import Customer
from ..exceptions import TithiError


class CouponService:
    """Service for managing discount coupons and promotional codes."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
    
    def create_coupon(
        self,
        tenant_id: str,
        code: str,
        name: str,
        description: str,
        discount_type: str,
        discount_value: Decimal,
        currency_code: str = "USD",
        max_uses: Optional[int] = None,
        max_uses_per_customer: int = 1,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        minimum_amount_cents: Optional[int] = None,
        maximum_discount_cents: Optional[int] = None,
        applicable_services: List[str] = None,
        applicable_customers: List[str] = None,
        is_public: bool = True,
        metadata: Dict[str, Any] = None
    ) -> Coupon:
        """Create a new discount coupon."""
        
        # Validate discount type
        if discount_type not in ['percentage', 'fixed_amount']:
            raise TithiError("TITHI_COUPON_INVALID_DISCOUNT_TYPE", "Invalid discount type")
        
        # Validate discount value
        if discount_value <= 0:
            raise TithiError("TITHI_COUPON_INVALID_DISCOUNT_VALUE", "Discount value must be positive")
        
        # Validate percentage discount
        if discount_type == 'percentage' and discount_value > 100:
            raise TithiError("TITHI_COUPON_INVALID_PERCENTAGE", "Percentage discount cannot exceed 100%")
        
        # Check for duplicate code
        existing_coupon = self.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.code == code
            )
        ).first()
        
        if existing_coupon:
            raise TithiError("TITHI_COUPON_CODE_EXISTS", "Coupon code already exists")
        
        # Set default values
        if valid_from is None:
            valid_from = datetime.utcnow()
        
        # Create coupon
        coupon = Coupon(
            tenant_id=tenant_id,
            code=code,
            name=name,
            description=description,
            discount_type=discount_type,
            discount_value=discount_value,
            currency_code=currency_code,
            max_uses=max_uses,
            max_uses_per_customer=max_uses_per_customer,
            valid_from=valid_from,
            valid_until=valid_until,
            minimum_amount_cents=minimum_amount_cents,
            maximum_discount_cents=maximum_discount_cents,
            applicable_services=applicable_services or [],
            applicable_customers=applicable_customers or [],
            is_public=is_public,
            metadata=metadata or {}
        )
        
        self.db.add(coupon)
        self.db.commit()
        
        # Emit log
        print(f"COUPON_CREATED: tenant_id={tenant_id}, coupon_id={coupon.id}, code={code}")
        
        return coupon
    
    def get_coupon_by_code(self, tenant_id: str, code: str) -> Optional[Coupon]:
        """Get a coupon by its code."""
        return self.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.code == code
            )
        ).first()
    
    def validate_coupon(
        self,
        tenant_id: str,
        code: str,
        customer_id: str,
        amount_cents: int,
        service_ids: List[str] = None
    ) -> Tuple[bool, str, Optional[Coupon]]:
        """Validate a coupon for use."""
        
        coupon = self.get_coupon_by_code(tenant_id, code)
        
        if not coupon:
            return False, "Coupon not found", None
        
        if not coupon.is_active:
            return False, "Coupon is not active", coupon
        
        # Check validity period
        now = datetime.utcnow()
        if coupon.valid_from > now:
            return False, "Coupon is not yet valid", coupon
        
        if coupon.valid_until and coupon.valid_until < now:
            return False, "Coupon has expired", coupon
        
        # Check usage limits
        if coupon.max_uses and coupon.used_count >= coupon.max_uses:
            return False, "Coupon usage limit exceeded", coupon
        
        # Check customer usage limit
        customer_usage = self.db.query(PromotionUsage).filter(
            and_(
                PromotionUsage.tenant_id == tenant_id,
                PromotionUsage.coupon_id == coupon.id,
                PromotionUsage.customer_id == customer_id
            )
        ).count()
        
        if customer_usage >= coupon.max_uses_per_customer:
            return False, "Customer usage limit exceeded", coupon
        
        # Check minimum amount
        if coupon.minimum_amount_cents and amount_cents < coupon.minimum_amount_cents:
            return False, f"Minimum order amount not met (${coupon.minimum_amount_cents / 100:.2f})", coupon
        
        # Check applicable services
        if coupon.applicable_services and service_ids:
            if not any(service_id in coupon.applicable_services for service_id in service_ids):
                return False, "Coupon not applicable to selected services", coupon
        
        # Check applicable customers
        if coupon.applicable_customers and customer_id not in coupon.applicable_customers:
            return False, "Coupon not applicable to this customer", coupon
        
        return True, "Coupon is valid", coupon
    
    def calculate_discount(
        self,
        coupon: Coupon,
        amount_cents: int
    ) -> int:
        """Calculate discount amount for a coupon."""
        
        if coupon.discount_type == 'percentage':
            discount_cents = int(amount_cents * (coupon.discount_value / 100))
        else:  # fixed_amount
            discount_cents = int(coupon.discount_value * 100)  # Convert to cents
        
        # Apply maximum discount limit
        if coupon.maximum_discount_cents:
            discount_cents = min(discount_cents, coupon.maximum_discount_cents)
        
        # Ensure discount doesn't exceed amount
        discount_cents = min(discount_cents, amount_cents)
        
        return discount_cents
    
    def apply_coupon(
        self,
        tenant_id: str,
        coupon_id: str,
        customer_id: str,
        booking_id: str,
        payment_id: str,
        original_amount_cents: int,
        discount_amount_cents: int
    ) -> PromotionUsage:
        """Apply a coupon and record usage."""
        
        # Create usage record
        usage = PromotionUsage(
            tenant_id=tenant_id,
            coupon_id=coupon_id,
            customer_id=customer_id,
            booking_id=booking_id,
            payment_id=payment_id,
            discount_amount_cents=discount_amount_cents,
            original_amount_cents=original_amount_cents,
            final_amount_cents=original_amount_cents - discount_amount_cents
        )
        
        self.db.add(usage)
        
        # Update coupon usage count
        coupon = self.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.id == coupon_id
            )
        ).first()
        
        if coupon:
            coupon.used_count += 1
        
        self.db.commit()
        
        # Emit log
        print(f"COUPON_APPLIED: tenant_id={tenant_id}, coupon_id={coupon_id}, usage_id={usage.id}")
        
        return usage
    
    def get_coupon_usage_stats(self, tenant_id: str, coupon_id: str) -> Dict[str, Any]:
        """Get usage statistics for a coupon."""
        
        coupon = self.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.id == coupon_id
            )
        ).first()
        
        if not coupon:
            raise TithiError("TITHI_COUPON_NOT_FOUND", "Coupon not found")
        
        # Get usage details
        usage_query = self.db.query(PromotionUsage).filter(
            and_(
                PromotionUsage.tenant_id == tenant_id,
                PromotionUsage.coupon_id == coupon_id
            )
        )
        
        total_usage = usage_query.count()
        total_discount = usage_query.with_entities(
            func.sum(PromotionUsage.discount_amount_cents)
        ).scalar() or 0
        
        # Get unique customers
        unique_customers = usage_query.with_entities(
            PromotionUsage.customer_id
        ).distinct().count()
        
        return {
            "coupon_id": coupon_id,
            "code": coupon.code,
            "name": coupon.name,
            "total_usage": total_usage,
            "total_discount_cents": total_discount,
            "unique_customers": unique_customers,
            "max_uses": coupon.max_uses,
            "used_count": coupon.used_count,
            "remaining_uses": coupon.max_uses - coupon.used_count if coupon.max_uses else None
        }


class GiftCardService:
    """Service for managing digital gift cards."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
    
    def generate_gift_card_code(self, length: int = 12) -> str:
        """Generate a unique gift card code."""
        characters = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(characters) for _ in range(length))
    
    def create_gift_card(
        self,
        tenant_id: str,
        amount_cents: int,
        currency_code: str = "USD",
        recipient_email: str = None,
        recipient_name: str = None,
        sender_name: str = None,
        message: str = None,
        valid_until: Optional[datetime] = None,
        metadata: Dict[str, Any] = None
    ) -> GiftCard:
        """Create a new gift card."""
        
        if amount_cents <= 0:
            raise TithiError("TITHI_GIFT_CARD_INVALID_AMOUNT", "Gift card amount must be positive")
        
        # Generate unique code
        code = self.generate_gift_card_code()
        while self.db.query(GiftCard).filter(GiftCard.code == code).first():
            code = self.generate_gift_card_code()
        
        # Create gift card
        gift_card = GiftCard(
            tenant_id=tenant_id,
            code=code,
            amount_cents=amount_cents,
            currency_code=currency_code,
            balance_cents=amount_cents,
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            sender_name=sender_name,
            message=message,
            valid_until=valid_until,
            metadata=metadata or {}
        )
        
        self.db.add(gift_card)
        self.db.commit()
        
        # Emit log
        print(f"GIFT_CARD_CREATED: tenant_id={tenant_id}, gift_card_id={gift_card.id}, code={code}")
        
        return gift_card
    
    def get_gift_card_by_code(self, code: str) -> Optional[GiftCard]:
        """Get a gift card by its code."""
        return self.db.query(GiftCard).filter(GiftCard.code == code).first()
    
    def validate_gift_card(
        self,
        code: str,
        amount_cents: int
    ) -> Tuple[bool, str, Optional[GiftCard]]:
        """Validate a gift card for use."""
        
        gift_card = self.get_gift_card_by_code(code)
        
        if not gift_card:
            return False, "Gift card not found", None
        
        if not gift_card.is_active:
            return False, "Gift card is not active", gift_card
        
        if gift_card.is_redeemed:
            return False, "Gift card has been redeemed", gift_card
        
        # Check validity period
        now = datetime.utcnow()
        if gift_card.valid_from > now:
            return False, "Gift card is not yet valid", gift_card
        
        if gift_card.valid_until and gift_card.valid_until < now:
            return False, "Gift card has expired", gift_card
        
        # Check balance
        if gift_card.balance_cents < amount_cents:
            return False, f"Insufficient balance (${gift_card.balance_cents / 100:.2f})", gift_card
        
        return True, "Gift card is valid", gift_card
    
    def redeem_gift_card(
        self,
        tenant_id: str,
        gift_card_id: str,
        customer_id: str,
        booking_id: str,
        payment_id: str,
        amount_cents: int,
        description: str = None
    ) -> Tuple[GiftCardTransaction, GiftCard]:
        """Redeem a gift card for a booking."""
        
        gift_card = self.db.query(GiftCard).filter(
            and_(
                GiftCard.tenant_id == tenant_id,
                GiftCard.id == gift_card_id
            )
        ).first()
        
        if not gift_card:
            raise TithiError("TITHI_GIFT_CARD_NOT_FOUND", "Gift card not found")
        
        if gift_card.balance_cents < amount_cents:
            raise TithiError("TITHI_GIFT_CARD_INSUFFICIENT_BALANCE", "Insufficient gift card balance")
        
        # Calculate new balance
        new_balance = gift_card.balance_cents - amount_cents
        
        # Create transaction record
        transaction = GiftCardTransaction(
            tenant_id=tenant_id,
            gift_card_id=gift_card_id,
            transaction_type="redemption",
            amount_cents=amount_cents,
            balance_after_cents=new_balance,
            booking_id=booking_id,
            payment_id=payment_id,
            description=description or f"Redeemed for booking {booking_id}"
        )
        
        self.db.add(transaction)
        
        # Update gift card balance
        gift_card.balance_cents = new_balance
        if new_balance == 0:
            gift_card.is_redeemed = True
        
        self.db.commit()
        
        # Emit log
        print(f"GIFT_CARD_REDEEMED: tenant_id={tenant_id}, gift_card_id={gift_card_id}, amount_cents={amount_cents}")
        
        return transaction, gift_card
    
    def refund_gift_card(
        self,
        tenant_id: str,
        gift_card_id: str,
        booking_id: str,
        payment_id: str,
        amount_cents: int,
        description: str = None
    ) -> GiftCardTransaction:
        """Refund amount to a gift card."""
        
        gift_card = self.db.query(GiftCard).filter(
            and_(
                GiftCard.tenant_id == tenant_id,
                GiftCard.id == gift_card_id
            )
        ).first()
        
        if not gift_card:
            raise TithiError("TITHI_GIFT_CARD_NOT_FOUND", "Gift card not found")
        
        # Calculate new balance
        new_balance = gift_card.balance_cents + amount_cents
        
        # Create transaction record
        transaction = GiftCardTransaction(
            tenant_id=tenant_id,
            gift_card_id=gift_card_id,
            transaction_type="refund",
            amount_cents=amount_cents,
            balance_after_cents=new_balance,
            booking_id=booking_id,
            payment_id=payment_id,
            description=description or f"Refund for booking {booking_id}"
        )
        
        self.db.add(transaction)
        
        # Update gift card balance
        gift_card.balance_cents = new_balance
        gift_card.is_redeemed = False  # Reactivate if it was fully redeemed
        
        self.db.commit()
        
        # Emit log
        print(f"GIFT_CARD_REFUNDED: tenant_id={tenant_id}, gift_card_id={gift_card_id}, amount_cents={amount_cents}")
        
        return transaction
    
    def get_gift_card_balance(self, code: str) -> int:
        """Get the current balance of a gift card."""
        gift_card = self.get_gift_card_by_code(code)
        return gift_card.balance_cents if gift_card else 0
    
    def get_gift_card_transactions(self, tenant_id: str, gift_card_id: str) -> List[GiftCardTransaction]:
        """Get all transactions for a gift card."""
        return self.db.query(GiftCardTransaction).filter(
            and_(
                GiftCardTransaction.tenant_id == tenant_id,
                GiftCardTransaction.gift_card_id == gift_card_id
            )
        ).order_by(GiftCardTransaction.created_at.desc()).all()


class PromotionService:
    """Main service for managing promotions (coupons and gift cards)."""
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or db.session
        self.coupon_service = CouponService(db_session)
        self.gift_card_service = GiftCardService(db_session)
    
    def apply_promotion(
        self,
        tenant_id: str,
        customer_id: str,
        booking_id: str,
        payment_id: str,
        amount_cents: int,
        coupon_code: str = None,
        gift_card_code: str = None,
        service_ids: List[str] = None
    ) -> Dict[str, Any]:
        """Apply a promotion (coupon or gift card) to a booking."""
        
        if not coupon_code and not gift_card_code:
            raise TithiError("TITHI_PROMOTION_REQUIRED", "Either coupon code or gift card code is required")
        
        if coupon_code and gift_card_code:
            raise TithiError("TITHI_PROMOTION_MULTIPLE", "Cannot apply both coupon and gift card")
        
        result = {
            "original_amount_cents": amount_cents,
            "discount_amount_cents": 0,
            "final_amount_cents": amount_cents,
            "promotion_type": None,
            "promotion_id": None,
            "usage_id": None
        }
        
        if coupon_code:
            # Apply coupon
            is_valid, message, coupon = self.coupon_service.validate_coupon(
                tenant_id, coupon_code, customer_id, amount_cents, service_ids
            )
            
            if not is_valid:
                raise TithiError("TITHI_COUPON_INVALID", message)
            
            discount_amount = self.coupon_service.calculate_discount(coupon, amount_cents)
            
            usage = self.coupon_service.apply_coupon(
                tenant_id, coupon.id, customer_id, booking_id, payment_id,
                amount_cents, discount_amount
            )
            
            result.update({
                "discount_amount_cents": discount_amount,
                "final_amount_cents": amount_cents - discount_amount,
                "promotion_type": "coupon",
                "promotion_id": coupon.id,
                "usage_id": usage.id
            })
        
        elif gift_card_code:
            # Apply gift card
            is_valid, message, gift_card = self.gift_card_service.validate_gift_card(
                gift_card_code, amount_cents
            )
            
            if not is_valid:
                raise TithiError("TITHI_GIFT_CARD_INVALID", message)
            
            # Use full gift card balance or amount, whichever is smaller
            discount_amount = min(gift_card.balance_cents, amount_cents)
            
            transaction, updated_gift_card = self.gift_card_service.redeem_gift_card(
                tenant_id, gift_card.id, customer_id, booking_id, payment_id,
                discount_amount
            )
            
            result.update({
                "discount_amount_cents": discount_amount,
                "final_amount_cents": amount_cents - discount_amount,
                "promotion_type": "gift_card",
                "promotion_id": gift_card.id,
                "usage_id": transaction.id
            })
        
        return result
    
    def get_promotion_analytics(self, tenant_id: str, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        """Get promotion analytics for a tenant."""
        
        # Base query filters
        filters = [PromotionUsage.tenant_id == tenant_id]
        
        if start_date:
            filters.append(PromotionUsage.created_at >= start_date)
        if end_date:
            filters.append(PromotionUsage.created_at <= end_date)
        
        # Get coupon analytics
        coupon_usage = self.db.query(PromotionUsage).filter(
            and_(
                *filters,
                PromotionUsage.coupon_id.isnot(None)
            )
        )
        
        coupon_stats = {
            "total_usage": coupon_usage.count(),
            "total_discount_cents": coupon_usage.with_entities(
                func.sum(PromotionUsage.discount_amount_cents)
            ).scalar() or 0,
            "unique_coupons": coupon_usage.with_entities(
                PromotionUsage.coupon_id
            ).distinct().count()
        }
        
        # Get gift card analytics
        gift_card_usage = self.db.query(PromotionUsage).filter(
            and_(
                *filters,
                PromotionUsage.gift_card_id.isnot(None)
            )
        )
        
        gift_card_stats = {
            "total_usage": gift_card_usage.count(),
            "total_discount_cents": gift_card_usage.with_entities(
                func.sum(PromotionUsage.discount_amount_cents)
            ).scalar() or 0,
            "unique_gift_cards": gift_card_usage.with_entities(
                PromotionUsage.gift_card_id
            ).distinct().count()
        }
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "coupons": coupon_stats,
            "gift_cards": gift_card_stats,
            "total_promotions": coupon_stats["total_usage"] + gift_card_stats["total_usage"],
            "total_discount_cents": coupon_stats["total_discount_cents"] + gift_card_stats["total_discount_cents"]
        }
