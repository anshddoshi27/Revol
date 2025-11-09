"""
Audit Service
Comprehensive service for immutable audit logging and compliance
"""

import uuid
import json
import structlog
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy import and_, or_, func, text, desc
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models.audit import AuditLog, EventOutbox
from app.middleware.error_handler import TithiError

logger = structlog.get_logger(__name__)


class AuditService:
    """Service for comprehensive audit logging and compliance."""
    
    def __init__(self):
        self.retention_period_days = 365  # 12 months retention
        self.immutable_fields = ['id', 'tenant_id', 'created_at', 'user_id']
    
    def create_audit_log(self, tenant_id: str, table_name: str, operation: str,
                        record_id: str, user_id: str, old_data: Dict[str, Any] = None,
                        new_data: Dict[str, Any] = None, action: str = None,
                        metadata: Dict[str, Any] = None) -> str:
        """
        Create an immutable audit log entry.
        
        Args:
            tenant_id: Tenant identifier
            table_name: Name of the table being audited
            operation: Database operation (INSERT, UPDATE, DELETE)
            record_id: ID of the record being audited
            user_id: ID of the user performing the action
            old_data: Previous state of the record
            new_data: New state of the record
            action: Business action being performed
            metadata: Additional metadata for the audit log
            
        Returns:
            Audit log ID
            
        Raises:
            TithiError: If audit log creation fails
        """
        try:
            # Validate required parameters
            if not all([tenant_id, table_name, operation, user_id]):
                raise TithiError("TITHI_AUDIT_WRITE_FAILED", "Missing required audit parameters")
            
            # Create audit log entry
            audit_log = AuditLog(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                table_name=table_name,
                operation=operation,
                record_id=record_id,
                old_data=self._sanitize_audit_data(old_data),
                new_data=self._sanitize_audit_data(new_data),
                user_id=user_id
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
            # Emit observability hook
            self._emit_audit_hook(audit_log, action, metadata)
            
            # Add to outbox for external systems
            self._add_to_outbox(audit_log, action, metadata)
            
            logger.info(
                "Audit log created successfully",
                audit_log_id=str(audit_log.id),
                tenant_id=tenant_id,
                table_name=table_name,
                operation=operation,
                record_id=record_id,
                user_id=user_id
            )
            
            return str(audit_log.id)
            
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error("Database error creating audit log", error=str(e))
            raise TithiError("TITHI_AUDIT_WRITE_FAILED", "Database error creating audit log")
        except Exception as e:
            logger.error("Unexpected error creating audit log", error=str(e))
            raise TithiError("TITHI_AUDIT_WRITE_FAILED", "Unexpected error creating audit log")
    
    def get_audit_logs(self, tenant_id: str, filters: Dict[str, Any] = None,
                      page: int = 1, per_page: int = 50) -> Tuple[List[Dict[str, Any]], int]:
        """
        Retrieve audit logs with filtering and pagination.
        
        Args:
            tenant_id: Tenant identifier
            filters: Filter criteria
            page: Page number (1-based)
            per_page: Number of records per page
            
        Returns:
            Tuple of (audit_logs, total_count)
        """
        try:
            query = AuditLog.query.filter_by(tenant_id=tenant_id)
            
            # Apply filters
            if filters:
                if 'table_name' in filters:
                    query = query.filter(AuditLog.table_name == filters['table_name'])
                if 'operation' in filters:
                    query = query.filter(AuditLog.operation == filters['operation'])
                if 'user_id' in filters:
                    query = query.filter(AuditLog.user_id == filters['user_id'])
                if 'record_id' in filters:
                    query = query.filter(AuditLog.record_id == filters['record_id'])
                if 'from_date' in filters:
                    query = query.filter(AuditLog.created_at >= filters['from_date'])
                if 'to_date' in filters:
                    query = query.filter(AuditLog.created_at <= filters['to_date'])
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination and ordering
            audit_logs = query.order_by(desc(AuditLog.created_at)) \
                            .offset((page - 1) * per_page) \
                            .limit(per_page) \
                            .all()
            
            # Convert to dictionaries
            audit_log_dicts = []
            for audit_log in audit_logs:
                audit_log_dicts.append({
                    'id': str(audit_log.id),
                    'tenant_id': str(audit_log.tenant_id),
                    'table_name': audit_log.table_name,
                    'operation': audit_log.operation,
                    'record_id': str(audit_log.record_id) if audit_log.record_id else None,
                    'old_data': audit_log.old_data or {},
                    'new_data': audit_log.new_data or {},
                    'user_id': str(audit_log.user_id) if audit_log.user_id else None,
                    'created_at': audit_log.created_at.isoformat() if audit_log.created_at else None
                })
            
            return audit_log_dicts, total_count
            
        except SQLAlchemyError as e:
            logger.error("Database error retrieving audit logs", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Database error retrieving audit logs")
        except Exception as e:
            logger.error("Unexpected error retrieving audit logs", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Unexpected error retrieving audit logs")
    
    def get_audit_trail(self, tenant_id: str, table_name: str, record_id: str) -> List[Dict[str, Any]]:
        """
        Get complete audit trail for a specific record.
        
        Args:
            tenant_id: Tenant identifier
            table_name: Name of the table
            record_id: ID of the record
            
        Returns:
            List of audit log entries for the record
        """
        try:
            audit_logs = AuditLog.query.filter(
                and_(
                    AuditLog.tenant_id == tenant_id,
                    AuditLog.table_name == table_name,
                    AuditLog.record_id == record_id
                )
            ).order_by(AuditLog.created_at).all()
            
            audit_trail = []
            for audit_log in audit_logs:
                audit_trail.append({
                    'id': str(audit_log.id),
                    'operation': audit_log.operation,
                    'old_data': audit_log.old_data or {},
                    'new_data': audit_log.new_data or {},
                    'user_id': str(audit_log.user_id) if audit_log.user_id else None,
                    'created_at': audit_log.created_at.isoformat() if audit_log.created_at else None
                })
            
            return audit_trail
            
        except SQLAlchemyError as e:
            logger.error("Database error retrieving audit trail", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Database error retrieving audit trail")
        except Exception as e:
            logger.error("Unexpected error retrieving audit trail", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Unexpected error retrieving audit trail")
    
    def get_user_activity(self, tenant_id: str, user_id: str, 
                         from_date: datetime = None, to_date: datetime = None) -> List[Dict[str, Any]]:
        """
        Get audit logs for a specific user's activity.
        
        Args:
            tenant_id: Tenant identifier
            user_id: User identifier
            from_date: Start date for activity
            to_date: End date for activity
            
        Returns:
            List of audit log entries for the user
        """
        try:
            query = AuditLog.query.filter(
                and_(
                    AuditLog.tenant_id == tenant_id,
                    AuditLog.user_id == user_id
                )
            )
            
            if from_date:
                query = query.filter(AuditLog.created_at >= from_date)
            if to_date:
                query = query.filter(AuditLog.created_at <= to_date)
            
            audit_logs = query.order_by(desc(AuditLog.created_at)).all()
            
            user_activity = []
            for audit_log in audit_logs:
                user_activity.append({
                    'id': str(audit_log.id),
                    'table_name': audit_log.table_name,
                    'operation': audit_log.operation,
                    'record_id': str(audit_log.record_id) if audit_log.record_id else None,
                    'created_at': audit_log.created_at.isoformat() if audit_log.created_at else None
                })
            
            return user_activity
            
        except SQLAlchemyError as e:
            logger.error("Database error retrieving user activity", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Database error retrieving user activity")
        except Exception as e:
            logger.error("Unexpected error retrieving user activity", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Unexpected error retrieving user activity")
    
    def get_audit_statistics(self, tenant_id: str, from_date: datetime = None, 
                           to_date: datetime = None) -> Dict[str, Any]:
        """
        Get audit statistics for a tenant.
        
        Args:
            tenant_id: Tenant identifier
            from_date: Start date for statistics
            to_date: End date for statistics
            
        Returns:
            Dictionary containing audit statistics
        """
        try:
            query = AuditLog.query.filter_by(tenant_id=tenant_id)
            
            if from_date:
                query = query.filter(AuditLog.created_at >= from_date)
            if to_date:
                query = query.filter(AuditLog.created_at <= to_date)
            
            # Get basic statistics
            total_logs = query.count()
            
            # Get operation breakdown
            operation_stats = db.session.query(
                AuditLog.operation,
                func.count(AuditLog.id).label('count')
            ).filter_by(tenant_id=tenant_id).group_by(AuditLog.operation).all()
            
            # Get table breakdown
            table_stats = db.session.query(
                AuditLog.table_name,
                func.count(AuditLog.id).label('count')
            ).filter_by(tenant_id=tenant_id).group_by(AuditLog.table_name).all()
            
            # Get user breakdown
            user_stats = db.session.query(
                AuditLog.user_id,
                func.count(AuditLog.id).label('count')
            ).filter_by(tenant_id=tenant_id).group_by(AuditLog.user_id).all()
            
            statistics = {
                'total_logs': total_logs,
                'operation_breakdown': {op: count for op, count in operation_stats},
                'table_breakdown': {table: count for table, count in table_stats},
                'user_breakdown': {str(user_id): count for user_id, count in user_stats},
                'period': {
                    'from_date': from_date.isoformat() if from_date else None,
                    'to_date': to_date.isoformat() if to_date else None
                }
            }
            
            return statistics
            
        except SQLAlchemyError as e:
            logger.error("Database error retrieving audit statistics", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Database error retrieving audit statistics")
        except Exception as e:
            logger.error("Unexpected error retrieving audit statistics", error=str(e))
            raise TithiError("TITHI_AUDIT_READ_FAILED", "Unexpected error retrieving audit statistics")
    
    def purge_old_audit_logs(self, tenant_id: str = None) -> int:
        """
        Purge audit logs older than retention period.
        
        Args:
            tenant_id: Tenant identifier (None for all tenants)
            
        Returns:
            Number of audit logs purged
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.retention_period_days)
            
            query = AuditLog.query.filter(AuditLog.created_at < cutoff_date)
            if tenant_id:
                query = query.filter_by(tenant_id=tenant_id)
            
            # Count records to be deleted
            count = query.count()
            
            # Delete records
            query.delete(synchronize_session=False)
            db.session.commit()
            
            logger.info(
                "Purged old audit logs",
                tenant_id=tenant_id,
                cutoff_date=cutoff_date.isoformat(),
                purged_count=count
            )
            
            return count
            
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error("Database error purging audit logs", error=str(e))
            raise TithiError("TITHI_AUDIT_PURGE_FAILED", "Database error purging audit logs")
        except Exception as e:
            logger.error("Unexpected error purging audit logs", error=str(e))
            raise TithiError("TITHI_AUDIT_PURGE_FAILED", "Unexpected error purging audit logs")
    
    def validate_audit_log_integrity(self, tenant_id: str) -> Dict[str, Any]:
        """
        Validate audit log integrity for a tenant.
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            Dictionary containing validation results
        """
        try:
            validation_results = {
                'tenant_id': tenant_id,
                'validation_timestamp': datetime.utcnow().isoformat(),
                'checks': {},
                'overall_status': 'PASS'
            }
            
            # Check for missing tenant_id
            missing_tenant_count = AuditLog.query.filter(
                AuditLog.tenant_id.is_(None)
            ).count()
            validation_results['checks']['missing_tenant_id'] = {
                'status': 'PASS' if missing_tenant_count == 0 else 'FAIL',
                'count': missing_tenant_count
            }
            
            # Check for missing user_id
            missing_user_count = AuditLog.query.filter(
                AuditLog.user_id.is_(None)
            ).count()
            validation_results['checks']['missing_user_id'] = {
                'status': 'PASS' if missing_user_count == 0 else 'FAIL',
                'count': missing_user_count
            }
            
            # Check for invalid operations
            invalid_operations = db.session.query(AuditLog.operation).filter(
                and_(
                    AuditLog.tenant_id == tenant_id,
                    ~AuditLog.operation.in_(['INSERT', 'UPDATE', 'DELETE'])
                )
            ).distinct().all()
            validation_results['checks']['invalid_operations'] = {
                'status': 'PASS' if len(invalid_operations) == 0 else 'FAIL',
                'operations': [op[0] for op in invalid_operations]
            }
            
            # Check for future timestamps
            future_timestamp_count = AuditLog.query.filter(
                and_(
                    AuditLog.tenant_id == tenant_id,
                    AuditLog.created_at > datetime.utcnow()
                )
            ).count()
            validation_results['checks']['future_timestamps'] = {
                'status': 'PASS' if future_timestamp_count == 0 else 'FAIL',
                'count': future_timestamp_count
            }
            
            # Determine overall status
            failed_checks = [check for check in validation_results['checks'].values() 
                           if check['status'] == 'FAIL']
            if failed_checks:
                validation_results['overall_status'] = 'FAIL'
            
            return validation_results
            
        except SQLAlchemyError as e:
            logger.error("Database error validating audit log integrity", error=str(e))
            raise TithiError("TITHI_AUDIT_VALIDATION_FAILED", "Database error validating audit log integrity")
        except Exception as e:
            logger.error("Unexpected error validating audit log integrity", error=str(e))
            raise TithiError("TITHI_AUDIT_VALIDATION_FAILED", "Unexpected error validating audit log integrity")
    
    def _sanitize_audit_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize audit data to remove sensitive information."""
        if not data:
            return {}
        
        sanitized = {}
        for key, value in data.items():
            # Skip sensitive fields
            if key.lower() in ['password', 'token', 'secret', 'key', 'ssn', 'credit_card']:
                sanitized[key] = '[REDACTED]'
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_audit_data(value)
            elif isinstance(value, list):
                sanitized[key] = [self._sanitize_audit_data(item) if isinstance(item, dict) else item 
                                for item in value]
            else:
                sanitized[key] = value
        
        return sanitized
    
    def _emit_audit_hook(self, audit_log: AuditLog, action: str = None, metadata: Dict[str, Any] = None):
        """Emit observability hook for audit log creation."""
        try:
            logger.info(
                "AUDIT_LOG_WRITTEN",
                audit_log_id=str(audit_log.id),
                tenant_id=str(audit_log.tenant_id),
                table_name=audit_log.table_name,
                operation=audit_log.operation,
                record_id=str(audit_log.record_id) if audit_log.record_id else None,
                user_id=str(audit_log.user_id) if audit_log.user_id else None,
                action=action,
                metadata=metadata or {},
                timestamp=audit_log.created_at.isoformat() if audit_log.created_at else None
            )
        except Exception as e:
            logger.error("Failed to emit audit hook", error=str(e))
    
    def _add_to_outbox(self, audit_log: AuditLog, action: str = None, metadata: Dict[str, Any] = None):
        """Add audit log to outbox for external systems."""
        try:
            outbox_event = EventOutbox(
                id=uuid.uuid4(),
                tenant_id=audit_log.tenant_id,
                event_code="AUDIT_LOG_CREATED",
                payload={
                    'audit_log_id': str(audit_log.id),
                    'table_name': audit_log.table_name,
                    'operation': audit_log.operation,
                    'record_id': str(audit_log.record_id) if audit_log.record_id else None,
                    'user_id': str(audit_log.user_id) if audit_log.user_id else None,
                    'action': action,
                    'metadata': metadata or {}
                },
                status='ready',
                ready_at=datetime.utcnow()
            )
            
            db.session.add(outbox_event)
            db.session.commit()
            
        except Exception as e:
            logger.error("Failed to add audit log to outbox", error=str(e))
            # Don't raise exception as this is not critical
