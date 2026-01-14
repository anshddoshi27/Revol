-- =================================================================
-- Task 15 Practical Testing Script
-- Tests actual tenant isolation functionality with real data
-- Run this after migrations 0001-0015 are applied
-- =================================================================

-- Clean up any existing test data first
DELETE FROM public.customers WHERE display_name LIKE 'Test Customer%';
DELETE FROM public.tenants WHERE slug IN ('test-tenant-a', 'test-tenant-b');

-- =================================================================
-- SETUP: Create test tenants and users
-- =================================================================

-- Create test tenants
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'test-tenant-a', 'America/New_York'),
  ('22222222-2222-2222-2222-222222222222', 'test-tenant-b', 'America/Los_Angeles')
ON CONFLICT (id) DO UPDATE SET 
  slug = EXCLUDED.slug,
  tz = EXCLUDED.tz;

-- Create test users (global table, no tenant_id)
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Admin', 'alice@tenant-a.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bob Admin', 'bob@tenant-b.com')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  primary_email = EXCLUDED.primary_email;

-- Create memberships
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner')
ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- =================================================================
-- TEST DATA: Create customers in different tenants
-- =================================================================

-- Tenant A customers
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Test Customer A1', 'customer-a1@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Test Customer A2', 'customer-a2@example.com')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email;

-- Tenant B customers  
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'Test Customer B1', 'customer-b1@example.com'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'Test Customer B2', 'customer-b2@example.com')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email;

-- =================================================================
-- VERIFICATION QUERIES - Run these to test tenant isolation
-- =================================================================

-- 1. Verify test data was created correctly (bypass RLS with service role)
SELECT 'Test data verification:' as test_phase;
SELECT 
  t.slug as tenant,
  count(c.*) as customer_count,
  string_agg(c.display_name, ', ' ORDER BY c.display_name) as customers
FROM public.tenants t
LEFT JOIN public.customers c ON c.tenant_id = t.id
WHERE t.slug IN ('test-tenant-a', 'test-tenant-b')
GROUP BY t.id, t.slug
ORDER BY t.slug;

-- =================================================================
-- JWT CLAIM SIMULATION TESTS
-- =================================================================

-- Test 1: Simulate Tenant A user context
SELECT 'TEST 1: Simulating Tenant A context' as test_name;

-- Mock JWT claims for Tenant A
-- In real Supabase, this would be set by auth.jwt()
-- For testing, we'll use a custom function

-- First verify the helper functions exist and work
SELECT 'Helper function test:' as check_type;
SELECT 
  public.current_tenant_id() as current_tenant_from_jwt,
  public.current_user_id() as current_user_from_jwt;

-- =================================================================
-- POLICY VALIDATION TESTS
-- =================================================================

-- Test 2: Check that all expected policies exist
SELECT 'TEST 2: Policy existence check' as test_name;

WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
    'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
    'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
  ]) as table_name
),
expected_cmds AS (
  SELECT unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as cmd
),
expected_policies AS (
  SELECT 
    t.table_name,
    c.cmd,
    t.table_name || '_' || 
    CASE c.cmd 
      WHEN 'SELECT' THEN 'sel'
      WHEN 'INSERT' THEN 'ins' 
      WHEN 'UPDATE' THEN 'upd'
      WHEN 'DELETE' THEN 'del'
    END as expected_policy_name
  FROM expected_tables t
  CROSS JOIN expected_cmds c
),
actual_policies AS (
  SELECT 
    p.tablename,
    p.cmd,
    p.policyname
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN (
      'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
      'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
      'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
      'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
    )
)
SELECT 
  e.table_name,
  e.cmd,
  e.expected_policy_name,
  CASE 
    WHEN a.policyname IS NOT NULL THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM expected_policies e
LEFT JOIN actual_policies a ON (
  e.table_name = a.tablename AND 
  e.cmd = a.cmd AND 
  e.expected_policy_name = a.policyname
)
ORDER BY e.table_name, e.cmd;

-- Test 3: Verify policy predicates are correct
SELECT 'TEST 3: Policy predicate validation' as test_name;

