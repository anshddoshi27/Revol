# Complete Verification Guide - Step by Step

This guide walks you through verifying all remaining items from your checklist.

---

## ✅ Item 1: Verify Subscription Creation with Correct Price

### Step 1.1: Check Database

Run this query to verify subscription details:

```sql
-- Verify subscription creation and price
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
  -- Price verification
  CASE 
    WHEN b.notifications_enabled = true AND b.stripe_price_id IS NOT NULL THEN 
      '✅ Pro Plan - Should use STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS'
    WHEN b.notifications_enabled = false AND b.stripe_price_id IS NOT NULL THEN 
      '✅ Basic Plan - Should use STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS'
    WHEN b.stripe_price_id IS NULL THEN 
      '❌ Missing Price ID'
    ELSE '⚠️ Check price configuration'
  END as price_verification
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';  -- Replace with your email
```

**Expected Results:**
- ✅ `stripe_subscription_id` is NOT NULL (starts with `sub_`)
- ✅ `stripe_price_id` is NOT NULL (starts with `price_`)
- ✅ `subscription_status` is `'trial'` or `'active'`
- ✅ `trial_ends_at` is set (7 days from creation)
- ✅ Price ID matches notifications setting

### Step 1.2: Verify in Stripe Dashboard

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/customers
   - Search for your email: `demo@tithi.com`

2. **Check Customer:**
   - Click on the customer
   - Go to "Subscriptions" tab
   - You should see an active subscription

3. **Verify Subscription Details:**
   - Click on the subscription
   - **Status:** Should be `trialing` or `active`
   - **Price ID:** Should match `stripe_price_id` from database
   - **Amount:** 
     - With notifications: **$21.99/month**
     - Without notifications: **$11.99/month**
   - **Trial End:** Should match `trial_ends_at` from database

4. **Check Metadata:**
   - Scroll to "Metadata" section
   - Should contain:
     - `business_id`: Your business UUID
     - `user_id`: Your user UUID

### Step 1.3: Verify Price Selection Logic

Check environment variables:

```bash
# Check your .env file (apps/web/.env)
# Should have:
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_xxxxx
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_xxxxx
```

**Compare:**
- Database `notifications_enabled` value
- Database `stripe_price_id` value
- Environment variable (WITH or WITHOUT NOTIFICATIONS)

**They should match!**

---

## ✅ Item 2: Create Customer Booking

### Step 2.1: Get Business Info

First, get your business subdomain and service/staff IDs:

```sql
-- Get business subdomain
SELECT 
  b.subdomain,
  b.name
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';

-- Get services
SELECT 
  s.id as service_id,
  s.name as service_name,
  s.price_cents,
  s.duration_min,
  b.subdomain
FROM services s
JOIN businesses b ON b.id = s.business_id
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com'
  AND s.is_active = true
  AND s.deleted_at IS NULL
LIMIT 1;

-- Get staff
SELECT 
  st.id as staff_id,
  st.name as staff_name,
  b.subdomain
FROM staff st
JOIN businesses b ON b.id = st.business_id
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com'
  AND st.is_active = true
  AND st.deleted_at IS NULL
LIMIT 1;
```

### Step 2.2: Create Booking via API

```bash
# Replace these values with your actual data
SUBDOMAIN="test-9s7v-1764715219148"  # Your subdomain from query above
SERVICE_ID="your-service-id"  # From service query above
STAFF_ID="your-staff-id"  # From staff query above
BASE_URL="http://localhost:3000"  # Or your production URL

# Create booking
curl -X POST "${BASE_URL}/api/public/${SUBDOMAIN}/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "'"${SERVICE_ID}"'",
    "staff_id": "'"${STAFF_ID}"'",
    "start_at": "2025-01-20T14:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }' | jq
```

**Expected Response:**
```json
{
  "booking_id": "uuid-here",
  "booking_code": "TITHI-XXXX",
  "client_secret": "seti_xxxxx_secret_xxxxx",
  "setup_intent_id": "seti_xxxxx",
  "final_price_cents": 10000,
  "message": "Booking created successfully. Please complete payment setup."
}
```

**Save these values:**
- `booking_id` - You'll need this later
- `setup_intent_id` - For completing SetupIntent
- `client_secret` - For completing SetupIntent

