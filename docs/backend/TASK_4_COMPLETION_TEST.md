# Task 4 Completion Test Suite

This document provides a comprehensive test checklist to verify that Task 4 (Full Backend Implementation) is 100% complete and working correctly.

## Prerequisites

Before running tests:
- [ ] Database migrations applied
- [ ] Environment variables set (`.env.local` configured)
- [ ] Next.js dev server running (`npm run dev`)
- [ ] Supabase project active
- [ ] Stripe test keys configured (for payment tests)

---

## Test 1: Authentication & User Setup

### 1.1 User Signup
- [ ] Create a test user via Supabase Auth
- [ ] Verify user can log in and get JWT token
- [ ] Verify `getCurrentUserId()` returns correct user ID

**Test Command**:
```bash
# Sign up via Supabase Auth (use Supabase dashboard or API)
# Then test auth helper
curl -X GET http://localhost:3000/api/test-db \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Returns user's data, not 401

---

## Test 2: Onboarding Endpoints (11 steps)

### 2.1 Step 1: Business Basics
- [ ] `PUT /api/business/onboarding/step-1-business` creates business
- [ ] Business row exists in database
- [ ] Returns `{success: true, businessId}`

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-1-business \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Salon",
    "description": "A test business",
    "doingBusinessAs": "Test DBA",
    "legalName": "Test Salon LLC",
    "industry": "Salon"
  }'
```

**Expected**: `{"success": true, "businessId": "uuid", ...}`

### 2.2 Step 2: Website/Subdomain
- [ ] `PUT /api/business/onboarding/step-2-website` validates subdomain
- [ ] Subdomain saved to database
- [ ] Returns booking URL

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-2-website \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "testsalon", "status": "reserved"}'
```

**Expected**: `{"success": true, "subdomain": "testsalon", "bookingUrl": "https://testsalon.tithi.com"}`

### 2.3 Step 3: Location & Contacts
- [ ] `PUT /api/business/onboarding/step-3-location` saves address
- [ ] Timezone, phone, email, address fields updated

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-3-location \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York",
    "phone": "+1-555-0100",
    "supportEmail": "support@testsalon.com",
    "addressLine1": "123 Main St",
    "city": "New York",
    "stateProvince": "NY",
    "postalCode": "10001",
    "country": "USA"
  }'
```

**Expected**: `{"success": true}`

### 2.4 Step 4: Team/Staff
- [ ] `PUT /api/business/onboarding/step-4-team` creates staff
- [ ] Staff rows exist in database
- [ ] Returns staff IDs

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-4-team \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "staff": [
      {"id": "stf1", "name": "Jane Doe", "role": "Stylist", "color": "#FF0000", "active": true}
    ]
  }'
```

**Expected**: `{"success": true, "staffIds": ["uuid"]}`

### 2.5 Step 5: Branding
- [ ] `PUT /api/business/onboarding/step-5-branding` saves colors/logo
- [ ] Brand colors updated in database

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-5-branding \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#FF5733",
    "logoUrl": "https://example.com/logo.png"
  }'
```

**Expected**: `{"success": true}`

### 2.6 Step 6: Services & Categories
- [ ] `PUT /api/business/onboarding/step-6-services` creates categories/services
- [ ] Categories and services exist in database
- [ ] Services linked to categories

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-6-services \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": [{
      "id": "cat1",
      "name": "Hair Services",
      "color": "#0000FF",
      "services": [{
        "id": "svc1",
        "name": "Haircut",
        "durationMinutes": 30,
        "priceCents": 5000,
        "description": "Basic haircut"
      }]
    }]
  }'
```

**Expected**: `{"success": true, "categoryIds": ["uuid"], "serviceIds": ["uuid"]}`

### 2.7 Step 7: Availability
- [ ] `PUT /api/business/onboarding/step-7-availability` creates availability rules
- [ ] Availability rules exist in database
- [ ] Rules linked to staff and services

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-7-availability \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "availability": [{
      "serviceId": "svc1",
      "staff": [{
        "staffId": "stf1",
        "slots": [{
          "day": "monday",
          "startTime": "09:00",
          "endTime": "17:00"
        }]
      }]
    }]
  }'
```

**Expected**: `{"success": true}`

### 2.8 Step 8: Notifications
- [ ] `PUT /api/business/onboarding/step-8-notifications` creates templates
- [ ] Notification templates exist in database

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-8-notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templates": [{
      "name": "Booking Confirmation",
      "channel": "email",
      "category": "confirmation",
      "trigger": "booking_created",
      "subject": "Booking Confirmed",
      "body": "Hi ${customer.name}, your booking is confirmed!"
    }]
  }'
