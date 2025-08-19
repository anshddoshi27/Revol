-- 0004_hotfix_touch_updated_at.sql
BEGIN;

-- Use clock_timestamp() so updated_at advances within the same transaction.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$ 
BEGIN
  -- Only touch if the row actually changes or we're inserting.
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA
        AND table_name   = TG_TABLE_NAME
        AND column_name  = 'updated_at'
    ) THEN
      NEW.updated_at := COALESCE(NEW.updated_at, clock_timestamp());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA
        AND table_name   = TG_TABLE_NAME
        AND column_name  = 'updated_at'
    ) THEN
      -- Always advance to at least the current clock time.
      NEW.updated_at :=
        GREATEST(
          COALESCE(NEW.updated_at, to_timestamp(0)),  -- minimal baseline
          clock_timestamp()
        );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-assert BEFORE triggers on the four Task-4 tables (idempotent IF NOT EXISTS pattern)
DO $$
BEGIN
  -- tenants
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'tenants_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER tenants_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.tenants
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;

  -- users (global)
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'users_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER users_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;

  -- memberships
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'memberships_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER memberships_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.memberships
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;

  -- themes (1:1)
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'themes_touch_updated_at'
  ) THEN
    EXECUTE $DDL$
      CREATE TRIGGER themes_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.themes
      FOR EACH ROW
      EXECUTE FUNCTION public.touch_updated_at();
    $DDL$;
  END IF;
END$$;

COMMIT;
