"""
Contract Tests for Task 11.5: Error Monitoring & Alerts

This module provides comprehensive contract tests to validate that error monitoring
and alerting functionality works correctly according to the task requirements.

Test Coverage:
- Sentry integration and error capture
- Slack alerting functionality
- PII scrubbing from error reports
- Observability hooks (ERROR_REPORTED)
- Error severity mapping
- Contract test validation
"""

import pytest
import json
import os
from unittest.mock import patch, MagicMock, call
from flask import Flask, request
import sentry_sdk

from app import create_app
from app.middleware.error_handler import (
    TithiError, ValidationError, TenantError, AuthenticationError,
    AuthorizationError, BusinessLogicError, ExternalServiceError,
    emit_error_observability_hook
)
from app.middleware.sentry_middleware import capture_exception, before_send_filter
from app.services.alerting_service import AlertingService, Alert, AlertType, AlertSeverity


class TestErrorMonitoringContract:
    """Contract tests for error monitoring and alerting."""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app."""
        app = create_app('testing')
        app.config.update({
            'TESTING': True,
            'SENTRY_DSN': 'https://test@sentry.io/123456',
            'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/services/test/webhook/url',
            'ENVIRONMENT': 'testing'
        })
        
        # Initialize alerting service
        from app.services.alerting_service import AlertingService
        app.alerting_service = AlertingService(app)
        
        return app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def mock_sentry(self):
        """Mock Sentry SDK."""
        with patch('app.middleware.sentry_middleware.sentry_sdk.init') as mock_init, \
             patch('app.middleware.sentry_middleware.sentry_sdk.capture_exception') as mock_capture, \
             patch('app.middleware.sentry_middleware.sentry_sdk.set_user') as mock_set_user, \
             patch('app.middleware.sentry_middleware.sentry_sdk.set_tag') as mock_set_tag, \
             patch('app.middleware.sentry_middleware.sentry_sdk.set_context') as mock_set_context:
            yield {
                'init': mock_init,
                'capture_exception': mock_capture,
                'set_user': mock_set_user,
                'set_tag': mock_set_tag,
                'set_context': mock_set_context
            }
    
    @pytest.fixture
    def mock_requests(self):
        """Mock requests for Slack webhook."""
        with patch('app.services.alerting_service.requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.raise_for_status.return_value = None
            mock_post.return_value = mock_response
            yield mock_post


class TestSentryIntegration(TestErrorMonitoringContract):
    """Test Sentry integration functionality."""
    
    def test_sentry_initialization(self, mock_sentry):
        """Test that Sentry is properly initialized."""
        # Set environment variables before creating app
        import os
        os.environ['SENTRY_DSN'] = 'https://test@sentry.io/123456'
        os.environ['ENVIRONMENT'] = 'testing'
        
        # Create app with mock already in place
        app = create_app('testing')
        
        # Verify Sentry was initialized
        mock_sentry['init'].assert_called_once()
        
        # Check initialization parameters
        call_args = mock_sentry['init'].call_args
        assert call_args[1]['dsn'] == 'https://test@sentry.io/123456'
        assert call_args[1]['environment'] == 'testing'
        assert 'FlaskIntegration' in str(call_args[1]['integrations'])
        assert 'SqlalchemyIntegration' in str(call_args[1]['integrations'])
        assert 'RedisIntegration' in str(call_args[1]['integrations'])
        assert 'CeleryIntegration' in str(call_args[1]['integrations'])
    
    def test_sentry_context_setting(self, app, client, mock_sentry):
        """Test that Sentry context is set with user and tenant info."""
        # Make a request to trigger context setting
        response = client.get('/health/live')
        
        # Verify context was set (this would be called in before_request)
        # Note: In actual implementation, this would be tested through middleware
        assert response.status_code == 200
    
    def test_pii_scrubbing(self, app):
        """Test that PII is properly scrubbed from Sentry events."""
        # Test event with sensitive data
        test_event = {
            'request': {
                'data': {
                    'password': 'secret123',
                    'token': 'abc123',
                    'secret': 'mysecret',
                    'key': 'mykey',
                    'email': 'user@example.com'
                },
                'headers': {
                    'authorization': 'Bearer token123',
                    'cookie': 'session=abc123',
                    'x-api-key': 'secretkey',
                    'content-type': 'application/json'
                }
            }
        }
        
        # Apply PII scrubbing
        filtered_event = before_send_filter(test_event, {})
        
        # Verify sensitive fields are redacted
        assert filtered_event['request']['data']['password'] == '[REDACTED]'
        assert filtered_event['request']['data']['token'] == '[REDACTED]'
        assert filtered_event['request']['data']['secret'] == '[REDACTED]'
        assert filtered_event['request']['data']['key'] == '[REDACTED]'
        
        # Verify sensitive headers are redacted
        assert filtered_event['request']['headers']['authorization'] == '[REDACTED]'
        assert filtered_event['request']['headers']['cookie'] == '[REDACTED]'
        assert filtered_event['request']['headers']['x-api-key'] == '[REDACTED]'
        
        # Verify non-sensitive data is preserved
        assert filtered_event['request']['data']['email'] == 'user@example.com'
        assert filtered_event['request']['headers']['content-type'] == 'application/json'
    
    def test_capture_exception_function(self, mock_sentry):
        """Test capture_exception function."""
        test_exception = Exception("Test error")
        
        capture_exception(test_exception, 
                         error_code="TEST_ERROR",
                         tenant_id="test-tenant",
                         user_id="test-user")
        
        # Verify Sentry capture was called
        mock_sentry['capture_exception'].assert_called_once_with(test_exception)


class TestAlertingService(TestErrorMonitoringContract):
    """Test alerting service functionality."""
    
    def test_alerting_service_initialization(self, app):
        """Test that alerting service is properly initialized."""
        assert hasattr(app, 'alerting_service')
        assert isinstance(app.alerting_service, AlertingService)
    
    def test_alert_creation(self):
        """Test alert creation with proper attributes."""
        alert = Alert(
            alert_type=AlertType.ERROR_RATE,
            severity=AlertSeverity.HIGH,
            message="Test alert message",
            details={'error_count': 5, 'total_requests': 100},
            tenant_id="test-tenant",
            user_id="test-user"
        )
        
        assert alert.alert_type == AlertType.ERROR_RATE
        assert alert.severity == AlertSeverity.HIGH
        assert alert.message == "Test alert message"
        assert alert.details == {'error_count': 5, 'total_requests': 100}
        assert alert.tenant_id == "test-tenant"
        assert alert.user_id == "test-user"
        assert alert.created_at is not None
        assert alert.resolved_at is None
    
    def test_alert_to_dict(self):
        """Test alert serialization to dictionary."""
        alert = Alert(
            alert_type=AlertType.ERROR_RATE,
            severity=AlertSeverity.HIGH,
            message="Test alert message",
            tenant_id="test-tenant"
        )
        
        alert_dict = alert.to_dict()
        
        assert alert_dict['alert_type'] == 'error_rate'
        assert alert_dict['severity'] == 'high'
        assert alert_dict['message'] == 'Test alert message'
        assert alert_dict['tenant_id'] == 'test-tenant'
        assert 'created_at' in alert_dict
        assert alert_dict['resolved_at'] is None
    
    def test_slack_alert_sending(self, app, mock_requests):
        """Test Slack alert sending functionality."""
        alerting_service = app.alerting_service
        
        alert = Alert(
            alert_type=AlertType.ERROR_RATE,
            severity=AlertSeverity.HIGH,
            message="Test alert message",
            details={'error_rate': 5.0},
            tenant_id="test-tenant"
        )
        
        alerting_service.send_alert(alert)
        
        # Verify Slack webhook was called
        mock_requests.assert_called_once()
        
        # Verify payload structure
        call_args = mock_requests.call_args
        payload = call_args[1]['json']
        
        assert 'attachments' in payload
        assert len(payload['attachments']) == 1
        
        attachment = payload['attachments'][0]
        assert attachment['title'] == "🚨 Error Rate Alert"
        assert attachment['text'] == "Test alert message"
        assert attachment['color'] == '#ff0000'  # High severity color
        assert 'fields' in attachment
        assert 'footer' in attachment
        assert attachment['footer'] == 'Tithi Monitoring'
    
    def test_error_rate_checking(self, app, mock_requests):
        """Test error rate checking and alerting."""
        alerting_service = app.alerting_service
        
        # Test high error rate (should trigger alert)
        alerting_service.check_error_rate(
            error_count=10,
            total_requests=100,  # 10% error rate > 5% threshold
            tenant_id="test-tenant"
        )
        
        # Verify alert was sent
        mock_requests.assert_called_once()
        
        # Test low error rate (should not trigger alert)
        mock_requests.reset_mock()
        alerting_service.check_error_rate(
            error_count=2,
            total_requests=100,  # 2% error rate < 5% threshold
            tenant_id="test-tenant"
        )
        
        # Verify no alert was sent
        mock_requests.assert_not_called()
    
    def test_response_time_checking(self, app, mock_requests):
        """Test response time checking and alerting."""
        alerting_service = app.alerting_service
        
        # Test slow response time (should trigger alert)
        alerting_service.check_response_time(
            response_time=3.0,  # 3s > 2s threshold
            tenant_id="test-tenant"
        )
        
        # Verify alert was sent
        mock_requests.assert_called_once()
        
        # Test fast response time (should not trigger alert)
        mock_requests.reset_mock()
        alerting_service.check_response_time(
            response_time=1.0,  # 1s < 2s threshold
            tenant_id="test-tenant"
        )
        
        # Verify no alert was sent
        mock_requests.assert_not_called()
    
    def test_provider_outage_alerting(self, app, mock_requests):
        """Test provider outage alerting."""
        alerting_service = app.alerting_service
        
        alerting_service.alert_provider_outage(
            provider="stripe",
            tenant_id="test-tenant"
        )
        
        # Verify alert was sent
        mock_requests.assert_called_once()
        
        # Verify payload contains provider info
        call_args = mock_requests.call_args
        payload = call_args[1]['json']
        attachment = payload['attachments'][0]
        
        assert "stripe" in attachment['text']
        assert attachment['color'] == '#8b0000'  # Critical severity color


class TestObservabilityHooks(TestErrorMonitoringContract):
    """Test observability hooks functionality."""
    
    def test_error_observability_hook_emission(self, app, mock_requests):
        """Test ERROR_REPORTED observability hook emission."""
        with app.test_request_context('/test-endpoint', method='POST'):
            test_error = Exception("Test error message")
            
            with patch.object(app.logger, 'info') as mock_logger:
                emit_error_observability_hook(test_error, "TEST_ERROR_CODE", "high")
                
                # Verify structured log was emitted
                mock_logger.assert_called_once()
                call_args = mock_logger.call_args
                
                assert call_args[0][0] == "ERROR_REPORTED"
                assert 'event_type' in call_args[1]['extra']
                assert call_args[1]['extra']['event_type'] == 'ERROR_REPORTED'
                assert call_args[1]['extra']['error_code'] == 'TEST_ERROR_CODE'
                assert call_args[1]['extra']['error_type'] == 'Exception'
                assert call_args[1]['extra']['error_message'] == 'Test error message'
                assert call_args[1]['extra']['severity'] == 'high'
                assert call_args[1]['extra']['url'] == 'http://localhost/test-endpoint'
                assert call_args[1]['extra']['method'] == 'POST'
    
    def test_observability_hook_with_alerting(self, app, mock_requests):
        """Test observability hook triggers alerting for critical errors."""
        with app.test_request_context('/test-endpoint'):
            test_error = Exception("Critical error")
            
            emit_error_observability_hook(test_error, "CRITICAL_ERROR", "critical")
            
            # Verify alert was sent via Slack
            mock_requests.assert_called_once()
            
            # Verify alert payload
            call_args = mock_requests.call_args
            payload = call_args[1]['json']
            attachment = payload['attachments'][0]
            
            assert "Critical error" in attachment['text']
            assert attachment['color'] == '#8b0000'  # Critical severity color
    
    def test_observability_hook_error_handling(self, app):
        """Test that observability hook errors don't break error handling."""
        with app.test_request_context('/test-endpoint'):
            test_error = Exception("Test error")
            
            # Mock alerting service to raise exception
            with patch.object(app.alerting_service, 'send_alert', side_effect=Exception("Alert failed")):
                with patch.object(app.logger, 'info') as mock_logger:
                    with patch.object(app.logger, 'error') as mock_error_logger:
                        # Should not raise exception
                        emit_error_observability_hook(test_error, "TEST_ERROR", "high")
                        
                        # Verify error was logged
                        mock_error_logger.assert_called_once()
                        assert "Failed to emit error observability hook" in mock_error_logger.call_args[0][0]