```

**Expected**: `{"success": true, "templateIds": ["uuid"]}`

### 2.9 Step 9: Policies
- [ ] `PUT /api/business/onboarding/step-9-policies` creates policy version
- [ ] Policy row exists with version 1
- [ ] Fee types and values saved

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-9-policies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancellationPolicy": "Cancel 24h before",
    "cancellationFeeType": "percent",
    "cancellationFeeValue": 50,
    "noShowPolicy": "No-show fee applies",
    "noShowFeeType": "amount",
    "noShowFeeValue": 2000,
    "refundPolicy": "Refunds within 7 days",
    "cashPolicy": "Cash accepted"
  }'
```

**Expected**: `{"success": true, "policyId": "uuid", "version": 1}`

### 2.10 Step 10: Gift Cards
- [ ] `PUT /api/business/onboarding/step-10-gift-cards` saves config
- [ ] Gift card config stored (or cards created)

**Test Command**:
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-10-gift-cards \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "amountType": "amount",
    "amountValue": 5000,
    "generatedCodes": ["TEST50"]
  }'
```

**Expected**: `{"success": true}`

### 2.11 Step 11: Payment Setup
- [ ] `POST /api/business/onboarding/step-11-payment-setup` creates Stripe Connect account
- [ ] Returns Account Link URL (or saves account ID if returning)
- [ ] Subscription created in Stripe
- [ ] Stripe IDs saved to database

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/business/onboarding/step-11-payment-setup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected**: `{"success": true, "accountLinkUrl": "https://connect.stripe.com/..."}` or `{"success": true, "subscriptionId": "sub_..."}`

### 2.12 Complete/Go Live
- [ ] `POST /api/business/onboarding/complete` finalizes onboarding
- [ ] Business marked as active/live
- [ ] Returns booking URL

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/business/onboarding/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: `{"success": true, "businessId": "uuid", "bookingUrl": "https://testsalon.tithi.com"}`

---

## Test 3: Stripe Integration

### 3.1 Stripe Connect Account
- [ ] Connect account created in Stripe
- [ ] `stripe_connect_account_id` saved to businesses table
- [ ] Account Link URL generated correctly

### 3.2 Subscription
- [ ] Subscription created in Stripe ($11.99/mo)
- [ ] `stripe_subscription_id` saved to businesses table
- [ ] Subscription status synced

### 3.3 Webhook Handler
- [ ] `POST /api/webhooks/stripe` accepts webhook events
- [ ] Webhook signature verified
- [ ] `customer.subscription.updated` updates database
- [ ] `payment_intent.succeeded` updates booking payment
- [ ] `setup_intent.succeeded` confirms card saved
- [ ] `charge.refunded` updates booking status

**Test Command** (simulate webhook):
```bash
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: YOUR_SIGNATURE" \
  -d '{
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test",
        "amount": 5000,
        "status": "succeeded"
      }
    }
  }'
```

**Expected**: Returns 200, updates database

---

## Test 4: Public Booking Flow

### 4.1 Catalog Endpoint
- [ ] `GET /api/public/{subdomain}/catalog` returns business data
- [ ] Returns categories, services, staff
- [ ] No authentication required
- [ ] Only active services/categories returned

**Test Command**:
```bash
curl http://localhost:3000/api/public/testsalon/catalog
```

**Expected**: `{business: {...}, categories: [...], services: [...], staff: [...]}`

### 4.2 Availability Endpoint
- [ ] `GET /api/public/{subdomain}/availability?service_id={id}&date=YYYY-MM-DD` returns slots
- [ ] Slots generated correctly (15-min increments)
- [ ] Blackouts respected
- [ ] Existing bookings excluded
- [ ] Lead time enforced
- [ ] Returns staff-specific slots

**Test Command**:
```bash
curl "http://localhost:3000/api/public/testsalon/availability?service_id=svc1&date=2025-01-20"
```

**Expected**: `[{staff_id: "uuid", staff_name: "Jane Doe", start_at: "...", end_at: "..."}]`

### 4.3 Gift Code Preview
- [ ] `POST /api/public/{subdomain}/gift-codes/preview` validates code
- [ ] Returns discount amount
- [ ] Returns final price
- [ ] Rejects invalid/expired codes

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/public/testsalon/gift-codes/preview \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST50", "base_price_cents": 5000}'
```

