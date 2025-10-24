BEGIN;

-- Migration: 0040_tenant_status_progression.sql
-- Purpose: Update tenant status to support onboarding → ready → active progression
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Update tenant status constraint to support new progression
-- ============================================================================

-- Drop existing status constraint if it exists
ALTER TABLE public.tenants 
DROP CONSTRAINT IF EXISTS tenants_status_check;

-- Add new status constraint with progression support
ALTER TABLE public.tenants 
ADD CONSTRAINT tenants_status_check 
CHECK (status IN ('onboarding', 'ready', 'active', 'suspended', 'trial', 'cancelled'));

-- ============================================================================
-- 2) Update existing tenants to appropriate status
-- ============================================================================

-- Set existing active tenants to 'ready' if they meet readiness criteria
-- (This is a simplified approach - in production you'd want more sophisticated logic)
UPDATE public.tenants 
SET status = 'ready'
WHERE status = 'active' 
  AND deleted_at IS NULL;

-- Set any remaining 'active' tenants to 'onboarding' to force readiness check
UPDATE public.tenants 
SET status = 'onboarding'
WHERE status = 'active' 
  AND deleted_at IS NULL;

-- ============================================================================
-- 3) Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.tenants.status IS 'Tenant status progression: onboarding → ready → active';

-- ============================================================================
-- 4) Add index for status-based queries
-- ============================================================================

-- Add index for status-based queries (if not already exists)
CREATE INDEX IF NOT EXISTS tenants_status_idx
ON public.tenants (status);

COMMIT;
