-- ============================================================================
-- COMPLETE VERIFICATION QUERIES
-- Use these queries to verify all Stripe integration components
-- Replace 'demo@tithi.com' with your email if different
-- ============================================================================

-- ============================================================================
-- 1. VERIFY SUBSCRIPTION CREATION WITH CORRECT PRICE
-- ============================================================================

-- Check subscription details and price selection
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_customer_id,
  b.stripe_subscription_id,
  b.stripe_price_id,
  b.subscription_status,
  b.notifications_enabled,
  b.trial_ends_at,
  b.next_bill_at,
  CASE 
    WHEN b.notifications_enabled = true AND b.stripe_price_id IS NOT NULL THEN 
      '✅ Pro Plan - Should use WITH_NOTIFICATIONS price'
    WHEN b.notifications_enabled = false AND b.stripe_price_id IS NOT NULL THEN 
      '✅ Basic Plan - Should use WITHOUT_NOTIFICATIONS price'
    WHEN b.stripe_price_id IS NULL THEN 
      '❌ Missing Price ID - Need to create subscription'
    ELSE '⚠️ Check price configuration'
  END as price_verification
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';

-- ============================================================================
-- 2. GET BUSINESS INFO FOR BOOKING CREATION
-- ============================================================================

-- Get business subdomain
SELECT 
  b.subdomain,
  b.name,
  b.id as business_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';

-- Get available services
SELECT 
  s.id as service_id,
  s.name as service_name,
  s.price_cents,
  s.duration_min,
  b.subdomain
FROM services s
JOIN businesses b ON b.id = s.business_id
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com'
  AND s.is_active = true
  AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

-- Get available staff
SELECT 
  st.id as staff_id,
  st.name as staff_name,
  b.subdomain
FROM staff st
JOIN businesses b ON b.id = st.business_id
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com'
  AND st.is_active = true
  AND st.deleted_at IS NULL
ORDER BY st.created_at DESC;

-- ============================================================================
-- 3. VERIFY BOOKING CREATION AND SETUPINTENT
-- ============================================================================

-- Check booking was created
SELECT 
  id,
  booking_code,
  status,
  payment_status,
  final_price_cents,
  stripe_setup_intent_id,
  created_at
FROM bookings
WHERE business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'  -- Replace with your subdomain
)
ORDER BY created_at DESC
LIMIT 10;

-- Verify SetupIntent completion
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_setup_intent_id,
  bp.status,
  b.status as booking_status,
  b.payment_status
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.stripe_setup_intent_id IS NOT NULL
  AND b.business_id = (
    SELECT id FROM businesses 
    WHERE subdomain = 'test-9s7v-1764715219148'
  )
ORDER BY bp.created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. VERIFY ALL MONEY ACTIONS (Complete, No-Show, Cancel, Refund)
-- ============================================================================

-- Check all bookings with their money actions
SELECT 
  b.id as booking_id,
  b.booking_code,
  b.status,
  b.payment_status,
  b.last_money_action,
  b.final_price_cents,
  bp.money_action,
  bp.amount_cents,
  bp.status as payment_status,
  bp.stripe_payment_intent_id,
  bp.stripe_refund_id
FROM bookings b
LEFT JOIN booking_payments bp ON bp.booking_id = b.id
WHERE b.business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY b.created_at DESC;

-- Verify Complete action
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_payment_intent_id,
  bp.amount_cents,
  bp.money_action,
  bp.status,
  bp.application_fee_cents,
  b.status as booking_status,
  b.payment_status,
  b.last_money_action
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.money_action = 'completed_charge'
  AND b.business_id = (
    SELECT id FROM businesses 
    WHERE subdomain = 'test-9s7v-1764715219148'
  )
ORDER BY bp.created_at DESC;

-- Verify No-Show action
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_payment_intent_id,
  bp.amount_cents,
  bp.money_action,
  b.status as booking_status,
  b.last_money_action
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.money_action = 'no_show_fee'
  AND b.business_id = (
    SELECT id FROM businesses 
    WHERE subdomain = 'test-9s7v-1764715219148'
  )
ORDER BY bp.created_at DESC;

-- Verify Cancel action
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_payment_intent_id,
  bp.amount_cents,
  bp.money_action,
  b.status as booking_status,
  b.last_money_action
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.money_action = 'cancel_fee'
  AND b.business_id = (
    SELECT id FROM businesses 
    WHERE subdomain = 'test-9s7v-1764715219148'
  )
ORDER BY bp.created_at DESC;

-- Verify Refund action
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_refund_id,
  bp.amount_cents,
  bp.money_action,
  b.status as booking_status,
  b.payment_status
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.money_action = 'refund'
  AND b.business_id = (
    SELECT id FROM businesses 
    WHERE subdomain = 'test-9s7v-1764715219148'
  )
ORDER BY bp.created_at DESC;

