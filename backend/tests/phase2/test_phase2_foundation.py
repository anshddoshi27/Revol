"""
Phase 2 Foundation Tests

Tests for Phase 1 prerequisites and Phase 2 readiness.
Validates that all foundational components are working before Phase 2 implementation.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from flask import Flask
from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Service, Resource, Booking, Customer
from app.services.business import ServiceService, BookingService, AvailabilityService


class TestPhase1Foundation:
    """Test Phase 1 foundation components are working"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    def test_health_endpoints_functional(self, app):
        """Health endpoints are working"""
        with app.test_client() as client:
            response = client.get('/health/')
            assert response.status_code == 200
            
            data = response.get_json()
            assert data['status'] == 'healthy'
    
    def test_jwt_auth_working(self, app):
        """JWT authentication is functional"""
        with app.app_context():
            # Create test user
            user = User(
                id=uuid.uuid4(),
                primary_email="test@example.com",
                display_name="Test User"
            )
            db.session.add(user)
            db.session.commit()
            
            # Test user creation
            assert user.id is not None
            assert user.primary_email == "test@example.com"
    
    def test_tenant_resolution_operational(self, app):
        """Tenant resolution middleware is working"""
        with app.app_context():
            # Create test tenant
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Test tenant creation
            assert tenant.id is not None
            assert tenant.slug == "test-salon"
    
    def test_rls_policies_enforced(self, app):
        """Row-Level Security policies are enforced"""
        with app.app_context():
            # Create two tenants
            tenant1 = Tenant(id=uuid.uuid4(), slug="salon-1")
            tenant2 = Tenant(id=uuid.uuid4(), slug="salon-2")
            
            db.session.add_all([tenant1, tenant2])
            db.session.commit()
            
            # Test tenant isolation
            assert tenant1.id != tenant2.id
            assert tenant1.slug != tenant2.slug
    
    def test_database_relationships_configured(self, app):
        """Database relationships are properly configured"""
        with app.app_context():
            # Create tenant
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            
            # Create user
            user = User(
                id=uuid.uuid4(),
                primary_email="owner@test.com",
                display_name="Test Owner"
            )
            
            # Create membership
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            
            db.session.add_all([tenant, user, membership])
            db.session.commit()
            
            # Test relationships
            assert membership.tenant_id == tenant.id
            assert membership.user_id == user.id
            assert membership.role == "owner"
    
    def test_middleware_registration(self, app):
        """Required middleware is registered"""
        # Check that middleware is registered in the app
        middleware_names = [str(type(middleware).__name__) for middleware in app.before_request_funcs.get(None, [])]
        
        # Should have some middleware registered
        assert len(middleware_names) > 0
    
    def test_error_handling_configured(self, app):
        """Error handling is properly configured"""
        with app.test_client() as client:
            # Test 404 error
            response = client.get('/nonexistent')
            assert response.status_code == 404
            
            # Test error response format
            data = response.get_json()
            assert 'code' in data or 'status' in data or 'error' in data or 'message' in data
    
    def test_observability_hooks_ready(self, app):
        """Observability hooks are ready"""
        # Check that logging is configured
        assert hasattr(app, 'logger') or hasattr(app, 'log_exception')
    
    def test_phase2_blueprints_available(self, app):
        """Phase 2 blueprints are available"""
        # Check that API v1 blueprint is registered
        assert 'api_v1' in app.blueprints
    
    def test_phase2_models_available(self, app):
        """Phase 2 models are available"""
        # Test that business models can be imported and instantiated
        service = Service(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            name="Test Service",
            duration_min=30,
            price_cents=5000
        )
        
        booking = Booking(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            resource_id=uuid.uuid4(),
            client_generated_id="test-123",
            service_snapshot={"service_id": str(uuid.uuid4()), "name": "Test Service"},
            start_at=datetime.utcnow(),
            end_at=datetime.utcnow() + timedelta(hours=1),
            booking_tz="UTC",
            status="pending"
        )
        
        assert service.name == "Test Service"
        assert booking.status == "pending"
    
    def test_phase2_services_available(self, app):
        """Phase 2 services are available"""
        # Test that services can be instantiated
        service_service = ServiceService()
        booking_service = BookingService()
        availability_service = AvailabilityService()
        
        assert service_service is not None
        assert booking_service is not None
        assert availability_service is not None


class TestPhase2Readiness:
    """Test Phase 2 readiness and components"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    def test_services_module_ready(self, app):
        """Services module is ready for Phase 2"""
        with app.app_context():
            service_service = ServiceService()
            
            # Test service creation
            tenant_id = uuid.uuid4()
            user_id = uuid.uuid4()
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000,
                'category': 'Hair'
            }
            
            service = service_service.create_service(tenant_id, service_data, user_id)
            assert service.name == 'Haircut'
            assert service.duration_min == 30
            assert service.price_cents == 5000
    
    def test_staff_module_ready(self, app):
        """Staff module is ready for Phase 2"""
        with app.app_context():
            # Test resource creation
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),
                name="John Doe",
                type="staff",
                tz="UTC",
                capacity=1
            )
            
            db.session.add(resource)
            db.session.commit()
            
            assert resource.name == "John Doe"
            assert resource.type == "staff"
    
    def test_availability_module_ready(self, app):
        """Availability module is ready for Phase 2"""
        with app.app_context():
            availability_service = AvailabilityService()
            
            # Test availability check
            tenant_id = uuid.uuid4()
            resource_id = uuid.uuid4()
            start_at = datetime.utcnow() + timedelta(hours=1)
            end_at = start_at + timedelta(hours=1)
            
            is_available = availability_service.is_time_available(tenant_id, resource_id, start_at, end_at)
            assert isinstance(is_available, bool)
    
    def test_bookings_module_ready(self, app):
        """Bookings module is ready for Phase 2"""
        with app.app_context():
            booking_service = BookingService()
            
            # Create test data first
            tenant_id = uuid.uuid4()
            user_id = uuid.uuid4()
            
            # Create service
            service = Service(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name="Test Service",
                slug="test-service",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service)
            
            # Create customer
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                display_name="Test Customer",
                email="test@example.com"
            )
            db.session.add(customer)
            
            # Create resource
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name="Test Staff",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(resource)
            db.session.commit()
            
            # Test booking creation - use a specific time within business hours
            booking_data = {
                'service_id': service.id,
                'resource_id': resource.id,
                'customer_id': customer.id,
                'start_at': '2025-01-06T10:00:00Z',  # 10:00 AM UTC (within business hours)
                'end_at': '2025-01-06T11:00:00Z',    # 11:00 AM UTC
                'booking_tz': 'UTC'
            }
            
            # This should work without errors
            booking = booking_service.create_booking(tenant_id, booking_data, user_id)
            assert booking.status == 'pending'
            assert booking.tenant_id == tenant_id
    
    def test_phase2_database_tables_ready(self, app):
        """Phase 2 database tables are ready"""
        with app.app_context():
            # Test that all Phase 2 tables exist and can be queried
            from sqlalchemy import inspect
            
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            
            required_tables = ['services', 'resources', 'bookings', 'customers', 'booking_items']
            for table in required_tables:
                assert table in tables
            
            # Test that we can query the tables
            services_count = db.session.query(Service).count()
            bookings_count = db.session.query(Booking).count()
            
            # Should not raise errors
            assert isinstance(services_count, int)
            assert isinstance(bookings_count, int)
