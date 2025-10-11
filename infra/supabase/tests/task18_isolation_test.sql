-- =================================================================
-- Task 18 Isolation Test
-- Tests that seed data from 0018_seed_dev.sql doesn't conflict with
-- existing data and maintains proper isolation boundaries
-- =================================================================

DO $$
DECLARE
    seed_tenant_id uuid := '01234567-89ab-cdef-0123-456789abcdef';
    seed_resource_id uuid := '11111111-1111-1111-1111-111111111111';
    seed_service_id uuid := '22222222-2222-2222-2222-222222222222';
    
    other_tenant_id uuid;
    other_resource_id uuid;
    other_service_id uuid;
    
    conflict_count integer;
    test_count integer;
    isolation_violation boolean := false;
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TASK 18 ISOLATION TEST';
    RAISE NOTICE 'Ensures seed data maintains proper isolation and no conflicts';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';

    -- =================================================================
    -- TEST 1: Verify no duplicate slugs across different tenants
    -- =================================================================
    RAISE NOTICE 'Test 1: Cross-Tenant Slug Isolation';
    RAISE NOTICE '-----------------------------------';
    
    -- Create a test tenant to verify isolation
    INSERT INTO public.tenants (slug, tz) 
    VALUES ('isolation-test-' || extract(epoch from now())::text, 'UTC') 
    RETURNING id INTO other_tenant_id;
    
    RAISE NOTICE 'Created test tenant: %', other_tenant_id;
    
    -- Try to create a service with the same slug in different tenant (should succeed)
    BEGIN
        INSERT INTO public.services (
            tenant_id, slug, name, description, duration_min, price_cents, category, active
        ) VALUES (
            other_tenant_id, 'haircut-basic', 'Different Basic Haircut', 
            'Same slug but different tenant', 45, 4000, 'haircuts', true
        ) RETURNING id INTO other_service_id;
        
        RAISE NOTICE '✓ Service slug isolation working - same slug allowed in different tenant';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Service slug isolation failed: %', SQLERRM;
        isolation_violation := true;
    END;
    
    -- Verify the original seed service still exists
    SELECT COUNT(*) INTO test_count 
    FROM public.services 
    WHERE id = seed_service_id AND tenant_id = seed_tenant_id AND slug = 'haircut-basic';
    
    IF test_count = 1 THEN
        RAISE NOTICE '✓ Original seed service unaffected by isolation test';
    ELSE
        RAISE NOTICE '❌ Original seed service affected by isolation test';
        isolation_violation := true;
    END IF;

    -- =================================================================
    -- TEST 2: Verify tenant slug uniqueness globally
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 2: Global Tenant Slug Uniqueness';
    RAISE NOTICE '------------------------------------';
    
    -- Try to create a tenant with the same slug as seed data (should fail)
    BEGIN
        INSERT INTO public.tenants (slug, tz) 
        VALUES ('salonx', 'Europe/London');
        
        RAISE NOTICE '❌ Global tenant slug uniqueness violated - duplicate ''salonx'' allowed';
        isolation_violation := true;
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Global tenant slug uniqueness maintained - duplicate ''salonx'' rejected';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Unexpected error testing tenant slug uniqueness: %', SQLERRM;
        isolation_violation := true;
    END;

    -- =================================================================
    -- TEST 3: Verify resource isolation within tenants
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 3: Resource Tenant Isolation';
    RAISE NOTICE '---------------------------------';
    
    -- Create a resource in the test tenant
    INSERT INTO public.resources (
        tenant_id, type, tz, capacity, name, is_active
    ) VALUES (
        other_tenant_id, 'staff', 'UTC', 1, 'Test Staff Member', true
    ) RETURNING id INTO other_resource_id;
    
    RAISE NOTICE 'Created test resource: %', other_resource_id;
    
    -- Try to link the seed service to the test resource (should fail due to composite FK)
    BEGIN
        INSERT INTO public.service_resources (
            tenant_id, service_id, resource_id
        ) VALUES (
            seed_tenant_id, seed_service_id, other_resource_id
        );
        
        RAISE NOTICE '❌ Cross-tenant resource linking allowed - isolation violated';
        isolation_violation := true;
    EXCEPTION WHEN foreign_key_violation THEN
        RAISE NOTICE '✓ Cross-tenant resource linking prevented by composite foreign key';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Unexpected error testing cross-tenant linking: %', SQLERRM;
        isolation_violation := true;
    END;

    -- =================================================================
    -- TEST 4: Verify theme 1:1 relationship isolation
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 4: Theme Relationship Isolation';
    RAISE NOTICE '-----------------------------------';
    
    -- Try to create a second theme for the seed tenant (should fail)
    BEGIN
        INSERT INTO public.themes (
            tenant_id, brand_color, logo_url, theme_json
        ) VALUES (
            seed_tenant_id, '#ff0000', 'https://example.com/logo2.png', 
            '{"layout": "classic"}'::jsonb
        );
        
        RAISE NOTICE '❌ Multiple themes allowed for single tenant - 1:1 relationship violated';
        isolation_violation := true;
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Theme 1:1 relationship maintained - duplicate theme rejected';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Unexpected error testing theme uniqueness: %', SQLERRM;
        isolation_violation := true;
    END;
    
    -- Create theme for test tenant (should succeed)
    BEGIN
        INSERT INTO public.themes (
            tenant_id, brand_color, logo_url, theme_json
        ) VALUES (
            other_tenant_id, '#00ff00', 'https://example.com/test-logo.png', 
            '{"layout": "minimal"}'::jsonb
        );
        
        RAISE NOTICE '✓ Theme creation for different tenant successful';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Theme creation for different tenant failed: %', SQLERRM;
        isolation_violation := true;
    END;

    -- =================================================================
    -- TEST 5: Verify customer data isolation
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 5: Customer Data Isolation';
    RAISE NOTICE '------------------------------';
    
    -- Create customers in both tenants with same email (should succeed due to partial unique)
    BEGIN
        -- Customer in seed tenant
        INSERT INTO public.customers (
            tenant_id, display_name, email
        ) VALUES (
            seed_tenant_id, 'John Doe (Seed)', 'john.doe@example.com'
        );
        
        -- Customer in test tenant with same email
        INSERT INTO public.customers (
            tenant_id, display_name, email  
        ) VALUES (
            other_tenant_id, 'John Doe (Test)', 'john.doe@example.com'
        );
        
        RAISE NOTICE '✓ Customer email isolation working - same email allowed in different tenants';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Customer email isolation failed: %', SQLERRM;
        isolation_violation := true;
    END;
    
    -- Try to create duplicate customer email in same tenant (should fail)
    BEGIN
        INSERT INTO public.customers (
            tenant_id, display_name, email
        ) VALUES (
            seed_tenant_id, 'John Doe Duplicate', 'john.doe@example.com'
        );
        
        RAISE NOTICE '❌ Customer email uniqueness within tenant violated';
        isolation_violation := true;
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✓ Customer email uniqueness within tenant maintained';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Unexpected error testing customer email uniqueness: %', SQLERRM;
        isolation_violation := true;
    END;

    -- =================================================================
    -- TEST 6: Verify ID collision detection
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test 6: ID Collision Detection';
    RAISE NOTICE '------------------------------';
    
    -- Check if any existing data uses the same UUIDs as seed data
    SELECT COUNT(*) INTO conflict_count
    FROM (
        SELECT id FROM public.tenants WHERE id = seed_tenant_id AND slug != 'salonx'
        UNION ALL
        SELECT id FROM public.resources WHERE id = seed_resource_id AND tenant_id != seed_tenant_id
        UNION ALL  
        SELECT id FROM public.services WHERE id = seed_service_id AND tenant_id != seed_tenant_id
    ) AS conflicts;
    
    IF conflict_count = 0 THEN
        RAISE NOTICE '✓ No UUID conflicts detected with existing data';
    ELSE
        RAISE NOTICE '❌ UUID conflicts detected: % conflicts found', conflict_count;
        isolation_violation := true;
    END IF;
    
    -- Verify ON CONFLICT DO NOTHING behavior
    BEGIN
        -- Try to re-insert the same seed data (should be ignored)
        INSERT INTO public.tenants (
            id, slug, tz, trust_copy_json, is_public_directory, public_blurb, billing_json
        ) VALUES (
            seed_tenant_id, 'salonx', 'America/New_York',
            '{"tagline": "Your trusted neighborhood salon", "guarantee": "100% satisfaction guaranteed"}',
            true, 'Modern salon services with experienced professionals',
            '{"plan": "pro", "trial_days": 30}'
        ) ON CONFLICT (id) DO NOTHING;
        
        -- Verify only one instance exists
        SELECT COUNT(*) INTO test_count FROM public.tenants WHERE id = seed_tenant_id;
        IF test_count = 1 THEN
            RAISE NOTICE '✓ ON CONFLICT DO NOTHING working correctly for tenants';
        ELSE
            RAISE NOTICE '❌ ON CONFLICT DO NOTHING not working - count: %', test_count;
            isolation_violation := true;
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error testing ON CONFLICT behavior: %', SQLERRM;
        isolation_violation := true;
    END;

    -- =================================================================
    -- CLEANUP TEST DATA
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Test Cleanup: Removing temporary test data';
    RAISE NOTICE '-------------------------------------------';
    
    -- Clean up test data (preserve seed data)
    DELETE FROM public.customers WHERE tenant_id = other_tenant_id;
    DELETE FROM public.themes WHERE tenant_id = other_tenant_id;
    DELETE FROM public.service_resources WHERE service_id = other_service_id;
    DELETE FROM public.services WHERE id = other_service_id;
    DELETE FROM public.resources WHERE id = other_resource_id;
    DELETE FROM public.tenants WHERE id = other_tenant_id;
    
    RAISE NOTICE '✓ Test cleanup completed - seed data preserved';

    -- =================================================================
    -- FINAL SUMMARY
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TASK 18 ISOLATION TEST SUMMARY';
    RAISE NOTICE '=================================================================';
    
    IF NOT isolation_violation THEN
        RAISE NOTICE '🎉 ALL ISOLATION TESTS PASSED';
        RAISE NOTICE 'Seed data maintains proper isolation boundaries';
        RAISE NOTICE '- Tenant slug uniqueness: ✓ Global enforcement';
        RAISE NOTICE '- Service slug uniqueness: ✓ Per-tenant enforcement';
        RAISE NOTICE '- Customer email uniqueness: ✓ Per-tenant enforcement';
        RAISE NOTICE '- Cross-tenant relationships: ✓ Properly blocked';
        RAISE NOTICE '- Theme 1:1 relationship: ✓ Enforced';
        RAISE NOTICE '- UUID collision detection: ✓ No conflicts';
        RAISE NOTICE '- ON CONFLICT behavior: ✓ Working correctly';
    ELSE
        RAISE NOTICE '❌ ISOLATION VIOLATIONS DETECTED';
        RAISE NOTICE 'Review the test output above for specific failures';
        RAISE NOTICE 'Some isolation boundaries may be compromised';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Key Isolation Principles Verified:';
    RAISE NOTICE '- Multi-tenancy: Each tenant operates independently';
    RAISE NOTICE '- Data integrity: Cross-tenant relationships prevented';
    RAISE NOTICE '- Uniqueness constraints: Properly scoped to tenant or global';
    RAISE NOTICE '- Idempotent operations: ON CONFLICT DO NOTHING working';
    RAISE NOTICE '';
    RAISE NOTICE 'Test completed at: %', now();
    RAISE NOTICE '=================================================================';
    
END $$;
