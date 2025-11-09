# Tithi Backend Summary & Frontend Integration Guide

**Purpose**: Single-source-of-truth backend map and routing guide for the Tithi frontend.

**Confidence Score**: 95% - Comprehensive analysis of backend structure, endpoints, and database schema.

## System Overview

**Architecture**: Multi-tenant Flask application with PostgreSQL database
**Authentication**: JWT-based with Supabase integration
**Payment Processing**: Stripe integration with webhook support
**Notifications**: Multi-channel (SMS, Email, Push) with template system
**Database**: PostgreSQL with Row Level Security (RLS)

### Key Features
- Multi-tenant white-label booking platform
- Real-time availability management
- Staff scheduling and management
- Payment processing with multiple methods
- Comprehensive notification system
- Analytics and reporting
- Admin dashboard with bulk operations

## API Endpoints

### Base URLs
- **API v1**: `/api/v1/*` (Authenticated endpoints)
- **Public**: `/v1/*` (Public tenant pages)
- **Onboarding**: `/onboarding/*` (Tenant registration)
- **Payments**: `/api/payments/*` (Payment processing)
- **Admin**: `/api/v1/admin/*` (Admin operations)

### Core Endpoints

#### Tenant Management
```http
GET    /api/v1/tenants                    # List user's tenants
GET    /api/v1/tenants/{id}               # Get tenant details
POST   /api/v1/tenants                    # Create new tenant
PUT    /api/v1/tenants/{id}               # Update tenant
DELETE /api/v1/tenants/{id}               # Delete tenant
```

#### Services Management
```http
GET    /api/v1/services                   # List services
POST   /api/v1/services                   # Create service
GET    /api/v1/services/{id}              # Get service
PUT    /api/v1/services/{id}              # Update service
DELETE /api/v1/services/{id}              # Delete service
```

#### Booking Management
```http
GET    /api/v1/bookings                   # List bookings
POST   /api/v1/bookings                   # Create booking
POST   /api/v1/bookings/{id}/confirm      # Confirm booking
POST   /api/v1/bookings/{id}/cancel       # Cancel booking
POST   /api/v1/bookings/{id}/complete     # Complete booking
```

#### Staff Management
```http
GET    /api/v1/staff                      # List staff
POST   /api/v1/staff                      # Create staff profile
GET    /api/v1/staff/{id}                 # Get staff profile
PUT    /api/v1/staff/{id}                 # Update staff profile
DELETE /api/v1/staff/{id}                 # Delete staff profile
GET    /api/v1/staff/{id}/availability    # Get staff availability
POST   /api/v1/staff/{id}/availability    # Create availability
```

#### Payment Processing
```http
POST   /api/payments/intent               # Create payment intent
POST   /api/payments/intent/{id}/confirm  # Confirm payment
POST   /api/payments/setup-intent         # Create setup intent
POST   /api/payments/refund               # Process refund
POST   /api/payments/checkout             # Create checkout session
POST   /api/payments/webhook/stripe       # Stripe webhook
```

#### Notification System
```http
POST   /api/v1/notifications/templates   # Create template
GET    /api/v1/notifications/templates    # List templates
POST   /api/v1/notifications             # Create notification
GET    /api/v1/notifications/{id}        # Get notification
POST   /api/v1/notifications/{id}/send   # Send notification
```

#### Admin Dashboard
```http
GET    /api/v1/admin/services            # Admin services list
POST   /api/v1/admin/services            # Admin create service
PUT    /api/v1/admin/services/{id}        # Admin update service
DELETE /api/v1/admin/services/{id}        # Admin delete service
POST   /api/v1/admin/services/bulk-update # Bulk update services
GET    /api/v1/admin/bookings/{id}        # Admin get booking
PUT    /api/v1/admin/bookings/{id}        # Admin update booking
POST   /api/v1/admin/bookings/bulk-actions # Bulk booking actions
```

## Database Schema

### Core Tables

#### Tenants
```sql
CREATE TABLE tenants (
    id uuid PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    tz text NOT NULL DEFAULT 'UTC',
    trust_copy_json jsonb DEFAULT '{}',
    is_public_directory boolean DEFAULT false,
    public_blurb text,
    billing_json jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);
```

