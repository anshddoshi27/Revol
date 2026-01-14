# Booking Actions API Documentation

## Overview

This document explains the booking action API endpoints (`/api/admin/bookings/[id]/{action}`) and their business logic, particularly the fee-first approach for handling bookings with and without payment records.

## Endpoints

- `POST /api/admin/bookings/[id]/complete` - Mark booking as completed and charge full amount
- `POST /api/admin/bookings/[id]/no-show` - Mark booking as no-show and charge no-show fee (if applicable)
- `POST /api/admin/bookings/[id]/cancel` - Mark booking as cancelled and charge cancellation fee (if applicable)
- `POST /api/admin/bookings/[id]/refund` - Refund booking and update status

All endpoints require:
- Authentication (user must be logged in)
- `X-Idempotency-Key` header to prevent duplicate charges
- Business ownership (user must own the business that owns the booking)

## Fee-First Logic

### Overview

The booking action API uses a **fee-first** approach: we calculate the fee BEFORE checking for payment records. This allows us to handle bookings with $0 fees even when they don't have payment records (e.g., test bookings, manually created bookings, or bookings where fees are waived).

### Flow Diagram

```
1. Validate booking exists and user has access
2. Calculate fee from policy snapshot
   ├─ If fee is $0 → Update booking status directly (skip payment)
   └─ If fee > $0 → Continue to payment validation
3. If fee > $0:
   ├─ Validate Stripe Connect account exists
   ├─ Validate customer has Stripe customer ID
   ├─ Check for payment record with setup_intent_id
   ├─ Retrieve payment method from SetupIntent
   └─ Create PaymentIntent and charge fee
4. Update booking status and payment status
5. Return response with booking_status field
```

### Policy Snapshot Structure

The `policy_snapshot` is stored as JSONB in the `bookings` table and contains fee configuration at the time of booking creation:

```typescript
{
  no_show_fee_type: 'amount' | 'percent' | null,
  no_show_fee_amount_cents?: number,  // If type is 'amount'
  no_show_fee_percent?: number,        // If type is 'percent' (0-100)
  cancel_fee_type: 'amount' | 'percent' | null,
  cancel_fee_amount_cents?: number,
  cancel_fee_percent?: number,
}
```

### Fee Calculation

**For no-show fees:**
- If `no_show_fee_type === 'amount'`: Use `no_show_fee_amount_cents` directly
- If `no_show_fee_type === 'percent'`: Calculate `(final_price_cents * no_show_fee_percent) / 100`
- If policy snapshot is missing or invalid: Default to $0

**For cancellation fees:**
- Same logic as no-show fees, using `cancel_fee_*` fields

**For complete booking:**
- Charge full `final_price_cents` (or `price_cents` if `final_price_cents` is not set)

### $0 Fee Handling

When the calculated fee is $0:
1. **Skip payment validation** - No need to check for payment records
2. **Update booking status directly** - Set status (e.g., `'no_show'`, `'completed'`) and `payment_status: 'none'`
3. **Return immediately** - No Stripe API calls needed

This supports:
- Test bookings created manually in the database
- Bookings created before payment flow was implemented
- Bookings where fees are waived (e.g., VIP customers)
- Bookings with $0 service prices

### Payment Record Requirements

When the calculated fee is > $0, we require:
1. **Business Stripe Connect Account**: `businesses.stripe_connect_account_id` must exist
2. **Customer Stripe Customer ID**: `customers.stripe_customer_id` must exist
3. **Payment Record with SetupIntent**: A `booking_payments` record with:
   - `stripe_setup_intent_id` is not null
   - `status` is `'none'` or `'card_saved'` (initial state or webhook-processed)
   - `booking_id` matches the booking

**Important**: Payment records may be in `'none'` status if the webhook hasn't processed the SetupIntent yet. The API handles this race condition by accepting both `'none'` and `'card_saved'` statuses.

### Payment Status Flow

```
Booking Created
  ↓
SetupIntent Created (payment record with status='none')
  ↓
Customer Completes SetupIntent
  ↓
Webhook Processes SetupIntent (payment record updated to status='card_saved')
  ↓
Admin Marks Booking as Complete/No-Show
  ↓
PaymentIntent Created and Charged
  ↓
Payment Record Created/Updated (status='charged' or 'charge_pending')
```

## Error Handling

### Common Errors

| Status | Error Message | Cause | Resolution |
|--------|---------------|-------|------------|
| 400 | `No-show fee is $X.XX, but no saved payment method found` | Fee > $0 but no payment record with `setup_intent_id` | Ensure booking was created through payment flow, or wait for webhook to process SetupIntent |
| 400 | `Payment method not yet available` | SetupIntent exists but payment method hasn't been extracted yet | Wait for webhook to process SetupIntent, or check SetupIntent status in Stripe |
| 400 | `Customer does not have a Stripe customer ID` | Booking was created manually, not through payment flow | Only bookings created through the public booking flow can be charged |
| 400 | `X-Idempotency-Key header is required` | Missing idempotency key | Include `X-Idempotency-Key` header in request |
| 401 | `Unauthorized` | User not logged in | Authenticate and try again |
| 404 | `Booking not found` | Booking doesn't exist or user doesn't have access | Verify booking ID and business ownership |
| 500 | `Business Stripe Connect account not configured` | Business hasn't set up Stripe Connect | Configure Stripe Connect account for business |
| 402 | Payment failed | Stripe rejected the charge | Check payment method, customer, or contact Stripe support |

