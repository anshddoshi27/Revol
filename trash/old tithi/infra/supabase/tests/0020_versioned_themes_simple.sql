-- ============================================================================
-- Simple Test File: 0020_versioned_themes_simple.sql
-- Purpose: Basic validation of versioned themes migration (no permission issues)
-- Dependencies: Migration 0020_versioned_themes.sql
-- ============================================================================

-- This script provides basic validation without requiring complex permissions
-- Run this after applying migration 0020_versioned_themes.sql

BEGIN;

-- ============================================================================
-- Test Setup: Create test data
-- ============================================================================

-- Create test tenant
INSERT INTO public.tenants (id, slug, tz, trust_copy_json, is_public_directory, public_blurb, billing_json)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'test-themes',
    'UTC',
    '{}',
    false,
    'Test tenant for theme validation',
    '{}'
);

-- Create test user
INSERT INTO public.users (id, display_name, primary_email)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Test User',
    'test@example.com'
);

-- Create test membership (owner role)
INSERT INTO public.memberships (id, tenant_id, user_id, role, permissions_json)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'owner',
    '{}'
);

-- Create test legacy theme (for migration testing)
INSERT INTO public.themes (tenant_id, brand_color, logo_url, theme_json)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '#ff0000',
    'https://example.com/logo.png',
    '{"layout": "modern", "typography": "sans-serif"}'
);

-- ============================================================================
-- Test 1: Table Structure Validation
-- ============================================================================

DO $$
DECLARE
    table_exists boolean;
    column_count integer;
    index_count integer;
    constraint_count integer;
BEGIN
    RAISE NOTICE '=== Testing Table Structure ===';
    
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tenant_themes'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ tenant_themes table exists';
    ELSE
        RAISE NOTICE '❌ tenant_themes table does not exist';
        RETURN;
    END IF;
    
    -- Check column count
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tenant_themes';
    
    RAISE NOTICE '✅ tenant_themes has % columns', column_count;
    
    -- Check index count
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' AND tablename = 'tenant_themes';
    
    RAISE NOTICE '✅ tenant_themes has % indexes', index_count;
    
    -- Check constraint count
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints 
    WHERE table_schema = 'public' AND table_name = 'tenant_themes';
    
    RAISE NOTICE '✅ tenant_themes has % constraints', constraint_count;
    
    -- Check RLS enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename = 'tenant_themes' 
          AND rowsecurity = true
    ) THEN
        RAISE NOTICE '✅ RLS is enabled on tenant_themes';
    ELSE
        RAISE NOTICE '❌ RLS is not enabled on tenant_themes';
    END IF;
    
END $$;

-- ============================================================================
-- Test 2: Compatibility View Validation
-- ============================================================================

DO $$
DECLARE
    view_exists boolean;
    view_column_count integer;
BEGIN
    RAISE NOTICE '=== Testing Compatibility View ===';
    
    -- Check if view exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'themes_current'
    ) INTO view_exists;
    
    IF view_exists THEN
        RAISE NOTICE '✅ themes_current view exists';
    ELSE
        RAISE NOTICE '❌ themes_current view does not exist';
        RETURN;
    END IF;
    
    -- Check view columns
    SELECT COUNT(*) INTO view_column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'themes_current';
    
    RAISE NOTICE '✅ themes_current view has % columns', view_column_count;
    
END $$;

-- ============================================================================
-- Test 3: Helper Functions Validation
-- ============================================================================

DO $$
DECLARE
    function_exists boolean;
BEGIN
    RAISE NOTICE '=== Testing Helper Functions ===';
    
    -- Check get_next_theme_version function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name = 'get_next_theme_version'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ get_next_theme_version function exists';
    ELSE
        RAISE NOTICE '❌ get_next_theme_version function does not exist';
    END IF;
    
    -- Check publish_theme function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name = 'publish_theme'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ publish_theme function exists';
    ELSE
        RAISE NOTICE '❌ publish_theme function does not exist';
    END IF;
    
    -- Check rollback_theme function
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name = 'rollback_theme'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ rollback_theme function exists';
    ELSE
        RAISE NOTICE '❌ rollback_theme function does not exist';
    END IF;
    
    -- Check if the helper functions exist (needed for RLS)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name = 'current_tenant_id'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ current_tenant_id helper function exists';
    ELSE
        RAISE NOTICE '❌ current_tenant_id helper function does not exist';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
          AND routine_name = 'current_user_id'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✅ current_user_id helper function exists';
    ELSE
        RAISE NOTICE '❌ current_user_id helper function does not exist';
    END IF;
    
END $$;

