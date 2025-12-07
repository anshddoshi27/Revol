-- Step 1: Find ALL businesses (see what exists)
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;

-- Step 2: Find ALL users (to see what emails exist)
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- Step 3: Check if business exists but without Stripe setup
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  CASE 
    WHEN b.stripe_connect_account_id IS NULL THEN '❌ No Connect Account'
    ELSE '✅ Has Connect Account: ' || b.stripe_connect_account_id
  END as connect_status,
  CASE 
    WHEN b.stripe_subscription_id IS NULL THEN '❌ No Subscription'
    ELSE '✅ Has Subscription: ' || b.stripe_subscription_id
  END as subscription_status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;

-- Step 4: Match Stripe accounts with database businesses
-- First, get all Stripe account IDs you see in Stripe Dashboard
-- Then check if any match:
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE b.stripe_connect_account_id IS NOT NULL;

-- Step 5: Find businesses without any Stripe setup
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  '❌ No Stripe setup' as status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE b.stripe_connect_account_id IS NULL
ORDER BY b.created_at DESC;


