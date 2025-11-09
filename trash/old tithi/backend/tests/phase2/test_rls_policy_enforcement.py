"""
Phase 2 RLS Policy Enforcement Tests

Comprehensive tests for Row Level Security (RLS) policy enforcement
across all Phase 2 modules to ensure complete tenant isolation.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch

from app import create_app, db
from app.models import Tenant, User, Membership, Service, Resource, Booking, Customer, StaffProfile, WorkSchedule
from app.models.core import TenantModel
from app.middleware.auth_middleware import get_current_user, get_current_tenant


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
def test_tenant_a():
    """Create test tenant A."""
    tenant = Tenant(
        id=uuid.uuid4(),
        slug="tenant-a",
        tz="UTC",
        is_public_directory=True,
        public_blurb="Test Tenant A"
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_tenant_b():
    """Create test tenant B."""
    tenant = Tenant(
        id=uuid.uuid4(),
        slug="tenant-b", 
        tz="UTC",
        is_public_directory=True,
        public_blurb="Test Tenant B"
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user():
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name="Test User",
        primary_email="test@example.com"
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def test_membership_a(test_tenant_a, test_user):
    """Create membership for tenant A."""
    membership = Membership(
        id=uuid.uuid4(),
        tenant_id=test_tenant_a.id,
        user_id=test_user.id,
        role="owner"
    )
    db.session.add(membership)
    db.session.commit()
    return membership


@pytest.fixture
def test_membership_b(test_tenant_b, test_user):
    """Create membership for tenant B."""
    membership = Membership(
        id=uuid.uuid4(),
        tenant_id=test_tenant_b.id,
        user_id=test_user.id,
        role="owner"
    )
    db.session.add(membership)
    db.session.commit()
    return membership


class TestRLSPolicyEnforcement:
    """Test RLS policy enforcement across all Phase 2 modules."""

    def test_tenant_isolation_services(self, app, test_tenant_a, test_tenant_b, test_user):
        """Test that services are properly isolated between tenants."""
        with app.app_context():
            # Create service for tenant A
            service_a = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                slug="service-a",
                name="Service A",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service_a)
            
            # Create service for tenant B
            service_b = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant_b.id,
                slug="service-b",
                name="Service B", 
                duration_min=60,
                price_cents=10000
            )
            db.session.add(service_b)
            db.session.commit()
            
            # Test tenant A can only see their services
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_a.id):
                services_a = Service.query.filter_by(tenant_id=test_tenant_a.id).all()
                assert len(services_a) == 1
                assert services_a[0].name == "Service A"
                
                # Verify tenant A cannot see tenant B's services
                services_b = Service.query.filter_by(tenant_id=test_tenant_b.id).all()
                assert len(services_b) == 0  # RLS should prevent this
            
            # Test tenant B can only see their services
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_b.id):
                services_b = Service.query.filter_by(tenant_id=test_tenant_b.id).all()
                assert len(services_b) == 1
                assert services_b[0].name == "Service B"
                
                # Verify tenant B cannot see tenant A's services
                services_a = Service.query.filter_by(tenant_id=test_tenant_a.id).all()
                assert len(services_a) == 0  # RLS should prevent this

    def test_tenant_isolation_bookings(self, app, test_tenant_a, test_tenant_b, test_user):
        """Test that bookings are properly isolated between tenants."""
        with app.app_context():
            # Create customer for tenant A
            customer_a = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                display_name="Customer A",
                email="customer-a@example.com"
            )
            db.session.add(customer_a)
            
            # Create customer for tenant B
            customer_b = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant_b.id,
                display_name="Customer B",
                email="customer-b@example.com"
            )
            db.session.add(customer_b)
            
            # Create resource for tenant A
            resource_a = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                name="Resource A",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource_a)
            
            # Create resource for tenant B
            resource_b = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant_b.id,
                name="Resource B",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource_b)
            
            # Create booking for tenant A
            booking_a = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                customer_id=customer_a.id,
                resource_id=resource_a.id,
                client_generated_id="booking-a-123",
                service_snapshot={"name": "Service A"},
                start_at=datetime.utcnow() + timedelta(hours=1),
                end_at=datetime.utcnow() + timedelta(hours=2),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking_a)
            
            # Create booking for tenant B
            booking_b = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant_b.id,
                customer_id=customer_b.id,
                resource_id=resource_b.id,
                client_generated_id="booking-b-123",
                service_snapshot={"name": "Service B"},
                start_at=datetime.utcnow() + timedelta(hours=3),
                end_at=datetime.utcnow() + timedelta(hours=4),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking_b)
            db.session.commit()
            
            # Test tenant A can only see their bookings
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_a.id):
                bookings_a = Booking.query.filter_by(tenant_id=test_tenant_a.id).all()
                assert len(bookings_a) == 1
                assert bookings_a[0].client_generated_id == "booking-a-123"
                
                # Verify tenant A cannot see tenant B's bookings
                bookings_b = Booking.query.filter_by(tenant_id=test_tenant_b.id).all()
                assert len(bookings_b) == 0  # RLS should prevent this

    def test_tenant_isolation_staff_profiles(self, app, test_tenant_a, test_tenant_b, test_user, test_membership_a, test_membership_b):
        """Test that staff profiles are properly isolated between tenants."""
        with app.app_context():
            # Create resource for tenant A
            resource_a = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                name="Staff A",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource_a)
            
            # Create resource for tenant B
            resource_b = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant_b.id,
                name="Staff B",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource_b)
            
            # Create staff profile for tenant A
            staff_a = StaffProfile(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                membership_id=test_membership_a.id,
                resource_id=resource_a.id,
                display_name="Staff Member A",
                specialties=["haircut", "styling"],
                hourly_rate_cents=5000
            )
            db.session.add(staff_a)
            
            # Create staff profile for tenant B
            staff_b = StaffProfile(
                id=uuid.uuid4(),
                tenant_id=test_tenant_b.id,
                membership_id=test_membership_b.id,
                resource_id=resource_b.id,
                display_name="Staff Member B",
                specialties=["massage", "therapy"],
                hourly_rate_cents=8000
            )
            db.session.add(staff_b)
            db.session.commit()
            
            # Test tenant A can only see their staff profiles
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_a.id):
                staff_profiles_a = StaffProfile.query.filter_by(tenant_id=test_tenant_a.id).all()
                assert len(staff_profiles_a) == 1
                assert staff_profiles_a[0].display_name == "Staff Member A"
                
                # Verify tenant A cannot see tenant B's staff profiles
                staff_profiles_b = StaffProfile.query.filter_by(tenant_id=test_tenant_b.id).all()
                assert len(staff_profiles_b) == 0  # RLS should prevent this

    def test_cross_tenant_data_access_prevention(self, app, test_tenant_a, test_tenant_b):
        """Test that cross-tenant data access is prevented at the database level."""
        with app.app_context():
            # Create service for tenant A
            service_a = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                slug="service-a",
                name="Service A",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service_a)
            db.session.commit()
            
            # Attempt to access tenant A's service with tenant B context
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_b.id):
                # This should return empty due to RLS
                services = Service.query.filter_by(id=service_a.id).all()
                assert len(services) == 0  # RLS should prevent access
                
                # Direct query with tenant B context should not return tenant A's data
                services = Service.query.filter_by(tenant_id=test_tenant_a.id).all()
                assert len(services) == 0  # RLS should prevent access

    def test_rls_policy_consistency(self, app, test_tenant_a, test_tenant_b):
        """Test that RLS policies are consistently applied across all tenant-scoped tables."""
        with app.app_context():
            # Create data for both tenants
            service_a = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                slug="service-a",
                name="Service A",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service_a)
            
            customer_a = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                display_name="Customer A",
                email="customer-a@example.com"
            )
            db.session.add(customer_a)
            
            resource_a = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                name="Resource A",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource_a)
            db.session.commit()
            
            # Test with tenant B context - should see no data
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_b.id):
                # All queries should return empty due to RLS
                services = Service.query.all()
                customers = Customer.query.all()
                resources = Resource.query.all()
                
                assert len(services) == 0
                assert len(customers) == 0
                assert len(resources) == 0

    def test_rls_policy_with_invalid_tenant_context(self, app):
        """Test RLS behavior when no valid tenant context is provided."""
        with app.app_context():
            # Create service without tenant context
            service = Service(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),  # Random tenant ID
                slug="service",
                name="Service",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service)
            db.session.commit()
            
            # Test with no tenant context
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=None):
                services = Service.query.all()
                assert len(services) == 0  # RLS should prevent access

    def test_rls_policy_with_malformed_tenant_id(self, app):
        """Test RLS behavior with malformed tenant ID."""
        with app.app_context():
            # Test with invalid tenant ID format
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value="invalid-uuid"):
                services = Service.query.all()
                assert len(services) == 0  # RLS should prevent access

    def test_tenant_model_inheritance_rls(self, app, test_tenant_a, test_tenant_b):
        """Test that all TenantModel subclasses properly inherit RLS behavior."""
        with app.app_context():
            # Create instances of all TenantModel subclasses for tenant A
            service = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                slug="service",
                name="Service",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service)
            
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                display_name="Customer",
                email="customer@example.com"
            )
            db.session.add(customer)
            
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=test_tenant_a.id,
                name="Resource",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource)
            db.session.commit()
            
            # Test with tenant B context - should see no data from any TenantModel subclass
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_b.id):
                # Test all TenantModel subclasses
                tenant_model_classes = [Service, Customer, Resource, Booking, StaffProfile, WorkSchedule]
                
                for model_class in tenant_model_classes:
                    if hasattr(model_class, '__tablename__'):
                        records = model_class.query.all()
                        assert len(records) == 0, f"RLS failed for {model_class.__name__}"


class TestRLSPolicyPerformance:
    """Test RLS policy performance and efficiency."""

    def test_rls_query_performance(self, app, test_tenant_a):
        """Test that RLS policies don't significantly impact query performance."""
        with app.app_context():
            # Create multiple services for tenant A
            services = []
            for i in range(100):
                service = Service(
                    id=uuid.uuid4(),
                    tenant_id=test_tenant_a.id,
                    slug=f"service-{i}",
                    name=f"Service {i}",
                    duration_min=30,
                    price_cents=5000
                )
                services.append(service)
                db.session.add(service)
            db.session.commit()
            
            # Test query performance with RLS
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_a.id):
                import time
                start_time = time.time()
                
                # Execute multiple queries
                for _ in range(10):
                    services = Service.query.filter_by(tenant_id=test_tenant_a.id).all()
                    assert len(services) == 100
                
                end_time = time.time()
                execution_time = end_time - start_time
                
                # Should complete within reasonable time (adjust threshold as needed)
                assert execution_time < 1.0  # 1 second for 10 queries with 100 records each

    def test_rls_memory_usage(self, app, test_tenant_a):
        """Test that RLS policies don't cause excessive memory usage."""
        with app.app_context():
            # Create large dataset
            services = []
            for i in range(1000):
                service = Service(
                    id=uuid.uuid4(),
                    tenant_id=test_tenant_a.id,
                    slug=f"service-{i}",
                    name=f"Service {i}",
                    duration_min=30,
                    price_cents=5000
                )
                services.append(service)
                db.session.add(service)
            db.session.commit()
            
            # Test memory usage with RLS
            with patch('app.middleware.auth_middleware.get_current_tenant', return_value=test_tenant_a.id):
                import psutil
                import os
                
                process = psutil.Process(os.getpid())
                memory_before = process.memory_info().rss
                
                # Execute queries
                services = Service.query.filter_by(tenant_id=test_tenant_a.id).all()
                assert len(services) == 1000
                
                memory_after = process.memory_info().rss
                memory_used = memory_after - memory_before
                
                # Memory usage should be reasonable (adjust threshold as needed)
                assert memory_used < 50 * 1024 * 1024  # 50MB
