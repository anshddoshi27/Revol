-- infra/supabase/tests/test2_overlap_no_pgtap.sql
-- Test file that works WITHOUT pgTAP extension
-- Uses simple SQL assertions instead of pgTAP functions

BEGIN;

-- =================================================================
-- TESTS: Basic Overlap and Constraint Validation (No pgTAP Required)
-- =================================================================

-- Test 1: Check if bookings table exists
DO $$
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'bookings' AND table_schema = 'public'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE 'PASS: Test 1 - Bookings table exists';
    ELSE
        RAISE NOTICE 'FAIL: Test 1 - Bookings table does not exist';
    END IF;
END $$;

-- Test 2: Check if bookings table has CHECK constraints
DO $$
DECLARE
    constraint_count integer;
BEGIN
    SELECT count(*) INTO constraint_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' AND table_schema = 'public' AND constraint_type = 'CHECK';
    
    IF constraint_count > 0 THEN
        RAISE NOTICE 'PASS: Test 2 - Bookings table has CHECK constraints (count: %)', constraint_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 2 - Bookings table has no CHECK constraints';
    END IF;
END $$;

-- Test 3: Check if touch_updated_at function exists
DO $$
DECLARE
    func_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'touch_updated_at' AND routine_schema = 'public'
    ) INTO func_exists;
    
    IF func_exists THEN
        RAISE NOTICE 'PASS: Test 3 - touch_updated_at function exists';
    ELSE
        RAISE NOTICE 'FAIL: Test 3 - touch_updated_at function does not exist';
    END IF;
END $$;

-- Test 4: Check if RLS is enabled on bookings table
DO $$
DECLARE
    rls_enabled boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'bookings' AND rowsecurity = true
    ) INTO rls_enabled;
    
    IF rls_enabled THEN
        RAISE NOTICE 'PASS: Test 4 - RLS is enabled on bookings table';
    ELSE
        RAISE NOTICE 'FAIL: Test 4 - RLS is not enabled on bookings table';
    END IF;
END $$;

-- Test 5: Check if RLS policies exist for bookings table
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT count(*) INTO policy_count FROM pg_policies WHERE tablename = 'bookings';
    
    IF policy_count > 0 THEN
        RAISE NOTICE 'PASS: Test 5 - RLS policies exist for bookings table (count: %)', policy_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 5 - No RLS policies found for bookings table';
    END IF;
END $$;

-- Test 6: Check if key constraints exist on bookings table
DO $$
DECLARE
    constraint_count integer;
BEGIN
    SELECT count(*) INTO constraint_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' AND table_schema = 'public';
    
    IF constraint_count > 0 THEN
        RAISE NOTICE 'PASS: Test 6 - Bookings table has constraints (count: %)', constraint_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 6 - Bookings table has no constraints';
    END IF;
END $$;

-- Test 7: Check if triggers exist on bookings table
DO $$
DECLARE
    trigger_count integer;
BEGIN
    SELECT count(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE event_object_table = 'bookings' AND event_object_schema = 'public';
    
    IF trigger_count > 0 THEN
        RAISE NOTICE 'PASS: Test 7 - Bookings table has triggers (count: %)', trigger_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 7 - Bookings table has no triggers';
    END IF;
END $$;

-- Test 8: Check if exclusion constraint exists (for overlap prevention)
DO $$
DECLARE
    exclusion_count integer;
BEGIN
    SELECT count(*) INTO exclusion_count 
    FROM pg_constraint 
    WHERE conrelid = 'public.bookings'::regclass AND contype = 'x';
    
    IF exclusion_count > 0 THEN
        RAISE NOTICE 'PASS: Test 8 - Bookings table has exclusion constraints (count: %)', exclusion_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 8 - Bookings table has no exclusion constraints';
    END IF;
END $$;

-- Test 9: Check if unique constraints exist on bookings table
DO $$
DECLARE
    unique_count integer;
BEGIN
    SELECT count(*) INTO unique_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' AND table_schema = 'public' AND constraint_type = 'UNIQUE';
    
    IF unique_count > 0 THEN
        RAISE NOTICE 'PASS: Test 9 - Bookings table has unique constraints (count: %)', unique_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 9 - Bookings table has no unique constraints';
    END IF;
END $$;

-- Test 10: Check if foreign key constraints exist on bookings table
DO $$
DECLARE
    fk_count integer;
BEGIN
    SELECT count(*) INTO fk_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'bookings' AND table_schema = 'public' AND constraint_type = 'FOREIGN KEY';
    
    IF fk_count > 0 THEN
        RAISE NOTICE 'PASS: Test 10 - Bookings table has foreign key constraints (count: %)', fk_count;
    ELSE
        RAISE NOTICE 'FAIL: Test 10 - Bookings table has no foreign key constraints';
    END IF;
END $$;

-- Test 11: Summary
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST SUMMARY: All 11 tests completed';
    RAISE NOTICE 'Check the output above for PASS/FAIL results';
    RAISE NOTICE '========================================';
END $$;

-- =================================================================
-- CLEANUP
-- =================================================================

-- No cleanup needed for this test file

COMMIT;