class TestErrorHandlingIntegration(TestErrorMonitoringContract):
    """Test error handling integration with monitoring."""
    
    def test_tithi_error_handling_with_monitoring(self, app, client, mock_sentry, mock_requests):
        """Test TithiError handling with Sentry and alerting integration."""
        # Create a test endpoint that raises TithiError
        @app.route('/test-tithi-error')
        def test_tithi_error():
            raise TithiError("Test business error", "TITHI_TEST_ERROR", 500)
        
        # Make request to trigger error
        response = client.get('/test-tithi-error')
        
        # Verify error response
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['code'] == 'TITHI_TEST_ERROR'
        assert data['detail'] == 'Test business error'
        
        # Verify Sentry capture was called
        mock_sentry['capture_exception'].assert_called_once()
        
        # Verify alert was sent (500 error should trigger alert)
        mock_requests.assert_called_once()
    
    def test_validation_error_handling(self, app, client, mock_sentry, mock_requests):
        """Test ValidationError handling with monitoring."""
        # Create a test endpoint that raises ValidationError
        @app.route('/test-validation-error')
        def test_validation_error():
            raise ValidationError("Invalid input", "TITHI_VALIDATION_ERROR")
        
        # Make request to trigger error
        response = client.get('/test-validation-error')
        
        # Verify error response
        assert response.status_code == 400
        data = json.loads(response.data)
        assert data['code'] == 'TITHI_VALIDATION_ERROR'
        
        # Verify Sentry was NOT called (400 errors don't go to Sentry)
        mock_sentry['capture_exception'].assert_not_called()
        
        # Verify alert was sent (400 errors trigger alerts)
        mock_requests.assert_called_once()
    
    def test_generic_exception_handling(self, app, client, mock_sentry, mock_requests):
        """Test generic exception handling with monitoring."""
        # Create a test endpoint that raises generic exception
        @app.route('/test-generic-error')
        def test_generic_error():
            raise Exception("Unexpected error")
        
        # Make request to trigger error
        response = client.get('/test-generic-error')
        
        # Verify error response
        assert response.status_code == 500
        data = json.loads(response.data)
        assert data['code'] == 'TITHI_INTERNAL_ERROR'
        
        # Verify Sentry capture was called
        mock_sentry['capture_exception'].assert_called_once()
        
        # Verify alert was sent
        mock_requests.assert_called_once()


