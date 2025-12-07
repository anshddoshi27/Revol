# How to Verify Stripe Connect Account & Subscription Creation

This guide explains how to verify that:
1. **Stripe Connect account** is created and linked correctly
2. **Subscription** is created with the correct price based on notifications settings

---

## 📋 Overview

During onboarding **Step 11 (Payment Setup)**, two critical Stripe integrations happen:

1. **Stripe Connect Account Creation** - Creates a Stripe Express account for the business to receive payments
2. **Subscription Creation** - Creates a subscription for the business with pricing based on `notifications_enabled` flag

---

## ✅ Verification Method 1: Database Queries

### Step 1: Verify Stripe Connect Account Creation

After completing Step 11 of onboarding, run this SQL query to verify the Connect account is created:

```sql
-- Check if Stripe Connect account is created and linked
-- NOTE: Uses auth.users (Supabase Auth table) instead of users table
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.subdomain,
  b.stripe_connect_account_id,
  au.email as owner_email,
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅ Created'
    ELSE '❌ Missing'
  END as connect_account_status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'your-email@example.com';  -- Replace with actual email
```

**Expected Result:**
- `stripe_connect_account_id` should be **NOT NULL**
- Account ID should start with `acct_` (e.g., `acct_1234567890`)

### Step 2: Verify Subscription Creation with Correct Price

Run this query to verify subscription details:

```sql
-- Verify subscription creation and price selection
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.subdomain,
  b.stripe_connect_account_id,
  b.stripe_customer_id,
  b.stripe_subscription_id,
  b.stripe_price_id,
  b.subscription_status,
  b.notifications_enabled,
  b.trial_ends_at,
  b.next_bill_at,
  -- Verify price selection logic
  CASE 
    WHEN b.notifications_enabled = true AND b.stripe_price_id = 'YOUR_PRICE_ID_WITH_NOTIFICATIONS' THEN '✅ Correct (Pro Plan)'
    WHEN b.notifications_enabled = false AND b.stripe_price_id = 'YOUR_PRICE_ID_WITHOUT_NOTIFICATIONS' THEN '✅ Correct (Basic Plan)'
    WHEN b.stripe_price_id IS NULL THEN '❌ Missing Price ID'
    ELSE '⚠️ Price may not match notifications setting'
  END as price_verification
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'your-email@example.com';  -- Replace with actual email
```

**Expected Results:**

| Field | Expected Value | Notes |
|-------|---------------|-------|
| `stripe_subscription_id` | `sub_xxxxx` | Should NOT be NULL |
| `stripe_price_id` | `price_xxxxx` | Should NOT be NULL |
| `subscription_status` | `'trial'` or `'active'` | Should be set |
| `notifications_enabled` | `true` or `false` | From Step 8 (Notifications) |
| `trial_ends_at` | Date 7 days from creation | Trial period |
| `next_bill_at` | Date (trial end or period end) | Next billing date |
| `price_verification` | ✅ Correct | Should match notifications setting |

### Step 3: Verify Complete Setup

Run this comprehensive check:

```sql
-- Complete verification checklist
SELECT 
  au.email,
  b.name as business_name,
  b.subdomain,
  -- Connect Account
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_connect_account,
  -- Customer
  CASE 
    WHEN b.stripe_customer_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_customer_id,
  -- Subscription
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_subscription,
  -- Price ID
  CASE 
    WHEN b.stripe_price_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_price_id,
  -- Status
  b.subscription_status,
  -- Trial
  CASE 
    WHEN b.trial_ends_at IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_trial_end,
  -- Notifications
  b.notifications_enabled,
  b.stripe_price_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'your-email@example.com';  -- Replace with actual email
```

**All fields should show ✅ for a complete setup.**

---

## ✅ Verification Method 2: Stripe Dashboard

### Step 1: Verify Stripe Connect Account

1. **Navigate to Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com
   - Log in with your Stripe account

2. **Go to Connect → Accounts:**
   - Click "Connect" in the left sidebar
   - Click "Accounts"
   - You'll see a list of all connected accounts

