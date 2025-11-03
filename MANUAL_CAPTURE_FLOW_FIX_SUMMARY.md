# Manual Capture Flow Fix Summary

**Date**: 2025-01-XX  
**Issue**: Backend does not implement SetupIntent at checkout (manual capture flow)  
**Status**: ✅ FIXED

---

## Problem Statement

Frontend logistics explicitly requires:
- **No charge at checkout** - only save card
- Create **SetupIntent** (not PaymentIntent) at checkout
- Charge later when admin presses Completed/No-Show/Cancelled buttons
- Booking starts as **pending** status, not confirmed

Current backend implementation was a placeholder that:
- Created no actual payment processing
- Set booking status to 'confirmed' or 'pending_payment'
- Did not integrate with Stripe SetupIntent
- Did not return `setup_intent_client_secret` needed by frontend

---

## Changes Made

### 1. Fixed Booking Flow Service (`backend/app/services/booking_flow_service.py`)

**Changed Methods**:

#### `_process_payment()` - Lines 447-495
**Before**: Placeholder implementation returning fake success
```python
def _process_payment(self, booking: Booking, payment_method: Dict[str, Any]) -> Dict[str, Any]:
    """Process payment for booking."""
    # This would integrate with Stripe or other payment processor
    # For now, return success for demo purposes
    
    return {
        'success': True,
        'payment_id': str(uuid.uuid4()),
        'amount_cents': booking.total_amount_cents
    }
```

**After**: Real SetupIntent creation
```python
def _process_payment(self, booking: Booking, payment_method: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process payment for booking by creating SetupIntent.
    Per frontend logistics: we save card at checkout, no charge yet.
    Actual charge happens when admin presses Completed/No-Show/Cancelled button.
    """
    payment_service = PaymentService()
    customer = Customer.query.get(booking.customer_id)
    setup_intent = payment_service.create_setup_intent(...)
    return {
        'success': True,
        'payment_id': str(setup_intent.id),
        'setup_intent_client_secret': self._get_stripe_setup_intent_client_secret(setup_intent),
        'amount_cents': booking.total_amount_cents,
        'payment_status': 'pending',
        'capture_method': 'off_session'
    }
```

#### `_get_stripe_setup_intent_client_secret()` - Lines 480-496
**New Method**: Retrieves client secret from Stripe for frontend integration

#### `create_booking()` - Lines 289-364
**Changes**:
- Added flush after customer creation (line 291)
- Set booking status to 'pending' (always, regardless of payment result)
- Return `setup_intent_client_secret` in response
- Updated logging

**Added Imports**:
```python
from ..models.team import TeamMemberService  # Missing import
from ..services.financial import PaymentService  # For SetupIntent creation
```

---

### 2. Fixed Payment Service (`backend/app/services/financial.py`)

**Changed Methods**:

#### `get_or_create_stripe_customer()` - Lines 173-221
**New Method**: Creates or retrieves Stripe Customer for database Customer
- Checks for existing Stripe Customer ID in `notification_preferences` field
- Creates Stripe Customer if not exists
- Stores Stripe Customer ID in `customer.notification_preferences['stripe_customer_id']`
- Removed commit (let caller handle transaction)

#### `create_setup_intent()` - Lines 223-284
**Signature Change**:
```python
# Before
def create_setup_intent(self, tenant_id: str, customer_id: str, idempotency_key: Optional[str] = None)

# After  
def create_setup_intent(self, tenant_id: str, db_customer: Any, idempotency_key: Optional[str] = None)
```

**Changes**:
- Now accepts Customer object (not just ID)
- Calls `get_or_create_stripe_customer()` to ensure Stripe Customer exists
- Creates SetupIntent (not PaymentIntent)
- Stores Stripe Customer ID in database
- Removed commit to allow caller to handle transaction

---

## Transaction Flow

**Before (Problematic)**:
```
create_booking()
  → _process_payment()  # fake success
  → commit()  # booking = confirmed
```

**After (Fixed)**:
```
create_booking()
  → _create_or_find_customer()
  → flush()  # ensure customer has ID
  → create booking
  → flush()  # ensure booking has ID
  → _process_payment()
    → get_or_create_stripe_customer()  # creates Stripe Customer, NO commit
    → create_setup_intent()  # creates SetupIntent, NO commit
    → return setup_intent_client_secret
  → commit()  # ALL changes in one transaction
```

---

## API Response Changes

**Booking Creation Endpoint** (`POST /booking/create`)

**Before**:
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "confirmed",  // WRONG
    "payment_status": "paid",  // WRONG
    "total_amount_cents": 12000,
    ...
  }
}
```

**After**:
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "pending",  // CORRECT
    "payment_status": "pending",  // CORRECT
    "total_amount_cents": 12000,
    "setup_intent_client_secret": "seti_xxx_secret_yyy",  // NEW
    "payment_id": "uuid",
    ...
  }
}
```

---

## Database Changes

**Customer Table**: Uses existing `notification_preferences` JSONB field to store `stripe_customer_id`
- No schema migration needed
- Field: `notification_preferences['stripe_customer_id']`

**Payment Table**: Uses existing `provider_setup_intent_id` field
- No schema migration needed
- Field already existed for SetupIntent tracking

---

## Frontend Integration

Frontend now receives `setup_intent_client_secret` and can:

1. Confirm SetupIntent with Stripe Elements:
```javascript
const { setupIntent, error } = await stripe.confirmSetup({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/booking/confirm`
  }
});
```

2. Display "No charge yet" message to customer
3. Show pending booking status
4. Enable admin buttons to charge later (Completed/No-Show/Cancelled)

---

## Testing Checklist

- [ ] Create new customer booking → SetupIntent created
- [ ] Existing customer booking → Reuse Stripe Customer
- [ ] Booking status = pending (not confirmed)
- [ ] Response includes `setup_intent_client_secret`
- [ ] Customer stored in Stripe
- [ ] Stripe Customer ID stored in `notification_preferences`
- [ ] All changes commit in one transaction
- [ ] Error handling works correctly

---

## Known Limitations / Future Work

1. **PaymentMethod Storage**: After SetupIntent confirmation, should save payment method to `PaymentMethod` table for future off-session charges
2. **Admin Button Integration**: Complete/No-Show/Cancelled buttons need to use saved payment method for charging
3. **Customer Stripe ID**: Using `notification_preferences` is a temporary solution; should add dedicated `stripe_customer_id` field to Customer model
4. **Gift Card Integration**: Gift card validation not yet integrated with SetupIntent flow

---

## References

- Frontend logistics: `docs/frontend/frontend logistics.txt:481-494`
- Issue detection: `docs/frontend/FRONTEND_BUILD_PHASES.md:246-324`
- Backend models: `backend/app/models/financial.py`, `backend/app/models/business.py`
- Service implementations: `backend/app/services/financial.py`, `backend/app/services/booking_flow_service.py`
