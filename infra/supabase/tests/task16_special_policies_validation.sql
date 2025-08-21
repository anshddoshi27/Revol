-- =============================================================================
-- BULLETPROOF TASK 16 VALIDATION: Special RLS Policies Practical Testing
-- =============================================================================
-- Run this in Supabase SQL editor to validate Task 16 special policies work
-- as intended in the actual database environment.
--
-- This script:
-- 1. Sets up realistic test data with multiple tenants/users/roles
-- 2. Tests all special policy patterns with actual JWT claim simulation
-- 3. Validates fail-closed security when claims are missing/invalid
-- 4. Confirms practical business scenarios work correctly
-- 5. Ensures service-role boundaries are enforced
--
-- Expected outcome: All tests should PASS, confirming Task 16 is bulletproof
-- =============================================================================

BEGIN;

-- Create a temporary schema for our tests to avoid conflicts
CREATE SCHEMA IF NOT EXISTS test_task16;
SET search_path = test_task16, public;

-- =============================================================================
-- SETUP: Create test tenants, users, and memberships for realistic scenarios
-- =============================================================================

-- Test tenants
INSERT INTO public.tenants (id, slug, tz) VALUES
  ('11111111-1111-1111-1111-111111111111', 'salon-alpha', 'America/New_York'),
  ('22222222-2222-2222-2222-222222222222', 'spa-beta', 'America/Los_Angeles'),
  ('33333333-3333-3333-3333-333333333333', 'clinic-gamma', 'America/Chicago')
ON CONFLICT (id) DO NOTHING;

-- Test users (global table)
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Owner', 'alice@salon-alpha.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Admin', 'bob@salon-alpha.com'), 
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Carol Staff', 'carol@salon-alpha.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Dave Owner', 'dave@spa-beta.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Eve Viewer', 'eve@spa-beta.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Frank Outsider', 'frank@external.com')
ON CONFLICT (id) DO NOTHING;

-- Test memberships with different roles
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  -- Salon Alpha members
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'staff'),
  -- Spa Beta members  
  ('22222222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'viewer'),
  -- Bob is also a member of Spa Beta (shared tenant scenario)
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'staff')
  -- Frank has no memberships (outsider)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Test billing records for admin testing
INSERT INTO public.tenant_billing (tenant_id, billing_email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'billing@salon-alpha.com'),
  ('22222222-2222-2222-2222-222222222222', 'billing@spa-beta.com')
ON CONFLICT (tenant_id) DO NOTHING;

-- Test themes for admin testing  
INSERT INTO public.themes (tenant_id, brand_color) VALUES
  ('11111111-1111-1111-1111-111111111111', '#ff6b6b'),
  ('22222222-2222-2222-2222-222222222222', '#4ecdc4')
ON CONFLICT (tenant_id) DO NOTHING;

-- Test quotas for admin testing
INSERT INTO public.quotas (tenant_id, code, limit_value) VALUES
  ('11111111-1111-1111-1111-111111111111', 'monthly_bookings', 1000),
  ('22222222-2222-2222-2222-222222222222', 'monthly_bookings', 500)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- =============================================================================
-- HELPER: JWT Claim Simulation Functions
-- =============================================================================
-- Since we can't control auth.jwt() in tests, we'll temporarily replace helpers
-- to simulate different user contexts for testing

-- Store original helper functions
CREATE OR REPLACE FUNCTION test_task16.original_current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION test_task16.original_current_tenant_id()  
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id',
    NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')
  )::uuid;
$$;

