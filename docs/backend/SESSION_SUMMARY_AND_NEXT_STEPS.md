# Tithi Backend Implementation - Session Summary & Next Steps

## 📋 Session Summary: What Was Completed

### ✅ Task 1: Baseline Analysis
- **Created**: `docs/backend/baseline-report.md`
- **Content**: Complete analysis of frontend codebase, API integration points, database schema design, and implementation strategy
- **Key Findings**:
  - Frontend uses fake/mock data (`useFakeBusiness`, `useFakeSession`)
  - Onboarding has 11 steps that need API endpoints
  - Admin pages need booking management APIs
  - Public booking flow needs catalog, availability, and booking creation APIs
  - Money board needs 4 action endpoints (Complete, No-Show, Cancel, Refund)

### ✅ Task 2: Database Schema Design
- **Created**: `docs/backend/baseline-report.md` (schema section)
- **Content**: Complete database model extracted from `backend clarifications`
- **Tables Identified**: 18 tables (businesses, services, bookings, payments, etc.)
- **Enums Identified**: 8 enum types (booking_status, payment_status, etc.)

### ✅ Task 3: Supabase Setup
- **Created Files**:
  - `apps/web/src/lib/db.ts` - Database client helpers (createServerClient, createAdminClient, createClientClient)
  - `apps/web/src/app/api/test-db/route.ts` - Test endpoint
  - `apps/web/ENV_SETUP.md` - Environment variables guide
  - `docs/backend/task-3-supabase-setup-complete.md` - Documentation
- **Status**: ✅ Complete - Connection verified, tables exist

### ✅ Task 4 (Partial): Database Migrations
- **Created Files**:
  - `supabase/migrations/20250101000000_initial_schema.sql` - Complete schema (601 lines)
  - `supabase/migrations/20250101000001_fix_booking_status_enum.sql` - Fix migration
  - `supabase/README.md` - Migration instructions
  - `docs/backend/task-4-migrations-complete.md` - Documentation
- **What It Creates**:
  - 8 ENUM types (booking_status includes 'held' for checkout holds)
  - 18 tables with all columns, foreign keys, constraints
  - 30+ indexes for performance
  - RLS policies for all tenant tables
  - Auto-update triggers for `updated_at` columns
- **Status**: ✅ Complete - Migration successfully run, all tables exist

### ✅ Task 4 (Partial): First API Endpoint
- **Created Files**:
  - `apps/web/src/lib/auth.ts` - Authentication helpers (getCurrentUserId, getCurrentBusinessId)
  - `apps/web/src/app/api/business/onboarding/step-1-business/route.ts` - First onboarding endpoint
  - `docs/backend/task-4-onboarding-api-start.md` - Documentation
- **Status**: 🚧 Started - Only 1 of 11+ endpoints created

---

## 🎯 What Needs to Be Done: Complete Task 4 (Full Backend Implementation)

**Task 4 is NOT just onboarding endpoints** - it includes the ENTIRE backend implementation per the implementation plan:

### Phase 1: Onboarding & Admin APIs (Steps 1-11)
- ✅ Step 1: Business basics (DONE)
- ⏳ Step 2: Website/subdomain
- ⏳ Step 3: Location & contacts
- ⏳ Step 4: Team/staff
- ⏳ Step 5: Branding
- ⏳ Step 6: Services & categories
- ⏳ Step 7: Availability rules
- ⏳ Step 8: Notifications templates
- ⏳ Step 9: Policies
- ⏳ Step 10: Gift cards
- ⏳ Step 11: Payment setup (Stripe Connect + subscription)
- ⏳ Complete/Go Live endpoint

### Phase 2: Stripe Integration
- ⏳ Stripe Connect account creation
- ⏳ Subscription billing ($11.99/mo)
- ⏳ Webhook handler for Stripe events
- ⏳ Payment helpers (SetupIntent, PaymentIntent, Refund)

