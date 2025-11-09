"""
Audit Middleware
Automatically logs critical actions for compliance and traceability
"""

import uuid
import json
import structlog
from datetime import datetime
from typing import Dict, Any, Optional, List
from flask import request, g, current_app
from werkzeug.exceptions import HTTPException

from app.middleware.error_handler import TithiError

logger = structlog.get_logger(__name__)


class AuditAction:
    """Audit action types for different operations."""
    
    # Booking actions
    BOOKING_CREATED = "BOOKING_CREATED"
    BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    BOOKING_RESCHEDULED = "BOOKING_RESCHEDULED"
    BOOKING_NO_SHOW = "BOOKING_NO_SHOW"
    BOOKING_COMPLETED = "BOOKING_COMPLETED"
    
    # Payment actions
    PAYMENT_CREATED = "PAYMENT_CREATED"
    PAYMENT_CAPTURED = "PAYMENT_CAPTURED"
    PAYMENT_REFUNDED = "PAYMENT_REFUNDED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    
    # Staff actions
    STAFF_CREATED = "STAFF_CREATED"
    STAFF_UPDATED = "STAFF_UPDATED"
    STAFF_DELETED = "STAFF_DELETED"
    STAFF_SCHEDULE_UPDATED = "STAFF_SCHEDULE_UPDATED"
    
    # Service actions
    SERVICE_CREATED = "SERVICE_CREATED"
    SERVICE_UPDATED = "SERVICE_UPDATED"
    SERVICE_DELETED = "SERVICE_DELETED"
    
    # Customer actions
    CUSTOMER_CREATED = "CUSTOMER_CREATED"
    CUSTOMER_UPDATED = "CUSTOMER_UPDATED"
    CUSTOMER_MERGED = "CUSTOMER_MERGED"
    
    # Admin actions
    ADMIN_LOGIN = "ADMIN_LOGIN"
    ADMIN_LOGOUT = "ADMIN_LOGOUT"
    ADMIN_ACTION_PERFORMED = "ADMIN_ACTION_PERFORMED"
    
    # System actions
    SYSTEM_CONFIGURATION_CHANGED = "SYSTEM_CONFIGURATION_CHANGED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    SECURITY_EVENT = "SECURITY_EVENT"


