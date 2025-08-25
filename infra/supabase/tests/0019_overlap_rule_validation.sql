-- infra/supabase/tests/0019_overlap_rule_validation.sql
-- pgTAP tests for updated bookings overlap rule (excluding completed status)
-- Tests that completed bookings don't block future bookings

BEGIN;

-- Enable pgTAP extension if not already enabled
SELECT plan(8);

-- Clean up any existing test data
DELETE FROM public.bookings WHERE client_generated_id LIKE 'p19-overlap-rule-%';
DELETE FROM public.customers WHERE email LIKE '%@overlap-rule-test-p19.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Overlap Rule Test%';
DELETE FROM public.services WHERE name LIKE 'P19 Overlap Rule Test%';
DELETE FROM public.tenants WHERE slug = 'p19-overlap-rule-test';
DELETE FROM public.users WHERE primary_email LIKE '%@overlap-rule-test-p19.com';

-- =================================================================
-- SETUP: Test Data Creation
-- =================================================================

-- Create test tenant
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('44444444-4444-4444-4444-444444444444', 'p19-overlap-rule-test', 'America/New_York');

-- Create test user
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('u4444444-4444-4444-4444-444444444444', 'Overlap Rule Test User', 'user@overlap-rule-test-p19.com');

-- Create membership
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('44444444-4444-4444-4444-444444444444', 'u4444444-4444-4444-4444-444444444444', 'owner');

