-- Quick diagnostic script to check tenant data and foreign key issues
-- Run this first to understand the current database state

DO $$
DECLARE
    tenant_count integer;
    existing_tenant_id uuid;
BEGIN
    RAISE NOTICE 'Debugging tenant and foreign key issues';
    RAISE NOTICE '==========================================';
    
    -- Check if tenants table exists and has data
    SELECT COUNT(*) INTO tenant_count FROM public.tenants;
    RAISE NOTICE 'Total tenants in database: %', tenant_count;
    
    IF tenant_count > 0 THEN
        SELECT id INTO existing_tenant_id FROM public.tenants LIMIT 1;
        RAISE NOTICE 'Sample tenant ID: %', existing_tenant_id;
        
        -- Show first few tenants
        RAISE NOTICE 'First few tenants:';
        FOR existing_tenant_id IN 
            SELECT id FROM public.tenants LIMIT 3
        LOOP
            RAISE NOTICE '  Tenant ID: %', existing_tenant_id;
        END LOOP;
        
    ELSE
        RAISE NOTICE 'No tenants found - creating a test tenant';
        INSERT INTO public.tenants (slug, tz) 
        VALUES ('debug-test-tenant-' || extract(epoch from now())::text, 'UTC') 
        RETURNING id INTO existing_tenant_id;
        RAISE NOTICE 'Created test tenant: %', existing_tenant_id;
    END IF;
    
    -- Check foreign key constraints on usage_counters
    RAISE NOTICE 'Checking foreign key constraints on usage_counters:';
    
    SELECT COUNT(*) INTO tenant_count 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'usage_counters' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id';
    
    RAISE NOTICE 'Foreign key constraints found: %', tenant_count;
    
    -- Test a simple insertion
    BEGIN
        INSERT INTO public.usage_counters (
            tenant_id, code, period_start, period_end, current_count
        ) VALUES (
            existing_tenant_id, 'debug_test', '2024-01-01', '2024-01-31', 1
        );
        RAISE NOTICE '✓ Test insertion successful';
        
        -- Clean up
        DELETE FROM public.usage_counters WHERE code = 'debug_test';
        RAISE NOTICE '✓ Cleanup successful';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Test insertion failed: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Diagnostic complete - you can now run the validation tests';
    
END $$;
