BEGIN;

-- ============================================================================
-- 0007 — Availability Rules & Exceptions
-- ============================================================================
-- Creates availability_rules (recurring weekly patterns) and availability_exceptions
-- (specific date overrides/closures) with proper validation constraints.
-- Uses ISO weekday numbering (1=Monday, 7=Sunday) and minute-of-day ranges.
-- Sets backbone for 15-minute slot generation and booking availability checks.

-- availability_rules: defines recurring weekly availability patterns per resource
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  
  -- ISO weekday: 1=Monday, 2=Tuesday, ..., 7=Sunday
  dow int NOT NULL CHECK (dow BETWEEN 1 AND 7),
  
  -- Minute of day: 0-1439 (0 = 00:00, 1439 = 23:59)
  start_minute int NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute int NOT NULL CHECK (end_minute BETWEEN 0 AND 1439),
  
  -- Ensure valid time range
  CHECK (start_minute < end_minute),
  
  -- Optional RRULE for complex recurrence patterns (JSON)
  rrule_json jsonb DEFAULT '{}',
  
  -- Metadata for additional configuration
  metadata jsonb DEFAULT '{}',
  
  -- Standard timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate rules for same resource/dow/time
CREATE UNIQUE INDEX IF NOT EXISTS availability_rules_resource_dow_time_uniq
  ON public.availability_rules (resource_id, dow, start_minute, end_minute);

-- Index for efficient resource+dow queries
CREATE INDEX IF NOT EXISTS availability_rules_resource_dow_idx
  ON public.availability_rules (resource_id, dow);

-- availability_exceptions: specific date overrides (closures or special hours)
CREATE TABLE IF NOT EXISTS public.availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  
  -- Specific date for the exception
  date date NOT NULL,
  
  -- NULL start_minute/end_minute = closed all day
  -- Non-NULL = special hours for this date
  start_minute int CHECK (start_minute IS NULL OR (start_minute BETWEEN 0 AND 1439)),
  end_minute int CHECK (end_minute IS NULL OR (end_minute BETWEEN 0 AND 1439)),
  
  -- If both start_minute and end_minute are specified, ensure valid range
  CHECK (
    (start_minute IS NULL AND end_minute IS NULL) OR
    (start_minute IS NOT NULL AND end_minute IS NOT NULL AND start_minute < end_minute)
  ),
  
  -- Description of the exception (e.g., "Holiday Closure", "Extended Hours")
  description text DEFAULT '',
  
  -- Metadata for additional configuration
  metadata jsonb DEFAULT '{}',
  
  -- Standard timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate exceptions for same resource/date/time
-- Uses coalesce to handle NULL start_minute/end_minute (closed all day)
CREATE UNIQUE INDEX IF NOT EXISTS availability_exceptions_resource_date_time_uniq
  ON public.availability_exceptions (
    resource_id, 
    date, 
    coalesce(start_minute, -1), 
    coalesce(end_minute, -1)
  );

-- Index for efficient resource+date range queries
CREATE INDEX IF NOT EXISTS availability_exceptions_resource_date_idx
  ON public.availability_exceptions (resource_id, date);

-- ============================================================================
-- Triggers: Attach updated_at touch triggers
-- ============================================================================

DO $$
BEGIN
  -- availability_rules touch trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'availability_rules_touch_updated_at'
  ) THEN
    CREATE TRIGGER availability_rules_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.availability_rules
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  -- availability_exceptions touch trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'availability_exceptions_touch_updated_at'
  ) THEN
    CREATE TRIGGER availability_exceptions_touch_updated_at
      BEFORE INSERT OR UPDATE ON public.availability_exceptions
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

COMMIT;
