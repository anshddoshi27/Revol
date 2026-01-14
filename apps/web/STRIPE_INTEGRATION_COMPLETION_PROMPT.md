# Stripe Integration Completion Prompt
## Production-Ready Payment Flow Implementation

**Context:** This prompt provides complete context for implementing production-ready Stripe integration for Tithi's multi-tenant booking platform. The executor must complete both subscription billing (business owners) and booking payments (customers) with full database synchronization.

---

## 🚨 CRITICAL REQUIREMENT: END-TO-END USER JOURNEY TEST

**BEFORE MARKING AS COMPLETE, YOU MUST:**

Test the complete flow from a NEW user signup through charging their first customer:

1. ✅ **New User Signup** → Account created correctly
2. ✅ **Complete Onboarding** → All data saves correctly (Steps 1-11)
3. ✅ **Stripe Connect Account** → Created and linked to business
4. ✅ **Subscription Creation** → Correct price based on notifications, 7-day trial
5. ✅ **Customer Booking** → Payment method saved (no charge)
6. ✅ **Money Actions** → Complete/No-Show/Cancel/Refund all work correctly
7. ✅ **Fees & Gift Cards** → Calculated and applied correctly
8. ✅ **Database Updates** → All Stripe IDs and statuses saved correctly
9. ✅ **Stripe Dashboard** → All records visible and correct

**This test simulates a real production scenario. If it fails, the integration is NOT production-ready.**

See section "🧪 COMPLETE TESTING WORKFLOW" for detailed step-by-step instructions.

---

## 📋 SESSION SUMMARY & CURRENT STATE

### What Has Been Completed

1. **✅ Production Integration Validation**
   - All three integrations (Stripe, SendGrid, Twilio) validated and confirmed production-ready
   - Environment variables identified and documented
   - Test mocks properly isolated (no leaks into production)
   - Webhook handler implemented with signature verification
   - Notification dispatchers use real API clients

2. **✅ Stripe Client Implementation**
   - `src/lib/stripe.ts` - Complete Stripe client with all helper functions:
     - `createConnectAccount()` - Creates Express accounts
     - `createAccountLink()` - Onboarding flow
     - `createOrGetCustomer()` - Customer management
     - `createSetupIntent()` - Save payment methods
     - `createPaymentIntent()` - Charge payments (with Connect destination)
     - `createSubscription()` - Subscription creation
     - `createRefund()` - Refund processing
     - `verifyConnectAccount()` - Account verification
   - Uses `STRIPE_SECRET_KEY` from environment
   - Creates Express accounts (not OAuth)
   - Uses `accountLinks.create()` for onboarding

3. **✅ Webhook Handler**
   - Route: `/api/webhooks/stripe`
   - Signature verification enabled
   - Handles all required events:
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
     - `setup_intent.succeeded`

4. **✅ Payment Setup Route**
   - Route: `/api/business/onboarding/step-11-payment-setup`
   - Creates Connect account
   - Creates Account Link for onboarding
   - Creates subscription with metadata
   - Handles price selection based on `notifications_enabled`

5. **✅ Booking Creation**
   - Route: `/api/public/{slug}/bookings`
   - Creates bookings with SetupIntent
   - Saves payment methods (no charge yet)
   - Handles gift cards
   - Creates policy snapshots

6. **✅ Money Action Routes**
   - `/api/admin/bookings/{id}/complete` - Charge full amount
   - `/api/admin/bookings/{id}/no-show` - Charge no-show fee
   - `/api/admin/bookings/{id}/cancel` - Charge cancellation fee
   - `/api/admin/bookings/{id}/refund` - Process refunds
   - All use idempotency keys
   - All use off-session charges for saved cards

7. **✅ Database Schema**
   - `businesses` table with Stripe fields:
     - `stripe_connect_account_id`
     - `stripe_customer_id`
     - `stripe_subscription_id`
     - `stripe_price_id`
     - `subscription_status`
     - `notifications_enabled`
     - `next_bill_at`
     - `trial_ends_at`
   - `bookings` table with payment fields
   - `booking_payments` table for payment tracking
   - `business_policies` table for policy snapshots

8. **✅ Test Data Setup**
   - Seed script creates demo business
   - Policies created and working
   - Booking creation tested and working

### What Needs to Be Completed

1. **⚠️ Subscription Billing Logic**
   - Price selection based on `notifications_enabled` flag
   - Proper subscription creation with trial period
   - Webhook handling for subscription state changes
   - Database updates for subscription lifecycle

2. **⚠️ Payment Flow Completion**
   - SetupIntent completion on frontend
   - PaymentIntent creation with correct Connect destination
   - Application fee calculation (1% platform fee)
   - Proper metadata for webhook processing

3. **⚠️ Database Synchronization**
   - Ensure all Stripe events update database correctly
   - Subscription status updates
   - Payment status updates
   - Fee tracking

4. **⚠️ Error Handling**
   - Payment failures
   - 3D Secure requirements
   - Off-session charge failures
   - Webhook processing errors

---

## 🎯 PRIMARY OBJECTIVES

### Objective 1: Complete Subscription Billing Flow

**Context from Frontend Logistics:**
- Each business = $11.99/month subscription
- Multiple businesses = multiple subscriptions (one per business)
- Subscription states: Trial (7 days), Active, Paused, Canceled
- Price varies based on `notifications_enabled`:
  - With notifications: Higher price
  - Without notifications: Lower price
- Trial period: 7 days free
- Subscription must be created during onboarding Step 11

**Implementation Requirements:**

