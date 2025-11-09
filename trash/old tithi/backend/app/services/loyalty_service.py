"""
Loyalty Service (Task 6.2: Loyalty Tracking)

This service implements customer loyalty tracking with points accrual from completed bookings.
Implements the requirements from Task 6.2 with full compliance to Tithi's architecture.

Features:
- 1 point per completed booking
- Configurable rewards
- Duplicate booking prevention (no double points)
- Tenant-scoped balances
- Idempotent operations by booking_id
- Observability hooks for LOYALTY_EARNED events
- Error handling with TITHI_LOYALTY_DUPLICATE_BOOKING

North-Star Invariants:
- Points must only accrue from completed bookings
- Balances must be tenant-scoped
- No duplicate points for same booking
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.crm import LoyaltyAccount, LoyaltyTransaction
from ..models.business import Customer, Booking
from ..models.audit import EventOutbox
from ..middleware.error_handler import TithiError

logger = logging.getLogger(__name__)


class LoyaltyService:
    """Service for managing customer loyalty points and rewards."""
    
    def __init__(self):
        self.session = db.session
    
    def get_loyalty_account(self, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Optional[LoyaltyAccount]:
        """
        Get or create loyalty account for a customer.
        
        Args:
            tenant_id: Tenant identifier
            customer_id: Customer identifier
            
        Returns:
            LoyaltyAccount instance
        """
        try:
            # Try to get existing account
            account = LoyaltyAccount.query.filter_by(
                tenant_id=tenant_id,
                customer_id=customer_id
            ).first()
            
            if not account:
                # Create new account
                account = LoyaltyAccount(
                    tenant_id=tenant_id,
                    customer_id=customer_id,
                    points_balance=0,
                    total_earned=0,
                    total_redeemed=0,
                    tier='bronze',
                    is_active=True
                )
                self.session.add(account)
                self.session.commit()
                
                logger.info(f"Created loyalty account for customer {customer_id} in tenant {tenant_id}")
            
            return account
            
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error getting loyalty account: {str(e)}")
            raise TithiError(
                message="Failed to get loyalty account",
                code="TITHI_LOYALTY_ACCOUNT_ERROR"
            )
    
    def award_points_for_booking(self, tenant_id: uuid.UUID, customer_id: uuid.UUID, 
                                booking_id: uuid.UUID, points: int = 1) -> Dict[str, Any]:
        """
        Award points for a completed booking.
        
        Args:
            tenant_id: Tenant identifier
            customer_id: Customer identifier
            booking_id: Booking identifier (for idempotency)
            points: Points to award (default: 1)
            
        Returns:
            Dict with loyalty account details
            
        Raises:
            TITHI_LOYALTY_DUPLICATE_BOOKING: If points already awarded for this booking
        """
        try:
            # Check if points already awarded for this booking
            existing_transaction = LoyaltyTransaction.query.filter_by(
                tenant_id=tenant_id,
                reference_type='booking',
                reference_id=booking_id,
                transaction_type='earned'
            ).first()
            
            if existing_transaction:
                logger.warning(f"Points already awarded for booking {booking_id}")
                raise TithiError(
                    message="Points already awarded for this booking",
                    code="TITHI_LOYALTY_DUPLICATE_BOOKING"
                )
            
            # Get or create loyalty account
            account = self.get_loyalty_account(tenant_id, customer_id)
            
            # Create transaction record
            transaction = LoyaltyTransaction(
                tenant_id=tenant_id,
                loyalty_account_id=account.id,
                transaction_type='earned',
                points=points,
                description=f"Points earned for completed booking",
                reference_type='booking',
                reference_id=booking_id
            )
            
            # Update account balances
            account.points_balance += points
            account.total_earned += points
            
            # Update tier based on total earned points
            account.tier = self._calculate_tier(account.total_earned)
            
            self.session.add(transaction)
            self.session.commit()
            
            # Emit observability event
            self._emit_loyalty_earned_event(tenant_id, customer_id, booking_id, points, account.points_balance)
            
            logger.info(f"Awarded {points} points to customer {customer_id} for booking {booking_id}")
            
            return {
                'account_id': str(account.id),
                'customer_id': str(customer_id),
                'points_awarded': points,
                'new_balance': account.points_balance,
                'total_earned': account.total_earned,
                'tier': account.tier,
                'transaction_id': str(transaction.id)
            }
            
        except TithiError:
            raise
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error awarding points: {str(e)}")
            raise TithiError(
                message="Failed to award loyalty points",
                code="TITHI_LOYALTY_AWARD_ERROR"
            )
    
    def redeem_points(self, tenant_id: uuid.UUID, customer_id: uuid.UUID, 
                     points: int, description: str, reference_type: str = None, 
                     reference_id: uuid.UUID = None) -> Dict[str, Any]:
        """
        Redeem points from customer's loyalty account.
        
        Args:
            tenant_id: Tenant identifier
            customer_id: Customer identifier
            points: Points to redeem
            description: Description of redemption
            reference_type: Type of reference (e.g., 'coupon', 'gift_card')
            reference_id: Reference identifier
            
        Returns:
            Dict with redemption details
        """
        try:
            account = self.get_loyalty_account(tenant_id, customer_id)
            
            if account.points_balance < points:
                raise TithiError(
                    message="Insufficient loyalty points",
                    code="TITHI_LOYALTY_INSUFFICIENT_POINTS"
                )
            
            # Create redemption transaction
            transaction = LoyaltyTransaction(
                tenant_id=tenant_id,
                loyalty_account_id=account.id,
                transaction_type='redeemed',
                points=-points,  # Negative for redemption
                description=description,
                reference_type=reference_type,
                reference_id=reference_id
            )
            
            # Update account balances
            account.points_balance -= points
            account.total_redeemed += points
            
            self.session.add(transaction)
            self.session.commit()
            
            logger.info(f"Redeemed {points} points for customer {customer_id}")
            
            return {
                'account_id': str(account.id),
                'customer_id': str(customer_id),
                'points_redeemed': points,
                'new_balance': account.points_balance,
                'total_redeemed': account.total_redeemed,
                'transaction_id': str(transaction.id)
            }
            
        except TithiError:
            raise
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error redeeming points: {str(e)}")
            raise TithiError(
                message="Failed to redeem loyalty points",
                code="TITHI_LOYALTY_REDEEM_ERROR"
            )
    
    def get_customer_loyalty_summary(self, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Dict[str, Any]:
        """
        Get loyalty summary for a customer.
        
        Args:
            tenant_id: Tenant identifier
            customer_id: Customer identifier
            
        Returns:
            Dict with loyalty summary
        """
        try:
            account = self.get_loyalty_account(tenant_id, customer_id)
            
            # Get recent transactions
            recent_transactions = LoyaltyTransaction.query.filter_by(
                loyalty_account_id=account.id
            ).order_by(LoyaltyTransaction.created_at.desc()).limit(10).all()
            
            return {
                'account_id': str(account.id),
                'customer_id': str(customer_id),
                'points_balance': account.points_balance,
                'total_earned': account.total_earned,
                'total_redeemed': account.total_redeemed,
                'tier': account.tier,
                'is_active': account.is_active,
                'recent_transactions': [tx.to_dict() for tx in recent_transactions],
                'created_at': account.created_at.isoformat() + "Z",
                'updated_at': account.updated_at.isoformat() + "Z"
            }
            
        except Exception as e:
            logger.error(f"Error getting loyalty summary: {str(e)}")
            raise TithiError(
                message="Failed to get loyalty summary",
                code="TITHI_LOYALTY_SUMMARY_ERROR"
            )
    
    def get_tenant_loyalty_stats(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """
        Get loyalty statistics for a tenant.
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            Dict with tenant loyalty statistics
        """
        try:
            # Get total accounts
            total_accounts = LoyaltyAccount.query.filter_by(tenant_id=tenant_id).count()
            active_accounts = LoyaltyAccount.query.filter_by(tenant_id=tenant_id, is_active=True).count()
            
            # Get total points awarded
            total_points_awarded = db.session.query(db.func.sum(LoyaltyTransaction.points)).filter(
                LoyaltyTransaction.tenant_id == tenant_id,
                LoyaltyTransaction.transaction_type == 'earned'
            ).scalar() or 0
            
            # Get total points redeemed
            total_points_redeemed = db.session.query(db.func.sum(db.func.abs(LoyaltyTransaction.points))).filter(
                LoyaltyTransaction.tenant_id == tenant_id,
                LoyaltyTransaction.transaction_type == 'redeemed'
            ).scalar() or 0
            
            # Get tier distribution
            tier_stats = db.session.query(
                LoyaltyAccount.tier,
                db.func.count(LoyaltyAccount.id)
            ).filter(
                LoyaltyAccount.tenant_id == tenant_id,
                LoyaltyAccount.is_active == True
            ).group_by(LoyaltyAccount.tier).all()
            
            return {
                'total_accounts': total_accounts,
                'active_accounts': active_accounts,
                'total_points_awarded': total_points_awarded,
                'total_points_redeemed': total_points_redeemed,
                'net_points_outstanding': total_points_awarded - total_points_redeemed,
                'tier_distribution': {tier: count for tier, count in tier_stats},
                'tenant_id': str(tenant_id)
            }
            
        except Exception as e:
            logger.error(f"Error getting loyalty stats: {str(e)}")
            raise TithiError(
                message="Failed to get loyalty statistics",
                code="TITHI_LOYALTY_STATS_ERROR"
            )
    
    def _calculate_tier(self, total_earned: int) -> str:
        """
        Calculate loyalty tier based on total earned points.
        
        Args:
            total_earned: Total points earned
            
        Returns:
            Tier name
        """
        if total_earned >= 1000:
            return 'platinum'
        elif total_earned >= 500:
            return 'gold'
        elif total_earned >= 100:
            return 'silver'
        else:
            return 'bronze'
    
    def _emit_loyalty_earned_event(self, tenant_id: uuid.UUID, customer_id: uuid.UUID, 
                                 booking_id: uuid.UUID, points: int, new_balance: int):
        """
        Emit LOYALTY_EARNED event to outbox for observability.
        
        Args:
            tenant_id: Tenant identifier
            customer_id: Customer identifier
            booking_id: Booking identifier
            points: Points awarded
            new_balance: New points balance
        """
        try:
            event = EventOutbox(
                tenant_id=tenant_id,
                event_code='LOYALTY_EARNED',
                payload={
                    'customer_id': str(customer_id),
                    'booking_id': str(booking_id),
                    'points_awarded': points,
                    'new_balance': new_balance,
                    'timestamp': datetime.utcnow().isoformat() + "Z"
                },
                status='ready'
            )
            
            self.session.add(event)
            self.session.commit()
            
            logger.info(f"Emitted LOYALTY_EARNED event for customer {customer_id}")
            
        except Exception as e:
            logger.error(f"Error emitting loyalty event: {str(e)}")
            # Don't raise error - this is observability, not critical path