### Phase 3: Public Booking Flow
- ⏳ Catalog endpoint (`GET /api/public/{subdomain}/catalog`)
- ⏳ Availability endpoint (`GET /api/public/{subdomain}/availability`)
- ⏳ Booking creation (`POST /api/public/{subdomain}/bookings`)
- ⏳ Gift code preview endpoint

### Phase 4: Admin Money Board
- ⏳ List bookings (`GET /api/admin/bookings`)
- ⏳ Complete action (`POST /api/admin/bookings/{id}/complete`)
- ⏳ No-show action (`POST /api/admin/bookings/{id}/no-show`)
- ⏳ Cancel action (`POST /api/admin/bookings/{id}/cancel`)
- ⏳ Refund action (`POST /api/admin/bookings/{id}/refund`)
- ⏳ Idempotency handling

### Phase 5: Availability Engine
- ⏳ Slot generation algorithm (15-min increments)
- ⏳ Blackout handling
- ⏳ Double-booking prevention
- ⏳ Held slot expiration

### Phase 6: Notifications System
- ⏳ Template CRUD endpoints
- ⏳ Event emission on booking actions
- ⏳ Job queue system
- ⏳ Worker/cron for sending emails/SMS
- ⏳ Placeholder substitution

### Phase 7: Background Jobs & Cron
- ⏳ Jobs table (already in schema)
- ⏳ Reminder scheduling (24h/1h before appointments)
- ⏳ Subscription health checks
- ⏳ Cleanup tasks (expire held slots, etc.)

### Phase 8: Gift Cards & Policies
- ⏳ Gift code validation/preview
- ⏳ Redemption logic
- ⏳ Policy snapshot on booking
- ⏳ Consent logging

---

## 📚 Critical Reference Documents

All context is in these files (READ THESE FIRST):

1. **`docs/backend/baseline-report.md`** - Complete frontend/backend analysis
   - Frontend integration points
   - Database schema design
   - API contract requirements

2. **`docs/frontend/backend clarifications`** - Complete backend specification
   - Auth & tenancy model
   - Database schema (table-by-table)
   - Stripe integration details
   - API contracts
   - Notifications system
   - Availability engine
   - Gift cards & policies
   - Operations & tooling

3. **`docs/frontend/frontend logistics.txt`** - Product requirements
   - Business rules
   - User flows
   - Payment flow (manual capture)
   - Onboarding steps

4. **`docs/backend/implementation-plan.md`** - Strategic plan
   - Phased approach
   - Task breakdown
   - Testing strategy

---

## 🔑 Key Design Decisions (Already Locked In)

### Authentication & Tenancy
- **One user = one business** (enforced by `UNIQUE (user_id)` on businesses)
- **Supabase Auth with JWT** (not sessions)
- **RLS policies** on all tenant tables: `user_id = auth.uid()`
- **No staff logins** - staff are data only, not authenticated users
- **No customer logins** - customers just provide name/email/phone at checkout

### Payment Flow
- **Card saved at checkout** (SetupIntent) - NO charge yet
- **Money moves ONLY when owner clicks buttons** in Past Bookings:
  - Completed → charge full amount
  - No-Show → charge no-show fee (from policy)
  - Cancelled → charge cancellation fee (from policy)
  - Refund → refund previous charge
- **Platform fee**: 1% on all charges
- **Stripe Connect**: Each business has Express account, destination charges

### Database Schema
- **All tables have**: `id` (uuid), `user_id`, `business_id`, `created_at`, `updated_at`
- **Soft deletes**: Most tables have `deleted_at` (except bookings, payments)
- **Policy snapshots**: Bookings store frozen policy JSON at booking time
- **Double-booking prevention**: Partial unique index on `(staff_id, start_at)` for active statuses

---

## 🚀 Detailed Instructions for New Chat (Option A)

### Context to Provide in New Chat

Copy this entire section into your new chat prompt:

---

**PROMPT START:**