1. **Onboarding Step 11 - Payment Setup (`/api/business/onboarding/step-11-payment-setup`)**
   - ✅ Already creates Connect account
   - ✅ Already creates Account Link
   - ⚠️ **NEEDS FIX:** Subscription creation logic
     - Must check `business.notifications_enabled` (boolean)
     - Select correct price ID:
       - If `notifications_enabled === true`: Use `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
       - If `notifications_enabled === false`: Use `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`
       - Fallback: `STRIPE_PLAN_PRICE_ID` if specific prices not set
     - Create subscription with:
       - 7-day trial period (`trial_period_days: 7`)
       - Metadata: `{ business_id, user_id }`
       - Payment method (if provided during onboarding)
     - Save to database:
       - `stripe_subscription_id`
       - `stripe_price_id` (the actual price used)
       - `subscription_status: 'trial'`
       - `trial_ends_at` (7 days from now)
       - `next_bill_at` (trial end date)

2. **Webhook Handler - Subscription Events**
   - ✅ Already handles `customer.subscription.updated`
   - ✅ Already handles `customer.subscription.deleted`
   - ✅ Already handles `invoice.payment_succeeded`
   - ✅ Already handles `invoice.payment_failed`
   - ⚠️ **VERIFY:** Database updates are correct:
     - Subscription status mapping:
       - `trialing` → `trial`
       - `active` → `active`
       - `past_due` → `paused`
       - `canceled` → `canceled`
       - `incomplete` → `trial` (until payment method added)
     - `next_bill_at` calculation:
       - If `trial_end` exists: Use `trial_end`
       - Otherwise: Use `current_period_end`
     - Subdomain deprovisioning on cancel

3. **Subscription Management (Future - Not MVP)**
   - Pause/Resume functionality
   - Cancel with deprovisioning
   - Upgrade/Downgrade (change price based on notifications toggle)

### Objective 2: Complete Booking Payment Flow

**Context from Frontend Logistics:**
- **CRITICAL RULE:** No charge at booking time - only save payment method
- Charges happen ONLY when admin clicks: Completed, No-Show, or Cancel
- Payment flow:
  1. Customer books → SetupIntent saves card (no charge)
  2. Booking status = `pending`, payment_status = `card_saved`
  3. Admin clicks "Complete" → Create PaymentIntent → Charge full amount
  4. Admin clicks "No-Show" → Create PaymentIntent → Charge no-show fee
  5. Admin clicks "Cancel" → Create PaymentIntent → Charge cancellation fee
  6. Admin clicks "Refund" → Refund previous charge

**Implementation Requirements:**

1. **Booking Creation (`/api/public/{slug}/bookings`)**
   - ✅ Already creates SetupIntent
   - ✅ Already saves booking with `payment_status: 'none'`
   - ⚠️ **VERIFY:** SetupIntent completion flow
     - Frontend must complete SetupIntent using Stripe.js
     - On success, update `booking_payments.status = 'card_saved'`
     - Update `bookings.payment_status = 'card_saved'`

2. **Complete Booking (`/api/admin/bookings/{id}/complete`)**
   - ✅ Already implemented
   - ⚠️ **VERIFY:**
     - Gets saved payment method from SetupIntent
     - Creates PaymentIntent with:
       - `on_behalf_of: connectAccountId`
       - `transfer_data.destination: connectAccountId`
       - `application_fee_amount: round(amount * 0.01)` (1% platform fee)
       - `off_session: true` (for saved cards)
       - Metadata: `{ booking_id, business_id, money_action: 'completed_charge' }`
     - Confirms PaymentIntent
     - Updates database:
       - `booking_payments.status = 'charged'`
       - `bookings.status = 'completed'`
       - `bookings.payment_status = 'charged'`
       - `bookings.last_money_action = 'completed_charge'`

3. **No-Show Fee (`/api/admin/bookings/{id}/no-show`)**
   - ✅ Already implemented
   - ⚠️ **VERIFY:**
     - Calculates fee from `business_policies`:
       - If `no_show_fee_type = 'percent'`: `fee = round(price * no_show_fee_percent / 100)`
       - If `no_show_fee_type = 'amount'`: `fee = no_show_fee_amount_cents`
       - If fee is 0: Just mark as no-show, no charge
     - Creates PaymentIntent with fee amount
     - Metadata: `{ booking_id, business_id, money_action: 'no_show_fee' }`
     - Updates database correctly

4. **Cancellation Fee (`/api/admin/bookings/{id}/cancel`)**
   - ✅ Already implemented
   - ⚠️ **VERIFY:**
     - Calculates fee from `business_policies`:
       - If `cancel_fee_type = 'percent'`: `fee = round(price * cancel_fee_percent / 100)`
       - If `cancel_fee_type = 'amount'`: `fee = cancel_fee_amount_cents`
       - If fee is 0: Just cancel, no charge
     - Creates PaymentIntent with fee amount
     - Metadata: `{ booking_id, business_id, money_action: 'cancel_fee' }`
     - Updates database correctly

5. **Refund (`/api/admin/bookings/{id}/refund`)**
   - ✅ Already implemented
   - ⚠️ **VERIFY:**
     - Checks if payment exists (can't refund if no charge)
     - Creates refund via Stripe
     - Creates new `booking_payments` record with `money_action: 'refund'`
     - Updates `bookings.status = 'refunded'`
     - Handles gift card balance restoration (if enabled)

6. **Gift Card Application**
   - ✅ Already implemented in booking creation
   - ⚠️ **VERIFY:**
     - Gift card validation
     - Balance deduction
     - Final price calculation: `price - gift_card_amount`
     - Refund restores balance (if policy allows)

### Objective 3: Database Synchronization

**Critical Database Updates Required:**

1. **Subscription Lifecycle:**
   ```sql
   -- On subscription creation (onboarding)
   UPDATE businesses SET
     stripe_subscription_id = 'sub_xxx',
     stripe_price_id = 'price_xxx',
     subscription_status = 'trial',
     trial_ends_at = '2025-01-XX',
     next_bill_at = '2025-01-XX'
   WHERE id = 'business_id';

   -- On subscription update (webhook)
   UPDATE businesses SET
     subscription_status = 'active|paused|canceled',
     next_bill_at = '2025-01-XX',
     subdomain = NULL  -- if canceled
   WHERE id = 'business_id';
   ```

2. **Payment Lifecycle:**
   ```sql
   -- On SetupIntent success
   UPDATE booking_payments SET
     status = 'card_saved',
     stripe_setup_intent_id = 'seti_xxx'
   WHERE booking_id = 'booking_id';

   -- On PaymentIntent success
   UPDATE booking_payments SET
     status = 'charged',
     stripe_payment_intent_id = 'pi_xxx',
     amount_cents = 10000,
     stripe_fee_cents = 320  -- from Stripe balance transaction
   WHERE booking_id = 'booking_id';

   UPDATE bookings SET
     status = 'completed|no_show|cancelled',
     payment_status = 'charged',
     last_money_action = 'completed_charge|no_show_fee|cancel_fee'
   WHERE id = 'booking_id';

   -- On refund
   INSERT INTO booking_payments (
     booking_id, money_action, status, 
     stripe_refund_id, amount_cents
   ) VALUES (...);
   ```

---

## 🔧 TECHNICAL SPECIFICATIONS

### Environment Variables (`.env` in `apps/web/`)

**Required for Production:**
```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...                    # Live mode key
STRIPE_WEBHOOK_SECRET=whsec_...                  # Webhook signing secret
NEXT_PUBLIC_APP_URL=https://yourdomain.com       # Production URL
STRIPE_PLAN_PRICE_ID=price_...                   # Fallback subscription price
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_... # Price with notifications
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_... # Price without notifications

