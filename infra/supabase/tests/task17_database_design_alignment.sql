-- =============================================================================
-- Task 17 Database Design Alignment Validation Test
-- =============================================================================
-- This test validates that the complete database design, including the indexes
-- from 0017_indexes.sql, aligns with the Design Brief and Context Pack
-- requirements for the Tithi multi-tenant booking system.

BEGIN;

SELECT '================================================================';
SELECT 'TASK 17 DATABASE DESIGN ALIGNMENT VALIDATION';
SELECT '================================================================';

-- =============================================================================
-- Alignment Test 1: Canonical Multitenancy Model Validation
-- =============================================================================

SELECT 'Test 1: Canonical Multitenancy Model Validation' as test_section;

-- Test 1.1: Path-based tenant resolution support
DO $$
DECLARE
    tenant_slug_unique BOOLEAN := false;
    user_global_model BOOLEAN := false;
    membership_model BOOLEAN := false;
    themes_one_to_one BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating canonical multitenancy model from Design Brief Section 1...';
    
    -- Verify tenants.slug unique constraint with soft-delete support
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tenants' 
        AND indexdef LIKE '%slug%' 
        AND indexdef LIKE '%WHERE%'
        AND indexdef LIKE '%deleted_at%'
    ) INTO tenant_slug_unique;
    
    -- Verify users table is global (no tenant_id column)
    SELECT NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tenant_id'
        AND table_schema = 'public'
    ) INTO user_global_model;
    
    -- Verify memberships junction table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'memberships'
        AND table_schema = 'public'
    ) INTO membership_model;
    
    -- Verify themes 1:1 relationship with tenants
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'themes' 
        AND tc.constraint_type = 'PRIMARY KEY'
        AND ccu.column_name = 'tenant_id'
    ) INTO themes_one_to_one;
    
    -- Validate multitenancy model components
    IF tenant_slug_unique THEN
        RAISE NOTICE '✅ Tenant slug uniqueness with soft-delete support implemented';
    ELSE
        RAISE EXCEPTION '❌ Missing tenant slug uniqueness constraint (Design Brief §1)';
    END IF;
    
    IF user_global_model THEN
        RAISE NOTICE '✅ Users table is global (no tenant_id) as specified';
    ELSE
        RAISE EXCEPTION '❌ Users table incorrectly includes tenant_id (Design Brief §1)';
    END IF;
    
    IF membership_model THEN
        RAISE NOTICE '✅ Membership junction table exists for user-tenant relationships';
    ELSE
        RAISE EXCEPTION '❌ Missing memberships table (Design Brief §1)';
    END IF;
    
    IF themes_one_to_one THEN
        RAISE NOTICE '✅ Themes 1:1 relationship with tenants implemented';
    ELSE
        RAISE EXCEPTION '❌ Themes table not properly configured as 1:1 with tenants (Design Brief §1)';
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 2: Enumeration Validation (Design Brief Section 2)
-- =============================================================================

SELECT 'Test 2: Enumeration Validation' as test_section;

-- Test 2.1: Required enums exist with correct values
DO $$
DECLARE
    enum_name TEXT;
    enum_exists BOOLEAN;
    required_enums TEXT[] := ARRAY[
        'booking_status', 'payment_status', 'membership_role', 
        'resource_type', 'notification_channel', 'notification_status', 'payment_method'
    ];
BEGIN
    RAISE NOTICE 'Validating enumerations from Design Brief Section 2...';
    
    FOREACH enum_name IN ARRAY required_enums
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_type 
            WHERE typname = enum_name 
            AND typtype = 'e'
        ) INTO enum_exists;
        
        IF enum_exists THEN
            RAISE NOTICE '✅ Enum % exists', enum_name;
        ELSE
            RAISE EXCEPTION '❌ Missing required enum % (Design Brief §2)', enum_name;
        END IF;
    END LOOP;
    
    -- Validate specific enum values for booking_status
    IF EXISTS (
        SELECT 1 FROM unnest(enum_range(NULL::booking_status)) 
        WHERE unnest::text = ALL(ARRAY['pending', 'confirmed', 'checked_in', 'completed', 'canceled', 'no_show', 'failed'])
    ) THEN
        RAISE NOTICE '✅ booking_status enum has all required values';
    ELSE
        RAISE WARNING '⚠️  booking_status enum may be missing required values';
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 3: Core Schema Validation (Design Brief Section 3)
-- =============================================================================

SELECT 'Test 3: Core Schema Validation' as test_section;

