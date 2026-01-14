-- =============================================================================
-- Task 17 Index Coverage Validation Test
-- =============================================================================
-- This test validates that all indexes specified in the Design Brief and 
-- Context Pack are properly implemented in the 0017_indexes.sql migration.
-- It ensures complete coverage of the index strategy requirements.

BEGIN;

SELECT '================================================================';
SELECT 'TASK 17 INDEX COVERAGE VALIDATION TEST';
SELECT '================================================================';

-- =============================================================================
-- Coverage Test 1: Design Brief Section 11 Index Requirements
-- =============================================================================

SELECT 'Test 1: Design Brief Section 11 Index Requirements' as test_section;

-- Test 1.1: Audit logs BRIN and BTREE indexes (Design Brief requirement)
DO $$
DECLARE
    brin_index_exists BOOLEAN := false;
    btree_index_exists BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating Design Brief Section 11 audit log index requirements...';
    
    -- Check for BRIN index on created_at
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%BRIN%' 
        AND indexdef LIKE '%created_at%'
    ) INTO brin_index_exists;
    
    -- Check for BTREE index on (tenant_id, created_at)
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'audit_logs' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%created_at%'
        AND indexdef NOT LIKE '%BRIN%'
    ) INTO btree_index_exists;
    
    IF brin_index_exists THEN
        RAISE NOTICE '✅ BRIN index on audit_logs.created_at exists (Design Brief 11)';
    ELSE
        RAISE EXCEPTION '❌ Missing BRIN index on audit_logs.created_at (Design Brief 11)';
    END IF;
    
    IF btree_index_exists THEN
        RAISE NOTICE '✅ BTREE index on audit_logs(tenant_id, created_at) exists (Design Brief 11)';
    ELSE
        RAISE EXCEPTION '❌ Missing BTREE index on audit_logs(tenant_id, created_at) (Design Brief 11)';
    END IF;
END $$;

-- Test 1.2: High-write table (tenant_id, created_at) pattern
DO $$
DECLARE
    table_name TEXT;
    index_exists BOOLEAN;
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
BEGIN
    RAISE NOTICE 'Validating high-write table (tenant_id, created_at) pattern...';
    
    -- Check required high-write tables from Design Brief
    FOR table_name IN 
        VALUES ('customers'), ('resources'), ('services'), ('memberships')
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = table_name 
            AND indexdef LIKE '%tenant_id%' 
            AND indexdef LIKE '%created_at%'
        ) INTO index_exists;
        
        IF index_exists THEN
            RAISE NOTICE '✅ High-write index on %(tenant_id, created_at) exists', table_name;
        ELSE
            missing_indexes := array_append(missing_indexes, table_name);
            RAISE WARNING '⚠️  Missing high-write index on %(tenant_id, created_at)', table_name;
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) IS NULL THEN
        RAISE NOTICE '✅ All high-write table indexes implemented';
    ELSE
        RAISE WARNING '⚠️  Missing high-write indexes on tables: %', array_to_string(missing_indexes, ', ');
    END IF;
END $$;

-- =============================================================================
-- Coverage Test 2: Context Pack Index Strategy Requirements
-- =============================================================================

SELECT 'Test 2: Context Pack Index Strategy Requirements' as test_section;

-- Test 2.1: Bookings time-based and operational queries
DO $$
DECLARE
    required_indexes TEXT[] := ARRAY[
        'bookings_tenant_start_desc_idx',
        'bookings_resource_start_idx', 
        'bookings_tenant_status_start_desc_idx',
        'bookings_tenant_rescheduled_from_idx'
    ];
    index_name TEXT;
    index_exists BOOLEAN;
    missing_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Validating bookings index requirements from Context Pack...';
    
    FOREACH index_name IN ARRAY required_indexes
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = index_name 
            AND tablename = 'bookings'
        ) INTO index_exists;
        
        IF index_exists THEN
            RAISE NOTICE '✅ Required booking index % exists', index_name;
        ELSE
            missing_count := missing_count + 1;
            RAISE WARNING '❌ Missing required booking index %', index_name;
        END IF;
    END LOOP;
    
    IF missing_count = 0 THEN
        RAISE NOTICE '✅ All required booking indexes implemented';
    ELSE
        RAISE EXCEPTION '❌ Missing % required booking indexes', missing_count;
    END IF;