# SendGrid
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890
```

### Stripe Connect Account Flow

1. **During Onboarding Step 11:**
   - Create Express account: `stripe.accounts.create({ type: 'express' })`
   - Save `account.id` to `businesses.stripe_connect_account_id`
   - Create Account Link: `stripe.accountLinks.create({ type: 'account_onboarding' })`
   - Redirect user to Account Link URL
   - User completes Stripe onboarding
   - User returns to app with `connectAccountId` in query params
   - Verify account: Check `account.details_submitted && account.charges_enabled`
   - Proceed to subscription creation

2. **Subscription Creation:**
   - Get or create Stripe Customer for business owner
   - Determine price ID based on `notifications_enabled`
   - Create subscription:
     ```typescript
     stripe.subscriptions.create({
       customer: customerId,
       items: [{ price: priceId }],
       trial_period_days: 7,
       metadata: { business_id, user_id },
       payment_behavior: 'default_incomplete'  // Until payment method added
     })
     ```
   - Save subscription ID and status to database

### Payment Intent Creation (Booking Charges)

**For Complete/No-Show/Cancel actions:**

```typescript
stripe.paymentIntents.create({
  amount: finalAmountCents,  // After gift card deduction
  currency: 'usd',
  customer: customerId,
  payment_method: savedPaymentMethodId,
  on_behalf_of: connectAccountId,
  transfer_data: {
    destination: connectAccountId,
  },
  application_fee_amount: Math.round(finalAmountCents * 0.01),  // 1% platform fee
  off_session: true,  // For saved cards
  confirm: true,
  metadata: {
    booking_id: bookingId,
    business_id: businessId,
    money_action: 'completed_charge' | 'no_show_fee' | 'cancel_fee',
    user_id: userId,
  },
})
```

### Webhook Processing

**Critical Webhook Events:**

1. **`payment_intent.succeeded`:**
   - Find booking by `metadata.booking_id`
   - Update `booking_payments.status = 'charged'`
   - Update `bookings.status` based on `metadata.money_action`
   - Update `bookings.payment_status = 'charged'`
   - Fetch fee from balance transaction if available

2. **`charge.refunded`:**
   - Find booking by payment intent ID
   - Create refund record in `booking_payments`
   - Update `bookings.status = 'refunded'`
   - Restore gift card balance if applicable

3. **`customer.subscription.updated`:**
   - Find business by `metadata.business_id`
   - Update `subscription_status` based on Stripe status
   - Update `next_bill_at` from `current_period_end` or `trial_end`
   - If canceled: Deprovision subdomain

---

## 📚 REFERENCE DOCUMENTATION

### Primary Reference: `docs/frontend/frontend logistics.txt`

**Key Points:**
- No charge at booking time - only save card
- Charges happen ONLY when admin clicks money action buttons
- Platform fee: 1% on all charges
- Subscription: $11.99/month per business
- Price varies based on notifications enabled/disabled
- Trial: 7 days free
- Subscription states: Trial, Active, Paused, Canceled

**Money Action Buttons:**
- **Completed** → Charge full booking amount
- **No-Show** → Charge no-show fee (from policies)
- **Cancelled** → Charge cancellation fee (from policies)
- **Refund** → Refund previous charge (if exists)

**Payment Flow:**
1. Customer books → SetupIntent saves card
2. Booking = `pending`, payment = `card_saved`
3. Admin clicks action → PaymentIntent created → Charge happens
4. Webhook updates database

### Additional References

- `PRODUCTION_INTEGRATION_VALIDATION_REPORT.md` - Complete validation details
- `PRODUCTION_SMOKE_TEST_PLAN.md` - Testing procedures
- `GUIDE_CREATE_BOOKINGS_VERIFY_STRIPE.md` - Manual testing guide
- `GUIDE_TEST_AS_CUSTOMER.md` - Customer testing flow

---

## ✅ ACCEPTANCE CRITERIA

### Subscription Billing

- [ ] Onboarding Step 11 creates subscription with correct price based on `notifications_enabled`
- [ ] Subscription has 7-day trial period
- [ ] Subscription metadata includes `business_id` and `user_id`
- [ ] Database correctly stores subscription ID, price ID, status, trial end, next bill date
- [ ] Webhook updates subscription status correctly
- [ ] Webhook updates `next_bill_at` correctly
- [ ] Canceled subscriptions deprovision subdomain
- [ ] Subscription status badges show correct state in UI

### Booking Payments

- [ ] Booking creation saves payment method (no charge)
- [ ] SetupIntent completion updates database
- [ ] Complete action charges full amount with 1% platform fee
- [ ] No-Show action charges correct fee (from policies)
- [ ] Cancel action charges correct fee (from policies)
- [ ] Refund action refunds previous charge
- [ ] All charges use Connect destination
- [ ] All charges include correct metadata
- [ ] Database updates correctly for all actions
- [ ] Webhooks update database correctly
- [ ] Gift cards apply correctly
- [ ] Gift card balances restore on refund (if enabled)

### Database Synchronization

- [ ] All Stripe events update database
- [ ] Payment statuses are accurate
- [ ] Subscription statuses are accurate
- [ ] Fee tracking is accurate
- [ ] No orphaned records
- [ ] All foreign keys maintained

### Error Handling

- [ ] Payment failures handled gracefully
- [ ] 3D Secure requirements handled
- [ ] Off-session failures create "Send Pay Link" option
- [ ] Webhook processing errors logged
- [ ] Idempotency prevents double-charges
- [ ] Retry logic for failed webhooks

---

## 🚀 IMPLEMENTATION STEPS

### Step 1: Review Current Implementation

1. Read `src/lib/stripe.ts` - Understand all helper functions
2. Read `src/app/api/business/onboarding/step-11-payment-setup/route.ts` - Review subscription creation
3. Read `src/app/api/admin/bookings/[id]/complete/route.ts` - Review payment charging
4. Read `src/app/api/webhooks/stripe/route.ts` - Review webhook handling
5. Read `docs/frontend/frontend logistics.txt` - Understand business logic

### Step 2: Fix Subscription Creation

1. **Update Step 11 route:**
   - Ensure `notifications_enabled` is checked correctly
   - Select correct price ID based on flag
   - Create subscription with trial period
   - Save all subscription data to database

2. **Test subscription creation:**
   - Create business with notifications enabled → Should use higher price
   - Create business with notifications disabled → Should use lower price
   - Verify trial period is 7 days
   - Verify metadata is correct

### Step 3: Verify Payment Flow

1. **Test booking creation:**
   - Create booking via API:
     ```bash
     curl -X POST http://localhost:3000/api/public/demo/bookings \
       -H "Content-Type: application/json" \
       -d '{
         "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
         "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
         "start_at": "2025-01-15T10:00:00Z",
         "customer": {
           "name": "Test Customer",
           "email": "test@example.com",
           "phone": "+1234567890"
         }
       }'
     ```
   - Response includes `client_secret` and `setup_intent_id`
   - Verify SetupIntent is created in Stripe Dashboard
   - **Complete SetupIntent (save payment method):**
     - Use the `client_secret` from the response
     - Complete it via Stripe.js on the frontend, OR
     - For testing: Use Stripe Dashboard to test the SetupIntent
     - Verify database updates:
       - `booking_payments.status = 'card_saved'`
       - `bookings.payment_status = 'card_saved'`

2. **Test money actions (Complete booking as business owner):**
   - **Log in as business owner:**
     - URL: `http://localhost:3000/login`
     - Email: `demo@tithi.com`
     - Password: `Tithi2025$Demo`
   - **Navigate to Bookings:**
     - Go to Bookings section in admin panel
     - Find the booking you just created
     - Click "Complete" button
   - **This will charge the payment and test Stripe integration**
   - **Verify in Stripe Dashboard:**
     - Go to Stripe Dashboard → Payments → Payment Intents
     - Find the Payment Intent for your booking
     - Verify payment status is "succeeded"
     - Verify `on_behalf_of` is set to connected account ID
     - Verify `transfer_data.destination` is connected account ID
     - Verify `application_fee_amount` is set (1% of amount)
     - Verify metadata contains `booking_id`, `business_id`, `money_action: 'completed_charge'`
   - **Verify database updates:**
     - `booking_payments.status = 'charged'`
     - `bookings.status = 'completed'`
     - `bookings.payment_status = 'charged'`
     - `bookings.last_money_action = 'completed_charge'`

