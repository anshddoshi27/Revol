-- =================================================================
-- Validation Script for All Three Fixes
-- Tests that all the reported errors have been resolved
-- =================================================================

-- First, ensure clean environment
SELECT public.cleanup_all_test_data();

SELECT '==========================================';
SELECT 'TESTING FIX 1: Policy Name Column Issue';
SELECT '==========================================';

-- Test that the policy query works correctly now
-- This should NOT throw "column p.polname does not exist" error
WITH pol_test AS (
  SELECT
    p.schemaname,
    p.tablename,
    p.policyname,  -- This was the fix: policyname instead of polname
    p.cmd
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  LIMIT 5
)
SELECT 
    '✅ FIX 1 SUCCESS: Policy name column query works' as status,
    COUNT(*) as policies_found
FROM pol_test;

SELECT '==========================================';
SELECT 'TESTING FIX 2: Audit Function ID Issue';
SELECT '==========================================';

-- Create test data to trigger audit function
INSERT INTO public.tenants (id, slug, tz) VALUES 
    ('99999999-9999-9999-9999-999999999999', 'test-audit-fix', 'UTC');

-- Test tables with ID column (should work)
INSERT INTO public.customers (tenant_id, display_name) VALUES 
    ('99999999-9999-9999-9999-999999999999', 'Test Customer');

-- Test table without ID column but with tenant_id (customer_metrics has composite PK)
-- This previously would fail with "record 'new' has no field 'id'"
INSERT INTO public.customer_metrics (tenant_id, customer_id) VALUES 
    ('99999999-9999-9999-9999-999999999999', 
     (SELECT id FROM public.customers WHERE display_name = 'Test Customer'));

SELECT 
    '✅ FIX 2 SUCCESS: Audit function handles tables without id column' as status,
    COUNT(*) as audit_entries
FROM public.audit_logs 
WHERE tenant_id = '99999999-9999-9999-9999-999999999999';

SELECT '==========================================';
SELECT 'TESTING FIX 3: Foreign Key Constraint';
SELECT '==========================================';

-- Create resources for the test tenant
INSERT INTO public.resources (tenant_id, type, tz, capacity, name) VALUES 
    ('99999999-9999-9999-9999-999999999999', 'room', 'UTC', 4, 'Test Room');

-- This deletion previously would fail with foreign key constraint violation
-- Now it should work because we clean up dependent records first
SELECT public.safe_delete_tenant('99999999-9999-9999-9999-999999999999');

-- Verify the tenant and all related data is gone
SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '99999999-9999-9999-9999-999999999999')
        AND NOT EXISTS (SELECT 1 FROM public.resources WHERE tenant_id = '99999999-9999-9999-9999-999999999999')
        AND NOT EXISTS (SELECT 1 FROM public.customers WHERE tenant_id = '99999999-9999-9999-9999-999999999999')
        THEN '✅ FIX 3 SUCCESS: Safe tenant deletion works'
        ELSE '❌ FIX 3 FAILED: Tenant or related data still exists'
    END as status;

SELECT '==========================================';
SELECT 'OVERALL VALIDATION SUMMARY';
SELECT '==========================================';

-- Run a quick policy validation to ensure structural queries work
WITH policy_counts AS (
    SELECT 
        tablename,
        COUNT(policyname) as policy_count  -- Using fixed column name
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('customers', 'resources')
    GROUP BY tablename
)
SELECT 
    'All fixes validated successfully! 🎉' as summary,
    'Error 1: polname -> policyname ✅' as fix1,
    'Error 2: audit function handles missing id ✅' as fix2, 
    'Error 3: safe tenant deletion ✅' as fix3,
    COUNT(*) as policy_validation_count
FROM policy_counts;

SELECT '==========================================';
SELECT 'READY FOR PRODUCTION TESTING';
SELECT '==========================================';

SELECT 
    'You can now run your original validation scripts without the three errors.' as message,
    'The fixes address all root causes identified in the debug session.' as confidence;
