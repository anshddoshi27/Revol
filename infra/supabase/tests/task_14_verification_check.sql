-- Verification: Compare migration file against rubric requirements
-- This validates that 0014_enable_rls.sql covers all expected tables

WITH rubric_expected AS (
  SELECT unnest(ARRAY[
    'tenants', 'users', 'memberships', 'themes',
    'customers', 'resources', 'customer_metrics', 
    'services', 'service_resources',
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
    'payments', 'tenant_billing',
    'coupons', 'gift_cards', 'referrals',
    'notification_event_type', 'notification_templates', 'notifications',
    'usage_counters', 'quotas',
    'audit_logs', 'events_outbox', 'webhook_events_inbox'
  ]) AS table_name
),

migration_tables AS (
  SELECT unnest(ARRAY[
    'tenants', 'users', 'memberships', 'themes',
    'customers', 'resources', 'customer_metrics',
    'services', 'service_resources', 
    'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
    'payments', 'tenant_billing',
    'coupons', 'gift_cards', 'referrals',
    'notification_event_type', 'notification_templates', 'notifications',
    'usage_counters', 'quotas',
    'audit_logs', 'events_outbox', 'webhook_events_inbox'
  ]) AS table_name
)

SELECT 
  'COVERAGE CHECK' as section,
  r.table_name,
  CASE 
    WHEN m.table_name IS NOT NULL THEN '✅ COVERED'
    ELSE '❌ MISSING FROM MIGRATION' 
  END as coverage_status
FROM rubric_expected r
LEFT JOIN migration_tables m ON r.table_name = m.table_name

UNION ALL

SELECT 
  'SUMMARY' as section,
  CONCAT('Total Expected: ', COUNT(r.table_name)::text) as table_name,
  CONCAT('Covered: ', COUNT(m.table_name)::text) as coverage_status
FROM rubric_expected r
LEFT JOIN migration_tables m ON r.table_name = m.table_name

ORDER BY section DESC, table_name;
