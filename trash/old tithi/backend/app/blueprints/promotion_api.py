"""
Promotion API Blueprint

This module provides REST API endpoints for promotion management including coupons and gift cards.
Aligned with Design Brief Module I - Promotions & Loyalty.
"""

from flask import Blueprint, request, jsonify, current_app
from flask_smorest import abort
from marshmallow import Schema, fields, validate, validates_schema, ValidationError
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import and_, or_

from ..services.promotion import CouponService, GiftCardService, PromotionService
from ..models.promotions import Coupon
from ..exceptions import TithiError
from ..middleware.auth_middleware import require_auth
from ..middleware.auth_middleware import require_tenant


# Create blueprint
promotion_bp = Blueprint('promotion_api', __name__)


# Request/Response Schemas
class CouponCreateSchema(Schema):
    """Schema for creating a coupon."""
    code = fields.Str(required=True, validate=validate.Length(min=1, max=50))
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str(allow_none=True)
    discount_type = fields.Str(required=True, validate=validate.OneOf(['percentage', 'fixed_amount']))
    discount_value = fields.Decimal(required=True, places=2)
    currency_code = fields.Str(load_default='USD', validate=validate.Length(equal=3))
    max_uses = fields.Int(allow_none=True, validate=validate.Range(min=1))
    max_uses_per_customer = fields.Int(load_default=1, validate=validate.Range(min=1))
    valid_from = fields.DateTime(allow_none=True)
    valid_until = fields.DateTime(allow_none=True)
    minimum_amount_cents = fields.Int(allow_none=True, validate=validate.Range(min=0))
    maximum_discount_cents = fields.Int(allow_none=True, validate=validate.Range(min=1))
    applicable_services = fields.List(fields.Str(), load_default=[])
    applicable_customers = fields.List(fields.Str(), load_default=[])
    is_public = fields.Bool(load_default=True)
    metadata = fields.Dict(load_default={})
    
    @validates_schema
    def validate_discount_value(self, data, **kwargs):
        """Validate discount value based on type."""
        discount_type = data.get('discount_type')
        discount_value = data.get('discount_value')
        
        if discount_type == 'percentage' and discount_value > 100:
            raise ValidationError('Percentage discount cannot exceed 100%', 'discount_value')
        
        if discount_value <= 0:
            raise ValidationError('Discount value must be positive', 'discount_value')
    
    @validates_schema
    def validate_validity_period(self, data, **kwargs):
        """Validate validity period."""
        valid_from = data.get('valid_from')
        valid_until = data.get('valid_until')
        
        if valid_from and valid_until and valid_until <= valid_from:
            raise ValidationError('valid_until must be after valid_from', 'valid_until')


class CouponUpdateSchema(Schema):
    """Schema for updating a coupon."""
    name = fields.Str(validate=validate.Length(min=1, max=255))
    description = fields.Str(allow_none=True)
    discount_type = fields.Str(validate=validate.OneOf(['percentage', 'fixed_amount']))
    discount_value = fields.Decimal(places=2)
    currency_code = fields.Str(validate=validate.Length(equal=3))
    max_uses = fields.Int(allow_none=True, validate=validate.Range(min=1))
    max_uses_per_customer = fields.Int(validate=validate.Range(min=1))
    valid_from = fields.DateTime(allow_none=True)
    valid_until = fields.DateTime(allow_none=True)
    minimum_amount_cents = fields.Int(allow_none=True, validate=validate.Range(min=0))
    maximum_discount_cents = fields.Int(allow_none=True, validate=validate.Range(min=1))
    applicable_services = fields.List(fields.Str())
    applicable_customers = fields.List(fields.Str())
    is_active = fields.Bool()
    is_public = fields.Bool()
    metadata = fields.Dict()
    
    @validates_schema
    def validate_discount_value(self, data, **kwargs):
        """Validate discount value based on type."""
        discount_type = data.get('discount_type')
        discount_value = data.get('discount_value')
        
        if discount_type == 'percentage' and discount_value and discount_value > 100:
            raise ValidationError('Percentage discount cannot exceed 100%', 'discount_value')
        
        if discount_value and discount_value <= 0:
            raise ValidationError('Discount value must be positive', 'discount_value')
    
    @validates_schema
    def validate_validity_period(self, data, **kwargs):
        """Validate validity period."""
        valid_from = data.get('valid_from')
        valid_until = data.get('valid_until')
        
        if valid_from and valid_until and valid_until <= valid_from:
            raise ValidationError('valid_until must be after valid_from', 'valid_until')


