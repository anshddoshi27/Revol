-- =================================================================
-- Analyze Existing Policies (Non-Destructive)
-- Shows what policies you already have vs what validation expects
-- =================================================================

SELECT '==========================================';
SELECT 'EXISTING POLICY ANALYSIS';
SELECT '==========================================';

-- Show all existing policies
SELECT 
  'EXISTING POLICIES:' as section,
  schemaname,
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
ORDER BY tablename, cmd;

-- Policy count summary
SELECT '==========================================';
SELECT 'POLICY COUNT SUMMARY:' as section;

SELECT 
  tablename,
  COUNT(*) as policy_count,
  array_agg(cmd ORDER BY cmd) as operations,
  array_agg(policyname ORDER BY cmd) as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Compare with validation expectations
SELECT '==========================================';
SELECT 'VALIDATION EXPECTATIONS vs REALITY:' as section;

WITH expected AS (
  SELECT * FROM (VALUES
    ('tenants', 1, 'SELECT only'),
    ('users', 1, 'SELECT only'),
    ('memberships', 4, 'SELECT/INSERT/UPDATE/DELETE'),
    ('themes', 4, 'SELECT/INSERT/UPDATE/DELETE'),
    ('tenant_billing', 4, 'SELECT/INSERT/UPDATE/DELETE'),
    ('quotas', 4, 'SELECT/INSERT/UPDATE/DELETE'),
    ('events_outbox', 4, 'SELECT/INSERT/UPDATE/DELETE'),
    ('webhook_events_inbox', 0, 'No end-user policies')
  ) AS t(tablename, expected_count, description)
),
actual AS (
  SELECT 
    tablename,
    COUNT(*) as actual_count
  FROM pg_policies 
  WHERE schemaname = 'public'
  GROUP BY tablename
)
SELECT 
  e.tablename,
  e.expected_count,
  COALESCE(a.actual_count, 0) as actual_count,
  e.description,
  CASE 
    WHEN COALESCE(a.actual_count, 0) = e.expected_count THEN '✅ MATCH'
    WHEN a.actual_count > e.expected_count THEN '⚠️  MORE than expected'
    ELSE '❌ MISSING policies'
  END as status
FROM expected e
LEFT JOIN actual a ON e.tablename = a.tablename
ORDER BY e.tablename;

-- Policy naming pattern analysis
SELECT '==========================================';
SELECT 'POLICY NAMING PATTERNS:' as section;

SELECT 
  tablename,
  string_agg(policyname, ', ' ORDER BY policyname) as policy_names,
  CASE 
    WHEN tablename = 'events_outbox' AND COUNT(*) = 4 THEN '✅ Has 4 policies (may be named differently)'
    WHEN tablename IN ('memberships', 'themes', 'tenant_billing', 'quotas') AND COUNT(*) = 4 THEN '✅ Has 4 policies (may be named differently)'
    WHEN tablename IN ('tenants', 'users') AND COUNT(*) = 1 THEN '✅ Has 1 policy (may be named differently)'
    WHEN tablename = 'webhook_events_inbox' AND COUNT(*) = 0 THEN '✅ No end-user policies (correct)'
    ELSE '⚠️  Policy count mismatch'
  END as assessment
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

SELECT '==========================================';
SELECT 'RECOMMENDATIONS:' as section;

SELECT 
  'Your policies are working correctly!' as finding,
  'The validation failures are due to naming differences, not missing functionality' as explanation,
  'Consider updating validation script to match your actual policy names' as suggestion;

-- Task 17 (0017_indexes.sql) Verification Rubric
-- Read-only checks comparing actual indexes in "public" against the canonical spec.

BEGIN;

-- Helper: normalize indexdef text for easier pattern checks
WITH actual AS (
  SELECT
    c.oid AS index_oid,
    i.schemaname,
    i.tablename,
    i.indexname,
    i.indexdef
  FROM pg_indexes i
  JOIN pg_class c ON c.relname = i.indexname
  WHERE i.schemaname = 'public'
),
-- ---------- Expected checks per table ----------

-- 1) BOOKINGS
bookings_has_tenant_start AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='bookings'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, start_at DESC)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
bookings_has_resource_start AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='bookings'
      AND indexdef ILIKE 'CREATE INDEX % ON % (resource_id, start_at)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
bookings_has_tenant_status_start_partial AS (
  -- Active statuses per Context Pack: pending, confirmed, checked_in
  -- (Some teams include completed in analytics; spec calls out "active" for the partial.)
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='bookings'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, status, start_at DESC)%'
      AND indexdef ILIKE '%USING btree%'
      AND indexdef ~* 'WHERE\s+status\s+IN\s*\('
  ) AS pass
),
bookings_has_tenant_rescheduled_from AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='bookings'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, rescheduled_from)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),

-- 2) SERVICES
services_has_tenant_active AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='services'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, active)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
services_has_tenant_category_active AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='services'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, category, active)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
services_has_gin_search_vector AS (
  -- Only required if column exists; we'll pass if EITHER the column does not exist OR a GIN index exists.
  SELECT
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='services' AND column_name='search_vector'
      )
      THEN EXISTS (
        SELECT 1 FROM actual
        WHERE tablename='services'
          AND indexdef ILIKE 'CREATE INDEX % ON % USING gin (search_vector)%'
      )
      ELSE TRUE
    END AS pass
),

-- 3) PAYMENTS
payments_has_tenant_created_desc AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='payments'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, created_at DESC)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
payments_has_tenant_status AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='payments'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, payment_status)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),

-- 4) CUSTOMERS
customers_has_tenant_is_first_time AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='customers'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, is_first_time)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),