3. **Find Your Account:**
   - Search by email address (the business owner's email)
   - Or search by account ID if you have it from the database

4. **Verify Account Details:**
   - **Account Type:** Should be `Express` ✅
   - **Account Status:** Should be `Active` or `Onboarding complete` ✅
   - **Account ID:** Should match `businesses.stripe_connect_account_id` in your database ✅
   - **Charges Enabled:** Should be `Yes` ✅
   - **Payouts Enabled:** Should be `Yes` (after onboarding completes) ✅

5. **Compare with Database:**
   ```sql
   SELECT stripe_connect_account_id 
   FROM businesses 
   WHERE user_id = (SELECT id FROM users WHERE email = 'your-email@example.com');
   ```
   - The account ID in Stripe Dashboard should **exactly match** the database value

### Step 2: Verify Subscription Creation

1. **Navigate to Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com
   - Click "Customers" in the left sidebar

2. **Find the Customer:**
   - Search by business owner's email address
   - Click on the customer to view details

3. **Check Subscriptions Tab:**
   - Click the "Subscriptions" tab
   - You should see an active subscription

4. **Verify Subscription Details:**
   - **Subscription ID:** Should match `businesses.stripe_subscription_id` in database ✅
   - **Status:** Should be `trialing`, `active`, or `incomplete` ✅
   - **Price:** Click on the subscription to see price details
   - **Trial End:** Should be 7 days from creation date ✅
   - **Metadata:** Click to view metadata:
     - Should contain `business_id`: Your business UUID ✅
     - Should contain `user_id`: Your user UUID ✅

5. **Verify Price Selection:**
   - Click on the subscription
   - Click on the price/item to view details
   - **Price ID:** Should match `businesses.stripe_price_id` in database ✅
   - **Amount:** 
     - If `notifications_enabled = true`: Should be **$21.99/month** (Pro Plan) ✅
     - If `notifications_enabled = false`: Should be **$11.99/month** (Basic Plan) ✅

6. **Compare Price IDs:**
   ```sql
   -- Get price ID from database
   SELECT 
     notifications_enabled,
     stripe_price_id,
     CASE 
       WHEN notifications_enabled = true THEN 'Should use STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS'
       ELSE 'Should use STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS'
     END as expected_price_source
   FROM businesses 
   WHERE user_id = (SELECT id FROM users WHERE email = 'your-email@example.com');
   ```
   - Verify the `stripe_price_id` matches your environment variable:
     - Check `.env` file for `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
     - Check `.env` file for `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`
   - The price ID in Stripe Dashboard should match the database value

---

## ✅ Verification Method 3: API Response Check

### Check Step 11 API Response

When you call the Step 11 payment setup endpoint, you should see:

```bash
curl -X POST http://localhost:3000/api/business/onboarding/step-11-payment-setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "email": "your-email@example.com"
  }'
```

**Expected Response (First Call - Account Creation):**
```json
{
  "success": true,
  "accountLinkUrl": "https://connect.stripe.com/setup/s/xxxxx",
  "connectAccountId": "acct_1234567890",
  "message": "Please complete Stripe Connect onboarding"
}
```

**Expected Response (After Onboarding - Subscription Creation):**
```json
{
  "success": true,
  "connectAccountId": "acct_1234567890",
  "subscriptionId": "sub_1234567890",
  "message": "Payment setup completed successfully"
}
```

### Check Server Logs

Look at your server console logs when Step 11 completes. You should see:

```
[step-11-payment-setup] Creating subscription for business xxxxx:
  - notifications_enabled: true (or false)
  - Plan: Pro ($21.99/month) (or Basic ($11.99/month))
  - Selected Stripe Price ID: price_xxxxx
  - Price ID source: WITH_NOTIFICATIONS (or WITHOUT_NOTIFICATIONS)
Subscription saved successfully:
  - Subscription ID: sub_xxxxx
  - Price ID: price_xxxxx
  - Notifications enabled: true (or false)
  - Status: trial
  - Plan: Pro ($21.99/month) (or Basic ($11.99/month))
```

---

## 🔍 Troubleshooting

### Issue: Connect Account Not Created

**Symptoms:**
- `stripe_connect_account_id` is NULL in database
- No account in Stripe Dashboard

**Solutions:**
1. Check server logs for errors during Step 11
2. Verify Stripe API keys are set correctly in `.env`
3. Check if Account Link URL was generated
4. Verify user completed the Stripe onboarding flow
5. Re-run Step 11 if needed

### Issue: Subscription Not Created

**Symptoms:**
- `stripe_subscription_id` is NULL in database
- No subscription in Stripe Dashboard

**Solutions:**
1. Check server logs for subscription creation errors
2. Verify price IDs are set in `.env`:
   - `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
   - `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`
   - Or fallback: `STRIPE_PLAN_PRICE_ID`
3. Verify Connect account is active (charges_enabled = true)
4. Check if customer was created (`stripe_customer_id` should exist)
5. Verify `notifications_enabled` is set in businesses table

### Issue: Wrong Price Selected

**Symptoms:**
- Price ID doesn't match notifications setting
- Wrong subscription amount

**Solutions:**
1. Check `businesses.notifications_enabled` value:
   ```sql
   SELECT notifications_enabled FROM businesses WHERE id = 'your-business-id';
   ```
