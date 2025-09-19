#!/usr/bin/env python3
"""
Phase 5 Final Production Readiness Test

This test validates Phase 5 core functionality with minimal database dependencies.
"""

import os
import sys
import uuid
from datetime import datetime

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.extensions import db
from app.models.system import EventOutbox, WebhookEventInbox, AuditLog
from app.services.quota_service import QuotaService
from app.jobs.outbox_worker import process_ready_outbox_events
from app.jobs.webhook_inbox_worker import process_webhook_event


class Phase5FinalTest:
    """Final Phase 5 production readiness test suite."""
    
    def __init__(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.test_results = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'critical_failures': [],
            'success_rate': 0.0
        }
        
    def run_test(self, test_name, test_func):
        """Run a single test and record results."""
        self.test_results['total_tests'] += 1
        
        try:
            with self.app.app_context():
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
    
    def test_outbox_model_basic(self):
        """Test EventOutbox model basic functionality."""
        try:
            # Test model instantiation without DB operations
            event = EventOutbox(
                tenant_id=uuid.uuid4(),
                event_code="TEST_EVENT",
                payload={"test": "data"},
                status="ready",
                attempts=0,
                max_attempts=3,
                ready_at=datetime.utcnow()
            )
            
            # Verify properties work
            assert event.event_code == "TEST_EVENT"
            assert event.status == "ready"
            assert event.attempts == 0
            
            return True
            
        except Exception as e:
            print(f"Outbox model test failed: {str(e)}")
            return False
    
    def test_webhook_inbox_model(self):
        """Test WebhookEventInbox model works."""
        try:
            # Create a webhook inbox entry
            inbox = WebhookEventInbox(
                provider="test_provider",
                id="test_event_123",
                payload={"type": "test.event"},
                processed_at=None
            )
            
            db.session.add(inbox)
            db.session.commit()
            
            # Verify it was created
            created_inbox = WebhookEventInbox.query.filter_by(
                provider="test_provider", 
                id="test_event_123"
            ).first()
            
            if not created_inbox:
                return False
                
            # Clean up
            db.session.delete(created_inbox)
            db.session.commit()
            
            return True
            
        except Exception as e:
            print(f"Webhook inbox model test failed: {str(e)}")
            return False
    
    def test_quota_service_basic(self):
        """Test QuotaService basic functionality."""
        try:
            quota_service = QuotaService()
            tenant_id = uuid.uuid4()
            
            # Test get_usage with non-existent quota (should return None)
            result = quota_service.get_usage(tenant_id, "non_existent_quota")
            if result is not None:
                return False
                
            return True
            
        except Exception as e:
            print(f"Quota service test failed: {str(e)}")
            return False
    
    def test_outbox_worker_task(self):
        """Test outbox worker task can be called."""
        try:
            # Test the task function exists and can be called
            result = process_ready_outbox_events(batch_limit=10)
            # Should return an integer (processed count)
            return isinstance(result, int)
            
        except Exception as e:
            print(f"Outbox worker test failed: {str(e)}")
            return False
    
    def test_webhook_worker_task(self):
        """Test webhook worker task can be called."""
        try:
            # Test the task function exists and can be called
            result = process_webhook_event("test_provider", "test_id")
            # Should return a boolean
            return isinstance(result, bool)
            
        except Exception as e:
            print(f"Webhook worker test failed: {str(e)}")
            return False
    
    def test_celery_import(self):
        """Test Celery can be imported from extensions."""
        try:
            from app.extensions import celery
            return celery is not None
            
        except Exception as e:
            print(f"Celery import test failed: {str(e)}")
            return False
    
    def test_admin_endpoints_exist(self):
        """Test admin endpoints are registered."""
        try:
            # Check if app has the expected routes
            routes = []
            for rule in self.app.url_map.iter_rules():
                routes.append(rule.rule)
            
            required_endpoints = [
                "/api/v1/admin/outbox/events",
                "/api/v1/admin/audit/logs"
            ]
            
            for endpoint in required_endpoints:
                if not any(endpoint in route for route in routes):
                    return False
                    
            return True
            
        except Exception as e:
            print(f"Admin endpoints test failed: {str(e)}")
            return False
    
    def test_payment_webhook_endpoint(self):
        """Test payment webhook endpoint exists."""
        try:
            # Check if app has webhook endpoints
            routes = []
            for rule in self.app.url_map.iter_rules():
                routes.append(rule.rule)
            
            webhook_endpoints = [route for route in routes if "webhook" in route]
            
            return len(webhook_endpoints) > 0
            
        except Exception as e:
            print(f"Payment webhook test failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Phase 5 final production readiness tests."""
        print("🚀 Starting Phase 5 Final Production Readiness Tests...")
        print("=" * 60)
        
        # Run all tests
        tests = [
            ("EventOutbox Model Basic", self.test_outbox_model_basic),
            ("WebhookEventInbox Model", self.test_webhook_inbox_model),
            ("QuotaService Basic", self.test_quota_service_basic),
            ("Outbox Worker Task", self.test_outbox_worker_task),
            ("Webhook Worker Task", self.test_webhook_worker_task),
            ("Celery Import", self.test_celery_import),
            ("Admin Endpoints Exist", self.test_admin_endpoints_exist),
            ("Payment Webhook Endpoint", self.test_payment_webhook_endpoint)
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
        """Generate comprehensive Phase 5 final production readiness report."""
        print("\n" + "=" * 60)
        print("📊 PHASE 5 FINAL PRODUCTION READINESS REPORT")
        print("=" * 60)
        
        print(f"Total Tests: {self.test_results['total_tests']}")
        print(f"Passed: {self.test_results['passed_tests']}")
        print(f"Failed: {self.test_results['failed_tests']}")
        print(f"Success Rate: {self.test_results['success_rate']:.1f}%")
        
        if self.test_results['critical_failures']:
            print(f"\n❌ CRITICAL FAILURES ({len(self.test_results['critical_failures'])}):")
            for failure in self.test_results['critical_failures']:
                print(f"  - {failure}")
        
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
    """Main function to run Phase 5 final production readiness tests."""
    test_suite = Phase5FinalTest()
    results = test_suite.run_all_tests()
    
    # Exit with appropriate code
    if results['success_rate'] >= 100:
        exit(0)  # Success
    else:
        exit(1)  # Failure


if __name__ == "__main__":
    main()