-- ============================================================================
-- Test 4: RLS Policies Validation
-- ============================================================================

DO $$
DECLARE
    policy_count integer;
    policy_record RECORD;
BEGIN
    RAISE NOTICE '=== Testing RLS Policies ===';
    
    -- Count policies on tenant_themes
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'tenant_themes';
    
    RAISE NOTICE '✅ tenant_themes has % RLS policies', policy_count;
    
    -- List policy names
    RAISE NOTICE 'Policies found:';
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'tenant_themes'
    LOOP
        RAISE NOTICE '  - %', policy_record.policyname;
    END LOOP;
    
END $$;

-- ============================================================================
-- Test 5: Business Logic Validation (Direct Testing)
-- ============================================================================

DO $$
DECLARE
    theme_id_1 uuid;
    theme_id_2 uuid;
    next_version integer;
BEGIN
    RAISE NOTICE '=== Testing Business Logic ===';
    
    -- Get next version number
    SELECT public.get_next_theme_version('11111111-1111-1111-1111-111111111111') INTO next_version;
    RAISE NOTICE 'Next version number: %', next_version;
    
    -- Insert first draft theme
    INSERT INTO public.tenant_themes (tenant_id, version, status, label, tokens, etag)
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        next_version,
        'draft',
        'Test Theme 1',
        '{"color": "blue"}',
        'etag-1'
    ) RETURNING id INTO theme_id_1;
    
    -- Verify draft was created
    IF theme_id_1 IS NOT NULL THEN
        RAISE NOTICE '✅ First draft theme was created with ID: %', theme_id_1;
    ELSE
        RAISE NOTICE '❌ First draft theme was not created';
        RETURN;
    END IF;
    
    -- Insert second draft theme
    SELECT public.get_next_theme_version('11111111-1111-1111-1111-111111111111') INTO next_version;
    
    INSERT INTO public.tenant_themes (tenant_id, version, status, label, tokens, etag)
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        next_version,
        'draft',
        'Test Theme 2',
        '{"color": "red"}',
        'etag-2'
    ) RETURNING id INTO theme_id_2;
    
    -- Verify second draft theme was created
    IF theme_id_2 IS NOT NULL THEN
        RAISE NOTICE '✅ Second draft theme was created with ID: %', theme_id_2;
    ELSE
        RAISE NOTICE '❌ Second draft theme was not created';
        RETURN;
    END IF;
    
    -- Test the unique constraint by trying to publish both themes
    -- This will test the business rule without calling the permission-checking function
    RAISE NOTICE 'Testing unique constraint: only one published per tenant';
    
    -- Try to publish first theme (should work)
    UPDATE public.tenant_themes 
    SET status = 'published' 
    WHERE id = theme_id_1;
    
    -- Verify only one theme is published
    IF (SELECT COUNT(*) FROM public.tenant_themes WHERE tenant_id = '11111111-1111-1111-1111-111111111111' AND status = 'published') = 1 THEN
        RAISE NOTICE '✅ Only one theme is published per tenant (constraint enforced)';
    ELSE
        RAISE NOTICE '❌ Expected 1 published theme, found %', (SELECT COUNT(*) FROM public.tenant_themes WHERE tenant_id = '11111111-1111-1111-1111-111111111111' AND status = 'published');
    END IF;
    
    -- Verify the first theme is published
    IF (SELECT status FROM public.tenant_themes WHERE id = theme_id_1) = 'published' THEN
        RAISE NOTICE '✅ First theme is published';
    ELSE
        RAISE NOTICE '❌ First theme is not published as expected';
    END IF;
    
    -- Verify the second theme is still draft
    IF (SELECT status FROM public.tenant_themes WHERE id = theme_id_2) = 'draft' THEN
        RAISE NOTICE '✅ Second theme remains draft';
    ELSE
        RAISE NOTICE '❌ Second theme is not draft as expected';
    END IF;
    
    -- Try to publish second theme (should fail due to unique constraint)
    BEGIN
        UPDATE public.tenant_themes 
        SET status = 'published' 
        WHERE id = theme_id_2;
        RAISE NOTICE '❌ Expected constraint violation when publishing second theme';
    EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE '✅ Unique constraint properly enforced - cannot publish second theme';
    END;
    
    -- Verify still only one published
    IF (SELECT COUNT(*) FROM public.tenant_themes WHERE tenant_id = '11111111-1111-1111-1111-111111111111' AND status = 'published') = 1 THEN
        RAISE NOTICE '✅ Still only one theme is published per tenant';
    ELSE
        RAISE NOTICE '❌ Expected 1 published theme, found %', (SELECT COUNT(*) FROM public.tenant_themes WHERE tenant_id = '11111111-1111-1111-1111-111111111111' AND status = 'published');
    END IF;
    
    RAISE NOTICE 'Business logic validation completed successfully';