2. Verify price IDs in `.env` match Stripe Dashboard:
   - With notifications: `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
   - Without notifications: `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`
3. Check server logs to see which price was selected:
   ```
   Creating subscription for business xxxxx:
     - notifications_enabled: [true/false]
     - Selected Stripe Price ID: [should match env var]
   ```

### Issue: Subscription Status Wrong

**Symptoms:**
- Status is not 'trial' after creation
- Trial end date is missing

**Solutions:**
1. Check if subscription was created with `trial_period_days: 7` in the code
2. Verify webhook is updating status correctly
3. Check Stripe Dashboard for actual subscription status
4. Manually update database if needed (after verifying in Stripe)

---

## 📝 Quick Verification Checklist

After completing Step 11, verify ALL of these:

### Database Verification ✅
- [ ] `stripe_connect_account_id` is NOT NULL and starts with `acct_`
- [ ] `stripe_customer_id` is NOT NULL and starts with `cus_`
- [ ] `stripe_subscription_id` is NOT NULL and starts with `sub_`
- [ ] `stripe_price_id` is NOT NULL and starts with `price_`
- [ ] `subscription_status` is set ('trial' or 'active')
- [ ] `trial_ends_at` is set (7 days from creation)
- [ ] `next_bill_at` is set
- [ ] Price ID matches notifications setting:
  - If `notifications_enabled = true` → Should use WITH_NOTIFICATIONS price
  - If `notifications_enabled = false` → Should use WITHOUT_NOTIFICATIONS price

### Stripe Dashboard Verification ✅
- [ ] Connect account exists in Stripe Dashboard → Connect → Accounts
- [ ] Connect account status is Active or Onboarding complete
- [ ] Connect account ID matches database
- [ ] Customer exists in Stripe Dashboard → Customers
- [ ] Subscription exists in Stripe Dashboard → Customers → Subscriptions tab
- [ ] Subscription ID matches database
- [ ] Subscription status is trialing, active, or incomplete
- [ ] Trial end date is 7 days from creation
- [ ] Price ID matches database
- [ ] Subscription amount matches notifications setting:
  - With notifications: $21.99/month
  - Without notifications: $11.99/month
- [ ] Metadata contains `business_id` and `user_id`

### Server Logs Verification ✅
- [ ] No errors during Connect account creation
- [ ] No errors during subscription creation
- [ ] Logs show correct price selection based on notifications
- [ ] Logs confirm subscription was saved to database

---

## 🎯 Example Verification Queries

### For a specific business owner email:

```sql
-- Complete verification for a specific user
SELECT 
  u.email as owner_email,
  b.name as business_name,
  b.subdomain,
  -- Stripe IDs
  b.stripe_connect_account_id,
  b.stripe_customer_id,
  b.stripe_subscription_id,
  b.stripe_price_id,
  -- Status
  b.subscription_status,
  b.notifications_enabled,
  -- Dates
  b.trial_ends_at,
  b.next_bill_at,
  -- Verification flags
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as connect_account_ok,
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as subscription_ok,
  CASE 
    WHEN b.stripe_price_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as price_id_ok,
  CASE 
    WHEN b.trial_ends_at IS NOT NULL THEN '✅'
    ELSE '❌'
  END as trial_end_ok
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';  -- Replace with your email
```

### Compare all businesses:

```sql
-- Overview of all businesses with Stripe setup
SELECT 
  b.name,
  b.subdomain,
  au.email,
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as connect_setup,
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as subscription_setup,
  b.subscription_status,
  b.notifications_enabled,
  b.stripe_price_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;
```

---

## 📞 Next Steps

After verifying both Connect account and subscription:

1. **Test Customer Booking Flow:**
   - Create a booking as a customer
   - Verify SetupIntent is created
   - Complete SetupIntent to save payment method

2. **Test Money Actions:**
   - Log in as business owner
   - Navigate to Bookings
   - Test Complete/No-Show/Cancel actions
   - Verify charges go to Connect account

3. **Verify Webhooks:**
   - Check webhook events in Stripe Dashboard
   - Verify database updates from webhooks

4. **Check Subscription Lifecycle:**
   - Wait for trial to end (or simulate)
   - Verify subscription status updates
   - Check invoice creation

---

## 🔗 Related Documentation

- `STRIPE_INTEGRATION_COMPLETION_PROMPT.md` - Complete integration guide
- `GUIDE_BOOKING_AUTHENTICATION.md` - Booking flow guide
- `STRIPE_INTEGRATION_FIXES_SUMMARY.md` - Recent fixes summary

---

**Last Updated:** Based on Step 11 payment setup route implementation