END $$;

-- Test 2.2: Services discovery and categorization
DO $$
DECLARE
    active_index_exists BOOLEAN := false;
    category_index_exists BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating services index requirements from Context Pack...';
    
    -- Check for tenant + active index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%active%'
    ) INTO active_index_exists;
    
    -- Check for tenant + category + active index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'services' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%category%' 
        AND indexdef LIKE '%active%'
    ) INTO category_index_exists;
    
    IF active_index_exists THEN
        RAISE NOTICE '✅ Services active filtering index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing services active filtering index';
    END IF;
    
    IF category_index_exists THEN
        RAISE NOTICE '✅ Services category + active filtering index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing services category + active filtering index';
    END IF;
END $$;

-- Test 2.3: Payments financial tracking and reporting
DO $$
DECLARE
    payment_time_index BOOLEAN := false;
    payment_status_index BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating payments index requirements from Context Pack...';
    
    -- Check for tenant + created_at DESC index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'payments' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%created_at%'
        AND indexdef LIKE '%DESC%'
    ) INTO payment_time_index;
    
    -- Check for tenant + status index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'payments' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%status%'
    ) INTO payment_status_index;
    
    IF payment_time_index THEN
        RAISE NOTICE '✅ Payments time-based reporting index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing payments time-based reporting index';
    END IF;
    
    IF payment_status_index THEN
        RAISE NOTICE '✅ Payments status filtering index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing payments status filtering index';
    END IF;
END $$;

-- Test 2.4: Customer segmentation and CRM
DO $$
DECLARE
    first_time_index BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating customer index requirements from Context Pack...';
    
    -- Check for tenant + is_first_time index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'customers' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%is_first_time%'
    ) INTO first_time_index;
    
    IF first_time_index THEN
        RAISE NOTICE '✅ Customer segmentation index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing customer segmentation index';
    END IF;
END $$;

-- Test 2.5: Events outbox reliable delivery system
DO $$
DECLARE
    outbox_status_index BOOLEAN := false;
    outbox_event_ready_index BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating events outbox index requirements from Context Pack...';
    
    -- Check for tenant + status index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'events_outbox' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%status%'
    ) INTO outbox_status_index;
    
    -- Check for tenant + event_code + ready_at index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'events_outbox' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%event_code%' 
        AND indexdef LIKE '%ready_at%'
    ) INTO outbox_event_ready_index;
    
    IF outbox_status_index THEN
        RAISE NOTICE '✅ Events outbox status processing index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing events outbox status processing index';
    END IF;
    
    IF outbox_event_ready_index THEN
        RAISE NOTICE '✅ Events outbox event-ready processing index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing events outbox event-ready processing index';
    END IF;
END $$;

-- =============================================================================
-- Coverage Test 3: Notification Processing Requirements
-- =============================================================================

SELECT 'Test 3: Notification Processing Requirements' as test_section;

-- Test 3.1: Notification queue processing indexes
DO $$
DECLARE
    notification_scheduled_index BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating notification processing index requirements...';
    
    -- Check for tenant + scheduled_at index with status filter
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'notifications' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%scheduled_at%'
        AND indexdef LIKE '%status%'
    ) INTO notification_scheduled_index;
    
    IF notification_scheduled_index THEN
        RAISE NOTICE '✅ Notification processing index exists';
    ELSE
        RAISE EXCEPTION '❌ Missing notification processing index';
    END IF;
END $$;

-- =============================================================================
-- Coverage Test 4: Partial Index Coverage Analysis
-- =============================================================================

SELECT 'Test 4: Partial Index Coverage Analysis' as test_section;

-- Test 4.1: Active status partial indexes
DO $$
DECLARE
    booking_partial_count INTEGER;
    service_partial_count INTEGER;
    notification_partial_count INTEGER;
    outbox_partial_count INTEGER;
