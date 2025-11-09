-- TITHI DB — TASK 14 SIMPLE CHECK: "Enable RLS on all tables"
-- Purpose: Quick verification that all expected tables have RLS enabled
-- Compatible with Supabase SQL Editor

-- List all public tables and their RLS status
SELECT 
  schemaname,
  tablename,    
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS ON'
    ELSE '❌ RLS OFF'
  END as status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Count summary
SELECT 
  'SUMMARY' as section,
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE rowsecurity) as rls_enabled_count,
  COUNT(*) FILTER (WHERE NOT rowsecurity) as rls_disabled_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE NOT rowsecurity) = 0 THEN '✅ ALL GOOD'
    ELSE '❌ SOME TABLES MISSING RLS'
  END as overall_status
FROM pg_tables 
WHERE schemaname = 'public';

-- Check for specific expected tables
SELECT 
  'EXPECTED TABLES CHECK' as section,
  table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name 
      AND rowsecurity = true
    ) THEN '✅ EXISTS WITH RLS'
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = table_name 
      AND rowsecurity = false
    ) THEN '❌ EXISTS BUT NO RLS'
    ELSE '❌ MISSING TABLE'
  END as status
FROM (VALUES 
  ('tenants'), ('users'), ('memberships'), ('themes'),
  ('customers'), ('resources'), ('customer_metrics'),
  ('services'), ('service_resources'),
  ('availability_rules'), ('availability_exceptions'),
  ('bookings'), ('booking_items'),
  ('payments'), ('tenant_billing'),
  ('coupons'), ('gift_cards'), ('referrals'),
  ('notification_event_type'), ('notification_templates'), ('notifications'),
  ('usage_counters'), ('quotas'),
  ('audit_logs'), ('events_outbox'), ('webhook_events_inbox')
) AS expected_tables(table_name)
ORDER BY table_name;
