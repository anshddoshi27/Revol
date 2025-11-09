BEGIN;

-- Migration: 0038_tenant_essential_fields.sql
-- Purpose: Add essential tenant fields for onboarding and business information
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Add essential tenant fields for business information
-- ============================================================================

-- Add business name field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS name text;

-- Add business email field  
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS email text;

-- Add business category/industry field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS category text;

-- Add logo URL field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add locale field (e.g., 'en_US', 'es_ES')
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en_US';

-- Add tenant status field (active, suspended, etc.)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add legal business name field (DBA)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS legal_name text;

-- Add contact phone field
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS phone text;

-- Add subdomain field for custom domains
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS subdomain text;

-- Add timezone field (separate from tz for business operations)
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS business_timezone text DEFAULT 'UTC';

-- ============================================================================
-- 2) Add constraints and indexes
-- ============================================================================

-- Add status constraint
ALTER TABLE public.tenants 
ADD CONSTRAINT IF NOT EXISTS tenants_status_check 
CHECK (status IN ('active', 'suspended', 'trial', 'cancelled'));

-- Add locale constraint (basic format validation)
ALTER TABLE public.tenants 
ADD CONSTRAINT IF NOT EXISTS tenants_locale_check 
CHECK (locale ~ '^[a-z]{2}_[A-Z]{2}$');

-- Add unique constraint for subdomain (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS tenants_subdomain_uniq
ON public.tenants (subdomain)
WHERE subdomain IS NOT NULL AND deleted_at IS NULL;

-- Add unique constraint for email (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS tenants_email_uniq
ON public.tenants (email)
WHERE email IS NOT NULL AND deleted_at IS NULL;

-- Add index for status-based queries
CREATE INDEX IF NOT EXISTS tenants_status_idx
ON public.tenants (status);

-- Add index for category-based queries
CREATE INDEX IF NOT EXISTS tenants_category_idx
ON public.tenants (category);

-- ============================================================================
-- 3) Update existing tenants with default values
-- ============================================================================

-- Set default values for existing tenants
UPDATE public.tenants 
SET 
    name = COALESCE(name, slug),
    status = COALESCE(status, 'active'),
    locale = COALESCE(locale, 'en_US'),
    business_timezone = COALESCE(business_timezone, tz)
WHERE deleted_at IS NULL;

-- ============================================================================
-- 4) Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.tenants.name IS 'Business name for the tenant';
COMMENT ON COLUMN public.tenants.email IS 'Business contact email address';
COMMENT ON COLUMN public.tenants.category IS 'Business category or industry';
COMMENT ON COLUMN public.tenants.logo_url IS 'URL to business logo image';
COMMENT ON COLUMN public.tenants.locale IS 'Locale code (e.g., en_US, es_ES)';
COMMENT ON COLUMN public.tenants.status IS 'Tenant status (active, suspended, trial, cancelled)';
COMMENT ON COLUMN public.tenants.legal_name IS 'Legal business name (DBA)';
COMMENT ON COLUMN public.tenants.phone IS 'Business contact phone number';
COMMENT ON COLUMN public.tenants.subdomain IS 'Custom subdomain for tenant';
COMMENT ON COLUMN public.tenants.business_timezone IS 'Business timezone for operations';

COMMIT;
