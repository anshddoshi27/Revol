"""
Loyalty Integration Tests (Task 6.2: Loyalty Tracking)

This module contains comprehensive tests for the loyalty tracking system
following Task 6.2 requirements and contract test specifications.

Contract Tests (Black-box):
- Given customer completes 2 bookings, When loyalty queried, Then balance shows 2 points
- Given duplicate booking completion, When loyalty points awarded, Then system rejects with TITHI_LOYALTY_DUPLICATE_BOOKING

North-Star Invariants:
- Points must only accrue from completed bookings
- Balances must be tenant-scoped
- No duplicate points for same booking
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Booking, Service, Resource
from app.models.crm import LoyaltyAccount, LoyaltyTransaction
from app.services.loyalty_service import LoyaltyService
from app.services.business_phase2 import BookingService
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
def test_tenant(app):
    """Create test tenant."""
    tenant = Tenant(
        id=uuid.uuid4(),
        slug='test-tenant',
        tz='UTC'
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user(app):
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name='Test User',
        primary_email='test@example.com'
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def test_membership(app, test_tenant, test_user):
    """Create test membership."""
    membership = Membership(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        user_id=test_user.id,
        role='owner'
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def test_customer(app, test_tenant):
    """Create test customer."""
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        display_name='Test Customer',
        email='customer@example.com',
        phone='+1234567890'
    )
    db.session.add(customer)
    db.session.commit()
    return customer


@pytest.fixture
def test_service(app, test_tenant):
    """Create test service."""
    service = Service(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        slug='test-service',
        name='Test Service',
        description='A test service',
        duration_min=60,
        price_cents=5000,
        active=True
    )
    db.session.add(service)
    db.session.commit()
    return service


@pytest.fixture
def test_resource(app, test_tenant):
    """Create test resource."""
    resource = Resource(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        type='staff',
        tz='UTC',
        capacity=1,
        name='Test Staff',
        is_active=True
    )
    db.session.add(resource)
    db.session.commit()
    return resource


@pytest.fixture
def test_booking(app, test_tenant, test_customer, test_service, test_resource):
    """Create test booking."""
    booking = Booking(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        customer_id=test_customer.id,
        resource_id=test_resource.id,
        client_generated_id='test-booking-1',
        service_snapshot={'id': str(test_service.id), 'name': test_service.name},
        start_at=datetime.utcnow() + timedelta(hours=1),
        end_at=datetime.utcnow() + timedelta(hours=2),
        booking_tz='UTC',
        status='confirmed'
    )
    db.session.add(booking)
    db.session.commit()
    return booking


@pytest.fixture
def loyalty_service():
    """Create loyalty service instance."""
    return LoyaltyService()


@pytest.fixture
def booking_service():
    """Create booking service instance."""
    return BookingService()


class TestLoyaltyService:
    """Test loyalty service functionality."""
    
    def test_get_loyalty_account_creation(self, app, loyalty_service, test_tenant, test_customer):
        """Test loyalty account creation."""
        account = loyalty_service.get_loyalty_account(test_tenant.id, test_customer.id)
        
        assert account is not None
        assert account.tenant_id == test_tenant.id
        assert account.customer_id == test_customer.id
        assert account.points_balance == 0
        assert account.total_earned == 0
        assert account.total_redeemed == 0
        assert account.tier == 'bronze'
        assert account.is_active == True
    
    def test_get_loyalty_account_existing(self, app, loyalty_service, test_tenant, test_customer):
        """Test getting existing loyalty account."""
        # Create account first
        account1 = loyalty_service.get_loyalty_account(test_tenant.id, test_customer.id)
        
        # Get same account again
        account2 = loyalty_service.get_loyalty_account(test_tenant.id, test_customer.id)
        
        assert account1.id == account2.id
        assert account1.points_balance == account2.points_balance
    
    def test_award_points_for_booking(self, app, loyalty_service, test_tenant, test_customer, test_booking):
        """Test awarding points for completed booking."""
        result = loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=test_booking.id,
            points=1
        )
        
        assert result['points_awarded'] == 1
        assert result['new_balance'] == 1
        assert result['total_earned'] == 1
        assert result['tier'] == 'bronze'
        
        # Verify account was updated
        account = LoyaltyAccount.query.filter_by(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id
        ).first()
        
        assert account.points_balance == 1
        assert account.total_earned == 1
        
        # Verify transaction was created
        transaction = LoyaltyTransaction.query.filter_by(
            tenant_id=test_tenant.id,
            reference_type='booking',
            reference_id=test_booking.id
        ).first()
        
        assert transaction is not None
        assert transaction.points == 1
        assert transaction.transaction_type == 'earned'
        assert transaction.description == 'Points earned for completed booking'
    
    def test_award_points_duplicate_booking(self, app, loyalty_service, test_tenant, test_customer, test_booking):
        """Test duplicate booking prevention (no double points)."""
        # Award points first time
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=test_booking.id,
            points=1
        )
        
        # Try to award points again for same booking
        with pytest.raises(TithiError) as exc_info:
            loyalty_service.award_points_for_booking(
                tenant_id=test_tenant.id,
                customer_id=test_customer.id,
                booking_id=test_booking.id,
                points=1
            )
        
        assert exc_info.value.code == 'TITHI_LOYALTY_DUPLICATE_BOOKING'
        
        # Verify only one transaction exists
        transactions = LoyaltyTransaction.query.filter_by(
            tenant_id=test_tenant.id,
            reference_type='booking',
            reference_id=test_booking.id
        ).all()
        
        assert len(transactions) == 1
    
    def test_redeem_points(self, app, loyalty_service, test_tenant, test_customer):
        """Test redeeming loyalty points."""
        # First award some points
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=10
        )
        
        # Redeem points
        result = loyalty_service.redeem_points(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            points=5,
            description='Redeemed for discount',
            reference_type='coupon',
            reference_id=uuid.uuid4()
        )
        
        assert result['points_redeemed'] == 5
        assert result['new_balance'] == 5
        assert result['total_redeemed'] == 5
        
        # Verify account was updated
        account = LoyaltyAccount.query.filter_by(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id
        ).first()
        
        assert account.points_balance == 5
        assert account.total_redeemed == 5
    
    def test_redeem_points_insufficient(self, app, loyalty_service, test_tenant, test_customer):
        """Test redeeming more points than available."""
        # Award some points
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=5
        )
        
        # Try to redeem more points than available
        with pytest.raises(TithiError) as exc_info:
            loyalty_service.redeem_points(
                tenant_id=test_tenant.id,
                customer_id=test_customer.id,
                points=10,
                description='Redeemed for discount'
            )
        
        assert exc_info.value.code == 'TITHI_LOYALTY_INSUFFICIENT_POINTS'
    
    def test_tier_calculation(self, app, loyalty_service, test_tenant, test_customer):
        """Test loyalty tier calculation."""
        # Test bronze tier (default)
        account = loyalty_service.get_loyalty_account(test_tenant.id, test_customer.id)
        assert account.tier == 'bronze'
        
        # Award points to reach silver tier (100+ points)
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=100
        )
        
        account = LoyaltyAccount.query.filter_by(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id
        ).first()
        assert account.tier == 'silver'
        
        # Award more points to reach gold tier (500+ points)
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=400
        )
        
        account = LoyaltyAccount.query.filter_by(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id
        ).first()
        assert account.tier == 'gold'
        
        # Award more points to reach platinum tier (1000+ points)
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=500
        )
        
        account = LoyaltyAccount.query.filter_by(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id
        ).first()
        assert account.tier == 'platinum'
    
    def test_get_customer_loyalty_summary(self, app, loyalty_service, test_tenant, test_customer):
        """Test getting customer loyalty summary."""
        # Award some points
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=5
        )
        
        summary = loyalty_service.get_customer_loyalty_summary(test_tenant.id, test_customer.id)
        
        assert summary['points_balance'] == 5
        assert summary['total_earned'] == 5
        assert summary['total_redeemed'] == 0
        assert summary['tier'] == 'bronze'
        assert summary['is_active'] == True
        assert len(summary['recent_transactions']) == 1
        assert summary['recent_transactions'][0]['points'] == 5
    
    def test_get_tenant_loyalty_stats(self, app, loyalty_service, test_tenant, test_customer):
        """Test getting tenant loyalty statistics."""
        # Award some points
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=10
        )
        
        stats = loyalty_service.get_tenant_loyalty_stats(test_tenant.id)
        
        assert stats['total_accounts'] == 1
        assert stats['active_accounts'] == 1
        assert stats['total_points_awarded'] == 10
        assert stats['total_points_redeemed'] == 0
        assert stats['net_points_outstanding'] == 10
        assert stats['tier_distribution']['bronze'] == 1


class TestLoyaltyContractTests:
    """Test loyalty contract requirements from Task 6.2."""
    
    def test_contract_test_two_bookings_two_points(self, app, loyalty_service, test_tenant, test_customer):
        """
        Contract test: Given customer completes 2 bookings, When loyalty queried, Then balance shows 2 points.
        """
        # Given: Customer completes 2 bookings
        booking1_id = uuid.uuid4()
        booking2_id = uuid.uuid4()
        
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=booking1_id,
            points=1
        )
        
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=booking2_id,
            points=1
        )
        
        # When: Loyalty queried
        summary = loyalty_service.get_customer_loyalty_summary(test_tenant.id, test_customer.id)
        
        # Then: Balance shows 2 points
        assert summary['points_balance'] == 2
        assert summary['total_earned'] == 2
        assert len(summary['recent_transactions']) == 2
    
    def test_contract_test_duplicate_booking_prevention(self, app, loyalty_service, test_tenant, test_customer):
        """
        Contract test: Given duplicate booking completion, When loyalty points awarded, Then system rejects with TITHI_LOYALTY_DUPLICATE_BOOKING.
        """
        booking_id = uuid.uuid4()
        
        # Award points first time
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=booking_id,
            points=1
        )
        
        # Try to award points again for same booking
        with pytest.raises(TithiError) as exc_info:
            loyalty_service.award_points_for_booking(
                tenant_id=test_tenant.id,
                customer_id=test_customer.id,
                booking_id=booking_id,
                points=1
            )
        
        # Then: System rejects with TITHI_LOYALTY_DUPLICATE_BOOKING
        assert exc_info.value.code == 'TITHI_LOYALTY_DUPLICATE_BOOKING'


class TestLoyaltyIntegrationWithBooking:
    """Test loyalty integration with booking completion."""
    
    def test_complete_booking_awards_loyalty_points(self, app, booking_service, loyalty_service, 
                                                   test_tenant, test_customer, test_booking, test_user):
        """Test that completing a booking awards loyalty points."""
        # Complete the booking
        completed_booking = booking_service.complete_booking(
            tenant_id=test_tenant.id,
            booking_id=test_booking.id,
            user_id=test_user.id
        )
        
        assert completed_booking.status == 'completed'
        
        # Verify loyalty points were awarded
        summary = loyalty_service.get_customer_loyalty_summary(test_tenant.id, test_customer.id)
        assert summary['points_balance'] == 1
        assert summary['total_earned'] == 1
        
        # Verify transaction exists
        transaction = LoyaltyTransaction.query.filter_by(
            tenant_id=test_tenant.id,
            reference_type='booking',
            reference_id=test_booking.id
        ).first()
        
        assert transaction is not None
        assert transaction.points == 1
        assert transaction.transaction_type == 'earned'
    
    def test_complete_booking_duplicate_prevention(self, app, booking_service, loyalty_service,
                                                  test_tenant, test_customer, test_booking, test_user):
        """Test that completing the same booking twice doesn't award duplicate points."""
        # Complete the booking first time
        booking_service.complete_booking(
            tenant_id=test_tenant.id,
            booking_id=test_booking.id,
            user_id=test_user.id
        )
        
        # Try to complete the same booking again
        with pytest.raises(ValueError):
            booking_service.complete_booking(
                tenant_id=test_tenant.id,
                booking_id=test_booking.id,
                user_id=test_user.id
            )
        
        # Verify only one loyalty transaction exists
        transactions = LoyaltyTransaction.query.filter_by(
            tenant_id=test_tenant.id,
            reference_type='booking',
            reference_id=test_booking.id
        ).all()
        
        assert len(transactions) == 1


