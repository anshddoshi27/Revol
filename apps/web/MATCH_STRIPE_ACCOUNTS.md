# Match Stripe Accounts with Database

You got "No rows returned" - let's find your business and match it with Stripe accounts.

---

## 🔍 Step 1: Find What Businesses Exist

Run this query to see ALL businesses in your database:

```sql
-- Find ALL businesses
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.created_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;
```

**What to look for:**
- What email addresses do you see?
- Do any businesses exist?
- Do any have `stripe_connect_account_id` set?

---

## 🔍 Step 2: Find What Users Exist

Run this to see all user emails:

```sql
-- Find ALL users/emails
SELECT 
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC;
```

**Match the emails** you see here with:
- The email you used to sign up
- The email in Stripe Dashboard (`demo@tithi.com`)

---

## 🔍 Step 3: Match Stripe Accounts with Database

In Stripe Dashboard, you saw:
- `demo@tithi.com` - Restricted
- `Test account` (2 of them)

### Option A: Check if Account ID is in Database

Run this to see which businesses have Stripe Connect accounts:

```sql
-- Find businesses WITH Stripe Connect accounts
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE b.stripe_connect_account_id IS NOT NULL;
```

**Then in Stripe Dashboard:**
1. Click on `demo@tithi.com` account
2. Copy the Account ID (from URL or details page - looks like `acct_1234567890`)
3. Compare with `stripe_connect_account_id` from the query above
4. If they match → That's your business!

### Option B: Match by Email

The Stripe account shows `demo@tithi.com`. Check if that email exists:

```sql
-- Check if demo@tithi.com exists
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';
```

**If this returns a row:**
- That's your business!
- Check if `stripe_connect_account_id` is set
- If NULL, you need to link it (see below)

**If this returns no rows:**
- The Stripe account exists but business isn't linked
- The email in Stripe might be different from your database
- Check what email you actually used to sign up

---

## 🔧 Step 4: Link Stripe Account to Database

If you found a business in the database but `stripe_connect_account_id` is NULL:

### Get Account ID from Stripe

1. Go to Stripe Dashboard → Connect → Accounts
2. Click on `demo@tithi.com` (or your account)
3. Copy the Account ID:
   - It's in the URL: `https://dashboard.stripe.com/connect/accounts/acct_XXXXX`
   - Or in the account details page

### Update Database

```sql
-- Update your business with the Stripe account ID
-- Replace acct_XXXXX with actual account ID from Stripe
-- Replace 'demo@tithi.com' with your actual email (or use business ID)

-- Option 1: Update by email
UPDATE businesses 
SET 
  stripe_connect_account_id = 'acct_XXXXX',  -- Replace with account ID from Stripe
  updated_at = now()
WHERE id = (
  SELECT b.id 
  FROM businesses b
  JOIN auth.users au ON au.id = b.user_id
  WHERE au.email = 'demo@tithi.com'  -- Replace with your email
);

-- Option 2: Update by business ID (if you know it)
UPDATE businesses 
SET 
  stripe_connect_account_id = 'acct_XXXXX',  -- Replace with account ID from Stripe
  updated_at = now()
WHERE id = 'YOUR_BUSINESS_ID_HERE';  -- Replace with actual business UUID
```

---

## 🎯 Quick Diagnostic Process

Run these queries in order:

### Query 1: See all businesses
```sql
SELECT 
  b.id,
  b.name,
  b.subdomain,
  au.email,
  b.stripe_connect_account_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
ORDER BY b.created_at DESC;
```

**If this returns no rows:**
- ❌ No businesses exist - onboarding wasn't completed
- **Solution:** Complete onboarding first

**If this returns rows:**
- ✅ Businesses exist - continue to Query 2

### Query 2: Check which emails match Stripe
```sql
SELECT 
  au.email,
  b.name,
  b.stripe_connect_account_id
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email LIKE '%tithi%' OR au.email LIKE '%demo%';
```

**Match emails** from this query with `demo@tithi.com` from Stripe

### Query 3: Find account ID in Stripe and link
1. In Stripe Dashboard, click `demo@tithi.com`
2. Copy Account ID from URL or page
3. Run update query (see Step 4 above)

---

## 🐛 Common Scenarios

### Scenario 1: Business Exists But No Stripe Account Linked

**Symptoms:**
- Query shows business exists
- But `stripe_connect_account_id` is NULL

**Solution:**
- Get Account ID from Stripe Dashboard
- Update database (see Step 4)

### Scenario 2: Stripe Account Exists But No Business in Database

**Symptoms:**
- See account in Stripe Dashboard
- But business query returns no rows

**Solution:**
- This shouldn't happen - Stripe account should be created during onboarding
- Check if you completed all 11 steps of onboarding
- If not, complete onboarding Step 11

### Scenario 3: Wrong Email Used

**Symptoms:**
- Query with one email returns nothing
- But business exists with different email

**Solution:**
- Run Query 1 to see all businesses and emails
- Match with the email in Stripe Dashboard
- Use the correct email in queries

### Scenario 4: No Businesses at All

**Symptoms:**
- Query 1 returns no rows

**Solution:**
- Onboarding wasn't completed
- Need to complete all 11 steps of onboarding
- Step 11 creates the Stripe Connect account

---

## ✅ Next Steps

1. **Run Query 1** (see all businesses) - Share the results
2. **Match emails** with Stripe Dashboard
3. **Get Account ID** from Stripe Dashboard
4. **Link account** to database if needed
5. **Enable account** in Stripe if restricted

---

**Start by running Query 1 and share what you see!**


