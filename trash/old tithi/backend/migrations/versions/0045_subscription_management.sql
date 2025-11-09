BEGIN;

-- Migration: 0045_subscription_management.sql
-- Purpose: Add subscription management fields to tenant_billing table
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Add subscription fields to tenant_billing table
-- ============================================================================

-- Add subscription_id (Stripe Subscription ID)
ALTER TABLE public.tenant_billing 
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);

-- Add subscription_status
ALTER TABLE public.tenant_billing 
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';

-- Add subscription_price_cents
ALTER TABLE public.tenant_billing 
ADD COLUMN IF NOT EXISTS subscription_price_cents INTEGER DEFAULT 1199;

-- Add next_billing_date
ALTER TABLE public.tenant_billing 
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Add stripe_customer_id (Stripe Customer ID)
ALTER TABLE public.tenant_billing 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Add trial_ends_at
ALTER TABLE public.tenant_billing 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ============================================================================
-- 2) Add constraints
-- ============================================================================

-- Add check constraint for subscription_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tenant_billing_subscription_status_check'
    ) THEN
        ALTER TABLE public.tenant_billing
        ADD CONSTRAINT tenant_billing_subscription_status_check 
        CHECK (subscription_status IN ('inactive', 'trial', 'active', 'paused', 'canceled'));
    END IF;
END $$;

-- Add check constraint for subscription_price_cents
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tenant_billing_subscription_price_check'
    ) THEN
        ALTER TABLE public.tenant_billing
        ADD CONSTRAINT tenant_billing_subscription_price_check 
        CHECK (subscription_price_cents >= 0);
    END IF;
END $$;

-- ============================================================================
-- 3) Add indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS tenant_billing_subscription_status_idx 
ON public.tenant_billing (subscription_status);

CREATE INDEX IF NOT EXISTS tenant_billing_subscription_id_idx 
ON public.tenant_billing (subscription_id);

CREATE INDEX IF NOT EXISTS tenant_billing_next_billing_date_idx 
ON public.tenant_billing (next_billing_date);

CREATE INDEX IF NOT EXISTS tenant_billing_trial_ends_at_idx 
ON public.tenant_billing (trial_ends_at);

-- ============================================================================
-- 4) Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.tenant_billing.subscription_id IS 'Stripe Subscription ID';
COMMENT ON COLUMN public.tenant_billing.subscription_status IS 'Subscription status: inactive, trial, active, paused, or canceled';
COMMENT ON COLUMN public.tenant_billing.subscription_price_cents IS 'Monthly subscription price in cents';
COMMENT ON COLUMN public.tenant_billing.next_billing_date IS 'Next billing date for the subscription';
COMMENT ON COLUMN public.tenant_billing.stripe_customer_id IS 'Stripe Customer ID for the tenant';
COMMENT ON COLUMN public.tenant_billing.trial_ends_at IS 'Trial end date';

COMMIT;


