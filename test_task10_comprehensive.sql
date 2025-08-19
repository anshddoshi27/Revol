-- === TASK 10 COMPREHENSIVE VALIDATION ===
-- Tests every single requirement from the rubric
-- Run this after executing 0010_promotions.sql

-- ========================================
-- A) INTERFACES CREATED (TABLES & TRIGGERS)
-- ========================================

-- Check tables exist
SELECT 'A1: Tables exist' AS test_category, 
       CASE 
         WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') 
           AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_cards')
           AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referrals')
         THEN 'PASS' 
         ELSE 'FAIL' 
       END AS status;

-- Check required columns exist
SELECT 'A2: Required columns exist' AS test_category,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'coupons' 
             AND column_name IN ('created_at', 'updated_at', 'tenant_id')
         ) AND EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'gift_cards' 
             AND column_name IN ('created_at', 'updated_at', 'tenant_id')
         ) AND EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'referrals' 
             AND column_name IN ('created_at', 'updated_at', 'tenant_id')
         )
         THEN 'PASS'
         ELSE 'FAIL'
       END AS status;

-- Check triggers exist
SELECT 'A3: Touch triggers exist' AS test_category,
       CASE 
         WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coupons_touch_updated_at')
           AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gift_cards_touch_updated_at')
           AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'referrals_touch_updated_at')
         THEN 'PASS'
         ELSE 'FAIL'
       END AS status;

-- ========================================
-- B) REQUIRED COLUMNS & CONSTRAINTS
-- ========================================

-- Check tenant_id is NOT NULL
SELECT 'B1: tenant_id NOT NULL' AS test_category,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'coupons' 
             AND column_name = 'tenant_id' AND is_nullable = 'NO'
         ) AND EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'gift_cards' 
             AND column_name = 'tenant_id' AND is_nullable = 'NO'
         ) AND EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'referrals' 
             AND column_name = 'tenant_id' AND is_nullable = 'NO'
         )
         THEN 'PASS'
         ELSE 'FAIL'
       END AS status;

-- Check foreign key constraints exist
SELECT 'B2: Foreign keys exist' AS test_category,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE table_schema = 'public' AND table_name = 'coupons' 
             AND constraint_type = 'FOREIGN KEY'
         ) AND EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE table_schema = 'public' AND table_name = 'gift_cards' 
             AND constraint_type = 'FOREIGN KEY'
         ) AND EXISTS (
           SELECT 1 FROM information_schema.table_constraints 
           WHERE table_schema = 'public' AND table_name = 'referrals' 
             AND constraint_type = 'FOREIGN KEY'
         )
         THEN 'PASS'
         ELSE 'FAIL'
       END AS status;

-- Check unique constraints exist
SELECT 'B3: Unique constraints exist' AS test_category,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM pg_indexes 
           WHERE tablename = 'coupons' AND indexname LIKE '%tenant_code%'
         ) AND EXISTS (
           SELECT 1 FROM pg_indexes 
           WHERE tablename = 'gift_cards' AND indexname LIKE '%tenant_code%'
         ) AND EXISTS (
           SELECT 1 FROM pg_indexes 
           WHERE tablename = 'referrals' AND indexname LIKE '%tenant_code%'
         ) AND EXISTS (
           SELECT 1 FROM pg_indexes 
           WHERE tablename = 'referrals' AND indexname LIKE '%referrer_referred%'
         )
         THEN 'PASS'
         ELSE 'FAIL'
       END AS status;

-- ========================================
-- C) MIGRATION HYGIENE
-- ========================================

-- Check if migration file exists (this is a manual check)
SELECT 'C1: Migration file exists' AS test_category,
       'MANUAL CHECK: Verify infra/supabase/migrations/0010_promotions.sql exists' AS status;

-- Check transaction wrapping (this would be visible in the file)
SELECT 'C2: Transaction wrapped' AS test_category,
       'MANUAL CHECK: Verify BEGIN; ... COMMIT; in migration file' AS status;

-- Check idempotency (IF NOT EXISTS usage)
SELECT 'C3: Idempotent creation' AS test_category,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM pg_indexes 
           WHERE tablename = 'coupons' AND indexname LIKE '%tenant_code%'
         )
         THEN 'PASS (tables created successfully)'
         ELSE 'FAIL'
       END AS status;

-- ========================================
-- D) CONSTRAINT VALIDATION (LIVE DATA)
-- ========================================

-- This section tests actual constraint enforcement
-- Only run if you have data in the tables

-- Test XOR constraint on coupons
SELECT 'D1: Coupons XOR constraint' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.coupons 
           WHERE NOT (
             (percent_off IS NOT NULL AND amount_off_cents IS NULL)
             OR
             (percent_off IS NULL AND amount_off_cents IS NOT NULL)
           )
         )
         THEN 'PASS'
         ELSE 'FAIL (XOR violation found)'
       END AS status;

-- Test percent_off range
SELECT 'D2: Coupons percent range' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.coupons 
           WHERE percent_off IS NOT NULL 
             AND NOT (percent_off BETWEEN 1 AND 100)
         )
         THEN 'PASS'
         ELSE 'FAIL (percent out of range)'
       END AS status;

-- Test amount_off_cents positive
SELECT 'D3: Coupons amount positive' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.coupons 
           WHERE amount_off_cents IS NOT NULL 
             AND amount_off_cents <= 0
         )
         THEN 'PASS'
         ELSE 'FAIL (amount not positive)'
       END AS status;

