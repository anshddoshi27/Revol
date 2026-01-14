"""
Test Suite for Timezone Handling (Task 11.3)

This module contains comprehensive tests for the timezone handling system,
including conversion helpers, tenant timezone management, and API endpoints.
"""

import pytest
import uuid
import json
from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch, MagicMock

from app import create_app
from app.models.core import Tenant
from app.services.timezone_service import TimezoneService, timezone_service
from app.extensions import db


class TestTimezoneService:
    """Test cases for TimezoneService."""
    
    @pytest.fixture
    def app(self):
        """Create test application."""
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
    def tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug='test-salon',
                tz='America/New_York',
                trust_copy_json={},
                is_public_directory=False
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @pytest.fixture
    def timezone_service_instance(self):
        """Create timezone service instance."""
        return TimezoneService()
    
    def test_get_tenant_timezone_success(self, app, tenant, timezone_service_instance):
        """Test successful tenant timezone retrieval."""
        with app.app_context():
            tz = timezone_service_instance.get_tenant_timezone(str(tenant.id))
            assert str(tz) == 'America/New_York'
    
    def test_get_tenant_timezone_not_found(self, app, timezone_service_instance):
        """Test tenant timezone retrieval with non-existent tenant."""
        with app.app_context():
            with pytest.raises(Exception) as exc_info:
                timezone_service_instance.get_tenant_timezone(str(uuid.uuid4()))
            assert "Tenant not found" in str(exc_info.value)
    
    def test_get_tenant_timezone_invalid_timezone(self, app, tenant, timezone_service_instance):
        """Test tenant timezone retrieval with invalid timezone."""
        with app.app_context():
            # Update tenant with invalid timezone
            tenant.tz = 'Invalid/Timezone'
            db.session.commit()
            
            with pytest.raises(Exception) as exc_info:
                timezone_service_instance.get_tenant_timezone(str(tenant.id))
            assert "TITHI_TIMEZONE_INVALID" in str(exc_info.value)
    
    def test_convert_to_tenant_timezone_success(self, app, tenant, timezone_service_instance):
        """Test successful UTC to tenant timezone conversion."""
        with app.app_context():
            # Test conversion: 9am EST -> 14:00 UTC
            utc_datetime = datetime(2025, 1, 27, 14, 0, 0, tzinfo=dt_timezone.utc)
            tenant_datetime = timezone_service_instance.convert_to_tenant_timezone(
                utc_datetime, str(tenant.id)
            )
            
            # Should be 9am EST (UTC-5)
            assert tenant_datetime.hour == 9
            assert tenant_datetime.minute == 0
            assert str(tenant_datetime.tzinfo) == 'America/New_York'
    
    def test_convert_to_utc_success(self, app, tenant, timezone_service_instance):
        """Test successful tenant timezone to UTC conversion."""
        with app.app_context():
            # Test conversion: 9am EST -> 14:00 UTC
            tenant_datetime = datetime(2025, 1, 27, 9, 0, 0)  # Naive datetime
            utc_datetime = timezone_service_instance.convert_to_utc(
                tenant_datetime, str(tenant.id)
            )
            
            # Should be 14:00 UTC
            assert utc_datetime.hour == 14
            assert utc_datetime.minute == 0
            assert utc_datetime.tzinfo == dt_timezone.utc
    
    def test_convert_to_utc_with_timezone_info(self, app, tenant, timezone_service_instance):
        """Test UTC conversion with datetime that already has timezone info."""
        with app.app_context():
            # Create datetime with timezone info
            import pytz
            est = pytz.timezone('America/New_York')
            tenant_datetime = est.localize(datetime(2025, 1, 27, 9, 0, 0))
            
            utc_datetime = timezone_service_instance.convert_to_utc(
                tenant_datetime, str(tenant.id)
            )
            
            # Should be 14:00 UTC
            assert utc_datetime.hour == 14
            assert utc_datetime.minute == 0
            assert utc_datetime.tzinfo == dt_timezone.utc
    
    def test_update_tenant_timezone_success(self, app, tenant, timezone_service_instance):
        """Test successful tenant timezone update."""
        with app.app_context():
            result = timezone_service_instance.update_tenant_timezone(
                str(tenant.id), 'America/Los_Angeles'
            )
            
            assert result['tenant_id'] == str(tenant.id)
            assert result['old_timezone'] == 'America/New_York'
            assert result['new_timezone'] == 'America/Los_Angeles'
            
            # Verify database update
            updated_tenant = Tenant.query.get(tenant.id)
            assert updated_tenant.tz == 'America/Los_Angeles'
    
    def test_update_tenant_timezone_invalid(self, app, tenant, timezone_service_instance):
        """Test tenant timezone update with invalid timezone."""
        with app.app_context():
            with pytest.raises(Exception) as exc_info:
                timezone_service_instance.update_tenant_timezone(
                    str(tenant.id), 'Invalid/Timezone'
                )
            assert "TITHI_TIMEZONE_INVALID" in str(exc_info.value)
    
    def test_validate_timezone_success(self, app, timezone_service_instance):
        """Test successful timezone validation."""
        with app.app_context():
            result = timezone_service_instance.validate_timezone('America/New_York')
            
            assert result['valid'] is True
            assert result['timezone'] == 'America/New_York'
            assert 'utc_offset' in result
            assert 'dst_active' in result
            assert 'current_time' in result
            assert 'utc_time' in result
    
    def test_validate_timezone_invalid(self, app, timezone_service_instance):
        """Test timezone validation with invalid timezone."""
        with app.app_context():
            with pytest.raises(Exception) as exc_info:
                timezone_service_instance.validate_timezone('Invalid/Timezone')
            assert "TITHI_TIMEZONE_INVALID" in str(exc_info.value)
    
    def test_validate_timezone_common_alias(self, app, timezone_service_instance):
        """Test timezone validation with common alias."""
        with app.app_context():
            result = timezone_service_instance.validate_timezone('EST')
            
            assert result['valid'] is True
            assert result['timezone'] == 'EST'
    
    def test_get_available_timezones(self, app, timezone_service_instance):
        """Test getting available timezones."""
        with app.app_context():
            timezones = timezone_service_instance.get_available_timezones()
            
            assert isinstance(timezones, list)
            assert len(timezones) > 0
            
            # Check that common timezones are included
            common_tz_names = [tz['name'] for tz in timezones]
            assert 'America/New_York' in common_tz_names
            assert 'America/Los_Angeles' in common_tz_names
            assert 'UTC' in common_tz_names
    
    def test_parse_timezone_common_aliases(self, app, timezone_service_instance):
        """Test parsing common timezone aliases."""
        with app.app_context():
            # Test common aliases
            assert str(timezone_service_instance._parse_timezone('EST')) == 'America/New_York'
            assert str(timezone_service_instance._parse_timezone('PST')) == 'America/Los_Angeles'
            assert str(timezone_service_instance._parse_timezone('UTC')) == 'UTC'
            assert str(timezone_service_instance._parse_timezone('utc')) == 'UTC'
    
    def test_parse_timezone_invalid(self, app, timezone_service_instance):
        """Test parsing invalid timezone."""
        with app.app_context():
            with pytest.raises(ValueError) as exc_info:
                timezone_service_instance._parse_timezone('Invalid/Timezone')
            assert "Unknown timezone" in str(exc_info.value)