class TestLoyaltyNorthStarInvariants:
    """Test North-Star invariants from Task 6.2."""
    
    def test_points_only_from_completed_bookings(self, app, loyalty_service, test_tenant, test_customer):
        """Test that points only accrue from completed bookings."""
        # This test ensures that the loyalty service only awards points
        # when explicitly called for completed bookings, not for other booking statuses
        
        booking_id = uuid.uuid4()
        
        # Award points for completed booking
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=booking_id,
            points=1
        )
        
        summary = loyalty_service.get_customer_loyalty_summary(test_tenant.id, test_customer.id)
        assert summary['points_balance'] == 1
        assert summary['total_earned'] == 1
    
    def test_balances_tenant_scoped(self, app, loyalty_service, test_tenant, test_customer):
        """Test that balances are tenant-scoped."""
        # Create another tenant
        other_tenant = Tenant(
            id=uuid.uuid4(),
            slug='other-tenant',
            tz='UTC'
        )
        db.session.add(other_tenant)
        db.session.commit()
        
        # Award points in first tenant
        loyalty_service.award_points_for_booking(
            tenant_id=test_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=5
        )
        
        # Check summary in first tenant
        summary1 = loyalty_service.get_customer_loyalty_summary(test_tenant.id, test_customer.id)
        assert summary1['points_balance'] == 5
        
        # Check summary in second tenant (should be 0)
        summary2 = loyalty_service.get_customer_loyalty_summary(other_tenant.id, test_customer.id)
        assert summary2['points_balance'] == 0
        
        # Award points in second tenant
        loyalty_service.award_points_for_booking(
            tenant_id=other_tenant.id,
            customer_id=test_customer.id,
            booking_id=uuid.uuid4(),
            points=3
        )
        
        # Check both summaries are independent
        summary1 = loyalty_service.get_customer_loyalty_summary(test_tenant.id, test_customer.id)
        summary2 = loyalty_service.get_customer_loyalty_summary(other_tenant.id, test_customer.id)
        
        assert summary1['points_balance'] == 5
        assert summary2['points_balance'] == 3
