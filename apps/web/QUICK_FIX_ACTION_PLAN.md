# Quick Action Plan: Enable Your Stripe Connect Account

## 🎯 Current Situation

You have **3 connected accounts** in Stripe:
- `demo@tithi.com` - **Restricted** (Dec 1, 2025)
- `Test account` - **Restricted** (Nov 27, 2025)  
- `Test account` - **Enabled** (Oct 24, 2025)

**Problem:** Restricted accounts **cannot receive payments**. You need to enable them.

---

## ✅ Step-by-Step Fix (Do This Now)

### Step 1: Identify Which Account is Yours

**Run this query to find your account ID:**

```sql
SELECT 
  b.name,
  au.email,
  b.stripe_connect_account_id,
  CASE 
    WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅ Found in database'
    ELSE '❌ Not in database'
  END as status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';  -- Replace with your email (e.g., demo@tithi.com)
```

**Match the account ID** from this query with the accounts in Stripe Dashboard.

---

### Step 2: Enable Your Restricted Account

**For the `demo@tithi.com` account (Restricted):**

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/connect/accounts/overview
   - Click on the **`demo@tithi.com`** account

2. **Check Account Status:**
   - You should see a banner like "Account requires attention" or "Complete onboarding"
   - Click on it or go to the **"Requirements"** tab

3. **Complete Missing Requirements:**
   - Business information (name, address, etc.)
   - Bank account details
   - Identity verification
   - Tax information (if required)

4. **After Completing:**
   - Account status should change from **"Restricted"** to **"Enabled"**
   - You'll see a green checkmark

---

### Step 3: Link Account ID to Database (If Missing)

**If your account ID isn't in the database:**

1. **Copy Account ID from Stripe:**
   - In Stripe Dashboard, click on your account
   - Copy the Account ID from the URL or account details (looks like `acct_1234567890`)

2. **Update Database:**

```sql
-- Replace acct_XXXXX with your actual account ID from Stripe
-- Replace YOUR_EMAIL_HERE with your email
UPDATE businesses 
SET 
  stripe_connect_account_id = 'acct_XXXXX',
  updated_at = now()
WHERE id = (
  SELECT b.id 
  FROM businesses b
  JOIN auth.users au ON au.id = b.user_id
  WHERE au.email = 'YOUR_EMAIL_HERE'
);

-- Verify it worked
SELECT 
  b.name,
  b.stripe_connect_account_id,
  au.email
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';
```

---

### Step 4: Verify Account is Enabled

**Check in Stripe Dashboard:**
- Account status should be **"Enabled"** (green badge)
- Charges enabled: **Yes**
- Payouts enabled: **Yes** (or enabled after first payment)

**Check in Database:**
```sql
SELECT 
  b.name,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.subscription_status
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_EMAIL_HERE';
```

---

### Step 5: Create Subscription (If Missing)

**Check if subscription exists:**

```sql
SELECT 
  stripe_subscription_id,
  stripe_price_id,
  subscription_status
FROM businesses
WHERE stripe_connect_account_id = 'acct_XXXXX';  -- Your account ID
```

**If subscription is missing:**

1. **Re-run Step 11 of onboarding:**
   - Log into your app
   - Navigate to onboarding Step 11 (payment setup)
   - Or call the API endpoint again

2. **Or manually verify in Stripe:**
   - Go to Stripe Dashboard → Customers
   - Find your customer (by email)
   - Check if subscription exists in Subscriptions tab

---

## 🚨 Important Notes

### About "Restricted" Status

**Restricted accounts cannot:**
- ❌ Receive payments from customers
- ❌ Process charges
- ❌ Transfer funds

**Why accounts are restricted:**
- Stripe onboarding incomplete
- Missing required business information
- Bank account not added
- Identity verification pending

**How to fix:**
- Complete the onboarding requirements in Stripe Dashboard
- Fill in all required fields
- Submit verification documents if needed

### About Multiple Accounts

You have 3 accounts. You likely only need **one**:

- **`demo@tithi.com`** - This might be your main account (check if email matches)
- **`Test account` (Restricted)** - Old test account (can delete if not needed)
- **`Test account` (Enabled)** - Another test account (can delete if not needed)

**Recommendation:**
- Keep the account linked to your actual business
- Delete unused test accounts in Stripe Dashboard (if in test mode)

---

## ✅ Success Checklist

After completing the steps above, verify:

- [ ] Account status is **"Enabled"** in Stripe Dashboard
- [ ] Account ID is saved in your database (`stripe_connect_account_id`)
- [ ] Subscription exists (check in Stripe and database)
- [ ] Charges enabled = **Yes** in Stripe
- [ ] You can test creating a booking and charging it

---

## 📞 Need Help?

**If account stays restricted:**
- Check the Requirements tab in Stripe Dashboard
- Look for any error messages or missing information
- Contact Stripe support if verification fails

**If account ID not linking:**
- Verify the account ID is correct (starts with `acct_`)
- Check database update query ran successfully
- Re-run Step 11 to create/link account

**If subscription not creating:**
- Check server logs for errors
- Verify price IDs are set in environment variables
- Check if customer was created in Stripe

---

## 🎯 Next Steps After Account is Enabled

1. ✅ Test creating a booking
2. ✅ Complete SetupIntent (save payment method)
3. ✅ Test charging the booking (Complete/No-Show/Cancel)
4. ✅ Verify funds transfer to your connected account
5. ✅ Check database updates correctly

---

**Start with Step 1 - identify which account is yours, then enable it!**


