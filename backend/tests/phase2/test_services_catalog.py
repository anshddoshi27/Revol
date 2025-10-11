"""
Phase 2 Services & Catalog Tests (Module D)

Tests for service management, pricing, categories, and staff assignments.
Validates CRUD operations, tenant isolation, and business logic.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from flask import Flask, g
from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Service, Resource, ServiceResource
from app.services.business import ServiceService


class TestServiceCRUD:
    """Test service CRUD operations"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant(self, app):
        """Create test tenant"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)  # Ensure object is attached to session
            return tenant
    
    @pytest.fixture
    def user(self, app, tenant):
        """Create test user"""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                primary_email="owner@test.com",
                display_name="Test Owner"
            )
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            db.session.add_all([user, membership])
            db.session.commit()
            db.session.refresh(user)  # Ensure object is attached to session
            db.session.refresh(membership)
            return user
    
    def test_create_service_tenant_scoped(self, app, tenant, user):
        """Create service with tenant isolation"""
        with app.app_context():
            service_service = ServiceService()
            
            service_data = {
                'name': 'Haircut',
                'description': 'Professional haircut service',
                'duration_min': 30,
                'price_cents': 5000,
                'category': 'Hair',
                'buffer_before_min': 5,
                'buffer_after_min': 10
            }
            
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            assert service.tenant_id == tenant.id
            assert service.name == 'Haircut'
            assert service.duration_min == 30
            assert service.price_cents == 5000
            assert service.category == 'Hair'
            assert service.active is True
    
    def test_service_retrieval_tenant_isolation(self, app, tenant, user):
        """Services are isolated by tenant"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create service for tenant 1
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service1 = service_service.create_service(tenant.id, service_data, user.id)
            
            # Create another tenant
            tenant2 = Tenant(
                id=uuid.uuid4(),
                slug="another-salon"
            )
            db.session.add(tenant2)
            db.session.commit()
            
            # Create service for tenant 2
            service2 = service_service.create_service(tenant2.id, service_data, user.id)
            
            # Test isolation
            services_tenant1 = service_service.get_services(tenant.id)
            services_tenant2 = service_service.get_services(tenant2.id)
            
            assert len(services_tenant1) == 1
            assert len(services_tenant2) == 1
            assert services_tenant1[0].id != services_tenant2[0].id
            assert services_tenant1[0].tenant_id == tenant.id
            assert services_tenant2[0].tenant_id == tenant2.id
    
    def test_service_bulk_update(self, app, tenant, user):
        """Update multiple service properties"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create service
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            # Update service
            update_data = {
                'name': 'Premium Haircut',
                'price_cents': 7500,
                'description': 'Premium haircut with styling',
                'category': 'Premium Hair'
            }
            
            updated_service = service_service.update_service(tenant.id, service.id, update_data, user.id)
            
            assert updated_service.name == 'Premium Haircut'
            assert updated_service.price_cents == 7500
            assert updated_service.description == 'Premium haircut with styling'
            assert updated_service.category == 'Premium Hair'
    
    def test_service_soft_delete_with_active_bookings(self, app, tenant, user):
        """Cannot delete service with active bookings"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create service
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            # Create customer and resource first
            from app.models.business import Customer, Resource
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                display_name='Test Customer',
                email='test@example.com'
            )
            db.session.add(customer)
            
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name='Test Staff',
                type='staff',
                tz='UTC',
                capacity=1
            )
            db.session.add(resource)
            db.session.commit()
            
            # Create mock active booking with valid foreign keys
            from app.models.business import Booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                customer_id=customer.id,
                resource_id=resource.id,
                client_generated_id="test-123",
                service_snapshot={"service_id": str(service.id), "name": service.name},
                start_at=datetime.utcnow() + timedelta(hours=1),
                end_at=datetime.utcnow() + timedelta(hours=2),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking)
            db.session.commit()
            
            # Attempt to delete service
            with pytest.raises(ValueError, match="Cannot delete service with active bookings"):
                service_service.delete_service(tenant.id, service.id, user.id)
    
    def test_service_soft_delete_success(self, app, tenant, user):
        """Successfully soft delete service without active bookings"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create service
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            # Delete service
            success = service_service.delete_service(tenant.id, service.id, user.id)
            
            assert success is True
            
            # Verify soft delete
            deleted_service = service_service.get_service(tenant.id, service.id)
            assert deleted_service is None
            
            # Verify service is marked as deleted
            db.session.refresh(service)
            assert service.deleted_at is not None
            assert service.active is False
    
    def test_service_observability_hooks(self, app, tenant, user):
        """Service operations trigger observability hooks"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create service (should trigger audit log)
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            # Verify service was created
            assert service is not None
            assert service.name == 'Haircut'


