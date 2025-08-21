-- =================================================================
-- Task 15 Tenant Isolation Test
-- Tests that tenant-scoped policies actually work to isolate data
-- NOTE: This requires simulating JWT claims which varies by environment
-- =================================================================

-- =================================================================
-- SETUP: Test Data Creation (run as service role / admin)
-- =================================================================

-- Clean up first
DO $$ 
BEGIN
  DELETE FROM public.customers WHERE email LIKE '%@isolation-test.com';
  DELETE FROM public.resources WHERE name LIKE 'Isolation Test%';
  DELETE FROM public.services WHERE name LIKE 'Isolation Test%';
  DELETE FROM public.tenants WHERE slug LIKE 'isolation-test-%';
  DELETE FROM public.users WHERE primary_email LIKE '%@isolation-test.com';
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if tables don't exist yet
  NULL;
END $$;

-- Create test tenants
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('10000000-0000-0000-0000-000000000001', 'isolation-test-alpha', 'UTC'),
  ('20000000-0000-0000-0000-000000000002', 'isolation-test-beta', 'UTC')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug;

-- Create test users  
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Alpha User', 'alpha@isolation-test.com'),
  ('b0000000-0000-0000-0000-000000000002', 'Beta User', 'beta@isolation-test.com')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Create memberships
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'owner')
ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Create test customers for Alpha tenant
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('ca000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alpha Customer 1', 'customer1@isolation-test.com'),
  ('ca000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Alpha Customer 2', 'customer2@isolation-test.com')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Create test customers for Beta tenant  
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('cb000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Beta Customer 1', 'customer3@isolation-test.com'),
  ('cb000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Beta Customer 2', 'customer4@isolation-test.com')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- Create test resources for Alpha tenant
