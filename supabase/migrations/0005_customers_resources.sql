-- 0005_customers_resources.sql  (REPLACEMENT / SAFE TO RE-RUN)
BEGIN;

-- ===============================
-- Customers (tenant-scoped, soft-delete, PII-ready)
-- ===============================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  display_name text,
  email citext,
  phone text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_first_time boolean NOT NULL DEFAULT true,
  pseudonymized_at timestamptz,
  customer_first_booking_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Soft-delete temporal sanity check (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_deleted_after_created_chk'
  ) THEN
    ALTER TABLE public.customers
    ADD CONSTRAINT customers_deleted_after_created_chk
      CHECK (deleted_at IS NULL OR deleted_at >= created_at);
  END IF;
END$$;

-- Per-tenant email uniqueness; ignore NULL emails and soft-deleted rows
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_uniq
  ON public.customers (tenant_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;


-- ===============================
-- Resources (type, tz, capacity, soft-delete, UX label + active flag)
-- ===============================
CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  type public.resource_type NOT NULL,
  tz text NOT NULL,
  capacity integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ► Ensure UX/pack-required columns exist even if table pre-existed
-- name: human-friendly label for calendars/lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='resources' AND column_name='name'
  ) THEN
    ALTER TABLE public.resources
      ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
END$$;

-- is_active: toggle to hide/disable without deleting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='resources' AND column_name='is_active'
  ) THEN
    ALTER TABLE public.resources
      ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END$$;

-- Capacity must be >= 1 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resources_capacity_ge_1_chk'
  ) THEN
    ALTER TABLE public.resources
    ADD CONSTRAINT resources_capacity_ge_1_chk CHECK (capacity >= 1);
  END IF;
END$$;

-- Soft-delete temporal sanity on resources (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resources_deleted_after_created_chk'
  ) THEN
    ALTER TABLE public.resources
    ADD CONSTRAINT resources_deleted_after_created_chk
      CHECK (deleted_at IS NULL OR deleted_at >= created_at);
  END IF;
END$$;


-- ===============================
-- Customer metrics (denormalized read model; app-managed)
-- ===============================
CREATE TABLE IF NOT EXISTS public.customer_metrics (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  total_bookings_count integer NOT NULL DEFAULT 0,
  first_booking_at timestamptz,
  last_booking_at timestamptz,
  total_spend_cents integer NOT NULL DEFAULT 0,
  no_show_count integer NOT NULL DEFAULT 0,
  canceled_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_metrics_pkey PRIMARY KEY (tenant_id, customer_id),
  CONSTRAINT customer_metrics_total_spend_cents_nonneg_chk CHECK (total_spend_cents >= 0),
  CONSTRAINT customer_metrics_no_show_nonneg_chk CHECK (no_show_count >= 0),
  CONSTRAINT customer_metrics_canceled_nonneg_chk CHECK (canceled_count >= 0),
  CONSTRAINT customer_metrics_bookings_nonneg_chk CHECK (total_bookings_count >= 0)
);


-- ===============================
-- Attach updated_at auto-touch trigger to all tables (idempotent)
-- ===============================
DO $$
BEGIN
  -- customers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'customers_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER customers_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.customers
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;

  -- resources
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'resources_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER resources_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.resources
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;

  -- customer_metrics (allowed to have only touch trigger; business logic stays in app)
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'customer_metrics_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER customer_metrics_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.customer_metrics
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;
END$$;

COMMIT;
