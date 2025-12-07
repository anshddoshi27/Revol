-- Quick Check: Stripe Connect Account Status
-- Run this in your Supabase SQL Editor or database tool
-- Replace 'YOUR_EMAIL_HERE' with your actual email address

-- Option 1: Check by your email
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.subdomain,
  au.email as owner_email,
  b.stripe_connect_account_id,
  b.stripe_customer_id,
  b.stripe_subscription_id,
  b.stripe_price_id,
  b.subscription_status,
  b.notifications_enabled,
  -- Status checks
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅ Has Connect Account'
    ELSE '❌ Missing Connect Account'
  END as connect_status,
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅ Has Subscription'
    ELSE '❌ Missing Subscription'
  END as subscription_status,
  CASE 
    WHEN b.stripe_price_id IS NOT NULL THEN '✅ Has Price ID'
    ELSE '❌ Missing Price ID'
  END as price_status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';  -- ⚠️ REPLACE THIS with your email


-- Option 2: See ALL businesses (if you don't know your email)
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.subscription_status,
  b.created_at,
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_connect
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;


-- Option 3: Check if ANY business has Stripe setup
SELECT 
  COUNT(*) as total_businesses,
  COUNT(b.stripe_connect_account_id) as businesses_with_connect,
  COUNT(b.stripe_subscription_id) as businesses_with_subscription,
  COUNT(*) FILTER (WHERE b.stripe_connect_account_id IS NOT NULL AND b.stripe_subscription_id IS NOT NULL) as fully_setup
FROM businesses b;