3. **Test other money actions:**
   - **No-show booking:**
     - Mark booking as no-show
     - Verify fee is charged (from policies)
     - Verify in Stripe Dashboard
     - Verify database updates
   - **Cancel booking:**
     - Cancel booking
     - Verify cancellation fee is charged (from policies)
     - Verify in Stripe Dashboard
     - Verify database updates
   - **Refund booking:**
     - Process refund
     - Verify refund in Stripe Dashboard
     - Verify refund record in database
     - Verify booking status = 'refunded'

4. **Test webhooks:**
   - Trigger webhook events (or wait for real events)
   - Verify database updates
   - Verify status changes
   - Check webhook logs in Stripe Dashboard

### Step 4: Database Synchronization

1. **Verify all database updates:**
   - Subscription lifecycle updates
   - Payment lifecycle updates
   - Fee tracking
   - Status changes

2. **Test edge cases:**
   - Payment failures
   - Webhook failures
   - Missing data
   - Invalid states

### Step 5: Production Readiness

1. **Environment variables:**
   - Verify all required vars are documented
   - Test with production-like values
   - Verify webhook secret is set

2. **Error handling:**
   - Test all error paths
   - Verify error messages are clear
   - Verify logging is adequate

3. **Testing:**
   - Run smoke tests
   - Test with real Stripe test mode
   - Verify webhook processing
   - Test subscription lifecycle

---

## 🎯 SUCCESS METRICS

### Functional Requirements

- ✅ Business owner can complete onboarding and create subscription
- ✅ Subscription is created with correct price based on notifications
- ✅ Subscription has 7-day trial
- ✅ Customer can create booking (card saved, no charge)
- ✅ Admin can complete booking (charge happens)
- ✅ Admin can mark no-show (fee charged)
- ✅ Admin can cancel booking (fee charged)
- ✅ Admin can refund booking
- ✅ All charges go to Connect account
- ✅ Platform fee (1%) is deducted
- ✅ Database is updated correctly for all actions
- ✅ Webhooks process correctly

### Technical Requirements

- ✅ All Stripe API calls use correct parameters
- ✅ All database updates are atomic
- ✅ Idempotency keys prevent double-charges
- ✅ Error handling is comprehensive
- ✅ Logging is adequate for debugging
- ✅ Webhook signature verification works
- ✅ Metadata is correct for all operations

---

## 📝 NOTES FOR EXECUTOR

### Critical Rules

1. **NO CHARGE AT BOOKING TIME** - Only save payment method
2. **Charges happen ONLY on admin action** - Complete, No-Show, Cancel
3. **Platform fee is 1%** - Applied to all charges
4. **Subscription price varies** - Based on `notifications_enabled` flag
5. **Trial is 7 days** - Free period before billing starts
6. **All charges use Connect** - Destination charges to business account

### Database Fields to Update

**Businesses table:**
- `stripe_connect_account_id` - Set during onboarding
- `stripe_customer_id` - Set during onboarding
- `stripe_subscription_id` - Set during onboarding
- `stripe_price_id` - Set during onboarding (the actual price used)
- `subscription_status` - Updated via webhooks
- `notifications_enabled` - Used to select price
- `next_bill_at` - Updated via webhooks
- `trial_ends_at` - Set during subscription creation

**Bookings table:**
- `status` - Updated on money actions
- `payment_status` - Updated on payment events
- `last_money_action` - Set on money actions

**Booking_payments table:**
- Created for each payment event
- Tracks SetupIntent, PaymentIntent, Refund IDs
- Tracks amounts and fees

### Testing Checklist

Before considering complete:

**Subscription Testing:**
- [ ] Create business with notifications enabled → Subscription uses higher price
- [ ] Create business with notifications disabled → Subscription uses lower price
- [ ] Verify subscription has 7-day trial period
- [ ] Verify subscription metadata is correct
- [ ] Verify database stores subscription data correctly

**Booking Payment Testing:**
- [ ] Create booking → Card saved, no charge
- [ ] Complete SetupIntent using `client_secret` from response
- [ ] Verify SetupIntent completion updates database
- [ ] Log in as business owner (`demo@tithi.com` / `Tithi2025$Demo`)
- [ ] Navigate to Bookings → Find booking → Click "Complete"
- [ ] Verify payment charged in Stripe Dashboard
- [ ] Verify transfer to connected account
- [ ] Verify application fee (1% platform fee)
- [ ] Verify database updates correctly
- [ ] Complete booking → Full amount charged
- [ ] No-show booking → Fee charged
- [ ] Cancel booking → Fee charged
- [ ] Refund booking → Refund processed
- [ ] Webhook updates database correctly
- [ ] All fees calculated correctly
- [ ] Gift cards apply correctly
- [ ] Database stays consistent

**Stripe Dashboard Verification:**
- [ ] Payment Intent created and succeeded
- [ ] `on_behalf_of` set to connected account
- [ ] `transfer_data.destination` set to connected account
- [ ] `application_fee_amount` calculated correctly (1% of amount)
- [ ] Metadata contains all required fields
- [ ] Transfer created to connected account
- [ ] Refunds appear in Stripe Dashboard

---

## 🔍 DEBUGGING TIPS

### Common Issues

1. **Subscription not created:**
   - Check `notifications_enabled` value
   - Verify price IDs are set in env
   - Check Stripe API response

2. **Payment not charging:**
   - Verify Connect account is active
   - Check payment method is saved
   - Verify off-session flag
   - Check application fee calculation

3. **Webhook not updating:**
   - Verify webhook secret
   - Check signature verification
   - Verify metadata is correct
   - Check database query

4. **Database not updating:**
   - Check transaction isolation
   - Verify foreign keys
   - Check error logs
   - Verify webhook processing

---

## 🧪 COMPLETE TESTING WORKFLOW

### ⚠️ CRITICAL: End-to-End User Journey Testing

**MANDATORY TEST:** You MUST test the complete user journey from signup to charging customers. This simulates a real production scenario and ensures everything works correctly.

### 🚀 AUTOMATED TESTING SCRIPT AVAILABLE

**Good News:** There's an automated script that simulates the entire onboarding flow!

**Run the automated test:**
```bash
cd apps/web
npm run test:onboarding-flow
```

This script:
- ✅ Creates a new user account automatically
- ✅ Simulates all 11 onboarding steps (direct database operations)
- ✅ Creates Stripe Connect account
- ✅ Creates subscription with correct price
- ✅ Creates test booking
- ✅ Verifies all database updates

