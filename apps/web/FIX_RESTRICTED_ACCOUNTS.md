# Fix Restricted Stripe Connect Accounts

You can see 3 connected accounts in Stripe Dashboard, but some are **"Restricted"** status. Here's how to fix this.

---

## 🔍 Step 1: Identify Your Account

From the Stripe Dashboard, I can see:
- **Account 1:** `demo@tithi.com` - Status: **Restricted** (Connected Dec 1, 2025)
- **Account 2:** `Test account` - Status: **Restricted** (Connected Nov 27, 2025)
- **Account 3:** `Test account` - Status: **Enabled** (Connected Oct 24, 2025)

### Find Your Account in Database

Run this query to see which account ID is saved to your business:

```sql
-- Check which Stripe Connect account is linked to your business
SELECT 
  b.id as business_id,
  b.name as business_name,
  b.subdomain,
  au.email as owner_email,
  b.stripe_connect_account_id,
  b.stripe_customer_id,
  b.stripe_subscription_id,
  b.subscription_status,
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅ Account ID saved'
    ELSE '❌ Account ID missing'
  END as account_saved_status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';  -- Replace with your email
```

**Match the account ID** from your database with the accounts in Stripe Dashboard:
- Click on each account in Stripe to see the Account ID (starts with `acct_`)
- Compare with `stripe_connect_account_id` from your database

---

## ⚠️ What Does "Restricted" Status Mean?

**Restricted** accounts cannot:
- ❌ Receive payments
- ❌ Transfer funds
- ❌ Complete charges

**Restricted** status happens when:
1. Stripe onboarding is incomplete
2. Required verification information is missing
3. Business details need to be updated
4. Bank account not added
5. Identity verification pending

---

## 🔧 Step 2: Enable Restricted Accounts

### Option A: Complete Stripe Onboarding (Recommended)

1. **In Stripe Dashboard:**
   - Go to **Connect → Accounts**
   - Click on your restricted account (e.g., `demo@tithi.com`)
   - You should see a banner saying "Account requires attention" or "Complete onboarding"

2. **Complete Required Information:**
   - Click the button to complete onboarding or fix requirements
   - Fill in:
     - Business information
     - Bank account details
     - Identity verification (if required)
     - Business verification documents (if required)

3. **After Completing:**
   - Account status should change to **"Enabled"** or **"Enabled (Limited)**
   - You'll be able to receive payments

### Option B: Generate New Account Link

If you need to re-do the onboarding flow from your app:

1. **Get Account Link via API:**
   ```bash
   # Call Step 11 endpoint to get Account Link URL
   curl -X POST http://localhost:3000/api/business/onboarding/step-11-payment-setup \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "email": "your-email@example.com",
       "connectAccountId": "acct_XXXXX"  # Your account ID from Stripe
     }'
   ```

2. **Visit the Account Link URL:**
   - This will take you to Stripe's onboarding flow
   - Complete all required fields
   - Return to your app

### Option C: Check Account Requirements in Stripe

1. **In Stripe Dashboard:**
   - Click on your restricted account
   - Go to the **"Requirements"** tab or section
   - Look for a list of required information:
     - ❌ Business details
     - ❌ Bank account
     - ❌ Identity verification
     - ❌ Tax information

2. **Complete Each Requirement:**
   - Click on each incomplete requirement
   - Fill in the information
   - Submit for review (if needed)

---

## 🔍 Step 3: Check Account Details in Stripe

For each restricted account:

1. **Click on the account** in Stripe Dashboard
2. **Check the Overview tab:**
   - Account status
   - Charges enabled: Should be **Yes**
   - Payouts enabled: Should be **Yes**
   - Capabilities: Should show what's available

3. **Check the Requirements tab:**
   - See what's missing
   - Complete any incomplete requirements

4. **Check the Settings tab:**
   - Verify business information is correct
   - Check bank account is added

---

## 🔧 Step 4: Link Account ID to Database (If Missing)