### Step 2.3: Verify Booking in Database

```sql
-- Check booking was created
SELECT 
  id,
  booking_code,
  status,
  payment_status,
  final_price_cents,
  stripe_setup_intent_id,
  created_at
FROM bookings
WHERE id = 'YOUR_BOOKING_ID'  -- Replace with booking_id from API response
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `status` = `'pending'`
- ✅ `payment_status` = `'none'` or `'card_saved'`
- ✅ `stripe_setup_intent_id` is set (starts with `seti_`)

---

## ✅ Item 3: Complete SetupIntent (Save Payment Method)

### Step 3.1: Complete SetupIntent via Stripe.js (Frontend)

If you have access to the frontend:

1. **Use the `client_secret` from booking response**
2. **Complete using Stripe.js:**

```javascript
// Frontend code (if you have access)
const stripe = Stripe('your-publishable-key');
const { error } = await stripe.confirmCardSetup(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: 'Test Customer',
      email: 'test@example.com'
    }
  }
});
```

### Step 3.2: Complete SetupIntent via Stripe Dashboard (Testing)

For testing without frontend:

1. **Go to Stripe Dashboard:**
   - https://dashboard.stripe.com/test/setup_intents
   - Find your SetupIntent by ID (`seti_xxxxx`)

2. **Complete SetupIntent:**
   - Click on the SetupIntent
   - Use test mode card: `4242 4242 4242 4242`
   - Complete the flow

### Step 3.3: Verify SetupIntent Completion

**In Stripe Dashboard:**
- Status should be `Succeeded` ✅

**In Database:**

```sql
-- Check booking payment status
SELECT 
  bp.id,
  bp.booking_id,
  bp.stripe_setup_intent_id,
  bp.status,
  b.status as booking_status,
  b.payment_status
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE bp.booking_id = 'YOUR_BOOKING_ID'
ORDER BY bp.created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `status` = `'card_saved'`
- ✅ `stripe_setup_intent_id` is set
- ✅ `booking.payment_status` = `'card_saved'`

**Also verify webhook processed:**

```sql
-- Check if webhook updated the booking
SELECT 
  status,
  payment_status,
  stripe_setup_intent_id
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```

**Expected:**
- ✅ `payment_status` = `'card_saved'` (if webhook processed)

---

## ✅ Item 4: Test All Money Actions

### Test 4.1: Complete Booking (Charge Full Amount)

**Step 1: Charge the booking**

```bash
# Replace with your values
BOOKING_ID="your-booking-id"
BASE_URL="http://localhost:3000"

# Get your session cookie from browser (DevTools → Application → Cookies)
# Then call:

curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/complete" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -H "X-Idempotency-Key: complete-$(date +%s)" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "paymentIntentId": "pi_xxxxx",
  "status": "succeeded",
  "amountCharged": 10000,
  "applicationFee": 100,
  "booking": {
    "id": "booking-id",
    "status": "completed",
    "payment_status": "charged"
  }
}
```

**Step 2: Verify in Database**

```sql
-- Check booking payment
SELECT 
  id,
  booking_id,
  stripe_payment_intent_id,
  amount_cents,
  money_action,
  status,
  application_fee_cents,
  stripe_fee_cents
FROM booking_payments
WHERE booking_id = 'YOUR_BOOKING_ID'
  AND money_action = 'completed_charge'
ORDER BY created_at DESC
LIMIT 1;

-- Check booking
SELECT 
  id,
  status,
  payment_status,
  last_money_action,
  final_price_cents
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```

**Expected:**
- ✅ `booking_payments.status` = `'charged'`
- ✅ `booking_payments.money_action` = `'completed_charge'`
- ✅ `booking_payments.amount_cents` = service price (e.g., 10000)
- ✅ `booking_payments.application_fee_cents` = 1% of amount (e.g., 100)
- ✅ `bookings.status` = `'completed'`
- ✅ `bookings.payment_status` = `'charged'`
- ✅ `bookings.last_money_action` = `'completed_charge'`

**Step 3: Verify in Stripe Dashboard**