I'm building the backend for Tithi, a white-label booking SaaS platform. I need you to complete **Task 4: Full Backend Implementation** which includes ALL backend work, not just API endpoints.

### Current Status

✅ **COMPLETED:**
- Database schema created and migrated (`supabase/migrations/20250101000000_initial_schema.sql`)
- All 18 tables exist with RLS policies
- Supabase client helpers created (`apps/web/src/lib/db.ts`)
- Auth helpers created (`apps/web/src/lib/auth.ts`)
- First onboarding endpoint created (`step-1-business`)
- Test endpoint working (`/api/test-db` returns success)

⏳ **NEEDS TO BE DONE:**
Everything else in the backend implementation plan (see below).

### Critical Reference Documents (READ THESE FIRST)

1. **`docs/backend/baseline-report.md`** - Complete analysis of frontend expectations and database design
2. **`docs/frontend/backend clarifications`** - Complete backend specification (4007 lines)
3. **`docs/frontend/frontend logistics.txt`** - Product requirements and business rules
4. **`docs/backend/implementation-plan.md`** - Strategic implementation plan

### Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React
- **Backend**: Next.js API routes (`apps/web/src/app/api/...`)
- **Database**: Supabase (PostgreSQL with RLS)
- **Payments**: Stripe Connect Express + Stripe Billing
- **Auth**: Supabase Auth (JWT-based)

### Key Design Rules (DO NOT DEVIATE)

1. **One user = one business** - Enforced by database constraint
2. **No money moves at checkout** - Card saved only (SetupIntent)
3. **Money moves only via admin buttons** - Complete/No-Show/Cancel/Refund
4. **RLS on all tables** - `user_id = auth.uid()` pattern
5. **Platform fee**: 1% on all charges
6. **Stripe Connect**: Destination charges to business accounts

### What to Implement (Complete Task 4)

#### 1. Onboarding API Endpoints (10 remaining)

Create these route handlers in `apps/web/src/app/api/business/onboarding/`:

- `PUT /api/business/onboarding/step-2-website` - Subdomain validation & reservation
- `PUT /api/business/onboarding/step-3-location` - Address, timezone, contacts  
- `PUT /api/business/onboarding/step-4-team` - Staff members (CRUD)
- `PUT /api/business/onboarding/step-5-branding` - Logo, colors
- `PUT /api/business/onboarding/step-6-services` - Categories & services (CRUD)
- `PUT /api/business/onboarding/step-7-availability` - Availability rules per staff/service
- `PUT /api/business/onboarding/step-8-notifications` - Notification templates (CRUD)
- `PUT /api/business/onboarding/step-9-policies` - Business policies (versioned)
- `PUT /api/business/onboarding/step-10-gift-cards` - Gift card config
- `POST /api/business/onboarding/step-11-payment-setup` - Stripe Connect + subscription
- `POST /api/business/onboarding/complete` - Finalize onboarding (Go Live)

**Pattern to follow** (from `step-1-business/route.ts`):
- Use `getCurrentUserId()` from `@/lib/auth`
- Return 401 if not authenticated
- Validate request body
- Use `createServerClient()` from `@/lib/db`
- Update or create records in database
- Return JSON response

**Reference the TypeScript types** in `apps/web/src/lib/onboarding-types.ts` for request/response shapes.

#### 2. Stripe Integration

**Files to create:**
- `apps/web/src/lib/stripe.ts` - Stripe client + helper functions
- `apps/web/src/app/api/webhooks/stripe/route.ts` - Webhook handler

**Functions needed:**
- `createStripeConnectAccount()` - Create Express account, return Account Link URL
- `createSubscription()` - Create $11.99/mo subscription
- `createSetupIntent()` - For saving card at checkout
- `createPaymentIntent()` - For charging on admin actions
- `createRefund()` - For refunding charges

