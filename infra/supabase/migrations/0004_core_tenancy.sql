BEGIN;

-- Generic updated_at auto-touch trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Tenants: path-based tenancy by slug; soft-delete via deleted_at
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  tz text NOT NULL DEFAULT 'UTC',
  trust_copy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public_directory boolean NOT NULL DEFAULT false,
  public_blurb text,
  billing_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Partial unique to respect soft-delete
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uniq
ON public.tenants (slug)
WHERE deleted_at IS NULL;

-- Global users (no tenant_id); profile-only, auth mapping handled at app layer
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  primary_email citext,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Memberships: user↔tenant join with role + granular permissions
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  role public.membership_role NOT NULL,
  permissions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One membership per (tenant,user)
CREATE UNIQUE INDEX IF NOT EXISTS memberships_unique_member
ON public.memberships (tenant_id, user_id);

-- Themes: 1:1 with tenants via PK(tenant_id)
CREATE TABLE IF NOT EXISTS public.themes (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  brand_color text,
  logo_url text,
  theme_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Attach touch_updated_at triggers idempotently
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tenants_touch_updated_at') THEN
    CREATE TRIGGER tenants_touch_updated_at
    BEFORE INSERT OR UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_touch_updated_at') THEN
    CREATE TRIGGER users_touch_updated_at
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'memberships_touch_updated_at') THEN
    CREATE TRIGGER memberships_touch_updated_at
    BEFORE INSERT OR UPDATE ON public.memberships
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'themes_touch_updated_at') THEN
    CREATE TRIGGER themes_touch_updated_at
    BEFORE INSERT OR UPDATE ON public.themes
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END;
$$;

-- Soft-delete temporal sanity check (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_deleted_after_created_chk'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
    ADD CONSTRAINT tenants_deleted_after_created_chk
    CHECK (deleted_at IS NULL OR deleted_at >= created_at);
  END IF;
END;
$$;

COMMIT;
