# Tithi Backend Implementation Plan

**Status**: Baseline complete ✅ | Ready to begin implementation

**Reference Documents**:
- `docs/backend/baseline-report.md` - Complete frontend/backend analysis
- `docs/frontend/backend clarifications` - Database schema and API contracts
- `docs/frontend/frontend logistics.txt` - Product requirements

---

## Implementation Strategy

### Phase 1: Foundation (Tasks 3-4)
**Goal**: Get database connected and basic CRUD working

1. **Task 3: Supabase Setup** (1-2 hours)
   - Create `apps/web/src/lib/db.ts` with Supabase client helpers
   - Set up `.env.local` with Supabase keys
   - Test connection and RLS

2. **Task 4: Onboarding API** (4-6 hours)
   - Create route handlers for each onboarding step
   - Wire form submissions to database
   - Test end-to-end: signup → complete onboarding → see data in DB

**Success Criteria**: Owner can complete onboarding and data persists in database

---

### Phase 2: Core Booking Flow (Tasks 5-6)
**Goal**: Customers can book appointments

3. **Task 5: Stripe Integration** (3-4 hours)
   - Connect onboarding → Stripe Connect account creation
   - Subscription setup for $11.99/mo
   - Webhook handler for Stripe events

4. **Task 6: Public Booking API** (4-6 hours)
   - Catalog endpoint (business info + services)
   - Availability endpoint (slot generation)
   - Booking creation endpoint (customer + booking + SetupIntent)

**Success Criteria**: Customer can book on public site, card saved, booking appears in admin

---

### Phase 3: Money & Admin (Tasks 7-8)
**Goal**: Owner can manage bookings and money moves

5. **Task 7: Money Board Actions** (3-4 hours)
   - List bookings endpoint
   - Four action endpoints (Complete/No-Show/Cancel/Refund)
   - Idempotency handling
   - Stripe PaymentIntent creation

**Detailed Implementation Instructions for Task 7:**

Before writing any code, scan the frontend to understand exact expectations: Use `codebase_search` in `apps/web/src` for terms like "Past Bookings", "money board", "Complete", "No-Show", "Cancel", "Refund" to find the admin components that will call these endpoints. Check `apps/web/src/app/app/b/[businessId]/payments/page.tsx` or similar admin pages to see what data structure the frontend expects in the response. The frontend likely expects a list of bookings with joined customer, service, staff, and payment summary data—verify the exact field names by reading the component code before implementing.

Create `apps/web/src/app/api/admin/bookings/route.ts` for the GET endpoint. Query the `bookings` table with RLS (using `createServerClient()` from `lib/db.ts` which respects `auth.uid()`), joining `customers`, `services`, `staff`, and the latest `booking_payments` row. Filter by `status` (from query params: `pending`, `completed`, `no_show`, `cancelled`, `refunded`), `from`/`to` date range, and implement cursor-based pagination using `next_page_token`. Return JSON matching the structure in `docs/frontend/backend clarifications` lines 2470-2499: each booking object must include `booking_id`, `booking_code`, `customer.name/email/phone`, `service.name`, `staff.name`, `start_at`, `end_at`, `base_price_cents`, `final_price_cents`, `status`, `payment_status`, `last_money_action`, and `last_payment_amount_cents`. Use the exact field names from the schema (`supabase/migrations/20250101000000_initial_schema.sql`)—do not invent new field names.

