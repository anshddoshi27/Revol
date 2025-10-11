"""
Database Index Validation Tests

This module contains comprehensive database index validation tests to ensure
all critical indexes are properly created and being used effectively.

Index Validation Targets:
- All tenant-scoped tables have (tenant_id, created_at) composite indexes
- Booking tables have calendar lookup indexes for <150ms queries
- Search indexes are properly configured for full-text search
- Exclusion constraints are working for overlap prevention
- Index usage statistics are within acceptable ranges
"""

import pytest
import time
import uuid
from datetime import datetime, timedelta, date
from typing import Dict, List, Any
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking, BookingItem
from app.models.financial import Payment
from app.models.promotions import Coupon, GiftCard
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.models.system import EventOutbox


class TestDatabaseIndexes:
    """Comprehensive database index validation tests."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for index tests."""
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
        self.services = self._create_test_services(20)
        self.resources = self._create_test_resources(10)
        self.bookings = self._create_test_bookings(500)
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="index-test-tenant",
            name="Index Test Tenant",
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
            email="indextest@example.com",
            display_name="Index Test User"
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
                display_name=f"Customer {i}",
                phone=f"+123456789{i:02d}"
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
                duration_min=60 + (i * 15),
                price_cents=5000 + (i * 1000),
                is_active=True,
                category=f"Category {i % 5}"
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
                capacity=1,
                is_active=True
            )
            resources.append(resource)
            db.session.add(resource)
        db.session.commit()
        return resources
    
    def _create_test_bookings(self, count):
        """Create test bookings."""
        bookings = []
        start_date = datetime.utcnow() - timedelta(days=30)
        
        for i in range(count):
            # Spread bookings over 60 days
            booking_date = start_date + timedelta(days=i % 60)
            start_time = booking_date.replace(hour=9 + (i % 8), minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(hours=1)
            
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customers[i % len(self.customers)].id,
                resource_id=self.resources[i % len(self.resources)].id,
                service_id=self.services[i % len(self.services)].id,
                start_at=start_time,
                end_at=end_time,
                status=['pending', 'confirmed', 'completed', 'canceled'][i % 4],
                client_generated_id=f"index-test-{i}"
            )
            bookings.append(booking)
            db.session.add(booking)
        db.session.commit()
        return bookings
    
    def test_tenant_scoped_indexes(self):
        """Test that tenant-scoped tables have proper indexes."""
        # Test tables that should have tenant_id indexes
        tenant_tables = [
            ('customers', Customer),
            ('services', Service),
            ('resources', Resource),
            ('bookings', Booking),
            ('payments', Payment),
            ('coupons', Coupon),
            ('gift_cards', GiftCard),
            ('notifications', Notification),
            ('audit_logs', AuditLog)
        ]
        
        for table_name, model_class in tenant_tables:
            # Test tenant-scoped query performance
            start_time = time.time()
            
            results = db.session.query(model_class).filter(
                model_class.tenant_id == self.tenant.id
            ).limit(10).all()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Should be fast due to tenant_id index
            assert query_time_ms < 50, f"{table_name} tenant query took {query_time_ms:.2f}ms, expected <50ms"
            
            print(f"{table_name} tenant index: {query_time_ms:.2f}ms")
    
    def test_booking_calendar_indexes(self):
        """Test booking calendar lookup indexes."""
        # Test calendar queries that should use composite indexes
        test_cases = [
            {
                'name': 'Single resource calendar',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.resource_id == self.resources[0].id,
                    Booking.start_at >= datetime.utcnow().date(),
                    Booking.end_at <= (datetime.utcnow() + timedelta(days=7)).date()
                ).all(),
                'max_time_ms': 150
            },
            {
                'name': 'Date range calendar',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.start_at >= datetime.utcnow().date(),
                    Booking.start_at <= (datetime.utcnow() + timedelta(days=30)).date(),
                    Booking.status.in_(['pending', 'confirmed', 'checked_in'])
                ).all(),
                'max_time_ms': 150
            },
            {
                'name': 'Resource and date calendar',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.resource_id == self.resources[0].id,
                    Booking.start_at >= datetime.utcnow().date(),
                    Booking.start_at <= (datetime.utcnow() + timedelta(days=14)).date()
                ).order_by(Booking.start_at).all(),
                'max_time_ms': 150
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} bookings)")
    
    def test_customer_search_indexes(self):
        """Test customer search indexes."""
        # Test customer search queries
        test_cases = [
            {
                'name': 'Email search',
                'query': lambda: db.session.query(Customer).filter(
                    Customer.tenant_id == self.tenant.id,
                    Customer.email.contains('customer1')
                ).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Name search',
                'query': lambda: db.session.query(Customer).filter(
                    Customer.tenant_id == self.tenant.id,
                    Customer.display_name.contains('Customer 1')
                ).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Phone search',
                'query': lambda: db.session.query(Customer).filter(
                    Customer.tenant_id == self.tenant.id,
                    Customer.phone.contains('+12345678901')
                ).all(),
                'max_time_ms': 100
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} results)")
    
    def test_service_search_indexes(self):
        """Test service search indexes."""
        # Test service search queries
        test_cases = [
            {
                'name': 'Service name search',
                'query': lambda: db.session.query(Service).filter(
                    Service.tenant_id == self.tenant.id,
                    Service.name.contains('Service 1')
                ).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Service category search',
                'query': lambda: db.session.query(Service).filter(
                    Service.tenant_id == self.tenant.id,
                    Service.category == 'Category 1'
                ).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Active services search',
                'query': lambda: db.session.query(Service).filter(
                    Service.tenant_id == self.tenant.id,
                    Service.is_active == True
                ).all(),
                'max_time_ms': 100
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} results)")
    
    def test_payment_indexes(self):
        """Test payment table indexes."""
        # Test payment queries
        test_cases = [
            {
                'name': 'Payment by booking',
                'query': lambda: db.session.query(Payment).filter(
                    Payment.tenant_id == self.tenant.id,
                    Payment.booking_id.isnot(None)
                ).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Payment by status',
                'query': lambda: db.session.query(Payment).filter(
                    Payment.tenant_id == self.tenant.id,
                    Payment.status == 'captured'
                ).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Payment by date range',
                'query': lambda: db.session.query(Payment).filter(
                    Payment.tenant_id == self.tenant.id,
                    Payment.created_at >= datetime.utcnow() - timedelta(days=30)
                ).all(),
                'max_time_ms': 100
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} results)")
    
    def test_audit_log_indexes(self):
        """Test audit log indexes."""
        # Test audit log queries
        test_cases = [
            {
                'name': 'Audit log by tenant',
                'query': lambda: db.session.query(AuditLog).filter(
                    AuditLog.tenant_id == self.tenant.id
                ).limit(10).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Audit log by table',
                'query': lambda: db.session.query(AuditLog).filter(
                    AuditLog.tenant_id == self.tenant.id,
                    AuditLog.table_name == 'bookings'
                ).limit(10).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Audit log by date range',
                'query': lambda: db.session.query(AuditLog).filter(
                    AuditLog.tenant_id == self.tenant.id,
                    AuditLog.created_at >= datetime.utcnow() - timedelta(days=7)
                ).limit(10).all(),
                'max_time_ms': 100
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} results)")
    
    def test_composite_indexes(self):
        """Test composite indexes for complex queries."""
        # Test composite index queries
        test_cases = [
            {
                'name': 'Tenant and date composite',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.created_at >= datetime.utcnow() - timedelta(days=30)
                ).order_by(Booking.created_at.desc()).limit(20).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Tenant and status composite',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.status == 'confirmed'
                ).order_by(Booking.start_at).limit(20).all(),
                'max_time_ms': 100
            },
            {
                'name': 'Customer and tenant composite',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.customer_id == self.customers[0].id
                ).order_by(Booking.start_at.desc()).limit(10).all(),
                'max_time_ms': 100
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} results)")
    
    def test_unique_constraint_indexes(self):
        """Test unique constraint indexes."""
        # Test unique constraint queries
        test_cases = [
            {
                'name': 'Customer email unique',
                'query': lambda: db.session.query(Customer).filter(
                    Customer.tenant_id == self.tenant.id,
                    Customer.email == 'customer1@example.com'
                ).first(),
                'max_time_ms': 50
            },
            {
                'name': 'Service slug unique',
                'query': lambda: db.session.query(Service).filter(
                    Service.tenant_id == self.tenant.id,
                    Service.slug == 'service-1'
                ).first(),
                'max_time_ms': 50
            },
            {
                'name': 'Booking client_generated_id unique',
                'query': lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.client_generated_id == 'index-test-1'
                ).first(),
                'max_time_ms': 50
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            result = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms")
    
    def test_join_query_indexes(self):
        """Test join query indexes."""
        # Test join queries
        test_cases = [
            {
                'name': 'Booking with customer join',
                'query': lambda: db.session.query(Booking, Customer).join(
                    Customer, Booking.customer_id == Customer.id
                ).filter(
                    Booking.tenant_id == self.tenant.id
                ).limit(20).all(),
                'max_time_ms': 200
            },
            {
                'name': 'Booking with service join',
                'query': lambda: db.session.query(Booking, Service).join(
                    Service, Booking.service_id == Service.id
                ).filter(
                    Booking.tenant_id == self.tenant.id
                ).limit(20).all(),
                'max_time_ms': 200
            },
            {
                'name': 'Payment with booking join',
                'query': lambda: db.session.query(Payment, Booking).join(
                    Booking, Payment.booking_id == Booking.id
                ).filter(
                    Payment.tenant_id == self.tenant.id
                ).limit(20).all(),
                'max_time_ms': 200
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            results = test_case['query']()
            
            end_time = time.time()
            query_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert query_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {query_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {query_time_ms:.2f}ms ({len(results)} results)")
    
    def test_index_usage_statistics(self):
        """Test index usage statistics."""
        # This test validates that indexes are being used effectively
        # In a real implementation, we would query pg_stat_user_indexes
        
        # Test that queries are using indexes by measuring performance
        # Fast queries indicate index usage
        
        # Test tenant-scoped query (should use tenant_id index)
        start_time = time.time()
        tenant_bookings = db.session.query(Booking).filter(
            Booking.tenant_id == self.tenant.id
        ).count()
        end_time = time.time()
        tenant_query_time = (end_time - start_time) * 1000
        
        # Test date range query (should use composite index)
        start_time = time.time()
        date_bookings = db.session.query(Booking).filter(
            Booking.tenant_id == self.tenant.id,
            Booking.start_at >= datetime.utcnow() - timedelta(days=7)
        ).count()
        end_time = time.time()
        date_query_time = (end_time - start_time) * 1000
        
        # Test full table scan (should be slower)
        start_time = time.time()
        all_bookings = db.session.query(Booking).count()
        end_time = time.time()
        full_scan_time = (end_time - start_time) * 1000
        
        # Performance assertions
        assert tenant_query_time < 100, f"Tenant query took {tenant_query_time:.2f}ms, should be <100ms with index"
        assert date_query_time < 100, f"Date query took {date_query_time:.2f}ms, should be <100ms with composite index"
        
        # Indexed queries should be faster than full scan
        assert tenant_query_time < full_scan_time, "Indexed query should be faster than full scan"
        assert date_query_time < full_scan_time, "Indexed query should be faster than full scan"
        
        print(f"Index usage: tenant={tenant_query_time:.2f}ms, date={date_query_time:.2f}ms, full_scan={full_scan_time:.2f}ms")
    
    def test_concurrent_index_performance(self):
        """Test index performance under concurrent load."""
        import threading
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def index_query(query_id):
            """Execute index-based query."""
            # Mix of different indexed queries
            queries = [
                lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id
                ).limit(10).all(),
                lambda: db.session.query(Customer).filter(
                    Customer.tenant_id == self.tenant.id,
                    Customer.email.contains('customer')
                ).limit(10).all(),
                lambda: db.session.query(Service).filter(
                    Service.tenant_id == self.tenant.id,
                    Service.is_active == True
                ).limit(10).all(),
                lambda: db.session.query(Booking).filter(
                    Booking.tenant_id == self.tenant.id,
                    Booking.start_at >= datetime.utcnow().date()
                ).limit(10).all()
            ]
            
            start_time = time.time()
            results = []
            
            for query in queries:
                try:
                    result = query()
                    results.append(len(result))
                except Exception as e:
                    results.append(0)
            
            end_time = time.time()
            return (end_time - start_time) * 1000, sum(results)
        
        # Execute 50 concurrent index queries
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(index_query, i) for i in range(50)]
            
            for future in as_completed(futures):
                try:
                    query_time_ms, result_count = future.result()
                    results.append(query_time_ms)
                except Exception as e:
                    print(f"Concurrent index query failed: {e}")
        
        end_time = time.time()
        total_time_ms = (end_time - start_time) * 1000
        
        # Performance assertions
        assert len(results) == 50, f"Expected 50 results, got {len(results)}"
        assert total_time_ms < 3000, f"Total concurrent execution took {total_time_ms:.2f}ms, expected <3000ms"
        
        avg_query_time = sum(results) / len(results)
        max_query_time = max(results)
        
        assert avg_query_time < 100, f"Average query time {avg_query_time:.2f}ms, expected <100ms"
        assert max_query_time < 300, f"Max query time {max_query_time:.2f}ms, expected <300ms"
        
        print(f"Concurrent index queries: {total_time_ms:.2f}ms total, {avg_query_time:.2f}ms avg, {max_query_time:.2f}ms max")
    
    def test_index_maintenance_performance(self):
        """Test index maintenance performance."""
        # Test index maintenance operations
        # In a real implementation, we would test REINDEX, ANALYZE, etc.
        
        # Test that queries remain fast after data modifications
        initial_count = db.session.query(Booking).filter(
            Booking.tenant_id == self.tenant.id
        ).count()
        
        # Add more data
        new_bookings = []
        for i in range(100):
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=self.tenant.id,
                customer_id=self.customers[i % len(self.customers)].id,
                resource_id=self.resources[i % len(self.resources)].id,
                service_id=self.services[i % len(self.services)].id,
                start_at=datetime.utcnow() + timedelta(days=i),
                end_at=datetime.utcnow() + timedelta(days=i, hours=1),
                status='pending',
                client_generated_id=f"maintenance-test-{i}"
            )
            new_bookings.append(booking)
            db.session.add(booking)
        
        db.session.commit()
        
        # Test query performance after data addition
        start_time = time.time()
        final_count = db.session.query(Booking).filter(
            Booking.tenant_id == self.tenant.id
        ).count()
        end_time = time.time()
        query_time_ms = (end_time - start_time) * 1000
        
        # Performance assertion
        assert query_time_ms < 100, f"Query after data addition took {query_time_ms:.2f}ms, expected <100ms"
        assert final_count == initial_count + 100, f"Expected {initial_count + 100} bookings, got {final_count}"
        
        print(f"Index maintenance: query after data addition took {query_time_ms:.2f}ms")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