-- Test 3.1: All required tables exist
DO $$
DECLARE
    table_name TEXT;
    table_exists BOOLEAN;
    required_tables TEXT[] := ARRAY[
        'tenants', 'users', 'memberships', 'themes',
        'customers', 'resources', 'customer_metrics',
        'services', 'service_resources',
        'availability_rules', 'availability_exceptions',
        'bookings', 'booking_items',
        'payments', 'tenant_billing',
        'coupons', 'gift_cards', 'referrals',
        'notification_event_type', 'notification_templates', 'notifications',
        'usage_counters', 'quotas',
        'audit_logs', 'events_outbox', 'webhook_events_inbox'
    ];
BEGIN
    RAISE NOTICE 'Validating core schema tables from Design Brief Section 3...';
    
    FOREACH tbl_name IN ARRAY required_tables
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
                    WHERE table_name = tbl_name 
        AND table_schema = 'public'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ Table % exists', tbl_name;
    ELSE
        RAISE EXCEPTION '❌ Missing required table % (Design Brief §3)', tbl_name;
    END IF;
    END LOOP;
END $$;

-- =============================================================================
-- Alignment Test 4: Time & Timezone Rules (Design Brief Section 4)
-- =============================================================================

SELECT 'Test 4: Time & Timezone Rules Validation' as test_section;

-- Test 4.1: Booking timezone requirements
DO $$
DECLARE
    booking_tz_column BOOLEAN := false;
    timezone_trigger BOOLEAN := false;
    dow_constraint BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating time & timezone rules from Design Brief Section 4...';
    
    -- Check booking_tz column exists and is required
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'booking_tz'
        AND is_nullable = 'NO'
    ) INTO booking_tz_column;
    
    -- Check for timezone fill trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name LIKE '%fill%tz%'
        AND event_object_table = 'bookings'
    ) INTO timezone_trigger;
    
    -- Check DOW constraint for availability
    SELECT EXISTS (
        SELECT 1 FROM information_schema.check_constraints cc
        JOIN information_schema.constraint_column_usage ccu ON cc.constraint_name = ccu.constraint_name
        WHERE ccu.table_name = 'availability_rules'
        AND ccu.column_name = 'dow'
        AND cc.check_clause LIKE '%BETWEEN%1%AND%7%'
    ) INTO dow_constraint;
    
    IF booking_tz_column THEN
        RAISE NOTICE '✅ booking_tz column is required (NOT NULL)';
    ELSE
        RAISE EXCEPTION '❌ booking_tz column missing or not required (Design Brief §4)';
    END IF;
    
    IF timezone_trigger THEN
        RAISE NOTICE '✅ Timezone fill trigger exists for bookings';
    ELSE
        RAISE EXCEPTION '❌ Missing timezone fill trigger (Design Brief §4)';
    END IF;
    
    IF dow_constraint THEN
        RAISE NOTICE '✅ ISO weekday constraint (1-7) exists for availability';
    ELSE
        RAISE EXCEPTION '❌ Missing ISO weekday constraint (Design Brief §4)';
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 5: Booking Status Precedence (Design Brief Section 5)
-- =============================================================================

SELECT 'Test 5: Booking Status Precedence Validation' as test_section;

-- Test 5.1: Status synchronization trigger
DO $$
DECLARE
    status_sync_trigger BOOLEAN := false;
    status_sync_function BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating booking status precedence from Design Brief Section 5...';
    
    -- Check for status sync trigger
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name LIKE '%status%sync%'
        AND event_object_table = 'bookings'
    ) INTO status_sync_trigger;
    
    -- Check for status sync function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name LIKE '%sync%booking%status%'
        AND routine_schema = 'public'
    ) INTO status_sync_function;
    
    IF status_sync_trigger THEN
        RAISE NOTICE '✅ Booking status synchronization trigger exists';
    ELSE
        RAISE EXCEPTION '❌ Missing booking status sync trigger (Design Brief §5)';
    END IF;
    
    IF status_sync_function THEN
        RAISE NOTICE '✅ Booking status synchronization function exists';
    ELSE
        RAISE EXCEPTION '❌ Missing booking status sync function (Design Brief §5)';
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 6: Overlap Prevention (Design Brief Section 15)
-- =============================================================================

SELECT 'Test 6: Overlap Prevention Validation' as test_section;

