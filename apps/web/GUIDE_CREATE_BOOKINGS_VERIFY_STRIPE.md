# Guide: Create Bookings and Verify Payments in Stripe

This guide walks you through creating bookings and verifying payments in Stripe Dashboard.

---

## Prerequisites

Before you start, ensure:
- ✅ Business owner has completed Stripe Connect onboarding (Test 1)
- ✅ Business has an active subscription (Test 2)
- ✅ You have access to:
  - Your production app (admin panel)
  - Stripe Dashboard (live mode)
  - Database access (optional, for verification)

---

## Step 1: Get Business Information

First, you need to know your business subdomain and have a service/staff set up.

### Option A: Through the App UI
1. Log in to your admin panel
2. Note your business subdomain (e.g., `my-business`)
3. Ensure you have at least one active service and staff member

### Option B: Through API/Database
```bash
# Get business subdomain
# Check your database or app configuration
```

---

## Step 2: Create a Booking (Public Booking Flow)

You can create a booking in two ways:

### Method 1: Through the Public Booking Page (Recommended)

1. **Navigate to Public Booking Page:**
   ```
   https://yourdomain.com/[subdomain]
   ```
   Example: `https://yourdomain.com/my-business`

2. **Fill out the booking form:**
   - Select a service
   - Select a staff member
   - Choose a date and time
   - Enter customer details:
     - Name: `Test Customer`
     - Email: `test@example.com` (use your real email for testing)
     - Phone: `+1234567890` (use your real phone for SMS testing)

3. **Complete the booking:**
   - The system will create a SetupIntent to save the card
   - Use a Stripe test card:
     - **Success:** `4242 4242 4242 4242`
     - **Decline:** `4000 0000 0000 0002`
     - **3D Secure:** `4000 0025 0000 3155`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

4. **Submit the booking:**
   - The booking will be created with status `pending`
   - Payment method will be saved
   - You should see a confirmation message

### Method 2: Through API (For Testing)

If you prefer to use the API directly:

```bash
# Set your variables
SUBDOMAIN="your-business-subdomain"
BASE_URL="https://yourdomain.com"  # or http://localhost:3000 for local

# Create booking
curl -X POST "${BASE_URL}/api/public/${SUBDOMAIN}/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "your-service-id",
    "staff_id": "your-staff-id",
    "start_at": "2024-12-20T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }'
```

**Response will include:**
```json
{
  "booking": {
    "id": "booking-id",
    "status": "pending",
    ...
  },
  "setupIntent": {
    "clientSecret": "seti_xxx_secret_xxx",
    "setupIntentId": "seti_xxx"
  }
}
```

**Note:** You'll need to complete the SetupIntent on the frontend using Stripe.js to save the payment method.

---

## Step 3: Complete/Charge the Booking

After creating a booking, you need to charge it. This simulates completing a service.

### Method 1: Through Admin Panel UI

1. **Log in to Admin Panel:**
   ```
   https://yourdomain.com/admin
   ```

2. **Navigate to Bookings:**
   - Go to "Bookings" section
   - Find the booking you just created
   - Click on it to view details

3. **Complete the Booking:**
   - Click "Complete" or "Charge" button
   - Confirm the action
   - The system will create a PaymentIntent and charge the saved card

### Method 2: Through API

```bash
# Set variables
BOOKING_ID="your-booking-id"
ADMIN_TOKEN="your-auth-token"  # Get from browser cookies or session
IDEMPOTENCY_KEY="unique-key-$(date +%s)"  # Must be unique per request

# Complete booking (charge payment)
curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/complete" \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -H "X-Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{}'
```

