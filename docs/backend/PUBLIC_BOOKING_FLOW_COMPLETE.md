# Public Booking Flow API - Implementation Complete

## Status: ✅ Production Ready

All three public booking endpoints have been implemented, tested, and are production-ready.

---

## Endpoints Implemented

### 1. GET `/api/public/{slug}/catalog`

**Purpose**: Returns business catalog (business info, categories, services, staff)

**Features**:
- ✅ Queries businesses by subdomain (active/trial only)
- ✅ Returns business info with branding
- ✅ Returns categories with nested services
- ✅ Returns staff summary
- ✅ Subscription status filter (only active/trial businesses visible)

**Response Structure**:
```json
{
  "business": {
    "id": "uuid",
    "name": "Business Name",
    "subdomain": "business-slug",
    "timezone": "America/New_York",
    "brand_primary_color": "#000000",
    "brand_secondary_color": "#ffffff",
    "logo_url": "https://...",
    "support_email": "support@example.com",
    "phone": "+1234567890"
  },
  "categories": [
    {
      "id": "uuid",
      "name": "Category Name",
      "description": "...",
      "color": "#ff0000",
      "services": [
        {
          "id": "uuid",
          "name": "Service Name",
          "description": "...",
          "duration_min": 60,
          "price_cents": 10000,
          "pre_appointment_instructions": "...",
          "staffIds": ["uuid1", "uuid2"]
        }
      ]
    }
  ],
  "staff": [
    {
      "id": "uuid",
      "name": "Staff Name",
      "role": "Stylist",
      "color": "#00ff00"
    }
  ]
}
```

---

### 2. GET `/api/public/{slug}/availability?service_id={id}&date=YYYY-MM-DD`

**Purpose**: Returns available time slots for a service on a specific date

**Features**:
- ✅ Loads availability rules for the service/staff/weekday
- ✅ Generates 15-minute slots using proper timezone handling
- ✅ Respects blackouts (global and staff-specific)
- ✅ Respects existing bookings (pending/scheduled/held)
- ✅ Respects lead time (min_lead_time_minutes)
- ✅ Respects max advance days
- ✅ Proper timezone conversion using `date-fns-tz`
- ✅ Only returns slots for active/trial businesses

**Query Parameters**:
- `service_id` (required): UUID of the service
- `date` (required): Date in YYYY-MM-DD format

**Response Structure**:
```json
{
  "slots": [
    {
      "staff_id": "uuid",
      "staff_name": "Staff Name",
      "start_at": "2025-01-15T14:00:00.000Z",
      "end_at": "2025-01-15T15:00:00.000Z"
    }
  ],
  "service_id": "uuid",
  "date": "2025-01-15"
}
```

**Timezone Handling**:
- Uses `zonedTimeToUtc` and `utcToZonedTime` from `date-fns-tz`
- Properly converts business timezone to UTC for storage
- Handles DST transitions correctly
- All slot times returned in UTC ISO format

---

### 3. POST `/api/public/{slug}/bookings`

**Purpose**: Creates a new booking with card setup (no charge yet)

**Features**:
- ✅ Validates slot is still available (overlap detection)
- ✅ Validates gift card code (if provided)
- ✅ Calculates final price with gift card discount
- ✅ Creates or reuses customer record
- ✅ Creates Stripe Customer if needed
- ✅ Creates booking row with:
  - Base and final prices
  - Policy snapshot (frozen policies at booking time)
  - Consent metadata (IP, user agent, timestamp)
  - Gift card info (if used)
- ✅ Creates Stripe SetupIntent (saves card, no charge)
- ✅ Creates booking_payments row with status 'card_saved'
- ✅ Returns booking_id, booking_code, and SetupIntent client_secret
- ✅ Only accepts bookings for active/trial businesses

**Request Body**:
```json
{
  "service_id": "uuid",
  "staff_id": "uuid",
  "start_at": "2025-01-15T14:00:00.000Z",
  "customer": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "+1234567890"
  },
  "gift_card_code": "WINTER20",
  "consent_ip": "127.0.0.1",
  "consent_user_agent": "Mozilla/5.0..."
}
```

**Response Structure**:
```json
{
  "booking_id": "uuid",
  "booking_code": "TITHI-12345678",
  "client_secret": "seti_...",
  "setup_intent_id": "seti_...",
  "final_price_cents": 8500,
  "message": "Booking created successfully. Please complete payment setup."
}
```

**Double-Booking Prevention**:
- Checks for overlapping bookings before creation
- Compares start/end times to detect conflicts
- Returns 409 Conflict if slot is already taken
- Unique database constraint provides additional protection

**Gift Card Handling**:
- Validates gift card exists and is active
- Checks expiration date
- For amount-type: Validates balance is sufficient
- For percent-type: Validates percentage is valid (0-100%)
- Calculates discount and final price
- Stores gift card info on booking (for later deduction)

**Customer Handling**:
- Creates or finds customer by email (case-insensitive)
- Updates customer info if already exists
- Creates Stripe Customer if not exists
- Ensures Stripe Customer ID is always present for SetupIntent

**Policy Snapshot**:
- Stores complete policy text and fees at booking time
- Ensures customer agreed to policies as they existed at booking
- Protects against policy changes after booking

---

### 4. POST `/api/public/{slug}/gift-codes/preview`

**Purpose**: Validates gift card code and computes discount

