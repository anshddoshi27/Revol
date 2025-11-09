# Tithi Backend Architecture Map

## Overview
This document provides a comprehensive architectural map of the Tithi backend system, detailing file-by-file connections, dependencies, and request flows to enable accurate frontend development.

## 1. File Summary Index

### Core Application Files
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/app/__init__.py` | Application factory | `create_app()` | config, extensions, middleware, blueprints |
| `backend/app/config.py` | Configuration management | `Config`, `DevelopmentConfig`, `ProductionConfig` | os, environment variables |
| `backend/app/extensions.py` | Flask extensions initialization | `db`, `migrate`, `cors`, `redis_client`, `celery` | flask_sqlalchemy, flask_migrate, redis, celery |
| `backend/app/exceptions.py` | Custom exception classes | `TithiError`, `ValidationError`, `AuthenticationError` | Base Exception classes |

### Blueprint Files (API Routes)
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/app/blueprints/api_v1.py` | Core authenticated API endpoints | `api_v1_bp` | services, middleware, models |
| `backend/app/blueprints/public.py` | Public endpoints (no auth) | `public_bp` | middleware |
| `backend/app/blueprints/health.py` | Health check endpoints | `health_bp` | extensions, services |
| `backend/app/blueprints/payment_api.py` | Payment processing | `payment_bp` | financial services, stripe |
| `backend/app/blueprints/onboarding.py` | Tenant onboarding | `onboarding_bp` | core services |
| `backend/app/blueprints/analytics_api.py` | Analytics and reporting | `analytics_bp` | analytics services |
| `backend/app/blueprints/notification_api.py` | Notification system | `notification_bp` | notification services |
| `backend/app/blueprints/crm_api.py` | Customer relationship management | `crm_bp` | crm services |
| `backend/app/blueprints/admin_dashboard_api.py` | Admin dashboard | `admin_bp` | admin services |
| `backend/app/blueprints/loyalty_api.py` | Loyalty program | `loyalty_bp` | loyalty services |
| `backend/app/blueprints/email_api.py` | Email management | `email_bp` | email services |
| `backend/app/blueprints/sms_api.py` | SMS management | `sms_bp` | sms services |
| `backend/app/blueprints/automation_api.py` | Business automation | `automation_bp` | automation services |
| `backend/app/blueprints/timezone_api.py` | Timezone handling | `timezone_bp` | timezone services |
| `backend/app/blueprints/idempotency_api.py` | Idempotency management | `idempotency_bp` | idempotency services |
| `backend/app/blueprints/calendar_api.py` | Calendar integration | `calendar_bp` | calendar services |
| `backend/app/blueprints/promotion_api.py` | Promotions and coupons | `promotion_bp` | promotion services |
| `backend/app/blueprints/monitoring_api.py` | System monitoring | `monitoring_bp` | monitoring services |
| `backend/app/blueprints/deployment_api.py` | Deployment management | `deployment_bp` | deployment services |

### Model Files (Database Layer)
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/app/models/__init__.py` | Model exports | All model classes | Individual model files |
| `backend/app/models/base.py` | Base model classes | `BaseModel`, `TenantModel`, `GlobalModel` | extensions, sqlalchemy |
| `backend/app/models/core.py` | Core entities | `Tenant`, `User`, `Membership` | base models, sqlalchemy |
| `backend/app/models/business.py` | Business entities | `Customer`, `Service`, `Resource`, `Booking`, `StaffProfile` | core models |
| `backend/app/models/financial.py` | Financial entities | `Payment`, `Invoice`, `Refund`, `PaymentMethod` | business models |
| `backend/app/models/system.py` | System entities | `Theme`, `Branding` | core models |
| `backend/app/models/analytics.py` | Analytics entities | `Event`, `Metric` | core models |
| `backend/app/models/crm.py` | CRM entities | `CustomerNote`, `LoyaltyAccount`, `CustomerSegment` | business models |
| `backend/app/models/automation.py` | Automation entities | `Automation`, `AutomationExecution` | core models |
| `backend/app/models/notification.py` | Notification entities | `Notification`, `NotificationTemplate`, `NotificationQueue` | core models |
| `backend/app/models/availability.py` | Availability entities | `AvailabilityRule`, `AvailabilityException` | business models |
| `backend/app/models/promotions.py` | Promotion entities | `Coupon`, `GiftCard`, `Referral` | core models |
| `backend/app/models/usage.py` | Usage tracking | `UsageCounter`, `Quota` | core models |
| `backend/app/models/audit.py` | Audit entities | `AuditLog`, `EventOutbox`, `WebhookEventInbox` | core models |
| `backend/app/models/oauth.py` | OAuth entities | `OAuthProvider` | core models |
| `backend/app/models/idempotency.py` | Idempotency entities | `IdempotencyKey` | core models |
| `backend/app/models/feature_flag.py` | Feature flags | `FeatureFlag` | core models |
| `backend/app/models/deployment.py` | Deployment entities | `Deployment` | core models |

### Service Files (Business Logic Layer)
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/app/services/__init__.py` | Service exports | All service classes | Individual service files |
| `backend/app/services/core.py` | Core business logic | `TenantService`, `UserService` | models, extensions |
| `backend/app/services/business_phase2.py` | Phase 2 business logic | `ServiceService`, `BookingService`, `CustomerService` | business models, cache |
| `backend/app/services/financial.py` | Financial logic | `PaymentService`, `InvoiceService` | financial models, stripe |
| `backend/app/services/system.py` | System logic | `ThemeService`, `BrandingService` | system models |
| `backend/app/services/analytics.py` | Analytics logic | `AnalyticsService` | analytics models |
| `backend/app/services/crm.py` | CRM logic | `CRMService` | crm models |
| `backend/app/services/automation.py` | Automation logic | `AutomationService` | automation models |
| `backend/app/services/notification.py` | Notification logic | `NotificationService` | notification models |
| `backend/app/services/email.py` | Email logic | `EmailService` | sendgrid, notification |
| `backend/app/services/sms.py` | SMS logic | `SMSService` | twilio, notification |
| `backend/app/services/loyalty.py` | Loyalty logic | `LoyaltyService` | crm models |
| `backend/app/services/promotion.py` | Promotion logic | `PromotionService` | promotion models |
| `backend/app/services/timezone.py` | Timezone logic | `TimezoneService` | pytz |
| `backend/app/services/idempotency.py` | Idempotency logic | `IdempotencyService` | idempotency models |
| `backend/app/services/calendar.py` | Calendar logic | `CalendarService` | external APIs |
| `backend/app/services/monitoring.py` | Monitoring logic | `MonitoringService` | metrics |
| `backend/app/services/deployment.py` | Deployment logic | `DeploymentService` | deployment models |
| `backend/app/services/cache.py` | Caching logic | `AvailabilityCacheService` | redis |
| `backend/app/services/alerting.py` | Alerting logic | `AlertingService` | slack, email |
| `backend/app/services/backup.py` | Backup logic | `BackupService` | database |
| `backend/app/services/compliance.py` | Compliance logic | `ComplianceService` | audit models |
| `backend/app/services/encryption.py` | Encryption logic | `EncryptionService` | cryptography |
| `backend/app/services/feature_flag.py` | Feature flag logic | `FeatureFlagService` | feature flag models |
| `backend/app/services/performance_monitoring.py` | Performance monitoring | `PerformanceMonitoringService` | metrics |
| `backend/app/services/quota.py` | Quota management | `QuotaService` | usage models |
| `backend/app/services/scheduler.py` | Scheduling logic | `SchedulerService` | celery |
| `backend/app/services/business.py` | Business logic wrapper | Re-exports from business_phase2 | business_phase2 services |
| `backend/app/services/audit.py` | Audit logic | `AuditService` | audit models |

### Middleware Files (Request Processing)
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/app/middleware/__init__.py` | Middleware exports | All middleware classes | Individual middleware files |
| `backend/app/middleware/tenant_middleware.py` | Tenant resolution | `TenantMiddleware` | flask, tenant resolution |
| `backend/app/middleware/auth_middleware.py` | Authentication | `AuthMiddleware`, `require_auth` | jwt, supabase |
| `backend/app/middleware/error_handler.py` | Error handling | `TithiError`, `register_error_handlers` | flask, sentry |
| `backend/app/middleware/logging_middleware.py` | Request logging | `LoggingMiddleware` | flask, logging |
| `backend/app/middleware/rate_limit_middleware.py` | Rate limiting | `RateLimitMiddleware` | flask_limiter |
| `backend/app/middleware/idempotency.py` | Idempotency | `idempotency_middleware` | idempotency service |
| `backend/app/middleware/sentry_middleware.py` | Sentry integration | `init_sentry`, `capture_exception` | sentry_sdk |
| `backend/app/middleware/metrics_middleware.py` | Metrics collection | `MetricsMiddleware` | prometheus |
| `backend/app/middleware/enhanced_logging_middleware.py` | Enhanced logging | `EnhancedLoggingMiddleware` | structured logging |
| `backend/app/middleware/audit_middleware.py` | Audit logging | `AuditMiddleware` | audit models |
| `backend/app/middleware/encryption_middleware.py` | Encryption | `EncryptionMiddleware` | encryption service |
| `backend/app/middleware/feature_flag_middleware.py` | Feature flags | `FeatureFlagMiddleware` | feature flag service |
| `backend/app/middleware/jwt_rotation_middleware.py` | JWT rotation | `JWTRotationMiddleware` | jwt |

### Job Files (Background Tasks)
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/app/jobs/automation_worker.py` | Automation tasks | `AutomationWorker` | celery, automation service |
| `backend/app/jobs/backup_jobs.py` | Backup tasks | `BackupJobs` | celery, backup service |
| `backend/app/jobs/compliance_jobs.py` | Compliance tasks | `ComplianceJobs` | celery, compliance service |
| `backend/app/jobs/email_worker.py` | Email tasks | `EmailWorker` | celery, email service |
| `backend/app/jobs/outbox_worker.py` | Outbox processing | `OutboxWorker` | celery, audit models |
| `backend/app/jobs/webhook_inbox_worker.py` | Webhook processing | `WebhookInboxWorker` | celery, webhook models |