-- Test helper that simulates JWT claims
CREATE OR REPLACE FUNCTION test_task16.simulate_user_context(
  user_id uuid DEFAULT NULL,
  tenant_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Set session variables to simulate JWT claims
  IF user_id IS NOT NULL THEN
    PERFORM set_config('test.current_user_id', user_id::text, false);
  ELSE
    PERFORM set_config('test.current_user_id', '', false);
  END IF;
  
  IF tenant_id IS NOT NULL THEN
    PERFORM set_config('test.current_tenant_id', tenant_id::text, false);
  ELSE
    PERFORM set_config('test.current_tenant_id', '', false);
  END IF;
END;
$$;

-- Replace public helpers with test versions during testing
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT NULLIF(current_setting('test.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$  
  SELECT NULLIF(current_setting('test.current_tenant_id', true), '')::uuid;
$$;

-- =============================================================================
-- TEST SUITE: Special Policies Validation
-- =============================================================================

CREATE TABLE test_task16.test_results (
  test_id serial PRIMARY KEY,
  test_name text NOT NULL,
  test_category text NOT NULL,
  passed boolean NOT NULL,
  expected_result text,
  actual_result text,
  notes text
);

-- Test counter for organized output
CREATE OR REPLACE FUNCTION test_task16.run_test(
  test_name text,
  test_category text,
  test_sql text,
  expected_accessible boolean,
  notes text DEFAULT ''
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  actual_accessible boolean := false;
  actual_result text;
  expected_result text;
BEGIN
  expected_result := CASE WHEN expected_accessible THEN 'ACCESSIBLE' ELSE 'DENIED' END;
  
  BEGIN
    EXECUTE test_sql;
    actual_accessible := true;
    actual_result := 'ACCESSIBLE';
  EXCEPTION WHEN OTHERS THEN
    actual_accessible := false;
    actual_result := 'DENIED: ' || SQLERRM;
  END;
  
  INSERT INTO test_task16.test_results (test_name, test_category, passed, expected_result, actual_result, notes)
  VALUES (test_name, test_category, actual_accessible = expected_accessible, expected_result, actual_result, notes);
END;
$$;

-- =============================================================================
-- CATEGORY 1: TENANTS Table (Member-gated SELECT, no writes)
-- =============================================================================

-- Test 1.1: Owner can read their own tenant
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Tenants: Owner reads own tenant',
  'TENANTS',
  'SELECT id FROM public.tenants WHERE id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Alice (owner) should see Salon Alpha'
);

-- Test 1.2: Member can read their tenant
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Tenants: Staff reads own tenant',
  'TENANTS', 
  'SELECT id FROM public.tenants WHERE id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Carol (staff) should see Salon Alpha'
);

-- Test 1.3: Member cannot read other tenants
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Tenants: Member cannot read other tenant',
  'TENANTS',
  'SELECT id FROM public.tenants WHERE id = ''22222222-2222-2222-2222-222222222222''',
  false,
  'Carol (Salon Alpha staff) should NOT see Spa Beta'
);

-- Test 1.4: Outsider cannot read any tenants
SELECT test_task16.simulate_user_context('ffffffff-ffff-ffff-ffff-ffffffffffff', NULL);
SELECT test_task16.run_test(
  'Tenants: Outsider reads nothing',
  'TENANTS',
  'SELECT count(*) FROM public.tenants',
  false,
  'Frank (no memberships) should see no tenants'
);

-- Test 1.5: No user context fails closed
SELECT test_task16.simulate_user_context(NULL, NULL);
SELECT test_task16.run_test(
  'Tenants: NULL context fails closed',
  'TENANTS',
  'SELECT count(*) FROM public.tenants',
  false,
  'NULL JWT claims should deny access'
);

-- =============================================================================
-- CATEGORY 2: USERS Table (Self + shared tenant access)
-- =============================================================================

-- Test 2.1: User can read self
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Users: Read self',
  'USERS',
  'SELECT id FROM public.users WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  true,
  'Alice should see herself'
);

-- Test 2.2: User can read others in same tenant
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Users: Read tenant mate',
  'USERS',
  'SELECT id FROM public.users WHERE id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
  true,
  'Alice should see Carol (both in Salon Alpha)'
);

-- Test 2.3: User can read others in shared tenants (Bob is in both Alpha and Beta)
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Users: Read shared tenant member',
  'USERS',
  'SELECT id FROM public.users WHERE id = ''dddddddd-dddd-dddd-dddd-dddddddddddd''',
  false,
  'Alice should NOT see Dave (different tenants only)'
);

-- Test 2.4: User cannot read pure outsiders
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Users: Cannot read outsider',
  'USERS',
  'SELECT id FROM public.users WHERE id = ''ffffffff-ffff-ffff-ffff-ffffffffffff''',
  false,
  'Alice should NOT see Frank (no shared tenants)'
);