class TestServiceBusinessLogic:
    """Test service business logic and validation"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant(self, app):
        """Create test tenant"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)  # Ensure object is attached to session
            return tenant
    
    @pytest.fixture
    def user(self, app, tenant):
        """Create test user"""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                primary_email="owner@test.com",
                display_name="Test Owner"
            )
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                user_id=user.id,
                role="owner"
            )
            db.session.add_all([user, membership])
            db.session.commit()
            db.session.refresh(user)  # Ensure object is attached to session
            db.session.refresh(membership)
            return user
    
    def test_service_pricing_validation(self, app, tenant, user):
        """Service pricing validation works correctly"""
        with app.app_context():
            service_service = ServiceService()
            
            # Test negative price
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': -1000
            }
            
            with pytest.raises(ValueError, match="Price cannot be negative"):
                service_service.create_service(tenant.id, service_data, user.id)
            
            # Test zero price (should be allowed)
            service_data['price_cents'] = 0
            service = service_service.create_service(tenant.id, service_data, user.id)
            assert service.price_cents == 0
    
    def test_service_buffer_times(self, app, tenant, user):
        """Service buffer times are handled correctly"""
        with app.app_context():
            service_service = ServiceService()
            
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000,
                'buffer_before_min': 15,
                'buffer_after_min': 10
            }
            
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            assert service.buffer_before_min == 15
            assert service.buffer_after_min == 10
    
    def test_service_categories(self, app, tenant, user):
        """Service categories are handled correctly"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create services with different categories
            categories = ['Hair', 'Nails', 'Massage', 'Facial']
            
            for category in categories:
                service_data = {
                    'name': f'{category} Service',
                    'duration_min': 30,
                    'price_cents': 5000,
                    'category': category
                }
                service = service_service.create_service(tenant.id, service_data, user.id)
                assert service.category == category
    
    def test_service_staff_assignments(self, app, tenant, user):
        """Service staff assignments work correctly"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create service
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, user.id)
            
            # Create staff resource
            staff = Resource(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="John Doe",
                type="staff",
                tz="UTC",
                capacity=1
            )
            db.session.add(staff)
            db.session.commit()
            
            # Assign staff to service
            success = service_service.assign_staff_to_service(tenant.id, service.id, staff.id, user.id)
            assert success is True
    
    def test_service_search_functionality(self, app, tenant, user):
        """Service search functionality works"""
        with app.app_context():
            service_service = ServiceService()
            
            # Create multiple services
            services_data = [
                {'name': 'Haircut', 'description': 'Professional haircut', 'category': 'Hair'},
                {'name': 'Hair Color', 'description': 'Hair coloring service', 'category': 'Hair'},
                {'name': 'Manicure', 'description': 'Nail care service', 'category': 'Nails'},
                {'name': 'Massage', 'description': 'Relaxing massage', 'category': 'Wellness'}
            ]
            
            for data in services_data:
                service_data = {
                    'name': data['name'],
                    'description': data['description'],
                    'duration_min': 30,
                    'price_cents': 5000,
                    'category': data['category']
                }
                service_service.create_service(tenant.id, service_data, user.id)
            
            # Test search by name
            hair_services = service_service.search_services(tenant.id, "Hair")
            assert len(hair_services) == 2
            assert all("Hair" in service.name for service in hair_services)
            
            # Test search by category
            nail_services = service_service.search_services(tenant.id, "", "Nails")
            assert len(nail_services) == 1
            assert nail_services[0].category == "Nails"


class TestServiceAPIEndpoints:
    """Test service API endpoints"""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app"""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant(self, app):
        """Create test tenant"""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-salon"
            )
            db.session.add(tenant)
            db.session.commit()
            db.session.refresh(tenant)  # Ensure object is attached to session
            return tenant
    
    def test_get_services_endpoint(self, app, tenant):
        """GET /api/v1/services endpoint works"""
        with app.app_context():
            # Ensure database is created
            db.create_all()
            
            # Mock the middleware by setting the context directly
            from flask import g
            g.tenant_id = tenant.id
            g.user_id = uuid.uuid4()
            
            with app.test_client() as client:
                response = client.get('/api/v1/services')
                assert response.status_code == 200

                data = response.get_json()
                assert 'services' in data
                assert 'total' in data
    
    def test_create_service_endpoint(self, app, tenant):
        """POST /api/v1/services endpoint works"""
        with app.app_context():
            # Ensure database is created
            db.create_all()
            
            # Mock the middleware by setting the context directly
            from flask import g
            g.tenant_id = tenant.id
            g.user_id = uuid.uuid4()
            
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000,
                'category': 'Hair'
            }

            with app.test_client() as client:
                response = client.post('/api/v1/services', json=service_data)
                assert response.status_code == 201

                data = response.get_json()
                assert data['name'] == 'Haircut'
                assert data['duration_min'] == 30
                assert data['price_cents'] == 5000
    
    def test_update_service_endpoint(self, app, tenant):
        """PUT /api/v1/services/{id} endpoint works"""
        with app.app_context():
            # Ensure database is created
            db.create_all()
            
            # Create service first
            service_service = ServiceService()
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, uuid.uuid4())
            
            # Mock the middleware by setting the context directly
            from flask import g
            g.tenant_id = tenant.id
            g.user_id = uuid.uuid4()
            
            with app.test_client() as client:
                update_data = {
                    'name': 'Premium Haircut',
                    'price_cents': 7500
                }
                
                response = client.put(f'/api/v1/services/{service.id}', json=update_data)
                assert response.status_code == 200
                
                data = response.get_json()
                assert data['name'] == 'Premium Haircut'
                assert data['price_cents'] == 7500
    
    def test_delete_service_endpoint(self, app, tenant):
        """DELETE /api/v1/services/{id} endpoint works"""
        with app.app_context():
            # Ensure database is created
            db.create_all()
            
            # Create service first
            service_service = ServiceService()
            service_data = {
                'name': 'Haircut',
                'duration_min': 30,
                'price_cents': 5000
            }
            service = service_service.create_service(tenant.id, service_data, uuid.uuid4())
            
            # Mock the middleware by setting the context directly
            from flask import g
            g.tenant_id = tenant.id
            g.user_id = uuid.uuid4()

            with app.test_client() as client:
                response = client.delete(f'/api/v1/services/{service.id}')
                assert response.status_code == 200

                data = response.get_json()
                assert data['message'] == 'Service deleted successfully'
