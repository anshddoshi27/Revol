# Quick Start: Complete Verification Guide

This is your **step-by-step roadmap** to verify all remaining Stripe integration components.

---

## 🎯 Your Current Status

✅ **Completed:**
- Stripe Connect account created (`acct_1SZeE0RpBhfmTDiM`)
- Business linked to account

❓ **To Verify:**
1. Subscription creation with correct price
2. Create customer booking
3. Complete SetupIntent (save payment method)
4. Test all money actions (Complete, No-Show, Cancel, Refund)
5. Verify all database updates
6. Verify all Stripe Dashboard records

---

## 📚 Documentation Files

I've created comprehensive guides for you:

1. **`COMPLETE_VERIFICATION_GUIDE.md`** ⭐ **START HERE**
   - Complete step-by-step instructions for all 6 items
   - Database queries
   - API calls
   - Stripe Dashboard verification steps

2. **`VERIFICATION_QUERIES.sql`**
   - All SQL queries ready to copy/paste
   - Organized by verification item
   - Quick status checks

3. **`COMPLETE_YOUR_SETUP.md`**
   - Fix subscription creation
   - Enable restricted accounts

4. **`DEBUG_STRIPE_CONNECT.md`**
   - Troubleshooting guide
   - Common issues and solutions

---

## 🚀 Quick Start: Verification Workflow

### Step 1: Verify Subscription (5 minutes)

**Run this query:**
```sql
SELECT 
  stripe_subscription_id,
  stripe_price_id,
  subscription_status,
  notifications_enabled,
  trial_ends_at
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';
```

**Check:**
- ✅ `stripe_subscription_id` exists? → If not, see `COMPLETE_YOUR_SETUP.md`
- ✅ `stripe_price_id` matches notifications setting?
- ✅ Verify in Stripe Dashboard → Customers → Subscriptions

**If subscription missing:** Re-run Step 11 of onboarding

---

### Step 2: Create Booking (10 minutes)

**Get your business info:**
```sql
SELECT subdomain FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';
```

**Create booking:**
```bash
curl -X POST "http://localhost:3000/api/public/YOUR_SUBDOMAIN/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "your-service-id",
    "staff_id": "your-staff-id",
    "start_at": "2025-01-20T14:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }'
```

**Save the response:**
- `booking_id`
- `setup_intent_id`
- `client_secret`

**See:** `COMPLETE_VERIFICATION_GUIDE.md` Section 2 for details

---

### Step 3: Complete SetupIntent (5 minutes)

**Option A: Via Stripe Dashboard (Testing)**
1. Go to: https://dashboard.stripe.com/test/setup_intents
2. Find your SetupIntent by ID
3. Complete with test card: `4242 4242 4242 4242`

**Option B: Via Frontend**
- Use Stripe.js with the `client_secret` from booking response

**Verify:**
```sql
SELECT payment_status, stripe_setup_intent_id
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```
- ✅ `payment_status` should be `'card_saved'`

---

### Step 4: Test Money Actions (30 minutes)

#### Test Complete (Charge Full Amount)

```bash
curl -X POST "http://localhost:3000/api/admin/bookings/YOUR_BOOKING_ID/complete" \
  -H "Cookie: your-session-cookie" \
  -H "X-Idempotency-Key: complete-$(date +%s)"
```

**Verify in Database:**
```sql
SELECT status, payment_status, last_money_action
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```
- ✅ `status` = `'completed'`
- ✅ `payment_status` = `'charged'`
- ✅ `last_money_action` = `'completed_charge'`

**Verify in Stripe Dashboard:**
- Go to Payments → Payment Intents
- Find Payment Intent
- Check: amount, on_behalf_of, application_fee_amount, metadata

**See:** `COMPLETE_VERIFICATION_GUIDE.md` Section 4.1 for full details

#### Test No-Show, Cancel, Refund

**Similar process - see:** `COMPLETE_VERIFICATION_GUIDE.md` Section 4.2-4.4

---

### Step 5: Verify Database Updates (5 minutes)

**Run comprehensive check:**
```sql
-- See VERIFICATION_QUERIES.sql for all queries
-- Quick summary:
SELECT 
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'no_show') as noshow,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  COUNT(*) FILTER (WHERE status = 'refunded') as refunded
FROM bookings
WHERE business_id = (SELECT id FROM businesses WHERE subdomain = 'test-9s7v-1764715219148');
```

**Check all payment records:**
```sql
SELECT money_action, status, COUNT(*) 
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE b.business_id = (SELECT id FROM businesses WHERE subdomain = 'test-9s7v-1764715219148')
GROUP BY money_action, status;
```

**See:** `VERIFICATION_QUERIES.sql` for complete queries

---

### Step 6: Verify Stripe Dashboard Records (10 minutes)

**Checklist:**

1. **Connect Account:**
   - ✅ Status = Enabled
   - ✅ Charges enabled = Yes
   - https://dashboard.stripe.com/connect/accounts/overview

2. **Customer & Subscription:**
   - ✅ Customer exists
   - ✅ Subscription exists with correct price
   - ✅ Metadata contains business_id
   - https://dashboard.stripe.com/customers

3. **Payment Intents:**
   - ✅ All succeeded
   - ✅ on_behalf_of set correctly
   - ✅ application_fee_amount = 1%
   - ✅ Metadata correct
   - https://dashboard.stripe.com/payments

4. **Transfers:**
   - ✅ Transfers exist
   - ✅ Destination = Connect account
   - ✅ Amount correct
   - https://dashboard.stripe.com/connect/transfers

**See:** `COMPLETE_VERIFICATION_GUIDE.md` Section 6 for detailed steps

---

## ✅ Final Checklist

After completing all steps, verify:

### Subscription ✅
- [ ] Subscription exists in database
- [ ] Price matches notifications setting
- [ ] Visible in Stripe Dashboard

### Booking Flow ✅
- [ ] Booking created successfully
- [ ] SetupIntent completed
- [ ] Payment method saved

### Money Actions ✅
- [ ] Complete action works
- [ ] No-Show action works
- [ ] Cancel action works
- [ ] Refund action works

### Database ✅
- [ ] All records created correctly
- [ ] Statuses updated correctly
- [ ] Fees tracked correctly

### Stripe Dashboard ✅
- [ ] All records visible
- [ ] All metadata correct
- [ ] Transfers working

---

## 🐛 Troubleshooting

**Issue:** Subscription not created
- **Solution:** See `COMPLETE_YOUR_SETUP.md` Step 3

**Issue:** Booking creation fails
- **Check:** Business subscription status (must be 'active' or 'trial')
- **Check:** Service and staff are active

**Issue:** Payment Intent not created
- **Check:** Connect account is enabled
- **Check:** Payment method is saved

**Issue:** Database not updating
- **Check:** Webhook is processing
- **Check:** Server logs for errors

**More help:** See `DEBUG_STRIPE_CONNECT.md`

---

## 📖 Next Steps

1. **Read:** `COMPLETE_VERIFICATION_GUIDE.md` for detailed instructions
2. **Use:** `VERIFICATION_QUERIES.sql` for all database queries
3. **Follow:** Step-by-step workflow above
4. **Verify:** Complete the final checklist

---

## 🎯 Your Business Info

- **Email:** demo@tithi.com
- **Subdomain:** test-9s7v-1764715219148
- **Connect Account:** acct_1SZeE0RpBhfmTDiM

**Use these values in all queries and API calls!**

---

**Good luck! Start with Step 1 and work through each step methodically.** 🚀