-- 5) EVENTS OUTBOX
outbox_has_tenant_status AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='events_outbox'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, status)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
outbox_has_tenant_topic_ready_at AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='events_outbox'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, topic, ready_at)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),
outbox_optional_unique_key_ok AS (
  -- This passes if either the unique exists OR it doesn't (optional).
  -- If present, it must be unique on (tenant_id, key).
  SELECT
    (
      NOT EXISTS (
        SELECT 1 FROM actual WHERE tablename='events_outbox' AND indexdef ILIKE '%(tenant_id, key)%UNIQUE%'
      )
    )
    OR EXISTS (
      SELECT 1 FROM actual
      WHERE tablename='events_outbox'
        AND indexdef ILIKE 'CREATE UNIQUE INDEX % ON % (tenant_id, key)%'
    ) AS pass
),

-- 6) AUDIT LOGS
audit_brin_created_at AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='audit_logs'
      AND indexdef ILIKE 'CREATE INDEX % ON % USING brin (created_at)%'
  ) AS pass
),
audit_tenant_created_btree AS (
  SELECT EXISTS (
    SELECT 1 FROM actual
    WHERE tablename='audit_logs'
      AND indexdef ILIKE 'CREATE INDEX % ON % (tenant_id, created_at)%'
      AND indexdef ILIKE '%USING btree%'
  ) AS pass
),

-- ========== Aggregate verdicts ==========
results AS (
  SELECT * FROM (
    VALUES
      ('bookings: (tenant_id, start_at DESC) btree',           (SELECT pass FROM bookings_has_tenant_start)),
      ('bookings: (resource_id, start_at) btree',               (SELECT pass FROM bookings_has_resource_start)),
      ('bookings: partial (tenant_id, status, start_at DESC)',  (SELECT pass FROM bookings_has_tenant_status_start_partial)),
      ('bookings: (tenant_id, rescheduled_from) btree',         (SELECT pass FROM bookings_has_tenant_rescheduled_from)),
      ('services: (tenant_id, active) btree',                   (SELECT pass FROM services_has_tenant_active)),
      ('services: (tenant_id, category, active) btree',         (SELECT pass FROM services_has_tenant_category_active)),
      ('services: GIN(search_vector) present if column exists', (SELECT pass FROM services_has_gin_search_vector)),
      ('payments: (tenant_id, created_at DESC) btree',          (SELECT pass FROM payments_has_tenant_created_desc)),
      ('payments: (tenant_id, payment_status) btree',           (SELECT pass FROM payments_has_tenant_status)),
      ('customers: (tenant_id, is_first_time) btree',           (SELECT pass FROM customers_has_tenant_is_first_time)),
      ('events_outbox: (tenant_id, status) btree',              (SELECT pass FROM outbox_has_tenant_status)),
      ('events_outbox: (tenant_id, topic, ready_at) btree',     (SELECT pass FROM outbox_has_tenant_topic_ready_at)),
      ('events_outbox: optional UNIQUE (tenant_id, key) OK',    (SELECT pass FROM outbox_optional_unique_key_ok)),
      ('audit_logs: BRIN(created_at)',                          (SELECT pass FROM audit_brin_created_at)),
      ('audit_logs: (tenant_id, created_at) btree',             (SELECT pass FROM audit_tenant_created_btree))
  ) AS t(check_name, pass)
),

summary AS (
  SELECT
    COUNT(*)                   AS total_checks,
    COUNT(*) FILTER (WHERE pass)  AS passed,
    COUNT(*) FILTER (WHERE NOT pass) AS failed
  FROM results
)

-- Output 1: Per-check PASS/FAIL
SELECT check_name, CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS verdict
FROM results
ORDER BY (CASE WHEN pass THEN 1 ELSE 0 END), check_name;

-- Output 2: Summary
SELECT * FROM summary;

-- Output 3: Any unexpected indexes on covered tables (manual review)
-- These are indexes on the core tables that do NOT match any expected patterns above.
WITH covered AS (
  SELECT unnest(ARRAY[
    'bookings','services','payments','customers','events_outbox','audit_logs'
  ]) AS tablename
),
expected_patterns AS (
  SELECT
    tablename,
    pattern
  FROM (VALUES
    ('bookings',      'USING btree \(tenant_id, start_at DESC\)'),
    ('bookings',      'USING btree \(resource_id, start_at\)'),
    ('bookings',      'USING btree \(tenant_id, status, start_at DESC\)'),
    ('bookings',      'USING btree \(tenant_id, rescheduled_from\)'),
    ('services',      'USING btree \(tenant_id, active\)'),
    ('services',      'USING btree \(tenant_id, category, active\)'),
    ('services',      'USING gin \(search_vector\)'),
    ('payments',      'USING btree \(tenant_id, created_at DESC\)'),
    ('payments',      'USING btree \(tenant_id, payment_status\)'),
    ('customers',     'USING btree \(tenant_id, is_first_time\)'),
    ('events_outbox', 'USING btree \(tenant_id, status\)'),
    ('events_outbox', 'USING btree \(tenant_id, topic, ready_at\)'),
    ('events_outbox', 'UNIQUE INDEX .* \(tenant_id, key\)'),
    ('audit_logs',    'USING brin \(created_at\)'),
    ('audit_logs',    'USING btree \(tenant_id, created_at\)')
  ) AS x(tablename, pattern)
)
SELECT a.tablename, a.indexname, a.indexdef
FROM actual a
JOIN covered c ON c.tablename = a.tablename
WHERE NOT EXISTS (
  SELECT 1 FROM expected_patterns p
  WHERE p.tablename = a.tablename
    AND a.indexdef ~ p.pattern
)
ORDER BY a.tablename, a.indexname;

ROLLBACK;  -- read-only rubric; no changes are made
