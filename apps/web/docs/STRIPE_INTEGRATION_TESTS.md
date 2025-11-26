# Stripe Integration Tests (Step 5)

This document describes the comprehensive test suite for the Stripe integration implementation.

## Test Coverage

### 1. Stripe Helper Functions (`lib/stripe.ts`)

#### ✅ `createConnectAccount`
- Creates a Stripe Connect Express account
- Returns account ID
- Sets up card_payments and transfers capabilities

#### ✅ `createAccountLink`
- Creates Account Link for Connect onboarding
- Returns URL for redirect
- Supports return_url and refresh_url

#### ✅ `verifyConnectAccount`
- Verifies Connect account is active
- Checks `details_submitted` and `charges_enabled`
- Returns boolean

#### ✅ `createOrGetCustomer`
- Creates or retrieves Stripe Customer
- Searches by email first
- Adds metadata for business tracking

#### ✅ `createSubscription` (Enhanced)
- Creates subscription with metadata (business_id, user_id)
- Returns subscription ID, status, and current_period_end
- Used for $11.99/month Tithi subscription

#### ✅ `createSetupIntent`
- Creates SetupIntent to save card without charging
- Returns setupIntentId and clientSecret
- Used at checkout to save payment method

#### ✅ `createPaymentIntent` (Enhanced)
- Creates PaymentIntent with Connect destination charge
- Supports off-session charges (`offSession: true`)
- Includes application_fee_amount (1% platform fee)
- Uses `on_behalf_of` and `transfer_data.destination`

#### ✅ `createRefund`
- Creates refund for a PaymentIntent
- Supports full or partial refunds
- Returns refund ID and amount

#### ✅ `getPaymentMethodFromSetupIntent`
- Retrieves payment method ID from SetupIntent
- Used to get saved card for off-session charges

### 2. Payment Setup Flow (`/api/business/onboarding/step-11-payment-setup`)

#### Flow Steps:
1. ✅ Create Connect account if not exists
2. ✅ Create Account Link for Stripe onboarding
3. ✅ Verify account after return from Stripe
4. ✅ Create Stripe Customer for owner
5. ✅ Create subscription with metadata (business_id, user_id)
6. ✅ Save all IDs to businesses table:
   - `stripe_connect_account_id`
   - `stripe_customer_id`
   - `stripe_subscription_id`
   - `subscription_status`
   - `next_bill_at`

### 3. Webhook Handler (`/api/webhooks/stripe`)

#### Subscription Events:
- ✅ `customer.subscription.updated`
  - Updates `subscription_status` and `next_bill_at`
  - Handles canceled status with subdomain deprovisioning

- ✅ `customer.subscription.deleted`
  - Marks business as canceled
  - Deprovisions subdomain

- ✅ `invoice.payment_succeeded`
  - Updates subscription_status to 'active'
  - Updates `next_bill_at` from current_period_end

- ✅ `invoice.payment_failed`
  - Updates subscription_status to 'past_due'
  - Updates `next_bill_at`

#### Payment Events:
- ✅ `payment_intent.succeeded`
  - Updates `booking_payments.status` to 'charged'
  - Updates `bookings.status` based on `money_action`:
    - `completed_charge` → status: 'completed'
    - `no_show_fee` → status: 'no_show'
    - `cancel_fee` → status: 'cancelled'
  - Fetches Stripe fees from balance transaction

- ✅ `payment_intent.payment_failed`
  - Updates `booking_payments.status` to 'failed'
  - Updates `bookings.payment_status` to 'failed'

- ✅ `charge.refunded`
  - Creates refund record in `booking_payments`
  - Gets `user_id` and `business_id` from original payment
  - Updates booking status to 'refunded'
  - Prevents duplicate refund records

- ✅ `setup_intent.succeeded`
  - Updates `booking_payments.status` to 'card_saved'
  - Updates `bookings.payment_status` to 'card_saved'

### 4. Payment Actions

#### ✅ Complete Booking (`POST /api/admin/bookings/{id}/complete`)
- Creates off-session PaymentIntent for `final_price_cents`
- Applies 1% platform fee
- Updates booking status to 'completed'
- Handles gift card balance deduction (if amount-type)
- Requires `X-Idempotency-Key` header

#### ✅ No-Show Booking (`POST /api/admin/bookings/{id}/no-show`)
- Calculates no-show fee from policy snapshot
- If fee is 0, just updates status (no charge)
- Otherwise creates off-session PaymentIntent
- Updates booking status to 'no_show'
- Requires `X-Idempotency-Key` header

#### ✅ Cancel Booking (`POST /api/admin/bookings/{id}/cancel`)
- Calculates cancellation fee from policy snapshot
- If fee is 0, just updates status (no charge)
- Otherwise creates off-session PaymentIntent
- Updates booking status to 'cancelled'
- Requires `X-Idempotency-Key` header

#### ✅ Refund Booking (`POST /api/admin/bookings/{id}/refund`)
- Finds previous charged payment
- Creates refund in Stripe
- Creates refund record in `booking_payments`
- Updates booking status to 'refunded'
- Optionally restores gift card balance (if amount-type)
- Requires `X-Idempotency-Key` header

### 5. Integration Points

#### ✅ Subscription Metadata
- Subscriptions include `business_id` and `user_id` in metadata
- Webhooks can find business using metadata

#### ✅ PaymentIntent Metadata
- PaymentIntents include `booking_id`, `business_id`, `money_action`
- Webhooks can update correct booking using metadata

#### ✅ Off-Session Charges
- All money actions use `offSession: true`
- PaymentIntent created with `off_session: true` and `request_three_d_secure: 'automatic'`

#### ✅ Connect Destination
- All PaymentIntents use Connect destination charges
- Includes `on_behalf_of` and `transfer_data.destination`

#### ✅ Platform Fee
- 1% platform fee applied to all charges
- `application_fee_amount = round(amount * 0.01)`

#### ✅ Idempotency
- All money actions are idempotent
- Same `X-Idempotency-Key` returns cached response
- Prevents double-charges

## Running Tests

```bash
# Run Stripe integration tests
npm run test:stripe
```

## Manual Testing Checklist

### Payment Setup
- [ ] Create Connect account via onboarding
- [ ] Complete Stripe Express onboarding
- [ ] Verify subscription is created with metadata
- [ ] Verify all IDs saved to businesses table

### Webhooks
- [ ] Test subscription.updated webhook
- [ ] Test subscription.deleted webhook (verify subdomain deprovisioning)
- [ ] Test invoice.payment_succeeded webhook
- [ ] Test invoice.payment_failed webhook
- [ ] Test payment_intent.succeeded webhook
- [ ] Test payment_intent.payment_failed webhook
- [ ] Test charge.refunded webhook
- [ ] Test setup_intent.succeeded webhook

### Payment Actions
- [ ] Complete booking (verify off-session charge)
- [ ] No-show booking with fee (verify charge)
- [ ] No-show booking with $0 fee (verify no charge)
- [ ] Cancel booking with fee (verify charge)
- [ ] Cancel booking with $0 fee (verify no charge)
- [ ] Refund booking (verify refund created)
- [ ] Test idempotency (same key returns cached response)

## Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLAN_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Notes

- All tests use Stripe test mode
- Webhook tests require Stripe CLI or webhook forwarding
- Payment action tests require test bookings in database
- Idempotency tests verify no double-charges occur


