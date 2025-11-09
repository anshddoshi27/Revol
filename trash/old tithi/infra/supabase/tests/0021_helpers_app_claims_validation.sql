-- =================================================================
-- Validation Test Suite for Migration 0021: Helper Functions App Claims
-- =================================================================
-- 
-- Tests the updated helper functions to ensure they:
-- 1. Prioritize app-set claims via current_setting('request.jwt.claims', true)
-- 2. Fall back to Supabase Auth JWT claims when app-set claims are not provided
-- 3. Maintain fail-closed behavior for RLS policies
-- 4. Handle cross-tenant access attempts correctly
-- =================================================================

-- Create test schema for isolation
CREATE SCHEMA IF NOT EXISTS test_0021_helpers;

-- Test data setup
INSERT INTO public.tenants (id, slug, tz, is_public_directory) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test-tenant-1', 'UTC', false),
  ('22222222-2222-2222-2222-222222222222', 'test-tenant-2', 'UTC', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test User 1', 'user1@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test User 2', 'user2@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'staff'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'staff')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Test table for validation
CREATE TABLE test_0021_helpers.test_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  data text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS and add policy
ALTER TABLE test_0021_helpers.test_data ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to ensure it's properly applied
DROP POLICY IF EXISTS test_data_tenant_isolation ON test_0021_helpers.test_data;

CREATE POLICY test_data_tenant_isolation ON test_0021_helpers.test_data
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Create a more restrictive policy for testing
CREATE POLICY test_data_strict_tenant_isolation ON test_0021_helpers.test_data
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id() 
    AND public.current_tenant_id() IS NOT NULL
  );

-- Create an even simpler policy for debugging
CREATE POLICY test_data_debug_policy ON test_0021_helpers.test_data
  FOR INSERT WITH CHECK (
    CASE 
      WHEN public.current_tenant_id() IS NULL THEN false
      WHEN tenant_id IS NULL THEN false
      ELSE tenant_id = public.current_tenant_id()
    END
  );

-- Create the simplest possible policy for testing
CREATE POLICY test_data_simple_policy ON test_0021_helpers.test_data
  FOR INSERT WITH CHECK (false);

-- Test results table
CREATE TABLE test_0021_helpers.test_results (
  test_id serial PRIMARY KEY,
  test_name text NOT NULL,
  test_category text NOT NULL,
  passed boolean NOT NULL,
  expected_result text,
  actual_result text,
  notes text
);

-- Test runner function
CREATE OR REPLACE FUNCTION test_0021_helpers.run_test(
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
  
  INSERT INTO test_0021_helpers.test_results (test_name, test_category, passed, expected_result, actual_result, notes)
  VALUES (test_name, test_category, actual_accessible = expected_accessible, expected_result, actual_result, notes);
END;
$$;

-- =================================================================
-- TEST SUITE: App Claims Priority Validation
-- =================================================================

-- Test 1: App-set claims take priority over Supabase Auth JWT
SELECT test_0021_helpers.run_test(
  'App Claims Priority - Tenant ID',
  'Priority Logic',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; SELECT public.current_tenant_id();',
  true,
  'Should return tenant_id from app-set claims'
);

-- Test 2: App-set claims take priority over Supabase Auth JWT for user ID
SELECT test_0021_helpers.run_test(
  'App Claims Priority - User ID',
  'Priority Logic', 
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; SELECT public.current_user_id();',
  true,
  'Should return user_id from app-set claims'
);

-- Test 3: Fallback to Supabase Auth when app-set claims not provided
SELECT test_0021_helpers.run_test(
  'Fallback to Supabase Auth - No App Claims',
  'Fallback Logic',
  'RESET ALL; SELECT public.current_tenant_id();',
  true,
  'Should fall back to Supabase Auth JWT when no app claims provided'
);

-- Test 4: RLS policy works with app-set claims
SELECT test_0021_helpers.run_test(
  'RLS Policy with App Claims - Same Tenant',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}''; INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''test data'');',
  true,
  'Should allow insert when tenant_id matches app-set claims'
);

-- Test 5a: Verify RLS policy is working with app-set claims
SELECT test_0021_helpers.run_test(
  'RLS Policy Verification - App Claims',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; SELECT public.current_tenant_id() as helper_result, ''11111111-1111-1111-1111-111111111111'' as expected_tenant;',
  true,
  'Should return app-set tenant_id from helper function'
);