**Expected**: `{discount_cents: 5000, final_price_cents: 0, type: "amount"}` or error if invalid

### 4.4 Booking Creation
- [ ] `POST /api/public/{subdomain}/bookings` creates booking
- [ ] Customer row created/found
- [ ] Booking row created (status='pending')
- [ ] SetupIntent created in Stripe
- [ ] Booking payment row created
- [ ] Policy snapshot stored
- [ ] Consent info logged
- [ ] Returns client_secret for SetupIntent

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/public/testsalon/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "svc1",
    "staff_id": "stf1",
    "start_at": "2025-01-20T14:00:00Z",
    "customer": {
      "name": "John Customer",
      "email": "customer@example.com",
      "phone": "+1-555-0101"
    },
    "gift_card_code": "TEST50"
  }'
```

**Expected**: `{booking_id: "uuid", booking_code: "TITHI-123", client_secret: "seti_..."}`

### 4.5 Double-Booking Prevention
- [ ] Cannot create two bookings for same staff/time
- [ ] Unique index prevents overlaps
- [ ] Returns error if slot taken

**Test Command**: Try to create two bookings for same slot
**Expected**: Second request fails with conflict error

---

## Test 5: Admin Money Board

### 5.1 List Bookings
- [ ] `GET /api/admin/bookings` returns bookings
- [ ] Filters by status work
- [ ] Filters by date range work
- [ ] Pagination works (cursor-based)
- [ ] Returns customer, service, staff info
- [ ] Only returns current user's bookings (RLS)

**Test Command**:
```bash
curl "http://localhost:3000/api/admin/bookings?status=pending&from=2025-01-01&to=2025-12-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: `{items: [...], next_page_token: "..."}`

### 5.2 Complete Action
- [ ] `POST /api/admin/bookings/{id}/complete` charges full amount
- [ ] PaymentIntent created in Stripe
- [ ] Charge goes to Connect account
- [ ] Platform fee (1%) applied
- [ ] Booking payment row created
- [ ] Booking status updated to 'completed'
- [ ] Idempotency works (double-click safe)
- [ ] Gift card balance deducted (if amount-type)

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/admin/bookings/{booking_id}/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Idempotency-Key: test-key-123" \
  -H "Content-Type: application/json"
```

**Expected**: `{status: "CHARGED", charge_amount: 5000, receipt_url: "..."}`

### 5.3 No-Show Action
- [ ] `POST /api/admin/bookings/{id}/no-show` charges no-show fee
- [ ] Fee calculated from policy snapshot
- [ ] PaymentIntent created
- [ ] Booking status updated to 'no_show'
- [ ] Works with 0 fee (just marks, no charge)

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/admin/bookings/{booking_id}/no-show \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Idempotency-Key: test-key-456"
```

**Expected**: `{status: "FEE_CHARGED", charge_amount: 2000, ...}`

### 5.4 Cancel Action
- [ ] `POST /api/admin/bookings/{id}/cancel` charges cancellation fee
- [ ] Fee calculated from policy snapshot
- [ ] Booking status updated to 'cancelled'
- [ ] Works with 0 fee

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/admin/bookings/{booking_id}/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Idempotency-Key: test-key-789"
```

**Expected**: `{status: "FEE_CHARGED", charge_amount: 2500, ...}`

### 5.5 Refund Action
- [ ] `POST /api/admin/bookings/{id}/refund` refunds charge
- [ ] Refund created in Stripe
- [ ] Booking status updated to 'refunded'
- [ ] Gift card balance restored (if setting enabled)
- [ ] No-op if no charge exists (returns message)

**Test Command**:
```bash
curl -X POST http://localhost:3000/api/admin/bookings/{booking_id}/refund \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Idempotency-Key: test-key-101"
```

**Expected**: `{status: "REFUNDED", refund_amount: 5000, ...}`

### 5.6 Idempotency
- [ ] Same idempotency key returns cached response
- [ ] No duplicate charges
- [ ] Works across all money actions

**Test Command**: Send same request twice with same idempotency key
**Expected**: Second request returns same response, no duplicate charge

---

## Test 6: Availability Engine

### 6.1 Slot Generation
- [ ] Slots generated in 15-minute increments
- [ ] Respects service duration
- [ ] Respects business timezone
- [ ] Excludes past times
- [ ] Enforces lead time
- [ ] Excludes blackouts
- [ ] Excludes existing bookings
- [ ] Returns staff-specific slots

**Test Command**: Call availability endpoint with various dates
**Expected**: Correct slots returned, no overlaps, no past times

### 6.2 Blackout Handling
- [ ] Blackouts exclude slots correctly
- [ ] Staff-specific blackouts work
- [ ] Business-wide blackouts work
- [ ] Date range blackouts work

**Test**: Create blackout, check availability
**Expected**: No slots during blackout period

### 6.3 Double-Booking Prevention
- [ ] Unique index prevents overlapping bookings
- [ ] Held slots expire after 5 minutes
- [ ] Expired slots become available again

**Test**: Try to book same slot twice
**Expected**: Second booking fails

---

## Test 7: Notifications System

### 7.1 Template CRUD
- [ ] `GET /api/admin/notifications/templates` lists templates
- [ ] `POST /api/admin/notifications/templates` creates template
- [ ] `PUT /api/admin/notifications/templates/{id}` updates template
- [ ] Placeholders validated

**Test Command**:
```bash
curl http://localhost:3000/api/admin/notifications/templates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: `{templates: [...]}`

