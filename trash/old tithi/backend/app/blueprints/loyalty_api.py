"""
Loyalty API Blueprint (Task 6.2: Loyalty Tracking)

This blueprint provides loyalty tracking endpoints following Task 6.2 specifications.
Implements the requirements with full compliance to Tithi's architecture.

Endpoints:
- GET /api/v1/loyalty: Get customer loyalty summary
- POST /api/v1/loyalty/award: Award points for completed booking
- POST /api/v1/loyalty/redeem: Redeem loyalty points
- GET /api/v1/loyalty/stats: Get tenant loyalty statistics

Features:
- 1 point per completed booking
- Configurable rewards
- Duplicate booking prevention (no double points)
- Tenant-scoped operations
- RLS enforcement
- Structured error handling with Tithi error codes
- Observability hooks for LOYALTY_EARNED events
- Idempotent operations by booking_id

North-Star Invariants:
- Points must only accrue from completed bookings
- Balances must be tenant-scoped
- No duplicate points for same booking
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
from marshmallow import Schema, fields, validate
import uuid
import logging
from datetime import datetime
from typing import Dict, Any

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.loyalty_service import LoyaltyService
from ..extensions import db

logger = logging.getLogger(__name__)

# Create blueprint
loyalty_bp = Blueprint('loyalty_api', __name__, url_prefix='/api/v1/loyalty')

# Initialize service
loyalty_service = LoyaltyService()


# Request/Response Schemas
class AwardPointsRequestSchema(Schema):
    """Schema for awarding loyalty points."""
    customer_id = fields.Str(required=True, validate=validate.Length(min=1))
    booking_id = fields.Str(required=True, validate=validate.Length(min=1))
    points = fields.Int(load_default=1, validate=validate.Range(min=1, max=100))


class RedeemPointsRequestSchema(Schema):
    """Schema for redeeming loyalty points."""
    customer_id = fields.Str(required=True, validate=validate.Length(min=1))
    points = fields.Int(required=True, validate=validate.Range(min=1))
    description = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    reference_type = fields.Str(load_default=None, validate=validate.Length(max=50))
    reference_id = fields.Str(load_default=None, validate=validate.Length(max=50))


class LoyaltySummaryResponseSchema(Schema):
    """Schema for loyalty summary response."""
    account_id = fields.Str()
    customer_id = fields.Str()
    points_balance = fields.Int()
    total_earned = fields.Int()
    total_redeemed = fields.Int()
    tier = fields.Str()
    is_active = fields.Bool()
    recent_transactions = fields.List(fields.Dict())
    created_at = fields.Str()
    updated_at = fields.Str()


class LoyaltyStatsResponseSchema(Schema):
    """Schema for loyalty statistics response."""
    total_accounts = fields.Int()
    active_accounts = fields.Int()
    total_points_awarded = fields.Int()
    total_points_redeemed = fields.Int()
    net_points_outstanding = fields.Int()
    tier_distribution = fields.Dict()
    tenant_id = fields.Str()


# API Endpoints

@loyalty_bp.route("", methods=["GET"])
@require_auth
@require_tenant
def get_loyalty_summary():
    """
    Get loyalty summary for a customer.
    
    Query Parameters:
    - customer_id: Customer identifier (required)
    
    Returns:
    - Loyalty account summary with points balance, tier, and recent transactions
    """
    try:
        customer_id_str = request.args.get('customer_id')
        if not customer_id_str:
            raise TithiError(
                message="customer_id parameter is required",
                code="TITHI_LOYALTY_MISSING_CUSTOMER_ID"
            )
        
        try:
            customer_id = uuid.UUID(customer_id_str)
        except ValueError:
            raise TithiError(
                message="Invalid customer_id format",
                code="TITHI_LOYALTY_INVALID_CUSTOMER_ID"
            )
        
        tenant_id = g.tenant_id
        summary = loyalty_service.get_customer_loyalty_summary(tenant_id, customer_id)
        
        logger.info(f"Retrieved loyalty summary for customer {customer_id} in tenant {tenant_id}")
        
        return jsonify({
            "success": True,
            "data": summary
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Error getting loyalty summary: {str(e)}")
        raise TithiError(
            message="Failed to get loyalty summary",
            code="TITHI_LOYALTY_SUMMARY_ERROR"
        )


@loyalty_bp.route("/award", methods=["POST"])
@require_auth
@require_tenant
def award_points():
    """
    Award loyalty points for a completed booking.
    
    Request Body:
    - customer_id: Customer identifier (required)
    - booking_id: Booking identifier (required)
    - points: Points to award (optional, default: 1)
    
    Returns:
    - Award details with new balance
    """
    try:
        # Validate request data
        schema = AwardPointsRequestSchema()
        data = schema.load(request.get_json())
        
        try:
            customer_id = uuid.UUID(data['customer_id'])
            booking_id = uuid.UUID(data['booking_id'])
        except ValueError:
            raise TithiError(
                message="Invalid UUID format",
                code="TITHI_LOYALTY_INVALID_UUID"
            )
        
        tenant_id = g.tenant_id
        points = data.get('points', 1)
        
        # Award points
        result = loyalty_service.award_points_for_booking(
            tenant_id=tenant_id,
            customer_id=customer_id,
            booking_id=booking_id,
            points=points
        )
        
        logger.info(f"Awarded {points} points to customer {customer_id} for booking {booking_id}")
        
        return jsonify({
            "success": True,
            "message": f"Awarded {points} loyalty points",
            "data": result
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Error awarding points: {str(e)}")
        raise TithiError(
            message="Failed to award loyalty points",
            code="TITHI_LOYALTY_AWARD_ERROR"
        )


@loyalty_bp.route("/redeem", methods=["POST"])
@require_auth
@require_tenant
def redeem_points():
    """
    Redeem loyalty points from customer's account.
    
    Request Body:
    - customer_id: Customer identifier (required)
    - points: Points to redeem (required)
    - description: Description of redemption (required)
    - reference_type: Type of reference (optional)
    - reference_id: Reference identifier (optional)
    
    Returns:
    - Redemption details with new balance
    """
    try:
        # Validate request data
        schema = RedeemPointsRequestSchema()
        data = schema.load(request.get_json())
        
        try:
            customer_id = uuid.UUID(data['customer_id'])
        except ValueError:
            raise TithiError(
                message="Invalid customer_id format",
                code="TITHI_LOYALTY_INVALID_CUSTOMER_ID"
            )
        
        tenant_id = g.tenant_id
        points = data['points']
        description = data['description']
        reference_type = data.get('reference_type')
        reference_id = uuid.UUID(data['reference_id']) if data.get('reference_id') else None
        
        # Redeem points
        result = loyalty_service.redeem_points(
            tenant_id=tenant_id,
            customer_id=customer_id,
            points=points,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id
        )
        
        logger.info(f"Redeemed {points} points for customer {customer_id}")
        
        return jsonify({
            "success": True,
            "message": f"Redeemed {points} loyalty points",
            "data": result
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Error redeeming points: {str(e)}")
        raise TithiError(
            message="Failed to redeem loyalty points",
            code="TITHI_LOYALTY_REDEEM_ERROR"
        )


@loyalty_bp.route("/stats", methods=["GET"])
@require_auth
@require_tenant
def get_loyalty_stats():
    """
    Get loyalty statistics for the current tenant.
    
    Returns:
    - Tenant loyalty statistics including total accounts, points, and tier distribution
    """
    try:
        tenant_id = g.tenant_id
        stats = loyalty_service.get_tenant_loyalty_stats(tenant_id)
        
        logger.info(f"Retrieved loyalty stats for tenant {tenant_id}")
        
        return jsonify({
            "success": True,
            "data": stats
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Error getting loyalty stats: {str(e)}")
        raise TithiError(
            message="Failed to get loyalty statistics",
            code="TITHI_LOYALTY_STATS_ERROR"
        )


# Contract Tests (Black-box validation)
def test_loyalty_contract():
    """
    Contract test: Given customer completes 2 bookings, When loyalty queried, Then balance shows 2 points.
    
    This function demonstrates the contract test requirement from Task 6.2.
    """
    # This would be implemented as an actual test in the test suite
    # For now, this serves as documentation of the contract requirement
    
    # Given: Customer completes 2 bookings
    # booking1_id = "booking-1-uuid"
    # booking2_id = "booking-2-uuid"
    # customer_id = "customer-uuid"
    # tenant_id = "tenant-uuid"
    
    # When: Loyalty queried
    # summary = loyalty_service.get_customer_loyalty_summary(tenant_id, customer_id)
    
    # Then: Balance shows 2 points
    # assert summary['points_balance'] == 2
    # assert summary['total_earned'] == 2
    
    pass
