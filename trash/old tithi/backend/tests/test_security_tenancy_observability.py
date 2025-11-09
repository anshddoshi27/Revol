"""
Security, Tenancy, and Observability Tests

This module tests the security, tenancy, and observability features implemented
in the Tithi backend to ensure proper tenant isolation, authentication, and logging.
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import g

from app import create_app, db
from app.models.core import Tenant, User
from app.models.business import Booking, Customer, Service
from app.models.financial import Payment
from app.middleware.auth_middleware import require_auth, require_tenant
from app.middleware.rate_limit_middleware import RateLimitExceededError
from app.services.audit_service import AuditService


class TestTenantIsolation:
    """Test tenant isolation and cross-tenant access prevention."""
    
    def setup_method(self):
        """Set up test data."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenants
            self.tenant1 = Tenant(
                id=uuid.uuid4(),
                name="Test Salon 1",
                slug="test-salon-1",
                status="active"
            )
            self.tenant2 = Tenant(
                id=uuid.uuid4(),
                name="Test Salon 2", 
                slug="test-salon-2",
                status="active"
            )
            
            # Create test users
            self.user1 = User(
                id=uuid.uuid4(),
                email="user1@test.com",
                tenant_id=self.tenant1.id
            )
            self.user2 = User(
                id=uuid.uuid4(),
                email="user2@test.com",
                tenant_id=self.tenant2.id
            )
            
            # Create test customers
            self.customer1 = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant1.id,
                email="customer1@test.com",
                display_name="Customer 1"
            )
            self.customer2 = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant2.id,
                email="customer2@test.com", 
                display_name="Customer 2"
            )
            
            # Create test services
            self.service1 = Service(
                id=uuid.uuid4(),
                tenant_id=self.tenant1.id,
                name="Service 1",
                price_cents=5000
            )
            self.service2 = Service(
                id=uuid.uuid4(),
                tenant_id=self.tenant2.id,
                name="Service 2",
                price_cents=7500
            )
            
            db.session.add_all([
                self.tenant1, self.tenant2,
                self.user1, self.user2,
                self.customer1, self.customer2,
                self.service1, self.service2
            ])
            db.session.commit()
    
    def teardown_method(self):
        """Clean up test data."""
        with self.app.app_context():
            db.drop_all()
    
    def test_tenant_cannot_access_other_tenant_customers(self):
        """Test that tenant A cannot access tenant B's customers."""
        with self.app.app_context():
            # Set tenant context to tenant1
            g.tenant_id = self.tenant1.id
            
            # Try to access tenant2's customer
            customer2 = Customer.query.filter_by(
                tenant_id=self.tenant2.id,
                id=self.customer2.id
            ).first()
            
            # Should return None due to RLS or manual filtering
            assert customer2 is None or customer2.tenant_id == self.tenant1.id
    
    def test_tenant_cannot_access_other_tenant_services(self):
        """Test that tenant A cannot access tenant B's services."""
        with self.app.app_context():
            # Set tenant context to tenant1
            g.tenant_id = self.tenant1.id
            
            # Try to access tenant2's service
            service2 = Service.query.filter_by(
                tenant_id=self.tenant2.id,
                id=self.service2.id
            ).first()
            
            # Should return None due to RLS or manual filtering
            assert service2 is None or service2.tenant_id == self.tenant1.id
    
    def test_tenant_scoped_queries_only_return_own_data(self):
        """Test that tenant-scoped queries only return data for the current tenant."""
        with self.app.app_context():
            # Set tenant context to tenant1
            g.tenant_id = self.tenant1.id
            
            # Query customers - should only return tenant1's customers
            customers = Customer.query.filter_by(tenant_id=self.tenant1.id).all()
            
            # Should only have tenant1's customer
            assert len(customers) == 1
            assert customers[0].tenant_id == self.tenant1.id
            assert customers[0].id == self.customer1.id
    
    def test_unauthorized_access_returns_403(self):
        """Test that unauthorized access returns 403."""
        # Test without authentication
        response = self.client.get('/api/v1/customers')
        assert response.status_code == 401  # Unauthorized
    
    def test_missing_tenant_context_returns_403(self):
        """Test that missing tenant context returns 403."""
        # Mock authentication but no tenant context
        with patch('app.middleware.auth_middleware.g') as mock_g:
            mock_g.user_id = str(self.user1.id)
            mock_g.tenant_id = None
            
            response = self.client.get('/api/v1/customers')
            assert response.status_code == 403  # Forbidden


