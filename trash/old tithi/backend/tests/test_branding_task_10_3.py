"""
Test Branding & White-Label Settings (Task 10.3)

This module provides comprehensive contract tests for Task 10.3: Branding & White-Label Settings.
Tests validate tenant branding management, file uploads, color validation, and email integration.

Aligned with Design Brief Module M - Admin Dashboard and Task 10.3 requirements.
"""

import pytest
import uuid
import json
from unittest.mock import Mock, patch
from werkzeug.datastructures import FileStorage
from io import BytesIO

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.system import Theme, Branding
from app.services.system import BrandingService
from app.services.email_service import TenantBrandingService
from app.middleware.error_handler import TithiError


class TestBrandingService:
    """Test BrandingService functionality."""
    
    @pytest.fixture
    def app(self):
        """Create test app with database."""
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
    def test_tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-business",
                tz="UTC"
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @pytest.fixture
    def test_user(self, app):
        """Create test user."""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                display_name="Test User",
                primary_email="test@example.com"
            )
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def test_membership(self, app, test_tenant, test_user):
        """Create test membership."""
        with app.app_context():
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                user_id=test_user.id,
                role="owner"
            )
            db.session.add(membership)
            db.session.commit()
            return membership
    
    @pytest.fixture
    def branding_service(self):
        """Create BrandingService instance."""
        return BrandingService()
    
    def test_get_tenant_branding_default(self, app, test_tenant, branding_service):
        """Test getting default branding for tenant."""
        with app.app_context():
            branding_data = branding_service.get_tenant_branding(test_tenant.id)
            
            assert branding_data["tenant_id"] == str(test_tenant.id)
            assert branding_data["tenant_slug"] == "test-business"
            assert branding_data["primary_color"] == "#000000"
            assert branding_data["secondary_color"] == "#FFFFFF"
            assert branding_data["logo_url"] is None
            assert branding_data["favicon_url"] is None
            assert branding_data["subdomain"] == "test-business"
    
    def test_get_tenant_branding_with_theme(self, app, test_tenant, branding_service):
        """Test getting branding with existing theme."""
        with app.app_context():
            # Create theme
            theme = Theme(
                tenant_id=test_tenant.id,
                brand_color="#FF0000",
                logo_url="https://example.com/logo.png",
                theme_json={
                    "secondary_color": "#00FF00",
                    "font_family": "Arial",
                    "custom_css": ".custom { color: red; }"
                }
            )
            db.session.add(theme)
            db.session.commit()
            
            branding_data = branding_service.get_tenant_branding(test_tenant.id)
            
            assert branding_data["primary_color"] == "#FF0000"
            assert branding_data["logo_url"] == "https://example.com/logo.png"
            assert branding_data["secondary_color"] == "#00FF00"
            assert branding_data["font_family"] == "Arial"
            assert branding_data["custom_css"] == ".custom { color: red; }"
    
    def test_update_branding_colors(self, app, test_tenant, test_user, branding_service):
        """Test updating branding colors."""
        with app.app_context():
            branding_data = {
                "primary_color": "#FF0000",
                "secondary_color": "#00FF00",
                "font_family": "Arial"
            }
            
            updated_branding = branding_service.update_branding(
                test_tenant.id, branding_data, test_user.id
            )
            
            assert updated_branding["primary_color"] == "#FF0000"
            assert updated_branding["secondary_color"] == "#00FF00"
            assert updated_branding["font_family"] == "Arial"
            
            # Verify theme was updated
            theme = Theme.query.filter_by(tenant_id=test_tenant.id).first()
            assert theme.brand_color == "#FF0000"
            assert theme.theme_json["secondary_color"] == "#00FF00"
            assert theme.theme_json["font_family"] == "Arial"
    
    def test_update_branding_invalid_color(self, app, test_tenant, test_user, branding_service):
        """Test updating branding with invalid color."""
        with app.app_context():
            branding_data = {
                "primary_color": "invalid-color"
            }
            
            with pytest.raises(TithiError) as exc_info:
                branding_service.update_branding(
                    test_tenant.id, branding_data, test_user.id
                )
            
            assert exc_info.value.code == "TITHI_BRANDING_INVALID_COLOR"
    
    def test_upload_logo(self, app, test_tenant, test_user, branding_service):
        """Test logo upload functionality."""
        with app.app_context():
            # Create mock file
            file_content = b"fake logo content"
            logo_file = FileStorage(
                stream=BytesIO(file_content),
                filename="logo.png",
                content_type="image/png"
            )
            
            result = branding_service.upload_logo(test_tenant.id, logo_file, test_user.id)
            
            assert "logo_url" in result
            assert "file_checksum" in result
            assert "file_size" in result
            assert result["file_size"] == len(file_content)
            assert result["message"] == "Logo uploaded successfully"
            
            # Verify theme was updated
            theme = Theme.query.filter_by(tenant_id=test_tenant.id).first()
            assert theme.logo_url == result["logo_url"]
    
    def test_upload_logo_too_large(self, app, test_tenant, test_user, branding_service):
        """Test logo upload with file too large."""
        with app.app_context():
            # Create mock file larger than 2MB
            file_content = b"x" * (3 * 1024 * 1024)  # 3MB
            logo_file = FileStorage(
                stream=BytesIO(file_content),
                filename="large_logo.png",
                content_type="image/png"
            )
            
            with pytest.raises(TithiError) as exc_info:
                branding_service.upload_logo(test_tenant.id, logo_file, test_user.id)
            
            assert exc_info.value.code == "TITHI_BRANDING_FILE_TOO_LARGE"
    
    def test_upload_logo_invalid_type(self, app, test_tenant, test_user, branding_service):
        """Test logo upload with invalid file type."""
        with app.app_context():
            file_content = b"fake content"
            logo_file = FileStorage(
                stream=BytesIO(file_content),
                filename="logo.txt",
                content_type="text/plain"
            )
            
            with pytest.raises(TithiError) as exc_info:
                branding_service.upload_logo(test_tenant.id, logo_file, test_user.id)
            
            assert exc_info.value.code == "TITHI_BRANDING_INVALID_FILE"
    
    def test_upload_favicon(self, app, test_tenant, test_user, branding_service):
        """Test favicon upload functionality."""
        with app.app_context():
            file_content = b"fake favicon content"
            favicon_file = FileStorage(
                stream=BytesIO(file_content),
                filename="favicon.ico",
                content_type="image/x-icon"
            )
            
            result = branding_service.upload_favicon(test_tenant.id, favicon_file, test_user.id)
            
            assert "favicon_url" in result
            assert "file_checksum" in result
            assert "file_size" in result
            assert result["file_size"] == len(file_content)
            assert result["message"] == "Favicon uploaded successfully"
            
            # Verify theme was updated
            theme = Theme.query.filter_by(tenant_id=test_tenant.id).first()
            assert theme.theme_json["favicon_url"] == result["favicon_url"]
    
    def test_validate_subdomain_available(self, app, branding_service):
        """Test subdomain validation for available subdomain."""
        with app.app_context():
            is_available = branding_service.validate_subdomain("new-business")
            assert is_available is True
    
    def test_validate_subdomain_taken(self, app, test_tenant, branding_service):
        """Test subdomain validation for taken subdomain."""
        with app.app_context():
            is_available = branding_service.validate_subdomain("test-business")
            assert is_available is False
    
    def test_validate_subdomain_same_tenant(self, app, test_tenant, branding_service):
        """Test subdomain validation for same tenant."""
        with app.app_context():
            is_available = branding_service.validate_subdomain("test-business", test_tenant.id)
            assert is_available is True
    
    def test_get_branding_for_email(self, app, test_tenant, branding_service):
        """Test getting branding formatted for email templates."""
        with app.app_context():
            # Create theme with branding
            theme = Theme(
                tenant_id=test_tenant.id,
                brand_color="#FF0000",
                logo_url="https://example.com/logo.png",
                theme_json={
                    "secondary_color": "#00FF00",
                    "font_family": "Arial"
                }
            )
            db.session.add(theme)
            db.session.commit()
            
            email_branding = branding_service.get_branding_for_email(test_tenant.id)
            
            assert email_branding["tenant_name"] == "Test Business"
            assert email_branding["tenant_slug"] == "test-business"
            assert email_branding["logo_url"] == "https://example.com/logo.png"
            assert email_branding["primary_color"] == "#FF0000"
            assert email_branding["secondary_color"] == "#00FF00"
            assert email_branding["font_family"] == "Arial"
            assert email_branding["website_url"] == "https://test-business.tithi.com"
            assert email_branding["support_email"] == "support@test-business.tithi.com"


