# 🗺️ Tithi Backend Executor Map

**Purpose**: This document provides AI executors with a complete understanding of the Tithi backend architecture to build the complimentary frontend effectively.

---

## 📋 Table of Contents

1. [Quick Start & Overview](#quick-start--overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Database Models & Relationships](#database-models--relationships)
4. [API Endpoints](#api-endpoints)
5. [Business Logic Flow](#business-logic-flow)
6. [Authentication & Authorization](#authentication--authorization)
7. [Multi-Tenancy & Data Isolation](#multi-tenancy--data-isolation)
8. [Frontend Integration Guide](#frontend-integration-guide)

---

## 🚀 Quick Start & Overview

### What is Tithi?
Multi-tenant salon/spa booking platform where:
- **Business owners** sign up and complete an 8-step onboarding
- **Each business** gets a unique subdomain (e.g., `salon.tithi.com`)
- **Customers** book services through public booking pages
- **Payments** use Stripe with manual capture (business controls charges)
- **Businesses** pay $11.99/month subscription per location

### Backend Architecture Summary
```
┌─────────────────────────────────────────────────────────┐
│                    Flask Backend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Blueprints  │→ │   Services   │→ │   Models     │ │
│  │  (API Routes)│  │ (Business    │  │  (Database)  │ │
│  │              │  │   Logic)     │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│           ↓                  ↓                 ↓         │
│    Flask-Smorest     SQLAlchemy 2.x     PostgreSQL      │
│    (OpenAPI docs)    (ORM)              (Database)      │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture & Tech Stack

### Tech Stack
- **Language**: Python 3.11+
- **Framework**: Flask 2.3+ with Flask-Smorest
- **ORM**: SQLAlchemy 2.0.23
- **Database**: PostgreSQL (via Supabase)
- **Cache**: Redis 5.0.1
- **Background Jobs**: Celery 5.3.4
- **Auth**: Supabase Auth (JWT-based)
- **Payments**: Stripe 7.8.0
- **Notifications**: SendGrid (email), Twilio (SMS)
- **Monitoring**: Sentry, Prometheus

### Key Design Principles
1. **Multi-tenant by construction**: All data scoped to `tenant_id`
2. **Blueprints per domain**: Modular, separate concerns
3. **Service layer**: Business logic separated from routes
4. **RLS (Row Level Security)**: Database-level tenant isolation
5. **API-first**: RESTful endpoints with OpenAPI docs
6. **Manual payment capture**: Business owners control all charges
7. **Subscription model**: $11.99/month per business

### Project Structure
```
backend/
├── index.py                    # Entry point
├── app/
│   ├── __init__.py            # Flask factory
│   ├── config.py              # Configuration
│   ├── extensions.py          # Flask extensions
│   ├── blueprints/            # API routes (23 blueprints)
│   │   ├── auth.py
│   │   ├── comprehensive_onboarding_api.py
│   │   ├── booking_flow_api.py
│   │   ├── payment_api.py
│   │   ├── admin_dashboard_api.py
│   │   └── ...
│   ├── models/                # Database models (23 models)
│   │   ├── core.py           # Tenants, Users, Memberships
│   │   ├── business.py       # Services, Customers, Bookings
│   │   ├── financial.py      # Payments, Refunds, Billing
│   │   ├── onboarding.py     # Onboarding flow models
│   │   ├── booking_flow.py   # Booking flow models
│   │   └── ...
│   ├── services/              # Business logic (34 services)
│   │   ├── core.py
│   │   ├── onboarding_service.py
│   │   ├── booking_flow_service.py
│   │   ├── financial.py
│   │   └── ...
│   ├── middleware/            # Custom middleware (14 files)
│   │   ├── auth_middleware.py
│   │   ├── tenant_middleware.py
│   │   ├── rate_limit_middleware.py
│   │   └── ...
│   └── jobs/                  # Background jobs (7 files)
├── migrations/                # Alembic migrations (50+ files)
└── tests/                     # Test suite (63+ files)
```

---

## 🗄️ Database Models & Relationships

### Core Entities

#### 1. **Tenant** (Business/Organization)
```python
class Tenant(GlobalModel):
    # Identification
    id: UUID
    slug: String              # Unique identifier (e.g., "salon-name")
    subdomain: String         # e.g., "salon.tithi.com"
    
    # Business Info
    name: String              # Business name
    email: String             # Business email
    phone: String             # Business phone
    legal_name: String        # DBA/legal name
    category: String          # Business category
    description: Text         # Business description
    
    # Location & Branding
    business_timezone: String # e.g., "America/New_York"
    address_json: JSON        # Full address
    logo_url: String          # Logo URL
    branding_json: JSON       # Colors, fonts, theme
    
    # Social & Policies
    social_links_json: JSON   # Instagram, Facebook, etc.
    policies_json: JSON       # Cancellation, no-show policies
    
    # Status
    status: Enum              # onboarding | ready | active
    is_public_directory: Boolean
    
    # Relationships
    users: relationship("User")                    # Owners/admins
    services: relationship("Service")              # Services offered
    team_members: relationship("TeamMember")       # Staff
    bookings: relationship("Booking")              # All bookings
    customers: relationship("Customer")            # Customer list
    onboarding_progress: relationship("OnboardingProgress")
```

#### 2. **User** (Platform Users - Business Owners/Admins)
```python
class User(GlobalModel):
    # Identification
    id: UUID
    
    # Account Info
    email: String (unique)    # Login email
    password_hash: String     # Hashed password
    first_name: String
    last_name: String
    display_name: String
    phone: String
    avatar_url: String
    
    # Relationships
    tenants: relationship("Tenant")      # Businesses they own/admin
    memberships: relationship("Membership")  # Tenant memberships
```

#### 3. **Membership** (User-Tenant relationship)
```python
class Membership(GlobalModel):
    tenant_id: UUID
    user_id: UUID
    role: Enum               # owner | admin | staff | viewer
    
    # Constraints: unique (tenant_id, user_id)
```

#### 4. **Customer** (End Customers)
```python
class Customer(TenantModel):
    # Scoped to tenant
    tenant_id: UUID
    id: UUID
    
    # Contact Info
    display_name: String
    email: String
    phone: String
    
    # Preferences
    marketing_opt_in: Boolean
    notification_preferences: JSON
    
    # Relationships
    bookings: relationship("Booking")
    payment_methods: relationship("PaymentMethod")
```

### Business Entities

#### 5. **Service** (Bookable Services)
```python
class Service(TenantModel):
    # Scoped to tenant
    tenant_id: UUID
    id: UUID
    
    # Service Info
    name: String
    description: Text
    short_description: Text      # For booking flow
    category: String             # Legacy category
    category_id: UUID            # Link to ServiceCategory
    duration_min: Integer        # Duration in minutes
    price_cents: Integer         # Price in cents
    
    # Display
    image_url: String
    instructions: Text           # Pre-appointment instructions
    is_featured: Boolean
    sort_order: Integer
    
    # Booking Rules
    requires_team_member_selection: Boolean
    allow_group_booking: Boolean
    max_group_size: Integer
    
    # Status
    active: Boolean
    deleted_at: DateTime
    
    # Relationships
    category: relationship("ServiceCategory")
    team_assignments: relationship("ServiceTeamAssignment")
```

#### 6. **ServiceCategory**
```python
class ServiceCategory(TenantModel):
    name: String
    description: Text
    color: String                # Hex color
    sort_order: Integer
    
    # Relationships
    services: relationship("Service")  # All services in category
```

#### 7. **TeamMember** (Staff)
```python
class TeamMember(TenantModel):
    # Staff Info
    first_name: String
    last_name: String
    email: String
    phone: String
    role: String                 # owner | admin | staff
    bio: Text
    specialties: JSON            # Array of specialties
    
    # Display
    profile_image_url: String
    display_name: String
    
    # Settings
    is_active: Boolean
    max_concurrent_bookings: Integer
    buffer_time_minutes: Integer
    
    # Relationships
    availability: relationship("TeamMemberAvailability")
```

#### 8. **Booking**
```python
class Booking(TenantModel):
    # Core booking data
    customer_id: UUID
    resource_id: UUID            # Team member/staff
    service_snapshot: JSON       # Service data at booking time
    
    # Time
    start_at: DateTime
    end_at: DateTime
    booking_tz: String
    
    # Status
    status: Enum  # pending | confirmed | checked_in | completed | 
                  # canceled | no_show | failed
    
    # Metadata
    no_show_flag: Boolean
    attendee_count: Integer
    canceled_at: DateTime
    
    # Relationships
    customer: relationship("Customer")
    payments: relationship("Payment")
    booking_items: relationship("BookingItem")
```

### Financial Entities

#### 9. **Payment**
```python
class Payment(TenantModel):
    # Core payment data
    booking_id: UUID
    customer_id: UUID
    status: Enum  # requires_action | authorized | captured | 
                  # refunded | canceled | failed
    
    # Amounts
    amount_cents: Integer
    tip_cents: Integer
    tax_cents: Integer
    application_fee_cents: Integer  # Platform fee (1%)
    no_show_fee_cents: Integer
    
    # Method
    method: Enum  # card | cash | apple_pay | paypal | other
    currency_code: String
    
    # Stripe Integration
    provider: String              # "stripe"
    provider_payment_id: String   # PaymentIntent ID
    provider_charge_id: String    # Charge ID
    provider_setup_intent_id: String  # SetupIntent ID
    provider_metadata: JSON
    
    # Safety
    idempotency_key: String (unique)
    explicit_consent_flag: Boolean
```

#### 10. **Refund**
```python
class Refund(TenantModel):
    payment_id: UUID
    booking_id: UUID
    amount_cents: Integer
    reason: Text
    refund_type: Enum  # full | partial | no_show_fee_only
    status: String     # pending | succeeded | failed
```

#### 11. **TenantBilling**
```python
class TenantBilling(TenantModel):
    # Subscription
    subscription_id: String
    subscription_status: Enum     # trial | active | paused | canceled
    subscription_price_cents: Integer  # 1199 ($11.99)
    next_billing_date: DateTime
    
    # Stripe
    stripe_customer_id: String
    stripe_account_id: String     # Connect account
    
    # Status
    connect_account_status: Enum  # pending | active
    onboarding_completed: Boolean
```

### Onboarding Entities

#### 12. **OnboardingProgress**
```python
class OnboardingProgress(TenantModel):
    current_step: Enum  # business_info | team_setup | services_categories |
                        # availability | notifications | policies | gift_cards |
                        # payment_setup | go_live
    
    completed_steps: JSON         # Array of completed steps
    step_data: JSON               # Data collected per step
    
    started_at: DateTime
    completed_at: DateTime
    last_activity_at: DateTime
```

### Promotion Entities

#### 13. **GiftCard**
```python
class GiftCard(TenantModel):
    code: String (unique)         # Gift card code
    amount_cents: Integer         # Fixed amount OR
    discount_percent: Integer     # Percentage discount
    
    expiration_date: Date
    is_active: Boolean
    
    # Usage tracking
    used_amount_cents: Integer
    usage_count: Integer
```

---

## 🔌 API Endpoints

### Base URLs
- **Development**: `http://localhost:5001`
- **Production**: `https://api.tithi.com`

### Authentication
All protected endpoints require:
```http
Authorization: Bearer <JWT_TOKEN>
```

### Main API Blueprints

#### 1. **Auth** (`/auth`)
```http
POST   /auth/register              # Create user account
POST   /auth/login                 # Login
POST   /auth/logout                # Logout
POST   /auth/refresh               # Refresh token
GET    /auth/me                    # Get current user
```

#### 2. **Onboarding** (`/api/v1/onboarding`)
```http
# Comprehensive Onboarding API
POST   /api/v1/onboarding/step1/business-account        # Step 1: Create business
POST   /api/v1/onboarding/step2/booking-website         # Step 2: Set subdomain
POST   /api/v1/onboarding/step3/location-contacts       # Step 3: Location & contacts
POST   /api/v1/onboarding/step4/team-members            # Step 4: Add team members
POST   /api/v1/onboarding/step5/branding                # Step 5: Logo & colors
POST   /api/v1/onboarding/step6/services-categories     # Step 6: Services
POST   /api/v1/onboarding/step7/availability            # Step 7: Availability
POST   /api/v1/onboarding/step8/notifications           # Step 8: Notification templates
POST   /api/v1/onboarding/step9/policies                # Step 9: Policies
POST   /api/v1/onboarding/step10/gift-cards             # Step 10: Gift cards (optional)
POST   /api/v1/onboarding/step11/payment-setup          # Step 11: Stripe Connect
POST   /api/v1/onboarding/step12/go-live                # Step 12: Go live

GET    /api/v1/onboarding/progress                      # Get onboarding progress
```

#### 3. **Booking Flow** (`/booking`)
```http
# Public Endpoints (No auth required)
GET    /booking/tenant-data/<tenant_id>                 # Get all booking site data
POST   /booking/availability                            # Check availability
POST   /booking/create                                  # Create booking
POST   /booking/confirm/<booking_id>                    # Confirm booking

# Request/Response Example
POST /booking/create
{
  "tenant_id": "uuid",
  "service_id": "uuid",
  "team_member_id": "uuid",
  "start_time": "2025-01-15T10:00:00Z",
  "customer_info": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "payment_method": {
    "type": "card",
    "stripe_payment_method_id": "pm_xxx"
  },
  "gift_card_code": "optional",
  "special_requests": "optional"
}

Response:
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "pending",
    "payment_status": "requires_action",
    "confirmation_number": "ABC123"
  }
}
```

#### 4. **Admin Dashboard** (`/api/v1/admin`)
```http
GET    /api/v1/admin/bookings                          # List all bookings
GET    /api/v1/admin/bookings/<booking_id>             # Get booking details
POST   /api/v1/admin/bookings/<booking_id>/complete    # Mark completed (charge)
POST   /api/v1/admin/bookings/<booking_id>/no-show     # Mark no-show (charge fee)
POST   /api/v1/admin/bookings/<booking_id>/cancel      # Cancel (charge fee)
POST   /api/v1/admin/bookings/<booking_id>/refund      # Refund payment

GET    /api/v1/admin/customers                         # List customers
GET    /api/v1/admin/customers/<customer_id>           # Get customer details
GET    /api/v1/admin/customers/<customer_id>/bookings  # Customer bookings

GET    /api/v1/admin/analytics                         # Business analytics
GET    /api/v1/admin/analytics/revenue                 # Revenue analytics
GET    /api/v1/admin/analytics/bookings                # Booking analytics
```

#### 5. **Payment** (`/api/payments`)
```http
POST   /api/payments/stripe/connect/setup              # Setup Stripe Connect
POST   /api/payments/stripe/subscription/create        # Create subscription
POST   /api/payments/stripe/checkout/session           # Create checkout
POST   /api/payments/stripe/payment/capture            # Capture payment
POST   /api/payments/stripe/payment/refund             # Refund payment
POST   /api/payments/webhook                           # Stripe webhook

GET    /api/payments/methods                           # List payment methods
GET    /api/payments/status/<payment_id>               # Get payment status
```

#### 6. **Services** (`/api/v1/services`)
```http
GET    /api/v1/services                                # List all services
GET    /api/v1/services/<service_id>                   # Get service details
POST   /api/v1/services                                # Create service
PUT    /api/v1/services/<service_id>                   # Update service
DELETE /api/v1/services/<service_id>                   # Delete service

GET    /api/v1/service-categories                      # List categories
POST   /api/v1/service-categories                      # Create category
PUT    /api/v1/service-categories/<category_id>        # Update category
```

#### 7. **Team Members** (`/api/v1/team`)
```http
GET    /api/v1/team/members                            # List team members
POST   /api/v1/team/members                            # Add team member
PUT    /api/v1/team/members/<member_id>                # Update team member
DELETE /api/v1/team/members/<member_id>                # Remove team member

GET    /api/v1/team/<member_id>/availability           # Get availability
POST   /api/v1/team/<member_id>/availability           # Set availability
```

---

## 🔄 Business Logic Flow

### Onboarding Flow (8-12 Steps)

```
User Registration
      ↓
Step 1: Business Account
  - Business name, description, legal name, industry
  - Creates Tenant record
  - Creates User record
  - Creates Membership (owner role)
      ↓
Step 2: Booking Website
  - Subdomain selection (e.g., "salon")
  - Validates uniqueness
  - Updates Tenant.subdomain
      ↓
Step 3: Location & Contacts
  - Phone, email, address, timezone
  - Updates Tenant fields
      ↓
Step 4: Team Members
  - Add staff with roles, names
  - Creates TeamMember records
      ↓
Step 5: Branding
  - Logo upload
  - Brand colors
  - Updates Tenant.branding_json
      ↓
Step 6: Services & Categories
  - Create ServiceCategory
  - Add Services to categories
  - Sets duration, price, instructions
      ↓
Step 7: Availability
  - Select service
  - Select team member
  - Set availability per service per staff
  - Creates TeamMemberAvailability records
      ↓
Step 8: Notifications
  - Create notification templates
  - Set channel, triggers, placeholders
  - Creates NotificationTemplate records
      ↓
Step 9: Policies
  - Cancellation, no-show, refund policies
  - Set fee types and amounts
  - Updates Tenant.policies_json
      ↓
Step 10: Gift Cards (Optional)
  - Create gift card templates
  - Set expiration, amount/percent
  - Generates codes
      ↓
Step 11: Payment Setup
  - Connect Stripe Express account
  - Create $11.99/month subscription
  - Store Stripe account IDs
  - Creates TenantBilling record
      ↓
Step 12: Go Live
  - Generate booking URL
  - Set Tenant.status = "active"
  - Booking site becomes public
```

### Booking Flow (Customer Side)

```
Customer visits subdomain.tithi.com
      ↓
Service Selection
  - Shows all ServiceCategories
  - Shows all Services within categories
  - Displays price, duration, description
  - Customer selects a service
      ↓
Time Selection (Availability)
  - Check availability for selected service
  - Filter by team member
  - Show color-coded calendar by staff
  - Customer selects time slot
      ↓
Checkout (Payment)
  - Collect customer info (name, email, phone)
  - Show policies modal (scrollable)
  - Require consent checkbox
  - Optional: Enter gift card code
  - Save payment method (SetupIntent)
  - NO CHARGE YET
      ↓
Confirmation
  - Booking created with status="pending"
  - Payment created with status="requires_action"
  - Send "booking created" notification
  - Show confirmation details
```

### Admin Actions (Money Movement)

```
Admin views Past Bookings
      ↓
For each booking, 4 buttons:
      
[Completed] → Charge full amount
  - Calls PaymentService.capture_payment()
  - Charges card via Stripe
  - Updates Payment.status = "captured"
  - Updates Booking.status = "completed"
  - Sends "booking completed" notification
      
[No-Show] → Charge no-show fee
  - Gets no-show fee from policies
  - If fee > 0: charges card
  - Updates Booking.no_show_flag = true
  - Updates Booking.status = "no_show"
  - Sends "no-show" notification
      
[Cancelled] → Charge cancellation fee
  - Gets cancellation fee from policies
  - If fee > 0: charges card
  - Updates Booking.status = "canceled"
  - Updates Booking.canceled_at
  - Sends "cancelled" notification
      
[Refund] → Refund payment
  - Checks if payment was captured
  - Processes refund via Stripe
  - Creates Refund record
  - Updates Payment.status = "refunded"
  - Optional: Restore gift card balance
```

### Payment Processing Flow

```
Booking Created
      ↓
SetupIntent created → Save payment method
  - Customer enters card details
  - Stripe creates SetupIntent
  - PaymentMethod saved to Stripe
  - PaymentMethod record in DB
  - NO CHARGE
      ↓
Payment Held (Manual Capture)
  - Payment created with status="requires_action"
  - PaymentIntent created with capture_method="manual"
  - Authorization only, no charge
      ↓
Admin Action (One of 4 buttons)
      ↓
IF [Completed]: Capture full payment
  - Stripe PaymentIntent.capture()
  - Charge the card
  - Platform fee (1%) calculated
  - Stripe fee deducted
  - Funds to Connect account
      ↓
IF [No-Show]: Charge no-show fee
  - Get fee from policies
  - Create new PaymentIntent
  - Charge fee amount only
      ↓
IF [Cancelled]: Charge cancellation fee
  - Get fee from policies
  - Create new PaymentIntent
  - Charge fee amount only
      ↓
IF [Refund]: Process refund
  - Create Refund on Stripe
  - Money returned to customer
```

---

## 🔐 Authentication & Authorization

### Auth Flow

```
User Register/Login
      ↓
Supabase Auth Issues JWT
      ↓
JWT Contains:
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "tenant_id": "tenant-uuid",     # If user owns/admin a business
  "membership_role": "owner",      # owner | admin | staff | viewer
  "exp": 1234567890
}
      ↓
Backend Verifies JWT
      ↓
Middleware Sets Context
  - g.user_id = token["sub"]
  - g.tenant_id = token["tenant_id"]
  - g.role = token["membership_role"]
      ↓
RLS Enforcement
  - Database queries filtered by tenant_id
  - User can only access their tenant's data
```

### Middleware

#### `AuthMiddleware`
- Verifies JWT tokens
- Extracts user_id, tenant_id, role
- Sets Flask global context (`g`)
- Decorator: `@require_auth`

#### `TenantMiddleware`
- Resolves tenant from subdomain or ID
- Ensures tenant is active
- Sets `g.tenant_id`
- Decorator: `@require_tenant`

### Role-Based Access

```python
# Roles hierarchy
owner > admin > staff > viewer

# Permissions
owner:    Full access (billing, all settings)
admin:    Manage bookings, services, team
staff:    View bookings, limited settings
viewer:   Read-only access
```

---

## 🏢 Multi-Tenancy & Data Isolation

### Tenant Isolation Strategy

1. **TenantModel**: All business data extends `TenantModel`
   - Every model has `tenant_id` column
   - Auto-filtered by tenant context

2. **RLS (Row Level Security)**: Database-level isolation
   - PostgreSQL policies enforce tenant boundaries
   - Prevents SQL injection tenant leaks

3. **Middleware**: Request-level filtering
   - `TenantMiddleware` sets context
   - Service layer filters by `tenant_id`

### Data Scoping Example

```python
# When user queries bookings:
# Backend automatically adds: WHERE tenant_id = g.tenant_id

Tenant A queries:  bookings WHERE tenant_id = 'aaa'
Tenant B queries:  bookings WHERE tenant_id = 'bbb'
# They cannot see each other's data
```

---

## 🎨 Frontend Integration Guide

### 1. Authentication Flow

```typescript
// 1. User registers
POST /auth/register
{
  "email": "user@example.com",
  "password": "secure_password",
  "first_name": "John",
  "last_name": "Doe"
}

// 2. User logs in
POST /auth/login
{
  "email": "user@example.com",
  "password": "secure_password"
}

// 3. Store JWT
localStorage.setItem("token", response.token)

// 4. Add to all requests
headers: {
  "Authorization": `Bearer ${token}`
}
```

### 2. Onboarding Integration

```typescript
// Step 1: Create business
POST /api/v1/onboarding/step1/business-account
{
  "business_name": "My Salon",
  "description": "Hair salon",
  "legal_name": "My Salon LLC",
  "industry": "Beauty"
}

// Step 2: Set subdomain
POST /api/v1/onboarding/step2/booking-website
{
  "subdomain": "my-salon"
}

// Step 6: Add services
POST /api/v1/onboarding/step6/services-categories
{
  "category": {
    "name": "Haircuts",
    "color": "#FF5733",
    "services": [
      {
        "name": "Men's Cut",
        "duration_min": 30,
        "price_cents": 3000,
        "instructions": "Arrive 5 minutes early"
      }
    ]
  }
}

// Step 7: Set availability
POST /api/v1/onboarding/step7/availability
{
  "service_id": "uuid",
  "team_member_id": "uuid",
  "availabilities": [
    {
      "day_of_week": 1,  // Monday
      "start_time": "09:00",
      "end_time": "17:00"
    }
  ]
}

// Check progress
GET /api/v1/onboarding/progress
// Returns current_step, completed_steps, step_data
```

### 3. Booking Flow Integration

```typescript
// 1. Load booking site (PUBLIC, NO AUTH)
GET /booking/tenant-data/{tenant_id}
// Returns all business data for booking site

// 2. Check availability
POST /booking/availability
{
  "tenant_id": "uuid",
  "service_id": "uuid",
  "start_date": "2025-01-15",
  "end_date": "2025-01-20",
  "team_member_id": "optional"
}
// Returns available time slots

// 3. Create booking
POST /booking/create
{
  "tenant_id": "uuid",
  "service_id": "uuid",
  "team_member_id": "uuid",
  "start_time": "2025-01-15T10:00:00Z",
  "customer_info": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1234567890"
  },
  "payment_method": {
    "stripe_payment_method_id": "pm_xxx"
  },
  "gift_card_code": "optional"
}
```

### 4. Admin Dashboard Integration

```typescript
// 1. List all bookings
GET /api/v1/admin/bookings
Query params: ?status=pending&page=1&limit=20

// 2. Complete booking (charge payment)
POST /api/v1/admin/bookings/{booking_id}/complete
{
  "idempotency_key": "unique-key"
}
// Charges the saved card, returns payment receipt

// 3. No-show booking (charge fee)
POST /api/v1/admin/bookings/{booking_id}/no-show
{
  "idempotency_key": "unique-key"
}
// Charges no-show fee from policies

// 4. Cancel booking (charge fee)
POST /api/v1/admin/bookings/{booking_id}/cancel
{
  "reason": "optional",
  "idempotency_key": "unique-key"
}
// Charges cancellation fee from policies

// 5. Refund booking
POST /api/v1/admin/bookings/{booking_id}/refund
{
  "refund_type": "full",
  "reason": "Customer request",
  "idempotency_key": "unique-key"
}
// Processes refund
```

### 5. Stripe Integration (Frontend)

```typescript
// 1. Initialize Stripe
import { loadStripe } from '@stripe/stripe-js'
const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY)

// 2. Collect payment method
const { paymentMethod, error } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement
})

// 3. Send to backend
POST /booking/create
{
  "payment_method": {
    "stripe_payment_method_id": paymentMethod.id
  }
}

// 4. In checkout page, show Stripe Elements
<Elements stripe={stripe}>
  <CardElement />
</Elements>
```

### 6. Subscription Management

```typescript
// Get subscription status
GET /api/v1/admin/subscription
// Returns: status, next_billing_date, price

// Activate subscription
POST /api/v1/admin/subscription/activate
// Switches to active, starts billing

// Pause subscription
POST /api/v1/admin/subscription/pause
// Pauses billing, keeps site active

// Cancel subscription
POST /api/v1/admin/subscription/cancel
// Cancels, deprovisions subdomain
```

---

## 🔍 Key Considerations for Frontend Builders

### 1. **Manual Payment Capture**
⚠️ **CRITICAL**: No charges happen at booking time. Payment is only captured when admin clicks "Completed", "No-Show", or "Cancelled".

### 2. **Multi-Tenant Data**
- Always include `tenant_id` in requests
- Never display other tenants' data
- Use subdomain to identify tenant

### 3. **Onboarding Persistence**
- Save each step as user completes it
- Show progress indicator
- Allow going back to previous steps

### 4. **Availability Generation**
- Availability is server-generated from rules
- Frontend just displays slots
- Real-time updates when slots get booked

### 5. **Notification Templates**
- Support dynamic placeholders
- Preview with sample data
- Validate placeholder syntax

### 6. **Gift Cards**
- Percentage discounts: Live price update
- Fixed amounts: Deduct from total
- Balance tracking for fixed amounts

### 7. **Subscription States**
- Trial → Active → Paused → Canceled
- Show next billing date
- Warn before canceling

### 8. **Error Handling**
- Always check `success` flag
- Display user-friendly error messages
- Log errors with `request_id`

---

## 📊 Data Flow Diagrams

### Complete Booking Flow (End-to-End)

```
┌──────────────────────────────────────────────────────────────┐
│ Customer visits salon.tithi.com                              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ GET /booking/tenant-data/{tenant_id}                         │
│ Returns: Business info, services, categories, team           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Customer selects service                                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /booking/availability                                   │
│ Returns: Available slots grouped by staff                    │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Customer selects time slot                                   │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Checkout Form                                                │
│ - Name, Email, Phone                                         │
│ - Policies modal                                             │
│ - Stripe Elements (card input)                               │
│ - Optional gift card                                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /booking/create                                         │
│ - Creates Booking (status="pending")                        │
│ - Creates Customer if new                                    │
│ - Saves PaymentMethod (SetupIntent)                          │
│ - Creates Payment (status="requires_action")                │
│ - NO CHARGE                                                  │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Confirmation Page                                            │
│ - Shows booking details                                      │
│ - Sends notification                                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Admin Views Booking in Dashboard                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Admin Clicks "Completed"                                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/admin/bookings/{id}/complete                    │
│ - Captures PaymentIntent                                     │
│ - Charges card                                               │
│ - Deducts platform fee (1%)                                  │
│ - Deducts Stripe fee                                         │
│ - Transfers to Connect account                               │
│ - Sends receipt                                              │
└──────────────────────────────────────────────────────────────┘
```

### Onboarding Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ POST /auth/register                                           │
│ Creates: User                                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/onboarding/step1/business-account               │
│ Creates: Tenant, Membership, OnboardingProgress              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/onboarding/step4/team-members                   │
│ Creates: TeamMember records                                   │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/onboarding/step6/services-categories            │
│ Creates: ServiceCategory, Service records                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/onboarding/step7/availability                   │
│ Creates: TeamMemberAvailability records                       │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/onboarding/step11/payment-setup                 │
│ Creates: Stripe Connect Account, Subscription                 │
│ Creates: TenantBilling record                                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ POST /api/v1/onboarding/step12/go-live                       │
│ Updates: Tenant.status = "active"                             │
│ Result: Booking site is now public                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing & Development

### Running Locally

```bash
# Start backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/tithi"
export SECRET_KEY="your-secret-key"
export STRIPE_SECRET_KEY="sk_test_xxx"

# Run migrations
flask db upgrade

# Start server
python index.py
# Server runs on http://localhost:5001
```

### Health Checks

```http
GET /health/live   # Liveness check
GET /health/ready  # Readiness check (includes DB)
```

### API Documentation

```http
GET /api/docs  # OpenAPI/Swagger docs
```

---

## 🚨 Common Pitfalls & Solutions

### Pitfall 1: Charging at Booking Time
❌ **WRONG**: Creating a charge when customer books  
✅ **CORRECT**: Only charge when admin clicks "Completed"

### Pitfall 2: Missing Tenant Context
❌ **WRONG**: Not including tenant_id in queries  
✅ **CORRECT**: Always use TenantModel, middleware handles it

### Pitfall 3: Not Handling Manual Capture
❌ **WRONG**: Creating PaymentIntent with capture_method="automatic"  
✅ **CORRECT**: Use capture_method="manual" for all bookings

### Pitfall 4: Missing Idempotency Keys
❌ **WRONG**: Not including idempotency_key on money actions  
✅ **CORRECT**: Generate unique key for every charge/refund

### Pitfall 5: Not Validating Gift Cards
❌ **WRONG**: Trusting gift card code from client  
✅ **CORRECT**: Validate on backend, check expiration/balance

---

## 📚 Additional Resources

- **Backend Architecture**: `docs/backend/BACKEND_ARCHITECTURE_MAP.md`
- **API Contracts**: `docs/backend/api-contracts-addendum.md`
- **Database Schema**: `docs/database/backend_build_blueprint.md`
- **Design Brief**: `docs/backend/design_brief.md`
- **Implementation Guide**: `backend/IMPLEMENTATION_GUIDE.md`

---

## 🎯 Key Takeaways

1. **Tenant-Scoped**: All data belongs to a tenant
2. **Manual Capture**: Business owners control all charges
3. **Multi-Step Onboarding**: 8-12 steps to set up business
4. **Public Booking Sites**: Each business gets unique subdomain
5. **Subscription Model**: $11.99/month per business
6. **JWT Auth**: Supabase-based authentication
7. **RLS Enforced**: Database-level tenant isolation
8. **Service Layer**: All business logic in services
9. **Idempotency**: All money actions are idempotent
10. **OpenAPI**: Complete API documentation

---

**Last Updated**: 2025-01-15  
**Version**: 1.0  
**Maintainer**: Tithi Engineering Team

