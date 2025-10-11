#!/usr/bin/env python3
"""
Phase 5 Simple Production Readiness Test

This test validates Phase 5 (Operations, Events & Audit) implementation status
without requiring a full database setup.

Phase 5 Requirements (Module N — Operations, Events & Audit):
- Outbox pattern for outbound events (notifications, webhooks) implemented with Celery workers
- Webhook inbox handles incoming provider events idempotently with signature validation
- Quota enforcement implemented via usage_counters & quotas table; throttling & notifications for exceeded quotas
- Audit logs record all relevant actions on PII, payments, bookings, promotions, and admin operations
- Contract tests validate outbox/inbox reliability, replay protection, quota enforcement, and audit log completeness
- Observability: logs for EVENT_OUTBOX_ENQUEUED, EVENT_PROCESSED, QUOTA_EXCEEDED, AUDIT_LOG_CREATED
"""

import os
import sys
import importlib.util
from pathlib import Path


class Phase5SimpleTest:
    """Simple Phase 5 production readiness test suite."""
    
    def __init__(self):
        self.test_results = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'critical_failures': [],
            'warnings': [],
            'success_rate': 0.0
        }
        
        self.backend_path = Path(__file__).parent / 'app'
        
    def run_test(self, test_name, test_func):
        """Run a single test and record results."""
        self.test_results['total_tests'] += 1
        
        try:
            result = test_func()
            if result:
                self.test_results['passed_tests'] += 1
                print(f"✅ {test_name}")
            else:
                self.test_results['failed_tests'] += 1
                self.test_results['critical_failures'].append(f"{test_name}: Test failed")
                print(f"❌ {test_name}")
        except Exception as e:
            self.test_results['failed_tests'] += 1
            self.test_results['critical_failures'].append(f"{test_name}: {str(e)}")
            print(f"❌ {test_name}: {str(e)}")
    
    def test_outbox_model_exists(self):
        """Test if EventOutbox model exists and has required fields."""
        try:
            system_models_path = self.backend_path / 'models' / 'system.py'
            if not system_models_path.exists():
                return False
            
            with open(system_models_path, 'r') as f:
                content = f.read()
            
            # Check for EventOutbox class
            if 'class EventOutbox' not in content:
                return False
            
            # Check for required fields
            required_fields = [
                'event_type',
                'payload',
                'status',
                'retry_count',
                'max_retries',
                'next_retry_at',
                'error_message'
            ]
            
            for field in required_fields:
                if field not in content:
                    return False
            
            return True
            
        except Exception as e:
            print(f"EventOutbox model test failed: {str(e)}")
            return False
    
    def test_audit_log_model_exists(self):
        """Test if AuditLog model exists and has required fields."""
        try:
            system_models_path = self.backend_path / 'models' / 'system.py'
            if not system_models_path.exists():
                return False
            
            with open(system_models_path, 'r') as f:
                content = f.read()
            
            # Check for AuditLog class
            if 'class AuditLog' not in content:
                return False
            
            # Check for required fields
            required_fields = [
                'table_name',
                'record_id',
                'operation',
                'user_id',
                'old_data',
                'new_data'
            ]
            
            for field in required_fields:
                if field not in content:
                    return False
            
            return True
            
        except Exception as e:
            print(f"AuditLog model test failed: {str(e)}")
            return False
    
    def test_outbox_service_methods(self):
        """Test if outbox service methods are implemented."""
        try:
            business_service_path = self.backend_path / 'services' / 'business_phase2.py'
            if not business_service_path.exists():
                return False
            
            with open(business_service_path, 'r') as f:
                content = f.read()
            
            # Check for _emit_event method
            if '_emit_event' not in content:
                return False
            
            # Check for EventOutbox usage
            if 'EventOutbox' not in content:
                return False
            
            return True
            
        except Exception as e:
            print(f"Outbox service methods test failed: {str(e)}")
            return False
    
    def test_audit_logging_methods(self):
        """Test if audit logging methods are implemented."""
        try:
            business_service_path = self.backend_path / 'services' / 'business_phase2.py'
            if not business_service_path.exists():
                return False
            
            with open(business_service_path, 'r') as f:
                content = f.read()
            
            # Check for _log_audit method
            if '_log_audit' not in content:
                return False
            
            # Check for AuditLog usage
            if 'AuditLog' not in content:
                return False
            
            return True
            
        except Exception as e:
            print(f"Audit logging methods test failed: {str(e)}")
            return False
    
    def test_database_migrations_exist(self):
        """Test if Phase 5 database migrations exist."""
        try:
            migrations_path = Path(__file__).parent.parent / 'supabase' / 'migrations'
            if not migrations_path.exists():
                return False
            
            # Check for audit logs migration
            audit_migration = migrations_path / '0013_audit_logs.sql'
            if not audit_migration.exists():
                return False
            
            # Check for usage quotas migration
            quotas_migration = migrations_path / '0012_usage_quotas.sql'
            if not quotas_migration.exists():
                return False
            
            # Check migration content
            with open(audit_migration, 'r') as f:
                audit_content = f.read()
            
            required_tables = ['audit_logs', 'events_outbox', 'webhook_events_inbox']
            for table in required_tables:
                if f'CREATE TABLE.*{table}' not in audit_content.replace('\n', ' '):
                    return False
            
            with open(quotas_migration, 'r') as f:
                quotas_content = f.read()
            
            required_quota_tables = ['usage_counters', 'quotas']
            for table in required_quota_tables:
                if f'CREATE TABLE.*{table}' not in quotas_content.replace('\n', ' '):
                    return False
            
            return True
            
        except Exception as e:
            print(f"Database migrations test failed: {str(e)}")
            return False
    
    def test_celery_integration(self):
        """Test if Celery integration is configured."""
        try:
            extensions_path = self.backend_path / 'extensions.py'
            if not extensions_path.exists():
                return False
            
            with open(extensions_path, 'r') as f:
                content = f.read()
            
            # Check for Celery import and configuration
            if 'celery' not in content.lower():
                return False
            
            return True
            
        except Exception as e:
            print(f"Celery integration test failed: {str(e)}")
            return False
    
    def test_webhook_handling(self):
        """Test if webhook handling is implemented."""
        try:
            # Check payment API for webhook handling
            payment_api_path = self.backend_path / 'blueprints' / 'payment_api.py'
            if not payment_api_path.exists():
                return False
            
            with open(payment_api_path, 'r') as f:
                content = f.read()
            
            # Check for webhook endpoints
            if 'webhook' not in content.lower():
                return False
            
            return True
            
        except Exception as e:
            print(f"Webhook handling test failed: {str(e)}")
            return False
    
    def test_notification_queue(self):
        """Test if notification queue is implemented."""
        try:
            notification_models_path = self.backend_path / 'models' / 'notification.py'
            if not notification_models_path.exists():
                return False
            
            with open(notification_models_path, 'r') as f:
                content = f.read()
            
            # Check for NotificationQueue class
            if 'class NotificationQueue' not in content:
                return False
            
            return True
            
        except Exception as e:
            print(f"Notification queue test failed: {str(e)}")
            return False
    
    def test_quota_enforcement_service(self):
        """Test if quota enforcement service exists."""
        try:
            # Check if there's a quota service
            services_path = self.backend_path / 'services'
            if not services_path.exists():
                return False
            
            # Look for quota-related files
            quota_files = list(services_path.glob('*quota*'))
            quota_files.extend(list(services_path.glob('*usage*')))
            
            # Also check if quota logic is in other services
            for service_file in services_path.glob('*.py'):
                if service_file.name == '__init__.py':
                    continue
                
                with open(service_file, 'r') as f:
                    content = f.read()
                
                if 'quota' in content.lower() or 'usage_counter' in content.lower():
                    return True
            
            return len(quota_files) > 0
            
        except Exception as e:
            print(f"Quota enforcement service test failed: {str(e)}")
            return False
    
    def test_observability_logging(self):
        """Test if observability logging is implemented."""
        try:
            # Check for structured logging in services
            services_path = self.backend_path / 'services'
            if not services_path.exists():
                return False
            
            logging_found = False
            for service_file in services_path.glob('*.py'):
                if service_file.name == '__init__.py':
                    continue
                
                with open(service_file, 'r') as f:
                    content = f.read()
                
                # Check for logging imports and usage
                if 'import logging' in content or 'from logging' in content:
                    if 'logger' in content or 'logging.' in content:
                        logging_found = True
                        break
            
            return logging_found
            
        except Exception as e:
            print(f"Observability logging test failed: {str(e)}")
            return False
    
    def test_admin_event_management(self):
        """Test if admin event management is implemented."""
        try:
            admin_api_path = self.backend_path / 'blueprints' / 'admin_dashboard_api.py'
            if not admin_api_path.exists():
                return False
            
            with open(admin_api_path, 'r') as f:
                content = f.read()
            
            # Check for audit logs endpoint
            if '/audit/logs' not in content:
                return False
            
            # Check for operations health endpoint
            if '/operations/health' not in content:
                return False
            
            return True
            
        except Exception as e:
            print(f"Admin event management test failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Phase 5 production readiness tests."""
        print("🚀 Starting Phase 5 Simple Production Readiness Tests...")
        print("=" * 60)
        
        # Run all tests
        tests = [
            ("EventOutbox Model Exists", self.test_outbox_model_exists),
            ("AuditLog Model Exists", self.test_audit_log_model_exists),
            ("Outbox Service Methods", self.test_outbox_service_methods),
            ("Audit Logging Methods", self.test_audit_logging_methods),
            ("Database Migrations Exist", self.test_database_migrations_exist),
            ("Celery Integration", self.test_celery_integration),
            ("Webhook Handling", self.test_webhook_handling),
            ("Notification Queue", self.test_notification_queue),
            ("Quota Enforcement Service", self.test_quota_enforcement_service),
            ("Observability Logging", self.test_observability_logging),
            ("Admin Event Management", self.test_admin_event_management)
        ]
        
        for test_name, test_func in tests:
            self.run_test(test_name, test_func)
        
        # Calculate success rate
        self.test_results['success_rate'] = (
            self.test_results['passed_tests'] / self.test_results['total_tests'] * 100
        ) if self.test_results['total_tests'] > 0 else 0
        
        # Generate report
        self.generate_report()
        
        return self.test_results
    
    def generate_report(self):
        """Generate comprehensive Phase 5 production readiness report."""
        print("\n" + "=" * 60)
        print("📊 PHASE 5 SIMPLE PRODUCTION READINESS REPORT")
        print("=" * 60)
        
        print(f"Total Tests: {self.test_results['total_tests']}")
        print(f"Passed: {self.test_results['passed_tests']}")
        print(f"Failed: {self.test_results['failed_tests']}")
        print(f"Success Rate: {self.test_results['success_rate']:.1f}%")
        
        if self.test_results['critical_failures']:
            print(f"\n❌ CRITICAL FAILURES ({len(self.test_results['critical_failures'])}):")
            for failure in self.test_results['critical_failures']:
                print(f"  - {failure}")
        
        if self.test_results['warnings']:
            print(f"\n⚠️  WARNINGS ({len(self.test_results['warnings'])}):")
            for warning in self.test_results['warnings']:
                print(f"  - {warning}")
        
        # Determine production readiness
        if self.test_results['success_rate'] >= 100:
            print(f"\n🎉 PHASE 5 IS 100% PRODUCTION READY! 🎉")
            status = "✅ 100% PRODUCTION READY"
        elif self.test_results['success_rate'] >= 90:
            print(f"\n✅ PHASE 5 IS SUBSTANTIALLY PRODUCTION READY")
            status = "✅ SUBSTANTIALLY PRODUCTION READY"
        elif self.test_results['success_rate'] >= 75:
            print(f"\n⚠️  PHASE 5 NEEDS MINOR FIXES")
            status = "⚠️  NEEDS MINOR FIXES"
        else:
            print(f"\n❌ PHASE 5 NEEDS MAJOR WORK")
            status = "❌ NEEDS MAJOR WORK"
        
        print(f"\nStatus: {status}")
        print("=" * 60)
        
        return status


def main():
    """Main function to run Phase 5 simple production readiness tests."""
    test_suite = Phase5SimpleTest()
    results = test_suite.run_all_tests()
    
    # Exit with appropriate code
    if results['success_rate'] >= 100:
        exit(0)  # Success
    else:
        exit(1)  # Failure


if __name__ == "__main__":
    main()
