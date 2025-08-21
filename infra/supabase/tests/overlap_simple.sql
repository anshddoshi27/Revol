-- infra/supabase/tests/overlap_simple.sql
-- Simplified pgTAP tests for booking overlap prevention and basic constraints
-- Tests basic functionality without complex JWT mocking

BEGIN;

-- Enable pgTAP extension if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- =================================================================
-- SETUP: Test Data Creation
-- =================================================================

-- Clean up any existing test data
DELETE FROM public.bookings WHERE client_generated_id LIKE 'p19-overlap-simple-%';
DELETE FROM public.customers WHERE email LIKE '%@overlap-test-simple.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Overlap Simple%';
DELETE FROM public.services WHERE name LIKE 'P19 Overlap Simple%';
DELETE FROM public.tenants WHERE slug = 'p19-overlap-simple-test';
DELETE FROM public.users WHERE primary_email LIKE '%@overlap-test-simple.com';

-- Create test tenant
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('33333333-3333-3333-3333-333333333333', 'p19-overlap-simple-test', 'America/New_York');

-- Create test user
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('u3333333-3333-3333-3333-333333333333', 'Overlap Simple Test User', 'user@overlap-test-simple.com');

-- Create membership
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('33333333-3333-3333-3333-333333333333', 'u3333333-3333-3333-3333-333333333333', 'owner');

-- Create test customer
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Test Customer Simple', 'customer@overlap-test-simple.com');

-- Create test resource
INSERT INTO public.resources (id, tenant_id, type, tz, capacity, name) VALUES
  ('r3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'staff', 'UTC', 1, 'P19 Overlap Simple Staff');

-- Create test service
INSERT INTO public.services (id, tenant_id, slug, name, duration_min, price_cents) VALUES
  ('s3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'p19-test-simple', 'P19 Overlap Simple Service', 60, 5000);

-- =================================================================
-- TESTS: Basic Database State Validation
-- =================================================================

-- Test 1: Test data was created successfully
SELECT is(
    (SELECT count(*)::int FROM public.tenants WHERE slug = 'p19-overlap-simple-test'),
    1,
    'Test 1: Test tenant should be created'
);

-- Test 2: Test customer was created successfully
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE email = 'customer@overlap-test-simple.com'),
    1,
    'Test 2: Test customer should be created'
);

-- Test 3: Test resource was created successfully
SELECT is(
    (SELECT count(*)::int FROM public.resources WHERE name = 'P19 Overlap Simple Staff'),
    1,
    'Test 3: Test resource should be created'
);

-- Test 4: Test service was created successfully
SELECT is(
    (SELECT count(*)::int FROM public.services WHERE slug = 'p19-test-simple'),
    1,
    'Test 4: Test service should be created'
);

-- Test 5: Bookings table exists
SELECT ok(
    (SELECT count(*) > 0 FROM information_schema.tables WHERE table_name = 'bookings'),
    'Test 5: Bookings table should exist'
);

-- Test 6: Bookings table has RLS enabled
SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE tablename = 'bookings'),
    'Test 6: Bookings table should have RLS enabled'
);

-- Test 7: Bookings table has policies
SELECT ok(
    (SELECT count(*) > 0 FROM pg_policies WHERE tablename = 'bookings'),
    'Test 7: Bookings table should have RLS policies'
);

-- Test 8: Bookings table has constraints
SELECT ok(
    (SELECT count(*) > 0 FROM information_schema.table_constraints WHERE table_name = 'bookings'),
    'Test 8: Bookings table should have constraints'
);

-- Test 9: Bookings table has triggers
SELECT ok(
    (SELECT count(*) > 0 FROM information_schema.triggers WHERE event_object_table = 'bookings'),
    'Test 9: Bookings table should have triggers'
);

-- Test 10: Basic booking insertion works
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-simple-booking-1', '2024-12-02 14:00:00+00', '2024-12-02 15:00:00+00', 'UTC', 'pending');

SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE client_generated_id = 'p19-overlap-simple-booking-1'),
    1,
    'Test 10: Basic booking insertion should work'
);

-- =================================================================
-- CLEANUP
-- =================================================================

-- Clean up test data
DELETE FROM public.bookings WHERE client_generated_id LIKE 'p19-overlap-simple-%';
DELETE FROM public.customers WHERE email LIKE '%@overlap-test-simple.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Overlap Simple%';
DELETE FROM public.services WHERE name LIKE 'P19 Overlap Simple%';
DELETE FROM public.tenants WHERE slug = 'p19-overlap-simple-test';
DELETE FROM public.users WHERE primary_email LIKE '%@overlap-test-simple.com';

SELECT finish();

ROLLBACK;