-- ============================================================================
-- 5. COMPLETE DATABASE VERIFICATION
-- ============================================================================

-- Summary of all database records
SELECT 
  -- Business info
  b.name as business_name,
  b.subdomain,
  au.email,
  
  -- Stripe setup
  CASE WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅' ELSE '❌' END as has_connect,
  CASE WHEN b.stripe_customer_id IS NOT NULL THEN '✅' ELSE '❌' END as has_customer,
  CASE WHEN b.stripe_subscription_id IS NOT NULL THEN '✅' ELSE '❌' END as has_subscription,
  CASE WHEN b.stripe_price_id IS NOT NULL THEN '✅' ELSE '❌' END as has_price_id,
  b.subscription_status,
  b.notifications_enabled,
  
  -- Bookings summary
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id) as total_bookings,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'completed') as completed,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'no_show') as noshow,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'cancelled') as cancelled,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'refunded') as refunded,
  
  -- Payments summary
  (SELECT COUNT(*) FROM booking_payments bp 
   JOIN bookings bk ON bk.id = bp.booking_id 
   WHERE bk.business_id = b.id) as total_payments,
  (SELECT COUNT(*) FROM booking_payments bp 
   JOIN bookings bk ON bk.id = bp.booking_id 
   WHERE bk.business_id = b.id AND bp.status = 'charged') as charged,
  (SELECT COUNT(*) FROM booking_payments bp 
   JOIN bookings bk ON bk.id = bp.booking_id 
   WHERE bk.business_id = b.id AND bp.money_action = 'refund') as refunds
  
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';

-- All bookings with payment details
SELECT 
  b.id as booking_id,
  b.booking_code,
  b.status as booking_status,
  b.payment_status,
  b.last_money_action,
  b.final_price_cents,
  bp.status as payment_record_status,
  bp.money_action,
  bp.amount_cents,
  bp.stripe_payment_intent_id,
  bp.stripe_setup_intent_id,
  bp.stripe_refund_id,
  bp.application_fee_cents,
  b.created_at
FROM bookings b
LEFT JOIN booking_payments bp ON bp.booking_id = b.id
WHERE b.business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY b.created_at DESC;

-- All payment records
SELECT 
  bp.id,
  bp.booking_id,
  bp.money_action,
  bp.status,
  bp.amount_cents,
  bp.application_fee_cents,
  bp.stripe_payment_intent_id,
  bp.stripe_setup_intent_id,
  bp.stripe_refund_id,
  bp.created_at,
  b.status as booking_status,
  b.payment_status,
  b.booking_code
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE b.business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY bp.created_at DESC;

-- ============================================================================
-- 6. CHECK POLICY FEES (for No-Show and Cancel)
-- ============================================================================

-- Get current policy fees
SELECT 
  no_show_fee_type,
  no_show_fee_amount_cents,
  no_show_fee_percent,
  cancel_fee_type,
  cancel_fee_amount_cents,
  cancel_fee_percent,
  version,
  is_active
FROM business_policies
WHERE business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY version DESC
LIMIT 1;

-- ============================================================================
-- 7. VERIFY SPECIFIC BOOKING (Replace booking_id)
-- ============================================================================

-- Replace 'YOUR_BOOKING_ID' with actual booking ID
SELECT 
  b.id,
  b.booking_code,
  b.status,
  b.payment_status,
  b.last_money_action,
  b.final_price_cents,
  bp.stripe_setup_intent_id,
  bp.stripe_payment_intent_id,
  bp.stripe_refund_id,
  bp.amount_cents,
  bp.money_action,
  bp.status as payment_record_status
FROM bookings b
LEFT JOIN booking_payments bp ON bp.booking_id = b.id
WHERE b.id = 'YOUR_BOOKING_ID'
ORDER BY bp.created_at DESC;

-- ============================================================================
-- QUICK STATUS CHECK
-- ============================================================================

-- Quick overview of everything
SELECT 
  'Business Setup' as category,
  CASE WHEN stripe_connect_account_id IS NOT NULL THEN '✅ Connected' ELSE '❌ Not Connected' END as status
FROM businesses
WHERE subdomain = 'test-9s7v-1764715219148'

UNION ALL

SELECT 
  'Subscription',
  CASE WHEN stripe_subscription_id IS NOT NULL THEN '✅ Created' ELSE '❌ Missing' END
FROM businesses
WHERE subdomain = 'test-9s7v-1764715219148'

UNION ALL

SELECT 
  'Total Bookings',
  COUNT(*)::text
FROM bookings
WHERE business_id = (SELECT id FROM businesses WHERE subdomain = 'test-9s7v-1764715219148')

UNION ALL

SELECT 
  'Completed Charges',
  COUNT(*)::text
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.money_action = 'completed_charge'
  AND b.business_id = (SELECT id FROM businesses WHERE subdomain = 'test-9s7v-1764715219148');


