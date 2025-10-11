# Tithi Database Comprehensive Report

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Database Architecture Overview](#database-architecture-overview)
3. [Core Tables and Relationships](#core-tables-and-relationships)
4. [Data Types and Enums](#data-types-and-enums)
5. [Security and Access Control](#security-and-access-control)
6. [Business Logic and Functions](#business-logic-and-functions)
7. [Performance and Indexing](#performance-and-indexing)
8. [Data Flow and Operations](#data-flow-and-operations)
9. [Compliance and Audit](#compliance-and-audit)
10. [Migration History and Implementation](#migration-history-and-implementation)
11. [Production Readiness](#production-readiness)
12. [Migration Reference Guide](#migration-reference-guide)
13. [Database Operations and Maintenance](#database-operations-and-maintenance)

## Executive Summary

The Tithi database is a comprehensive multi-tenant booking and appointment management system built on PostgreSQL with Supabase. It supports complex business operations including booking management, payment processing, staff scheduling, customer relationship management, and analytics. The database is designed with enterprise-grade security, compliance, and scalability features.

**Key Statistics:**
- **Total Tables:** 39 core tables (extracted from migrations)
- **Total Functions:** 40 stored procedures and functions
- **Total Indexes:** 80+ performance indexes
- **Total Policies:** 98 Row Level Security policies
- **Total Constraints:** 62+ data integrity constraints
- **Total Triggers:** 44 automated triggers
- **Total Migrations:** 31 migration files
- **Materialized Views:** 4 analytics views
- **Exclusion Constraints:** 3 GiST-based overlap prevention
- **Security Model:** Row Level Security (RLS) enabled on all tables
- **Compliance:** PCI-compliant payment processing
- **Multi-tenancy:** Complete tenant isolation
- **Audit Trail:** Comprehensive logging and audit capabilities

## Database Architecture Overview

### Core Design Principles
1. **Multi-tenancy:** Complete data isolation between tenants
2. **Security-first:** RLS policies and comprehensive access controls
3. **Audit compliance:** Full audit trail for all operations
4. **Performance:** Optimized indexes and materialized views
5. **Scalability:** Designed for high-volume operations
6. **Compliance:** PCI DSS compliant payment processing

### Technology Stack
- **Database:** PostgreSQL 13+
- **Platform:** Supabase
- **Extensions:** pgcrypto, citext, btree_gist, pg_trgm
- **Security:** Row Level Security (RLS)
- **Audit:** Custom audit logging system

### Migration-Driven Architecture

The Tithi database architecture is built through 31 carefully orchestrated migrations, each serving specific purposes:

#### **Phase 1: Foundation (Migrations 0001-0010)**
- **0001 Extensions:** Core PostgreSQL extensions for UUID generation, case-insensitive text, and overlap prevention
- **0002 Types:** Custom enum types for status tracking and categorization
- **0003 Helpers:** RLS helper functions for JWT claim extraction
- **0004 Tenancy:** Multi-tenant infrastructure with users, tenants, and memberships
- **0005-0008 Business Logic:** Customers, resources, services, availability, and bookings
- **0009-0010 Payments & Promotions:** Payment processing and marketing features

#### **Phase 2: Advanced Features (Migrations 0011-0020)**
- **0011-0013 Notifications & Audit:** Template-based messaging and comprehensive audit trails
- **0014-0016 Security:** RLS enablement and comprehensive access control policies
- **0017-0018 Performance:** Critical indexes and development seeding
- **0019-0020 Enhancements:** Booking improvements and versioned theming

#### **Phase 3: Production Readiness (Migrations 0021-0031)**
- **0021-0022 Availability:** Advanced scheduling with overlap prevention
- **0023 OAuth:** Google login and OAuth provider support
- **0024-0025 Payments:** Card-on-file functionality and refund automation
- **0026-0027 Staff & Offline:** Staff management and offline booking support
- **0028-0031 Analytics & Hardening:** Materialized views, security hardening, and enhanced notifications

### Key Architectural Patterns

#### **1. Multi-Tenant Data Isolation**
```sql
-- Every business table includes tenant_id for isolation
CREATE TABLE table_name (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  -- ... other columns
);
```

#### **2. Row Level Security (RLS)**
```sql
-- Standard tenant-scoped policies
CREATE POLICY "table_sel" ON table_name
  FOR SELECT USING (tenant_id = current_tenant_id());
```

#### **3. Overlap Prevention with GiST**
```sql
-- Prevents double-booking using exclusion constraints
ALTER TABLE bookings
ADD CONSTRAINT bookings_excl_resource_time
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status IN ('pending', 'confirmed', 'checked_in'));
```

#### **4. Audit Trail Integration**
```sql
-- Automatic audit logging via triggers
CREATE TRIGGER table_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON table_name
  FOR EACH ROW EXECUTE FUNCTION log_audit();
```

## Core Tables and Relationships

### 1. Tenancy and User Management

#### `tenants` Table
**Purpose:** Root table for multi-tenant architecture
**Migration:** 0004_core_tenancy.sql
```sql
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  tz text NOT NULL DEFAULT 'UTC',
  trust_copy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public_directory boolean NOT NULL DEFAULT false,
  public_blurb text,
  billing_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_no_show_fee_percent decimal(5,2) DEFAULT 3.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
```

**Key Features:**
- Soft delete support via `deleted_at`
- Unique slug constraint (respects soft delete)
- Timezone configuration per tenant
- Trust messaging configuration
- Default no-show fee percentage

**Migration Implementation:**
```sql
-- Partial unique to respect soft-delete
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uniq
ON public.tenants (slug)
WHERE deleted_at IS NULL;

-- Soft-delete temporal sanity check
ALTER TABLE public.tenants
ADD CONSTRAINT tenants_deleted_after_created_chk
CHECK (deleted_at IS NULL OR deleted_at >= created_at);
```

#### `users` Table
**Purpose:** Global user management (cross-tenant)
**Migration:** 0004_core_tenancy.sql
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  primary_email citext,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Key Features:**
- Global users (no tenant_id) for cross-tenant access
- Case-insensitive email using citext extension
- Profile information for display purposes
- OAuth integration support (added in migration 0023)

#### `memberships` Table
**Purpose:** User-tenant relationship with roles
**Migration:** 0004_core_tenancy.sql
```sql
CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role membership_role NOT NULL,
  permissions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Roles:** `owner`, `admin`, `staff`, `viewer`

**Migration Implementation:**
```sql
-- One membership per (tenant,user)
CREATE UNIQUE INDEX IF NOT EXISTS memberships_unique_member
ON public.memberships (tenant_id, user_id);
```

#### `themes` Table
**Purpose:** Tenant branding configuration
**Migration:** 0004_core_tenancy.sql (basic), 0020_versioned_themes.sql (enhanced)
```sql
-- Basic theme (1:1 with tenants)
CREATE TABLE themes (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id),
  brand_color text,
  logo_url text,
  theme_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Versioned themes (enhanced in migration 0020)
CREATE TABLE tenant_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  version integer NOT NULL DEFAULT 1,
  brand_color text,
  logo_url text,
  theme_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. Customer Management

#### `customers` Table
**Purpose:** Customer data with PII handling
```sql
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  display_name text,
  email citext,
  phone text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_first_time boolean NOT NULL DEFAULT true,
  pseudonymized_at timestamptz,
  customer_first_booking_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

**Key Features:**
- GDPR compliance with pseudonymization
- Marketing consent tracking
- First-time customer identification
- Soft delete support

#### `customer_metrics` Table
**Purpose:** Denormalized customer analytics
```sql
CREATE TABLE customer_metrics (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  total_bookings_count integer NOT NULL DEFAULT 0,
  first_booking_at timestamptz,
  last_booking_at timestamptz,
  total_spend_cents integer NOT NULL DEFAULT 0,
  no_show_count integer NOT NULL DEFAULT 0,
  canceled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_metrics_pkey PRIMARY KEY (tenant_id, customer_id)
);
```

### 3. Resource and Service Management

#### `resources` Table
**Purpose:** Bookable resources (staff, rooms, equipment)
```sql
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  type resource_type NOT NULL,
  tz text NOT NULL,
  capacity integer NOT NULL,
  name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

**Resource Types:** `staff`, `room`

#### `services` Table
**Purpose:** Bookable services with pricing
```sql
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  slug text NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  duration_min integer NOT NULL DEFAULT 60,
  price_cents integer NOT NULL DEFAULT 0,
  buffer_before_min integer NOT NULL DEFAULT 0,
  buffer_after_min integer NOT NULL DEFAULT 0,
  no_show_fee_percent decimal(5,2) DEFAULT 3.00,
  category text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

#### `service_resources` Table
**Purpose:** Many-to-many relationship between services and resources
```sql
CREATE TABLE service_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  service_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 4. Availability and Scheduling

#### `availability_rules` Table
**Purpose:** Recurring availability patterns
```sql
CREATE TABLE availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  dow int NOT NULL CHECK (dow BETWEEN 1 AND 7),
  start_minute int NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute int NOT NULL CHECK (end_minute BETWEEN 0 AND 1439),
  rrule_json jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `availability_exceptions` Table
**Purpose:** Specific date overrides and closures
```sql
CREATE TABLE availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_minute int CHECK (start_minute IS NULL OR (start_minute BETWEEN 0 AND 1439)),
  end_minute int CHECK (end_minute IS NULL OR (end_minute BETWEEN 0 AND 1439)),
  start_at timestamptz,
  end_at timestamptz,
  closed boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual',
  description text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 5. Booking Management

#### `bookings` Table
**Purpose:** Core booking records
```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  client_generated_id text NOT NULL,
  service_snapshot jsonb NOT NULL DEFAULT '{}',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  booking_tz text NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  canceled_at timestamptz,
  canceled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason text,
  no_show_flag boolean NOT NULL DEFAULT false,
  no_show_fee_applied boolean NOT NULL DEFAULT false,
  attendee_count int NOT NULL DEFAULT 1,
  rescheduled_from uuid REFERENCES bookings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Booking Statuses:** `pending`, `confirmed`, `checked_in`, `completed`, `canceled`, `no_show`, `failed`

#### `booking_items` Table
**Purpose:** Multi-resource booking support
```sql
CREATE TABLE booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  buffer_before_min int NOT NULL DEFAULT 0,
  buffer_after_min int NOT NULL DEFAULT 0,
  price_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 6. Payment Processing

#### `payments` Table
**Purpose:** Payment transactions with PCI compliance
```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status payment_status NOT NULL DEFAULT 'requires_action',
  method payment_method NOT NULL DEFAULT 'card',
  currency_code text NOT NULL DEFAULT 'USD',
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  tip_cents integer NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  application_fee_cents integer NOT NULL DEFAULT 0 CHECK (application_fee_cents >= 0),
  no_show_fee_cents integer NOT NULL DEFAULT 0 CHECK (no_show_fee_cents >= 0),
  fee_type text DEFAULT 'booking',
  related_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_payment_id text,
  provider_charge_id text,
  provider_setup_intent_id text,
  provider_metadata jsonb DEFAULT '{}',
  idempotency_key text,
  backup_setup_intent_id text,
  explicit_consent_flag boolean NOT NULL DEFAULT false,
  royalty_applied boolean NOT NULL DEFAULT false,
  royalty_basis text CHECK (royalty_basis IN ('new_customer', 'referral', 'other')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Payment Statuses:** `requires_action`, `authorized`, `captured`, `refunded`, `canceled`, `failed`
**Payment Methods:** `card`, `cash`, `apple_pay`, `paypal`, `other`

#### `refunds` Table
**Purpose:** Refund transaction tracking
```sql
CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL,
  refund_type text NOT NULL DEFAULT 'full' CHECK (refund_type IN ('full', 'partial', 'no_show_fee_only')),
  provider text NOT NULL DEFAULT 'stripe',
  provider_refund_id text,
  provider_metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  idempotency_key text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 7. Promotions and Marketing

#### `coupons` Table
**Purpose:** Discount coupon management
```sql
CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  percent_off int,
  amount_off_cents int,
  minimum_amount_cents int NOT NULL DEFAULT 0,
  maximum_discount_cents int,
  usage_limit int,
  usage_count int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
```

#### `gift_cards` Table
**Purpose:** Gift card management
```sql
CREATE TABLE gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  initial_balance_cents int NOT NULL,
  current_balance_cents int NOT NULL,
  purchaser_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  recipient_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `referrals` Table
**Purpose:** Referral program tracking
```sql
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  referrer_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  referred_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_amount_cents int NOT NULL DEFAULT 0,
  referrer_reward_cents int NOT NULL DEFAULT 0,
  referred_reward_cents int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 8. Notification System

#### `notification_event_type` Table
**Purpose:** Event type definitions
```sql
CREATE TABLE notification_event_type (
  code text PRIMARY KEY,
  description text NOT NULL DEFAULT ''
);
```

#### `notification_templates` Table
**Purpose:** Per-tenant notification templates
```sql
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES notification_event_type(code) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  name text NOT NULL DEFAULT '',
  subject text DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `notifications` Table
**Purpose:** Notification queue with retry logic
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES notification_event_type(code) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',
  to_email text,
  to_phone text,
  target_json jsonb DEFAULT '{}',
  subject text DEFAULT '',
  body text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_attempt_at timestamptz,
  error_message text,
  dedupe_key text,
  provider_message_id text,
  provider_metadata jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 9. Staff Management

#### `staff_profiles` Table
**Purpose:** Staff member profiles and assignments
```sql
CREATE TABLE staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text,
  specialties text[],
  hourly_rate_cents integer,
  is_active boolean NOT NULL DEFAULT true,
  max_concurrent_bookings integer DEFAULT 1,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `work_schedules` Table
**Purpose:** Staff work schedules and time off
```sql
CREATE TABLE work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  schedule_type schedule_type NOT NULL,
  start_date date NOT NULL,
  end_date date,
  work_hours jsonb,
  is_time_off boolean NOT NULL DEFAULT false,
  overrides_regular boolean NOT NULL DEFAULT false,
  rrule text,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 10. Analytics and Reporting

#### Materialized Views
The database includes several materialized views for analytics:

1. **`revenue_analytics`** - Revenue and booking metrics by date
2. **`customer_analytics`** - Customer behavior and lifetime value
3. **`service_analytics`** - Service performance and popularity
4. **`staff_performance_analytics`** - Staff productivity metrics

### 11. Audit and Compliance

#### `audit_logs` Table
**Purpose:** Comprehensive audit trail
```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `events_outbox` Table
**Purpose:** Event sourcing and reliable messaging
```sql
CREATE TABLE events_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_code text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'delivered', 'failed')),
  ready_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_attempt_at timestamptz,
  error_message text,
  key text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## Data Types and Enums

### Custom Enums
**Migration:** 0002_types.sql

All enums are defined with idempotent checks per Design Brief requirements:

```sql
-- Booking statuses - tracks booking lifecycle
CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'checked_in', 'completed', 
  'canceled', 'no_show', 'failed'
);

-- Payment statuses - tracks payment processing states
CREATE TYPE payment_status AS ENUM (
  'requires_action', 'authorized', 'captured', 
  'refunded', 'canceled', 'failed'
);

-- Membership roles - user roles within tenants
CREATE TYPE membership_role AS ENUM (
  'owner', 'admin', 'staff', 'viewer'
);

-- Resource types - types of bookable resources
CREATE TYPE resource_type AS ENUM (
  'staff', 'room'
);

-- Notification channels - communication channels
CREATE TYPE notification_channel AS ENUM (
  'email', 'sms', 'push'
);

-- Notification statuses - message delivery states
CREATE TYPE notification_status AS ENUM (
  'queued', 'sent', 'failed'
);

-- Payment methods - payment processing methods
CREATE TYPE payment_method AS ENUM (
  'card', 'cash', 'apple_pay', 'paypal', 'other'
);

-- Schedule types - staff scheduling types (added in migration 0026)
CREATE TYPE schedule_type AS ENUM (
  'regular', 'override', 'time_off', 'holiday'
);

-- Assignment change types - staff assignment tracking (added in migration 0026)
CREATE TYPE assignment_change_type AS ENUM (
  'assigned', 'unassigned', 'role_changed', 'rate_changed'
);
```

### Migration Implementation Pattern
```sql
-- All enums use idempotent creation pattern
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM (
            'pending', 'confirmed', 'checked_in', 'completed',
            'canceled', 'no_show', 'failed'
        );
    END IF;
    -- ... other enum types
END
$$;
```

### PostgreSQL Extensions
**Migration:** 0001_extensions.sql

```sql
-- Core extensions for Tithi functionality
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- UUID generation & crypto functions
CREATE EXTENSION IF NOT EXISTS citext;        -- Case-insensitive text (emails)
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- GiST indexes for overlap prevention
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Text search & similarity
```

**Extension Purposes:**
- **pgcrypto:** UUID generation, cryptographic functions for secure operations
- **citext:** Case-insensitive text operations for emails and user input
- **btree_gist:** GiST indexes on btree data types for overlap prevention constraints
- **pg_trgm:** Text search and similarity operations for customer and service discovery

## Security and Access Control

### Row Level Security (RLS)
**Migration:** 0014_enable_rls.sql, 0015_policies_standard.sql, 0016_policies_special.sql

All tables have RLS enabled with comprehensive policies:

#### Standard Tenant-Scoped Policies
**Migration:** 0015_policies_standard.sql
- **SELECT:** `USING (tenant_id = current_tenant_id())`
- **INSERT:** `WITH CHECK (tenant_id = current_tenant_id())`
- **UPDATE:** `USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())`
- **DELETE:** `USING (tenant_id = current_tenant_id())`

```sql
-- Example standard policy pattern
CREATE POLICY "customers_sel" ON public.customers
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "customers_ins" ON public.customers
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "customers_upd" ON public.customers
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "customers_del" ON public.customers
  FOR DELETE USING (tenant_id = public.current_tenant_id());
```

#### Special Access Patterns
**Migration:** 0016_policies_special.sql
- **Tenants:** Member-gated SELECT, service-role writes only
- **Users:** Self or shared-tenant access
- **Memberships:** Member reads, owner/admin writes
- **Themes/Billing/Quotas:** Member reads, owner/admin writes

### RLS Helper Functions
**Migration:** 0003_helpers.sql, 0021_update_helpers_app_claims.sql, 0030_critical_security_hardening.sql

```sql
-- Enhanced RLS helper functions with robust error handling
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid AS $$
DECLARE
  tenant_id_value text;
  jwt_claims jsonb;
BEGIN
  -- Try to get JWT claims
  BEGIN
    jwt_claims := auth.jwt();
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  
  -- Check for tenant_id in JWT claims
  tenant_id_value := jwt_claims->>'tenant_id';
  
  -- Validate UUID format and return
  IF tenant_id_value IS NOT NULL 
     AND tenant_id_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN tenant_id_value::uuid;
  END IF;
  
  -- Fallback: check for tenant_id in request.jwt.claims setting
  BEGIN
    tenant_id_value := current_setting('request.jwt.claims.tenant_id', true);
    IF tenant_id_value IS NOT NULL 
       AND tenant_id_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN tenant_id_value::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting not available, continue
  END;
  
  RETURN NULL;
END;
$$;

-- Enhanced current_user_id() function
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid AS $$
-- Similar implementation for user_id extraction
$$;
```

### Security Features

#### 1. PCI Compliance
**Migration:** 0029_database_hardening_and_improvements.sql, 0030_critical_security_hardening.sql
- **No Raw Card Data:** All card data handled by Stripe
- **Encrypted Storage:** Sensitive data encrypted at rest
- **PCI Audit Function:** Automated compliance validation

```sql
-- PCI compliance audit function
CREATE OR REPLACE FUNCTION public.validate_payment_method_compliance(
  p_tenant_id uuid,
  p_payment_method_id uuid
)
RETURNS TABLE(is_compliant boolean, violations text[], recommendations text[])
LANGUAGE plpgsql AS $$
-- Validates payment method data for PCI compliance
-- Checks for proper format and absence of sensitive data
$$;
```

#### 2. Tenant Isolation Verification
**Migration:** 0030_critical_security_hardening.sql
```sql
-- Comprehensive tenant isolation test
CREATE OR REPLACE FUNCTION public.test_tenant_isolation_comprehensive()
RETURNS TABLE(
  test_name text,
  passed boolean,
  details text
) AS $$
-- Tests RLS isolation, helper functions, and audit capabilities
$$;
```

#### 3. Audit Logging
**Migration:** 0013_audit_logs.sql, 0013a_audit_logs_fix.sql, 0023b_audit_logs_tenant_id_nullable.sql
- **Complete Trail:** All operations logged
- **User Attribution:** Track who made changes
- **Data Changes:** Before/after values stored
- **Retention Policy:** 12-month retention with cleanup

#### 4. OAuth Integration Security
**Migration:** 0023_oauth_providers.sql
- **Encrypted Token Storage:** OAuth tokens encrypted at rest
- **User Linking:** Secure account linking and validation
- **Provider Management:** Support for Google, Facebook, Apple

#### 5. Production Security Hardening
**Migration:** 0030_critical_security_hardening.sql
- **Enhanced RLS Functions:** Robust error handling and fallback support
- **Booking Overlap Prevention:** Comprehensive validation and conflict resolution
- **Offline Booking Security:** Idempotency verification and validation
- **Production Monitoring:** Health checks and readiness reporting

## Business Logic and Functions

### Core Business Functions

#### Booking Management
**Migration:** 0008_bookings.sql, 0030_critical_security_hardening.sql

```sql
-- Sync booking status based on flags (Migration 0008)
CREATE OR REPLACE FUNCTION public.sync_booking_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Enforce status precedence: canceled_at → no_show_flag → (preserve existing status)
    IF NEW.canceled_at IS NOT NULL THEN
        NEW.status = 'canceled';
    ELSIF NEW.no_show_flag = true THEN
        NEW.status = 'no_show';
    -- Otherwise preserve the explicitly set status
    END IF;
    RETURN NEW;
END;
$$;

-- Fill booking timezone from resource/tenant (Migration 0008)
CREATE OR REPLACE FUNCTION public.fill_booking_tz()
RETURNS TRIGGER AS $$
BEGIN
    -- Fill booking_tz in priority order: NEW.booking_tz → resource.tz → tenant.tz → error
    IF NEW.booking_tz IS NULL THEN
        -- Try resource timezone
        SELECT r.tz INTO NEW.booking_tz
        FROM public.resources r
        WHERE r.id = NEW.resource_id
        AND r.tenant_id = NEW.tenant_id;
        
        -- If still NULL, try tenant timezone
        IF NEW.booking_tz IS NULL THEN
            SELECT t.tz INTO NEW.booking_tz
            FROM public.tenants t
            WHERE t.id = NEW.tenant_id;
            
            -- If still NULL, raise exception
            IF NEW.booking_tz IS NULL THEN
                RAISE EXCEPTION 'booking_tz is required but could not be resolved from resource or tenant';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Validate booking slot availability (Migration 0030)
CREATE OR REPLACE FUNCTION public.validate_booking_slot_availability(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(
  is_available boolean,
  conflicting_booking_id uuid,
  conflict_type text,
  suggested_slots timestamptz[]
) AS $$
DECLARE
  conflict_record record;
  suggested_slots timestamptz[] := '{}';
BEGIN
  -- Check for overlapping bookings with active statuses only
  SELECT b.id, b.status, b.start_at, b.end_at
  INTO conflict_record
  FROM public.bookings b
  WHERE b.tenant_id = p_tenant_id
    AND b.resource_id = p_resource_id
    AND b.status IN ('pending', 'confirmed', 'checked_in', 'completed')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  LIMIT 1;
  
  IF conflict_record IS NOT NULL THEN
    -- Generate suggested alternative slots
    suggested_slots := ARRAY[
      p_start_at + interval '30 minutes',
      p_start_at + interval '1 hour',
      p_start_at - interval '30 minutes',
      p_start_at + interval '2 hours'
    ];
    
    RETURN QUERY SELECT 
      false,
      conflict_record.id,
      'overlap_with_' || conflict_record.status,
      suggested_slots;
  ELSE
    RETURN QUERY SELECT 
      true,
      NULL::uuid,
      NULL::text,
      suggested_slots;
  END IF;
END;
$$;
```

#### Payment Processing
```sql
-- Calculate no-show fee
CREATE FUNCTION calculate_no_show_fee(
  p_booking_id uuid,
  p_tenant_id uuid
) RETURNS integer;

-- Process no-show fee
CREATE FUNCTION process_no_show_fee(
  p_booking_id uuid,
  p_tenant_id uuid,
  p_customer_id uuid
) RETURNS uuid;

-- Process refund with fee deduction
CREATE FUNCTION process_refund_with_fee(
  p_original_payment_id uuid,
  p_tenant_id uuid,
  p_reason text,
  p_refund_type text DEFAULT 'partial'
) RETURNS uuid;
```

#### Availability Management
```sql
-- Merge overlapping availability exceptions
CREATE FUNCTION merge_availability_exception(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_closed boolean DEFAULT true,
  p_source text DEFAULT 'manual',
  p_description text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid;
```

#### Theme Management
```sql
-- Publish theme (unpublish others)
CREATE FUNCTION publish_theme(p_theme_id uuid) RETURNS void;

-- Rollback to specific version
CREATE FUNCTION rollback_theme(
  p_tenant_id uuid, 
  p_version integer
) RETURNS void;
```

### Validation Functions
```sql
-- Validate service-resource compatibility
CREATE FUNCTION validate_service_resource_compatibility(
  p_tenant_id uuid,
  p_service_id uuid,
  p_resource_id uuid
) RETURNS boolean;

-- Check quota limits
CREATE FUNCTION check_quota_limit(
  p_tenant_id uuid,
  p_quota_code text
) RETURNS boolean;
```

### Audit and Compliance Functions
```sql
-- Log audit trail
CREATE FUNCTION log_audit() RETURNS TRIGGER;

-- Anonymize customer data (GDPR)
CREATE FUNCTION anonymize_customer(
  p_tenant_id uuid, 
  p_customer_id uuid
) RETURNS void;

-- Audit PCI compliance
CREATE FUNCTION audit_pci_compliance() RETURNS TABLE(...);
```

## Detailed Database Constraints and Relationships

### Foreign Key Relationships
The database implements a comprehensive referential integrity system with 62+ constraints:

#### **Primary Foreign Key Patterns:**
1. **Tenant-Scoped Tables:** All business tables reference `tenants(id)`
2. **User References:** Global user references via `users(id)`
3. **Customer References:** Customer-scoped data via `customers(id)`
4. **Resource References:** Resource-scoped data via `resources(id)`
5. **Service References:** Service-scoped data via `services(id)`
6. **Booking References:** Booking-scoped data via `bookings(id)`
7. **Payment References:** Payment-scoped data via `payments(id)`

#### **Cascade Behaviors:**
- **ON DELETE CASCADE:** Tenant deletion removes all tenant data
- **ON DELETE SET NULL:** Optional references set to NULL on deletion
- **ON DELETE RESTRICT:** Prevents deletion if referenced data exists

### Exclusion Constraints (GiST-based)
The database uses 3 sophisticated exclusion constraints for data integrity:

#### **1. Booking Overlap Prevention**
```sql
ALTER TABLE bookings 
ADD CONSTRAINT bookings_excl_resource_time 
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status IN ('pending', 'confirmed', 'checked_in', 'completed'));
```
**Purpose:** Prevents double-booking of resources
**Technology:** GiST (Generalized Search Tree) with tstzrange
**Scope:** Active booking statuses only

#### **2. Availability Exception Overlap Prevention**
```sql
ALTER TABLE availability_exceptions
ADD CONSTRAINT availability_exceptions_excl_resource_time
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (closed = true AND start_at IS NOT NULL AND end_at IS NOT NULL);
```
**Purpose:** Prevents overlapping closed periods
**Technology:** GiST with tstzrange
**Scope:** Closed exceptions only

### Data Integrity Constraints

#### **Check Constraints (62+ total):**
1. **Temporal Constraints:** `deleted_at >= created_at`
2. **Range Constraints:** `dow BETWEEN 1 AND 7`, `start_minute BETWEEN 0 AND 1439`
3. **Positive Value Constraints:** `amount_cents >= 0`, `capacity >= 1`
4. **Percentage Constraints:** `percent_off BETWEEN 1 AND 100`
5. **Status Constraints:** `status IN ('pending', 'confirmed', ...)`
6. **XOR Constraints:** Exactly one of `percent_off` OR `amount_off_cents`

#### **Unique Constraints:**
1. **Tenant Isolation:** `(tenant_id, slug)` for tenants
2. **Email Uniqueness:** `(tenant_id, email)` for customers
3. **Idempotency:** `(tenant_id, client_generated_id)` for bookings
4. **Provider Integration:** `(tenant_id, provider, idempotency_key)` for payments
5. **Resource Assignment:** `(tenant_id, resource_id)` for staff profiles

### Trigger System (44 triggers)

#### **Automated Timestamp Management:**
- **`touch_updated_at()` trigger:** Updates `updated_at` on all table modifications
- **Applied to:** All tables with `updated_at` column
- **Behavior:** Monotonic timestamp advancement using `clock_timestamp()`

#### **Business Logic Triggers:**
- **`sync_booking_status()`:** Enforces status precedence (canceled_at → no_show_flag → status)
- **`fill_booking_tz()`:** Resolves timezone from resource → tenant → error
- **`emit_availability_changed()`:** Publishes availability change events

#### **Audit Triggers:**
- **`log_audit()`:** Comprehensive audit logging for all operations
- **Applied to:** Key business tables (bookings, services, payments, themes, quotas)
- **Captures:** Before/after values, user context, operation type

### Materialized Views (4 views)

#### **1. Revenue Analytics**
```sql
CREATE MATERIALIZED VIEW revenue_analytics AS
SELECT 
  tenant_id, date, week, month, quarter, year,
  total_bookings, completed_bookings, canceled_bookings, no_show_bookings,
  total_revenue_cents, completed_revenue_cents, refunded_revenue_cents,
  avg_booking_value_cents, avg_completed_booking_value_cents,
  unique_customers, unique_completed_customers, unique_resources,
  first_booking_at, last_booking_at, last_updated
FROM bookings b
LEFT JOIN booking_items bi ON bi.booking_id = b.id
LEFT JOIN refunds r ON r.booking_id = b.id
GROUP BY tenant_id, date, week, month, quarter, year;
```

#### **2. Customer Analytics**
```sql
CREATE MATERIALIZED VIEW customer_analytics AS
SELECT 
  tenant_id, customer_id, display_name, email,
  total_bookings, completed_bookings, canceled_bookings, no_show_bookings,
  total_spent_cents, completed_spent_cents, refunded_cents,
  avg_booking_value_cents, avg_completed_booking_value_cents,
  first_booking_at, last_booking_at, avg_days_between_bookings,
  customer_status, last_updated
FROM customers c
LEFT JOIN bookings b ON b.customer_id = c.id
LEFT JOIN booking_items bi ON bi.booking_id = b.id
LEFT JOIN refunds r ON r.booking_id = b.id
GROUP BY tenant_id, customer_id, display_name, email;
```

#### **3. Service Analytics**
```sql
CREATE MATERIALIZED VIEW service_analytics AS
SELECT 
  tenant_id, service_id, service_name, category, price_cents, duration_min,
  total_bookings, completed_bookings, canceled_bookings, no_show_bookings,
  total_revenue_cents, completed_revenue_cents,
  unique_customers, unique_completed_customers, unique_resources,
  first_booking_at, last_booking_at, bookings_last_30_days, bookings_last_7_days,
  last_updated
FROM services s
LEFT JOIN bookings b ON (b.service_snapshot->>'id')::uuid = s.id
LEFT JOIN booking_items bi ON bi.booking_id = b.id
GROUP BY tenant_id, service_id, service_name, category, price_cents, duration_min;
```

#### **4. Staff Performance Analytics**
```sql
CREATE MATERIALIZED VIEW staff_performance_analytics AS
SELECT 
  tenant_id, staff_profile_id, staff_name, specialties, hourly_rate_cents,
  resource_id, resource_name,
  total_bookings, completed_bookings, canceled_bookings, no_show_bookings,
  total_revenue_cents, completed_revenue_cents,
  unique_customers, unique_completed_customers,
  first_booking_at, last_booking_at, bookings_last_30_days, bookings_last_7_days,
  total_hours_worked, completed_hours_worked, last_updated
FROM staff_profiles sp
LEFT JOIN resources r ON r.id = sp.resource_id
LEFT JOIN bookings b ON b.resource_id = sp.resource_id
LEFT JOIN booking_items bi ON bi.booking_id = b.id
GROUP BY tenant_id, staff_profile_id, staff_name, specialties, hourly_rate_cents, resource_id, resource_name;
```

## Performance and Indexing

### Critical Indexes (80+ total)

#### Booking Performance
```sql
-- Calendar queries (sub-150ms)
CREATE INDEX idx_bookings_calendar_lookup 
ON bookings(tenant_id, resource_id, start_at, end_at, status) 
WHERE status IN ('pending', 'confirmed', 'checked_in');

-- Time-based queries
CREATE INDEX idx_bookings_tenant_start_desc_idx 
ON bookings(tenant_id, start_at DESC);
```

#### Search Performance
```sql
-- Full-text search
CREATE INDEX idx_services_search 
ON services USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Trigram similarity
CREATE INDEX idx_services_name_trgm 
ON services USING gin(name gin_trgm_ops);
```

#### Audit Performance
```sql
-- BRIN for time-based queries
CREATE INDEX idx_audit_logs_brin_created_at_idx 
ON audit_logs USING BRIN (created_at);

-- BTREE for tenant lookups
CREATE INDEX idx_audit_logs_tenant_created_idx 
ON audit_logs (tenant_id, created_at);
```

### Exclusion Constraints
```sql
-- Prevent booking overlaps
ALTER TABLE bookings 
ADD CONSTRAINT bookings_excl_resource_time 
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status IN ('pending', 'confirmed', 'checked_in', 'completed'));

-- Prevent availability exception overlaps
ALTER TABLE availability_exceptions
ADD CONSTRAINT availability_exceptions_excl_resource_time
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (closed = true AND start_at IS NOT NULL AND end_at IS NOT NULL);
```

## Data Flow and Operations

### Database Object Hierarchy
The Tithi database follows a hierarchical structure with clear data flow patterns:

#### **Core Hierarchy:**
```
tenants (root)
├── users (global, cross-tenant)
├── memberships (user ↔ tenant relationships)
├── themes (1:1 with tenants)
├── tenant_billing (1:1 with tenants)
├── customers (tenant-scoped)
├── resources (tenant-scoped)
├── services (tenant-scoped)
├── service_resources (many-to-many)
├── availability_rules (resource-scoped)
├── availability_exceptions (resource-scoped)
├── bookings (customer + resource + service)
├── booking_items (multi-resource support)
├── payments (booking-scoped)
├── refunds (payment-scoped)
├── coupons (tenant-scoped)
├── gift_cards (tenant-scoped)
├── referrals (customer-scoped)
└── notifications (tenant-scoped)
```

#### **Data Flow Patterns:**

### 1. **Tenant Onboarding Flow**
```
1. Create tenant → tenants table
2. Create user → users table  
3. Create membership → memberships table
4. Initialize theme → themes table
5. Setup billing → tenant_billing table
6. Configure quotas → quotas table
```

### 2. **Service Setup Flow**
```
1. Create resources → resources table
2. Create services → services table
3. Link services to resources → service_resources table
4. Configure availability → availability_rules table
5. Set up exceptions → availability_exceptions table
```

### 3. **Customer Onboarding Flow**
```
1. Customer registration → customers table
2. Initialize metrics → customer_metrics table
3. Set preferences → customer_preferences table
4. Track first booking → customer_first_booking_at
```

### 4. **Booking Lifecycle**
```
1. **Creation:** Customer creates booking with `client_generated_id`
   - Insert into bookings table
   - Create booking_items for multi-resource support
   - Validate availability using exclusion constraints
   - Check service-resource compatibility

2. **Validation:** 
   - Check availability using GiST exclusion constraints
   - Validate service-resource compatibility
   - Ensure no overlapping bookings
   - Check quota limits

3. **Payment:** 
   - Create payment record in payments table
   - Process with Stripe integration
   - Handle idempotency with client_generated_id
   - Track payment status and metadata

4. **Confirmation:** 
   - Update booking status to 'confirmed'
   - Send confirmation notifications
   - Create calendar events
   - Update customer metrics

5. **Reminders:** 
   - Scheduled reminder notifications
   - 24h, 12h, 1h before booking
   - Configurable per tenant

6. **Check-in:** 
   - Mark as checked in
   - Update booking status
   - Track attendance

7. **Completion:** 
   - Mark as completed
   - Update customer metrics
   - Process final payment capture
   - Send completion notifications

8. **No-show Handling:** 
   - Mark as no-show
   - Calculate no-show fee
   - Process fee collection
   - Update customer metrics
```

### 5. **Payment Processing Flow**
```
1. **Authorization:** Authorize payment with Stripe
2. **Capture:** Capture payment after service completion
3. **Refunds:** Process refunds with fee deductions
4. **No-show Fees:** Automatically charge no-show fees
5. **Royalties:** Track and apply platform royalties
```

### 6. **Notification System Flow**
```
1. **Event Trigger:** Business event occurs
2. **Template Lookup:** Find appropriate template
3. **Queue Notification:** Add to notification queue
4. **Provider Processing:** Send via configured provider
5. **Retry Logic:** Handle failures with exponential backoff
6. **Analytics:** Track delivery metrics
```

### 7. **Audit Trail Flow**
```
1. **Operation Detection:** Trigger fires on data change
2. **Context Extraction:** Get tenant, user, and record info
3. **Audit Log Creation:** Insert into audit_logs table
4. **Event Emission:** Add to events_outbox for processing
5. **Retention Management:** Clean up old audit logs
```

### 8. **Data Modification Patterns**

#### **Insert Operations:**
- All inserts include `tenant_id` for tenant isolation
- UUIDs generated using `gen_random_uuid()`
- Timestamps set via `touch_updated_at()` trigger
- Audit logs created via `log_audit()` trigger

#### **Update Operations:**
- `updated_at` automatically updated via triggers
- Status changes trigger business logic functions
- Cross-table updates maintain referential integrity
- Audit trail captures before/after values

#### **Delete Operations:**
- Soft deletes preferred (using `deleted_at` column)
- Hard deletes cascade based on foreign key constraints
- Audit logs capture deletion events
- Related data cleanup handled by triggers

#### **Query Patterns:**
- All queries filtered by `tenant_id` via RLS
- Indexes optimized for common query patterns
- Materialized views for analytics queries
- Full-text search for customer and service discovery

### Payment Processing
1. **Authorization:** Authorize payment with Stripe
2. **Capture:** Capture payment after service completion
3. **Refunds:** Process refunds with fee deductions
4. **No-show Fees:** Automatically charge no-show fees
5. **Royalties:** Track and apply platform royalties

### Notification System
1. **Event Trigger:** Business event occurs
2. **Template Lookup:** Find appropriate template
3. **Queue Notification:** Add to notification queue
4. **Provider Processing:** Send via configured provider
5. **Retry Logic:** Handle failures with exponential backoff
6. **Analytics:** Track delivery metrics

### Audit Trail
1. **Operation Detection:** Trigger fires on data change
2. **Context Extraction:** Get tenant, user, and record info
3. **Audit Log Creation:** Insert into audit_logs table
4. **Event Emission:** Add to events_outbox for processing
5. **Retention Management:** Clean up old audit logs

## Compliance and Audit

### GDPR Compliance
- **Data Anonymization:** `anonymize_customer()` function
- **Consent Tracking:** Marketing opt-in flags
- **Data Portability:** JSON export capabilities
- **Right to be Forgotten:** Soft delete with anonymization

### PCI DSS Compliance
- **No Raw Card Data:** All card data handled by Stripe
- **Encrypted Storage:** Sensitive data encrypted
- **Access Controls:** Role-based access to payment data
- **Audit Logging:** Complete payment audit trail

### Audit Requirements
- **Complete Trail:** All operations logged
- **User Attribution:** Track who made changes
- **Data Changes:** Before/after values stored
- **Retention Policy:** 12-month retention with cleanup

## Migration History and Implementation

### Phase 1: Core Foundation (Migrations 0001-0010)
**Timeline:** Initial database setup and core business logic

#### **0001: Extensions** - `0001_extensions.sql`
- **Purpose:** Install PostgreSQL extensions required for the application
- **Key Extensions:** pgcrypto, citext, btree_gist, pg_trgm
- **Impact:** Enables UUID generation, case-insensitive text, overlap prevention, and text search

#### **0002: Custom Types** - `0002_types.sql`
- **Purpose:** Define enum types used throughout the application
- **Key Types:** booking_status, payment_status, membership_role, resource_type, notification_channel, payment_method
- **Impact:** Provides type safety and data validation across the application

#### **0003: RLS Helper Functions** - `0003_helpers.sql`
- **Purpose:** Create JWT claim extraction functions for Row Level Security
- **Key Functions:** current_tenant_id(), current_user_id()
- **Impact:** Enables tenant isolation and user context for RLS policies

#### **0004: Core Tenancy** - `0004_core_tenancy.sql`
- **Purpose:** Create multi-tenant infrastructure
- **Key Tables:** tenants, users, memberships, themes
- **Impact:** Establishes the foundation for multi-tenant data isolation

#### **0005: Customers & Resources** - `0005_customers_resources.sql`
- **Purpose:** Create customer management and bookable resources
- **Key Tables:** customers, resources, customer_metrics
- **Impact:** Enables customer relationship management and resource booking

#### **0006: Services** - `0006_services.sql`
- **Purpose:** Create service catalog and resource mapping
- **Key Tables:** services, service_resources
- **Impact:** Provides flexible service definitions with resource associations

#### **0007: Availability** - `0007_availability.sql`
- **Purpose:** Create availability scheduling system
- **Key Tables:** availability_rules, availability_exceptions
- **Impact:** Enables complex scheduling with recurring patterns and exceptions

#### **0008: Bookings** - `0008_bookings.sql`
- **Purpose:** Create booking system with overlap prevention
- **Key Tables:** bookings, booking_items
- **Key Features:** GiST exclusion constraints, status management, timezone resolution
- **Impact:** Core booking functionality with conflict prevention

#### **0009: Payments & Billing** - `0009_payments_billing.sql`
- **Purpose:** Create payment processing and tenant billing
- **Key Tables:** payments, tenant_billing
- **Impact:** Stripe integration and tenant-level billing configuration

#### **0010: Promotions** - `0010_promotions.sql`
- **Purpose:** Create promotion and loyalty system
- **Key Tables:** coupons, gift_cards, referrals
- **Impact:** Marketing and customer retention features

### Phase 2: Advanced Features (Migrations 0011-0020)
**Timeline:** Notifications, security, and performance optimization

#### **0011: Notifications** - `0011_notifications.sql`
- **Purpose:** Create notification system with templates and queue
- **Key Tables:** notification_event_type, notification_templates, notifications
- **Impact:** Template-based messaging with multi-channel support

#### **0012: Usage Quotas** - `0012_usage_quotas.sql`
- **Purpose:** Create usage tracking and quota enforcement
- **Key Tables:** usage_counters, quotas
- **Impact:** Application-level quota management and enforcement

#### **0013: Audit Logs** - `0013_audit_logs.sql` + fixes
- **Purpose:** Create comprehensive audit logging and event system
- **Key Tables:** audit_logs, events_outbox, webhook_events_inbox
- **Impact:** Complete audit trail for compliance and event delivery

#### **0014: Enable RLS** - `0014_enable_rls.sql`
- **Purpose:** Enable Row Level Security on all tables
- **Impact:** Activates deny-by-default security model

#### **0015: Standard RLS Policies** - `0015_policies_standard.sql`
- **Purpose:** Create tenant-scoped RLS policies for data isolation
- **Impact:** Comprehensive access control with tenant isolation

#### **0016: Special RLS Policies** - `0016_policies_special.sql`
- **Purpose:** Create special RLS policies for cross-tenant tables
- **Impact:** Specialized access patterns for system tables

#### **0017: Performance Indexes** - `0017_indexes.sql`
- **Purpose:** Create performance indexes for common query patterns
- **Impact:** Optimized query performance for calendar views and analytics

#### **0018: Development Seeding** - `0018_seed_dev.sql`
- **Purpose:** Seed development data for local testing
- **Impact:** Realistic test data for development environment

#### **0019: Booking Improvements** - `0019_update_bookings_overlap_rule.sql`
- **Purpose:** Update bookings overlap rule to exclude completed status
- **Impact:** Improved business logic for booking conflicts

#### **0020: Versioned Themes** - `0020_versioned_themes.sql`
- **Purpose:** Introduce versioned themes with publish/rollback capability
- **Key Tables:** tenant_themes, themes_current
- **Impact:** Theme management with versioning and A/B testing support

### Phase 3: Production Readiness (Migrations 0021-0031)
**Timeline:** Advanced features, security hardening, and production optimization

#### **0021-0022: Availability Improvements** - `0021_rollback_helpers.sql`, `0022_availability_exceptions_overlap_prevention.sql`
- **Purpose:** Rollback helpers and availability exception overlap prevention
- **Impact:** Enhanced availability management with merge-on-write functionality

#### **0023: OAuth Providers** - `0023_oauth_providers.sql` + fixes
- **Purpose:** Add OAuth providers support for Google login and other providers
- **Key Tables:** oauth_providers
- **Impact:** Secure OAuth integration with encrypted token storage

#### **0024: Payment Methods** - `0024_payment_methods.sql`
- **Purpose:** Add payment methods support for card-on-file functionality
- **Key Tables:** payment_methods
- **Impact:** Persistent payment method storage for recurring payments

#### **0025: No-Show Fee Automation** - `0025_no_show_fee_refund_automation.sql`
- **Purpose:** Implement no-show fee automation and comprehensive refund/fee capture flow
- **Key Tables:** refunds, payment_fees
- **Impact:** Automated fee processing and refund management

#### **0026: Staff Management** - `0026_staff_assignment_shift_scheduling.sql`
- **Purpose:** Add staff assignment and shift scheduling system
- **Key Tables:** staff_profiles, work_schedules, staff_assignment_history
- **Impact:** Comprehensive staff management and scheduling

#### **0027: Offline Booking** - `0027_offline_booking_idempotency.sql`
- **Purpose:** Add offline booking support with idempotency enhancement
- **Impact:** Offline sync scenarios with pending booking management

#### **0028: Analytics** - `0028_analytics_materialized_views.sql`
- **Purpose:** Create analytics materialized views and aggregated counters
- **Key Views:** revenue_analytics, customer_analytics, service_analytics, staff_performance_analytics
- **Impact:** Pre-computed analytics for dashboards and reporting

#### **0029: Database Hardening** - `0029_database_hardening_and_improvements.sql`
- **Purpose:** Critical fixes and performance optimizations
- **Impact:** Production-ready security, performance, and compliance features

#### **0030: Critical Security Hardening** - `0030_critical_security_hardening.sql`
- **Purpose:** Production readiness and comprehensive security
- **Impact:** Enhanced security, monitoring, and operational improvements

#### **0031: Enhanced Notifications** - `0031_enhanced_notification_system.sql`
- **Purpose:** Comprehensive notification system with templates and provider management
- **Key Tables:** notification_settings, notification_providers, notification_analytics
- **Impact:** Advanced notification system with analytics and multi-provider support

### Migration Evolution Summary

The migration history shows a clear evolution from basic functionality to enterprise-grade features:

1. **Foundation Phase:** Core multi-tenant architecture and business logic
2. **Feature Phase:** Advanced capabilities like notifications, security, and performance
3. **Production Phase:** Hardening, analytics, and operational excellence

Each migration builds upon previous ones, maintaining backward compatibility while adding new capabilities. The progression demonstrates careful planning and iterative development of a comprehensive booking management system.

## Production Readiness

### Security Checklist
- ✅ Row Level Security enabled on all tables
- ✅ PCI compliance verified
- ✅ Audit logging comprehensive
- ✅ Tenant isolation tested
- ✅ Access controls implemented
- ✅ Data encryption in place

### Performance Checklist
- ✅ Critical indexes created
- ✅ Materialized views for analytics
- ✅ Query optimization completed
- ✅ Exclusion constraints for data integrity
- ✅ Full-text search capabilities
- ✅ Calendar query optimization

### Operational Checklist
- ✅ Backup and recovery procedures
- ✅ Monitoring and alerting
- ✅ Health check functions
- ✅ Automated cleanup procedures
- ✅ Migration rollback procedures
- ✅ Documentation complete

### Compliance Checklist
- ✅ GDPR compliance features
- ✅ PCI DSS compliance
- ✅ Audit trail requirements
- ✅ Data retention policies
- ✅ Security hardening complete
- ✅ Production monitoring ready

## Conclusion

The Tithi database represents a comprehensive, enterprise-grade booking and appointment management system with:

- **Complete Multi-tenancy:** Full data isolation and tenant management
- **Robust Security:** RLS, PCI compliance, and comprehensive audit trails
- **Scalable Architecture:** Optimized for high-volume operations
- **Business Logic:** Complex booking, payment, and notification workflows
- **Analytics Ready:** Materialized views and performance optimization
- **Production Ready:** Security hardening and operational monitoring

The database is designed to support complex business operations while maintaining security, compliance, and performance requirements. It provides a solid foundation for building a comprehensive booking management platform.

## Database Operations and Maintenance

### Data Storage Patterns

#### **UUID Strategy:**
- **Primary Keys:** All tables use `uuid` with `gen_random_uuid()` default
- **Foreign Keys:** UUID references maintain referential integrity
- **Benefits:** Globally unique, no sequential dependencies, distributed-friendly

#### **Timestamp Management:**
- **Created At:** `created_at timestamptz NOT NULL DEFAULT now()`
- **Updated At:** `updated_at timestamptz NOT NULL DEFAULT now()`
- **Deleted At:** `deleted_at timestamptz NULL` for soft deletes
- **Timezone Handling:** All timestamps stored in UTC, converted per tenant timezone

#### **JSONB Usage:**
- **Metadata Storage:** Flexible schema for additional data
- **Service Snapshots:** Immutable service data at booking time
- **Configuration:** Tenant-specific settings and preferences
- **Audit Data:** Before/after values in audit logs

### Data Modification Operations

#### **Insert Operations:**
```sql
-- Standard insert pattern
INSERT INTO table_name (
  id, tenant_id, field1, field2, created_at, updated_at
) VALUES (
  gen_random_uuid(), 
  current_tenant_id(), 
  value1, 
  value2, 
  now(), 
  now()
);
```

#### **Update Operations:**
```sql
-- Standard update pattern with tenant isolation
UPDATE table_name 
SET field1 = new_value, updated_at = now()
WHERE id = record_id 
  AND tenant_id = current_tenant_id();
```

#### **Soft Delete Operations:**
```sql
-- Soft delete pattern
UPDATE table_name 
SET deleted_at = now(), updated_at = now()
WHERE id = record_id 
  AND tenant_id = current_tenant_id()
  AND deleted_at IS NULL;
```

#### **Hard Delete Operations:**
```sql
-- Hard delete with cascade (use carefully)
DELETE FROM table_name 
WHERE id = record_id 
  AND tenant_id = current_tenant_id();
```

### Query Patterns

#### **Tenant-Scoped Queries:**
```sql
-- All queries must include tenant_id filter
SELECT * FROM table_name 
WHERE tenant_id = current_tenant_id()
  AND additional_conditions;
```

#### **Calendar Queries:**
```sql
-- Optimized for sub-150ms performance
SELECT * FROM bookings 
WHERE tenant_id = current_tenant_id()
  AND resource_id = $1
  AND start_at >= $2
  AND end_at <= $3
  AND status IN ('pending', 'confirmed', 'checked_in')
ORDER BY start_at;
```

#### **Analytics Queries:**
```sql
-- Use materialized views for performance
SELECT * FROM revenue_analytics 
WHERE tenant_id = current_tenant_id()
  AND date >= $1
  AND date <= $2
ORDER BY date DESC;
```

### Maintenance Operations

#### **Index Maintenance:**
```sql
-- Rebuild indexes for performance
REINDEX INDEX CONCURRENTLY idx_bookings_calendar_lookup;

-- Analyze tables for query planning
ANALYZE bookings;
ANALYZE customers;
ANALYZE services;
```

#### **Materialized View Refresh:**
```sql
-- Refresh analytics views
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_analytics;
REFRESH MATERIALIZED VIEW CONCURRENTLY customer_analytics;
REFRESH MATERIALIZED VIEW CONCURRENTLY service_analytics;
REFRESH MATERIALIZED VIEW CONCURRENTLY staff_performance_analytics;
```

#### **Audit Log Cleanup:**
```sql
-- Clean up old audit logs (12-month retention)
SELECT public.audit_log_retention_cleanup();
```

#### **Vacuum Operations:**
```sql
-- Vacuum tables for space reclamation
VACUUM ANALYZE bookings;
VACUUM ANALYZE customers;
VACUUM ANALYZE payments;
```

### Monitoring and Health Checks

#### **System Health Monitoring:**
```sql
-- Check system health
SELECT * FROM public.get_production_readiness_status();

-- Check tenant isolation
SELECT * FROM public.test_tenant_isolation_comprehensive();

-- Check PCI compliance
SELECT * FROM public.audit_pci_compliance();
```

#### **Performance Monitoring:**
```sql
-- Check index usage
SELECT * FROM public.get_index_usage_stats();

-- Check table sizes
SELECT * FROM public.get_table_size_stats();

-- Check query performance
SELECT * FROM public.get_slow_query_stats();
```

### Backup and Recovery

#### **Backup Strategy:**
1. **Full Database Backup:** Daily full backups
2. **Incremental Backup:** Hourly WAL archiving
3. **Point-in-Time Recovery:** 30-day retention
4. **Cross-Region Replication:** For disaster recovery

#### **Recovery Procedures:**
1. **Point-in-Time Recovery:** Restore to specific timestamp
2. **Tenant Data Recovery:** Restore specific tenant data
3. **Table-Level Recovery:** Restore specific tables
4. **Index Rebuild:** Rebuild corrupted indexes

### Scaling Considerations

#### **Horizontal Scaling:**
- **Tenant Sharding:** Partition by tenant_id for large tenants
- **Read Replicas:** Separate read/write workloads
- **Connection Pooling:** Manage database connections efficiently

#### **Vertical Scaling:**
- **Memory Optimization:** Tune shared_buffers and work_mem
- **CPU Optimization:** Parallel query execution
- **Storage Optimization:** SSD storage for performance

#### **Query Optimization:**
- **Index Tuning:** Monitor and optimize index usage
- **Query Analysis:** Use EXPLAIN ANALYZE for optimization
- **Materialized Views:** Pre-compute complex aggregations

### Security Maintenance

#### **Access Control:**
- **Regular Policy Review:** Audit RLS policies quarterly
- **User Access Review:** Review user permissions monthly
- **Audit Log Analysis:** Monitor for suspicious activity

#### **Data Protection:**
- **Encryption at Rest:** Ensure all data is encrypted
- **Encryption in Transit:** Use SSL/TLS for all connections
- **Key Rotation:** Rotate encryption keys regularly

#### **Compliance:**
- **GDPR Compliance:** Regular data anonymization
- **PCI Compliance:** Quarterly security audits
- **Audit Trail:** Maintain comprehensive audit logs

---

## Migration Reference Guide

This section provides a comprehensive reference to all 31 migrations, organized by functional areas with key implementation details.

### Core Infrastructure Migrations

#### MIGRATION 0001: Extensions
**File:** `0001_extensions.sql`
**Purpose:** Install PostgreSQL extensions required for the application
**Output:** Enables UUID generation, case-insensitive text, overlap prevention, and text search

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- UUID generation & crypto functions
CREATE EXTENSION IF NOT EXISTS citext;        -- Case-insensitive text (emails)
CREATE EXTENSION IF NOT EXISTS btree_gist;    -- GiST indexes for overlap prevention
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- Text search & similarity
```

#### MIGRATION 0002: Custom Types
**File:** `0002_types.sql`
**Purpose:** Define enum types used throughout the application
**Output:** Creates 8 enum types for status tracking and categorization

```sql
-- Key enum types with idempotent creation
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'canceled', 'no_show', 'failed');
CREATE TYPE payment_status AS ENUM ('requires_action', 'authorized', 'captured', 'refunded', 'canceled', 'failed');
CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'staff', 'viewer');
CREATE TYPE resource_type AS ENUM ('staff', 'room');
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push');
CREATE TYPE payment_method AS ENUM ('card', 'cash', 'apple_pay', 'paypal', 'other');
```

#### MIGRATION 0003: RLS Helper Functions
**File:** `0003_helpers.sql`
**Purpose:** Create JWT claim extraction functions for Row Level Security
**Output:** Functions to extract tenant_id and user_id from JWT for RLS policies

```sql
-- Extract tenant_id from JWT claims with UUID validation
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid AS $$
  SELECT CASE
    WHEN (auth.jwt()->>'tenant_id') IS NOT NULL
     AND (auth.jwt()->>'tenant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (auth.jwt()->>'tenant_id')::uuid
    ELSE NULL::uuid
  END;
$$;
```

#### MIGRATION 0004: Core Tenancy
**File:** `0004_core_tenancy.sql`
**Purpose:** Create multi-tenant infrastructure with users, tenants, and memberships
**Output:** Core tables for tenant isolation and user management

```sql
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_at := COALESCE(NEW.updated_at, clock_timestamp());
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := GREATEST(COALESCE(NEW.updated_at, to_timestamp(0)), clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$;

-- Core tenant table with soft delete
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  tz text NOT NULL DEFAULT 'UTC',
  is_public_directory boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);
```

### Business Logic Migrations

#### MIGRATION 0005: Customers & Resources
**File:** `0005_customers_resources.sql`
**Purpose:** Create customer management and bookable resources
**Output:** Customer records with PII handling and resource definitions

#### MIGRATION 0006: Services
**File:** `0006_services.sql`
**Purpose:** Create service catalog and resource mapping
**Output:** Service definitions with pricing and resource associations

#### MIGRATION 0007: Availability
**File:** `0007_availability.sql`
**Purpose:** Create availability scheduling system
**Output:** Recurring availability patterns and exception handling

#### MIGRATION 0008: Bookings
**File:** `0008_bookings.sql`
**Purpose:** Create booking system with overlap prevention
**Output:** Booking records with status management and conflict prevention

```sql
-- GiST exclusion constraint for overlap prevention
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_excl_resource_time
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at, end_at, '[)') WITH &&
) WHERE (status IN ('pending', 'confirmed', 'checked_in'));

-- Status sync trigger
CREATE OR REPLACE FUNCTION public.sync_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.canceled_at IS NOT NULL THEN
    NEW.status = 'canceled';
  ELSIF NEW.no_show_flag = true THEN
    NEW.status = 'no_show';
  END IF;
  RETURN NEW;
END;
$$;
```

### Payment & Billing Migrations

#### MIGRATION 0009: Payments & Billing
**File:** `0009_payments_billing.sql`
**Purpose:** Create payment processing and tenant billing
**Output:** Payment records with Stripe integration and tenant billing

#### MIGRATION 0024: Payment Methods
**File:** `0024_payment_methods.sql`
**Purpose:** Add card-on-file functionality with Stripe PaymentMethod storage
**Output:** Persistent payment method storage for recurring payments

```sql
-- Stripe PaymentMethod storage for card-on-file
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  stripe_payment_method_id text NOT NULL,
  type text NOT NULL,
  last4 text,
  exp_month integer,
  exp_year integer,
  brand text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Security & Access Control Migrations

#### MIGRATION 0014: Enable RLS
**File:** `0014_enable_rls.sql`
**Purpose:** Enable Row Level Security on all tables
**Output:** Deny-by-default security model activated

#### MIGRATION 0015: Standard RLS Policies
**File:** `0015_policies_standard.sql`
**Purpose:** Create tenant-scoped RLS policies for data isolation
**Output:** Comprehensive access control with tenant isolation

#### MIGRATION 0016: Special RLS Policies
**File:** `0016_policies_special.sql`
**Purpose:** Create special RLS policies for cross-tenant tables
**Output:** Specialized RLS policies for system tables

### Advanced Features Migrations

#### MIGRATION 0011: Notifications
**File:** `0011_notifications.sql`
**Purpose:** Create notification system with templates and queue
**Output:** Template-based messaging with multi-channel support

#### MIGRATION 0026: Staff Management
**File:** `0026_staff_assignment_shift_scheduling.sql`
**Purpose:** Add staff assignment and shift scheduling system
**Output:** Staff profiles, work schedules, and assignment tracking

#### MIGRATION 0028: Analytics
**File:** `0028_analytics_materialized_views.sql`
**Purpose:** Create analytics materialized views and aggregated counters
**Output:** Pre-computed analytics for dashboards and reporting

```sql
-- Revenue analytics materialized view
CREATE MATERIALIZED VIEW public.revenue_analytics AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as booking_count,
  SUM(amount_cents) as total_revenue_cents,
  AVG(amount_cents) as avg_booking_value_cents
FROM public.payments
WHERE status = 'captured'
GROUP BY tenant_id, DATE_TRUNC('day', created_at);
```

### Production Hardening Migrations

#### MIGRATION 0029: Database Hardening
**File:** `0029_database_hardening_and_improvements.sql`
**Purpose:** Critical fixes and performance optimizations
**Output:** Production-ready security, performance, and compliance features

#### MIGRATION 0030: Critical Security Hardening
**File:** `0030_critical_security_hardening.sql`
**Purpose:** Production readiness and comprehensive security
**Output:** Enhanced security, monitoring, and operational improvements

```sql
-- Comprehensive booking overlap validation
CREATE OR REPLACE FUNCTION public.validate_booking_slot_availability(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(
  is_available boolean,
  conflicting_booking_id uuid,
  conflict_type text,
  suggested_slots timestamptz[]
) AS $$
-- Validates booking availability and suggests alternatives
$$;
```

#### MIGRATION 0031: Enhanced Notifications
**File:** `0031_enhanced_notification_system.sql`
**Purpose:** Comprehensive notification system with templates and provider management
**Output:** Advanced notification system with analytics and multi-provider support

```sql
-- Notification settings per tenant
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  notification_type text NOT NULL,
  timing_hours integer NOT NULL DEFAULT 24,
  template_id uuid REFERENCES public.notification_templates(id),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Migration Dependencies and Order

The migrations follow a specific dependency order:

1. **Foundation (0001-0004):** Extensions → Types → Helpers → Tenancy
2. **Business Logic (0005-0010):** Customers/Resources → Services → Availability → Bookings → Payments → Promotions
3. **Advanced Features (0011-0013):** Notifications → Quotas → Audit
4. **Security (0014-0016):** Enable RLS → Standard Policies → Special Policies
5. **Performance (0017-0018):** Indexes → Development Seeding
6. **Enhancements (0019-0028):** Booking improvements → Theming → Availability → OAuth → Payments → Staff → Offline → Analytics
7. **Hardening (0029-0031):** Database hardening → Security hardening → Enhanced notifications

### Migration Best Practices

1. **Idempotent Operations:** All migrations use `IF NOT EXISTS` patterns
2. **Transaction Wrapping:** Each migration wrapped in `BEGIN/COMMIT`
3. **Rollback Support:** Helper functions for rollback scenarios
4. **Data Validation:** Comprehensive constraint checking
5. **Performance Considerations:** Indexes created after table creation
6. **Security First:** RLS enabled before data insertion

---

*This comprehensive report was generated on January 27, 2025, based on analysis of 31 migration files, 39 tables, 40 functions, 80+ indexes, 98 RLS policies, 62+ constraints, 44 triggers, and 4 materialized views. The report provides complete visibility into the Tithi database architecture, operations, and maintenance procedures.*
