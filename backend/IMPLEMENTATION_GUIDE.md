# Tithi Backend Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the enhanced Tithi backend to support the complete platform functionality.

## Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Flask application with SQLAlchemy
- Existing Tithi backend structure

## Implementation Steps

### Step 1: Database Migrations

Run the new database migrations in order:

```bash
# Apply the new migrations
flask db upgrade

# Or run migrations individually:
# 0041_onboarding_models.sql
# 0042_booking_flow_models.sql  
# 0043_analytics_models.sql
# 0044_enhanced_notifications.sql
```

### Step 2: Model Integration

Add the new models to your Flask application:

```python
# In backend/app/models/__init__.py
from .onboarding import *
from .booking_flow import *
from .analytics import *
from .notification_enhanced import *

# Update existing imports
from .business import Service, Customer, Booking, Resource
```

### Step 3: Service Layer Implementation

Create service classes for each major functionality:

#### Onboarding Service
```python
# backend/app/services/onboarding_service.py
class OnboardingService:
    def start_onboarding(self, tenant_id):
        """Start onboarding process for tenant"""
        pass
    
    def update_step_data(self, tenant_id, step, data):
        """Update data for specific onboarding step"""
        pass
    
    def complete_step(self, tenant_id, step):
        """Mark step as completed"""
        pass
    
    def get_progress(self, tenant_id):
        """Get current onboarding progress"""
        pass
```

#### Booking Flow Service
```python
# backend/app/services/booking_flow_service.py
class BookingFlowService:
    def create_session(self, tenant_id):
        """Create new booking session"""
        pass
    
    def get_available_services(self, tenant_id):
        """Get services available for booking"""
        pass
    
    def get_availability(self, tenant_id, service_id, date):
        """Get availability for service on date"""
        pass
    
    def confirm_booking(self, session_id, customer_data):
        """Confirm booking and create booking record"""
        pass
```

#### Analytics Service
```python
# backend/app/services/analytics_service.py
class AnalyticsService:
    def get_revenue_analytics(self, tenant_id, period):
        """Get revenue analytics for period"""
        pass
    
    def get_customer_analytics(self, tenant_id, period):
        """Get customer analytics for period"""
        pass
    
    def get_booking_analytics(self, tenant_id, period):
        """Get booking analytics for period"""
        pass
    
    def get_staff_performance(self, tenant_id, staff_id, period):
        """Get staff performance analytics"""
        pass
```

#### Notification Service
```python
# backend/app/services/notification_service.py
class NotificationService:
    def create_template(self, tenant_id, template_data):
        """Create notification template"""
        pass
    
    def send_notification(self, tenant_id, template_id, recipient_data):
        """Send notification using template"""
        pass
    
    def process_placeholders(self, template, data):
        """Process placeholders in template"""
        pass
    
    def get_analytics(self, tenant_id, period):
        """Get notification analytics"""
        pass
```

### Step 4: API Endpoints

Create API endpoints for each service:

#### Onboarding Endpoints
```python
# backend/app/blueprints/onboarding.py
@onboarding_bp.route('/api/onboarding/start', methods=['POST'])
def start_onboarding():
    """Start onboarding process"""
    pass

@onboarding_bp.route('/api/onboarding/step/<step>', methods=['PUT'])
def update_step(step):
    """Update onboarding step data"""
    pass

@onboarding_bp.route('/api/onboarding/progress', methods=['GET'])
def get_progress():
    """Get onboarding progress"""
    pass
```

#### Booking Flow Endpoints
```python
# backend/app/blueprints/booking_flow.py
@booking_bp.route('/api/booking/services', methods=['GET'])
def get_services():
    """Get available services for booking"""
    pass

@booking_bp.route('/api/booking/availability', methods=['GET'])
def get_availability():
    """Get availability for service"""
    pass

@booking_bp.route('/api/booking/session', methods=['POST'])
def create_session():
    """Create booking session"""
    pass

@booking_bp.route('/api/booking/confirm', methods=['POST'])
def confirm_booking():
    """Confirm booking"""
    pass
```

#### Analytics Endpoints
```python
# backend/app/blueprints/analytics.py
@analytics_bp.route('/api/analytics/revenue', methods=['GET'])
def get_revenue_analytics():
    """Get revenue analytics"""
    pass

@analytics_bp.route('/api/analytics/customers', methods=['GET'])
def get_customer_analytics():
    """Get customer analytics"""
    pass

@analytics_bp.route('/api/analytics/bookings', methods=['GET'])
def get_booking_analytics():
    """Get booking analytics"""
    pass
```

#### Notification Endpoints
```python
# backend/app/blueprints/notifications.py
@notification_bp.route('/api/notifications/templates', methods=['GET'])
def get_templates():
    """Get notification templates"""
    pass

@notification_bp.route('/api/notifications/templates', methods=['POST'])
def create_template():
    """Create notification template"""
    pass

@notification_bp.route('/api/notifications/placeholders', methods=['GET'])
def get_placeholders():
    """Get available placeholders"""
    pass
```

### Step 5: Frontend Integration