For the four money action endpoints, create `apps/web/src/app/api/admin/bookings/[id]/complete/route.ts`, `no-show/route.ts`, `cancel/route.ts`, and `refund/route.ts`. Each must: (1) Require `X-Idempotency-Key` header (UUID), check `idempotency_keys` table for `(booking_id, action_type, key)` uniqueness—if exists, return cached response from `idempotency_keys.result_json`; (2) Load booking with `business_id`, read `policy_snapshot` JSONB to extract fee type (`no_show_fee_type`, `cancel_fee_type`) and value; (3) Calculate charge amount: For "Complete", use `booking.final_price_cents`; For "No-Show", if `policy_snapshot.no_show_fee_type = 'amount'` use `no_show_fee_amount_cents`, if `'percent'` calculate `round(base_price_cents * no_show_fee_percent / 100)`; For "Cancel", same logic with cancel fees; For "Refund", if no charge exists return `{status: "NO_CHARGE", message: "No charge to refund"}`, else load `stripe_payment_intent_id` from `booking_payments`; (4) Create Stripe PaymentIntent (or Refund) using `stripe.charges.create` or `stripe.refunds.create` with `on_behalf_of` = `business.stripe_connect_account_id`, `application_fee_amount` = `round(charge_amount * 0.01)` (1% platform fee), and `idempotency_key` from header; (5) Insert `booking_payments` row with `stripe_payment_intent_id`/`stripe_refund_id`, `amount_cents`, `platform_fee_cents`, `status` = `'charged'`/`'refunded'`; (6) Update `bookings.status` to `'completed'`/`'no_show'`/`'cancelled'`/`'refunded'`, `payment_status` = `'charged'`/`'refunded'`, `last_money_action` = `'completed'`/`'no_show'`/`'cancelled'`/`'refunded'`; (7) Store idempotency key in `idempotency_keys` with `result_json` containing `{status, charge_amount, receipt_url}`; (8) Return minimal JSON: `{status: "CHARGED"|"REFUNDED", charge_amount: number, receipt_url: string}`. Reference `docs/frontend/backend clarifications` lines 2003-2254 for exact Stripe Connect patterns and fee calculations.

6. **Task 8: Availability Engine** (4-6 hours)
   - Slot generation algorithm
   - Blackout handling
   - Double-booking prevention (unique index + held status)

**Detailed Implementation Instructions for Task 8:**

First, verify the database schema has the required constraints: Check `supabase/migrations/20250101000000_initial_schema.sql` for the partial unique index on `bookings(staff_id, start_at)` with `WHERE status IN ('pending', 'scheduled', 'held')`—this prevents double-booking at the database level. Also confirm `availability_rules` table has columns: `user_id`, `business_id`, `service_id`, `staff_id`, `weekday` (0-6), `start_time`, `end_time`, `is_active`, and `blackouts` table has `staff_id` (nullable for business-wide), `start_at`, `end_at`, `reason`. Read `docs/frontend/backend clarifications` lines 2911-3032 for the exact slot generation algorithm—it uses 15-minute increments, respects lead time (`min_lead_time_minutes` from `businesses` or default 2 hours), max advance (`max_advance_days`), and excludes blackouts and existing bookings.

Create `apps/web/src/lib/availability.ts` with function `generateAvailabilitySlots(serviceId: string, staffId: string | null, date: string, businessId: string, supabase: SupabaseClient): Promise<Slot[]>`. The function must: (1) Load `availability_rules` for the service/staff/weekday using `supabase.from('availability_rules').select().eq('service_id', serviceId).eq('staff_id', staffId).eq('weekday', dayOfWeek).eq('is_active', true)`; (2) Load `blackouts` for the date range using `.gte('start_at', dateStart).lte('end_at', dateEnd)`; (3) Load existing bookings for that staff/date with `.eq('staff_id', staffId).gte('start_at', dateStart).lt('end_at', dateEnd).in('status', ['pending', 'scheduled', 'held', 'completed'])`; (4) Get service duration from `services.duration_min`; (5) Get business timezone from `businesses.timezone`; (6) Convert all times to business timezone using a library like `date-fns-tz`; (7) Walk in 15-minute steps from rule `start_time` to `end_time`; (8) For each candidate slot at time `T`: Check `T >= now + min_lead_time_minutes`, `T + duration <= rule.end_time`, slot doesn't overlap any blackout (check `T < blackout.end_at && T + duration > blackout.start_at`), slot doesn't overlap any existing booking (check `T < booking.end_at && T + duration > booking.start_at`); (9) If all checks pass, add slot `{staff_id, staff_name, start_at: ISO string, end_at: ISO string}`; (10) Return array of valid slots. Test with edge cases: slots at day boundaries, blackouts spanning multiple days, bookings that end exactly when next starts (should allow), and timezone conversions (e.g., business in EST, user in PST).

For the availability endpoint, create `apps/web/src/app/api/public/[subdomain]/availability/route.ts`. Extract `subdomain` from URL params, query `businesses` by `subdomain` to get `business_id` and `timezone`, then call `generateAvailabilitySlots()` with `service_id` and `date` from query params. Return `{slots: Slot[]}`. 

**Availability Maintenance + Double-Booking Protection:**

