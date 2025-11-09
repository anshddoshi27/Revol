BEGIN;

-- RLS helper: current tenant id from JWT claim 'tenant_id'
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

-- RLS helper: current user id from JWT claim 'sub'
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