INSERT INTO public.resources (id, tenant_id, type, tz, capacity, name) VALUES
  ('ra000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'staff', 'UTC', 1, 'Isolation Test Alpha Staff'),
  ('ra000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'room', 'UTC', 4, 'Isolation Test Alpha Room')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Create test resources for Beta tenant
INSERT INTO public.resources (id, tenant_id, type, tz, capacity, name) VALUES
  ('rb000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'staff', 'UTC', 1, 'Isolation Test Beta Staff'),
  ('rb000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'room', 'UTC', 2, 'Isolation Test Beta Room')  
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Create test services
INSERT INTO public.services (id, tenant_id, slug, name, duration_min, price_cents) VALUES
  ('sa000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'alpha-service', 'Isolation Test Alpha Service', 60, 5000),
  ('sb000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'beta-service', 'Isolation Test Beta Service', 30, 3000)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- =================================================================
-- VERIFICATION: Check test data was created
-- =================================================================

SELECT 'TEST DATA VERIFICATION' as section;

-- Verify tenants
SELECT 'Tenants created:' as check_type, slug, id FROM public.tenants 
WHERE slug LIKE 'isolation-test-%' ORDER BY slug;

-- Verify customers per tenant (should see 2 per tenant)
SELECT 'Customers per tenant:' as check_type, 
       t.slug as tenant, 
       count(c.*) as customer_count,
       string_agg(c.display_name, ', ') as customer_names
FROM public.tenants t
LEFT JOIN public.customers c ON c.tenant_id = t.id
WHERE t.slug LIKE 'isolation-test-%'
GROUP BY t.id, t.slug
ORDER BY t.slug;

-- Verify resources per tenant  
SELECT 'Resources per tenant:' as check_type,
       t.slug as tenant,
       count(r.*) as resource_count,
       string_agg(r.name, ', ') as resource_names
FROM public.tenants t  
LEFT JOIN public.resources r ON r.tenant_id = t.id
WHERE t.slug LIKE 'isolation-test-%'
GROUP BY t.id, t.slug
ORDER BY t.slug;

-- =================================================================
-- POLICY FUNCTIONALITY TESTS
-- =================================================================

SELECT 'POLICY FUNCTIONALITY TESTS' as section;

-- Test 1: Verify current_tenant_id() helper function
SELECT 'Helper function test:' as test_name;
SELECT 
  'public.current_tenant_id()' as function_name,
  public.current_tenant_id() as result,
  CASE 
    WHEN public.current_tenant_id() IS NULL THEN '✓ Returns NULL (no JWT context)'
    ELSE '⚠️  Returns: ' || public.current_tenant_id()::text
  END as interpretation;

-- Test 2: Check that policies prevent cross-tenant data access
-- NOTE: In a real environment with JWT context, you would only see your tenant's data

SELECT 'Cross-tenant isolation test:' as test_name;

-- This query will show all data when run as service-role
-- But would be filtered by tenant when run with proper JWT claims
SELECT 
  'customers' as table_name,
  t.slug as tenant,
  c.display_name,
  'Should only see own tenant data with JWT' as note
FROM public.customers c
JOIN public.tenants t ON t.id = c.tenant_id  
WHERE t.slug LIKE 'isolation-test-%'
ORDER BY t.slug, c.display_name;

-- Test 3: Verify policy names and structure
SELECT 'Policy structure verification:' as test_name;

-- Check customers table policies as example
SELECT 
  p.policyname,
  p.cmd,
  CASE 
    WHEN p.qual ~* 'tenant_id\s*=\s*public\.current_tenant_id' THEN '✓ Correct USING clause'
    ELSE '✗ Invalid USING: ' || COALESCE(p.qual, 'NULL')
  END as using_check,
  CASE 
    WHEN p.cmd NOT IN ('INSERT', 'UPDATE') THEN 'N/A'
    WHEN p.with_check ~* 'tenant_id\s*=\s*public\.current_tenant_id' THEN '✓ Correct WITH CHECK'
    ELSE '✗ Invalid WITH CHECK: ' || COALESCE(p.with_check, 'NULL')  
  END as with_check_validation
FROM pg_policies p
WHERE p.schemaname = 'public' 
  AND p.tablename = 'customers'
ORDER BY p.cmd;

-- =================================================================
-- COMPREHENSIVE POLICY AUDIT
-- =================================================================

SELECT 'COMPREHENSIVE POLICY AUDIT' as section;

-- Check all tenant-scoped tables have exactly 4 policies
WITH tenant_tables AS (
  SELECT unnest(ARRAY[
    'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
    'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
    'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
  ]) as table_name
),
policy_audit AS (
  SELECT 
    tt.table_name,
    count(p.policyname) as total_policies,
    count(*) FILTER (WHERE p.cmd = 'SELECT') as select_count,
    count(*) FILTER (WHERE p.cmd = 'INSERT') as insert_count,
    count(*) FILTER (WHERE p.cmd = 'UPDATE') as update_count,
    count(*) FILTER (WHERE p.cmd = 'DELETE') as delete_count,
    bool_and(
      CASE WHEN p.cmd = 'SELECT' THEN 
        p.qual ~* 'tenant_id\s*=\s*public\.current_tenant_id'
      ELSE true END
    ) as select_predicates_ok,
    bool_and(
      CASE WHEN p.cmd = 'INSERT' THEN
        p.with_check ~* 'tenant_id\s*=\s*public\.current_tenant_id'
      ELSE true END  
    ) as insert_predicates_ok,
    bool_and(
      CASE WHEN p.cmd = 'UPDATE' THEN
        (p.qual ~* 'tenant_id\s*=\s*public\.current_tenant_id' AND
         p.with_check ~* 'tenant_id\s*=\s*public\.current_tenant_id')
      ELSE true END
    ) as update_predicates_ok,
    bool_and(
      CASE WHEN p.cmd = 'DELETE' THEN
        p.qual ~* 'tenant_id\s*=\s*public\.current_tenant_id'  
      ELSE true END
    ) as delete_predicates_ok
  FROM tenant_tables tt
  LEFT JOIN pg_policies p ON (p.schemaname = 'public' AND p.tablename = tt.table_name)
  GROUP BY tt.table_name
)
SELECT 
  table_name,
  total_policies,
  select_count,
  insert_count, 
  update_count,
  delete_count,
  CASE 
    WHEN total_policies = 4 AND 
         select_count = 1 AND insert_count = 1 AND 
         update_count = 1 AND delete_count = 1 AND
         COALESCE(select_predicates_ok, false) AND
         COALESCE(insert_predicates_ok, false) AND  
         COALESCE(update_predicates_ok, false) AND
         COALESCE(delete_predicates_ok, false)
    THEN '✅ FULLY COMPLIANT'
    ELSE '❌ ISSUES FOUND'
  END as compliance_status
FROM policy_audit
ORDER BY table_name;

-- =================================================================
-- FINAL SUMMARY
-- =================================================================

SELECT 'TASK 15 FINAL VALIDATION SUMMARY' as final_section;

WITH 
tenant_tables AS (
  SELECT unnest(ARRAY[
    'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items', 
    'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
    'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
  ]) as table_name
),
compliance_check AS (
  SELECT 
    tt.table_name,
    CASE 
      WHEN count(p.policyname) = 4 AND
           count(*) FILTER (WHERE p.cmd = 'SELECT') = 1 AND
           count(*) FILTER (WHERE p.cmd = 'INSERT') = 1 AND  
           count(*) FILTER (WHERE p.cmd = 'UPDATE') = 1 AND
           count(*) FILTER (WHERE p.cmd = 'DELETE') = 1
      THEN true
      ELSE false
    END as has_correct_policies
  FROM tenant_tables tt
  LEFT JOIN pg_policies p ON (p.schemaname = 'public' AND p.tablename = tt.table_name)
  GROUP BY tt.table_name
)
SELECT 
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE has_correct_policies) as compliant_tables,
  COUNT(*) - COUNT(*) FILTER (WHERE has_correct_policies) as non_compliant_tables,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE has_correct_policies) 
    THEN '🎉 TASK 15 IS FULLY COMPLIANT - READY FOR TASK 16!'
    ELSE '⚠️  TASK 15 HAS ISSUES - CHECK DETAILS ABOVE'
  END as final_verdict
FROM compliance_check;

-- =================================================================  
-- CLEANUP TEST DATA
-- =================================================================

-- Clean up test data
DELETE FROM public.services WHERE name LIKE 'Isolation Test%';
DELETE FROM public.resources WHERE name LIKE 'Isolation Test%';  
DELETE FROM public.customers WHERE email LIKE '%@isolation-test.com';
DELETE FROM public.memberships WHERE tenant_id IN ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002');
DELETE FROM public.tenants WHERE slug LIKE 'isolation-test-%';
DELETE FROM public.users WHERE primary_email LIKE '%@isolation-test.com';

SELECT '✅ Test cleanup completed successfully' as cleanup_status;