class CouponResponseSchema(Schema):
    """Schema for coupon response."""
    id = fields.Str()
    code = fields.Str()
    name = fields.Str()
    description = fields.Str()
    discount_type = fields.Str()
    discount_value = fields.Decimal(places=2)
    currency_code = fields.Str()
    max_uses = fields.Int(allow_none=True)
    max_uses_per_customer = fields.Int()
    used_count = fields.Int()
    valid_from = fields.DateTime()
    valid_until = fields.DateTime(allow_none=True)
    minimum_amount_cents = fields.Int(allow_none=True)
    maximum_discount_cents = fields.Int(allow_none=True)
    applicable_services = fields.List(fields.Str())
    applicable_customers = fields.List(fields.Str())
    is_active = fields.Bool()
    is_public = fields.Bool()
    metadata = fields.Dict()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class GiftCardCreateSchema(Schema):
    """Schema for creating a gift card."""
    amount_cents = fields.Int(required=True, validate=validate.Range(min=1))
    currency_code = fields.Str(load_default='USD', validate=validate.Length(equal=3))
    recipient_email = fields.Email(allow_none=True)
    recipient_name = fields.Str(allow_none=True, validate=validate.Length(max=255))
    sender_name = fields.Str(allow_none=True, validate=validate.Length(max=255))
    message = fields.Str(allow_none=True)
    valid_until = fields.DateTime(allow_none=True)
    metadata = fields.Dict(load_default={})


class GiftCardResponseSchema(Schema):
    """Schema for gift card response."""
    id = fields.Str()
    code = fields.Str()
    amount_cents = fields.Int()
    currency_code = fields.Str()
    balance_cents = fields.Int()
    recipient_email = fields.Str(allow_none=True)
    recipient_name = fields.Str(allow_none=True)
    sender_name = fields.Str(allow_none=True)
    message = fields.Str(allow_none=True)
    valid_from = fields.DateTime()
    valid_until = fields.DateTime(allow_none=True)
    is_active = fields.Bool()
    is_redeemed = fields.Bool()
    metadata = fields.Dict()
    created_at = fields.DateTime()
    updated_at = fields.DateTime()


class PromotionApplySchema(Schema):
    """Schema for applying a promotion."""
    customer_id = fields.Str(required=True)
    booking_id = fields.Str(required=True)
    payment_id = fields.Str(required=True)
    amount_cents = fields.Int(required=True, validate=validate.Range(min=1))
    coupon_code = fields.Str(allow_none=True)
    gift_card_code = fields.Str(allow_none=True)
    service_ids = fields.List(fields.Str(), load_default=[])
    
    @validates_schema
    def validate_promotion_required(self, data, **kwargs):
        """Validate that either coupon or gift card is provided."""
        coupon_code = data.get('coupon_code')
        gift_card_code = data.get('gift_card_code')
        
        if not coupon_code and not gift_card_code:
            raise ValidationError('Either coupon_code or gift_card_code is required')
        
        if coupon_code and gift_card_code:
            raise ValidationError('Cannot apply both coupon and gift card')


class PromotionResponseSchema(Schema):
    """Schema for promotion application response."""
    original_amount_cents = fields.Int()
    discount_amount_cents = fields.Int()
    final_amount_cents = fields.Int()
    promotion_type = fields.Str(allow_none=True)
    promotion_id = fields.Str(allow_none=True)
    usage_id = fields.Str(allow_none=True)


# Initialize services
coupon_service = CouponService()
gift_card_service = GiftCardService()
promotion_service = PromotionService()