**What it does:**
- Uses Supabase admin client to bypass auth
- Directly creates all onboarding data
- Calls Stripe APIs to create Connect account and subscription
- Creates a test booking
- Verifies all data is saved correctly

**What you still need to do manually:**
1. Complete Stripe Connect onboarding (one-time, via Account Link)
2. Complete SetupIntent (to save payment method)
3. Test money actions via admin panel (Complete/No-Show/Cancel/Refund)

**This script eliminates the need to manually click through the UI for onboarding!**

**Why This Test is Critical:**
- Verifies user signup creates account correctly
- Verifies onboarding saves all data correctly
- Verifies Stripe Connect account is created and linked properly
- Verifies subscription is created with correct price based on notifications
- Verifies business can charge customers correctly
- Verifies fees, gift cards, and money actions work correctly
- Verifies all database updates are accurate

**This test MUST be completed before considering the integration production-ready.**

### Test Scenario: New User Signup → Onboarding → Charging Customers

**Objective:** Verify that when a new user signs up, completes onboarding, and starts accepting bookings, all Stripe integrations work correctly:
- User account is created
- Business data saves correctly
- Stripe Connect account is created and linked
- Subscription is created with correct price
- Customer bookings work
- Money actions charge correctly with fees and gift cards
- All database updates are accurate

---

### Phase 1: User Signup & Account Creation

**Test Steps:**

1. **Create a new user account:**
   - Navigate to: `http://localhost:3000/signup`
   - Fill out signup form:
     - Email: `newuser@test.com` (use a NEW email, not demo@tithi.com)
     - Password: `TestPassword123!`
     - Name: `Test User`
     - Last Name: `Lastname`
   - Submit signup

2. **Verify user account creation:**
   ```sql
   -- Check users table
   SELECT id, email, name, created_at 
   FROM users 
   WHERE email = 'newuser@test.com';
   -- Should show: New user record created
   ```

3. **Verify onboarding starts:**
   - Should redirect to onboarding Step 1
   - User should be logged in
   - Session should be active

**Expected Results:**
- ✅ User account created in database
- ✅ User is logged in
- ✅ Onboarding flow starts
- ✅ No errors in console/logs

---

### Phase 2: Complete Onboarding (Steps 1-11)

**Test Steps:**

1. **Step 1: Business Basics**
   - Business Name: `Test Business`
   - Description: `A test business for Stripe integration`
   - DBA: `Test Business LLC`
   - Legal Name: `Test Business LLC`
   - Industry: Select any
   - Save and continue

2. **Step 2: Booking Website**
   - Subdomain: `test-business` (or any available subdomain)
   - Verify subdomain is available
   - Save and continue

3. **Step 3: Location & Contacts**
   - Timezone: `America/New_York`
   - Phone: `+15551234567`
   - Support Email: `support@testbusiness.com`
   - Website: `https://testbusiness.com`
   - Address: Fill out complete address
   - Save and continue

4. **Step 4: Team**
   - Add at least one staff member:
     - Name: `John Staff`
     - Role: `Service Provider`
     - Color: Any
   - Save and continue

5. **Step 5: Branding**
   - Upload logo (or skip)
   - Brand Color: `#4ECDC4`
   - Save and continue

6. **Step 6: Services & Categories**
   - Create at least one category:
     - Name: `Test Category`
     - Description: `Test category`
     - Color: `#FF6B6B`
   - Add at least one service:
     - Name: `Test Service`
     - Description: `A test service`
     - Duration: `60` minutes
     - Price: `$100.00` (10000 cents)
     - Instructions: `Test instructions`
   - Save and continue

7. **Step 7: Availability**
   - Select the service you created
   - Select the staff member
   - Set availability (e.g., Monday-Friday, 9 AM - 5 PM)
   - Save and continue

8. **Step 8: Notifications**
   - Create at least one notification template (optional for this test)
   - **IMPORTANT:** Note whether you enable notifications or not
   - Save and continue

9. **Step 9: Policies**
   - Cancellation Policy: `Test cancellation policy`
   - No-Show Policy: `Test no-show policy`
   - No-Show Fee: `50%` (percent)
   - Cancel Fee: `25%` (percent)
   - Refund Policy: `Test refund policy`
   - Save and continue

10. **Step 10: Gift Cards (Optional)**
    - Skip or create a test gift card
    - Save and continue

11. **Step 11: Payment Setup (CRITICAL TEST)**
    - **This is where Stripe Connect account is created**
    - Enter email: `newuser@test.com`
    - Click "Connect Stripe Account" or similar
    - **Verify:**
      - Stripe Connect account is created
      - Account Link URL is generated
      - Redirect to Stripe onboarding works

    - **Complete Stripe Connect Onboarding:**
      - Use Stripe test mode
      - Complete the Stripe onboarding form
      - Return to your app

    - **Verify Stripe Connect Account:**
      ```sql
      -- Check business record
      SELECT 
        id, 
        name, 
        subdomain,
        stripe_connect_account_id,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        subscription_status,
        notifications_enabled,
        trial_ends_at,
        next_bill_at
      FROM businesses 
      WHERE user_id = (SELECT id FROM users WHERE email = 'newuser@test.com');
      ```

    - **Verify in Stripe Dashboard:**
      - Go to Stripe Dashboard → Connect → Accounts
      - Find the account (search by email: `newuser@test.com`)
      - Verify:
        - Account type = `Express` ✅
        - Account status = `Active` or `Onboarding complete` ✅
        - Account ID matches `businesses.stripe_connect_account_id` ✅

    - **Verify Subscription Creation:**
      - Check Stripe Dashboard → Customers
      - Find customer (email: `newuser@test.com`)
      - Check Subscriptions tab
      - Verify:
        - Subscription exists ✅
        - Status = `trialing` or `incomplete` ✅
        - Trial end = 7 days from now ✅
        - Price ID matches `businesses.stripe_price_id` ✅
        - Metadata contains `business_id` and `user_id` ✅

    - **Verify Price Selection:**
      - Check `businesses.notifications_enabled` value
      - Check `businesses.stripe_price_id` value
      - Verify:
        - If `notifications_enabled = true`: Price should be `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
        - If `notifications_enabled = false`: Price should be `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`

    - **Verify Database:**
      ```sql
      -- All these should be set:
      SELECT 
        stripe_connect_account_id IS NOT NULL as has_connect_account,
        stripe_customer_id IS NOT NULL as has_customer_id,
        stripe_subscription_id IS NOT NULL as has_subscription,
        stripe_price_id IS NOT NULL as has_price_id,
        subscription_status = 'trial' as is_trial,
        trial_ends_at IS NOT NULL as has_trial_end,
        next_bill_at IS NOT NULL as has_next_bill
      FROM businesses 
      WHERE user_id = (SELECT id FROM users WHERE email = 'newuser@test.com');
      -- All should return true
      ```

**Expected Results:**
- ✅ All onboarding data saved correctly
- ✅ Stripe Connect account created
- ✅ Connect account linked to business
- ✅ Subscription created with correct price
- ✅ Trial period set to 7 days
- ✅ Database has all Stripe IDs
- ✅ Price selected based on `notifications_enabled`

---

### Phase 3: Customer Booking Flow

**Test Steps:**

1. **Access Public Booking Page:**
   - Navigate to: `http://localhost:3000/test-business` (or your subdomain)
   - Verify business info displays correctly
   - Verify services are listed

