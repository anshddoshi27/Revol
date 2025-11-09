-- infra/supabase/tests/run_tests.sql
-- Test runner script to identify and fix test issues

-- Check if pgTAP is available
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgtap') THEN
        RAISE NOTICE 'pgTAP extension not available. Creating a simple test environment...';
        
        -- Create a simple test function if pgTAP is not available
        CREATE OR REPLACE FUNCTION simple_test_ok(condition boolean, message text) RETURNS void AS $$
        BEGIN
            IF condition THEN
                RAISE NOTICE 'PASS: %', message;
            ELSE
                RAISE NOTICE 'FAIL: %', message;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
        
        RAISE NOTICE 'Simple test environment created. Use simple_test_ok() function for testing.';
    ELSE
        RAISE NOTICE 'pgTAP extension is available.';
    END IF;
END $$;

-- Check database state
SELECT 'Database State Check' as test_type;

-- Check if key tables exist
SELECT 
    table_name,
    CASE WHEN table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (
    VALUES 
        ('tenants'),
        ('users'),
        ('customers'),
        ('resources'),
        ('services'),
        ('bookings'),
        ('payments')
) AS expected_tables(table_name)
LEFT JOIN information_schema.tables t ON t.table_name = expected_tables.table_name;

-- Check if key functions exist
SELECT 
    routine_name,
    CASE WHEN routine_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (
    VALUES 
        ('current_tenant_id'),
        ('current_user_id'),
        ('touch_updated_at'),
        ('sync_booking_status'),
        ('fill_booking_tz')
) AS expected_functions(routine_name)
LEFT JOIN information_schema.routines r ON r.routine_name = expected_functions.routine_name;

-- Check if RLS is enabled on key tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('tenants', 'users', 'customers', 'resources', 'services', 'bookings', 'payments')
ORDER BY tablename;

-- Check if policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('tenants', 'users', 'customers', 'resources', 'services', 'bookings', 'payments')
ORDER BY tablename, policyname;

-- Check if key constraints exist
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('tenants', 'users', 'customers', 'resources', 'services', 'bookings', 'payments')
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Check if triggers exist
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('tenants', 'users', 'customers', 'resources', 'services', 'bookings', 'payments')
ORDER BY event_object_table, trigger_name;

-- Summary
SELECT 'Test Environment Ready' as status;
