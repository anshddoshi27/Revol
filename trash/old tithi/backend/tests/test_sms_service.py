"""
SMS Service Tests

This module provides comprehensive tests for SMS notification functionality.
Aligned with Task 7.2 requirements and contract tests.
"""

import pytest
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.exc import SQLAlchemyError

from app.services.sms_service import SMSService, SMSRequest, SMSResult, SMSErrorCode
from app.models.notification import Notification, NotificationChannel, NotificationStatus, NotificationPreference
from app.models.business import Customer
from app.models.system import EventOutbox
from app.models.core import Tenant
from app.exceptions import TithiError


class TestSMSService:
    """Test cases for SMS service."""
    
    @pytest.fixture
    def sms_service(self):
        """Create SMS service instance."""
        return SMSService()
    
    @pytest.fixture
    def sample_tenant(self):
        """Create sample tenant."""
        return Tenant(
            id=uuid.uuid4(),
            slug="test-tenant",
            tz="UTC"
        )
    
    @pytest.fixture
    def sample_customer(self, sample_tenant):
        """Create sample customer."""
        return Customer(
            id=uuid.uuid4(),
            tenant_id=sample_tenant.id,
            display_name="Test Customer",
            email="test@example.com",
            phone="+1234567890",
            marketing_opt_in=True
        )
    
    @pytest.fixture
    def sample_sms_request(self, sample_tenant, sample_customer):
        """Create sample SMS request."""
        return SMSRequest(
            tenant_id=sample_tenant.id,
            customer_id=sample_customer.id,
            phone="+1234567890",
            message="Test SMS message",
            event_type="booking_reminder"
        )
    
    def test_phone_validation_valid(self, sms_service):
        """Test valid phone number validation."""
        valid_phones = [
            "+1234567890",
            "+44123456789",
            "+8612345678901"
        ]
        
        for phone in valid_phones:
            assert sms_service._validate_phone_number(phone) is True
    
    def test_phone_validation_invalid(self, sms_service):
        """Test invalid phone number validation."""
        invalid_phones = [
            "1234567890",  # No +
            "+123",  # Too short
            "+abc1234567890",  # Contains letters
            "",  # Empty
            None  # None
        ]
        
        for phone in invalid_phones:
            assert sms_service._validate_phone_number(phone) is False
    
    @patch('app.services.sms_service.db.session')
    def test_validate_sms_opt_in_customer_opted_in(self, mock_db, sms_service, sample_tenant, sample_customer):
        """Test SMS opt-in validation for opted-in customer."""
        # Mock customer query
        mock_db.query.return_value.filter.return_value.first.return_value = sample_customer
        
        # Mock preference query (no explicit preferences)
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = sms_service._validate_sms_opt_in(sample_tenant.id, sample_customer.id)
        assert result is True
    
    @patch('app.services.sms_service.db.session')
    def test_validate_sms_opt_in_customer_opted_out(self, mock_db, sms_service, sample_tenant, sample_customer):
        """Test SMS opt-in validation for opted-out customer."""
        # Set customer as opted out
        sample_customer.marketing_opt_in = False
        
        # Mock customer query
        mock_db.query.return_value.filter.return_value.first.return_value = sample_customer
        
        # Mock preference query (no explicit preferences)
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = sms_service._validate_sms_opt_in(sample_tenant.id, sample_customer.id)
        assert result is False
    
    @patch('app.services.sms_service.db.session')
    def test_validate_sms_opt_in_explicit_preferences(self, mock_db, sms_service, sample_tenant, sample_customer):
        """Test SMS opt-in validation with explicit preferences."""
        # Create explicit preference
        preference = NotificationPreference(
            tenant_id=sample_tenant.id,
            user_type='customer',
            user_id=sample_customer.id,
            sms_enabled=False
        )
        
        # Mock customer query
        mock_db.query.return_value.filter.return_value.first.return_value = sample_customer
        
        # Mock preference query
        mock_db.query.return_value.filter.return_value.first.return_value = preference
        
        result = sms_service._validate_sms_opt_in(sample_tenant.id, sample_customer.id)
        assert result is False
    
    @patch('app.services.sms_service.db.session')
    def test_validate_sms_opt_in_no_customer_id(self, mock_db, sms_service, sample_tenant):
        """Test SMS opt-in validation for non-customer SMS."""
        result = sms_service._validate_sms_opt_in(sample_tenant.id, None)
        assert result is True
    
    @patch('app.services.sms_service.db.session')
    def test_create_notification_record(self, mock_db, sms_service, sample_sms_request):
        """Test notification record creation."""
        mock_notification = Mock()
        mock_db.session.add.return_value = None
        mock_db.session.commit.return_value = None
        
        with patch('app.services.sms_service.Notification', return_value=mock_notification):
            result = sms_service._create_notification_record(sample_sms_request)
            assert result == mock_notification
            mock_db.session.add.assert_called_once()
            mock_db.session.commit.assert_called_once()
    
    @patch('app.services.sms_service.Client')
    def test_send_via_twilio_success(self, mock_client_class, sms_service, sample_sms_request):
        """Test successful Twilio SMS sending."""
        # Mock Twilio client
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = "test_message_sid"
        mock_client.messages.create.return_value = mock_message
        mock_client_class.return_value = mock_client
        
        # Mock notification
        mock_notification = Mock()
        mock_notification.id = uuid.uuid4()
        
        # Mock Flask app config
        with patch('app.services.sms_service.current_app') as mock_app:
            mock_app.config.get.return_value = "+1234567890"
            sms_service.twilio_client = mock_client
            
            result = sms_service._send_via_twilio(sample_sms_request, mock_notification)
            
            assert result.success is True
            assert result.provider_message_id == "test_message_sid"
            mock_client.messages.create.assert_called_once()
    
    @patch('app.services.sms_service.Client')
    def test_send_via_twilio_retry_logic(self, mock_client_class, sms_service, sample_sms_request):
        """Test Twilio retry logic (2x retries)."""
        # Mock Twilio client that fails first two times, succeeds third time
        mock_client = Mock()
        mock_message = Mock()
        mock_message.sid = "test_message_sid"
        
        # First two calls fail, third succeeds
        mock_client.messages.create.side_effect = [
            Exception("Network error"),
            Exception("Network error"),
            mock_message
        ]
        mock_client_class.return_value = mock_client
        
        # Mock notification
        mock_notification = Mock()
        mock_notification.id = uuid.uuid4()
        
        # Mock Flask app config
        with patch('app.services.sms_service.current_app') as mock_app:
            mock_app.config.get.return_value = "+1234567890"
            sms_service.twilio_client = mock_client
            
            result = sms_service._send_via_twilio(sample_sms_request, mock_notification)
            
            assert result.success is True
            assert result.provider_message_id == "test_message_sid"
            assert mock_client.messages.create.call_count == 3
    
    @patch('app.services.sms_service.Client')
    def test_send_via_twilio_max_retries_exceeded(self, mock_client_class, sms_service, sample_sms_request):
        """Test Twilio max retries exceeded."""
        # Mock Twilio client that always fails
        mock_client = Mock()
        mock_client.messages.create.side_effect = Exception("Persistent error")
        mock_client_class.return_value = mock_client
        
        # Mock notification
        mock_notification = Mock()
        mock_notification.id = uuid.uuid4()
        
        # Mock Flask app config
        with patch('app.services.sms_service.current_app') as mock_app:
            mock_app.config.get.return_value = "+1234567890"
            sms_service.twilio_client = mock_client
            
            result = sms_service._send_via_twilio(sample_sms_request, mock_notification)
            
            assert result.success is False
            assert "Twilio error" in result.error_message
            assert result.error_code == SMSErrorCode.SMS_PROVIDER_ERROR
            assert mock_client.messages.create.call_count == 3  # 1 initial + 2 retries
    
    def test_simulate_sms_sending(self, sms_service, sample_sms_request):
        """Test simulated SMS sending for development."""
        mock_notification = Mock()
        mock_notification.id = uuid.uuid4()
        
        result = sms_service._simulate_sms_sending(sample_sms_request, mock_notification)
        
        assert result.success is True
        assert result.delivery_id == str(mock_notification.id)
        assert result.provider_message_id.startswith("sim_")
    
    @patch('app.services.sms_service.db.session')
    def test_update_notification_status_success(self, mock_db, sms_service):
        """Test notification status update for successful delivery."""
        mock_notification = Mock()
        mock_result = SMSResult(success=True, provider_message_id="test_sid")
        
        sms_service._update_notification_status(mock_notification, mock_result)
        
        assert mock_notification.status == NotificationStatus.SENT
        assert mock_notification.provider_message_id == "test_sid"
        mock_db.session.commit.assert_called_once()
    
    @patch('app.services.sms_service.db.session')
    def test_update_notification_status_failure(self, mock_db, sms_service):
        """Test notification status update for failed delivery."""
        mock_notification = Mock()
        mock_result = SMSResult(success=False, error_message="Test error")
        
        sms_service._update_notification_status(mock_notification, mock_result)
        
        assert mock_notification.status == NotificationStatus.FAILED
        assert mock_notification.failure_reason == "Test error"
        mock_db.session.commit.assert_called_once()
    
    @patch('app.services.sms_service.db.session')
    def test_emit_sms_event_success(self, mock_db, sms_service, sample_sms_request):
        """Test SMS event emission for successful delivery."""
        mock_result = SMSResult(success=True, delivery_id="test_delivery_id")
        
        sms_service._emit_sms_event(sample_sms_request, mock_result)
        
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()
        
        # Verify event was created
        call_args = mock_db.session.add.call_args[0][0]
        assert call_args.event_code == "SMS_SENT"
        assert call_args.tenant_id == sample_sms_request.tenant_id
    
    @patch('app.services.sms_service.db.session')
    def test_emit_sms_event_failure(self, mock_db, sms_service, sample_sms_request):
        """Test SMS event emission for failed delivery."""
        mock_result = SMSResult(success=False, error_message="Test error")
        
        sms_service._emit_sms_event(sample_sms_request, mock_result)
        
        mock_db.session.add.assert_called_once()
        mock_db.session.commit.assert_called_once()
        
        # Verify event was created
        call_args = mock_db.session.add.call_args[0][0]
        assert call_args.event_code == "SMS_FAILED"
        assert call_args.tenant_id == sample_sms_request.tenant_id
    
    def test_format_booking_reminder_message(self, sms_service):
        """Test booking reminder message formatting."""
        booking_details = {
            'service_name': 'Haircut',
            'start_time': '2:00 PM',
            'business_name': 'Salon ABC'
        }
        
        message = sms_service._format_booking_reminder_message(booking_details)
        
        assert "Haircut" in message
        assert "2:00 PM" in message
        assert "Salon ABC" in message
        assert "Reply STOP to opt out" in message
    
    def test_format_cancellation_message(self, sms_service):
        """Test cancellation message formatting."""
        booking_details = {
            'service_name': 'Haircut',
            'business_name': 'Salon ABC'
        }
        
        message = sms_service._format_cancellation_message(booking_details)
        
        assert "Haircut" in message
        assert "Salon ABC" in message
        assert "cancelled" in message
        assert "Reply STOP to opt out" in message
    
    def test_format_promotion_message(self, sms_service):
        """Test promotion message formatting."""
        promotion_details = {
            'title': 'Special Offer',
            'description': '20% off all services',
            'business_name': 'Salon ABC'
        }
        
        message = sms_service._format_promotion_message(promotion_details)
        
        assert "Salon ABC" in message
        assert "Special Offer" in message
        assert "20% off all services" in message
        assert "Reply STOP to opt out" in message
    
    @patch('app.services.sms_service.db.session')
    def test_get_sms_delivery_status_found(self, mock_db, sms_service):
        """Test getting SMS delivery status when notification exists."""
        mock_notification = Mock()
        mock_notification.id = "test_delivery_id"
        mock_notification.status = NotificationStatus.SENT
        mock_notification.sent_at = datetime.utcnow()
        mock_notification.provider_message_id = "test_sid"
        mock_notification.failure_reason = None
        
        mock_db.query.return_value.filter.return_value.first.return_value = mock_notification
        
        result = sms_service.get_sms_delivery_status("test_delivery_id")
        
        assert result is not None
        assert result["delivery_id"] == "test_delivery_id"
        assert result["status"] == "sent"
        assert result["provider_message_id"] == "test_sid"
    
    @patch('app.services.sms_service.db.session')
    def test_get_sms_delivery_status_not_found(self, mock_db, sms_service):
        """Test getting SMS delivery status when notification doesn't exist."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        result = sms_service.get_sms_delivery_status("nonexistent_id")
        
        assert result is None


class TestSMSIntegration:
    """Integration tests for SMS service."""
    
    @pytest.fixture
    def sms_service(self):
        """Create SMS service instance."""
        return SMSService()
    
    @patch('app.services.sms_service.db.session')
    @patch('app.services.sms_service.SMSService._send_via_twilio')
    def test_send_sms_full_flow_success(self, mock_send_twilio, mock_db, sms_service):
        """Test complete SMS sending flow with success."""
        # Mock successful Twilio sending
        mock_send_twilio.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Mock database operations
        mock_notification = Mock()
        mock_db.session.add.return_value = None
        mock_db.session.commit.return_value = None
        
        with patch('app.services.sms_service.Notification', return_value=mock_notification):
            request = SMSRequest(
                tenant_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                phone="+1234567890",
                message="Test message"
            )
            
            result = sms_service.send_sms(request)
            
            assert result.success is True
            assert result.delivery_id == "test_delivery_id"
            assert result.provider_message_id == "test_sid"
    
    @patch('app.services.sms_service.db.session')
    def test_send_sms_opt_out_validation(self, mock_db, sms_service):
        """Test SMS sending with opt-out validation."""
        # Mock customer query to return opted-out customer
        mock_customer = Mock()
        mock_customer.marketing_opt_in = False
        mock_db.query.return_value.filter.return_value.first.return_value = mock_customer
        
        request = SMSRequest(
            tenant_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            phone="+1234567890",
            message="Test message"
        )
        
        result = sms_service.send_sms(request)
        
        assert result.success is False
        assert result.error_code == SMSErrorCode.SMS_OPT_OUT
        assert "opted out" in result.error_message
    
    @patch('app.services.sms_service.db.session')
    def test_send_sms_invalid_phone(self, mock_db, sms_service):
        """Test SMS sending with invalid phone number."""
        request = SMSRequest(
            tenant_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            phone="invalid_phone",
            message="Test message"
        )
        
        result = sms_service.send_sms(request)
        
        assert result.success is False
        assert result.error_code == SMSErrorCode.SMS_INVALID_PHONE
        assert "Invalid phone number" in result.error_message


class TestSMSContractTests:
    """Contract tests for SMS service (black-box testing)."""
    
    @pytest.fixture
    def sms_service(self):
        """Create SMS service instance."""
        return SMSService()
    
    @patch('app.services.sms_service.db.session')
    def test_contract_unsubscribed_user_skips_delivery(self, mock_db, sms_service):
        """
        Contract Test: Given a user unsubscribed from SMS, 
        When a reminder scheduled, 
        Then system skips delivery.
        """
        # Mock customer query to return opted-out customer
        mock_customer = Mock()
        mock_customer.marketing_opt_in = False
        mock_db.query.return_value.filter.return_value.first.return_value = mock_customer
        
        request = SMSRequest(
            tenant_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            phone="+1234567890",
            message="Reminder: Your appointment is tomorrow",
            event_type="booking_reminder"
        )
        
        result = sms_service.send_sms(request)
        
        # Verify SMS was not sent
        assert result.success is False
        assert result.error_code == SMSErrorCode.SMS_OPT_OUT
        assert "opted out" in result.error_message
    
    @patch('app.services.sms_service.db.session')
    @patch('app.services.sms_service.SMSService._send_via_twilio')
    def test_contract_reminder_sms_sent_24h_before_booking(self, mock_send_twilio, mock_db, sms_service):
        """
        Contract Test: Reminder SMS sent 24h before booking.
        """
        # Mock successful Twilio sending
        mock_send_twilio.return_value = SMSResult(
            success=True,
            delivery_id="test_delivery_id",
            provider_message_id="test_sid"
        )
        
        # Mock database operations
        mock_customer = Mock()
        mock_customer.marketing_opt_in = True
        mock_db.query.return_value.filter.return_value.first.return_value = mock_customer
        
        mock_notification = Mock()
        mock_db.session.add.return_value = None
        mock_db.session.commit.return_value = None
        
        with patch('app.services.sms_service.Notification', return_value=mock_notification):
            # Schedule SMS for 24 hours from now
            scheduled_time = datetime.utcnow() + timedelta(hours=24)
            
            request = SMSRequest(
                tenant_id=uuid.uuid4(),
                customer_id=uuid.uuid4(),
                phone="+1234567890",
                message="Reminder: Your appointment is tomorrow at 2:00 PM",
                event_type="booking_reminder",
                scheduled_at=scheduled_time
            )
            
            result = sms_service.send_sms(request)
            
            # Verify SMS was sent successfully
            assert result.success is True
            assert result.delivery_id == "test_delivery_id"
            assert result.provider_message_id == "test_sid"
    
    def test_contract_sms_retries_2x_if_twilio_fails(self, sms_service):
        """
        Contract Test: SMS retries 2x if Twilio fails.
        """
        with patch('app.services.sms_service.Client') as mock_client_class:
            # Mock Twilio client that fails first two times, succeeds third time
            mock_client = Mock()
            mock_message = Mock()
            mock_message.sid = "test_message_sid"
            
            # First two calls fail, third succeeds
            mock_client.messages.create.side_effect = [
                Exception("Network error"),
                Exception("Network error"),
                mock_message
            ]
            mock_client_class.return_value = mock_client
            
            # Mock notification
            mock_notification = Mock()
            mock_notification.id = uuid.uuid4()
            
            # Mock Flask app config
            with patch('app.services.sms_service.current_app') as mock_app:
                mock_app.config.get.return_value = "+1234567890"
                sms_service.twilio_client = mock_client
                
                request = SMSRequest(
                    tenant_id=uuid.uuid4(),
                    customer_id=uuid.uuid4(),
                    phone="+1234567890",
                    message="Test message"
                )
                
                result = sms_service._send_via_twilio(request, mock_notification)
                
                # Verify retry logic: 1 initial + 2 retries = 3 total calls
                assert mock_client.messages.create.call_count == 3
                assert result.success is True
                assert result.provider_message_id == "test_message_sid"


class TestSMSNorthStarInvariants:
    """Test North-Star invariants for SMS service."""
    
    @pytest.fixture
    def sms_service(self):
        """Create SMS service instance."""
        return SMSService()
    
    @patch('app.services.sms_service.db.session')
    def test_north_star_sms_always_respects_opt_in(self, mock_db, sms_service):
        """
        North-Star Invariant: SMS must always respect opt-in.
        """
        # Test with opted-out customer
        mock_customer = Mock()
        mock_customer.marketing_opt_in = False
        mock_db.query.return_value.filter.return_value.first.return_value = mock_customer
        
        request = SMSRequest(
            tenant_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            phone="+1234567890",
            message="Test message"
        )
        
        result = sms_service.send_sms(request)
        
        # Verify SMS was blocked due to opt-out
        assert result.success is False
        assert result.error_code == SMSErrorCode.SMS_OPT_OUT
    
    @patch('app.services.sms_service.db.session')
    def test_north_star_unsubscribed_customers_never_contacted(self, mock_db, sms_service):
        """
        North-Star Invariant: Unsubscribed customers never contacted.
        """
        # Test with explicit SMS opt-out preference
        mock_preference = Mock()
        mock_preference.sms_enabled = False
        
        mock_customer = Mock()
        mock_customer.marketing_opt_in = True  # Marketing opt-in is True
        
        # Mock database queries
        def mock_query_side_effect(*args, **kwargs):
            query_mock = Mock()
            filter_mock = Mock()
            first_mock = Mock()
            
            # Return customer for first query, preference for second query
            if mock_db.query.call_count == 1:
                first_mock.return_value = mock_customer
            else:
                first_mock.return_value = mock_preference
            
            filter_mock.first = first_mock
            query_mock.filter = filter_mock
            return query_mock
        
        mock_db.query.side_effect = mock_query_side_effect
        
        request = SMSRequest(
            tenant_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            phone="+1234567890",
            message="Test message"
        )
        
        result = sms_service.send_sms(request)
        
        # Verify SMS was blocked due to explicit opt-out
        assert result.success is False
        assert result.error_code == SMSErrorCode.SMS_OPT_OUT
