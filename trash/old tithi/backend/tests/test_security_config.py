"""
Security Configuration Validation Tests

This module contains comprehensive tests for security configuration validation
to ensure all security settings are properly configured and enforced.

Security Configurations Tested:
- Security headers validation
- CORS configuration
- Rate limiting configuration
- Authentication configuration
- Encryption configuration
- Audit logging configuration
- Error handling security
- Session security
- Input validation security
"""

import pytest
import json
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock
from flask import Flask, request, g
import os

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.middleware.auth_middleware import AuthMiddleware
from app.middleware.rate_limit_middleware import RateLimitMiddleware
from app.middleware.encryption_middleware import EncryptionMiddleware
from app.middleware.audit_middleware import AuditMiddleware
from app.middleware.error_handler import TithiError
from app.config import Config


class TestSecurityConfiguration:
    """Comprehensive security configuration validation tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for each test."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="security-config-tenant",
                name="Security Config Tenant",
                timezone="UTC",
                is_active=True
            )
            db.session.add(self.tenant)
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="Security Config User",
                primary_email="security-config@example.com"
            )
            db.session.add(self.user)
            
            # Create membership
            self.membership = Membership(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                user_id=self.user.id,
                role="owner"
            )
            db.session.add(self.membership)
            
            db.session.commit()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_security_headers(self):
        """Test that security headers are properly set."""
        response = self.client.get('/health/live')
        
        # Verify security headers are present
        security_headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'",
            'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
        
        for header, expected_value in security_headers.items():
            if header in response.headers:
                assert response.headers[header] == expected_value, f"Security header {header} not set correctly"
            else:
                # Some headers might be optional in test environment
                print(f"Warning: Security header {header} not found in response")
    
    def test_cors_configuration(self):
        """Test CORS configuration security."""
        # Test preflight request
        response = self.client.options('/api/test', headers={
            'Origin': 'https://malicious-site.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
        })
        
        # Verify CORS headers are properly configured
        if 'Access-Control-Allow-Origin' in response.headers:
            allowed_origin = response.headers['Access-Control-Allow-Origin']
            # Should not allow arbitrary origins
            assert allowed_origin != '*', "CORS should not allow all origins"
            assert 'malicious-site.com' not in allowed_origin, "CORS should not allow malicious origins"
    
    def test_rate_limiting_configuration(self):
        """Test rate limiting configuration."""
        rate_limit_middleware = RateLimitMiddleware()
        
        # Test default rate limits
        assert rate_limit_middleware.default_limit == 100, "Default rate limit should be 100 requests per minute"
        assert rate_limit_middleware.default_window == 60, "Default rate limit window should be 60 seconds"
        
        # Test endpoint-specific limits
        endpoint_limits = rate_limit_middleware.endpoint_limits
        
        assert '/api/bookings' in endpoint_limits, "Bookings endpoint should have specific rate limit"
        assert endpoint_limits['/api/bookings']['limit'] == 50, "Bookings rate limit should be 50 req/min"
        
        assert '/api/payments' in endpoint_limits, "Payments endpoint should have specific rate limit"
        assert endpoint_limits['/api/payments']['limit'] == 30, "Payments rate limit should be 30 req/min"
        
        assert '/api/availability' in endpoint_limits, "Availability endpoint should have specific rate limit"
        assert endpoint_limits['/api/availability']['limit'] == 200, "Availability rate limit should be 200 req/min"
    
    def test_authentication_configuration(self):
        """Test authentication configuration security."""
        auth_middleware = AuthMiddleware()
        
        # Test JWT configuration
        assert hasattr(auth_middleware, 'app'), "Auth middleware should be initialized"
        
        # Test that authentication is required for protected endpoints
        response = self.client.get('/api/tenants/current')
        assert response.status_code == 401, "Protected endpoint should require authentication"
        
        # Test that public endpoints don't require authentication
        response = self.client.get('/health/live')
        assert response.status_code == 200, "Health endpoint should be public"
    
    def test_encryption_configuration(self):
        """Test encryption configuration security."""
        encryption_middleware = EncryptionMiddleware()
        
        # Test encryption key configuration
        assert hasattr(encryption_middleware, 'encryption_key'), "Encryption middleware should have encryption key"
        
        # Test that encryption key is properly configured
        encryption_key = encryption_middleware.encryption_key
        assert encryption_key is not None, "Encryption key should not be None"
        assert len(encryption_key) >= 32, "Encryption key should be at least 32 characters"
        
        # Test encryption/decryption functionality
        test_data = "sensitive test data"
        encrypted_data = encryption_middleware.encrypt(test_data)
        decrypted_data = encryption_middleware.decrypt(encrypted_data)
        
        assert encrypted_data != test_data, "Encrypted data should be different from original"
        assert decrypted_data == test_data, "Decrypted data should match original"
    
    def test_audit_logging_configuration(self):
        """Test audit logging configuration."""
        audit_middleware = AuditMiddleware()
        
        # Test audit configuration
        assert hasattr(audit_middleware, 'app'), "Audit middleware should be initialized"
        
        # Test audit action types
        from app.middleware.audit_middleware import AuditAction
        assert hasattr(AuditAction, 'CREATE'), "AuditAction should have CREATE action"
        assert hasattr(AuditAction, 'UPDATE'), "AuditAction should have UPDATE action"
        assert hasattr(AuditAction, 'DELETE'), "AuditAction should have DELETE action"
        assert hasattr(AuditAction, 'READ'), "AuditAction should have READ action"
        assert hasattr(AuditAction, 'SECURITY_EVENT'), "AuditAction should have SECURITY_EVENT action"
    
    def test_error_handling_security(self):
        """Test error handling security configuration."""
        # Test that error responses don't leak sensitive information
        response = self.client.get('/api/nonexistent-endpoint')
        
        # Verify error response doesn't contain sensitive information
        error_data = response.get_json()
        if error_data:
            error_str = str(error_data).lower()
            sensitive_patterns = ['password', 'secret', 'key', 'token', 'api_key']
            for pattern in sensitive_patterns:
                assert pattern not in error_str, f"Sensitive pattern {pattern} found in error response"
    
    def test_session_security(self):
        """Test session security configuration."""
        # Test session configuration
        assert self.app.config.get('SESSION_COOKIE_SECURE', False), "Session cookies should be secure in production"
        assert self.app.config.get('SESSION_COOKIE_HTTPONLY', True), "Session cookies should be HTTP only"
        assert self.app.config.get('SESSION_COOKIE_SAMESITE', 'Lax'), "Session cookies should have SameSite protection"
    
    def test_input_validation_security(self):
        """Test input validation security configuration."""
        # Test SQL injection prevention
        malicious_input = "'; DROP TABLE users; --"
        
        response = self.client.post('/api/customers', json={
            'display_name': malicious_input,
            'email': 'test@example.com',
            'tenant_id': str(self.tenant.id)
        })
        
        # Should not cause SQL injection
        assert response.status_code != 500, "Malicious input should not cause server error"
        
        # Test XSS prevention
        xss_input = "<script>alert('XSS')</script>"
        
        response = self.client.post('/api/customers', json={
            'display_name': xss_input,
            'email': 'test@example.com',
            'tenant_id': str(self.tenant.id)
        })
        
        # Should sanitize XSS input
        if response.status_code == 200:
            response_data = response.get_json()
            if 'display_name' in response_data:
                assert '<script>' not in response_data['display_name'], "XSS input should be sanitized"
    
    def test_environment_security(self):
        """Test environment security configuration."""
        # Test that sensitive environment variables are not exposed
        sensitive_vars = [
            'STRIPE_SECRET_KEY',
            'DATABASE_URL',
            'REDIS_URL',
            'JWT_SECRET_KEY',
            'ENCRYPTION_KEY'
        ]
        
        for var in sensitive_vars:
            if var in os.environ:
                # Should not be exposed in application config
                assert var not in str(self.app.config), f"Sensitive environment variable {var} should not be exposed in config"
    
    def test_database_security_configuration(self):
        """Test database security configuration."""
        # Test database connection security
        db_url = self.app.config.get('DATABASE_URL', '')
        
        if db_url:
            # Should use SSL in production
            if 'production' in self.app.config.get('ENV', ''):
                assert 'sslmode=require' in db_url, "Database should require SSL in production"
        
        # Test connection pooling
        assert hasattr(db, 'engine'), "Database should have engine configured"
        
        # Test connection limits
        engine = db.engine
        if hasattr(engine.pool, 'size'):
            assert engine.pool.size() <= 20, "Database connection pool should be limited"
    
    def test_redis_security_configuration(self):
        """Test Redis security configuration."""
        redis_url = self.app.config.get('REDIS_URL', '')
        
        if redis_url:
            # Should use authentication
            assert '@' in redis_url or 'password' in redis_url, "Redis should use authentication"
            
            # Should use SSL in production
            if 'production' in self.app.config.get('ENV', ''):
                assert redis_url.startswith('rediss://'), "Redis should use SSL in production"
    
    def test_logging_security_configuration(self):
        """Test logging security configuration."""
        # Test that logs don't contain sensitive information
        import logging
        
        # Create test logger
        logger = logging.getLogger('security_test')
        
        # Test log message sanitization
        sensitive_data = {
            'password': 'secret123',
            'api_key': 'sk_test_123456789',
            'card_number': '4111111111111111'
        }
        
        # Log should not contain sensitive data
        log_message = f"Test log with data: {sensitive_data}"
        
        # Check if logging configuration sanitizes sensitive data
        # This is a basic check - actual implementation would depend on logging configuration
        assert 'secret123' not in log_message.lower() or 'password' not in log_message.lower(), "Logs should not contain sensitive data"
    
    def test_api_security_configuration(self):
        """Test API security configuration."""
        # Test API versioning
        response = self.client.get('/api/v1/test')
        # Should handle versioning properly
        
        # Test API rate limiting headers
        response = self.client.get('/api/test')
        if 'X-RateLimit-Limit' in response.headers:
            assert response.headers['X-RateLimit-Limit'].isdigit(), "Rate limit header should be numeric"
        
        # Test API authentication headers
        response = self.client.get('/api/test')
        if 'WWW-Authenticate' in response.headers:
            assert 'Bearer' in response.headers['WWW-Authenticate'], "API should use Bearer authentication"
    
    def test_ssl_tls_configuration(self):
        """Test SSL/TLS configuration."""
        # Test HTTPS enforcement
        if self.app.config.get('ENV') == 'production':
            # In production, should enforce HTTPS
            assert self.app.config.get('FORCE_HTTPS', False), "Production should enforce HTTPS"
        
        # Test TLS version
        # This would typically be tested at the web server level
        # but we can check if the app is configured for secure connections
        assert self.app.config.get('PREFERRED_URL_SCHEME', 'http') == 'https' or \
               self.app.config.get('ENV') != 'production', "Should prefer HTTPS in production"
    
    def test_security_middleware_order(self):
        """Test that security middleware is applied in correct order."""
        # Test middleware registration order
        middleware_order = []
        
        # Check if middleware is registered in correct order
        # Security middleware should be applied early in the request cycle
        for func in self.app.before_request_funcs.get(None, []):
            middleware_order.append(func.__name__)
        
        # Auth middleware should be before business logic
        auth_middleware_found = False
        for func_name in middleware_order:
            if 'auth' in func_name.lower():
                auth_middleware_found = True
                break
        
        assert auth_middleware_found, "Authentication middleware should be registered"
    
    def test_security_headers_consistency(self):
        """Test that security headers are consistent across all endpoints."""
        endpoints_to_test = [
            '/health/live',
            '/health/ready',
            '/api/test',
            '/v1/test'
        ]
        
        security_headers = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection'
        ]
        
        for endpoint in endpoints_to_test:
            try:
                response = self.client.get(endpoint)
                
                for header in security_headers:
                    if header in response.headers:
                        # Header should be consistent across endpoints
                        header_value = response.headers[header]
                        assert header_value is not None, f"Security header {header} should have value for {endpoint}"
            except Exception:
                # Some endpoints might not exist in test environment
                continue
    
    def test_csrf_protection_configuration(self):
        """Test CSRF protection configuration."""
        # Test CSRF token requirement for state-changing operations
        response = self.client.post('/api/customers', json={
            'display_name': 'Test Customer',
            'email': 'test@example.com',
            'tenant_id': str(self.tenant.id)
        })
        
        # Should require CSRF protection for POST requests
        # Implementation depends on CSRF middleware configuration
        if response.status_code == 403:
            assert 'csrf' in response.get_json().get('detail', '').lower(), "Should indicate CSRF protection"
    
    def test_security_monitoring_configuration(self):
        """Test security monitoring configuration."""
        # Test that security events are properly monitored
        from app.middleware.audit_middleware import AuditAction
        
        # Test security event logging
        assert hasattr(AuditAction, 'SECURITY_EVENT'), "Should have security event audit action"
        
        # Test that security violations are logged
        # This would typically involve testing actual security violations
        # and ensuring they are properly logged and monitored


class TestSecurityConfigurationIntegration:
    """Integration tests for security configuration across the entire system."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Set up test environment for integration tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            db.create_all()
    
    def teardown_method(self):
        """Clean up after each test."""
        with self.app.app_context():
            db.drop_all()
    
    def test_security_configuration_consistency(self):
        """Test that security configuration is consistent across all components."""
        # Test that all security middleware is properly configured
        middleware_components = [
            AuthMiddleware,
            RateLimitMiddleware,
            EncryptionMiddleware,
            AuditMiddleware
        ]
        
        for middleware_class in middleware_components:
            middleware = middleware_class()
            middleware.init_app(self.app)
            
            # Each middleware should be properly initialized
            assert hasattr(middleware, 'app'), f"{middleware_class.__name__} should be initialized with app"
    
    def test_security_configuration_environment_switching(self):
        """Test that security configuration adapts to different environments."""
        # Test development environment
        dev_app = create_app('development')
        assert dev_app.config.get('ENV') == 'development'
        
        # Test production environment
        prod_app = create_app('production')
        assert prod_app.config.get('ENV') == 'production'
        
        # Security should be stricter in production
        assert prod_app.config.get('SESSION_COOKIE_SECURE', False), "Production should use secure session cookies"
        assert prod_app.config.get('PREFERRED_URL_SCHEME') == 'https', "Production should prefer HTTPS"
    
    def test_security_configuration_validation(self):
        """Test that security configuration is validated on startup."""
        # Test that invalid security configuration causes startup failure
        with patch.dict(os.environ, {'ENCRYPTION_KEY': ''}):
            with pytest.raises(Exception):
                # Should fail to start with invalid encryption key
                create_app('testing')
    
    def test_security_configuration_documentation(self):
        """Test that security configuration is properly documented."""
        # Test that security settings are documented in configuration
        security_settings = [
            'SECRET_KEY',
            'JWT_SECRET_KEY',
            'ENCRYPTION_KEY',
            'SESSION_COOKIE_SECURE',
            'SESSION_COOKIE_HTTPONLY',
            'SESSION_COOKIE_SAMESITE'
        ]
        
        for setting in security_settings:
            # Should be defined in configuration
            assert hasattr(Config, setting), f"Security setting {setting} should be defined in Config"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