-- Test 5a1: Verify RLS is enabled and policy exists
SELECT test_0021_helpers.run_test(
  'RLS Status Verification',
  'RLS Integration',
  'SELECT 
     c.relname as table_name,
     c.relrowsecurity as rls_enabled,
     p.polname as policy_name,
     p.polcmd as policy_cmd
   FROM pg_class c
   LEFT JOIN pg_policy p ON p.polrelid = c.oid
   WHERE c.relname = ''test_data'' AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ''test_0021_helpers'');',
  true,
  'Should show RLS enabled and policy details'
);

-- Test 5b: RLS policy denies cross-tenant access with app-set claims
SELECT test_0021_helpers.run_test(
  'RLS Policy with App Claims - Cross Tenant Denied',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''22222222-2222-2222-2222-222222222222'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''cross tenant data'');',
  false,
  'Should deny insert when tenant_id does not match app-set claims (RLS policy enforcement)'
);

-- Test 5d: Verify RLS policy is actually enforced (debug)
SELECT test_0021_helpers.run_test(
  'RLS Policy Enforcement Debug',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   SELECT 
     public.current_tenant_id() as current_tenant,
     ''22222222-2222-2222-2222-222222222222'' as insert_tenant,
     (public.current_tenant_id() = ''22222222-2222-2222-2222-222222222222''::uuid) as policy_result,
     (SELECT COUNT(*) FROM test_0021_helpers.test_data) as before_count;
   
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''22222222-2222-2222-2222-222222222222'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''cross tenant data'');
   
   SELECT 
     (SELECT COUNT(*) FROM test_0021_helpers.test_data) as after_count,
     (SELECT COUNT(*) FROM test_0021_helpers.test_data WHERE tenant_id = ''22222222-2222-2222-2222-222222222222'') as cross_tenant_count;',
  false,
  'Should show policy enforcement details and deny cross-tenant insert'
);

-- Test 5e: Check session context and permissions
SELECT test_0021_helpers.run_test(
  'Session Context Check',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}''; 
   SELECT 
     current_user as current_user,
     session_user as session_user,
     current_setting(''role'') as current_role,
     public.current_tenant_id() as current_tenant,
     has_table_privilege(''test_0021_helpers.test_data'', ''INSERT'') as has_insert_privilege;',
  true,
  'Should show current session context and permissions'
);

-- Test 5f: Simple RLS policy test (no app claims)
SELECT test_0021_helpers.run_test(
  'Simple RLS Test - No Claims',
  'RLS Integration',
  'RESET ALL; 
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''test without claims'');',
  false,
  'Should deny insert when no claims available (RLS fail-closed)'
);

-- Test 5g: Direct policy evaluation test
SELECT test_0021_helpers.run_test(
  'Direct Policy Evaluation',
  'RLS Integration',
  'RESET ALL; 
   SELECT 
     public.current_tenant_id() as helper_result,
     (public.current_tenant_id() IS NULL) as is_null,
     (public.current_tenant_id() = ''11111111-1111-1111-1111-111111111111''::uuid) as policy_eval;',
  true,
  'Should show helper function result and policy evaluation'
);

-- Test 5h: Table structure and RLS verification
SELECT test_0021_helpers.run_test(
  'Table Structure Verification',
  'RLS Integration',
  'SELECT 
     schemaname,
     tablename,
     rowsecurity as rls_enabled,
     hasindexes,
     hasrules,
     hastriggers
   FROM pg_tables 
   WHERE tablename = ''test_data'' AND schemaname = ''test_0021_helpers'';',
  true,
  'Should show test table structure and RLS status'
);

-- Test 5i: Test cross-tenant access with different app claims
SELECT test_0021_helpers.run_test(
  'Cross-Tenant Access - Different App Claims',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "33333333-3333-3333-3333-333333333333", "sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}''; 
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''22222222-2222-2222-2222-222222222222'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''cross tenant with different app claims'');',
  false,
  'Should deny insert when app-set tenant_id does not match insert tenant_id'
);

