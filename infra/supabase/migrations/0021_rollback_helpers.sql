BEGIN;

-- =================================================================
-- Rollback Migration 0021: Restore Original Helper Functions
-- =================================================================
-- 
-- This script restores the original helper functions from Migration 0003
-- that only read from Supabase Auth JWT claims.
--
-- Use this if you need to revert the app-claims priority behavior
-- =================================================================

-- Restore current_tenant_id() to original implementation
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
RETURNS NULL ON NULL INPUT
AS $$
  SELECT
    CASE
      WHEN (auth.jwt()->>'tenant_id') IS NOT NULL
       AND (auth.jwt()->>'tenant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt()->>'tenant_id')::uuid
      ELSE NULL::uuid
    END;
$$;

-- Restore current_user_id() to original implementation
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
RETURNS NULL ON NULL INPUT
AS $$
  SELECT
    CASE
      WHEN (auth.jwt()->>'sub') IS NOT NULL
       AND (auth.jwt()->>'sub') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt()->>'sub')::uuid
      ELSE NULL::uuid
    END;
$$;

COMMIT;