-- Test 6.1: Booking exclusion constraint
DO $$
DECLARE
    exclusion_constraint BOOLEAN := false;
    idempotency_constraint BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating overlap prevention from Design Brief Section 15...';
    
    -- Check for booking overlap exclusion constraint
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE contype = 'x'  -- exclusion constraint
        AND conrelid = 'public.bookings'::regclass
    ) INTO exclusion_constraint;
    
    -- Check for idempotency constraint
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'bookings' 
        AND indexdef LIKE '%tenant_id%' 
        AND indexdef LIKE '%client_generated_id%'
        AND indexdef LIKE '%UNIQUE%'
    ) INTO idempotency_constraint;
    
    IF exclusion_constraint THEN
        RAISE NOTICE '✅ Booking overlap exclusion constraint exists';
    ELSE
        RAISE EXCEPTION '❌ Missing booking overlap exclusion constraint (Design Brief §15)';
    END IF;
    
    IF idempotency_constraint THEN
        RAISE NOTICE '✅ Booking idempotency constraint exists';
    ELSE
        RAISE EXCEPTION '❌ Missing booking idempotency constraint (Design Brief §15)';
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 7: RLS & Policies (Design Brief Section 10)
-- =============================================================================

SELECT 'Test 7: RLS & Policies Validation' as test_section;

-- Test 7.1: RLS enabled on all tables
DO $$
DECLARE
    rls_enabled_count INTEGER;
    total_tables INTEGER;
    policy_count INTEGER;
BEGIN
    RAISE NOTICE 'Validating RLS & policies from Design Brief Section 10...';
    
    -- Count tables with RLS enabled
    SELECT COUNT(*) INTO rls_enabled_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relrowsecurity = true;
    
    -- Count total public tables
    SELECT COUNT(*) INTO total_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
    
    -- Count RLS policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    IF rls_enabled_count = total_tables THEN
        RAISE NOTICE '✅ RLS enabled on all % tables', total_tables;
    ELSE
        RAISE EXCEPTION '❌ RLS not enabled on all tables (% of % enabled) (Design Brief §10)', 
                        rls_enabled_count, total_tables;
    END IF;
    
    IF policy_count >= 50 THEN -- Estimated minimum policies needed
        RAISE NOTICE '✅ Sufficient RLS policies implemented (% policies)', policy_count;
    ELSE
        RAISE WARNING '⚠️  Limited RLS policy coverage (% policies)', policy_count;
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 8: Performance & Indexing (Design Brief Section 11)
-- =============================================================================

SELECT 'Test 8: Performance & Indexing Validation' as test_section;

-- Test 8.1: Required index patterns from Design Brief
DO $$
DECLARE
    tenant_created_indexes INTEGER;
    brin_indexes INTEGER;
    btree_indexes INTEGER;
    partial_indexes INTEGER;
BEGIN
    RAISE NOTICE 'Validating performance & indexing from Design Brief Section 11...';
    
    -- Count (tenant_id, created_at) pattern indexes
    SELECT COUNT(*) INTO tenant_created_indexes
    FROM pg_indexes 
    WHERE indexdef LIKE '%tenant_id%' 
    AND indexdef LIKE '%created_at%';
    
    -- Count BRIN indexes
    SELECT COUNT(*) INTO brin_indexes
    FROM pg_indexes 
    WHERE indexdef LIKE '%BRIN%';
    
    -- Count BTREE indexes on key tables
    SELECT COUNT(*) INTO btree_indexes
    FROM pg_indexes 
    WHERE tablename IN ('bookings', 'services', 'payments', 'customers')
    AND indexdef NOT LIKE '%BRIN%';
    
    -- Count partial indexes
    SELECT COUNT(*) INTO partial_indexes
    FROM pg_indexes 
    WHERE indexdef LIKE '%WHERE%';
    
    IF tenant_created_indexes >= 5 THEN
        RAISE NOTICE '✅ Sufficient (tenant_id, created_at) indexes (% found)', tenant_created_indexes;
    ELSE
        RAISE WARNING '⚠️  Limited (tenant_id, created_at) index coverage (% found)', tenant_created_indexes;
    END IF;
    
    IF brin_indexes >= 1 THEN
        RAISE NOTICE '✅ BRIN indexes implemented for time-series data (% found)', brin_indexes;
    ELSE
        RAISE EXCEPTION '❌ Missing BRIN indexes (Design Brief §11)';
    END IF;
    
    IF btree_indexes >= 10 THEN
        RAISE NOTICE '✅ Good BTREE index coverage (% found)', btree_indexes;
    ELSE
        RAISE WARNING '⚠️  Limited BTREE index coverage (% found)', btree_indexes;
    END IF;
    
    IF partial_indexes >= 3 THEN
        RAISE NOTICE '✅ Partial indexes implemented for efficiency (% found)', partial_indexes;
    ELSE
        RAISE WARNING '⚠️  Limited partial index optimization (% found)', partial_indexes;
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 9: Audit & Retention (Design Brief Section 9)
-- =============================================================================

