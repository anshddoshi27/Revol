"""
Performance Monitoring Service

This module provides comprehensive performance monitoring capabilities for the Tithi backend,
including query performance tracking, cache performance monitoring, and system metrics collection.

Features:
- Query performance tracking with SLO validation
- Cache hit rate monitoring and optimization
- Database index usage analysis
- System resource monitoring
- Performance alerting and reporting
"""

import time
import uuid
import json
import psutil
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from contextlib import contextmanager
from collections import defaultdict, deque
import logging

from app.extensions import db, get_redis
from app.middleware.error_handler import TithiError


@dataclass
class PerformanceMetric:
    """Performance metric data structure."""
    metric_name: str
    value: float
    unit: str
    timestamp: datetime
    tenant_id: Optional[uuid.UUID] = None
    metadata: Dict[str, Any] = None


@dataclass
class QueryPerformanceMetric:
    """Query performance metric."""
    query_name: str
    execution_time_ms: float
    tenant_id: Optional[uuid.UUID]
    result_count: int
    timestamp: datetime
    metadata: Dict[str, Any] = None


@dataclass
class CachePerformanceMetric:
    """Cache performance metric."""
    cache_name: str
    operation: str  # 'hit', 'miss', 'set', 'delete'
    response_time_ms: float
    tenant_id: Optional[uuid.UUID]
    timestamp: datetime
    metadata: Dict[str, Any] = None


