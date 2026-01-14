# 🚀 NEW CHAT PROMPT: Complete Task 4 (Full Backend Implementation)

**Copy everything below this line into a NEW Cursor chat to continue backend implementation**

---

## Context: What's Already Done

I'm building the backend for **Tithi**, a white-label booking SaaS platform. The database and initial setup are complete. I need you to implement the **ENTIRE backend** (Task 4), which includes all API endpoints, Stripe integration, notifications, availability engine, and background jobs.

**⚠️ IMPORTANT: Before starting implementation, read these summary documents for complete context:**
1. **`docs/backend/SESSION_COMPLETE_SUMMARY.md`** - Quick overview of what's done
2. **`docs/backend/SESSION_SUMMARY_AND_NEXT_STEPS.md`** - Detailed session summary with all context

### ✅ Completed Work

1. **Database Schema** - Fully migrated and working
   - File: `supabase/migrations/20250101000000_initial_schema.sql`
   - 18 tables created with RLS policies
   - All indexes and constraints in place
   - Verified: `http://localhost:3000/api/test-db` returns success

2. **Supabase Setup** - Complete
   - File: `apps/web/src/lib/db.ts` - Database client helpers
   - File: `apps/web/src/lib/auth.ts` - Authentication helpers
   - Environment variables configured

3. **First Endpoint** - Created as template
   - File: `apps/web/src/app/api/business/onboarding/step-1-business/route.ts`
   - Pattern to follow for remaining endpoints

### 📚 Critical Reference Documents

**READ THESE FIRST** (they contain all the specs):

**START HERE - Session Summaries** (read these for complete context):
1. **`docs/backend/SESSION_COMPLETE_SUMMARY.md`**
   - Quick reference of what's done
   - Database status verification
   - File locations
   - What's ready to use

2. **`docs/backend/SESSION_SUMMARY_AND_NEXT_STEPS.md`**
   - Complete session summary
   - What was accomplished
   - What needs to be done
   - Detailed breakdown of all phases
   - Key design decisions already locked in

**Then Read These - Technical Specs**:
3. **`docs/backend/baseline-report.md`**
   - Frontend integration points
   - Database schema design
   - API contract requirements
   - What frontend expects

4. **`docs/frontend/backend clarifications`** (4007 lines)
   - Complete backend specification
   - Table-by-table schema details
   - Stripe integration specifics
   - API contracts
   - Notification system design
   - Availability engine algorithm
   - Gift cards & policies logic

5. **`docs/frontend/frontend logistics.txt`**
   - Product requirements
   - Business rules
   - Payment flow (manual capture)
   - Onboarding steps

6. **`docs/backend/implementation-plan.md`**
   - Strategic approach
   - Task breakdown
   - Testing strategy

### 🎯 Your Mission: Complete Task 4

Task 4 includes **EVERYTHING** in the backend implementation plan:

1. ✅ Onboarding endpoints (1 done, 10 remaining)
2. ⏳ Stripe integration (Connect + Billing + Webhooks)
3. ⏳ Public booking flow APIs
4. ⏳ Admin money board APIs
5. ⏳ Availability engine
6. ⏳ Notifications system
7. ⏳ Background jobs & cron
8. ⏳ Gift cards & policies

---

## Implementation Requirements

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL with RLS)
- **Payments**: Stripe Connect Express + Stripe Billing
- **Auth**: Supabase Auth (JWT-based)

### Key Design Rules (DO NOT DEVIATE)

1. **One user = one business** (database enforced)
2. **No money at checkout** - Card saved only (SetupIntent)
3. **Money moves via admin buttons only** - Complete/No-Show/Cancel/Refund
4. **RLS on all tables** - Use `createServerClient()` (respects RLS)
5. **Platform fee**: 1% on all charges
6. **Stripe Connect**: Destination charges to business accounts

### Code Patterns to Follow

**Authentication** (use in all protected endpoints):
```typescript
import { getCurrentUserId } from '@/lib/auth';
import { createServerClient } from '@/lib/db';

const userId = await getCurrentUserId();
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const supabase = await createServerClient();
```

