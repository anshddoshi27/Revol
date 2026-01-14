# Quick: Create Subscription for DAMBOX Account

**You don't need a new account!** Just call the API directly while logged in.

---

## ✅ Quick Steps (2 minutes)

### Step 1: Log Into Your App

1. Go to: `http://localhost:3000/login`
2. Email: `johny@gmail.com`
3. Log in ✅

### Step 2: Open Browser Console

1. Press **F12** (or right-click → Inspect)
2. Click **Console** tab

### Step 3: Run This Command

Copy and paste this into the console, then press Enter:

```javascript
fetch('/api/business/onboarding/step-11-payment-setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'johny@gmail.com',
    connectAccountId: 'acct_1SamCw2KHPPJV1hT'
  })
})
.then(r => r.json())
.then(d => {
  console.log('✅ Success!', d);
  if (d.subscriptionId) {
    console.log('✅ Subscription created:', d.subscriptionId);
  }
})
.catch(e => console.error('❌ Error:', e));
```

### Step 4: Check Result

Look at the console output:
- ✅ **Success:** Should show `subscriptionId` in the response
- ❌ **Error:** Check the error message

---

## 🔧 Before Running: Check Environment Variables

Make sure your `.env` file (in `apps/web/`) has:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx
```

**Restart your dev server** if you updated `.env`!

---

## ✅ After Running: Verify

Run this query to check subscription was created:

```sql
SELECT 
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  subscription_status,
  trial_ends_at
FROM businesses
WHERE name = 'DAMBOX';
```

**Should show all fields filled in!**

---

## 🐛 Troubleshooting

**Error: "Price ID not configured"**
- Check `.env` has `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS` set
- Restart dev server

**Error: "Unauthorized"**
- Make sure you're logged in
- Try refreshing the page and logging in again

**Error: "Connect account not verified"**
- Go to Stripe Dashboard → Connect → Accounts
- Find account `acct_1SamCw2KHPPJV1hT`
- Complete onboarding if it shows "Restricted"

---

**That's it! Just log in, open console, and run the command!** 🚀


