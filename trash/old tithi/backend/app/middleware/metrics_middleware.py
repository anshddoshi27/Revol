"""
Comprehensive Prometheus Metrics Middleware
Provides comprehensive application metrics for monitoring and observability

Features:
- HTTP request metrics (count, duration, active connections)
- Business metrics (bookings, payments, notifications, customers)
- Performance metrics (database queries, cache hits, response times)
- Operational metrics (queue depths, worker status, resource usage)
- Error metrics (error rates, failure counts, retry attempts)
- External service metrics (Stripe, Twilio, SendGrid response times)
"""

from prometheus_client import Counter, Histogram, Gauge, Summary, Info, generate_latest, CONTENT_TYPE_LATEST
from flask import request, Response, current_app
import time
import structlog
import psutil
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

logger = structlog.get_logger(__name__)

# HTTP Request Metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code', 'tenant_id', 'user_role']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'tenant_id'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
)

REQUEST_SIZE = Histogram(
    'http_request_size_bytes',
    'HTTP request size in bytes',
    ['method', 'endpoint'],
    buckets=[100, 1000, 10000, 100000, 1000000]
)

RESPONSE_SIZE = Histogram(
    'http_response_size_bytes',
    'HTTP response size in bytes',
    ['method', 'endpoint', 'status_code'],
    buckets=[100, 1000, 10000, 100000, 1000000]
)

ACTIVE_REQUESTS = Gauge(
    'http_requests_active',
    'Number of active HTTP requests'
)

# Business Metrics
BOOKING_COUNT = Counter(
    'bookings_total',
    'Total bookings created',
    ['tenant_id', 'status', 'service_type', 'resource_type']
)

BOOKING_DURATION = Histogram(
    'booking_duration_minutes',
    'Booking duration in minutes',
    ['tenant_id', 'service_type'],
    buckets=[15, 30, 60, 90, 120, 180, 240, 360, 480, 720]
)

PAYMENT_COUNT = Counter(
    'payments_total',
    'Total payments processed',
    ['tenant_id', 'status', 'method', 'currency']
)

PAYMENT_AMOUNT = Histogram(
    'payment_amount_cents',
    'Payment amount in cents',
    ['tenant_id', 'method', 'currency'],
    buckets=[100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]
)

CUSTOMER_COUNT = Counter(
    'customers_total',
    'Total customers created',
    ['tenant_id', 'source']
)

NOTIFICATION_COUNT = Counter(
    'notifications_total',
    'Total notifications sent',
    ['tenant_id', 'channel', 'status', 'template_type']
)

NOTIFICATION_DELIVERY_TIME = Histogram(
    'notification_delivery_seconds',
    'Notification delivery time in seconds',
    ['tenant_id', 'channel', 'provider'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600]
)

# Performance Metrics
DATABASE_QUERY_COUNT = Counter(
    'database_queries_total',
    'Total database queries executed',
    ['tenant_id', 'operation', 'table']
)

DATABASE_QUERY_DURATION = Histogram(
    'database_query_duration_seconds',
    'Database query duration in seconds',
    ['tenant_id', 'operation', 'table'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
)

DATABASE_CONNECTIONS = Gauge(
    'database_connections_active',
    'Number of active database connections'
)

DATABASE_CONNECTION_POOL_SIZE = Gauge(
    'database_connection_pool_size',
    'Database connection pool size'
)

CACHE_HITS = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['tenant_id', 'cache_type', 'key_pattern']
)

CACHE_MISSES = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['tenant_id', 'cache_type', 'key_pattern']
)

REDIS_CONNECTIONS = Gauge(
    'redis_connections_active',
    'Number of active Redis connections'
)

REDIS_MEMORY_USAGE = Gauge(
    'redis_memory_usage_bytes',
    'Redis memory usage in bytes'
)

# Operational Metrics
CELERY_TASK_COUNT = Counter(
    'celery_tasks_total',
    'Total Celery tasks executed',
    ['tenant_id', 'task_name', 'status']
)

CELERY_TASK_DURATION = Histogram(
    'celery_task_duration_seconds',
    'Celery task duration in seconds',
    ['tenant_id', 'task_name'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800]
)

CELERY_QUEUE_SIZE = Gauge(
    'celery_queue_size',
    'Celery queue size',
    ['queue_name']
)

CELERY_WORKER_COUNT = Gauge(
    'celery_workers_active',
    'Number of active Celery workers'
)

# Error Metrics
ERROR_COUNT = Counter(
    'errors_total',
    'Total errors occurred',
    ['tenant_id', 'error_type', 'severity', 'component']
)

RETRY_COUNT = Counter(
    'retries_total',
    'Total retry attempts',
    ['tenant_id', 'operation', 'retry_reason']
)

