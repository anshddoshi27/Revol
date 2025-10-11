BEGIN;

-- ============================================================================
-- Migration: 0020_versioned_themes.sql
-- Purpose: Introduce versioned themes with publish/rollback and history
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)
-- ============================================================================

-- Goal: Tenants can save multiple theme versions they like, publish one, 
-- and roll back later. Keep existing 1:1 branding behavior available via 
-- a compatibility view for current "read current theme" paths.

-- ============================================================================
-- 1) Create tenant_themes table (append-friendly)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_themes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    version integer NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    label text NULL,  -- human-friendly name ("Spring 2026")
    tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
    etag text NOT NULL,
    created_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2) Uniqueness constraints and indexes
-- ============================================================================

-- Unique (tenant_id, version) - each version per tenant is unique
CREATE UNIQUE INDEX IF NOT EXISTS tenant_themes_tenant_version_uniq
ON public.tenant_themes (tenant_id, version);

-- Unique (tenant_id) where status='published' - at most one published per tenant
CREATE UNIQUE INDEX IF NOT EXISTS tenant_themes_tenant_published_uniq
ON public.tenant_themes (tenant_id) WHERE status = 'published';

-- Index for efficient tenant lookups
CREATE INDEX IF NOT EXISTS tenant_themes_tenant_id_idx
ON public.tenant_themes (tenant_id);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS tenant_themes_status_idx
ON public.tenant_themes (status);

-- Index for created_by lookups
CREATE INDEX IF NOT EXISTS tenant_themes_created_by_idx
ON public.tenant_themes (created_by);

-- ============================================================================
-- 3) Enable RLS and create policies
-- ============================================================================
-- Note: Policies are dropped and recreated to ensure clean state on re-runs

ALTER TABLE public.tenant_themes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to ensure clean recreation
DROP POLICY IF EXISTS "tenant_themes_sel_members" ON public.tenant_themes;
DROP POLICY IF EXISTS "tenant_themes_ins_owner_admin" ON public.tenant_themes;
DROP POLICY IF EXISTS "tenant_themes_upd_owner_admin" ON public.tenant_themes;

-- SELECT: Members can read themes for their tenants
CREATE POLICY "tenant_themes_sel_members"
ON public.tenant_themes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenant_themes.tenant_id
          AND m.user_id = public.current_user_id()
    )
);

-- INSERT: Only owners and admins can create themes
CREATE POLICY "tenant_themes_ins_owner_admin"
ON public.tenant_themes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenant_themes.tenant_id
          AND m.user_id = public.current_user_id()
          AND m.role IN ('owner', 'admin')
    )
);

-- UPDATE: Only owners and admins can modify themes
-- Special handling for status changes (publish/rollback)
CREATE POLICY "tenant_themes_upd_owner_admin"
ON public.tenant_themes
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenant_themes.tenant_id
          AND m.user_id = public.current_user_id()
          AND m.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenant_themes.tenant_id
          AND m.user_id = public.current_user_id()
          AND m.role IN ('owner', 'admin')
    )
);

-- DELETE: Denied (append-only design)
-- No DELETE policy means DELETE operations are denied by default

-- ============================================================================
-- 4) Compatibility view: themes_current
-- ============================================================================

-- Create a view that returns the currently published row per tenant (or NULL if none)
-- This preserves the old 1:1 read behavior for consumers
CREATE OR REPLACE VIEW public.themes_current AS
SELECT 
    tt.tenant_id,
    tt.id as theme_id,
    tt.version,
    tt.status,
    tt.label,
    tt.tokens,
    tt.etag,
    tt.created_by,
    tt.created_at,
    tt.updated_at
FROM public.tenant_themes tt
WHERE tt.status = 'published';

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.themes_current TO authenticated;

-- ============================================================================
-- 5) Data backfill from legacy themes table
-- ============================================================================

-- For each tenant with a legacy theme, insert a version 1 row in tenant_themes
-- with status='published', copying tokens/fields; set a stable etag
-- This backfill must be safe to re-run (check existence per-tenant)
DO $$
DECLARE
    tenant_record RECORD;
    existing_theme_count INTEGER;
    stable_etag TEXT;
BEGIN
    -- Loop through all tenants that have legacy themes
    FOR tenant_record IN 
        SELECT t.id, t.slug, th.brand_color, th.logo_url, th.theme_json
        FROM public.tenants t
        JOIN public.themes th ON t.id = th.tenant_id
        WHERE t.deleted_at IS NULL
    LOOP
        -- Check if this tenant already has a version 1 theme
        SELECT COUNT(*) INTO existing_theme_count
        FROM public.tenant_themes tt
        WHERE tt.tenant_id = tenant_record.id AND tt.version = 1;
        
        -- Only create if no version 1 exists
        IF existing_theme_count = 0 THEN
            -- Create a stable etag based on tenant slug and current timestamp
            stable_etag := 'legacy-' || tenant_record.slug || '-' || 
                          to_char(now(), 'YYYYMMDD-HH24MISS');
            
            -- Insert the legacy theme as version 1 published
            INSERT INTO public.tenant_themes (
                tenant_id,
                version,
                status,
                label,
                tokens,
                etag,
                created_at,
                updated_at
            ) VALUES (
                tenant_record.id,
                1,
                'published',
                'Legacy Theme',
                jsonb_build_object(
                    'brand_color', tenant_record.brand_color,
                    'logo_url', tenant_record.logo_url,
                    'theme_json', tenant_record.theme_json
                ),
                stable_etag,
                now(),
                now()
            );
            
            RAISE NOTICE 'Migrated legacy theme for tenant % (slug: %) to version 1', 
                        tenant_record.id, tenant_record.slug;
        ELSE
            RAISE NOTICE 'Tenant % already has version 1 theme, skipping migration', 
                        tenant_record.id;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- 6) Audit integration