-- Test 5j: Debug cross-tenant policy evaluation
SELECT test_0021_helpers.run_test(
  'Cross-Tenant Policy Debug',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   SELECT 
     public.current_tenant_id() as current_tenant,
     ''22222222-2222-2222-2222-222222222222'' as insert_tenant,
     (public.current_tenant_id() = ''22222222-2222-2222-2222-222222222222''::uuid) as policy_result,
     (public.current_tenant_id() IS NULL) as is_null,
     (public.current_tenant_id() IS NOT NULL) as is_not_null;',
  true,
  'Should show detailed policy evaluation for cross-tenant access'
);

-- Test 5k: Test strict RLS policy enforcement
SELECT test_0021_helpers.run_test(
  'Strict RLS Policy Test',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''22222222-2222-2222-2222-222222222222'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''strict policy cross tenant test'');',
  false,
  'Should deny insert with strict policy when tenant_id does not match'
);

-- Test 5l: Verify policy enforcement is working
SELECT test_0021_helpers.run_test(
  'Policy Enforcement Verification',
  'RLS Integration',
  'SELECT 
     p.polname as policy_name,
     p.polcmd as policy_command,
     p.polpermissive as is_permissive,
     p.polroles as policy_roles
   FROM pg_policy p
   JOIN pg_class c ON p.polrelid = c.oid
   WHERE c.relname = ''test_data'' AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ''test_0021_helpers'');',
  true,
  'Should show all policies on test table'
);

-- Test 5m: Test policy condition evaluation directly
SELECT test_0021_helpers.run_test(
  'Direct Policy Condition Test',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   SELECT 
     public.current_tenant_id() as current_tenant,
     ''22222222-2222-2222-2222-222222222222'' as insert_tenant,
     (public.current_tenant_id() = ''22222222-2222-2222-2222-222222222222''::uuid) as direct_comparison,
     (public.current_tenant_id() IS NOT DISTINCT FROM ''22222222-2222-2222-2222-222222222222''::uuid) as distinct_comparison,
     (public.current_tenant_id()::text = ''22222222-2222-2222-2222-222222222222'') as text_comparison;',
  true,
  'Should show different comparison methods for policy evaluation'
);

-- Test 5n: Test debug policy enforcement
SELECT test_0021_helpers.run_test(
  'Debug Policy Test',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''22222222-2222-2222-2222-222222222222'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''debug policy cross tenant test'');',
  false,
  'Should deny insert with debug policy when tenant_id does not match'
);

-- Test 5o: Test RLS bypass (should fail)
SELECT test_0021_helpers.run_test(
  'RLS Bypass Test',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   -- Try to bypass RLS by using a different approach
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) 
   SELECT ''22222222-2222-2222-2222-222222222222'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''bypass test''
   WHERE false;',
  false,
  'Should deny insert even with WHERE false clause'
);

-- Test 5p: Check RLS environment and session
SELECT test_0021_helpers.run_test(
  'RLS Environment Check',
  'RLS Integration',
  'SELECT 
     current_setting(''row_security'') as row_security_setting,
     current_user as current_user,
     session_user as session_user,
     current_setting(''role'') as current_role,
     has_table_privilege(''test_0021_helpers.test_data'', ''INSERT'') as current_role,
     has_table_privilege(''test_0021_helpers.test_data'', ''INSERT WITH ROW LEVEL SECURITY'') as has_rls_insert_privilege;',
  true,
  'Should show RLS environment and session details'
);

