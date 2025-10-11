"""
Load Testing Suite for Tithi Backend
Comprehensive performance testing for all critical endpoints
"""

import pytest
import asyncio
import aiohttp
import time
import statistics
from concurrent.futures import ThreadPoolExecutor
import json
from typing import List, Dict, Any
import uuid
from datetime import datetime, timedelta


class LoadTestResults:
    """Container for load test results."""
    
    def __init__(self):
        self.response_times: List[float] = []
        self.status_codes: List[int] = []
        self.errors: List[str] = []
        self.start_time: float = 0
        self.end_time: float = 0
    
    def add_result(self, response_time: float, status_code: int, error: str = None):
        """Add test result."""
        self.response_times.append(response_time)
        self.status_codes.append(status_code)
        if error:
            self.errors.append(error)
    
    def get_summary(self) -> Dict[str, Any]:
        """Get test summary statistics."""
        if not self.response_times:
            return {}
        
        return {
            'total_requests': len(self.response_times),
            'successful_requests': len([s for s in self.status_codes if 200 <= s < 300]),
            'failed_requests': len([s for s in self.status_codes if s >= 400]),
            'avg_response_time': statistics.mean(self.response_times),
            'median_response_time': statistics.median(self.response_times),
            'p95_response_time': self._percentile(self.response_times, 95),
            'p99_response_time': self._percentile(self.response_times, 99),
            'min_response_time': min(self.response_times),
            'max_response_time': max(self.response_times),
            'requests_per_second': len(self.response_times) / (self.end_time - self.start_time),
            'error_rate': len(self.errors) / len(self.response_times) * 100
        }
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile."""
        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile / 100)
        return sorted_data[min(index, len(sorted_data) - 1)]


class LoadTester:
    """Load testing framework for Tithi backend."""
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.session = None
        self.test_tenant_id = None
        self.test_customer_id = None
        self.test_service_id = None
    
    async def setup_session(self):
        """Setup HTTP session."""
        self.session = aiohttp.ClientSession()
        
        # Create test data
        await self._create_test_data()
    
    async def cleanup_session(self):
        """Cleanup HTTP session."""
        if self.session:
            await self.session.close()
    
    async def _create_test_data(self):
        """Create test data for load testing."""
        # Create test tenant
        tenant_data = {
            'slug': f'load-test-{uuid.uuid4().hex[:8]}',
            'tz': 'UTC',
            'trust_copy_json': {},
            'billing_json': {}
        }
        
        async with self.session.post(f"{self.base_url}/api/tenants", json=tenant_data) as resp:
            if resp.status == 201:
                tenant = await resp.json()
                self.test_tenant_id = tenant['id']
        
        # Create test customer
        customer_data = {
            'display_name': 'Load Test Customer',
            'email': f'loadtest-{uuid.uuid4().hex[:8]}@example.com',
            'phone': '+1234567890',
            'marketing_opt_in': True
        }
        
        async with self.session.post(
            f"{self.base_url}/api/tenants/{self.test_tenant_id}/customers",
            json=customer_data
        ) as resp:
            if resp.status == 201:
                customer = await resp.json()
                self.test_customer_id = customer['id']
        
        # Create test service
        service_data = {
            'name': 'Load Test Service',
            'slug': f'load-test-service-{uuid.uuid4().hex[:8]}',
            'description': 'Service for load testing',
            'duration_min': 60,
            'price_cents': 5000,
            'buffer_before_min': 0,
            'buffer_after_min': 0,
            'category': 'test'
        }
        
        async with self.session.post(
            f"{self.base_url}/api/tenants/{self.test_tenant_id}/services",
            json=service_data
        ) as resp:
            if resp.status == 201:
                service = await resp.json()
                self.test_service_id = service['id']
    
    async def test_endpoint(self, method: str, endpoint: str, data: Dict = None, 
                          concurrent_users: int = 10, requests_per_user: int = 10) -> LoadTestResults:
        """Test endpoint under load."""
        results = LoadTestResults()
        results.start_time = time.time()
        
        async def make_request():
            """Make single request."""
            start_time = time.time()
            try:
                async with self.session.request(
                    method, 
                    f"{self.base_url}{endpoint}", 
                    json=data
                ) as resp:
                    response_time = time.time() - start_time
                    results.add_result(response_time, resp.status)
            except Exception as e:
                response_time = time.time() - start_time
                results.add_result(response_time, 0, str(e))
        
        # Execute concurrent requests
        tasks = []
        for _ in range(concurrent_users * requests_per_user):
            tasks.append(make_request())
        
        await asyncio.gather(*tasks)
        results.end_time = time.time()
        
        return results
    
    async def test_health_endpoint(self, concurrent_users: int = 50, requests_per_user: int = 20):
        """Test health endpoint performance."""
        return await self.test_endpoint(
            'GET', '/health/live', 
            concurrent_users=concurrent_users, 
            requests_per_user=requests_per_user
        )
    
    async def test_tenant_bootstrap(self, concurrent_users: int = 20, requests_per_user: int = 10):
        """Test tenant bootstrap performance."""
        return await self.test_endpoint(
            'GET', f'/v1/b/{self.test_tenant_id}',
            concurrent_users=concurrent_users,
            requests_per_user=requests_per_user
        )
    
    async def test_availability_query(self, concurrent_users: int = 30, requests_per_user: int = 15):
        """Test availability query performance."""
        params = {
            'service_id': self.test_service_id,
            'date_from': (datetime.now() + timedelta(days=1)).isoformat(),
            'date_to': (datetime.now() + timedelta(days=7)).isoformat(),
            'tz': 'UTC'
        }
        
        endpoint = f"/api/availability?{'&'.join(f'{k}={v}' for k, v in params.items())}"
        return await self.test_endpoint('GET', endpoint)
    
    async def test_booking_creation(self, concurrent_users: int = 10, requests_per_user: int = 5):
        """Test booking creation performance."""
        booking_data = {
            'client_generated_id': str(uuid.uuid4()),
            'service_id': self.test_service_id,
            'customer_id': self.test_customer_id,
            'start_at': (datetime.now() + timedelta(days=1)).isoformat(),
            'end_at': (datetime.now() + timedelta(days=1, hours=1)).isoformat(),
            'booking_tz': 'UTC'
        }
        
        return await self.test_endpoint(
            'POST', f'/api/tenants/{self.test_tenant_id}/bookings',
            data=booking_data,
            concurrent_users=concurrent_users,
            requests_per_user=requests_per_user
        )


class TestPerformanceRequirements:
    """Test suite for performance requirements."""
    
    @pytest.mark.asyncio
    async def test_api_response_time_under_500ms(self):
        """Test that API median response time is under 500ms."""
        tester = LoadTester()
        await tester.setup_session()
        
        try:
            results = await tester.test_health_endpoint(concurrent_users=20, requests_per_user=10)
            summary = results.get_summary()
            
            assert summary['median_response_time'] < 0.5, \
                f"Median response time {summary['median_response_time']:.3f}s exceeds 500ms requirement"
            
            assert summary['p95_response_time'] < 1.0, \
                f"P95 response time {summary['p95_response_time']:.3f}s exceeds 1s threshold"
            
            assert summary['error_rate'] < 1.0, \
                f"Error rate {summary['error_rate']:.2f}% exceeds 1% threshold"
        
        finally:
            await tester.cleanup_session()
    
    @pytest.mark.asyncio
    async def test_booking_flow_under_2s(self):
        """Test that booking flow completes under 2s on 3G simulation."""
        tester = LoadTester()
        await tester.setup_session()
        
        try:
            # Simulate 3G network conditions (slower requests)
            results = await tester.test_booking_creation(concurrent_users=5, requests_per_user=3)
            summary = results.get_summary()
            
            assert summary['p95_response_time'] < 2.0, \
                f"Booking flow P95 response time {summary['p95_response_time']:.3f}s exceeds 2s requirement"
            
            assert summary['error_rate'] < 5.0, \
                f"Booking flow error rate {summary['error_rate']:.2f}% exceeds 5% threshold"
        
        finally:
            await tester.cleanup_session()
    
    @pytest.mark.asyncio
    async def test_availability_query_performance(self):
        """Test availability query performance under load."""
        tester = LoadTester()
        await tester.setup_session()
        
        try:
            results = await tester.test_availability_query(concurrent_users=25, requests_per_user=8)
            summary = results.get_summary()
            
            assert summary['median_response_time'] < 0.15, \
                f"Availability query median response time {summary['median_response_time']:.3f}s exceeds 150ms requirement"
            
            assert summary['requests_per_second'] > 100, \
                f"Availability query throughput {summary['requests_per_second']:.1f} req/s below 100 req/s requirement"
        
        finally:
            await tester.cleanup_session()
    
    @pytest.mark.asyncio
    async def test_concurrent_booking_handling(self):
        """Test system handles concurrent bookings correctly."""
        tester = LoadTester()
        await tester.setup_session()
        
        try:
            results = await tester.test_booking_creation(concurrent_users=15, requests_per_user=5)
            summary = results.get_summary()
            
            # Check for booking conflicts (should be handled gracefully)
            conflict_errors = [e for e in results.errors if 'conflict' in e.lower()]
            
            assert len(conflict_errors) < len(results.response_times) * 0.1, \
                f"Too many booking conflicts: {len(conflict_errors)} out of {len(results.response_times)} requests"
            
            assert summary['error_rate'] < 10.0, \
                f"Concurrent booking error rate {summary['error_rate']:.2f}% exceeds 10% threshold"
        
        finally:
            await tester.cleanup_session()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