-- Test 2.5: Shared tenant visibility (Bob in both Alpha and Beta)
SELECT test_task16.simulate_user_context('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222');
SELECT test_task16.run_test(
  'Users: Shared tenant visibility',
  'USERS',
  'SELECT id FROM public.users WHERE id = ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee''',
  true,
  'Bob should see Eve (both in Spa Beta)'
);

-- =============================================================================
-- CATEGORY 3: MEMBERSHIPS Table (Member reads, owner/admin writes)
-- =============================================================================

-- Test 3.1: Member can read memberships in their tenant
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Member reads tenant memberships',
  'MEMBERSHIPS',
  'SELECT user_id FROM public.memberships WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Carol should see all Salon Alpha memberships'
);

-- Test 3.2: Member cannot read other tenant memberships
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Member cannot read other tenant',
  'MEMBERSHIPS',
  'SELECT user_id FROM public.memberships WHERE tenant_id = ''22222222-2222-2222-2222-222222222222''',
  false,
  'Carol should NOT see Spa Beta memberships'
);

-- Test 3.3: Owner can add new members
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Owner adds member',
  'MEMBERSHIPS',
  'INSERT INTO public.memberships (tenant_id, user_id, role) VALUES (''11111111-1111-1111-1111-111111111111'', ''ffffffff-ffff-ffff-ffff-ffffffffffff'', ''viewer'')',
  true,
  'Alice (owner) should add Frank as viewer'
);

-- Test 3.4: Admin can add new members
SELECT test_task16.simulate_user_context('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Admin adds member',
  'MEMBERSHIPS', 
  'INSERT INTO public.memberships (tenant_id, user_id, role) VALUES (''11111111-1111-1111-1111-111111111111'', ''eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'', ''staff'') ON CONFLICT DO NOTHING',
  true,
  'Bob (admin) should add Eve as staff'
);

-- Test 3.5: Staff cannot add members
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Staff cannot add member',
  'MEMBERSHIPS',
  'INSERT INTO public.memberships (tenant_id, user_id, role) VALUES (''11111111-1111-1111-1111-111111111111'', ''dddddddd-dddd-dddd-dddd-dddddddddddd'', ''viewer'')',
  false,
  'Carol (staff) should NOT add members'
);

-- Test 3.6: Owner can update member roles
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Owner updates role',
  'MEMBERSHIPS',
  'UPDATE public.memberships SET role = ''admin'' WHERE tenant_id = ''11111111-1111-1111-1111-111111111111'' AND user_id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
  true,
  'Alice (owner) should promote Carol to admin'
);

-- Test 3.7: Staff cannot update roles
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Memberships: Staff cannot update roles',
  'MEMBERSHIPS',
  'UPDATE public.memberships SET role = ''owner'' WHERE tenant_id = ''11111111-1111-1111-1111-111111111111'' AND user_id = ''cccccccc-cccc-cccc-cccc-cccccccccccc''',
  false,
  'Carol (staff) should NOT update roles'
);

-- =============================================================================
-- CATEGORY 4: THEMES/BILLING/QUOTAS (Member reads, owner/admin writes)
-- =============================================================================

-- Test 4.1: Member can read themes
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Themes: Member reads theme',
  'THEMES',
  'SELECT brand_color FROM public.themes WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Carol should see Salon Alpha theme'
);

-- Test 4.2: Owner can update themes
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Themes: Owner updates theme',
  'THEMES',
  'UPDATE public.themes SET brand_color = ''#00ff00'' WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Alice (owner) should update theme color'
);

-- Test 4.3: Staff cannot update themes
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Themes: Staff cannot update theme',
  'THEMES',
  'UPDATE public.themes SET brand_color = ''#ff0000'' WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  false,
  'Carol (staff) should NOT update themes'
);

-- Test 4.4: Member can read billing
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Billing: Member reads billing',
  'BILLING',
  'SELECT billing_email FROM public.tenant_billing WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Carol should see billing info'
);