-- ============================================================================

-- Attach audit trigger to tenant_themes table
DROP TRIGGER IF EXISTS tenant_themes_audit_aiud ON public.tenant_themes;
CREATE TRIGGER tenant_themes_audit_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.tenant_themes
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Attach touch_updated_at trigger
DROP TRIGGER IF EXISTS tenant_themes_touch_updated_at ON public.tenant_themes;
CREATE TRIGGER tenant_themes_touch_updated_at
    BEFORE INSERT OR UPDATE ON public.tenant_themes
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 7) Helper functions for theme management
-- ============================================================================

-- Function to get the next version number for a tenant
CREATE OR REPLACE FUNCTION public.get_next_theme_version(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_version integer;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1
    INTO next_version
    FROM public.tenant_themes
    WHERE tenant_id = p_tenant_id;
    
    RETURN next_version;
END;
$$;

-- Function to publish a theme (automatically unpublishes others)
CREATE OR REPLACE FUNCTION public.publish_theme(p_theme_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_uuid uuid;
BEGIN
    -- Get the tenant_id for this theme
    SELECT tenant_id INTO tenant_uuid
    FROM public.tenant_themes
    WHERE id = p_theme_id;
    
    IF tenant_uuid IS NULL THEN
        RAISE EXCEPTION 'Theme with id % not found', p_theme_id;
    END IF;
    
    -- Verify the user has permission to publish themes for this tenant
    IF NOT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = tenant_uuid
          AND m.user_id = public.current_user_id()
          AND m.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to publish themes for this tenant';
    END IF;
    
    -- Unpublish all other themes for this tenant
    UPDATE public.tenant_themes
    SET status = 'archived', updated_at = now()
    WHERE tenant_id = tenant_uuid AND status = 'published';
    
    -- Publish the specified theme
    UPDATE public.tenant_themes
    SET status = 'published', updated_at = now()
    WHERE id = p_theme_id;
    
    RAISE NOTICE 'Theme % published for tenant %', p_theme_id, tenant_uuid;
END;
$$;

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION public.rollback_theme(p_tenant_id uuid, p_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify the user has permission to rollback themes for this tenant
    IF NOT EXISTS (
        SELECT 1 FROM public.memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = public.current_user_id()
          AND m.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to rollback themes for this tenant';
    END IF;
    
    -- Verify the target version exists
    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_themes
        WHERE tenant_id = p_tenant_id AND version = p_version
    ) THEN
        RAISE EXCEPTION 'Theme version % not found for tenant %', p_version, p_tenant_id;
    END IF;
    
    -- Unpublish current theme
    UPDATE public.tenant_themes
    SET status = 'archived', updated_at = now()
    WHERE tenant_id = p_tenant_id AND status = 'published';
    
    -- Publish the target version
    UPDATE public.tenant_themes
    SET status = 'published', updated_at = now()
    WHERE tenant_id = p_tenant_id AND version = p_version;
    
    RAISE NOTICE 'Rolled back to theme version % for tenant %', p_version, p_tenant_id;
END;
$$;

-- ============================================================================
-- 8) Validation and constraints
-- ============================================================================
-- Note: Constraints are dropped and recreated to ensure clean state on re-runs

-- Drop existing constraints if they exist
ALTER TABLE public.tenant_themes DROP CONSTRAINT IF EXISTS tenant_themes_etag_not_empty;
ALTER TABLE public.tenant_themes DROP CONSTRAINT IF EXISTS tenant_themes_tokens_not_null;
ALTER TABLE public.tenant_themes DROP CONSTRAINT IF EXISTS tenant_themes_version_positive;

-- Ensure etag is not empty
ALTER TABLE public.tenant_themes 
ADD CONSTRAINT tenant_themes_etag_not_empty 
CHECK (etag != '');

-- Ensure tokens is not null
ALTER TABLE public.tenant_themes 
ADD CONSTRAINT tenant_themes_tokens_not_null 
CHECK (tokens IS NOT NULL);

-- Ensure version is positive
ALTER TABLE public.tenant_themes 
ADD CONSTRAINT tenant_themes_version_positive 
CHECK (version > 0);

-- ============================================================================
-- 9) Grant permissions
-- ============================================================================

-- Grant appropriate permissions to authenticated users
GRANT SELECT ON public.tenant_themes TO authenticated;
GRANT INSERT, UPDATE ON public.tenant_themes TO authenticated;

-- Grant usage on sequences (if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- Migration Summary
-- ============================================================================

-- Created: tenant_themes table with versioning support
-- Created: themes_current compatibility view
-- Created: RLS policies for secure access
-- Created: Helper functions for theme management
-- Migrated: Legacy themes data to new structure
-- Integrated: Audit logging and timestamp triggers
-- Maintained: Backward compatibility for existing consumers

COMMIT;