If your account exists in Stripe but `stripe_connect_account_id` is NULL in your database:

### Step 4a: Find Account ID in Stripe

1. Go to Stripe Dashboard → Connect → Accounts
2. Click on your account (e.g., `demo@tithi.com`)
3. Copy the Account ID from the URL or account details (starts with `acct_`)

### Step 4b: Update Database

```sql
-- Update business with the Stripe Connect account ID
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

-- Verify update
SELECT 
  b.name,
  b.stripe_connect_account_id,
  au.email
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';
```

---

## 🔧 Step 5: Complete Subscription Setup

After the account is enabled:

1. **Verify Subscription Exists:**
   ```sql
   SELECT 
     stripe_subscription_id,
     stripe_price_id,
     subscription_status,
     notifications_enabled
   FROM businesses
   WHERE stripe_connect_account_id = 'acct_XXXXX';  -- Your account ID
   ```

2. **If Subscription is Missing:**
   - Re-run Step 11 of onboarding
   - Or call the API endpoint again
   - Subscription should be created automatically

3. **Check Subscription in Stripe:**
   - Go to Stripe Dashboard → Customers
   - Find your customer (by email)
   - Check Subscriptions tab
   - Verify subscription exists and is active/trialing

---

## ✅ Verification Checklist

After fixing restricted accounts:

### Database Check:
```sql
SELECT 
  b.name,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.subscription_status,
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_account,
  CASE 
    WHEN b.stripe_subscription_id IS NOT NULL THEN '✅'
    ELSE '❌'
  END as has_subscription
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';
```

### Stripe Dashboard Check:
- [ ] Account status is **"Enabled"** (not Restricted)
- [ ] Charges enabled = **Yes**
- [ ] Payouts enabled = **Yes** (or will be after first payment)
- [ ] Account ID matches database
- [ ] Subscription exists (if created)
- [ ] Customer exists

---

## 🐛 Common Issues with Restricted Accounts

### Issue 1: Account Shows Restricted After Onboarding

**Solution:**
- Check Requirements tab in Stripe Dashboard
- Complete any missing information
- Some restrictions are temporary and will clear after verification

### Issue 2: Can't Find Requirements to Complete

**Solution:**
- In Stripe Dashboard, click on the restricted account
- Look for a banner at the top with a link to complete requirements
- Or go to Settings → Requirements section

### Issue 3: Account ID Not Saved in Database

**Solution:**
- Find the account ID in Stripe Dashboard
- Update database manually (see Step 4 above)
- Or re-run Step 11 to create/link the account

### Issue 4: Multiple Accounts Created

**Solution:**
- You have 3 accounts in Stripe
- Only one should be linked to your business in the database
- Identify which one is correct (match by email or creation date)
- Update database to link the correct account
- You can delete unused accounts in Stripe (if test mode)

---

## 🎯 Next Steps

1. **Identify Your Account:**
   - Match your email with the accounts in Stripe
   - Check which account ID is in your database

2. **Enable Restricted Account:**
   - Complete Stripe onboarding requirements
   - Or generate new Account Link and complete flow

3. **Verify Database Link:**
   - Ensure account ID is saved to your business record
   - Update manually if needed

4. **Complete Subscription:**
   - Verify subscription exists
   - Create if missing

5. **Test Payment Flow:**
   - Once account is enabled, test creating a booking
   - Test charging the booking
   - Verify funds transfer correctly

---

## 📞 Quick Reference

**Stripe Dashboard URL:**
- Connect Accounts: https://dashboard.stripe.com/connect/accounts/overview
- Your Account: https://dashboard.stripe.com/connect/accounts/acct_XXXXX (replace with your ID)

**Common Account Statuses:**
- **Enabled:** ✅ Can receive payments
- **Restricted:** ❌ Cannot receive payments (complete requirements)
- **In Review:** ⏳ Under verification
- **Rejected:** ❌ Verification failed (contact Stripe support)

---

**After your account is Enabled, you can proceed with testing the booking and payment flow!**