-- Create test customer
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('c4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'Test Customer', 'customer@overlap-rule-test-p19.com');

-- Create test resource
INSERT INTO public.resources (id, tenant_id, type, tz, capacity, name) VALUES
  ('r4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'room', 'America/New_York', 1, 'P19 Overlap Rule Test Room');

-- Create test service
INSERT INTO public.services (id, tenant_id, slug, name, duration_min, price_cents) VALUES
  ('s4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'p19-overlap-rule-test', 'P19 Overlap Rule Test Service', 30, 5000);

-- =================================================================
-- TEST 1: Two non-overlapping completed bookings can coexist with future pending booking
-- =================================================================

-- Create first completed booking (9:00-9:30 AM)
INSERT INTO public.bookings (
    id, tenant_id, customer_id, resource_id, service_id,
    start_at, end_at, booking_tz, status, attendee_count, client_generated_id
) VALUES (
    'b1111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    'c4444444-4444-4444-4444-444444444444',
    'r4444444-4444-4444-4444-444444444444',
    's4444444-4444-4444-4444-444444444444',
    '2025-01-27 09:00:00-05', '2025-01-27 09:30:00-05',
    'America/New_York', 'completed', 1, 'p19-overlap-rule-test-1'
);

-- Create second completed booking (10:00-10:30 AM)
INSERT INTO public.bookings (
    id, tenant_id, customer_id, resource_id, service_id,
    start_at, end_at, booking_tz, status, attendee_count, client_generated_id
) VALUES (
    'b2222222-2222-2222-2222-222222222222',
    '44444444-4444-4444-4444-444444444444',
    'c4444444-4444-4444-4444-444444444444',
    'r4444444-4444-4444-4444-444444444444',
    's4444444-4444-4444-4444-444444444444',
    '2025-01-27 10:00:00-05', '2025-01-27 10:30:00-05',
    'America/New_York', 'completed', 1, 'p19-overlap-rule-test-2'
);

-- Test that we can create a future pending booking (11:00-11:30 AM) without conflict
-- This should succeed because completed bookings don't participate in overlap prevention
SELECT lives_ok(
    $$
    INSERT INTO public.bookings (
        id, tenant_id, customer_id, resource_id, service_id,
        start_at, end_at, booking_tz, status, attendee_count, client_generated_id
    ) VALUES (
        'b3333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444',
        'c4444444-4444-4444-4444-444444444444',
        'r4444444-4444-4444-4444-444444444444',
        's4444444-4444-4444-4444-444444444444',
        '2025-01-27 11:00:00-05', '2025-01-27 11:30:00-05',
        'America/New_York', 'pending', 1, 'p19-overlap-rule-test-3'
    )
    $$,
    'Future pending booking should succeed after completed bookings (completed status excluded from overlap)'
);

-- =================================================================
-- TEST 2: Overlapping confirmed and pending bookings still conflict
-- =================================================================

-- This should fail due to overlap with the pending booking we just created
SELECT throws_ok(
    $$
    INSERT INTO public.bookings (
        id, tenant_id, customer_id, resource_id, service_id,
        start_at, end_at, booking_tz, status, attendee_count, client_generated_id
    ) VALUES (
        'b4444444-4444-4444-4444-444444444444',
        '44444444-4444-4444-4444-444444444444',
        'c4444444-4444-4444-4444-444444444444',
        'r4444444-4444-4444-4444-444444444444',
        's4444444-4444-4444-4444-444444444444',
        '2025-01-27 11:15:00-05', '2025-01-27 11:45:00-05',
        'America/New_York', 'confirmed', 1, 'p19-overlap-rule-test-4'
    )
    $$,
    'Overlapping confirmed and pending bookings should still conflict (exclusion constraint active)'
);

-- =================================================================
-- TEST 3: Verify start_at < end_at invariant still holds
-- =================================================================

-- This should fail due to invalid time ordering
SELECT throws_ok(
    $$
    INSERT INTO public.bookings (
        id, tenant_id, customer_id, resource_id, service_id,
        start_at, end_at, booking_tz, status, attendee_count, client_generated_id
    ) VALUES (
        'b5555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444',
        'c4444444-4444-4444-4444-444444444444',
        'r4444444-4444-4444-4444-444444444444',
        's4444444-4444-4444-4444-444444444444',
        '2025-01-27 12:00:00-05', '2025-01-27 11:30:00-05',
        'America/New_York', 'pending', 1, 'p19-overlap-rule-test-5'
    )
    $$,
    'start_at < end_at invariant should still be enforced'
);

-- =================================================================
-- TEST 4: Verify the constraint definition is correct
-- =================================================================

-- Check that the constraint exists and has the right definition
SELECT has_constraint(
    'public.bookings',
    'bookings_excl_resource_time',
    'bookings_excl_resource_time constraint should exist'
);

-- Verify the constraint definition excludes completed status
SELECT matches(
    (SELECT pg_get_constraintdef(c.oid)
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON t.relnamespace = n.oid
     WHERE t.relname = 'bookings'
       AND n.nspname = 'public'
       AND c.conname = 'bookings_excl_resource_time'),
    '.*status IN \(''pending'', ''confirmed'', ''checked_in''\).*',
    'Constraint should only include pending, confirmed, checked_in statuses'
);

-- Verify completed status is NOT in the constraint
SELECT doesnt_match(
    (SELECT pg_get_constraintdef(c.oid)
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON t.relnamespace = n.oid
     WHERE t.relname = 'bookings'
       AND n.nspname = 'public'
       AND c.conname = 'bookings_excl_resource_time'),
    '.*completed.*',
    'Constraint should NOT include completed status'
);

-- =================================================================
-- TEST 5: Verify that completed bookings don't block each other
-- =================================================================

-- Create overlapping completed bookings - this should succeed
SELECT lives_ok(
    $$
    INSERT INTO public.bookings (
        id, tenant_id, customer_id, resource_id, service_id,
        start_at, end_at, booking_tz, status, attendee_count, client_generated_id
    ) VALUES (
        'b6666666-6666-6666-6666-666666666666',
        '44444444-4444-4444-4444-444444444444',
        'c4444444-4444-4444-4444-444444444444',
        'r4444444-4444-4444-4444-444444444444',
        's4444444-4444-4444-4444-444444444444',
        '2025-01-27 13:00:00-05', '2025-01-27 13:30:00-05',
        'America/New_York', 'completed', 1, 'p19-overlap-rule-test-6'
    )
    $$,
    'Overlapping completed booking should succeed (completed status excluded from overlap)'
);

-- Create another overlapping completed booking - this should also succeed
SELECT lives_ok(
    $$
    INSERT INTO public.bookings (
        id, tenant_id, customer_id, resource_id, service_id,
        start_at, end_at, booking_tz, status, attendee_count, client_generated_id
    ) VALUES (
        'b7777777-7777-7777-7777-777777777777',
        '44444444-4444-4444-4444-444444444444',
        'c4444444-4444-4444-4444-444444444444',
        'r4444444-4444-4444-4444-444444444444',
        's4444444-4444-4444-4444-444444444444',
        '2025-01-27 13:15:00-05', '2025-01-27 13:45:00-05',
        'America/New_York', 'completed', 1, 'p19-overlap-rule-test-7'
    )
    $$,
    'Second overlapping completed booking should also succeed'
);

-- =================================================================
-- CLEANUP: Remove test data
-- =================================================================

DELETE FROM public.bookings WHERE client_generated_id LIKE 'p19-overlap-rule-%';
DELETE FROM public.customers WHERE email LIKE '%@overlap-rule-test-p19.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Overlap Rule Test%';
DELETE FROM public.services WHERE name LIKE 'P19 Overlap Rule Test%';
DELETE FROM public.tenants WHERE slug = 'p19-overlap-rule-test';
DELETE FROM public.users WHERE primary_email LIKE '%@overlap-rule-test-p19.com';

-- =================================================================
-- FINISH TESTING
-- =================================================================

SELECT * FROM finish();

ROLLBACK;