@promotion_bp.route('/coupons', methods=['POST'])
@require_auth
@require_tenant
def create_coupon():
    """Create a new discount coupon."""
    try:
        # Parse and validate request data
        schema = CouponCreateSchema()
        data = schema.load(request.json)
        
        # Get tenant_id from context
        tenant_id = request.tenant_id
        
        # Create coupon
        coupon = coupon_service.create_coupon(
            tenant_id=tenant_id,
            code=data['code'],
            name=data['name'],
            description=data.get('description'),
            discount_type=data['discount_type'],
            discount_value=data['discount_value'],
            currency_code=data['currency_code'],
            max_uses=data.get('max_uses'),
            max_uses_per_customer=data['max_uses_per_customer'],
            valid_from=data.get('valid_from'),
            valid_until=data.get('valid_until'),
            minimum_amount_cents=data.get('minimum_amount_cents'),
            maximum_discount_cents=data.get('maximum_discount_cents'),
            applicable_services=data['applicable_services'],
            applicable_customers=data['applicable_customers'],
            is_public=data['is_public'],
            metadata=data['metadata']
        )
        
        # Return response
        response_schema = CouponResponseSchema()
        return jsonify(response_schema.dump(coupon)), 201
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error creating coupon: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/coupons/<coupon_id>', methods=['GET'])
@require_auth
@require_tenant
def get_coupon(coupon_id):
    """Get a coupon by ID."""
    try:
        tenant_id = request.tenant_id
        
        coupon = coupon_service.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.id == coupon_id
            )
        ).first()
        
        if not coupon:
            abort(404, message="Coupon not found")
        
        response_schema = CouponResponseSchema()
        return jsonify(response_schema.dump(coupon))
        
    except Exception as e:
        current_app.logger.error(f"Error getting coupon: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/coupons/validate', methods=['POST'])
@require_auth
@require_tenant
def validate_coupon():
    """Validate a coupon for use."""
    try:
        data = request.json
        tenant_id = request.tenant_id
        
        # Validate required fields
        required_fields = ['code', 'customer_id', 'amount_cents']
        for field in required_fields:
            if field not in data:
                abort(400, message=f"Missing required field: {field}")
        
        # Validate coupon
        is_valid, message, coupon = coupon_service.validate_coupon(
            tenant_id=tenant_id,
            code=data['code'],
            customer_id=data['customer_id'],
            amount_cents=data['amount_cents'],
            service_ids=data.get('service_ids', [])
        )
        
        if not is_valid:
            abort(400, message=message)
        
        # Calculate discount
        discount_amount = coupon_service.calculate_discount(coupon, data['amount_cents'])
        
        return jsonify({
            "valid": True,
            "message": message,
            "coupon": CouponResponseSchema().dump(coupon),
            "discount_amount_cents": discount_amount,
            "final_amount_cents": data['amount_cents'] - discount_amount
        })
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error validating coupon: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/gift-cards', methods=['POST'])
@require_auth
@require_tenant
def create_gift_card():
    """Create a new gift card."""
    try:
        # Parse and validate request data
        schema = GiftCardCreateSchema()
        data = schema.load(request.json)
        
        # Get tenant_id from context
        tenant_id = request.tenant_id
        
        # Create gift card
        gift_card = gift_card_service.create_gift_card(
            tenant_id=tenant_id,
            amount_cents=data['amount_cents'],
            currency_code=data['currency_code'],
            recipient_email=data.get('recipient_email'),
            recipient_name=data.get('recipient_name'),
            sender_name=data.get('sender_name'),
            message=data.get('message'),
            valid_until=data.get('valid_until'),
            metadata=data['metadata']
        )
        
        # Return response
        response_schema = GiftCardResponseSchema()
        return jsonify(response_schema.dump(gift_card)), 201
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error creating gift card: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/gift-cards/<gift_card_id>', methods=['GET'])
@require_auth
@require_tenant
def get_gift_card(gift_card_id):
    """Get a gift card by ID."""
    try:
        tenant_id = request.tenant_id
        
        gift_card = gift_card_service.db.query(GiftCard).filter(
            and_(
                GiftCard.tenant_id == tenant_id,
                GiftCard.id == gift_card_id
            )
        ).first()
        
        if not gift_card:
            abort(404, message="Gift card not found")
        
        response_schema = GiftCardResponseSchema()
        return jsonify(response_schema.dump(gift_card))
        
    except Exception as e:
        current_app.logger.error(f"Error getting gift card: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/gift-cards/validate', methods=['POST'])
@require_auth
@require_tenant
def validate_gift_card():
    """Validate a gift card for use."""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['code', 'amount_cents']
        for field in required_fields:
            if field not in data:
                abort(400, message=f"Missing required field: {field}")
        
        # Validate gift card
        is_valid, message, gift_card = gift_card_service.validate_gift_card(
            code=data['code'],
            amount_cents=data['amount_cents']
        )
        
        if not is_valid:
            abort(400, message=message)
        
        # Calculate available discount
        discount_amount = min(gift_card.balance_cents, data['amount_cents'])
        
        return jsonify({
            "valid": True,
            "message": message,
            "gift_card": GiftCardResponseSchema().dump(gift_card),
            "discount_amount_cents": discount_amount,
            "final_amount_cents": data['amount_cents'] - discount_amount
        })
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error validating gift card: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/gift-cards/balance/<code>', methods=['GET'])
@require_auth
@require_tenant
def get_gift_card_balance(code):
    """Get the balance of a gift card by code."""
    try:
        balance = gift_card_service.get_gift_card_balance(code)
        
        return jsonify({
            "code": code,
            "balance_cents": balance
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting gift card balance: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/apply', methods=['POST'])
@require_auth
@require_tenant
def apply_promotion():
    """Apply a promotion (coupon or gift card) to a booking."""
    try:
        # Parse and validate request data
        schema = PromotionApplySchema()
        data = schema.load(request.json)
        
        # Get tenant_id from context
        tenant_id = request.tenant_id
        
        # Apply promotion
        result = promotion_service.apply_promotion(
            tenant_id=tenant_id,
            customer_id=data['customer_id'],
            booking_id=data['booking_id'],
            payment_id=data['payment_id'],
            amount_cents=data['amount_cents'],
            coupon_code=data.get('coupon_code'),
            gift_card_code=data.get('gift_card_code'),
            service_ids=data['service_ids']
        )
        
        # Return response
        response_schema = PromotionResponseSchema()
        return jsonify(response_schema.dump(result))
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error applying promotion: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/analytics', methods=['GET'])
@require_auth
@require_tenant
def get_promotion_analytics():
    """Get promotion analytics for the tenant."""
    try:
        tenant_id = request.tenant_id
        
        # Parse query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        # Get analytics
        analytics = promotion_service.get_promotion_analytics(
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return jsonify(analytics)
        
    except Exception as e:
        current_app.logger.error(f"Error getting promotion analytics: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/coupons', methods=['GET'])
@require_auth
@require_tenant
def list_coupons():
    """List all coupons for the tenant."""
    try:
        tenant_id = request.tenant_id
        
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        search = request.args.get('search', '')
        
        # Build query
        query = coupon_service.db.query(Coupon).filter(Coupon.tenant_id == tenant_id)
        
        # Apply filters
        if active_only:
            query = query.filter(Coupon.is_active == True)
        
        if search:
            query = query.filter(
                or_(
                    Coupon.code.ilike(f'%{search}%'),
                    Coupon.name.ilike(f'%{search}%'),
                    Coupon.description.ilike(f'%{search}%')
                )
            )
        
        # Order by created_at desc
        query = query.order_by(Coupon.created_at.desc())
        
        # Paginate
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        # Convert to response format
        coupons_data = []
        for coupon in pagination.items:
            coupons_data.append({
                "id": str(coupon.id),
                "code": coupon.code,
                "name": coupon.name,
                "description": coupon.description,
                "discount_type": coupon.discount_type,
                "discount_value": float(coupon.discount_value),
                "currency_code": coupon.currency_code,
                "max_uses": coupon.max_uses,
                "max_uses_per_customer": coupon.max_uses_per_customer,
                "used_count": coupon.used_count,
                "valid_from": coupon.valid_from.isoformat() if coupon.valid_from else None,
                "valid_until": coupon.valid_until.isoformat() if coupon.valid_until else None,
                "minimum_amount_cents": coupon.minimum_amount_cents,
                "maximum_discount_cents": coupon.maximum_discount_cents,
                "applicable_services": coupon.applicable_services,
                "applicable_customers": coupon.applicable_customers,
                "is_active": coupon.is_active,
                "is_public": coupon.is_public,
                "metadata": coupon.metadata_json,
                "created_at": coupon.created_at.isoformat(),
                "updated_at": coupon.updated_at.isoformat()
            })
        
        return jsonify({
            "coupons": coupons_data,
            "pagination": {
                "page": pagination.page,
                "per_page": pagination.per_page,
                "total": pagination.total,
                "pages": pagination.pages,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Error listing coupons: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/coupons/<coupon_id>', methods=['PUT'])
@require_auth
@require_tenant
def update_coupon(coupon_id):
    """Update a coupon."""
    try:
        tenant_id = request.tenant_id
        
        # Get existing coupon
        coupon = coupon_service.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.id == coupon_id
            )
        ).first()
        
        if not coupon:
            abort(404, message="Coupon not found")
        
        # Parse and validate request data
        schema = CouponUpdateSchema()
        data = schema.load(request.json)
        
        # Update coupon fields
        if 'name' in data:
            coupon.name = data['name']
        if 'description' in data:
            coupon.description = data['description']
        if 'discount_type' in data:
            coupon.discount_type = data['discount_type']
        if 'discount_value' in data:
            coupon.discount_value = data['discount_value']
        if 'currency_code' in data:
            coupon.currency_code = data['currency_code']
        if 'max_uses' in data:
            coupon.max_uses = data['max_uses']
        if 'max_uses_per_customer' in data:
            coupon.max_uses_per_customer = data['max_uses_per_customer']
        if 'valid_from' in data:
            coupon.valid_from = data['valid_from']
        if 'valid_until' in data:
            coupon.valid_until = data['valid_until']
        if 'minimum_amount_cents' in data:
            coupon.minimum_amount_cents = data['minimum_amount_cents']
        if 'maximum_discount_cents' in data:
            coupon.maximum_discount_cents = data['maximum_discount_cents']
        if 'applicable_services' in data:
            coupon.applicable_services = data['applicable_services']
        if 'applicable_customers' in data:
            coupon.applicable_customers = data['applicable_customers']
        if 'is_active' in data:
            coupon.is_active = data['is_active']
        if 'is_public' in data:
            coupon.is_public = data['is_public']
        if 'metadata' in data:
            coupon.metadata_json = data['metadata']
        
        # Save changes
        coupon_service.db.commit()
        
        # Return updated coupon
        response_schema = CouponResponseSchema()
        return jsonify(response_schema.dump(coupon))
        
    except ValidationError as e:
        abort(400, message="Validation error", errors=e.messages)
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error updating coupon: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/coupons/<coupon_id>', methods=['DELETE'])
@require_auth
@require_tenant
def delete_coupon(coupon_id):
    """Delete a coupon."""
    try:
        tenant_id = request.tenant_id
        
        # Get existing coupon
        coupon = coupon_service.db.query(Coupon).filter(
            and_(
                Coupon.tenant_id == tenant_id,
                Coupon.id == coupon_id
            )
        ).first()
        
        if not coupon:
            abort(404, message="Coupon not found")
        
        # Check if coupon has been used
        if coupon.used_count > 0:
            abort(400, message="Cannot delete coupon that has been used")
        
        # Soft delete the coupon
        coupon.deleted_at = datetime.utcnow()
        coupon.is_active = False
        
        coupon_service.db.commit()
        
        return jsonify({"message": "Coupon deleted successfully"})
        
    except Exception as e:
        current_app.logger.error(f"Error deleting coupon: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/coupons/<coupon_id>/stats', methods=['GET'])
@require_auth
@require_tenant
def get_coupon_stats(coupon_id):
    """Get usage statistics for a coupon."""
    try:
        tenant_id = request.tenant_id
        
        stats = coupon_service.get_coupon_usage_stats(tenant_id, coupon_id)
        
        return jsonify(stats)
        
    except TithiError as e:
        abort(400, message=e.message, error_code=e.error_code)
    except Exception as e:
        current_app.logger.error(f"Error getting coupon stats: {str(e)}")
        abort(500, message="Internal server error")


@promotion_bp.route('/gift-cards/<gift_card_id>/transactions', methods=['GET'])
@require_auth
@require_tenant
def get_gift_card_transactions(gift_card_id):
    """Get all transactions for a gift card."""
    try:
        tenant_id = request.tenant_id
        
        transactions = gift_card_service.get_gift_card_transactions(tenant_id, gift_card_id)
        
        # Convert transactions to response format
        transaction_data = []
        for transaction in transactions:
            transaction_data.append({
                "id": str(transaction.id),
                "transaction_type": transaction.transaction_type,
                "amount_cents": transaction.amount_cents,
                "balance_after_cents": transaction.balance_after_cents,
                "booking_id": str(transaction.booking_id) if transaction.booking_id else None,
                "payment_id": str(transaction.payment_id) if transaction.payment_id else None,
                "description": transaction.description,
                "created_at": transaction.created_at.isoformat()
            })
        
        return jsonify({
            "gift_card_id": gift_card_id,
            "transactions": transaction_data
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting gift card transactions: {str(e)}")
        abort(500, message="Internal server error")
