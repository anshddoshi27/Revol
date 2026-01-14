BEGIN;

-- Services table with per-tenant slugs, pricing, duration, category, and soft-delete
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  slug text NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  duration_min integer NOT NULL DEFAULT 60,
  price_cents integer NOT NULL DEFAULT 0,
  buffer_before_min integer NOT NULL DEFAULT 0,
  buffer_after_min integer NOT NULL DEFAULT 0,
  category text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Service-Resource mapping table (many-to-many) with tenant_id for cross-tenant integrity
CREATE TABLE IF NOT EXISTS public.service_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  service_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Constraints and indexes for services
DO $$
BEGIN
  -- Partial unique index for active services by tenant and slug
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'services_tenant_slug_uniq' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX services_tenant_slug_uniq ON public.services (tenant_id, slug) 
    WHERE deleted_at IS NULL;
  END IF;

  -- Composite unique index for services (id, tenant_id) to support composite FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'services_id_tenant_uniq' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX services_id_tenant_uniq ON public.services (id, tenant_id);
  END IF;

  -- Unique constraint on service-resource mapping
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'service_resources_unique_pair' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX service_resources_unique_pair ON public.service_resources (service_id, resource_id);
  END IF;
END $$;

-- Add composite unique constraint on resources table to support composite FK
DO $$
BEGIN
  -- Composite unique index for resources (id, tenant_id) to support composite FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'resources_id_tenant_uniq' AND n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX resources_id_tenant_uniq ON public.resources (id, tenant_id);
  END IF;
END $$;

-- Add CHECK constraints
DO $$
BEGIN
  -- Price must be non-negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_price_nonneg_chk'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_price_nonneg_chk 
    CHECK (price_cents >= 0);
  END IF;

  -- Duration must be positive
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_duration_pos_chk'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_duration_pos_chk 
    CHECK (duration_min > 0);
  END IF;

  -- Buffer times must be non-negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_buffer_before_nonneg_chk'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_buffer_before_nonneg_chk 
    CHECK (buffer_before_min >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_buffer_after_nonneg_chk'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_buffer_after_nonneg_chk 
    CHECK (buffer_after_min >= 0);
  END IF;

  -- Soft-delete temporal sanity check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_deleted_after_created_chk'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT services_deleted_after_created_chk 
    CHECK (deleted_at IS NULL OR deleted_at >= created_at);
  END IF;
END $$;

-- Add composite foreign keys for cross-tenant integrity
DO $$
BEGIN
  -- Composite FK: service_resources(service_id, tenant_id) → services(id, tenant_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_resources_service_tenant_fk'
  ) THEN
    ALTER TABLE public.service_resources ADD CONSTRAINT service_resources_service_tenant_fk
    FOREIGN KEY (service_id, tenant_id) REFERENCES public.services(id, tenant_id) ON DELETE CASCADE;
  END IF;

  -- Composite FK: service_resources(resource_id, tenant_id) → resources(id, tenant_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_resources_resource_tenant_fk'
  ) THEN
    ALTER TABLE public.service_resources ADD CONSTRAINT service_resources_resource_tenant_fk
    FOREIGN KEY (resource_id, tenant_id) REFERENCES public.resources(id, tenant_id) ON DELETE CASCADE;
  END IF;
END $$;

-- Attach touch_updated_at trigger to services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'services_touch_updated_at'
  ) THEN
    CREATE TRIGGER services_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.services
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

COMMIT;