class PerformanceMonitor:
    """Main performance monitoring service."""
    
    def __init__(self):
        """Initialize performance monitor."""
        self.redis_client = get_redis()
        self.metrics_buffer = deque(maxlen=1000)
        self.query_metrics = deque(maxlen=500)
        self.cache_metrics = deque(maxlen=500)
        self.system_metrics = deque(maxlen=100)
        self._lock = threading.Lock()
        self._slo_thresholds = {
            'calendar_query_ms': 150,
            'booking_creation_ms': 300,
            'availability_calculation_ms': 150,
            'customer_search_ms': 100,
            'payment_query_ms': 100,
            'cache_hit_rate_percent': 80,
            'cache_response_ms': 10,
            'api_median_ms': 500
        }
        self._alert_callbacks = []
    
    def add_alert_callback(self, callback: Callable[[str, Dict], None]):
        """Add alert callback for performance issues."""
        self._alert_callbacks.append(callback)
    
    def _emit_alert(self, alert_type: str, data: Dict[str, Any]):
        """Emit performance alert."""
        for callback in self._alert_callbacks:
            try:
                callback(alert_type, data)
            except Exception as e:
                logging.error(f"Alert callback failed: {e}")
    
    @contextmanager
    def measure_query(self, query_name: str, tenant_id: Optional[uuid.UUID] = None):
        """Context manager for measuring query performance."""
        start_time = time.time()
        result_count = 0
        error = None
        
        try:
            yield
        except Exception as e:
            error = e
            raise
        finally:
            end_time = time.time()
            execution_time_ms = (end_time - start_time) * 1000
            
            # Record query metric
            metric = QueryPerformanceMetric(
                query_name=query_name,
                execution_time_ms=execution_time_ms,
                tenant_id=tenant_id,
                result_count=result_count,
                timestamp=datetime.utcnow(),
                metadata={'error': str(error) if error else None}
            )
            
            self._record_query_metric(metric)
            
            # Check SLO violations
            self._check_query_slo(query_name, execution_time_ms, tenant_id)
    
    def _record_query_metric(self, metric: QueryPerformanceMetric):
        """Record query performance metric."""
        with self._lock:
            self.query_metrics.append(metric)
            
            # Store in Redis for persistence
            if self.redis_client:
                try:
                    key = f"perf:query:{metric.query_name}:{datetime.utcnow().strftime('%Y%m%d%H')}"
                    self.redis_client.lpush(key, json.dumps(asdict(metric), default=str))
                    self.redis_client.expire(key, 86400)  # 24 hours
                except Exception as e:
                    logging.error(f"Failed to store query metric in Redis: {e}")
    
    def _check_query_slo(self, query_name: str, execution_time_ms: float, tenant_id: Optional[uuid.UUID]):
        """Check query SLO violations."""
        # Map query names to SLO thresholds
        slo_mapping = {
            'calendar_query': 'calendar_query_ms',
            'booking_creation': 'booking_creation_ms',
            'availability_calculation': 'availability_calculation_ms',
            'customer_search': 'customer_search_ms',
            'payment_query': 'payment_query_ms'
        }
        
        slo_key = slo_mapping.get(query_name)
        if slo_key and execution_time_ms > self._slo_thresholds[slo_key]:
            self._emit_alert('query_slo_violation', {
                'query_name': query_name,
                'execution_time_ms': execution_time_ms,
                'slo_threshold_ms': self._slo_thresholds[slo_key],
                'tenant_id': str(tenant_id) if tenant_id else None,
                'timestamp': datetime.utcnow().isoformat()
            })
    
    @contextmanager
    def measure_cache_operation(self, cache_name: str, operation: str, tenant_id: Optional[uuid.UUID] = None):
        """Context manager for measuring cache operations."""
        start_time = time.time()
        hit = False
        error = None
        
        try:
            yield hit
        except Exception as e:
            error = e
            raise
        finally:
            end_time = time.time()
            response_time_ms = (end_time - start_time) * 1000
            
            # Record cache metric
            metric = CachePerformanceMetric(
                cache_name=cache_name,
                operation=operation,
                response_time_ms=response_time_ms,
                tenant_id=tenant_id,
                timestamp=datetime.utcnow(),
                metadata={'error': str(error) if error else None}
            )
            
            self._record_cache_metric(metric)
            
            # Check cache SLO violations
            self._check_cache_slo(cache_name, operation, response_time_ms, tenant_id)
    
    def _record_cache_metric(self, metric: CachePerformanceMetric):
        """Record cache performance metric."""
        with self._lock:
            self.cache_metrics.append(metric)
            
            # Store in Redis for persistence
            if self.redis_client:
                try:
                    key = f"perf:cache:{metric.cache_name}:{datetime.utcnow().strftime('%Y%m%d%H')}"
                    self.redis_client.lpush(key, json.dumps(asdict(metric), default=str))
                    self.redis_client.expire(key, 86400)  # 24 hours
                except Exception as e:
                    logging.error(f"Failed to store cache metric in Redis: {e}")
    
    def _check_cache_slo(self, cache_name: str, operation: str, response_time_ms: float, tenant_id: Optional[uuid.UUID]):
        """Check cache SLO violations."""
        if response_time_ms > self._slo_thresholds['cache_response_ms']:
            self._emit_alert('cache_slo_violation', {
                'cache_name': cache_name,
                'operation': operation,
                'response_time_ms': response_time_ms,
                'slo_threshold_ms': self._slo_thresholds['cache_response_ms'],
                'tenant_id': str(tenant_id) if tenant_id else None,
                'timestamp': datetime.utcnow().isoformat()
            })
    
    def record_cache_hit(self, cache_name: str, tenant_id: Optional[uuid.UUID] = None):
        """Record cache hit."""
        metric = CachePerformanceMetric(
            cache_name=cache_name,
            operation='hit',
            response_time_ms=0.0,
            tenant_id=tenant_id,
            timestamp=datetime.utcnow()
        )
        self._record_cache_metric(metric)
    
    def record_cache_miss(self, cache_name: str, tenant_id: Optional[uuid.UUID] = None):
        """Record cache miss."""
        metric = CachePerformanceMetric(
            cache_name=cache_name,
            operation='miss',
            response_time_ms=0.0,
            tenant_id=tenant_id,
            timestamp=datetime.utcnow()
        )
        self._record_cache_metric(metric)
    
    def get_query_performance_stats(self, query_name: Optional[str] = None, 
                                  tenant_id: Optional[uuid.UUID] = None,
                                  hours: int = 24) -> Dict[str, Any]:
        """Get query performance statistics."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Filter metrics
        metrics = [
            m for m in self.query_metrics
            if m.timestamp >= cutoff_time
            and (query_name is None or m.query_name == query_name)
            and (tenant_id is None or m.tenant_id == tenant_id)
        ]
        
        if not metrics:
            return {'count': 0, 'avg_ms': 0, 'max_ms': 0, 'min_ms': 0, 'p95_ms': 0}
        
        execution_times = [m.execution_time_ms for m in metrics]
        execution_times.sort()
        
        return {
            'count': len(metrics),
            'avg_ms': sum(execution_times) / len(execution_times),
            'max_ms': max(execution_times),
            'min_ms': min(execution_times),
            'p95_ms': execution_times[int(len(execution_times) * 0.95)] if execution_times else 0,
            'p99_ms': execution_times[int(len(execution_times) * 0.99)] if execution_times else 0
        }
    
    def get_cache_performance_stats(self, cache_name: Optional[str] = None,
                                  tenant_id: Optional[uuid.UUID] = None,
                                  hours: int = 24) -> Dict[str, Any]:
        """Get cache performance statistics."""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Filter metrics
        metrics = [
            m for m in self.cache_metrics
            if m.timestamp >= cutoff_time
            and (cache_name is None or m.cache_name == cache_name)
            and (tenant_id is None or m.tenant_id == tenant_id)
        ]
        
        if not metrics:
            return {'count': 0, 'hit_rate': 0, 'avg_response_ms': 0}
        
        # Calculate hit rate
        hits = len([m for m in metrics if m.operation == 'hit'])
        misses = len([m for m in metrics if m.operation == 'miss'])
        total_requests = hits + misses
        hit_rate = (hits / total_requests * 100) if total_requests > 0 else 0
        
        # Calculate response times
        response_times = [m.response_time_ms for m in metrics if m.response_time_ms > 0]
        avg_response_ms = sum(response_times) / len(response_times) if response_times else 0
        
        return {
            'count': len(metrics),
            'hit_rate': hit_rate,
            'hits': hits,
            'misses': misses,
            'avg_response_ms': avg_response_ms,
            'max_response_ms': max(response_times) if response_times else 0
        }
    
    def get_system_performance_stats(self) -> Dict[str, Any]:
        """Get system performance statistics."""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk usage
            disk = psutil.disk_usage('/')
            
            # Network I/O
            network = psutil.net_io_counters()
            
            return {
                'cpu_percent': cpu_percent,
                'memory_percent': memory.percent,
                'memory_available_gb': memory.available / (1024**3),
                'disk_percent': disk.percent,
                'disk_free_gb': disk.free / (1024**3),
                'network_bytes_sent': network.bytes_sent,
                'network_bytes_recv': network.bytes_recv,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logging.error(f"Failed to get system performance stats: {e}")
            return {}
    
    def check_performance_health(self) -> Dict[str, Any]:
        """Check overall performance health."""
        health_status = {
            'status': 'healthy',
            'issues': [],
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Check query performance
        query_stats = self.get_query_performance_stats(hours=1)
        if query_stats['count'] > 0:
            if query_stats['avg_ms'] > self._slo_thresholds['api_median_ms']:
                health_status['issues'].append({
                    'type': 'query_performance',
                    'message': f"Average query time {query_stats['avg_ms']:.2f}ms exceeds SLO",
                    'severity': 'warning'
                })
            
            if query_stats['p95_ms'] > self._slo_thresholds['calendar_query_ms'] * 2:
                health_status['issues'].append({
                    'type': 'query_performance',
                    'message': f"P95 query time {query_stats['p95_ms']:.2f}ms is very high",
                    'severity': 'critical'
                })
        
        # Check cache performance
        cache_stats = self.get_cache_performance_stats(hours=1)
        if cache_stats['count'] > 0:
            if cache_stats['hit_rate'] < self._slo_thresholds['cache_hit_rate_percent']:
                health_status['issues'].append({
                    'type': 'cache_performance',
                    'message': f"Cache hit rate {cache_stats['hit_rate']:.1f}% below SLO",
                    'severity': 'warning'
                })
        
        # Check system resources
        system_stats = self.get_system_performance_stats()
        if system_stats:
            if system_stats.get('cpu_percent', 0) > 80:
                health_status['issues'].append({
                    'type': 'system_resources',
                    'message': f"CPU usage {system_stats['cpu_percent']:.1f}% is high",
                    'severity': 'warning'
                })
            
            if system_stats.get('memory_percent', 0) > 85:
                health_status['issues'].append({
                    'type': 'system_resources',
                    'message': f"Memory usage {system_stats['memory_percent']:.1f}% is high",
                    'severity': 'critical'
                })
        
        # Update overall status
        if any(issue['severity'] == 'critical' for issue in health_status['issues']):
            health_status['status'] = 'critical'
        elif health_status['issues']:
            health_status['status'] = 'warning'
        
        return health_status
    
    def generate_performance_report(self, tenant_id: Optional[uuid.UUID] = None,
                                 hours: int = 24) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        report = {
            'tenant_id': str(tenant_id) if tenant_id else None,
            'period_hours': hours,
            'generated_at': datetime.utcnow().isoformat(),
            'query_performance': {},
            'cache_performance': {},
            'system_performance': {},
            'recommendations': []
        }
        
        # Query performance report
        query_stats = self.get_query_performance_stats(tenant_id=tenant_id, hours=hours)
        report['query_performance'] = query_stats
        
        # Cache performance report
        cache_stats = self.get_cache_performance_stats(tenant_id=tenant_id, hours=hours)
        report['cache_performance'] = cache_stats
        
        # System performance report
        system_stats = self.get_system_performance_stats()
        report['system_performance'] = system_stats
        
        # Generate recommendations
        recommendations = []
        
        if query_stats['avg_ms'] > self._slo_thresholds['api_median_ms']:
            recommendations.append({
                'type': 'query_optimization',
                'priority': 'high',
                'message': 'Consider optimizing slow queries or adding database indexes'
            })
        
        if cache_stats['hit_rate'] < self._slo_thresholds['cache_hit_rate_percent']:
            recommendations.append({
                'type': 'cache_optimization',
                'priority': 'medium',
                'message': 'Consider increasing cache TTL or improving cache key strategy'
            })
        
        if system_stats.get('cpu_percent', 0) > 70:
            recommendations.append({
                'type': 'scaling',
                'priority': 'high',
                'message': 'Consider scaling up CPU resources or optimizing CPU-intensive operations'
            })
        
        report['recommendations'] = recommendations
        
        return report


class QueryPerformanceTracker:
    """Decorator for tracking query performance."""
    
    def __init__(self, monitor: PerformanceMonitor, query_name: str):
        """Initialize query performance tracker."""
        self.monitor = monitor
        self.query_name = query_name
    
    def __call__(self, func):
        """Decorator function."""
        def wrapper(*args, **kwargs):
            tenant_id = kwargs.get('tenant_id') or (args[0] if args and hasattr(args[0], 'tenant_id') else None)
            
            with self.monitor.measure_query(self.query_name, tenant_id):
                return func(*args, **kwargs)
        
        return wrapper


class CachePerformanceTracker:
    """Decorator for tracking cache performance."""
    
    def __init__(self, monitor: PerformanceMonitor, cache_name: str):
        """Initialize cache performance tracker."""
        self.monitor = monitor
        self.cache_name = cache_name
    
    def __call__(self, func):
        """Decorator function."""
        def wrapper(*args, **kwargs):
            tenant_id = kwargs.get('tenant_id') or (args[0] if args and hasattr(args[0], 'tenant_id') else None)
            operation = kwargs.get('operation', 'unknown')
            
            with self.monitor.measure_cache_operation(self.cache_name, operation, tenant_id):
                return func(*args, **kwargs)
        
        return wrapper


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


def track_query_performance(query_name: str):
    """Decorator for tracking query performance."""
    return QueryPerformanceTracker(performance_monitor, query_name)


def track_cache_performance(cache_name: str):
    """Decorator for tracking cache performance."""
    return CachePerformanceTracker(performance_monitor, cache_name)
