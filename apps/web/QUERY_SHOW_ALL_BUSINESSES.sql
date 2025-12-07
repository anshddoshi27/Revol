-- Show all businesses so you can find yours
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.subscription_status,
  b.notifications_enabled,
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;