Before implementing booking creation, verify the database schema has the partial unique index: Open `supabase/migrations/20250101000000_initial_schema.sql` and confirm there exists a unique index on `bookings` table: `CREATE UNIQUE INDEX idx_bookings_staff_start_active ON bookings(staff_id, start_at) WHERE status IN ('pending', 'scheduled', 'held');`. This index prevents two bookings from having the same `staff_id` and `start_at` when their status is active/held. If this index does not exist, create a new migration file `supabase/migrations/YYYYMMDDHHMMSS_add_booking_unique_index.sql` with the exact SQL above. The `WHERE` clause is critical—it only enforces uniqueness for active bookings, allowing multiple `completed` or `cancelled` bookings at the same time (for historical records). Test the index by attempting to insert two bookings with same `staff_id` and `start_at` and `status = 'pending'`—the second insert should fail with PostgreSQL error code `23505` (unique_violation).

For double-booking prevention in booking creation (`POST /api/public/[subdomain]/bookings`), implement Option A (simpler approach): After validating the slot is free using `generateAvailabilitySlots()`, immediately attempt to insert the booking row with `status = 'pending'`, `staff_id`, `start_at` (from request), `end_at = start_at + service.duration_minutes`, and all other required fields. Wrap the insert in a try-catch block. If the insert succeeds, proceed with creating the SetupIntent and return success. If the insert fails with PostgreSQL error code `23505` (unique_violation), this means another booking was created between when you checked availability and when you inserted—return HTTP `409 Conflict` with JSON body `{error: "Slot is no longer available", code: "SLOT_TAKEN"}`. The frontend should handle this by showing an error message and refreshing the availability slots so the user can pick a different time. This approach is simpler because it relies entirely on the database constraint—no additional "held" status logic needed, and the race condition is handled by the unique index.

Optionally, implement Option B (explicit held status) if you want to reserve slots temporarily during checkout: When the user selects a slot and proceeds to checkout (but before card is saved), insert the booking with `status = 'held'`, `held_expires_at = now() + INTERVAL '5 minutes'` (use PostgreSQL `now() + INTERVAL '5 minutes'` or JavaScript `new Date(Date.now() + 5 * 60 * 1000).toISOString()`). Update the unique index to include `'held'` in the WHERE clause (already included above). When the SetupIntent succeeds (webhook `setup_intent.succeeded`), update the booking `status = 'pending'` and clear `held_expires_at`. If the SetupIntent fails or times out, the held booking will expire via cron. Create cleanup cron endpoint `GET /api/cron/cleanup` (protected by `CRON_SECRET` header) that: (1) Queries `bookings` for `status = 'held'` AND `held_expires_at < now()`; (2) For each expired held booking, check if `stripe_setup_intent_id IS NULL` (no payment method was saved)—if true, update `status = 'pending'` (or delete the row if you prefer), which makes the slot available again; if `stripe_setup_intent_id IS NOT NULL`, the card was saved but booking wasn't finalized, so keep it as `'held'` and handle separately (or mark as `'pending'` if you want to allow manual completion). Schedule this cron to run every 2-5 minutes via Vercel Cron (`vercel.json` with `"crons": [{"path": "/api/cron/cleanup", "schedule": "*/3 * * * *"}]`) or external cron service. Reference `docs/frontend/backend clarifications` lines 3033-3070 for the exact held slot expiration logic and timing requirements.

---

### Phase 4: Polish & Automation (Tasks 9-11)
**Goal**: Notifications, gift cards, background jobs

7. **Task 9: Notifications** (3-4 hours)
   - Template CRUD endpoints
   - Event emission on booking actions
   - Job queue + worker/cron
   - Email/SMS sending (SendGrid/Twilio)

**Detailed Implementation Instructions for Task 9:**

Before implementing, scan the frontend for notification template usage: Use `codebase_search` in `apps/web/src` for "notification", "template", "email", "SMS" to find where templates are configured (likely in onboarding step 8 or admin settings). Read `docs/frontend/backend clarifications` lines 2657-2828 for the exact schema: `notification_templates` table has `id`, `user_id`, `business_id`, `name`, `channel` (enum: `'email'`|`'sms'`), `category` (enum: `'confirmation'`|`'reminder'`|`'receipt'`|`'alert'`), `trigger` (enum: `'booking_created'`|`'booking_completed'`|`'booking_reminder_24h'`|`'booking_reminder_1h'`|`'fee_charged'`|`'refund_processed'`), `subject` (for email), `body` (text with placeholders like `${customer.name}`, `${service.name}`, `${booking.date}`, `${booking.time}`, `${booking.code}`, `${business.name}`, `${amount}`), `is_active`, `created_at`, `updated_at`. The `notification_jobs` table (or `jobs` table with `type = 'notification'`) has `id`, `business_id`, `template_id`, `booking_id`, `trigger`, `recipient_email`/`recipient_phone`, `status` (enum: `'pending'`|`'processing'`|`'sent'`|`'failed'`|`'dead'`), `retry_count`, `next_retry_at`, `created_at`.

