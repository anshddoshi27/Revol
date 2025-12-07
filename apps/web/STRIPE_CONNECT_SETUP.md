# Stripe Connect Setup - Environment Variables

## ✅ **STRIPE_CONNECT_CLIENT_ID is NOT Required**

This application uses **Stripe Connect Express accounts** with **Account Links**, which does **NOT** require a `STRIPE_CONNECT_CLIENT_ID`.

### Why No Client ID is Needed

The app uses:
- **Express accounts** (`type: 'express'` in `createConnectAccount`)
- **Account Links** for onboarding (not OAuth)
- **Server-side account creation** using the secret key

`STRIPE_CONNECT_CLIENT_ID` is only needed for:
- ❌ OAuth-based Connect flows (redirecting to Stripe's OAuth page)
- ❌ Custom accounts (different account type)

This app uses **Express accounts with Account Links**, so it doesn't need a client ID.

---

## ✅ **Required Stripe Environment Variables**

### Required:
```bash
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production
```

### Optional (for webhooks):
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Optional (for subscription plans):
```bash
STRIPE_PLAN_PRICE_ID=price_...
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_...
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_...
```

---

## 🔍 **How Stripe Connect Works in This App**

### 1. Account Creation
```typescript
// src/lib/stripe.ts
export async function createConnectAccount(userId: string, email: string) {
  const account = await stripe.accounts.create({
    type: 'express',  // ← Express account, no client ID needed
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  return account.id;
}
```

### 2. Onboarding Link
```typescript
export async function createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',  // ← Account Links, not OAuth
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return accountLink.url;
}
```

### 3. Payment Processing
```typescript
// Payments are made with destination charges
const paymentIntent = await stripe.paymentIntents.create({
  amount,
  currency: 'usd',
  on_behalf_of: connectAccountId,  // ← Uses account ID, not client ID
  transfer_data: {
    destination: connectAccountId,
  },
  application_fee_amount: applicationFee,
});
```

---

## ✅ **Summary**

- ✅ **STRIPE_CONNECT_CLIENT_ID:** NOT needed
- ✅ **STRIPE_SECRET_KEY:** Required
- ✅ **STRIPE_WEBHOOK_SECRET:** Optional (for webhooks)
- ✅ **STRIPE_PLAN_PRICE_ID:** Optional (for subscriptions)

The app works perfectly without `STRIPE_CONNECT_CLIENT_ID` because it uses Express accounts with Account Links, not OAuth-based Connect.


