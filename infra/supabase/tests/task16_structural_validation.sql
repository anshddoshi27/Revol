-- =============================================================================
-- TASK 16 STRUCTURAL VALIDATION: Policy Architecture Verification
-- =============================================================================
-- This is the rubric from the user, adapted for Supabase SQL editor.
-- Validates that Task 16 was implemented with exact policy names, counts,
-- and patterns as specified in the Design Brief and Context Pack.
--
-- Run this FIRST to ensure structural correctness before running practical tests.
-- =============================================================================

WITH
-- ---------- Helper: ensure RLS is enabled on all relevant tables (Task 14 pre-req)
rls_expected AS (
  SELECT unnest(ARRAY[
    'tenants','users','memberships','themes','tenant_billing','quotas',
    'webhook_events_inbox','events_outbox'
  ]) AS tablename
),
rls_status AS (
  SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (SELECT tablename FROM rls_expected)
),

-- ---------- Helper: policies present in catalog
pol AS (
  SELECT
    p.schemaname,
    p.tablename,
    p.policyname,
    p.cmd,
    COALESCE(p.qual, '') AS using_expr,
    COALESCE(p.with_check, '') AS check_expr
  FROM pg_policies p
  JOIN pg_class pc
    ON pc.relname = p.tablename
   AND pc.relkind = 'r'
  JOIN pg_namespace pn
    ON pn.oid = pc.relnamespace AND pn.nspname = p.schemaname
  WHERE p.schemaname = 'public'
),

-- ---------- Expected policy counts by table for Task 16
policy_count_expect AS (
  SELECT * FROM (VALUES
    ('tenants',          1),   -- SELECT only
    ('users',            1),   -- SELECT only
    ('memberships',      4),   -- SELECT/INSERT/UPDATE/DELETE (owner/admin writers)
    ('themes',           4),
    ('tenant_billing',   4),
    ('quotas',           4),
    ('webhook_events_inbox', 0), -- service-role only (no end-user policies)
    ('events_outbox',    4)    -- SELECT/INSERT/UPDATE/DELETE
  ) AS t(tablename, expected_count)
),

-- ---------- Check 1: RLS enabled
check_rls AS (
  SELECT
    'RLS enabled on '||e.tablename AS check_name,
    CASE WHEN s.rls_enabled IS TRUE THEN 'PASS' ELSE 'FAIL' END AS passed,
    s.rls_enabled::text AS got,
    'true' AS expected
  FROM rls_expected e
  LEFT JOIN rls_status s ON s.tablename = e.tablename
),

-- ---------- Check 2: Exact policy counts per table
check_counts AS (
  SELECT
    'Policy count on '||e.tablename AS check_name,
    CASE WHEN COUNT(p.policyname) = e.expected_count THEN 'PASS' ELSE 'FAIL' END AS passed,
    COUNT(p.policyname)::text AS got,
    e.expected_count::text AS expected
  FROM policy_count_expect e
  LEFT JOIN pol p ON p.tablename = e.tablename
  GROUP BY e.tablename, e.expected_count
),

-- ---------- Check 3: Tenants table policies (SELECT only, member-gated via EXISTS)
check_tenants AS (
  SELECT
    'tenants: SELECT member-gated (policy name & USING)' AS check_name,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pol
        WHERE tablename='tenants' AND cmd='SELECT'
          AND policyname='tenants_sel_members'
          AND using_expr ILIKE '%EXISTS (%FROM public.memberships%'
          AND using_expr ILIKE '%m.tenant_id = tenants.id%'
          AND using_expr ILIKE '%m.user_id = public.current_user_id()%'
      )
    THEN 'PASS' ELSE 'FAIL' END AS passed,
    COALESCE((
      SELECT policyname||' / '||using_expr
      FROM pol WHERE tablename='tenants' AND cmd='SELECT' LIMIT 1
    ), 'NONE') AS got,
    'Policy tenants_sel_members with USING EXISTS(memberships) + current_user_id()' AS expected
),
check_tenants_no_writes AS (
  SELECT
    'tenants: no INSERT/UPDATE/DELETE policies' AS check_name,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pol WHERE tablename='tenants' AND cmd IN ('INSERT','UPDATE','DELETE')
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT string_agg(cmd||':'||policyname, ', ')
       FROM pol WHERE tablename='tenants' AND cmd IN ('INSERT','UPDATE','DELETE')) AS got,
    'None' AS expected
),