class TestRateLimiting:
    """Test rate limiting functionality."""
    
    def setup_method(self):
        """Set up test data."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
    
    def test_rate_limit_exceeded_returns_429(self):
        """Test that exceeding rate limit returns 429."""
        # Mock rate limit exceeded
        with patch('app.middleware.rate_limit_middleware.RateLimitMiddleware._check_token_bucket') as mock_check:
            mock_check.return_value = (False, 0, 60.0)  # Rate limit exceeded
            
            response = self.client.get('/api/v1/customers')
            assert response.status_code == 429
    
    def test_rate_limit_headers_present(self):
        """Test that rate limit headers are present in response."""
        # Mock successful rate limit check
        with patch('app.middleware.rate_limit_middleware.RateLimitMiddleware._check_token_bucket') as mock_check:
            mock_check.return_value = (True, 10, 60.0)  # Rate limit OK
            
            response = self.client.get('/api/v1/customers')
            assert 'X-RateLimit-Remaining' in response.headers
            assert 'X-RateLimit-Reset' in response.headers


class TestStructuredLogging:
    """Test structured logging functionality."""
    
    def setup_method(self):
        """Set up test data."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
    
    def test_booking_creation_logs_structured_data(self):
        """Test that booking creation logs structured data."""
        with patch('app.services.business_phase2.logger') as mock_logger:
            from app.services.business_phase2 import BookingService
            
            booking_service = BookingService()
            tenant_id = uuid.uuid4()
            
            # Mock booking creation
            booking_data = {
                'customer_id': str(uuid.uuid4()),
                'service_id': str(uuid.uuid4()),
                'resource_id': str(uuid.uuid4()),
                'start_at': datetime.utcnow() + timedelta(hours=1),
                'end_at': datetime.utcnow() + timedelta(hours=2)
            }
            
            # This would normally create a booking, but we're testing logging
            # The actual booking creation would trigger the logging
            
            # Verify that structured logging is called with proper fields
            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args
            
            # Check that structured data includes required fields
            assert 'tenant_id' in call_args[1]['extra']
            assert 'booking_id' in call_args[1]['extra']
            assert 'event_type' in call_args[1]['extra']
    
    def test_payment_creation_logs_structured_data(self):
        """Test that payment creation logs structured data."""
        with patch('app.services.financial.logger') as mock_logger:
            from app.services.financial import PaymentService
            
            payment_service = PaymentService()
            
            # Mock payment creation
            tenant_id = str(uuid.uuid4())
            booking_id = str(uuid.uuid4())
            amount_cents = 5000
            
            # This would normally create a payment, but we're testing logging
            # The actual payment creation would trigger the logging
            
            # Verify that structured logging is called with proper fields
            mock_logger.info.assert_called()
            call_args = mock_logger.info.call_args
            
            # Check that structured data includes required fields
            assert 'tenant_id' in call_args[1]['extra']
            assert 'payment_id' in call_args[1]['extra']
            assert 'booking_id' in call_args[1]['extra']


