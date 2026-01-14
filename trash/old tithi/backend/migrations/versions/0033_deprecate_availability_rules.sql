-- Migration: 0033_deprecate_availability_rules.sql
-- Purpose: Mark availability_rules as deprecated in favor of staff_availability
-- Dependencies: Task 4.2 (Staff Availability) - Complete

BEGIN;

-- Add deprecation comment to availability_rules table
COMMENT ON TABLE public.availability_rules IS 'DEPRECATED: Use staff_availability table instead. This table is kept for backward compatibility but should not be used for new availability rules.';

-- Add deprecation warning column
ALTER TABLE public.availability_rules 
ADD COLUMN IF NOT EXISTS is_deprecated boolean NOT NULL DEFAULT true;

-- Create index for deprecation flag
CREATE INDEX IF NOT EXISTS idx_availability_rules_deprecated 
ON public.availability_rules (is_deprecated) WHERE is_deprecated = true;

-- Add constraint to prevent new non-deprecated rules
ALTER TABLE public.availability_rules 
ADD CONSTRAINT ck_no_new_rules CHECK (is_deprecated = true);

COMMIT;