-- Test 5q: Test simplest possible policy (should always deny)
SELECT test_0021_helpers.run_test(
  'Simplest Policy Test',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; 
   INSERT INTO test_0021_helpers.test_data (tenant_id, user_id, data) VALUES (''11111111-1111-1111-1111-111111111111'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''simple policy test'');',
  false,
  'Should always deny insert with policy that always returns false'
);

-- Test 5r: Check if you have superuser privileges
SELECT test_0021_helpers.run_test(
  'Superuser Check',
  'RLS Integration',
  'SELECT 
     current_user as current_user,
     session_user as session_user,
     current_setting(''role'') as current_role,
     (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) as is_superuser,
     (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) as bypasses_rls,
     current_setting(''row_security'') as row_security_setting;',
  true,
  'Should show if current user has privileges that bypass RLS'
);

-- Test 5c: Verify RLS policy logic directly
SELECT test_0021_helpers.run_test(
  'RLS Policy Logic Verification',
  'RLS Integration',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; SELECT 
    public.current_tenant_id() as current_tenant,
    ''22222222-2222-2222-2222-222222222222'' as insert_tenant,
    (public.current_tenant_id() = ''22222222-2222-2222-2222-222222222222''::uuid) as policy_result;',
  true,
  'Should show policy comparison: current_tenant != insert_tenant (false)'
);

-- Test 6: Empty app-set claims fall back to Supabase Auth
SELECT test_0021_helpers.run_test(
  'Empty App Claims Fallback',
  'Fallback Logic',
  'SET LOCAL "request.jwt.claims" = ''''; SELECT public.current_tenant_id();',
  true,
  'Should fall back to Supabase Auth JWT when app-set claims are empty'
);

-- Test 7: Malformed app-set claims fall back to Supabase Auth
SELECT test_0021_helpers.run_test(
  'Malformed App Claims Fallback',
  'Fallback Logic',
  'SET LOCAL "request.jwt.claims" = ''invalid json''; SELECT public.current_tenant_id();',
  false,
  'Should return NULL when app-set claims are malformed (fail closed)'
);

-- Test 8: Missing tenant_id in app-set claims falls back to Supabase Auth
SELECT test_0021_helpers.run_test(
  'Missing Tenant ID in App Claims Fallback',
  'Fallback Logic',
  'SET LOCAL "request.jwt.claims" = ''{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; SELECT public.current_tenant_id();',
  true,
  'Should fall back to Supabase Auth JWT when tenant_id missing from app-set claims'
);

-- Test 9: Invalid UUID format in app-set claims falls back to Supabase Auth
SELECT test_0021_helpers.run_test(
  'Invalid UUID Format in App Claims Fallback',
  'Fallback Logic',
  'SET LOCAL "request.jwt.claims" = ''{"tenant_id": "invalid-uuid", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}''; SELECT public.current_tenant_id();',
  true,
  'Should fall back to Supabase Auth JWT when tenant_id is not a valid UUID'
);

-- Test 10: Verify helper function signatures remain unchanged
SELECT test_0021_helpers.run_test(
  'Helper Function Signatures',
  'Function Properties',
  'SELECT 
    p.proname,
    pg_catalog.format_type(p.prorettype, NULL) as return_type,
    p.provolatile,
    p.prosecdef
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = ''public'' 
     AND p.proname IN (''current_tenant_id'', ''current_user_id'')
   ORDER BY p.proname;',
  true,
  'Should show STABLE functions returning uuid with SECURITY INVOKER'
);

-- =================================================================
-- TEST RESULTS SUMMARY
-- =================================================================

SELECT 
  test_category,
  COUNT(*) as total_tests,
  COUNT(*) FILTER (WHERE passed) as passed_tests,
  COUNT(*) FILTER (WHERE NOT passed) as failed_tests,
  ROUND(
    (COUNT(*) FILTER (WHERE passed)::decimal / COUNT(*)::decimal) * 100, 2
  ) as success_rate
FROM test_0021_helpers.test_results
GROUP BY test_category
ORDER BY test_category;

SELECT 
  'OVERALL RESULTS' as summary,
  COUNT(*) as total_tests,
  COUNT(*) FILTER (WHERE passed) as passed_tests,
  COUNT(*) FILTER (WHERE NOT passed) as failed_tests,
  ROUND(
    (COUNT(*) FILTER (WHERE passed)::decimal / COUNT(*)::decimal) * 100, 2
  ) as success_rate
FROM test_0021_helpers.test_results;

-- Detailed test results
SELECT 
  test_name,
  test_category,
  CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END as status,
  expected_result,
  actual_result,
  notes
FROM test_0021_helpers.test_results
ORDER BY test_category, test_id;

-- =================================================================
-- CLEANUP
-- =================================================================

-- Clean up test data
DROP TABLE test_0021_helpers.test_data;
DROP TABLE test_0021_helpers.test_results;
DROP FUNCTION test_0021_helpers.run_test(text, text, text, boolean, text);
DROP SCHEMA test_0021_helpers;

-- Clean up seed data
DELETE FROM public.memberships WHERE tenant_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM public.users WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM public.tenants WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Reset any session variables
RESET ALL;