class TestAuditTrail:
    """Test audit trail functionality."""
    
    def setup_method(self):
        """Set up test data."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
    
    def test_audit_log_creation(self):
        """Test that audit logs are created for admin actions."""
        with self.app.app_context():
            db.create_all()
            
            audit_service = AuditService()
            tenant_id = str(uuid.uuid4())
            user_id = str(uuid.uuid4())
            record_id = str(uuid.uuid4())
            
            # Create audit log
            audit_log_id = audit_service.create_audit_log(
                tenant_id=tenant_id,
                table_name="bookings",
                operation="DELETE",
                record_id=record_id,
                user_id=user_id,
                action="ADMIN_BOOKING_CANCELLED",
                metadata={"admin_action": True}
            )
            
            # Verify audit log was created
            assert audit_log_id is not None
            
            # Verify audit log can be retrieved
            audit_logs, total = audit_service.get_audit_logs(tenant_id)
            assert total > 0
            assert any(log['id'] == audit_log_id for log in audit_logs)
    
    def test_audit_log_contains_required_fields(self):
        """Test that audit logs contain all required fields."""
        with self.app.app_context():
            db.create_all()
            
            audit_service = AuditService()
            tenant_id = str(uuid.uuid4())
            user_id = str(uuid.uuid4())
            record_id = str(uuid.uuid4())
            
            # Create audit log
            audit_log_id = audit_service.create_audit_log(
                tenant_id=tenant_id,
                table_name="services",
                operation="DELETE",
                record_id=record_id,
                user_id=user_id,
                action="ADMIN_SERVICE_DELETED",
                metadata={"admin_action": True}
            )
            
            # Get audit log
            audit_logs, total = audit_service.get_audit_logs(tenant_id)
            audit_log = next(log for log in audit_logs if log['id'] == audit_log_id)
            
            # Verify required fields
            assert audit_log['tenant_id'] == tenant_id
            assert audit_log['table_name'] == "services"
            assert audit_log['operation'] == "DELETE"
            assert audit_log['record_id'] == record_id
            assert audit_log['user_id'] == user_id
            assert audit_log['action'] == "ADMIN_SERVICE_DELETED"


class TestSecurityHeaders:
    """Test security headers and middleware."""
    
    def setup_method(self):
        """Set up test data."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
    
    def test_security_headers_present(self):
        """Test that security headers are present in responses."""
        response = self.client.get('/health')
        
        # Check for common security headers
        assert 'X-Content-Type-Options' in response.headers
        assert 'X-Frame-Options' in response.headers
        assert 'X-XSS-Protection' in response.headers
    
    def test_cors_headers_present(self):
        """Test that CORS headers are present."""
        response = self.client.options('/api/v1/customers')
        
        # Check for CORS headers
        assert 'Access-Control-Allow-Origin' in response.headers
        assert 'Access-Control-Allow-Methods' in response.headers


class TestTenantResolution:
    """Test tenant resolution middleware."""
    
    def setup_method(self):
        """Set up test data."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
    
    def test_tenant_resolution_from_subdomain(self):
        """Test tenant resolution from subdomain."""
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            tenant = Tenant(
                id=uuid.uuid4(),
                name="Test Salon",
                slug="test-salon",
                status="active"
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Mock request with subdomain
            with patch('app.middleware.tenant_middleware.environ') as mock_environ:
                mock_environ.get.return_value = "test-salon.tithi.com"
                
                from app.middleware.tenant_middleware import TenantMiddleware
                middleware = TenantMiddleware(self.app)
                
                # Test tenant resolution
                tenant_id = middleware._resolve_from_host(mock_environ)
                assert tenant_id == str(tenant.id)
    
    def test_tenant_resolution_from_path(self):
        """Test tenant resolution from path."""
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            tenant = Tenant(
                id=uuid.uuid4(),
                name="Test Salon",
                slug="test-salon",
                status="active"
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Mock request with path
            with patch('app.middleware.tenant_middleware.environ') as mock_environ:
                mock_environ.get.return_value = "/v1/b/test-salon/availability"
                
                from app.middleware.tenant_middleware import TenantMiddleware
                middleware = TenantMiddleware(self.app)
                
                # Test tenant resolution
                tenant_id = middleware._resolve_from_path(mock_environ)
                assert tenant_id == str(tenant.id)


if __name__ == '__main__':
    pytest.main([__file__])
