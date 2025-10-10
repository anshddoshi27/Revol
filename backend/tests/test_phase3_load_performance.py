"""
Phase 3 Load and Performance Tests

This module contains comprehensive load and performance tests for Phase 3 modules:
- Payment processing under load
- Notification throughput
- Promotion validation performance
- Database query optimization
- Memory usage and resource consumption
"""

import pytest
import time
import threading
import uuid
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from unittest.mock import patch, MagicMock
import psutil
import os

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.models.financial import Payment
from app.models.promotions import Coupon, GiftCard
from app.models.notification import Notification
from app.services.financial import PaymentService
from app.services.promotion import PromotionService
from app.services.notification import NotificationService


class TestPhase3LoadPerformance:
    """Load and performance tests for Phase 3 modules."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for load tests."""
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        
        # Create test database
        db.create_all()
        
        # Create test data
        self.tenant = self._create_test_tenant()
        self.user = self._create_test_user()
        self.membership = self._create_test_membership()
        self.customers = self._create_test_customers(100)
        self.services = self._create_test_services(10)
        self.resources = self._create_test_resources(5)
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="load-test-tenant",
            name="Load Test Tenant",
            timezone="UTC",
            is_active=True
        )
        db.session.add(tenant)
        db.session.commit()
        return tenant
    
    def _create_test_user(self):
        """Create test user."""
        user = User(
            id=uuid.uuid4(),
            email="loadtest@example.com",
            display_name="Load Test User"
        )
        db.session.add(user)
        db.session.commit()
        return user
    
    def _create_test_membership(self):
        """Create test membership."""
        membership = Membership(
            id=uuid.uuid4(),
            tenant_id=self.tenant.id,
            user_id=self.user.id,
            role="owner"
        )
        db.session.add(membership)
        db.session.commit()
        return membership
    
    def _create_test_customers(self, count):
        """Create test customers."""
        customers = []
        for i in range(count):
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                email=f"customer{i}@example.com",
                display_name=f"Customer {i}"
            )
            customers.append(customer)
            db.session.add(customer)
        db.session.commit()
        return customers
    
    def _create_test_services(self, count):
        """Create test services."""
        services = []
        for i in range(count):
            service = Service(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                name=f"Service {i}",
                duration_minutes=60,
                price_cents=5000 + (i * 1000),
                is_active=True
            )
            services.append(service)
            db.session.add(service)
        db.session.commit()
        return services
    
    def _create_test_resources(self, count):
        """Create test resources."""
        resources = []
        for i in range(count):
            resource = Resource(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                name=f"Staff {i}",
                type="staff",
                is_active=True
            )
            resources.append(resource)
            db.session.add(resource)
        db.session.commit()
        return resources
    
    def test_payment_processing_load(self):
        """Test payment processing under high load."""
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_load_test",
                status="requires_payment_method"
            )
            
            def process_payment(customer_id, service_id, amount_cents):
                """Process a single payment."""
                return payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=amount_cents
                )
            
            # Test with 100 concurrent payments
            start_time = time.time()
            results = []
            
            with ThreadPoolExecutor(max_workers=20) as executor:
                futures = []
                for i in range(100):
                    future = executor.submit(
                        process_payment,
                        str(self.customers[i % len(self.customers)].id),
                        str(self.services[i % len(self.services)].id),
                        5000 + (i * 100)
                    )
                    futures.append(future)
                
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        results.append(result)
                    except Exception as e:
                        print(f"Payment processing error: {e}")
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Performance assertions
            assert len(results) == 100, f"Expected 100 payments, got {len(results)}"
            assert processing_time < 30.0, f"Processing took {processing_time}s, expected < 30s"
            assert processing_time / 100 < 0.3, f"Average processing time {processing_time/100}s, expected < 0.3s"
            
            print(f"Processed 100 payments in {processing_time:.2f}s (avg: {processing_time/100:.3f}s per payment)")
    
    def test_notification_throughput(self):
        """Test notification processing throughput."""
        notification_service = NotificationService()
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202,
                body="Message sent"
            )
            
            def send_notification(customer_id, subject, body):
                """Send a single notification."""
                customer = self.customers[customer_id % len(self.customers)]
                return notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email=customer.email,
                    channel="email",
                    subject=subject,
                    body=body,
                    event_type="load_test"
                )
            
            # Test with 200 concurrent notifications
            start_time = time.time()
            results = []
            
            with ThreadPoolExecutor(max_workers=25) as executor:
                futures = []
                for i in range(200):
                    future = executor.submit(
                        send_notification,
                        i,
                        f"Load Test Notification {i}",
                        f"This is notification {i} for load testing"
                    )
                    futures.append(future)
                
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        results.append(result)
                    except Exception as e:
                        print(f"Notification sending error: {e}")
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Performance assertions
            assert len(results) == 200, f"Expected 200 notifications, got {len(results)}"
            assert processing_time < 60.0, f"Processing took {processing_time}s, expected < 60s"
            assert processing_time / 200 < 0.3, f"Average processing time {processing_time/200}s, expected < 0.3s"
            
            print(f"Sent 200 notifications in {processing_time:.2f}s (avg: {processing_time/200:.3f}s per notification)")
    
    def test_promotion_validation_performance(self):
        """Test promotion validation performance under load."""
        promotion_service = PromotionService()
        
        # Create test coupons
        coupons = []
        for i in range(50):
            coupon = Coupon(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                code=f"LOADTEST{i:02d}",
                discount_type="percentage",
                discount_value=10 + (i % 20),
                is_active=True,
                usage_limit=1000
            )
            coupons.append(coupon)
            db.session.add(coupon)
        db.session.commit()
        
        def validate_coupon(coupon_code, amount_cents):
            """Validate a single coupon."""
            return promotion_service.coupon_service.validate_coupon(
                tenant_id=str(self.tenant.id),
                code=coupon_code,
                customer_id=str(self.customers[0].id),
                amount_cents=amount_cents
            )
        
        # Test with 500 concurrent validations
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=30) as executor:
            futures = []
            for i in range(500):
                coupon_code = f"LOADTEST{i % 50:02d}"
                amount_cents = 5000 + (i * 100)
                future = executor.submit(validate_coupon, coupon_code, amount_cents)
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    print(f"Coupon validation error: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Performance assertions
        assert len(results) == 500, f"Expected 500 validations, got {len(results)}"
        assert processing_time < 20.0, f"Processing took {processing_time}s, expected < 20s"
        assert processing_time / 500 < 0.04, f"Average processing time {processing_time/500}s, expected < 0.04s"
        
        print(f"Validated 500 coupons in {processing_time:.2f}s (avg: {processing_time/500:.3f}s per validation)")
    
    def test_database_query_performance(self):
        """Test database query performance under load."""
        # Create test bookings
        bookings = []
        for i in range(1000):
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customers[i % len(self.customers)].id,
                resource_id=self.resources[i % len(self.resources)].id,
                service_id=self.services[i % len(self.services)].id,
                start_at=datetime.utcnow() + timedelta(hours=i),
                end_at=datetime.utcnow() + timedelta(hours=i+1),
                status="confirmed"
            )
            bookings.append(booking)
            db.session.add(booking)
        db.session.commit()
        
        def query_bookings():
            """Query bookings with various filters."""
            # Test different query patterns
            queries = [
                # Query by tenant
                db.session.query(Booking).filter(Booking.tenant_id == self.tenant.id).count(),
                # Query by customer
                db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.customer_id == self.customers[0].id
                ).count(),
                # Query by date range
                db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.start_at >= datetime.utcnow(),
                    Booking.start_at <= datetime.utcnow() + timedelta(days=7)
                ).count(),
                # Query with joins
                db.session.query(Booking).join(Customer).filter(
                    Booking.tenant_id == self.tenant.id,
                    Customer.email.like('%@example.com')
                ).count()
            ]
            return queries
        
        # Test with 100 concurrent queries
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = []
            for i in range(100):
                future = executor.submit(query_bookings)
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    print(f"Database query error: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Performance assertions
        assert len(results) == 100, f"Expected 100 query sets, got {len(results)}"
        assert processing_time < 15.0, f"Processing took {processing_time}s, expected < 15s"
        assert processing_time / 100 < 0.15, f"Average processing time {processing_time/100}s, expected < 0.15s"
        
        print(f"Executed 100 query sets in {processing_time:.2f}s (avg: {processing_time/100:.3f}s per query set)")
    
    def test_memory_usage_under_load(self):
        """Test memory usage under load conditions."""
        import gc
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        payment_service = PaymentService()
        
        with patch('stripe.PaymentIntent.create') as mock_stripe:
            mock_stripe.return_value = MagicMock(
                id="pi_memory_test",
                status="requires_payment_method"
            )
            
            # Create many payments to test memory usage
            payments = []
            for i in range(1000):
                payment = payment_service.create_payment_intent(
                    tenant_id=str(self.tenant.id),
                    booking_id=str(uuid.uuid4()),
                    amount_cents=5000
                )
                payments.append(payment)
                
                # Check memory every 100 payments
                if i % 100 == 0:
                    current_memory = process.memory_info().rss / 1024 / 1024  # MB
                    memory_increase = current_memory - initial_memory
                    print(f"After {i+1} payments: {current_memory:.1f}MB (+{memory_increase:.1f}MB)")
            
            # Final memory check
            final_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_increase = final_memory - initial_memory
            
            # Memory usage should be reasonable
            assert memory_increase < 100, f"Memory increased by {memory_increase:.1f}MB, expected < 100MB"
            assert final_memory < 500, f"Total memory usage {final_memory:.1f}MB, expected < 500MB"
            
            print(f"Memory usage: {initial_memory:.1f}MB -> {final_memory:.1f}MB (+{memory_increase:.1f}MB)")
            
            # Cleanup
            del payments
            gc.collect()
    
    def test_concurrent_booking_creation(self):
        """Test concurrent booking creation with conflict detection."""
        def create_booking(customer_id, resource_id, start_offset_hours):
            """Create a single booking."""
            start_time = datetime.utcnow() + timedelta(hours=start_offset_hours)
            end_time = start_time + timedelta(hours=1)
            
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=customer_id,
                resource_id=resource_id,
                service_id=self.services[0].id,
                start_at=start_time,
                end_at=end_time,
                status="pending"
            )
            
            try:
                db.session.add(booking)
                db.session.commit()
                return booking
            except Exception as e:
                db.session.rollback()
                return None
        
        # Test concurrent booking creation for same time slot
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            # Create 20 bookings for the same time slot (should cause conflicts)
            for i in range(20):
                future = executor.submit(
                    create_booking,
                    str(self.customers[i % len(self.customers)].id),
                    str(self.resources[0].id),  # Same resource
                    1  # Same time offset
                )
                futures.append(future)
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    print(f"Booking creation error: {e}")
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Should have some successful bookings and some conflicts
        successful_bookings = [r for r in results if r is not None]
        failed_bookings = [r for r in results if r is None]
        
        assert len(successful_bookings) > 0, "Should have at least one successful booking"
        assert len(failed_bookings) > 0, "Should have some failed bookings due to conflicts"
        assert processing_time < 10.0, f"Processing took {processing_time}s, expected < 10s"
        
        print(f"Created {len(successful_bookings)} successful bookings, {len(failed_bookings)} failed due to conflicts")
        print(f"Processing time: {processing_time:.2f}s")
    
    def test_payment_retry_mechanism(self):
        """Test payment retry mechanism under failure conditions."""
        payment_service = PaymentService()
        
        # Mock Stripe to fail first few attempts, then succeed
        call_count = 0
        def mock_stripe_create(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise Exception("Stripe temporarily unavailable")
            return MagicMock(
                id="pi_retry_test",
                status="requires_payment_method"
            )
        
        with patch('stripe.PaymentIntent.create', side_effect=mock_stripe_create):
            # Test retry mechanism
            start_time = time.time()
            
            payment = None
            for attempt in range(5):  # Max 5 attempts
                try:
                    payment = payment_service.create_payment_intent(
                        tenant_id=str(self.tenant.id),
                        booking_id=str(uuid.uuid4()),
                        amount_cents=5000
                    )
                    break
                except Exception as e:
                    if attempt < 4:  # Not the last attempt
                        time.sleep(0.1)  # Brief delay before retry
                        continue
                    else:
                        raise e
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Should succeed after retries
            assert payment is not None, "Payment should succeed after retries"
            assert call_count == 3, f"Expected 3 Stripe calls (2 failures + 1 success), got {call_count}"
            assert processing_time < 5.0, f"Processing took {processing_time}s, expected < 5s"
            
            print(f"Payment succeeded after {call_count} attempts in {processing_time:.2f}s")
    
    def test_notification_deduplication_performance(self):
        """Test notification deduplication performance under load."""
        notification_service = NotificationService()
        
        with patch('app.services.notification.SendGridAPIClient') as mock_sendgrid:
            mock_sendgrid.return_value.send.return_value = MagicMock(
                status_code=202
            )
            
            def send_duplicate_notification(notification_id):
                """Send a notification with duplicate dedupe key."""
                return notification_service.send_notification(
                    tenant_id=str(self.tenant.id),
                    recipient_email="duplicate@example.com",
                    channel="email",
                    subject="Duplicate Test",
                    body="This is a duplicate notification",
                    event_type="duplicate_test",
                    dedupe_key="duplicate_key_123"
                )
            
            # Test deduplication with 100 duplicate notifications
            start_time = time.time()
            results = []
            
            with ThreadPoolExecutor(max_workers=20) as executor:
                futures = []
                for i in range(100):
                    future = executor.submit(send_duplicate_notification, i)
                    futures.append(future)
                
                for future in as_completed(futures):
                    try:
                        result = future.result()
                        results.append(result)
                    except Exception as e:
                        print(f"Notification deduplication error: {e}")
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # All notifications should have the same ID (deduplication working)
            unique_ids = set(str(r.id) for r in results if r is not None)
            assert len(unique_ids) == 1, f"Expected 1 unique notification ID, got {len(unique_ids)}"
            assert processing_time < 10.0, f"Processing took {processing_time}s, expected < 10s"
            
            print(f"Deduplicated 100 notifications in {processing_time:.2f}s (1 unique notification)")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
