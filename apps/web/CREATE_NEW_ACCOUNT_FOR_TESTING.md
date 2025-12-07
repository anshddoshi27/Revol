# Create New Account for Testing

Let's create a fresh account and verify the subscription creation process from scratch.

---

## 🎯 Step-by-Step: Create New Account

### Step 1: Sign Up

1. **Go to signup page:**
   - `http://localhost:3000/signup`
   - Or `http://localhost:3000/auth/signup`

2. **Fill out the form:**
   - Email: Use a NEW email (e.g., `test-dambox-new@example.com`)
   - Password: Create a strong password (save it somewhere!)
   - Name: Your name
   - Submit

3. **Verify signup:**
   - You should be redirected to onboarding
   - Or check your email for verification link

---

### Step 2: Complete Onboarding (All 11 Steps)

Go through all onboarding steps:

#### Step 1: Business Basics
- Business Name: `Test Business New`
- Description: `Testing subscription creation`
- Fill out required fields
- Save and continue

#### Step 2: Booking Website
- Subdomain: `test-business-new` (or any available)
- Save and continue

#### Step 3: Location & Contacts
- Fill out timezone, phone, email, address
- Save and continue

#### Step 4: Team
- Add at least one staff member
- Save and continue

#### Step 5: Branding
- Upload logo or skip
- Set brand colors
- Save and continue

#### Step 6: Services & Categories
- Create at least one category
- Create at least one service:
  - Name: `Test Service`
  - Duration: `60` minutes
  - Price: `$100.00` (10000 cents)
- Save and continue

#### Step 7: Availability
- Set availability for service/staff
- Save and continue

#### Step 8: Notifications
- **Important:** Note whether you enable notifications or not
  - If enabled → Will use `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
  - If disabled → Will use `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`
- Save and continue

#### Step 9: Policies
- Fill out cancellation, no-show, refund policies
- Set fees (e.g., 50% no-show, 25% cancel)
- Save and continue

#### Step 10: Gift Cards (Optional)
- Skip or create a test gift card
- Save and continue

#### Step 11: Payment Setup ⭐ **CRITICAL**
- This is where subscription gets created!
- Enter your email
- Click "Connect Stripe Account" or "Set Up Payment"
- Complete Stripe onboarding flow
- **Subscription should be created automatically**

---

### Step 3: Verify Subscription Was Created

After completing Step 11, run this query to check:

```sql
-- Find your new account by email
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
WHERE au.email = 'YOUR_NEW_EMAIL_HERE'  -- Replace with your new email
ORDER BY b.created_at DESC
LIMIT 1;
```

**Expected Results:**
- ✅ `stripe_connect_account_id` is NOT NULL
- ✅ `stripe_customer_id` is NOT NULL
- ✅ `stripe_subscription_id` is NOT NULL
- ✅ `stripe_price_id` is NOT NULL
- ✅ `subscription_status` is `'trial'` or `'active'`
- ✅ `trial_ends_at` is set (7 days from creation)

---

### Step 4: Verify in Stripe Dashboard

1. **Go to:** https://dashboard.stripe.com/customers
2. **Search for:** Your new email
3. **Check:**
   - ✅ Customer exists
   - ✅ Subscription exists
   - ✅ Price matches notifications setting
   - ✅ Trial period is 7 days

---

## 🔧 Before Starting: Check Environment Variables

Make sure your `.env` file (in `apps/web/`) has:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_xxxxx
```

**Restart your dev server** after checking!

---

## 🐛 Troubleshooting

### Issue: Subscription Not Created in Step 11

**Check:**
1. Server logs for errors
2. Environment variables are set
3. Stripe API key is correct
4. Price IDs are valid in Stripe

**Solution:**
- Check server console for error messages
- Verify price IDs in Stripe Dashboard
- Re-run Step 11 if needed

### Issue: Connect Account Not Created

**Check:**
1. Stripe API key is set
2. Server logs for errors

**Solution:**
- Check `.env` has `STRIPE_SECRET_KEY`
- Restart dev server
- Try Step 11 again

---

## ✅ After Account is Created

Once you have a new account with subscription, you can:

1. ✅ Verify subscription creation with correct price (Item 1) ✅
2. ✅ Create customer booking (Item 2)
3. ✅ Complete SetupIntent (Item 3)
4. ✅ Test all money actions (Item 4)
5. ✅ Verify database updates (Item 5)
6. ✅ Verify Stripe Dashboard records (Item 6)

See `COMPLETE_VERIFICATION_GUIDE.md` for the rest!

---

## 📋 Quick Checklist

- [ ] Sign up with new email
- [ ] Complete all 11 onboarding steps
- [ ] Complete Step 11 (Payment Setup)
- [ ] Verify subscription created in database
- [ ] Verify subscription exists in Stripe Dashboard
- [ ] Note your new email for future queries

---

## 🎯 Quick Reference Query

After creating new account, use this to check everything:

```sql
-- Replace 'YOUR_NEW_EMAIL' with your actual email
SELECT 
  b.name,
  b.subdomain,
  au.email,
  CASE WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅' ELSE '❌' END as has_connect,
  CASE WHEN b.stripe_subscription_id IS NOT NULL THEN '✅' ELSE '❌' END as has_subscription,
  b.stripe_subscription_id,
  b.stripe_price_id,
  b.subscription_status,
  b.notifications_enabled
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_NEW_EMAIL'
ORDER BY b.created_at DESC
LIMIT 1;
```

---

**Create a new account and go through onboarding - this way you can verify the complete flow works correctly!** 🚀


