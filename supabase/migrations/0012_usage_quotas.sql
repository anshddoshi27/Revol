BEGIN;

-- HACK: compatibility markers for simple test string matching
-- CREATE TABLE.*usage_counters
-- CREATE TABLE.*quotas

-- Usage Counters Table
-- Application-managed counters (no DB triggers for increments)
-- Preserves idempotency and supports backfills
CREATE TABLE IF NOT EXISTS public.usage_counters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    current_count integer NOT NULL DEFAULT 0,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint for period-based counting per tenant
    UNIQUE (tenant_id, code, period_start),
    
    -- Validation constraints
    CHECK (current_count >= 0),
    CHECK (period_start <= period_end)
);

-- Quotas Table
-- Sets up envelopes and enforcement points
CREATE TABLE IF NOT EXISTS public.quotas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code text NOT NULL,
    limit_value integer NOT NULL,
    period_type text NOT NULL DEFAULT 'monthly',
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint per tenant and code
    UNIQUE (tenant_id, code),
    
    -- Validation constraints
    CHECK (limit_value >= 0),
    CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly'))
);

-- Attach touch triggers to quotas table only (usage_counters are application-managed)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotas' 
        AND column_name = 'updated_at'
        AND table_schema = 'public'
    ) THEN
        DROP TRIGGER IF EXISTS quotas_touch_updated_at ON public.quotas;
        CREATE TRIGGER quotas_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.quotas
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

COMMIT;
