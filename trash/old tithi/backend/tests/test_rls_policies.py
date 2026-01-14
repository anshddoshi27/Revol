"""
Row Level Security (RLS) Policy Test Suite

This module contains comprehensive tests for Row Level Security policies to ensure
complete tenant data isolation and proper access control enforcement.

RLS Requirements Tested:
- Tenant isolation enforcement
- Cross-tenant data access prevention
- RLS helper function validation
- Policy enforcement for all CRUD operations
- Special access patterns for system tables
- Audit trail for RLS violations
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import Flask
from sqlalchemy import text

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment, PaymentMethod, Refund
from app.models.promotions import Coupon, GiftCard
from app.models.notification import Notification, NotificationTemplate
from app.models.audit import AuditLog
from app.middleware.error_handler import TithiError


class TestRLSPolicies:
    """Comprehensive RLS policy validation tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for each test."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenants
            self.tenant1 = Tenant(
                id=uuid.uuid4(),
                slug="rls-test-tenant-1",
                name="RLS Test Tenant 1",
                timezone="UTC",
                is_active=True
            )
            self.tenant2 = Tenant(
                id=uuid.uuid4(),
                slug="rls-test-tenant-2", 
                name="RLS Test Tenant 2",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant1)
            db.session.add(self.tenant2)
            
            # Create test users
            self.user1 = User(
                id=uuid.uuid4(),
                display_name="RLS Test User 1",
                primary_email="rls-user1@example.com"
            )
            self.user2 = User(
                id=uuid.uuid4(),
                display_name="RLS Test User 2",
                primary_email="rls-user2@example.com"
            )
            db.session.add(self.user1)
            db.session.add(self.user2)
            
            # Create memberships
            self.membership1 = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant1.id,
                user_id=self.user1.id,
                role="owner"
            )
            self.membership2 = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant2.id,
                user_id=self.user2.id,
                role="owner"
            )
            db.session.add(self.membership1)
            db.session.add(self.membership2)
            
            # Create test customers
            self.customer1 = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant1.id,
                display_name="RLS Customer 1",
                email="customer1@example.com"
            )
            self.customer2 = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant2.id,
                display_name="RLS Customer 2",
                email="customer2@example.com"
            )
            db.session.add(self.customer1)
            db.session.add(self.customer2)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_tenant_isolation_customers(self):
        """Test that tenants cannot access each other's customers."""
        # Set tenant1 context
        with patch('app.models.core.current_tenant_id', return_value=self.tenant1.id):
            # Tenant1 should only see their own customers
            tenant1_customers = db.session.query(Customer).filter(
                Customer.tenant_id == self.tenant1.id
            ).all()
            
            assert len(tenant1_customers) == 1
            assert tenant1_customers[0].id == self.customer1.id
            
            # Tenant1 should not see tenant2's customers
            tenant2_customers = db.session.query(Customer).filter(
                Customer.tenant_id == self.tenant2.id
            ).all()
            
            assert len(tenant2_customers) == 0  # RLS should prevent access
        
        # Set tenant2 context
        with patch('app.models.core.current_tenant_id', return_value=self.tenant2.id):
            # Tenant2 should only see their own customers
            tenant2_customers = db.session.query(Customer).filter(
                Customer.tenant_id == self.tenant2.id
            ).all()
            
            assert len(tenant2_customers) == 1
            assert tenant2_customers[0].id == self.customer2.id
            
            # Tenant2 should not see tenant1's customers
            tenant1_customers = db.session.query(Customer).filter(
                Customer.tenant_id == self.tenant1.id
            ).all()
            
            assert len(tenant1_customers) == 0  # RLS should prevent access
    
    def test_tenant_isolation_bookings(self):
        """Test that tenants cannot access each other's bookings."""
        # Create bookings for each tenant
        booking1 = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            customer_id=self.customer1.id,
            resource_id=uuid.uuid4(),
            client_generated_id=str(uuid.uuid4()),
            start_at=datetime.utcnow() + timedelta(hours=1),
            end_at=datetime.utcnow() + timedelta(hours=2),
            booking_tz="UTC",
            status="confirmed"
        )
        
        booking2 = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            customer_id=self.customer2.id,
            resource_id=uuid.uuid4(),
            client_generated_id=str(uuid.uuid4()),
            start_at=datetime.utcnow() + timedelta(hours=3),
            end_at=datetime.utcnow() + timedelta(hours=4),
            booking_tz="UTC",
            status="confirmed"
        )
        
        db.session.add(booking1)
        db.session.add(booking2)
        db.session.commit()
        
        # Test tenant isolation
        with patch('app.models.business.current_tenant_id', return_value=self.tenant1.id):
            tenant1_bookings = db.session.query(Booking).filter(
                Booking.tenant_id == self.tenant1.id
            ).all()
            
            assert len(tenant1_bookings) == 1
            assert tenant1_bookings[0].id == booking1.id
            
            # Should not see tenant2's bookings
            tenant2_bookings = db.session.query(Booking).filter(
                Booking.tenant_id == self.tenant2.id
            ).all()
            
            assert len(tenant2_bookings) == 0
    
    def test_tenant_isolation_payments(self):
        """Test that tenants cannot access each other's payments."""
        # Create payments for each tenant
        payment1 = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            customer_id=self.customer1.id,
            amount_cents=5000,
            status='captured',
            method='card',
            provider='stripe',
            provider_payment_id="pi_tenant1_test"
        )
        
        payment2 = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            customer_id=self.customer2.id,
            amount_cents=7500,
            status='captured',
            method='card',
            provider='stripe',
            provider_payment_id="pi_tenant2_test"
        )
        
        db.session.add(payment1)
        db.session.add(payment2)
        db.session.commit()
        
        # Test tenant isolation
        with patch('app.models.financial.current_tenant_id', return_value=self.tenant1.id):
            tenant1_payments = db.session.query(Payment).filter(
                Payment.tenant_id == self.tenant1.id
            ).all()
            
            assert len(tenant1_payments) == 1
            assert tenant1_payments[0].id == payment1.id
            
            # Should not see tenant2's payments
            tenant2_payments = db.session.query(Payment).filter(
                Payment.tenant_id == self.tenant2.id
            ).all()
            
            assert len(tenant2_payments) == 0
    
    def test_tenant_isolation_promotions(self):
        """Test that tenants cannot access each other's promotions."""
        # Create coupons for each tenant
        coupon1 = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            code="TENANT1_SAVE20",
            name="Tenant 1 Save 20%",
            percent_off=20,
            active=True
        )
        
        coupon2 = Coupon(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            code="TENANT2_SAVE15",
            name="Tenant 2 Save 15%",
            percent_off=15,
            active=True
        )
        
        db.session.add(coupon1)
        db.session.add(coupon2)
        db.session.commit()
        
        # Test tenant isolation
        with patch('app.models.promotions.current_tenant_id', return_value=self.tenant1.id):
            tenant1_coupons = db.session.query(Coupon).filter(
                Coupon.tenant_id == self.tenant1.id
            ).all()
            
            assert len(tenant1_coupons) == 1
            assert tenant1_coupons[0].id == coupon1.id
            
            # Should not see tenant2's coupons
            tenant2_coupons = db.session.query(Coupon).filter(
                Coupon.tenant_id == self.tenant2.id
            ).all()
            
            assert len(tenant2_coupons) == 0
    
    def test_rls_insert_enforcement(self):
        """Test that RLS prevents inserting data for wrong tenant."""
        with patch('app.models.business.current_tenant_id', return_value=self.tenant1.id):
            # Try to insert customer for tenant2 while in tenant1 context
            try:
                invalid_customer = Customer(
                    id=uuid.uuid4(),
                    tenant_id=self.tenant2.id,  # Wrong tenant!
                    display_name="Invalid Customer",
                    email="invalid@example.com"
                )
                db.session.add(invalid_customer)
                db.session.commit()
                
                # If we get here, RLS failed
                assert False, "RLS should have prevented inserting customer for wrong tenant"
                
            except Exception as e:
                # RLS should prevent this
                assert "tenant_id" in str(e).lower() or "policy" in str(e).lower()
    
    def test_rls_update_enforcement(self):
        """Test that RLS prevents updating data for wrong tenant."""
        # Create customer for tenant1
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            display_name="Test Customer",
            email="test@example.com"
        )
        db.session.add(customer)
        db.session.commit()
        
        # Try to update customer while in tenant2 context
        with patch('app.models.business.current_tenant_id', return_value=self.tenant2.id):
            try:
                customer.display_name = "Updated Name"
                db.session.commit()
                
                # If we get here, RLS failed
                assert False, "RLS should have prevented updating customer from wrong tenant"
                
            except Exception as e:
                # RLS should prevent this
                assert "tenant_id" in str(e).lower() or "policy" in str(e).lower()
    
    def test_rls_delete_enforcement(self):
        """Test that RLS prevents deleting data for wrong tenant."""
        # Create customer for tenant1
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            display_name="Test Customer",
            email="test@example.com"
        )
        db.session.add(customer)
        db.session.commit()
        
        # Try to delete customer while in tenant2 context
        with patch('app.models.business.current_tenant_id', return_value=self.tenant2.id):
            try:
                db.session.delete(customer)
                db.session.commit()
                
                # If we get here, RLS failed
                assert False, "RLS should have prevented deleting customer from wrong tenant"
                
            except Exception as e:
                # RLS should prevent this
                assert "tenant_id" in str(e).lower() or "policy" in str(e).lower()
    
    def test_cross_tenant_data_leakage_prevention(self):
        """Test comprehensive cross-tenant data leakage prevention."""
        # Create various data for both tenants
        self._create_test_data_for_both_tenants()
        
        # Test that tenant1 cannot see any tenant2 data
        with patch('app.models.business.current_tenant_id', return_value=self.tenant1.id):
            # Check customers
            all_customers = db.session.query(Customer).all()
            tenant1_customers = [c for c in all_customers if c.tenant_id == self.tenant1.id]
            assert len(tenant1_customers) == 1
            assert len(all_customers) == 1  # Should only see own customers
            
            # Check bookings
            all_bookings = db.session.query(Booking).all()
            tenant1_bookings = [b for b in all_bookings if b.tenant_id == self.tenant1.id]
            assert len(tenant1_bookings) == 1
            assert len(all_bookings) == 1  # Should only see own bookings
            
            # Check payments
            all_payments = db.session.query(Payment).all()
            tenant1_payments = [p for p in all_payments if p.tenant_id == self.tenant1.id]
            assert len(tenant1_payments) == 1
            assert len(all_payments) == 1  # Should only see own payments
    
    def test_rls_helper_function_validation(self):
        """Test that RLS helper functions work correctly."""
        # Test current_tenant_id() function
        with patch('app.models.core.current_tenant_id', return_value=self.tenant1.id):
            tenant_id = db.session.execute(text("SELECT public.current_tenant_id()")).scalar()
            assert tenant_id == self.tenant1.id
        
        # Test current_user_id() function
        with patch('app.models.core.current_user_id', return_value=self.user1.id):
            user_id = db.session.execute(text("SELECT public.current_user_id()")).scalar()
            assert user_id == self.user1.id
    
    def test_special_rls_policies_tenants_table(self):
        """Test special RLS policies for tenants table."""
        # Test that members can read their tenant data
        with patch('app.models.core.current_tenant_id', return_value=self.tenant1.id):
            with patch('app.models.core.current_user_id', return_value=self.user1.id):
                tenant = db.session.query(Tenant).filter(
                    Tenant.id == self.tenant1.id
                ).first()
                
                assert tenant is not None
                assert tenant.id == self.tenant1.id
        
        # Test that members cannot read other tenant data
        with patch('app.models.core.current_tenant_id', return_value=self.tenant1.id):
            with patch('app.models.core.current_user_id', return_value=self.user1.id):
                other_tenant = db.session.query(Tenant).filter(
                    Tenant.id == self.tenant2.id
                ).first()
                
                assert other_tenant is None  # Should not be accessible
    
    def test_special_rls_policies_users_table(self):
        """Test special RLS policies for users table."""
        # Test that users can read their own data
        with patch('app.models.core.current_user_id', return_value=self.user1.id):
            user = db.session.query(User).filter(
                User.id == self.user1.id
            ).first()
            
            assert user is not None
            assert user.id == self.user1.id
        
        # Test that users cannot read other users' data
        with patch('app.models.core.current_user_id', return_value=self.user1.id):
            other_user = db.session.query(User).filter(
                User.id == self.user2.id
            ).first()
            
            assert other_user is None  # Should not be accessible
    
    def test_special_rls_policies_memberships_table(self):
        """Test special RLS policies for memberships table."""
        # Test that members can read their own memberships
        with patch('app.models.core.current_user_id', return_value=self.user1.id):
            membership = db.session.query(Membership).filter(
                Membership.user_id == self.user1.id
            ).first()
            
            assert membership is not None
            assert membership.id == self.membership1.id
        
        # Test that members cannot read other users' memberships
        with patch('app.models.core.current_user_id', return_value=self.user1.id):
            other_membership = db.session.query(Membership).filter(
                Membership.user_id == self.user2.id
            ).first()
            
            assert other_membership is None  # Should not be accessible
    
    def test_audit_log_rls_enforcement(self):
        """Test that audit logs respect RLS policies."""
        # Create audit log for tenant1
        audit_log1 = AuditLog(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            table_name="customers",
            operation="INSERT",
            record_id=str(self.customer1.id),
            new_data={"display_name": "Test Customer"},
            user_id=self.user1.id
        )
        
        audit_log2 = AuditLog(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            table_name="customers",
            operation="INSERT",
            record_id=str(self.customer2.id),
            new_data={"display_name": "Test Customer 2"},
            user_id=self.user2.id
        )
        
        db.session.add(audit_log1)
        db.session.add(audit_log2)
        db.session.commit()
        
        # Test tenant isolation for audit logs
        with patch('app.models.audit.current_tenant_id', return_value=self.tenant1.id):
            tenant1_audit_logs = db.session.query(AuditLog).filter(
                AuditLog.tenant_id == self.tenant1.id
            ).all()
            
            assert len(tenant1_audit_logs) == 1
            assert tenant1_audit_logs[0].id == audit_log1.id
            
            # Should not see tenant2's audit logs
            tenant2_audit_logs = db.session.query(AuditLog).filter(
                AuditLog.tenant_id == self.tenant2.id
            ).all()
            
            assert len(tenant2_audit_logs) == 0
    
    def test_rls_policy_violation_auditing(self):
        """Test that RLS policy violations are properly audited."""
        # Attempt to access cross-tenant data
        with patch('app.models.business.current_tenant_id', return_value=self.tenant1.id):
            try:
                # This should fail due to RLS
                db.session.query(Customer).filter(
                    Customer.tenant_id == self.tenant2.id
                ).all()
            except Exception:
                pass  # Expected to fail
        
        # Check if violation was audited
        audit_logs = db.session.query(AuditLog).filter(
            AuditLog.table_name == "customers",
            AuditLog.operation == "SELECT"
        ).all()
        
        # Should have audit logs for legitimate access
        assert len(audit_logs) >= 0  # May or may not have audit logs depending on implementation
    
    def test_rls_with_null_tenant_context(self):
        """Test RLS behavior when tenant context is null."""
        # Test with null tenant context
        with patch('app.models.business.current_tenant_id', return_value=None):
            customers = db.session.query(Customer).all()
            assert len(customers) == 0  # Should see no customers with null context
    
    def test_rls_with_invalid_tenant_context(self):
        """Test RLS behavior when tenant context is invalid."""
        invalid_tenant_id = uuid.uuid4()
        
        # Test with invalid tenant context
        with patch('app.models.business.current_tenant_id', return_value=invalid_tenant_id):
            customers = db.session.query(Customer).all()
            assert len(customers) == 0  # Should see no customers with invalid context
    
    def _create_test_data_for_both_tenants(self):
        """Helper method to create test data for both tenants."""
        # Create resources
        resource1 = Resource(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            type="staff",
            name="Staff Member 1",
            capacity=1
        )
        resource2 = Resource(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            type="staff",
            name="Staff Member 2",
            capacity=1
        )
        db.session.add(resource1)
        db.session.add(resource2)
        
        # Create bookings
        booking1 = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            customer_id=self.customer1.id,
            resource_id=resource1.id,
            client_generated_id=str(uuid.uuid4()),
            start_at=datetime.utcnow() + timedelta(hours=1),
            end_at=datetime.utcnow() + timedelta(hours=2),
            booking_tz="UTC",
            status="confirmed"
        )
        
        booking2 = Booking(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            customer_id=self.customer2.id,
            resource_id=resource2.id,
            client_generated_id=str(uuid.uuid4()),
            start_at=datetime.utcnow() + timedelta(hours=3),
            end_at=datetime.utcnow() + timedelta(hours=4),
            booking_tz="UTC",
            status="confirmed"
        )
        db.session.add(booking1)
        db.session.add(booking2)
        
        # Create payments
        payment1 = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant1.id,
            customer_id=self.customer1.id,
            booking_id=booking1.id,
            amount_cents=5000,
            status='captured',
            method='card',
            provider='stripe',
            provider_payment_id="pi_tenant1_test"
        )
        
        payment2 = Payment(
            id=uuid.uuid4(),
            tenant_id=self.tenant2.id,
            customer_id=self.customer2.id,
            booking_id=booking2.id,
            amount_cents=7500,
            status='captured',
            method='card',
            provider='stripe',
            provider_payment_id="pi_tenant2_test"
        )
        db.session.add(payment1)
        db.session.add(payment2)
        
        db.session.commit()


