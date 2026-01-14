# Debug: Stripe Connect Account Not Created

This guide helps you debug why the Stripe Connect account wasn't created after completing onboarding.

---

## 🔍 Step 1: Check Current Database State

First, let's see what's actually in your database. Use these **corrected queries** (for Supabase):

### Query 1: Check Your Business Record

```sql
-- Find your business by email (using Supabase auth.users)
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
  au.email as owner_email,
  -- Status indicators
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅ Has Connect Account'
    ELSE '❌ Missing Connect Account'
  END as connect_status,
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅ Has Subscription'
    ELSE '❌ Missing Subscription'
  END as subscription_status_check
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';  -- Replace with your actual email
```

**Replace `YOUR_EMAIL_HERE` with the email you used to sign up.**

### Query 2: List All Businesses (if you're not sure which email)

```sql
-- See all businesses and their Stripe setup status
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
```

---

## 🔍 Step 2: Check What Happened During Step 11

The Connect account should be created when Step 11 is called. Let's check:

### Check Server Logs

Look at your server console logs when you completed Step 11. You should see logs like:

```
[step-11-payment-setup] API called
[step-11-payment-setup] User authenticated: [user-id]
[step-11-payment-setup] Business ID: [business-id]
```

If you see errors about:
- `Stripe API key not found` → Environment variable issue
- `Failed to create Connect account` → Stripe API issue
- `Business not found` → Onboarding incomplete

### Check Environment Variables

Make sure these are set in your `.env` file (in `apps/web/`):

```bash
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_...
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_...
```

---

## 🔧 Step 3: Manual Fix - Re-run Step 11

If the Connect account wasn't created, you can manually trigger it:

### Option A: Re-run via Frontend

1. Log in to your account
2. Navigate back to onboarding Step 11 (payment setup)
3. If there's a button to "Connect Stripe" or "Set Up Payment", click it
4. Complete the Stripe onboarding flow

### Option B: Call the API Directly

If you have access to make API calls:

```bash
# Get your auth token first (from browser DevTools → Application → Cookies)
# Or use the session token

curl -X POST http://localhost:3000/api/business/onboarding/step-11-payment-setup \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -d '{
    "email": "your-email@example.com"
  }'
```

### Option C: Check API Response

When Step 11 is called, you should get one of these responses:

**First call (creates account and returns Account Link):**
```json
{
  "success": true,
  "accountLinkUrl": "https://connect.stripe.com/setup/s/xxxxx",
  "connectAccountId": "acct_1234567890",
  "message": "Please complete Stripe Connect onboarding"
}
```

**After completing Stripe onboarding:**
```json
{
  "success": true,
  "connectAccountId": "acct_1234567890",
  "subscriptionId": "sub_1234567890",
  "message": "Payment setup completed successfully"
}
```

---

## 🔍 Step 4: Verify Stripe Dashboard

1. Go to https://dashboard.stripe.com
2. Log in to your Stripe account
3. Go to **Connect → Accounts**
4. Check if any accounts exist

**If you see accounts:**
- Note the account ID (starts with `acct_`)
- Check if it matches your database
- The account might be created but not saved to database

**If you don't see any accounts:**
- The account creation likely failed
- Check server logs for errors
- Verify Stripe API key is correct

---

## 🔧 Step 5: Manual Database Fix (If Account Exists in Stripe)

If the account was created in Stripe but not saved to your database:

### Step 5a: Find Your Stripe Account ID

1. Go to Stripe Dashboard → Connect → Accounts
2. Find the account (search by email or check recent)
3. Copy the Account ID (starts with `acct_`)

### Step 5b: Update Database

```sql
-- Update your business record with the Connect account ID
UPDATE businesses 
SET 
  stripe_connect_account_id = 'acct_XXXXX',  -- Replace with actual account ID from Stripe
  updated_at = now()
WHERE id = (
  SELECT b.id 
  FROM businesses b
  JOIN auth.users au ON au.id = b.user_id
  WHERE au.email = 'YOUR_EMAIL_HERE'  -- Replace with your email
);
```

### Step 5c: Verify Update

```sql
-- Verify the update worked
SELECT 
  b.name,
  b.stripe_connect_account_id,
  au.email
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';
```

---

## 🔧 Step 6: Complete the Stripe Onboarding Flow

