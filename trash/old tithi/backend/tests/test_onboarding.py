"""
Test suite for tenant onboarding functionality.

This module tests the onboarding wizard endpoints including:
- Business registration with subdomain generation
- Subdomain uniqueness validation
- Default theme and policy creation
- Idempotency handling
- Error cases and edge conditions
"""

import pytest
import json
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.system import Theme


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
def auth_headers():
    """Create authentication headers for testing."""
    return {
        'Authorization': 'Bearer test-jwt-token',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def mock_user():
    """Create mock user for testing."""
    return {
        'id': str(uuid.uuid4()),
        'email': 'test@example.com',
        'display_name': 'Test User'
    }


@pytest.fixture
def sample_registration_data():
    """Sample registration data for testing."""
    return {
        "business_name": "Test Salon",
        "category": "Beauty",
        "logo": "https://example.com/logo.png",
        "policies": {
            "cancellation_policy": "24 hour notice required",
            "no_show_policy": "3% fee for no-shows"
        },
        "owner_email": "owner@testsalon.com",
        "owner_name": "John Doe",
        "timezone": "America/New_York",
        "currency": "USD",
        "locale": "en_US"
    }


class TestOnboardingRegistration:
    """Test cases for business registration endpoint."""
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_successful_registration(self, mock_get_user, client, auth_headers, mock_user, sample_registration_data):
        """Test successful business registration."""
        mock_get_user.return_value = mock_user
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(sample_registration_data)
        )
        
        assert response.status_code == 201
        data = response.get_json()
        
        # Verify response structure
        assert 'id' in data
        assert 'business_name' in data
        assert 'slug' in data
        assert 'subdomain' in data
        assert data['business_name'] == "Test Salon"
        assert data['slug'] == "test-salon"
        assert data['subdomain'] == "test-salon.tithi.com"
        assert data['category'] == "Beauty"
        assert data['timezone'] == "America/New_York"
        assert data['currency'] == "USD"
        assert data['locale'] == "en_US"
        assert data['status'] == "active"
        assert data['is_existing'] == False
        
        # Verify tenant was created in database
        tenant = Tenant.query.filter_by(slug="test-salon").first()
        assert tenant is not None
        assert tenant.name == "Test Salon"
        assert tenant.email == "owner@testsalon.com"
        assert tenant.category == "Beauty"
        assert tenant.logo_url == "https://example.com/logo.png"
        assert tenant.tz == "America/New_York"
        assert tenant.status == "active"
        
        # Verify membership was created
        membership = Membership.query.filter_by(
            tenant_id=tenant.id,
            user_id=mock_user['id']
        ).first()
        assert membership is not None
        assert membership.role == "owner"
        
        # Verify default theme was created
        theme = Theme.query.filter_by(tenant_id=tenant.id).first()
        assert theme is not None
        assert theme.brand_color == "#000000"
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_registration_without_optional_fields(self, mock_get_user, client, auth_headers, mock_user):
        """Test registration with minimal required fields."""
        mock_get_user.return_value = mock_user
        
        minimal_data = {
            "business_name": "Minimal Business",
            "owner_email": "minimal@example.com",
            "owner_name": "Jane Doe"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(minimal_data)
        )
        
        assert response.status_code == 201
        data = response.get_json()
        
        assert data['business_name'] == "Minimal Business"
        assert data['slug'] == "minimal-business"
        assert data['subdomain'] == "minimal-business.tithi.com"
        assert data['timezone'] == "UTC"  # Default
        assert data['currency'] == "USD"  # Default
        assert data['locale'] == "en_US"  # Default
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_subdomain_generation_with_special_characters(self, mock_get_user, client, auth_headers, mock_user):
        """Test subdomain generation with special characters."""
        mock_get_user.return_value = mock_user
        
        data = {
            "business_name": "Test's Salon & Spa!",
            "owner_email": "test@example.com",
            "owner_name": "Test Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 201
        data = response.get_json()
        
        # Should convert special chars to hyphens
        assert data['slug'] == "test-s-salon-spa"
        assert data['subdomain'] == "test-s-salon-spa.tithi.com"
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_subdomain_uniqueness_handling(self, mock_get_user, client, auth_headers, mock_user):
        """Test subdomain uniqueness handling."""
        mock_get_user.return_value = mock_user
        
        # Create first tenant
        data1 = {
            "business_name": "Test Business",
            "owner_email": "test1@example.com",
            "owner_name": "Test Owner 1"
        }
        
        response1 = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data1)
        )
        assert response1.status_code == 201
        
        # Create second tenant with same base name
        data2 = {
            "business_name": "Test Business",
            "owner_email": "test2@example.com",
            "owner_name": "Test Owner 2"
        }
        
        response2 = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data2)
        )
        assert response2.status_code == 201
        
        data2_response = response2.get_json()
        # Should have different subdomain
        assert data2_response['slug'] == "test-business-1"
        assert data2_response['subdomain'] == "test-business-1.tithi.com"
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_idempotent_registration(self, mock_get_user, client, auth_headers, mock_user):
        """Test idempotent registration - same user, same subdomain."""
        mock_get_user.return_value = mock_user
        
        data = {
            "business_name": "Idempotent Business",
            "owner_email": "idempotent@example.com",
            "owner_name": "Idempotent Owner"
        }
        
        # First registration
        response1 = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        assert response1.status_code == 201
        
        # Second registration with same data
        response2 = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        assert response2.status_code == 200  # Should return existing tenant
        
        data1 = response1.get_json()
        data2 = response2.get_json()
        
        # Should return same tenant
        assert data1['id'] == data2['id']
        assert data2['is_existing'] == True
    
    def test_missing_required_fields(self, client, auth_headers):
        """Test registration with missing required fields."""
        data = {
            "business_name": "Test Business"
            # Missing owner_email and owner_name
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Missing required fields" in data['detail']
        assert data['code'] == "TITHI_VALIDATION_ERROR"
    
    def test_invalid_email_format(self, client, auth_headers):
        """Test registration with invalid email format."""
        data = {
            "business_name": "Test Business",
            "owner_email": "invalid-email",
            "owner_name": "Test Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Invalid email format" in data['detail']
        assert data['code'] == "TITHI_VALIDATION_ERROR"
    
    def test_business_name_validation(self, client, auth_headers):
        """Test business name validation."""
        # Too short
        data = {
            "business_name": "A",  # Too short
            "owner_email": "test@example.com",
            "owner_name": "Test Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Business name must be at least 2 characters" in data['detail']
    
    def test_unauthorized_request(self, client):
        """Test registration without authentication."""
        data = {
            "business_name": "Test Business",
            "owner_email": "test@example.com",
            "owner_name": "Test Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            data=json.dumps(data)
        )
        
        assert response.status_code == 401
    
    def test_malformed_json(self, client, auth_headers):
        """Test registration with malformed JSON."""
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data="invalid json"
        )
        
        assert response.status_code == 400


class TestSubdomainAvailability:
    """Test cases for subdomain availability checking."""
    
    def test_check_available_subdomain(self, client, auth_headers):
        """Test checking availability of a new subdomain."""
        response = client.get(
            '/onboarding/check-subdomain/test-subdomain',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['subdomain'] == "test-subdomain"
        assert data['available'] == True
        assert data['suggested_url'] == "test-subdomain.tithi.com"
    
    def test_check_unavailable_subdomain(self, client, auth_headers):
        """Test checking availability of an existing subdomain."""
        # First create a tenant
        with patch('app.blueprints.onboarding.get_current_user') as mock_get_user:
            mock_user = {'id': str(uuid.uuid4()), 'email': 'test@example.com'}
            mock_get_user.return_value = mock_user
            
            data = {
                "business_name": "Test Business",
                "owner_email": "test@example.com",
                "owner_name": "Test Owner"
            }
            
            response = client.post(
                '/onboarding/register',
                headers=auth_headers,
                data=json.dumps(data)
            )
            assert response.status_code == 201
        
        # Now check if subdomain is available
        response = client.get(
            '/onboarding/check-subdomain/test-business',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data['subdomain'] == "test-business"
        assert data['available'] == False
        assert data['suggested_url'] is None
    
    def test_invalid_subdomain_format(self, client, auth_headers):
        """Test checking invalid subdomain format."""
        response = client.get(
            '/onboarding/check-subdomain/INVALID_SUBDOMAIN!',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Invalid subdomain format" in data['detail']
    
    def test_subdomain_too_short(self, client, auth_headers):
        """Test checking subdomain that's too short."""
        response = client.get(
            '/onboarding/check-subdomain/a',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Subdomain must be between 2 and 50 characters" in data['detail']
    
    def test_subdomain_too_long(self, client, auth_headers):
        """Test checking subdomain that's too long."""
        long_subdomain = "a" * 51
        response = client.get(
            f'/onboarding/check-subdomain/{long_subdomain}',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Subdomain must be between 2 and 50 characters" in data['detail']


class TestDefaultSetup:
    """Test cases for default theme and policy setup."""
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_default_theme_creation(self, mock_get_user, client, auth_headers, mock_user):
        """Test that default theme is created for new tenant."""
        mock_get_user.return_value = mock_user
        
        data = {
            "business_name": "Theme Test Business",
            "owner_email": "theme@example.com",
            "owner_name": "Theme Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 201
        response_data = response.get_json()
        
        # Check that theme was created
        tenant = Tenant.query.filter_by(id=response_data['id']).first()
        theme = Theme.query.filter_by(tenant_id=tenant.id).first()
        
        assert theme is not None
        assert theme.brand_color == "#000000"
        assert theme.theme_json['primary_color'] == "#000000"
        assert theme.theme_json['secondary_color'] == "#ffffff"
        assert theme.theme_json['accent_color'] == "#007bff"
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_default_policies_creation(self, mock_get_user, client, auth_headers, mock_user):
        """Test that default policies are created for new tenant."""
        mock_get_user.return_value = mock_user
        
        data = {
            "business_name": "Policy Test Business",
            "owner_email": "policy@example.com",
            "owner_name": "Policy Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 201
        response_data = response.get_json()
        
        # Check that policies were created
        tenant = Tenant.query.filter_by(id=response_data['id']).first()
        
        assert tenant.default_no_show_fee_percent == 3.00
        assert tenant.trust_copy_json['cancellation_policy'] == "Cancellations must be made at least 24 hours in advance."
        assert tenant.trust_copy_json['no_show_policy'] == "No-show appointments will be charged a 3% fee."
        assert tenant.billing_json['currency'] == "USD"
        assert tenant.billing_json['timezone'] == "UTC"


class TestErrorHandling:
    """Test cases for error handling and edge conditions."""
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_theme_creation_failure_doesnt_fail_registration(self, mock_get_user, client, auth_headers, mock_user):
        """Test that theme creation failure doesn't fail the entire registration."""
        mock_get_user.return_value = mock_user
        
        # Mock theme creation to fail
        with patch('app.blueprints.onboarding.create_default_theme') as mock_create_theme:
            mock_create_theme.side_effect = Exception("Theme creation failed")
            
            data = {
                "business_name": "Resilient Business",
                "owner_email": "resilient@example.com",
                "owner_name": "Resilient Owner"
            }
            
            response = client.post(
                '/onboarding/register',
                headers=auth_headers,
                data=json.dumps(data)
            )
            
            # Registration should still succeed
            assert response.status_code == 201
    
    @patch('app.blueprints.onboarding.get_current_user')
    def test_policy_creation_failure_doesnt_fail_registration(self, mock_get_user, client, auth_headers, mock_user):
        """Test that policy creation failure doesn't fail the entire registration."""
        mock_get_user.return_value = mock_user
        
        # Mock policy creation to fail
        with patch('app.blueprints.onboarding.create_default_policies') as mock_create_policies:
            mock_create_policies.side_effect = Exception("Policy creation failed")
            
            data = {
                "business_name": "Resilient Business 2",
                "owner_email": "resilient2@example.com",
                "owner_name": "Resilient Owner 2"
            }
            
            response = client.post(
                '/onboarding/register',
                headers=auth_headers,
                data=json.dumps(data)
            )
            
            # Registration should still succeed
            assert response.status_code == 201
    
    def test_empty_request_body(self, client, auth_headers):
        """Test registration with empty request body."""
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=""
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert "Request body is required" in data['detail']
    
    def test_missing_content_type(self, client):
        """Test registration without content type header."""
        data = {
            "business_name": "Test Business",
            "owner_email": "test@example.com",
            "owner_name": "Test Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            data=json.dumps(data)
        )
        
        # Should still work as Flask can parse JSON without explicit content type
        assert response.status_code in [200, 201, 400]  # Depends on implementation


class TestObservabilityHooks:
    """Test cases for observability and logging."""
    
    @patch('app.blueprints.onboarding.get_current_user')
    @patch('app.blueprints.onboarding.logger')
    def test_tenant_onboarded_log_emitted(self, mock_logger, mock_get_user, client, auth_headers, mock_user):
        """Test that TENANT_ONBOARDED log is emitted."""
        mock_get_user.return_value = mock_user
        
        data = {
            "business_name": "Observable Business",
            "owner_email": "observable@example.com",
            "owner_name": "Observable Owner"
        }
        
        response = client.post(
            '/onboarding/register',
            headers=auth_headers,
            data=json.dumps(data)
        )
        
        assert response.status_code == 201
        
        # Check that log was emitted
        mock_logger.info.assert_called()
        log_calls = [call for call in mock_logger.info.call_args_list if "TENANT_ONBOARDED" in str(call)]
        assert len(log_calls) > 0
        
        # Check log content
        log_call = log_calls[0]
        assert "TENANT_ONBOARDED" in str(log_call)
        assert "subdomain=" in str(log_call)
