-- ============================================================================
-- SIMPLE VERIFICATION QUERIES - Copy and paste ONE query at a time
-- Replace 'demo@tithi.com' with your email if different
-- ============================================================================

-- QUERY 1: Check subscription details (RUN THIS FIRST)
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
  b.next_bill_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';

-- QUERY 2: Get business subdomain (needed for booking creation)
SELECT 
  b.subdomain,
  b.name,
  b.id as business_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';

-- QUERY 3: Get services (needed for booking creation)
SELECT 
  s.id as service_id,
  s.name as service_name,
  s.price_cents,
  s.duration_min
FROM services s
JOIN businesses b ON b.id = s.business_id
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com'
  AND s.is_active = true
  AND s.deleted_at IS NULL
ORDER BY s.created_at DESC;

-- QUERY 4: Get staff (needed for booking creation)
SELECT 
  st.id as staff_id,
  st.name as staff_name
FROM staff st
JOIN businesses b ON b.id = st.business_id
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com'
  AND st.is_active = true
  AND st.deleted_at IS NULL
ORDER BY st.created_at DESC;

-- QUERY 5: Check all bookings
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
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY created_at DESC
LIMIT 10;

-- QUERY 6: Check specific booking (replace YOUR_BOOKING_ID)
SELECT 
  id,
  booking_code,
  status,
  payment_status,
  last_money_action,
  final_price_cents,
  stripe_setup_intent_id,
  created_at
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';

-- QUERY 7: Check payment records for a booking (replace YOUR_BOOKING_ID)
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_payment_intent_id,
  bp.stripe_setup_intent_id,
  bp.stripe_refund_id,
  bp.amount_cents,
  bp.money_action,
  bp.status,
  bp.application_fee_cents
FROM booking_payments bp
WHERE bp.booking_id = 'YOUR_BOOKING_ID'
ORDER BY bp.created_at DESC;

-- QUERY 8: Summary of all bookings and payments
SELECT 
  b.id as booking_id,
  b.booking_code,
  b.status,
  b.payment_status,
  b.last_money_action,
  bp.money_action,
  bp.amount_cents,
  bp.status as payment_record_status
FROM bookings b
LEFT JOIN booking_payments bp ON bp.booking_id = b.id
WHERE b.business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY b.created_at DESC;