**Database queries** (automatically filtered by RLS):
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);
```

**Reference existing code**:
- `apps/web/src/app/api/business/onboarding/step-1-business/route.ts` - Endpoint pattern
- `apps/web/src/lib/db.ts` - Database client usage
- `apps/web/src/lib/auth.ts` - Auth helper usage

---

## Detailed Implementation Checklist

**⚠️ BEFORE STARTING: Read `docs/backend/SESSION_COMPLETE_SUMMARY.md` and `docs/backend/SESSION_SUMMARY_AND_NEXT_STEPS.md` for complete context on what's been done and the full scope of work.**

### Phase 1: Onboarding Endpoints (10 remaining)

Create these in `apps/web/src/app/api/business/onboarding/`:

#### Step 2: Website/Subdomain
**File**: `step-2-website/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-2-website`
**Body**: `{ subdomain: string, status: "idle" | "validating" | "reserved" | "error" }`
**Logic**:
- Validate subdomain format (alphanumeric, hyphens, 3-63 chars)
- Check if subdomain is available (query `businesses` table)
- Update `businesses.subdomain`
- Return: `{ success: true, subdomain, bookingUrl: "https://{subdomain}.tithi.com" }`

#### Step 3: Location & Contacts
**File**: `step-3-location/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-3-location`
**Body**: `LocationContacts` type (see `onboarding-types.ts`)
**Logic**:
- Update `businesses` table with: timezone, phone, support_email, website, address fields
- Return: `{ success: true }`

#### Step 4: Team/Staff
**File**: `step-4-team/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-4-team`
**Body**: `{ staff: StaffMember[] }` (see `onboarding-types.ts`)
**Logic**:
- Delete existing staff for this business (soft delete: set `deleted_at`)
- Insert new staff rows
- Return: `{ success: true, staffIds: [...] }`

#### Step 5: Branding
**File**: `step-5-branding/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-5-branding`
**Body**: `BrandingConfig` type
**Logic**:
- Update `businesses` with: `brand_primary_color`, `brand_secondary_color`, `logo_url`
- Return: `{ success: true }`

#### Step 6: Services & Categories
**File**: `step-6-services/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-6-services`
**Body**: `{ categories: ServiceCategory[] }` (see `onboarding-types.ts`)
**Logic**:
- For each category:
  - Upsert `service_categories` (delete old, insert new)
  - For each service in category:
    - Upsert `services` (delete old, insert new)
- Return: `{ success: true, categoryIds: [...], serviceIds: [...] }`

#### Step 7: Availability
**File**: `step-7-availability/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-7-availability`
**Body**: `{ availability: ServiceAvailability[] }` (see `onboarding-types.ts`)
**Logic**:
- Delete existing `availability_rules` for this business
- For each service availability:
  - For each staff availability:
    - For each slot:
      - Insert `availability_rules` row (rule_type='weekly', weekday, start_time, end_time)
- Return: `{ success: true }`

#### Step 8: Notifications
**File**: `step-8-notifications/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-8-notifications`
**Body**: `{ templates: NotificationTemplate[] }`
**Logic**:
- Upsert `notification_templates` (delete old, insert new)
- Return: `{ success: true, templateIds: [...] }`

#### Step 9: Policies
**File**: `step-9-policies/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-9-policies`
**Body**: `PoliciesConfig` type
**Logic**:
- Get current policy version
- Insert new `business_policies` row with incremented version
- Mark old version as `is_active = false`
- Return: `{ success: true, policyId, version }`

#### Step 10: Gift Cards
**File**: `step-10-gift-cards/route.ts`
**Endpoint**: `PUT /api/business/onboarding/step-10-gift-cards`
**Body**: `GiftCardConfig` type
**Logic**:
- Store gift card settings (this is just config, actual cards created later)
- For generated codes, insert `gift_cards` rows
- Return: `{ success: true }`

#### Step 11: Payment Setup
**File**: `step-11-payment-setup/route.ts`
**Endpoint**: `POST /api/business/onboarding/step-11-payment-setup`
**Body**: `{ connectAccountId?: string }` (if returning from Stripe)
**Logic**:
- If `connectAccountId` provided: verify account, save to `businesses.stripe_connect_account_id`
- If not: create Stripe Connect Express account, return Account Link URL
- Create Stripe subscription for $11.99/mo
- Save: `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`
- Return: `{ success: true, accountLinkUrl?: string, subscriptionId }`

#### Complete/Go Live
**File**: `complete/route.ts`
**Endpoint**: `POST /api/business/onboarding/complete`
**Logic**:
- Verify all required data is present
- Mark business as active (or set a flag)
- Return: `{ success: true, businessId, bookingUrl }`

---

### Phase 2: Stripe Integration

#### Stripe Client Helper
**File**: `apps/web/src/lib/stripe.ts`
**Functions needed**:
```typescript
export function getStripeClient() // Returns Stripe instance
export async function createConnectAccount(userId: string) // Create Express account
export async function createAccountLink(accountId: string) // Get onboarding URL
export async function createSubscription(customerId: string, priceId: string) // $11.99/mo
export async function createSetupIntent(customerId: string) // Save card
export async function createPaymentIntent(params: {
  amount: number;
  customerId: string;
  paymentMethodId: string;
  connectAccountId: string;
  applicationFee: number;
}) // Charge with Connect
export async function createRefund(paymentIntentId: string, amount?: number) // Refund
```

#### Webhook Handler
**File**: `apps/web/src/app/api/webhooks/stripe/route.ts`
**Endpoint**: `POST /api/webhooks/stripe`
**Logic**:
- Verify webhook signature
- Handle events:
  - `customer.subscription.updated` → update `subscription_status`
  - `invoice.payment_succeeded` → mark subscription active
  - `invoice.payment_failed` → mark subscription past_due
  - `payment_intent.succeeded` → update `booking_payments.status = 'charged'`
  - `payment_intent.payment_failed` → update `booking_payments.status = 'failed'`
  - `charge.refunded` → update booking status
  - `setup_intent.succeeded` → confirm card saved
- Return 200 to acknowledge

**Reference**: `docs/frontend/backend clarifications` lines 1292-2305

---

### Phase 3: Public Booking Flow

#### Catalog Endpoint
**File**: `apps/web/src/app/api/public/[slug]/catalog/route.ts`
**Endpoint**: `GET /api/public/{slug}/catalog`
**Logic**:
- Query `businesses` by subdomain (no auth required)
- Query `service_categories` with `services` (active only)
- Query `staff` (active only)
- Return: `{ business: {...}, categories: [...], staff: [...] }`

#### Availability Endpoint
**File**: `apps/web/src/app/api/public/[slug]/availability/route.ts`
**Endpoint**: `GET /api/public/{slug}/availability?service_id={id}&date=YYYY-MM-DD`
**Logic**:
- Use availability engine (see Phase 5)
- Return: `[{staff_id, staff_name, start_at, end_at}]`

#### Booking Creation
**File**: `apps/web/src/app/api/public/[slug]/bookings/route.ts`
**Endpoint**: `POST /api/public/{slug}/bookings`
**Body**: `{ service_id, staff_id, start_at, customer: {name, email, phone}, gift_card_code? }`
**Logic**:
- Validate slot available (check unique index)
- Validate gift code if provided
- Compute `final_price_cents`
- Create/find `customers` row
- Get current `business_policies`, create snapshot JSON
- Create `bookings` row (status='pending', payment_status='card_saved')
- Create Stripe SetupIntent
- Create `booking_payments` row
- Store consent info (IP, user-agent, timestamp)
- Return: `{ booking_id, booking_code, client_secret }`

#### Gift Code Preview
**File**: `apps/web/src/app/api/public/[slug]/gift-codes/preview/route.ts`
**Endpoint**: `POST /api/public/{slug}/gift-codes/preview`
**Body**: `{ code: string, base_price_cents: number }`
**Logic**:
- Validate code exists, active, not expired
- Compute discount (amount or percent)
- Return: `{ discount_cents, final_price_cents, type }`

---

### Phase 4: Admin Money Board

#### List Bookings
**File**: `apps/web/src/app/api/admin/bookings/route.ts`
**Endpoint**: `GET /api/admin/bookings?status=&from=&to=&cursor=`
**Logic**:
- Query `bookings` with joins to customers, services, staff
- Filter by status, date range
- Pagination: cursor-based
- Return: `{ items: [...], next_page_token }`

#### Money Actions (4 endpoints)
**Files**: 
- `apps/web/src/app/api/admin/bookings/[id]/complete/route.ts`
- `apps/web/src/app/api/admin/bookings/[id]/no-show/route.ts`
- `apps/web/src/app/api/admin/bookings/[id]/cancel/route.ts`
- `apps/web/src/app/api/admin/bookings/[id]/refund/route.ts`

**Shared Logic**:
1. Get `X-Idempotency-Key` header
2. Check `idempotency_keys` table (if exists, return cached response)
3. Look up booking, business, customer
4. Compute amount:
   - Complete → `final_price_cents`
   - No-Show → fee from `policy_snapshot.no_show_fee_*`
   - Cancel → fee from `policy_snapshot.cancel_fee_*`
   - Refund → amount from previous charge
5. Create Stripe PaymentIntent (or Refund) with Connect destination
6. Insert `booking_payments` row
7. Update `bookings.status`, `payment_status`, `last_money_action`
8. Handle gift card balance (if amount-type and Completed)
9. Store idempotency key + response
10. Return: `{ status, charge_amount, receipt_url }`

**Reference**: `docs/frontend/backend clarifications` lines 2437-2548

---

### Phase 5: Availability Engine

**File**: `apps/web/src/lib/availability.ts`

**Function**: `generateAvailabilitySlots(params: { serviceId, date, businessId })`

**Algorithm** (from clarifications):
1. Load `availability_rules` for that service + staff (where rule_type='weekly')
2. Load `blackouts` for that date (staff-specific or global)
3. Load existing `bookings` for that date (status IN ('pending', 'scheduled', 'held'))
4. Get business timezone
5. For each staff that can perform service:
   - Get weekly rules for that weekday
   - Convert start_time/end_time to actual timestamps
   - Walk in 15-minute increments
   - For each candidate slot:
     - Check: after lead time, before rule end, not in blackout, not overlapping booking
   - Add to results
6. Return: `[{staff_id, staff_name, start_at, end_at}]`

**Reference**: `docs/frontend/backend clarifications` lines 2831-3116

---

### Phase 6: Notifications System

#### Template CRUD
**File**: `apps/web/src/app/api/admin/notifications/templates/route.ts`
**Endpoints**:
- `GET /api/admin/notifications/templates` - List all
- `POST /api/admin/notifications/templates` - Create
- `PUT /api/admin/notifications/templates/{id}` - Update

#### Notification Helper
**File**: `apps/web/src/lib/notifications.ts`
**Functions**:
```typescript
export async function enqueueNotification(params: {
  businessId: string;
  bookingId: string;
  trigger: NotificationTrigger;
}) // Create notification_jobs row

