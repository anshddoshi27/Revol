-- =================================================================
-- Task 15 Diagnostic Script
-- Shows exactly what the validation scripts found vs expected
-- =================================================================

-- Show sample policy predicates to understand the format
SELECT 'SAMPLE POLICY PREDICATES:' as section;

SELECT 
  tablename,
  policyname,
  cmd,
  CASE WHEN qual IS NULL OR qual = '' THEN '(empty)' ELSE qual END as using_clause,
  CASE WHEN with_check IS NULL OR with_check = '' THEN '(empty)' ELSE with_check END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'customers' 
ORDER BY cmd;

-- Test our updated regex patterns
SELECT 'REGEX PATTERN TESTING:' as section;

WITH test_patterns AS (
  SELECT 
    'tenant_id = current_tenant_id()' as test_predicate,
    'Old regex (strict)' as test_type,
    ('tenant_id = current_tenant_id()' ~* '\btenant_id\s*=\s*public\.current_tenant_id\s*\(\s*\)') as matches_old
  UNION ALL
  SELECT 
    'tenant_id = current_tenant_id()' as test_predicate,
    'New regex (flexible)' as test_type,  
    ('tenant_id = current_tenant_id()' ~* '\btenant_id\s*=\s*(public\.)?current_tenant_id\s*\(\s*\)') as matches_new
  UNION ALL
  SELECT 
    'tenant_id = public.current_tenant_id()' as test_predicate,
    'Old regex (strict)' as test_type,
    ('tenant_id = public.current_tenant_id()' ~* '\btenant_id\s*=\s*public\.current_tenant_id\s*\(\s*\)') as matches_old
  UNION ALL
  SELECT 
    'tenant_id = public.current_tenant_id()' as test_predicate,
    'New regex (flexible)' as test_type,
    ('tenant_id = public.current_tenant_id()' ~* '\btenant_id\s*=\s*(public\.)?current_tenant_id\s*\(\s*\)') as matches_new
)
SELECT 
  test_predicate,
  test_type,
  CASE WHEN matches_old OR matches_new THEN '✅ MATCHES' ELSE '❌ NO MATCH' END as result
FROM test_patterns;

-- Check what the actual policies contain
SELECT 'ACTUAL POLICY CONTENT ANALYSIS:' as section;

SELECT 
  tablename,
  cmd,
  COUNT(*) as policy_count,
  -- Show a sample predicate for each command type
  string_agg(DISTINCT 
    CASE 
      WHEN cmd = 'INSERT' THEN COALESCE(with_check, '(empty)')
      ELSE COALESCE(qual, '(empty)') 
    END, ' | ') as sample_predicates
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'services', 'bookings')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;

-- Test the corrected validation logic
SELECT 'CORRECTED VALIDATION TEST:' as section;

WITH policy_test AS (
  SELECT 
    p.tablename,
    p.cmd,
    p.policyname,
    -- Test the corrected logic
    CASE 
      WHEN p.cmd = 'INSERT' THEN TRUE  -- INSERT policies don't need USING clauses
      ELSE (p.qual ~* '\btenant_id\s*=\s*(public\.)?current_tenant_id\s*\(\s*\)')
    END AS using_ok,
    CASE
      WHEN p.cmd IN ('INSERT','UPDATE')
        THEN (coalesce(p.with_check,'') ~* '\btenant_id\s*=\s*(public\.)?current_tenant_id\s*\(\s*\)')
      ELSE TRUE
    END AS with_check_ok
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('customers', 'services') -- Test on a couple tables
)
SELECT 
  tablename,
  cmd,
  policyname,
  CASE WHEN using_ok THEN '✅' ELSE '❌' END as using_status,
  CASE WHEN with_check_ok THEN '✅' ELSE '❌' END as with_check_status,
  CASE WHEN using_ok AND with_check_ok THEN '✅ PASS' ELSE '❌ FAIL' END as overall_status
FROM policy_test
ORDER BY tablename, cmd;

-- Summary of what should happen after the fix
SELECT 'SUMMARY AFTER FIX:' as section;

SELECT 
  'The validation scripts have been updated to:' as description,
  '1. Accept both current_tenant_id() and public.current_tenant_id()' as fix1,
  '2. Correctly handle INSERT policies (no USING clause needed)' as fix2,
  '3. Should now pass validation for all correctly implemented policies' as expected_result;
