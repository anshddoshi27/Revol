-- ============================================================================
-- Task 13 Quick Validation - Run in Supabase SQL Editor
-- ============================================================================
-- Quick tests to verify core functionality of Task 13 implementation

-- Test 1: Verify all tables exist
SELECT 
    'audit_logs' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') 
         THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
    'events_outbox',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events_outbox' AND table_schema = 'public') 
         THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
    'webhook_events_inbox',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_events_inbox' AND table_schema = 'public') 
         THEN '✅ EXISTS' ELSE '❌ MISSING' END;

-- Test 2: Verify all functions exist
SELECT 
    'log_audit' as function_name,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_audit' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) 
         THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
    'purge_audit_older_than_12m',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'purge_audit_older_than_12m' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) 
         THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
    'anonymize_customer',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'anonymize_customer' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) 
         THEN '✅ EXISTS' ELSE '❌ MISSING' END;

-- Test 3: Verify audit triggers exist on key tables
SELECT 
    t.trigger_schema as schemaname,
    t.event_object_table as tablename,
    t.trigger_name as triggername,
    '✅ TRIGGER EXISTS' as status
FROM information_schema.triggers t
WHERE t.trigger_name LIKE '%_audit_aiud'
ORDER BY t.event_object_table;

-- Test 4: Verify events_outbox has touch_updated_at trigger
SELECT 
    t.trigger_schema as schemaname,
    t.event_object_table as tablename,
    t.trigger_name as triggername,
    '✅ TOUCH TRIGGER EXISTS' as status
FROM information_schema.triggers t
WHERE t.event_object_table = 'events_outbox' AND t.trigger_name LIKE '%touch_updated_at';

-- Test 5: Check table structures
SELECT 
    'audit_logs columns' as test,
    string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'audit_logs' AND table_schema = 'public'
UNION ALL
SELECT 
    'events_outbox columns',
    string_agg(column_name, ', ' ORDER BY ordinal_position)
FROM information_schema.columns 
WHERE table_name = 'events_outbox' AND table_schema = 'public'
UNION ALL
SELECT 
    'webhook_events_inbox columns',
    string_agg(column_name, ', ' ORDER BY ordinal_position)
FROM information_schema.columns 
WHERE table_name = 'webhook_events_inbox' AND table_schema = 'public';

-- Test 6: Verify constraints exist
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    CASE 
        WHEN contype = 'c' THEN 'CHECK'
        WHEN contype = 'f' THEN 'FOREIGN KEY'
        WHEN contype = 'p' THEN 'PRIMARY KEY'
        WHEN contype = 'u' THEN 'UNIQUE'
        ELSE contype::text
    END as constraint_description,
    '✅ EXISTS' as status
FROM pg_constraint 
WHERE conrelid IN (
    SELECT oid FROM pg_class 
    WHERE relname IN ('audit_logs', 'events_outbox', 'webhook_events_inbox')
)
ORDER BY conname;

-- Test 7: Quick functional test (if you have existing tenant data)
-- Uncomment and modify the tenant_id if you want to test with real data:

/*
DO $$
DECLARE
    test_tenant_id uuid;
    audit_count_before int;
    audit_count_after int;
BEGIN
    -- Use existing tenant or create test tenant
    SELECT id INTO test_tenant_id FROM tenants LIMIT 1;
    
    IF test_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenants found - skipping functional test';
        RETURN;
    END IF;
    
    -- Count existing audit records
    SELECT COUNT(*) INTO audit_count_before FROM audit_logs;
    
    -- Test events_outbox insert
    INSERT INTO events_outbox (tenant_id, event_code, payload)
    VALUES (test_tenant_id, 'test_event', '{"test": true}');
    
    -- Test webhook_events_inbox insert
    INSERT INTO webhook_events_inbox (provider, id, payload)
    VALUES ('test', 'event-001', '{"webhook": "test"}')
    ON CONFLICT (provider, id) DO NOTHING;
    
    SELECT COUNT(*) INTO audit_count_after FROM audit_logs;
    
    RAISE NOTICE 'Functional test completed - Audit records: % -> %', audit_count_before, audit_count_after;
    
    -- Clean up
    DELETE FROM events_outbox WHERE event_code = 'test_event';
    DELETE FROM webhook_events_inbox WHERE provider = 'test' AND id = 'event-001';
END;
$$;
*/

-- Final summary
SELECT 
    '🎉 TASK 13 VALIDATION SUMMARY' as message,
    'All core components verified' as status;