1. **Go to:** https://dashboard.stripe.com/payments
2. **Find Payment Intent:** Search by `pi_xxxxx` from API response
3. **Verify:**
   - ✅ Status = `Succeeded`
   - ✅ Amount = service price (e.g., 10000 cents)
   - ✅ `on_behalf_of` = your Connect account ID
   - ✅ `transfer_data.destination` = your Connect account ID
   - ✅ `application_fee_amount` = 1% of amount (e.g., 100 cents)
   - ✅ Metadata:
     - `booking_id` = your booking ID
     - `business_id` = your business ID
     - `money_action` = `completed_charge`

4. **Check Transfer:**
   - Click on transfer link
   - Verify destination = your Connect account
   - Verify amount = net amount (after platform fee)

---

### Test 4.2: No-Show Fee

**Step 1: Create another booking and complete SetupIntent first**

```bash
# Create new booking (same as Step 2.2)
# Complete SetupIntent (same as Step 3)
# Save the new booking_id
```

**Step 2: Charge no-show fee**

```bash
BOOKING_ID="new-booking-id"

curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/no-show" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -H "X-Idempotency-Key: noshow-$(date +%s)" \
  -d '{}'
```

**Step 3: Verify fee calculation**

First, check your no-show fee policy:

```sql
-- Get no-show fee policy
SELECT 
  no_show_fee_type,
  no_show_fee_amount_cents,
  no_show_fee_percent
FROM business_policies
WHERE business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'  -- Your subdomain
)
AND is_active = true
ORDER BY version DESC
LIMIT 1;
```

**Calculate expected fee:**
- If `no_show_fee_type = 'percent'`: Fee = `price_cents * no_show_fee_percent / 100`
- If `no_show_fee_type = 'amount'`: Fee = `no_show_fee_amount_cents`
- If fee is 0: No charge, just status update

**Step 4: Verify in Database**

```sql
-- Check booking payment
SELECT 
  amount_cents,
  money_action,
  status
FROM booking_payments
WHERE booking_id = 'YOUR_BOOKING_ID'
  AND money_action = 'no_show_fee';

-- Check booking
SELECT 
  status,
  payment_status,
  last_money_action
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```

**Expected:**
- ✅ `booking_payments.amount_cents` = no-show fee amount
- ✅ `booking_payments.money_action` = `'no_show_fee'`
- ✅ `bookings.status` = `'no_show'`
- ✅ `bookings.last_money_action` = `'no_show_fee'`

**Step 5: Verify in Stripe Dashboard**

- Find Payment Intent with metadata `money_action: 'no_show_fee'`
- Verify amount = no-show fee
- Verify application fee = 1% of fee amount

---

### Test 4.3: Cancel Fee

**Step 1: Create another booking and complete SetupIntent**

**Step 2: Charge cancellation fee**

```bash
BOOKING_ID="booking-id-for-cancel"

curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/cancel" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -H "X-Idempotency-Key: cancel-$(date +%s)" \
  -d '{}'
```

**Step 3: Verify fee calculation**

```sql
-- Get cancellation fee policy
SELECT 
  cancel_fee_type,
  cancel_fee_amount_cents,
  cancel_fee_percent
FROM business_policies
WHERE business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
AND is_active = true
ORDER BY version DESC
LIMIT 1;
```

**Step 4: Verify in Database**

```sql
SELECT 
  amount_cents,
  money_action,
  status
FROM booking_payments
WHERE booking_id = 'YOUR_BOOKING_ID'
  AND money_action = 'cancel_fee';

SELECT 
  status,
  payment_status,
  last_money_action
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```

**Expected:**
- ✅ `booking_payments.amount_cents` = cancellation fee
- ✅ `bookings.status` = `'cancelled'`
- ✅ `bookings.last_money_action` = `'cancel_fee'`

---

### Test 4.4: Refund

**Step 1: Find a completed booking (one that was charged)**

```sql
-- Find a completed booking
SELECT 
  id,
  status,
  payment_status,
  final_price_cents
FROM bookings
WHERE status = 'completed'
  AND payment_status = 'charged'
ORDER BY created_at DESC
LIMIT 1;
```

**Step 2: Process refund**

```bash
BOOKING_ID="completed-booking-id"

curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/refund" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie-here" \
  -H "X-Idempotency-Key: refund-$(date +%s)" \
  -d '{
    "amount": null
  }'  # null = full refund, or specify amount for partial
```