### 7.2 Event Emission
- [ ] Booking created → notification job enqueued
- [ ] Booking completed → notification job enqueued
- [ ] Fee charged → notification job enqueued
- [ ] Jobs created in `notification_jobs` table

**Test**: Create booking, check notification_jobs table
**Expected**: Job row created with correct trigger

### 7.3 Placeholder Substitution
- [ ] `${customer.name}` replaced correctly
- [ ] `${service.name}` replaced correctly
- [ ] `${booking.date}` replaced correctly
- [ ] `${booking.time}` replaced correctly
- [ ] All placeholders work

**Test**: Render template with sample data
**Expected**: All placeholders replaced with actual values

### 7.4 Email Sending
- [ ] Notification job processed
- [ ] Email sent via SendGrid (or configured provider)
- [ ] Job status updated to 'sent'
- [ ] Notification event logged

**Test**: Process notification job
**Expected**: Email sent, status updated

### 7.5 Retry Logic
- [ ] Failed sends retry with backoff
- [ ] Max retries enforced (3 attempts)
- [ ] Dead jobs marked correctly

**Test**: Force email failure, check retry behavior
**Expected**: Retries with exponential backoff, marks dead after 3

---

## Test 8: Background Jobs & Cron

### 8.1 Reminder Scheduling
- [ ] `GET /api/cron/reminders` finds bookings needing reminders
- [ ] 24h reminders enqueued
- [ ] 1h reminders enqueued
- [ ] Jobs scheduled correctly

**Test Command**:
```bash
curl http://localhost:3000/api/cron/reminders
```

**Expected**: Jobs created for upcoming bookings

### 8.2 Subscription Health
- [ ] `GET /api/cron/subscription-health` checks Stripe
- [ ] Updates subscription status if out of sync
- [ ] Handles canceled subscriptions

**Test Command**:
```bash
curl http://localhost:3000/api/cron/subscription-health
```

**Expected**: Subscription status synced

### 8.3 Cleanup
- [ ] `GET /api/cron/cleanup` expires held slots
- [ ] Old held bookings marked expired
- [ ] Cleanup runs without errors

**Test Command**:
```bash
curl http://localhost:3000/api/cron/cleanup
```

**Expected**: Held bookings older than 5min expired

---

## Test 9: Gift Cards & Policies

### 9.1 Gift Code Validation
- [ ] Valid codes return discount
- [ ] Invalid codes return error
- [ ] Expired codes rejected
- [ ] Percent codes calculate correctly
- [ ] Amount codes calculate correctly

**Test**: Preview various gift codes
**Expected**: Correct discounts calculated

### 9.2 Gift Card Redemption
- [ ] Gift code applied at booking
- [ ] Final price calculated correctly
- [ ] Balance not deducted until charge (amount-type)
- [ ] Percent codes don't affect balance

**Test**: Create booking with gift code
**Expected**: Discount applied, balance unchanged until charge

### 9.3 Gift Card Balance Updates
- [ ] On Completed: amount-type balance deducted
- [ ] Ledger entry created
- [ ] Balance updated correctly

**Test**: Complete booking with amount-type gift card
**Expected**: Balance deducted, ledger entry created

### 9.4 Gift Card Refund Restore
- [ ] On Refund: balance restored (if setting enabled)
- [ ] Ledger entry created
- [ ] Balance updated correctly

