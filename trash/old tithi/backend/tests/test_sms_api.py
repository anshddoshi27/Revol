"""
SMS API Tests

This module provides comprehensive tests for SMS API endpoints.
Aligned with Task 7.2 requirements and API contract testing.
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from app.services.sms_service import SMSResult, SMSErrorCode


class TestSMSAPI:
    """Test cases for SMS API endpoints."""
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self):
        """Create authentication headers."""
        return {
            'Authorization': 'Bearer test_token',
            'Content-Type': 'application/json'
        }
    
    @pytest.fixture
    def sample_tenant(self):
        """Create sample tenant."""
        return {
            'id': str(uuid.uuid4()),
            'slug': 'test-tenant',
            'tz': 'UTC'
        }
    
    @pytest.fixture
    def sample_customer(self):
        """Create sample customer."""
        return {
            'id': str(uuid.uuid4()),
            'tenant_id': str(uuid.uuid4()),
            'display_name': 'Test Customer',
            'email': 'test@example.com',
            'phone': '+1234567890',
            'marketing_opt_in': True
        }
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_send_sms_success(self, mock_sms_service_class, mock_get_user, mock_get_tenant, 
                             client, auth_headers, sample_tenant, sample_customer):
        """Test successful SMS sending."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_sms.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Test data
        sms_data = {
            'customer_id': sample_customer['id'],
            'phone': '+1234567890',
            'message': 'Test SMS message',
            'event_type': 'booking_reminder'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['delivery_id'] == "test_delivery_id"
        assert data['provider_message_id'] == "test_sid"
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_send_sms_opt_out_error(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                   client, auth_headers, sample_tenant, sample_customer):
        """Test SMS sending with opt-out error."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_sms.return_value = SMSResult(
            success=False,
            error_code=SMSErrorCode.SMS_OPT_OUT,
            error_message="Customer has opted out of SMS notifications"
        )
        
        # Test data
        sms_data = {
            'customer_id': sample_customer['id'],
            'phone': '+1234567890',
            'message': 'Test SMS message'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 403
        data = json.loads(response.data)
        assert "opted out" in data['message']
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    def test_send_sms_invalid_phone(self, mock_get_user, mock_get_tenant, client, auth_headers, sample_tenant):
        """Test SMS sending with invalid phone number."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Test data with invalid phone
        sms_data = {
            'phone': 'invalid_phone',
            'message': 'Test SMS message'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "phone" in data['message'].lower()
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_send_booking_reminder_success(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                         client, auth_headers, sample_tenant, sample_customer):
        """Test successful booking reminder SMS."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_booking_reminder.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Test data
        reminder_data = {
            'customer_id': sample_customer['id'],
            'phone': '+1234567890',
            'service_name': 'Haircut',
            'start_time': '2:00 PM',
            'business_name': 'Salon ABC'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/booking-reminder',
            headers=auth_headers,
            data=json.dumps(reminder_data)
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['delivery_id'] == "test_delivery_id"
        assert data['provider_message_id'] == "test_sid"
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_send_cancellation_notification_success(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                                   client, auth_headers, sample_tenant, sample_customer):
        """Test successful cancellation notification SMS."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_cancellation_notification.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Test data
        cancellation_data = {
            'customer_id': sample_customer['id'],
            'phone': '+1234567890',
            'service_name': 'Haircut',
            'business_name': 'Salon ABC'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/cancellation',
            headers=auth_headers,
            data=json.dumps(cancellation_data)
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['delivery_id'] == "test_delivery_id"
        assert data['provider_message_id'] == "test_sid"
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_send_promotion_sms_success(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                       client, auth_headers, sample_tenant, sample_customer):
        """Test successful promotion SMS."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_promotion_sms.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Test data
        promotion_data = {
            'customer_id': sample_customer['id'],
            'phone': '+1234567890',
            'title': 'Special Offer',
            'description': '20% off all services',
            'business_name': 'Salon ABC'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/promotion',
            headers=auth_headers,
            data=json.dumps(promotion_data)
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['delivery_id'] == "test_delivery_id"
        assert data['provider_message_id'] == "test_sid"
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_get_sms_status_success(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                   client, auth_headers, sample_tenant):
        """Test successful SMS status retrieval."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.get_sms_delivery_status.return_value = {
            'delivery_id': 'test_delivery_id',
            'status': 'sent',
            'sent_at': '2025-01-27T10:00:00Z',
            'provider_message_id': 'test_sid',
            'failure_reason': None
        }
        
        response = client.get(
            '/api/v1/notifications/sms/status/test_delivery_id',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['delivery_id'] == 'test_delivery_id'
        assert data['status'] == 'sent'
        assert data['provider_message_id'] == 'test_sid'
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_get_sms_status_not_found(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                     client, auth_headers, sample_tenant):
        """Test SMS status retrieval when delivery not found."""
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=sample_tenant['id'])
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.get_sms_delivery_status.return_value = None
        
        response = client.get(
            '/api/v1/notifications/sms/status/nonexistent_id',
            headers=auth_headers
        )
        
        assert response.status_code == 404
        data = json.loads(response.data)
        assert "not found" in data['message']
    
    def test_send_sms_unauthorized(self, client):
        """Test SMS sending without authentication."""
        sms_data = {
            'phone': '+1234567890',
            'message': 'Test SMS message'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 401
    
    def test_send_sms_missing_required_fields(self, client, auth_headers):
        """Test SMS sending with missing required fields."""
        sms_data = {
            'phone': '+1234567890'
            # Missing 'message' field
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 400
    
    def test_send_sms_message_too_long(self, client, auth_headers):
        """Test SMS sending with message too long."""
        sms_data = {
            'phone': '+1234567890',
            'message': 'x' * 1601  # Exceeds 1600 character limit
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 400
    
    def test_send_sms_phone_too_short(self, client, auth_headers):
        """Test SMS sending with phone number too short."""
        sms_data = {
            'phone': '+123',  # Too short
            'message': 'Test message'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response.status_code == 400


class TestSMSAPIContractTests:
    """Contract tests for SMS API (black-box testing)."""
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self):
        """Create authentication headers."""
        return {
            'Authorization': 'Bearer test_token',
            'Content-Type': 'application/json'
        }
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_contract_unsubscribed_user_skips_delivery_api(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                                          client, auth_headers):
        """
        Contract Test: Given a user unsubscribed from SMS, 
        When a reminder scheduled via API, 
        Then system skips delivery.
        """
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=str(uuid.uuid4()))
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service to return opt-out error
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_sms.return_value = SMSResult(
            success=False,
            error_code=SMSErrorCode.SMS_OPT_OUT,
            error_message="Customer has opted out of SMS notifications"
        )
        
        # Test data
        sms_data = {
            'customer_id': str(uuid.uuid4()),
            'phone': '+1234567890',
            'message': 'Reminder: Your appointment is tomorrow',
            'event_type': 'booking_reminder'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        # Verify SMS was not sent
        assert response.status_code == 403
        data = json.loads(response.data)
        assert "opted out" in data['message']
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_contract_reminder_sms_sent_24h_before_booking_api(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                                              client, auth_headers):
        """
        Contract Test: Reminder SMS sent 24h before booking via API.
        """
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=str(uuid.uuid4()))
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_booking_reminder.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Test data
        reminder_data = {
            'customer_id': str(uuid.uuid4()),
            'phone': '+1234567890',
            'service_name': 'Haircut',
            'start_time': '2:00 PM',
            'business_name': 'Salon ABC'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/booking-reminder',
            headers=auth_headers,
            data=json.dumps(reminder_data)
        )
        
        # Verify SMS was sent successfully
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['delivery_id'] == "test_delivery_id"
        assert data['provider_message_id'] == "test_sid"
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_contract_sms_retries_2x_if_twilio_fails_api(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                                        client, auth_headers):
        """
        Contract Test: SMS retries 2x if Twilio fails via API.
        """
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=str(uuid.uuid4()))
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service to simulate retry logic
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        
        # First call fails, second succeeds (simulating retry)
        mock_sms_service.send_sms.side_effect = [
            SMSResult(success=False, error_code=SMSErrorCode.SMS_PROVIDER_ERROR),
            SMSResult(success=True, delivery_id="test_delivery_id", provider_message_id="test_sid")
        ]
        
        # Test data
        sms_data = {
            'phone': '+1234567890',
            'message': 'Test message'
        }
        
        # First request should fail
        response1 = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response1.status_code == 502  # Provider error
        
        # Second request should succeed (simulating retry)
        response2 = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        assert response2.status_code == 200
        data = json.loads(response2.data)
        assert data['success'] is True
        assert data['delivery_id'] == "test_delivery_id"


class TestSMSAPINorthStarInvariants:
    """Test North-Star invariants for SMS API."""
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self):
        """Create authentication headers."""
        return {
            'Authorization': 'Bearer test_token',
            'Content-Type': 'application/json'
        }
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_north_star_sms_always_respects_opt_in_api(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                                      client, auth_headers):
        """
        North-Star Invariant: SMS must always respect opt-in via API.
        """
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=str(uuid.uuid4()))
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service to return opt-out error
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_sms.return_value = SMSResult(
            success=False,
            error_code=SMSErrorCode.SMS_OPT_OUT,
            error_message="Customer has opted out of SMS notifications"
        )
        
        # Test data
        sms_data = {
            'customer_id': str(uuid.uuid4()),
            'phone': '+1234567890',
            'message': 'Test message'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/send',
            headers=auth_headers,
            data=json.dumps(sms_data)
        )
        
        # Verify SMS was blocked due to opt-out
        assert response.status_code == 403
        data = json.loads(response.data)
        assert "opted out" in data['message']
    
    @patch('app.blueprints.sms_api.get_current_tenant')
    @patch('app.blueprints.sms_api.get_current_user')
    @patch('app.blueprints.sms_api.SMSService')
    def test_north_star_unsubscribed_customers_never_contacted_api(self, mock_sms_service_class, mock_get_user, mock_get_tenant,
                                                                  client, auth_headers):
        """
        North-Star Invariant: Unsubscribed customers never contacted via API.
        """
        # Mock authentication
        mock_get_tenant.return_value = Mock(id=str(uuid.uuid4()))
        mock_get_user.return_value = Mock(id=str(uuid.uuid4()))
        
        # Mock SMS service to return opt-out error
        mock_sms_service = Mock()
        mock_sms_service_class.return_value = mock_sms_service
        mock_sms_service.send_promotion_sms.return_value = SMSResult(
            success=False,
            error_code=SMSErrorCode.SMS_OPT_OUT,
            error_message="Customer has opted out of SMS notifications"
        )
        
        # Test data for promotion SMS
        promotion_data = {
            'customer_id': str(uuid.uuid4()),
            'phone': '+1234567890',
            'title': 'Special Offer',
            'description': '20% off all services',
            'business_name': 'Salon ABC'
        }
        
        response = client.post(
            '/api/v1/notifications/sms/promotion',
            headers=auth_headers,
            data=json.dumps(promotion_data)
        )
        
        # Verify SMS was blocked due to opt-out
        assert response.status_code == 403
        data = json.loads(response.data)
        assert "opted out" in data['message']
