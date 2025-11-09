BEGIN;

-- 0009 — Payments & tenant_billing (enums + FKs) (+ cash/no-show fields)

-- Table: payments
-- PCI boundary: Stripe only, no card data stored
-- Provider IDs, idempotency keys, and provider uniques for replay safety
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Core payment fields
  status public.payment_status NOT NULL DEFAULT 'requires_action',
  method public.payment_method NOT NULL DEFAULT 'card',
  currency_code text NOT NULL DEFAULT 'USD',
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  tip_cents integer NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  tax_cents integer NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  application_fee_cents integer NOT NULL DEFAULT 0 CHECK (application_fee_cents >= 0),
  
  -- Provider integration (Stripe only)
  provider text NOT NULL DEFAULT 'stripe',
  provider_payment_id text,
  provider_charge_id text,
  provider_setup_intent_id text,
  provider_metadata jsonb DEFAULT '{}',
  
  -- Idempotency and replay safety
  idempotency_key text,
  
  -- Cash payment support with backup card
  backup_setup_intent_id text,
  explicit_consent_flag boolean NOT NULL DEFAULT false,
  
  -- No-show fee handling
  no_show_fee_cents integer NOT NULL DEFAULT 0 CHECK (no_show_fee_cents >= 0),
  
  -- Royalty tracking (3% new customer)
  royalty_applied boolean NOT NULL DEFAULT false,
  royalty_basis text CHECK (royalty_basis IN ('new_customer', 'referral', 'other')),
  
  -- Metadata and timestamps
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add touch trigger for payments
DROP TRIGGER IF EXISTS payments_touch_updated_at ON public.payments;
CREATE TRIGGER payments_touch_updated_at 
  BEFORE UPDATE ON public.payments 
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Table: tenant_billing
-- Tenant-level billing configuration and Stripe Connect integration
CREATE TABLE IF NOT EXISTS public.tenant_billing (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Stripe Connect integration
  stripe_connect_id text,
  stripe_connect_enabled boolean NOT NULL DEFAULT false,
  
  -- Billing configuration
  billing_email text,
  billing_address_json jsonb DEFAULT '{}',
  
  -- Trial and pricing configuration
  trial_ends_at timestamptz,
  monthly_price_cents integer NOT NULL DEFAULT 1199 CHECK (monthly_price_cents >= 0),
  
  -- Trust messaging variants
  trust_messaging_variant text DEFAULT 'standard' CHECK (trust_messaging_variant IN ('standard', 'first_month_free', '90_day_no_monthly')),
  
  -- Payment method on file
  default_payment_method_id text,
  
  -- Metadata and timestamps
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add touch trigger for tenant_billing
DROP TRIGGER IF EXISTS tenant_billing_touch_updated_at ON public.tenant_billing;
CREATE TRIGGER tenant_billing_touch_updated_at 
  BEFORE UPDATE ON public.tenant_billing 
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Unique constraints for idempotency and replay safety
CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_provider_idempotency_uniq 
  ON public.payments(tenant_id, provider, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_provider_charge_uniq 
  ON public.payments(tenant_id, provider, provider_charge_id) 
  WHERE provider_charge_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_provider_payment_uniq 
  ON public.payments(tenant_id, provider, provider_payment_id) 
  WHERE provider_payment_id IS NOT NULL;

COMMIT;