Create template CRUD endpoints: `GET /api/admin/notifications/templates` (list all for business), `POST /api/admin/notifications/templates` (create), `PUT /api/admin/notifications/templates/[id]` (update), `DELETE /api/admin/notifications/templates/[id]` (soft delete: set `deleted_at`). Each must validate: `channel` is valid enum, `trigger` is valid enum, `body` contains only allowed placeholders (validate against whitelist: `customer.name`, `customer.email`, `customer.phone`, `service.name`, `service.duration`, `staff.name`, `booking.code`, `booking.date`, `booking.time`, `booking.amount`, `business.name`, `business.phone`, `business.support_email`). Store templates in `notification_templates` with RLS (`user_id = auth.uid()`).

For event emission, create helper function `emitNotification(businessId: string, trigger: string, bookingId: string, supabase: SupabaseClient): Promise<void>` in `apps/web/src/lib/notifications.ts`. This function: (1) Queries `notification_templates` for `business_id` + `trigger` + `is_active = true`; (2) For each template, loads booking data (join `customers`, `services`, `staff`, `businesses`); (3) Resolves placeholders by replacing `${customer.name}` with `booking.customer.name`, `${service.name}` with `booking.service.name`, `${booking.date}` with formatted date in business timezone, `${booking.time}` with formatted time, `${booking.code}` with `booking.booking_code`, `${booking.amount}` with formatted currency, etc.; (4) Inserts row into `notification_jobs` (or `jobs` table) with `status = 'pending'`, `template_id`, `booking_id`, `trigger`, `recipient_email`/`recipient_phone` from template channel, `subject` and `body` with resolved placeholders; (5) Call this function from booking creation endpoint (`POST /api/public/[subdomain]/bookings`), money action endpoints (Complete/No-Show/Cancel/Refund), and reminder cron. Reference `docs/frontend/backend clarifications` lines 2789-2828 for exact job queue structure and retry logic.

Create worker/cron endpoint `GET /api/cron/notifications` (protected by `CRON_SECRET` header). This endpoint: (1) Queries `notification_jobs` for `status = 'pending'` OR (`status = 'failed'` AND `retry_count < 3` AND `next_retry_at <= now()`); (2) For each job, update `status = 'processing'`; (3) If `template.channel = 'email'`, send via SendGrid API (`POST https://api.sendgrid.com/v3/mail/send` with `from`, `to`, `subject`, `text`/`html` body) or SMTP; if `channel = 'sms'`, send via Twilio API (`POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json` with `From`, `To`, `Body`); (4) On success, update `status = 'sent'`, insert row into `notification_events` table (for audit log) with `template_id`, `booking_id`, `channel`, `recipient`, `sent_at`; (5) On failure, increment `retry_count`, set `next_retry_at = now() + (retry_count * 15 minutes)` (exponential backoff: 15min, 30min, 45min), if `retry_count >= 3` set `status = 'dead'`; (6) Use idempotency: check `notification_events` for `(booking_id, trigger, channel)` uniqueness to prevent duplicate sends. Schedule this cron via Vercel Cron (add to `vercel.json`) or external cron service hitting the endpoint with `CRON_SECRET` header.

8. **Task 10: Gift Cards & Policies** (2-3 hours)
   - Gift code validation/preview
   - Redemption on booking
   - Policy snapshot + consent logging
   - Refund balance restoration

**Detailed Implementation Instructions for Task 10:**