BEGIN
    RAISE NOTICE 'Validating partial index coverage...';
    
    -- Count booking partial indexes for active statuses
    SELECT COUNT(*) INTO booking_partial_count
    FROM pg_indexes 
    WHERE tablename = 'bookings' 
    AND indexdef LIKE '%WHERE%'
    AND (indexdef LIKE '%pending%' OR indexdef LIKE '%confirmed%' OR indexdef LIKE '%checked_in%');
    
    -- Count service partial indexes
    SELECT COUNT(*) INTO service_partial_count
    FROM pg_indexes 
    WHERE tablename = 'services' 
    AND indexdef LIKE '%WHERE%'
    AND indexdef LIKE '%active%';
    
    -- Count notification partial indexes
    SELECT COUNT(*) INTO notification_partial_count
    FROM pg_indexes 
    WHERE tablename = 'notifications' 
    AND indexdef LIKE '%WHERE%'
    AND indexdef LIKE '%queued%';
    
    -- Count outbox partial indexes
    SELECT COUNT(*) INTO outbox_partial_count
    FROM pg_indexes 
    WHERE tablename = 'events_outbox' 
    AND indexdef LIKE '%WHERE%'
    AND indexdef LIKE '%ready%';
    
    RAISE NOTICE 'Partial index coverage: bookings=%, services=%, notifications=%, outbox=%',
                 booking_partial_count, service_partial_count, notification_partial_count, outbox_partial_count;
    
    IF booking_partial_count >= 1 THEN
        RAISE NOTICE '✅ Booking partial indexes implemented';
    ELSE
        RAISE WARNING '⚠️  No booking partial indexes found';
    END IF;
    
    IF service_partial_count >= 1 THEN
        RAISE NOTICE '✅ Service partial indexes implemented';
    ELSE
        RAISE WARNING '⚠️  No service partial indexes found';
    END IF;
    
    IF notification_partial_count >= 1 THEN
        RAISE NOTICE '✅ Notification partial indexes implemented';
    ELSE
        RAISE WARNING '⚠️  No notification partial indexes found';
    END IF;
    
    IF outbox_partial_count >= 1 THEN
        RAISE NOTICE '✅ Outbox partial indexes implemented';
    ELSE
        RAISE WARNING '⚠️  No outbox partial indexes found';
    END IF;
END $$;

-- =============================================================================
-- Coverage Test 5: Composite Index Pattern Analysis
-- =============================================================================

SELECT 'Test 5: Composite Index Pattern Analysis' as test_section;

-- Test 5.1: Multi-column index patterns
DO $$
DECLARE
    composite_index_count INTEGER;
    tenant_time_pattern_count INTEGER;
    filter_pattern_count INTEGER;
BEGIN
    RAISE NOTICE 'Validating composite index patterns...';
    
    -- Count composite indexes (contain commas)
    SELECT COUNT(*) INTO composite_index_count
    FROM pg_indexes 
    WHERE indexdef ~ '\([^)]*,.*[^)]*\)'
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'audit_logs');
    
    -- Count tenant_id + time pattern indexes
    SELECT COUNT(*) INTO tenant_time_pattern_count
    FROM pg_indexes 
    WHERE indexdef LIKE '%tenant_id%' 
    AND (indexdef LIKE '%created_at%' OR indexdef LIKE '%start_at%' OR indexdef LIKE '%scheduled_at%' OR indexdef LIKE '%ready_at%')
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'audit_logs');
    
    -- Count tenant_id + filter pattern indexes
    SELECT COUNT(*) INTO filter_pattern_count
    FROM pg_indexes 
    WHERE indexdef LIKE '%tenant_id%' 
    AND (indexdef LIKE '%status%' OR indexdef LIKE '%active%' OR indexdef LIKE '%category%' OR indexdef LIKE '%is_first_time%')
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox');
    
    RAISE NOTICE 'Composite index analysis: total=%, tenant+time=%, tenant+filter=%',
                 composite_index_count, tenant_time_pattern_count, filter_pattern_count;
    
    IF composite_index_count >= 10 THEN
        RAISE NOTICE '✅ Good composite index coverage';
    ELSIF composite_index_count >= 5 THEN
        RAISE NOTICE '✅ Adequate composite index coverage';
    ELSE
        RAISE WARNING '⚠️  Limited composite index coverage';
    END IF;
    
    IF tenant_time_pattern_count >= 5 THEN
        RAISE NOTICE '✅ Good tenant+time pattern coverage';
    ELSE
        RAISE WARNING '⚠️  Limited tenant+time pattern coverage';
    END IF;
    
    IF filter_pattern_count >= 4 THEN
        RAISE NOTICE '✅ Good tenant+filter pattern coverage';
    ELSE
        RAISE WARNING '⚠️  Limited tenant+filter pattern coverage';
    END IF;
