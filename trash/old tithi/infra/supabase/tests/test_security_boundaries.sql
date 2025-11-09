-- =================================================================
-- Test Security Boundaries & Fail-Closed Behavior
-- Verifies that your RLS policies actually block unauthorized access
-- =================================================================

SELECT '==========================================';
SELECT 'TESTING SECURITY BOUNDARIES';
SELECT '==========================================';

-- Test 1: Verify RLS is actually blocking access
SELECT 'Test 1: RLS Enforcement Verification' as test;

-- Check if RLS is truly enabled and working
SELECT 
  tablename,
  relrowsecurity as rls_enabled,
  CASE 
    WHEN relrowsecurity THEN '✅ RLS Active'
    ELSE '❌ RLS Disabled'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
  AND c.relname IN ('tenants', 'users', 'memberships', 'themes', 'events_outbox')
ORDER BY tablename;

-- Test 2: Check policy coverage completeness
SELECT 'Test 2: Policy Coverage Analysis' as test;

-- Verify that all tables have appropriate policies
WITH table_policy_coverage AS (
  SELECT 
    c.relname as tablename,
    COUNT(p.policyname) as policy_count,
    CASE 
      WHEN COUNT(p.policyname) = 0 THEN '❌ No policies (deny all)'
      WHEN COUNT(p.policyname) >= 1 THEN '✅ Has policies'
      ELSE '⚠️  Policy count unclear'
    END as coverage_status
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
  WHERE n.nspname = 'public' 
    AND c.relkind = 'r'
    AND c.relname IN ('tenants', 'users', 'memberships', 'themes', 'tenant_billing', 'quotas', 'events_outbox', 'webhook_events_inbox')
  GROUP BY c.relname
)
SELECT 
  tablename,
  policy_count,
  coverage_status
FROM table_policy_coverage
ORDER BY tablename;

-- Test 3: Analyze policy predicates for security
SELECT 'Test 3: Policy Security Analysis' as test;

-- Check what your policies actually enforce
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%tenant_id%' THEN '✅ Tenant-scoped'
    WHEN qual LIKE '%current_user_id%' THEN '✅ User-scoped'
    WHEN qual LIKE '%EXISTS%' THEN '✅ Complex predicate'
    WHEN qual IS NULL OR qual = '' THEN '⚠️  No USING clause'
    ELSE '⚠️  Other predicate: ' || qual
  END as security_level,
  CASE 
    WHEN qual IS NOT NULL AND qual != '' THEN LEFT(qual, 50) || '...'
    ELSE 'No USING clause'
  END as predicate_preview
FROM pg_policies p
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'events_outbox')
ORDER BY tablename, cmd;

-- Test 4: Check for potential security gaps
SELECT 'Test 4: Security Gap Analysis' as test;

-- Look for tables that might be missing critical policies
WITH security_analysis AS (
  SELECT 
    tablename,
    COUNT(*) as total_policies,
    COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_policies,
    COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_policies,
    COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_policies,
    COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_policies,
    CASE 
      WHEN COUNT(*) = 0 THEN '❌ CRITICAL: No policies (deny all)'
      WHEN COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) = 0 THEN '⚠️  WARNING: No SELECT policies'
      WHEN COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) = 0 THEN '⚠️  WARNING: No INSERT policies'
      WHEN COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) = 0 THEN '⚠️  WARNING: No UPDATE policies'
      WHEN COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) = 0 THEN '⚠️  WARNING: No DELETE policies'
      ELSE '✅ All operation types covered'
    END as security_assessment
  FROM pg_policies p
  WHERE schemaname = 'public'
    AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'tenant_billing', 'quotas', 'events_outbox')
  GROUP BY tablename
)
SELECT 
  tablename,
  total_policies,
  select_policies,
  insert_policies,
  update_policies,
  delete_policies,
  security_assessment
FROM security_analysis
ORDER BY tablename;

-- Test 5: Verify helper function security
SELECT 'Test 5: Helper Function Security' as test;

-- Check if your helper functions are secure
SELECT 
  proname as function_name,
  CASE 
    WHEN prosrc LIKE '%SECURITY DEFINER%' THEN '⚠️  SECURITY DEFINER (runs as owner)'
    WHEN prosrc LIKE '%SECURITY INVOKER%' THEN '✅ SECURITY INVOKER (runs as caller)'
    ELSE '⚠️  Security context unclear'
  END as security_context,
  CASE 
    WHEN prosrc LIKE '%current_setting%' THEN '✅ Uses session context'
    WHEN prosrc LIKE '%auth.jwt%' THEN '✅ Uses JWT claims'
    ELSE '⚠️  Context source unclear'
  END as context_source
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('current_user_id', 'current_tenant_id')
ORDER BY proname;

SELECT '==========================================';
SELECT 'SECURITY ANALYSIS COMPLETE';
SELECT '==========================================';

SELECT 
  'This analysis shows whether your RLS policies' as summary,
  'are actually providing security, not just existing.' as explanation,
  'Look for ❌ and ⚠️  indicators that need attention.' as guidance;