First, verify the schema: Check `supabase/migrations/20250101000000_initial_schema.sql` for `gift_cards` table with columns: `id`, `user_id`, `business_id`, `code` (unique per business), `discount_type` (enum: `'amount'`|`'percent'`), `initial_amount_cents` (for amount type), `current_balance_cents` (for amount type, decremented on redemption), `percent_off` (for percent type, e.g., 20.00 for 20%), `expires_at`, `is_active`, and `gift_card_ledger` table with `id`, `user_id`, `business_id`, `gift_card_id`, `booking_id`, `delta_cents` (positive = added, negative = consumed), `reason` (enum: `'purchase'`|`'redemption'`|`'refund_restore'`|`'admin_adjust'`). Also verify `business_policies` table has `cancellation_policy_text`, `no_show_policy_text`, `refund_policy_text`, `cash_policy_text`, `no_show_fee_type`, `no_show_fee_amount_cents`, `no_show_fee_percent`, `cancel_fee_type`, `cancel_fee_amount_cents`, `cancel_fee_percent`, and `bookings` table has `policy_snapshot` (JSONB), `consent_at`, `consent_ip`, `consent_user_agent`, `gift_card_id`, `gift_card_amount_applied_cents`. Read `docs/frontend/backend clarifications` lines 3152-3400 for exact gift card redemption logic.

Create `POST /api/public/[subdomain]/gift-codes/preview` endpoint. Extract `subdomain` from URL, query `businesses` by `subdomain`, extract `gift_card_code` and `base_price_cents` from request body. Query `gift_cards` with `.eq('business_id', businessId).eq('code', code).eq('is_active', true).is('expires_at', null).or('expires_at.gt', new Date().toISOString())`. If not found or expired, return `400 Bad Request` with `{error: "Invalid or expired gift code"}`. Calculate discount: If `discount_type = 'amount'`, `discount_cents = min(gift_card.current_balance_cents, base_price_cents)` (cannot exceed balance or base price); if `discount_type = 'percent'`, `discount_cents = round(base_price_cents * gift_card.percent_off / 100)`. Calculate `final_price_cents = max(0, base_price_cents - discount_cents)` (clamp at 0). Return `{valid: true, discount_cents: number, final_price_cents: number, discount_type: 'amount'|'percent'}`. This endpoint does NOT modify any data—it's a preview only.

In booking creation (`POST /api/public/[subdomain]/bookings`), after validating the gift code (call preview endpoint logic), load current `business_policies` where `is_active = true` and `version` is latest. Create `policy_snapshot` JSONB object: `{cancellation_policy_text, no_show_policy_text, refund_policy_text, cash_policy_text, no_show_fee_type, no_show_fee_amount_cents, no_show_fee_percent, cancel_fee_type, cancel_fee_amount_cents, cancel_fee_percent, version, snapshot_at: ISO timestamp}`. Extract `consent_ip` from request headers (`x-forwarded-for` or `req.ip`), `consent_user_agent` from `user-agent` header. Insert booking with `policy_snapshot`, `consent_at = now()`, `consent_ip`, `consent_user_agent`, `gift_card_id` (if used), `gift_card_amount_applied_cents = discount_cents`, `final_price_cents`. Do NOT decrement gift card balance yet—wait until charge succeeds.