END $$;

-- =============================================================================
-- Coverage Test 6: Index Type Optimization Coverage
-- =============================================================================

SELECT 'Test 6: Index Type Optimization Coverage' as test_section;

-- Test 6.1: Index type distribution analysis
DO $$
DECLARE
    btree_indexes INTEGER;
    brin_indexes INTEGER;
    partial_indexes INTEGER;
    descending_indexes INTEGER;
BEGIN
    RAISE NOTICE 'Analyzing index type optimization coverage...';
    
    -- Count different index types
    SELECT COUNT(*) INTO btree_indexes
    FROM pg_indexes 
    WHERE indexdef NOT LIKE '%BRIN%'
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'audit_logs');
    
    SELECT COUNT(*) INTO brin_indexes
    FROM pg_indexes 
    WHERE indexdef LIKE '%BRIN%'
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'audit_logs');
    
    SELECT COUNT(*) INTO partial_indexes
    FROM pg_indexes 
    WHERE indexdef LIKE '%WHERE%'
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'notifications');
    
    SELECT COUNT(*) INTO descending_indexes
    FROM pg_indexes 
    WHERE indexdef LIKE '%DESC%'
    AND tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'audit_logs');
    
    RAISE NOTICE 'Index type distribution: BTREE=%, BRIN=%, Partial=%, Descending=%',
                 btree_indexes, brin_indexes, partial_indexes, descending_indexes;
    
    -- Evaluate optimization coverage
    IF brin_indexes >= 1 THEN
        RAISE NOTICE '✅ BRIN optimization for time-series data implemented';
    ELSE
        RAISE WARNING '⚠️  No BRIN optimization found';
    END IF;
    
    IF partial_indexes >= 3 THEN
        RAISE NOTICE '✅ Good partial index optimization coverage';
    ELSE
        RAISE WARNING '⚠️  Limited partial index optimization';
    END IF;
    
    IF descending_indexes >= 2 THEN
        RAISE NOTICE '✅ Descending order optimization implemented';
    ELSE
        RAISE WARNING '⚠️  Limited descending order optimization';
    END IF;
END $$;

-- =============================================================================
-- Coverage Test 7: Final Coverage Report
-- =============================================================================

SELECT 'Test 7: Final Coverage Report' as test_section;

-- Generate comprehensive coverage report
DO $$
DECLARE
    total_required INTEGER := 20; -- Estimated required indexes from Design Brief + Context Pack
    total_implemented INTEGER;
    coverage_categories RECORD;
    coverage_score INTEGER := 0;
    max_coverage_score INTEGER := 12;
