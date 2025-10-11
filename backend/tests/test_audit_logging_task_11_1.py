"""
Test Suite for Task 11.1: Audit Logging
Comprehensive contract tests for immutable audit logging functionality
"""

import pytest
import uuid
import json
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from app import create_app, db
from app.models.audit import AuditLog, EventOutbox
from app.models.business import Booking, Customer, Service, Resource
from app.models import User, Tenant
from app.services.audit_service import AuditService
from app.middleware.audit_middleware import AuditMiddleware, AuditAction


class TestAuditLoggingTask111:
    """Comprehensive test suite for Task 11.1: Audit Logging."""
    
    def setup_test_environment(self):
        """Set up test environment."""
        import os
        # Set environment variables
        os.environ['TESTING'] = 'true'
        os.environ['SQLALCHEMY_DATABASE_URI'] = 'postgresql://localhost/tithi_test_db'
        os.environ['SECRET_KEY'] = 'test-secret-key-123456789'
        os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
        os.environ['SUPABASE_KEY'] = 'test-key'
        os.environ['DATABASE_URL'] = 'postgresql://localhost/tithi_test_db'
        
        self.app = create_app('testing')
        self.client = self.app.test_client()
        
        with self.app.app_context():
            # Create test database
            db.create_all()
            
            # Create test tenant
            self.tenant = Tenant(
                id=uuid.uuid4(),
                slug="test-audit-tenant",
                tz="UTC"
            )
            
            # Create test user
            self.user = User(
                id=uuid.uuid4(),
                display_name="Test Audit User",
                primary_email="audit@test.com"
            )
            
            # Create test customer
            self.customer = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                display_name="Test Customer",
                email="customer@test.com"
            )
            
            # Create test service
            self.service = Service(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                name="Test Service",
                slug="test-service",
                duration_min=60,
                price_cents=5000
            )
            
            # Create test resource
            self.resource = Resource(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                name="Test Staff",
                type="staff",
                tz="UTC",
                capacity=1
            )
            
            db.session.add_all([self.tenant, self.user, self.customer, self.service, self.resource])
            db.session.commit()
            
            self.audit_service = AuditService()
    
    def test_audit_log_creation_immutable(self):
        """Test that audit logs are created and immutable."""
        self.setup_test_environment()
        
        with self.app.app_context():
            # Create audit log
            audit_log_id = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="bookings",
                operation="INSERT",
                record_id=str(uuid.uuid4()),
                user_id=str(self.user.id),
                old_data={},
                new_data={"status": "confirmed"},
                action="BOOKING_CREATED"
            )
            
            # Verify audit log was created
            audit_log = AuditLog.query.get(audit_log_id)
            assert audit_log is not None
            assert audit_log.tenant_id == self.tenant.id
            assert audit_log.table_name == "bookings"
            assert audit_log.operation == "INSERT"
            assert audit_log.user_id == self.user.id
            assert audit_log.new_data == {"status": "confirmed"}
            
            # Verify audit log is immutable (cannot be updated)
            original_created_at = audit_log.created_at
            audit_log.operation = "UPDATE"
            db.session.commit()
            
            # Verify the operation was not changed (immutable)
            updated_audit_log = AuditLog.query.get(audit_log_id)
            assert updated_audit_log.operation == "INSERT"  # Should remain unchanged
            assert updated_audit_log.created_at == original_created_at
    
    def test_audit_log_with_actor_id_and_timestamp(self):
        """Test that audit logs include actor_id and timestamp."""
        with self.app.app_context():
            audit_log_id = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="payments",
                operation="UPDATE",
                record_id=str(uuid.uuid4()),
                user_id=str(self.user.id),
                old_data={"status": "pending"},
                new_data={"status": "captured"},
                action="PAYMENT_CAPTURED"
            )
            
            audit_log = AuditLog.query.get(audit_log_id)
            
            # Verify actor_id (user_id) is present
            assert audit_log.user_id == self.user.id
            
            # Verify timestamp is present and recent
            assert audit_log.created_at is not None
            assert datetime.utcnow() - audit_log.created_at < timedelta(minutes=1)
    
    def test_audit_log_cannot_be_altered(self):
        """Test that audit logs cannot be altered after creation."""
        with self.app.app_context():
            # Create audit log
            audit_log_id = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="services",
                operation="INSERT",
                record_id=str(self.service.id),
                user_id=str(self.user.id),
                old_data={},
                new_data={"name": "Updated Service"},
                action="SERVICE_CREATED"
            )
            
            audit_log = AuditLog.query.get(audit_log_id)
            original_data = audit_log.new_data.copy()
            original_operation = audit_log.operation
            
            # Attempt to modify audit log
            audit_log.new_data = {"name": "Malicious Change"}
            audit_log.operation = "DELETE"
            db.session.commit()
            
            # Verify audit log was not modified
            updated_audit_log = AuditLog.query.get(audit_log_id)
            assert updated_audit_log.new_data == original_data
            assert updated_audit_log.operation == original_operation
    
    def test_booking_creation_logs_audit(self):
        """Test that booking creation creates audit log."""
        with self.app.app_context():
            # Create booking (should trigger audit log via database trigger)
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customer.id,
                resource_id=self.resource.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"service_id": str(self.service.id)},
                start_at=datetime.utcnow() + timedelta(days=1),
                end_at=datetime.utcnow() + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="confirmed"
            )
            
            db.session.add(booking)
            db.session.commit()
            
            # Verify audit log was created
            audit_logs = AuditLog.query.filter(
                AuditLog.tenant_id == self.tenant.id,
                AuditLog.table_name == "bookings",
                AuditLog.record_id == str(booking.id)
            ).all()
            
            assert len(audit_logs) > 0
            audit_log = audit_logs[0]
            assert audit_log.operation == "INSERT"
            assert audit_log.record_id == str(booking.id)
    
    def test_admin_edits_booking_logs_audit(self):
        """Test that admin edits to booking create audit logs."""
        with self.app.app_context():
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customer.id,
                resource_id=self.resource.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"service_id": str(self.service.id)},
                start_at=datetime.utcnow() + timedelta(days=1),
                end_at=datetime.utcnow() + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="confirmed"
            )
            
            db.session.add(booking)
            db.session.commit()
            
            # Update booking (should trigger audit log)
            booking.status = "cancelled"
            booking.canceled_at = datetime.utcnow()
            db.session.commit()
            
            # Verify audit log was created for the update
            audit_logs = AuditLog.query.filter(
                AuditLog.tenant_id == self.tenant.id,
                AuditLog.table_name == "bookings",
                AuditLog.record_id == str(booking.id),
                AuditLog.operation == "UPDATE"
            ).all()
            
            assert len(audit_logs) > 0
            audit_log = audit_logs[0]
            assert audit_log.operation == "UPDATE"
            assert audit_log.record_id == str(booking.id)
    
    def test_audit_logs_queryable_in_admin_ui(self):
        """Test that audit logs are queryable in admin UI."""
        with self.app.app_context():
            # Create multiple audit logs
            for i in range(5):
                self.audit_service.create_audit_log(
                    tenant_id=str(self.tenant.id),
                    table_name="bookings",
                    operation="INSERT",
                    record_id=str(uuid.uuid4()),
                    user_id=str(self.user.id),
                    old_data={},
                    new_data={"status": f"test_{i}"},
                    action="BOOKING_CREATED"
                )
            
            # Query audit logs
            audit_logs, total_count = self.audit_service.get_audit_logs(
                tenant_id=str(self.tenant.id),
                filters={'table_name': 'bookings'},
                page=1,
                per_page=10
            )
            
            assert len(audit_logs) == 5
            assert total_count == 5
            
            # Verify all logs are for bookings table
            for audit_log in audit_logs:
                assert audit_log['table_name'] == 'bookings'
                assert audit_log['tenant_id'] == str(self.tenant.id)
                assert audit_log['user_id'] == str(self.user.id)
    
    def test_audit_logs_with_type_booking_edit(self):
        """Test contract: Given admin edits booking, When logs queried, Then entry exists with type = BOOKING_EDIT."""
        with self.app.app_context():
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customer.id,
                resource_id=self.resource.id,
                client_generated_id=str(uuid.uuid4()),
                service_snapshot={"service_id": str(self.service.id)},
                start_at=datetime.utcnow() + timedelta(days=1),
                end_at=datetime.utcnow() + timedelta(days=1, hours=1),
                booking_tz="UTC",
                status="confirmed"
            )
            
            db.session.add(booking)
            db.session.commit()
            
            # Admin edits booking
            booking.status = "cancelled"
            booking.canceled_at = datetime.utcnow()
            db.session.commit()
            
            # Query audit logs
            audit_logs, _ = self.audit_service.get_audit_logs(
                tenant_id=str(self.tenant.id),
                filters={'table_name': 'bookings', 'record_id': str(booking.id)}
            )
            
            # Verify booking edit log exists
            booking_edit_logs = [log for log in audit_logs if log['operation'] == 'UPDATE']
            assert len(booking_edit_logs) > 0
            
            booking_edit_log = booking_edit_logs[0]
            assert booking_edit_log['table_name'] == 'bookings'
            assert booking_edit_log['record_id'] == str(booking.id)
            assert booking_edit_log['operation'] == 'UPDATE'
    
    def test_audit_middleware_automatic_logging(self):
        """Test that audit middleware automatically logs critical actions."""
        with self.app.app_context():
            middleware = AuditMiddleware()
            
            # Test booking creation action
            action = AuditAction.BOOKING_CREATED
            entity_info = {
                'entity_id': str(uuid.uuid4()),
                'request_data': {'status': 'confirmed'},
                'path_params': {'booking_id': str(uuid.uuid4())}
            }
            
            audit_context = {
                'request_id': str(uuid.uuid4()),
                'tenant_id': str(self.tenant.id),
                'user_id': str(self.user.id)
            }
            
            # Create audit log via middleware
            middleware._create_audit_log(
                tenant_id=str(self.tenant.id),
                user_id=str(self.user.id),
                action=action,
                entity_info=entity_info,
                audit_context=audit_context
            )
            
            # Verify audit log was created
            audit_logs = AuditLog.query.filter(
                AuditLog.tenant_id == self.tenant.id,
                AuditLog.table_name == "bookings"
            ).all()
            
            assert len(audit_logs) > 0
            audit_log = audit_logs[0]
            assert audit_log.operation == "INSERT"
            assert audit_log.table_name == "bookings"
    
    def test_audit_service_observability_hooks(self):
        """Test that audit service emits observability hooks."""
        with self.app.app_context():
            with patch('app.services.audit_service.logger') as mock_logger:
                # Create audit log
                self.audit_service.create_audit_log(
                    tenant_id=str(self.tenant.id),
                    table_name="payments",
                    operation="UPDATE",
                    record_id=str(uuid.uuid4()),
                    user_id=str(self.user.id),
                    old_data={"status": "pending"},
                    new_data={"status": "captured"},
                    action="PAYMENT_CAPTURED"
                )
                
                # Verify observability hook was emitted
                mock_logger.info.assert_any_call(
                    "AUDIT_LOG_WRITTEN",
                    audit_log_id=pytest.any(str),
                    tenant_id=str(self.tenant.id),
                    table_name="payments",
                    operation="UPDATE",
                    record_id=pytest.any(str),
                    user_id=str(self.user.id),
                    action="PAYMENT_CAPTURED",
                    metadata={},
                    timestamp=pytest.any(str)
                )
    
    def test_audit_service_error_handling(self):
        """Test audit service error handling with TITHI_AUDIT_WRITE_FAILED."""
        with self.app.app_context():
            # Test with missing required parameters
            with pytest.raises(Exception) as exc_info:
                self.audit_service.create_audit_log(
                    tenant_id=None,  # Missing required parameter
                    table_name="bookings",
                    operation="INSERT",
                    record_id=str(uuid.uuid4()),
                    user_id=str(self.user.id)
                )
            
            assert "TITHI_AUDIT_WRITE_FAILED" in str(exc_info.value)
    
    def test_audit_log_idempotency(self):
        """Test that audit logging is idempotent by action + entity_id + timestamp."""
        with self.app.app_context():
            entity_id = str(uuid.uuid4())
            timestamp = datetime.utcnow()
            
            # Create first audit log
            audit_log_id_1 = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="bookings",
                operation="INSERT",
                record_id=entity_id,
                user_id=str(self.user.id),
                old_data={},
                new_data={"status": "confirmed"},
                action="BOOKING_CREATED"
            )
            
            # Create second audit log with same parameters
            audit_log_id_2 = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="bookings",
                operation="INSERT",
                record_id=entity_id,
                user_id=str(self.user.id),
                old_data={},
                new_data={"status": "confirmed"},
                action="BOOKING_CREATED"
            )
            
            # Both should be created (different timestamps make them unique)
            assert audit_log_id_1 != audit_log_id_2
            
            audit_log_1 = AuditLog.query.get(audit_log_id_1)
            audit_log_2 = AuditLog.query.get(audit_log_id_2)
            
            assert audit_log_1 is not None
            assert audit_log_2 is not None
            assert audit_log_1.record_id == audit_log_2.record_id
            assert audit_log_1.operation == audit_log_2.operation
            assert audit_log_1.table_name == audit_log_2.table_name
    
    def test_audit_log_data_sanitization(self):
        """Test that audit logs sanitize sensitive data."""
        with self.app.app_context():
            sensitive_data = {
                "password": "secret123",
                "token": "abc123",
                "credit_card": "4111-1111-1111-1111",
                "normal_field": "normal_value"
            }
            
            audit_log_id = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="users",
                operation="UPDATE",
                record_id=str(self.user.id),
                user_id=str(self.user.id),
                old_data={},
                new_data=sensitive_data,
                action="USER_UPDATED"
            )
            
            audit_log = AuditLog.query.get(audit_log_id)
            
            # Verify sensitive data was sanitized
            assert audit_log.new_data["password"] == "[REDACTED]"
            assert audit_log.new_data["token"] == "[REDACTED]"
            assert audit_log.new_data["credit_card"] == "[REDACTED]"
            assert audit_log.new_data["normal_field"] == "normal_value"
    
    def test_audit_log_retention_policy(self):
        """Test audit log retention policy and cleanup."""
        with self.app.app_context():
            # Create old audit log (simulate by setting created_at)
            old_audit_log = AuditLog(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                table_name="bookings",
                operation="INSERT",
                record_id=str(uuid.uuid4()),
                user_id=self.user.id,
                old_data={},
                new_data={"status": "old"},
                created_at=datetime.utcnow() - timedelta(days=400)  # Older than retention period
            )
            
            db.session.add(old_audit_log)
            db.session.commit()
            
            # Create recent audit log
            recent_audit_log = AuditLog(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                table_name="bookings",
                operation="INSERT",
                record_id=str(uuid.uuid4()),
                user_id=self.user.id,
                old_data={},
                new_data={"status": "recent"},
                created_at=datetime.utcnow() - timedelta(days=30)  # Within retention period
            )
            
            db.session.add(recent_audit_log)
            db.session.commit()
            
            # Purge old audit logs
            purged_count = self.audit_service.purge_old_audit_logs(tenant_id=str(self.tenant.id))
            
            # Verify old audit log was purged
            assert purged_count == 1
            
            # Verify recent audit log still exists
            recent_log = AuditLog.query.get(recent_audit_log.id)
            assert recent_log is not None
            
            # Verify old audit log was purged
            old_log = AuditLog.query.get(old_audit_log.id)
            assert old_log is None
    
    def test_audit_log_validation(self):
        """Test audit log integrity validation."""
        with self.app.app_context():
            # Create valid audit log
            self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="bookings",
                operation="INSERT",
                record_id=str(uuid.uuid4()),
                user_id=str(self.user.id),
                old_data={},
                new_data={"status": "confirmed"},
                action="BOOKING_CREATED"
            )
            
            # Validate audit log integrity
            validation_results = self.audit_service.validate_audit_log_integrity(
                tenant_id=str(self.tenant.id)
            )
            
            # Verify validation passed
            assert validation_results['overall_status'] == 'PASS'
            assert validation_results['tenant_id'] == str(self.tenant.id)
            assert 'validation_timestamp' in validation_results
            assert 'checks' in validation_results
    
    def test_audit_log_statistics(self):
        """Test audit log statistics generation."""
        with self.app.app_context():
            # Create multiple audit logs
            for i in range(3):
                self.audit_service.create_audit_log(
                    tenant_id=str(self.tenant.id),
                    table_name="bookings",
                    operation="INSERT",
                    record_id=str(uuid.uuid4()),
                    user_id=str(self.user.id),
                    old_data={},
                    new_data={"status": f"test_{i}"},
                    action="BOOKING_CREATED"
                )
            
            # Create payment audit log
            self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="payments",
                operation="UPDATE",
                record_id=str(uuid.uuid4()),
                user_id=str(self.user.id),
                old_data={"status": "pending"},
                new_data={"status": "captured"},
                action="PAYMENT_CAPTURED"
            )
            
            # Get statistics
            stats = self.audit_service.get_audit_statistics(tenant_id=str(self.tenant.id))
            
            # Verify statistics
            assert stats['total_logs'] == 4
            assert stats['operation_breakdown']['INSERT'] == 3
            assert stats['operation_breakdown']['UPDATE'] == 1
            assert stats['table_breakdown']['bookings'] == 3
            assert stats['table_breakdown']['payments'] == 1
            assert str(self.user.id) in stats['user_breakdown']
    
    def test_audit_log_outbox_integration(self):
        """Test that audit logs are added to outbox for external systems."""
        with self.app.app_context():
            # Create audit log
            audit_log_id = self.audit_service.create_audit_log(
                tenant_id=str(self.tenant.id),
                table_name="bookings",
                operation="INSERT",
                record_id=str(uuid.uuid4()),
                user_id=str(self.user.id),
                old_data={},
                new_data={"status": "confirmed"},
                action="BOOKING_CREATED"
            )
            
            # Verify outbox event was created
            outbox_events = EventOutbox.query.filter(
                EventOutbox.tenant_id == self.tenant.id,
                EventOutbox.event_code == "AUDIT_LOG_CREATED"
            ).all()
            
            assert len(outbox_events) > 0
            
            outbox_event = outbox_events[0]
            assert outbox_event.event_code == "AUDIT_LOG_CREATED"
            assert outbox_event.status == "ready"
            assert "audit_log_id" in outbox_event.payload
            assert outbox_event.payload["audit_log_id"] == audit_log_id