In money action "Complete" (`POST /api/admin/bookings/[id]/complete`), after Stripe PaymentIntent succeeds, if `booking.gift_card_id` is not null and `gift_card.discount_type = 'amount'`: (1) Decrement `gift_cards.current_balance_cents -= booking.gift_card_amount_applied_cents`; (2) Insert `gift_card_ledger` row with `delta_cents = -booking.gift_card_amount_applied_cents`, `reason = 'redemption'`, `booking_id = booking.id`. For percent-type gift cards, no balance decrement (they're one-time discounts). In "Refund" action, if business has setting `restore_gift_card_on_refund = true` (add this to `businesses` table or `business_policies`), and `booking.gift_card_id` is not null and `discount_type = 'amount'`: (1) Increment `gift_cards.current_balance_cents += booking.gift_card_amount_applied_cents`; (2) Insert `gift_card_ledger` row with `delta_cents = +booking.gift_card_amount_applied_cents`, `reason = 'refund_restore'`, `booking_id = booking.id`. Reference `docs/frontend/backend clarifications` lines 3400-3500 for exact ledger audit requirements.

9. **Task 11: Background Jobs** (2-3 hours)
   - Jobs table
   - Reminder scheduling (24h/1h before)
   - Subscription health checks
   - Cleanup tasks

**Detailed Implementation Instructions for Task 11:**

Verify the `jobs` table exists in `supabase/migrations/20250101000000_initial_schema.sql` with columns: `id`, `user_id`, `business_id`, `type` (enum: `'notification'`|`'reminder'`|`'subscription_check'`|`'cleanup'`), `status` (enum: `'pending'`|`'processing'`|`'completed'`|`'failed'`|`'dead'`), `payload` (JSONB for job-specific data), `scheduled_at`, `started_at`, `completed_at`, `error_message`, `retry_count`, `next_retry_at`, `created_at`. Alternatively, if using `notification_jobs` table separately, ensure it has similar structure. Read `docs/frontend/backend clarifications` lines 3700-3750 for exact cron job requirements.

Create `GET /api/cron/reminders` endpoint (protected by `CRON_SECRET` header). This endpoint: (1) Queries `bookings` for `status IN ('pending', 'scheduled')` and `start_at` between `now() + 24 hours - 5 minutes` and `now() + 24 hours + 5 minutes` (24h reminder window) OR `start_at` between `now() + 1 hour - 5 minutes` and `now() + 1 hour + 5 minutes` (1h reminder window); (2) For each booking, checks if reminder job already exists in `notification_jobs` (or `jobs`) with `trigger = 'booking_reminder_24h'` or `'booking_reminder_1h'` and `booking_id`; (3) If not exists, calls `emitNotification(businessId, 'booking_reminder_24h' or 'booking_reminder_1h', bookingId, supabase)` which creates notification job; (4) Returns `{scheduled: number}` count. Schedule this cron to run every 5-10 minutes via Vercel Cron (`vercel.json` with `"crons": [{"path": "/api/cron/reminders", "schedule": "*/10 * * * *"}]`) or external cron.

Create `GET /api/cron/subscription-health` endpoint. This endpoint: (1) Queries `businesses` for `subscription_status IN ('active', 'trial', 'paused')`; (2) For each business, calls Stripe API `stripe.subscriptions.retrieve(business.stripe_subscription_id)`; (3) Compares Stripe subscription `status` with `business.subscription_status`: If Stripe says `'active'` but DB says `'canceled'`, update DB to `'active'`; if Stripe says `'canceled'` or `'past_due'` but DB says `'active'`, update DB to `'canceled'`, set `business.deleted_at = now()` (soft delete), and optionally deprovision subdomain; (4) Updates `next_bill_at` from Stripe subscription `current_period_end`; (5) Returns `{checked: number, updated: number}`. Schedule daily at 2 AM UTC.

Create `GET /api/cron/cleanup` endpoint. This endpoint: (1) Updates `bookings` set `status = 'pending'` where `status = 'held'` and `held_expires_at < now()` and `stripe_setup_intent_id IS NULL` (expired held slots); (2) Deletes old `idempotency_keys` rows where `created_at < now() - 30 days`; (3) Marks old `notification_jobs` as `'dead'` where `status = 'failed'` and `retry_count >= 3` and `next_retry_at < now() - 7 days`; (4) Optionally archives old `notification_events` older than 1 year to cold storage; (5) Returns `{expired_holds: number, cleaned_keys: number, dead_jobs: number}`. Schedule daily at 3 AM UTC. Reference `docs/frontend/backend clarifications` lines 3710-3720 for exact cleanup requirements.

---

### Phase 5: Testing & Deployment (Task 12)
**Goal**: Production-ready

10. **Task 12: Testing & Seeding** (3-4 hours)
   - Seed script with demo business
   - Unit tests (slot gen, pricing, placeholders)
   - Integration tests (booking flow, money actions)
   - E2E test (full onboarding → booking → charge)

**Detailed Implementation Instructions for Task 12:**

Create `apps/web/scripts/seed.ts` (or `supabase/seed.sql`). Before writing, read `docs/frontend/backend clarifications` lines 3928-3962 for exact seed data requirements. The seed script must create: (1) One demo owner user via Supabase Auth API (`supabase.auth.admin.createUser({email: 'demo@tithi.dev', password: 'demo123', email_confirm: true})`) or SQL insert into `auth.users` (if using service role); (2) One `businesses` row with `user_id = owner.id`, `name = 'Demo Salon'`, `subdomain = 'demo'`, `timezone = 'America/New_York'`, `stripe_connect_account_id = 'acct_test_...'` (use Stripe test account), `subscription_status = 'active'`; (3) Two `service_categories` (e.g., "Hair Services", "Nail Services") with colors; (4) Three `services` (e.g., "Haircut" 30min $50, "Color" 90min $150, "Manicure" 45min $35) linked to categories; (5) Two `staff` (e.g., "Jane Doe", "John Smith") with colors; (6) `staff_services` linking staff to services; (7) `availability_rules` for Monday-Friday 9 AM - 5 PM for each staff+service combo; (8) One `business_policies` row with version 1, cancellation/no-show/refund policies, fees; (9) Two `gift_cards`: one amount-type ($50 balance, code "DEMO50"), one percent-type (20% off, code "DEMO20"); (10) Two `notification_templates`: "Booking Confirmation" (email, trigger `booking_created`), "24h Reminder" (email, trigger `booking_reminder_24h`); (11) Ten `customers` with varied names/emails/phones; (12) Fifteen `bookings` across statuses: 3 `pending`, 3 `completed` (with charges), 2 `no_show` (with fees), 2 `cancelled`, 2 `refunded`, 3 `held` (expired). Use `createAdminClient()` from `lib/db.ts` to bypass RLS for seeding. Run with `npx tsx apps/web/scripts/seed.ts` or execute SQL via Supabase Dashboard.

For unit tests, create `apps/web/src/lib/__tests__/availability.test.ts`, `pricing.test.ts`, `notifications.test.ts` using Vitest or Jest. In `availability.test.ts`, test `generateAvailabilitySlots()`: (1) Test basic slot generation: given service 30min, rule 9 AM - 5 PM, no blackouts/bookings, expect slots every 15min from 9 AM to 4:30 PM; (2) Test blackout exclusion: add blackout 12 PM - 1 PM, expect no slots in that range; (3) Test booking exclusion: add booking 2 PM - 2:30 PM, expect no slot at 2 PM; (4) Test lead time: if `now = 10 AM`, `min_lead_time = 2 hours`, expect no slots before 12 PM; (5) Test timezone conversion: business in EST, generate slots for date, verify times are in EST; (6) Test edge cases: slot at exact rule boundary, overlapping blackouts, multiple staff for same service. In `pricing.test.ts`, test gift card discount calculation: (1) Amount-type: base $100, balance $50, expect discount $50, final $50; (2) Amount-type: base $30, balance $50, expect discount $30 (cannot exceed base), final $0; (3) Percent-type: base $100, 20% off, expect discount $20, final $80; (4) Percent-type: base $10, 50% off, expect discount $5, final $5; (5) Clamp at zero: base $10, discount $15, expect final $0. In `notifications.test.ts`, test placeholder resolution: (1) Template `"Hi ${customer.name}, your ${service.name} is confirmed"` with booking data, expect `"Hi John Doe, your Haircut is confirmed"`; (2) Test all placeholders: `${customer.name}`, `${customer.email}`, `${service.name}`, `${staff.name}`, `${booking.code}`, `${booking.date}`, `${booking.time}`, `${booking.amount}`, `${business.name}`; (3) Test missing data: if `customer.name` is null, use `"Customer"` as fallback; (4) Test date formatting: `booking.start_at = '2025-01-20T14:00:00Z'`, business timezone EST, expect `${booking.date} = "January 20, 2025"`, `${booking.time} = "9:00 AM"` (converted to EST). Run tests with `npm test` or `npx vitest`.

For integration tests, create `apps/web/src/app/api/__tests__/booking-flow.test.ts`. Use a test framework like Vitest with `@supabase/supabase-js` test client. Test flow: (1) Create test business via admin client; (2) Create test service, staff, availability; (3) Call `GET /api/public/demo/catalog`, verify returns business/services/staff; (4) Call `GET /api/public/demo/availability?service_id=X&date=2025-01-20`, verify returns slots; (5) Call `POST /api/public/demo/bookings` with valid slot, customer data, gift code, verify returns `booking_id` and `client_secret`; (6) Verify `bookings` row created with `status = 'pending'`, `policy_snapshot` populated, `consent_at` set; (7) Verify `booking_payments` row created with `stripe_setup_intent_id`; (8) Verify `customers` row created/found; (9) Call `GET /api/admin/bookings` with auth token, verify booking appears in list; (10) Call `POST /api/admin/bookings/{id}/complete` with idempotency key, verify Stripe PaymentIntent created (mock Stripe or use test mode), verify `bookings.status = 'completed'`, `payment_status = 'charged'`; (11) Verify `gift_card_ledger` row created if gift card used; (12) Verify notification job created. Test money actions: (1) Test "No-Show" with fee, verify fee calculated from `policy_snapshot`; (2) Test "Cancel" with 0 fee, verify status updated but no charge; (3) Test "Refund" after complete, verify refund created, balance restored if enabled. Use test database (separate Supabase project or `test` schema) and clean up after each test.

For E2E test, create `apps/web/e2e/full-flow.spec.ts` using Playwright or Cypress. Test: (1) Sign up new user → redirected to onboarding; (2) Complete all 11 onboarding steps (use `page.fill()`, `page.click()` to fill forms); (3) Verify "Go Live" screen appears with booking URL; (4) Open booking URL in new page/tab; (5) Select service, pick slot, enter customer info, apply gift code, submit; (6) Verify Stripe Elements form appears, fill test card (`4242 4242 4242 4242`), submit; (7) Verify booking confirmation page; (8) Switch to admin view, verify booking in "Past Bookings"; (9) Click "Completed", verify charge succeeds, booking status updates; (10) Verify notification email sent (check test email inbox or mock); (11) Click "Refund", verify refund processed, status updates. Run with `npx playwright test` or `npx cypress run`. Reference `docs/backend/TASK_4_COMPLETION_TEST.md` for comprehensive test checklist.

**Success Criteria**: All tests pass, seed data works, ready for deployment

---

## How to Execute Each Task

### For Each Task:

1. **Read the baseline report** - Understand what the frontend expects
2. **Check backend clarifications** - See exact schema/API contracts
3. **Create route handler** - In `apps/web/src/app/api/...`
4. **Write database queries** - Using Supabase client or SQL
5. **Test locally** - Use Supabase Studio or pgAdmin to verify data
6. **Update frontend** - Replace fake context calls with real API calls
7. **Verify end-to-end** - Test the full flow in browser

### Example: Task 4 (Onboarding API)

**Step 1**: Create `apps/web/src/app/api/business/onboarding/step-1-business/route.ts`
```typescript
import { createClient } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  const supabase = createClient()
  const { businessName, description, ... } = await request.json()
  
  // Insert/update businesses table
  // Return success
}
```

**Step 2**: Update `apps/web/src/app/onboarding/page.tsx`
- Replace `onboarding.saveBusiness()` with `fetch('/api/business/onboarding/step-1-business', ...)`

**Step 3**: Test in browser - fill form, submit, check database

---

## Key Files to Create

### Database
- `supabase/migrations/001_initial_schema.sql` - All tables, enums, indexes, RLS
- `supabase/migrations/002_seed_data.sql` - Optional demo data

### Backend Helpers
- `apps/web/src/lib/db.ts` - Supabase client factory
- `apps/web/src/lib/stripe.ts` - Stripe client + helpers
- `apps/web/src/lib/availability.ts` - Slot generation logic
- `apps/web/src/lib/notifications.ts` - Template rendering + sending

### API Routes
- `apps/web/src/app/api/business/onboarding/...` - 8 step endpoints
- `apps/web/src/app/api/admin/bookings/...` - Money board
- `apps/web/src/app/api/public/[slug]/...` - Public booking
- `apps/web/src/app/api/webhooks/stripe/route.ts` - Stripe webhooks

---

## Testing Strategy

### Unit Tests
- Slot generation algorithm
- Gift card discount calculation
- Policy fee calculation
- Notification placeholder substitution

### Integration Tests
- Onboarding completion → all tables populated
- Booking creation → customer + booking + payment records
- Money action → Stripe charge + DB update

### Manual Testing Checklist
- [ ] Sign up → complete onboarding → see admin
- [ ] Public booking site loads with business data
- [ ] Customer books appointment → card saved
- [ ] Admin sees booking in Past Bookings
- [ ] Click "Completed" → charge succeeds
- [ ] Click "No-Show" → fee charged
- [ ] Click "Refund" → refund processed
- [ ] Notifications send (check email/SMS)
- [ ] Gift card applied → discount shown
- [ ] Availability slots respect blackouts

---

## Deployment Checklist

Before going live:
- [ ] All migrations applied to production Supabase
- [ ] Environment variables set (Stripe keys, Supabase keys)
- [ ] Stripe webhook URL configured
- [ ] RLS policies tested in production
- [ ] Seed script run (optional demo business)
- [ ] Error monitoring set up (Sentry or similar)
- [ ] Logging configured (Supabase Logflare or Vercel logs)

---

## Next Steps

**Start with Task 3**: Set up Supabase client and verify connection. This is the foundation everything else builds on.

Once Task 3 is done, move to Task 4 and implement one onboarding step at a time. Test each step before moving to the next.

**Estimated Total Time**: 30-40 hours for complete v1 backend

**Priority Order**: Tasks 3-7 are critical for MVP. Tasks 8-11 add polish but can be done incrementally.




