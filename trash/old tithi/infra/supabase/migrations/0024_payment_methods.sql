-- P0024 — Payment Methods & No-Show Fee Automation
-- Implements the database review recommendation for no-show fee automation and refund/fee capture flow

BEGIN;

-- Add cancellation tracking fields to bookings table
DO $$
BEGIN
    -- Add canceled_by field to track who canceled the booking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'canceled_by'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN canceled_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- Add cancellation_reason field for audit trail
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN cancellation_reason text;
    END IF;

    -- Add no_show_fee_applied flag to track if fee was charged
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'no_show_fee_applied'
    ) THEN
        ALTER TABLE public.bookings 
        ADD COLUMN no_show_fee_applied boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add no-show fee percentage to services table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' 
        AND column_name = 'no_show_fee_percent'
    ) THEN
        ALTER TABLE public.services 
        ADD COLUMN no_show_fee_percent decimal(5,2) DEFAULT 3.00 
        CHECK (no_show_fee_percent >= 0 AND no_show_fee_percent <= 100);
    END IF;
END $$;

-- Add default no-show fee percentage to tenants table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' 
        AND column_name = 'default_no_show_fee_percent'
    ) THEN
        ALTER TABLE public.tenants 
        ADD COLUMN default_no_show_fee_percent decimal(5,2) DEFAULT 3.00 
        CHECK (default_no_show_fee_percent >= 0 AND default_no_show_fee_percent <= 100);
    END IF;
END $$;

-- Add fee tracking fields to payments table
DO $$
BEGIN
    -- Add fee_type to distinguish between different types of fees
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'fee_type'
    ) THEN
        ALTER TABLE public.payments 
        ADD COLUMN fee_type text DEFAULT 'booking' 
        CHECK (fee_type IN ('booking', 'no_show_fee', 'refund', 'refund_fee', 'application_fee'));
    END IF;

    -- Add related_payment_id for refunds and fee captures
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'related_payment_id'
    ) THEN
        ALTER TABLE public.payments 
        ADD COLUMN related_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create refunds table for tracking refund transactions
