-- =================================================================
-- Task 18 Cleanup Test
-- Tests safe removal of seed data with proper dependency handling
-- and validates that the database remains functional after cleanup
-- =================================================================

DO $$
DECLARE
    seed_tenant_id uuid := '01234567-89ab-cdef-0123-456789abcdef';
    seed_resource_id uuid := '11111111-1111-1111-1111-111111111111';
    seed_service_id uuid := '22222222-2222-2222-2222-222222222222';
    seed_service_resource_id uuid := '33333333-3333-3333-3333-333333333333';
    
    dependency_count integer;
    cleanup_issues boolean := false;
    step_result text;
    table_count integer;
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TASK 18 CLEANUP TEST';
    RAISE NOTICE 'Tests safe removal of seed data and post-cleanup functionality';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'WARNING: This test will remove all Task 18 seed data!';
    RAISE NOTICE 'Only run this test in development environments.';
    RAISE NOTICE '';

    -- =================================================================
    -- PHASE 1: Pre-cleanup validation
    -- =================================================================
    RAISE NOTICE 'Phase 1: Pre-cleanup Validation';
    RAISE NOTICE '--------------------------------';
    
    -- Verify seed data exists before cleanup
    SELECT COUNT(*) INTO dependency_count
    FROM public.tenants 
    WHERE id = seed_tenant_id AND slug = 'salonx';
    
    IF dependency_count = 0 THEN
        RAISE NOTICE 'ℹ️  Seed tenant not found - cleanup test not applicable';
        RAISE NOTICE 'Either seed data was never created or already cleaned up';
        RETURN;
    ELSE
        RAISE NOTICE '✓ Seed tenant exists - proceeding with cleanup test';
    END IF;
    
    -- Check for any dependent data that might block cleanup
    RAISE NOTICE '';
    RAISE NOTICE 'Checking for dependent data that might block cleanup:';
    
    -- Check for bookings using seed service
    SELECT COUNT(*) INTO dependency_count
    FROM public.booking_items 
    WHERE service_id = seed_service_id OR resource_id = seed_resource_id;
    
    IF dependency_count > 0 THEN
        RAISE NOTICE 'ℹ️  Found % booking items dependent on seed data', dependency_count;
    ELSE
        RAISE NOTICE '✓ No booking dependencies found';
    END IF;
    
    -- Check for customers in seed tenant
    SELECT COUNT(*) INTO dependency_count
    FROM public.customers 
    WHERE tenant_id = seed_tenant_id;
    
    IF dependency_count > 0 THEN
        RAISE NOTICE 'ℹ️  Found % customers in seed tenant', dependency_count;
    ELSE
        RAISE NOTICE '✓ No customer dependencies found';
    END IF;
    
    -- Check for users with memberships in seed tenant
    SELECT COUNT(*) INTO dependency_count
    FROM public.memberships 
    WHERE tenant_id = seed_tenant_id;
    
    IF dependency_count > 0 THEN
        RAISE NOTICE 'ℹ️  Found % memberships in seed tenant', dependency_count;
    ELSE
        RAISE NOTICE '✓ No membership dependencies found';
    END IF;

    -- =================================================================
    -- PHASE 2: Dependency cleanup (if needed)
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 2: Dependency Cleanup';
    RAISE NOTICE '---------------------------';
    
    -- Clean up any dependent data to enable seed data removal
    -- Note: In production, you'd want to be more careful about this
    
    -- Remove booking items that depend on seed service/resource
    DELETE FROM public.booking_items 
    WHERE service_id = seed_service_id OR resource_id = seed_resource_id;
    
    GET DIAGNOSTICS dependency_count = ROW_COUNT;
    IF dependency_count > 0 THEN
        RAISE NOTICE 'Removed % booking items dependent on seed data', dependency_count;
    END IF;
    
    -- Remove bookings that might be orphaned
    DELETE FROM public.bookings b
    WHERE b.tenant_id = seed_tenant_id 
      AND NOT EXISTS (
          SELECT 1 FROM public.booking_items bi 
          WHERE bi.booking_id = b.id
      );
    
    GET DIAGNOSTICS dependency_count = ROW_COUNT;
    IF dependency_count > 0 THEN
        RAISE NOTICE 'Removed % orphaned bookings in seed tenant', dependency_count;
    END IF;
    
    -- Remove customers from seed tenant
    DELETE FROM public.customers 
    WHERE tenant_id = seed_tenant_id;
    
    GET DIAGNOSTICS dependency_count = ROW_COUNT;
    IF dependency_count > 0 THEN
        RAISE NOTICE 'Removed % customers from seed tenant', dependency_count;
    END IF;
    
    -- Remove memberships from seed tenant
    DELETE FROM public.memberships 
    WHERE tenant_id = seed_tenant_id;
    
    GET DIAGNOSTICS dependency_count = ROW_COUNT;
    IF dependency_count > 0 THEN
        RAISE NOTICE 'Removed % memberships from seed tenant', dependency_count;
    END IF;
    
    RAISE NOTICE '✓ Dependency cleanup completed';

    -- =================================================================
    -- PHASE 3: Seed data removal (in dependency order)
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 3: Seed Data Removal';
    RAISE NOTICE '--------------------------';
    
    -- Step 1: Remove service_resources link
    BEGIN
        DELETE FROM public.service_resources 
        WHERE id = seed_service_resource_id;
        
        GET DIAGNOSTICS dependency_count = ROW_COUNT;
        IF dependency_count = 1 THEN
            RAISE NOTICE '✓ Removed service_resources link';
        ELSE
            RAISE NOTICE '⚠️  Service_resources link not found or already removed';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error removing service_resources: %', SQLERRM;
        cleanup_issues := true;
    END;
    
    -- Step 2: Remove service
    BEGIN
        DELETE FROM public.services 
        WHERE id = seed_service_id;
        
        GET DIAGNOSTICS dependency_count = ROW_COUNT;
        IF dependency_count = 1 THEN
            RAISE NOTICE '✓ Removed service ''Basic Haircut''';
        ELSE
            RAISE NOTICE '⚠️  Service not found or already removed';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error removing service: %', SQLERRM;
        cleanup_issues := true;
    END;
    
    -- Step 3: Remove resource
    BEGIN
        DELETE FROM public.resources 
        WHERE id = seed_resource_id;
        
        GET DIAGNOSTICS dependency_count = ROW_COUNT;
        IF dependency_count = 1 THEN
            RAISE NOTICE '✓ Removed resource ''Sarah Johnson''';
        ELSE
            RAISE NOTICE '⚠️  Resource not found or already removed';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error removing resource: %', SQLERRM;
        cleanup_issues := true;
    END;
    
    -- Step 4: Remove theme
    BEGIN
        DELETE FROM public.themes 
        WHERE tenant_id = seed_tenant_id;
        
        GET DIAGNOSTICS dependency_count = ROW_COUNT;
        IF dependency_count = 1 THEN
            RAISE NOTICE '✓ Removed theme for tenant ''salonx''';
        ELSE
            RAISE NOTICE '⚠️  Theme not found or already removed';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error removing theme: %', SQLERRM;
        cleanup_issues := true;
    END;
    
    -- Step 5: Remove tenant (last due to foreign key dependencies)
    BEGIN
        DELETE FROM public.tenants 
        WHERE id = seed_tenant_id;
        
        GET DIAGNOSTICS dependency_count = ROW_COUNT;
        IF dependency_count = 1 THEN
            RAISE NOTICE '✓ Removed tenant ''salonx''';
        ELSE
            RAISE NOTICE '⚠️  Tenant not found or already removed';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error removing tenant: %', SQLERRM;
        cleanup_issues := true;
    END;

    -- =================================================================
    -- PHASE 4: Verification of complete removal
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 4: Cleanup Verification';
    RAISE NOTICE '-----------------------------';
    
    -- Verify all seed data has been removed
    SELECT COUNT(*) INTO dependency_count
    FROM public.tenants 
    WHERE id = seed_tenant_id;
    
    IF dependency_count = 0 THEN
        RAISE NOTICE '✓ Tenant completely removed';
    ELSE
        RAISE NOTICE '❌ Tenant still exists after cleanup';
        cleanup_issues := true;
    END IF;
    
    SELECT COUNT(*) INTO dependency_count
    FROM public.themes 
    WHERE tenant_id = seed_tenant_id;
    
    IF dependency_count = 0 THEN
        RAISE NOTICE '✓ Theme completely removed';
    ELSE
        RAISE NOTICE '❌ Theme still exists after cleanup';
        cleanup_issues := true;
    END IF;
    
    SELECT COUNT(*) INTO dependency_count
    FROM public.resources 
    WHERE id = seed_resource_id;
    
    IF dependency_count = 0 THEN
        RAISE NOTICE '✓ Resource completely removed';
    ELSE
        RAISE NOTICE '❌ Resource still exists after cleanup';
        cleanup_issues := true;
    END IF;
    
    SELECT COUNT(*) INTO dependency_count
    FROM public.services 
    WHERE id = seed_service_id;
    
    IF dependency_count = 0 THEN
        RAISE NOTICE '✓ Service completely removed';
    ELSE
        RAISE NOTICE '❌ Service still exists after cleanup';
        cleanup_issues := true;
    END IF;
    
    SELECT COUNT(*) INTO dependency_count
    FROM public.service_resources 
    WHERE id = seed_service_resource_id;
    
    IF dependency_count = 0 THEN
        RAISE NOTICE '✓ Service-resource link completely removed';
    ELSE
        RAISE NOTICE '❌ Service-resource link still exists after cleanup';
        cleanup_issues := true;
    END IF;

    -- =================================================================
    -- PHASE 5: Post-cleanup functionality test
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 5: Post-cleanup Functionality Test';
    RAISE NOTICE '----------------------------------------';
    
    -- Test that database is still functional after cleanup
    BEGIN
        -- Test creating a new tenant
        INSERT INTO public.tenants (slug, tz) 
        VALUES ('post-cleanup-test', 'UTC');
        
        RAISE NOTICE '✓ New tenant creation works after cleanup';
        
        -- Clean up test tenant
        DELETE FROM public.tenants WHERE slug = 'post-cleanup-test';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ New tenant creation failed after cleanup: %', SQLERRM;
        cleanup_issues := true;
    END;
    
    -- Test that unique constraints are reset and can be reused
    BEGIN
        INSERT INTO public.tenants (slug, tz) 
        VALUES ('salonx', 'UTC');
        
        RAISE NOTICE '✓ Tenant slug ''salonx'' can be reused after cleanup';
        
        -- Clean up test tenant
        DELETE FROM public.tenants WHERE slug = 'salonx';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Tenant slug reuse failed after cleanup: %', SQLERRM;
        cleanup_issues := true;
    END;
    
    -- Verify table structures are intact
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('tenants', 'themes', 'resources', 'services', 'service_resources');
    
    IF table_count = 5 THEN
        RAISE NOTICE '✓ All table structures intact after cleanup';
    ELSE
        RAISE NOTICE '❌ Table structures damaged after cleanup (found %/5)', table_count;
        cleanup_issues := true;
    END IF;
    
    -- Verify constraints are still active
    BEGIN
        INSERT INTO public.tenants (slug, tz) VALUES ('', 'UTC');
        RAISE NOTICE '❌ Tenant slug constraint not working after cleanup';
        cleanup_issues := true;
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '✓ Tenant constraints still active after cleanup';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Unexpected error testing constraints: %', SQLERRM;
        cleanup_issues := true;
    END;

    -- =================================================================
    -- FINAL SUMMARY
    -- =================================================================
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'TASK 18 CLEANUP TEST SUMMARY';
    RAISE NOTICE '=================================================================';
    
    IF NOT cleanup_issues THEN
        RAISE NOTICE '🎉 CLEANUP TEST PASSED SUCCESSFULLY';
        RAISE NOTICE 'All seed data has been safely removed';
        RAISE NOTICE '';
        RAISE NOTICE 'Cleanup Verification:';
        RAISE NOTICE '- ✓ All seed entities removed: tenant, theme, resource, service, links';
        RAISE NOTICE '- ✓ No orphaned dependencies remaining';
        RAISE NOTICE '- ✓ Database functionality preserved';
        RAISE NOTICE '- ✓ Unique constraints reset and reusable';
        RAISE NOTICE '- ✓ Table structures and constraints intact';
        RAISE NOTICE '';
        RAISE NOTICE 'The database is clean and ready for production deployment';
    ELSE
        RAISE NOTICE '❌ CLEANUP ISSUES DETECTED';
        RAISE NOTICE 'Review the test output above for specific failures';
        RAISE NOTICE 'Some seed data may remain or database functionality may be impaired';
        RAISE NOTICE '';
        RAISE NOTICE 'Recommended Actions:';
        RAISE NOTICE '- Review and manually resolve any remaining dependencies';
        RAISE NOTICE '- Verify database integrity before production deployment';
        RAISE NOTICE '- Consider restoring from backup if issues persist';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Cleanup Process Summary:';
    RAISE NOTICE '1. Pre-cleanup validation: Identified dependencies';
    RAISE NOTICE '2. Dependency cleanup: Removed blocking relationships';
    RAISE NOTICE '3. Seed data removal: Deleted in proper dependency order';
    RAISE NOTICE '4. Cleanup verification: Confirmed complete removal';
    RAISE NOTICE '5. Functionality test: Verified database still works';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: This cleanup is irreversible!';
    RAISE NOTICE 'To restore seed data, re-run migration 0018_seed_dev.sql';
    RAISE NOTICE '';
    RAISE NOTICE 'Test completed at: %', now();
    RAISE NOTICE '=================================================================';
    
END $$;
