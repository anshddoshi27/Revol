# Backend Changes Needed

This document lists all backend endpoints and functionality that are required but may not be fully implemented yet.

## Critical Gaps

### 1. Tenant ID Lookup by Slug
**Location**: `app/booking/[slug]/page.tsx`, `app/booking/[slug]/service/[serviceId]/page.tsx`

**Issue**: The booking flow pages need to get `tenant_id` from the `slug` parameter.

**Required Endpoint**:
```
GET /v1/public/tenants/by-slug/{slug}
Response: { tenant_id: string, ... }
```

**Current Workaround**: Hardcoded empty string - **WILL NOT WORK**

---

### 2. Refund Endpoint
**Location**: `app/app/b/[businessId]/page.tsx` (BookingsList component)

**Issue**: Refund button requires a dedicated endpoint.

**Required Endpoint**:
```
POST /api/v1/bookings/{booking_id}/refund
Body: { amount_cents?: number, reason?: string }
Headers: { Idempotency-Key: string }
```

**Current Workaround**: Shows alert - **NON-FUNCTIONAL**

---

### 3. Subscription Management Endpoints
**Location**: `app/app/b/[businessId]/page.tsx` (SubscriptionManagement component)

**Issue**: Need endpoints to manage subscription states (Trial, Active, Paused, Canceled).

**Required Endpoints**:
```
GET /api/v1/tenants/{id}/subscription
POST /api/v1/tenants/{id}/subscription/activate
POST /api/v1/tenants/{id}/subscription/pause
POST /api/v1/tenants/{id}/subscription/cancel
POST /api/v1/tenants/{id}/subscription/start-trial
```

**Current Workaround**: Buttons exist but no functionality - **NON-FUNCTIONAL**

---

### 4. Business Settings Update
**Location**: `app/app/b/[businessId]/page.tsx` (business tab)

**Issue**: Admin panel needs to edit business settings post-onboarding.

**Required Endpoint**:
```
PUT /api/v1/tenants/{id}/settings
Body: {
  // All onboarding fields that can be edited
  subdomain?: string,
  timezone?: string,
  phone?: string,
  website?: string,
  address?: {...},
  // etc.
}
```

**Current Workaround**: Shows placeholder - **NON-FUNCTIONAL**

---

### 5. Staff Management Endpoints
**Location**: `app/app/b/[businessId]/page.tsx` (staff tab)

**Issue**: Need CRUD operations for staff/team members.

**Required Endpoints**:
```
GET /api/v1/staff
POST /api/v1/staff
GET /api/v1/staff/{id}
PUT /api/v1/staff/{id}
DELETE /api/v1/staff/{id}
```

**Current Workaround**: Shows placeholder - **NON-FUNCTIONAL**

---

### 6. Booking by Code Lookup
**Location**: `app/booking/[slug]/confirm/[bookingCode]/page.tsx`

**Issue**: Need to fetch booking by code (not just ID).

**Required Endpoint**:
```
GET /booking/by-code/{booking_code}
Response: { booking: {...} }
```

**Current Workaround**: Uses booking_id endpoint pattern - **MAY NOT WORK**

---

### 7. Stripe SetupIntent Integration
**Location**: `app/booking/[slug]/checkout/page.tsx`

**Issue**: Frontend is set up for Stripe Elements but needs SetupIntent client_secret from backend.

**Required Flow**:
1. Frontend creates booking with payment intent
2. Backend creates SetupIntent (not PaymentIntent) to save card
3. Backend returns `setup_intent_client_secret`
4. Frontend uses Stripe Elements to confirm SetupIntent
5. Card is saved for off-session use

**Current Status**: Structure exists but integration incomplete

---

### 8. Payment Method Capture Actions
**Location**: `app/app/b/[businessId]/page.tsx` (BookingsList - Completed/No-Show buttons)

**Issue**: Endpoints exist but need to handle:
- Off-session PaymentIntent creation
- Card on file usage
- Application fee (1% platform fee)
- Stripe Connect destination charges

**Verification Needed**:
- `POST /api/v1/bookings/{id}/complete` - Should create PaymentIntent if card on file exists
- `POST /api/v1/bookings/{id}/no-show` - Should charge no-show fee from policies
- Response should include payment status and receipt info

---

### 9. Gift Card Validation
**Location**: `app/booking/[slug]/checkout/page.tsx`

**Issue**: Need endpoint to validate gift card code and calculate discount.

**Required Endpoint**:
```
POST /api/v1/gift-cards/validate
Body: { code: string, amount_cents: number }
Response: {
  valid: boolean,
  discount_cents: number,
  final_amount_cents: number
}
```

**Current Status**: Code field exists but validation not implemented

---

### 10. Onboarding Steps 3-8
**Location**: `app/onboarding/step2/page.tsx` (and future step pages)

**Status**: Step 2 is implemented. Steps 3-8 need to be created following the same pattern.

**Required Endpoints** (already defined in backend):
- `POST /onboarding/step3/team-members` ✓
- `POST /onboarding/step4/services-categories` ✓
- `POST /onboarding/step5/availability` ✓
- `POST /onboarding/step6/notifications` ✓
- `POST /onboarding/step7/policies-gift-cards` ✓
- `POST /onboarding/step8/go-live` ✓

**Action**: Create frontend pages for steps 3-8 (see step2 as template)

---

## Data Flow Issues

### Booking Payment Flow

The frontend expects this flow:

1. **Checkout**: Save card only (SetupIntent) - no charge
2. **Booking Created**: Status = "pending", payment = "authorized" (card saved)
3. **Admin Action (Completed)**: Charge full amount off-session
4. **Admin Action (No-Show)**: Charge no-show fee off-session
5. **Admin Action (Refund)**: Refund if payment exists

**Verification**: Ensure backend booking endpoints return:
- `payment_status: 'authorized'` after SetupIntent confirms
- `setup_intent_client_secret` in booking creation response
- Payment action endpoints handle off-session charges correctly

---

## Testing Checklist

- [ ] Tenant lookup by slug works
- [ ] Refund endpoint functional
- [ ] Subscription management works
- [ ] Business settings can be updated
- [ ] Staff CRUD operations work
- [ ] Booking by code lookup works
- [ ] Stripe SetupIntent flow completes
- [ ] Payment buttons (Complete/No-Show) create charges
- [ ] Gift card validation works
- [ ] All onboarding steps complete successfully

---

## Notes

- All endpoints marked as "BACKEND CHANGE NEEDED" in code comments
- Frontend structure is complete and ready once backend endpoints are available
- API client in `lib/api-client.ts` defines exact request/response shapes
- React Query hooks in `lib/hooks.ts` handle all data fetching
- Error handling is in place but may need adjustment based on actual error responses