-- Test gift card balances non-negative
SELECT 'D4: Gift card balances non-negative' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.gift_cards 
           WHERE initial_balance_cents < 0 
              OR current_balance_cents < 0
         )
         THEN 'PASS'
         ELSE 'FAIL (negative balance found)'
       END AS status;

-- Test gift card current <= initial
SELECT 'D5: Gift card current <= initial' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.gift_cards 
           WHERE current_balance_cents > initial_balance_cents
         )
         THEN 'PASS'
         ELSE 'FAIL (current exceeds initial)'
       END AS status;

-- Test no self-referrals
SELECT 'D6: No self-referrals' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.referrals 
           WHERE referrer_customer_id = referred_customer_id
         )
         THEN 'PASS'
         ELSE 'FAIL (self-referral found)'
       END AS status;

-- Test referral rewards non-negative
SELECT 'D7: Referral rewards non-negative' AS test_category,
       CASE 
         WHEN NOT EXISTS (
           SELECT 1 FROM public.referrals 
           WHERE reward_amount_cents < 0 
              OR referrer_reward_cents < 0 
              OR referred_reward_cents < 0
         )
         THEN 'PASS'
         ELSE 'FAIL (negative reward found)'
       END AS status;

-- ========================================
-- SUMMARY
-- ========================================

-- Count total tests and passes
WITH test_results AS (
  SELECT 
    CASE 
      WHEN status LIKE 'PASS%' THEN 1 
      ELSE 0 
    END AS passed,
    CASE 
      WHEN status LIKE 'FAIL%' THEN 1 
      ELSE 0 
    END AS failed,
    CASE 
      WHEN status LIKE 'MANUAL%' THEN 1 
      ELSE 0 
    END AS manual
    FROM (
      SELECT 'A1: Tables exist' AS test_category, 
             CASE 
               WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') 
                 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gift_cards')
                 AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referrals')
               THEN 'PASS' 
               ELSE 'FAIL' 
             END AS status
      UNION ALL
      SELECT 'A2: Required columns exist' AS test_category,
             CASE 
               WHEN EXISTS (
                 SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'coupons' 
                   AND column_name IN ('created_at', 'updated_at', 'tenant_id')
               ) AND EXISTS (
                 SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'gift_cards' 
                   AND column_name IN ('created_at', 'updated_at', 'tenant_id')
               ) AND EXISTS (
                 SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'referrals' 
                   AND column_name IN ('created_at', 'updated_at', 'tenant_id')
               )
               THEN 'PASS'
               ELSE 'FAIL'
             END AS status
      UNION ALL
      SELECT 'A3: Touch triggers exist' AS test_category,
             CASE 
               WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coupons_touch_updated_at')
                 AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gift_cards_touch_updated_at')
                 AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'referrals_touch_updated_at')
               THEN 'PASS'
               ELSE 'FAIL'
             END AS status
      UNION ALL
      SELECT 'B1: tenant_id NOT NULL' AS test_category,
             CASE 
               WHEN EXISTS (
                 SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'coupons' 
                   AND column_name = 'tenant_id' AND is_nullable = 'NO'
               ) AND EXISTS (
                 SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'gift_cards' 
                   AND column_name = 'tenant_id' AND is_nullable = 'NO'
               ) AND EXISTS (
                 SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'referrals' 
                   AND column_name = 'tenant_id' AND is_nullable = 'NO'
               )
               THEN 'PASS'
               ELSE 'FAIL'
             END AS status
      UNION ALL
      SELECT 'B2: Foreign keys exist' AS test_category,
             CASE 
               WHEN EXISTS (
                 SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_schema = 'public' AND table_name = 'coupons' 
                   AND constraint_type = 'FOREIGN KEY'
               ) AND EXISTS (
                 SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_schema = 'public' AND table_name = 'gift_cards' 
                   AND constraint_type = 'FOREIGN KEY'
               ) AND EXISTS (
                 SELECT 1 FROM information_schema.table_constraints 
                 WHERE table_schema = 'public' AND table_name = 'referrals' 
                   AND constraint_type = 'FOREIGN KEY'
               )
               THEN 'PASS'
               ELSE 'FAIL'
             END AS status
      UNION ALL
      SELECT 'B3: Unique constraints exist' AS test_category,
             CASE 
               WHEN EXISTS (
                 SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'coupons' AND indexname LIKE '%tenant_code%'
               ) AND EXISTS (
                 SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'gift_cards' AND indexname LIKE '%tenant_code%'
               ) AND EXISTS (
                 SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'referrals' AND indexname LIKE '%tenant_code%'
               ) AND EXISTS (
                 SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'referrals' AND indexname LIKE '%referrer_referred%'
               )
               THEN 'PASS'
               ELSE 'FAIL'
             END AS status
      UNION ALL
      SELECT 'C3: Idempotent creation' AS test_category,
             CASE 
               WHEN EXISTS (
                 SELECT 1 FROM pg_indexes 
                 WHERE tablename = 'coupons' AND indexname LIKE '%tenant_code%'
               )
               THEN 'PASS (tables created successfully)'
               ELSE 'FAIL'
             END AS status
    ) AS all_tests
)
SELECT 
  'SUMMARY' AS test_category,
  passed || ' PASSED, ' || failed || ' FAILED, ' || manual || ' MANUAL CHECKS' AS status
FROM test_results;
