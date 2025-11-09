-- =================================================================
-- Task 15 Quick Validation Check  
-- Simple pass/fail validation for Task 15 compliance
-- Run this to get immediate feedback on Task 15 status
-- =================================================================

-- Check 1: Helper functions exist
WITH helper_check AS (
  SELECT 
    EXISTS(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace  
      WHERE n.nspname = 'public' 
        AND p.proname = 'current_tenant_id'
        AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
    ) as has_current_tenant_id,
    EXISTS(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'current_user_id' 
        AND pg_catalog.format_type(p.prorettype, NULL) = 'uuid'
    ) as has_current_user_id
)
SELECT 
  '1. Helper Functions' as check_name,
  CASE 
    WHEN has_current_tenant_id AND has_current_user_id THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  CASE
    WHEN NOT has_current_tenant_id THEN 'Missing current_tenant_id()'
    WHEN NOT has_current_user_id THEN 'Missing current_user_id()'
    ELSE 'Both helper functions exist'
  END as details
FROM helper_check;

-- Check 2: All tenant-scoped tables have RLS enabled
WITH rls_check AS (
  SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
      'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
      'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
      'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
    )
)
SELECT 
  '2. RLS Enabled' as check_name,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE rls_enabled) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE rls_enabled) THEN 
      'RLS enabled on all ' || COUNT(*) || ' tables'
    ELSE 
      'RLS missing on ' || (COUNT(*) - COUNT(*) FILTER (WHERE rls_enabled)) || ' tables'
  END as details
FROM rls_check;

-- Check 3: All tables have exactly 4 policies (SELECT/INSERT/UPDATE/DELETE)
WITH policy_check AS (
  SELECT 
    table_name,
    COALESCE(sel_count, 0) as sel_count,
    COALESCE(ins_count, 0) as ins_count, 
    COALESCE(upd_count, 0) as upd_count,
    COALESCE(del_count, 0) as del_count
  FROM (
    SELECT unnest(ARRAY[
      'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
      'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
      'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates', 
      'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
    ]) as table_name
  ) expected_tables
  LEFT JOIN (
    SELECT 
      p.tablename,
      count(*) FILTER (WHERE p.cmd = 'SELECT') as sel_count,
      count(*) FILTER (WHERE p.cmd = 'INSERT') as ins_count,
      count(*) FILTER (WHERE p.cmd = 'UPDATE') as upd_count, 
      count(*) FILTER (WHERE p.cmd = 'DELETE') as del_count
    FROM pg_policies p
    WHERE p.schemaname = 'public'
    GROUP BY p.tablename
  ) actual_policies ON expected_tables.table_name = actual_policies.tablename
)
SELECT 
  '3. Policy Count' as check_name,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE 
      sel_count = 1 AND ins_count = 1 AND upd_count = 1 AND del_count = 1
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE 
      sel_count = 1 AND ins_count = 1 AND upd_count = 1 AND del_count = 1
    ) THEN 
      'All ' || COUNT(*) || ' tables have 4 policies each'
    ELSE
      (COUNT(*) - COUNT(*) FILTER (WHERE 
        sel_count = 1 AND ins_count = 1 AND upd_count = 1 AND del_count = 1
      )) || ' tables missing or have incorrect policy counts'
  END as details
FROM policy_check;

-- Check 4: All policies use correct tenant_id predicate
WITH predicate_check AS (
  SELECT 
    p.tablename,
    p.cmd,
    CASE WHEN p.cmd = 'SELECT' THEN
      p.qual ~* 'tenant_id.*current_tenant_id'
    WHEN p.cmd = 'INSERT' THEN
      p.with_check ~* 'tenant_id.*current_tenant_id'
    WHEN p.cmd = 'UPDATE' THEN  
      (p.qual ~* 'tenant_id.*current_tenant_id' AND
       p.with_check ~* 'tenant_id.*current_tenant_id')
    WHEN p.cmd = 'DELETE' THEN
      p.qual ~* 'tenant_id.*current_tenant_id'
    ELSE false
    END as predicate_correct
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN (
      'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
      'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
      'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
      'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
    )
)
SELECT 
  '4. Policy Predicates' as check_name,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE predicate_correct) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE predicate_correct) THEN
      'All ' || COUNT(*) || ' policies use correct tenant_id predicates'
    ELSE
      (COUNT(*) - COUNT(*) FILTER (WHERE predicate_correct)) || ' policies have incorrect predicates'
  END as details
FROM predicate_check;

-- Check 5: Policy naming convention
WITH naming_check AS (
  SELECT 
    p.tablename,
    p.cmd,
    p.policyname,
    CASE p.cmd
      WHEN 'SELECT' THEN p.tablename || '_sel'
      WHEN 'INSERT' THEN p.tablename || '_ins'  
      WHEN 'UPDATE' THEN p.tablename || '_upd'
      WHEN 'DELETE' THEN p.tablename || '_del'
    END as expected_name,
    p.policyname = (
      CASE p.cmd
        WHEN 'SELECT' THEN p.tablename || '_sel'
        WHEN 'INSERT' THEN p.tablename || '_ins'
        WHEN 'UPDATE' THEN p.tablename || '_upd' 
        WHEN 'DELETE' THEN p.tablename || '_del'
      END
    ) as name_correct
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN (
      'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
      'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
      'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
      'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
    )
)
SELECT 
  '5. Policy Naming' as check_name,
  CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE name_correct) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  CASE
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE name_correct) THEN
      'All ' || COUNT(*) || ' policies follow naming convention'
    ELSE  
      (COUNT(*) - COUNT(*) FILTER (WHERE name_correct)) || ' policies have incorrect names'
  END as details
