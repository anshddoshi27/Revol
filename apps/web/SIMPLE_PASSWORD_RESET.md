# Simple Password Reset Guide

## 🎯 Quick Steps

### Step 1: Go to Login Page

1. Open: `http://localhost:3000/login`

### Step 2: Find "Forgot Password" Link

- Look for "Forgot Password?" or "Reset Password" link
- Usually below the login form
- Or check: `http://localhost:3000/forgot-password`
- Or check: `http://localhost:3000/auth/forgot-password`

### Step 3: Enter Email

- Email: `johny@gmail.com`
- Submit

### Step 4: Check Email

- Check inbox for `johny@gmail.com`
- Click reset link
- Set new password

### Step 5: Log In

- Log in with new password
- Follow `QUICK_CREATE_SUBSCRIPTION.md` to create subscription

---

## 🔧 Alternative: Reset via Supabase Dashboard

If the app doesn't have password reset:

1. Go to: https://supabase.com/dashboard
2. Log in to your Supabase account
3. Select your project
4. Go to **Authentication** → **Users**
5. Find `johny@gmail.com`
6. Click **"Send password reset email"** or **"Reset password"**
7. Check email and reset

---

## 🎯 Or: Create Subscription via Stripe Dashboard + Database Update

If password reset doesn't work, you can create subscription manually:

### Step 1: Create Customer in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/customers
2. Click **"+ Add customer"**
3. Email: `johny@gmail.com`
4. Name: `DAMBOX`
5. Save → Copy Customer ID (starts with `cus_`)

### Step 2: Create Subscription in Stripe Dashboard

1. Click on the customer you just created
2. Go to **Subscriptions** tab
3. Click **"+ Add subscription"**
4. Select your price (the one from `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`)
5. Set trial period: **7 days**
6. Add metadata:
   - `business_id`: `c5bb33ab-d767-44db-a239-68d65f19ecf1`
   - `user_email`: `johny@gmail.com`
7. Save → Copy Subscription ID (starts with `sub_`)

### Step 3: Update Database

Run this SQL query (replace with actual IDs from Stripe):

```sql
UPDATE businesses 
SET 
  stripe_customer_id = 'cus_XXXXX',  -- From Step 1
  stripe_subscription_id = 'sub_XXXXX',  -- From Step 2
  stripe_price_id = 'price_XXXXX',  -- Your price ID from .env
  subscription_status = 'trial',
  trial_ends_at = NOW() + INTERVAL '7 days',
  next_bill_at = NOW() + INTERVAL '7 days',
  updated_at = NOW()
WHERE id = 'c5bb33ab-d767-44db-a239-68d65f19ecf1';
```

---

## ✅ Recommended Order

1. **Try password reset first** (easiest)
2. **If that fails, try Supabase Dashboard reset**
3. **If that fails, create subscription manually via Stripe + update database**

---

**Start with password reset - it's the quickest!** 🔑