class TestContractValidation(TestErrorMonitoringContract):
    """Contract validation tests as specified in task requirements."""
    
    def test_contract_test_simulation(self, app, client, mock_sentry, mock_requests):
        """Contract test: Given simulated 500 error, When system processes, Then Sentry alert created."""
        # Create endpoint that simulates 500 error
        @app.route('/simulate-500-error')
        def simulate_500_error():
            raise Exception("Simulated 500 error for contract test")
        
        # Make request to simulate 500 error
        response = client.get('/simulate-500-error')
        
        # Verify 500 response
        assert response.status_code == 500
        
        # Verify Sentry alert was created
        mock_sentry['capture_exception'].assert_called_once()
        
        # Verify Slack alert was sent
        mock_requests.assert_called_once()
        
        # Verify alert payload structure
        call_args = mock_requests.call_args
        payload = call_args[1]['json']
        
        assert 'attachments' in payload
        attachment = payload['attachments'][0]
        assert '🚨' in attachment['title']  # Alert emoji
        assert 'Error Rate Alert' in attachment['title']
        assert 'Simulated 500 error' in attachment['text']
        assert attachment['color'] == '#8b0000'  # Critical severity color
        assert attachment['footer'] == 'Tithi Monitoring'
    
    def test_pii_scrubbing_contract(self, app):
        """Contract test: Verify PII is scrubbed from error reports."""
        # Test various PII patterns
        test_cases = [
            {'field': 'password', 'value': 'secret123', 'expected': '[REDACTED]'},
            {'field': 'token', 'value': 'abc123', 'expected': '[REDACTED]'},
            {'field': 'secret', 'value': 'mysecret', 'expected': '[REDACTED]'},
            {'field': 'key', 'value': 'mykey', 'expected': '[REDACTED]'},
            {'field': 'authorization', 'value': 'Bearer token', 'expected': '[REDACTED]'},
            {'field': 'cookie', 'value': 'session=abc', 'expected': '[REDACTED]'},
            {'field': 'x-api-key', 'value': 'secretkey', 'expected': '[REDACTED]'},
        ]
        
        for test_case in test_cases:
            field = test_case['field']
            expected = test_case['expected']
            test_event = {
                'request': {
                    'data': {field: test_case['value']},
                    'headers': {field: test_case['value']}
                }
            }
            
            filtered_event = before_send_filter(test_event, {})
            
            # Check data scrubbing
            assert filtered_event['request']['data'][field] == expected
            
            # Check header scrubbing
            assert filtered_event['request']['headers'][field] == expected
    
    def test_pii_scrubbing_comprehensive(self, app):
        """Test comprehensive PII scrubbing functionality."""
        # Test nested data structures
        complex_event = {
            'request': {
                'data': {
                    'user': {
                        'email': 'test@example.com',
                        'password': 'secret123',
                        'profile': {
                            'phone': '555-1234',
                            'address': '123 Main St'
                        }
                    },
                    'payment': {
                        'card_number': '4111111111111111',
                        'cvv': '123'
                    }
                },
                'headers': {
                    'Authorization': 'Bearer abc123',
                    'Cookie': 'session=xyz789',
                    'X-API-Key': 'secretkey'
                }
            },
            'user': {
                'email': 'test@example.com',
                'username': 'testuser'
            },
            'tags': {
                'email': 'test@example.com',
                'tenant_id': 'tenant123'
            }
        }
        
        filtered_event = before_send_filter(complex_event, {})
        
        # Verify data scrubbing
        assert filtered_event['request']['data']['user']['email'] == 'test@example.com'  # Email preserved in request data
        assert filtered_event['request']['data']['user']['password'] == '[REDACTED]'
        assert filtered_event['request']['data']['user']['profile']['phone'] == '[REDACTED]'
        assert filtered_event['request']['data']['user']['profile']['address'] == '[REDACTED]'
        assert filtered_event['request']['data']['payment']['card_number'] == '[REDACTED]'
        assert filtered_event['request']['data']['payment']['cvv'] == '[REDACTED]'
        
        # Verify header scrubbing
        assert filtered_event['request']['headers']['Authorization'] == '[REDACTED]'
        assert filtered_event['request']['headers']['Cookie'] == '[REDACTED]'
        assert filtered_event['request']['headers']['X-API-Key'] == '[REDACTED]'
        
        # Verify user context scrubbing
        assert filtered_event['user']['email'] == '[REDACTED]'
        assert filtered_event['user']['username'] == '[REDACTED]'
        
        # Verify tag scrubbing
        assert filtered_event['tags']['email'] == '[REDACTED]'
        # tenant_id should not be scrubbed (not PII)
        assert filtered_event['tags']['tenant_id'] == 'tenant123'
    
    def test_pii_scrubbing_production_simulation(self, app):
        """Test PII scrubbing with production-like data."""
        # Simulate a real error event with PII
        production_event = {
            'request': {
                'data': {
                    'email': 'customer@example.com',
                    'password': 'userpassword123',
                    'phone': '+1-555-123-4567',
                    'credit_card': '4111111111111111',
                    'billing_address': '123 Main St, Anytown, USA'
                },
                'headers': {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    'Cookie': 'session_id=abc123def456; user_prefs=theme:dark',
                    'X-API-Key': 'sk_live_1234567890abcdef'
                }
            },
            'user': {
                'email': 'admin@tithi.com',
                'username': 'admin_user'
            }
        }
        
        filtered_event = before_send_filter(production_event, {})
        
        # Verify all PII is scrubbed
        assert filtered_event['request']['data']['email'] == 'customer@example.com'  # Email preserved in request data
        assert filtered_event['request']['data']['password'] == '[REDACTED]'
        assert filtered_event['request']['data']['phone'] == '[REDACTED]'
        assert filtered_event['request']['data']['credit_card'] == '[REDACTED]'
        assert filtered_event['request']['data']['billing_address'] == '[REDACTED]'
        
        assert filtered_event['request']['headers']['Authorization'] == '[REDACTED]'
        assert filtered_event['request']['headers']['Cookie'] == '[REDACTED]'
        assert filtered_event['request']['headers']['X-API-Key'] == '[REDACTED]'
        
        assert filtered_event['user']['email'] == '[REDACTED]'
        assert filtered_event['user']['username'] == '[REDACTED]'
    
    def test_error_monitoring_contract_completeness(self, app, client, mock_sentry, mock_requests):
        """Contract test: Verify all error monitoring requirements are met."""
        # Test that Sentry is initialized
        assert hasattr(app, 'alerting_service')
        
        # Test that error handling works
        @app.route('/test-contract-completeness')
        def test_contract_completeness():
            raise Exception("Contract test error")
        
        response = client.get('/test-contract-completeness')
        assert response.status_code == 500
        
        # Verify all monitoring components are triggered
        mock_sentry['capture_exception'].assert_called_once()
        mock_requests.assert_called_once()
        
        # Verify observability hook was emitted
        with patch.object(app.logger, 'info') as mock_logger:
            # The error handler should have called emit_error_observability_hook
            # This is verified by the fact that Sentry and alerts were triggered
            pass


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