### Retry Logic

The API includes automatic retry logic with exponential backoff for transient Stripe API failures:
- **Max retries**: 3 (4 total attempts)
- **Base delay**: 1 second
- **Backoff**: Exponential (1s, 2s, 4s)
- **Retries on**: Rate limits (429), network errors, 5xx responses
- **Does not retry**: Client errors (4xx except 429)

### Idempotency

All booking action endpoints are **idempotent**. If the same `X-Idempotency-Key` is used twice:
- First request: Processes normally
- Subsequent requests: Returns cached response from first request

This prevents duplicate charges if a request is retried due to network issues.

## Response Format

### Success Response

```json
{
  "status": "CHARGED",
  "charge_amount": 5000,
  "currency": "usd",
  "stripe_payment_intent_id": "pi_xxx",
  "receipt_url": "https://dashboard.stripe.com/payments/pi_xxx",
  "booking_status": "completed"
}
```

### $0 Fee Response

```json
{
  "status": "NO_SHOW",
  "charge_amount": 0,
  "currency": "usd",
  "message": "No-show fee is $0.00. Booking marked as no-show.",
  "booking_status": "no_show"
}
```

### Requires Action Response

When payment requires customer authentication (3DS, etc.):

```json
{
  "status": "REQUIRES_ACTION",
  "charge_amount": 5000,
  "currency": "usd",
  "stripe_payment_intent_id": "pi_xxx",
  "client_secret": "pi_xxx_secret_xxx",
  "message": "Payment requires customer authentication. Send payment link to customer.",
  "booking_status": "no_show"
}
```

**Admin Notification**: When `REQUIRES_ACTION` status is returned, the admin is automatically notified via console logs (expandable to email/in-app notifications).

### Error Response

```json
{
  "error": "No saved payment method found for this booking",
  "booking_id": "xxx",
  "fee_amount_cents": 5000,
  "has_payment_records": true,
  "payment_records_count": 1
}
```

## Metrics & Monitoring

All booking actions are logged with metrics for monitoring:
- **Action type**: `complete`, `no-show`, `cancel`, `refund`
- **Status**: `success`, `failed`, `requires_action`, `no_payment_method`, `invalid_state`
- **Duration**: Time taken for the operation
- **Amount**: Fee/charge amount in cents
- **Payment Intent ID**: Stripe payment intent ID (if applicable)

Logs are prefixed with `[booking-action-metric]` for easy filtering.

## Best Practices

1. **Always include `X-Idempotency-Key`** - Use a UUID or deterministic value based on booking ID + action
2. **Handle `REQUIRES_ACTION` status** - Admin should send payment authentication link to customer
3. **Check for $0 fees** - If fee is $0, action will succeed even without payment records
4. **Wait for webhook** - If SetupIntent was just created, wait a few seconds for webhook to process before taking action
5. **Monitor metrics** - Track success/failure rates by action type to identify issues

## Example Usage

### Complete Booking

```typescript
const response = await fetch(`/api/admin/bookings/${bookingId}/complete`, {
  method: 'POST',
  headers: {
    'X-Idempotency-Key': `${bookingId}-complete-${Date.now()}`,
  },
});

const data = await response.json();

if (data.status === 'CHARGED') {
  console.log('Booking completed, charged:', data.charge_amount / 100);
} else if (data.status === 'REQUIRES_ACTION') {
  console.warn('Customer needs to authenticate payment');
  // Send payment link to customer
}
```

### Mark No-Show (with $0 fee)

```typescript
// This will succeed even if booking has no payment records
const response = await fetch(`/api/admin/bookings/${bookingId}/no-show`, {
  method: 'POST',
  headers: {
    'X-Idempotency-Key': `${bookingId}-no-show-${Date.now()}`,
  },
});

const data = await response.json();
// If fee is $0, status will be 'NO_SHOW' with charge_amount: 0
```

## Database Schema Reference

### Relevant Tables

- `bookings` - Main booking record with `policy_snapshot`, `status`, `payment_status`
- `booking_payments` - Payment records with `stripe_setup_intent_id`, `stripe_payment_intent_id`, `status`
- `businesses` - Business configuration with `stripe_connect_account_id`
- `customers` - Customer records with `stripe_customer_id`

### Enum Values

**`booking_status`**: `'pending'`, `'confirmed'`, `'checked_in'`, `'completed'`, `'cancelled'`, `'no_show'`

**`payment_status`**: `'none'`, `'card_saved'`, `'charge_pending'`, `'charged'`, `'refunded'`, `'failed'`

**Note**: Use British spelling `'cancelled'` (not `'canceled'`) to match database enum.

## Related Documentation

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Payment Intents API](https://stripe.com/docs/payments/payment-intents)
- [Setup Intents API](https://stripe.com/docs/payments/setup-intents)
- [Idempotency Guide](https://stripe.com/docs/api/idempotent_requests)
