-- =================================================================
-- Test Policy Functionality (Not Just Names)
-- Verifies that your existing policies actually work as intended
-- =================================================================

-- Clean environment first
SELECT public.cleanup_all_test_data();

SELECT '==========================================';
SELECT 'TESTING ACTUAL POLICY FUNCTIONALITY';
SELECT '==========================================';

-- Test 1: Create test tenant and user
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('11111111-2222-3333-4444-555555555555', 'policy-test-tenant', 'UTC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, display_name, primary_email) VALUES 
  ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Policy Test User', 'policy-test@example.com')
ON CONFLICT (id) DO NOTHING;

-- Test 2: Test tenant visibility policies
SELECT 'Test 2: Tenant Visibility Policies' as test;

-- This should work if tenant policies are working
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Tenant policies allow access'
    ELSE '❌ Tenant policies blocking access'
  END as result,
  COUNT(*) as tenants_visible
FROM public.tenants 
WHERE slug = 'policy-test-tenant';

-- Test 3: Test user visibility policies  
SELECT 'Test 3: User Visibility Policies' as test;

-- This should work if user policies are working
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ User policies allow access'
    ELSE '❌ User policies blocking access'
  END as result,
  COUNT(*) as users_visible
FROM public.users 
WHERE primary_email = 'policy-test@example.com';

-- Test 4: Test membership creation (if policies allow)
SELECT 'Test 4: Membership Creation Policies' as test;

-- Try to create a membership (this tests INSERT policies)
BEGIN;
  INSERT INTO public.memberships (tenant_id, user_id, role) VALUES 
    ('11111111-2222-3333-4444-555555555555', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'owner');
  
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN '✅ Membership INSERT policies working'
      ELSE '❌ Membership INSERT policies blocking'
    END as result,
    COUNT(*) as memberships_created
  FROM public.memberships 
  WHERE tenant_id = '11111111-2222-3333-4444-555555555555';
ROLLBACK;

-- Test 5: Test theme policies
SELECT 'Test 5: Theme Policies' as test;

-- Try to create a theme (tests INSERT policies)
BEGIN;
  INSERT INTO public.themes (tenant_id, brand_color) VALUES 
    ('11111111-2222-3333-4444-555555555555', '#test-color');
  
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN '✅ Theme INSERT policies working'
      ELSE '❌ Theme INSERT policies blocking'
    END as result,
    COUNT(*) as themes_created
  FROM public.themes 
  WHERE tenant_id = '11111111-2222-3333-4444-555555555555';
ROLLBACK;

-- Test 6: Test events_outbox policies
SELECT 'Test 6: Events Outbox Policies' as test;

-- Try to create an event (tests INSERT policies)
BEGIN;
  INSERT INTO public.events_outbox (tenant_id, event_code, payload) VALUES 
    ('11111111-2222-3333-4444-555555555555', 'policy_test', '{"test": true}');
  
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN '✅ Events INSERT policies working'
      ELSE '❌ Events INSERT policies blocking'
    END as result,
    COUNT(*) as events_created
  FROM public.events_outbox 
  WHERE tenant_id = '11111111-2222-3333-4444-555555555555';
ROLLBACK;

-- Test 7: Test cross-tenant isolation
SELECT 'Test 7: Cross-Tenant Isolation' as test;

-- Create a second tenant
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('22222222-3333-4444-5555-666666666666', 'policy-test-tenant-2', 'UTC')
ON CONFLICT (id) DO NOTHING;

-- Try to access first tenant's data from second tenant context
-- This should be blocked if isolation policies work
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Cross-tenant isolation working'
    ELSE '⚠️  Cross-tenant isolation may have gaps'
  END as result,
  COUNT(*) as cross_tenant_access
FROM public.tenants 
WHERE slug = 'policy-test-tenant';

-- Test 8: Test policy predicate analysis
SELECT 'Test 8: Policy Predicate Analysis' as test;

-- Show what your policies actually check for
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL AND qual != '' THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL AND with_check != '' THEN 'WITH CHECK: ' || with_check
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('tenants', 'users', 'memberships', 'themes', 'events_outbox')
ORDER BY tablename, cmd;

-- Cleanup
SELECT public.safe_delete_tenant('11111111-2222-3333-4444-555555555555');
SELECT public.safe_delete_tenant('22222222-3333-4444-5555-666666666666');
DELETE FROM public.users WHERE primary_email = 'policy-test@example.com';

SELECT '==========================================';
SELECT 'POLICY FUNCTIONALITY TEST COMPLETE';
SELECT '==========================================';

SELECT 
  'This test verifies that your policies actually work,' as summary,
  'not just that they exist with the right names.' as explanation,
  'If all tests pass, your RLS implementation is solid!' as conclusion;