**Step 3: Verify in Database**

```sql
-- Check refund payment record
SELECT 
  id,
  booking_id,
  stripe_refund_id,
  amount_cents,
  money_action,
  status
FROM booking_payments
WHERE booking_id = 'YOUR_BOOKING_ID'
  AND money_action = 'refund'
ORDER BY created_at DESC
LIMIT 1;

-- Check booking status
SELECT 
  status,
  payment_status
FROM bookings
WHERE id = 'YOUR_BOOKING_ID';
```

**Expected:**
- ✅ New `booking_payments` record with `money_action = 'refund'`
- ✅ `stripe_refund_id` is set
- ✅ `bookings.status` = `'refunded'`

**Step 4: Verify in Stripe Dashboard**

1. **Go to:** https://dashboard.stripe.com/payments/refunds
2. **Find refund:** Search by refund ID or booking ID in metadata
3. **Verify:**
   - ✅ Status = `Succeeded`
   - ✅ Amount = refund amount
   - ✅ Original Payment Intent linked

---

## ✅ Item 5: Verify All Database Updates

### Complete Database Verification Query

Run this comprehensive query to verify all database updates:

```sql
-- Complete database verification
SELECT 
  -- Business info
  b.name as business_name,
  b.subdomain,
  au.email,
  
  -- Stripe setup
  CASE WHEN b.stripe_connect_account_id IS NOT NULL THEN '✅' ELSE '❌' END as has_connect,
  CASE WHEN b.stripe_customer_id IS NOT NULL THEN '✅' ELSE '❌' END as has_customer,
  CASE WHEN b.stripe_subscription_id IS NOT NULL THEN '✅' ELSE '❌' END as has_subscription,
  CASE WHEN b.stripe_price_id IS NOT NULL THEN '✅' ELSE '❌' END as has_price_id,
  b.subscription_status,
  b.notifications_enabled,
  
  -- Bookings summary
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id) as total_bookings,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'completed') as completed_bookings,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'no_show') as noshow_bookings,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'cancelled') as cancelled_bookings,
  (SELECT COUNT(*) FROM bookings bk WHERE bk.business_id = b.id AND bk.status = 'refunded') as refunded_bookings,
  
  -- Payments summary
  (SELECT COUNT(*) FROM booking_payments bp 
   JOIN bookings bk ON bk.id = bp.booking_id 
   WHERE bk.business_id = b.id) as total_payments,
  (SELECT COUNT(*) FROM booking_payments bp 
   JOIN bookings bk ON bk.id = bp.booking_id 
   WHERE bk.business_id = b.id AND bp.status = 'charged') as charged_payments,
  (SELECT COUNT(*) FROM booking_payments bp 
   JOIN bookings bk ON bk.id = bp.booking_id 
   WHERE bk.business_id = b.id AND bp.money_action = 'refund') as refunds
  
FROM businesses b
JOIN auth.users au ON au.id = b.user_id
WHERE au.email = 'demo@tithi.com';
```

### Verify All Bookings and Payments

```sql
-- All bookings with payment status
SELECT 
  b.id as booking_id,
  b.booking_code,
  b.status as booking_status,
  b.payment_status,
  b.last_money_action,
  b.final_price_cents,
  bp.status as payment_record_status,
  bp.money_action,
  bp.amount_cents,
  bp.stripe_payment_intent_id,
  bp.stripe_refund_id,
  b.created_at
FROM bookings b
LEFT JOIN booking_payments bp ON bp.booking_id = b.id
WHERE b.business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY b.created_at DESC;
```

### Verify Payment Records Integrity

```sql
-- Check all payment records
SELECT 
  bp.id,
  bp.booking_id,
  bp.money_action,
  bp.status,
  bp.amount_cents,
  bp.application_fee_cents,
  bp.stripe_payment_intent_id,
  bp.stripe_setup_intent_id,
  bp.stripe_refund_id,
  bp.created_at,
  b.status as booking_status,
  b.payment_status
FROM booking_payments bp
JOIN bookings b ON b.id = bp.booking_id
WHERE b.business_id = (
  SELECT id FROM businesses 
  WHERE subdomain = 'test-9s7v-1764715219148'
)
ORDER BY bp.created_at DESC;
```

