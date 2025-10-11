-- =================================================================
-- Task 15 Regex Debug Script
-- Tests the exact regex patterns to see why they're not matching
-- =================================================================

-- Test 1: Show what the actual policies contain
SELECT 'ACTUAL POLICY CONTENT:' as test_section;

SELECT 
  tablename,
  cmd,
  policyname,
  CASE WHEN qual IS NULL OR qual = '' THEN '(empty)' ELSE qual END as using_clause,
  CASE WHEN with_check IS NULL OR with_check = '' THEN '(empty)' ELSE with_check END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'customers' 
ORDER BY cmd;

-- Test 2: Test our regex patterns step by step
SELECT 'REGEX PATTERN TESTING:' as test_section;

-- Test the exact predicate we're seeing in the output
WITH test_cases AS (
  SELECT '(tenant_id = current_tenant_id())' as test_predicate
)
SELECT 
  test_predicate,
  'Testing exact predicate from output' as description,
  test_predicate ~* '\btenant_id\s*=\s*(public\.)?current_tenant_id\s*\(\s*\)' as matches_flexible_regex,
  test_predicate ~* '\btenant_id\s*=\s*public\.current_tenant_id\s*\(\s*\)' as matches_strict_regex,
  test_predicate ~* 'tenant_id\s*=\s*current_tenant_id\s*\(\s*\)' as matches_simple_regex
FROM test_cases;

-- Test 3: Test different regex variations
SELECT 'REGEX VARIATIONS TEST:' as test_section;

SELECT 
  '(tenant_id = current_tenant_id())' as test_predicate,
  'tenant_id\s*=\s*current_tenant_id\s*\(\s*\)' as regex_pattern,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id\s*=\s*current_tenant_id\s*\(\s*\)') as matches
UNION ALL
SELECT 
  '(tenant_id = current_tenant_id())' as test_predicate,
  'tenant_id\s*=\s*current_tenant_id' as regex_pattern,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id\s*=\s*current_tenant_id') as matches
UNION ALL
SELECT 
  '(tenant_id = current_tenant_id())' as test_predicate,
  'tenant_id.*current_tenant_id' as regex_pattern,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id.*current_tenant_id') as matches
UNION ALL
SELECT 
  '(tenant_id = current_tenant_id())' as test_predicate,
  'tenant_id.*=.*current_tenant_id' as regex_pattern,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id.*=.*current_tenant_id') as matches;

-- Test 4: Show what the actual policies look like in detail
SELECT 'DETAILED POLICY ANALYSIS:' as test_section;

SELECT 
  tablename,
  cmd,
  policyname,
  qual,
  with_check,
  -- Test our regex on the actual content
  CASE 
    WHEN cmd = 'INSERT' THEN 'N/A (INSERT)'
    WHEN qual IS NULL OR qual = '' THEN 'NULL/empty'
    WHEN qual ~* 'tenant_id\s*=\s*current_tenant_id\s*\(\s*\)' THEN '✅ MATCHES'
    ELSE '❌ NO MATCH: ' || qual
  END as using_regex_test,
  CASE 
    WHEN cmd NOT IN ('INSERT', 'UPDATE') THEN 'N/A'
    WHEN with_check IS NULL OR with_check = '' THEN 'NULL/empty'
    WHEN with_check ~* 'tenant_id\s*=\s*current_tenant_id\s*\(\s*\)' THEN '✅ MATCHES'
    ELSE '❌ NO MATCH: ' || with_check
  END as with_check_regex_test
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('customers', 'services')
ORDER BY tablename, cmd;

-- Test 5: Find the working regex pattern
SELECT 'WORKING REGEX DISCOVERY:' as test_section;

-- Test various regex patterns to find one that works
SELECT 
  '(tenant_id = current_tenant_id())' as test_string,
  'tenant_id = current_tenant_id()' as pattern1,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id = current_tenant_id()') as matches1,
  'tenant_id.*current_tenant_id' as pattern2,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id.*current_tenant_id') as matches2,
  'tenant_id.*=.*current_tenant_id' as pattern3,
  ('(tenant_id = current_tenant_id())' ~* 'tenant_id.*=.*current_tenant_id') as matches3;
