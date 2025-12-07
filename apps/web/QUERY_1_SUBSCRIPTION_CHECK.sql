-- Query 1: Check DAMBOX account subscription status
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
WHERE b.name = 'DAMBOX'
   OR au.email = 'johny@gmail.com'
ORDER BY b.created_at DESC
LIMIT 1;

