-- infra/supabase/tests/test1_tenant_isolation.sql
-- Extremely simple test file to debug pgTAP issues

BEGIN;

-- Enable pgTAP extension if not already enabled
-- Note: pgTAP should be available in the test environment
-- CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- =================================================================
-- TESTS: Minimal Tests
-- =================================================================

-- Test 1: Always true
SELECT ok(true, 'Test 1: This should always pass');

-- Test 2: Simple math
SELECT ok(2 + 2 = 4, 'Test 2: Basic math should work');

-- Test 3: Database query
SELECT ok(
    (SELECT count(*) FROM public.tenants) >= 0,
    'Test 3: Should be able to query tenants table'
);

-- =================================================================
-- CLEANUP
-- =================================================================

SELECT finish();

ROLLBACK;
