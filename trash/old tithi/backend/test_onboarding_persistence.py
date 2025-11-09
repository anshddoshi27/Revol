"""
Test suite for onboarding persistence fixes.

This test suite validates that:
1. All onboarding fields are persisted correctly
2. User-provided policies are not overwritten by defaults
3. Resolve-tenant API returns fused config
4. Booking availability is properly determined
"""

import pytest
import json
from unittest.mock import patch, MagicMock
from app import create_app
from app.extensions import db
from app.models.core import Tenant, User
from app.services.core import TenantService


class TestOnboardingPersistence:
    """Test onboarding persistence functionality."""
    
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
    
    def test_onboarding_persists_all_fields(self, client, auth_headers, mock_user):
        """Test that all onboarding fields are persisted correctly."""
        with patch('app.middleware.auth_middleware.get_current_user', return_value=mock_user):
            # Complete onboarding payload with all fields
            payload = {
                "business_name": "Test Salon",
                "legal_name": "Test Salon LLC",
                "category": "beauty",
                "industry": "personal_care",
                "logo": "https://example.com/logo.png",
                "policies": {
                    "cancellation_policy": "Custom cancellation policy",
                    "no_show_policy": "Custom no-show policy",
                    "rescheduling_policy": "Custom rescheduling policy",
                    "payment_policy": "Custom payment policy",
                    "refund_policy": "Custom refund policy"
                },
                "owner_email": "owner@testsalon.com",
                "owner_name": "John Doe",
                "phone": "+1-555-123-4567",
                "website": "https://testsalon.com",
                "timezone": "America/New_York",
                "currency": "USD",
                "locale": "en_US",
                "address": {
                    "street": "123 Main St",
                    "city": "New York",
                    "state": "NY",
                    "postal_code": "10001",
                    "country": "US"
                },
                "branding": {
                    "primary_color": "#FF5733",
                    "secondary_color": "#33FF57",
                    "font": "Arial"
                },
                "socials": {
                    "facebook": "https://facebook.com/testsalon",
                    "instagram": "https://instagram.com/testsalon",
                    "twitter": "https://twitter.com/testsalon",
                    "linkedin": "https://linkedin.com/company/testsalon"
                }
            }
            
            response = client.post('/onboarding/register', 
                                 json=payload, 
                                 headers=auth_headers)
            
            assert response.status_code == 201
            data = response.get_json()
            
            # Verify response contains all fields
            assert data['business_name'] == "Test Salon"
            assert data['category'] == "beauty"
            assert data['logo'] == "https://example.com/logo.png"
            assert data['timezone'] == "America/New_York"
            assert data['currency'] == "USD"
            assert data['locale'] == "en_US"
            
            # Verify tenant was created with all fields
            tenant = Tenant.query.filter_by(slug=data['slug']).first()
            assert tenant is not None
            assert tenant.name == "Test Salon"
            assert tenant.legal_name == "Test Salon LLC"
            assert tenant.phone == "+1-555-123-4567"
            assert tenant.business_timezone == "America/New_York"
            assert tenant.address_json == payload['address']
            assert tenant.social_links_json == payload['socials']
            assert tenant.branding_json == payload['branding']
            assert tenant.policies_json == payload['policies']
    
    def test_user_policies_not_overwritten_by_defaults(self, client, auth_headers, mock_user):
        """Test that user-provided policies are not overwritten by defaults."""
        with patch('app.middleware.auth_middleware.get_current_user', return_value=mock_user):
            # Payload with custom policies
            payload = {
                "business_name": "Policy Test Salon",
                "owner_email": "owner@policytest.com",
                "owner_name": "Jane Doe",
                "policies": {
                    "cancellation_policy": "Custom cancellation: 48 hours notice required",
                    "no_show_policy": "Custom no-show: $25 fee",
                    "rescheduling_policy": "Custom rescheduling: 4 hours notice",
                    "payment_policy": "Custom payment: Cash only",
                    "refund_policy": "Custom refund: No refunds"
                }
            }
            
            response = client.post('/onboarding/register', 
                                 json=payload, 
                                 headers=auth_headers)
            
            assert response.status_code == 201
            
            # Verify custom policies are preserved
            tenant = Tenant.query.filter_by(name="Policy Test Salon").first()
            assert tenant is not None
            
            # Check that custom policies are in trust_copy_json
            trust_copy = tenant.trust_copy_json
            assert trust_copy['cancellation_policy'] == "Custom cancellation: 48 hours notice required"
            assert trust_copy['no_show_policy'] == "Custom no-show: $25 fee"
            assert trust_copy['rescheduling_policy'] == "Custom rescheduling: 4 hours notice"
            assert trust_copy['payment_policy'] == "Custom payment: Cash only"
            assert trust_copy['refund_policy'] == "Custom refund: No refunds"
            
            # Verify custom policies are also stored in policies_json
            policies = tenant.policies_json
            assert policies['cancellation_policy'] == "Custom cancellation: 48 hours notice required"
            assert policies['no_show_policy'] == "Custom no-show: $25 fee"
    
    def test_resolve_tenant_returns_fused_config(self, client, app):
        """Test that resolve-tenant API returns complete fused configuration."""
        with app.app_context():
            # Create a tenant with all fields populated
            tenant = Tenant(
                name="Resolve Test Salon",
                email="test@resolvetest.com",
                slug="resolvetest",
                legal_name="Resolve Test Salon LLC",
                phone="+1-555-999-8888",
                category="beauty",
                logo_url="https://example.com/resolve-logo.png",
                tz="America/Los_Angeles",
                business_timezone="America/Los_Angeles",
                locale="en_US",
                status="active",
                address_json={
                    "street": "456 Test Ave",
                    "city": "Los Angeles",
                    "state": "CA",
                    "postal_code": "90210",
                    "country": "US"
                },
                social_links_json={
                    "facebook": "https://facebook.com/resolvetest",
                    "instagram": "https://instagram.com/resolvetest"
                },
                branding_json={
                    "primary_color": "#FF0000",
                    "secondary_color": "#00FF00",
                    "font": "Helvetica"
                },
                trust_copy_json={
                    "cancellation_policy": "24 hour cancellation policy",
                    "no_show_policy": "No-show fee applies",
                    "rescheduling_policy": "Rescheduling allowed",
                    "payment_policy": "Payment required",
                    "refund_policy": "Refunds available"
                },
                billing_json={
                    "currency": "USD"
                }
            )
            
            db.session.add(tenant)
            db.session.commit()
            
            # Test resolve-tenant endpoint
            response = client.get('/onboarding/resolve-tenant?subdomain=resolvetest')
            
            assert response.status_code == 200
            config = response.get_json()
            
            # Verify business information
            assert config['business']['name'] == "Resolve Test Salon"
            assert config['business']['legal_name'] == "Resolve Test Salon LLC"
            assert config['business']['email'] == "test@resolvetest.com"
            assert config['business']['phone'] == "+1-555-999-8888"
            assert config['business']['category'] == "beauty"
            assert config['business']['address']['street'] == "456 Test Ave"
            assert config['business']['address']['city'] == "Los Angeles"
            assert config['business']['socials']['facebook'] == "https://facebook.com/resolvetest"
            
            # Verify branding
            assert config['branding']['logo_url'] == "https://example.com/resolve-logo.png"
            assert config['branding']['primary_color'] == "#FF0000"
            assert config['branding']['secondary_color'] == "#00FF00"
            assert config['branding']['font'] == "Helvetica"
            
            # Verify policies
            assert config['policies']['cancellation_policy'] == "24 hour cancellation policy"
            assert config['policies']['no_show_policy'] == "No-show fee applies"
            
            # Verify settings
            assert config['settings']['timezone'] == "America/Los_Angeles"
            assert config['settings']['business_timezone'] == "America/Los_Angeles"
            assert config['settings']['locale'] == "en_US"
            assert config['settings']['currency'] == "USD"
            
            # Verify booking status
            assert config['booking']['enabled'] == True
            assert config['booking']['status'] == "available"
            
            # Verify metadata
            assert config['tenant_id'] == str(tenant.id)
            assert config['slug'] == "resolvetest"
            assert config['subdomain'] == "resolvetest.tithi.com"
    
    def test_resolve_tenant_with_host_parameter(self, client, app):
        """Test resolve-tenant with host parameter."""
        with app.app_context():
            # Create tenant
            tenant = Tenant(
                name="Host Test Salon",
                email="test@hosttest.com",
                slug="hosttest",
                status="active"
            )
            db.session.add(tenant)
            db.session.commit()
            
            # Test with full host
            response = client.get('/onboarding/resolve-tenant?host=hosttest.tithi.com')
            assert response.status_code == 200
            config = response.get_json()
            assert config['business']['name'] == "Host Test Salon"
            
            # Test with just subdomain
            response = client.get('/onboarding/resolve-tenant?host=hosttest')
            assert response.status_code == 200
            config = response.get_json()
            assert config['business']['name'] == "Host Test Salon"
    
    def test_resolve_tenant_not_found(self, client):
        """Test resolve-tenant with non-existent tenant."""
        response = client.get('/onboarding/resolve-tenant?subdomain=nonexistent')
        assert response.status_code == 404
        
        data = response.get_json()
        assert data['message'] == "Tenant not found"
        assert data['code'] == "TITHI_TENANT_NOT_FOUND"
    
    def test_resolve_tenant_inactive(self, client, app):
        """Test resolve-tenant with inactive tenant."""
        with app.app_context():
            # Create inactive tenant
            tenant = Tenant(
                name="Inactive Salon",
                email="test@inactive.com",
                slug="inactive",
                status="suspended"
            )
            db.session.add(tenant)
            db.session.commit()
            
            response = client.get('/onboarding/resolve-tenant?subdomain=inactive')
            assert response.status_code == 403
            
            data = response.get_json()
            assert data['message'] == "Tenant is not active"
            assert data['code'] == "TITHI_TENANT_INACTIVE"
    
    def test_resolve_tenant_missing_parameters(self, client):
        """Test resolve-tenant with missing parameters."""
        response = client.get('/onboarding/resolve-tenant')
        assert response.status_code == 400
        
        data = response.get_json()
        assert data['message'] == "Either 'host' or 'subdomain' parameter is required"
        assert data['code'] == "TITHI_VALIDATION_ERROR"
    
    def test_onboarding_partial_payload(self, client, auth_headers, mock_user):
        """Test onboarding with minimal payload (only required fields)."""
        with patch('app.middleware.auth_middleware.get_current_user', return_value=mock_user):
            # Minimal payload
            payload = {
                "business_name": "Minimal Salon",
                "owner_email": "owner@minimal.com",
                "owner_name": "Minimal Owner"
            }
            
            response = client.post('/onboarding/register', 
                                 json=payload, 
                                 headers=auth_headers)
            
            assert response.status_code == 201
            data = response.get_json()
            
            # Verify tenant was created with defaults
            tenant = Tenant.query.filter_by(slug=data['slug']).first()
            assert tenant is not None
            assert tenant.name == "Minimal Salon"
            assert tenant.email == "owner@minimal.com"
            assert tenant.status == "active"
            assert tenant.address_json == {}
            assert tenant.social_links_json == {}
            assert tenant.branding_json == {}
            assert tenant.policies_json == {}
            
            # Verify default policies were applied
            trust_copy = tenant.trust_copy_json
            assert "cancellation_policy" in trust_copy
            assert "no_show_policy" in trust_copy
            assert "rescheduling_policy" in trust_copy
            assert "payment_policy" in trust_copy
            assert "refund_policy" in trust_copy


if __name__ == '__main__':
    pytest.main([__file__])
