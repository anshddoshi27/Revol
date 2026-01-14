-- TITHI DB — TASK 14 RUBRIC: "Enable RLS on all tables"
-- Purpose: 100% confirm that every table created by Tasks 00–13 exists
--          and has Row Level Security ENABLED (deny-by-default baseline).
-- Outcome: 1) Per-table checklist
--          2) Roll-up summary
--          3) FAILS HARD (RAISE EXCEPTION) if any check fails

-- ---------- CONFIG: expected tables after Tasks 00–13 ----------
WITH expected AS (
  SELECT unnest(ARRAY[
    -- Core tenancy
    'public.tenants',
    'public.users',
    'public.memberships',
    'public.themes',

    -- Catalog / CRM
    'public.customers',
    'public.resources',
    'public.customer_metrics',

    -- Services
    'public.services',
    'public.service_resources',

    -- Availability / Scheduling
    'public.availability_rules',
    'public.availability_exceptions',
    'public.bookings',
    'public.booking_items',

    -- Money / Billing
    'public.payments',
    'public.tenant_billing',

    -- Promotions
    'public.coupons',
    'public.gift_cards',
    'public.referrals',

    -- Notifications
    'public.notification_event_type',
    'public.notification_templates',
    'public.notifications',

    -- Usage & Quotas
    'public.usage_counters',
    'public.quotas',

    -- Audit & Eventing
    'public.audit_logs',
    'public.events_outbox',
    'public.webhook_events_inbox'
  ]) AS fqname
),

-- ---------- Introspection of actual tables ----------
catalog AS (
  SELECT
    n.nspname                          AS schema_name,
    c.relname                          AS table_name,
    (n.nspname || '.' || c.relname)    AS fqname,
    c.relkind                          AS relkind,             -- 'r' = table
    c.relrowsecurity                   AS rls_enabled,         -- true if RLS enabled
    c.relforcerowsecurity              AS force_rls            -- true if FORCE RLS
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' -- ordinary tables only
),

joined AS (
  SELECT
    e.fqname,
    c.schema_name,
    c.table_name,
    (c.fqname IS NOT NULL)            AS exists_flag,
    COALESCE(c.rls_enabled, false)    AS rls_enabled,
    COALESCE(c.force_rls, false)      AS force_rls,
    CASE
      WHEN c.fqname IS NULL THEN 'MISSING TABLE from Tasks 00–13'
      WHEN c.rls_enabled IS NOT TRUE THEN 'RLS NOT ENABLED'
      ELSE 'OK'
    END AS status_note
  FROM expected e
  LEFT JOIN catalog c ON c.fqname = e.fqname
),

summary AS (
  SELECT
    COUNT(*)                                           AS total_expected,
    COUNT(*) FILTER (WHERE exists_flag)               AS total_found,
    COUNT(*) FILTER (WHERE exists_flag AND rls_enabled) AS total_rls_on,
    COUNT(*) FILTER (WHERE NOT exists_flag)           AS missing_tables,
    COUNT(*) FILTER (WHERE exists_flag AND NOT rls_enabled) AS rls_off
  FROM joined
)

-- ---------- 1) Per-table checklist ----------
SELECT
  'PER-TABLE CHECKLIST' as report_section,
  fqname                 AS table_fqname,
  exists_flag::text      AS exists,
  rls_enabled::text      AS rls_enabled,
  force_rls::text        AS force_rls,          -- informative; not required by Task 14
  status_note
FROM joined
ORDER BY (NOT exists_flag), (NOT rls_enabled), fqname

UNION ALL

-- ---------- 2) Roll-up summary ----------
SELECT
  'ROLL-UP SUMMARY' as report_section,
  CONCAT('Expected: ', total_expected::text) AS table_fqname,
  CONCAT('Found: ', total_found::text) AS exists,
  CONCAT('RLS On: ', total_rls_on::text) AS rls_enabled,
  CONCAT('Missing: ', missing_tables::text) AS force_rls,
  CASE
    WHEN missing_tables = 0 AND rls_off = 0 THEN 'PASS - All tables exist with RLS enabled'
    ELSE CONCAT('FAIL - Missing: ', missing_tables::text, ', RLS Off: ', rls_off::text)
  END AS status_note
FROM summary;

-- ---------- 3) Hard fail if any gap ----------
DO $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM (
    WITH expected AS (
      SELECT unnest(ARRAY[
        'public.tenants', 'public.users', 'public.memberships', 'public.themes',
        'public.customers', 'public.resources', 'public.customer_metrics',
        'public.services', 'public.service_resources',
        'public.availability_rules', 'public.availability_exceptions', 
        'public.bookings', 'public.booking_items',
        'public.payments', 'public.tenant_billing',
        'public.coupons', 'public.gift_cards', 'public.referrals',
        'public.notification_event_type', 'public.notification_templates', 'public.notifications',
        'public.usage_counters', 'public.quotas',
        'public.audit_logs', 'public.events_outbox', 'public.webhook_events_inbox'
      ]) AS fqname
    ),
    catalog AS (
      SELECT
        (n.nspname || '.' || c.relname) AS fqname,
        c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
    ),
    joined AS (
      SELECT
        e.fqname,
        (c.fqname IS NOT NULL) AS exists_flag,
        COALESCE(c.rls_enabled, false) AS rls_enabled
      FROM expected e
      LEFT JOIN catalog c ON c.fqname = e.fqname
    )
    SELECT 
      COUNT(*) FILTER (WHERE NOT exists_flag) AS missing_tables,
      COUNT(*) FILTER (WHERE exists_flag AND NOT rls_enabled) AS rls_off
    FROM joined
  ) z;

  IF s.missing_tables > 0 OR s.rls_off > 0 THEN
    RAISE EXCEPTION
      'Task 14 FAILED: % missing table(s); % table(s) with RLS OFF. See the checklist above for details.',
      s.missing_tables, s.rls_off;
  ELSE
    RAISE NOTICE 'Task 14 VALIDATION PASSED: All % tables exist with RLS enabled!', 
      (SELECT COUNT(*) FROM (
        SELECT unnest(ARRAY[
          'public.tenants', 'public.users', 'public.memberships', 'public.themes',
          'public.customers', 'public.resources', 'public.customer_metrics',
          'public.services', 'public.service_resources',
          'public.availability_rules', 'public.availability_exceptions', 
          'public.bookings', 'public.booking_items',
          'public.payments', 'public.tenant_billing',
          'public.coupons', 'public.gift_cards', 'public.referrals',
          'public.notification_event_type', 'public.notification_templates', 'public.notifications',
          'public.usage_counters', 'public.quotas',
          'public.audit_logs', 'public.events_outbox', 'public.webhook_events_inbox'
        ]) AS fqname
      ) t);
  END IF;
END$$;
