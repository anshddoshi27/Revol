# Fix Missing Subscription

Your business is set up but the subscription is missing. Here's how to create it.

---

## 🔍 Current Status

✅ **Working:**
- Business: Studio Nova 9n9e
- Subdomain: test-rqkt-1764877009772
- Stripe Connect Account: acct_1SZeE0RpBhfmTDiM (linked)

❌ **Missing:**
- Stripe Customer ID
- Stripe Subscription ID
- Stripe Price ID
- Subscription status is "active" but no subscription exists (inconsistent)

---

## 🔧 Solution: Create Subscription

You need to re-run Step 11 of onboarding to create the subscription. Here are your options:

---

### Option 1: Re-run Step 11 via Frontend (Easiest)

1. **Log into your app:**
   - Go to: `http://localhost:3000/login`
   - Email: `demo@tithi.com`
   - Log in

2. **Navigate to onboarding Step 11:**
   - Go to: `http://localhost:3000/onboarding/payment-setup`
   - Or access via your onboarding flow

3. **Complete the payment setup:**
   - The system should detect your existing Connect account
   - It will create the Stripe customer
   - It will create the subscription with correct price
   - It will save all IDs to database

4. **Verify it worked:**
   - Run Query 1 again to check subscription was created

---

### Option 2: Call Step 11 API Directly

If you can't access the frontend, call the API directly:

```bash
# Get your session cookie from browser:
# 1. Open DevTools (F12)
# 2. Go to Application → Cookies
# 3. Find your session cookie (look for supabase-auth-token or similar)
# 4. Copy the value

BASE_URL="http://localhost:3000"
SESSION_COOKIE="your-session-cookie-value-here"

curl -X POST "${BASE_URL}/api/business/onboarding/step-11-payment-setup" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}" \
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

### Option 3: Check Environment Variables First

Before running Step 11, make sure your environment variables are set:

1. **Check your `.env` file** (in `apps/web/` directory):

```bash
# Required for subscription creation
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx  # For notifications_enabled = true
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_xxxxx  # For notifications_enabled = false
```

2. **Since `notifications_enabled = true`, you need:**
   - `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` set to a valid Stripe price ID

3. **Get Price ID from Stripe Dashboard:**
   - Go to: https://dashboard.stripe.com/products
   - Create or find your product/price
   - Copy the Price ID (starts with `price_`)
   - Add to `.env` file

4. **Restart your dev server** after updating `.env`

---

## ✅ After Creating Subscription: Verify

Run Query 1 again:

```sql
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
```

**Expected Results After Fix:**
- ✅ `stripe_customer_id` is NOT NULL (starts with `cus_`)
- ✅ `stripe_subscription_id` is NOT NULL (starts with `sub_`)
- ✅ `stripe_price_id` is NOT NULL (starts with `price_`)
- ✅ `subscription_status` is `'trial'` or `'active'`
- ✅ `trial_ends_at` is set (7 days from creation)
- ✅ `next_bill_at` is set

---

## 🐛 Troubleshooting

### Issue: Step 11 Returns Error "Price ID not configured"

**Solution:**
1. Check `.env` file has `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` set
2. Verify the price ID is valid in Stripe Dashboard
3. Restart dev server after updating `.env`

### Issue: Step 11 Returns Error "Connect account not verified"

**Solution:**
1. Check Stripe Dashboard → Connect → Accounts
2. Find account `acct_1SZeE0RpBhfmTDiM`
3. Verify account status is "Enabled" (not Restricted)
4. If Restricted, complete Stripe onboarding

### Issue: Subscription Status Shows "active" But No Subscription ID

**Solution:**
- This is the current inconsistent state
- Re-running Step 11 should fix it
- The subscription creation will set the correct status

---

## 📝 Quick Action Plan

1. **Check environment variables** - Make sure price IDs are set
2. **Re-run Step 11** - Via frontend or API
3. **Verify subscription created** - Run Query 1 again
4. **Check Stripe Dashboard** - Verify subscription exists

---

## 🎯 Next Steps After Subscription is Created

Once subscription is created, you can:
1. ✅ Verify subscription creation with correct price (Item 1)
2. ✅ Create customer booking (Item 2)
3. ✅ Complete SetupIntent (Item 3)
4. ✅ Test money actions (Item 4)
5. ✅ Verify database updates (Item 5)
6. ✅ Verify Stripe Dashboard records (Item 6)

See `COMPLETE_VERIFICATION_GUIDE.md` for the rest!

---

**Start by checking your environment variables, then re-run Step 11!**