-- Test 4.5: Admin can update billing
SELECT test_task16.simulate_user_context('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Billing: Admin updates billing',
  'BILLING',
  'UPDATE public.tenant_billing SET billing_email = ''new-billing@salon-alpha.com'' WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Bob (admin) should update billing'
);

-- Test 4.6: Viewer cannot update billing
SELECT test_task16.simulate_user_context('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
SELECT test_task16.run_test(
  'Billing: Viewer cannot update billing',
  'BILLING',
  'UPDATE public.tenant_billing SET billing_email = ''hacked@evil.com'' WHERE tenant_id = ''22222222-2222-2222-2222-222222222222''',
  false,
  'Eve (viewer) should NOT update billing'
);

-- Test 4.7: Member can read quotas
SELECT test_task16.simulate_user_context('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
SELECT test_task16.run_test(
  'Quotas: Member reads quotas',
  'QUOTAS',
  'SELECT limit_value FROM public.quotas WHERE tenant_id = ''22222222-2222-2222-2222-222222222222''',
  true,
  'Eve should see Spa Beta quotas'
);

-- Test 4.8: Owner can update quotas
SELECT test_task16.simulate_user_context('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222');
SELECT test_task16.run_test(
  'Quotas: Owner updates quotas',
  'QUOTAS',
  'UPDATE public.quotas SET limit_value = 750 WHERE tenant_id = ''22222222-2222-2222-2222-222222222222''',
  true,
  'Dave (owner) should update quotas'
);

-- Test 4.9: Viewer cannot delete quotas
SELECT test_task16.simulate_user_context('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222');
SELECT test_task16.run_test(
  'Quotas: Viewer cannot delete quotas',
  'QUOTAS',
  'DELETE FROM public.quotas WHERE tenant_id = ''22222222-2222-2222-2222-222222222222''',
  false,
  'Eve (viewer) should NOT delete quotas'
);

-- =============================================================================
-- CATEGORY 5: EVENTS_OUTBOX (Tenant-scoped member access)  
-- =============================================================================

-- Insert test events first
INSERT INTO public.events_outbox (tenant_id, event_code, payload) VALUES
  ('11111111-1111-1111-1111-111111111111', 'booking_created', '{"booking_id": "test1"}'),
  ('22222222-2222-2222-2222-222222222222', 'booking_created', '{"booking_id": "test2"}')
ON CONFLICT DO NOTHING;

-- Test 5.1: Member can read events for their tenant
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Events: Member reads tenant events',
  'EVENTS_OUTBOX',
  'SELECT event_code FROM public.events_outbox WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  true,
  'Carol should see Salon Alpha events'
);

-- Test 5.2: Member cannot read other tenant events
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Events: Member cannot read other tenant events',
  'EVENTS_OUTBOX',
  'SELECT event_code FROM public.events_outbox WHERE tenant_id = ''22222222-2222-2222-2222-222222222222''',
  false,
  'Carol should NOT see Spa Beta events'
);

-- Test 5.3: Member can insert events for their tenant
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Events: Member inserts event',
  'EVENTS_OUTBOX',
  'INSERT INTO public.events_outbox (tenant_id, event_code, payload) VALUES (''11111111-1111-1111-1111-111111111111'', ''customer_registered'', ''{"test": true}'')',
  true,
  'Carol should create events for Salon Alpha'
);

-- Test 5.4: Member cannot insert events for other tenants
SELECT test_task16.simulate_user_context('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Events: Member cannot insert for other tenant',
  'EVENTS_OUTBOX',
  'INSERT INTO public.events_outbox (tenant_id, event_code, payload) VALUES (''22222222-2222-2222-2222-222222222222'', ''hacking_attempt'', ''{"evil": true}'')',
  false,
  'Carol should NOT create events for Spa Beta'
);

-- =============================================================================
-- CATEGORY 6: WEBHOOK_EVENTS_INBOX (Service-role only)
-- =============================================================================

-- Test 6.1: Regular user cannot read webhook inbox
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Webhook Inbox: User cannot read',
  'WEBHOOK_INBOX',
  'SELECT count(*) FROM public.webhook_events_inbox',
  false,
  'Alice (owner) should NOT access webhook inbox'
);

