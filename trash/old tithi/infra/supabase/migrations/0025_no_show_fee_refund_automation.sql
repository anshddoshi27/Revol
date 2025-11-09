-- P0025 — No-Show Fee Refund Automation
-- Implements comprehensive no-show fee and refund automation system
-- This migration adds the refunds table and related functionality

BEGIN;

-- Note: refunds table is already created in migration 0024
-- This migration adds the payment_fees table and related functionality

-- Create payment_fees table for detailed fee tracking
CREATE TABLE IF NOT EXISTS public.payment_fees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    
    -- Fee details
    fee_type text NOT NULL,
    base_amount_cents integer NOT NULL,
    percentage_applied decimal(5,2),
    amount_cents integer NOT NULL,
    
    -- Status and processing
    status text NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'charged', 'failed', 'waived')),
    charged_at timestamptz,
    waived_reason text,
    
    -- Provider integration
    provider_fee_id text,
    provider_metadata jsonb DEFAULT '{}',
    
    -- Metadata and timestamps
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Note: unique indexes for refunds table are already created in migration 0024

-- Note: refunds table trigger is already created in migration 0024

-- Add touch trigger for payment_fees table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'payment_fees_touch_updated_at'
    ) THEN
        CREATE TRIGGER payment_fees_touch_updated_at
            BEFORE UPDATE ON public.payment_fees
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Note: refunds table indexes are already created in migration 0024

CREATE INDEX IF NOT EXISTS idx_payment_fees_payment_id 
ON public.payment_fees(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_fees_booking_id 
ON public.payment_fees(booking_id) 
WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_fees_fee_type 
ON public.payment_fees(fee_type);

CREATE INDEX IF NOT EXISTS idx_payment_fees_status 
ON public.payment_fees(status);

CREATE INDEX IF NOT EXISTS idx_payment_fees_tenant_id 
ON public.payment_fees(tenant_id);

-- Add comments for documentation
COMMENT ON TABLE public.payment_fees IS 'Tracks detailed fee information for payments';

COMMIT;
