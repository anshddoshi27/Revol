"""
Simple Test Suite for Audit Service
Tests the core audit logging functionality without complex database setup
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

from app.services.audit_service import AuditService
from app.middleware.audit_middleware import AuditAction


class TestAuditServiceSimple:
    """Simple tests for audit service functionality."""

    def test_audit_service_initialization(self):
        """Test that audit service can be initialized."""
        audit_service = AuditService()
        assert audit_service is not None

    def test_audit_action_constants(self):
        """Test that audit action constants are properly defined."""
        # Test booking actions
        assert AuditAction.BOOKING_CREATED == "BOOKING_CREATED"
        assert AuditAction.BOOKING_CONFIRMED == "BOOKING_CONFIRMED"
        assert AuditAction.BOOKING_CANCELLED == "BOOKING_CANCELLED"
        
        # Test payment actions
        assert AuditAction.PAYMENT_CREATED == "PAYMENT_CREATED"
        assert AuditAction.PAYMENT_CAPTURED == "PAYMENT_CAPTURED"
        assert AuditAction.PAYMENT_REFUNDED == "PAYMENT_REFUNDED"
        
        # Test staff actions
        assert AuditAction.STAFF_CREATED == "STAFF_CREATED"
        assert AuditAction.STAFF_UPDATED == "STAFF_UPDATED"
        assert AuditAction.STAFF_DELETED == "STAFF_DELETED"
        
        # Test service actions
        assert AuditAction.SERVICE_CREATED == "SERVICE_CREATED"
        assert AuditAction.SERVICE_UPDATED == "SERVICE_UPDATED"
        assert AuditAction.SERVICE_DELETED == "SERVICE_DELETED"

    def test_audit_service_methods_exist(self):
        """Test that audit service has required methods."""
        audit_service = AuditService()
        
        # Check that required methods exist
        assert hasattr(audit_service, 'create_audit_log')
        assert hasattr(audit_service, 'get_audit_logs')
        assert hasattr(audit_service, 'get_audit_trail')
        assert hasattr(audit_service, 'get_user_activity')
        assert hasattr(audit_service, 'get_audit_statistics')
        assert hasattr(audit_service, 'purge_old_audit_logs')
        assert hasattr(audit_service, 'validate_audit_log_integrity')
        
        # Check method signatures
        assert callable(audit_service.create_audit_log)
        assert callable(audit_service.get_audit_logs)
        assert callable(audit_service.get_audit_trail)
        assert callable(audit_service.get_user_activity)
        assert callable(audit_service.get_audit_statistics)
        assert callable(audit_service.purge_old_audit_logs)
        assert callable(audit_service.validate_audit_log_integrity)

    def test_audit_service_immutability_check(self):
        """Test that audit service has immutable fields configuration."""
        audit_service = AuditService()
        
        # Check that immutable fields are configured
        assert hasattr(audit_service, 'immutable_fields')
        assert isinstance(audit_service.immutable_fields, list)
        assert 'id' in audit_service.immutable_fields
        assert 'tenant_id' in audit_service.immutable_fields
        assert 'created_at' in audit_service.immutable_fields
        assert 'user_id' in audit_service.immutable_fields

    @patch('app.services.audit_service.db')
    def test_audit_service_create_log_with_mock(self, mock_db):
        """Test audit log creation with mocked database."""
        # Setup mock
        mock_session = MagicMock()
        mock_db.session = mock_session
        
        # Mock the AuditLog model
        with patch('app.services.audit_service.AuditLog') as mock_audit_log_class:
            mock_audit_log_instance = MagicMock()
            mock_audit_log_instance.id = uuid.uuid4()
            mock_audit_log_class.return_value = mock_audit_log_instance
            
            audit_service = AuditService()
            
            # Test data
            tenant_id = uuid.uuid4()
            user_id = uuid.uuid4()
            record_id = uuid.uuid4()
            
            # Create audit log
            result = audit_service.create_audit_log(
                tenant_id=str(tenant_id),
                table_name="test_table",
                operation="INSERT",
                record_id=str(record_id),
                user_id=str(user_id),
                new_data={"field": "value"}
            )
            
            # Verify the result is a string (audit log ID)
            assert isinstance(result, str)
            assert result == str(mock_audit_log_instance.id)
            
            # Verify that the audit log was created with correct parameters
            mock_audit_log_class.assert_called_once()
            call_args = mock_audit_log_class.call_args[1]
            
            assert call_args['tenant_id'] == str(tenant_id)
            assert call_args['table_name'] == "test_table"
            assert call_args['operation'] == "INSERT"
            assert call_args['record_id'] == str(record_id)
            assert call_args['user_id'] == str(user_id)
            assert call_args['new_data'] == {"field": "value"}
            assert call_args['old_data'] == {}
            
            # Verify database operations
            mock_session.add.assert_called_once_with(mock_audit_log_instance)
            mock_session.commit.assert_called_once()

    @patch('app.services.audit_service.db')
    def test_audit_service_error_handling(self, mock_db):
        """Test audit service error handling."""
        # Setup mock to raise an exception
        mock_session = MagicMock()
        mock_db.session = mock_session
        mock_session.commit.side_effect = Exception("Database error")
        
        audit_service = AuditService()
        
        # Test that exception is properly handled
        from app.middleware.error_handler import TithiError
        with pytest.raises(TithiError) as exc_info:
            audit_service.create_audit_log(
                tenant_id=str(uuid.uuid4()),
                table_name="test_table",
                operation="INSERT",
                record_id=str(uuid.uuid4()),
                user_id=str(uuid.uuid4())
            )
        
        # Verify rollback was called
        mock_session.rollback.assert_called_once()
        
        # Verify the exception was wrapped in TithiError
        # The error code is "TITHI_AUDIT_WRITE_FAILED"
        assert "TITHI_AUDIT_WRITE_FAILED" in str(exc_info.value)

    def test_audit_middleware_action_mapping(self):
        """Test audit middleware action to table mapping."""
        from app.middleware.audit_middleware import AuditMiddleware
        
        middleware = AuditMiddleware()
        
        # Test booking actions
        assert middleware._get_table_name_from_action(AuditAction.BOOKING_CREATED) == "bookings"
        assert middleware._get_table_name_from_action(AuditAction.BOOKING_CONFIRMED) == "bookings"
        assert middleware._get_table_name_from_action(AuditAction.BOOKING_CANCELLED) == "bookings"
        
        # Test payment actions
        assert middleware._get_table_name_from_action(AuditAction.PAYMENT_CREATED) == "payments"
        assert middleware._get_table_name_from_action(AuditAction.PAYMENT_CAPTURED) == "payments"
        
        # Test staff actions
        assert middleware._get_table_name_from_action(AuditAction.STAFF_CREATED) == "staff_profiles"
        assert middleware._get_table_name_from_action(AuditAction.STAFF_UPDATED) == "staff_profiles"
        
        # Test service actions
        assert middleware._get_table_name_from_action(AuditAction.SERVICE_CREATED) == "services"
        assert middleware._get_table_name_from_action(AuditAction.SERVICE_UPDATED) == "services"

    def test_audit_middleware_operation_mapping(self):
        """Test audit middleware action to operation mapping."""
        from app.middleware.audit_middleware import AuditMiddleware
        
        middleware = AuditMiddleware()
        
        # Test INSERT operations
        assert middleware._get_operation_from_action(AuditAction.BOOKING_CREATED) == "INSERT"
        assert middleware._get_operation_from_action(AuditAction.STAFF_CREATED) == "INSERT"
        assert middleware._get_operation_from_action(AuditAction.SERVICE_CREATED) == "INSERT"
        
        # Test UPDATE operations
        assert middleware._get_operation_from_action(AuditAction.BOOKING_CONFIRMED) == "UPDATE"
        assert middleware._get_operation_from_action(AuditAction.BOOKING_RESCHEDULED) == "UPDATE"
        assert middleware._get_operation_from_action(AuditAction.PAYMENT_CAPTURED) == "UPDATE"
        
        # Test DELETE operations
        assert middleware._get_operation_from_action(AuditAction.BOOKING_CANCELLED) == "UPDATE"  # Cancelled is an update to status
        assert middleware._get_operation_from_action(AuditAction.STAFF_DELETED) == "DELETE"
        assert middleware._get_operation_from_action(AuditAction.SERVICE_DELETED) == "DELETE"
        
        # Test ACCESS operations (these map to UPDATE in the current implementation)
        assert middleware._get_operation_from_action(AuditAction.ADMIN_LOGIN) == "UPDATE"
        assert middleware._get_operation_from_action(AuditAction.ADMIN_LOGOUT) == "UPDATE"
        assert middleware._get_operation_from_action(AuditAction.ADMIN_ACTION_PERFORMED) == "UPDATE"

    def test_audit_log_action_decorator_exists(self):
        """Test that the audit_log_action decorator exists and is callable."""
        from app.middleware.audit_middleware import audit_log_action
        
        # Test that decorator exists and is callable
        assert callable(audit_log_action)
        
        # Test that decorator can be called with action parameter
        decorator = audit_log_action(AuditAction.BOOKING_CREATED)
        assert callable(decorator)
        
        # Test that decorator can be called with additional parameters
        decorator_with_params = audit_log_action(
            AuditAction.BOOKING_CREATED,
            entity_id="test-id",
            old_data={"old": "data"},
            new_data={"new": "data"}
        )
        assert callable(decorator_with_params)

    def test_audit_service_logging_integration(self):
        """Test that audit service integrates with logging."""
        with patch('app.services.audit_service.logger') as mock_logger:
            audit_service = AuditService()
            
            # Mock the database operations
            with patch('app.services.audit_service.db') as mock_db:
                mock_session = MagicMock()
                mock_db.session = mock_session
                
                with patch('app.services.audit_service.AuditLog') as mock_audit_log_class:
                    mock_audit_log_instance = MagicMock()
                    mock_audit_log_instance.id = uuid.uuid4()
                    mock_audit_log_class.return_value = mock_audit_log_instance
                    
                    # Create audit log
                    audit_service.create_audit_log(
                        tenant_id=uuid.uuid4(),
                        table_name="test_table",
                        operation="INSERT",
                        record_id=uuid.uuid4(),
                        user_id=uuid.uuid4()
                    )
                    
                    # Verify that logging was called (multiple times)
                    assert mock_logger.info.call_count >= 1
                    
                    # Verify log message content - check the first call
                    first_call = mock_logger.info.call_args_list[0]
                    assert first_call[0][0] == "AUDIT_LOG_WRITTEN"
                    
                    # Verify log context
                    log_context = first_call[1]
                    assert 'audit_log_id' in log_context
                    assert 'tenant_id' in log_context
                    assert 'table_name' in log_context
                    assert 'operation' in log_context
                    assert 'record_id' in log_context
                    assert 'user_id' in log_context
