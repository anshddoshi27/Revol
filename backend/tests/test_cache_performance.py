"""
Cache Performance Tests

This module contains comprehensive cache performance tests to ensure Redis caching
meets performance requirements and provides effective cache hit rates.

Performance Targets:
- Cache hit rate: >80% for frequently accessed data
- Cache response time: <10ms for cache hits
- Cache miss penalty: <50ms for cache misses
- Cache invalidation: <100ms for bulk operations
"""

import pytest
import time
import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any
from unittest.mock import patch, MagicMock

from app import create_app
from app.extensions import db, get_redis
from app.models.core import Tenant, User, Membership
from app.models.business import Customer, Service, Resource, Booking
from app.services.cache import (
    CacheService, 
    AvailabilityCacheService, 
    BookingHoldCacheService, 
    WaitlistCacheService
)
from app.services.business_phase2 import AvailabilityService


class TestCachePerformance:
    """Comprehensive cache performance tests."""
    
    @pytest.fixture(autouse=True)
    def setup_test_environment(self):
        """Setup test environment for cache tests."""
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
        self.customers = self._create_test_customers(50)
        self.services = self._create_test_services(10)
        self.resources = self._create_test_resources(5)
        
        # Initialize cache services
        self.cache_service = CacheService()
        self.availability_cache = AvailabilityCacheService()
        self.hold_cache = BookingHoldCacheService()
        self.waitlist_cache = WaitlistCacheService()
        
        yield
        
        # Cleanup
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
    
    def _create_test_tenant(self):
        """Create test tenant."""
        tenant = Tenant(
            id=uuid.uuid4(),
            slug="cache-test-tenant",
            name="Cache Test Tenant",
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
            email="cachetest@example.com",
            display_name="Cache Test User"
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
                category=f"Category {i % 3}"
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
    
    def test_cache_hit_rate_performance(self):
        """Test cache hit rate meets >80% requirement."""
        # Test availability cache hit rate
        resource_id = self.resources[0].id
        date_str = datetime.utcnow().date().isoformat()
        
        # Generate test availability data
        availability_data = {
            'slots': [
                {'start': '09:00', 'end': '10:00', 'available': True},
                {'start': '10:00', 'end': '11:00', 'available': True},
                {'start': '11:00', 'end': '12:00', 'available': False},
                {'start': '12:00', 'end': '13:00', 'available': True},
            ]
        }
        
        # Cache the data
        self.availability_cache.set_availability(
            self.tenant.id, resource_id, date_str, availability_data
        )
        
        # Test cache hit rate with multiple reads
        hit_count = 0
        miss_count = 0
        total_requests = 100
        
        for i in range(total_requests):
            start_time = time.time()
            
            cached_data = self.availability_cache.get_availability(
                self.tenant.id, resource_id, date_str
            )
            
            end_time = time.time()
            response_time_ms = (end_time - start_time) * 1000
            
            if cached_data:
                hit_count += 1
                # Cache hits should be very fast
                assert response_time_ms < 10, f"Cache hit took {response_time_ms:.2f}ms, expected <10ms"
            else:
                miss_count += 1
        
        hit_rate = (hit_count / total_requests) * 100
        
        # Performance assertions
        assert hit_rate >= 80, f"Cache hit rate {hit_rate:.1f}%, expected >=80%"
        assert hit_count > miss_count, f"Cache hits {hit_count} should exceed misses {miss_count}"
        
        print(f"Cache hit rate: {hit_rate:.1f}% ({hit_count}/{total_requests})")
    
    def test_cache_response_time_performance(self):
        """Test cache response time meets <10ms requirement."""
        # Test different cache operations
        test_cases = [
            {
                'name': 'Cache set operation',
                'operation': lambda: self.cache_service.set('test_key', {'data': 'test'}, 300),
                'max_time_ms': 10
            },
            {
                'name': 'Cache get operation (hit)',
                'operation': lambda: self.cache_service.get('test_key'),
                'max_time_ms': 10
            },
            {
                'name': 'Cache delete operation',
                'operation': lambda: self.cache_service.delete('test_key'),
                'max_time_ms': 10
            }
        ]
        
        # Set up test data
        self.cache_service.set('test_key', {'data': 'test'}, 300)
        
        for test_case in test_cases:
            start_time = time.time()
            
            result = test_case['operation']()
            
            end_time = time.time()
            response_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert response_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {response_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {response_time_ms:.2f}ms")
    
    def test_cache_miss_penalty_performance(self):
        """Test cache miss penalty meets <50ms requirement."""
        # Test cache miss scenarios
        test_cases = [
            {
                'name': 'Availability cache miss',
                'operation': lambda: self.availability_cache.get_availability(
                    self.tenant.id, 
                    self.resources[0].id, 
                    '2025-12-31'  # Non-existent date
                ),
                'max_time_ms': 50
            },
            {
                'name': 'General cache miss',
                'operation': lambda: self.cache_service.get('non_existent_key'),
                'max_time_ms': 50
            }
        ]
        
        for test_case in test_cases:
            start_time = time.time()
            
            result = test_case['operation']()
            
            end_time = time.time()
            response_time_ms = (end_time - start_time) * 1000
            
            # Performance assertion
            assert response_time_ms < test_case['max_time_ms'], \
                f"{test_case['name']} took {response_time_ms:.2f}ms, exceeds {test_case['max_time_ms']}ms limit"
            
            print(f"{test_case['name']}: {response_time_ms:.2f}ms")
    
    def test_availability_cache_performance(self):
        """Test availability cache performance."""
        resource_id = self.resources[0].id
        date_str = datetime.utcnow().date().isoformat()
        
        # Test availability cache operations
        availability_data = {
            'slots': [
                {'start': '09:00', 'end': '10:00', 'available': True},
                {'start': '10:00', 'end': '11:00', 'available': True},
                {'start': '11:00', 'end': '12:00', 'available': False},
            ],
            'resource_id': str(resource_id),
            'date': date_str
        }
        
        # Test cache set performance
        start_time = time.time()
        success = self.availability_cache.set_availability(
            self.tenant.id, resource_id, date_str, availability_data
        )
        end_time = time.time()
        set_time_ms = (end_time - start_time) * 1000
        
        assert success, "Availability cache set should succeed"
        assert set_time_ms < 20, f"Availability cache set took {set_time_ms:.2f}ms, expected <20ms"
        
        # Test cache get performance
        start_time = time.time()
        cached_data = self.availability_cache.get_availability(
            self.tenant.id, resource_id, date_str
        )
        end_time = time.time()
        get_time_ms = (end_time - start_time) * 1000
        
        assert cached_data is not None, "Availability cache get should return data"
        assert get_time_ms < 10, f"Availability cache get took {get_time_ms:.2f}ms, expected <10ms"
        
        # Test cache invalidation performance
        start_time = time.time()
        invalidated_count = self.availability_cache.invalidate_availability(
            self.tenant.id, resource_id, date_str
        )
        end_time = time.time()
        invalidate_time_ms = (end_time - start_time) * 1000
        
        assert invalidated_count >= 0, "Availability cache invalidation should succeed"
        assert invalidate_time_ms < 20, f"Availability cache invalidation took {invalidate_time_ms:.2f}ms, expected <20ms"
        
        print(f"Availability cache: set={set_time_ms:.2f}ms, get={get_time_ms:.2f}ms, invalidate={invalidate_time_ms:.2f}ms")
    
    def test_booking_hold_cache_performance(self):
        """Test booking hold cache performance."""
        hold_key = f"hold_{uuid.uuid4()}"
        hold_data = {
            'booking_data': {
                'customer_id': str(self.customers[0].id),
                'service_id': str(self.services[0].id),
                'resource_id': str(self.resources[0].id),
                'start_at': (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                'end_at': (datetime.utcnow() + timedelta(hours=2)).isoformat()
            },
            'expires_at': (datetime.utcnow() + timedelta(minutes=15)).isoformat(),
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Test hold creation performance
        start_time = time.time()
        success = self.hold_cache.create_hold(
            self.tenant.id, hold_key, hold_data
        )
        end_time = time.time()
        create_time_ms = (end_time - start_time) * 1000
        
        assert success, "Hold creation should succeed"
        assert create_time_ms < 20, f"Hold creation took {create_time_ms:.2f}ms, expected <20ms"
        
        # Test hold retrieval performance
        start_time = time.time()
        retrieved_hold = self.hold_cache.get_hold(self.tenant.id, hold_key)
        end_time = time.time()
        get_time_ms = (end_time - start_time) * 1000
        
        assert retrieved_hold is not None, "Hold retrieval should succeed"
        assert get_time_ms < 10, f"Hold retrieval took {get_time_ms:.2f}ms, expected <10ms"
        
        # Test hold release performance
        start_time = time.time()
        released = self.hold_cache.release_hold(self.tenant.id, hold_key)
        end_time = time.time()
        release_time_ms = (end_time - start_time) * 1000
        
        assert released, "Hold release should succeed"
        assert release_time_ms < 10, f"Hold release took {release_time_ms:.2f}ms, expected <10ms"
        
        print(f"Booking hold cache: create={create_time_ms:.2f}ms, get={get_time_ms:.2f}ms, release={release_time_ms:.2f}ms")
    
    def test_waitlist_cache_performance(self):
        """Test waitlist cache performance."""
        resource_id = self.resources[0].id
        
        # Test waitlist operations
        waitlist_data = {
            'customer_id': str(self.customers[0].id),
            'customer_name': self.customers[0].display_name,
            'customer_email': self.customers[0].email,
            'priority': 1,
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Test adding to waitlist performance
        start_time = time.time()
        success = self.waitlist_cache.add_to_waitlist_cache(
            self.tenant.id, resource_id, waitlist_data
        )
        end_time = time.time()
        add_time_ms = (end_time - start_time) * 1000
        
        assert success, "Waitlist add should succeed"
        assert add_time_ms < 20, f"Waitlist add took {add_time_ms:.2f}ms, expected <20ms"
        
        # Test waitlist retrieval performance
        start_time = time.time()
        waitlist = self.waitlist_cache.get_waitlist(self.tenant.id, resource_id)
        end_time = time.time()
        get_time_ms = (end_time - start_time) * 1000
        
        assert waitlist is not None, "Waitlist retrieval should succeed"
        assert len(waitlist) > 0, "Waitlist should contain entries"
        assert get_time_ms < 10, f"Waitlist retrieval took {get_time_ms:.2f}ms, expected <10ms"
        
        # Test waitlist removal performance
        start_time = time.time()
        removed = self.waitlist_cache.remove_from_waitlist_cache(
            self.tenant.id, resource_id, self.customers[0].id
        )
        end_time = time.time()
        remove_time_ms = (end_time - start_time) * 1000
        
        assert removed, "Waitlist removal should succeed"
        assert remove_time_ms < 20, f"Waitlist removal took {remove_time_ms:.2f}ms, expected <20ms"
        
        print(f"Waitlist cache: add={add_time_ms:.2f}ms, get={get_time_ms:.2f}ms, remove={remove_time_ms:.2f}ms")
    
    def test_cache_invalidation_performance(self):
        """Test cache invalidation performance meets <100ms requirement."""
        # Set up multiple cache entries
        resource_id = self.resources[0].id
        dates = [
            (datetime.utcnow() + timedelta(days=i)).date().isoformat() 
            for i in range(10)
        ]
        
        # Cache multiple availability entries
        for date_str in dates:
            availability_data = {
                'slots': [{'start': '09:00', 'end': '10:00', 'available': True}],
                'date': date_str
            }
            self.availability_cache.set_availability(
                self.tenant.id, resource_id, date_str, availability_data
            )
        
        # Test bulk invalidation performance
        start_time = time.time()
        invalidated_count = self.availability_cache.invalidate_availability(
            self.tenant.id, resource_id
        )
        end_time = time.time()
        invalidate_time_ms = (end_time - start_time) * 1000
        
        # Performance assertions
        assert invalidated_count >= 0, "Bulk invalidation should succeed"
        assert invalidate_time_ms < 100, f"Bulk invalidation took {invalidate_time_ms:.2f}ms, expected <100ms"
        
        print(f"Bulk cache invalidation: {invalidate_time_ms:.2f}ms ({invalidated_count} entries)")
    
    def test_concurrent_cache_performance(self):
        """Test cache performance under concurrent load."""
        import threading
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def cache_operation(operation_id):
            """Execute cache operations."""
            resource_id = self.resources[operation_id % len(self.resources)].id
            date_str = (datetime.utcnow() + timedelta(days=operation_id % 7)).date().isoformat()
            
            # Mix of cache operations
            operations = [
                lambda: self.availability_cache.set_availability(
                    self.tenant.id, resource_id, date_str, 
                    {'slots': [{'start': '09:00', 'end': '10:00', 'available': True}]}
                ),
                lambda: self.availability_cache.get_availability(
                    self.tenant.id, resource_id, date_str
                ),
                lambda: self.cache_service.set(f'key_{operation_id}', {'data': f'value_{operation_id}'}, 300),
                lambda: self.cache_service.get(f'key_{operation_id}')
            ]
            
            start_time = time.time()
            results = []
            
            for operation in operations:
                try:
                    result = operation()
                    results.append(result)
                except Exception as e:
                    results.append(None)
            
            end_time = time.time()
            return (end_time - start_time) * 1000, len([r for r in results if r is not None])
        
        # Execute 50 concurrent cache operations
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(cache_operation, i) for i in range(50)]
            
            for future in as_completed(futures):
                try:
                    operation_time_ms, success_count = future.result()
                    results.append(operation_time_ms)
                except Exception as e:
                    print(f"Concurrent cache operation failed: {e}")
        
        end_time = time.time()
        total_time_ms = (end_time - start_time) * 1000
        
        # Performance assertions
        assert len(results) == 50, f"Expected 50 results, got {len(results)}"
        assert total_time_ms < 2000, f"Total concurrent execution took {total_time_ms:.2f}ms, expected <2000ms"
        
        avg_operation_time = sum(results) / len(results)
        max_operation_time = max(results)
        
        assert avg_operation_time < 50, f"Average operation time {avg_operation_time:.2f}ms, expected <50ms"
        assert max_operation_time < 200, f"Max operation time {max_operation_time:.2f}ms, expected <200ms"
        
        print(f"Concurrent cache operations: {total_time_ms:.2f}ms total, {avg_operation_time:.2f}ms avg, {max_operation_time:.2f}ms max")
    
    def test_cache_memory_usage_performance(self):
        """Test cache memory usage under load."""
        import psutil
        import os
        
        # Get initial memory usage
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Create many cache entries
        cache_entries = 1000
        for i in range(cache_entries):
            key = f'perf_test_key_{i}'
            value = {
                'id': i,
                'data': f'Performance test data for entry {i}',
                'timestamp': datetime.utcnow().isoformat(),
                'metadata': {'test': True, 'iteration': i}
            }
            
            self.cache_service.set(key, value, 300)
            
            # Check memory every 100 entries
            if i % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024  # MB
                memory_increase = current_memory - initial_memory
                print(f"After {i+1} cache entries: {current_memory:.1f}MB (+{memory_increase:.1f}MB)")
        
        # Final memory check
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory usage should be reasonable
        assert memory_increase < 50, f"Memory increased by {memory_increase:.1f}MB, expected <50MB"
        assert final_memory < 200, f"Total memory usage {final_memory:.1f}MB, expected <200MB"
        
        print(f"Cache memory usage: {initial_memory:.1f}MB -> {final_memory:.1f}MB (+{memory_increase:.1f}MB)")
        
        # Cleanup
        for i in range(cache_entries):
            key = f'perf_test_key_{i}'
            self.cache_service.delete(key)
    
    def test_cache_fallback_performance(self):
        """Test cache fallback to memory when Redis unavailable."""
        # Mock Redis to be unavailable
        with patch('app.extensions.get_redis', return_value=None):
            # Create new cache service with no Redis
            fallback_cache = CacheService()
            
            # Test fallback performance
            test_data = {'test': 'data', 'timestamp': datetime.utcnow().isoformat()}
            
            # Test set operation (should fallback to memory)
            start_time = time.time()
            success = fallback_cache.set('fallback_key', test_data, 300)
            end_time = time.time()
            set_time_ms = (end_time - start_time) * 1000
            
            assert success, "Fallback cache set should succeed"
            assert set_time_ms < 5, f"Fallback cache set took {set_time_ms:.2f}ms, expected <5ms"
            
            # Test get operation (should fallback to memory)
            start_time = time.time()
            retrieved_data = fallback_cache.get('fallback_key')
            end_time = time.time()
            get_time_ms = (end_time - start_time) * 1000
            
            assert retrieved_data is not None, "Fallback cache get should succeed"
            assert retrieved_data == test_data, "Fallback cache should return correct data"
            assert get_time_ms < 5, f"Fallback cache get took {get_time_ms:.2f}ms, expected <5ms"
            
            print(f"Cache fallback performance: set={set_time_ms:.2f}ms, get={get_time_ms:.2f}ms")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '-s'])