#### Onboarding Flow
```javascript
// Frontend onboarding flow implementation
const onboardingSteps = [
    'business_info',
    'team_setup', 
    'services_categories',
    'availability',
    'notifications',
    'policies',
    'gift_cards',
    'payment_setup',
    'go_live'
];

// API calls for each step
async function updateOnboardingStep(step, data) {
    const response = await fetch(`/api/onboarding/step/${step}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}
```

#### Booking Flow
```javascript
// Frontend booking flow implementation
async function getAvailableServices(tenantId) {
    const response = await fetch(`/api/booking/services?tenant=${tenantId}`);
    return response.json();
}

async function getAvailability(serviceId, date) {
    const response = await fetch(`/api/booking/availability?service=${serviceId}&date=${date}`);
    return response.json();
}

async function createBookingSession(tenantId) {
    const response = await fetch('/api/booking/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId })
    });
    return response.json();
}
```

#### Admin Dashboard
```javascript
// Frontend admin dashboard implementation
async function getRevenueAnalytics(period) {
    const response = await fetch(`/api/analytics/revenue?period=${period}`);
    return response.json();
}

async function getCustomerAnalytics(period) {
    const response = await fetch(`/api/analytics/customers?period=${period}`);
    return response.json();
}
```

### Step 6: Testing

#### Unit Tests
```python
# backend/tests/test_onboarding.py
def test_onboarding_progress():
    """Test onboarding progress tracking"""
    pass

def test_service_categories():
    """Test service category management"""
    pass

def test_team_member_availability():
    """Test team member availability"""
    pass
```

#### Integration Tests
```python
# backend/tests/test_booking_flow.py
def test_booking_session_creation():
    """Test booking session creation"""
    pass

def test_availability_calculation():
    """Test availability calculation"""
    pass

def test_booking_confirmation():
    """Test booking confirmation"""
    pass
```

#### API Tests
```python
# backend/tests/test_api.py
def test_onboarding_endpoints():
    """Test onboarding API endpoints"""
    pass

def test_booking_flow_endpoints():
    """Test booking flow API endpoints"""
    pass

def test_analytics_endpoints():
    """Test analytics API endpoints"""
    pass
```

### Step 7: Performance Optimization

#### Database Indexes
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_booking_sessions_tenant ON booking_sessions(tenant_id);
CREATE INDEX CONCURRENTLY idx_availability_slots_service_date ON availability_slots(service_id, date);
CREATE INDEX CONCURRENTLY idx_analytics_tenant_date ON revenue_analytics(tenant_id, date);
```

#### Caching
```python
# Add Redis caching for frequently accessed data
from flask_caching import Cache

cache = Cache(app)

@cache.memoize(timeout=300)
def get_availability(tenant_id, service_id, date):
    """Get cached availability data"""
    pass
```

#### Background Tasks
```python
# Add background task processing
from celery import Celery

celery = Celery(app.name, broker=app.config['CELERY_BROKER_URL'])

@celery.task
def process_analytics(tenant_id, date):
    """Process analytics in background"""
    pass

@celery.task
def send_notification(notification_id):
    """Send notification in background"""
    pass
```

### Step 8: Monitoring and Logging

#### Application Monitoring
```python
# Add monitoring and logging
import logging
from flask import request

@app.before_request
def log_request():
    logging.info(f"Request: {request.method} {request.path}")

@app.after_request
def log_response(response):
    logging.info(f"Response: {response.status_code}")
    return response
```

#### Analytics Tracking
```python
# Track user actions for analytics
def track_user_action(tenant_id, user_id, action, data):
    """Track user actions for analytics"""
    pass
```

## Deployment Checklist

### Pre-deployment
- [ ] Run all database migrations
- [ ] Update model imports
- [ ] Implement service layers
- [ ] Create API endpoints
- [ ] Write comprehensive tests
- [ ] Performance testing
- [ ] Security review

### Deployment
- [ ] Deploy database changes
- [ ] Deploy application code
- [ ] Update environment variables
- [ ] Restart application services
- [ ] Verify functionality
- [ ] Monitor performance

### Post-deployment
- [ ] Monitor error logs
- [ ] Check analytics data
- [ ] Verify tenant isolation
- [ ] Test booking flow
- [ ] Validate notifications
- [ ] Performance monitoring

## Troubleshooting

### Common Issues

1. **Database Migration Errors**
   - Check PostgreSQL version compatibility
   - Verify migration order
   - Review constraint conflicts

2. **Model Import Errors**
   - Verify all model files are in correct location
   - Check import statements
   - Ensure all dependencies are installed

3. **API Endpoint Errors**
   - Check route registration
   - Verify request/response formats
   - Review authentication middleware

4. **Performance Issues**
   - Add database indexes
   - Implement caching
   - Optimize queries

### Support

For technical support and questions:
- Review the comprehensive documentation
- Check the database schema
- Examine the model relationships
- Test with sample data

## Conclusion

This implementation guide provides a complete roadmap for implementing the enhanced Tithi backend. Follow the steps in order, test thoroughly, and monitor performance to ensure successful deployment.

The enhanced backend now fully supports:
- Complete onboarding flow
- Advanced booking system
- Comprehensive analytics
- Enhanced notifications
- Full tenant isolation
- Scalable architecture

This provides a solid foundation for the Tithi platform to support unlimited businesses with their booking and management needs.