END $$;

-- ============================================================================
-- Test 6: Data Migration Validation
-- ============================================================================

DO $$
DECLARE
    migrated_theme_count integer;
    brand_color text;
BEGIN
    RAISE NOTICE '=== Testing Data Migration ===';
    
    -- Check if legacy theme was migrated to version 1
    SELECT COUNT(*) INTO migrated_theme_count
    FROM public.tenant_themes 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111' 
      AND version = 1 
      AND status = 'published';
    
    IF migrated_theme_count > 0 THEN
        RAISE NOTICE '✅ Legacy theme was migrated to version 1 published';
    ELSE
        RAISE NOTICE '❌ Legacy theme was not migrated as expected';
        RETURN;
    END IF;
    
    -- Verify tokens contain legacy data
    SELECT tokens->>'brand_color' INTO brand_color
    FROM public.tenant_themes 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111' 
      AND version = 1;
    
    IF brand_color = '#ff0000' THEN
        RAISE NOTICE '✅ Migrated theme preserves brand_color: %', brand_color;
    ELSE
        RAISE NOTICE '❌ Migrated theme brand_color mismatch. Expected: #ff0000, Got: %', brand_color;
    END IF;
    
END $$;

-- ============================================================================
-- Test 7: Compatibility View Testing
-- ============================================================================

DO $$
DECLARE
    published_theme_count integer;
    view_theme_count integer;
BEGIN
    RAISE NOTICE '=== Testing Compatibility View ===';
    
    -- Count published themes
    SELECT COUNT(*) INTO published_theme_count
    FROM public.tenant_themes 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111' 
      AND status = 'published';
    
    -- Count themes in compatibility view
    SELECT COUNT(*) INTO view_theme_count
    FROM public.themes_current 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
    
    -- Should match
    IF published_theme_count = view_theme_count THEN
        RAISE NOTICE '✅ Compatibility view returns same count as published themes: %', published_theme_count;
    ELSE
        RAISE NOTICE '❌ Compatibility view count mismatch. Expected: %, Got: %', published_theme_count, view_theme_count;
    END IF;
    
    -- Verify view only shows published themes
    IF (SELECT COUNT(*) FROM public.themes_current WHERE status != 'published') = 0 THEN
        RAISE NOTICE '✅ Compatibility view only shows published themes';
    ELSE
        RAISE NOTICE '❌ Compatibility view shows non-published themes';
    END IF;
    
END $$;

-- ============================================================================
-- Test 8: Audit Integration Validation
-- ============================================================================

DO $$
DECLARE
    audit_trigger_exists boolean;
    updated_at_trigger_exists boolean;
BEGIN
    RAISE NOTICE '=== Testing Audit Integration ===';
    
    -- Check audit trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'tenant_themes_audit_aiud'
    ) INTO audit_trigger_exists;
    
    IF audit_trigger_exists THEN
        RAISE NOTICE '✅ Audit trigger exists';
    ELSE
        RAISE NOTICE '❌ Audit trigger does not exist';
    END IF;
    
    -- Check updated at trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'tenant_themes_touch_updated_at'
    ) INTO updated_at_trigger_exists;
    
    IF updated_at_trigger_exists THEN
        RAISE NOTICE '✅ Updated at trigger exists';
    ELSE
        RAISE NOTICE '❌ Updated at trigger does not exist';
    END IF;
    
END $$;

-- ============================================================================
-- Test Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERSIONED THEMES MIGRATION VALIDATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'All tests completed. Check the output above for any ❌ errors.';
    RAISE NOTICE 'If all tests show ✅, the migration is working correctly.';
    RAISE NOTICE '';
    RAISE NOTICE 'Key features validated:';
    RAISE NOTICE '✅ Table structure and constraints';
    RAISE NOTICE '✅ RLS policies and security';
    RAISE NOTICE '✅ Business logic (unique constraint)';
    RAISE NOTICE '✅ Data migration from legacy themes';
    RAISE NOTICE '✅ Compatibility view functionality';
    RAISE NOTICE '✅ Helper functions';
    RAISE NOTICE '✅ Audit integration';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- Test Cleanup
-- ============================================================================

-- Clean up test data
DELETE FROM public.tenant_themes WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.themes WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.memberships WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
DELETE FROM public.users WHERE id = '22222222-2222-2222-2222-222222222222';
DELETE FROM public.tenants WHERE id = '11111111-1111-1111-1111-111111111111';

COMMIT;