-- ---------- Check 4: Users table policy (SELECT self or shared-tenant)
check_users AS (
  SELECT
    'users: SELECT self or shared-tenant (policy name & USING)' AS check_name,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pol
        WHERE tablename='users' AND cmd='SELECT'
          AND policyname='users_sel_self_or_shared_tenant'
          AND using_expr ILIKE '%id = public.current_user_id()%'
          AND using_expr ILIKE '%JOIN public.memberships m1%'
          AND using_expr ILIKE '%JOIN public.memberships m2 ON m1.tenant_id = m2.tenant_id%'
          AND using_expr ILIKE '%m1.user_id = public.current_user_id()%'
          AND using_expr ILIKE '%m2.user_id = users.id%'
      )
    THEN 'PASS' ELSE 'FAIL' END AS passed,
    COALESCE((
      SELECT policyname||' / '||using_expr
      FROM pol WHERE tablename='users' AND cmd='SELECT' LIMIT 1
    ), 'NONE') AS got,
    'Policy users_sel_self_or_shared_tenant with self OR shared-tenant EXISTS-join' AS expected
),
check_users_no_writes AS (
  SELECT
    'users: no INSERT/UPDATE/DELETE policies' AS check_name,
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pol WHERE tablename='users' AND cmd IN ('INSERT','UPDATE','DELETE')
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT string_agg(cmd||':'||policyname, ', ')
       FROM pol WHERE tablename='users' AND cmd IN ('INSERT','UPDATE','DELETE')) AS got,
    'None' AS expected
),

-- ---------- Macro for "owner/admin write gates" (memberships, themes, tenant_billing, quotas)
check_owner_admin AS (
  SELECT * FROM (
    VALUES
      ('memberships'),
      ('themes'),
      ('tenant_billing'),
      ('quotas')
  ) AS t(tablename)
),
check_owner_admin_select AS (
  SELECT
    tablename||': SELECT member-gated (USING EXISTS)' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE pol.tablename = t.tablename AND cmd='SELECT'
        AND using_expr ILIKE '%EXISTS (%FROM public.memberships%'
        AND using_expr ILIKE '%m.tenant_id = '||t.tablename||'.tenant_id%'
        AND using_expr ILIKE '%m.user_id = public.current_user_id()%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT policyname FROM pol WHERE tablename=t.tablename AND cmd='SELECT' LIMIT 1) AS got,
    'Member-gated SELECT' AS expected
  FROM check_owner_admin t
),
check_owner_admin_insert AS (
  SELECT
    tablename||': INSERT owner/admin WITH CHECK' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE pol.tablename = t.tablename AND cmd='INSERT'
        AND check_expr ILIKE '%EXISTS (%FROM public.memberships%'
        AND check_expr ILIKE '%m.tenant_id = '||t.tablename||'.tenant_id%'
        AND check_expr ILIKE '%m.user_id = public.current_user_id()%'
        AND check_expr ILIKE '%m.role IN (''owner'', ''admin'')%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT policyname FROM pol WHERE tablename=t.tablename AND cmd='INSERT' LIMIT 1) AS got,
    'Owner/Admin WITH CHECK' AS expected
  FROM check_owner_admin t
),
check_owner_admin_update AS (
  SELECT
    tablename||': UPDATE owner/admin USING & WITH CHECK' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE pol.tablename = t.tablename AND cmd='UPDATE'
        AND using_expr ILIKE '%EXISTS (%FROM public.memberships%'
        AND using_expr ILIKE '%m.tenant_id = '||t.tablename||'.tenant_id%'
        AND using_expr ILIKE '%m.user_id = public.current_user_id()%'
        AND using_expr ILIKE '%m.role IN (''owner'', ''admin'')%'
        AND check_expr ILIKE '%EXISTS (%FROM public.memberships%'
        AND check_expr ILIKE '%m.tenant_id = '||t.tablename||'.tenant_id%'
        AND check_expr ILIKE '%m.user_id = public.current_user_id()%'
        AND check_expr ILIKE '%m.role IN (''owner'', ''admin'')%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT policyname FROM pol WHERE tablename=t.tablename AND cmd='UPDATE' LIMIT 1) AS got,
    'Owner/Admin USING + WITH CHECK' AS expected
  FROM check_owner_admin t
),
check_owner_admin_delete AS (
  SELECT
    tablename||': DELETE owner/admin USING' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE pol.tablename = t.tablename AND cmd='DELETE'
        AND using_expr ILIKE '%EXISTS (%FROM public.memberships%'
        AND using_expr ILIKE '%m.tenant_id = '||t.tablename||'.tenant_id%'
        AND using_expr ILIKE '%m.user_id = public.current_user_id()%'
        AND using_expr ILIKE '%m.role IN (''owner'', ''admin'')%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT policyname FROM pol WHERE tablename=t.tablename AND cmd='DELETE' LIMIT 1) AS got,
    'Owner/Admin USING' AS expected
  FROM check_owner_admin t
),

-- ---------- webhook_events_inbox: zero end-user policies
check_webhook_inbox AS (
  SELECT
    'webhook_events_inbox: no end-user policies (service-role only)' AS check_name,
    CASE WHEN NOT EXISTS (SELECT 1 FROM pol WHERE tablename='webhook_events_inbox')
    THEN 'PASS' ELSE 'FAIL' END AS passed,
    (SELECT string_agg(policyname, ', ') FROM pol WHERE tablename='webhook_events_inbox') AS got,
    'None' AS expected
),

