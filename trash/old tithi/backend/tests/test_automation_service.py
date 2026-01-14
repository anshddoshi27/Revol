"""
Test Automation Service
Comprehensive tests for automated reminders and campaigns
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

from app.services.automation_service import AutomationService
from app.models.automation import Automation, AutomationExecution, AutomationStatus, AutomationTrigger, AutomationAction
from app.models.business import Booking, Customer
from app.models.core import Tenant
from app.middleware.error_handler import TithiError


class TestAutomationService:
    """Test cases for AutomationService."""
    
    @pytest.fixture
    def automation_service(self):
        """Create automation service instance."""
        return AutomationService()
    
    @pytest.fixture
    def sample_tenant_id(self):
        """Sample tenant ID for testing."""
        return str(uuid.uuid4())
    
    @pytest.fixture
    def sample_user_id(self):
        """Sample user ID for testing."""
        return str(uuid.uuid4())
    
    @pytest.fixture
    def sample_automation_data(self, sample_tenant_id):
        """Sample automation data for testing."""
        return {
            'name': 'Test Automation',
            'description': 'Test automation for reminders',
            'trigger_type': 'booking_confirmed',
            'trigger_config': {'delay_hours': 24},
            'action_type': 'send_email',
            'action_config': {
                'recipient': 'customer@example.com',
                'subject': 'Booking Reminder',
                'content': 'Your booking is tomorrow!'
            },
            'target_audience': {},
            'conditions': {},
            'rate_limit_per_hour': 100,
            'rate_limit_per_day': 1000,
            'metadata': {},
            'tags': ['reminder', 'booking']
        }
    
    def test_create_automation_success(self, automation_service, sample_tenant_id, sample_user_id, sample_automation_data):
        """Test successful automation creation."""
        with patch('app.services.automation_service.db.session') as mock_session:
            mock_session.add = Mock()
            mock_session.commit = Mock()
            
            automation_id = automation_service.create_automation(
                sample_tenant_id, sample_automation_data, sample_user_id
            )
            
            assert automation_id is not None
            assert isinstance(automation_id, str)
            mock_session.add.assert_called_once()
            mock_session.commit.assert_called_once()
    
    def test_create_automation_validation_error(self, automation_service, sample_tenant_id, sample_user_id):
        """Test automation creation with validation errors."""
        invalid_data = {
            'name': 'Test Automation',
            # Missing required fields
        }
        
        with pytest.raises(TithiError) as exc_info:
            automation_service.create_automation(sample_tenant_id, invalid_data, sample_user_id)
        
        assert exc_info.value.code == "TITHI_VALIDATION_ERROR"
    
    def test_create_automation_invalid_trigger_type(self, automation_service, sample_tenant_id, sample_user_id):
        """Test automation creation with invalid trigger type."""
        invalid_data = {
            'name': 'Test Automation',
            'trigger_type': 'invalid_trigger',
            'action_type': 'send_email',
            'action_config': {}
        }
        
        with pytest.raises(TithiError) as exc_info:
            automation_service.create_automation(sample_tenant_id, invalid_data, sample_user_id)
        
        assert exc_info.value.code == "TITHI_VALIDATION_ERROR"
    
    def test_create_automation_invalid_action_type(self, automation_service, sample_tenant_id, sample_user_id):
        """Test automation creation with invalid action type."""
        invalid_data = {
            'name': 'Test Automation',
            'trigger_type': 'booking_confirmed',
            'action_type': 'invalid_action',
            'action_config': {}
        }
        
        with pytest.raises(TithiError) as exc_info:
            automation_service.create_automation(sample_tenant_id, invalid_data, sample_user_id)
        
        assert exc_info.value.code == "TITHI_VALIDATION_ERROR"
    
    def test_create_automation_invalid_cron_expression(self, automation_service, sample_tenant_id, sample_user_id):
        """Test automation creation with invalid cron expression."""
        invalid_data = {
            'name': 'Test Automation',
            'trigger_type': 'scheduled_time',
            'action_type': 'send_email',
            'action_config': {},
            'schedule_expression': 'invalid cron expression'
        }
        
        with pytest.raises(TithiError) as exc_info:
            automation_service.create_automation(sample_tenant_id, invalid_data, sample_user_id)
        
        assert exc_info.value.code == "TITHI_AUTOMATION_SCHEDULE_INVALID"
    
    def test_get_automation_success(self, automation_service, sample_tenant_id):
        """Test successful automation retrieval."""
        automation_id = str(uuid.uuid4())
        
        mock_automation = Mock()
        mock_automation.to_dict.return_value = {
            'id': automation_id,
            'name': 'Test Automation',
            'status': 'active'
        }
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = mock_automation
            
            result = automation_service.get_automation(sample_tenant_id, automation_id)
            
            assert result['id'] == automation_id
            assert result['name'] == 'Test Automation'
            assert result['status'] == 'active'
    
    def test_get_automation_not_found(self, automation_service, sample_tenant_id):
        """Test automation retrieval when not found."""
        automation_id = str(uuid.uuid4())
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = None
            
            with pytest.raises(TithiError) as exc_info:
                automation_service.get_automation(sample_tenant_id, automation_id)
            
            assert exc_info.value.code == "TITHI_AUTOMATION_NOT_FOUND"
            assert exc_info.value.status_code == 404
    
    def test_list_automations_success(self, automation_service, sample_tenant_id):
        """Test successful automation listing."""
        mock_automations = [
            Mock(to_dict=Mock(return_value={'id': str(uuid.uuid4()), 'name': 'Automation 1'})),
            Mock(to_dict=Mock(return_value={'id': str(uuid.uuid4()), 'name': 'Automation 2'}))
        ]
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.count.return_value = 2
            mock_query.filter_by.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_automations
            
            result = automation_service.list_automations(sample_tenant_id)
            
            assert result['total_count'] == 2
            assert len(result['automations']) == 2
    
    def test_update_automation_success(self, automation_service, sample_tenant_id):
        """Test successful automation update."""
        automation_id = str(uuid.uuid4())
        
        mock_automation = Mock()
        mock_automation.to_dict.return_value = {
            'id': automation_id,
            'name': 'Updated Automation',
            'status': 'active'
        }
        
        update_data = {
            'name': 'Updated Automation',
            'description': 'Updated description'
        }
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = mock_automation
            
            with patch('app.services.automation_service.db.session') as mock_session:
                mock_session.commit = Mock()
                
                result = automation_service.update_automation(sample_tenant_id, automation_id, update_data)
                
                assert result['id'] == automation_id
                assert result['name'] == 'Updated Automation'
                mock_session.commit.assert_called_once()
    
    def test_cancel_automation_success(self, automation_service, sample_tenant_id):
        """Test successful automation cancellation."""
        automation_id = str(uuid.uuid4())
        
        mock_automation = Mock()
        mock_automation.to_dict.return_value = {
            'id': automation_id,
            'name': 'Cancelled Automation',
            'status': 'cancelled'
        }
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = mock_automation
            
            with patch('app.services.automation_service.db.session') as mock_session:
                mock_session.commit = Mock()
                
                result = automation_service.cancel_automation(sample_tenant_id, automation_id)
                
                assert result['id'] == automation_id
                assert result['status'] == 'cancelled'
                mock_session.commit.assert_called_once()
    
    def test_execute_automation_success(self, automation_service):
        """Test successful automation execution."""
        automation_id = str(uuid.uuid4())
        
        mock_automation = Mock()
        mock_automation.id = automation_id
        mock_automation.tenant_id = str(uuid.uuid4())
        mock_automation.action_type = AutomationAction.SEND_EMAIL
        mock_automation.action_config = {
            'recipient': 'test@example.com',
            'subject': 'Test Email',
            'content': 'Test content'
        }
        mock_automation.max_executions = None
        mock_automation.execution_count = 0
        mock_automation.rate_limit_per_hour = 100
        mock_automation.rate_limit_per_day = 1000
        
        trigger_data = {
            'trigger_type': 'booking_confirmed',
            'booking_id': str(uuid.uuid4())
        }
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = mock_automation
            
            with patch('app.services.automation_service.db.session') as mock_session:
                mock_session.add = Mock()
                mock_session.commit = Mock()
                
                with patch.object(automation_service, '_should_execute_automation', return_value=True):
                    with patch.object(automation_service, '_check_rate_limits', return_value=True):
                        with patch.object(automation_service, '_execute_action', return_value={'status': 'success'}):
                            
                            result = automation_service.execute_automation(automation_id, trigger_data)
                            
                            assert result['executed'] is True
                            assert 'execution_id' in result
                            assert 'action_result' in result
    
    def test_execute_automation_conditions_not_met(self, automation_service):
        """Test automation execution when conditions are not met."""
        automation_id = str(uuid.uuid4())
        
        mock_automation = Mock()
        mock_automation.id = automation_id
        mock_automation.tenant_id = str(uuid.uuid4())
        
        trigger_data = {'trigger_type': 'booking_confirmed'}
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = mock_automation
            
            with patch.object(automation_service, '_should_execute_automation', return_value=False):
                
                result = automation_service.execute_automation(automation_id, trigger_data)
                
                assert result['executed'] is False
                assert result['reason'] == 'Automation conditions not met'
    
    def test_execute_automation_rate_limit_exceeded(self, automation_service):
        """Test automation execution when rate limit is exceeded."""
        automation_id = str(uuid.uuid4())
        
        mock_automation = Mock()
        mock_automation.id = automation_id
        mock_automation.tenant_id = str(uuid.uuid4())
        
        trigger_data = {'trigger_type': 'booking_confirmed'}
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter_by.return_value.first.return_value = mock_automation
            
            with patch.object(automation_service, '_should_execute_automation', return_value=True):
                with patch.object(automation_service, '_check_rate_limits', return_value=False):
                    
                    result = automation_service.execute_automation(automation_id, trigger_data)
                    
                    assert result['executed'] is False
                    assert result['reason'] == 'Rate limit exceeded'
    
    def test_process_scheduled_automations_success(self, automation_service):
        """Test successful processing of scheduled automations."""
        mock_automations = [
            Mock(
                id=str(uuid.uuid4()),
                tenant_id=str(uuid.uuid4()),
                schedule_expression='0 9 * * 1',
                schedule_timezone='UTC'
            )
        ]
        
        with patch('app.services.automation_service.Automation.query') as mock_query:
            mock_query.filter.return_value.all.return_value = mock_automations
            
            with patch.object(automation_service, 'execute_automation', return_value={'executed': True}):
                with patch('app.services.automation_service.db.session') as mock_session:
                    mock_session.commit = Mock()
                    
                    result = automation_service.process_scheduled_automations()
                    
                    assert result['executed'] == 1
                    assert result['errors'] == 0
                    assert result['total_processed'] == 1
    
    def test_validate_automation_data_success(self, automation_service):
        """Test successful automation data validation."""
        valid_data = {
            'name': 'Test Automation',
            'trigger_type': 'booking_confirmed',
            'action_type': 'send_email',
            'action_config': {}
        }
        
        # Should not raise any exception
        automation_service._validate_automation_data(valid_data)
    
    def test_validate_automation_data_missing_fields(self, automation_service):
        """Test automation data validation with missing fields."""
        invalid_data = {
            'name': 'Test Automation',
            # Missing trigger_type and action_type
        }
        
        with pytest.raises(TithiError) as exc_info:
            automation_service._validate_automation_data(invalid_data)
        
        assert exc_info.value.code == "TITHI_VALIDATION_ERROR"
    
    def test_calculate_next_execution_success(self, automation_service):
        """Test successful next execution calculation."""
        cron_expression = '0 9 * * 1'  # Every Monday at 9 AM
        timezone_str = 'UTC'
        
        result = automation_service._calculate_next_execution(cron_expression, timezone_str)
        
        assert isinstance(result, datetime)
    
    def test_calculate_next_execution_invalid_cron(self, automation_service):
        """Test next execution calculation with invalid cron expression."""
        invalid_cron = 'invalid cron expression'
        timezone_str = 'UTC'
        
        with pytest.raises(TithiError) as exc_info:
            automation_service._calculate_next_execution(invalid_cron, timezone_str)
        
        assert exc_info.value.code == "TITHI_AUTOMATION_SCHEDULE_INVALID"
    
    def test_execute_send_email_action(self, automation_service):
        """Test send email action execution."""
        mock_automation = Mock()
        mock_automation.tenant_id = str(uuid.uuid4())
        mock_automation.action_config = {
            'recipient': 'test@example.com',
            'subject': 'Test Email',
            'content': 'Test content'
        }
        
        trigger_data = {'booking_id': str(uuid.uuid4())}
        
        with patch.object(automation_service.notification_service, 'send_immediate_notification') as mock_send:
            mock_send.return_value = Mock(success=True, notification_id=str(uuid.uuid4()))
            
            result = automation_service._execute_send_email(mock_automation, trigger_data)
            
            assert result['status'] == 'success'
            assert 'notification_id' in result
    
    def test_execute_send_sms_action(self, automation_service):
        """Test send SMS action execution."""
        mock_automation = Mock()
        mock_automation.tenant_id = str(uuid.uuid4())
        mock_automation.action_config = {
            'recipient': '+1234567890',
            'content': 'Test SMS content'
        }
        
        trigger_data = {'booking_id': str(uuid.uuid4())}
        
        with patch.object(automation_service.notification_service, 'send_immediate_notification') as mock_send:
            mock_send.return_value = Mock(success=True, notification_id=str(uuid.uuid4()))
            
            result = automation_service._execute_send_sms(mock_automation, trigger_data)
            
            assert result['status'] == 'success'
            assert 'notification_id' in result
    
    def test_execute_send_sms_missing_recipient(self, automation_service):
        """Test send SMS action with missing recipient."""
        mock_automation = Mock()
        mock_automation.tenant_id = str(uuid.uuid4())
        mock_automation.action_config = {
            'content': 'Test SMS content'
            # Missing recipient
        }
        
        trigger_data = {'booking_id': str(uuid.uuid4())}
        
        result = automation_service._execute_send_sms(mock_automation, trigger_data)
        
        assert result['status'] == 'error'
        assert 'Recipient and content required' in result['message']
    
    def test_emit_automation_event_success(self, automation_service):
        """Test successful automation event emission."""
        tenant_id = str(uuid.uuid4())
        event_code = 'AUTOMATION_CREATED'
        payload = {'automation_id': str(uuid.uuid4())}
        
        with patch('app.services.automation_service.db.session') as mock_session:
            mock_session.add = Mock()
            mock_session.commit = Mock()
            
            # Should not raise any exception
            automation_service._emit_automation_event(tenant_id, event_code, payload)
            
            mock_session.add.assert_called_once()
            mock_session.commit.assert_called_once()


class TestAutomationIntegration:
    """Integration tests for automation system."""
    
    def test_booking_reminder_automation_flow(self):
        """Test complete booking reminder automation flow."""
        # This would be an integration test that:
        # 1. Creates a booking
        # 2. Creates an automation for booking reminders
        # 3. Triggers the automation
        # 4. Verifies the reminder was sent
        pass
    
    def test_scheduled_campaign_automation_flow(self):
        """Test complete scheduled campaign automation flow."""
        # This would be an integration test that:
        # 1. Creates a scheduled automation
        # 2. Waits for the scheduled time
        # 3. Verifies the campaign was executed
        pass
    
    def test_automation_rate_limiting(self):
        """Test automation rate limiting functionality."""
        # This would be an integration test that:
        # 1. Creates an automation with low rate limits
        # 2. Executes it multiple times quickly
        # 3. Verifies rate limiting is enforced
        pass