2. **Create a Booking:**
   ```bash
   # Get catalog first
   curl http://localhost:3000/api/public/test-business/catalog | jq
   
   # Create booking (use service_id and staff_id from catalog)
   curl -X POST http://localhost:3000/api/public/test-business/bookings \
     -H "Content-Type: application/json" \
     -d '{
       "service_id": "YOUR_SERVICE_ID",
       "staff_id": "YOUR_STAFF_ID",
       "start_at": "2025-01-20T10:00:00Z",
       "customer": {
         "name": "Customer Name",
         "email": "customer@example.com",
         "phone": "+1987654321"
       }
     }' | jq
   ```

3. **Verify Booking Created:**
   ```sql
   -- Check booking
   SELECT 
     id, 
     status, 
     payment_status,
     final_price_cents,
     stripe_setup_intent_id
   FROM bookings 
   WHERE business_id = (SELECT id FROM businesses WHERE subdomain = 'test-business')
   ORDER BY created_at DESC 
   LIMIT 1;
   -- Should show: status = 'pending', payment_status = 'none', setup_intent_id set
   ```

4. **Complete SetupIntent (Save Payment Method):**
   - Use the `client_secret` from booking response
   - Complete via Stripe.js frontend OR Stripe Dashboard
   - **Verify:**
     - SetupIntent status = `succeeded` in Stripe Dashboard
     - Database: `booking_payments.status = 'card_saved'`
     - Database: `bookings.payment_status = 'card_saved'`

**Expected Results:**
- ✅ Booking created successfully
- ✅ SetupIntent created
- ✅ Payment method saved (no charge yet)
- ✅ Database updated correctly

---

### Phase 4: Money Actions (Charge Customers)

**Test Steps:**

1. **Log in as Business Owner:**
   - Navigate to: `http://localhost:3000/login`
   - Email: `newuser@test.com`
   - Password: `TestPassword123!`
   - Should log in successfully

2. **Navigate to Bookings:**
   - Go to Bookings section
   - Find the booking you just created
   - Verify booking details are correct

3. **Test Complete Action (Charge Full Amount):**
   - Click "Complete" button
   - **Verify in Stripe Dashboard:**
     - Go to Payments → Payment Intents
     - Find the Payment Intent (search by booking ID in metadata)
     - Verify:
       - Status = `succeeded` ✅
       - Amount = `10000` cents ($100.00) ✅
       - `on_behalf_of` = Connect account ID ✅
       - `transfer_data.destination` = Connect account ID ✅
       - `application_fee_amount` = `100` cents (1% of 10000) ✅
       - Metadata: `booking_id`, `business_id`, `money_action: 'completed_charge'` ✅
   - **Verify Transfer:**
     - Click transfer link
     - Verify destination = Connect account
     - Verify amount = `9900` cents (10000 - 100 platform fee)
   - **Verify Database:**
     ```sql
     -- Check booking payment
     SELECT 
       status, 
       stripe_payment_intent_id, 
       amount_cents,
       stripe_fee_cents
     FROM booking_payments 
     WHERE booking_id = 'YOUR_BOOKING_ID';
     -- Should show: status = 'charged', payment_intent_id set, amount_cents = 10000
     
     -- Check booking
     SELECT 
       status, 
       payment_status, 
       last_money_action
     FROM bookings 
       WHERE id = 'YOUR_BOOKING_ID';
     -- Should show: status = 'completed', payment_status = 'charged', last_money_action = 'completed_charge'
     ```

4. **Test No-Show Action (Charge Fee):**
   - Create another booking
   - Complete SetupIntent
   - Click "No-Show" button
   - **Verify:**
     - Fee calculated: 50% of $100 = $50 (5000 cents)
     - Payment Intent created with amount = 5000 cents
     - Application fee = 50 cents (1% of 5000)
     - Database: `bookings.status = 'no_show'`, `last_money_action = 'no_show_fee'`
     - Database: `booking_payments.amount_cents = 5000`

5. **Test Cancel Action (Charge Fee):**
   - Create another booking
   - Complete SetupIntent
   - Click "Cancel" button
   - **Verify:**
     - Fee calculated: 25% of $100 = $25 (2500 cents)
     - Payment Intent created with amount = 2500 cents
     - Application fee = 25 cents (1% of 2500)
     - Database: `bookings.status = 'cancelled'`, `last_money_action = 'cancel_fee'`
     - Database: `booking_payments.amount_cents = 2500`

6. **Test Refund Action:**
   - Find a completed booking (one that was charged)
   - Click "Refund" button
   - **Verify:**
     - Refund created in Stripe Dashboard → Payments → Refunds
     - Refund amount matches original charge
     - Database: New `booking_payments` record with `money_action = 'refund'`
     - Database: `bookings.status = 'refunded'`

7. **Test Gift Card Application:**
   - Create a booking with gift card code
   - **Verify:**
     - Gift card balance deducted
     - Final price = service price - gift card amount
     - Charge amount = final price (not full service price)
   - Complete the booking
   - **Verify:**
     - Payment Intent amount = final price (after gift card)
     - Application fee = 1% of final price
     - Gift card balance updated correctly

**Expected Results:**
- ✅ All money actions work correctly
- ✅ Fees calculated correctly (from policies)
- ✅ Platform fee (1%) applied correctly
- ✅ Charges go to Connect account
- ✅ Transfers work correctly
- ✅ Database updates correctly
- ✅ Gift cards apply correctly

---

### Phase 5: Subscription Lifecycle Verification

**Test Steps:**

1. **Verify Trial Period:**
   - Check `businesses.trial_ends_at` in database
   - Should be 7 days from subscription creation
   - Check Stripe Dashboard → Subscriptions
   - Verify trial end date matches

2. **Simulate Subscription Webhook Events:**
   - Use Stripe CLI or Dashboard to trigger:
     - `customer.subscription.updated` (trial → active)
     - `invoice.payment_succeeded`
   - **Verify Database Updates:**
     ```sql
     -- After webhook processes
     SELECT 
       subscription_status,
       next_bill_at,
       trial_ends_at
     FROM businesses 
     WHERE stripe_subscription_id = 'YOUR_SUBSCRIPTION_ID';
     -- Should show correct status and dates
     ```

3. **Verify Subscription Metadata:**
   - Check Stripe Dashboard → Subscriptions
   - Click on subscription
   - Verify metadata contains:
     - `business_id` ✅
     - `user_id` ✅

**Expected Results:**
- ✅ Trial period is 7 days
- ✅ Webhooks update database correctly
- ✅ Subscription metadata is correct
- ✅ Status transitions work correctly

---

### Phase 6: Database Integrity Check

**Final Verification:**

Run these queries to verify all data is correct:

