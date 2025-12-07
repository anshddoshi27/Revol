-- Query 1: Find account by DAMBOX (search in name or email)
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
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE b.name ILIKE '%DAMBOX%'
   OR au.email ILIKE '%DAMBOX%'
ORDER BY b.created_at DESC;

-- Query 2: Find the MOST RECENT business account
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
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC
LIMIT 5;

-- Query 3: Show ALL businesses so you can find yours
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.subscription_status,
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;

-- Query 4: Search for DAMBOX in all fields
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
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE b.name ILIKE '%DAMBOX%'
   OR au.email ILIKE '%DAMBOX%'
   OR b.subdomain ILIKE '%DAMBOX%'
ORDER BY b.created_at DESC;


