# Quick Start: Create New Account

## ✅ Simple 3-Step Process

### Step 1: Sign Up (2 minutes)

1. Go to: `http://localhost:3000/signup`
2. Fill out form:
   - Email: `test-new-account@example.com` (use a NEW email)
   - Password: `TestPassword123!` (save it!)
   - Name: Your name
3. Submit and verify (check email if needed)

---

### Step 2: Complete Onboarding (15-20 minutes)

Go through all 11 steps:

1. **Business Basics** - Name, description, etc.
2. **Booking Website** - Choose subdomain
3. **Location & Contacts** - Address, phone, email
4. **Team** - Add at least one staff member
5. **Branding** - Logo, colors (optional)
6. **Services** - Create at least one service ($100, 60 min)
7. **Availability** - Set schedule
8. **Notifications** - Enable or disable (affects price!)
9. **Policies** - Cancellation, no-show fees
10. **Gift Cards** - Skip for now
11. **Payment Setup** ⭐ - Connect Stripe, creates subscription

**Important:** In Step 8 (Notifications), remember if you enabled or disabled notifications - this affects which price is used!

---

### Step 3: Verify Subscription Created (1 minute)

Run this query (replace with your new email):

```sql
SELECT 
  b.name,
  au.email,
  b.subdomain,
  b.stripe_connect_account_id,
  b.stripe_subscription_id,
  b.stripe_price_id,
  b.subscription_status,
  b.notifications_enabled,
  b.trial_ends_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'YOUR_NEW_EMAIL_HERE'
ORDER BY b.created_at DESC
LIMIT 1;
```

**Should show:**
- ✅ All Stripe IDs are NOT NULL
- ✅ Subscription status is 'trial'
- ✅ Trial end date is set

---

## 🔧 Before You Start

**Check your `.env` file has:**

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_xxxxx
```

**Restart dev server** if you updated `.env`!

---

## ✅ After Account Created

You now have a fresh account with subscription! Next steps:

1. ✅ Verify subscription creation (Item 1) ✅
2. Create customer booking (Item 2)
3. Complete SetupIntent (Item 3)
4. Test money actions (Item 4)
5. Verify database updates (Item 5)
6. Verify Stripe Dashboard (Item 6)

See `COMPLETE_VERIFICATION_GUIDE.md` for details!

---

## 🎯 Quick Checklist

- [ ] Sign up with new email
- [ ] Save password somewhere!
- [ ] Complete all 11 onboarding steps
- [ ] Note if notifications enabled/disabled
- [ ] Verify subscription in database query
- [ ] Check Stripe Dashboard for subscription

---

**That's it! Create a new account and go through onboarding - subscription should be created automatically in Step 11!** 🚀


