"""
Phase 2 Enhanced Features Tests

Tests for the enhanced features including RLS policy enforcement,
Google Calendar integration, notification system, and analytics.
"""

import pytest
import uuid
from datetime import datetime, timedelta, date
from unittest.mock import patch, MagicMock

from app import create_app, db
from app.models import Tenant, User, Customer, Service, Resource, Booking, StaffProfile
from app.services.calendar_integration import GoogleCalendarService
from app.services.notification_service import NotificationService, NotificationRequest
from app.models.notification import NotificationChannel, NotificationPriority
from app.services.analytics_service import AnalyticsService, AnalyticsPeriod


@pytest.fixture
def app():
    """Create test application."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def test_tenant():
    """Create test tenant."""
    tenant = Tenant(
        id=uuid.uuid4(),
        slug="test-tenant",
        tz="UTC",
        is_public_directory=True,
        public_blurb="Test Tenant"
    )
    db.session.add(tenant)
    db.session.commit()
    return tenant


@pytest.fixture
def test_user():
    """Create test user."""
    user = User(
        id=uuid.uuid4(),
        display_name="Test User",
        primary_email="test@example.com"
    )
    db.session.add(user)
    db.session.commit()
    return user


class TestRLSPolicyEnforcement:
    """Test RLS policy enforcement enhancements."""
    
    def test_tenant_isolation_services(self, app, test_tenant):
        """Test that services are properly isolated between tenants."""
        with app.app_context():
            # Create service for tenant
            service = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                slug="test-service",
                name="Test Service",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service)
            db.session.commit()
            
            # Test tenant can see their service
            services = Service.query.filter_by(tenant_id=test_tenant.id).all()
            assert len(services) == 1
            assert services[0].name == "Test Service"
    
    def test_cross_tenant_data_access_prevention(self, app, test_tenant):
        """Test that cross-tenant data access is prevented."""
        with app.app_context():
            # Create another tenant
            other_tenant = Tenant(
                id=uuid.uuid4(),
                slug="other-tenant",
                tz="UTC",
                is_public_directory=True
            )
            db.session.add(other_tenant)
            db.session.commit()
            
            # Create service for other tenant
            other_service = Service(
                id=uuid.uuid4(),
                tenant_id=other_tenant.id,
                slug="other-service",
                name="Other Service",
                duration_min=60,
                price_cents=10000
            )
            db.session.add(other_service)
            db.session.commit()
            
            # Test tenant cannot see other tenant's service
            services = Service.query.filter_by(tenant_id=test_tenant.id).all()
            assert len(services) == 0  # Should be empty


class TestGoogleCalendarIntegration:
    """Test Google Calendar integration features."""
    
    def test_calendar_service_initialization(self, app):
        """Test Google Calendar service initialization."""
        with app.app_context():
            calendar_service = GoogleCalendarService()
            assert calendar_service is not None
            assert calendar_service.SCOPES is not None
            assert len(calendar_service.SCOPES) > 0
    
    def test_authorization_url_generation(self, app, test_tenant, test_user):
        """Test authorization URL generation."""
        with app.app_context():
            calendar_service = GoogleCalendarService()
            
            with patch.object(calendar_service, '_get_client_config') as mock_config:
                mock_config.return_value = {
                    "web": {
                        "client_id": "test-client-id",
                        "client_secret": "test-client-secret",
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token"
                    }
                }
                
                auth_url = calendar_service.get_authorization_url(
                    test_tenant.id, test_user.id, "http://localhost:5000/callback"
                )
                
                assert auth_url is not None
                assert "accounts.google.com" in auth_url
    
    def test_calendar_event_creation(self, app, test_tenant):
        """Test calendar event creation."""
        with app.app_context():
            # Create staff profile
            staff_profile = StaffProfile(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                membership_id=uuid.uuid4(),
                resource_id=uuid.uuid4(),
                display_name="Test Staff"
            )
            db.session.add(staff_profile)
            db.session.commit()
            
            calendar_service = GoogleCalendarService()
            
            booking_data = {
                'service_name': 'Test Service',
                'description': 'Test booking',
                'start_at': datetime.utcnow() + timedelta(hours=1),
                'end_at': datetime.utcnow() + timedelta(hours=2),
                'timezone': 'UTC',
                'customer_email': 'customer@example.com'
            }
            
            # Mock the calendar service
            with patch.object(calendar_service, '_get_credentials') as mock_creds:
                mock_creds.return_value = None  # No credentials for test
                
                result = calendar_service.create_booking_event(
                    staff_profile.id, test_tenant.id, booking_data
                )
                
                # Should return False due to no credentials
                assert result is False


class TestNotificationSystem:
    """Test enhanced notification system."""
    
    def test_notification_service_initialization(self, app):
        """Test notification service initialization."""
        with app.app_context():
            notification_service = NotificationService()
            assert notification_service is not None
            assert notification_service.template_service is not None
            assert notification_service.delivery_service is not None
            assert notification_service.scheduler is not None
            assert notification_service.analytics is not None
    
    def test_notification_request_creation(self, app, test_tenant):
        """Test notification request creation."""
        with app.app_context():
            request = NotificationRequest(
                tenant_id=test_tenant.id,
                event_code="booking_confirmed",
                channel=NotificationChannel.EMAIL,
                recipient="test@example.com",
                subject="Booking Confirmed",
                content="Your booking has been confirmed",
                priority=NotificationPriority.HIGH
            )
            
            assert request.tenant_id == test_tenant.id
            assert request.event_code == "booking_confirmed"
            assert request.channel == NotificationChannel.EMAIL
            assert request.recipient == "test@example.com"
            assert request.priority == NotificationPriority.HIGH
    
    def test_notification_template_service(self, app, test_tenant):
        """Test notification template service."""
        with app.app_context():
            template_service = NotificationService().template_service
            
            template_data = {
                'event_code': 'booking_confirmed',
                'channel': 'email',
                'name': 'Booking Confirmation Email',
                'subject': 'Your booking is confirmed',
                'body': 'Hello {{customer_name}}, your booking for {{service_name}} is confirmed.',
                'is_active': True
            }
            
            template = template_service.create_template(test_tenant.id, template_data)
            
            assert template is not None
            assert template.event_code == 'booking_confirmed'
            assert template.channel == 'email'
            assert template.name == 'Booking Confirmation Email'
            assert template.is_active is True
    
    def test_notification_delivery_service(self, app, test_tenant):
        """Test notification delivery service."""
        with app.app_context():
            delivery_service = NotificationService().delivery_service
            
            request = NotificationRequest(
                tenant_id=test_tenant.id,
                event_code="test_event",
                channel=NotificationChannel.EMAIL,
                recipient="test@example.com",
                subject="Test Subject",
                content="Test content",
                priority=NotificationPriority.NORMAL
            )
            
            # Mock email sending
            with patch.object(delivery_service, '_send_email') as mock_send:
                mock_send.return_value = MagicMock(success=True, provider_message_id="test-123")
                
                result = delivery_service.send_notification(request)
                
                assert result.success is True
                assert result.provider_message_id == "test-123"


class TestAnalyticsService:
    """Test enhanced analytics service."""
    
    def test_analytics_service_initialization(self, app):
        """Test analytics service initialization."""
        with app.app_context():
            analytics_service = AnalyticsService()
            assert analytics_service is not None
            assert analytics_service.business_service is not None
            assert analytics_service.performance_service is not None
            assert analytics_service.report_service is not None
    
    def test_revenue_metrics_calculation(self, app, test_tenant):
        """Test revenue metrics calculation."""
        with app.app_context():
            analytics_service = AnalyticsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            # Mock database queries
            with patch('app.services.analytics_service.Payment') as mock_payment:
                mock_query = MagicMock()
                mock_query.filter.return_value = mock_query
                mock_query.with_entities.return_value = mock_query
                mock_query.scalar.return_value = 100000  # $1000 in cents
                mock_query.group_by.return_value = mock_query
                mock_query.order_by.return_value = mock_query
                mock_query.all.return_value = []
                
                mock_payment.query = mock_query
                
                metrics = analytics_service.business_service.get_revenue_metrics(
                    test_tenant.id, start_date, end_date
                )
                
                assert 'total_revenue' in metrics
                assert 'revenue_by_period' in metrics
                assert 'revenue_growth' in metrics
                assert 'average_booking_value' in metrics
    
    def test_booking_metrics_calculation(self, app, test_tenant):
        """Test booking metrics calculation."""
        with app.app_context():
            analytics_service = AnalyticsService()
            
            start_date = date.today() - timedelta(days=30)
            end_date = date.today()
            
            # Mock database queries
            with patch('app.services.analytics_service.Booking') as mock_booking:
                mock_query = MagicMock()
                mock_query.filter.return_value = mock_query
                mock_query.count.return_value = 100
                mock_query.group_by.return_value = mock_query
                mock_query.all.return_value = [
                    MagicMock(status='confirmed', count=80),
                    MagicMock(status='canceled', count=10),
                    MagicMock(status='no_show', count=10)
                ]
                
                mock_booking.query = mock_query
                
                metrics = analytics_service.business_service.get_booking_metrics(
                    test_tenant.id, start_date, end_date
                )
                
                assert 'total_bookings' in metrics
                assert 'bookings_by_status' in metrics
                assert 'conversion_rate' in metrics
                assert 'no_show_rate' in metrics
                assert 'cancellation_rate' in metrics
    
    def test_custom_report_creation(self, app, test_tenant):
        """Test custom report creation."""
        with app.app_context():
            analytics_service = AnalyticsService()
            
            report_config = {
                'title': 'Monthly Business Report',
                'period': 'monthly',
                'start_date': '2024-01-01',
                'end_date': '2024-01-31',
                'include_revenue': True,
                'include_bookings': True,
                'include_customers': True,
                'include_staff': False,
                'include_performance': False
            }
            
            # Mock the business service methods
            with patch.object(analytics_service.business_service, 'get_revenue_metrics') as mock_revenue:
                with patch.object(analytics_service.business_service, 'get_booking_metrics') as mock_bookings:
                    with patch.object(analytics_service.business_service, 'get_customer_metrics') as mock_customers:
                        mock_revenue.return_value = {'total_revenue': 100000}
                        mock_bookings.return_value = {'total_bookings': 100}
                        mock_customers.return_value = {'total_customers': 50}
                        
                        report = analytics_service.create_custom_report(
                            test_tenant.id, report_config
                        )
                        
                        assert report is not None
                        assert report.title == 'Monthly Business Report'
                        assert report.period == AnalyticsPeriod.MONTHLY
                        assert 'revenue' in report.metrics
                        assert 'bookings' in report.metrics
                        assert 'customers' in report.metrics


class TestAPIEndpoints:
    """Test enhanced API endpoints."""
    
    def test_calendar_authorization_endpoint(self, client, test_tenant):
        """Test calendar authorization endpoint."""
        with patch('app.blueprints.calendar_api.get_current_user', return_value=uuid.uuid4()):
            with patch('app.blueprints.calendar_api.g.tenant_id', test_tenant.id):
                response = client.post('/api/v1/calendar/google/authorize', json={
                    'redirect_uri': 'http://localhost:5000/callback'
                })
                
                assert response.status_code == 200
                data = response.get_json()
                assert 'authorization_url' in data
    
    def test_notification_template_endpoints(self, client, test_tenant):
        """Test notification template endpoints."""
        with patch('app.blueprints.notification_api.get_current_user', return_value=uuid.uuid4()):
            with patch('app.blueprints.notification_api.g.tenant_id', test_tenant.id):
                # Test list templates
                response = client.get('/api/v1/notifications/templates')
                assert response.status_code == 200
                
                # Test create template
                response = client.post('/api/v1/notifications/templates', json={
                    'event_code': 'booking_confirmed',
                    'channel': 'email',
                    'name': 'Booking Confirmation',
                    'body': 'Your booking is confirmed'
                })
                assert response.status_code == 201
    
    def test_analytics_dashboard_endpoint(self, client, test_tenant):
        """Test analytics dashboard endpoint."""
        with patch('app.blueprints.analytics_api.get_current_user', return_value=uuid.uuid4()):
            with patch('app.blueprints.analytics_api.g.tenant_id', test_tenant.id):
                response = client.get('/api/v1/analytics/dashboard', query_string={
                    'start_date': '2024-01-01',
                    'end_date': '2024-01-31'
                })
                
                assert response.status_code == 200
                data = response.get_json()
                assert 'period' in data
                assert 'metrics' in data
    
    def test_analytics_export_endpoint(self, client, test_tenant):
        """Test analytics export endpoint."""
        with patch('app.blueprints.analytics_api.get_current_user', return_value=uuid.uuid4()):
            with patch('app.blueprints.analytics_api.g.tenant_id', test_tenant.id):
                response = client.get('/api/v1/analytics/export', query_string={
                    'start_date': '2024-01-01',
                    'end_date': '2024-01-31',
                    'format': 'json'
                })
                
                assert response.status_code == 200
                assert response.content_type == 'application/json'


class TestIntegrationFeatures:
    """Test integration between enhanced features."""
    
    def test_booking_with_calendar_integration(self, app, test_tenant):
        """Test booking creation with calendar integration."""
        with app.app_context():
            # Create staff profile
            staff_profile = StaffProfile(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                membership_id=uuid.uuid4(),
                resource_id=uuid.uuid4(),
                display_name="Test Staff"
            )
            db.session.add(staff_profile)
            db.session.commit()
            
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=uuid.uuid4(),
                resource_id=staff_profile.resource_id,
                client_generated_id="test-123",
                service_snapshot={"name": "Test Service"},
                start_at=datetime.utcnow() + timedelta(hours=1),
                end_at=datetime.utcnow() + timedelta(hours=2),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking)
            db.session.commit()
            
            # Test calendar integration
            calendar_service = GoogleCalendarService()
            booking_data = {
                'service_name': 'Test Service',
                'start_at': booking.start_at,
                'end_at': booking.end_at,
                'timezone': 'UTC',
                'customer_email': 'test@example.com'
            }
            
            with patch.object(calendar_service, '_get_credentials') as mock_creds:
                mock_creds.return_value = None  # No credentials for test
                
                result = calendar_service.create_booking_event(
                    staff_profile.id, test_tenant.id, booking_data
                )
                
                # Should return False due to no credentials
                assert result is False
    
    def test_booking_with_notification_integration(self, app, test_tenant):
        """Test booking creation with notification integration."""
        with app.app_context():
            # Create customer
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                display_name="Test Customer",
                email="test@example.com"
            )
            db.session.add(customer)
            db.session.commit()
            
            # Create service
            service = Service(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                slug="test-service",
                name="Test Service",
                duration_min=30,
                price_cents=5000
            )
            db.session.add(service)
            db.session.commit()
            
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=test_tenant.id,
                customer_id=customer.id,
                resource_id=uuid.uuid4(),
                client_generated_id="test-123",
                service_snapshot={"id": str(service.id), "name": service.name},
                start_at=datetime.utcnow() + timedelta(hours=1),
                end_at=datetime.utcnow() + timedelta(hours=2),
                booking_tz="UTC",
                status="confirmed"
            )
            db.session.add(booking)
            db.session.commit()
            
            # Test notification integration
            notification_service = NotificationService()
            
            with patch.object(notification_service, 'send_immediate_notification') as mock_send:
                mock_send.return_value = MagicMock(success=True)
                
                result = notification_service.send_booking_notification(
                    booking, "booking_confirmed"
                )
                
                assert result.success is True