CREATE TABLE IF NOT EXISTS public.refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    
    -- Refund details
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    reason text NOT NULL,
    refund_type text NOT NULL DEFAULT 'full' 
        CHECK (refund_type IN ('full', 'partial', 'no_show_fee_only')),
    
    -- Provider integration
    provider text NOT NULL DEFAULT 'stripe',
    provider_refund_id text,
    provider_metadata jsonb DEFAULT '{}',
    
    -- Status tracking
    status text NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
    
    -- Idempotency
    idempotency_key text,
    
    -- Metadata and timestamps
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique index for idempotency (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS refunds_idempotency_uniq 
ON public.refunds (tenant_id, provider, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Add unique index for provider refund ID (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS refunds_provider_refund_uniq 
ON public.refunds (tenant_id, provider, provider_refund_id) 
WHERE provider_refund_id IS NOT NULL;

-- Add touch trigger for refunds table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'refunds_touch_updated_at'
    ) THEN
        CREATE TRIGGER refunds_touch_updated_at
            BEFORE UPDATE ON public.refunds
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Drop existing function if it exists (in case of return type mismatch)
DROP FUNCTION IF EXISTS public.calculate_no_show_fee(uuid, uuid);

-- Create function to calculate no-show fee
CREATE OR REPLACE FUNCTION public.calculate_no_show_fee(
    p_booking_id uuid,
    p_tenant_id uuid
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking_amount integer;
    v_service_fee_percent decimal(5,2);
    v_tenant_fee_percent decimal(5,2);
    v_fee_percent decimal(5,2);
    v_fee_cents integer;
BEGIN
    -- Get the booking amount from booking_items
    SELECT COALESCE(SUM(price_cents), 0) INTO v_booking_amount
    FROM public.booking_items
    WHERE booking_id = p_booking_id
    AND tenant_id = p_tenant_id;
    
    -- Get service-specific no-show fee percentage
    SELECT s.no_show_fee_percent INTO v_service_fee_percent
    FROM public.bookings b
    JOIN public.services s ON s.id = (b.service_snapshot->>'id')::uuid
    WHERE b.id = p_booking_id
    AND b.tenant_id = p_tenant_id;
    
    -- Get tenant default no-show fee percentage
    SELECT default_no_show_fee_percent INTO v_tenant_fee_percent
    FROM public.tenants
    WHERE id = p_tenant_id;
    
    -- Use service-specific fee if available, otherwise tenant default
    v_fee_percent := COALESCE(v_service_fee_percent, v_tenant_fee_percent, 3.00);
    
    -- Calculate fee amount
    v_fee_cents := ROUND(v_booking_amount * v_fee_percent / 100);
    
    RETURN v_fee_cents;
END;
$$;

-- Drop existing function if it exists (in case of return type mismatch)
DROP FUNCTION IF EXISTS public.process_no_show_fee(uuid, uuid, uuid);

-- Create function to process no-show fee
CREATE OR REPLACE FUNCTION public.process_no_show_fee(
    p_booking_id uuid,
    p_tenant_id uuid,
    p_customer_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_fee_amount integer;
    v_payment_id uuid;
    v_booking_amount integer;
BEGIN
    -- Calculate the no-show fee
    v_fee_amount := public.calculate_no_show_fee(p_booking_id, p_tenant_id);
    
    -- Get the original booking amount for reference
    SELECT COALESCE(SUM(price_cents), 0) INTO v_booking_amount
    FROM public.booking_items
    WHERE booking_id = p_booking_id
    AND tenant_id = p_tenant_id;
    
    -- Only process if there's a fee to charge
    IF v_fee_amount > 0 THEN
        -- Create a payment record for the no-show fee
        INSERT INTO public.payments (
            tenant_id,
            booking_id,
            customer_id,
            status,
            method,
            amount_cents,
            fee_type,
            no_show_fee_cents,
            metadata
        ) VALUES (
            p_tenant_id,
            p_booking_id,
            p_customer_id,
            'requires_payment_method',
            'card',
            v_fee_amount,
            'no_show_fee',
            v_fee_amount,
            jsonb_build_object(
                'original_booking_amount', v_booking_amount,
                'fee_percentage', (v_fee_amount::decimal / v_booking_amount * 100)::decimal(5,2),
                'processed_at', now()
            )
        ) RETURNING id INTO v_payment_id;
        
        -- Mark the booking as having no-show fee applied
        UPDATE public.bookings
        SET no_show_fee_applied = true
        WHERE id = p_booking_id
        AND tenant_id = p_tenant_id;
        
        RETURN v_payment_id;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Drop existing function if it exists (in case of return type mismatch)
DROP FUNCTION IF EXISTS public.process_refund_with_fee(uuid, uuid, text, text);

-- Create function to process refund with no-show fee deduction
CREATE OR REPLACE FUNCTION public.process_refund_with_fee(
    p_original_payment_id uuid,
    p_tenant_id uuid,
    p_reason text,
    p_refund_type text DEFAULT 'partial'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_original_payment record;
    v_refund_amount integer;
    v_no_show_fee_amount integer;
    v_refund_id uuid;
BEGIN
    -- Get the original payment details
    SELECT * INTO v_original_payment
    FROM public.payments
    WHERE id = p_original_payment_id
    AND tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original payment not found';
    END IF;
    
    -- Calculate refund amount based on type
    IF p_refund_type = 'full' THEN
        v_refund_amount := v_original_payment.amount_cents;
    ELSIF p_refund_type = 'no_show_fee_only' THEN
        -- Only refund the no-show fee portion
        v_refund_amount := v_original_payment.no_show_fee_cents;
    ELSE -- partial
        -- Refund original amount minus no-show fee
        v_no_show_fee_amount := COALESCE(v_original_payment.no_show_fee_cents, 0);
        v_refund_amount := v_original_payment.amount_cents - v_no_show_fee_amount;
    END IF;
    
    -- Only process if there's an amount to refund
    IF v_refund_amount > 0 THEN
        -- Create refund record
        INSERT INTO public.refunds (
            tenant_id,
            payment_id,
            booking_id,
            amount_cents,
            reason,
            refund_type,
            metadata
        ) VALUES (
            p_tenant_id,
            p_original_payment_id,
            v_original_payment.booking_id,
            v_refund_amount,
            p_reason,
            p_refund_type,
            jsonb_build_object(
                'original_amount', v_original_payment.amount_cents,
                'no_show_fee_deducted', v_no_show_fee_amount,
                'processed_at', now()
            )
        ) RETURNING id INTO v_refund_id;
        
        RETURN v_refund_id;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_canceled_by 
ON public.bookings(canceled_by) 
WHERE canceled_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_no_show_fee_applied 
ON public.bookings(no_show_fee_applied) 
WHERE no_show_fee_applied = true;

CREATE INDEX IF NOT EXISTS idx_payments_fee_type 
ON public.payments(fee_type) 
WHERE fee_type != 'booking';

CREATE INDEX IF NOT EXISTS idx_payments_related_payment_id 
ON public.payments(related_payment_id) 
WHERE related_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id 
ON public.refunds(payment_id);

CREATE INDEX IF NOT EXISTS idx_refunds_booking_id 
ON public.refunds(booking_id) 
WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refunds_status 
ON public.refunds(status);

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.canceled_by IS 'User who canceled the booking (NULL if system-canceled)';
COMMENT ON COLUMN public.bookings.cancellation_reason IS 'Reason for cancellation (e.g., "customer_request", "no_show", "emergency")';
COMMENT ON COLUMN public.bookings.no_show_fee_applied IS 'Whether a no-show fee has been charged for this booking';
COMMENT ON COLUMN public.services.no_show_fee_percent IS 'Percentage fee charged for no-shows (overrides tenant default)';
COMMENT ON COLUMN public.tenants.default_no_show_fee_percent IS 'Default percentage fee charged for no-shows (used when service has no specific fee)';
COMMENT ON COLUMN public.payments.fee_type IS 'Type of fee: booking, no_show_fee, refund, refund_fee, application_fee';
COMMENT ON COLUMN public.payments.related_payment_id IS 'Reference to related payment (e.g., refund references original payment)';
COMMENT ON TABLE public.refunds IS 'Tracks refund transactions including no-show fee deductions';

COMMIT;
