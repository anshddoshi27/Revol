BEGIN;

-- =================================================================
-- Migration 0021: Update Helper Functions to Read App-Set Claims First
-- =================================================================
-- 
-- Goal: Update helper functions to prioritize app-set JWT claims over Supabase Auth
-- - First try: current_setting('request.jwt.claims', true) as JSON
-- - Fallback: auth.jwt() for Supabase Auth compatibility
-- - No policy changes required - existing RLS policies continue to work
-- - Fail closed: NULL cast errors result in RLS denial
--
-- Why: Aligns helper behavior with middleware that sets 
-- SET LOCAL "request.jwt.claims" while preserving Supabase default behavior
-- =================================================================

-- Update current_tenant_id() to read app-set claims first
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
RETURNS NULL ON NULL INPUT
AS $$
  SELECT
    CASE
      -- First priority: app-set claims via current_setting
      WHEN current_setting('request.jwt.claims', true) IS NOT NULL
       AND current_setting('request.jwt.claims', true) != ''
       AND (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id') IS NOT NULL
       AND (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
      
      -- Fallback: Supabase Auth JWT claims
      WHEN (auth.jwt()->>'tenant_id') IS NOT NULL
       AND (auth.jwt()->>'tenant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt()->>'tenant_id')::uuid
      
      -- Fail closed: return NULL for RLS denial
      ELSE NULL::uuid
    END;
$$;

-- Update current_user_id() to read app-set claims first  
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
RETURNS NULL ON NULL INPUT
AS $$
  SELECT
    CASE
      -- First priority: app-set claims via current_setting
      WHEN current_setting('request.jwt.claims', true) IS NOT NULL
       AND current_setting('request.jwt.claims', true) != ''
       AND (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') IS NOT NULL
       AND (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
      
      -- Fallback: Supabase Auth JWT claims
      WHEN (auth.jwt()->>'sub') IS NOT NULL
       AND (auth.jwt()->>'sub') ~* '^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (auth.jwt()->>'sub')::uuid
      
      -- Fail closed: return NULL for RLS denial
      ELSE NULL::uuid
    END;
$$;

COMMIT;