Even if the account ID is saved, you need to complete the Stripe onboarding:

1. **Get the Account Link:**
   - The Account Link URL is generated when Step 11 is first called
   - It should be in the API response: `accountLinkUrl`

2. **Complete Stripe Onboarding:**
   - Visit the Account Link URL
   - Fill out Stripe's onboarding form (business details, bank info, etc.)
   - Complete the flow

3. **Return to Your App:**
   - After completing Stripe onboarding, you'll be redirected back
   - The app should verify the account and create the subscription

4. **Re-call Step 11:**
   - After returning from Stripe, call Step 11 again
   - This time it should verify the account and create the subscription

---

## 🔧 Step 7: Create Missing Subscription (If Needed)

If the Connect account exists but subscription is missing:

### Check if Customer Exists

```sql
-- Check if Stripe customer was created
SELECT 
  stripe_customer_id,
  stripe_connect_account_id
FROM businesses
WHERE id = (
  SELECT b.id 
  FROM businesses b
  JOIN auth.users au ON au.id = b.user_id
  WHERE au.email = 'YOUR_EMAIL_HERE'
);
```

### Manually Trigger Subscription Creation

Call Step 11 again - it should:
1. Verify the Connect account exists
2. Create/get the Stripe customer
3. Create the subscription with correct price

Or check the server logs to see what happened during subscription creation.

---

## 🐛 Common Issues & Solutions

### Issue 1: "Relation auth.users does not exist"

**Solution:** You're querying the wrong database or don't have access. In Supabase:
- Use the SQL Editor in the Supabase Dashboard
- Or ensure you're connected to the correct database

### Issue 2: Connect Account Created But Not Saved

**Symptoms:** Account exists in Stripe Dashboard but `stripe_connect_account_id` is NULL in database

**Solution:**
1. Find the account ID in Stripe Dashboard
2. Update the database manually (see Step 5 above)
3. Re-run Step 11 to complete the flow

### Issue 3: Step 11 Never Called

**Symptoms:** No logs, no API calls, nothing in database

**Solution:**
1. Check if onboarding actually completed Step 11
2. Check browser network tab for API calls
3. Try accessing Step 11 directly in the UI
4. Check if there were any errors during onboarding

### Issue 4: Environment Variables Not Set

**Symptoms:** Errors about missing Stripe keys

**Solution:**
1. Check `.env` file in `apps/web/` directory
2. Verify `STRIPE_SECRET_KEY` is set
3. Restart your dev server after adding env vars
4. For production, set them in your hosting platform

### Issue 5: Stripe Onboarding Not Completed

**Symptoms:** Account ID exists but account is not active in Stripe

**Solution:**
1. Go to Stripe Dashboard → Connect → Accounts
2. Click on your account
3. Check status - if it says "Onboarding incomplete", complete it
4. Or get a new Account Link URL and complete onboarding

---

## ✅ Verification Checklist

After fixing, verify everything:

### Database Check:
```sql
SELECT 
  b.name,
  au.email,
  CASE WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅' ELSE '❌' END as has_connect,
  CASE WHEN b.stripe_subscription_id IS NOT NULL THEN '✅' ELSE '❌' END as has_subscription,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.subscription_status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';
```

All should show ✅.

### Stripe Dashboard Check:
- [ ] Account exists in Connect → Accounts
- [ ] Account status is "Active" or "Onboarding complete"
- [ ] Customer exists in Customers
- [ ] Subscription exists (if created)

---

## 📞 Next Steps

Once the Connect account is set up:

1. **Complete Subscription Setup:**
   - Verify subscription is created
   - Check price matches notifications setting

2. **Test Booking Flow:**
   - Create a test booking
   - Complete SetupIntent
   - Test money actions (Complete/No-Show/Cancel)

3. **Verify Webhooks:**
   - Check Stripe Dashboard → Developers → Webhooks
   - Ensure webhook endpoint is configured
   - Test webhook events

---

## 🔗 Related Files

- `apps/web/src/app/api/business/onboarding/step-11-payment-setup/route.ts` - Step 11 implementation
- `apps/web/src/lib/stripe.ts` - Stripe helper functions
- `VERIFY_STRIPE_SETUP.md` - Verification guide (with corrected queries)

---

**Need more help?** Check the server logs for detailed error messages during Step 11 execution.



