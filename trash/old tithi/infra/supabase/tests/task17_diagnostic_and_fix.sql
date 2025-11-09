-- =============================================================================
-- Task 17 Diagnostic and Fix Script
-- =============================================================================
-- This script diagnoses the current database state and fixes any missing
-- indexes that should have been created by the 0017_indexes.sql migration.

BEGIN;

SELECT '================================================================';
SELECT 'TASK 17 DIAGNOSTIC AND FIX SCRIPT';
SELECT '================================================================';

-- =============================================================================
-- Diagnostic Phase 1: Check Current Database State
-- =============================================================================

SELECT 'Phase 1: Database State Analysis' as diagnostic_phase;

-- Check if audit_logs table exists
DO $$
DECLARE
    audit_table_exists BOOLEAN;
    audit_indexes_count INTEGER;
    brin_index_exists BOOLEAN;
    btree_index_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Checking audit_logs table and index status...';
    
    -- Check if audit_logs table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'audit_logs' 
        AND table_schema = 'public'
    ) INTO audit_table_exists;
    
    IF audit_table_exists THEN
        RAISE NOTICE '✅ audit_logs table exists';
        
        -- Count existing indexes on audit_logs
        SELECT COUNT(*) INTO audit_indexes_count
        FROM pg_indexes 
        WHERE tablename = 'audit_logs';
        
        RAISE NOTICE 'Found % existing indexes on audit_logs table', audit_indexes_count;
        
        -- Check for BRIN index
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'audit_logs' 
            AND indexdef LIKE '%BRIN%' 
            AND indexdef LIKE '%created_at%'
        ) INTO brin_index_exists;
        
        -- Check for BTREE index
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'audit_logs' 
            AND indexdef LIKE '%tenant_id%' 
            AND indexdef LIKE '%created_at%'
            AND indexdef NOT LIKE '%BRIN%'
        ) INTO btree_index_exists;
        
        IF brin_index_exists THEN
            RAISE NOTICE '✅ BRIN index on audit_logs.created_at exists';
        ELSE
            RAISE NOTICE '❌ BRIN index on audit_logs.created_at is missing';
        END IF;
        
        IF btree_index_exists THEN
            RAISE NOTICE '✅ BTREE index on audit_logs(tenant_id, created_at) exists';
        ELSE
            RAISE NOTICE '❌ BTREE index on audit_logs(tenant_id, created_at) is missing';
        END IF;
        
    ELSE
        RAISE NOTICE '❌ audit_logs table does not exist - check if 0013_audit_logs.sql was applied';
    END IF;
END $$;

-- Check migration status
DO $$
DECLARE
    migration_count INTEGER;
    last_migration TEXT;
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    table_name TEXT;
    table_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Checking migration status...';
    
    -- Count tables that should exist after all migrations
    SELECT COUNT(*) INTO migration_count
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name IN (
        'tenants', 'users', 'memberships', 'customers', 'resources', 'services',
        'bookings', 'payments', 'events_outbox', 'audit_logs', 'notifications'
    );
    
    RAISE NOTICE 'Found % of 11 expected core tables', migration_count;
    
    -- Check specific missing tables
    FOR table_name IN 
        VALUES ('tenants'), ('users'), ('memberships'), ('customers'), ('resources'), 
               ('services'), ('bookings'), ('payments'), ('events_outbox'), ('audit_logs'), ('notifications')
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = table_name 
            AND table_schema = 'public'
        ) INTO table_exists;
        
        IF NOT table_exists THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) IS NULL THEN
        RAISE NOTICE '✅ All expected tables exist';
    ELSE
        RAISE NOTICE '❌ Missing tables: %', array_to_string(missing_tables, ', ');
        RAISE NOTICE '⚠️  This suggests migrations 0001-0017 may not be complete';
    END IF;
END $$;

-- =============================================================================
-- Diagnostic Phase 2: Check Index Creation Capabilities
-- =============================================================================

SELECT 'Phase 2: Index Creation Capability Check' as diagnostic_phase;

-- Check if we can create indexes
DO $$
DECLARE
    can_create_index BOOLEAN := false;
    test_index_name TEXT := 'test_index_capability_' || extract(epoch from now())::TEXT;
BEGIN
    RAISE NOTICE 'Testing index creation capability...';
    
    BEGIN
        -- Try to create a simple test index
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON pg_catalog.pg_class (oid)', test_index_name);
        can_create_index := true;
        
        -- Clean up test index
        EXECUTE format('DROP INDEX IF EXISTS %I', test_index_name);
        
        RAISE NOTICE '✅ Index creation capability confirmed';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '❌ Index creation failed: %', SQLERRM;
            can_create_index := false;
    END;
    
    IF can_create_index THEN
        RAISE NOTICE '✅ Database has permission to create indexes';
    ELSE
        RAISE NOTICE '❌ Database lacks permission to create indexes';
    END IF;
END $$;

-- =============================================================================
-- Fix Phase 1: Create Missing audit_logs Indexes
-- =============================================================================

SELECT 'Fix Phase 1: Creating Missing audit_logs Indexes' as fix_phase;

