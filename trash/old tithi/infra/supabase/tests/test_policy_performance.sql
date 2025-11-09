-- =================================================================
-- Test Policy Performance & Scalability
-- Analyzes whether your policies will perform well at scale
-- =================================================================

SELECT '==========================================';
SELECT 'TESTING POLICY PERFORMANCE & SCALABILITY';
SELECT '==========================================';

-- Test 1: Analyze policy predicate complexity
SELECT 'Test 1: Policy Predicate Complexity Analysis' as test;

-- Check for potentially expensive policy predicates
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%EXISTS%' AND qual LIKE '%JOIN%' THEN '⚠️  Complex EXISTS with JOIN'
    WHEN qual LIKE '%EXISTS%' THEN '⚠️  EXISTS clause (moderate complexity)'
    WHEN qual LIKE '%JOIN%' THEN '⚠️  JOIN clause (moderate complexity)'
    WHEN qual LIKE '%tenant_id%' AND qual LIKE '%current_tenant_id%' THEN '✅ Simple tenant check'
    WHEN qual LIKE '%current_user_id%' THEN '✅ Simple user check'
    WHEN qual IS NULL OR qual = '' THEN '✅ No USING clause'
    ELSE '⚠️  Other predicate: ' || LEFT(qual, 30)
  END as complexity_level,
  CASE 
    WHEN qual IS NOT NULL AND qual != '' THEN LEFT(qual, 60) || '...'
    ELSE 'No USING clause'
  END as predicate_preview
FROM pg_policies p
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'events_outbox')
ORDER BY tablename, cmd;

-- Test 2: Check for missing indexes on policy columns
SELECT 'Test 2: Index Analysis for Policy Columns' as test;

-- Identify columns used in policies that might need indexes
WITH policy_columns AS (
  SELECT DISTINCT
    p.tablename,
    CASE 
      WHEN p.qual LIKE '%tenant_id%' THEN 'tenant_id'
      WHEN p.qual LIKE '%user_id%' THEN 'user_id'
      WHEN p.qual LIKE '%id%' THEN 'id'
      ELSE NULL
    END as policy_column
  FROM pg_policies p
  WHERE schemaname = 'public'
    AND p.qual IS NOT NULL 
    AND p.qual != ''
),
index_coverage AS (
  SELECT 
    pc.tablename,
    pc.policy_column,
    CASE 
      WHEN i.indexname IS NOT NULL THEN '✅ Indexed'
      ELSE '⚠️  No index found'
    END as index_status,
    i.indexname,
    i.indexdef
  FROM policy_columns pc
  LEFT JOIN pg_indexes i ON i.tablename = pc.tablename 
    AND (i.indexdef LIKE '%' || pc.policy_column || '%' OR i.indexdef LIKE '%' || pc.policy_column || '%')
  WHERE pc.policy_column IS NOT NULL
)
SELECT 
  tablename,
  policy_column,
  index_status,
  COALESCE(indexname, 'None') as index_name
FROM index_coverage
ORDER BY tablename, policy_column;

-- Test 3: Analyze policy count impact
SELECT 'Test 3: Policy Count Impact Analysis' as test;

-- Check if you have too many policies that could impact performance
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) <= 4 THEN '✅ Optimal policy count'
    WHEN COUNT(*) <= 8 THEN '⚠️  Moderate policy count'
    WHEN COUNT(*) <= 12 THEN '⚠️  High policy count'
    ELSE '❌ Very high policy count - may impact performance'
  END as performance_impact,
  array_agg(cmd ORDER BY cmd) as operations
FROM pg_policies p
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'tenant_billing', 'quotas', 'events_outbox')
GROUP BY tablename
ORDER BY COUNT(*) DESC;

-- Test 4: Check for redundant or conflicting policies
SELECT 'Test 4: Policy Redundancy Analysis' as test;

-- Look for potentially redundant policies
WITH policy_analysis AS (
  SELECT 
    tablename,
    cmd,
    COUNT(*) as policy_count,
    array_agg(policyname ORDER BY policyname) as policy_names,
    array_agg(qual ORDER BY policyname) as using_clauses,
    array_agg(with_check ORDER BY policyname) as check_clauses
  FROM pg_policies p
  WHERE schemaname = 'public'
    AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'events_outbox')
  GROUP BY tablename, cmd
)
SELECT 
  tablename,
  cmd,
  policy_count,
  CASE 
    WHEN policy_count = 1 THEN '✅ Single policy'
    WHEN policy_count = 2 THEN '⚠️  Multiple policies - check for conflicts'
    ELSE '❌ Multiple policies - potential conflicts'
  END as redundancy_assessment,
  policy_names,
  CASE 
    WHEN policy_count > 1 THEN 'Review for conflicts or redundancy'
    ELSE 'No redundancy concerns'
  END as recommendation
FROM policy_analysis
ORDER BY tablename, cmd;

-- Test 5: Check for potential N+1 query issues
SELECT 'Test 5: N+1 Query Risk Analysis' as test;

-- Look for policies that might cause N+1 query problems
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%EXISTS%' AND qual LIKE '%SELECT%' THEN '⚠️  Potential N+1 risk (EXISTS with subquery)'
    WHEN qual LIKE '%JOIN%' THEN '⚠️  Potential N+1 risk (JOIN in policy)'
    WHEN qual LIKE '%tenant_id%' AND qual LIKE '%current_tenant_id%' THEN '✅ Low risk (simple equality)'
    WHEN qual LIKE '%current_user_id%' THEN '✅ Low risk (simple equality)'
    ELSE '⚠️  Risk level unclear'
  END as n1_risk_assessment,
  CASE 
    WHEN qual IS NOT NULL AND qual != '' THEN LEFT(qual, 50) || '...'
    ELSE 'No USING clause'
  END as predicate_preview
FROM pg_policies p
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'events_outbox')
ORDER BY tablename, cmd;

SELECT '==========================================';
SELECT 'PERFORMANCE ANALYSIS COMPLETE';
SELECT '==========================================';

SELECT 
  'This analysis identifies potential performance issues' as summary,
  'in your RLS policies that could impact scalability.' as explanation,
  'Address ⚠️  and ❌ items for optimal performance.' as guidance;
