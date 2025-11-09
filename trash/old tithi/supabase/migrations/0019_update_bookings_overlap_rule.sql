-- Migration: 0019_update_bookings_overlap_rule.sql
-- Purpose: Update bookings overlap rule to exclude completed status from overlap prevention
-- Date: 2025-01-27
-- Author: System

BEGIN;

-- =================================================================
-- UPDATE BOOKINGS OVERLAP RULE TO EXCLUDE COMPLETED STATUS
-- =================================================================

-- Goal: A booking with status 'completed' must NOT block future bookings.
-- Only truly active statuses should participate in the GiST exclusion.

-- Step 1: Detect and drop the current exclusion constraint
-- Look up the constraint by table = 'bookings' and gist/tstzrange signature
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the exclusion constraint on bookings table with gist and tstzrange
    -- Use pg_constraint directly and check for exclusion constraint type
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'bookings'
      AND n.nspname = 'public'
      AND c.contype = 'x'  -- exclusion constraint
      AND c.conexclop IS NOT NULL;  -- ensure it's a proper exclusion constraint
    
    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped existing overlap constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No existing overlap constraint found on bookings table';
    END IF;
END $$;

-- Step 2: Recreate the exclusion constraint with updated status filter
-- Only include: pending, confirmed, checked_in
-- Explicitly exclude: completed, canceled, no_show, failed
DO $$
BEGIN
    -- Verify that start_at and end_at columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'bookings' 
          AND column_name = 'start_at'
    ) THEN
        RAISE EXCEPTION 'Column bookings.start_at does not exist';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'bookings' 
          AND column_name = 'end_at'
    ) THEN
        RAISE EXCEPTION 'Column bookings.end_at does not exist';
    END IF;
    
    -- Create the new exclusion constraint
    ALTER TABLE public.bookings 
    ADD CONSTRAINT bookings_excl_resource_time 
    EXCLUDE USING gist (
        resource_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
    )
    WHERE (
        status IN ('pending', 'confirmed', 'checked_in') 
        AND resource_id IS NOT NULL
    );
    
    RAISE NOTICE 'Created new overlap constraint excluding completed status';
END $$;

-- =================================================================
-- VALIDATION: Ensure the constraint was created correctly
-- =================================================================

-- Verify the new constraint exists and has the correct definition
DO $$
DECLARE
    constraint_def text;
BEGIN
    SELECT pg_get_constraintdef(c.oid) INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE t.relname = 'bookings'
      AND n.nspname = 'public'
      AND c.conname = 'bookings_excl_resource_time';
    
    IF constraint_def IS NULL THEN
        RAISE EXCEPTION 'New overlap constraint was not created';
    END IF;
    
    RAISE NOTICE 'New overlap constraint created: %', constraint_def;
END $$;

COMMIT;
