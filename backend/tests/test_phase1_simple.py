"""
Phase 1 Simple Test Suite

This is a simplified test suite to verify Phase 1 restoration.
"""

import pytest
import os
from app import create_app


class TestPhase1Restoration:
    """Test Phase 1 restoration."""
    
    def test_app_creation(self):
        """Test that the app can be created."""
        # Set environment variables
        os.environ['TESTING'] = 'true'
        os.environ['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        os.environ['SECRET_KEY'] = 'test-secret-key-123456789'
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_KEY'] = 'test-key'
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        
        app = create_app('testing')
        assert app is not None
        assert app.config['TESTING'] is True
    
    def test_health_endpoint(self):
        """Test health endpoint."""
        # Set environment variables
        os.environ['TESTING'] = 'true'
        os.environ['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        os.environ['SECRET_KEY'] = 'test-secret-key-123456789'
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_KEY'] = 'test-key'
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        
        app = create_app('testing')
        client = app.test_client()
        
        response = client.get('/health/')
        assert response.status_code == 200
        
        data = response.get_json()
        assert 'status' in data
        assert 'services' in data
    
    def test_blueprint_registration(self):
        """Test blueprint registration."""
        # Set environment variables
        os.environ['TESTING'] = 'true'
        os.environ['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        os.environ['SECRET_KEY'] = 'test-secret-key-123456789'
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_KEY'] = 'test-key'
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        
        app = create_app('testing')
        
        # Check that blueprints are registered
        routes = [rule.rule for rule in app.url_map.iter_rules()]
        assert any(route.startswith('/health') for route in routes)
        assert any(route.startswith('/api/v1') for route in routes)
        assert any(route.startswith('/v1/') for route in routes)
