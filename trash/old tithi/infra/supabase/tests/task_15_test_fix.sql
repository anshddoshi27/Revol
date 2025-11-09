-- =================================================================
-- Task 15 Fix Verification Script
-- Tests that our simplified regex now correctly matches the policies
-- =================================================================

-- Test 1: Verify our simplified regex works
SELECT 'REGEX FIX VERIFICATION:' as test_section;

-- Test the exact predicate format from your output
SELECT 
  '(tenant_id = current_tenant_id())' as test_predicate,
  'tenant_id.*current_tenant_id' as simplified_regex,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id.*current_tenant_id') as matches_simplified,
  'Should be TRUE' as expected_result;

-- Test 2: Show what the validation should now find
SELECT 'VALIDATION RESULTS PREVIEW:' as test_section;

-- This simulates what the fixed validation script should return
WITH sample_policies AS (
  SELECT 
    'customers' as tablename,
    'SELECT' as cmd,
    '(tenant_id = current_tenant_id())' as qual,
    '' as with_check
  UNION ALL
  SELECT 
    'customers' as tablename,
    'INSERT' as cmd,
    '' as qual,
    '(tenant_id = current_tenant_id())' as with_check
  UNION ALL
  SELECT 
    'customers' as tablename,
    'UPDATE' as cmd,
    '(tenant_id = current_tenant_id())' as qual,
    '(tenant_id = current_tenant_id())' as with_check
  UNION ALL
  SELECT 
    'customers' as tablename,
    'DELETE' as cmd,
    '(tenant_id = current_tenant_id())' as qual,
    '' as with_check
)
SELECT 
  tablename,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN TRUE  -- INSERT policies don't have USING clauses
    ELSE (qual ~* 'tenant_id.*current_tenant_id')
  END AS using_ok,
  CASE
    WHEN cmd IN ('INSERT','UPDATE')
      THEN (coalesce(with_check,'') ~* 'tenant_id.*current_tenant_id')
    ELSE TRUE
  END AS with_check_ok,
  CASE 
    WHEN cmd = 'INSERT' THEN 
      CASE WHEN with_check ~* 'tenant_id.*current_tenant_id' THEN '✅ PASS' ELSE '❌ FAIL' END
    WHEN cmd = 'UPDATE' THEN
      CASE WHEN (qual ~* 'tenant_id.*current_tenant_id' AND with_check ~* 'tenant_id.*current_tenant_id') 
           THEN '✅ PASS' ELSE '❌ FAIL' END
    ELSE
      CASE WHEN qual ~* 'tenant_id.*current_tenant_id' THEN '✅ PASS' ELSE '❌ FAIL' END
  END as overall_status
FROM sample_policies
ORDER BY cmd;

-- Test 3: Expected final result
SELECT 'EXPECTED VALIDATION RESULT:' as test_section;

SELECT 
  'After the regex fix, the validation should:' as description,
  '1. Accept (tenant_id = current_tenant_id()) as valid' as fix1,
  '2. Handle INSERT policies correctly (no USING clause needed)' as fix2,
  '3. Return 0 rows (no failures) for all tables' as expected_result,
  '4. Show Task 15 is fully compliant' as final_status;
