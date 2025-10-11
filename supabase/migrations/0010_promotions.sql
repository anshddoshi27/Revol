BEGIN;

-- Promotions tables: coupons, gift_cards, referrals
-- Implements Design Brief section 6) Promotions Rules (Final)
-- XOR checks, non-negative balances, unique constraints, no self-referrals

-- Table: coupons
-- XOR constraint: exactly one of percent_off [1-100] OR amount_off_cents > 0
CREATE TABLE IF NOT EXISTS public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code text NOT NULL,
    name text NOT NULL DEFAULT '',
    description text DEFAULT '',
    percent_off int, -- Must be between 1 and 100 if used
    amount_off_cents int, -- Must be > 0 if used
    minimum_amount_cents int NOT NULL DEFAULT 0,
    maximum_discount_cents int, -- Optional cap on discount
    usage_limit int, -- NULL = unlimited
    usage_count int NOT NULL DEFAULT 0,
    starts_at timestamptz,
    expires_at timestamptz,
    active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    
    -- XOR constraint: exactly one of percent_off or amount_off_cents
    CONSTRAINT coupons_discount_xor CHECK (
        (percent_off IS NOT NULL AND amount_off_cents IS NULL) OR
        (percent_off IS NULL AND amount_off_cents IS NOT NULL)
    ),
    
    -- Percent off must be between 1 and 100
    CONSTRAINT coupons_percent_off_range CHECK (
        percent_off IS NULL OR (percent_off BETWEEN 1 AND 100)
    ),
    
    -- Amount off must be positive
    CONSTRAINT coupons_amount_off_positive CHECK (
        amount_off_cents IS NULL OR amount_off_cents > 0
    ),
    
    -- Non-negative constraints
    CONSTRAINT coupons_minimum_amount_non_negative CHECK (minimum_amount_cents >= 0),
    CONSTRAINT coupons_maximum_discount_non_negative CHECK (maximum_discount_cents IS NULL OR maximum_discount_cents >= 0),
    CONSTRAINT coupons_usage_limit_positive CHECK (usage_limit IS NULL OR usage_limit > 0),
    CONSTRAINT coupons_usage_count_non_negative CHECK (usage_count >= 0),
    
    -- Temporal constraints
    CONSTRAINT coupons_expires_after_starts CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
    CONSTRAINT coupons_soft_delete_temporal CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

-- Unique constraint: (tenant_id, code) for active coupons
CREATE UNIQUE INDEX IF NOT EXISTS coupons_tenant_code_uniq 
ON public.coupons(tenant_id, code) 
WHERE deleted_at IS NULL;

-- Table: gift_cards
-- Non-negative balances, unique (tenant_id, code)
CREATE TABLE IF NOT EXISTS public.gift_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code text NOT NULL,
    initial_balance_cents int NOT NULL,
    current_balance_cents int NOT NULL,
    purchaser_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    recipient_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    expires_at timestamptz,
    active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Non-negative balance constraints
    CONSTRAINT gift_cards_initial_balance_non_negative CHECK (initial_balance_cents >= 0),
    CONSTRAINT gift_cards_current_balance_non_negative CHECK (current_balance_cents >= 0),
    
    -- Current balance cannot exceed initial balance
    CONSTRAINT gift_cards_current_lte_initial CHECK (current_balance_cents <= initial_balance_cents)
);

-- Unique constraint: (tenant_id, code)
CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_tenant_code_uniq 
ON public.gift_cards(tenant_id, code);

-- Table: referrals
-- Unique (tenant_id, referrer_customer_id, referred_customer_id), no self-referrals, unique (tenant_id, code)
CREATE TABLE IF NOT EXISTS public.referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code text NOT NULL,
    referrer_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    referred_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    reward_amount_cents int NOT NULL DEFAULT 0,
    referrer_reward_cents int NOT NULL DEFAULT 0,
    referred_reward_cents int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending', -- pending, completed, expired
    completed_at timestamptz,
    expires_at timestamptz,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- No self-referrals
    CONSTRAINT referrals_no_self_referral CHECK (referrer_customer_id != referred_customer_id),
    
    -- Non-negative reward amounts
    CONSTRAINT referrals_reward_amount_non_negative CHECK (reward_amount_cents >= 0),
    CONSTRAINT referrals_referrer_reward_non_negative CHECK (referrer_reward_cents >= 0),
    CONSTRAINT referrals_referred_reward_non_negative CHECK (referred_reward_cents >= 0),
    
    -- Valid status values
    CONSTRAINT referrals_valid_status CHECK (status IN ('pending', 'completed', 'expired'))
);

-- Unique constraint: (tenant_id, referrer_customer_id, referred_customer_id)
CREATE UNIQUE INDEX IF NOT EXISTS referrals_tenant_referrer_referred_uniq 
ON public.referrals(tenant_id, referrer_customer_id, referred_customer_id);

-- Unique constraint: (tenant_id, code)
CREATE UNIQUE INDEX IF NOT EXISTS referrals_tenant_code_uniq 
ON public.referrals(tenant_id, code);

-- Attach touch_updated_at triggers to coupons and gift_cards (as specified in task)
DO $$
BEGIN
    -- Coupons trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'coupons_touch_updated_at'
    ) THEN
        CREATE TRIGGER coupons_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.coupons
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
    
    -- Gift cards trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'gift_cards_touch_updated_at'
    ) THEN
        CREATE TRIGGER gift_cards_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.gift_cards
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
    
    -- Referrals trigger (adding for consistency)
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'referrals_touch_updated_at'
    ) THEN
        CREATE TRIGGER referrals_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.referrals
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

COMMIT;