export async function renderTemplate(
  template: NotificationTemplate,
  data: { booking, customer, service, business }
) // Substitute placeholders

export async function sendNotification(job: NotificationJob) // Send via email/SMS
```

#### Job Processor
**File**: `apps/web/src/app/api/cron/notifications/route.ts`
**Endpoint**: `GET /api/cron/notifications` (called by cron)
**Logic**:
- Query `notification_jobs` where status='pending'
- For each job:
  - Load template
  - Render with placeholders
  - Send via SendGrid (email) or Twilio (SMS)
  - Update status
  - On failure: retry with exponential backoff

**Placeholders**: `${customer.name}`, `${service.name}`, `${booking.date}`, etc.

**Reference**: `docs/frontend/backend clarifications` lines 2649-2830

---

### Phase 7: Background Jobs & Cron

#### Reminders Cron
**File**: `apps/web/src/app/api/cron/reminders/route.ts`
**Endpoint**: `GET /api/cron/reminders`
**Logic**:
- Find bookings happening in next 24h (not reminded yet)
- Enqueue 24h reminder jobs
- Find bookings happening in next 1h (not reminded yet)
- Enqueue 1h reminder jobs
- Run every 5-10 minutes

#### Subscription Health
**File**: `apps/web/src/app/api/cron/subscription-health/route.ts`
**Endpoint**: `GET /api/cron/subscription-health`
**Logic**:
- Query Stripe for subscription status
- Compare with database
- Update if out of sync
- Run daily

#### Cleanup Cron
**File**: `apps/web/src/app/api/cron/cleanup/route.ts`
**Endpoint**: `GET /api/cron/cleanup`
**Logic**:
- Expire held bookings older than 5 minutes
- Mark as 'expired' or delete
- Run every minute

**Reference**: `docs/frontend/backend clarifications` lines 3638-4006

---

### Phase 8: Gift Cards & Policies

**Already covered in**:
- Gift code preview endpoint (Phase 3)
- Gift code redemption (Phase 3 - booking creation)
- Gift card balance updates (Phase 4 - money actions)
- Policy snapshots (Phase 3 - booking creation)

**Additional logic needed**:
- On Completed: if amount-type gift card, deduct balance, write ledger
- On Refund: if amount-type and setting enabled, restore balance

**Reference**: `docs/frontend/backend clarifications` lines 3152-3635

---

## Testing Strategy

After each phase:
1. Test endpoint with curl/Postman
2. Verify data in Supabase Dashboard
3. Check RLS is working (can't see other users' data)
4. Test error cases (invalid input, missing auth, etc.)

## Environment Variables

Add to `apps/web/.env.local`:
- `STRIPE_SECRET_KEY` (from Stripe dashboard)
- `STRIPE_WEBHOOK_SECRET` (from Stripe webhooks)
- `STRIPE_PLAN_PRODUCT_ID` (create in Stripe)
- `STRIPE_PLAN_PRICE_ID` (create in Stripe)
- `SENDGRID_API_KEY` (optional, for emails)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (optional, for SMS)

## Testing & Verification

After implementing Task 4, verify completion using:

1. **`docs/backend/TASK_4_COMPLETION_TEST.md`** - Comprehensive manual test checklist
2. **`docs/backend/TASK_4_QUICK_CHECKLIST.md`** - Quick verification checklist
3. **`apps/web/scripts/test-task-4.ts`** - Automated infrastructure tests
4. **`docs/backend/TEST_SUITE_README.md`** - Test suite documentation

Run automated tests:
```bash
cd apps/web
npm run test:task4
```

## Success Criteria

Task 4 is complete when:
- ✅ All 11 onboarding endpoints work
- ✅ Stripe Connect + subscription works
- ✅ Public booking flow works
- ✅ Admin money board works
- ✅ Availability slots generate correctly
- ✅ Notifications send
- ✅ Background jobs run
- ✅ Gift cards work

**Start implementing in the order listed above. Test each phase before moving to the next.**

---

**END OF PROMPT - Copy everything above this line into new chat**