class TestTimezoneAPI:
    """Test cases for timezone API endpoints."""
    
    @pytest.fixture
    def app(self):
        """Create test application."""
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
    def tenant(self, app):
        """Create test tenant."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug='test-salon',
                tz='America/New_York',
                trust_copy_json={},
                is_public_directory=False
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    @pytest.fixture
    def auth_headers(self):
        """Create mock auth headers."""
        return {
            'Authorization': 'Bearer mock-jwt-token',
            'Content-Type': 'application/json'
        }
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_convert_timezone_to_tenant_success(self, mock_verify, client, tenant, auth_headers):
        """Test successful timezone conversion to tenant timezone."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(tenant.id),
            'roles': ['owner']
        }
        
        data = {
            'datetime': '2025-01-27T14:00:00Z',
            'tenant_id': str(tenant.id),
            'conversion_type': 'to_tenant'
        }
        
        response = client.post(
            '/api/v1/timezone/convert',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        
        assert 'original_datetime' in result
        assert 'converted_datetime' in result
        assert result['conversion_type'] == 'to_tenant'
        assert result['tenant_id'] == str(tenant.id)
        assert result['timezone'] == 'America/New_York'
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_convert_timezone_to_utc_success(self, mock_verify, client, tenant, auth_headers):
        """Test successful timezone conversion to UTC."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(tenant.id),
            'roles': ['owner']
        }
        
        data = {
            'datetime': '2025-01-27T09:00:00',
            'tenant_id': str(tenant.id),
            'conversion_type': 'to_utc'
        }
        
        response = client.post(
            '/api/v1/timezone/convert',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        
        assert 'original_datetime' in result
        assert 'converted_datetime' in result
        assert result['conversion_type'] == 'to_utc'
        assert result['tenant_id'] == str(tenant.id)
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_convert_timezone_invalid_data(self, mock_verify, client, auth_headers):
        """Test timezone conversion with invalid data."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(uuid.uuid4()),
            'roles': ['owner']
        }
        
        data = {
            'datetime': 'invalid-datetime',
            'tenant_id': 'invalid-uuid',
            'conversion_type': 'invalid_type'
        }
        
        response = client.post(
            '/api/v1/timezone/convert',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 400
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_update_tenant_timezone_success(self, mock_verify, client, tenant, auth_headers):
        """Test successful tenant timezone update."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(tenant.id),
            'roles': ['owner']
        }
        
        data = {
            'timezone': 'America/Los_Angeles'
        }
        
        response = client.put(
            f'/api/v1/timezone/tenant/{tenant.id}',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        
        assert result['tenant_id'] == str(tenant.id)
        assert result['old_timezone'] == 'America/New_York'
        assert result['new_timezone'] == 'America/Los_Angeles'
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_update_tenant_timezone_invalid_timezone(self, mock_verify, client, tenant, auth_headers):
        """Test tenant timezone update with invalid timezone."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(tenant.id),
            'roles': ['owner']
        }
        
        data = {
            'timezone': 'Invalid/Timezone'
        }
        
        response = client.put(
            f'/api/v1/timezone/tenant/{tenant.id}',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 400
        result = response.get_json()
        assert 'TITHI_TIMEZONE_INVALID' in result.get('code', '')
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_update_tenant_timezone_insufficient_permissions(self, mock_verify, client, tenant, auth_headers):
        """Test tenant timezone update with insufficient permissions."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(tenant.id),
            'roles': ['staff']  # Not owner or admin
        }
        
        data = {
            'timezone': 'America/Los_Angeles'
        }
        
        response = client.put(
            f'/api/v1/timezone/tenant/{tenant.id}',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 403
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_validate_timezone_success(self, mock_verify, client, auth_headers):
        """Test successful timezone validation."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(uuid.uuid4()),
            'roles': ['owner']
        }
        
        data = {
            'timezone': 'America/New_York'
        }
        
        response = client.post(
            '/api/v1/timezone/validate',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        
        assert result['valid'] is True
        assert result['timezone'] == 'America/New_York'
        assert 'utc_offset' in result
        assert 'dst_active' in result
        assert 'current_time' in result
        assert 'utc_time' in result
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_validate_timezone_invalid(self, mock_verify, client, auth_headers):
        """Test timezone validation with invalid timezone."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(uuid.uuid4()),
            'roles': ['owner']
        }
        
        data = {
            'timezone': 'Invalid/Timezone'
        }
        
        response = client.post(
            '/api/v1/timezone/validate',
            data=json.dumps(data),
            headers=auth_headers
        )
        
        assert response.status_code == 400
        result = response.get_json()
        assert 'TITHI_TIMEZONE_INVALID' in result.get('code', '')
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_get_available_timezones_success(self, mock_verify, client, auth_headers):
        """Test successful retrieval of available timezones."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(uuid.uuid4()),
            'roles': ['owner']
        }
        
        response = client.get(
            '/api/v1/timezone/available',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        
        assert 'timezones' in result
        assert 'count' in result
        assert isinstance(result['timezones'], list)
        assert len(result['timezones']) > 0
        
        # Check that common timezones are included
        tz_names = [tz['name'] for tz in result['timezones']]
        assert 'America/New_York' in tz_names
        assert 'America/Los_Angeles' in tz_names
        assert 'UTC' in tz_names
    
    @patch('app.middleware.auth_middleware.verify_jwt_token')
    def test_get_tenant_current_time_success(self, mock_verify, client, tenant, auth_headers):
        """Test successful retrieval of current time in tenant timezone."""
        mock_verify.return_value = {
            'sub': str(uuid.uuid4()),
            'tenant_id': str(tenant.id),
            'roles': ['owner']
        }
        
        response = client.get(
            f'/api/v1/timezone/tenant/{tenant.id}/current',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.get_json()
        
        assert result['tenant_id'] == str(tenant.id)
        assert result['timezone'] == 'America/New_York'
        assert 'utc_time' in result
        assert 'tenant_time' in result
        assert 'utc_offset' in result
        assert 'dst_active' in result


class TestTimezoneContractTests:
    """Contract tests for timezone handling as specified in task requirements."""
    
    @pytest.fixture
    def app(self):
        """Create test application."""
        app = create_app('testing')
        with app.app_context():
            db.create_all()
            yield app
            db.drop_all()
    
    @pytest.fixture
    def tenant_pst(self, app):
        """Create test tenant in PST timezone."""
        with app.app_context():
            tenant = Tenant(
                id=uuid.uuid4(),
                slug='test-salon-pst',
                tz='America/Los_Angeles',  # PST
                trust_copy_json={},
                is_public_directory=False
            )
            db.session.add(tenant)
            db.session.commit()
            return tenant
    
    def test_contract_test_booking_at_9am_pst_stored_as_17_00_utc(self, app, tenant_pst):
        """Contract test: Given tenant in PST, When booking at 9am PST, Then stored datetime = 17:00 UTC."""
        with app.app_context():
            # This is the exact contract test specified in the task
            # Given tenant in PST
            assert tenant_pst.tz == 'America/Los_Angeles'
            
            # When booking at 9am PST
            booking_time_pst = datetime(2025, 1, 27, 9, 0, 0)  # 9am PST (naive)
            
            # Convert to UTC using timezone service
            utc_datetime = timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
            
            # Then stored datetime = 17:00 UTC
            assert utc_datetime.hour == 17  # 17:00 UTC
            assert utc_datetime.minute == 0
            assert utc_datetime.tzinfo == dt_timezone.utc
            
            # Verify the conversion is deterministic
            utc_datetime_2 = timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
            assert utc_datetime == utc_datetime_2
    
    def test_contract_test_dst_edge_cases(self, app, tenant_pst):
        """Contract test: Timezone handling must pass DST edge cases."""
        with app.app_context():
            # Test DST transition (spring forward)
            # March 10, 2024 2:00 AM PST -> 3:00 AM PDT
            dst_transition_pst = datetime(2024, 3, 10, 2, 30, 0)  # 2:30 AM PST
            
            # This should convert to 10:30 AM UTC (PST is UTC-8)
            utc_datetime = timezone_service.convert_to_utc(dst_transition_pst, str(tenant_pst.id))
            assert utc_datetime.hour == 10
            assert utc_datetime.minute == 30
            
            # Test DST transition (fall back)
            # November 3, 2024 2:00 AM PDT -> 1:00 AM PST
            dst_transition_pdt = datetime(2024, 11, 3, 1, 30, 0)  # 1:30 AM PST
            
            # This should convert to 9:30 AM UTC (PST is UTC-8)
            utc_datetime = timezone_service.convert_to_utc(dst_transition_pdt, str(tenant_pst.id))
            assert utc_datetime.hour == 9
            assert utc_datetime.minute == 30
    
    def test_contract_test_conversion_correctness(self, app, tenant_pst):
        """Contract test: Conversion correct - round trip conversion maintains accuracy."""
        with app.app_context():
            # Test round-trip conversion
            original_utc = datetime(2025, 1, 27, 17, 0, 0, tzinfo=dt_timezone.utc)
            
            # Convert to tenant timezone
            tenant_time = timezone_service.convert_to_tenant_timezone(original_utc, str(tenant_pst.id))
            
            # Convert back to UTC
            back_to_utc = timezone_service.convert_to_utc(tenant_time, str(tenant_pst.id))
            
            # Should be the same (within 1 second due to DST handling)
            time_diff = abs((back_to_utc - original_utc).total_seconds())
            assert time_diff < 1.0  # Allow for DST transitions
    
    def test_contract_test_deterministic_conversions(self, app, tenant_pst):
        """Contract test: Conversions deterministic - same input always produces same output."""
        with app.app_context():
            # Test deterministic conversion
            booking_time_pst = datetime(2025, 1, 27, 9, 0, 0)
            
            # Multiple conversions should produce identical results
            utc_1 = timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
            utc_2 = timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
            utc_3 = timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
            
            assert utc_1 == utc_2 == utc_3
    
    def test_contract_test_observability_hooks(self, app, tenant_pst):
        """Contract test: Observability hooks emit TIMEZONE_CONVERTED."""
        with app.app_context():
            # Test that observability hooks are emitted
            with patch('app.services.timezone_service.logger') as mock_logger:
                booking_time_pst = datetime(2025, 1, 27, 9, 0, 0)
                
                # Perform conversion
                timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
                
                # Verify observability hook was called
                mock_logger.info.assert_called()
                log_calls = [call.args[0] for call in mock_logger.info.call_args_list]
                assert any('TIMEZONE_CONVERTED' in call for call in log_calls)
    
    def test_contract_test_error_model_enforcement(self, app):
        """Contract test: Error model enforcement - TITHI_TIMEZONE_INVALID for invalid timezones."""
        with app.app_context():
            # Test invalid timezone handling
            with pytest.raises(Exception) as exc_info:
                timezone_service.validate_timezone('Invalid/Timezone')
            
            # Should raise TITHI_TIMEZONE_INVALID error
            assert 'TITHI_TIMEZONE_INVALID' in str(exc_info.value)
    
    def test_contract_test_idempotency_retry_guarantee(self, app, tenant_pst):
        """Contract test: Idempotency & retry guarantee - conversions deterministic."""
        with app.app_context():
            # Test that retries don't cause issues
            booking_time_pst = datetime(2025, 1, 27, 9, 0, 0)
            
            # Simulate retry scenario
            results = []
            for _ in range(5):
                utc_result = timezone_service.convert_to_utc(booking_time_pst, str(tenant_pst.id))
                results.append(utc_result)
            
            # All results should be identical
            assert all(result == results[0] for result in results)