class TestBrandingAPI:
    """Test branding API endpoints."""
    
    @pytest.fixture
    def app(self):
        """Create test app with database."""
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
    def test_tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-business",
                tz="UTC"
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @pytest.fixture
    def test_user(self, app):
        """Create test user."""
        with app.app_context():
            user = User(
                id=uuid.uuid4(),
                display_name="Test User",
                primary_email="test@example.com"
            )
            db.session.add(user)
            db.session.commit()
            return user
    
    @pytest.fixture
    def test_membership(self, app, test_tenant, test_user):
        """Create test membership."""
        with app.app_context():
            membership = Membership(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                user_id=test_user.id,
                role="owner"
            )
            db.session.add(membership)
            db.session.commit()
            return membership
    
    @pytest.fixture
    def auth_headers(self, test_user, test_tenant):
        """Create authentication headers."""
        return {
            "Authorization": f"Bearer {test_user.id}",
            "X-Tenant-ID": str(test_tenant.id)
        }
    
    def test_get_branding(self, client, auth_headers):
        """Test GET /admin/branding endpoint."""
        response = client.get("/api/v1/admin/branding", headers=auth_headers)
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "branding" in data
        assert data["branding"]["tenant_slug"] == "test-business"
        assert data["branding"]["primary_color"] == "#000000"
    
    def test_update_branding(self, client, auth_headers):
        """Test PUT /admin/branding endpoint."""
        branding_data = {
            "primary_color": "#FF0000",
            "secondary_color": "#00FF00",
            "font_family": "Arial"
        }
        
        response = client.put(
            "/api/v1/admin/branding",
            headers=auth_headers,
            json=branding_data
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Branding updated successfully"
        assert data["branding"]["primary_color"] == "#FF0000"
        assert data["branding"]["secondary_color"] == "#00FF00"
    
    def test_update_branding_invalid_color(self, client, auth_headers):
        """Test PUT /admin/branding with invalid color."""
        branding_data = {
            "primary_color": "invalid-color"
        }
        
        response = client.put(
            "/api/v1/admin/branding",
            headers=auth_headers,
            json=branding_data
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["code"] == "TITHI_BRANDING_INVALID_COLOR"
    
    def test_upload_logo(self, client, auth_headers):
        """Test POST /admin/branding/upload-logo endpoint."""
        file_content = b"fake logo content"
        data = {
            "logo": (BytesIO(file_content), "logo.png")
        }
        
        response = client.post(
            "/api/v1/admin/branding/upload-logo",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Logo uploaded successfully"
        assert "logo_url" in data
        assert "file_checksum" in data
    
    def test_upload_logo_no_file(self, client, auth_headers):
        """Test POST /admin/branding/upload-logo without file."""
        response = client.post(
            "/api/v1/admin/branding/upload-logo",
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data["code"] == "TITHI_VALIDATION_ERROR"
    
    def test_upload_favicon(self, client, auth_headers):
        """Test POST /admin/branding/upload-favicon endpoint."""
        file_content = b"fake favicon content"
        data = {
            "favicon": (BytesIO(file_content), "favicon.ico")
        }
        
        response = client.post(
            "/api/v1/admin/branding/upload-favicon",
            headers=auth_headers,
            data=data,
            content_type="multipart/form-data"
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["message"] == "Favicon uploaded successfully"
        assert "favicon_url" in data
        assert "file_checksum" in data
    
    def test_validate_subdomain(self, client, auth_headers):
        """Test POST /admin/branding/validate-subdomain endpoint."""
        subdomain_data = {
            "subdomain": "new-business"
        }
        
        response = client.post(
            "/api/v1/admin/branding/validate-subdomain",
            headers=auth_headers,
            json=subdomain_data
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["subdomain"] == "new-business"
        assert data["is_available"] is True
        assert data["message"] == "Subdomain is available"
    
    def test_validate_subdomain_taken(self, client, auth_headers):
        """Test POST /admin/branding/validate-subdomain with taken subdomain."""
        subdomain_data = {
            "subdomain": "test-business"
        }
        
        response = client.post(
            "/api/v1/admin/branding/validate-subdomain",
            headers=auth_headers,
            json=subdomain_data
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["subdomain"] == "test-business"
        assert data["is_available"] is False
        assert data["message"] == "Subdomain is already taken"
    
    def test_branding_unauthorized(self, client):
        """Test branding endpoints without authentication."""
        response = client.get("/api/v1/admin/branding")
        assert response.status_code == 401


class TestEmailBrandingIntegration:
    """Test email branding integration (Contract Test requirement)."""
    
    @pytest.fixture
    def app(self):
        """Create test app with database."""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def test_tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-business",
                tz="UTC"
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    def test_email_branding_includes_logo_and_colors(self, app, test_tenant):
        """Contract Test: Given tenant uploads new logo, When customer receives email, Then new logo appears in email."""
        with app.app_context():
            # Create branding service
            branding_service = BrandingService()
            
            # Upload logo
            file_content = b"fake logo content"
            logo_file = FileStorage(
                stream=BytesIO(file_content),
                filename="logo.png",
                content_type="image/png"
            )
            
            # Mock user for upload
            user_id = uuid.uuid4()
            logo_result = branding_service.upload_logo(test_tenant.id, logo_file, user_id)
            
            # Update colors
            branding_data = {
                "primary_color": "#FF0000",
                "secondary_color": "#00FF00"
            }
            branding_service.update_branding(test_tenant.id, branding_data, user_id)
            
            # Get branding for email
            email_branding_service = TenantBrandingService()
            email_branding = email_branding_service.get_tenant_branding(test_tenant.id)
            
            # Verify email includes logo and colors
            assert email_branding["logo_url"] == logo_result["logo_url"]
            assert email_branding["primary_color"] == "#FF0000"
            assert email_branding["secondary_color"] == "#00FF00"
            assert email_branding["tenant_name"] == "Test Business"
            assert email_branding["website_url"] == "https://test-business.tithi.com"
    
    def test_email_branding_template_application(self, app, test_tenant):
        """Test applying branding to email template."""
        with app.app_context():
            # Create branding
            branding_service = BrandingService()
            branding_data = {
                "primary_color": "#FF0000",
                "secondary_color": "#00FF00"
            }
            user_id = uuid.uuid4()
            branding_service.update_branding(test_tenant.id, branding_data, user_id)
            
            # Get branding for email
            email_branding_service = TenantBrandingService()
            email_branding = email_branding_service.get_tenant_branding(test_tenant.id)
            
            # Test template application
            template = """
            <html>
            <body style="color: {{primary_color}};">
                <img src="{{logo_url}}" alt="{{tenant_name}}">
                <h1>{{tenant_name}}</h1>
                <p>Visit us at {{website_url}}</p>
            </body>
            </html>
            """
            
            branded_template = email_branding_service.apply_branding_to_template(template, email_branding)
            
            assert "#FF0000" in branded_template
            assert "Test Business" in branded_template
            assert "https://test-business.tithi.com" in branded_template


class TestBrandingObservability:
    """Test branding observability hooks."""
    
    @pytest.fixture
    def app(self):
        """Create test app with database."""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def test_tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-business",
                tz="UTC"
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @patch('app.services.system.emit_event')
    def test_branding_update_emits_event(self, mock_emit_event, app, test_tenant):
        """Test that branding updates emit BRANDING_UPDATED event."""
        with app.app_context():
            branding_service = BrandingService()
            user_id = uuid.uuid4()
            
            branding_data = {
                "primary_color": "#FF0000",
                "secondary_color": "#00FF00"
            }
            
            branding_service.update_branding(test_tenant.id, branding_data, user_id)
            
            # Verify event was emitted
            mock_emit_event.assert_called_once()
            call_args = mock_emit_event.call_args
            assert call_args[1]["tenant_id"] == test_tenant.id
            assert call_args[1]["event_code"] == "BRANDING_UPDATED"
            assert call_args[1]["payload"]["user_id"] == str(user_id)
            assert "primary_color" in call_args[1]["payload"]["updated_fields"]
            assert "secondary_color" in call_args[1]["payload"]["updated_fields"]
    
    @patch('app.services.system.emit_event')
    def test_logo_upload_emits_event(self, mock_emit_event, app, test_tenant):
        """Test that logo upload emits BRANDING_UPDATED event."""
        with app.app_context():
            branding_service = BrandingService()
            user_id = uuid.uuid4()
            
            file_content = b"fake logo content"
            logo_file = FileStorage(
                stream=BytesIO(file_content),
                filename="logo.png",
                content_type="image/png"
            )
            
            branding_service.upload_logo(test_tenant.id, logo_file, user_id)
            
            # Verify event was emitted
            mock_emit_event.assert_called_once()
            call_args = mock_emit_event.call_args
            assert call_args[1]["tenant_id"] == test_tenant.id
            assert call_args[1]["event_code"] == "BRANDING_UPDATED"
            assert call_args[1]["payload"]["user_id"] == str(user_id)
            assert call_args[1]["payload"]["action"] == "logo_uploaded"
            assert "logo_url" in call_args[1]["payload"]
            assert "file_checksum" in call_args[1]["payload"]


class TestBrandingIdempotency:
    """Test branding idempotency requirements."""
    
    @pytest.fixture
    def app(self):
        """Create test app with database."""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def test_tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-business",
                tz="UTC"
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    def test_logo_upload_idempotency_by_checksum(self, app, test_tenant):
        """Test that logo upload is idempotent by checksum."""
        with app.app_context():
            branding_service = BrandingService()
            user_id = uuid.uuid4()
            
            # Upload same logo twice
            file_content = b"fake logo content"
            logo_file1 = FileStorage(
                stream=BytesIO(file_content),
                filename="logo.png",
                content_type="image/png"
            )
            logo_file2 = FileStorage(
                stream=BytesIO(file_content),
                filename="logo.png",
                content_type="image/png"
            )
            
            result1 = branding_service.upload_logo(test_tenant.id, logo_file1, user_id)
            result2 = branding_service.upload_logo(test_tenant.id, logo_file2, user_id)
            
            # Both uploads should have same checksum
            assert result1["file_checksum"] == result2["file_checksum"]
            assert result1["file_size"] == result2["file_size"]
            
            # Both should generate same URL (idempotent)
            assert result1["logo_url"] == result2["logo_url"]
    
    def test_branding_update_idempotency(self, app, test_tenant):
        """Test that branding updates are idempotent."""
        with app.app_context():
            branding_service = BrandingService()
            user_id = uuid.uuid4()
            
            branding_data = {
                "primary_color": "#FF0000",
                "secondary_color": "#00FF00"
            }
            
            # Update branding twice with same data
            result1 = branding_service.update_branding(test_tenant.id, branding_data, user_id)
            result2 = branding_service.update_branding(test_tenant.id, branding_data, user_id)
            
            # Both updates should return same result
            assert result1["primary_color"] == result2["primary_color"]
            assert result1["secondary_color"] == result2["secondary_color"]
            assert result1["tenant_slug"] == result2["tenant_slug"]


if __name__ == "__main__":
    pytest.main([__file__])