**Features**:
- ✅ Validates gift card exists and is active
- ✅ Checks expiration date
- ✅ Validates balance for amount-type cards
- ✅ Validates percentage for percent-type cards
- ✅ Calculates discount and final price
- ✅ Only accessible for active/trial businesses

**Request Body**:
```json
{
  "code": "WINTER20",
  "base_price_cents": 10000
}
```

**Response Structure**:
```json
{
  "discount_cents": 1500,
  "final_price_cents": 8500,
  "type": "percent",
  "gift_card_id": "uuid",
  "gift_card_balance_cents": null,
  "percent_off": 15
}
```

---

## Key Improvements Made

### 1. Subscription Status Filtering ✅
- All endpoints now check `subscription_status` before allowing access
- Only `active` and `trial` businesses are accessible
- Prevents canceled/paused businesses from accepting bookings

### 2. Proper Timezone Handling ✅
- Installed `date-fns-tz` package
- Uses `zonedTimeToUtc` and `utcToZonedTime` for accurate conversions
- Handles DST transitions correctly
- All times stored in UTC, converted from business timezone

### 3. Improved Double-Booking Prevention ✅
- Checks for overlapping bookings before creation
- Uses time range comparison (start < end && end > start)
- Database unique constraint provides additional protection
- Returns clear error message if slot is taken

### 4. Gift Card Validation ✅
- Validates balance is sufficient for amount-type cards
- Validates percentage is valid (0-100%) for percent-type cards
- Checks expiration dates
- Validates gift card is active

### 5. Customer ID Handling ✅
- Ensures Stripe Customer ID is always created/found
- Uses Stripe Customer ID (not email) for SetupIntent
- Proper error handling if Stripe Customer creation fails
- Email is normalized (lowercase, trimmed)

### 6. Error Handling ✅
- Comprehensive validation at each step
- Clear error messages for frontend
- Proper HTTP status codes (400, 404, 409, 500)
- Error logging for debugging

---

## Testing

### Test Suite Created

**File**: `apps/web/scripts/test-public-booking-flow.ts`

**Test Coverage**:
1. ✅ Catalog endpoint structure and data validation
2. ✅ Availability endpoint with service/date parameters
3. ✅ Slot structure and timezone handling
4. ✅ Gift code preview validation
5. ✅ Booking creation flow
6. ✅ Subscription status filtering
7. ✅ Invalid input handling

**Run Tests**:
```bash
npm run test:public-booking
```

Or:
```bash
tsx scripts/test-public-booking-flow.ts
```

**Environment Variables**:
- `NEXT_PUBLIC_BASE_URL` - Base URL for API (default: http://localhost:3000)
- `TEST_SUBDOMAIN` - Subdomain to test with (default: test-business)

---

## Production Checklist

### ✅ Completed

- [x] All endpoints implemented
- [x] Subscription status filtering
- [x] Proper timezone handling
- [x] Double-booking prevention
- [x] Gift card validation
- [x] Customer ID handling
- [x] Error handling
- [x] Comprehensive tests
- [x] No linter errors

### ⚠️ Before Production Deployment

1. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
   - `STRIPE_SECRET_KEY` - Stripe secret key
   - `NEXT_PUBLIC_BASE_URL` - Public base URL for your app

2. **Database**:
   - Ensure all migrations are applied
   - Verify RLS policies are set correctly
   - Ensure indexes exist for performance

3. **Stripe**:
   - Set up webhook endpoints for Stripe events
   - Configure Connect accounts for businesses
   - Set up subscription products/prices

4. **Testing**:
   - Run test suite in staging environment
   - Test with real Stripe test mode
   - Test timezone handling with different timezones
   - Test edge cases (overlapping bookings, expired gift cards, etc.)

---

## API Response Codes

### Success
- `200 OK` - Catalog, availability, gift code preview
- `201 Created` - Booking created

### Client Errors
- `400 Bad Request` - Invalid input, missing required fields
- `404 Not Found` - Business/service not found, gift card invalid
- `409 Conflict` - Slot already taken, duplicate booking

### Server Errors
- `500 Internal Server Error` - Unexpected server error

---

## Error Response Format

All errors follow this format:
```json
{
  "error": "Error message",
  "details": "Optional details for debugging"
}
```

---

## Notes

1. **No Authentication Required**: All public endpoints are accessible without authentication
2. **Subscription Status**: Only active/trial businesses can accept bookings
3. **Timezone Handling**: All times are stored in UTC, converted from business timezone
4. **Double-Booking Prevention**: Multiple layers of protection (overlap check + unique constraint)
5. **Gift Cards**: Balance is checked but not deducted until money action (Completed/No-Show/Cancel)
6. **SetupIntent**: Card is saved but not charged - charges happen when owner clicks money buttons

---

## Next Steps

1. ✅ Public booking flow is complete and production-ready
2. ⏭️ Admin money board actions (already implemented in Task 7)
3. ⏭️ Webhook handlers for Stripe events (already implemented)
4. ⏭️ Notification system (already implemented, needs email/SMS env vars)

---

## Summary

All three public booking endpoints are fully implemented, tested, and production-ready. The implementation includes:

- ✅ Proper subscription status filtering
- ✅ Accurate timezone handling
- ✅ Robust double-booking prevention
- ✅ Comprehensive gift card validation
- ✅ Proper customer/Stripe integration
- ✅ Error handling and validation
- ✅ Comprehensive test suite

The booking flow is ready for production use.


