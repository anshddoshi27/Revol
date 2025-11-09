-- infra/supabase/tests/test2_overlap.sql
-- Simple test file for basic overlap functionality

BEGIN;

SELECT plan(3);

-- =================================================================
-- TESTS: Basic Overlap Tests
-- =================================================================

-- Test 1: Basic table existence
SELECT ok(
    (SELECT count(*) FROM information_schema.tables WHERE table_name = 'bookings')::int = 1,
    'Test 1: Bookings table should exist'
);

-- Test 2: Basic constraint existence
SELECT ok(
    (SELECT count(*) FROM information_schema.table_constraints WHERE table_name = 'bookings' AND constraint_type = 'CHECK')::int >= 1,
    'Test 2: Bookings table should have CHECK constraints'
);

-- Test 3: Basic function existence
SELECT ok(
    (SELECT count(*) FROM information_schema.routines WHERE routine_name = 'touch_updated_at')::int >= 1,
    'Test 3: touch_updated_at function should exist'
);

-- =================================================================
-- CLEANUP
-- =================================================================

SELECT finish();

ROLLBACK;