```sql
-- 1. Verify user and business relationship
SELECT 
  u.email,
  u.name,
  b.name as business_name,
  b.subdomain,
  b.stripe_connect_account_id IS NOT NULL as has_connect,
  b.stripe_subscription_id IS NOT NULL as has_subscription,
  b.subscription_status
FROM users u
JOIN businesses b ON b.user_id = u.id
WHERE u.email = 'newuser@test.com';

-- 2. Verify all bookings have payment records
SELECT 
  b.id as booking_id,
  b.status,
  b.payment_status,
  bp.status as payment_record_status,
  bp.stripe_payment_intent_id,
  bp.amount_cents
FROM bookings b
LEFT JOIN booking_payments bp ON bp.booking_id = b.id
WHERE b.business_id = (SELECT id FROM businesses WHERE subdomain = 'test-business')
ORDER BY b.created_at DESC;

-- 3. Verify Stripe IDs are consistent
SELECT 
  b.stripe_connect_account_id,
  b.stripe_customer_id,
  b.stripe_subscription_id,
  b.stripe_price_id,
  COUNT(DISTINCT bp.stripe_payment_intent_id) as payment_count
FROM businesses b
LEFT JOIN bookings bk ON bk.business_id = b.id
LEFT JOIN booking_payments bp ON bp.booking_id = bk.id
WHERE b.subdomain = 'test-business'
GROUP BY b.id;

-- 4. Verify subscription data
SELECT 
  subscription_status,
  notifications_enabled,
  stripe_price_id,
  trial_ends_at,
  next_bill_at,
  CASE 
    WHEN trial_ends_at IS NOT NULL THEN 'Has trial'
    ELSE 'No trial'
  END as trial_status
FROM businesses
WHERE subdomain = 'test-business';
```

**Expected Results:**
- ✅ All relationships are correct
- ✅ All bookings have payment records
- ✅ Stripe IDs are consistent
- ✅ Subscription data is complete

---

### Phase 7: Stripe Dashboard Verification

**Complete Stripe Dashboard Audit:**

1. **Connect Account:**
   - Go to Connect → Accounts
   - Find account for `newuser@test.com`
   - Verify:
     - Account is active ✅
     - Can receive transfers ✅
     - Account ID matches database ✅

2. **Customer & Subscription:**
   - Go to Customers
   - Find customer for `newuser@test.com`
   - Verify:
     - Customer exists ✅
     - Has active subscription ✅
     - Subscription has correct price ✅
     - Subscription has metadata ✅
     - Trial period is 7 days ✅

3. **Payment Intents:**
   - Go to Payments → Payment Intents
   - Filter by customer or metadata
   - Verify:
     - All money actions created Payment Intents ✅
     - All succeeded ✅
     - All have correct `on_behalf_of` ✅
     - All have correct `application_fee_amount` ✅
     - All have correct metadata ✅

4. **Transfers:**
   - Go to Connect → Transfers
   - Verify:
     - Transfers created for each charge ✅
     - Amounts are correct (after platform fee) ✅
     - Destinations are correct ✅

5. **Refunds:**
   - Go to Payments → Refunds
   - Verify:
     - Refunds exist for refunded bookings ✅
     - Amounts are correct ✅

---

### ✅ COMPLETE TEST CHECKLIST

Before considering the integration complete, verify ALL of these:

**User & Business Setup:**
- [ ] New user can sign up
- [ ] User account created in database
- [ ] Onboarding flow works end-to-end
- [ ] All business data saves correctly
- [ ] Business record has all required fields

**Stripe Connect:**
- [ ] Connect account created during onboarding
- [ ] Connect account is Express type
- [ ] Connect account is active and can receive payments
- [ ] Connect account ID saved to database
- [ ] Account Link onboarding flow works

**Subscription:**
- [ ] Subscription created with correct price (based on notifications)
- [ ] Subscription has 7-day trial
- [ ] Subscription metadata includes business_id and user_id
- [ ] Subscription status saved to database
- [ ] Trial end date saved to database
- [ ] Next bill date saved to database
- [ ] Price ID saved to database

**Customer Bookings:**
- [ ] Customer can create booking (no login required)
- [ ] SetupIntent created correctly
- [ ] Payment method saved (no charge)
- [ ] Booking status = 'pending'
- [ ] Payment status = 'card_saved' (after SetupIntent)

**Money Actions:**
- [ ] Complete action charges full amount correctly
- [ ] No-Show action charges correct fee (from policies)
- [ ] Cancel action charges correct fee (from policies)
- [ ] Refund action refunds correctly
- [ ] All charges use Connect destination
- [ ] All charges include 1% platform fee
- [ ] All charges include correct metadata

**Fees & Calculations:**
- [ ] Platform fee (1%) calculated correctly
- [ ] No-show fee calculated correctly (from policies)
- [ ] Cancellation fee calculated correctly (from policies)
- [ ] Gift cards apply correctly
- [ ] Final price = service price - gift card
- [ ] Charges use final price (not full service price)

**Database Updates:**
- [ ] All Stripe IDs saved correctly
- [ ] Payment records created for all actions
- [ ] Booking statuses update correctly
- [ ] Payment statuses update correctly
- [ ] Fee amounts tracked correctly
- [ ] Webhook events update database

**Stripe Dashboard:**
- [ ] Connect account visible and active
- [ ] Customer and subscription visible
- [ ] Payment Intents visible and succeeded
- [ ] Transfers visible and correct amounts
- [ ] Refunds visible (if any)
- [ ] All metadata correct

---

### End-to-End Test Flow

**Prerequisites:**
- Business owner account exists: `demo@tithi.com` / `Tithi2025$Demo`
- Business "Demo Salon" with subdomain `demo` exists
- Stripe test mode keys configured
- Stripe CLI running for webhook forwarding (if testing locally)

**Step 1: Create Booking as Customer (No Login Required)**

```bash
# Create booking via API
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
    "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
    "start_at": "2025-01-15T10:00:00Z",
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
  "booking_id": "xxx",
  "booking_code": "TITHI-XXX",
  "client_secret": "seti_xxx_secret_xxx",
  "setup_intent_id": "seti_xxx",
  "final_price_cents": 5000,
  "message": "Booking created successfully. Please complete payment setup."
}
```

**Step 2: Complete SetupIntent (Save Payment Method)**

**Option A: Via Frontend (Recommended)**
- Use Stripe.js to complete the SetupIntent with the `client_secret`
- This saves the payment method without charging

**Option B: For Testing (Stripe Dashboard)**
- Go to Stripe Dashboard → Setup Intents
- Find the SetupIntent by ID
- Use Stripe test cards to complete it
- Or use Stripe CLI: `stripe setup_intents confirm seti_xxx`

**Verify:**
- SetupIntent status = `succeeded`
- Database: `booking_payments.status = 'card_saved'`
- Database: `bookings.payment_status = 'card_saved'`

**Step 3: Complete Booking as Business Owner (Charge Payment)**

1. **Log in as business owner:**
   - Navigate to: `http://localhost:3000/login`
   - Email: `demo@tithi.com`
   - Password: `Tithi2025$Demo`