**Webhook events to handle:**
- `customer.subscription.updated` → update `subscription_status`
- `invoice.payment_succeeded` → mark subscription active
- `invoice.payment_failed` → mark subscription past_due
- `payment_intent.succeeded` → update booking payment status
- `payment_intent.payment_failed` → mark payment failed
- `charge.refunded` → update booking status
- `setup_intent.succeeded` → confirm card saved

**Reference**: `docs/frontend/backend clarifications` lines 1292-2305 for Stripe details

#### 3. Public Booking Flow APIs

**Files to create:**
- `apps/web/src/app/api/public/[slug]/catalog/route.ts` - Business catalog
- `apps/web/src/app/api/public/[slug]/availability/route.ts` - Available slots
- `apps/web/src/app/api/public/[slug]/bookings/route.ts` - Create booking
- `apps/web/src/app/api/public/[slug]/gift-codes/preview/route.ts` - Gift code validation

**Catalog endpoint** (`GET /api/public/{slug}/catalog`):
- Query `businesses` by subdomain
- Return: business info, categories, services, staff
- No auth required (public)

**Availability endpoint** (`GET /api/public/{slug}/availability?service_id&date=YYYY-MM-DD`):
- Load `availability_rules` for that service/staff
- Load `blackouts` for that date
- Load existing `bookings` for that date
- Generate 15-minute slots using algorithm from clarifications
- Return: `[{staff_id, staff_name, start_at, end_at}]`

**Booking creation** (`POST /api/public/{slug}/bookings`):
- Validate slot still available (check unique index)
- Validate gift code if provided, compute `final_price_cents`
- Create/find `customers` row
- Create `bookings` row (status='pending', payment_status='card_saved')
- Create Stripe SetupIntent
- Create `booking_payments` row with SetupIntent ID
- Store policy snapshot (from current `business_policies`)
- Return: `{booking_id, booking_code, client_secret}`

**Reference**: `docs/frontend/backend clarifications` lines 2310-2648 for API contracts

#### 4. Admin Money Board APIs

**Files to create:**
- `apps/web/src/app/api/admin/bookings/route.ts` - List bookings
- `apps/web/src/app/api/admin/bookings/[id]/complete/route.ts`
- `apps/web/src/app/api/admin/bookings/[id]/no-show/route.ts`
- `apps/web/src/app/api/admin/bookings/[id]/cancel/route.ts`
- `apps/web/src/app/api/admin/bookings/[id]/refund/route.ts`

**List endpoint** (`GET /api/admin/bookings`):
- Query `bookings` with joins to customers, services, staff
- Filter by: status, from, to, staff_id, service_id
- Pagination: cursor-based
- Return: `{items: [...], next_page_token}`

**Money action endpoints** (all follow same pattern):
- Require `X-Idempotency-Key` header
- Check idempotency (query `idempotency_keys` table)
- Look up booking, business, customer, saved payment method
- Compute amount:
  - Complete → `final_price_cents`
  - No-Show → no-show fee from `policy_snapshot`
  - Cancel → cancellation fee from `policy_snapshot`
  - Refund → amount of previous charge
- Create Stripe PaymentIntent (or Refund) with Connect destination
- Insert `booking_payments` row
- Update `bookings.status`, `payment_status`, `last_money_action`
- Handle gift card balance (for amount-type cards on Completed)
- Return: `{status, charge_amount, receipt_url}`

**Reference**: `docs/frontend/backend clarifications` lines 2437-2548

#### 5. Availability Engine

**File to create:**
- `apps/web/src/lib/availability.ts` - Slot generation logic

**Function**: `generateAvailabilitySlots(serviceId, date, businessId)`

**Algorithm** (from clarifications):
1. Load `availability_rules` for that service + staff
2. Load `blackouts` for that date
3. Load existing `bookings` for that date
4. For each staff that can perform service:
   - Get weekly rules for that weekday
   - Convert to actual timestamps in business timezone
   - Walk in 15-minute increments
   - Filter out: past times, lead time violations, blackouts, existing bookings
   - Return slots: `[{staff_id, staff_name, start, end}]`