class AuditMiddleware:
    """Middleware for automatic audit logging of critical actions."""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the audit middleware with Flask app."""
        app.before_request(self.before_request)
        app.after_request(self.after_request)
        
        # Register audit logging decorator
        app.audit_log = self.audit_log_action
    
    def before_request(self):
        """Set up audit context for the request."""
        # Store request start time for audit context
        g.audit_start_time = datetime.utcnow()
        g.audit_context = {
            'request_id': str(uuid.uuid4()),
            'method': request.method,
            'path': request.path,
            'remote_addr': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'tenant_id': getattr(g, 'tenant_id', None),
            'user_id': getattr(g, 'user_id', None)
        }
    
    def after_request(self, response):
        """Log audit events after request processing."""
        try:
            # Only log for successful operations (2xx status codes)
            if 200 <= response.status_code < 300:
                self._log_request_audit(response)
        except Exception as e:
            logger.error("Failed to log audit after request", error=str(e))
        
        return response
    
    def _log_request_audit(self, response):
        """Log audit information for the request."""
        try:
            audit_context = getattr(g, 'audit_context', {})
            tenant_id = audit_context.get('tenant_id')
            user_id = audit_context.get('user_id')
            
            if not tenant_id or not user_id:
                return  # Skip audit logging for unauthenticated requests
            
            # Determine audit action based on request path and method
            action = self._determine_audit_action()
            if not action:
                return  # No audit action needed for this request
            
            # Extract entity information from request
            entity_info = self._extract_entity_info()
            
            # Log the audit event
            self._create_audit_log(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                entity_info=entity_info,
                audit_context=audit_context
            )
            
        except Exception as e:
            logger.error("Failed to log request audit", error=str(e))
    
    def _determine_audit_action(self) -> Optional[str]:
        """Determine audit action based on request path and method."""
        path = request.path
        method = request.method
        
        # Booking actions
        if '/bookings' in path:
            if method == 'POST':
                return AuditAction.BOOKING_CREATED
            elif method == 'PUT' and '/confirm' in path:
                return AuditAction.BOOKING_CONFIRMED
            elif method == 'PUT' and '/cancel' in path:
                return AuditAction.BOOKING_CANCELLED
            elif method == 'PUT' and '/reschedule' in path:
                return AuditAction.BOOKING_RESCHEDULED
            elif method == 'PUT' and '/no-show' in path:
                return AuditAction.BOOKING_NO_SHOW
            elif method == 'PUT' and '/complete' in path:
                return AuditAction.BOOKING_COMPLETED
        
        # Payment actions
        elif '/payments' in path:
            if method == 'POST':
                return AuditAction.PAYMENT_CREATED
            elif method == 'PUT' and '/capture' in path:
                return AuditAction.PAYMENT_CAPTURED
            elif method == 'PUT' and '/refund' in path:
                return AuditAction.PAYMENT_REFUNDED
        
        # Staff actions
        elif '/staff' in path:
            if method == 'POST':
                return AuditAction.STAFF_CREATED
            elif method == 'PUT':
                return AuditAction.STAFF_UPDATED
            elif method == 'DELETE':
                return AuditAction.STAFF_DELETED
            elif '/schedule' in path and method == 'PUT':
                return AuditAction.STAFF_SCHEDULE_UPDATED
        
        # Service actions
        elif '/services' in path:
            if method == 'POST':
                return AuditAction.SERVICE_CREATED
            elif method == 'PUT':
                return AuditAction.SERVICE_UPDATED
            elif method == 'DELETE':
                return AuditAction.SERVICE_DELETED
        
        # Customer actions
        elif '/customers' in path:
            if method == 'POST':
                return AuditAction.CUSTOMER_CREATED
            elif method == 'PUT':
                return AuditAction.CUSTOMER_UPDATED
            elif '/merge' in path:
                return AuditAction.CUSTOMER_MERGED
        
        # Admin actions
        elif '/admin' in path:
            return AuditAction.ADMIN_ACTION_PERFORMED
        
        return None
    
    def _extract_entity_info(self) -> Dict[str, Any]:
        """Extract entity information from request."""
        entity_info = {
            'request_data': request.get_json() if request.is_json else None,
            'query_params': dict(request.args),
            'path_params': request.view_args or {}
        }
        
        # Extract entity ID from path if available
        if request.view_args:
            entity_info['entity_id'] = list(request.view_args.values())[0]
        
        return entity_info
    
    def _create_audit_log(self, tenant_id: str, user_id: str, action: str, 
                         entity_info: Dict[str, Any], audit_context: Dict[str, Any]):
        """Create an audit log entry."""
        try:
            # Import here to avoid circular imports
            from app.extensions import db
            from app.models.audit import AuditLog
            
            audit_log = AuditLog(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                table_name=self._get_table_name_from_action(action),
                operation=self._get_operation_from_action(action),
                record_id=entity_info.get('entity_id'),
                old_data={},  # Will be populated by database triggers
                new_data=entity_info.get('request_data', {}),
                user_id=user_id
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
            # Emit observability hook
            self._emit_audit_hook(action, audit_log, audit_context)
            
        except Exception as e:
            logger.error("Failed to create audit log", error=str(e))
            raise TithiError("TITHI_AUDIT_WRITE_FAILED", "Failed to write audit log")
    
    def _get_table_name_from_action(self, action: str) -> str:
        """Map audit action to table name."""
        action_to_table = {
            AuditAction.BOOKING_CREATED: "bookings",
            AuditAction.BOOKING_CONFIRMED: "bookings",
            AuditAction.BOOKING_CANCELLED: "bookings",
            AuditAction.BOOKING_RESCHEDULED: "bookings",
            AuditAction.BOOKING_NO_SHOW: "bookings",
            AuditAction.BOOKING_COMPLETED: "bookings",
            AuditAction.PAYMENT_CREATED: "payments",
            AuditAction.PAYMENT_CAPTURED: "payments",
            AuditAction.PAYMENT_REFUNDED: "payments",
            AuditAction.STAFF_CREATED: "staff_profiles",
            AuditAction.STAFF_UPDATED: "staff_profiles",
            AuditAction.STAFF_DELETED: "staff_profiles",
            AuditAction.STAFF_SCHEDULE_UPDATED: "work_schedules",
            AuditAction.SERVICE_CREATED: "services",
            AuditAction.SERVICE_UPDATED: "services",
            AuditAction.SERVICE_DELETED: "services",
            AuditAction.CUSTOMER_CREATED: "customers",
            AuditAction.CUSTOMER_UPDATED: "customers",
            AuditAction.CUSTOMER_MERGED: "customers",
            AuditAction.ADMIN_ACTION_PERFORMED: "admin_actions"
        }
        return action_to_table.get(action, "unknown")
    
    def _get_operation_from_action(self, action: str) -> str:
        """Map audit action to database operation."""
        if 'CREATED' in action:
            return 'INSERT'
        elif 'UPDATED' in action or 'CONFIRMED' in action or 'CANCELLED' in action or 'RESCHEDULED' in action or 'NO_SHOW' in action or 'COMPLETED' in action or 'CAPTURED' in action or 'REFUNDED' in action:
            return 'UPDATE'
        elif 'DELETED' in action:
            return 'DELETE'
        else:
            return 'UPDATE'  # Default to UPDATE for other actions
    
    def _emit_audit_hook(self, action: str, audit_log, audit_context: Dict[str, Any]):
        """Emit observability hook for audit log creation."""
        try:
            logger.info(
                "AUDIT_LOG_WRITTEN",
                audit_log_id=str(audit_log.id),
                action=action,
                tenant_id=audit_log.tenant_id,
                user_id=audit_log.user_id,
                table_name=audit_log.table_name,
                operation=audit_log.operation,
                record_id=str(audit_log.record_id) if audit_log.record_id else None,
                request_id=audit_context.get('request_id'),
                timestamp=audit_log.created_at.isoformat() if audit_log.created_at else None
            )
        except Exception as e:
            logger.error("Failed to emit audit hook", error=str(e))
    
    def audit_log_action(self, action: str, entity_id: str = None, 
                        old_data: Dict[str, Any] = None, 
                        new_data: Dict[str, Any] = None):
        """Decorator for manual audit logging of specific actions."""
        def decorator(func):
            def wrapper(*args, **kwargs):
                try:
                    # Execute the original function
                    result = func(*args, **kwargs)
                    
                    # Log audit action
                    tenant_id = getattr(g, 'tenant_id', None)
                    user_id = getattr(g, 'user_id', None)
                    
                    if tenant_id and user_id:
                        self._create_manual_audit_log(
                            tenant_id=tenant_id,
                            user_id=user_id,
                            action=action,
                            entity_id=entity_id,
                            old_data=old_data,
                            new_data=new_data
                        )
                    
                    return result
                    
                except Exception as e:
                    logger.error("Failed to execute audited function", error=str(e))
                    raise
            
            return wrapper
        return decorator
    
    def _create_manual_audit_log(self, tenant_id: str, user_id: str, action: str,
                               entity_id: str = None, old_data: Dict[str, Any] = None,
                               new_data: Dict[str, Any] = None):
        """Create a manual audit log entry."""
        try:
            # Import here to avoid circular imports
            from app.extensions import db
            from app.models.audit import AuditLog
            
            audit_log = AuditLog(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                table_name=self._get_table_name_from_action(action),
                operation=self._get_operation_from_action(action),
                record_id=entity_id,
                old_data=old_data or {},
                new_data=new_data or {},
                user_id=user_id
            )
            
            db.session.add(audit_log)
            db.session.commit()
            
            # Emit observability hook
            audit_context = {
                'request_id': str(uuid.uuid4()),
                'method': 'MANUAL',
                'path': 'manual_audit',
                'tenant_id': tenant_id,
                'user_id': user_id
            }
            self._emit_audit_hook(action, audit_log, audit_context)
            
        except Exception as e:
            logger.error("Failed to create manual audit log", error=str(e))
            raise TithiError("TITHI_AUDIT_WRITE_FAILED", "Failed to write manual audit log")


def audit_log_action(action: str, entity_id: str = None, 
                    old_data: Dict[str, Any] = None, 
                    new_data: Dict[str, Any] = None):
    """Standalone decorator for audit logging."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            try:
                # Execute the original function
                result = func(*args, **kwargs)
                
                # Log audit action
                tenant_id = getattr(g, 'tenant_id', None)
                user_id = getattr(g, 'user_id', None)
                
                if tenant_id and user_id:
                    audit_log = AuditLog(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        table_name=AuditMiddleware()._get_table_name_from_action(action),
                        operation=AuditMiddleware()._get_operation_from_action(action),
                        record_id=entity_id,
                        old_data=old_data or {},
                        new_data=new_data or {},
                        user_id=user_id
                    )
                    
                    db.session.add(audit_log)
                    db.session.commit()
                    
                    # Emit observability hook
                    logger.info(
                        "AUDIT_LOG_WRITTEN",
                        audit_log_id=str(audit_log.id),
                        action=action,
                        tenant_id=audit_log.tenant_id,
                        user_id=audit_log.user_id,
                        table_name=audit_log.table_name,
                        operation=audit_log.operation,
                        record_id=str(audit_log.record_id) if audit_log.record_id else None
                    )
                
                return result
                
            except Exception as e:
                logger.error("Failed to execute audited function", error=str(e))
                raise
        
        return wrapper
    return decorator
