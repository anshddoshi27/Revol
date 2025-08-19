-- === TASK 10 DATA INSERTION TESTS ===
-- Tests constraint enforcement by inserting valid and invalid data
-- Run this after executing 0010_promotions.sql and having some tenant/customer data

-- ========================================
-- PREREQUISITES
-- ========================================
-- You need at least one tenant and one customer to run these tests
-- If you don't have them, create them first or skip this script

-- ========================================
-- TEST 1: VALID COUPON INSERTIONS
-- ========================================

-- Test 1a: Percent-based coupon (valid)
INSERT INTO public.coupons (
    tenant_id, 
    code, 
    name, 
    percent_off, 
    amount_off_cents,
    minimum_amount_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1), -- Replace with actual tenant_id
    'SAVE20', 
    '20% Off', 
    20, 
    NULL,
    1000
) ON CONFLICT DO NOTHING;

-- Test 1b: Amount-based coupon (valid)
INSERT INTO public.coupons (
    tenant_id, 
    code, 
    name, 
    percent_off, 
    amount_off_cents,
    minimum_amount_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1), -- Replace with actual tenant_id
    'SAVE5', 
    '$5 Off', 
    NULL, 
    500,
    1000
) ON CONFLICT DO NOTHING;

-- ========================================
-- TEST 2: VALID GIFT CARD INSERTIONS
-- ========================================

-- Test 2a: Basic gift card
INSERT INTO public.gift_cards (
    tenant_id, 
    code, 
    initial_balance_cents, 
    current_balance_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1), -- Replace with actual tenant_id
    'GIFT100', 
    10000, -- $100.00
    10000  -- $100.00
) ON CONFLICT DO NOTHING;

-- Test 2b: Gift card with partial balance used
INSERT INTO public.gift_cards (
    tenant_id, 
    code, 
    initial_balance_cents, 
    current_balance_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1), -- Replace with actual tenant_id
    'GIFT50', 
    5000, -- $50.00
    3000  -- $30.00 (partially used)
) ON CONFLICT DO NOTHING;

-- ========================================
-- TEST 3: VALID REFERRAL INSERTIONS
-- ========================================

-- Test 3a: Basic referral
INSERT INTO public.referrals (
    tenant_id, 
    code, 
    referrer_customer_id, 
    referred_customer_id,
    reward_amount_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1), -- Replace with actual tenant_id
    'REF001', 
    (SELECT id FROM public.customers LIMIT 1), -- Replace with actual customer_id
    (SELECT id FROM public.customers LIMIT 1 OFFSET 1), -- Different customer
    1000
) ON CONFLICT DO NOTHING;

-- ========================================
-- TEST 4: CONSTRAINT VIOLATION TESTS
-- ========================================
-- These should all fail due to constraints

-- Test 4a: Coupon with both percent and amount (XOR violation)
-- This should fail:
/*
INSERT INTO public.coupons (
    tenant_id, 
    code, 
    name, 
    percent_off, 
    amount_off_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1),
    'INVALID', 
    'Invalid Coupon', 
    20, 
    500
);
*/

-- Test 4b: Coupon with percent out of range (1-100)
-- This should fail:
/*
INSERT INTO public.coupons (
    tenant_id, 
    code, 
    name, 
    percent_off
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1),
    'INVALID2', 
    'Invalid Percent', 
    150
);
*/

-- Test 4c: Coupon with zero amount
-- This should fail:
/*
INSERT INTO public.coupons (
    tenant_id, 
    code, 
    name, 
    amount_off_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1),
    'INVALID3', 
    'Zero Amount', 
    0
);
*/

-- Test 4d: Gift card with negative balance
-- This should fail:
/*
INSERT INTO public.gift_cards (
    tenant_id, 
    code, 
    initial_balance_cents, 
    current_balance_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1),
    'INVALID4', 
    -1000, 
    -1000
);
*/

-- Test 4e: Gift card with current > initial
-- This should fail:
/*
INSERT INTO public.gift_cards (
    tenant_id, 
    code, 
    initial_balance_cents, 
    current_balance_cents
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1),
    'INVALID5', 
    1000, 
    2000
);
*/

-- Test 4f: Self-referral
-- This should fail:
/*
INSERT INTO public.referrals (
    tenant_id, 
    code, 
    referrer_customer_id, 
    referred_customer_id
) VALUES (
    (SELECT id FROM public.tenants LIMIT 1),
    'INVALID6', 
    (SELECT id FROM public.customers LIMIT 1),
    (SELECT id FROM public.customers LIMIT 1) -- Same customer
);
*/

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check what was inserted successfully
SELECT 'COUPONS' AS table_name, COUNT(*) AS count FROM public.coupons
UNION ALL
SELECT 'GIFT_CARDS' AS table_name, COUNT(*) AS count FROM public.gift_cards
UNION ALL
SELECT 'REFERRALS' AS table_name, COUNT(*) AS count FROM public.referrals;

-- Check coupon types
SELECT 
    code,
    CASE 
        WHEN percent_off IS NOT NULL THEN 'PERCENT: ' || percent_off || '%'
        WHEN amount_off_cents IS NOT NULL THEN 'AMOUNT: $' || (amount_off_cents::numeric / 100)
        ELSE 'INVALID'
    END AS discount_type
FROM public.coupons;

-- Check gift card balances
SELECT 
    code,
    (initial_balance_cents::numeric / 100) AS initial_balance,
    (current_balance_cents::numeric / 100) AS current_balance,
    (current_balance_cents::numeric / 100) <= (initial_balance_cents::numeric / 100) AS valid_balance
FROM public.gift_cards;

-- Check referrals
SELECT 
    code,
    referrer_customer_id,
    referred_customer_id,
    referrer_customer_id != referred_customer_id AS no_self_referral
FROM public.referrals;
