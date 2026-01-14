# Fix DAMBOX Subscription - Step by Step

## 🎯 Current Status

**DAMBOX Account:**
- ✅ Stripe Connect Account: `acct_1SamCw2KHPPJV1hT` (Linked!)
- ❌ Stripe Customer ID: Missing
- ❌ Stripe Subscription ID: Missing
- ❌ Stripe Price ID: Missing
- ⚠️ Subscription Status: "trial" (but no subscription exists)

---

## 🔧 Solution: Create Subscription

You need to create the Stripe customer and subscription. Here's how:

---

### Step 1: Check Environment Variables

Make sure your `.env` file (in `apps/web/` directory) has:

```bash
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx  # Since notifications_enabled = true
```

**Important:** Since `notifications_enabled = true`, you need `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` set.

---

### Step 2: Get Stripe Price ID (If Not Set)

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/products
   - Create a product/price for your subscription
   - Copy the Price ID (starts with `price_`)

2. **Add to `.env`:**
   ```bash
   STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx
   ```

3. **Restart your dev server** after updating `.env`

---

### Step 3: Create Subscription

**Option A: Via Frontend (Easiest)**

1. **Log into your app:**
   - URL: `http://localhost:3000/login`
   - Email: `johny@gmail.com`
   - Password: (your password)

2. **Navigate to onboarding Step 11:**
   - Go to: `http://localhost:3000/onboarding/payment-setup`
   - Or access via your onboarding flow

3. **Complete payment setup:**
   - System should detect existing Connect account
   - Will create Stripe customer
   - Will create subscription with correct price
   - Will save all IDs to database

4. **Verify it worked:**
   - Run the subscription check query again

---

### Step 3: Create Subscription (Alternative - API Call)

If you can't access the frontend, call the API directly:

```bash
# Get your session cookie from browser:
# 1. Open DevTools (F12)
# 2. Go to Application → Cookies
# 3. Find your session cookie
# 4. Copy the value

BASE_URL="http://localhost:3000"
SESSION_COOKIE="your-session-cookie-value-here"

curl -X POST "${BASE_URL}/api/business/onboarding/step-11-payment-setup" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}" \
  -d '{
    "email": "johny@gmail.com",
    "connectAccountId": "acct_1SamCw2KHPPJV1hT"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "connectAccountId": "acct_1SamCw2KHPPJV1hT",
  "subscriptionId": "sub_XXXXX",
  "message": "Payment setup completed successfully"
}
```

---

## ✅ Step 4: Verify Subscription Created

After creating subscription, run the check query again:

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
WHERE b.name = 'DAMBOX'
   OR au.email = 'johny@gmail.com'
ORDER BY b.created_at DESC
LIMIT 1;
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

### Issue: "Price ID not configured" Error

**Solution:**
1. Check `.env` file has `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` set
2. Verify price ID exists in Stripe Dashboard
3. Restart dev server after updating `.env`

### Issue: "Connect account not verified" Error

**Solution:**
1. Go to Stripe Dashboard → Connect → Accounts
2. Find account: `acct_1SamCw2KHPPJV1hT`
3. Verify account status is "Enabled" (not Restricted)
4. If Restricted, complete Stripe onboarding

### Issue: Can't Log In

**Solution:**
- Use email: `johny@gmail.com`
- Check if you have the correct password
- Or use API call method instead

---

## 📋 Quick Checklist

- [ ] Check `.env` has `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` set
- [ ] Restart dev server (if updated `.env`)
- [ ] Log in with `johny@gmail.com`
- [ ] Navigate to Step 11 payment setup
- [ ] Complete payment setup
- [ ] Run verification query to confirm subscription created

---

## 🎯 Next Steps After Subscription Created

Once subscription is created, you can proceed with:

1. ✅ Verify subscription creation with correct price (Item 1) ✅
2. ✅ Create customer booking (Item 2)
3. ✅ Complete SetupIntent (Item 3)
4. ✅ Test all money actions (Item 4)
5. ✅ Verify database updates (Item 5)
6. ✅ Verify Stripe Dashboard records (Item 6)

See `COMPLETE_VERIFICATION_GUIDE.md` for detailed steps!

---

**Start by checking your environment variables, then re-run Step 11!**