-- ---------- events_outbox: member read/write via current_tenant_id; named policies present
check_outbox_select AS (
  SELECT
    'events_outbox: SELECT member-gated (policy name & USING)' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE tablename='events_outbox' AND cmd='SELECT'
        AND policyname='events_outbox_sel_members_and_service'
        AND using_expr ILIKE '%EXISTS (%FROM public.memberships%'
        AND using_expr ILIKE '%m.tenant_id = events_outbox.tenant_id%'
        AND using_expr ILIKE '%m.user_id = public.current_user_id()%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    COALESCE((SELECT policyname||' / '||using_expr FROM pol WHERE tablename='events_outbox' AND cmd='SELECT' LIMIT 1), 'NONE') AS got,
    'events_outbox_sel_members_and_service with member-gated USING' AS expected
),
check_outbox_insert AS (
  SELECT
    'events_outbox: INSERT WITH CHECK tenant_id = current_tenant_id()' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE tablename='events_outbox' AND cmd='INSERT'
        AND policyname='events_outbox_ins_members'
        AND check_expr ILIKE '%tenant_id = public.current_tenant_id()%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    COALESCE((SELECT policyname||' / '||check_expr FROM pol WHERE tablename='events_outbox' AND cmd='INSERT' LIMIT 1), 'NONE') AS got,
    'events_outbox_ins_members WITH CHECK tenant_id = current_tenant_id()' AS expected
),
check_outbox_update AS (
  SELECT
    'events_outbox: UPDATE USING/WITH CHECK tenant_id = current_tenant_id()' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE tablename='events_outbox' AND cmd='UPDATE'
        AND policyname='events_outbox_upd_members'
        AND using_expr ILIKE '%tenant_id = public.current_tenant_id()%'
        AND check_expr ILIKE '%tenant_id = public.current_tenant_id()%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    COALESCE((SELECT policyname||' / '||using_expr||' || '||check_expr FROM pol WHERE tablename='events_outbox' AND cmd='UPDATE' LIMIT 1), 'NONE') AS got,
    'events_outbox_upd_members USING & WITH CHECK = current_tenant_id()' AS expected
),
check_outbox_delete AS (
  SELECT
    'events_outbox: DELETE USING tenant_id = current_tenant_id()' AS check_name,
    CASE WHEN EXISTS (
      SELECT 1 FROM pol
      WHERE tablename='events_outbox' AND cmd='DELETE'
        AND policyname='events_outbox_del_members'
        AND using_expr ILIKE '%tenant_id = public.current_tenant_id()%'
    ) THEN 'PASS' ELSE 'FAIL' END AS passed,
    COALESCE((SELECT policyname||' / '||using_expr FROM pol WHERE tablename='events_outbox' AND cmd='DELETE' LIMIT 1), 'NONE') AS got,
    'events_outbox_del_members USING = current_tenant_id()' AS expected
),

-- ---------- Presence of helper functions used by policies (Task 03 pre-req)
check_helpers AS (
  SELECT
    'Helpers present: current_user_id() & current_tenant_id()' AS check_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_user_id' AND pronamespace = 'public'::regnamespace)
           AND EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_tenant_id' AND pronamespace = 'public'::regnamespace)
    THEN 'PASS' ELSE 'FAIL' END AS passed,
    (
      SELECT string_agg(proname, ', ')
      FROM pg_proc
      WHERE pronamespace='public'::regnamespace AND proname IN ('current_user_id','current_tenant_id')
    ) AS got,
    'Both functions exist in schema public' AS expected
)
-- ---------- Final UNION of all checks  
SELECT 
  ROW_NUMBER() OVER (ORDER BY check_name) as test_num,
  check_name, 
  passed, 
  expected, 
  got
FROM (
  SELECT * FROM check_rls
  UNION ALL SELECT * FROM check_counts
  UNION ALL SELECT * FROM check_tenants
  UNION ALL SELECT * FROM check_tenants_no_writes
  UNION ALL SELECT * FROM check_users
  UNION ALL SELECT * FROM check_users_no_writes
  UNION ALL SELECT * FROM check_owner_admin_select
  UNION ALL SELECT * FROM check_owner_admin_insert
  UNION ALL SELECT * FROM check_owner_admin_update
  UNION ALL SELECT * FROM check_owner_admin_delete
  UNION ALL SELECT * FROM check_webhook_inbox
  UNION ALL SELECT * FROM check_outbox_select
  UNION ALL SELECT * FROM check_outbox_insert
  UNION ALL SELECT * FROM check_outbox_update
  UNION ALL SELECT * FROM check_outbox_delete
  UNION ALL SELECT * FROM check_helpers
) t
ORDER BY check_name;

-- Run the summary in a separate query to get the statistics
-- To see summary, run this after the above query:
-- 
-- SELECT 
--   CASE 
--     WHEN failed_count = 0 
--     THEN '🎉 PERFECT! All ' || total_count || ' structural validations PASSED.'
--     ELSE '❌ ' || failed_count || ' validations FAILED out of ' || total_count || '.'
--   END as summary,
--   total_count,
--   passed_count, 
--   failed_count
-- FROM (
--   SELECT 
--     COUNT(*) as total_count,
--     SUM(CASE WHEN passed = 'PASS' THEN 1 ELSE 0 END) as passed_count,
--     SUM(CASE WHEN passed = 'FAIL' THEN 1 ELSE 0 END) as failed_count
--   FROM <previous_query_results>
-- );