---

## ✅ Item 6: Verify All Stripe Dashboard Records

### Verification Checklist for Stripe Dashboard

#### 6.1: Connect Account

1. **Go to:** https://dashboard.stripe.com/connect/accounts/overview
2. **Find your account:** `demo@tithi.com`
3. **Verify:**
   - ✅ Account ID matches database: `acct_1SZeE0RpBhfmTDiM`
   - ✅ Status = `Enabled` (not Restricted)
   - ✅ Charges enabled = `Yes`
   - ✅ Payouts enabled = `Yes` (or enabled after first payment)

#### 6.2: Customer & Subscription

1. **Go to:** https://dashboard.stripe.com/customers
2. **Search for:** `demo@tithi.com`
3. **Verify Customer:**
   - ✅ Customer exists
   - ✅ Customer ID matches database `stripe_customer_id`
4. **Verify Subscription:**
   - ✅ Subscription exists (Subscriptions tab)
   - ✅ Subscription ID matches database
   - ✅ Status = `trialing` or `active`
   - ✅ Price ID matches database
   - ✅ Trial end = 7 days from creation
   - ✅ Metadata contains `business_id` and `user_id`

#### 6.3: Payment Intents

1. **Go to:** https://dashboard.stripe.com/payments
2. **Filter by:**
   - Customer email: `demo@tithi.com`
   - Or metadata: `business_id` = your business ID
3. **Verify each Payment Intent:**
   - ✅ Status = `Succeeded`
   - ✅ `on_behalf_of` = your Connect account ID
   - ✅ `transfer_data.destination` = your Connect account ID
   - ✅ `application_fee_amount` = 1% of amount
   - ✅ Metadata:
     - `booking_id`
     - `business_id`
     - `money_action` (completed_charge, no_show_fee, cancel_fee)

#### 6.4: Setup Intents

1. **Go to:** https://dashboard.stripe.com/test/setup_intents
2. **Verify:**
   - ✅ All SetupIntents show `Succeeded`
   - ✅ Payment methods saved

#### 6.5: Transfers

1. **Go to:** https://dashboard.stripe.com/connect/transfers
2. **Verify:**
   - ✅ Transfers exist for each charge
   - ✅ Destination = your Connect account
   - ✅ Amount = net amount (after platform fee)

#### 6.6: Refunds

1. **Go to:** https://dashboard.stripe.com/payments/refunds
2. **Verify:**
   - ✅ Refunds exist (if you processed any)
   - ✅ Status = `Succeeded`
   - ✅ Amount matches refund amount

---

## 📋 Complete Verification Checklist

After completing all tests, verify everything:

### Subscription ✅
- [ ] Subscription created with correct price
- [ ] Price matches notifications setting
- [ ] Trial period is 7 days
- [ ] Metadata contains business_id and user_id

### Booking Creation ✅
- [ ] Booking created successfully
- [ ] SetupIntent created
- [ ] Payment method saved

### Money Actions ✅
- [ ] Complete action charges full amount
- [ ] No-Show action charges correct fee
- [ ] Cancel action charges correct fee
- [ ] Refund action processes correctly
- [ ] All charges use Connect destination
- [ ] Platform fee (1%) calculated correctly

### Database ✅
- [ ] All Stripe IDs saved correctly
- [ ] Payment records created for all actions
- [ ] Booking statuses updated correctly
- [ ] Payment statuses updated correctly
- [ ] Fee amounts tracked correctly

### Stripe Dashboard ✅
- [ ] Connect account visible and enabled
- [ ] Customer and subscription visible
- [ ] Payment Intents visible and succeeded
- [ ] Transfers visible with correct amounts
- [ ] Refunds visible (if any)
- [ ] All metadata correct

---

## 🎯 Quick Reference: Your Current Setup

Based on your database:
- **Business:** Urban Clinic k24l
- **Subdomain:** test-9s7v-1764715219148
- **Email:** demo@tithi.com
- **Connect Account:** acct_1SZeE0RpBhfmTDiM
- **Subscription:** Check if exists

**Use these values in all queries and API calls!**

---

**Start with Item 1 and work through each item step by step!**


