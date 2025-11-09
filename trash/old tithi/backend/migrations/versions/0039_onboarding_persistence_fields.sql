BEGIN;

-- Migration: 0039_onboarding_persistence_fields.sql
-- Purpose: Add fields for onboarding persistence (address, socials, branding, policies)
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Add business address and contact information fields
-- ============================================================================

-- Add business address JSON field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS address_json jsonb DEFAULT '{}'::jsonb;

-- Add social links JSON field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS social_links_json jsonb DEFAULT '{}'::jsonb;

-- Add branding information JSON field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS branding_json jsonb DEFAULT '{}'::jsonb;

-- Add custom policies JSON field (separate from trust_copy_json)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS policies_json jsonb DEFAULT '{}'::jsonb;

-- ============================================================================
-- 2) Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.tenants.address_json IS 'Business address information (street, city, state, postal_code, country)';
COMMENT ON COLUMN public.tenants.social_links_json IS 'Social media links and profiles';
COMMENT ON COLUMN public.tenants.branding_json IS 'Branding information (colors, fonts, theme settings)';
COMMENT ON COLUMN public.tenants.policies_json IS 'Custom policies provided during onboarding (not overwritten by defaults)';

-- ============================================================================
-- 3) Add indexes for JSON field queries
-- ============================================================================

-- Add GIN index for address_json queries
CREATE INDEX IF NOT EXISTS tenants_address_json_gin_idx
ON public.tenants USING GIN (address_json);

-- Add GIN index for social_links_json queries
CREATE INDEX IF NOT EXISTS tenants_social_links_json_gin_idx
ON public.tenants USING GIN (social_links_json);

-- Add GIN index for branding_json queries
CREATE INDEX IF NOT EXISTS tenants_branding_json_gin_idx
ON public.tenants USING GIN (branding_json);

-- Add GIN index for policies_json queries
CREATE INDEX IF NOT EXISTS tenants_policies_json_gin_idx
ON public.tenants USING GIN (policies_json);

COMMIT;
