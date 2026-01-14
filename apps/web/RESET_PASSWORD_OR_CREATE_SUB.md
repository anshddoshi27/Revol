# Forgot Password? Two Options

You forgot the password for `johny@gmail.com`. Here are two ways to fix it:

---

## 🎯 Option 1: Reset Password (Recommended)

### Step 1: Go to Password Reset Page

1. **Go to your app's login page:**
   - `http://localhost:3000/login`

2. **Click "Forgot Password" or "Reset Password" link**
   - Usually below the login form

3. **Or go directly to reset page:**
   - `http://localhost:3000/reset-password`
   - Or `http://localhost:3000/auth/reset-password`
   - Or check your app's auth routes

### Step 2: Enter Your Email

- Enter: `johny@gmail.com`
- Click "Send Reset Link"

### Step 3: Check Email

- Check your email inbox for `johny@gmail.com`
- Look for password reset email
- Click the reset link

### Step 4: Set New Password

- Enter your new password
- Confirm it
- Save

### Step 5: Log In and Create Subscription

1. Log in with new password
2. Follow the steps in `QUICK_CREATE_SUBSCRIPTION.md`

---

## 🎯 Option 2: Create Subscription WITHOUT Login (Alternative)

If password reset doesn't work, create a script that uses admin access to create the subscription directly.

### Create Script File

**File:** `apps/web/scripts/create-subscription-admin.js`

```javascript
// Admin script to create subscription for existing account
// This bypasses authentication and uses admin client

import { createAdminClient } from '../src/lib/db';
import {
  createOrGetCustomer,
  createSubscription,
  verifyConnectAccount,
} from '../src/lib/stripe';

const BUSINESS_ID = 'c5bb33ab-d767-44db-a239-68d65f19ecf1'; // DAMBOX business ID
const USER_EMAIL = 'johny@gmail.com';
const CONNECT_ACCOUNT_ID = 'acct_1SamCw2KHPPJV1hT';

async function createSubscriptionAdmin() {
  console.log('Creating subscription for DAMBOX account...');
  
  const supabase = createAdminClient();
  
  // Get business
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', BUSINESS_ID)
    .single();
  
  if (businessError || !business) {
    console.error('Business not found:', businessError);
    return;
  }
  
  console.log('Business found:', business.name);
  
  // Verify Connect account
  const isVerified = await verifyConnectAccount(CONNECT_ACCOUNT_ID);
  if (!isVerified) {
    console.error('Connect account not verified!');
    return;
  }
  
  console.log('Connect account verified');
  
  // Get price ID from environment
  const notificationsEnabled = business.notifications_enabled === true;
  const priceId = notificationsEnabled
    ? process.env.STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS
    : process.env.STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS;
  
  if (!priceId) {
    console.error('Price ID not configured!');
    console.error('Set STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS or STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS');
    return;
  }
  
  console.log('Using price ID:', priceId);
  
  // Create or get customer
  let customerId = business.stripe_customer_id;
  if (!customerId) {
    customerId = await createOrGetCustomer(USER_EMAIL, business.name || 'Business Owner', {
      business_id: BUSINESS_ID,
      user_id: business.user_id,
    });
    
    // Save customer ID
    await supabase
      .from('businesses')
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', BUSINESS_ID);
    
    console.log('Customer created:', customerId);
  } else {
    console.log('Using existing customer:', customerId);
  }
  
  // Create subscription
  const subscription = await createSubscription(
    customerId,
    priceId,
    {
      business_id: BUSINESS_ID,
      user_id: business.user_id,
    },
    null // No payment method yet
  );
  
  console.log('Subscription created:', subscription.subscriptionId);
  
  // Calculate dates
  const nextBillAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  
  let subscriptionStatus = 'trial';
  if (subscription.status === 'active') {
    subscriptionStatus = 'active';
  } else if (subscription.status === 'trialing') {
    subscriptionStatus = 'trial';
  }
  
  // Save subscription
  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      stripe_subscription_id: subscription.subscriptionId,
      stripe_price_id: priceId,
      subscription_status: subscriptionStatus,
      trial_ends_at: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      next_bill_at: nextBillAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', BUSINESS_ID);
  
  if (updateError) {
    console.error('Error saving subscription:', updateError);
    return;
  }
  
  console.log('✅ Subscription saved to database!');
  console.log('Subscription ID:', subscription.subscriptionId);
  console.log('Status:', subscriptionStatus);
}

createSubscriptionAdmin()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
```

### Run the Script

```bash
cd apps/web
node scripts/create-subscription-admin.js
```

**Note:** This requires admin database access and Stripe API keys to be set.

---

## 🎯 Option 3: Use Supabase Dashboard (Easiest Alternative)

If you have access to Supabase Dashboard, you can reset the password there:

### Step 1: Go to Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Log in to your Supabase account
3. Select your project

### Step 2: Reset Password

1. Go to **Authentication** → **Users**
2. Find user with email: `johny@gmail.com`
3. Click on the user
4. Click **"Send password reset email"** or **"Reset password"**
5. Check email and set new password

### Step 3: Log In and Create Subscription

1. Log in with new password
2. Follow steps in `QUICK_CREATE_SUBSCRIPTION.md`

---

## 🎯 Option 4: Create New Test Account (Last Resort)

If all else fails, create a new test account just for verification:

1. **Sign up with a new email**
2. **Complete onboarding** (or use existing business)
3. **Create subscription** for that account
4. **Use that account for testing**

But try password reset first - it's easier!

---

## 📋 Quick Checklist

**Try in this order:**

1. ✅ **Password Reset via App** (Option 1)
   - Go to login page
   - Click "Forgot Password"
   - Reset via email

2. ✅ **Password Reset via Supabase** (Option 3)
   - Use Supabase Dashboard
   - Reset from Auth → Users

3. ✅ **Admin Script** (Option 2)
   - Create script with admin access
   - Run directly

4. ✅ **New Account** (Option 4)
   - Last resort only

---

## 🎯 Recommended: Start with Password Reset

**Easiest path:**

1. Go to: `http://localhost:3000/login`
2. Click "Forgot Password" or "Reset Password"
3. Enter: `johny@gmail.com`
4. Check email and reset
5. Log in with new password
6. Use browser console method from `QUICK_CREATE_SUBSCRIPTION.md`

---

**Start with password reset - it's the easiest!** 🔑


