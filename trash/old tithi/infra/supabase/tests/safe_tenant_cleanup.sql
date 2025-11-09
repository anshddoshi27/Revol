-- =================================================================
-- Safe Tenant Cleanup Helper
-- Addresses ERROR 23503: foreign key constraint violations when 
-- deleting tenants that still have related records
-- =================================================================

-- Function to safely clean up tenant data in proper order
CREATE OR REPLACE FUNCTION public.safe_delete_tenant(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    resource_count integer;
    other_refs_count integer;
BEGIN
    RAISE NOTICE 'Starting safe deletion of tenant: %', p_tenant_id;
    
    -- First, count and delete resources that reference this tenant
    SELECT COUNT(*) INTO resource_count 
    FROM public.resources 
    WHERE tenant_id = p_tenant_id;
    
    IF resource_count > 0 THEN
        RAISE NOTICE 'Deleting % resources for tenant %', resource_count, p_tenant_id;
        DELETE FROM public.resources WHERE tenant_id = p_tenant_id;
    END IF;
    
    -- Check for other tables that might reference this tenant
    -- (Add more tables as needed based on your schema)
    SELECT COUNT(*) INTO other_refs_count FROM (
        SELECT 1 FROM public.customers WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT 1 FROM public.customer_metrics WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT 1 FROM public.services WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT 1 FROM public.memberships WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT 1 FROM public.themes WHERE tenant_id = p_tenant_id
    ) refs;
    
    IF other_refs_count > 0 THEN
        RAISE NOTICE 'Found % other references, cleaning up...', other_refs_count;
        -- Delete in proper order to avoid FK violations
        DELETE FROM public.customer_metrics WHERE tenant_id = p_tenant_id;
        DELETE FROM public.customers WHERE tenant_id = p_tenant_id;
        DELETE FROM public.services WHERE tenant_id = p_tenant_id;
        DELETE FROM public.memberships WHERE tenant_id = p_tenant_id;
        DELETE FROM public.themes WHERE tenant_id = p_tenant_id;
    END IF;
    
    -- Finally, delete the tenant itself
    DELETE FROM public.tenants WHERE id = p_tenant_id;
    
    RAISE NOTICE 'Successfully deleted tenant: %', p_tenant_id;
END;
$$;

-- Quick cleanup script for test tenant
DO $$
DECLARE
    test_tenant_id uuid := '550e8400-e29b-41d4-a716-446655440000';
BEGIN
    -- Check if this is the problematic tenant from the error message
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = test_tenant_id) THEN
        RAISE NOTICE 'Found problematic tenant, attempting safe cleanup...';
        PERFORM public.safe_delete_tenant(test_tenant_id);
    ELSE
        RAISE NOTICE 'Test tenant % not found in database', test_tenant_id;
    END IF;
END $$;

-- Verification: Check that the tenant is gone and no orphaned records exist
DO $$
DECLARE
    test_tenant_id uuid := '550e8400-e29b-41d4-a716-446655440000';
    remaining_refs integer;
BEGIN
    -- Count any remaining references
    SELECT COUNT(*) INTO remaining_refs FROM (
        SELECT 1 FROM public.tenants WHERE id = test_tenant_id
        UNION ALL
        SELECT 1 FROM public.resources WHERE tenant_id = test_tenant_id
        UNION ALL
        SELECT 1 FROM public.customers WHERE tenant_id = test_tenant_id
        UNION ALL
        SELECT 1 FROM public.customer_metrics WHERE tenant_id = test_tenant_id
        UNION ALL
        SELECT 1 FROM public.services WHERE tenant_id = test_tenant_id
        UNION ALL
        SELECT 1 FROM public.memberships WHERE tenant_id = test_tenant_id
        UNION ALL
        SELECT 1 FROM public.themes WHERE tenant_id = test_tenant_id
    ) refs;
    
    IF remaining_refs = 0 THEN
        RAISE NOTICE '✅ SUCCESS: No remaining references to tenant %', test_tenant_id;
    ELSE
        RAISE NOTICE '❌ WARNING: % remaining references found for tenant %', remaining_refs, test_tenant_id;
    END IF;
END $$;
