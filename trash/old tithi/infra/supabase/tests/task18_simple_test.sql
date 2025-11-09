-- Simple Task 18 Test - Should definitely show output
-- This is a minimal test to verify the notice level is working

DO $$
DECLARE
    test_tenant_id uuid := '01234567-89ab-cdef-0123-456789abcdef';
    found_count integer;
BEGIN
    -- Test 1: Simple message
    RAISE LOG '=== SIMPLE TASK 18 TEST STARTED ===';
    RAISE LOG 'Testing basic functionality...';
    
    -- Test 2: Check if seed data exists
    SELECT COUNT(*) INTO found_count
    FROM public.tenants 
    WHERE id = test_tenant_id AND slug = 'salonx';
    
    IF found_count > 0 THEN
        RAISE LOG '✓ Seed data found: % tenants with salonx slug', found_count;
    ELSE
        RAISE LOG '❌ No seed data found - run migration 0018_seed_dev.sql first';
    END IF;
    
    -- Test 3: Check basic table structure
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        RAISE LOG '✓ Tenants table exists';
    ELSE
        RAISE LOG '❌ Tenants table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'themes') THEN
        RAISE LOG '✓ Themes table exists';
    ELSE
        RAISE LOG '❌ Themes table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resources') THEN
        RAISE LOG '✓ Resources table exists';
    ELSE
        RAISE LOG '❌ Resources table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
        RAISE LOG '✓ Services table exists';
    ELSE
        RAISE LOG '❌ Services table missing';
    END IF;
    
    -- Test 4: Final summary
    RAISE LOG '=== TEST COMPLETED ===';
    RAISE LOG 'If you see this message, the test is working!';
    
END $$;