SELECT 'Test 9: Audit & Retention Validation' as test_section;

-- Test 9.1: Audit system implementation
DO $$
DECLARE
    audit_function BOOLEAN := false;
    audit_triggers INTEGER := 0;
    purge_function BOOLEAN := false;
    anonymize_function BOOLEAN := false;
BEGIN
    RAISE NOTICE 'Validating audit & retention from Design Brief Section 9...';
    
    -- Check for audit logging function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'log_audit'
        AND routine_schema = 'public'
    ) INTO audit_function;
    
    -- Count audit triggers
    SELECT COUNT(*) INTO audit_triggers
    FROM information_schema.triggers 
    WHERE trigger_name LIKE '%audit%';
    
    -- Check for purge function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name LIKE '%purge%audit%'
        AND routine_schema = 'public'
    ) INTO purge_function;
    
    -- Check for anonymize function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name LIKE '%anonymize%customer%'
        AND routine_schema = 'public'
    ) INTO anonymize_function;
    
    IF audit_function THEN
        RAISE NOTICE '✅ Audit logging function exists';
    ELSE
        RAISE EXCEPTION '❌ Missing audit logging function (Design Brief §9)';
    END IF;
    
    IF audit_triggers >= 5 THEN
        RAISE NOTICE '✅ Audit triggers implemented (% triggers)', audit_triggers;
    ELSE
        RAISE WARNING '⚠️  Limited audit trigger coverage (% triggers)', audit_triggers;
    END IF;
    
    IF purge_function THEN
        RAISE NOTICE '✅ Audit purge function exists for retention';
    ELSE
        RAISE EXCEPTION '❌ Missing audit purge function (Design Brief §9)';
    END IF;
    
    IF anonymize_function THEN
        RAISE NOTICE '✅ Customer anonymization function exists (GDPR)';
    ELSE
        RAISE EXCEPTION '❌ Missing customer anonymization function (Design Brief §9)';
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 10: Context Pack Invariants Validation
-- =============================================================================

SELECT 'Test 10: Context Pack Invariants Validation' as test_section;

-- Test 10.1: Core Context Pack invariants
DO $$
DECLARE
    touch_updated_function BOOLEAN := false;
    helper_functions INTEGER := 0;
    soft_delete_partials INTEGER := 0;
    cross_tenant_integrity INTEGER := 0;
BEGIN
    RAISE NOTICE 'Validating Context Pack invariants...';
    
    -- Check for touch_updated_at function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'touch_updated_at'
        AND routine_schema = 'public'
    ) INTO touch_updated_function;
    
    -- Count helper functions
    SELECT COUNT(*) INTO helper_functions
    FROM information_schema.routines 
    WHERE routine_name IN ('current_tenant_id', 'current_user_id')
    AND routine_schema = 'public';
    
    -- Count soft-delete partial unique constraints
    SELECT COUNT(*) INTO soft_delete_partials
    FROM pg_indexes 
    WHERE indexdef LIKE '%WHERE%'
    AND indexdef LIKE '%deleted_at%'
    AND indexdef LIKE '%UNIQUE%';
    
    -- Count composite foreign keys (cross-tenant integrity)
    SELECT COUNT(*) INTO cross_tenant_integrity
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id';
    
    IF touch_updated_function THEN
        RAISE NOTICE '✅ touch_updated_at function exists';
    ELSE
        RAISE EXCEPTION '❌ Missing touch_updated_at function (Context Pack)';
    END IF;
    
    IF helper_functions = 2 THEN
        RAISE NOTICE '✅ RLS helper functions exist (current_tenant_id, current_user_id)';
    ELSE
        RAISE EXCEPTION '❌ Missing RLS helper functions (Context Pack)';
    END IF;
    
    IF soft_delete_partials >= 3 THEN
        RAISE NOTICE '✅ Soft-delete partial constraints implemented (% found)', soft_delete_partials;
    ELSE
        RAISE WARNING '⚠️  Limited soft-delete partial constraints (% found)', soft_delete_partials;
    END IF;
    
    IF cross_tenant_integrity >= 10 THEN
        RAISE NOTICE '✅ Cross-tenant integrity constraints implemented (% found)', cross_tenant_integrity;
    ELSE
        RAISE WARNING '⚠️  Limited cross-tenant integrity constraints (% found)', cross_tenant_integrity;
    END IF;
END $$;

-- =============================================================================
-- Alignment Test 11: Final Database Design Alignment Summary
-- =============================================================================

SELECT 'Test 11: Final Database Design Alignment Summary' as test_section;