**Response will include:**
```json
{
  "success": true,
  "paymentIntentId": "pi_xxx",
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

---

## Step 4: Verify Payment in Stripe Dashboard

Now let's verify everything in Stripe Dashboard.

### 4.1: Access Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Live mode** (toggle in top right)
3. Navigate to **Payments** → **Payment Intents**

### 4.2: Find Your Payment Intent

1. **Search for the Payment Intent:**
   - Look for the `paymentIntentId` from the API response (e.g., `pi_xxx`)
   - Or search by customer email: `test@example.com`
   - Or filter by date (today's date)

2. **Click on the Payment Intent** to view details

### 4.3: Verify Payment Intent Details

Check the following in the Payment Intent details:

#### ✅ Basic Information:
- **Status:** Should be `Succeeded` (green checkmark)
- **Amount:** Should match your service price (in cents, e.g., `$100.00` = `10000`)
- **Currency:** Should be `usd`
- **Customer:** Should show the customer email

#### ✅ Connect Account Details:
- **On behalf of:** Should show your connected account ID (e.g., `acct_xxx`)
- **Transfer:** Should show "Transfer to connected account"
- **Destination:** Should match your `stripe_connect_account_id`

#### ✅ Application Fee:
- **Application fee amount:** Should be 1% of the total (e.g., `$100.00` charge = `$1.00` fee = `100` cents)
- **Net amount:** Should be amount minus fee (e.g., `$99.00`)

#### ✅ Metadata:
Click on "Metadata" section and verify:
- `booking_id`: Should match your booking ID
- `business_id`: Should match your business ID
- `money_action`: Should be `completed_charge`
- `user_id`: Should match the business owner's user ID

#### ✅ Payment Method:
- **Card:** Should show the last 4 digits of the test card
- **Type:** Should be `card`
- **Brand:** Should show card brand (e.g., `Visa`)

### 4.4: Verify Transfer to Connected Account

1. **Check the Transfer:**
   - In the Payment Intent details, look for "Transfer" section
   - Click on the transfer link
   - Verify:
     - **Destination:** Your connected account
     - **Amount:** Net amount (after platform fee)
     - **Status:** `Paid` or `Pending`

2. **Check Connected Account Balance:**
   - Go to **Connect** → **Accounts**
   - Find your connected account
   - Check the balance - it should show the transferred amount

### 4.5: Verify Platform Fee

1. **Check Platform Earnings:**
   - Go to **Payments** → **All payments**
   - Find your payment
   - The application fee should be visible in your platform account balance

2. **Check Balance Transactions:**
   - Go to **Balance** → **Transactions**
   - Find the transaction
   - Verify:
     - **Type:** `Charge`
     - **Fee:** Application fee amount
     - **Net:** Amount minus fee

---

## Step 5: Verify Database Records

Verify that the database was updated correctly.

### 5.1: Check Booking Record

```sql
-- Get booking details
SELECT 
  id,
  status,
  payment_status,
  last_money_action,
  final_price_cents,
  created_at,
  updated_at
FROM bookings
WHERE id = 'your-booking-id';
```

**Expected values:**
- `status`: `completed`
- `payment_status`: `charged`
- `last_money_action`: `completed_charge`
- `final_price_cents`: Should match the service price

### 5.2: Check Payment Record

```sql
-- Get payment details
SELECT 
  id,
  booking_id,
  stripe_payment_intent_id,
  amount_cents,
  money_action,
  status,
  stripe_fee_cents,
  created_at
FROM booking_payments
WHERE booking_id = 'your-booking-id'
ORDER BY created_at DESC;
```

**Expected values:**
- `stripe_payment_intent_id`: Should match the Payment Intent ID from Stripe
- `amount_cents`: Should match the service price
- `money_action`: `completed_charge`
- `status`: `charged`
- `stripe_fee_cents`: Should be set (Stripe's processing fee)

### 5.3: Check Customer Record

```sql
-- Get customer details
SELECT 
  id,
  name,
  email,
  phone,
  stripe_customer_id
