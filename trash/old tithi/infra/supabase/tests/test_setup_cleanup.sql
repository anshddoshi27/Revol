-- =================================================================
-- Test Setup and Cleanup Script
-- Ensures clean test environment and handles foreign key constraints
-- =================================================================

-- Function to clean up all test data safely
CREATE OR REPLACE FUNCTION public.cleanup_all_test_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_record RECORD;
BEGIN
    RAISE NOTICE 'Starting comprehensive test data cleanup...';
    
    -- Clean up all tenant-related data in proper order to avoid FK violations
    -- This handles both known test slugs and any orphaned data
    
    -- Step 1: Clean up dependent tables first
    RAISE NOTICE 'Cleaning up dependent tables...';
    
    -- Clean audit logs (these reference many tables)
    DELETE FROM public.audit_logs WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean events outbox
    DELETE FROM public.events_outbox WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean customer metrics (references customers)
    DELETE FROM public.customer_metrics WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean customers
    DELETE FROM public.customers WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean resources (this was causing the FK constraint error)
    DELETE FROM public.resources WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean services
    DELETE FROM public.services WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean tenant billing
    DELETE FROM public.tenant_billing WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean themes
    DELETE FROM public.themes WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Clean memberships
    DELETE FROM public.memberships WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
    
    -- Step 2: Clean up test users (these might be referenced by memberships)
    DELETE FROM public.users WHERE primary_email LIKE '%@test%' OR display_name LIKE 'Test%';
    
    -- Step 3: Finally clean up tenants
    DELETE FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%';
    
    -- Step 4: Handle any remaining problematic tenant (like the one from the error)
    -- This is a safety net for orphaned data
    DELETE FROM public.resources WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';
    DELETE FROM public.tenants WHERE id = '550e8400-e29b-41d4-a716-446655440000';
    
    RAISE NOTICE 'Test data cleanup completed successfully.';
END;
$$;

-- Function to verify clean state
CREATE OR REPLACE FUNCTION public.verify_clean_test_state()
RETURNS TABLE(table_name text, remaining_count bigint)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 'tenants'::text, COUNT(*) FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    UNION ALL
    SELECT 'users'::text, COUNT(*) FROM public.users WHERE primary_email LIKE '%@test%' OR display_name LIKE 'Test%'
    UNION ALL
    SELECT 'resources'::text, COUNT(*) FROM public.resources WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    )
    UNION ALL
    SELECT 'customers'::text, COUNT(*) FROM public.customers WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    )
    UNION ALL
    SELECT 'memberships'::text, COUNT(*) FROM public.memberships WHERE tenant_id IN (
        SELECT id FROM public.tenants WHERE slug LIKE 'test-%' OR slug LIKE 'isolation-test-%'
    );
END;
$$;

-- Execute cleanup
SELECT public.cleanup_all_test_data();

-- Verify cleanup
SELECT 'POST-CLEANUP VERIFICATION:' as status;
SELECT * FROM public.verify_clean_test_state();

-- Check for the specific problematic tenant
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.tenants WHERE id = '550e8400-e29b-41d4-a716-446655440000')
        THEN '❌ Problematic tenant still exists'
        ELSE '✅ Problematic tenant cleaned up'
    END as tenant_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.resources WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000')
        THEN '❌ Orphaned resources still exist'
        ELSE '✅ No orphaned resources'
    END as resource_status;
