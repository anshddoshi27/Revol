-- === TASK 10 LIVE DATA SCANS (error-proof, no writes) ===
-- Returns rows only; zero rows = no violations.
-- At the end, you get a PASS/FAIL summary.

WITH
-- ----- Source snapshots -----
coupons AS (
  SELECT id, tenant_id, code, percent_off, amount_off_cents,
         minimum_amount_cents, maximum_discount_cents,
         starts_at, expires_at, created_at, deleted_at,
         usage_count, usage_limit
  FROM public.coupons
),
gift_cards AS (
  SELECT id, tenant_id, code, initial_balance_cents, current_balance_cents
  FROM public.gift_cards
),
referrals AS (
  SELECT id, tenant_id, code, referrer_customer_id, referred_customer_id, status,
         reward_amount_cents, referrer_reward_cents, referred_reward_cents
  FROM public.referrals
),

-- ----- Violation finders (each returns test name + key columns) -----
v_coupons_xor AS (
  SELECT 'coupons_xor_violation'::text AS test, id, tenant_id, code
  FROM coupons
  WHERE NOT (
    (percent_off IS NOT NULL AND amount_off_cents IS NULL)
    OR
    (percent_off IS NULL AND amount_off_cents IS NOT NULL)
  )
),
v_coupons_pct AS (
  SELECT 'coupons_percent_out_of_range', id, tenant_id, code
  FROM coupons
  WHERE percent_off IS NOT NULL
    AND NOT (percent_off BETWEEN 1 AND 100)
),
v_coupons_amt AS (
  SELECT 'coupons_amount_not_positive', id, tenant_id, code
  FROM coupons
  WHERE amount_off_cents IS NOT NULL
    AND amount_off_cents <= 0
),
v_coupons_min AS (
  SELECT 'coupons_minimum_negative', id, tenant_id, code
  FROM coupons
  WHERE minimum_amount_cents < 0
),
v_coupons_max AS (
  SELECT 'coupons_maximum_negative', id, tenant_id, code
  FROM coupons
  WHERE maximum_discount_cents IS NOT NULL
    AND maximum_discount_cents < 0
),
v_coupons_dates AS (
  SELECT 'coupons_expires_before_starts', id, tenant_id, code
  FROM coupons
  WHERE expires_at IS NOT NULL
    AND starts_at IS NOT NULL
    AND expires_at <= starts_at
),
v_coupons_soft_delete AS (
  SELECT 'coupons_soft_delete_temporal_violation', id, tenant_id, code
  FROM coupons
  WHERE deleted_at IS NOT NULL
    AND deleted_at < created_at
),
v_coupons_usage_cnt AS (
  SELECT 'coupons_usage_count_negative', id, tenant_id, code
  FROM coupons
  WHERE usage_count < 0
),
v_coupons_usage_lim AS (
  SELECT 'coupons_usage_limit_not_positive', id, tenant_id, code
  FROM coupons
  WHERE usage_limit IS NOT NULL
    AND usage_limit <= 0
),

v_gc_init AS (
  SELECT 'gift_cards_initial_negative', id, tenant_id, code
  FROM gift_cards
  WHERE initial_balance_cents < 0
),
v_gc_curr AS (
  SELECT 'gift_cards_current_negative', id, tenant_id, code
  FROM gift_cards
  WHERE current_balance_cents < 0
),
v_gc_over AS (
  SELECT 'gift_cards_current_exceeds_initial', id, tenant_id, code
  FROM gift_cards
  WHERE current_balance_cents > initial_balance_cents
),

v_ref_self AS (
  SELECT 'referrals_self_referral', id, tenant_id, code
  FROM referrals
  WHERE referrer_customer_id = referred_customer_id
),
v_ref_code_dup AS (
  SELECT 'referrals_code_duplicate' AS test, 
         (array_agg(id))[1] AS id,  -- Get first ID from the group
         tenant_id, 
         code
  FROM referrals
  GROUP BY tenant_id, code
  HAVING COUNT(*) > 1
),
v_ref_pair_dup AS (
  SELECT 'referrals_pair_duplicate' AS test, 
         (array_agg(id))[1] AS id,  -- Get first ID from the group
         tenant_id, 
         (array_agg(code))[1] AS code  -- Get first code from the group
  FROM referrals
  GROUP BY tenant_id, referrer_customer_id, referred_customer_id
  HAVING COUNT(*) > 1
),

-- ----- Union of all violations -----
all_violations AS (
  SELECT * FROM v_coupons_xor
  UNION ALL SELECT * FROM v_coupons_pct
  UNION ALL SELECT * FROM v_coupons_amt
  UNION ALL SELECT * FROM v_coupons_min
  UNION ALL SELECT * FROM v_coupons_max
  UNION ALL SELECT * FROM v_coupons_dates
  UNION ALL SELECT * FROM v_coupons_soft_delete
  UNION ALL SELECT * FROM v_coupons_usage_cnt
  UNION ALL SELECT * FROM v_coupons_usage_lim
  UNION ALL SELECT * FROM v_gc_init
  UNION ALL SELECT * FROM v_gc_curr
  UNION ALL SELECT * FROM v_gc_over
  UNION ALL SELECT * FROM v_ref_self
  UNION ALL SELECT * FROM v_ref_code_dup
  UNION ALL SELECT * FROM v_ref_pair_dup
)

-- ----- 1) Detail rows (any violations appear here) -----
SELECT test, id, tenant_id, code
FROM all_violations
ORDER BY test, tenant_id NULLS LAST, code NULLS LAST, id NULLS LAST;

-- The above should return zero rows if everything is working correctly.
-- If you see any rows, those indicate constraint violations that should be impossible.

-- ----- 2) One-line summary (PASS if zero violations) -----
-- (Uncomment the section below to get a summary)
/*
WITH s AS (
  SELECT COUNT(*) AS n FROM all_violations
)
SELECT CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END AS status, n AS violation_count
FROM s;
*/