### Configuration and Deployment Files
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/requirements.txt` | Python dependencies | Package versions | pip |
| `backend/alembic.ini` | Database migration config | Alembic configuration | alembic |
| `backend/Dockerfile` | Container configuration | Docker build instructions | docker |
| `docker-compose.yml` | Multi-service orchestration | Service definitions | docker-compose |
| `backend/migrations/env.py` | Migration environment | Alembic environment setup | alembic |
| `backend/migrations/script.py.mako` | Migration template | Migration file template | alembic |

### Test Files
| File Path | Purpose | Key Exports | Dependencies |
|-----------|---------|-------------|--------------|
| `backend/tests/` | Test suite directory | Test modules | pytest |
| `backend/tests/phase2/` | Phase 2 tests | Business logic tests | pytest |
| `backend/tests/phase4/` | Phase 4 tests | Production readiness tests | pytest |
| `backend/test_*.py` | Root level tests | Integration tests | pytest |

## 2. File Connection Map (Detailed Architecture)

### Request Flow Architecture

The Tithi backend follows a layered architecture where requests flow through middleware, routes, services, and models in a specific order. Here's the complete file-to-file connection map:

```
📁 Tithi Backend Architecture
│
├── 🚀 Entry Point
│   └── app/__init__.py (Flask App Factory)
│       ├── imports: config.py, extensions.py
│       ├── registers: middleware stack
│       ├── registers: blueprint collection
│       └── initializes: database, Redis, Celery
│
├── ⚙️ Configuration Layer
│   ├── app/config.py (Environment Configs)
│   │   ├── DevelopmentConfig, TestingConfig, ProductionConfig
│   │   ├── Database URLs, Redis URLs, Stripe Keys
│   │   └── External Service Configurations
│   └── app/extensions.py (Flask Extensions)
│       ├── SQLAlchemy (db), Migrate, CORS
│       ├── Redis client, Celery instance
│       └── Observability middleware
│
├── 🛡️ Middleware Stack (Request Processing Order)
│   ├── 1. LoggingMiddleware (Request logging)
│   ├── 2. TenantMiddleware (Tenant resolution)
│   │   ├── Path-based: /v1/b/{slug}
│   │   ├── Host-based: subdomain.tithi.com
│   │   └── Sets: g.tenant_id
│   ├── 3. RateLimitMiddleware (Rate limiting)
│   ├── 4. AuthMiddleware (JWT Authentication)
│   │   ├── Validates: Supabase JWT tokens
│   │   ├── Extracts: user_id, tenant_id, user_role
│   │   └── Sets: g.user_id, g.tenant_id, g.user_email
│   ├── 5. IdempotencyMiddleware (Request deduplication)
│   └── 6. ErrorHandler (Global error handling)
│
├── 🛣️ Route Layer (Blueprints)
│   ├── /health/* → health.py
│   │   ├── Basic health checks
│   │   ├── Comprehensive readiness checks
│   │   └── External service monitoring
│   │
│   ├── /api/v1/* → api_v1.py (Core Business API)
│   │   ├── /tenants → TenantService
│   │   ├── /services → ServiceService
│   │   ├── /bookings → BookingService
│   │   ├── /staff → StaffService
│   │   └── /availability → AvailabilityService
│   │
│   ├── /onboarding/* → onboarding.py
│   │   ├── /register → TenantService + ThemeService
│   │   └── /check-subdomain → Tenant validation
│   │
│   ├── /v1/* → public.py (Public endpoints)
│   │   ├── /{slug} → Public tenant pages
│   │   └── /{slug}/services → Public service listings
│   │
│   ├── /api/payments/* → payment_api.py
│   │   ├── PaymentService, BillingService
│   │   ├── Stripe integration
│   │   └── Webhook processing
│   │
│   ├── /api/v1/calendar/* → calendar_api.py
│   │   ├── GoogleCalendarService
│   │   └── CalendarConflictResolver
│   │
│   ├── /api/v1/notifications/* → notification_api.py
│   │   ├── NotificationService
│   │   ├── NotificationTemplateService
│   │   └── NotificationPreferenceService
│   │
│   ├── /api/v1/analytics/* → analytics_api.py
│   │   ├── AnalyticsService
│   │   └── Business metrics & reporting
│   │
│   └── Additional Blueprints:
│       ├── crm_api.py, admin_dashboard_api.py
│       ├── loyalty_api.py, email_api.py
│       ├── sms_api.py, automation_api.py
│       └── timezone_api.py, idempotency_api.py
│
├── 🔧 Services Layer (Business Logic)
│   ├── Core Services
│   │   ├── core.py
│   │   │   ├── TenantService → Tenant model
│   │   │   └── UserService → User model
│   │   │
│   │   └── business_phase2.py (Main Business Logic)
│   │       ├── ServiceService → Service model
│   │       ├── BookingService → Booking model
│   │       ├── CustomerService → Customer model
│   │       ├── StaffService → StaffProfile model
│   │       ├── AvailabilityService → AvailabilityCache model
│   │       └── StaffAvailabilityService → StaffAvailability model
│   │
│   ├── Financial Services
│   │   ├── financial.py
│   │   │   ├── PaymentService → Payment model
│   │   │   └── BillingService → Billing model
│   │   │
│   │   └── promotion.py
│   │       └── PromotionService → Promotion model
│   │
│   ├── System Services
│   │   ├── system.py
│   │   │   └── ThemeService → Theme model
│   │   │
│   │   ├── notification.py
│   │   │   ├── NotificationService → Notification model
│   │   │   └── NotificationTemplateService → NotificationTemplate model
│   │   │
│   │   ├── analytics_service.py
│   │   │   └── AnalyticsService → Analytics models
│   │   │
│   │   └── calendar_integration.py
│   │       ├── GoogleCalendarService → OAuthProvider model
│   │       └── CalendarConflictResolver
│   │
│   └── Utility Services
│       ├── cache.py (Redis caching)
│       ├── email_service.py (SendGrid integration)
│       ├── sms_service.py (Twilio integration)
│       ├── automation_service.py (Workflow automation)
│       ├── loyalty_service.py (Loyalty programs)
│       ├── audit_service.py (Audit logging)
│       ├── alerting_service.py (Monitoring alerts)
│       └── idempotency.py (Request deduplication)
│
├── 🗄️ Models Layer (Data Access)
│   ├── Base Models
│   │   ├── base.py
│   │   │   ├── BaseModel (id, created_at, updated_at)
│   │   │   ├── GlobalModel (cross-tenant entities)
│   │   │   └── TenantModel (tenant-scoped entities)
│   │   │
│   │   └── core.py
│   │       ├── Tenant → tenants table
│   │       ├── User → users table
│   │       └── Membership → memberships table
│   │
│   ├── Business Models
│   │   └── business.py
│   │       ├── Customer → customers table
│   │       ├── Service → services table
│   │       ├── Resource → resources table
│   │       ├── Booking → bookings table
│   │       ├── BookingItem → booking_items table
│   │       ├── StaffProfile → staff_profiles table
│   │       ├── WorkSchedule → work_schedules table
│   │       ├── StaffAvailability → staff_availability table
│   │       ├── BookingHold → booking_holds table
│   │       └── WaitlistEntry → waitlist_entries table
│   │
│   ├── Financial Models
│   │   └── financial.py
│   │       ├── Payment → payments table
│   │       ├── PaymentMethod → payment_methods table
│   │       ├── Billing → billing table
│   │       └── Refund → refunds table
│   │
│   ├── System Models
│   │   ├── system.py
│   │   │   ├── Theme → themes table
│   │   │   └── Branding → branding table
│   │   │
│   │   ├── notification.py
│   │   │   ├── Notification → notifications table
│   │   │   └── NotificationTemplate → notification_templates table
│   │   │
│   │   ├── analytics.py
│   │   │   └── AnalyticsEvent → analytics_events table
│   │   │
│   │   ├── oauth.py
│   │   │   └── OAuthProvider → oauth_providers table
│   │   │
│   │   └── audit.py
│   │       ├── AuditLog → audit_logs table
│   │       └── EventOutbox → event_outbox table
│   │
│   └── Specialized Models
│       ├── promotions.py → promotions table
│       ├── loyalty.py → loyalty_accounts table
│       ├── automation.py → automations table
│       ├── crm.py → customer_segments table
│       ├── feature_flag.py → feature_flags table
│       ├── idempotency.py → idempotency_keys table
│       └── usage.py → usage_quotas table
│
└── 🗃️ Database Layer (PostgreSQL Schema)
    ├── Core Tables
    │   ├── tenants (id, slug, tz, trust_copy_json, billing_json)
    │   ├── users (id, display_name, primary_email, avatar_url)
    │   └── memberships (tenant_id, user_id, role, permissions_json)
    │
    ├── Business Tables
    │   ├── customers (tenant_id, display_name, email, phone)
    │   ├── services (tenant_id, name, duration_min, price_cents)
    │   ├── resources (tenant_id, type, tz, capacity, metadata_json)
    │   ├── bookings (tenant_id, customer_id, resource_id, start_at, end_at)
    │   ├── staff_profiles (tenant_id, membership_id, resource_id)
    │   ├── work_schedules (tenant_id, staff_profile_id, schedule_type)
    │   └── staff_availability (tenant_id, staff_profile_id, weekday)
    │
    ├── Financial Tables
    │   ├── payments (tenant_id, booking_id, amount_cents, status)
    │   ├── payment_methods (tenant_id, customer_id, provider_payment_method_id)
    │   └── refunds (tenant_id, payment_id, amount_cents, reason)
    │
    ├── System Tables
    │   ├── themes (tenant_id, brand_color, theme_json)
    │   ├── notifications (tenant_id, channel, recipient_type, content)
    │   ├── oauth_providers (tenant_id, provider, access_token)
    │   └── audit_logs (tenant_id, user_id, action, resource_type)
    │
    └── Database Features
        ├── Row Level Security (RLS) policies
        ├── Triggers for updated_at timestamps
        ├── Functions for booking status sync
        ├── Materialized views for analytics
        └── Indexes for performance optimization
```

### Key Architectural Patterns

#### 1. **Multi-Tenant Architecture**
- **Tenant Resolution**: Path-based (`/v1/b/{slug}`) and host-based (`subdomain.tithi.com`)
- **Row Level Security**: Database-level tenant isolation
- **Context Propagation**: `g.tenant_id` flows through all layers

#### 2. **Service Layer Pattern**
- **Business Logic**: Encapsulated in service classes
- **Model Abstraction**: Services interact with models, not direct DB
- **Validation**: Centralized validation in service layer
- **Error Handling**: Structured error propagation

#### 3. **Middleware Stack**
- **Order Matters**: Logging → Tenant → Rate Limit → Auth → Idempotency
- **Context Setting**: Each middleware adds to Flask's `g` object
- **Early Returns**: Public endpoints skip authentication

#### 4. **Database Design**
- **Soft Deletes**: `deleted_at` columns for data retention
- **Audit Trail**: Comprehensive audit logging
- **Triggers**: Automated timestamp updates and status sync
- **Materialized Views**: Pre-computed analytics data

### Request Flow Examples

#### 1. Tenant Onboarding Flow
```
POST /onboarding/register
├── AuthMiddleware: Validates JWT token
├── TenantMiddleware: Resolves tenant context
├── onboarding.py: register_business()
├── TenantService: create_tenant()
├── ThemeService: create_default_theme()
├── Tenant Model: INSERT INTO tenants
├── Membership Model: INSERT INTO memberships
└── Response: Tenant + subdomain + default setup
```

#### 2. Service Management Flow
```
POST /api/v1/services
├── AuthMiddleware: Validates JWT + sets g.user_id
├── TenantMiddleware: Sets g.tenant_id
├── api_v1.py: create_service()
├── ServiceService: create_service()
├── Service Model: INSERT INTO services
├── AuditLog: Logs service creation
└── Response: Created service details
```

#### 3. Booking Creation Flow
```
POST /api/v1/bookings
├── AuthMiddleware: Validates JWT + sets g.user_id
├── TenantMiddleware: Sets g.tenant_id
├── api_v1.py: create_booking()
├── BookingService: create_booking()
├── AvailabilityService: Check availability
├── Booking Model: INSERT INTO bookings
├── BookingItem Model: INSERT INTO booking_items
├── NotificationService: Send confirmation
└── Response: Booking details + confirmation
```

#### 4. Payment Processing Flow
```
POST /api/payments/intents
├── AuthMiddleware: Validates JWT + sets g.user_id
├── TenantMiddleware: Sets g.tenant_id
├── payment_api.py: create_payment_intent()
├── PaymentService: create_payment_intent()
├── Stripe API: Create payment intent
├── Payment Model: INSERT INTO payments
├── WebhookEventInbox: Queue webhook processing
└── Response: Payment intent + client_secret
```

### Frontend Integration Points

#### 1. **Authentication Flow**
- Frontend sends JWT tokens in `Authorization: Bearer <token>` header
- Backend validates via Supabase JWT validation
- User context available in all authenticated endpoints

#### 2. **Tenant Context**
- Frontend can use either path-based (`/v1/b/salon-slug`) or host-based (`salon-slug.tithi.com`) routing
- Backend automatically resolves tenant from request
- All business operations are tenant-scoped

#### 3. **API Endpoints**
- **Core Business**: `/api/v1/*` for authenticated operations
- **Public**: `/v1/*` for public tenant pages
- **Specialized**: `/api/payments/*`, `/api/v1/calendar/*`, etc.
- **Health**: `/health/*` for monitoring

#### 4. **Data Models**
- **Tenant**: Business information, branding, policies
- **Services**: Service catalog with pricing and duration
- **Bookings**: Appointment management with status tracking
- **Customers**: Customer profiles with preferences
- **Staff**: Staff profiles with availability and schedules
- **Payments**: Payment processing with Stripe integration

## 3. Database Migration Files (39 migrations)
| Migration File | Purpose | Key Changes | Backend Files |
|----------------|---------|-------------|---------------|
| `0001_extensions.sql` | PostgreSQL extensions | Enable required extensions | All models |
| `0002_types.sql` | Custom types | Define enums and types | All models |
| `0003_helpers.sql` | Helper functions | Database utility functions | All models |
| `0004_core_tenancy.sql` | Core tenancy | tenants, users, memberships | models/core.py |
| `0005_customers_resources.sql` | Customer/Resource tables | customers, resources tables | models/business.py |
| `0006_services.sql` | Service catalog | services, service_resources | models/business.py |
| `0007_availability.sql` | Availability system | availability_rules, availability_exceptions | models/availability.py |
| `0008_bookings.sql` | Booking system | bookings, booking_items | models/business.py |
| `0009_payments_billing.sql` | Payment system | payments, invoices, refunds | models/financial.py |
| `0010_promotions.sql` | Promotion system | coupons, gift_cards, referrals | models/promotions.py |
| `0011_notifications.sql` | Notification system | notifications, notification_templates | models/notification.py |
| `0012_usage_quotas.sql` | Usage tracking | usage_counters, quotas | models/usage.py |
| `0013_audit_logs.sql` | Audit system | audit_logs, event_outbox | models/audit.py |
| `0014_enable_rls.sql` | Row Level Security | Enable RLS policies | All tenant-scoped models |
| `0015_policies_standard.sql` | Standard RLS policies | Basic tenant isolation | All tenant-scoped models |
| `0016_policies_special.sql` | Special RLS policies | Complex access patterns | All tenant-scoped models |
| `0017_indexes.sql` | Database indexes | Performance optimization | All models |
| `0018_seed_dev.sql` | Development data | Seed data for development | All models |
| `0025_phase2_staff_enums_and_missing_tables.sql` | Staff system | staff_profiles, work_schedules | models/business.py |
| `0027_phase2_rls_policies.sql` | Staff RLS policies | Staff-specific access control | models/business.py |
| `0028_staff_assignment_shift_scheduling.sql` | Staff scheduling | Staff availability, assignments | models/business.py |
| `0032_automation_tables.sql` | Automation system | automations, automation_executions | models/automation.py |
| `0032_crm_tables.sql` | CRM system | customer_notes, loyalty_accounts | models/crm.py |
| `0032_idempotency_keys.sql` | Idempotency system | idempotency_keys table | models/idempotency.py |
| `0032_staff_availability.sql` | Staff availability | staff_availability table | models/business.py |
| `0033_enhanced_notification_system.sql` | Enhanced notifications | notification_queue, preferences | models/notification.py |
| `0034_offline_booking_idempotency.sql` | Offline booking support | Booking idempotency | models/business.py |
| `0035_analytics_materialized_views.sql` | Analytics views | Materialized views for analytics | models/analytics.py |
| `0036_critical_security_hardening.sql` | Security hardening | Enhanced RLS, security functions | All models |

## 4. Request Lifecycle Traces (Module 3)

Now let me trace the complete request lifecycles for all major domains of the Tithi application, showing how requests flow through middleware → controller → service → model → database → response.

### 1. Authentication & Tenant Context Flow

#### JWT Authentication Flow
```
POST /api/v1/auth/login
├── middleware/auth_middleware.py
│   ├── _extract_token() → Extract Bearer token from Authorization header
│   ├── _validate_token() → Decode JWT with Supabase secret
│   ├── Extract: g.user_id, g.tenant_id, g.user_email, g.user_role
│   └── Log authentication success
├── blueprints/api_v1.py
│   └── list_tenants() → Get user's tenant memberships
├── services/core.py
│   └── TenantService.get_user_tenants()
├── models/core.py
│   ├── User.query.filter_by(id=g.user_id)
│   └── Membership.query.filter_by(user_id=g.user_id)
└── Response: {"tenants": [...], "user_context": {...}}
```

#### Tenant Resolution Flow
```
GET /v1/b/salon-slug/services
├── middleware/tenant_middleware.py
│   ├── _resolve_from_path() → Extract slug from /v1/b/{slug}
│   ├── _get_tenant_id_by_slug() → Query tenants table
│   └── Set g.tenant_id
├── middleware/auth_middleware.py
│   └── Skip authentication (public endpoint)
├── blueprints/public.py
│   └── get_tenant_public_services()
├── models/business.py
│   └── Service.query.filter_by(tenant_id=g.tenant_id, active=True)
└── Response: {"services": [...], "tenant_info": {...}}
```

### 2. Onboarding Flow (Tenant Creation, Owner Setup, Stripe Connect)

#### Business Registration Flow
```
POST /onboarding/register
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   ├── Extract user context: g.user_id, g.user_email
│   └── Set authentication context
├── blueprints/onboarding.py
│   ├── register_business()
│   ├── Validate: business_name, owner_email, owner_name
│   ├── generate_subdomain() → Convert business name to slug
│   └── ensure_unique_subdomain() → Check uniqueness, append numbers if needed
├── services/core.py
│   └── TenantService.create_tenant()
│       ├── Validate tenant data
│       ├── Create Tenant model
│       └── Create Membership (owner role)
├── models/core.py
│   ├── INSERT INTO tenants (id, name, slug, email, tz, billing_json)
│   └── INSERT INTO memberships (tenant_id, user_id, role)
├── services/system.py
│   └── ThemeService.create_default_theme()
├── models/system.py
│   └── INSERT INTO themes (tenant_id, brand_color, theme_json)
├── create_default_policies()
│   ├── Update tenant.trust_copy_json
│   ├── Update tenant.billing_json
│   └── Set default_no_show_fee_percent
├── EventOutbox
│   └── INSERT INTO event_outbox (TENANT_ONBOARDED event)
└── Response: {"id": "...", "subdomain": "salon-slug.tithi.com", "status": "active"}
```

#### Subdomain Availability Check Flow
```
GET /onboarding/check-subdomain/salon-slug
├── middleware/auth_middleware.py
│   └── Validate JWT token
├── blueprints/onboarding.py
│   ├── check_subdomain_availability()
│   ├── Validate subdomain format (regex)
│   └── Check length constraints
├── models/core.py
│   └── Tenant.query.filter_by(slug=subdomain, deleted_at=None)
└── Response: {"subdomain": "salon-slug", "available": true, "suggested_url": "salon-slug.tithi.com"}
```

### 3. Bookings Flow (Service Selection, Availability Check, Booking Lifecycle)

#### Service Selection Flow
```
GET /api/v1/services
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/api_v1.py
│   └── list_services()
├── services/business_phase2.py
│   └── ServiceService.get_services()
├── models/business.py
│   └── Service.query.filter_by(tenant_id=g.tenant_id, active=True)
└── Response: {"services": [{"id": "...", "name": "...", "price_cents": 5000}]}
```

#### Availability Check Flow
```
GET /api/v1/availability/{resource_id}/slots?start_date=2024-01-01&end_date=2024-01-07
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/api_v1.py
│   ├── get_availability_slots()
│   ├── Parse start_date, end_date parameters
│   └── Validate date format
├── services/business_phase2.py
│   └── AvailabilityService.get_available_slots()
│       ├── Get resource availability rules
│       ├── Get staff availability
│       ├── Check existing bookings for conflicts
│       └── Calculate available time slots
├── services/cache.py
│   └── AvailabilityCacheService.get_cached_slots()
├── models/business.py
│   ├── AvailabilityRule.query.filter_by(resource_id=resource_id)
│   ├── StaffAvailability.query.filter_by(staff_profile_id=staff_id)
│   └── Booking.query.filter_by(resource_id=resource_id, status='confirmed')
└── Response: {"resource_id": "...", "slots": [{"start": "...", "end": "...", "available": true}]}
```

#### Booking Creation Flow
```
POST /api/v1/bookings
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── middleware/idempotency.py
│   ├── Check idempotency key
│   └── Prevent duplicate requests
├── blueprints/api_v1.py
│   ├── create_booking()
│   ├── Validate request body
│   └── Extract booking data
├── services/business_phase2.py
│   └── BookingService.create_booking()
│       ├── Validate booking data
│       ├── Check availability conflicts
│       ├── Calculate total amount
│       └── Create booking record
├── models/business.py
│   ├── INSERT INTO bookings (id, tenant_id, customer_id, resource_id, start_at, end_at, status)
│   └── INSERT INTO booking_items (booking_id, service_id, resource_id)
├── services/financial.py
│   └── PaymentService.create_payment_intent()
├── models/financial.py
│   └── INSERT INTO payments (id, tenant_id, booking_id, amount_cents, status)
├── EventOutbox
│   └── INSERT INTO event_outbox (BOOKING_CREATED event)
├── jobs/email_worker.py
│   └── send_booking_confirmation.delay()
└── Response: {"id": "...", "status": "pending", "payment_intent_id": "..."}
```

#### Booking Confirmation Flow
```
POST /api/v1/bookings/{booking_id}/confirm
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/api_v1.py
│   └── confirm_booking()
├── services/business_phase2.py
│   └── BookingService.confirm_booking()
│       ├── Validate booking exists and belongs to tenant
│       ├── Check booking status (must be 'pending')
│       ├── Update booking status to 'confirmed'
│       └── Update payment status
├── models/business.py
│   └── UPDATE bookings SET status='confirmed' WHERE id=booking_id
├── models/financial.py
│   └── UPDATE payments SET status='captured' WHERE booking_id=booking_id
├── EventOutbox
│   └── INSERT INTO event_outbox (BOOKING_CONFIRMED event)
├── jobs/email_worker.py
│   └── send_booking_confirmed.delay()
└── Response: {"message": "Booking confirmed successfully", "booking_id": "..."}
```

### 4. Payments Flow (Stripe Checkout, Pay-by-Cash, No-Show Resolution)

#### Stripe Checkout Flow
```
POST /api/payments/checkout
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── middleware/idempotency.py
│   ├── Check idempotency key
│   └── Prevent duplicate payment requests
├── blueprints/payment_api.py
│   ├── create_checkout()
│   ├── Validate: booking_id, payment_method
│   └── Generate idempotency key
├── services/financial.py
│   └── PaymentService.create_payment_intent()
│       ├── Validate booking exists and belongs to tenant
│       ├── Check booking status (must be 'pending' or 'confirmed')
│       ├── Calculate total amount from booking
│       └── Create Stripe PaymentIntent
├── External: Stripe API
│   ├── POST /v1/payment_intents
│   ├── Set metadata: tenant_id, booking_id
│   └── Return client_secret
├── models/financial.py
│   └── INSERT INTO payments (id, tenant_id, booking_id, amount_cents, provider_payment_id, status)
├── EventOutbox
│   └── INSERT INTO event_outbox (PAYMENT_INTENT_CREATED event)
└── Response: {"payment_intent_id": "...", "client_secret": "...", "amount_cents": 5000}
```

#### Payment Confirmation Flow
```
POST /api/payments/intent/{payment_id}/confirm
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/payment_api.py
│   └── confirm_payment_intent()
├── services/financial.py
│   └── PaymentService.confirm_payment_intent()
│       ├── Retrieve payment record
│       ├── Get Stripe PaymentIntent
│       ├── Update payment status based on Stripe status
│       └── Update booking status if payment successful
├── External: Stripe API
│   └── GET /v1/payment_intents/{payment_intent_id}
├── models/financial.py
│   └── UPDATE payments SET status='captured' WHERE id=payment_id
├── models/business.py
│   └── UPDATE bookings SET status='confirmed' WHERE id=booking_id
├── EventOutbox
│   └── INSERT INTO event_outbox (PAYMENT_CAPTURED event)
├── jobs/email_worker.py
│   └── send_payment_receipt.delay()
└── Response: {"id": "...", "status": "captured", "booking_id": "..."}
```

#### No-Show Fee Capture Flow
```
POST /api/payments/no-show-fee
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/payment_api.py
│   ├── capture_no_show_fee()
│   ├── Validate: booking_id, no_show_fee_cents
│   └── Check booking status (must be 'no_show')
├── services/financial.py
│   └── PaymentService.capture_no_show_fee()
│       ├── Get customer's default payment method
│       ├── Create Stripe charge using stored payment method
│       ├── Update booking status to 'no_show_fee_charged'
│       └── Create payment record
├── External: Stripe API
│   ├── POST /v1/charges
│   └── Use customer's default payment method
├── models/financial.py
│   └── INSERT INTO payments (id, tenant_id, booking_id, amount_cents, fee_type='no_show_fee')
├── models/business.py
│   └── UPDATE bookings SET status='no_show_fee_charged' WHERE id=booking_id
├── EventOutbox
│   └── INSERT INTO event_outbox (NO_SHOW_FEE_CAPTURED event)
└── Response: {"id": "...", "amount_cents": 1500, "status": "captured"}
```

### 5. Services & Availability Flow

#### Service Creation Flow
```
POST /api/v1/services
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/api_v1.py
│   ├── create_service()
│   ├── Validate request body
│   └── Extract service data
├── services/business_phase2.py
│   └── ServiceService.create_service()
│       ├── Validate: name, duration_min, price_cents
│       ├── Validate duration constraints
│       ├── Generate slug from name
│       └── Create service record
├── models/business.py
│   └── INSERT INTO services (id, tenant_id, name, duration_min, price_cents, active)
├── models/audit.py
│   └── INSERT INTO audit_logs (tenant_id, table_name='services', operation='CREATE')
├── EventOutbox
│   └── INSERT INTO event_outbox (SERVICE_CREATED event)
└── Response: {"id": "...", "name": "Hair Cut", "duration_min": 60, "price_cents": 5000}
```

#### Staff Availability Management Flow
```
POST /api/v1/staff/{staff_id}/availability
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/api_v1.py
│   ├── create_staff_availability()
│   ├── Validate: weekday, start_time, end_time
│   └── Validate staff profile exists
├── services/business_phase2.py
│   └── StaffAvailabilityService.create_availability()
│       ├── Validate weekday (0-6)
│       ├── Validate time format
│       ├── Check for conflicts with existing availability
│       └── Create or update availability record
├── models/business.py
│   └── INSERT INTO staff_availability (id, staff_profile_id, weekday, start_time, end_time)
├── models/audit.py
│   └── INSERT INTO audit_logs (tenant_id, table_name='staff_availability', operation='CREATE')
├── EventOutbox
│   └── INSERT INTO event_outbox (STAFF_AVAILABILITY_UPDATED event)
└── Response: {"id": "...", "weekday": 1, "start_time": "09:00", "end_time": "17:00"}
```

### 6. Notifications Flow (Email/SMS Booking Confirmations, Reminders, Cancellations)

#### Notification Template Creation Flow
```
POST /api/v1/notifications/templates
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/notification_api.py
│   ├── create_notification_template()
│   ├── Validate: name, channel, content
│   └── Validate template syntax
├── services/notification.py
│   └── NotificationTemplateService.create_template()
│       ├── Validate channel (email, sms, push)
│       ├── Validate content type
│       ├── Parse Jinja2 template syntax
│       └── Create template record
├── models/notification.py
│   └── INSERT INTO notification_templates (id, tenant_id, name, channel, content, variables)
├── models/audit.py
│   └── INSERT INTO audit_logs (tenant_id, table_name='notification_templates', operation='CREATE')
└── Response: {"id": "...", "name": "booking_confirmation", "channel": "email", "content": "..."}
```

#### Booking Confirmation Notification Flow
```
POST /api/v1/notifications
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── blueprints/notification_api.py
│   ├── create_notification()
│   ├── Validate: channel, recipient_type, template_id
│   └── Extract template variables
├── services/notification.py
│   └── NotificationService.create_notification()
│       ├── Get notification template
│       ├── Render template with variables
│       ├── Check recipient preferences
│       └── Create notification record
├── models/notification.py
│   ├── INSERT INTO notifications (id, tenant_id, channel, recipient_email, subject, content, status)
│   └── INSERT INTO notification_queue (id, notification_id, scheduled_at, priority)
├── jobs/email_worker.py
│   └── send_notification.delay()
├── External: SendGrid API
│   ├── POST /v3/mail/send
│   └── Send email with rendered content
├── models/notification.py
│   └── UPDATE notifications SET status='sent', sent_at=NOW() WHERE id=notification_id
└── Response: {"id": "...", "status": "queued", "scheduled_at": "..."}
```

### 7. Admin Dashboard Flow (Bookings, Services, Branding, Policies)

#### Admin Booking Management Flow
```
GET /api/v1/admin/bookings?status=pending&start_date=2024-01-01&end_date=2024-01-31
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── middleware/auth_middleware.py
│   └── require_role('admin') → Check user role
├── blueprints/admin_dashboard_api.py
│   ├── get_admin_bookings()
│   ├── Parse query parameters
│   └── Validate date range
├── services/business_phase2.py
│   └── BookingService.get_bookings_for_admin()
│       ├── Apply tenant filtering
│       ├── Apply status filtering
│       ├── Apply date range filtering
│       └── Include customer and service details
├── models/business.py
│   ├── Booking.query.filter_by(tenant_id=g.tenant_id)
│   ├── JOIN customers ON bookings.customer_id = customers.id
│   └── JOIN services ON booking_items.service_id = services.id
├── models/audit.py
│   └── INSERT INTO audit_logs (tenant_id, table_name='bookings', operation='ADMIN_VIEW')
└── Response: {"bookings": [...], "total": 25, "filters": {"status": "pending"}}
```

#### Bulk Booking Actions Flow
```
POST /api/v1/admin/bookings/bulk-action
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── middleware/auth_middleware.py
│   └── require_role('admin') → Check user role
├── blueprints/admin_dashboard_api.py
│   ├── bulk_booking_action()
│   ├── Validate: action, booking_ids
│   └── Extract action parameters
├── services/business_phase2.py
│   └── BookingService.bulk_action()
│       ├── Validate all bookings belong to tenant
│       ├── Check user permissions for each booking
│       ├── Execute action atomically
│       └── Update booking statuses
├── models/business.py
│   └── UPDATE bookings SET status='confirmed' WHERE id IN (booking_ids)
├── models/audit.py
│   └── INSERT INTO audit_logs (tenant_id, table_name='bookings', operation='BULK_CONFIRM')
├── EventOutbox
│   └── INSERT INTO event_outbox (BULK_BOOKING_ACTION event)
├── jobs/email_worker.py
│   └── send_bulk_notifications.delay()
└── Response: {"message": "Bulk action completed", "updated_count": 5, "action": "confirm"}
```

#### Branding Update Flow
```
PUT /api/v1/admin/branding
├── middleware/auth_middleware.py
│   ├── Validate JWT token
│   └── Set g.user_id, g.tenant_id
├── middleware/tenant_middleware.py
│   └── Ensure g.tenant_id is set
├── middleware/auth_middleware.py
│   └── require_role('owner') → Check user role
├── blueprints/admin_dashboard_api.py
│   ├── update_branding()
│   ├── Validate: logo_url, brand_color, theme_json
│   └── Validate image URL format
├── services/system.py
│   └── BrandingService.update_branding()
│       ├── Validate color format
│       ├── Validate theme JSON structure
│       ├── Update branding record
│       └── Create theme version
├── models/system.py
│   ├── UPDATE branding SET logo_url=..., brand_color=... WHERE tenant_id=g.tenant_id
│   └── INSERT INTO themes (id, tenant_id, theme_data, version)
├── models/audit.py
│   └── INSERT INTO audit_logs (tenant_id, table_name='branding', operation='UPDATE')
├── EventOutbox
│   └── INSERT INTO event_outbox (BRANDING_UPDATED event)
└── Response: {"message": "Branding updated successfully", "theme_id": "...", "version": 2}
```

### Cross-Cutting Concerns in Request Lifecycles

#### Middleware Stack Execution Order
1. **LoggingMiddleware** → Request/response logging, correlation IDs
2. **TenantMiddleware** → Tenant resolution from path/host
3. **RateLimitMiddleware** → Request throttling per tenant/user
4. **AuthMiddleware** → JWT validation, user context
5. **IdempotencyMiddleware** → Duplicate request prevention
6. **ErrorHandler** → Global error handling, structured responses

#### Database Transaction Patterns
- **Atomic Operations**: All booking/payment operations use database transactions
- **Rollback on Error**: Failed operations automatically rollback changes
- **Audit Logging**: Every data modification creates audit trail
- **Event Sourcing**: Business events stored in event_outbox for reliable delivery

#### External Service Integration
- **Stripe**: Payment processing with webhook handling
- **SendGrid**: Email delivery with template rendering
- **Twilio**: SMS delivery with phone number validation
- **Supabase**: JWT authentication and user management

#### Background Job Processing
- **Celery Workers**: Email, SMS, automation, backup tasks
- **Queue Management**: Priority-based job scheduling
- **Retry Logic**: Failed jobs retry with exponential backoff
- **Dead Letter Queue**: Failed jobs moved to DLQ after max retries

This comprehensive request lifecycle mapping provides the frontend team with complete visibility into how requests flow through the Tithi backend system, enabling accurate API integration and proper error handling.

## 5. Database Map

### Core Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `tenants` | Business organizations | id, slug, tz, trust_copy_json | models/core.py, services/core.py |
| `users` | Individual users | id, display_name, primary_email | models/core.py, services/core.py |
| `memberships` | User-tenant relationships | user_id, tenant_id, role | models/core.py, services/core.py |

### Business Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `customers` | Customer records | id, tenant_id, display_name, email | models/business.py, services/business_phase2.py |
| `services` | Service catalog | id, tenant_id, name, duration_min, price_cents | models/business.py, services/business_phase2.py |
| `resources` | Staff/equipment | id, tenant_id, type, capacity | models/business.py, services/business_phase2.py |
| `bookings` | Customer bookings | id, tenant_id, customer_id, resource_id, start_at, end_at | models/business.py, services/business_phase2.py |
| `booking_items` | Booking line items | booking_id, service_id, resource_id | models/business.py, services/business_phase2.py |
| `service_resources` | Service-resource mapping | service_id, resource_id | models/business.py, services/business_phase2.py |
| `staff_profiles` | Staff information | id, tenant_id, membership_id, display_name | models/business.py, services/business_phase2.py |
| `work_schedules` | Staff schedules | staff_profile_id, schedule_type, work_hours | models/business.py, services/business_phase2.py |
| `staff_availability` | Staff availability | staff_profile_id, weekday, start_time, end_time | models/business.py, services/business_phase2.py |
| `availability_rules` | Availability rules | resource_id, rule_type, schedule | models/availability.py, services/business_phase2.py |
| `availability_exceptions` | Availability exceptions | resource_id, exception_date, is_available | models/availability.py, services/business_phase2.py |

### Financial Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `payments` | Payment records | id, tenant_id, booking_id, amount_cents, status | models/financial.py, services/financial.py |
| `invoices` | Invoice records | id, tenant_id, customer_id, total_cents | models/financial.py, services/financial.py |
| `refunds` | Refund records | id, payment_id, amount_cents, reason | models/financial.py, services/financial.py |
| `payment_methods` | Payment methods | id, customer_id, provider, provider_payment_method_id | models/financial.py, services/financial.py |
| `tenant_billing` | Tenant billing | tenant_id, stripe_customer_id, subscription_status | models/financial.py, services/financial.py |

### System Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `themes` | UI themes | id, tenant_id, name, theme_data | models/system.py, services/system.py |
| `branding` | Branding assets | id, tenant_id, logo_url, colors | models/system.py, services/system.py |

### Analytics Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `events` | Event tracking | id, tenant_id, event_type, event_data | models/analytics.py, services/analytics.py |
| `metrics` | Performance metrics | id, tenant_id, metric_name, value | models/analytics.py, services/analytics.py |

### CRM Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `customer_notes` | Customer notes | id, tenant_id, customer_id, note_text | models/crm.py, services/crm.py |
| `customer_segments` | Customer segments | id, tenant_id, name, criteria | models/crm.py, services/crm.py |
| `loyalty_accounts` | Loyalty accounts | id, tenant_id, customer_id, points_balance | models/crm.py, services/loyalty.py |
| `loyalty_transactions` | Loyalty transactions | loyalty_account_id, points_change, reason | models/crm.py, services/loyalty.py |

### Automation Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `automations` | Automation rules | id, tenant_id, name, trigger_type | models/automation.py, services/automation.py |
| `automation_executions` | Execution history | automation_id, execution_time, status | models/automation.py, services/automation.py |

### Notification Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `notifications` | Notification records | id, tenant_id, recipient_id, type, content | models/notification.py, services/notification.py |
| `notification_templates` | Email templates | id, tenant_id, template_name, content | models/notification.py, services/notification.py |
| `notification_preferences` | User preferences | user_id, notification_type, enabled | models/notification.py, services/notification.py |

### Audit Tables
| Table | Purpose | Key Fields | Backend Files |
|-------|---------|------------|---------------|
| `audit_logs` | Audit trail | id, tenant_id, user_id, action, details | models/audit.py, services/audit.py |
| `event_outbox` | Event sourcing | id, tenant_id, event_type, event_data | models/audit.py, jobs/outbox_worker.py |
| `webhook_event_inbox` | Webhook events | id, tenant_id, webhook_url, event_data | models/audit.py, jobs/webhook_inbox_worker.py |

## 6. Cross-Cutting Utilities Map

### Middleware Stack (Request Processing Order)
1. **LoggingMiddleware** - Request/response logging
2. **TenantMiddleware** - Tenant resolution and context
3. **RateLimitMiddleware** - Rate limiting
4. **AuthMiddleware** - Authentication and authorization
5. **IdempotencyMiddleware** - Idempotency key handling
6. **ErrorHandler** - Error handling and response formatting

### Configuration Management
- **Environment Variables**: Database URLs, API keys, service endpoints
- **Config Classes**: Development, Testing, Production, Staging
- **Validation**: Required configuration validation on startup

### Error Handling
- **Custom Exceptions**: TithiError, ValidationError, AuthenticationError
- **Structured Responses**: RFC 7807 Problem+JSON format
- **Monitoring Integration**: Sentry error tracking
- **Alerting**: Critical error notifications

### Caching Strategy
- **Redis**: Availability slots, booking holds, waitlist entries
- **Cache Services**: AvailabilityCacheService, BookingHoldCacheService
- **TTL Management**: Configurable cache expiration times

### Background Jobs
- **Celery**: Asynchronous task processing
- **Workers**: Email, automation, backup, compliance
- **Job Types**: Email sending, automation execution, data backup

### External Integrations
- **Stripe**: Payment processing
- **SendGrid**: Email delivery
- **Twilio**: SMS delivery
- **Supabase**: Authentication and database
- **Slack**: Alerting and notifications

## 7. Tenant Isolation Rules

### Database Level
- **Row Level Security (RLS)**: Enabled on all tenant-scoped tables
- **Tenant ID**: Required foreign key on all business entities
- **Policies**: Tenant-specific access policies enforced

### Application Level
- **Tenant Context**: Set by TenantMiddleware on every request
- **Service Layer**: All services validate tenant access
- **Model Queries**: Automatic tenant filtering in queries

### API Level
- **Authentication**: JWT contains tenant context
- **Authorization**: Role-based access within tenant
- **Public APIs**: Tenant resolution via slug or subdomain

## 8. Frontend Integration Points

### Authentication Endpoints
- `POST /api/v1/auth/login` - User authentication
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout

### Tenant Management
- `GET /api/v1/tenants` - List user's tenants
- `POST /api/v1/tenants` - Create new tenant
- `GET /api/v1/tenants/{id}` - Get tenant details
- `PUT /api/v1/tenants/{id}` - Update tenant

### Service Management
- `GET /api/v1/services` - List tenant services
- `POST /api/v1/services` - Create service
- `GET /api/v1/services/{id}` - Get service details
- `PUT /api/v1/services/{id}` - Update service
- `DELETE /api/v1/services/{id}` - Delete service

### Booking Management
- `GET /api/v1/bookings` - List bookings
- `POST /api/v1/bookings` - Create booking
- `POST /api/v1/bookings/{id}/confirm` - Confirm booking
- `POST /api/v1/bookings/{id}/cancel` - Cancel booking
- `POST /api/v1/bookings/{id}/complete` - Complete booking

### Staff Management
- `GET /api/v1/staff` - List staff
- `POST /api/v1/staff` - Create staff profile
- `GET /api/v1/staff/{id}` - Get staff details
- `PUT /api/v1/staff/{id}` - Update staff profile
- `GET /api/v1/staff/{id}/availability` - Get staff availability
- `POST /api/v1/staff/{id}/availability` - Set staff availability

### Availability Management
- `GET /api/v1/availability/{resource_id}/slots` - Get available slots
- `POST /api/v1/availability/rules` - Create availability rule
- `PUT /api/v1/availability/rules/{id}` - Update availability rule

### Payment Processing
- `POST /api/payments/process` - Process payment
- `GET /api/payments/{id}` - Get payment details
- `POST /api/payments/{id}/refund` - Process refund

### Public APIs (No Authentication)
- `GET /v1/{slug}` - Public tenant page
- `GET /v1/{slug}/info` - Public tenant information
- `GET /v1/{slug}/services` - Public service catalog

## 9. Data Flow Patterns

### Multi-Tenant Data Access
1. **Request arrives** with tenant context
2. **TenantMiddleware** resolves tenant ID
3. **Service layer** validates tenant access
4. **Model queries** automatically filter by tenant_id
5. **Response** contains only tenant-scoped data

### Booking Lifecycle
1. **Availability Check** - Query available slots
2. **Booking Creation** - Create pending booking
3. **Payment Processing** - Charge customer
4. **Confirmation** - Update booking status
5. **Notification** - Send confirmation email
6. **Completion** - Award loyalty points

### Staff Scheduling
1. **Availability Rules** - Define regular hours
2. **Schedule Exceptions** - Handle time off
3. **Booking Assignment** - Assign staff to bookings
4. **Conflict Detection** - Prevent double booking

## 10. Additional Important Details

### Dependencies and Technologies
- **Python Version**: 3.11
- **Flask Version**: 2.3.3
- **Database**: PostgreSQL 13+ with Row Level Security
- **Cache**: Redis 6+
- **Background Jobs**: Celery 5.3.4
- **Payment Processing**: Stripe 7.8.0
- **Email**: SendGrid 6.10.0
- **SMS**: Twilio 8.10.0
- **Monitoring**: Sentry, Prometheus
- **Containerization**: Docker with docker-compose

### Key Database Features
- **Row Level Security (RLS)**: Comprehensive tenant isolation
- **Custom Types**: Enums for status fields, payment methods, etc.
- **Helper Functions**: Database-level utilities for tenant resolution
- **Triggers**: Automatic timestamp updates, booking status sync
- **Indexes**: Performance optimization for common queries
- **Materialized Views**: Analytics and reporting optimization

### Security Features
- **JWT Authentication**: Supabase integration
- **Tenant Isolation**: Database and application level
- **Rate Limiting**: Request throttling
- **Idempotency**: Duplicate request prevention
- **Audit Logging**: Complete action tracking
- **Encryption**: Sensitive data protection
- **PCI Compliance**: Payment data handling

### Production Readiness Features
- **Health Checks**: Comprehensive system monitoring
- **Error Handling**: Structured error responses
- **Logging**: Structured logging with correlation IDs
- **Metrics**: Performance and business metrics
- **Alerting**: Critical issue notifications
- **Backup**: Automated data backup
- **Compliance**: Audit trail and data retention

This architecture map provides the complete foundation for frontend development, ensuring accurate API integration and proper tenant isolation throughout the application.

## 🗄️ Database Schema Map (Module 4)

Now let me examine the complete database schema by analyzing all model files and migration definitions to provide a comprehensive map of every table, its fields, relationships, and backend references.

### Core Tables

#### `tenants` (Global Table)
**Purpose**: Business organizations and tenant configuration
**Columns**:
- `id` (UUID, PK) - Primary key
- `slug` (String(100), UNIQUE) - URL-friendly identifier
- `tz` (String(50), DEFAULT 'UTC') - Timezone
- `trust_copy_json` (JSON, DEFAULT {}) - Trust messaging configuration
- `is_public_directory` (Boolean, DEFAULT false) - Public visibility
- `public_blurb` (Text) - Public description
- `billing_json` (JSON, DEFAULT {}) - Billing configuration
- `default_no_show_fee_percent` (Numeric(5,2), DEFAULT 3.00) - Default no-show fee
- `deleted_at` (DateTime) - Soft delete timestamp
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**: 
- One-to-many: customers, services, resources, bookings, themes, branding, automations
- Many-to-many: users (via memberships)

**Tenant Isolation**: Global table, no tenant_id
**Backend References**: 
- `models/core.py` - Tenant model
- `services/core.py` - TenantService
- `blueprints/onboarding.py` - Tenant creation
- `blueprints/api_v1.py` - Tenant management

#### `users` (Global Table)
**Purpose**: Individual user accounts across all tenants
**Columns**:
- `id` (UUID, PK) - Primary key
- `display_name` (String(255)) - User display name
- `primary_email` (String(255), UNIQUE) - Primary email address
- `avatar_url` (String(500)) - Avatar image URL
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-many: tenants (via memberships)
- One-to-many: memberships, audit_logs, oauth_providers

**Tenant Isolation**: Global table, no tenant_id
**Backend References**:
- `models/core.py` - User model
- `services/core.py` - UserService
- `blueprints/api_v1.py` - User management

#### `memberships` (Tenant-Scoped Table)
**Purpose**: User-tenant relationships with roles and permissions
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `user_id` (UUID, FK → users.id) - User reference
- `role` (membership_role ENUM) - owner, admin, staff, viewer
- `permissions_json` (JSON, DEFAULT {}) - Granular permissions
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, user
- One-to-many: staff_profiles

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/core.py` - Membership model
- `services/core.py` - TenantService
- `blueprints/onboarding.py` - Owner membership creation

### Business Tables

#### `customers` (Tenant-Scoped Table)
**Purpose**: Customer records for each tenant
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `display_name` (String(255)) - Customer name
- `email` (String(255), UNIQUE per tenant) - Email address
- `phone` (String(50)) - Phone number
- `marketing_opt_in` (Boolean, DEFAULT false) - Marketing consent
- `notification_preferences` (JSON, DEFAULT {}) - Notification settings
- `is_first_time` (Boolean, DEFAULT true) - First-time customer flag
- `pseudonymized_at` (DateTime) - GDPR compliance timestamp
- `customer_first_booking_at` (DateTime) - First booking timestamp
- `deleted_at` (DateTime) - Soft delete timestamp
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant
- One-to-many: bookings, customer_notes, loyalty_accounts, segment_memberships
- One-to-many: payments, gift_cards (as purchaser/recipient)

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/business.py` - Customer model
- `services/business_phase2.py` - CustomerService
- `blueprints/api_v1.py` - Customer management
- `blueprints/crm_api.py` - CRM operations

#### `services` (Tenant-Scoped Table)
**Purpose**: Service catalog for each tenant
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `slug` (String(100)) - URL-friendly identifier
- `name` (String(255)) - Service name
- `description` (Text) - Service description
- `duration_min` (Integer, DEFAULT 60) - Duration in minutes
- `price_cents` (Integer, DEFAULT 0) - Price in cents
- `buffer_before_min` (Integer, DEFAULT 0) - Pre-service buffer
- `buffer_after_min` (Integer, DEFAULT 0) - Post-service buffer
- `category` (String(255)) - Service category
- `active` (Boolean, DEFAULT true) - Active status
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `deleted_at` (DateTime) - Soft delete timestamp
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant
- One-to-many: booking_items, service_resources

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/business.py` - Service model
- `services/business_phase2.py` - ServiceService
- `blueprints/api_v1.py` - Service management
- `blueprints/public.py` - Public service listings

#### `resources` (Tenant-Scoped Table)
**Purpose**: Staff members or equipment/resources
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `type` (resource_type ENUM) - staff, room
- `tz` (String(50)) - Resource timezone
- `capacity` (Integer) - Capacity (≥1)
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `name` (String(255)) - Human-friendly name
- `is_active` (Boolean, DEFAULT true) - Active status
- `deleted_at` (DateTime) - Soft delete timestamp
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant
- One-to-many: booking_items, service_resources, staff_profiles
- One-to-many: availability_rules, availability_exceptions

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/business.py` - Resource model
- `services/business_phase2.py` - ResourceService
- `blueprints/api_v1.py` - Resource management

#### `bookings` (Tenant-Scoped Table)
**Purpose**: Customer appointment bookings
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `customer_id` (UUID, FK → customers.id) - Customer reference
- `resource_id` (UUID, FK → resources.id) - Resource reference
- `client_generated_id` (String(255)) - Idempotency key
- `service_snapshot` (JSON) - Service details at booking time
- `start_at` (DateTime) - Booking start time
- `end_at` (DateTime) - Booking end time
- `booking_tz` (String(50)) - Booking timezone
- `status` (booking_status ENUM) - pending, confirmed, checked_in, completed, canceled, no_show, failed
- `canceled_at` (DateTime) - Cancellation timestamp
- `no_show_flag` (Boolean, DEFAULT false) - No-show flag
- `attendee_count` (Integer, DEFAULT 1) - Number of attendees
- `rescheduled_from` (UUID, FK → bookings.id) - Rescheduling reference
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, customer, resource
- One-to-many: booking_items, payments
- Self-reference: rescheduled_from_booking

**Constraints**:
- `start_at < end_at` (time order)
- `attendee_count > 0` (positive attendees)
- Unique `(tenant_id, client_generated_id)` (idempotency)
- Exclusion constraint for overlapping bookings

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/business.py` - Booking model
- `services/business_phase2.py` - BookingService
- `blueprints/api_v1.py` - Booking management
- `blueprints/payment_api.py` - Payment processing

#### `booking_items` (Tenant-Scoped Table)
**Purpose**: Multi-resource booking support with individual pricing
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `booking_id` (UUID, FK → bookings.id) - Booking reference
- `resource_id` (UUID, FK → resources.id) - Resource reference
- `service_id` (UUID, FK → services.id) - Service reference
- `start_at` (DateTime) - Item start time
- `end_at` (DateTime) - Item end time
- `buffer_before_min` (Integer, DEFAULT 0) - Pre-service buffer
- `buffer_after_min` (Integer, DEFAULT 0) - Post-service buffer
- `price_cents` (Integer, DEFAULT 0) - Item price in cents
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, booking, resource, service

**Constraints**:
- `start_at < end_at` (time order)
- `buffer_before_min >= 0`, `buffer_after_min >= 0` (non-negative buffers)
- `price_cents >= 0` (non-negative price)

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/business.py` - BookingItem model
- `services/business_phase2.py` - BookingService (via Booking)

### Financial Tables

#### `payments` (Tenant-Scoped Table)
**Purpose**: Payment transactions with Stripe integration
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `booking_id` (UUID, FK → bookings.id) - Booking reference
- `customer_id` (UUID, FK → customers.id) - Customer reference
- `status` (payment_status ENUM) - requires_action, authorized, captured, refunded, canceled, failed
- `method` (payment_method ENUM) - card, cash, apple_pay, paypal, other
- `currency_code` (String(3), DEFAULT 'USD') - Currency
- `amount_cents` (Integer, DEFAULT 0) - Amount in cents
- `tip_cents` (Integer, DEFAULT 0) - Tip amount
- `tax_cents` (Integer, DEFAULT 0) - Tax amount
- `application_fee_cents` (Integer, DEFAULT 0) - Application fee
- `no_show_fee_cents` (Integer, DEFAULT 0) - No-show fee
- `fee_type` (String(50), DEFAULT 'booking') - Fee type
- `related_payment_id` (UUID, FK → payments.id) - Related payment
- `provider` (String(50), DEFAULT 'stripe') - Payment provider
- `provider_payment_id` (String(255)) - Stripe PaymentIntent ID
- `provider_charge_id` (String(255)) - Stripe Charge ID
- `provider_setup_intent_id` (String(255)) - Stripe SetupIntent ID
- `provider_metadata` (JSON, DEFAULT {}) - Provider metadata
- `idempotency_key` (String(255), UNIQUE) - Idempotency key
- `backup_setup_intent_id` (String(255)) - Backup payment method
- `explicit_consent_flag` (Boolean, DEFAULT false) - Consent flag
- `royalty_applied` (Boolean, DEFAULT false) - Royalty applied
- `royalty_basis` (String(50)) - Royalty basis
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, booking, customer
- Self-reference: related_payment
- One-to-many: refunds

**Constraints**:
- All amount fields ≥ 0 (non-negative amounts)
- Unique `(tenant_id, provider, idempotency_key)` (idempotency)
- Unique `(tenant_id, provider, provider_charge_id)` (provider uniqueness)

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/financial.py` - Payment model
- `services/financial.py` - PaymentService
- `blueprints/payment_api.py` - Payment processing
- `jobs/automation_worker.py` - Payment automation

#### `payment_methods` (Tenant-Scoped Table)
**Purpose**: Customer payment methods for recurring payments
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `customer_id` (UUID, FK → customers.id) - Customer reference
- `stripe_payment_method_id` (String(255)) - Stripe payment method ID
- `type` (String(50)) - card, bank_account, etc.
- `last4` (String(4)) - Last 4 digits
- `exp_month` (Integer) - Expiration month
- `exp_year` (Integer) - Expiration year
- `brand` (String(50)) - Card brand
- `is_default` (Boolean, DEFAULT false) - Default payment method
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, customer

**Constraints**:
- `exp_month` between 1-12 (valid month)
- `exp_year >= 2024` (valid year)

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/financial.py` - PaymentMethod model
- `services/financial.py` - PaymentService

#### `refunds` (Tenant-Scoped Table)
**Purpose**: Refund transactions
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `payment_id` (UUID, FK → payments.id) - Payment reference
- `booking_id` (UUID, FK → bookings.id) - Booking reference
- `amount_cents` (Integer) - Refund amount in cents
- `reason` (Text) - Refund reason
- `refund_type` (String(20), DEFAULT 'full') - full, partial, no_show_fee_only
- `provider` (String(50), DEFAULT 'stripe') - Provider
- `provider_refund_id` (String(255)) - Provider refund ID
- `provider_metadata` (JSON, DEFAULT {}) - Provider metadata
- `status` (String(20), DEFAULT 'pending') - pending, succeeded, failed, canceled
- `idempotency_key` (String(255)) - Idempotency key
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, payment, booking

**Constraints**:
- `amount_cents > 0` (positive refund amount)
- `refund_type` in valid enum values
- `status` in valid enum values

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/financial.py` - Refund model
- `services/financial.py` - PaymentService

### System Tables

#### `themes` (Tenant-Scoped Table)
**Purpose**: Tenant UI theme configuration
**Columns**:
- `tenant_id` (UUID, PK, FK → tenants.id) - Tenant reference (1:1)
- `brand_color` (String(7)) - Hex color code
- `logo_url` (String(500)) - Logo URL
- `theme_json` (JSON, DEFAULT {}) - Theme configuration
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- One-to-one: tenant

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/system.py` - Theme model
- `services/system.py` - ThemeService
- `blueprints/onboarding.py` - Default theme creation

#### `branding` (Tenant-Scoped Table)
**Purpose**: Tenant branding assets and configuration
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `logo_url` (String(500)) - Logo URL
- `primary_color` (String(7)) - Primary hex color
- `secondary_color` (String(7)) - Secondary hex color
- `font_family` (String(100)) - Font family
- `custom_css` (Text) - Custom CSS
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/system.py` - Branding model
- `services/system.py` - BrandingService

### Notification Tables

#### `notification_templates` (Tenant-Scoped Table)
**Purpose**: Reusable notification templates
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `name` (String(255)) - Template name
- `description` (Text) - Template description
- `channel` (notification_channel ENUM) - email, sms, push
- `subject` (String(500)) - Email subject
- `content` (Text) - Template content
- `content_type` (String(50), DEFAULT 'text/plain') - Content type
- `variables` (JSON, DEFAULT {}) - Available variables
- `required_variables` (JSON, DEFAULT []) - Required variables
- `trigger_event` (String(100)) - Triggering event
- `category` (String(100)) - Template category
- `is_active` (Boolean, DEFAULT true) - Active status
- `is_system` (Boolean, DEFAULT false) - System template flag
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant
- One-to-many: notifications

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/notification.py` - NotificationTemplate model
- `services/notification.py` - NotificationTemplateService
- `blueprints/notification_api.py` - Template management

#### `notifications` (Tenant-Scoped Table)
**Purpose**: Individual notification instances
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `template_id` (UUID, FK → notification_templates.id) - Template reference
- `channel` (notification_channel ENUM) - email, sms, push
- `recipient_type` (String(50)) - customer, staff, admin
- `recipient_id` (UUID) - Recipient ID
- `recipient_email` (String(255)) - Recipient email
- `recipient_phone` (String(20)) - Recipient phone
- `recipient_name` (String(255)) - Recipient name
- `subject` (String(500)) - Notification subject
- `content` (Text) - Notification content
- `content_type` (String(50), DEFAULT 'text/plain') - Content type
- `priority` (notification_priority ENUM, DEFAULT 'normal') - Priority level
- `scheduled_at` (DateTime) - Scheduled send time
- `expires_at` (DateTime) - Expiration time
- `status` (notification_status ENUM, DEFAULT 'pending') - Delivery status
- `sent_at` (DateTime) - Sent timestamp
- `delivered_at` (DateTime) - Delivered timestamp
- `failed_at` (DateTime) - Failed timestamp
- `failure_reason` (Text) - Failure reason
- `provider` (String(50)) - Provider (sendgrid, twilio, etc.)
- `provider_message_id` (String(255)) - Provider message ID
- `provider_response` (JSON, DEFAULT {}) - Provider response
- `booking_id` (UUID, FK → bookings.id) - Related booking
- `payment_id` (UUID, FK → payments.id) - Related payment
- `customer_id` (UUID, FK → customers.id) - Related customer
- `retry_count` (Integer, DEFAULT 0) - Retry count
- `max_retries` (Integer, DEFAULT 3) - Max retries
- `next_retry_at` (DateTime) - Next retry time
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, template, booking, payment, customer

**Constraints**:
- `retry_count >= 0`, `max_retries >= 0` (non-negative retry counts)
- `scheduled_at >= created_at` (future scheduling)
- `expires_at > created_at` (future expiration)

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/notification.py` - Notification model
- `services/notification.py` - NotificationService
- `services/email_service.py` - Email delivery
- `services/sms_service.py` - SMS delivery
- `jobs/email_worker.py` - Background processing

### CRM Tables

#### `customer_notes` (Tenant-Scoped Table)
**Purpose**: Customer interaction notes and history
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `customer_id` (UUID, FK → customers.id) - Customer reference
- `content` (Text) - Note content
- `created_by` (UUID) - Creator user ID
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, customer

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/crm.py` - CustomerNote model
- `services/business_phase2.py` - CustomerService (notes)
- `blueprints/crm_api.py` - CRM operations

#### `loyalty_accounts` (Tenant-Scoped Table)
**Purpose**: Customer loyalty program accounts
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `customer_id` (UUID, FK → customers.id) - Customer reference
- `points_balance` (Integer, DEFAULT 0) - Current points balance
- `total_earned` (Integer, DEFAULT 0) - Total points earned
- `total_redeemed` (Integer, DEFAULT 0) - Total points redeemed
- `tier` (String(50), DEFAULT 'bronze') - Loyalty tier
- `is_active` (Boolean, DEFAULT true) - Active status
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, customer
- One-to-many: loyalty_transactions

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/crm.py` - LoyaltyAccount model
- `services/loyalty_service.py` - LoyaltyService
- `blueprints/loyalty_api.py` - Loyalty management

### Automation Tables

#### `automations` (Tenant-Scoped Table)
**Purpose**: Business automation rules and workflows
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `name` (String(255)) - Automation name
- `description` (Text) - Automation description
- `status` (automation_status ENUM) - active, paused, cancelled, completed
- `trigger_type` (automation_trigger ENUM) - Event triggers
- `trigger_config` (JSON, DEFAULT {}) - Trigger configuration
- `action_type` (automation_action ENUM) - Action types
- `action_config` (JSON, DEFAULT {}) - Action configuration
- `schedule_expression` (String(255)) - Cron expression
- `schedule_timezone` (String(50), DEFAULT 'UTC') - Schedule timezone
- `start_date` (DateTime) - Start date
- `end_date` (DateTime) - End date
- `max_executions` (Integer) - Max executions limit
- `execution_count` (Integer, DEFAULT 0) - Current execution count
- `last_executed_at` (DateTime) - Last execution time
- `next_execution_at` (DateTime) - Next execution time
- `target_audience` (JSON, DEFAULT {}) - Target audience
- `conditions` (JSON, DEFAULT {}) - Execution conditions
- `rate_limit_per_hour` (Integer, DEFAULT 100) - Rate limiting
- `rate_limit_per_day` (Integer, DEFAULT 1000) - Rate limiting
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `created_by` (String(255)) - Creator user ID
- `tags` (JSON, DEFAULT []) - Tags
- `is_active` (Boolean, DEFAULT true) - Active status
- `version` (Integer, DEFAULT 1) - Version number
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant
- One-to-many: automation_executions

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/automation.py` - Automation model
- `services/automation_service.py` - AutomationService
- `jobs/automation_worker.py` - Background execution
- `blueprints/automation_api.py` - Automation management

### Audit Tables

#### `audit_logs` (Global Table)
**Purpose**: Comprehensive audit trail for all operations
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference (nullable)
- `table_name` (String(100)) - Table name
- `operation` (String(20)) - INSERT, UPDATE, DELETE
- `record_id` (UUID) - Record ID
- `old_data` (JSON) - Old data snapshot
- `new_data` (JSON) - New data snapshot
- `user_id` (UUID, FK → users.id) - User who performed operation
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant, user

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()` (nullable for system operations)
**Backend References**:
- `models/audit.py` - AuditLog model
- `services/audit_service.py` - AuditService
- `middleware/audit_middleware.py` - Automatic logging
- `blueprints/admin_dashboard_api.py` - Audit viewing

#### `events_outbox` (Tenant-Scoped Table)
**Purpose**: Reliable event delivery for business events
**Columns**:
- `id` (UUID, PK) - Primary key
- `tenant_id` (UUID, FK → tenants.id) - Tenant reference
- `event_code` (String(100)) - Event type code
- `payload` (JSON, DEFAULT {}) - Event payload
- `status` (String(20), DEFAULT 'ready') - ready, delivered, failed
- `ready_at` (DateTime, DEFAULT now()) - Ready for processing
- `delivered_at` (DateTime) - Delivery timestamp
- `failed_at` (DateTime) - Failure timestamp
- `attempts` (Integer, DEFAULT 0) - Attempt count
- `max_attempts` (Integer, DEFAULT 3) - Max attempts
- `last_attempt_at` (DateTime) - Last attempt time
- `error_message` (Text) - Error message
- `key` (String(255)) - Event key
- `metadata_json` (JSON, DEFAULT {}) - Additional metadata
- `created_at`, `updated_at` (DateTime) - Standard timestamps

**Relationships**:
- Many-to-one: tenant

**Constraints**:
- `attempts >= 0`, `max_attempts >= 0` (non-negative attempts)

**Tenant Isolation**: RLS policy `tenant_id = current_tenant_id()`
**Backend References**:
- `models/audit.py` - EventOutbox model
- `jobs/outbox_worker.py` - Event processing
- Multiple services for event creation

### Database Features and Constraints

#### Row Level Security (RLS)
- **Enabled on all tables** for deny-by-default security
- **Standard policies**: `tenant_id = current_tenant_id()` for tenant-scoped tables
- **Special policies**: Global tables (tenants, users) have custom access patterns
- **Function**: `current_tenant_id()` returns current tenant context

#### Database Functions and Triggers
- **`touch_updated_at()`**: Automatic timestamp updates
- **`sync_booking_status()`**: Booking status synchronization based on flags
- **`fill_booking_tz()`**: Automatic timezone resolution for bookings
- **Exclusion constraints**: Prevent overlapping bookings on same resource

#### Custom Types (Enums)
- `booking_status`: pending, confirmed, checked_in, completed, canceled, no_show, failed
- `payment_status`: requires_action, authorized, captured, refunded, canceled, failed
- `membership_role`: owner, admin, staff, viewer
- `resource_type`: staff, room
- `notification_channel`: email, sms, push
- `payment_method`: card, cash, apple_pay, paypal, other

#### Indexes and Performance
- **Unique indexes**: Tenant-specific uniqueness (slug, email, etc.)
- **Partial indexes**: Soft-delete aware uniqueness
- **Composite indexes**: Multi-column queries
- **Exclusion indexes**: Overlap prevention for bookings

This comprehensive database schema map provides the frontend team with complete visibility into the data model, enabling accurate form design, API integration, and proper handling of tenant isolation throughout the application.

## 🛠️ Cross-Cutting Concerns Map (Module 5)

Now let me examine the complete cross-cutting infrastructure of the Tithi backend, documenting all middleware, utilities, external integrations, security measures, and infrastructure components that affect multiple domains.

### Middleware Stack (Request Processing Pipeline)

The Tithi backend implements a comprehensive middleware stack that processes every request in a specific order. Each middleware component adds context, performs validation, and handles cross-cutting concerns.

#### 1. **LoggingMiddleware** (`middleware/logging_middleware.py`)
**Purpose**: Request/response logging with correlation IDs and performance metrics
**Files Using It**: All requests (globally applied)
**Impact on Frontend**:
- Generates unique `request_id` for tracing requests across services
- Logs request duration, status codes, and response sizes
- Frontend can include `X-Request-ID` header for correlation
- Performance metrics available at `/metrics` endpoint

**Key Features**:
- Structured JSON logging with tenant context
- Request/response correlation IDs
- Performance timing measurements
- Error tracking and status code logging

#### 2. **TenantMiddleware** (`middleware/tenant_middleware.py`)
**Purpose**: Multi-tenant resolution and context setting
**Files Using It**: All tenant-scoped requests
**Impact on Frontend**:
- Supports both path-based (`/v1/b/{slug}`) and host-based (`subdomain.tithi.com`) routing
- Sets `g.tenant_id` for all subsequent middleware and services
- Frontend must use consistent tenant routing patterns
- Public endpoints automatically resolve tenant context

**Key Features**:
- Path-based tenant resolution from `/v1/b/{slug}` pattern
- Host-based tenant resolution from subdomain patterns
- Tenant validation and error handling
- Context propagation through Flask's `g` object

#### 3. **RateLimitMiddleware** (`middleware/rate_limit_middleware.py`)
**Purpose**: Request throttling with Redis-backed token bucket algorithm
**Files Using It**: All authenticated requests
**Impact on Frontend**:
- Default limit: 100 requests/minute per tenant/user
- Endpoint-specific limits (bookings: 50/min, payments: 30/min)
- Returns `429` status with `Retry-After` header when exceeded
- Frontend must implement exponential backoff for rate limit errors

**Key Features**:
- Token bucket algorithm with Redis backend
- Per-tenant and per-user rate limiting
- Configurable limits per endpoint
- Fallback to in-memory limiting when Redis unavailable
- Response headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

#### 4. **AuthMiddleware** (`middleware/auth_middleware.py`)
**Purpose**: JWT authentication and authorization with Supabase integration
**Files Using It**: All authenticated endpoints
**Impact on Frontend**:
- Requires `Authorization: Bearer <token>` header
- Validates Supabase JWT tokens
- Sets user context: `g.user_id`, `g.tenant_id`, `g.user_email`, `g.user_role`
- Public endpoints (`/v1/b/*`, `/health`) skip authentication
- Test mode provides mock authentication context

**Key Features**:
- Supabase JWT validation with configurable secrets
- User and tenant context extraction
- Role-based authorization decorators
- Comprehensive error handling with structured responses
- Helper functions: `get_current_user()`, `is_authenticated()`, `require_role()`

#### 5. **IdempotencyMiddleware** (`middleware/idempotency.py`)
**Purpose**: Request deduplication for critical endpoints
**Files Using It**: Critical endpoints (bookings, payments, availability)
**Impact on Frontend**:
- Requires `Idempotency-Key` header for critical operations
- Returns cached response for duplicate requests
- 24-hour expiration for idempotency keys
- Frontend must generate unique keys for retry scenarios

**Key Features**:
- Critical endpoint protection (bookings, payments, availability holds)
- Request hash validation for content consistency
- Database-backed response caching
- Automatic cleanup of expired keys
- Prevents duplicate booking/payment creation

#### 6. **ErrorHandler** (`middleware/error_handler.py`)
**Purpose**: Global error handling with structured responses
**Files Using It**: All requests (globally applied)
**Impact on Frontend**:
- RFC 7807 Problem+JSON error format
- Structured error codes (e.g., `TITHI_AUTH_TOKEN_MISSING`)
- Tenant and user context in error responses
- Sentry integration for server errors
- Frontend must handle structured error responses

**Key Features**:
- Custom exception hierarchy (`TithiError`, `ValidationError`, `AuthenticationError`)
- Structured error responses with error codes
- Observability hooks for monitoring
- Sentry integration for error tracking
- Comprehensive error logging

### Observability and Monitoring Infrastructure

#### 7. **SentryMiddleware** (`middleware/sentry_middleware.py`)
**Purpose**: Error tracking and performance monitoring
**Files Using It**: All requests (globally applied)
**Impact on Frontend**:
- Automatic error capture and reporting
- Performance monitoring with configurable sampling
- PII data scrubbing for compliance
- User and tenant context in error reports
- Frontend errors can be correlated with backend errors

**Key Features**:
- Flask, SQLAlchemy, Redis, Celery integrations
- Configurable sampling rates for traces and profiles
- Comprehensive PII scrubbing (passwords, tokens, personal data)
- User and tenant context setting
- Environment-specific configuration

#### 8. **MetricsMiddleware** (`middleware/metrics_middleware.py`)
**Purpose**: Comprehensive Prometheus metrics collection
**Files Using It**: All requests (globally applied)
**Impact on Frontend**:
- Metrics available at `/metrics` and `/metrics/system` endpoints
- Business metrics (bookings, payments, customers, notifications)
- Performance metrics (response times, database queries, cache hits)
- External service metrics (Stripe, Twilio, SendGrid)
- Frontend can monitor system health via metrics endpoints

**Key Features**:
- HTTP request metrics (count, duration, size, active connections)
- Business metrics (bookings, payments, customers, notifications)
- Performance metrics (database queries, cache operations, response times)
- External service metrics (API calls, response times, error rates)
- System metrics (CPU, memory, disk usage, load average)

#### 9. **EnhancedLoggingMiddleware** (`middleware/enhanced_logging_middleware.py`)
**Purpose**: Structured logging with request tracing
**Files Using It**: All requests (globally applied)
**Impact on Frontend**:
- Structured JSON logging with tenant context
- Request tracing with correlation IDs
- Business event logging
- Performance event logging
- Security event logging
- Frontend can correlate logs using request IDs

**Key Features**:
- Structured logging with `structlog`
- Request context injection
- Business event logging (`log_business_event()`)
- Security event logging (`log_security_event()`)
- Performance event logging (`log_performance_event()`)

#### 10. **AuditMiddleware** (`middleware/audit_middleware.py`)
**Purpose**: Automatic audit logging for compliance
**Files Using It**: All authenticated requests
**Impact on Frontend**:
- Automatic audit trail for all data modifications
- Compliance-ready logging for regulatory requirements
- User action tracking for security
- Frontend actions are automatically audited

**Key Features**:
- Automatic audit action detection based on request patterns
- Comprehensive audit log creation
- Manual audit logging decorators
- Observability hooks for audit events
- Compliance-ready audit trail

### Security and Compliance Infrastructure

#### 11. **EncryptionMiddleware** (`middleware/encryption_middleware.py`)
**Purpose**: Field-level encryption for sensitive data
**Files Using It**: Models with PII data
**Impact on Frontend**:
- Automatic encryption/decryption of sensitive fields
- PII data protection for compliance
- Searchable hashing for encrypted data
- Frontend receives decrypted data automatically

**Key Features**:
- Field-level encryption using Fernet (AES 128)
- PBKDF2 key derivation with configurable iterations
- PII field management per model
- Searchable hashing for encrypted fields
- Automatic encryption/decryption in data access

#### 12. **FeatureFlagMiddleware** (`middleware/feature_flag_middleware.py`)
**Purpose**: Feature flag evaluation and context setting
**Files Using It**: All authenticated requests
**Impact on Frontend**:
- Feature flags available in request context
- Response headers: `X-Feature-Flags`, `X-Feature-Variants`
- A/B testing and gradual rollouts
- Frontend can adapt UI based on enabled features

**Key Features**:
- Automatic feature flag evaluation per request
- User and tenant-specific flag evaluation
- Feature variant support for A/B testing
- Response header injection for frontend consumption
- Decorator support for feature-gated endpoints

### External Service Integrations

#### 13. **Stripe Integration** (`services/financial.py`)
**Purpose**: Payment processing and billing
**Files Using It**: Payment endpoints, webhook handlers
**Impact on Frontend**:
- Payment intent creation and confirmation
- Webhook processing for payment events
- Customer payment method management
- Frontend integrates with Stripe Elements for payment UI

**Key Features**:
- Payment intent creation and confirmation
- Payment method management
- Webhook event processing
- Refund processing
- No-show fee capture
- Comprehensive error handling and retry logic

#### 14. **SendGrid Integration** (`services/email_service.py`)
**Purpose**: Email delivery with tenant branding
**Files Using It**: Notification system, booking confirmations
**Impact on Frontend**:
- Automated email notifications
- Tenant-branded email templates
- Email delivery tracking and analytics
- Frontend can trigger email notifications via API

**Key Features**:
- SendGrid API integration
- Tenant branding application
- Template management and rendering
- Delivery tracking and analytics
- Retry logic and error handling
- Quota enforcement

#### 15. **Twilio Integration** (`services/sms_service.py`)
**Purpose**: SMS delivery for notifications
**Files Using It**: Notification system, booking reminders
**Impact on Frontend**:
- SMS notifications for bookings
- Phone number validation
- Delivery tracking
- Frontend can trigger SMS notifications via API

**Key Features**:
- Twilio API integration
- SMS template management
- Phone number validation
- Delivery tracking
- Rate limiting and error handling

#### 16. **Supabase Integration** (`middleware/auth_middleware.py`)
**Purpose**: Authentication and user management
**Files Using It**: All authenticated endpoints
**Impact on Frontend**:
- JWT token validation
- User authentication
- Tenant context extraction
- Frontend uses Supabase for user authentication

**Key Features**:
- JWT token validation
- User context extraction
- Tenant context from JWT claims
- Authentication error handling

### Caching and Performance Infrastructure

#### 17. **CacheService** (`services/cache.py`)
**Purpose**: Redis-based caching with fallback
**Files Using It**: Availability calculations, booking holds, waitlist management
**Impact on Frontend**:
- Improved response times for availability queries
- Booking hold management
- Waitlist caching
- Frontend benefits from faster API responses

**Key Features**:
- Redis backend with in-memory fallback
- Distributed locking for concurrent operations
- TTL management and cache invalidation
- Specialized cache services (availability, booking holds, waitlist)
- Cache hit/miss metrics

#### 18. **AvailabilityCacheService** (`services/cache.py`)
**Purpose**: Availability calculation caching
**Files Using It**: Availability endpoints
**Impact on Frontend**:
- Faster availability slot calculations
- Reduced database load
- Configurable cache TTL
- Frontend gets faster availability responses

**Key Features**:
- Resource-specific availability caching
- Date-based cache keys
- Automatic cache invalidation
- Tenant-scoped cache isolation

#### 19. **BookingHoldCacheService** (`services/cache.py`)
**Purpose**: Booking hold management
**Files Using It**: Booking creation flow
**Impact on Frontend**:
- Prevents double-booking during checkout
- Configurable hold duration (default 15 minutes)
- Hold extension capabilities
- Frontend must handle hold expiration

**Key Features**:
- Booking hold creation and management
- Hold extension capabilities
- Automatic cleanup of expired holds
- Tenant-scoped hold isolation

### Background Job Processing

#### 20. **Celery Integration** (`extensions.py`)
**Purpose**: Asynchronous task processing
**Files Using It**: Email sending, automation, backups, compliance
**Impact on Frontend**:
- Asynchronous email/SMS delivery
- Background processing of heavy operations
- Task status tracking
- Frontend can trigger background tasks via API

**Key Features**:
- Redis-based task queue
- Task routing and priority management
- Retry logic with exponential backoff
- Task status tracking and monitoring
- Worker scaling and load balancing

#### 21. **EmailWorker** (`jobs/email_worker.py`)
**Purpose**: Asynchronous email processing
**Files Using It**: Email notification system
**Impact on Frontend**:
- Non-blocking email delivery
- Retry logic for failed emails
- Email delivery tracking
- Frontend gets immediate response for email triggers

**Key Features**:
- Asynchronous email sending
- Retry logic with exponential backoff
- Email delivery tracking
- Error handling and dead letter queue

#### 22. **AutomationWorker** (`jobs/automation_worker.py`)
**Purpose**: Business automation execution
**Files Using It**: Automation system
**Impact on Frontend**:
- Automated business workflows
- Scheduled task execution
- Automation monitoring
- Frontend can trigger and monitor automations

**Key Features**:
- Automation rule execution
- Scheduled task processing
- Event-driven automation triggers
- Automation monitoring and logging

### Alerting and Monitoring

#### 23. **AlertingService** (`services/alerting_service.py`)
**Purpose**: Comprehensive alerting for failures and performance issues
**Files Using It**: Error handlers, monitoring systems
**Impact on Frontend**:
- Real-time alerts for system issues
- Performance degradation notifications
- Provider outage alerts
- Frontend can receive alerts via webhooks

**Key Features**:
- Multi-channel alerting (Slack, email, webhooks)
- Configurable alert rules and thresholds
- Alert severity levels and routing
- Alert history and resolution tracking
- Business metric monitoring (error rates, response times, no-show rates)

#### 24. **ComplianceService** (`services/compliance_service.py`)
**Purpose**: GDPR compliance and data protection
**Files Using It**: Data access, user management
**Impact on Frontend**:
- GDPR-compliant data handling
- Data retention policies
- User consent management
- Frontend must handle consent and data deletion requests

**Key Features**:
- GDPR compliance automation
- Data retention policy enforcement
- User consent tracking
- Data anonymization and pseudonymization
- Audit trail for compliance

### Configuration and Environment Management

#### 25. **Configuration Management** (`config.py`)
**Purpose**: Environment-specific configuration
**Files Using It**: All application components
**Impact on Frontend**:
- Environment-specific API endpoints
- Feature flags and configuration
- External service configuration
- Frontend must adapt to environment-specific settings

**Key Features**:
- Environment-specific configuration classes
- Required configuration validation
- Secure defaults and secrets management
- 12-factor app compliance
- Configuration inheritance and overrides

#### 26. **Extensions Management** (`extensions.py`)
**Purpose**: Flask extensions initialization
**Files Using It**: Application startup
**Impact on Frontend**:
- Database connection management
- Redis connection management
- Celery task queue setup
- Frontend depends on backend service availability

**Key Features**:
- SQLAlchemy database initialization
- Redis client setup with fallback
- Celery task queue configuration
- CORS configuration
- Observability middleware initialization

### Security and Compliance Features

#### 27. **Row Level Security (RLS)**
**Purpose**: Database-level tenant isolation
**Files Using It**: All tenant-scoped models
**Impact on Frontend**:
- Automatic tenant data isolation
- Prevents cross-tenant data access
- Frontend can trust tenant isolation

**Key Features**:
- Database-level tenant isolation policies
- Automatic tenant context setting
- Cross-tenant access prevention
- Audit trail for security

#### 28. **Idempotency Keys**
**Purpose**: Request deduplication and reliability
**Files Using It**: Critical endpoints
**Impact on Frontend**:
- Prevents duplicate operations
- Reliable retry mechanisms
- Frontend must generate unique idempotency keys

**Key Features**:
- Request deduplication
- Response caching
- Retry safety
- 24-hour expiration

#### 29. **Audit Logging**
**Purpose**: Comprehensive audit trail
**Files Using It**: All data modifications
**Impact on Frontend**:
- Complete action tracking
- Compliance requirements
- Security monitoring
- Frontend actions are automatically audited

**Key Features**:
- Automatic audit log creation
- User action tracking
- Data change tracking
- Compliance-ready audit trail

### Cross-Cutting Impact Summary

#### **Frontend Integration Requirements**:

1. **Authentication**: Include `Authorization: Bearer <token>` header for all authenticated requests
2. **Tenant Context**: Use consistent routing patterns (`/v1/b/{slug}` or `subdomain.tithi.com`)
3. **Rate Limiting**: Implement exponential backoff for 429 responses
4. **Idempotency**: Include `Idempotency-Key` header for critical operations
5. **Error Handling**: Parse structured error responses with error codes
6. **Feature Flags**: Check `X-Feature-Flags` and `X-Feature-Variants` headers
7. **Request Tracing**: Include `X-Request-ID` header for correlation
8. **Monitoring**: Use `/metrics` endpoint for system health monitoring

#### **Security Considerations**:

1. **PII Protection**: Sensitive data automatically encrypted/decrypted
2. **Tenant Isolation**: Database-level isolation prevents cross-tenant access
3. **Audit Trail**: All actions automatically logged for compliance
4. **Error Tracking**: Comprehensive error monitoring with Sentry
5. **Rate Limiting**: Protection against abuse and DoS attacks

---

## 🖥️ Frontend Integration Guide (Module 6)

This section provides comprehensive guidance for frontend development, mapping all backend endpoints, data flows, and integration requirements to enable accurate frontend implementation without guessing.

### 1. Frontend Routing Map

#### **Authentication & Tenant Management**

| Frontend Route | Component | Backend Endpoint | Method | Auth Required | Tenant Required |
|---|---|---|---|---|---|
| `/login` | LoginPage | `/auth/login` | POST | No | No |
| `/register` | RegisterPage | `/auth/register` | POST | No | No |
| `/dashboard` | DashboardPage | `/api/v1/tenants` | GET | Yes | No |
| `/tenant/{slug}` | TenantDashboard | `/api/v1/tenants/{id}` | GET | Yes | Yes |
| `/onboarding` | OnboardingWizard | `/onboarding/register` | POST | Yes | No |
| `/onboarding/check-subdomain` | SubdomainCheck | `/onboarding/check-subdomain/{subdomain}` | GET | Yes | No |

#### **Core Business Operations**

| Frontend Route | Component | Backend Endpoint | Method | Auth Required | Tenant Required |
|---|---|---|---|---|---|
| `/services` | ServicesPage | `/api/v1/services` | GET | Yes | Yes |
| `/services/new` | ServiceForm | `/api/v1/services` | POST | Yes | Yes |
| `/services/{id}/edit` | ServiceForm | `/api/v1/services/{id}` | PUT | Yes | Yes |
| `/bookings` | BookingsPage | `/api/v1/bookings` | GET | Yes | Yes |
| `/bookings/new` | BookingForm | `/api/v1/bookings` | POST | Yes | Yes |
| `/bookings/{id}` | BookingDetails | `/api/v1/bookings/{id}` | GET | Yes | Yes |
| `/bookings/{id}/confirm` | BookingConfirmation | `/api/v1/bookings/{id}/confirm` | POST | Yes | Yes |
| `/customers` | CustomersPage | `/api/v1/customers` | GET | Yes | Yes |
| `/customers/new` | CustomerForm | `/api/v1/customers` | POST | Yes | Yes |

#### **Payment & Checkout**

| Frontend Route | Component | Backend Endpoint | Method | Auth Required | Tenant Required |
|---|---|---|---|---|---|
| `/checkout` | CheckoutPage | `/api/v1/payments/checkout` | POST | Yes | Yes |
| `/payment/confirm` | PaymentConfirmation | `/api/v1/payments/confirm` | POST | Yes | Yes |
| `/payment/methods` | PaymentMethodsPage | `/api/v1/payments/methods` | GET | Yes | Yes |

#### **Admin Dashboard**

| Frontend Route | Component | Backend Endpoint | Method | Auth Required | Tenant Required |
|---|---|---|---|---|---|
| `/admin/dashboard` | AdminDashboard | `/api/v1/admin/dashboard` | GET | Yes | Yes |
| `/admin/services` | AdminServicesPage | `/api/v1/admin/services` | GET | Yes | Yes |
| `/admin/services/bulk` | BulkServicesPage | `/api/v1/admin/services/bulk-update` | POST | Yes | Yes |
| `/admin/bookings` | AdminBookingsPage | `/api/v1/admin/bookings` | GET | Yes | Yes |
| `/admin/bookings/bulk` | BulkBookingsPage | `/api/v1/admin/bookings/bulk-actions` | POST | Yes | Yes |
| `/admin/analytics` | AnalyticsPage | `/api/v1/analytics/dashboard` | GET | Yes | Yes |
| `/admin/notifications` | NotificationsPage | `/api/v1/notifications/templates` | GET | Yes | Yes |

#### **Notifications & Communication**

| Frontend Route | Component | Backend Endpoint | Method | Auth Required | Tenant Required |
|---|---|---|---|---|---|
| `/notifications/email` | EmailNotifications | `/notifications/email/send` | POST | Yes | Yes |
| `/notifications/sms` | SMSNotifications | `/api/v1/notifications/sms/send` | POST | Yes | Yes |
| `/notifications/templates` | NotificationTemplates | `/api/v1/notifications/templates` | GET | Yes | Yes |

### 2. Forms & Data Collection Requirements

#### **Tenant Onboarding Form**
```typescript
interface OnboardingFormData {
  business_name: string;        // Required, max 255 chars
  category?: string;           // Optional, business category
  logo?: string;              // Optional, base64 or URL
  policies?: {
    cancellation_policy?: string;
    no_show_policy?: string;
    rescheduling_policy?: string;
    payment_policy?: string;
    refund_policy?: string;
  };
  owner_email: string;        // Required, valid email
  owner_name: string;         // Required, max 255 chars
  timezone?: string;          // Optional, default: UTC
  currency?: string;          // Optional, default: USD
  locale?: string;            // Optional, default: en_US
}
```

#### **Service Creation Form**
```typescript
interface ServiceFormData {
  name: string;               // Required, max 255 chars
  description?: string;       // Optional, max 1000 chars
  duration_min: number;      // Required, positive integer
  price_cents: number;       // Required, positive integer
  currency?: string;         // Optional, default: USD
  category?: string;         // Optional, max 100 chars
  buffer_before_min?: number; // Optional, non-negative integer
  buffer_after_min?: number;  // Optional, non-negative integer
  active?: boolean;          // Optional, default: true
}
```

#### **Booking Creation Form**
```typescript
interface BookingFormData {
  customer_id: string;        // Required, UUID
  resource_id: string;       // Required, UUID
  service_id: string;        // Required, UUID
  start_at: string;          // Required, ISO datetime
  end_at: string;            // Required, ISO datetime
  booking_tz: string;       // Required, timezone string
  attendee_count?: number;   // Optional, default: 1
  client_generated_id?: string; // Optional, max 255 chars
}
```

#### **Customer Information Form**
```typescript
interface CustomerFormData {
  display_name: string;      // Required, max 255 chars
  email: string;             // Required, valid email
  phone?: string;            // Optional, max 50 chars
  marketing_opt_in?: boolean; // Optional, default: false
  notification_preferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
}
```

#### **Payment Form**
```typescript
interface PaymentFormData {
  booking_id: string;        // Required, UUID
  payment_method: string;   // Required, 'card' | 'cash'
  customer_id?: string;     // Optional, UUID
  idempotency_key?: string;  // Optional, UUID
  coupon_code?: string;     // Optional, max 50 chars
  gift_card_code?: string;   // Optional, max 50 chars
}
```

### 3. Payment Flow Integration

#### **Stripe Integration Flow**
1. **Create Payment Intent**: `POST /api/v1/payments/checkout`
   - Payload: `{booking_id, payment_method, customer_id?, idempotency_key?}`
   - Response: `{payment_intent_id, client_secret, amount_cents, currency}`
   - Headers: `Authorization: Bearer <token>`, `Idempotency-Key: <uuid>`

2. **Confirm Payment**: `POST /api/v1/payments/confirm`
   - Payload: `{payment_intent_id, payment_method_id?}`
   - Response: `{status, payment_id, booking_id, amount_cents}`
   - Headers: `Authorization: Bearer <token>`

3. **Handle Payment Status**:
   - `requires_action`: Show 3D Secure challenge
   - `succeeded`: Redirect to confirmation page
   - `failed`: Show error message, allow retry
   - `canceled`: Return to booking form

#### **Cash Payment Flow**
1. **Mark as Cash**: `POST /api/v1/payments/cash`
   - Payload: `{booking_id, amount_cents, currency}`
   - Response: `{payment_id, status: 'pending', booking_id}`
   - Headers: `Authorization: Bearer <token>`

2. **Admin Confirmation**: Admin marks payment as completed via admin dashboard

#### **Customer Disclaimers**
- **No-Show Policy**: Display tenant's default no-show fee (3% default)
- **Cancellation Policy**: Show tenant-specific cancellation terms
- **Payment Terms**: Display payment due date and methods accepted

### 4. Booking Flow Integration

#### **Complete Booking Lifecycle**

1. **Service Selection**:
   - `GET /api/v1/services` → Display service catalog
   - Filter by category, price, duration
   - Show availability calendar

2. **Availability Check**:
   - `GET /api/v1/availability?service_id={id}&date={date}` → Check available slots
   - Display time slots with pricing
   - Handle timezone conversion

3. **Customer Information**:
   - Create customer: `POST /api/v1/customers` (if new)
   - Or lookup existing: `GET /api/v1/customers?email={email}`

4. **Booking Creation**:
   - `POST /api/v1/bookings` → Create pending booking
   - Response: `{booking_id, status: 'pending', total_amount_cents}`

5. **Payment Processing**:
   - `POST /api/v1/payments/checkout` → Create payment intent
   - Handle Stripe payment flow
   - Confirm payment: `POST /api/v1/payments/confirm`

6. **Booking Confirmation**:
   - `POST /api/v1/bookings/{id}/confirm` → Confirm booking
   - Send confirmation email: `POST /notifications/email/booking/{id}/confirmation`
   - Send SMS reminder: `POST /api/v1/notifications/sms/send`

#### **Admin Booking Management**

1. **View Bookings**:
   - `GET /api/v1/admin/bookings` → List all bookings
   - Filter by status, date range, customer
   - Display booking details with customer info

2. **Bulk Actions**:
   - `POST /api/v1/admin/bookings/bulk-actions` → Bulk operations
   - Actions: `confirm`, `cancel`, `reschedule`, `message`
   - Payload: `{action, booking_ids, action_data?}`

3. **Individual Booking Updates**:
   - `PUT /api/v1/admin/bookings/{id}` → Update specific booking
   - Payload: `{update_fields: {status?, start_at?, end_at?, notes?}}`

### 5. Onboarding Integration

#### **Tenant Registration Flow**

1. **Business Information**:
   - `POST /onboarding/register` → Create tenant
   - Auto-generate subdomain from business name
   - Validate subdomain uniqueness

2. **Subdomain Check**:
   - `GET /onboarding/check-subdomain/{subdomain}` → Check availability
   - Real-time validation during typing
   - Suggest alternatives if taken

3. **Default Setup**:
   - Create default theme and branding
   - Set up default policies
   - Initialize Stripe Connect (if needed)

4. **Response Structure**:
```typescript
interface OnboardingResponse {
  id: string;                 // Tenant UUID
  business_name: string;
  slug: string;              // Subdomain slug
  subdomain: string;         // Full subdomain
  category?: string;
  logo?: string;
  timezone: string;
  currency: string;
  locale: string;
  status: 'active';
  created_at: string;        // ISO datetime
  updated_at: string;       // ISO datetime
  is_existing: boolean;      // Whether tenant already existed
}
```

### 6. Admin Dashboard Integration

#### **Dashboard Overview**
- `GET /api/v1/admin/dashboard` → Get dashboard metrics
- Display: bookings count, revenue, customer metrics, service utilization

#### **Services Management**
- `GET /api/v1/admin/services` → List all services
- `POST /api/v1/admin/services/bulk-update` → Bulk service updates
- Features: search, filter by category, bulk activate/deactivate

#### **Booking Management**
- `GET /api/v1/admin/bookings` → List all bookings
- `POST /api/v1/admin/bookings/bulk-actions` → Bulk booking actions
- Features: status filtering, date range selection, customer search

#### **Analytics Integration**
- `GET /api/v1/analytics/dashboard` → Dashboard metrics
- `GET /api/v1/analytics/revenue` → Revenue analytics
- `GET /api/v1/analytics/bookings` → Booking analytics
- Display: charts, trends, performance metrics

### 7. Notifications Integration

#### **Email Notifications**
- `POST /notifications/email/send` → Send email
- `POST /notifications/email/booking/{id}/{event_type}` → Booking-specific emails
- Event types: `confirmation`, `reminder`, `cancellation`, `reschedule`

#### **SMS Notifications**
- `POST /api/v1/notifications/sms/send` → Send SMS
- Payload: `{customer_id?, phone, message, event_type?, scheduled_at?, metadata?}`
- Features: opt-out handling, delivery status tracking

#### **Notification Templates**
- `GET /api/v1/notifications/templates` → List templates
- `POST /api/v1/notifications/templates` → Create template
- Support for: email, SMS, push notifications

### 8. Error Handling & Alerts

#### **Backend Error Codes → Frontend Behavior**

| Error Code | HTTP Status | Frontend Action | User Message |
|---|---|---|---|
| `TITHI_AUTH_TOKEN_MISSING` | 401 | Redirect to login | "Please log in to continue" |
| `TITHI_AUTH_TOKEN_EXPIRED` | 401 | Refresh token or redirect | "Session expired, please log in again" |
| `TITHI_TENANT_NOT_FOUND` | 404 | Show tenant error page | "Business not found" |
| `TITHI_BOOKING_NOT_FOUND` | 404 | Show booking error | "Booking not found" |
| `TITHI_VALIDATION_ERROR` | 400 | Show field errors | Display specific field validation errors |
| `TITHI_PAYMENT_STRIPE_ERROR` | 502 | Show payment error | "Payment processing error, please try again" |
| `TITHI_SERVICE_NOT_FOUND` | 404 | Show service error | "Service not available" |
| `TITHI_CUSTOMER_NOT_FOUND` | 404 | Show customer error | "Customer not found" |
| `TITHI_RATE_LIMIT_EXCEEDED` | 429 | Show rate limit message | "Too many requests, please wait" |
| `TITHI_FEATURE_NOT_AVAILABLE` | 403 | Hide feature | "Feature not available" |

#### **Error Response Structure**
```typescript
interface ErrorResponse {
  type: string;              // Error type URI
  title: string;             // Error title
  detail: string;            // Error message
  status: number;            // HTTP status code
  code: string;              // Error code
  details: object;           // Additional error details
  instance: string;          // Request URL
  tenant_id?: string;        // Tenant context
  user_id?: string;          // User context
}
```

### 9. State Management Notes

#### **Caching Strategy**
- **Services**: Cache service catalog (5 minutes)
- **Availability**: Cache availability data (1 minute)
- **Customer Data**: Cache customer info (10 minutes)
- **Booking Data**: Cache booking details (2 minutes)
- **Admin Data**: Cache admin metrics (5 minutes)

#### **Live Data Requirements**
- **Payment Status**: Always fetch live payment status
- **Booking Status**: Real-time booking status updates
- **Notification Status**: Live notification delivery status
- **Admin Actions**: Real-time admin action results

#### **Data Dependencies**
- **Services → Availability**: Services must be loaded before checking availability
- **Customer → Booking**: Customer must exist before creating booking
- **Booking → Payment**: Booking must be created before payment
- **Payment → Confirmation**: Payment must succeed before booking confirmation

### 10. Narrative Walkthrough Examples

#### **Customer Booking Flow**
```
1. Customer visits tenant subdomain (e.g., salon.tithi.com)
2. Frontend calls GET /api/v1/services to display service catalog
3. Customer selects service, frontend calls GET /api/v1/availability?service_id={id}&date={date}
4. Customer selects time slot, frontend shows booking form
5. Customer enters details, frontend calls POST /api/v1/customers (if new customer)
6. Frontend calls POST /api/v1/bookings to create pending booking
7. Frontend calls POST /api/v1/payments/checkout to create payment intent
8. Customer completes Stripe payment, frontend calls POST /api/v1/payments/confirm
9. Frontend calls POST /api/v1/bookings/{id}/confirm to confirm booking
10. Frontend calls POST /notifications/email/booking/{id}/confirmation to send confirmation
11. Customer sees confirmation page with booking details
```

#### **Admin Dashboard Flow**
```
1. Admin logs in and selects tenant
2. Frontend calls GET /api/v1/admin/dashboard to load dashboard metrics
3. Admin navigates to bookings, frontend calls GET /api/v1/admin/bookings
4. Admin selects multiple bookings for bulk action
5. Frontend calls POST /api/v1/admin/bookings/bulk-actions with action='confirm'
6. Admin updates individual booking, frontend calls PUT /api/v1/admin/bookings/{id}
7. Admin sends message to customers, frontend calls POST /api/v1/admin/bookings/send-message
8. Admin views analytics, frontend calls GET /api/v1/analytics/dashboard
9. Admin manages services, frontend calls GET /api/v1/admin/services
10. Admin performs bulk service updates, frontend calls POST /api/v1/admin/services/bulk-update
```

#### **Tenant Onboarding Flow**
```
1. User visits onboarding page after registration
2. Frontend shows business information form
3. User enters business name, frontend calls GET /onboarding/check-subdomain/{subdomain} for real-time validation
4. User completes form, frontend calls POST /onboarding/register
5. Backend creates tenant, generates subdomain, sets up defaults
6. Frontend receives tenant data and redirects to tenant dashboard
7. Frontend calls GET /api/v1/tenants/{id} to load tenant details
8. User can now access tenant-specific features and admin dashboard
```

### 11. Authentication & Security Requirements

#### **JWT Token Handling**
- **Header Format**: `Authorization: Bearer <token>`
- **Token Refresh**: Implement automatic token refresh before expiration
- **Error Handling**: Handle 401 responses by redirecting to login
- **Tenant Context**: Include tenant_id in JWT payload for multi-tenant support

#### **Request Headers**
```typescript
interface RequestHeaders {
  'Authorization': string;           // Bearer token
  'Content-Type': 'application/json';
  'X-Request-ID'?: string;          // Request correlation ID
  'Idempotency-Key'?: string;        // For critical operations
  'X-Feature-Flags'?: string;       // Feature flag context
  'X-Tenant-ID'?: string;           // Tenant context (if not in JWT)
}
```

#### **Rate Limiting**
- **429 Responses**: Implement exponential backoff
- **Retry Logic**: Maximum 3 retries with increasing delays
- **User Feedback**: Show "Please wait" message during rate limiting

### 12. Integration Checklist

#### **Before Frontend Development**
- [ ] Set up JWT authentication flow
- [ ] Implement tenant context handling
- [ ] Set up error handling for all error codes
- [ ] Configure Stripe payment integration
- [ ] Set up notification templates
- [ ] Implement idempotency key generation

#### **During Development**
- [ ] Test all API endpoints with proper authentication
- [ ] Validate all form data against backend schemas
- [ ] Implement proper error handling for each endpoint
- [ ] Test payment flows with Stripe test mode
- [ ] Verify tenant isolation in all requests
- [ ] Test notification delivery and templates

#### **Before Production**
- [ ] Switch to Stripe live mode
- [ ] Configure production notification templates
- [ ] Set up monitoring and error tracking
- [ ] Test all admin dashboard features
- [ ] Verify tenant onboarding flow
- [ ] Test bulk operations and admin actions

---

**⚡ End Result**: This Frontend Integration Guide provides complete step-by-step instructions for building all frontend pages, components, and flows. The frontend team can now implement:

- Complete routing structure with backend endpoint mapping
- All form validation and data collection requirements  
- Full payment flow integration with Stripe and cash options
- Complete booking lifecycle from service selection to confirmation
- Tenant onboarding wizard with subdomain generation
- Comprehensive admin dashboard with all management features
- Email and SMS notification integration
- Proper error handling and user feedback
- State management and caching strategies
- Security and authentication requirements

The frontend can be built accurately without guessing, with full knowledge of backend capabilities, data structures, and integration requirements.

#### **Performance Optimizations**:

1. **Caching**: Redis-based caching improves response times
2. **Background Jobs**: Asynchronous processing prevents blocking
3. **Metrics**: Comprehensive monitoring for performance optimization
4. **Connection Pooling**: Database and Redis connection management
5. **CDN Integration**: Static asset optimization

This comprehensive cross-cutting concerns map provides the frontend team with complete visibility into all middleware, utilities, external integrations, security measures, and infrastructure components that affect requests, responses, error handling, authentication, and external services throughout the Tithi backend system.
