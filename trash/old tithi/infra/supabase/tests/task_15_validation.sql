-- ===========================================================
-- RUBRIC: Validate Task 15 (Standard tenant-scoped policies)
-- Context:
--  - Task 03 helpers must exist (current_tenant_id/current_user_id)
--  - Task 14 enabled RLS everywhere, deny-by-default
--  - Task 15 requires 4 policies per tenant-scoped table, all with:
--        tenant_id = public.current_tenant_id()  (USING / WITH CHECK)
--  - Task 16 handles special tables separately (excluded here)
--  - Strict-name check based on your 0015 migration file
-- ===========================================================

WITH
-- ---------- Helpers must exist (Task 03) ----------
helpers AS (
  SELECT
    bool_and(exists(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'current_tenant_id'
        AND pg_get_function_identity_arguments(p.oid) = ''
        AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
    )) AS has_current_tenant_id,
    bool_and(exists(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'current_user_id'
        AND pg_get_function_identity_arguments(p.oid) = ''
        AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
    )) AS has_current_user_id
),
-- ---------- Identify tenant-scoped tables (have tenant_id) and exclude Task 16 special cases ----------
tenant_tables AS (
  SELECT c.oid, n.nspname AS schemaname, c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r' -- ordinary tables
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attisdropped = false
    )
    AND c.relname NOT IN ('tenants','users','memberships','themes','tenant_billing','quotas','notification_event_type','webhook_events_inbox')
),
-- ---------- RLS must be enabled on each tenant-scoped table (Task 14) ----------
rls_state AS (
  SELECT t.schemaname, t.tablename, c.relrowsecurity AS rls_enabled
  FROM tenant_tables t
  JOIN pg_class c ON c.oid = t.oid
),
-- ---------- Summarize policies by command for each tenant table ----------
policy_summary AS (
  SELECT
    p.schemaname, p.tablename,
    count(*) FILTER (WHERE p.cmd = 'SELECT') AS sel_cnt,
    count(*) FILTER (WHERE p.cmd = 'INSERT') AS ins_cnt,
    count(*) FILTER (WHERE p.cmd = 'UPDATE') AS upd_cnt,
    count(*) FILTER (WHERE p.cmd = 'DELETE') AS del_cnt
  FROM pg_policies p
  JOIN tenant_tables t
    ON p.schemaname = t.schemaname AND p.tablename = t.tablename
  GROUP BY p.schemaname, p.tablename
),
-- ---------- Validate semantics of each policy's USING / WITH CHECK ----------
policy_semantics AS (
  SELECT
    p.schemaname, p.tablename, p.policyname, p.cmd,
    coalesce(p.qual, '')      AS using_expr,
    coalesce(p.with_check, '') AS with_check_expr,
    -- Predicate must include "tenant_id = current_tenant_id()" (simplified regex)
    -- INSERT policies don't need USING clauses, only WITH CHECK
    CASE 
      WHEN p.cmd = 'INSERT' THEN TRUE  -- INSERT policies don't have USING clauses
      ELSE (p.qual ~* 'tenant_id.*current_tenant_id')
    END AS using_ok,
    CASE
      WHEN p.cmd IN ('INSERT','UPDATE')
        THEN (coalesce(p.with_check,'') ~* 'tenant_id.*current_tenant_id')
      ELSE TRUE
    END AS with_check_ok
  FROM pg_policies p
  JOIN tenant_tables t
    ON p.schemaname = t.schemaname AND p.tablename = t.tablename
),
-- ---------- STRICT: expected named policies from your 0015 file (optional) ----------
-- Based on actual tables with tenant_id columns, excluding Task 16 special tables
expected_named AS (
  SELECT * FROM (VALUES
    -- Table, Policy Name, Command
    ('customers','customers_sel','SELECT'),
    ('customers','customers_ins','INSERT'),
    ('customers','customers_upd','UPDATE'),
    ('customers','customers_del','DELETE'),

    ('resources','resources_sel','SELECT'),
    ('resources','resources_ins','INSERT'),
    ('resources','resources_upd','UPDATE'),
    ('resources','resources_del','DELETE'),

    ('customer_metrics','customer_metrics_sel','SELECT'),
    ('customer_metrics','customer_metrics_ins','INSERT'),
    ('customer_metrics','customer_metrics_upd','UPDATE'),
    ('customer_metrics','customer_metrics_del','DELETE'),

    ('services','services_sel','SELECT'),
    ('services','services_ins','INSERT'),
    ('services','services_upd','UPDATE'),
    ('services','services_del','DELETE'),

    ('service_resources','service_resources_sel','SELECT'),
    ('service_resources','service_resources_ins','INSERT'),
    ('service_resources','service_resources_upd','UPDATE'),
    ('service_resources','service_resources_del','DELETE'),

    ('availability_rules','availability_rules_sel','SELECT'),
    ('availability_rules','availability_rules_ins','INSERT'),
    ('availability_rules','availability_rules_upd','UPDATE'),
    ('availability_rules','availability_rules_del','DELETE'),

    ('availability_exceptions','availability_exceptions_sel','SELECT'),
    ('availability_exceptions','availability_exceptions_ins','INSERT'),
    ('availability_exceptions','availability_exceptions_upd','UPDATE'),
    ('availability_exceptions','availability_exceptions_del','DELETE'),

    ('bookings','bookings_sel','SELECT'),
    ('bookings','bookings_ins','INSERT'),
    ('bookings','bookings_upd','UPDATE'),
    ('bookings','bookings_del','DELETE'),

    ('booking_items','booking_items_sel','SELECT'),
    ('booking_items','booking_items_ins','INSERT'),
    ('booking_items','booking_items_upd','UPDATE'),
    ('booking_items','booking_items_del','DELETE'),

    ('payments','payments_sel','SELECT'),
    ('payments','payments_ins','INSERT'),
    ('payments','payments_upd','UPDATE'),
    ('payments','payments_del','DELETE'),

    ('coupons','coupons_sel','SELECT'),
    ('coupons','coupons_ins','INSERT'),
    ('coupons','coupons_upd','UPDATE'),
    ('coupons','coupons_del','DELETE'),

    ('gift_cards','gift_cards_sel','SELECT'),
    ('gift_cards','gift_cards_ins','INSERT'),
    ('gift_cards','gift_cards_upd','UPDATE'),
    ('gift_cards','gift_cards_del','DELETE'),

    ('referrals','referrals_sel','SELECT'),
    ('referrals','referrals_ins','INSERT'),
    ('referrals','referrals_upd','UPDATE'),
    ('referrals','referrals_del','DELETE'),

    ('notification_templates','notification_templates_sel','SELECT'),
    ('notification_templates','notification_templates_ins','INSERT'),
    ('notification_templates','notification_templates_upd','UPDATE'),
    ('notification_templates','notification_templates_del','DELETE'),

    ('notifications','notifications_sel','SELECT'),
    ('notifications','notifications_ins','INSERT'),
    ('notifications','notifications_upd','UPDATE'),
    ('notifications','notifications_del','DELETE'),

    ('usage_counters','usage_counters_sel','SELECT'),
    ('usage_counters','usage_counters_ins','INSERT'),
    ('usage_counters','usage_counters_upd','UPDATE'),
    ('usage_counters','usage_counters_del','DELETE'),

    ('audit_logs','audit_logs_sel','SELECT'),
    ('audit_logs','audit_logs_ins','INSERT'),
    ('audit_logs','audit_logs_upd','UPDATE'),
    ('audit_logs','audit_logs_del','DELETE'),

    ('events_outbox','events_outbox_sel','SELECT'),
    ('events_outbox','events_outbox_ins','INSERT'),
    ('events_outbox','events_outbox_upd','UPDATE'),
    ('events_outbox','events_outbox_del','DELETE')
  ) AS v(tablename, policyname, cmd)
),
strict_missing AS (
  -- Any expected (name, cmd) not found?
  SELECT e.tablename, e.policyname, e.cmd
  FROM expected_named e
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public'
   AND p.tablename  = e.tablename
   AND p.policyname = e.policyname
   AND p.cmd        = e.cmd
  WHERE p.policyname IS NULL
),
-- ---------- Collect failures ----------
fail_helpers AS (
  SELECT 'helpers' AS check_type,
         CASE
           WHEN NOT (SELECT has_current_tenant_id FROM helpers) THEN 'missing function public.current_tenant_id()::uuid'
         END AS detail
  UNION ALL
  SELECT 'helpers',
         CASE
           WHEN NOT (SELECT has_current_user_id FROM helpers) THEN 'missing function public.current_user_id()::uuid'
         END
),
fail_rls AS (
  SELECT 'rls' AS check_type,
         format('RLS not enabled on %I.%I', r.schemaname, r.tablename) AS detail
  FROM rls_state r
  WHERE r.rls_enabled IS NOT TRUE
),
fail_counts AS (
  SELECT 'policy_count' AS check_type,
         format('%I.%I needs 4 policies per CRUD but has sel=%s ins=%s upd=%s del=%s',
                s.schemaname, s.tablename, s.sel_cnt, s.ins_cnt, s.upd_cnt, s.del_cnt) AS detail
  FROM policy_summary s
  WHERE NOT (s.sel_cnt = 1 AND s.ins_cnt = 1 AND s.upd_cnt = 1 AND s.del_cnt = 1)
),
fail_semantic_using AS (
  SELECT 'policy_semantics' AS check_type,
         format('%I.%I %s policy USING is not tenant-scoped (found: %s)',
                ps.schemaname, ps.tablename, ps.cmd, NULLIF(ps.using_expr,'')) AS detail
  FROM policy_semantics ps
  WHERE ps.using_ok IS NOT TRUE
),
fail_semantic_check AS (
  SELECT 'policy_semantics' AS check_type,
         format('%I.%I %s policy WITH CHECK is not tenant-scoped (found: %s)',
                ps.schemaname, ps.tablename, ps.cmd, NULLIF(ps.with_check_expr,'')) AS detail
  FROM policy_semantics ps
  WHERE ps.with_check_ok IS NOT TRUE
),
fail_strict_names AS (
  SELECT 'policy_names' AS check_type,
         format('Expected named policy missing: %I on %I (%s)', policyname, tablename, cmd) AS detail
  FROM strict_missing
)
-- ---------- Final report: any rows returned here indicate a failure ----------
SELECT *
FROM (
  SELECT * FROM fail_helpers WHERE detail IS NOT NULL
  UNION ALL
  SELECT * FROM fail_rls
  UNION ALL
  SELECT * FROM fail_counts
  UNION ALL
  SELECT * FROM fail_semantic_using
  UNION ALL
  SELECT * FROM fail_semantic_check
  UNION ALL
  SELECT * FROM fail_strict_names
) f
ORDER BY check_type, detail;

-- Tip: If this returns NO ROWS, Task 15 is fully compliant with spec.
-- To see a compact summary of successes as well, run:
--   SELECT 'OK: Task 15 policies are correctly implemented.' AS status
--   WHERE NOT EXISTS (SELECT 1 FROM ( <the big SELECT above> ) x );