-- Create missing BRIN index on audit_logs.created_at
DO $$
DECLARE
    brin_index_exists BOOLEAN;
    index_created BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Attempting to create missing BRIN index on audit_logs.created_at...';
    
    -- Check if index already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%BRIN%' 
        AND indexdef LIKE '%created_at%'
    ) INTO brin_index_exists;
    
    IF brin_index_exists THEN
        RAISE NOTICE '✅ BRIN index already exists - no action needed';
    ELSE
        BEGIN
            -- Try to create the BRIN index
            CREATE INDEX IF NOT EXISTS audit_logs_brin_created_at_idx 
            ON audit_logs USING BRIN (created_at);
            
            index_created := true;
            RAISE NOTICE '✅ BRIN index created successfully';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create BRIN index: %', SQLERRM;
                RAISE NOTICE '⚠️  This may indicate the table structure is not as expected';
        END;
    END IF;
END $$;

-- Create missing BTREE index on audit_logs(tenant_id, created_at)
DO $$
DECLARE
    btree_index_exists BOOLEAN;
    index_created BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Attempting to create missing BTREE index on audit_logs(tenant_id, created_at)...';
    
    -- Check if index already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%created_at%'
        AND indexdef NOT LIKE '%BRIN%'
    ) INTO btree_index_exists;
    
    IF btree_index_exists THEN
        RAISE NOTICE '✅ BTREE index already exists - no action needed';
    ELSE
        BEGIN
            -- Try to create the BTREE index
            CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx 
            ON audit_logs (tenant_id, created_at);
            
            index_created := true;
            RAISE NOTICE '✅ BTREE index created successfully';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Failed to create BTREE index: %', SQLERRM;
                RAISE NOTICE '⚠️  This may indicate the table structure is not as expected';
        END;
    END IF;
END $$;

-- =============================================================================
-- Fix Phase 2: Create Other Missing Indexes from 0017
-- =============================================================================

SELECT 'Fix Phase 2: Creating Other Missing Indexes' as fix_phase;

-- Create missing indexes for other tables
DO $$
DECLARE
    index_name TEXT;
    index_def TEXT;
    index_created BOOLEAN;
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    created_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Checking and creating other missing indexes from 0017...';
    
    -- Define required indexes from 0017
    FOR index_name, index_def IN 
        VALUES 
            ('tenants_created_idx', 'CREATE INDEX IF NOT EXISTS tenants_created_idx ON tenants (created_at)'),
            ('users_created_idx', 'CREATE INDEX IF NOT EXISTS users_created_idx ON users (created_at)'),
            ('memberships_tenant_created_idx', 'CREATE INDEX IF NOT EXISTS memberships_tenant_created_idx ON memberships (tenant_id, created_at)'),
            ('customers_tenant_created_idx', 'CREATE INDEX IF NOT EXISTS customers_tenant_created_idx ON customers (tenant_id, created_at)'),
            ('resources_tenant_created_idx', 'CREATE INDEX IF NOT EXISTS resources_tenant_created_idx ON resources (tenant_id, created_at)'),
            ('services_tenant_created_idx', 'CREATE INDEX IF NOT EXISTS services_tenant_created_idx ON services (tenant_id, created_at)'),
            ('bookings_tenant_start_desc_idx', 'CREATE INDEX IF NOT EXISTS bookings_tenant_start_desc_idx ON bookings (tenant_id, start_at DESC)'),
            ('bookings_resource_start_idx', 'CREATE INDEX IF NOT EXISTS bookings_resource_start_idx ON bookings (resource_id, start_at)'),
            ('bookings_tenant_status_start_desc_idx', 'CREATE INDEX IF NOT EXISTS bookings_tenant_status_start_desc_idx ON bookings (tenant_id, status, start_at DESC) WHERE status IN (''pending'', ''confirmed'', ''checked_in'')'),
            ('bookings_tenant_rescheduled_from_idx', 'CREATE INDEX IF NOT EXISTS bookings_tenant_rescheduled_from_idx ON bookings (tenant_id, rescheduled_from) WHERE rescheduled_from IS NOT NULL'),
            ('services_tenant_active_idx', 'CREATE INDEX IF NOT EXISTS services_tenant_active_idx ON services (tenant_id, active)'),
            ('services_tenant_category_active_idx', 'CREATE INDEX IF NOT EXISTS services_tenant_category_active_idx ON services (tenant_id, category, active) WHERE active = true AND category IS NOT NULL AND category != '''''),
            ('payments_tenant_created_desc_idx', 'CREATE INDEX IF NOT EXISTS payments_tenant_created_desc_idx ON payments (tenant_id, created_at DESC)'),
            ('payments_tenant_payment_status_idx', 'CREATE INDEX IF NOT EXISTS payments_tenant_payment_status_idx ON payments (tenant_id, status)'),
            ('customers_tenant_is_first_time_idx', 'CREATE INDEX IF NOT EXISTS customers_tenant_is_first_time_idx ON customers (tenant_id, is_first_time)'),
            ('events_outbox_tenant_status_idx', 'CREATE INDEX IF NOT EXISTS events_outbox_tenant_status_idx ON events_outbox (tenant_id, status)'),
            ('events_outbox_tenant_event_ready_idx', 'CREATE INDEX IF NOT EXISTS events_outbox_tenant_event_ready_idx ON events_outbox (tenant_id, event_code, ready_at) WHERE status = ''ready'''),
            ('notifications_tenant_scheduled_idx', 'CREATE INDEX IF NOT EXISTS notifications_tenant_scheduled_idx ON notifications (tenant_id, scheduled_at) WHERE status = ''queued''')
    LOOP
        BEGIN
            -- Check if index exists
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = index_name
            ) THEN
                -- Try to create the index
                EXECUTE index_def;
                created_count := created_count + 1;
                RAISE NOTICE '✅ Created missing index: %', index_name;
            ELSE
                RAISE NOTICE '✅ Index already exists: %', index_name;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                missing_indexes := array_append(missing_indexes, index_name);
                RAISE NOTICE '❌ Failed to create index %: %', index_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Index creation summary: % new indexes created', created_count;
    
    IF array_length(missing_indexes, 1) IS NOT NULL THEN
        RAISE NOTICE '⚠️  Failed to create indexes: %', array_to_string(missing_indexes, ', ');
    END IF;
