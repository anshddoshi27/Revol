# Testing Booking Actions (Complete, No-Show, Cancel)

## Quick Testing Guide

### Test with $0 Fees (No Stripe Required) ✅

The booking actions **already work** for bookings with **$0 fees** without any Stripe Connect setup!

**How it works:**
- If `no_show_fee` = $0 → No-show button works immediately
- If `cancel_fee` = $0 → Cancel button works immediately  
- If booking has no policy snapshot → Defaults to $0 fee
- Status updates happen directly in the database (no payment processing)

### Test with Fees > $0 (Requires Stripe)

For bookings that charge fees, you need:
1. **Stripe Connect account** created
2. **Stripe Connect onboarding completed** (all 8 actions in Stripe Dashboard)
3. **Payment record** with `setup_intent_id` for the booking

## How to Test

### Step 1: Check Your Bookings

1. Go to Past Bookings page: `/app/b/[business-id]`
2. Open browser console (F12)
3. Look for bookings - check their `policy_snapshot`:
   ```javascript
   // In browser console, check booking data
   // Look for bookings with no_show_fee = $0 or no policy_snapshot
   ```

### Step 2: Test No-Show Button

**For bookings with $0 no-show fee:**
1. Click "No-show" button
2. Should work immediately ✅
3. Check terminal logs: `[no-show-booking] Calculated no-show fee: $0.00`
4. Booking status should update to `no_show`

**For bookings with >$0 fee:**
- Need Stripe Connect account set up first
- Will see error: "Stripe Connect account does not have transfers capability enabled"

### Step 3: Test Complete Button

**For bookings with payment records:**
1. Click "Completed" button
2. Requires Stripe Connect account (even if fee is $0, because it charges full booking amount)
3. Will charge full booking price to customer's saved payment method

**Note:** Complete always requires payment, so it always needs Stripe Connect.

### Step 4: Test Cancel Button

**For bookings with $0 cancellation fee:**
1. Click "Cancel" button  
2. Should work immediately ✅
3. Booking status updates to `cancelled`

## Terminal Logs to Watch

When testing, watch your terminal for:

```
[no-show-booking] Calculating fee for booking...
[no-show-booking] Calculated no-show fee: $X.XX
[no-show-booking] No-show fee is $0, updating status without payment
```

OR

```
[booking-action-metric] no-show | success | booking: xxx
[booking-action-metric] no-show | failed | error: ...
```

## Troubleshooting

### "Action unavailable" Error

**Check:**
1. Browser console for detailed error message
2. Terminal logs for fee calculation
3. If fee > $0, ensure Stripe Connect is set up

### "Stripe Connect account not configured"

**Options:**
1. **Test with $0 fees** (easiest - no Stripe needed)
2. **Set up Stripe Connect** (required for fees > $0)

### Test Stripe Account

The test Stripe account (`revol.mainacc@gmail.com`) can be:
- **Ignored** - it doesn't affect your code
- **Deleted** - if you want to clean up (delete in Stripe Dashboard)
- **Completed** - if you want to test with real fees (complete the 8 onboarding actions)

## Recommended Testing Flow

1. **Start with $0 fees** - Test that buttons work for status updates
2. **Verify status persists** - Refresh page, check booking still shows updated status
3. **Check analytics** - Verify analytics page reflects updated booking statuses
4. **Test with fees** (optional) - Set up Stripe Connect if you want to test payment processing

## Current Implementation Status

✅ **Completed:**
- Fee-first logic ($0 fees work without Stripe)
- Status persistence (updates saved to database)
- Error handling (clear error messages)
- Metrics logging (terminal logs for debugging)
- Analytics updates (status changes reflect in analytics)

✅ **Works Without Stripe:**
- No-show with $0 fee
- Cancel with $0 fee
- Status updates for all actions

❌ **Requires Stripe:**
- Complete (always charges full amount)
- No-show with fee > $0
- Cancel with fee > $0