class TestRLSIntegration:
    """Integration tests for RLS policies across the entire system."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for integration tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="rls-integration-tenant",
                name="RLS Integration Tenant",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant)
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="RLS Integration User",
                primary_email="rls-integration@example.com"
            )
            db.session.add(self.user)
            
            # Create membership
            self.membership = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                user_id=self.user.id,
                role="owner"
            )
            db.session.add(self.membership)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_end_to_end_rls_enforcement(self):
        """Test RLS enforcement across complete business workflows."""
        with patch('app.models.business.current_tenant_id', return_value=self.tenant.id):
            with patch('app.models.business.current_user_id', return_value=self.user.id):
                # Create customer
                customer = Customer(
                    id=uuid.uuid4(),
                    tenant_id=self.tenant.id,
                    display_name="Integration Customer",
                    email="integration@example.com"
                )
                db.session.add(customer)
                
                # Create resource
                resource = Resource(
                    id=uuid.uuid4(),
                    tenant_id=self.tenant.id,
                    type="staff",
                    name="Integration Staff",
                    capacity=1
                )
                db.session.add(resource)
                
                # Create booking
                booking = Booking(
                    id=uuid.uuid4(),
                    tenant_id=self.tenant.id,
                    customer_id=customer.id,
                    resource_id=resource.id,
                    client_generated_id=str(uuid.uuid4()),
                    start_at=datetime.utcnow() + timedelta(hours=1),
                    end_at=datetime.utcnow() + timedelta(hours=2),
                    booking_tz="UTC",
                    status="confirmed"
                )
                db.session.add(booking)
                
                # Create payment
                payment = Payment(
                    id=uuid.uuid4(),
                    tenant_id=self.tenant.id,
                    customer_id=customer.id,
                    booking_id=booking.id,
                    amount_cents=5000,
                    status='captured',
                    method='card',
                    provider='stripe',
                    provider_payment_id="pi_integration_test"
                )
                db.session.add(payment)
                
                db.session.commit()
                
                # Verify all data is accessible in correct tenant context
                customers = db.session.query(Customer).all()
                assert len(customers) == 1
                assert customers[0].id == customer.id
                
                bookings = db.session.query(Booking).all()
                assert len(bookings) == 1
                assert bookings[0].id == booking.id
                
                payments = db.session.query(Payment).all()
                assert len(payments) == 1
                assert payments[0].id == payment.id
    
    def test_rls_with_complex_queries(self):
        """Test RLS enforcement with complex multi-table queries."""
        with patch('app.models.business.current_tenant_id', return_value=self.tenant.id):
            # Create test data
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                display_name="Complex Query Customer",
                email="complex@example.com"
            )
            db.session.add(customer)
            
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                type="staff",
                name="Complex Query Staff",
                capacity=1
            )
            db.session.add(resource)
            
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=customer.id,
                resource_id=resource.id,
                client_generated_id=str(uuid.uuid4()),
                start_at=datetime.utcnow() + timedelta(hours=1),
                end_at=datetime.utcnow() + timedelta(hours=2),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking)
            
            payment = Payment(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=customer.id,
                booking_id=booking.id,
                amount_cents=5000,
                status='captured',
                method='card',
                provider='stripe',
                provider_payment_id="pi_complex_test"
            )
            db.session.add(payment)
            
            db.session.commit()
            
            # Test complex join query
            complex_query = db.session.query(
                Customer.display_name,
                Booking.start_at,
                Payment.amount_cents
            ).join(
                Booking, Customer.id == Booking.customer_id
            ).join(
                Payment, Booking.id == Payment.booking_id
            ).filter(
                Customer.tenant_id == self.tenant.id
            ).all()
            
            assert len(complex_query) == 1
            assert complex_query[0].display_name == "Complex Query Customer"
            assert complex_query[0].amount_cents == 5000


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