**Reference**: `docs/frontend/backend clarifications` lines 2649-3116

#### 6. Notifications System

**Files to create:**
- `apps/web/src/app/api/admin/notifications/templates/route.ts` - CRUD templates
- `apps/web/src/lib/notifications.ts` - Template rendering, sending
- `apps/web/src/app/api/cron/notifications/route.ts` - Job processor

**Template CRUD**:
- `GET /api/admin/notifications/templates` - List all templates
- `PUT /api/admin/notifications/templates/{id}` - Update template
- `POST /api/admin/notifications/templates` - Create template

**Event emission**:
- When booking created → enqueue notification job
- When booking completed → enqueue notification job
- When fee charged → enqueue notification job
- etc.

**Job processor**:
- Query `notification_jobs` where status='pending'
- For each job:
  - Load template
  - Substitute placeholders: `${customer.name}`, `${service.name}`, etc.
  - Send via email (SendGrid) or SMS (Twilio)
  - Update job status
  - Retry with exponential backoff on failure

**Placeholders supported**:
- `${customer.name}`, `${service.name}`, `${service.duration}`, `${service.price}`
- `${booking.date}`, `${booking.time}`, `${business.name}`, `${booking.url}`

**Reference**: `docs/frontend/backend clarifications` lines 2649-2830

#### 7. Background Jobs & Cron

**Files to create:**
- `apps/web/src/app/api/cron/reminders/route.ts` - 24h/1h reminders
- `apps/web/src/app/api/cron/subscription-health/route.ts` - Check subscriptions
- `apps/web/src/app/api/cron/cleanup/route.ts` - Expire held slots, cleanup

**Reminders cron**:
- Find bookings happening in next 24h or 1h
- Enqueue notification jobs for reminders
- Run every 5-10 minutes

**Subscription health**:
- Check Stripe subscription status vs database
- Update `subscription_status` if out of sync
- Run daily

**Cleanup cron**:
- Expire held bookings older than 5 minutes
- Mark as 'expired' or delete
- Run every minute

**Reference**: `docs/frontend/backend clarifications` lines 3638-4006

#### 8. Gift Cards & Policies

**Gift code preview** (`POST /api/public/{slug}/gift-codes/preview`):
- Validate code exists, active, not expired
- Compute discount (amount or percent)
- Return: `{discount_cents, final_price_cents, type}`

**Redemption logic**:
- On booking creation: store gift code info, compute final price
- On Completed action: if amount-type, deduct balance, write ledger
- On Refund: if amount-type and setting enabled, restore balance

**Policy snapshot**:
- On booking creation: copy current `business_policies` into `bookings.policy_snapshot`
- Include: policy texts, fee types, fee values
- Store consent: `consent_at`, `consent_ip`, `consent_user_agent`

**Reference**: `docs/frontend/backend clarifications` lines 3152-3635

### Implementation Order (Recommended)

1. **Onboarding endpoints** (steps 2-11) - Get data saving working
2. **Stripe helpers** - Payment infrastructure
3. **Public booking flow** - Customer-facing APIs
4. **Admin money board** - Core business logic
5. **Availability engine** - Slot generation
6. **Notifications** - Communication system
7. **Background jobs** - Automation
8. **Gift cards** - Discount system

### Testing Strategy

After each phase:
- Test endpoint with curl or Postman
- Verify data in Supabase Dashboard
- Check RLS is working (can't see other users' data)

### Environment Variables Needed

Already documented in `apps/web/ENV_SETUP.md`:
- Supabase keys (✅ already set)
- Stripe keys (need to add)
- SendGrid/Twilio keys (optional for now)

### Important Notes