**Test**: Refund booking with gift card
**Expected**: Balance restored (if enabled), ledger entry created

### 9.5 Policy Snapshots
- [ ] Policy snapshot stored at booking time
- [ ] Snapshot includes all policy texts
- [ ] Snapshot includes fee types and values
- [ ] Snapshot used for fee calculations (not current policies)

**Test**: Create booking, check policy_snapshot JSON
**Expected**: Complete policy data stored

### 9.6 Consent Logging
- [ ] Consent timestamp stored
- [ ] IP address stored
- [ ] User agent stored
- [ ] Policy hash stored

**Test**: Create booking with consent
**Expected**: All consent fields populated

---

## Test 10: Security & RLS

### 10.1 Tenant Isolation
- [ ] User A cannot see User B's data
- [ ] RLS policies enforce isolation
- [ ] Cross-tenant queries return empty

**Test**: Query as different users
**Expected**: Each user only sees their own data

### 10.2 Authentication Required
- [ ] Protected endpoints return 401 without auth
- [ ] Public endpoints work without auth
- [ ] JWT tokens validated correctly

**Test**: Call protected endpoint without token
**Expected**: 401 Unauthorized

### 10.3 Data Validation
- [ ] Invalid input returns 400
- [ ] Missing required fields rejected
- [ ] Type validation works

**Test**: Send invalid data to endpoints
**Expected**: 400 Bad Request with error message

---

## Test 11: End-to-End Flow

### 11.1 Complete Onboarding Flow
- [ ] User signs up
- [ ] Completes all 11 onboarding steps
- [ ] Business goes live
- [ ] Booking URL accessible

**Test**: Complete full onboarding
**Expected**: Business live, booking site works

### 11.2 Complete Booking Flow
- [ ] Customer views catalog
- [ ] Customer sees availability
- [ ] Customer creates booking
- [ ] Card saved (no charge)
- [ ] Owner sees booking in admin
- [ ] Owner clicks "Completed"
- [ ] Charge succeeds
- [ ] Notification sent

**Test**: Full booking → charge flow
**Expected**: Everything works end-to-end

### 11.3 No-Show Flow
- [ ] Booking created
- [ ] Owner marks "No-Show"
- [ ] Fee charged
- [ ] Notification sent

**Test**: No-show scenario
**Expected**: Fee charged, notification sent

### 11.4 Refund Flow
- [ ] Booking charged
- [ ] Owner clicks "Refund"
- [ ] Refund processed
- [ ] Balance restored (if gift card)
- [ ] Notification sent

**Test**: Refund scenario
**Expected**: Refund processed, notifications sent

---

## Automated Test Script

See `apps/web/scripts/test-task-4.ts` for automated test runner.

---

## Success Criteria

Task 4 is **100% complete** when:

- ✅ All 11 onboarding endpoints work
- ✅ Stripe Connect + subscription works
- ✅ Webhook handler processes events
- ✅ Public catalog returns data
- ✅ Availability generates correct slots
- ✅ Booking creation saves card (no charge)
- ✅ Admin can list bookings
- ✅ All 4 money actions work (Complete, No-Show, Cancel, Refund)
- ✅ Idempotency prevents duplicates
- ✅ Gift codes validate and apply
- ✅ Notifications send (email at minimum)
- ✅ Background jobs run
- ✅ RLS enforces tenant isolation
- ✅ End-to-end flow works

---

## Test Results Template

```
Date: ___________
Tester: ___________

Test 1: Authentication - [ ] PASS [ ] FAIL
Test 2: Onboarding - [ ] PASS [ ] FAIL
  - Step 1: [ ] PASS [ ] FAIL
  - Step 2: [ ] PASS [ ] FAIL
  - ... (all 11 steps)
Test 3: Stripe - [ ] PASS [ ] FAIL
Test 4: Public Booking - [ ] PASS [ ] FAIL
Test 5: Admin Money Board - [ ] PASS [ ] FAIL
Test 6: Availability Engine - [ ] PASS [ ] FAIL
Test 7: Notifications - [ ] PASS [ ] FAIL
Test 8: Background Jobs - [ ] PASS [ ] FAIL
Test 9: Gift Cards - [ ] PASS [ ] FAIL
Test 10: Security - [ ] PASS [ ] FAIL
Test 11: End-to-End - [ ] PASS [ ] FAIL

Overall: [ ] COMPLETE [ ] INCOMPLETE

Issues Found:
1. ___________
2. ___________
```