2. **Navigate to Bookings:**
   - Go to Bookings section in admin panel
   - Find the booking you created (by booking code or customer email)
   - Click on the booking to view details

3. **Click "Complete" button:**
   - This triggers the charge
   - Button should show spinner and disable
   - Wait for success confirmation

4. **Verify in Stripe Dashboard:**
   - Go to Stripe Dashboard → Payments → Payment Intents
   - Find the Payment Intent (search by booking ID in metadata)
   - **Verify:**
     - Status = `succeeded` ✅
     - `on_behalf_of` = connected account ID ✅
     - `transfer_data.destination` = connected account ID ✅
     - `application_fee_amount` = 1% of amount ✅
     - Metadata contains:
       - `booking_id` ✅
       - `business_id` ✅
       - `money_action: 'completed_charge'` ✅
   - **Check Transfer:**
     - Click on the transfer link
     - Verify destination is connected account
     - Verify amount is net (after platform fee)

5. **Verify Database Updates:**
   ```sql
   -- Check booking payment
   SELECT status, stripe_payment_intent_id, amount_cents 
   FROM booking_payments 
   WHERE booking_id = 'your-booking-id';
   -- Should show: status = 'charged', payment_intent_id set, amount_cents = 5000

   -- Check booking
   SELECT status, payment_status, last_money_action 
   FROM bookings 
   WHERE id = 'your-booking-id';
   -- Should show: status = 'completed', payment_status = 'charged', last_money_action = 'completed_charge'
   ```

**Step 4: Test Other Money Actions**

**No-Show Fee:**
1. Find a different booking
2. Click "No-Show" button
3. Verify fee is charged (check policies for fee amount)
4. Verify in Stripe Dashboard
5. Verify database: `bookings.status = 'no_show'`, `last_money_action = 'no_show_fee'`

**Cancellation Fee:**
1. Find a booking
2. Click "Cancel" button
3. Verify cancellation fee is charged (check policies)
4. Verify in Stripe Dashboard
5. Verify database: `bookings.status = 'cancelled'`, `last_money_action = 'cancel_fee'`

**Refund:**
1. Find a completed booking (one that was charged)
2. Click "Refund" button
3. Verify refund in Stripe Dashboard → Payments → Refunds
4. Verify refund record in database
5. Verify database: `bookings.status = 'refunded'`

**Step 5: Verify Webhook Processing**

1. **Check Stripe Dashboard:**
   - Go to Developers → Webhooks
   - Click on your webhook endpoint
   - Check "Recent events" tab
   - Verify events show green checkmarks (200 status)

2. **Check Application Logs:**
   - Look for webhook processing logs
   - Verify no errors occurred

3. **Verify Database:**
   - Check that webhook events updated database correctly
   - Verify payment statuses match Stripe

---

## 🎯 MANDATORY TESTING REQUIREMENT

### ⚠️ YOU MUST COMPLETE THE END-TO-END USER JOURNEY TEST

**Before marking this as complete, you MUST:**

1. **Create a NEW user account** (not using demo@tithi.com)
   - Sign up with a fresh email
   - Complete full onboarding (all 11 steps)
   - Verify all data saves correctly

2. **Verify Stripe Connect Account Creation:**
   - Connect account is created during Step 11
   - Account is linked to the business in database
   - Account is active and can receive payments
   - Account ID is saved correctly

3. **Verify Subscription Creation:**
   - Subscription is created with correct price
   - Price selection based on `notifications_enabled` flag works
   - Trial period is 7 days
   - All subscription data saved to database
   - Metadata includes business_id and user_id

4. **Test Customer Booking Flow:**
   - Create booking as customer (no login)
   - SetupIntent saves payment method (no charge)
   - Verify database updates correctly

5. **Test All Money Actions:**
   - Complete booking → Charge full amount
   - No-show booking → Charge fee (from policies)
   - Cancel booking → Charge fee (from policies)
   - Refund booking → Refund previous charge
   - Verify all charges go to Connect account
   - Verify platform fee (1%) is deducted
   - Verify gift cards apply correctly

6. **Verify Database Integrity:**
   - All Stripe IDs saved correctly
   - All payment records created
   - All statuses updated correctly
   - All relationships maintained

7. **Verify Stripe Dashboard:**
   - Connect account visible and active
   - Subscription visible with correct price
   - Payment Intents visible and succeeded
   - Transfers visible with correct amounts
   - All metadata correct

**If ANY of these fail, the integration is NOT production-ready. Fix the issues before proceeding.**

---

## 📞 FINAL INSTRUCTIONS

**Your mission:** Complete the Stripe integration to make it production-ready. Focus on:

1. **Subscription billing** - Ensure correct price selection and database updates
2. **Payment flow** - Ensure all money actions work correctly
3. **Database sync** - Ensure all Stripe events update database
4. **Error handling** - Ensure all error paths are handled
5. **Testing** - Verify everything works end-to-end using the workflow above

**Reference the frontend logistics document** - It's the source of truth for business logic.

**Test thoroughly** - Use Stripe test mode and verify all flows work. **YOU MUST complete the end-to-end user journey test** (see section "🧪 COMPLETE TESTING WORKFLOW"). This is not optional - it's the only way to verify production readiness.

**Update documentation** - Document any changes or fixes made.

**Be thorough** - This is production code that will handle real money. Every detail matters.

**Final Check:** Before considering complete, verify:
- [ ] New user can sign up and complete onboarding
- [ ] Stripe Connect account is created and linked
- [ ] Subscription is created with correct price
- [ ] Customer can create booking (payment method saved)
- [ ] Business owner can charge customers (Complete/No-Show/Cancel)
- [ ] All fees calculated correctly (platform fee, policy fees)
- [ ] Gift cards apply correctly
- [ ] Refunds work correctly
- [ ] All database updates are accurate
- [ ] All Stripe records are visible in Dashboard

**Key Testing Credentials:**
- Business Owner Login: `demo@tithi.com` / `Tithi2025$Demo`
- Business Subdomain: `demo`
- Test Service ID: `6cca8944-c73a-444e-a96c-39a6f5fcd613`
- Test Staff ID: `98e11fe0-de84-4d98-b6f6-2c2640a27f48`

---

---

## 📋 QUICK REFERENCE: CRITICAL TEST FLOW

**If you only do one thing, do this complete test:**

1. **Sign up new user** → `newuser@test.com` / `TestPassword123!`
2. **Complete onboarding** → All 11 steps, note notifications enabled/disabled
3. **Verify Connect account** → Created in Stripe, linked in database
4. **Verify subscription** → Correct price, 7-day trial, metadata correct
5. **Create customer booking** → Via API, save payment method
6. **Complete booking** → Log in as owner, click "Complete"
7. **Verify charge** → Stripe Dashboard shows correct amount, fees, transfer
8. **Verify database** → All statuses and IDs updated correctly
9. **Test other actions** → No-show, Cancel, Refund
10. **Verify gift cards** → Apply discount, verify final price

**If ALL of these pass, the integration is production-ready. If ANY fail, fix before proceeding.**

---

**Good luck! Make this production-ready! 🚀**