TIMEOUT_COUNT = Counter(
    'timeouts_total',
    'Total timeout occurrences',
    ['tenant_id', 'operation', 'timeout_type']
)

# External Service Metrics
STRIPE_API_CALLS = Counter(
    'stripe_api_calls_total',
    'Total Stripe API calls',
    ['tenant_id', 'operation', 'status']
)

STRIPE_API_DURATION = Histogram(
    'stripe_api_duration_seconds',
    'Stripe API call duration in seconds',
    ['tenant_id', 'operation'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

TWILIO_API_CALLS = Counter(
    'twilio_api_calls_total',
    'Total Twilio API calls',
    ['tenant_id', 'operation', 'status']
)

TWILIO_API_DURATION = Histogram(
    'twilio_api_duration_seconds',
    'Twilio API call duration in seconds',
    ['tenant_id', 'operation'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

SENDGRID_API_CALLS = Counter(
    'sendgrid_api_calls_total',
    'Total SendGrid API calls',
    ['tenant_id', 'operation', 'status']
)

SENDGRID_API_DURATION = Histogram(
    'sendgrid_api_duration_seconds',
    'SendGrid API call duration in seconds',
    ['tenant_id', 'operation'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

# System Metrics
SYSTEM_CPU_USAGE = Gauge(
    'system_cpu_usage_percent',
    'System CPU usage percentage'
)

SYSTEM_MEMORY_USAGE = Gauge(
    'system_memory_usage_bytes',
    'System memory usage in bytes'
)

SYSTEM_DISK_USAGE = Gauge(
    'system_disk_usage_bytes',
    'System disk usage in bytes'
)

SYSTEM_LOAD_AVERAGE = Gauge(
    'system_load_average',
    'System load average',
    ['period']  # 1min, 5min, 15min
)

# Application Info
APP_INFO = Info(
    'app_info',
    'Application information'
)


class MetricsMiddleware:
    """Comprehensive middleware to collect and expose Prometheus metrics."""
    
    def __init__(self, app=None):
        self.app = app
        self.start_time = time.time()
        self.last_system_update = 0
        self.system_update_interval = 30  # Update system metrics every 30 seconds
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize metrics middleware with Flask app."""
        app.before_request(self.before_request)
        app.after_request(self.after_request)
        
        # Set application info
        APP_INFO.info({
            'version': '1.0.0',
            'environment': app.config.get('ENV', 'development'),
            'python_version': os.sys.version,
            'flask_version': app.config.get('FLASK_VERSION', '2.3.3')
        })
        
        # Add metrics endpoint
        @app.route('/metrics')
        def metrics():
            return Response(
                generate_latest(),
                mimetype=CONTENT_TYPE_LATEST
            )
        
        # Add system metrics endpoint
        @app.route('/metrics/system')
        def system_metrics():
            self._update_system_metrics()
            return Response(
                generate_latest(),
                mimetype=CONTENT_TYPE_LATEST
            )
    
    def before_request(self):
        """Track request start time and increment active requests."""
        request.start_time = time.time()
        ACTIVE_REQUESTS.inc()
        
        # Record request size
        content_length = request.content_length or 0
        REQUEST_SIZE.labels(
            method=request.method,
            endpoint=request.endpoint or 'unknown'
        ).observe(content_length)
    
    def after_request(self, response):
        """Record comprehensive request metrics after response."""
        # Calculate duration
        duration = time.time() - request.start_time
        
        # Get context information
        tenant_id = getattr(request, 'tenant_id', 'unknown')
        user_role = getattr(request, 'user_role', 'unknown')
        
        # Record HTTP metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.endpoint or 'unknown',
            status_code=response.status_code,
            tenant_id=tenant_id,
            user_role=user_role
        ).inc()
        
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.endpoint or 'unknown',
            tenant_id=tenant_id
        ).observe(duration)
        
        # Record response size
        response_length = len(response.get_data()) if hasattr(response, 'get_data') else 0
        RESPONSE_SIZE.labels(
            method=request.method,
            endpoint=request.endpoint or 'unknown',
            status_code=response.status_code
        ).observe(response_length)
        
        # Record error metrics if applicable
        if response.status_code >= 400:
            ERROR_COUNT.labels(
                tenant_id=tenant_id,
                error_type=f'http_{response.status_code}',
                severity='medium' if response.status_code < 500 else 'high',
                component='http'
            ).inc()
        
        # Decrement active requests
        ACTIVE_REQUESTS.dec()
        
        # Update system metrics periodically
        self._update_system_metrics_if_needed()
        
        return response
    
    def _update_system_metrics_if_needed(self):
        """Update system metrics if enough time has passed."""
        current_time = time.time()
        if current_time - self.last_system_update > self.system_update_interval:
            self._update_system_metrics()
            self.last_system_update = current_time
    
    def _update_system_metrics(self):
        """Update system-level metrics."""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            SYSTEM_CPU_USAGE.set(cpu_percent)
            
            # Memory usage
            memory = psutil.virtual_memory()
            SYSTEM_MEMORY_USAGE.set(memory.used)
            
            # Disk usage
            disk = psutil.disk_usage('/')
            SYSTEM_DISK_USAGE.set(disk.used)
            
            # Load average
            load_avg = psutil.getloadavg()
            SYSTEM_LOAD_AVERAGE.labels(period='1min').set(load_avg[0])
            SYSTEM_LOAD_AVERAGE.labels(period='5min').set(load_avg[1])
            SYSTEM_LOAD_AVERAGE.labels(period='15min').set(load_avg[2])
            
        except Exception as e:
            logger.warning(f"Failed to update system metrics: {e}")
    
    def record_database_query(self, tenant_id: str, operation: str, table: str, duration: float):
        """Record database query metrics."""
        DATABASE_QUERY_COUNT.labels(
            tenant_id=tenant_id,
            operation=operation,
            table=table
        ).inc()
        
        DATABASE_QUERY_DURATION.labels(
            tenant_id=tenant_id,
            operation=operation,
            table=table
        ).observe(duration)
    
    def record_cache_operation(self, tenant_id: str, cache_type: str, key_pattern: str, hit: bool):
        """Record cache operation metrics."""
        if hit:
            CACHE_HITS.labels(
                tenant_id=tenant_id,
                cache_type=cache_type,
                key_pattern=key_pattern
            ).inc()
        else:
            CACHE_MISSES.labels(
                tenant_id=tenant_id,
                cache_type=cache_type,
                key_pattern=key_pattern
            ).inc()
    
    def record_external_api_call(self, service: str, tenant_id: str, operation: str, 
                               status: str, duration: float):
        """Record external API call metrics."""
        if service.lower() == 'stripe':
            STRIPE_API_CALLS.labels(
                tenant_id=tenant_id,
                operation=operation,
                status=status
            ).inc()
            STRIPE_API_DURATION.labels(
                tenant_id=tenant_id,
                operation=operation
            ).observe(duration)
        elif service.lower() == 'twilio':
            TWILIO_API_CALLS.labels(
                tenant_id=tenant_id,
                operation=operation,
                status=status
            ).inc()
            TWILIO_API_DURATION.labels(
                tenant_id=tenant_id,
                operation=operation
            ).observe(duration)
        elif service.lower() == 'sendgrid':
            SENDGRID_API_CALLS.labels(
                tenant_id=tenant_id,
                operation=operation,
                status=status
            ).inc()
            SENDGRID_API_DURATION.labels(
                tenant_id=tenant_id,
                operation=operation
            ).observe(duration)
    
    def record_celery_task(self, tenant_id: str, task_name: str, status: str, duration: float = None):
        """Record Celery task metrics."""
        CELERY_TASK_COUNT.labels(
            tenant_id=tenant_id,
            task_name=task_name,
            status=status
        ).inc()
        
        if duration is not None:
            CELERY_TASK_DURATION.labels(
                tenant_id=tenant_id,
                task_name=task_name
            ).observe(duration)
    
    def update_connection_metrics(self, db_connections: int = None, redis_connections: int = None):
        """Update connection metrics."""
        if db_connections is not None:
            DATABASE_CONNECTIONS.set(db_connections)
        if redis_connections is not None:
            REDIS_CONNECTIONS.set(redis_connections)
    
    def update_queue_metrics(self, queue_name: str, size: int):
        """Update queue size metrics."""
        CELERY_QUEUE_SIZE.labels(queue_name=queue_name).set(size)
    
    def update_worker_metrics(self, worker_count: int):
        """Update worker count metrics."""
        CELERY_WORKER_COUNT.set(worker_count)


# Business Metrics Helper Functions
def record_booking_metric(tenant_id: str, status: str, service_type: str = 'unknown', 
                         resource_type: str = 'unknown', duration_minutes: int = None):
    """Record comprehensive booking metrics."""
    BOOKING_COUNT.labels(
        tenant_id=tenant_id, 
        status=status, 
        service_type=service_type, 
        resource_type=resource_type
    ).inc()
    
    if duration_minutes is not None:
        BOOKING_DURATION.labels(
            tenant_id=tenant_id,
            service_type=service_type
        ).observe(duration_minutes)


def record_payment_metric(tenant_id: str, status: str, method: str, currency: str = 'USD', 
                         amount_cents: int = None):
    """Record comprehensive payment metrics."""
    PAYMENT_COUNT.labels(
        tenant_id=tenant_id, 
        status=status, 
        method=method, 
        currency=currency
    ).inc()
    
    if amount_cents is not None:
        PAYMENT_AMOUNT.labels(
            tenant_id=tenant_id,
            method=method,
            currency=currency
        ).observe(amount_cents)


def record_customer_metric(tenant_id: str, source: str = 'booking'):
    """Record customer creation metric."""
    CUSTOMER_COUNT.labels(tenant_id=tenant_id, source=source).inc()


def record_notification_metric(tenant_id: str, channel: str, status: str, 
                             template_type: str = 'unknown', delivery_time: float = None):
    """Record comprehensive notification metrics."""
    NOTIFICATION_COUNT.labels(
        tenant_id=tenant_id, 
        channel=channel, 
        status=status, 
        template_type=template_type
    ).inc()
    
    if delivery_time is not None:
        NOTIFICATION_DELIVERY_TIME.labels(
            tenant_id=tenant_id,
            channel=channel,
            provider='unknown'  # Could be enhanced to track actual provider
        ).observe(delivery_time)


def record_error_metric(tenant_id: str, error_type: str, severity: str, component: str):
    """Record error occurrence metric."""
    ERROR_COUNT.labels(
        tenant_id=tenant_id,
        error_type=error_type,
        severity=severity,
        component=component
    ).inc()


def record_retry_metric(tenant_id: str, operation: str, retry_reason: str):
    """Record retry attempt metric."""
    RETRY_COUNT.labels(
        tenant_id=tenant_id,
        operation=operation,
        retry_reason=retry_reason
    ).inc()


def record_timeout_metric(tenant_id: str, operation: str, timeout_type: str):
    """Record timeout occurrence metric."""
    TIMEOUT_COUNT.labels(
        tenant_id=tenant_id,
        operation=operation,
        timeout_type=timeout_type
    ).inc()


# System Metrics Helper Functions
def update_database_connections(count: int):
    """Update database connections metric."""
    DATABASE_CONNECTIONS.set(count)


def update_redis_connections(count: int):
    """Update Redis connections metric."""
    REDIS_CONNECTIONS.set(count)


def update_redis_memory_usage(bytes_used: int):
    """Update Redis memory usage metric."""
    REDIS_MEMORY_USAGE.set(bytes_used)


def update_database_pool_size(size: int):
    """Update database connection pool size metric."""
    DATABASE_CONNECTION_POOL_SIZE.set(size)


# External Service Metrics Helper Functions
def record_stripe_api_call(tenant_id: str, operation: str, status: str, duration: float):
    """Record Stripe API call metrics."""
    STRIPE_API_CALLS.labels(
        tenant_id=tenant_id,
        operation=operation,
        status=status
    ).inc()
    
    STRIPE_API_DURATION.labels(
        tenant_id=tenant_id,
        operation=operation
    ).observe(duration)


def record_twilio_api_call(tenant_id: str, operation: str, status: str, duration: float):
    """Record Twilio API call metrics."""
    TWILIO_API_CALLS.labels(
        tenant_id=tenant_id,
        operation=operation,
        status=status
    ).inc()
    
    TWILIO_API_DURATION.labels(
        tenant_id=tenant_id,
        operation=operation
    ).observe(duration)


def record_sendgrid_api_call(tenant_id: str, operation: str, status: str, duration: float):
    """Record SendGrid API call metrics."""
    SENDGRID_API_CALLS.labels(
        tenant_id=tenant_id,
        operation=operation,
        status=status
    ).inc()
    
    SENDGRID_API_DURATION.labels(
        tenant_id=tenant_id,
        operation=operation
    ).observe(duration)


# Celery Metrics Helper Functions
def record_celery_task_metric(tenant_id: str, task_name: str, status: str, duration: float = None):
    """Record Celery task metrics."""
    CELERY_TASK_COUNT.labels(
        tenant_id=tenant_id,
        task_name=task_name,
        status=status
    ).inc()
    
    if duration is not None:
        CELERY_TASK_DURATION.labels(
            tenant_id=tenant_id,
            task_name=task_name
        ).observe(duration)


def update_celery_queue_size(queue_name: str, size: int):
    """Update Celery queue size metric."""
    CELERY_QUEUE_SIZE.labels(queue_name=queue_name).set(size)


def update_celery_worker_count(count: int):
    """Update Celery worker count metric."""
    CELERY_WORKER_COUNT.set(count)


# Global metrics middleware instance
metrics_middleware = MetricsMiddleware()


def get_metrics_middleware():
    """Get the global metrics middleware instance."""
    return metrics_middleware
