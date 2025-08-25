-- =================================================================
-- Simple Validation for Migration 0021: Helper Functions App Claims
-- =================================================================
-- 
-- This script provides a simple way to test the updated helper functions
-- without the complex test framework. Run this after applying the migration.
-- =================================================================

-- Test 1: Check that helper functions exist and have correct signatures
SELECT 
  'Helper Functions Check' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' 
        AND p.proname = 'current_tenant_id'
        AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
    ) THEN '✅ current_tenant_id() exists'
    ELSE '❌ current_tenant_id() missing or wrong return type'
  END as status;

SELECT 
  'Helper Functions Check' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' 
        AND p.proname = 'current_user_id'
        AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
    ) THEN '✅ current_user_id() exists'
    ELSE '❌ current_user_id() missing or wrong return type'
  END as status;

-- Test 2: Test app-set claims priority
SELECT 'App Claims Priority Test' as test_name;

-- Set app claims
SET LOCAL "request.jwt.claims" = '{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Check that helpers return the app-set values
SELECT 
  'App Claims Priority' as test_name,
  CASE 
    WHEN public.current_tenant_id()::text = '11111111-1111-1111-1111-111111111111' 
    THEN '✅ current_tenant_id() returns app-set value'
    ELSE '❌ current_tenant_id() does not return app-set value'
  END as status;

SELECT 
  'App Claims Priority' as test_name,
  CASE 
    WHEN public.current_user_id()::text = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
    THEN '✅ current_user_id() returns app-set value'
    ELSE '❌ current_user_id() does not return app-set value'
  END as status;

-- Test 3: Test fallback behavior (no app claims)
SELECT 'Fallback Behavior Test' as test_name;

-- Reset to use Supabase Auth
RESET ALL;

-- Check that helpers return NULL when no claims available (fail closed)
SELECT 
  'Fallback Behavior' as test_name,
  CASE 
    WHEN public.current_tenant_id() IS NULL 
    THEN '✅ current_tenant_id() returns NULL (fail closed)'
    ELSE '❌ current_tenant_id() should return NULL when no claims'
  END as status;

SELECT 
  'Fallback Behavior' as test_name,
  CASE 
    WHEN public.current_user_id() IS NULL 
    THEN '✅ current_user_id() returns NULL (fail closed)'
    ELSE '❌ current_user_id() should return NULL when no claims'
  END as status;

-- Test 4: Test invalid app claims handling
SELECT 'Invalid Claims Handling Test' as test_name;

-- Set invalid JSON
SET LOCAL "request.jwt.claims" = 'invalid json';

-- Check that helpers return NULL on invalid JSON (fail closed)
SELECT 
  'Invalid JSON Handling' as test_name,
  CASE 
    WHEN public.current_tenant_id() IS NULL 
    THEN '✅ current_tenant_id() returns NULL on invalid JSON (fail closed)'
    ELSE '❌ current_tenant_id() should return NULL on invalid JSON'
  END as status;

-- Set empty claims
SET LOCAL "request.jwt.claims" = '';

-- Check that helpers return NULL on empty claims (fail closed)
SELECT 
  'Empty Claims Handling' as test_name,
  CASE 
    WHEN public.current_tenant_id() IS NULL 
    THEN '✅ current_tenant_id() returns NULL on empty claims (fail closed)'
    ELSE '❌ current_tenant_id() should return NULL on empty claims'
  END as status;

-- Set claims missing tenant_id
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Check that helpers return NULL when required claim missing (fail closed)
SELECT 
  'Missing Tenant ID Handling' as test_name,
  CASE 
    WHEN public.current_tenant_id() IS NULL 
    THEN '✅ current_tenant_id() returns NULL when tenant_id missing (fail closed)'
    ELSE '❌ current_tenant_id() should return NULL when tenant_id missing'
  END as status;

-- Test 5: Test UUID validation
SELECT 'UUID Validation Test' as test_name;

-- Set claims with invalid UUID format
SET LOCAL "request.jwt.claims" = '{"tenant_id": "invalid-uuid", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Check that helpers return NULL on invalid UUID (fail closed)
SELECT 
  'Invalid UUID Handling' as test_name,
  CASE 
    WHEN public.current_tenant_id() IS NULL 
    THEN '✅ current_tenant_id() returns NULL on invalid UUID (fail closed)'
    ELSE '❌ current_tenant_id() should return NULL on invalid UUID'
  END as status;

-- Summary
SELECT 'Validation Complete' as summary;
SELECT 'Check the results above to verify the migration works correctly.' as next_steps;