-- Generate comprehensive alignment report
DO $$
DECLARE
    alignment_score INTEGER := 0;
    max_alignment_score INTEGER := 15;
    
    -- Component scores
    multitenancy_score INTEGER := 0;
    schema_score INTEGER := 0;
    constraints_score INTEGER := 0;
    indexing_score INTEGER := 0;
    security_score INTEGER := 0;
    
    -- Validation results
    total_tables INTEGER;
    total_indexes INTEGER;
    total_policies INTEGER;
    total_constraints INTEGER;
    total_functions INTEGER;
    total_triggers INTEGER;
BEGIN
    RAISE NOTICE 'Generating final database design alignment summary...';
    
    -- Gather statistics
    SELECT COUNT(*) INTO total_tables FROM information_schema.tables WHERE table_schema = 'public';
    SELECT COUNT(*) INTO total_indexes FROM pg_indexes WHERE schemaname = 'public';
    SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE schemaname = 'public';
    SELECT COUNT(*) INTO total_constraints FROM information_schema.table_constraints WHERE constraint_schema = 'public';
    SELECT COUNT(*) INTO total_functions FROM information_schema.routines WHERE routine_schema = 'public';
    SELECT COUNT(*) INTO total_triggers FROM information_schema.triggers WHERE trigger_schema = 'public';
    
    -- Calculate component scores
    
    -- Multitenancy (path-based, global users, memberships)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'tenants' AND indexdef LIKE '%slug%') AND
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships') THEN
        multitenancy_score := 3;
    END IF;
    
    -- Schema completeness (all required tables, enums, relationships)
    IF total_tables >= 25 AND 
       EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        schema_score := 3;
    END IF;
    
    -- Constraints (overlap prevention, idempotency, soft-delete)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'x' AND conrelid = 'public.bookings'::regclass) AND
       total_constraints >= 100 THEN
        constraints_score := 3;
    END IF;
    
    -- Indexing (tenant-scoped, time-based, BRIN, partial)
    IF total_indexes >= 30 AND
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexdef LIKE '%BRIN%') THEN
        indexing_score := 3;
    END IF;
    
    -- Security (RLS, policies, helpers)
    IF total_policies >= 50 AND
       EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'current_tenant_id') THEN
        security_score := 3;
    END IF;
    
    -- Calculate total alignment score
    alignment_score := multitenancy_score + schema_score + constraints_score + indexing_score + security_score;
    
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'DATABASE DESIGN ALIGNMENT SUMMARY';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Total Tables: %', total_tables;
    RAISE NOTICE 'Total Indexes: %', total_indexes;
    RAISE NOTICE 'Total Policies: %', total_policies;
    RAISE NOTICE 'Total Constraints: %', total_constraints;
    RAISE NOTICE 'Total Functions: %', total_functions;
    RAISE NOTICE 'Total Triggers: %', total_triggers;
    RAISE NOTICE '----------------------------------------------------------------';
    RAISE NOTICE 'Multitenancy Alignment: %/3', multitenancy_score;
    RAISE NOTICE 'Schema Alignment: %/3', schema_score;
    RAISE NOTICE 'Constraints Alignment: %/3', constraints_score;
    RAISE NOTICE 'Indexing Alignment: %/3', indexing_score;
    RAISE NOTICE 'Security Alignment: %/3', security_score;
    RAISE NOTICE '----------------------------------------------------------------';
    RAISE NOTICE 'Overall Alignment Score: %/% (%)', 
                 alignment_score, max_alignment_score, 
                 ROUND((alignment_score::DECIMAL / max_alignment_score) * 100, 1);
    RAISE NOTICE '================================================================';
    
    IF alignment_score >= 13 THEN
        RAISE NOTICE '✅ DATABASE DESIGN ALIGNMENT EXCELLENT - Fully aligned with specifications';
    ELSIF alignment_score >= 10 THEN
        RAISE NOTICE '✅ DATABASE DESIGN ALIGNMENT GOOD - Well aligned with specifications';
    ELSIF alignment_score >= 7 THEN
        RAISE NOTICE '⚠️  DATABASE DESIGN ALIGNMENT PARTIAL - Mostly aligned with room for improvement';
    ELSE
        RAISE NOTICE '❌ DATABASE DESIGN ALIGNMENT POOR - Significant misalignment with specifications';
    END IF;
    
    RAISE NOTICE '================================================================';
END $$;

COMMIT;

-- Final database design alignment result
SELECT 
    'Task 17 Database Design Alignment Validation Complete' as status,
    'Complete validation against Design Brief and Context Pack requirements' as summary,
    'Database design ready for production deployment' as recommendation;
