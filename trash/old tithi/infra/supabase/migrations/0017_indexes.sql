BEGIN;

-- ============================================================================
-- Task 17: Performance Indexes
-- ============================================================================
-- This migration adds performance indexes to support common query patterns
-- across the multi-tenant database following the Index Strategy in the 
-- Context Pack. Focuses on high-traffic paths: bookings time queries,
-- service discovery, payment tracking, customer filtering, and outbox processing.

-- ============================================================================
-- High-Write Tables: Core tenant + timestamp patterns
-- ============================================================================

-- Core tenancy tables (tenants is root table, no tenant_id)
CREATE INDEX IF NOT EXISTS tenants_created_idx 
    ON tenants (created_at);

CREATE INDEX IF NOT EXISTS users_created_idx 
    ON users (created_at);

CREATE INDEX IF NOT EXISTS memberships_tenant_created_idx 
    ON memberships (tenant_id, created_at);

-- Business data tables
CREATE INDEX IF NOT EXISTS customers_tenant_created_idx 
    ON customers (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS resources_tenant_created_idx 
    ON resources (tenant_id, created_at);

CREATE INDEX IF NOT EXISTS services_tenant_created_idx 
    ON services (tenant_id, created_at);

-- ============================================================================
-- Bookings: Time-based and operational queries
-- ============================================================================

-- Core booking time queries (calendar views, scheduling)
CREATE INDEX IF NOT EXISTS bookings_tenant_start_desc_idx 
    ON bookings (tenant_id, start_at DESC);

CREATE INDEX IF NOT EXISTS bookings_resource_start_idx 
    ON bookings (resource_id, start_at);

-- Active bookings filtering (supports overlap prevention queries)
-- Context Pack specifies: partial for active statuses (pending, confirmed, checked_in)
CREATE INDEX IF NOT EXISTS bookings_tenant_status_start_desc_idx 
    ON bookings (tenant_id, status, start_at DESC) 
    WHERE status IN ('pending', 'confirmed', 'checked_in');

-- Reschedule tracking (audit and business intelligence)
CREATE INDEX IF NOT EXISTS bookings_tenant_rescheduled_from_idx 
    ON bookings (tenant_id, rescheduled_from) 
    WHERE rescheduled_from IS NOT NULL;

-- ============================================================================
-- Services: Discovery and categorization
-- ============================================================================

-- Service visibility (active services filtering)
CREATE INDEX IF NOT EXISTS services_tenant_active_idx 
    ON services (tenant_id, active);

-- Category-based service discovery (chips and filtering UI)
CREATE INDEX IF NOT EXISTS services_tenant_category_active_idx 
    ON services (tenant_id, category, active) 
    WHERE active = true AND category IS NOT NULL AND category != '';

-- Note: GIN index on search_vector not created as column doesn't exist in services table
-- This would be added in a future migration if search functionality is needed

-- ============================================================================
-- Payments: Financial tracking and reporting
-- ============================================================================

-- Payment timeline queries (financial reporting)
CREATE INDEX IF NOT EXISTS payments_tenant_created_desc_idx 
    ON payments (tenant_id, created_at DESC);

-- Payment status tracking (processing pipelines)
CREATE INDEX IF NOT EXISTS payments_tenant_payment_status_idx 
    ON payments (tenant_id, status);

-- ============================================================================
-- Customers: Segmentation and CRM
-- ============================================================================

-- First-time customer segmentation (marketing and onboarding)
CREATE INDEX IF NOT EXISTS customers_tenant_is_first_time_idx 
    ON customers (tenant_id, is_first_time);

-- ============================================================================
-- Events Outbox: Reliable delivery system
-- ============================================================================

-- Outbox worker consumption (ready events processing)
CREATE INDEX IF NOT EXISTS events_outbox_tenant_status_idx 
    ON events_outbox (tenant_id, status);

-- Event code-based processing with timing
-- Context Pack specifies: (tenant_id, topic, ready_at) - using event_code as the topic equivalent
CREATE INDEX IF NOT EXISTS events_outbox_tenant_event_ready_idx 
    ON events_outbox (tenant_id, event_code, ready_at) 
    WHERE status = 'ready';

-- Note: Optional unique (tenant_id, key) already exists from 0013_audit_logs.sql

-- ============================================================================
-- Audit Logs: Compliance and debugging
-- ============================================================================

-- Design Brief requires: BRIN on created_at + BTREE on (tenant_id, created_at)
-- BRIN index on created_at for efficient time-based queries and retention purging
CREATE INDEX IF NOT EXISTS audit_logs_brin_created_at_idx 
    ON audit_logs USING BRIN (created_at);

-- BTREE index on (tenant_id, created_at) for scoped lookups
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx 
    ON audit_logs (tenant_id, created_at);

-- ============================================================================
-- Notifications: Queue processing and retry logic
-- ============================================================================

-- Notification processing by tenant and schedule
CREATE INDEX IF NOT EXISTS notifications_tenant_scheduled_idx 
    ON notifications (tenant_id, scheduled_at) 
    WHERE status = 'queued';

-- ============================================================================
-- Availability: Slot generation support
-- ============================================================================

-- Resource availability lookup (existing indexes support core queries)
-- availability_rules_resource_dow_idx and availability_exceptions_resource_date_idx
-- already created in 0007_availability.sql provide needed performance

COMMIT;
