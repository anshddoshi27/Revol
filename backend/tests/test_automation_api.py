"""
Test Automation API
Comprehensive tests for automation API endpoints
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from app.blueprints.automation_api import automation_bp
from app.middleware.error_handler import TithiError


class TestAutomationAPI:
    """Test cases for automation API endpoints."""
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def auth_headers(self):
        """Create authentication headers."""
        return {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
        }
    
    @pytest.fixture
    def sample_automation_data(self):
        """Sample automation data for testing."""
        return {
            'name': 'Test Booking Reminder',
            'description': 'Send reminder 24 hours before booking',
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
    
    def test_create_automation_success(self, client, auth_headers, sample_automation_data):
        """Test successful automation creation."""
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.create_automation.return_value = str(uuid.uuid4())
            
            response = client.post(
                '/api/v1/automations',
                headers=auth_headers,
                data=json.dumps(sample_automation_data)
            )
            
            assert response.status_code == 201
            data = json.loads(response.data)
            assert 'automation_id' in data
            assert 'message' in data
            assert data['message'] == 'Automation created successfully'
    
    def test_create_automation_missing_body(self, client, auth_headers):
        """Test automation creation with missing request body."""
        response = client.post(
            '/api/v1/automations',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['code'] == 'TITHI_VALIDATION_ERROR'
    
    def test_create_automation_service_error(self, client, auth_headers, sample_automation_data):
        """Test automation creation with service error."""
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.create_automation.side_effect = TithiError(
                message="Service error",
                code="TITHI_AUTOMATION_CREATE_ERROR"
            )
            
            response = client.post(
                '/api/v1/automations',
                headers=auth_headers,
                data=json.dumps(sample_automation_data)
            )
            
            assert response.status_code == 500
            data = json.loads(response.data)
            assert data['code'] == 'TITHI_AUTOMATION_CREATE_ERROR'
    
    def test_list_automations_success(self, client, auth_headers):
        """Test successful automation listing."""
        mock_automations = [
            {
                'id': str(uuid.uuid4()),
                'name': 'Automation 1',
                'status': 'active'
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Automation 2',
                'status': 'paused'
            }
        ]
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.list_automations.return_value = {
                'automations': mock_automations,
                'total_count': 2,
                'limit': 50,
                'offset': 0
            }
            
            response = client.get(
                '/api/v1/automations',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['total_count'] == 2
            assert len(data['automations']) == 2
    
    def test_list_automations_with_filters(self, client, auth_headers):
        """Test automation listing with filters."""
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.list_automations.return_value = {
                'automations': [],
                'total_count': 0,
                'limit': 50,
                'offset': 0
            }
            
            response = client.get(
                '/api/v1/automations?status=active&trigger_type=booking_confirmed&limit=10&offset=0',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            mock_service.list_automations.assert_called_once()
    
    def test_get_automation_success(self, client, auth_headers):
        """Test successful automation retrieval."""
        automation_id = str(uuid.uuid4())
        mock_automation = {
            'id': automation_id,
            'name': 'Test Automation',
            'status': 'active',
            'trigger_type': 'booking_confirmed',
            'action_type': 'send_email'
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.get_automation.return_value = mock_automation
            
            response = client.get(
                f'/api/v1/automations/{automation_id}',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['id'] == automation_id
            assert data['name'] == 'Test Automation'
    
    def test_get_automation_not_found(self, client, auth_headers):
        """Test automation retrieval when not found."""
        automation_id = str(uuid.uuid4())
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.get_automation.side_effect = TithiError(
                message="Automation not found",
                code="TITHI_AUTOMATION_NOT_FOUND",
                status_code=404
            )
            
            response = client.get(
                f'/api/v1/automations/{automation_id}',
                headers=auth_headers
            )
            
            assert response.status_code == 404
            data = json.loads(response.data)
            assert data['code'] == 'TITHI_AUTOMATION_NOT_FOUND'
    
    def test_update_automation_success(self, client, auth_headers):
        """Test successful automation update."""
        automation_id = str(uuid.uuid4())
        update_data = {
            'name': 'Updated Automation',
            'description': 'Updated description'
        }
        
        updated_automation = {
            'id': automation_id,
            'name': 'Updated Automation',
            'description': 'Updated description',
            'status': 'active'
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.update_automation.return_value = updated_automation
            
            response = client.put(
                f'/api/v1/automations/{automation_id}',
                headers=auth_headers,
                data=json.dumps(update_data)
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['automation']['name'] == 'Updated Automation'
            assert data['message'] == 'Automation updated successfully'
    
    def test_update_automation_missing_body(self, client, auth_headers):
        """Test automation update with missing request body."""
        automation_id = str(uuid.uuid4())
        
        response = client.put(
            f'/api/v1/automations/{automation_id}',
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['code'] == 'TITHI_VALIDATION_ERROR'
    
    def test_cancel_automation_success(self, client, auth_headers):
        """Test successful automation cancellation."""
        automation_id = str(uuid.uuid4())
        
        cancelled_automation = {
            'id': automation_id,
            'name': 'Cancelled Automation',
            'status': 'cancelled'
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.cancel_automation.return_value = cancelled_automation
            
            response = client.post(
                f'/api/v1/automations/{automation_id}/cancel',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['automation']['status'] == 'cancelled'
            assert data['message'] == 'Automation cancelled successfully'
    
    def test_execute_automation_success(self, client, auth_headers):
        """Test successful automation execution."""
        automation_id = str(uuid.uuid4())
        trigger_data = {
            'booking_id': str(uuid.uuid4()),
            'customer_id': str(uuid.uuid4())
        }
        
        execution_result = {
            'executed': True,
            'execution_id': str(uuid.uuid4()),
            'action_result': {'status': 'success'}
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.execute_automation.return_value = execution_result
            
            response = client.post(
                f'/api/v1/automations/{automation_id}/execute',
                headers=auth_headers,
                data=json.dumps(trigger_data)
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['result']['executed'] is True
            assert 'execution_id' in data['result']
    
    def test_execute_automation_not_executed(self, client, auth_headers):
        """Test automation execution when not executed."""
        automation_id = str(uuid.uuid4())
        trigger_data = {}
        
        execution_result = {
            'executed': False,
            'reason': 'Automation conditions not met'
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.execute_automation.return_value = execution_result
            
            response = client.post(
                f'/api/v1/automations/{automation_id}/execute',
                headers=auth_headers,
                data=json.dumps(trigger_data)
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['result']['executed'] is False
            assert 'conditions not met' in data['message']
    
    def test_get_automation_executions_success(self, client, auth_headers):
        """Test successful automation execution history retrieval."""
        automation_id = str(uuid.uuid4())
        
        mock_executions = [
            {
                'id': str(uuid.uuid4()),
                'automation_id': automation_id,
                'execution_status': 'completed',
                'started_at': datetime.utcnow().isoformat() + 'Z'
            }
        ]
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.get_automation_executions.return_value = {
                'executions': mock_executions,
                'total_count': 1,
                'limit': 50,
                'offset': 0
            }
            
            response = client.get(
                f'/api/v1/automations/{automation_id}/executions',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['total_count'] == 1
            assert len(data['executions']) == 1
    
    def test_get_automation_executions_with_pagination(self, client, auth_headers):
        """Test automation execution history with pagination."""
        automation_id = str(uuid.uuid4())
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.get_automation_executions.return_value = {
                'executions': [],
                'total_count': 0,
                'limit': 10,
                'offset': 20
            }
            
            response = client.get(
                f'/api/v1/automations/{automation_id}/executions?limit=10&offset=20',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            mock_service.get_automation_executions.assert_called_once()
    
    def test_process_scheduled_automations_success(self, client, auth_headers):
        """Test successful processing of scheduled automations."""
        process_result = {
            'executed': 5,
            'errors': 0,
            'total_processed': 5
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.process_scheduled_automations.return_value = process_result
            
            response = client.post(
                '/api/v1/automations/process-scheduled',
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['result']['executed'] == 5
            assert 'Processed 5 automations successfully' in data['message']
    
    def test_get_automation_templates_success(self, client, auth_headers):
        """Test successful automation templates retrieval."""
        response = client.get(
            '/api/v1/automations/templates',
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'templates' in data
        assert 'total_count' in data
        assert len(data['templates']) > 0
        
        # Check that templates have required fields
        template = data['templates'][0]
        assert 'id' in template
        assert 'name' in template
        assert 'description' in template
        assert 'trigger_type' in template
        assert 'action_type' in template
    
    def test_test_automation_success(self, client, auth_headers):
        """Test successful automation testing."""
        automation_id = str(uuid.uuid4())
        test_data = {
            'booking_id': str(uuid.uuid4()),
            'customer_id': str(uuid.uuid4())
        }
        
        test_result = {
            'executed': True,
            'execution_id': str(uuid.uuid4()),
            'action_result': {'status': 'success'}
        }
        
        with patch('app.blueprints.automation_api.AutomationService') as mock_service_class:
            mock_service = Mock()
            mock_service_class.return_value = mock_service
            mock_service.execute_automation.return_value = test_result
            
            response = client.post(
                f'/api/v1/automations/{automation_id}/test',
                headers=auth_headers,
                data=json.dumps(test_data)
            )
            
            assert response.status_code == 200
            data = json.loads(response.data)
            assert data['result']['executed'] is True
            assert data['test_mode'] is True
            assert 'Automation test completed' in data['message']
    
    def test_get_automation_stats_success(self, client, auth_headers):
        """Test successful automation statistics retrieval."""
        mock_stats = {
            'total_automations': 10,
            'active_automations': 8,
            'total_executions': 150,
            'successful_executions': 145,
            'recent_executions_30d': 25,
            'success_rate_percent': 96.67
        }
        
        with patch('app.blueprints.automation_api.Automation') as mock_automation:
            with patch('app.blueprints.automation_api.AutomationExecution') as mock_execution:
                with patch('app.blueprints.automation_api.AutomationStatus') as mock_status:
                    # Mock query results
                    mock_automation.query.filter_by.return_value.count.return_value = 10
                    mock_automation.query.filter_by.return_value.filter.return_value.count.return_value = 8
                    mock_execution.query.filter_by.return_value.count.return_value = 150
                    mock_execution.query.filter.return_value.count.return_value = 145
                    
                    response = client.get(
                        '/api/v1/automations/stats',
                        headers=auth_headers
                    )
                    
                    assert response.status_code == 200
                    data = json.loads(response.data)
                    assert 'total_automations' in data
                    assert 'active_automations' in data
                    assert 'total_executions' in data
                    assert 'successful_executions' in data
                    assert 'success_rate_percent' in data
    
    def test_unauthorized_access(self, client):
        """Test unauthorized access to automation endpoints."""
        response = client.get('/api/v1/automations')
        
        # Should return 401 or redirect to login
        assert response.status_code in [401, 302]
    
    def test_invalid_json(self, client, auth_headers):
        """Test automation creation with invalid JSON."""
        response = client.post(
            '/api/v1/automations',
            headers=auth_headers,
            data='invalid json'
        )
        
        # Should return 400 Bad Request
        assert response.status_code == 400


class TestAutomationAPIIntegration:
    """Integration tests for automation API."""
    
    def test_complete_automation_lifecycle(self, client, auth_headers):
        """Test complete automation lifecycle: create -> execute -> cancel."""
        # This would be an integration test that:
        # 1. Creates an automation
        # 2. Executes it
        # 3. Checks execution history
        # 4. Cancels the automation
        # 5. Verifies it's cancelled
        pass
    
    def test_automation_with_real_notifications(self, client, auth_headers):
        """Test automation with real notification service integration."""
        # This would be an integration test that:
        # 1. Creates an email automation
        # 2. Executes it with real trigger data
        # 3. Verifies email was actually sent
        pass
    
    def test_scheduled_automation_execution(self, client, auth_headers):
        """Test scheduled automation execution."""
        # This would be an integration test that:
        # 1. Creates a scheduled automation
        # 2. Waits for scheduled time
        # 3. Verifies automation was executed
        pass