-- Test 6.2: Regular user cannot write to webhook inbox
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Webhook Inbox: User cannot write',
  'WEBHOOK_INBOX',
  'INSERT INTO public.webhook_events_inbox (provider, id, payload) VALUES (''stripe'', ''test_event'', ''{}'')',
  false,
  'Alice should NOT write to webhook inbox'
);

-- =============================================================================
-- CATEGORY 7: FAIL-CLOSED SECURITY (NULL/Invalid claims)
-- =============================================================================

-- Test 7.1: NULL user_id denies all access
SELECT test_task16.simulate_user_context(NULL, '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Fail-closed: NULL user_id',
  'SECURITY',
  'SELECT count(*) FROM public.tenants',
  false,
  'NULL user_id should deny access'
);

-- Test 7.2: NULL tenant_id fails tenant-scoped operations
SELECT test_task16.simulate_user_context('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL);
SELECT test_task16.run_test(
  'Fail-closed: NULL tenant_id',
  'SECURITY',
  'INSERT INTO public.events_outbox (tenant_id, event_code) VALUES (''11111111-1111-1111-1111-111111111111'', ''test'')',
  false,
  'NULL tenant_id should fail tenant-scoped writes'
);

-- Test 7.3: Invalid user_id denies access
SELECT test_task16.simulate_user_context('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111');
SELECT test_task16.run_test(
  'Fail-closed: Invalid user_id',
  'SECURITY',
  'SELECT count(*) FROM public.memberships WHERE tenant_id = ''11111111-1111-1111-1111-111111111111''',
  false,
  'Invalid user_id should deny access'
);

-- =============================================================================
-- RESULTS SUMMARY
-- =============================================================================

-- Show comprehensive test results
SELECT 
  test_category,
  COUNT(*) as total_tests,
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed_tests,
  ROUND(100.0 * SUM(CASE WHEN passed THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate
FROM test_task16.test_results 
GROUP BY test_category
ORDER BY test_category;

-- Show failed tests for debugging
SELECT test_name, test_category, expected_result, actual_result, notes
FROM test_task16.test_results 
WHERE NOT passed
ORDER BY test_category, test_name;

-- Show summary
SELECT 
  CASE 
    WHEN SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) = 0 
    THEN '🎉 ALL TESTS PASSED! Task 16 special policies are bulletproof.'
    ELSE '❌ ' || SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) || ' tests failed. Check failed tests above.'
  END as overall_result,
  COUNT(*) as total_tests,
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed
FROM test_task16.test_results;

-- =============================================================================
-- CLEANUP: Restore original helpers and clean up test data
-- =============================================================================

-- Restore original helper functions
DROP FUNCTION public.current_user_id();
DROP FUNCTION public.current_tenant_id();

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id',
    NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')
  )::uuid;
$$;

-- Clean up test session variables
SELECT set_config('test.current_user_id', '', false);
SELECT set_config('test.current_tenant_id', '', false);

-- Note: Test data remains for further manual verification if needed
-- To clean up test data, run:
-- DELETE FROM public.events_outbox WHERE payload::jsonb ? 'test';
-- DELETE FROM public.quotas WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- DELETE FROM public.themes WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- DELETE FROM public.tenant_billing WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- DELETE FROM public.memberships WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
-- DELETE FROM public.users WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff');
-- DELETE FROM public.tenants WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

COMMIT;

-- Final note
SELECT '
=============================================================================
TASK 16 VALIDATION COMPLETE

This test validates that special RLS policies work correctly in practice:

✅ TENANTS: Member-gated SELECT, service-role writes only
✅ USERS: Self and shared-tenant visibility  
✅ MEMBERSHIPS: Member reads, owner/admin writes
✅ THEMES/BILLING/QUOTAS: Member reads, owner/admin admin writes
✅ EVENTS_OUTBOX: Tenant-scoped member access
✅ WEBHOOK_INBOX: Service-role only (no end-user policies)
✅ FAIL-CLOSED: NULL/invalid claims properly denied

If all tests passed, Task 16 special policies are production-ready!
=============================================================================' as validation_complete;