FROM customers
WHERE email = 'test@example.com';
```

**Expected:**
- Customer should exist
- `stripe_customer_id` should be set (if customer was created in Stripe)

---

## Step 6: Test Other Payment Scenarios

### Test 6.1: No-Show Fee

1. **Mark booking as no-show:**
   ```bash
   curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/no-show" \
     -H "X-Idempotency-Key: no-show-$(date +%s)" \
     -H "Cookie: your-session-cookie"
   ```

2. **Verify in Stripe:**
   - Find the Payment Intent
   - Check metadata: `money_action` should be `no_show_fee`
   - Verify amount matches no-show fee (or 0 if no fee)

3. **Verify in Database:**
   - `bookings.status` should be `no_show`
   - `bookings.last_money_action` should be `no_show_fee`

### Test 6.2: Refund

1. **Process refund:**
   ```bash
   curl -X POST "${BASE_URL}/api/admin/bookings/${BOOKING_ID}/refund" \
     -H "X-Idempotency-Key: refund-$(date +%s)" \
     -H "Cookie: your-session-cookie" \
     -d '{"amount": null}'  # null = full refund, or specify amount for partial
   ```

2. **Verify in Stripe:**
   - Go to **Payments** → **Refunds**
   - Find the refund
   - Verify status is `Succeeded`
   - Verify amount matches refund amount

3. **Verify in Database:**
   - New `booking_payments` record with `money_action: "refund"`
   - `bookings.status` should be `refunded`
   - `bookings.payment_status` should be `refunded`

---

## Step 7: Verify Webhook Processing

After completing a booking, verify that webhooks are being processed.

### 7.1: Check Stripe Webhook Logs

1. **Go to Stripe Dashboard:**
   - Navigate to **Developers** → **Webhooks**
   - Click on your webhook endpoint

2. **Check Recent Events:**
   - Look for `payment_intent.succeeded` event
   - Verify it shows a green checkmark (200 status)
   - Click on the event to see request/response

3. **Verify Event Data:**
   - Check that the event contains your payment intent ID
   - Verify metadata matches your booking

### 7.2: Check Application Logs

Check your application logs for webhook processing:
- Look for "Webhook signature verification" messages
- Look for "Payment intent succeeded" processing
- Verify no errors occurred

### 7.3: Verify Database Updates

After webhook processing, verify:
- `booking_payments.status` is updated to `charged`
- `bookings.payment_status` is updated to `charged`
- `bookings.status` is updated to `completed`
- `stripe_fee_cents` is populated (if available)

---

## Troubleshooting

### Payment Intent Not Created

**Symptoms:**
- No Payment Intent in Stripe Dashboard
- API returns error

**Check:**
1. Verify business has `stripe_connect_account_id` set
2. Verify business subscription is active
3. Check API logs for errors
4. Verify booking has a saved payment method

### Payment Intent Created but Not Succeeded

**Symptoms:**
- Payment Intent exists but status is `requires_action` or `requires_payment_method`

**Solutions:**
1. For test cards requiring 3D Secure, use: `4000 0025 0000 3155`
2. Check Payment Intent details for required action
3. Complete the required action (e.g., 3D Secure authentication)

### Transfer Not Created

**Symptoms:**
- Payment succeeded but no transfer to connected account

**Check:**
1. Verify `on_behalf_of` is set in Payment Intent
2. Verify `transfer_data.destination` is set
3. Verify connected account is active and charges_enabled
4. Check Stripe Dashboard → Connect → Accounts for account status

### Webhook Not Received

**Symptoms:**
- Payment succeeded but database not updated

**Check:**
1. Verify webhook endpoint URL is correct in Stripe Dashboard
2. Verify `STRIPE_WEBHOOK_SECRET` is set correctly
3. Check webhook logs in Stripe Dashboard
4. Verify webhook endpoint is publicly accessible
5. Check application logs for webhook processing errors

---

## Quick Reference: Stripe Test Cards

| Card Number | Scenario | Use Case |
|------------|----------|----------|
| `4242 4242 4242 4242` | Success | Normal successful payment |
| `4000 0000 0000 0002` | Decline | Test declined card |
| `4000 0025 0000 3155` | 3D Secure | Test 3D Secure authentication |
| `4000 0000 0000 9995` | Insufficient Funds | Test insufficient funds |

**All test cards:**
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

---

## Summary Checklist

After completing a booking and charging it, verify:

- [ ] Payment Intent created in Stripe Dashboard
- [ ] Payment Intent status is `Succeeded`
- [ ] `on_behalf_of` is set to connected account
- [ ] `transfer_data.destination` is set to connected account
- [ ] Application fee is calculated correctly (1%)
- [ ] Metadata contains `booking_id`, `business_id`, `money_action`
- [ ] Transfer created to connected account
- [ ] Database: `bookings.status` = `completed`
- [ ] Database: `bookings.payment_status` = `charged`
- [ ] Database: `booking_payments.status` = `charged`
- [ ] Webhook event `payment_intent.succeeded` received
- [ ] Webhook processed successfully (200 status)

---

## Next Steps

After verifying payments work correctly:

1. **Test No-Show Fee:** Mark a booking as no-show and verify fee is charged
2. **Test Refund:** Process a refund and verify it works
3. **Test Webhooks:** Verify all webhook events are processed correctly
4. **Test Email/SMS:** Verify notifications are sent (see other guides)

---

**Need Help?** Check the troubleshooting section or review the Stripe Dashboard logs for detailed error messages.