END $$;

-- =============================================================================
-- Verification Phase: Confirm All Indexes Exist
-- =============================================================================

SELECT 'Verification Phase: Confirming All Indexes Exist' as verification_phase;

-- Final verification of audit_logs indexes
DO $$
DECLARE
    brin_index_exists BOOLEAN;
    btree_index_exists BOOLEAN;
    total_indexes INTEGER;
BEGIN
    RAISE NOTICE 'Final verification of audit_logs indexes...';
    
    -- Check BRIN index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%BRIN%' 
        AND indexdef LIKE '%created_at%'
    ) INTO brin_index_exists;
    
    -- Check BTREE index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%created_at%'
        AND indexdef NOT LIKE '%BRIN%'
    ) INTO btree_index_exists;
    
    -- Count total indexes on audit_logs
    SELECT COUNT(*) INTO total_indexes
    FROM pg_indexes 
    WHERE tablename = 'audit_logs';
    
    RAISE NOTICE 'audit_logs index status:';
    RAISE NOTICE '  BRIN index on created_at: %', CASE WHEN brin_index_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  BTREE index on (tenant_id, created_at): %', CASE WHEN btree_index_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE '  Total indexes on audit_logs: %', total_indexes;
    
    IF brin_index_exists AND btree_index_exists THEN
        RAISE NOTICE '✅ All required audit_logs indexes are now present';
    ELSE
        RAISE NOTICE '❌ Some audit_logs indexes are still missing - manual intervention may be required';
    END IF;
END $$;

-- =============================================================================
-- Final Status Report
-- =============================================================================

SELECT 'Final Status Report' as report_section;

-- Generate comprehensive status report
DO $$
DECLARE
    total_tables INTEGER;
    total_indexes INTEGER;
    audit_logs_indexes INTEGER;
    task17_indexes INTEGER;
    fix_status TEXT;
BEGIN
    RAISE NOTICE 'Generating final diagnostic and fix status report...';
    
    -- Gather final statistics
    SELECT COUNT(*) INTO total_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public';
    
    SELECT COUNT(*) INTO total_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO audit_logs_indexes
    FROM pg_indexes 
    WHERE tablename = 'audit_logs';
    
    SELECT COUNT(*) INTO task17_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public'
    AND indexname LIKE '%_idx'
    AND tablename IN ('tenants', 'users', 'memberships', 'customers', 'resources', 'services',
                     'bookings', 'payments', 'events_outbox', 'audit_logs', 'notifications');
    
    -- Determine fix status
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%BRIN%' 
        AND indexdef LIKE '%created_at%'
    ) THEN
        fix_status := '✅ RESOLVED';
    ELSE
        fix_status := '❌ STILL MISSING';
    END IF;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'DIAGNOSTIC AND FIX COMPLETION REPORT';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Database Statistics:';
    RAISE NOTICE '  Total Tables: %', total_tables;
    RAISE NOTICE '  Total Indexes: %', total_indexes;
    RAISE NOTICE '  Task 17 Indexes: %', task17_indexes;
    RAISE NOTICE '  audit_logs Indexes: %', audit_logs_indexes;
    RAISE NOTICE '';
    RAISE NOTICE 'Critical Issue Status:';
    RAISE NOTICE '  BRIN index on audit_logs.created_at: %', fix_status;
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    IF fix_status = '✅ RESOLVED' THEN
        RAISE NOTICE '  ✅ Run the comprehensive validation tests again';
        RAISE NOTICE '  ✅ All Task 17 tests should now pass';
    ELSE
        RAISE NOTICE '  ❌ Manual investigation required for missing indexes';
        RAISE NOTICE '  ❌ Check table structure and migration logs';
    END IF;
    RAISE NOTICE '================================================================';
END $$;

COMMIT;

-- Final status output
SELECT 
    'Task 17 Diagnostic and Fix Complete' as status,
    'Database state analyzed and missing indexes created where possible' as summary,
    'Run comprehensive validation tests again to verify fixes' as next_steps;