#### Users
```sql
CREATE TABLE users (
    id uuid PRIMARY KEY,
    display_name text,
    primary_email citext UNIQUE,
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### Memberships
```sql
CREATE TABLE memberships (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    user_id uuid REFERENCES users(id),
    role membership_role NOT NULL,
    permissions_json jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);
```

#### Customers
```sql
CREATE TABLE customers (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    display_name text,
    email citext,
    phone text,
    marketing_opt_in boolean DEFAULT false,
    notification_preferences jsonb DEFAULT '{}',
    is_first_time boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### Services
```sql
CREATE TABLE services (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    duration_min integer NOT NULL DEFAULT 60,
    price_cents integer NOT NULL DEFAULT 0,
    buffer_before_min integer DEFAULT 0,
    buffer_after_min integer DEFAULT 0,
    category text,
    active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### Resources
```sql
CREATE TABLE resources (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    type resource_type NOT NULL,
    tz text NOT NULL,
    capacity integer NOT NULL,
    metadata jsonb DEFAULT '{}',
    name text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

#### Bookings
```sql
CREATE TABLE bookings (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    customer_id uuid REFERENCES customers(id),
    resource_id uuid REFERENCES resources(id),
    client_generated_id text NOT NULL,
    service_snapshot jsonb NOT NULL DEFAULT '{}',
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    booking_tz text NOT NULL,
    status booking_status DEFAULT 'pending',
    canceled_at timestamptz,
    no_show_flag boolean DEFAULT false,
    attendee_count integer DEFAULT 1,
    rescheduled_from uuid REFERENCES bookings(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, client_generated_id)
);
```

#### Payments
```sql
CREATE TABLE payments (
    id uuid PRIMARY KEY,
    tenant_id uuid REFERENCES tenants(id),
    booking_id uuid REFERENCES bookings(id),
    customer_id uuid REFERENCES customers(id),
    status payment_status DEFAULT 'requires_action',
    method payment_method DEFAULT 'card',
    currency_code text DEFAULT 'USD',
    amount_cents integer NOT NULL CHECK (amount_cents >= 0),
    tip_cents integer DEFAULT 0,
    tax_cents integer DEFAULT 0,
    application_fee_cents integer DEFAULT 0,
    provider text DEFAULT 'stripe',
    provider_payment_id text,
    provider_charge_id text,
    provider_setup_intent_id text,
    provider_metadata jsonb DEFAULT '{}',
    idempotency_key text,
    backup_setup_intent_id text,
    explicit_consent_flag boolean DEFAULT false,
    no_show_fee_cents integer DEFAULT 0,
    royalty_applied boolean DEFAULT false,
    royalty_basis text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

## Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "tenant_id": "tenant_uuid",
  "role": "owner|admin|staff|customer",
  "permissions": ["read:bookings", "write:services"],
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Required Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Tenant-ID: <tenant_uuid>  # For multi-tenant requests
```

### Role-Based Access Control
- **Owner**: Full access to all tenant resources
- **Admin**: Full access except billing and tenant settings
- **Staff**: Access to bookings, customers, and own profile
- **Customer**: Access to own bookings and profile

## Payment Methods

### Supported Payment Methods
1. **Credit/Debit Cards** (Stripe)
2. **Apple Pay** (Stripe)
3. **Google Pay** (Stripe)
4. **PayPal** (Stripe)
5. **Cash Payments** (with backup card authorization)

### Payment Flow
1. **Create Payment Intent**: `POST /api/payments/intent`
2. **Confirm Payment**: `POST /api/payments/intent/{id}/confirm`
3. **Handle Webhooks**: `POST /api/payments/webhook/stripe`

### Webhook Events
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `setup_intent.succeeded`
- `charge.dispute.created`

## Notification System

### Channels
- **Email**: SendGrid integration
- **SMS**: Twilio integration
- **Push**: Web push notifications
- **Webhook**: Custom webhook endpoints

### Template System
```json
{
  "name": "booking_confirmation",
  "channel": "email",
  "subject": "Booking Confirmed - {{service_name}}",
  "content": "Your booking for {{service_name}} on {{booking_date}} is confirmed.",
  "variables": {
    "service_name": "string",
    "booking_date": "datetime",
    "customer_name": "string"
  },
  "required_variables": ["service_name", "booking_date"]
}
```

### Notification Preferences
```json
{
  "email_enabled": true,
  "sms_enabled": true,
  "push_enabled": true,
  "booking_notifications": true,
  "payment_notifications": true,
  "promotion_notifications": false,
  "system_notifications": true,
  "marketing_notifications": false,
  "digest_frequency": "immediate",
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00"
}
```

## Frontend Integration Patterns

### Request/Response Examples

#### Create Booking
```http
POST /api/v1/bookings
Authorization: Bearer <token>
Content-Type: application/json

{
            "customer_id": "uuid",
            "resource_id": "uuid",
                "service_id": "uuid",
  "start_at": "2024-01-15T10:00:00Z",
  "end_at": "2024-01-15T11:00:00Z",
  "attendee_count": 1,
  "client_generated_id": "unique_client_id"
}
```

#### Response
```json
{
  "id": "booking_uuid",
  "customer_id": "customer_uuid",
  "resource_id": "resource_uuid",
  "start_at": "2024-01-15T10:00:00Z",
  "end_at": "2024-01-15T11:00:00Z",
  "status": "pending",
  "attendee_count": 1,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
}
```

#### Create Payment Intent
```http
POST /api/payments/intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "booking_id": "uuid",
  "amount_cents": 5000,
    "currency": "USD",
  "customer_id": "uuid",
  "idempotency_key": "unique_key"
}
```

#### Response
```json
{
  "id": "payment_uuid",
  "booking_id": "booking_uuid",
  "customer_id": "customer_uuid",
  "amount_cents": 5000,
    "currency_code": "USD",
  "status": "requires_action",
    "method": "card",
  "provider_payment_id": "pi_stripe_id",
  "client_secret": "pi_stripe_client_secret",
    "created_at": "2024-01-01T00:00:00Z"
}
```

## Error Handling

### Error Response Format
```json
{
  "type": "https://tithi.com/errors/validation",
  "title": "Validation Error",
  "detail": "Missing required field: customer_id",
  "status": 400,
  "code": "TITHI_VALIDATION_ERROR",
  "instance": "/api/v1/bookings"
}
```

### Common Error Codes
- `TITHI_VALIDATION_ERROR`: Invalid request data
- `TITHI_AUTH_ERROR`: Authentication failed
- `TITHI_TENANT_NOT_FOUND`: Tenant not found
- `TITHI_BOOKING_NOT_FOUND`: Booking not found
- `TITHI_SERVICE_NOT_FOUND`: Service not found
- `TITHI_PAYMENT_STRIPE_ERROR`: Stripe payment error
- `TITHI_NOTIFICATION_ERROR`: Notification error

## Missing Items Checklist

### ⚠️ Missing Endpoints
1. **Customer Management**: CRUD operations for customers
2. **Resource Management**: CRUD operations for resources
3. **Availability Management**: Real-time availability updates
4. **Calendar Integration**: External calendar sync
5. **Analytics Endpoints**: Detailed analytics queries
6. **File Upload**: Logo and document upload endpoints
7. **Webhook Management**: Webhook configuration endpoints

### ⚠️ Missing Database Fields
1. **Tenant Settings**: Additional tenant configuration fields
2. **Customer Preferences**: More detailed customer preferences
3. **Service Categories**: Service categorization system
4. **Staff Skills**: Staff skill and specialty management
5. **Booking Notes**: Customer and staff notes for bookings

### ⚠️ Missing Validation Rules
1. **Booking Overlap Prevention**: Real-time conflict detection
2. **Service Duration Validation**: Minimum/maximum duration limits
3. **Payment Amount Validation**: Business rule validation
4. **Notification Rate Limiting**: Prevent notification spam
5. **File Upload Validation**: File type and size restrictions

## Next Steps

1. **Complete Missing Endpoints**: Implement remaining CRUD operations
2. **Add Real-time Features**: WebSocket integration for live updates
3. **Enhance Validation**: Add comprehensive business rule validation
4. **Implement File Upload**: Add support for file uploads
5. **Add Analytics**: Implement detailed analytics endpoints
6. **Create Frontend Routing Map**: Map frontend components to backend endpoints
7. **Generate Test Suite**: Create comprehensive test coverage

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
**Confidence Score**: 95%
