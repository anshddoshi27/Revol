-- Migration: 0022_availability_exceptions_overlap_prevention.sql
-- Purpose: Add overlap prevention for availability exceptions with merge-on-write
-- Date: 2025-01-27
-- Author: System
-- Note: Compatible with web SQL editors (no psql meta-commands)

BEGIN;

-- =================================================================
-- PHASE 1: ADD UTC TIMESTAMP FIELDS AND CLOSED FLAG
-- =================================================================

-- Add new fields to support UTC timestamptz ranges and closed status
-- Keep existing date/minute fields for backward compatibility during transition
ALTER TABLE public.availability_exceptions 
ADD COLUMN IF NOT EXISTS start_at timestamptz,
ADD COLUMN IF NOT EXISTS end_at timestamptz,
ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Add constraint to ensure valid time range for new UTC fields
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'availability_exceptions_utc_time_order_chk'
    ) THEN
        ALTER TABLE public.availability_exceptions 
        ADD CONSTRAINT availability_exceptions_utc_time_order_chk 
        CHECK (start_at IS NULL OR end_at IS NULL OR start_at < end_at);
    END IF;
END $$;

-- =================================================================
-- PHASE 2: 15-MINUTE ALIGNMENT UTILITY FUNCTIONS
-- =================================================================

-- Function to round timestamptz to 15-minute boundaries
-- Always rounds down to the nearest 15-minute mark
CREATE OR REPLACE FUNCTION public.round_to_15min(ts timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Extract minutes and round down to nearest 15-minute boundary
    -- Examples: 09:07 -> 09:00, 09:23 -> 09:15, 09:45 -> 09:45
    RETURN date_trunc('hour', ts) + 
           (EXTRACT(minute FROM ts)::int / 15 * 15) * interval '1 minute';
END;
$$;

-- Function to validate and normalize exception time range
-- Ensures start_at < end_at and both are 15-minute aligned
CREATE OR REPLACE FUNCTION public.normalize_exception_range(
    p_start_at timestamptz,
    p_end_at timestamptz
)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalized_start timestamptz;
    normalized_end timestamptz;
BEGIN
    -- Round to 15-minute boundaries
    normalized_start := public.round_to_15min(p_start_at);
    normalized_end := public.round_to_15min(p_end_at);
    
    -- If end time was rounded down and equals start, move to next 15-min slot
    IF normalized_end <= normalized_start THEN
        normalized_end := normalized_start + interval '15 minutes';
    END IF;
    
    -- Validate range
    IF normalized_start >= normalized_end THEN
        RAISE EXCEPTION 'Invalid time range: start_at % must be before end_at %', 
            normalized_start, normalized_end;
    END IF;
    
    RETURN QUERY SELECT normalized_start, normalized_end;
END;
$$;

-- =================================================================
-- PHASE 3: OVERLAP DETECTION AND MERGE FUNCTIONS
-- =================================================================

-- Function to find overlapping or adjacent exceptions for merge candidates
CREATE OR REPLACE FUNCTION public.find_exception_neighbors(
    p_tenant_id uuid,
    p_resource_id uuid,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_closed boolean DEFAULT true,
    p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    start_at timestamptz,
    end_at timestamptz,
    source text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.id,
        ae.start_at,
        ae.end_at,
        ae.source
    FROM public.availability_exceptions ae
    WHERE ae.tenant_id = p_tenant_id
      AND ae.resource_id = p_resource_id
      AND ae.closed = p_closed
      AND ae.start_at IS NOT NULL
      AND ae.end_at IS NOT NULL
      AND (p_exclude_id IS NULL OR ae.id != p_exclude_id)
      AND (
          -- Overlapping ranges using half-open interval logic
          tstzrange(ae.start_at, ae.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
          OR
          -- Adjacent ranges (touching boundaries)
          ae.end_at = p_start_at
          OR
          ae.start_at = p_end_at
      );
END;
$$;

-- Function to compute merged time range from a set of overlapping exceptions
CREATE OR REPLACE FUNCTION public.compute_merged_range(
    p_base_start timestamptz,
    p_base_end timestamptz,
    p_neighbor_starts timestamptz[],
    p_neighbor_ends timestamptz[]
)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    merged_start timestamptz;
    merged_end timestamptz;
    i int;
BEGIN
    -- Start with base range
    merged_start := p_base_start;
    merged_end := p_base_end;
    
    -- Expand to include all neighbors (only if arrays are not empty)
    IF array_length(p_neighbor_starts, 1) IS NOT NULL AND array_length(p_neighbor_starts, 1) > 0 THEN
        FOR i IN 1..array_length(p_neighbor_starts, 1)
        LOOP
            merged_start := LEAST(merged_start, p_neighbor_starts[i]);
            merged_end := GREATEST(merged_end, p_neighbor_ends[i]);
        END LOOP;
    END IF;
    
    RETURN QUERY SELECT merged_start, merged_end;
END;
$$;

-- =================================================================
-- PHASE 4: MERGE-ON-WRITE TRANSACTION FUNCTION
-- =================================================================

-- Main function to handle merge-on-write for availability exceptions
-- This replaces overlapping exceptions with a single merged exception
CREATE OR REPLACE FUNCTION public.merge_availability_exception(
    p_tenant_id uuid,
    p_resource_id uuid,
    p_start_at timestamptz,
    p_end_at timestamptz,
    p_closed boolean DEFAULT true,
    p_source text DEFAULT 'manual',
    p_description text DEFAULT '',
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    normalized_range RECORD;
    neighbor RECORD;
    neighbor_starts timestamptz[];
    neighbor_ends timestamptz[];
    neighbor_sources text[];
    merged_range RECORD;
    merged_source text;
    new_exception_id uuid;
BEGIN
    -- Step 1: Normalize input to 15-minute boundaries
    SELECT * INTO normalized_range 
    FROM public.normalize_exception_range(p_start_at, p_end_at);
    
    -- Step 2: Find all overlapping/adjacent neighbors
    neighbor_starts := ARRAY[]::timestamptz[];
    neighbor_ends := ARRAY[]::timestamptz[];
    neighbor_sources := ARRAY[]::text[];
    
    FOR neighbor IN 
        SELECT * FROM public.find_exception_neighbors(
            p_tenant_id, p_resource_id, 
            normalized_range.start_at, normalized_range.end_at, 
            p_closed
        )
    LOOP
        neighbor_starts := neighbor_starts || neighbor.start_at;
        neighbor_ends := neighbor_ends || neighbor.end_at;
        neighbor_sources := neighbor_sources || neighbor.source;
    END LOOP;
    
    -- Step 3: Compute merged range
    SELECT * INTO merged_range
    FROM public.compute_merged_range(
        normalized_range.start_at,
        normalized_range.end_at,
        neighbor_starts,
        neighbor_ends
    );
    
    -- Step 4: Determine merged source (prefer manual > gcal > other)
    merged_source := p_source;
    IF array_length(neighbor_sources, 1) > 0 THEN
        -- If any neighbor is manual, keep manual
        IF 'manual' = ANY(neighbor_sources) OR p_source = 'manual' THEN
            merged_source := 'manual';
        -- Otherwise, prefer gcal
        ELSIF 'gcal' = ANY(neighbor_sources) OR p_source = 'gcal' THEN
            merged_source := 'gcal';
        ELSE
            merged_source := p_source;
        END IF;
    END IF;
    
    -- Step 5: Delete all neighbors in a single operation (atomic)
    DELETE FROM public.availability_exceptions
    WHERE id IN (
        SELECT neighbor_exception.id 
        FROM public.find_exception_neighbors(
            p_tenant_id, p_resource_id,
            normalized_range.start_at, normalized_range.end_at,
            p_closed
        ) neighbor_exception
    );
    
    -- Step 6: Insert the merged exception
    INSERT INTO public.availability_exceptions (
        tenant_id,
        resource_id,
        date,
        start_minute,
        end_minute,
        start_at,
        end_at,
        closed,
        source,
        description,
        metadata
    ) VALUES (
        p_tenant_id,
        p_resource_id,
        merged_range.start_at::date,
        NULL,  -- start_minute: NULL for UTC timestamp-based exceptions
        NULL,  -- end_minute: NULL for UTC timestamp-based exceptions
        merged_range.start_at,
        merged_range.end_at,
        p_closed,
        merged_source,
        COALESCE(p_description, ''),
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO new_exception_id;
    
    RETURN new_exception_id;
END;
$$;

-- =================================================================
-- PHASE 5: FILTERED GIST EXCLUSION CONSTRAINT
-- =================================================================

-- Add GiST exclusion constraint to prevent overlapping closed exceptions
-- Only applies to closed=true exceptions with non-null UTC timestamps
-- Uses same pattern as bookings overlap prevention
DO $$
BEGIN
    -- Create the filtered exclusion constraint
    -- This prevents overlapping closed exceptions at the database level
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'availability_exceptions_excl_resource_time'
    ) THEN
        ALTER TABLE public.availability_exceptions
        ADD CONSTRAINT availability_exceptions_excl_resource_time
        EXCLUDE USING gist (
            resource_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (
            closed = true 
            AND start_at IS NOT NULL 
            AND end_at IS NOT NULL
        );
        
        RAISE NOTICE 'Created availability exceptions overlap exclusion constraint';
    ELSE
        RAISE NOTICE 'Availability exceptions overlap exclusion constraint already exists';
    END IF;
    
EXCEPTION WHEN duplicate_table THEN
    RAISE NOTICE 'Availability exceptions overlap exclusion constraint already exists';
END $$;

-- =================================================================
-- PHASE 6: EVENT EMISSION TRIGGER
-- =================================================================

-- Function to emit availability_changed events
CREATE OR REPLACE FUNCTION public.emit_availability_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert into events_outbox for availability_changed event
    -- This will be processed by the event worker to notify caches/UI
    INSERT INTO public.events_outbox (
        tenant_id,
        event_code,
        payload,
        key
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        'availability_changed',
        jsonb_build_object(
            'resource_id', COALESCE(NEW.resource_id, OLD.resource_id),
            'changed_at', now(),
            'change_type', CASE 
                WHEN TG_OP = 'INSERT' THEN 'exception_created'
                WHEN TG_OP = 'UPDATE' THEN 'exception_updated'
                WHEN TG_OP = 'DELETE' THEN 'exception_deleted'
            END
        ),
        'availability_' || COALESCE(NEW.id, OLD.id)::text || '_' || TG_OP || '_' || substr(gen_random_uuid()::text, 1, 8)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach availability_changed trigger to availability_exceptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'availability_exceptions_emit_changed_aiud'
    ) THEN
        CREATE TRIGGER availability_exceptions_emit_changed_aiud
            AFTER INSERT OR UPDATE OR DELETE ON public.availability_exceptions
            FOR EACH ROW
            EXECUTE FUNCTION public.emit_availability_changed();
        
        RAISE NOTICE 'Created availability_changed event trigger';
    ELSE
        RAISE NOTICE 'Availability_changed event trigger already exists';
    END IF;
END $$;

-- =================================================================
-- PHASE 7: MIGRATION DATA COMPATIBILITY
-- =================================================================

-- For existing records, populate UTC fields from date + minute fields
-- This maintains backward compatibility during transition
UPDATE public.availability_exceptions 
SET 
    start_at = CASE 
        WHEN start_minute IS NOT NULL AND date IS NOT NULL THEN
            -- Convert date + minute to UTC (assuming tenant timezone)
            -- This is a simplified conversion - production should use tenant.tz
            date::timestamptz + (start_minute || ' minutes')::interval
        ELSE NULL
    END,
    end_at = CASE 
        WHEN end_minute IS NOT NULL AND date IS NOT NULL THEN
            date::timestamptz + (end_minute || ' minutes')::interval
        ELSE NULL
    END,
    closed = CASE
        WHEN start_minute IS NULL AND end_minute IS NULL THEN true  -- All-day closure
        ELSE false  -- Special hours
    END
WHERE start_at IS NULL AND end_at IS NULL;

-- Apply 15-minute rounding to migrated data (only after functions are created)
-- Note: This will be done in a separate step after all functions are available

-- =================================================================
-- VALIDATION AND VERIFICATION
-- =================================================================

-- Verify the constraint was created correctly
DO $$
DECLARE
    constraint_def text;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'availability_exceptions'
      AND n.nspname = 'public'
      AND c.conname = 'availability_exceptions_excl_resource_time';
    
    IF constraint_def IS NULL THEN
        RAISE WARNING 'Availability exceptions overlap constraint was not created';
    ELSE
        RAISE NOTICE 'Availability exceptions overlap constraint created successfully';
    END IF;
END $$;

-- Verify functions were created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'round_to_15min') THEN
        RAISE EXCEPTION 'Function round_to_15min was not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'normalize_exception_range') THEN
        RAISE EXCEPTION 'Function normalize_exception_range was not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'merge_availability_exception') THEN
        RAISE EXCEPTION 'Function merge_availability_exception was not created';
    END IF;
    
    RAISE NOTICE 'All availability exception functions created successfully';
END $$;

COMMIT;