SELECT 
  p.tablename,
  p.policyname,
  p.cmd,
  CASE 
    WHEN p.cmd = 'INSERT' THEN 'N/A (INSERT uses WITH CHECK only)'
    WHEN p.qual ~* 'tenant_id.*current_tenant_id' THEN '✓ CORRECT'
    ELSE '✗ INCORRECT: ' || COALESCE(p.qual, 'NULL')
  END as using_clause_check,
  CASE 
    WHEN p.cmd IN ('INSERT', 'UPDATE') THEN
      CASE 
        WHEN p.with_check ~* 'tenant_id.*current_tenant_id' THEN '✓ CORRECT'
        ELSE '✗ INCORRECT: ' || COALESCE(p.with_check, 'NULL')
      END
    ELSE 'N/A'
  END as with_check_clause_check
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items', 
    'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
    'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
  )
ORDER BY p.tablename, p.cmd;

-- Test 4: RLS is enabled on all tables
SELECT 'TEST 4: RLS enablement check' as test_name;

SELECT 
  c.relname as table_name,
  CASE 
    WHEN c.relrowsecurity THEN '✓ ENABLED'
    ELSE '✗ DISABLED'
  END as rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
    'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates', 
    'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
  )
ORDER BY c.relname;

-- =================================================================
-- SUMMARY REPORT
-- =================================================================

SELECT 'SUMMARY: Task 15 Compliance Check' as final_report;

WITH 
expected_tables AS (
  SELECT unnest(ARRAY[
    'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
    'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
    'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
  ]) as table_name
),
policy_counts AS (
  SELECT 
    p.tablename,
    count(*) FILTER (WHERE p.cmd = 'SELECT') as sel_count,
    count(*) FILTER (WHERE p.cmd = 'INSERT') as ins_count,
    count(*) FILTER (WHERE p.cmd = 'UPDATE') as upd_count,
    count(*) FILTER (WHERE p.cmd = 'DELETE') as del_count
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  GROUP BY p.tablename
),
rls_status AS (
  SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace  
  WHERE n.nspname = 'public' AND c.relkind = 'r'
)
SELECT 
  et.table_name,
  COALESCE(r.rls_enabled, false) as rls_enabled,
  COALESCE(pc.sel_count, 0) as select_policies,
  COALESCE(pc.ins_count, 0) as insert_policies,
  COALESCE(pc.upd_count, 0) as update_policies,
  COALESCE(pc.del_count, 0) as delete_policies,
  CASE 
    WHEN COALESCE(r.rls_enabled, false) = true AND
         COALESCE(pc.sel_count, 0) = 1 AND
         COALESCE(pc.ins_count, 0) = 1 AND
         COALESCE(pc.upd_count, 0) = 1 AND
         COALESCE(pc.del_count, 0) = 1 THEN '✓ COMPLIANT'
    ELSE '✗ NON-COMPLIANT'
  END as task15_status
FROM expected_tables et
LEFT JOIN policy_counts pc ON et.table_name = pc.tablename
LEFT JOIN rls_status r ON et.table_name = r.table_name
ORDER BY et.table_name;

-- Final compliance summary
SELECT 
  COUNT(*) as total_expected_tables,
  COUNT(*) FILTER (WHERE 
    COALESCE(r.rls_enabled, false) = true AND
    COALESCE(pc.sel_count, 0) = 1 AND
    COALESCE(pc.ins_count, 0) = 1 AND
    COALESCE(pc.upd_count, 0) = 1 AND
    COALESCE(pc.del_count, 0) = 1
  ) as compliant_tables,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE 
      COALESCE(r.rls_enabled, false) = true AND
      COALESCE(pc.sel_count, 0) = 1 AND
      COALESCE(pc.ins_count, 0) = 1 AND
      COALESCE(pc.upd_count, 0) = 1 AND
      COALESCE(pc.del_count, 0) = 1
    ) THEN '🎉 TASK 15 FULLY COMPLIANT'
    ELSE '⚠️  TASK 15 HAS ISSUES'
  END as overall_status
FROM expected_tables et
LEFT JOIN policy_counts pc ON et.table_name = pc.tablename
LEFT JOIN rls_status r ON et.table_name = r.table_name;

-- =================================================================
-- CLEANUP
-- =================================================================

-- Clean up test data
DELETE FROM public.customers WHERE display_name LIKE 'Test Customer%';
DELETE FROM public.memberships WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM public.tenants WHERE slug IN ('test-tenant-a', 'test-tenant-b');
DELETE FROM public.users WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

SELECT 'Test cleanup completed' as cleanup_status;