- **All endpoints require authentication** except public booking endpoints
- **Use `createServerClient()`** for authenticated routes (respects RLS)
- **Use `createAdminClient()`** only for webhooks/cron (bypasses RLS)
- **Idempotency keys** required on all money actions
- **Policy snapshots** must be stored at booking time (don't reference current policies)
- **Gift card balances** only move when money actually charges (not at booking time)

### Success Criteria

Task 4 is complete when:
- ✅ All 11 onboarding endpoints work
- ✅ Stripe Connect + subscription works
- ✅ Public booking flow works (catalog, availability, booking creation)
- ✅ Admin money board works (list, complete, no-show, cancel, refund)
- ✅ Availability slots generate correctly
- ✅ Notifications send (at least email)
- ✅ Background jobs run (reminders, cleanup)
- ✅ Gift cards work (validation, redemption, refund restore)

**PROMPT END**

---

## 📝 Additional Context for New Chat

### File Structure Created

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── db.ts ✅ (Supabase clients)
│   │   └── auth.ts ✅ (Auth helpers)
│   └── app/
│       └── api/
│           ├── test-db/route.ts ✅
│           └── business/
│               └── onboarding/
│                   └── step-1-business/route.ts ✅
│
supabase/
└── migrations/
    ├── 20250101000000_initial_schema.sql ✅
    └── 20250101000001_fix_booking_status_enum.sql ✅

docs/
├── backend/
│   ├── baseline-report.md ✅
│   ├── implementation-plan.md ✅
│   ├── task-3-supabase-setup-complete.md ✅
│   ├── task-4-migrations-complete.md ✅
│   └── task-4-onboarding-api-start.md ✅
└── frontend/
    ├── backend clarifications ✅
    └── frontend logistics.txt ✅
```

### Key Code Patterns

**Authentication pattern** (use in all protected endpoints):
```typescript
const userId = await getCurrentUserId();
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Database query pattern**:
```typescript
const supabase = await createServerClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);
```

**Idempotency pattern** (for money actions):
```typescript
const idempotencyKey = request.headers.get('X-Idempotency-Key');
// Check if key exists in idempotency_keys table
// If exists, return cached response
// If not, process and store response
```

### Common Pitfalls to Avoid

1. **Don't charge at booking time** - Only save card (SetupIntent)
2. **Don't forget policy snapshots** - Store at booking creation, not reference
3. **Don't move gift card balance early** - Only on actual charge
4. **Don't bypass RLS** - Use `createServerClient()` unless webhook/cron
5. **Don't forget idempotency** - Required on all money actions
6. **Don't hardcode amounts** - Use `policy_snapshot` for fees

---

## ✅ Verification Checklist

Before considering Task 4 complete, verify:

- [ ] All 11 onboarding endpoints created and tested
- [ ] Stripe Connect account creation works
- [ ] Subscription billing works ($11.99/mo)
- [ ] Webhook handler processes Stripe events
- [ ] Public catalog endpoint returns business data
- [ ] Availability endpoint generates correct slots
- [ ] Booking creation saves card (no charge)
- [ ] Admin can list bookings
- [ ] Complete button charges correctly
- [ ] No-show button charges fee correctly
- [ ] Cancel button charges fee correctly
- [ ] Refund button refunds correctly
- [ ] Gift codes validate and apply discounts
- [ ] Notifications send (email at minimum)
- [ ] Reminders schedule correctly
- [ ] Held slots expire after 5 minutes
- [ ] RLS prevents cross-tenant data access

---

## 🎯 Final Instructions

**For the new chat:**

1. **Start with the prompt above** (copy entire "PROMPT START" to "PROMPT END" section)
2. **Reference the documents** listed (baseline-report, backend clarifications, etc.)
3. **Follow the implementation order** (onboarding → Stripe → public → admin → etc.)
4. **Test each phase** before moving to next
5. **Use existing code as patterns** (step-1-business, db.ts, auth.ts)

**Success means:**
- All endpoints work
- Data persists correctly
- RLS enforces isolation
- Stripe integration works
- Notifications send
- Background jobs run

Good luck! 🚀




