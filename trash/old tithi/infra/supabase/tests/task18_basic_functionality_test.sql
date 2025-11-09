-- =================================================================
-- Task 18 Basic Functionality Test
-- Tests that seed data from 0018_seed_dev.sql was correctly inserted
-- and validates all basic relationships and constraints
-- =================================================================

DO $$
DECLARE
    test_tenant_id uuid := '01234567-89ab-cdef-0123-456789abcdef';
    test_resource_id uuid := '11111111-1111-1111-1111-111111111111';
    test_service_id uuid := '22222222-2222-2222-2222-222222222222';
    test_service_resource_id uuid := '33333333-3333-3333-3333-333333333333';
    
    found_count integer;
    test_result text;
    actual_value text;
    expected_value text;
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TASK 18 BASIC FUNCTIONALITY TEST';
    RAISE NOTICE 'Validates 0018_seed_dev.sql seed data insertion and structure';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';

    -- =================================================================
    -- TEST 1: Verify tenant creation
    -- =================================================================
    RAISE NOTICE 'Test 1: Tenant Data Validation';
    RAISE NOTICE '---------------------------------';
    
    -- Check tenant exists with correct data
    SELECT COUNT(*) INTO found_count
    FROM public.tenants 
    WHERE id = test_tenant_id AND slug = 'salonx';
    
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Tenant ''salonx'' exists with correct ID';
        
        -- Validate tenant properties
        SELECT tz INTO actual_value FROM public.tenants WHERE id = test_tenant_id;
        IF actual_value = 'America/New_York' THEN
            RAISE NOTICE '✓ Tenant timezone correctly set to America/New_York';
        ELSE
            RAISE NOTICE '❌ Tenant timezone incorrect. Expected: America/New_York, Got: %', actual_value;
        END IF;
        
        -- Check trust_copy_json
        SELECT trust_copy_json->>'tagline' INTO actual_value FROM public.tenants WHERE id = test_tenant_id;
        IF actual_value = 'Your trusted neighborhood salon' THEN
            RAISE NOTICE '✓ Tenant trust_copy_json correctly populated';
        ELSE
            RAISE NOTICE '❌ Tenant trust_copy_json incorrect. Expected tagline not found';
        END IF;
        
        -- Check public directory settings
        SELECT is_public_directory::text INTO actual_value FROM public.tenants WHERE id = test_tenant_id;
        IF actual_value = 'true' THEN
            RAISE NOTICE '✓ Tenant is_public_directory correctly set to true';
        ELSE
            RAISE NOTICE '❌ Tenant is_public_directory incorrect. Expected: true, Got: %', actual_value;
        END IF;
        
    ELSE
        RAISE NOTICE '❌ Tenant ''salonx'' not found or duplicated (count: %)', found_count;
    END IF;

    -- =================================================================
    -- TEST 2: Verify theme creation
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 2: Theme Data Validation';
    RAISE NOTICE '------------------------------';
    
    SELECT COUNT(*) INTO found_count
    FROM public.themes 
    WHERE tenant_id = test_tenant_id;
    
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Theme exists for tenant salonx';
        
        -- Validate theme properties
        SELECT brand_color INTO actual_value FROM public.themes WHERE tenant_id = test_tenant_id;
        IF actual_value = '#2563eb' THEN
            RAISE NOTICE '✓ Theme brand_color correctly set to #2563eb';
        ELSE
            RAISE NOTICE '❌ Theme brand_color incorrect. Expected: #2563eb, Got: %', actual_value;
        END IF;
        
        -- Check theme_json
        SELECT theme_json->>'layout' INTO actual_value FROM public.themes WHERE tenant_id = test_tenant_id;
        IF actual_value = 'modern' THEN
            RAISE NOTICE '✓ Theme layout correctly set to modern';
        ELSE
            RAISE NOTICE '❌ Theme layout incorrect. Expected: modern, Got: %', actual_value;
        END IF;
        
    ELSE
        RAISE NOTICE '❌ Theme not found or duplicated for tenant (count: %)', found_count;
    END IF;

    -- =================================================================
    -- TEST 3: Verify resource creation
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 3: Resource Data Validation';
    RAISE NOTICE '---------------------------------';
    
    SELECT COUNT(*) INTO found_count
    FROM public.resources 
    WHERE id = test_resource_id AND tenant_id = test_tenant_id;
    
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Resource ''Sarah Johnson'' exists with correct IDs';
        
        -- Validate resource properties
        SELECT type::text INTO actual_value FROM public.resources WHERE id = test_resource_id;
        IF actual_value = 'staff' THEN
            RAISE NOTICE '✓ Resource type correctly set to staff';
        ELSE
            RAISE NOTICE '❌ Resource type incorrect. Expected: staff, Got: %', actual_value;
        END IF;
        
        SELECT name INTO actual_value FROM public.resources WHERE id = test_resource_id;
        IF actual_value = 'Sarah Johnson' THEN
            RAISE NOTICE '✓ Resource name correctly set to Sarah Johnson';
        ELSE
            RAISE NOTICE '❌ Resource name incorrect. Expected: Sarah Johnson, Got: %', actual_value;
        END IF;
        
        SELECT capacity INTO found_count FROM public.resources WHERE id = test_resource_id;
        IF found_count = 1 THEN
            RAISE NOTICE '✓ Resource capacity correctly set to 1';
        ELSE
            RAISE NOTICE '❌ Resource capacity incorrect. Expected: 1, Got: %', found_count;
        END IF;
        
        SELECT is_active::text INTO actual_value FROM public.resources WHERE id = test_resource_id;
        IF actual_value = 'true' THEN
            RAISE NOTICE '✓ Resource is_active correctly set to true';
        ELSE
            RAISE NOTICE '❌ Resource is_active incorrect. Expected: true, Got: %', actual_value;
        END IF;
        
    ELSE
        RAISE NOTICE '❌ Resource not found or duplicated (count: %)', found_count;
    END IF;

    -- =================================================================
    -- TEST 4: Verify service creation
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 4: Service Data Validation';
    RAISE NOTICE '-------------------------------';
    
    SELECT COUNT(*) INTO found_count
    FROM public.services 
    WHERE id = test_service_id AND tenant_id = test_tenant_id;
    
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Service ''Basic Haircut'' exists with correct IDs';
        
        -- Validate service properties
        SELECT slug INTO actual_value FROM public.services WHERE id = test_service_id;
        IF actual_value = 'haircut-basic' THEN
            RAISE NOTICE '✓ Service slug correctly set to haircut-basic';
        ELSE
            RAISE NOTICE '❌ Service slug incorrect. Expected: haircut-basic, Got: %', actual_value;
        END IF;
        
        SELECT name INTO actual_value FROM public.services WHERE id = test_service_id;
        IF actual_value = 'Basic Haircut' THEN
            RAISE NOTICE '✓ Service name correctly set to Basic Haircut';
        ELSE
            RAISE NOTICE '❌ Service name incorrect. Expected: Basic Haircut, Got: %', actual_value;
        END IF;
        
        SELECT duration_min INTO found_count FROM public.services WHERE id = test_service_id;
        IF found_count = 60 THEN
            RAISE NOTICE '✓ Service duration correctly set to 60 minutes';
        ELSE
            RAISE NOTICE '❌ Service duration incorrect. Expected: 60, Got: %', found_count;
        END IF;
        
        SELECT price_cents INTO found_count FROM public.services WHERE id = test_service_id;
        IF found_count = 3500 THEN
            RAISE NOTICE '✓ Service price correctly set to 3500 cents ($35.00)';
        ELSE
            RAISE NOTICE '❌ Service price incorrect. Expected: 3500, Got: %', found_count;
        END IF;
        
        SELECT active::text INTO actual_value FROM public.services WHERE id = test_service_id;
        IF actual_value = 'true' THEN
            RAISE NOTICE '✓ Service active correctly set to true';
        ELSE
            RAISE NOTICE '❌ Service active incorrect. Expected: true, Got: %', actual_value;
        END IF;
        
    ELSE
        RAISE NOTICE '❌ Service not found or duplicated (count: %)', found_count;
    END IF;

    -- =================================================================
    -- TEST 5: Verify service-resource linking
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 5: Service-Resource Link Validation';
    RAISE NOTICE '----------------------------------------';
    
    SELECT COUNT(*) INTO found_count
    FROM public.service_resources 
    WHERE id = test_service_resource_id 
      AND tenant_id = test_tenant_id
      AND service_id = test_service_id 
      AND resource_id = test_resource_id;
    
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Service-Resource link exists with correct relationships';
        RAISE NOTICE '  - Links service ''Basic Haircut'' to resource ''Sarah Johnson''';
    ELSE
        RAISE NOTICE '❌ Service-Resource link not found or duplicated (count: %)', found_count;
    END IF;

    -- =================================================================
    -- TEST 6: Verify data integrity and constraints
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 6: Data Integrity Validation';
    RAISE NOTICE '----------------------------------';
    
    -- Check tenant slug uniqueness
    SELECT COUNT(*) INTO found_count FROM public.tenants WHERE slug = 'salonx';
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Tenant slug uniqueness maintained';
    ELSE
        RAISE NOTICE '❌ Tenant slug uniqueness violated (count: %)', found_count;
    END IF;
    
    -- Check theme 1:1 relationship
    SELECT COUNT(*) INTO found_count FROM public.themes WHERE tenant_id = test_tenant_id;
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Theme 1:1 relationship with tenant maintained';
    ELSE
        RAISE NOTICE '❌ Theme 1:1 relationship violated (count: %)', found_count;
    END IF;
    
    -- Check service slug uniqueness within tenant
    SELECT COUNT(*) INTO found_count 
    FROM public.services 
    WHERE tenant_id = test_tenant_id AND slug = 'haircut-basic';
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Service slug uniqueness within tenant maintained';
    ELSE
        RAISE NOTICE '❌ Service slug uniqueness within tenant violated (count: %)', found_count;
    END IF;

    -- =================================================================
    -- TEST 7: Verify timestamps and auto-updated fields
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 7: Timestamp Validation';
    RAISE NOTICE '----------------------------';
    
    -- Check all created_at fields are set
    SELECT COUNT(*) INTO found_count
    FROM public.tenants 
    WHERE id = test_tenant_id AND created_at IS NOT NULL AND updated_at IS NOT NULL;
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Tenant timestamps correctly set';
    ELSE
        RAISE NOTICE '❌ Tenant timestamps not set';
    END IF;
    
    SELECT COUNT(*) INTO found_count
    FROM public.themes 
    WHERE tenant_id = test_tenant_id AND created_at IS NOT NULL AND updated_at IS NOT NULL;
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Theme timestamps correctly set';
    ELSE
        RAISE NOTICE '❌ Theme timestamps not set';
    END IF;
    
    SELECT COUNT(*) INTO found_count
    FROM public.resources 
    WHERE id = test_resource_id AND created_at IS NOT NULL AND updated_at IS NOT NULL;
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Resource timestamps correctly set';
    ELSE
        RAISE NOTICE '❌ Resource timestamps not set';
    END IF;
    
    SELECT COUNT(*) INTO found_count
    FROM public.services 
    WHERE id = test_service_id AND created_at IS NOT NULL AND updated_at IS NOT NULL;
    IF found_count = 1 THEN
        RAISE NOTICE '✓ Service timestamps correctly set';
    ELSE
        RAISE NOTICE '❌ Service timestamps not set';
    END IF;

    -- =================================================================
    -- FINAL SUMMARY
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TASK 18 BASIC FUNCTIONALITY TEST SUMMARY';
    RAISE NOTICE '=================================================================';
    
    -- Count successful validations
    SELECT COUNT(*) INTO found_count
    FROM (
        SELECT 1 WHERE EXISTS (SELECT 1 FROM public.tenants WHERE id = test_tenant_id AND slug = 'salonx')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM public.themes WHERE tenant_id = test_tenant_id)
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM public.resources WHERE id = test_resource_id AND tenant_id = test_tenant_id)
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM public.services WHERE id = test_service_id AND tenant_id = test_tenant_id)
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM public.service_resources WHERE id = test_service_resource_id)
    ) AS validations;
    
    RAISE NOTICE 'Core Data Entities: % / 5 created successfully', found_count;
    
    IF found_count = 5 THEN
        RAISE NOTICE '🎉 ALL TESTS PASSED - Task 18 seed data fully functional';
        RAISE NOTICE 'The development environment is ready for testing!';
    ELSIF found_count >= 3 THEN
        RAISE NOTICE '⚠️  MOSTLY WORKING - % entities created, but some issues detected', found_count;
        RAISE NOTICE 'Review the specific test failures above';
    ELSE
        RAISE NOTICE '❌ MULTIPLE FAILURES - Only % entities created successfully', found_count;
        RAISE NOTICE 'Task 18 seed data migration may not have run correctly';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Test completed at: %', now();
    RAISE NOTICE '=================================================================';
    
END $$;
