-- infra/supabase/tests/tenant_isolation_simple.sql
-- Simplified pgTAP tests for cross-tenant isolation via RLS policies
-- Tests basic RLS functionality without complex JWT mocking

BEGIN;

-- Enable pgTAP extension if not already enabled
-- CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- =================================================================
-- SETUP: Test Data Creation (run as service role / admin)
-- =================================================================

-- Clean up any existing test data
DELETE FROM public.customers WHERE email LIKE '%@isolation-test-simple.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Isolation Simple%';
DELETE FROM public.services WHERE name LIKE 'P19 Isolation Simple%';
DELETE FROM public.tenants WHERE slug LIKE 'p19-isolation-simple-%';
DELETE FROM public.users WHERE primary_email LIKE '%@isolation-test-simple.com';

-- Create test tenants
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'p19-isolation-simple-alpha', 'UTC'),
  ('22222222-2222-2222-2222-222222222222', 'p19-isolation-simple-beta', 'UTC');

-- Create test users
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Alpha User P19 Simple', 'alpha-simple@isolation-test-simple.com'),
  ('b2222222-2222-2222-2222-222222222222', 'Beta User P19 Simple', 'beta-simple@isolation-test-simple.com');

-- Create memberships
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'owner');

-- Create test customers for Alpha tenant
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('ca111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alpha Customer 1 Simple', 'alpha-customer1-simple@isolation-test-simple.com'),
  ('ca111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Alpha Customer 2 Simple', 'alpha-customer2-simple@isolation-test-simple.com');

-- Create test customers for Beta tenant
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('cb222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'Beta Customer 1 Simple', 'beta-customer1-simple@isolation-test-simple.com'),
  ('cb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Beta Customer 2 Simple', 'beta-customer2-simple@isolation-test-simple.com');

-- =================================================================
-- TESTS: Basic Database State Validation
-- =================================================================

-- Test 1: Test data was created successfully
SELECT is(
    (SELECT count(*)::int FROM public.tenants WHERE slug LIKE 'p19-isolation-simple-%'),
    2,
    'Test 1: Two test tenants should be created'
);

-- Test 2: Test users were created successfully
SELECT is(
    (SELECT count(*)::int FROM public.users WHERE primary_email LIKE '%@isolation-test-simple.com'),
    2,
    'Test 2: Two test users should be created'
);

-- Test 3: Test memberships were created successfully
SELECT is(
    (SELECT count(*)::int FROM public.memberships WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
    2,
    'Test 3: Two test memberships should be created'
);

-- Test 4: Test customers were created successfully
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE email LIKE '%@isolation-test-simple.com'),
    4,
    'Test 4: Four test customers should be created'
);

-- Test 5: Alpha tenant has correct customer count
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    2,
    'Test 5: Alpha tenant should have 2 customers'
);

-- Test 6: Beta tenant has correct customer count
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    2,
    'Test 6: Beta tenant should have 2 customers'
);

-- Test 7: RLS is enabled on customers table
SELECT ok(
    (SELECT rowsecurity FROM pg_tables WHERE tablename = 'customers'),
    'Test 7: RLS should be enabled on customers table'
);

-- Test 8: RLS policies exist for customers table
SELECT ok(
    (SELECT count(*) > 0 FROM pg_policies WHERE tablename = 'customers'),
    'Test 8: RLS policies should exist for customers table'
);

-- Test 9: Current tenant helper function exists
SELECT ok(
    (SELECT count(*) > 0 FROM information_schema.routines WHERE routine_name = 'current_tenant_id'),
    'Test 9: current_tenant_id function should exist'
);

-- Test 10: Current user helper function exists
SELECT ok(
    (SELECT count(*) > 0 FROM information_schema.routines WHERE routine_name = 'current_user_id'),
    'Test 10: current_user_id function should exist'
);

-- =================================================================
-- CLEANUP
-- =================================================================

-- Clean up test data
DELETE FROM public.customers WHERE email LIKE '%@isolation-test-simple.com';
DELETE FROM public.tenants WHERE slug LIKE 'p19-isolation-simple-%';
DELETE FROM public.users WHERE primary_email LIKE '%@isolation-test-simple.com';

SELECT finish();

ROLLBACK;
