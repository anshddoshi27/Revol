-- ============================================================================
-- Debug Script: debug_0020_migration.sql
-- Purpose: Check what's actually in the database after migration
-- ============================================================================

-- This script will help diagnose what's happening with the migration

-- Checking if tenant_themes table exists
SELECT '=== Checking if tenant_themes table exists ===' as section;
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenant_themes'
) as table_exists;

-- Checking tenant_themes table structure
SELECT '=== Checking tenant_themes table structure ===' as section;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'tenant_themes'
ORDER BY ordinal_position;

-- Checking if any data exists in tenant_themes
SELECT '=== Checking if any data exists in tenant_themes ===' as section;
SELECT COUNT(*) as total_rows FROM public.tenant_themes;

-- Checking if themes_current view exists
SELECT '=== Checking if themes_current view exists ===' as section;
SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'themes_current'
) as view_exists;

-- Checking if any data exists in themes_current view
SELECT '=== Checking if any data exists in themes_current view ===' as section;
SELECT COUNT(*) as view_rows FROM public.themes_current;

-- Checking if legacy themes table has data
SELECT '=== Checking if legacy themes table has data ===' as section;
SELECT COUNT(*) as legacy_themes FROM public.themes;

-- Checking if test tenant exists
SELECT '=== Checking if test tenant exists ===' as section;
SELECT id, slug, deleted_at FROM public.tenants WHERE slug = 'test-themes';

-- Checking if test user exists
SELECT '=== Checking if test user exists ===' as section;
SELECT id, display_name FROM public.users WHERE display_name = 'Test User';

-- Checking if test membership exists
SELECT '=== Checking if test membership exists ===' as section;
SELECT id, tenant_id, user_id, role FROM public.memberships 
WHERE tenant_id IN (SELECT id FROM public.tenants WHERE slug = 'test-themes');

-- Checking if helper functions exist
SELECT '=== Checking if helper functions exist ===' as section;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_next_theme_version', 'publish_theme', 'rollback_theme')
ORDER BY routine_name;

-- Checking RLS policies
SELECT '=== Checking RLS policies ===' as section;
SELECT policyname, cmd, permissive 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'tenant_themes';

-- Checking triggers
SELECT '=== Checking triggers ===' as section;
SELECT tgname, tgtype, tgenabled 
FROM pg_trigger 
WHERE tgrelid = 'tenant_themes'::regclass;

-- Checking indexes
SELECT '=== Checking indexes ===' as section;
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'tenant_themes';

-- Checking constraints
SELECT '=== Checking constraints ===' as section;
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'tenant_themes'::regclass;

-- Sample data from tenant_themes (if any)
SELECT '=== Sample data from tenant_themes (if any) ===' as section;
SELECT * FROM public.tenant_themes LIMIT 5;

-- Sample data from themes_current view (if any)
SELECT '=== Sample data from themes_current view (if any) ===' as section;
SELECT * FROM public.themes_current LIMIT 5;
