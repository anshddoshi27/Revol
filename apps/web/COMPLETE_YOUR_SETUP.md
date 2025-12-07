# Complete Your Stripe Setup - Action Plan

## ✅ Current Status

Your business is found and connected:
- **Business:** Urban Clinic k24l
- **Email:** demo@tithi.com
- **Stripe Account ID:** `acct_1SZeE0RpBhfmTDiM` ✅ (Linked!)
- **Subscription:** ❌ Missing (needs to be created)

---

## 🎯 Step 1: Verify Account in Stripe Dashboard

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/connect/accounts/overview

2. **Find your account:**
   - Look for `demo@tithi.com`
   - Click on it
   - Check the Account ID in the URL or details page
   - It should be: `acct_1SZeE0RpBhfmTDiM`

3. **Check Account Status:**
   - Is it **"Restricted"** or **"Enabled"**?
   - If Restricted → Complete Step 2 below
   - If Enabled → Skip to Step 3

---

## 🔧 Step 2: Enable Restricted Account (If Needed)

If your account shows **"Restricted"** status:

1. **In Stripe Dashboard:**
   - Click on your account (`demo@tithi.com`)
   - You'll see a banner or notification about requirements

2. **Complete Onboarding:**
   - Click "Complete onboarding" or "Finish setup"
   - Fill in required information:
     - Business details
     - Bank account information
     - Identity verification (if required)
   - Submit and wait for verification

3. **Verify Status Changed:**
   - Account status should change to **"Enabled"**
   - Charges enabled should show **"Yes"**

---

## 🔧 Step 3: Create Missing Subscription

Your subscription is missing. Let's create it:

### Option A: Re-run Step 11 (Recommended)

1. **Log into your app:**
   - Navigate to onboarding Step 11 (Payment Setup)
   - Or access: `http://localhost:3000/onboarding/payment-setup`

2. **Complete the flow:**
   - The system should detect the existing Connect account
   - It should create the subscription automatically

### Option B: Call Step 11 API Directly

If you can't access the UI, call the API:

```bash
# Get your session cookie from browser (DevTools → Application → Cookies)
# Then call:

curl -X POST http://localhost:3000/api/business/onboarding/step-11-payment-setup \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d '{
    "email": "demo@tithi.com",
    "connectAccountId": "acct_1SZeE0RpBhfmTDiM"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "connectAccountId": "acct_1SZeE0RpBhfmTDiM",
  "subscriptionId": "sub_XXXXX",
  "message": "Payment setup completed successfully"
}
```

---

## ✅ Step 4: Verify Subscription Created

After creating subscription, verify it:

### Check Database:

```sql
-- Check if subscription was created
SELECT 
  b.id,
  b.name,
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
```

**Expected:**
- ✅ `stripe_subscription_id` should be NOT NULL (starts with `sub_`)
- ✅ `stripe_customer_id` should be set (starts with `cus_`)
- ✅ `stripe_price_id` should be set (starts with `price_`)
- ✅ `subscription_status` should be `'trial'` or `'active'`
- ✅ `trial_ends_at` should be set (7 days from creation)

### Check Stripe Dashboard:

1. **Go to Customers:**
   - https://dashboard.stripe.com/customers
   - Search for `demo@tithi.com`

2. **Check Subscriptions:**
   - Click on the customer
   - Go to "Subscriptions" tab
   - You should see a subscription

3. **Verify Subscription Details:**
   - Status: `trialing` or `active`
   - Price: Should match your notifications setting:
     - With notifications: $21.99/month
     - Without notifications: $11.99/month
   - Trial end: 7 days from creation
   - Metadata: Should contain `business_id` and `user_id`

---

## 🔍 Step 5: Verify Complete Setup

Run this comprehensive check:

```sql
-- Complete verification
SELECT 
  b.name as business_name,
  b.subdomain,
  au.email,
  -- Stripe IDs
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_connect_account,
  CASE 
    WHEN b.stripe_customer_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_customer,
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_subscription,
  CASE 
    WHEN b.stripe_price_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_price_id,
  -- Status
  b.subscription_status,
  b.notifications_enabled,
  -- Dates
  CASE 
    WHEN b.trial_ends_at IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_trial_end,
  CASE 
    WHEN b.next_bill_at IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_next_bill
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';
```

**All should show ✅ for complete setup!**

---

## 📋 Quick Action Checklist

- [ ] Verify account `acct_1SZeE0RpBhfmTDiM` exists in Stripe Dashboard
- [ ] Check if account is Restricted or Enabled
- [ ] If Restricted: Complete onboarding requirements in Stripe
- [ ] Create subscription (re-run Step 11 or call API)
- [ ] Verify subscription created in database
- [ ] Verify subscription exists in Stripe Dashboard
- [ ] Check subscription price matches notifications setting
- [ ] Verify trial period is 7 days

---

## 🐛 Troubleshooting

### Issue: Step 11 Doesn't Create Subscription

**Check:**
1. Server logs for errors
2. Environment variables (price IDs set?)
3. Connect account is enabled?
4. Customer created?

**Solution:**
- Check server console for error messages
- Verify `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` and `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS` are set in `.env`
- Ensure Connect account status is "Enabled"

### Issue: Subscription Created But Wrong Price

**Check:**
```sql
SELECT notifications_enabled, stripe_price_id
FROM businesses
WHERE email = 'demo@tithi.com';
```

**Verify:**
- If `notifications_enabled = true` → Should use WITH_NOTIFICATIONS price
- If `notifications_enabled = false` → Should use WITHOUT_NOTIFICATIONS price

---

## 🎯 Summary

You're almost there! You have:
- ✅ Business created
- ✅ Stripe Connect account linked (`acct_1SZeE0RpBhfmTDiM`)
- ❌ Subscription missing (need to create)

**Next Steps:**
1. Enable account in Stripe if restricted
2. Re-run Step 11 to create subscription
3. Verify everything is set up correctly

---

**Start with Step 1: Check your account status in Stripe Dashboard!**