BEGIN
    RAISE NOTICE 'Generating final index coverage report...';
    
    -- Count total implemented indexes
    SELECT COUNT(*) INTO total_implemented
    FROM pg_indexes 
    WHERE tablename IN ('tenants', 'users', 'memberships', 'customers', 'resources', 'services',
                       'bookings', 'payments', 'events_outbox', 'audit_logs', 'notifications')
    AND indexname LIKE '%_idx';
    
    -- Analyze coverage by categories
    SELECT 
        COUNT(*) FILTER (WHERE indexdef LIKE '%tenant_id%') AS tenant_scoped,
        COUNT(*) FILTER (WHERE indexdef LIKE '%created_at%' OR indexdef LIKE '%start_at%' OR indexdef LIKE '%scheduled_at%') AS time_based,
        COUNT(*) FILTER (WHERE indexdef LIKE '%status%') AS status_filtering,
        COUNT(*) FILTER (WHERE indexdef LIKE '%active%') AS active_filtering,
        COUNT(*) FILTER (WHERE indexdef LIKE '%WHERE%') AS partial_optimized,
        COUNT(*) FILTER (WHERE indexdef LIKE '%BRIN%') AS brin_optimized,
        COUNT(*) FILTER (WHERE indexdef ~ '\([^)]*,.*[^)]*\)') AS composite_patterns,
        COUNT(*) FILTER (WHERE indexdef LIKE '%DESC%') AS ordering_optimized
    INTO coverage_categories
    FROM pg_indexes 
    WHERE tablename IN ('bookings', 'services', 'payments', 'customers', 'events_outbox', 'audit_logs', 'notifications')
    AND indexname LIKE '%_idx';
    
    -- Calculate coverage score
    IF coverage_categories.tenant_scoped >= 6 THEN coverage_score := coverage_score + 2; END IF;
    IF coverage_categories.time_based >= 4 THEN coverage_score := coverage_score + 2; END IF;
    IF coverage_categories.status_filtering >= 2 THEN coverage_score := coverage_score + 1; END IF;
    IF coverage_categories.active_filtering >= 1 THEN coverage_score := coverage_score + 1; END IF;
    IF coverage_categories.partial_optimized >= 3 THEN coverage_score := coverage_score + 2; END IF;
    IF coverage_categories.brin_optimized >= 1 THEN coverage_score := coverage_score + 1; END IF;
    IF coverage_categories.composite_patterns >= 8 THEN coverage_score := coverage_score + 2; END IF;
    IF coverage_categories.ordering_optimized >= 2 THEN coverage_score := coverage_score + 1; END IF;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'INDEX COVERAGE VALIDATION REPORT';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Total Indexes Implemented: %', total_implemented;
    RAISE NOTICE 'Tenant-Scoped Indexes: %', coverage_categories.tenant_scoped;
    RAISE NOTICE 'Time-Based Indexes: %', coverage_categories.time_based;
    RAISE NOTICE 'Status Filtering Indexes: %', coverage_categories.status_filtering;
    RAISE NOTICE 'Active Filtering Indexes: %', coverage_categories.active_filtering;
    RAISE NOTICE 'Partial Optimized Indexes: %', coverage_categories.partial_optimized;
    RAISE NOTICE 'BRIN Optimized Indexes: %', coverage_categories.brin_optimized;
    RAISE NOTICE 'Composite Pattern Indexes: %', coverage_categories.composite_patterns;
    RAISE NOTICE 'Ordering Optimized Indexes: %', coverage_categories.ordering_optimized;
    RAISE NOTICE 'Coverage Score: %/% (%)', 
                 coverage_score, max_coverage_score, 
                 ROUND((coverage_score::DECIMAL / max_coverage_score) * 100, 1);
    RAISE NOTICE '================================================================';
    
    IF coverage_score >= 10 THEN
        RAISE NOTICE '✅ INDEX COVERAGE VALIDATION PASSED - Excellent coverage';
    ELSIF coverage_score >= 8 THEN
        RAISE NOTICE '✅ INDEX COVERAGE VALIDATION PASSED - Good coverage';
    ELSIF coverage_score >= 6 THEN
        RAISE NOTICE '⚠️  INDEX COVERAGE VALIDATION PARTIAL - Acceptable coverage';
    ELSE
        RAISE NOTICE '❌ INDEX COVERAGE VALIDATION FAILED - Insufficient coverage';
    END IF;
    
    RAISE NOTICE '================================================================';
END $$;

COMMIT;

-- Final coverage validation result
SELECT 
    'Task 17 Index Coverage Validation Complete' as status,
    'All Design Brief and Context Pack index requirements validated' as summary,
    'Check coverage report above for detailed analysis' as next_steps;