FROM naming_check;

-- OVERALL SUMMARY
SELECT 
  '🎯 OVERALL RESULT' as check_name,
  CASE 
    WHEN (
      -- All helper functions exist
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace  
             WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id') AND
      EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'current_user_id') AND
      
      -- All tables have RLS enabled  
      (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
         AND c.relname IN (
           'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
           'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
           'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
           'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
         )) = 18 AND
         
      -- All tables have correct policy counts
      (SELECT COUNT(*)
       FROM (
         SELECT p.tablename,
                count(*) FILTER (WHERE p.cmd = 'SELECT') as sel_count,
                count(*) FILTER (WHERE p.cmd = 'INSERT') as ins_count,
                count(*) FILTER (WHERE p.cmd = 'UPDATE') as upd_count,
                count(*) FILTER (WHERE p.cmd = 'DELETE') as del_count
         FROM pg_policies p
         WHERE p.schemaname = 'public' 
           AND p.tablename IN (
             'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
             'availability_rules', 'availability_exceptions', 'bookings', 'booking_items', 
             'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
             'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
           )
         GROUP BY p.tablename
       ) policy_counts
       WHERE sel_count = 1 AND ins_count = 1 AND upd_count = 1 AND del_count = 1) = 18
    ) THEN '🎉 TASK 15 FULLY COMPLIANT!'
    ELSE '⚠️ TASK 15 HAS ISSUES'
  END as status,
  'Task 15 creates standard tenant-scoped policies for all tenant tables' as description;

-- Show any specific issues for debugging
SELECT '🔍 DETAILED ISSUES (if any):' as debug_section;

-- Tables missing policies
SELECT 
  'Missing policies on: ' || table_name as issue,
  'Expected 4 policies, found ' || 
  (COALESCE(sel_count,0) + COALESCE(ins_count,0) + COALESCE(upd_count,0) + COALESCE(del_count,0)) as details
FROM (
  SELECT 
    expected.table_name,
    pc.sel_count, pc.ins_count, pc.upd_count, pc.del_count
  FROM (
    SELECT unnest(ARRAY[
      'customers', 'resources', 'customer_metrics', 'services', 'service_resources',
      'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
      'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
      'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
    ]) as table_name
  ) expected
  LEFT JOIN (
    SELECT 
      p.tablename,
      count(*) FILTER (WHERE p.cmd = 'SELECT') as sel_count,
      count(*) FILTER (WHERE p.cmd = 'INSERT') as ins_count,
      count(*) FILTER (WHERE p.cmd = 'UPDATE') as upd_count,
      count(*) FILTER (WHERE p.cmd = 'DELETE') as del_count
    FROM pg_policies p  
    WHERE p.schemaname = 'public'
    GROUP BY p.tablename
  ) pc ON expected.table_name = pc.tablename
) policy_analysis  
WHERE NOT (COALESCE(sel_count,0) = 1 AND COALESCE(ins_count,0) = 1 AND 
           COALESCE(upd_count,0) = 1 AND COALESCE(del_count,0) = 1);

-- If no issues found
SELECT 'No policy issues found' as issue, 'All tables have correct policies' as details
WHERE NOT EXISTS (
  SELECT 1 FROM (
    SELECT 
      expected.table_name,
      pc.sel_count, pc.ins_count, pc.upd_count, pc.del_count
    FROM (
      SELECT unnest(ARRAY[
        'customers', 'resources', 'customer_metrics', 'services', 'service_resources', 
        'availability_rules', 'availability_exceptions', 'bookings', 'booking_items',
        'payments', 'coupons', 'gift_cards', 'referrals', 'notification_templates',
        'notifications', 'usage_counters', 'audit_logs', 'events_outbox'
      ]) as table_name
    ) expected
    LEFT JOIN (
      SELECT 
        p.tablename,
        count(*) FILTER (WHERE p.cmd = 'SELECT') as sel_count,
        count(*) FILTER (WHERE p.cmd = 'INSERT') as ins_count, 
        count(*) FILTER (WHERE p.cmd = 'UPDATE') as upd_count,
        count(*) FILTER (WHERE p.cmd = 'DELETE') as del_count
      FROM pg_policies p
      WHERE p.schemaname = 'public'
      GROUP BY p.tablename
    ) pc ON expected.table_name = pc.tablename
  ) policy_analysis
  WHERE NOT (COALESCE(sel_count,0) = 1 AND COALESCE(ins_count,0) = 1 AND
             COALESCE(upd_count,0) = 1 AND COALESCE(del_count,0) = 1)
);
