"""
Test Suite for Task 11.2: Rate Limiting

This test suite validates the rate limiting middleware implementation with comprehensive
contract tests, integration tests, and edge case validation.

Test Coverage:
- Token bucket algorithm validation
- Per-tenant and per-user rate limiting
- Endpoint-specific rate limits
- Redis-based distributed rate limiting
- Error handling and observability hooks
- Contract tests for 101 requests → last one denied
"""

import pytest
import time
import json
from unittest.mock import patch, MagicMock
from flask import Flask, g
from app import create_app
from app.middleware.rate_limit_middleware import RateLimitMiddleware, RateLimitExceededError


class TestRateLimitingTask112:
    """Test suite for Task 11.2 Rate Limiting implementation."""
    
    @pytest.fixture
    def app(self):
        """Create test Flask app with rate limiting enabled."""
        app = create_app('testing')
        app.config['TESTING'] = True
        app.config['REDIS_URL'] = 'redis://localhost:6379/15'  # Use test database
        
        # Mock Redis client for testing
        with patch('app.middleware.rate_limit_middleware.redis.from_url') as mock_redis:
            mock_client = MagicMock()
            mock_client.ping.return_value = True
            mock_client.pipeline.return_value = MagicMock()
            mock_redis.return_value = mock_client
            
            yield app
    
    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()
    
    @pytest.fixture
    def mock_redis_client(self):
        """Mock Redis client for testing."""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        
        # Mock pipeline for token bucket operations
        mock_pipeline = MagicMock()
        mock_pipeline.execute.return_value = [None, 0, None, None]  # No current requests
        mock_client.pipeline.return_value = mock_pipeline
        
        return mock_client
    
    def test_rate_limit_middleware_initialization(self, app):
        """Test that rate limiting middleware initializes correctly."""
        middleware = RateLimitMiddleware(app)
        
        assert middleware.default_limit == 100
        assert middleware.default_window == 60
        assert '/api/bookings' in middleware.endpoint_limits
        assert '/api/payments' in middleware.endpoint_limits
        assert '/api/availability' in middleware.endpoint_limits
        assert '/v1/tenants' in middleware.endpoint_limits
    
    def test_endpoint_specific_rate_limits(self, app):
        """Test that endpoint-specific rate limits are configured correctly."""
        middleware = RateLimitMiddleware(app)
        
        # Test bookings endpoint limit
        bookings_limit = middleware.endpoint_limits['/api/bookings']
        assert bookings_limit['limit'] == 50
        assert bookings_limit['window'] == 60
        
        # Test payments endpoint limit
        payments_limit = middleware.endpoint_limits['/api/payments']
        assert payments_limit['limit'] == 30
        assert payments_limit['window'] == 60
        
        # Test availability endpoint limit
        availability_limit = middleware.endpoint_limits['/api/availability']
        assert availability_limit['limit'] == 200
        assert availability_limit['window'] == 60
        
        # Test tenant operations limit
        tenants_limit = middleware.endpoint_limits['/v1/tenants']
        assert tenants_limit['limit'] == 20
        assert tenants_limit['window'] == 60
    
    def test_rate_limit_key_generation(self, app):
        """Test rate limit key generation for tenant and user isolation."""
        middleware = RateLimitMiddleware(app)
        
        with app.test_request_context('/api/bookings', method='POST'):
            # Set tenant and user context
            g.tenant_id = 'tenant-123'
            g.user_id = 'user-456'
            
            key = middleware._generate_rate_limit_key()
            expected_key = 'rate_limit:tenant-123:user-456:/api/bookings'
            assert key == expected_key
    
    def test_rate_limit_key_anonymous_user(self, app):
        """Test rate limit key generation for anonymous users."""
        middleware = RateLimitMiddleware(app)
        
        with app.test_request_context('/api/bookings', method='POST'):
            # No tenant or user context
            key = middleware._generate_rate_limit_key()
            expected_key = 'rate_limit:global:anonymous:/api/bookings'
            assert key == expected_key
    
    def test_redis_rate_limit_check_success(self, app, mock_redis_client):
        """Test successful Redis rate limit check."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        # Mock pipeline execution for successful check
        mock_pipeline = mock_redis_client.pipeline.return_value
        mock_pipeline.execute.return_value = [None, 0, None, None]  # No current requests
        
        allowed, remaining, reset_time = middleware._check_redis_rate_limit(
            'test_key', 100, 60
        )
        
        assert allowed is True
        assert remaining == 99  # 100 - 0 - 1 (current request)
        assert reset_time is not None
    
    def test_redis_rate_limit_check_exceeded(self, app, mock_redis_client):
        """Test Redis rate limit check when limit is exceeded."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        # Mock pipeline execution for exceeded limit
        mock_pipeline = mock_redis_client.pipeline.return_value
        mock_pipeline.execute.return_value = [None, 100, None, None]  # Already at limit
        
        allowed, remaining, reset_time = middleware._check_redis_rate_limit(
            'test_key', 100, 60
        )
        
        assert allowed is False
        assert remaining == 0
        assert reset_time is not None
    
    def test_rate_limit_exceeded_error(self):
        """Test RateLimitExceededError creation and properties."""
        error = RateLimitExceededError("Test rate limit exceeded", retry_after=30)
        
        assert error.message == "Test rate limit exceeded"
        assert error.code == "TITHI_RATE_LIMIT_EXCEEDED"
        assert error.status_code == 429
        assert error.retry_after == 30
    
    def test_rate_limit_error_handler(self, app, client):
        """Test rate limit error handler response format."""
        with app.test_request_context():
            error = RateLimitExceededError("Rate limit exceeded", retry_after=60)
            response = app.error_handler_spec[None][429](error)
            
            response_data = json.loads(response.data)
            
            assert response_data['type'] == 'https://tithi.com/errors/rate-limit-exceeded'
            assert response_data['title'] == 'Rate Limit Exceeded'
            assert response_data['detail'] == 'Rate limit exceeded'
            assert response_data['status'] == 429
            assert response_data['code'] == 'TITHI_RATE_LIMIT_EXCEEDED'
            assert response_data['retry_after'] == 60
            assert response.status_code == 429
    
    def test_contract_test_101_requests_denied(self, app, mock_redis_client):
        """Contract test: 101 requests → last one denied."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        # Mock pipeline execution for first 100 requests (allowed)
        mock_pipeline = mock_redis_client.pipeline.return_value
        mock_pipeline.execute.return_value = [None, 0, None, None]  # No current requests
        
        # Test first 100 requests (should be allowed)
        for i in range(100):
            allowed, remaining, reset_time = middleware._check_redis_rate_limit(
                'test_key', 100, 60
            )
            assert allowed is True, f"Request {i+1} should be allowed"
            assert remaining == 99 - i, f"Remaining should be {99 - i} for request {i+1}"
        
        # Mock pipeline execution for 101st request (should be denied)
        mock_pipeline.execute.return_value = [None, 100, None, None]  # At limit
        
        # Test 101st request (should be denied)
        allowed, remaining, reset_time = middleware._check_redis_rate_limit(
            'test_key', 100, 60
        )
        assert allowed is False, "101st request should be denied"
        assert remaining == 0, "Remaining should be 0 when limit exceeded"
    
    def test_observability_hook_emission(self, app, mock_redis_client):
        """Test that RATE_LIMIT_TRIGGERED observability hook is emitted."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        with app.test_request_context('/api/bookings', method='POST'):
            # Set tenant and user context
            g.tenant_id = 'tenant-123'
            g.user_id = 'user-456'
            g.request_id = 'req-789'
            
            # Mock pipeline execution for exceeded limit
            mock_pipeline = mock_redis_client.pipeline.return_value
            mock_pipeline.execute.return_value = [None, 100, None, None]  # At limit
            
            # Mock logger to capture log calls
            with patch.object(middleware.logger, 'warning') as mock_logger:
                middleware._emit_rate_limit_triggered(
                    {'limit': 100, 'window': 60}, 0, time.time() + 60
                )
                
                # Verify observability hook was emitted
                mock_logger.assert_called_once()
                call_args = mock_logger.call_args
                
                assert call_args[0][0] == "Rate limit triggered"
                extra_data = call_args[1]['extra']
                
                assert extra_data['event'] == 'RATE_LIMIT_TRIGGERED'
                assert extra_data['tenant_id'] == 'tenant-123'
                assert extra_data['user_id'] == 'user-456'
                assert extra_data['endpoint'] == '/api/bookings'
                assert extra_data['method'] == 'POST'
                assert extra_data['limit'] == 100
                assert extra_data['window'] == 60
                assert extra_data['remaining'] == 0
                assert extra_data['request_id'] == 'req-789'
    
    def test_tenant_isolation_in_rate_limiting(self, app, mock_redis_client):
        """Test that rate limiting maintains tenant isolation."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        # Test different tenants get different rate limit keys
        with app.test_request_context('/api/bookings', method='POST'):
            g.tenant_id = 'tenant-1'
            g.user_id = 'user-1'
            key1 = middleware._generate_rate_limit_key()
            
        with app.test_request_context('/api/bookings', method='POST'):
            g.tenant_id = 'tenant-2'
            g.user_id = 'user-1'
            key2 = middleware._generate_rate_limit_key()
        
        assert key1 != key2
        assert 'tenant-1' in key1
        assert 'tenant-2' in key2
    
    def test_user_isolation_in_rate_limiting(self, app, mock_redis_client):
        """Test that rate limiting maintains user isolation within tenants."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        # Test different users get different rate limit keys within same tenant
        with app.test_request_context('/api/bookings', method='POST'):
            g.tenant_id = 'tenant-1'
            g.user_id = 'user-1'
            key1 = middleware._generate_rate_limit_key()
            
        with app.test_request_context('/api/bookings', method='POST'):
            g.tenant_id = 'tenant-1'
            g.user_id = 'user-2'
            key2 = middleware._generate_rate_limit_key()
        
        assert key1 != key2
        assert 'user-1' in key1
        assert 'user-2' in key2
    
    def test_endpoint_specific_rate_limit_configuration(self, app):
        """Test that endpoint-specific rate limits are properly configured."""
        middleware = RateLimitMiddleware(app)
        
        # Test bookings endpoint
        config = middleware._get_rate_limit_config()
        with app.test_request_context('/api/bookings'):
            config = middleware._get_rate_limit_config()
            assert config['limit'] == 50
            assert config['window'] == 60
        
        # Test payments endpoint
        with app.test_request_context('/api/payments'):
            config = middleware._get_rate_limit_config()
            assert config['limit'] == 30
            assert config['window'] == 60
        
        # Test availability endpoint
        with app.test_request_context('/api/availability'):
            config = middleware._get_rate_limit_config()
            assert config['limit'] == 200
            assert config['window'] == 60
        
        # Test tenant operations endpoint
        with app.test_request_context('/v1/tenants'):
            config = middleware._get_rate_limit_config()
            assert config['limit'] == 20
            assert config['window'] == 60
    
    def test_global_default_rate_limit(self, app):
        """Test that global default rate limit is used for unconfigured endpoints."""
        middleware = RateLimitMiddleware(app)
        
        with app.test_request_context('/api/unknown-endpoint'):
            config = middleware._get_rate_limit_config()
            assert config['limit'] == 100  # Global default
            assert config['window'] == 60  # Global default
    
    def test_rate_limit_headers_addition(self, app):
        """Test that rate limit headers are added to responses."""
        middleware = RateLimitMiddleware(app)
        
        with app.test_request_context():
            middleware._add_rate_limit_headers(50, time.time() + 60)
            
            assert hasattr(g, 'rate_limit_headers')
            headers = g.rate_limit_headers
            
            assert 'X-RateLimit-Remaining' in headers
            assert 'X-RateLimit-Reset' in headers
            assert 'Retry-After' in headers
            assert headers['X-RateLimit-Remaining'] == '50'
    
    def test_redis_connection_failure_fallback(self, app):
        """Test fallback behavior when Redis connection fails."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = None  # Simulate Redis failure
        
        # Should fall back to in-memory rate limiting
        allowed, remaining, reset_time = middleware._check_token_bucket(
            {'limit': 100, 'window': 60}
        )
        
        # In-memory fallback should allow requests (basic implementation)
        assert allowed is True
        assert remaining is not None
        assert reset_time is not None
    
    def test_rate_limit_decorator(self, app):
        """Test rate_limit decorator functionality."""
        from app.middleware.rate_limit_middleware import rate_limit
        
        @rate_limit(limit=50, window=60)
        def test_endpoint():
            return "success"
        
        # Decorator should not raise errors
        result = test_endpoint()
        assert result == "success"
    
    def test_get_rate_limit_status(self, app):
        """Test get_rate_limit_status function."""
        from app.middleware.rate_limit_middleware import get_rate_limit_status
        
        with app.test_request_context():
            # Test without rate limit headers
            status = get_rate_limit_status()
            assert status['status'] == 'no_rate_limit_applied'
            
            # Test with rate limit headers
            g.rate_limit_headers = {
                'X-RateLimit-Remaining': '50',
                'X-RateLimit-Reset': '1234567890',
                'Retry-After': '60'
            }
            
            status = get_rate_limit_status()
            assert status['status'] == 'rate_limit_applied'
            assert 'headers' in status
            assert status['headers']['X-RateLimit-Remaining'] == '50'
    
    def test_health_endpoint_exemption(self, app, mock_redis_client):
        """Test that health endpoints are exempt from rate limiting."""
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        with app.test_request_context('/health/live'):
            # Health endpoints should not trigger rate limiting
            # This is tested by ensuring no Redis calls are made
            middleware._check_rate_limit()
            
            # Verify no Redis operations were called
            mock_redis_client.pipeline.assert_not_called()
    
    def test_testing_mode_exemption(self, app, mock_redis_client):
        """Test that testing mode exempts requests from rate limiting."""
        app.config['TESTING'] = True
        middleware = RateLimitMiddleware(app)
        middleware.redis_client = mock_redis_client
        
        with app.test_request_context('/api/bookings'):
            # Testing mode should not trigger rate limiting
            middleware._check_rate_limit()
            
            # Verify no Redis operations were called
            mock_redis_client.pipeline.assert_not_called()


class TestRateLimitingIntegration:
    """Integration tests for rate limiting with Flask app."""
    
    @pytest.fixture
    def app_with_rate_limiting(self):
        """Create Flask app with rate limiting middleware enabled."""
        app = create_app('testing')
        app.config['TESTING'] = True
        
        # Mock Redis client
        with patch('app.middleware.rate_limit_middleware.redis.from_url') as mock_redis:
            mock_client = MagicMock()
            mock_client.ping.return_value = True
            mock_client.pipeline.return_value = MagicMock()
            mock_redis.return_value = mock_client
            
            yield app
    
    def test_rate_limiting_middleware_integration(self, app_with_rate_limiting):
        """Test that rate limiting middleware integrates properly with Flask app."""
        client = app_with_rate_limiting.test_client()
        
        # Test that app starts without errors
        response = client.get('/health/live')
        assert response.status_code == 200
    
    def test_rate_limit_error_response_format(self, app_with_rate_limiting):
        """Test that rate limit errors return proper Problem+JSON format."""
        client = app_with_rate_limiting.test_client()
        
        # Mock rate limit exceeded
        with patch('app.middleware.rate_limit_middleware.RateLimitMiddleware._check_token_bucket') as mock_check:
            mock_check.return_value = (False, 0, time.time() + 60)
            
            response = client.get('/api/bookings')
            
            assert response.status_code == 429
            data = json.loads(response.data)
            
            assert data['type'] == 'https://tithi.com/errors/rate-limit-exceeded'
            assert data['title'] == 'Rate Limit Exceeded'
            assert data['status'] == 429
            assert data['code'] == 'TITHI_RATE_LIMIT_EXCEEDED'
            assert 'retry_after' in data
            assert 'Retry-After' in response.headers


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
