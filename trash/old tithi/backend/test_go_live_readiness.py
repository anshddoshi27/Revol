"""
Test suite for go-live readiness validation.

This test suite validates that:
1. Tenant status progression works correctly
2. Readiness validation checks all requirements
3. Resolve-tenant API returns proper booking status
4. Go-live requirements endpoint works for admin UI
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from app import create_app
from app.extensions import db
from app.models.core import Tenant, User
from app.models.business import Service, Resource
from app.models.financial import TenantBilling
from app.services.readiness import TenantReadinessService


class TestGoLiveReadiness:
    """Test go-live readiness functionality."""
    
    @pytest.fixture
    def app(self):
        """Create test app."""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def mock_user(self):
        """Create mock user."""
        user = MagicMock()
        user.id = "550e8400-e29b-41d4-a716-446655440000"
        user.email = "test@example.com"
        return user
    
    @pytest.fixture
    def auth_headers(self):
        """Create auth headers."""
        return {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
        }
    
    def test_tenant_status_progression(self, app):
        """Test tenant status progression from onboarding to ready to active."""
        with app.app_context():
            # Create tenant in onboarding status
            tenant = Tenant(
                name="Status Test Salon",
                email="test@statustest.com",
                slug="statustest",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Verify initial status
            assert tenant.status == "onboarding"
            
            # Test status progression
            readiness_service = TenantReadinessService()
            
            # Initially not ready (no services, etc.)
            is_ready, _ = readiness_service.check_tenant_readiness(str(tenant.id))
            assert not is_ready
            
            # Update status based on readiness
            readiness_service.update_tenant_status(str(tenant.id))
            tenant = Tenant.query.get(tenant.id)
            assert tenant.status == "onboarding"  # Still onboarding because not ready
    
    def test_readiness_validation_stripe_connection(self, app):
        """Test readiness validation for Stripe connection."""
        with app.app_context():
            # Create tenant
            tenant = Tenant(
                name="Stripe Test Salon",
                email="test@stripetest.com",
                slug="stripetest",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            readiness_service = TenantReadinessService()
            
            # Test without Stripe connection
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert not is_ready
            assert not requirements["requirements"]["stripe_connected"]
            
            # Add Stripe connection
            billing = TenantBilling(
                tenant_id=tenant.id,
                stripe_connect_enabled=True,
                stripe_connect_id="acct_test123"
            )
            db.session.add(billing)
            db.session.commit()
            
            # Test with Stripe connection
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert requirements["requirements"]["stripe_connected"]
    
    def test_readiness_validation_services(self, app):
        """Test readiness validation for services."""
        with app.app_context():
            # Create tenant
            tenant = Tenant(
                name="Service Test Salon",
                email="test@servicetest.com",
                slug="servicetest",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            readiness_service = TenantReadinessService()
            
            # Test without services
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert not is_ready
            assert not requirements["requirements"]["has_services"]
            
            # Add service
            service = Service(
                tenant_id=tenant.id,
                name="Haircut",
                description="Professional haircut service",
                duration_minutes=60,
                price_cents=5000,
                is_active=True
            )
            db.session.add(service)
            db.session.commit()
            
            # Test with service
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert requirements["requirements"]["has_services"]
    
    def test_readiness_validation_availability(self, app):
        """Test readiness validation for availability."""
        with app.app_context():
            # Create tenant
            tenant = Tenant(
                name="Availability Test Salon",
                email="test@availabilitytest.com",
                slug="availabilitytest",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            readiness_service = TenantReadinessService()
            
            # Test without staff
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert not is_ready
            assert not requirements["requirements"]["has_availability"]
            
            # Add staff member
            staff = Resource(
                tenant_id=tenant.id,
                type="staff",
                name="John Doe",
                capacity=1,
                is_active=True
            )
            db.session.add(staff)
            db.session.commit()
            
            # Test with staff
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert requirements["requirements"]["has_availability"]
    
    def test_readiness_validation_policies(self, app):
        """Test readiness validation for policies."""
        with app.app_context():
            # Create tenant
            tenant = Tenant(
                name="Policy Test Salon",
                email="test@policytest.com",
                slug="policytest",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            readiness_service = TenantReadinessService()
            
            # Test without policies
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert not is_ready
            assert not requirements["requirements"]["has_policies"]
            
            # Add policies
            tenant.trust_copy_json = {
                "cancellation_policy": "24 hour cancellation policy",
                "no_show_policy": "No-show fee applies",
                "rescheduling_policy": "Rescheduling allowed",
                "payment_policy": "Payment required",
                "refund_policy": "Refunds available"
            }
            db.session.commit()
            
            # Test with policies
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert requirements["requirements"]["has_policies"]
    
    def test_readiness_validation_business_info(self, app):
        """Test readiness validation for business information."""
        with app.app_context():
            # Create tenant with minimal info
            tenant = Tenant(
                name="",  # Empty name
                email="",  # Empty email
                slug="businessinfotest",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            readiness_service = TenantReadinessService()
            
            # Test without business info
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert not is_ready
            assert not requirements["requirements"]["has_business_info"]
            
            # Add business info
            tenant.name = "Business Info Test Salon"
            tenant.email = "test@businessinfotest.com"
            tenant.phone = "+1-555-123-4567"
            db.session.commit()
            
            # Test with business info
            is_ready, requirements = readiness_service.check_tenant_readiness(str(tenant.id))
            assert requirements["requirements"]["has_business_info"]
    
    def test_resolve_tenant_with_readiness(self, client, app):
        """Test resolve-tenant API includes readiness information."""
        with app.app_context():
            # Create tenant with some readiness requirements met
            tenant = Tenant(
                name="Resolve Readiness Test Salon",
                email="test@resolvereadinesstest.com",
                slug="resolvereadinesstest",
                status="onboarding",
                phone="+1-555-999-8888",
                trust_copy_json={
                    "cancellation_policy": "24 hour cancellation policy",
                    "no_show_policy": "No-show fee applies",
                    "rescheduling_policy": "Rescheduling allowed",
                    "payment_policy": "Payment required",
                    "refund_policy": "Refunds available"
                }
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Add Stripe connection
            billing = TenantBilling(
                tenant_id=tenant.id,
                stripe_connect_enabled=True,
                stripe_connect_id="acct_test123"
            )
            db.session.add(billing)
            
            # Add service
            service = Service(
                tenant_id=tenant.id,
                name="Haircut",
                description="Professional haircut service",
                duration_minutes=60,
                price_cents=5000,
                is_active=True
            )
            db.session.add(service)
            
            # Add staff
            staff = Resource(
                tenant_id=tenant.id,
                type="staff",
                name="John Doe",
                capacity=1,
                is_active=True
            )
            db.session.add(staff)
            db.session.commit()
            
            # Test resolve-tenant endpoint
            response = client.get('/onboarding/resolve-tenant?subdomain=resolvereadinesstest')
            
            assert response.status_code == 200
            config = response.get_json()
            
            # Verify booking status includes readiness
            assert "booking" in config
            assert "readiness" in config["booking"]
            assert "is_ready" in config["booking"]["readiness"]
            assert "requirements" in config["booking"]["readiness"]
            assert "unmet_requirements" in config["booking"]["readiness"]
            
            # Verify booking is enabled if ready
            if config["booking"]["readiness"]["is_ready"]:
                assert config["booking"]["enabled"] == True
                assert config["booking"]["status"] == "available"
            else:
                assert config["booking"]["enabled"] == False
                assert config["booking"]["status"] == "unavailable"
    
    def test_go_live_requirements_endpoint(self, client, auth_headers, mock_user, app):
        """Test go-live requirements endpoint for admin UI."""
        with app.app_context():
            with patch('app.middleware.auth_middleware.get_current_user', return_value=mock_user):
                # Create tenant
                tenant = Tenant(
                    name="Go Live Test Salon",
                    email="test@golivetest.com",
                    slug="golivetest",
                    status="onboarding"
                )
                db.session.add(tenant)
                db.session.commit()
                
                # Test go-live requirements endpoint
                response = client.get(f'/onboarding/go-live-requirements/{tenant.id}', 
                                     headers=auth_headers)
                
                assert response.status_code == 200
                requirements = response.get_json()
                
                # Verify response structure
                assert "tenant_id" in requirements
                assert "is_ready" in requirements
                assert "can_go_live" in requirements
                assert "requirements" in requirements
                assert "unmet_requirements" in requirements
                assert "tenant_status" in requirements
                
                # Verify requirements structure
                reqs = requirements["requirements"]
                assert "stripe_connected" in reqs
                assert "has_services" in reqs
                assert "has_availability" in reqs
                assert "has_policies" in reqs
                assert "has_business_info" in reqs
                
                # Each requirement should have met status and description
                for req_name, req_data in reqs.items():
                    assert "met" in req_data
                    assert "description" in req_data
                    assert isinstance(req_data["met"], bool)
                    assert isinstance(req_data["description"], str)
    
    def test_fully_ready_tenant(self, client, app):
        """Test a fully ready tenant passes all requirements."""
        with app.app_context():
            # Create fully configured tenant
            tenant = Tenant(
                name="Fully Ready Salon",
                email="test@fullyready.com",
                slug="fullyready",
                status="onboarding",
                phone="+1-555-123-4567",
                trust_copy_json={
                    "cancellation_policy": "24 hour cancellation policy",
                    "no_show_policy": "No-show fee applies",
                    "rescheduling_policy": "Rescheduling allowed",
                    "payment_policy": "Payment required",
                    "refund_policy": "Refunds available"
                }
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Add all requirements
            billing = TenantBilling(
                tenant_id=tenant.id,
                stripe_connect_enabled=True,
                stripe_connect_id="acct_test123"
            )
            db.session.add(billing)
            
            service = Service(
                tenant_id=tenant.id,
                name="Haircut",
                description="Professional haircut service",
                duration_minutes=60,
                price_cents=5000,
                is_active=True
            )
            db.session.add(service)
            
            staff = Resource(
                tenant_id=tenant.id,
                type="staff",
                name="John Doe",
                capacity=1,
                is_active=True
            )
            db.session.add(staff)
            db.session.commit()
            
            # Test resolve-tenant
            response = client.get('/onboarding/resolve-tenant?subdomain=fullyready')
            
            assert response.status_code == 200
            config = response.get_json()
            
            # Should be ready and booking enabled
            assert config["booking"]["readiness"]["is_ready"] == True
            assert config["booking"]["enabled"] == True
            assert config["booking"]["status"] == "available"
            assert len(config["booking"]["readiness"]["unmet_requirements"]) == 0
    
    def test_unmet_requirements_list(self, client, app):
        """Test that unmet requirements are properly listed."""
        with app.app_context():
            # Create tenant with minimal configuration
            tenant = Tenant(
                name="Minimal Salon",
                email="test@minimal.com",
                slug="minimal",
                status="onboarding"
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Test resolve-tenant
            response = client.get('/onboarding/resolve-tenant?subdomain=minimal')
            
            assert response.status_code == 200
            config = response.get_json()
            
            # Should not be ready
            assert config["booking"]["readiness"]["is_ready"] == False
            assert config["booking"]["enabled"] == False
            assert config["booking"]["status"] == "unavailable"
            
            # Should have unmet requirements
            unmet = config["booking"]["readiness"]["unmet_requirements"]
            assert len(unmet) > 0
            
            # Should include specific unmet requirements
            expected_requirements = [
                "Stripe Connect account not set up",
                "No active services configured",
                "No staff availability configured",
                "Required policies not configured",
                "Essential business information missing"
            ]
            
            for expected in expected_requirements:
                assert any(expected in req for req in unmet)


if __name__ == '__main__':
    pytest.main([__file__])
