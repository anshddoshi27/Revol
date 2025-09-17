# Tithi Backend — Complete Atomic Tasks Reference

This document contains all atomic tasks for building the Tithi backend, organized by phases with full specifications.

---

## Mission Context

Tithi is an end-to-end, fully white-labeled platform for service-based businesses (e.g., salons, clinics, studios) to launch their own branded booking systems in minutes.

Every tenant (business) has its own subdomain (business.tithi.com) or custom domain.

Customers booking services only see the business's brand, logo, colors, policies, not "Tithi" (unless explicitly chosen).

Tithi replaces multiple tools by offering onboarding, branding, bookings, payments, policies, notifications, CRM, analytics — all within one modular platform.

**North Star Goals:**
- Strict tenant data isolation.
- Full tenant-controlled branding.
- Owner/Admin only (no staff roles in v1).
- Bookings require full payment validation.
- Availability must always be defined for booking to function.
- Secure, observable, and deterministic backend execution.

## Executor Guidelines

### 1. Task Context
- Always reference the design brief and context pack before generating outputs.
- Ensure every deliverable aligns with Tithi's mission, business rules, and platform goals.
- If task requirements conflict with mission context → stop and generate clarifying questions.

### 2. Confidence Score Workflow
**Confidence Score (0–100%):**
- If <100% → do not execute. Instead:
  - List areas of uncertainty.
  - Generate clarifying questions.
  - Await user input.
  - Recalculate confidence.
- If 100% → proceed with deliverable generation.

**Explanation Required:** Always explain why the score was chosen. If <100%, include explicit questions.

### 3. Tenant Isolation & Security
- Every action, query, schema, log, and notification must be scoped by tenant_id.
- Cross-tenant access is forbidden, even in examples or test cases.
- Customer profiles are tenant-specific. If the same individual books with two businesses, two distinct profiles are created.

### 4. Payments & Bookings
Bookings are valid only when fully paid:
- Credit card required (even if "cash" selected, to enforce no-show fee).
- Gift card/coupon must cover full amount. If partial, balance requires credit card.
- No booking can be confirmed without complete payment success.
- Payments and booking creation must be atomic, idempotent, and deterministic.

### 5. Availability Rules
- Admin (owner) must define weekly availability blocks (1-hour increments).
- Availability is always required; without it, booking pages display:
  "Online booking isn't available for <Business Name> at this time."
- Exceptions (buffers, holidays) must be manually configured and take effect immediately.

### 6. Branding & White-Labeling
- All customer-facing outputs are tenant-branded.
- If branding data missing → fallback:
  - Business name in clean black & white font, optional gradients, professional style.
  - No Tithi mention.

### 7. Notifications
- Automatic booking confirmation (email + SMS) sent post-booking.
- All other reminders/follow-ups are manual in v1.
- Notifications must never duplicate.
- Admin can configure message content and timing.

### 8. Error Handling & Observability
- Errors must follow Tithi error codes with human-readable and machine-readable formats.
- All operations must log structured metadata: tenant_id, booking_id, payment_id, etc.
- Include observability hooks for tracing, metrics, and debugging.

### 9. Idempotency & Determinism
- All tasks must be idempotent (same inputs = same outputs).
- No unintended side effects on re-execution.
- Transactions must be deterministic.

### 10. Test Coverage
Generate unit + integration tests for:
- Tenant isolation enforcement.
- Booking/payment rules.
- Notifications.
- CRUD flows for tenant-specific entities.

### 11. Human-Readable Deliverable Summary
Before generating technical outputs, provide a short plain-language explanation of what the deliverable is and how it fits Tithi's mission.

### 12. Environment Defaults
- Development: local DB, dummy Stripe, emails → console.
- Staging: test DB, test Stripe, emails → test addresses.
- Production: real DB, real Stripe, real emails.

Always confirm the environment context before generating.

### 13. Future-Proofing
If task implementation involves assumptions that may change in v2+ (e.g., staff roles, recurring bookings, saved availability templates, alternative payments), flag them for future consideration.

## Phase 1 — Foundation Setup

### Task 1.1: Backend Project Scaffold
**Context:** Initialize backend repo with Python 3.11, Flask blueprints, Supabase/Postgres integration, Alembic migrations, and directory layout.

**Deliverable:** 
- Repo initialized with Flask app factory pattern
- Config for environments (dev/staging/prod)
- Supabase client integration
- Directory layout: `/api`, `/models`, `/services`, `/migrations`

**Constraints:**
- Must use Python 3.11
- Alembic migrations required for schema
- Config must be 12-factor compliant

**Inputs/Outputs:**
- Input: N/A
- Output: Running Flask app with "/health" endpoint

**Validation:** `GET /health` returns 200 with `{status: "ok"}`

**Testing:**
- Unit: health check returns 200
- Integration: app runs locally with Postgres

**Dependencies:** None

**Executive Rationale:** This establishes the foundational scaffolding for the backend. Without a proper project structure, later atomic tasks risk inconsistency, duplication, or brittle integration.

**North-Star Invariants:**
- The backend must always boot successfully in all environments
- All configs must be externalized (never hardcoded)

**Contract Tests (Black-box):** Given a running backend container, When a request is made to GET /health, Then the response must be 200 and include {status: "ok"}.

**Schema/DTO Freeze Note:** No schemas introduced here; DTOs frozen at future tasks.

**Observability Hooks:**
- Log "BACKEND_BOOTED" with env and timestamp
- Metric: `backend_startup_duration_ms`

**Error Model Enforcement:** `TITHI_BOOT_FAILURE` if environment variables missing

**Idempotency & Retry Guarantee:** Not applicable (setup task)

---

### Task 1.2: Database Initialization
**Context:** Setup Postgres schema with tenant isolation, RLS enabled. Provides core tables for tenants, users, and base metadata.

**Deliverable:**
- Alembic migration creating `tenants`, `users`, `roles`
- RLS enabled on all tenant tables

**Constraints:**
- Must enforce tenant_id scoping
- Primary keys = UUID v4

**Inputs/Outputs:**
- Input: Migration execution
- Output: Database schema

**Validation:**
- Tables created with RLS ON
- Queries without tenant_id denied

**Testing:**
- Attempt select without tenant_id → denied
- Insert with tenant_id → success

**Dependencies:** Task 1.1

**Executive Rationale:** This guarantees multi-tenant isolation from day one. Prevents data leaks and underpins compliance with privacy regulations.

**North-Star Invariants:**
- No tenant may read/write another tenant's data
- Every row in a tenant-scoped table must have tenant_id

**Contract Tests (Black-box):** Given tenant A and tenant B exist, When a user from tenant A queries users table, Then no rows belonging to tenant B are returned.

**Schema/DTO Freeze Note:** `tenants`, `users`, `roles` schemas frozen after this task.

**Observability Hooks:** Emit `DB_SCHEMA_MIGRATION_APPLIED` event with migration_id

**Error Model Enforcement:** `TITHI_DB_RLS_VIOLATION` for queries violating RLS

**Idempotency & Retry Guarantee:** Alembic migrations must be idempotent; re-running applies no changes

---

### Task 1.3: Multi-Environment Config
**Context:** Configure environment handling for dev/staging/prod with secrets management.

**Deliverable:**
- `.env` support with dotenv
- Config loader for per-env secrets

**Constraints:**
- No secrets in repo
- ENV variables required at startup

**Inputs/Outputs:**
- Input: ENV vars
- Output: Flask app configured

**Validation:** Missing secrets → error

**Testing:** Run app with missing DB_URL → fails

**Dependencies:** Task 1.1

**Executive Rationale:** Ensures secure, environment-specific deployment. Prevents secret leakage into code and makes scaling predictable.

**North-Star Invariants:**
- Secrets must never be hardcoded
- Each env config must fully resolve before app starts

**Contract Tests (Black-box):** Given no DB_URL in env, When backend boots, Then it fails with TITHI_BOOT_FAILURE.

**Schema/DTO Freeze Note:** No schema introduced.

**Observability Hooks:** Emit `CONFIG_LOADED` with env_name

**Error Model Enforcement:** `TITHI_BOOT_FAILURE` → missing secrets

**Idempotency & Retry Guarantee:** Configs loaded once per boot

---

## Phase 2 — Authentication & Authorization

### Task 2.1: JWT Auth Setup
**Context:** Implement authentication with JWT, including tenant_id claims. Provides the base for secure access control.

**Deliverable:**
- JWT encode/decode with secret
- Middleware to inject tenant_id from JWT

**Constraints:**
- JWT expiry = 1h
- Refresh tokens implemented

**Inputs/Outputs:**
- Input: {username, password}
- Output: {access_token, refresh_token}

**Validation:**
- Valid creds → token returned
- Invalid → 401

**Testing:** Decode token → tenant_id claim correct

**Dependencies:** Task 1.2

**Executive Rationale:** JWT with tenant_id enables secure, scoped access control. Critical for ensuring every request is tied to the correct tenant.

**North-Star Invariants:**
- Tenant_id claim must always be present
- Expired tokens must always fail

**Contract Tests (Black-box):** Given a valid user, When they request a token, Then response includes access_token with tenant_id claim.

**Schema/DTO Freeze Note:** `auth_tokens` DTO frozen.

**Observability Hooks:**
- Emit `AUTH_LOGIN_SUCCESS` and `AUTH_LOGIN_FAIL`

**Error Model Enforcement:**
- `TITHI_AUTH_INVALID_CREDENTIALS`
- `TITHI_AUTH_EXPIRED_TOKEN`

**Idempotency & Retry Guarantee:** Token generation idempotent per login

---

### Task 2.2: Role-Based Access Control (RBAC)
**Context:** Enforce roles (owner, admin, staff, customer). RBAC ensures correct privilege boundaries.

**Deliverable:**
- Middleware enforcing role checks
- DB schema for roles per user

**Constraints:** Each user has exactly 1 role per tenant

**Inputs/Outputs:**
- Input: API request with JWT
- Output: allow/deny

**Validation:**
- Owner can manage staff
- Staff cannot change roles

**Testing:** Try staff → create tenant = 403

**Dependencies:** Task 2.1

**Executive Rationale:** Role isolation ensures security boundaries between tenant staff and customers. Prevents privilege escalation.

**North-Star Invariants:**
- Customers must never access admin endpoints
- Owners always retain ultimate authority

**Contract Tests (Black-box):** Given a staff user, When they attempt to create a new tenant, Then they receive 403 Forbidden.

**Schema/DTO Freeze Note:** `roles` schema frozen.

**Observability Hooks:** Emit `RBAC_DENIED` log with user_id, endpoint

**Error Model Enforcement:** `TITHI_AUTH_FORBIDDEN_ROLE`

**Idempotency & Retry Guarantee:** RBAC checks deterministic, no side effects

---

## Phase 3 — Onboarding & Tenant Branding

### Task 3.1: Tenant Onboarding Wizard
**Context:** Businesses register via onboarding wizard: business name, category, subdomain, logo, policies.

**Deliverable:**
- `/onboarding/register` endpoint
- Generates subdomain `<tenant>.tithi.com`
- Saves branding + policy defaults

**Constraints:**
- Subdomain unique
- Policies defaulted but editable

**Inputs/Outputs:**
- Input: {business_name, category, logo, policies}
- Output: tenant record + subdomain

**Validation:** Duplicate subdomain → error

**Testing:** Register → accessible at `<tenant>.tithi.com`

**Dependencies:** Task 1.2, Task 2.1

**Executive Rationale:** Onboarding is the entry point for businesses, defining brand, policies, and subdomain. Foundation for white-label promise.

**North-Star Invariants:**
- No two tenants share subdomain
- Onboarding must always result in functional tenant

**Contract Tests (Black-box):** Given a business registers with subdomain "spa123", When another tries same subdomain, Then system must reject with 409 conflict.

**Schema/DTO Freeze Note:** `tenants` schema extended, frozen post-task.

**Observability Hooks:** Emit `TENANT_ONBOARDED` with tenant_id, subdomain

**Error Model Enforcement:** `TITHI_TENANT_DUPLICATE_SUBDOMAIN`

**Idempotency & Retry Guarantee:** Registration idempotent per email/subdomain

---

### Task 3.2: Branding Assets
**Context:** Allow tenants to upload logos, choose colors, and customize booking page.

**Deliverable:**
- `/branding/assets` endpoint
- S3 bucket integration for logos

**Constraints:**
- Max logo size 2MB
- Colors validated against hex

**Inputs/Outputs:**
- Input: {logo_file, hex_colors}
- Output: branding record

**Validation:** Invalid hex rejected

**Testing:** Upload logo → retrievable

**Dependencies:** Task 3.1

**Executive Rationale:** Branding assets enable white-label booking experiences that differentiate businesses.

**North-Star Invariants:**
- Assets must always resolve correctly
- Branding must always scope to tenant

**Contract Tests (Black-box):** Given a tenant uploads a logo, When another tenant fetches it, Then system must deny access (403).

**Schema/DTO Freeze Note:** `branding` schema frozen.

**Observability Hooks:** Emit `BRANDING_UPDATED` log

**Error Model Enforcement:** `TITHI_BRANDING_INVALID_HEX`

**Idempotency & Retry Guarantee:** Logo uploads overwrite deterministically

---

## Phase 1 — Foundation, Auth & Onboarding (Modules A, B, C) - COMPLETION CRITERIA

**End Goal:** Fully operational foundational backend with multi-tenant architecture, auth, and tenant onboarding. The system should be capable of registering new tenants and staff, applying white-label branding, and enforcing execution discipline.

**Requirements:**

**Module A — Foundation Setup & Execution Discipline**
- App factory & config management implemented.
- Health endpoints /health/live & /health/ready pass.
- Structured logging in place with tenant_id and user_id redacted.
- CI gates enforce frozen interfaces & contract tests.
- Micro-tickets created from brief for all initial tasks.
- Execution context validation ensures all developers reference design brief, DB migrations, frozen DTOs.

**Module B — Auth & Tenancy**
- Supabase JWT validation implemented.
- Tenant resolution works via path /v1/b/{slug} and host-based API /api/resolve-tenant.
- Staff invites & membership creation fully functional.
- RLS policies enforce tenant scoping (no cross-tenant data leaks).
- Error model codes defined (TITHI_AUTH_INVALID_INVITE, TITHI_AUTH_UNAUTHORIZED).
- Contract tests validate JWT, tenant resolution, and membership isolation.
- Observability hooks for login, invite creation, acceptance.

**Module C — Onboarding & Branding**
- Tenant creation endpoint (POST /v1/tenants) works with subdomain auto-generation.
- Branding endpoints functional (PUT /v1/tenants/{id}/branding, theme versioning, publish theme).
- Custom domain connection endpoint works with DNS verification & SSL provisioning.
- Asset URLs are signed and expire correctly.
- Test booking flow for onboarding validated (tenant sees branding & theme).
- Contract tests ensure branding endpoints return correct DTOs; DTOs frozen.
- Structured logs emitted for tenant creation, branding updates.

**Phase Completion Criteria:**
- Tenant can onboard fully and see their branded admin/public pages.
- All auth flows validated end-to-end (owners, staff, JWTs).
- CI/CD passes foundation checks (lint, unit tests, pgTAP).
- No data leaks; RLS enforced and verified via tests.
- Health & logging infrastructure functional.

---

## Phase 4 — Core Booking System

### Task 4.1: Service Catalog
**Context:** Businesses must define services (name, duration, price, staff assignment). Foundation for booking.

**Deliverable:**
- `/services` CRUD endpoints
- `services` table migration

**Constraints:**
- Duration in minutes, > 0
- Price must be >= 0

**Inputs/Outputs:**
- Input: {name, duration, price}
- Output: {service_id}

**Validation:**
- Duplicate name allowed
- Invalid duration rejected

**Testing:** Create service → retrievable

**Dependencies:** Task 3.1

**Executive Rationale:** Defines what can be booked. Without services, no scheduling is possible.

**North-Star Invariants:**
- Every service must belong to exactly one tenant
- Duration cannot be negative

**Contract Tests (Black-box):** Given tenant A and tenant B exist, When tenant A lists services, Then no services from tenant B are included.

**Schema/DTO Freeze Note:** `services` schema frozen.

**Observability Hooks:** Emit `SERVICE_CREATED` with service_id, tenant_id

**Error Model Enforcement:** `TITHI_SERVICE_INVALID_DURATION`

**Idempotency & Retry Guarantee:** Service creation idempotent by {tenant_id, name}

---

### Task 4.2: Staff Availability
**Context:** Staff define working hours and availability. Bookings cannot be made outside availability.

**Deliverable:**
- `/staff/availability` endpoints
- `staff_availability` table

**Constraints:**
- Must support recurring weekly schedules
- Timezones handled per tenant

**Inputs/Outputs:**
- Input: {staff_id, weekday, start_time, end_time}
- Output: availability record

**Validation:** End > start

**Testing:** Query availability returns correct slots

**Dependencies:** Task 4.1

**Executive Rationale:** Availability ensures bookings respect real-world staff schedules, preventing double-booking.

**North-Star Invariants:** A booking must never exist outside availability

**Contract Tests (Black-box):** Given staff sets availability Mon 9–5, When a booking is attempted Mon 6pm, Then system rejects with 409.

**Schema/DTO Freeze Note:** `staff_availability` schema frozen.

**Observability Hooks:** Emit `AVAILABILITY_SET`

**Error Model Enforcement:** `TITHI_AVAILABILITY_CONFLICT`

**Idempotency & Retry Guarantee:** Same availability submission overwrites cleanly

---

### Task 4.3: Booking Creation
**Context:** Customers create bookings against services & staff respecting availability.

**Deliverable:**
- `/bookings/create` endpoint
- `bookings` table

**Constraints:**
- Must prevent overlaps
- Must enforce cancellation policy reference

**Inputs/Outputs:**
- Input: {customer_id, service_id, staff_id, datetime}
- Output: {booking_id}

**Validation:**
- Staff free at time
- Service exists

**Testing:** Overlap booking rejected

**Dependencies:** Task 4.2

**Executive Rationale:** This is the core revenue-driving feature. Booking system integrity is mission critical.

**North-Star Invariants:**
- No booking overlaps
- Booking always linked to tenant

**Contract Tests (Black-box):** Given staff has booking 2–3pm, When another booking is attempted 2:30–3pm, Then system rejects with TITHI_BOOKING_CONFLICT.

**Schema/DTO Freeze Note:** `bookings` schema frozen.

**Observability Hooks:** Emit `BOOKING_CREATED` with tenant_id, booking_id

**Error Model Enforcement:**
- `TITHI_BOOKING_CONFLICT`
- `TITHI_BOOKING_OUTSIDE_AVAILABILITY`

**Idempotency & Retry Guarantee:** Booking creation idempotent with client-sent key

---

## Phase 2 — Core Booking System (Modules D, E, F, G) - COMPLETION CRITERIA

**End Goal:** Services, staff, schedules, availability, and booking lifecycle fully functional and deterministic. The system can handle bookings respecting availability, buffer times, overlapping constraints, and customer data creation.

**Requirements:**

**Module D — Services & Catalog**
- CRUD for services works with tenant scoping.
- Bulk updates functional and validated.
- Deletion rules prevent active booking removal; soft-delete + notifications implemented.
- Contract tests validate service retrieval per tenant only.
- Observability: SERVICE_CREATED, SERVICE_UPDATED, SERVICE_DELETED structured logs emitted.

**Module E — Staff & Work Schedules**
- Staff profiles creation/update with assignments.
- Work schedules using RRULE implemented; overrides supported.
- Conflict detection (overlaps, deleted staff) implemented.
- Google Calendar sync optional, OAuth integrated.
- Contract tests: staff access only within tenant, schedule rules respected.

**Module F — Availability & Scheduling Engine**
- Availability calculated from recurring rules, exceptions, resource calendars.
- Buffer times, breaks, capacity, and constraints applied.
- Holds and waitlists implemented with TTL, idempotency, and distributed locks.
- DST & timezone conversion edge cases handled.
- Contract tests validate availability output and hold/release APIs.
- Observability hooks: AVAILABILITY_CALC, HOLD_CREATED, HOLD_RELEASED.

**Module G — Booking Lifecycle**
- Booking CRUD with client-generated IDs for idempotency.
- Overlap prevention via GiST constraints & availability checks.
- Cancellation, reschedule, no-show flows functional with Stripe integration.
- Partial failure handling via outbox pattern.
- Contract tests validate multi-tenant isolation, booking constraints, notification triggers.
- Structured logs: BOOKING_CREATED, BOOKING_CONFIRMED, BOOKING_CANCELLED.

**Phase Completion Criteria:**
- Public booking flow functional: service selection → availability → booking → confirmation.
- Availability engine deterministic; edge cases (DST, overlaps) verified.
- All booking events trigger outbox events for notifications & analytics.
- CI/CD passes unit, integration, pgTAP, contract tests.
- No tenant sees another tenant's services, staff, or bookings.

---

## Phase 5 — Payments & Policies

### Task 5.1: Stripe Integration
**Context:** Integrate Stripe Connect for tenant payments.

**Deliverable:**
- `/payments/checkout` endpoint
- Stripe secret keys per tenant

**Constraints:**
- Must tokenize card
- PCI compliance via Stripe only

**Inputs/Outputs:**
- Input: {booking_id, payment_method}
- Output: {payment_intent_id}

**Validation:**
- Booking must exist
- Tenant Stripe connected

**Testing:** Payment success triggers webhook

**Dependencies:** Task 4.3

**Executive Rationale:** Enables monetization. Without payments, platform lacks business model.

**North-Star Invariants:**
- No booking may be confirmed without a payment intent (if required)
- Every payment has Stripe ID

**Contract Tests (Black-box):** Given a valid booking, When payment submitted, Then Stripe payment_intent created and linked.

**Schema/DTO Freeze Note:** `payments` schema frozen.

**Observability Hooks:** Emit `PAYMENT_INITIATED`

**Error Model Enforcement:** `TITHI_PAYMENT_FAILED`

**Idempotency & Retry Guarantee:** Stripe API used with idempotency keys

---

### Task 5.2: Refunds & Cancellation Fees
**Context:** Process refunds when bookings cancelled. Apply no-show fees.

**Deliverable:**
- `/payments/refund` endpoint
- Refund workflow tied to cancellation policies

**Constraints:**
- Stripe refund APIs only
- Must respect cancellation window

**Inputs/Outputs:**
- Input: {booking_id}
- Output: {refund_id}

**Validation:** Cancelled booking → refund allowed

**Testing:** Cancel before window → full refund

**Dependencies:** Task 5.1

**Executive Rationale:** Refunds + fees protect revenue and enforce policies. Critical for business trust.

**North-Star Invariants:**
- Refund logic must always follow policy
- No refund without prior charge

**Contract Tests (Black-box):** Given cancellation < 24h, When refund requested, Then only partial refund issued.

**Schema/DTO Freeze Note:** `refunds` schema frozen.

**Observability Hooks:** Emit `REFUND_ISSUED`

**Error Model Enforcement:** `TITHI_REFUND_POLICY_VIOLATION`

**Idempotency & Retry Guarantee:** Refund idempotent by booking_id

---

## Phase 6 — Promotions & Loyalty

### Task 6.1: Coupons & Gift Codes
**Context:** Allow tenants to create coupons/gift codes for customers.

**Deliverable:**
- `/promotions/coupons` CRUD
- `coupons` table

**Constraints:**
- Code unique per tenant
- Expiry dates enforced

**Inputs/Outputs:**
- Input: {code, discount, expiry}
- Output: coupon record

**Validation:** Expired coupons rejected

**Testing:** Apply coupon → discount applied

**Dependencies:** Task 5.1

**Executive Rationale:** Promotions drive customer acquisition and retention.

**North-Star Invariants:**
- Discount never exceeds 100%
- Expired coupons never valid

**Contract Tests (Black-box):** Given a coupon expired yesterday, When applied at checkout, Then system rejects with TITHI_COUPON_EXPIRED.

**Schema/DTO Freeze Note:** `coupons` schema frozen.

**Observability Hooks:** Emit `COUPON_REDEEMED`

**Error Model Enforcement:**
- `TITHI_COUPON_INVALID`
- `TITHI_COUPON_EXPIRED`

**Idempotency & Retry Guarantee:** Coupon redemption atomic

---

### Task 6.2: Loyalty Tracking
**Context:** Track customer visits & rewards.

**Deliverable:**
- `/loyalty` endpoints
- `loyalty_points` table

**Constraints:**
- 1 point per booking
- Configurable rewards

**Inputs/Outputs:**
- Input: booking completion
- Output: points balance updated

**Validation:** Duplicate booking → no double points

**Testing:** 3 bookings → 3 points

**Dependencies:** Task 4.3

**Executive Rationale:** Loyalty builds repeat business and engagement.

**North-Star Invariants:**
- Points must only accrue from completed bookings
- Balances must be tenant-scoped

**Contract Tests (Black-box):** Given customer completes 2 bookings, When loyalty queried, Then balance shows 2 points.

**Schema/DTO Freeze Note:** `loyalty_points` schema frozen.

**Observability Hooks:** Emit `LOYALTY_EARNED`

**Error Model Enforcement:** `TITHI_LOYALTY_DUPLICATE_BOOKING`

**Idempotency & Retry Guarantee:** Idempotent by booking_id

---

## Phase 3 — Payments & Business Logic (Modules H, I, J) - COMPLETION CRITERIA

**End Goal:** Payments, billing, promotions, and notifications fully functional. Customers can pay securely, promotions applied correctly, and notifications sent reliably according to tenant branding.

**Requirements:**

**Module H — Payments & Billing**
- Payment intents, SetupIntents, captures, refunds, and no-show fees handled via Stripe.
- Support multiple providers: card, Apple Pay, Google Pay, PayPal, cash (collateral capture).
- Stripe Connect payout integration for tenants.
- Idempotency & provider replay protection implemented.
- Contract tests for payment flows (success, failure, partial refund).
- Structured logs: PAYMENT_INTENT_CREATED, PAYMENT_CAPTURED, PAYMENT_REFUNDED.

**Module I — Promotions & Gift Cards**
- Coupons, gift cards, referral codes created and validated per tenant.
- Conditional rules, stacking logic, and usage limits enforced.
- A/B testing framework implemented for tenants.
- Contract tests ensure tenant isolation and promo validity.
- Observability hooks: PROMO_CREATED, PROMO_APPLIED, PROMO_EXPIRED.

**Module J — Notifications & Messaging**
- Template creation and updates functional per tenant.
- Automated triggers for booking events (confirmation, reminders, follow-ups).
- SMS (Twilio) and email (SendGrid) channels integrated.
- Deduplication, retries, SLA adherence implemented.
- Contract tests for notification delivery and opt-in/opt-out handling.
- Structured logs: NOTIFICATION_ENQUEUED, NOTIFICATION_SENT, NOTIFICATION_FAILED.

**Phase Completion Criteria:**
- Payments flow end-to-end verified; no-show fees enforced correctly.
- Promotions & coupons applied correctly with analytics captured.
- Notifications delivered reliably with SLA & opt-in compliance.
- All contract tests pass; observability hooks emit required metrics.
- CI/CD passes unit, integration, and contract tests; staging environment tested.

---

## Phase 7 — Notifications & Automations

### Task 7.1: Email Notifications
**Context:** Send transactional emails for booking confirmations, cancellations, reminders, and promotions.

**Deliverable:**
- `/notifications/email` service
- Integration with SendGrid

**Constraints:**
- Must use tenant branding
- Must be async queue-based

**Inputs/Outputs:**
- Input: {template, recipient, variables}
- Output: delivery_id

**Validation:** Email sent with correct tenant logo/colors

**Testing:** Confirmation email includes service, time, staff

**Dependencies:** Task 4.3, Task 3.2

**Executive Rationale:** Email is primary transactional channel. Without it, customers lack booking confirmation.

**North-Star Invariants:**
- Emails must always be branded
- Customers must never receive another tenant's emails

**Contract Tests (Black-box):** Given a tenant books a service, When confirmation email sent, Then email includes tenant branding and booking details.

**Schema/DTO Freeze Note:** `notification_logs` schema frozen here.

**Observability Hooks:** Emit `EMAIL_SENT`

**Error Model Enforcement:** `TITHI_EMAIL_DELIVERY_FAILED`

**Idempotency & Retry Guarantee:** Emails retried up to 3x if SendGrid error

---

### Task 7.2: SMS Notifications
**Context:** Send SMS reminders for bookings, cancellations, and promotions.

**Deliverable:**
- `/notifications/sms` service
- Twilio integration

**Constraints:**
- Opt-in required per customer
- Marketing SMS must allow unsubscribe

**Inputs/Outputs:**
- Input: {phone, message}
- Output: delivery_id

**Validation:** Unsubscribed users never receive SMS

**Testing:** Reminder SMS sent 24h before booking

**Dependencies:** Task 4.3

**Executive Rationale:** SMS drives high engagement for reminders and reduces no-shows.

**North-Star Invariants:**
- SMS must always respect opt-in
- Unsubscribed customers never contacted

**Contract Tests (Black-box):** Given a user unsubscribed from SMS, When a reminder scheduled, Then system skips delivery.

**Schema/DTO Freeze Note:** `customer_preferences` schema frozen.

**Observability Hooks:** Emit `SMS_SENT`

**Error Model Enforcement:**
- `TITHI_SMS_DELIVERY_FAILED`
- `TITHI_SMS_OPT_OUT`

**Idempotency & Retry Guarantee:** SMS retries 2x if Twilio fails

---

### Task 7.3: Automated Reminders & Campaigns
**Context:** Automate reminders (e.g., 24h before booking) and allow scheduled campaigns.

**Deliverable:**
- Scheduler service
- `/automations` endpoints

**Constraints:**
- Must support cron-like rules
- Must support cancellation of automations

**Inputs/Outputs:**
- Input: {trigger, action, schedule}
- Output: automation_id

**Validation:** Reminder triggers at correct time

**Testing:** Booking at 3pm → reminder at 3pm previous day

**Dependencies:** Task 7.1, Task 7.2

**Executive Rationale:** Automations reduce manual effort and enforce consistency in communication.

**North-Star Invariants:**
- Reminders must always fire at the correct time
- Campaigns must never exceed target audience scope

**Contract Tests (Black-box):** Given booking at 4pm Monday, When automation set for 24h prior, Then reminder fires at 4pm Sunday.

**Schema/DTO Freeze Note:** `automations` schema frozen.

**Observability Hooks:** Emit `AUTOMATION_TRIGGERED`

**Error Model Enforcement:** `TITHI_AUTOMATION_SCHEDULE_INVALID`

**Idempotency & Retry Guarantee:** Automations idempotent by {tenant_id, trigger, action}

---

## Phase 8 — Customer Relationship Management (CRM)

### Task 8.1: Customer Profiles
**Context:** Maintain customer profiles with booking history, notes, preferences.

**Deliverable:**
- `/customers` CRUD endpoints
- `customers` table

**Constraints:**
- PII encrypted at rest
- Email/phone unique per tenant

**Inputs/Outputs:**
- Input: {name, email, phone}
- Output: customer_id

**Validation:** Duplicate email rejected

**Testing:** Profile retrieved with booking history

**Dependencies:** Task 4.3

**Executive Rationale:** CRM centralizes customer data for personalization and analytics.

**North-Star Invariants:**
- Customer identity must remain unique within tenant
- Booking history immutable

**Contract Tests (Black-box):** Given customer email already exists, When another with same email added, Then system rejects with TITHI_CUSTOMER_DUPLICATE.

**Schema/DTO Freeze Note:** `customers` schema frozen.

**Observability Hooks:** Emit `CUSTOMER_CREATED`

**Error Model Enforcement:** `TITHI_CUSTOMER_DUPLICATE`

**Idempotency & Retry Guarantee:** Idempotent by email+tenant_id

---

### Task 8.2: Segmentation
**Context:** Allow filtering customers into segments (e.g., frequent, lapsed).

**Deliverable:**
- `/customers/segments` endpoints
- Dynamic queries on booking + loyalty data

**Constraints:** Must be filterable by frequency, recency, spend

**Inputs/Outputs:**
- Input: {criteria}
- Output: segment list

**Validation:** Segments return expected customers

**Testing:** Frequent filter → returns top bookers

**Dependencies:** Task 8.1, Task 6.2

**Executive Rationale:** Segmentation powers targeted marketing and personalization.

**North-Star Invariants:**
- Segments must be reproducible
- Segments must never cross tenants

**Contract Tests (Black-box):** Given tenant has 10 customers, When filter applied spend > $1000, Then only qualifying customers returned.

**Schema/DTO Freeze Note:** `segments` schema frozen.

**Observability Hooks:** Emit `SEGMENT_CREATED`

**Error Model Enforcement:** `TITHI_SEGMENT_INVALID_CRITERIA`

**Idempotency & Retry Guarantee:** Segmentation queries deterministic

---

### Task 8.3: Notes & Interactions
**Context:** Allow staff to add notes per customer.

**Deliverable:**
- `/customers/{id}/notes` endpoints
- `customer_notes` table

**Constraints:** Notes private to tenant staff

**Inputs/Outputs:**
- Input: {note, staff_id}
- Output: note_id

**Validation:** Empty notes rejected

**Testing:** Notes retrievable by staff

**Dependencies:** Task 8.1

**Executive Rationale:** Notes enhance customer relationships and service personalization.

**North-Star Invariants:** Notes must never be exposed to customers

**Contract Tests (Black-box):** Given staff adds a note, When customer fetches their profile, Then note not visible.

**Schema/DTO Freeze Note:** `customer_notes` schema frozen.

**Observability Hooks:** Emit `NOTE_ADDED`

**Error Model Enforcement:** `TITHI_NOTE_INVALID`

**Idempotency & Retry Guarantee:** Idempotent by {customer_id, note_text, staff_id, timestamp}

---

## Phase 4 — CRM, Analytics & Admin Dashboard (Modules K, L, M) - COMPLETION CRITERIA

**End Goal:** Customer management, analytics, and admin dashboard fully functional. Businesses can see customer histories, segment audiences, run analytics, and manage the platform via admin UI.

**Requirements:**

**Module K — CRM & Customer Management**
- Customer profiles automatically created at first booking.
- Deduplication heuristics applied (email/phone fuzzy matching).
- Opt-in management for marketing messages (GDPR compliance).
- Loyalty program implemented: accrual & redemption APIs.
- Contract tests: tenant isolation, customer history integrity, loyalty points correctness.
- Observability: logs for CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_MERGED.

**Module L — Analytics & Reporting**
- Event ingestion pipeline from bookings, payments, notifications operational.
- Materialized views for dashboards refreshed according to latency requirements.
- Revenue, bookings, retention, promotions, and staff performance metrics exposed via API.
- Access control: only tenant owners/admins can query analytics.
- Contract tests validate multi-tenant isolation, correct aggregation, and edge cases.
- Observability: logs for ANALYTICS_EVENT_INGESTED, DASHBOARD_REFRESH.

**Module M — Admin Dashboard / UI Backends**
- Backend support for all admin actions (availability scheduler, services, bookings, CRM, promotions, notifications, staff, branding, billing, audit logs).
- Drag-and-drop rescheduling updates work_schedules and bookings atomically.
- Bulk actions implemented for booking table (confirm, cancel, reschedule, message).
- Live theme preview sandboxed for unpublished themes.
- Contract tests verify all admin actions respect tenant RLS, error codes, and idempotency.
- Observability: logs for ADMIN_ACTION_PERFORMED, including tenant_id, user_id, action_type.

**Phase Completion Criteria:**
- Admin can manage customers, bookings, promotions, staff, branding, and notifications fully.
- Dashboards return accurate metrics with materialized view refresh logic verified.
- Contract tests for CRM, analytics, and admin actions pass.
- CI/CD passes unit, integration, contract tests; staging tested for admin workflows.
- No tenant can access another tenant's data.

---

## Phase 9 — Analytics

### Task 9.1: Revenue Analytics
**Context:** Track revenue by service, staff, time period.

**Deliverable:**
- `/analytics/revenue` endpoints
- Aggregates payments data

**Constraints:**
- Must support date ranges
- Must exclude refunded payments

**Inputs/Outputs:**
- Input: {date_range}
- Output: revenue metrics

**Validation:** Refunds excluded

**Testing:** $100 booking refunded → net $0

**Dependencies:** Task 5.2

**Executive Rationale:** Revenue analytics are core KPIs for businesses.

**North-Star Invariants:**
- Revenue never double-counted
- Refunds always excluded

**Contract Tests (Black-box):** Given 2 payments $50 and $100, When queried, Then total revenue = $150.

**Schema/DTO Freeze Note:** `analytics_revenue` view frozen.

**Observability Hooks:** Emit `ANALYTICS_REVENUE_QUERIED`

**Error Model Enforcement:** `TITHI_ANALYTICS_QUERY_INVALID`

**Idempotency & Retry Guarantee:** Queries deterministic

---

### Task 9.2: Customer Analytics
**Context:** Track customer growth, churn, retention.

**Deliverable:**
- `/analytics/customers` endpoints
- Aggregates customer table

**Constraints:** Must define churned = no booking in 90d

**Inputs/Outputs:**
- Input: {date_range}
- Output: churn rate, retention

**Validation:** Numbers accurate with sample data

**Testing:** Customer churn test with inactivity

**Dependencies:** Task 8.1

**Executive Rationale:** Customer analytics drive marketing decisions.

**North-Star Invariants:** Metrics must always tenant-scope

**Contract Tests (Black-box):** Given 10 customers, 2 inactive > 90d, When churn calculated, Then churn = 20%.

**Schema/DTO Freeze Note:** `analytics_customers` view frozen.

**Observability Hooks:** Emit `ANALYTICS_CUSTOMERS_QUERIED`

**Error Model Enforcement:** `TITHI_ANALYTICS_INVALID_DATE_RANGE`

**Idempotency & Retry Guarantee:** Queries deterministic

---

### Task 9.3: Staff & Policy Analytics
**Context:** Track staff utilization, cancellations, no-shows.

**Deliverable:**
- `/analytics/staff` endpoints
- Aggregates bookings + cancellations

**Constraints:** Must calculate utilization % = booked_hours / available_hours

**Inputs/Outputs:**
- Input: {staff_id, date_range}
- Output: utilization, cancellations

**Validation:** Utilization calculated correctly

**Testing:** 20h availability, 10h booked → 50%

**Dependencies:** Task 4.2, Task 5.2

**Executive Rationale:** Staff analytics optimize resource allocation and policy enforcement.

**North-Star Invariants:** Utilization must never exceed 100%

**Contract Tests (Black-box):** Given 10h booked out of 20h available, When utilization queried, Then result = 50%.

**Schema/DTO Freeze Note:** `analytics_staff` view frozen.

**Observability Hooks:** Emit `ANALYTICS_STAFF_QUERIED`

**Error Model Enforcement:** `TITHI_ANALYTICS_CALCULATION_ERROR`

**Idempotency & Retry Guarantee:** Queries deterministic

---

## Phase 5 — Operations, Events & Audit (Module N) - COMPLETION CRITERIA

**End Goal:** System reliability, external integrations, audit logging, quotas, and retry mechanisms fully functional. Tithi backend can process webhooks, enforce quotas, and ensure observability.

**Requirements:**

**Module N — Operations, Events & Audit**
- Outbox pattern for outbound events (notifications, webhooks) implemented with Celery workers.
- Webhook inbox handles incoming provider events idempotently with signature validation.
- Quota enforcement implemented via usage_counters & quotas table; throttling & notifications for exceeded quotas.
- Audit logs record all relevant actions on PII, payments, bookings, promotions, and admin operations.
- Contract tests validate outbox/inbox reliability, replay protection, quota enforcement, and audit log completeness.
- Observability: logs for EVENT_OUTBOX_ENQUEUED, EVENT_PROCESSED, QUOTA_EXCEEDED, AUDIT_LOG_CREATED.

**Phase Completion Criteria:**
- All external provider integrations (Stripe, Twilio, SendGrid) operate reliably with retry and idempotency guarantees.
- Admins can view and retry failed events.
- Quotas enforced correctly per tenant; alerts generated.
- Audit logs capture all sensitive actions, with immutable storage and PII redaction.
- CI/CD passes unit, integration, contract tests; staging tested for operational resilience.

---

## Phase 10 — Admin Dashboard & Operations

### Task 10.1: Admin Booking Management
**Context:** Admins need to view, edit, and cancel bookings for operational control.

**Deliverable:**
- `/admin/bookings` endpoints
- Booking CRUD (with restrictions)

**Constraints:**
- Only admins/staff roles may access
- Must preserve audit trail

**Inputs/Outputs:**
- Input: {booking_id, update_fields}
- Output: updated booking

**Validation:** Booking edits must not violate staff availability

**Testing:** Admin reschedules booking → updates correctly

**Dependencies:** Task 4.3

**Executive Rationale:** Admins require operational oversight to resolve conflicts or customer issues.

**North-Star Invariants:** Audit log must always capture edits

**Contract Tests (Black-box):** Given admin edits booking time, When queried, Then audit log contains "RESCHEDULED" event.

**Schema/DTO Freeze Note:** `admin_booking_actions` log frozen.

**Observability Hooks:** Emit `BOOKING_MODIFIED`

**Error Model Enforcement:** `TITHI_BOOKING_EDIT_VIOLATION`

**Idempotency & Retry Guarantee:** Edits idempotent by booking_id + timestamp

---

### Task 10.2: Staff & Services Management
**Context:** Admins manage staff roster and services offered.

**Deliverable:**
- `/admin/staff` endpoints
- `/admin/services` endpoints

**Constraints:** Staff emails unique per tenant

**Inputs/Outputs:**
- Input: staff {name, role}, service {name, duration, price}
- Output: staff_id, service_id

**Validation:** Duplicate staff email rejected

**Testing:** Staff addition → available for bookings

**Dependencies:** Task 4.1, Task 4.2

**Executive Rationale:** Admins control resources and must configure them.

**North-Star Invariants:**
- Staff always scoped to tenant
- Services cannot exist without tenant link

**Contract Tests (Black-box):** Given staff added, When booking attempted, Then staff selectable in booking flow.

**Schema/DTO Freeze Note:** `staff` and `services` schemas frozen here.

**Observability Hooks:** Emit `STAFF_ADDED`

**Error Model Enforcement:** `TITHI_STAFF_DUPLICATE_EMAIL`

**Idempotency & Retry Guarantee:** Staff creation idempotent by email

---

### Task 10.3: Branding & White-Label Settings
**Context:** Tenants customize logo, colors, subdomain branding.

**Deliverable:**
- `/admin/branding` endpoints
- Asset upload (logo, favicon)

**Constraints:**
- Only tenant admin may modify
- Max file size 2MB

**Inputs/Outputs:**
- Input: {logo_file, color_hex, domain_subdomain}
- Output: updated branding config

**Validation:** Hex codes validated

**Testing:** Booking email includes logo + colors

**Dependencies:** Task 3.2

**Executive Rationale:** Branding ensures white-labeling for tenant differentiation.

**North-Star Invariants:**
- Subdomain unique globally
- Branding applied across all tenant assets

**Contract Tests (Black-box):** Given tenant uploads new logo, When customer receives email, Then new logo appears in email.

**Schema/DTO Freeze Note:** `branding_settings` schema frozen.

**Observability Hooks:** Emit `BRANDING_UPDATED`

**Error Model Enforcement:** `TITHI_BRANDING_INVALID_COLOR`

**Idempotency & Retry Guarantee:** Logo upload idempotent by checksum

---

### Task 10.4: Admin Analytics Dashboard
**Context:** Provide dashboard views for revenue, bookings, customers, staff.

**Deliverable:**
- `/admin/analytics` endpoints
- Pre-aggregated queries

**Constraints:** Must paginate large datasets

**Inputs/Outputs:**
- Input: {metric, range}
- Output: chart data

**Validation:** Data matches analytics API

**Testing:** Revenue dashboard matches manual query

**Dependencies:** Phase 9 tasks

**Executive Rationale:** Dashboards allow admins to monitor KPIs without SQL.

**North-Star Invariants:** Admin dashboards must always be accurate and consistent

**Contract Tests (Black-box):** Given revenue = $1000 in analytics API, When admin views dashboard, Then revenue shows $1000.

**Schema/DTO Freeze Note:** `admin_dashboard_views` frozen.

**Observability Hooks:** Emit `DASHBOARD_VIEWED`

**Error Model Enforcement:** `TITHI_DASHBOARD_DATA_MISMATCH`

**Idempotency & Retry Guarantee:** Queries deterministic

---

## Phase 6 — NFRs, Testing, CI/CD, Deployment (Global across all modules) - COMPLETION CRITERIA

**End Goal:** System non-functional requirements fully met — performance, security, reliability, maintainability, observability, compliance. CI/CD pipelines validate correctness; deployments follow safe practices.

**Requirements:**

**Performance**
- API median response < 500ms; public booking flow < 2s on 3G.
- Caching layer (Redis) integrated for tenant bootstrap and availability queries.
- Contract tests and load tests validate performance SLAs.

**Security**
- RLS enforced on all tables.
- JWT verification and rotation implemented.
- Field-level encryption for sensitive PII.
- PCI compliance verified: no raw card storage.
- Contract/adversarial tests validate RLS, JWT tampering, PII protection.

**Reliability**
- Backup & restore procedures implemented with daily backups & point-in-time recovery.
- Outbox/inbox ensures at-least-once delivery; retry policies in place.
- CI/CD tests validate idempotency, failover, and partial failure handling.

**Maintainability**
- Frozen DTOs and migrations enforced.
- Contract tests and OpenAPI spec generation automated.
- Micro-ticket system used for task tracking.

**Observability**
- Structured logs, Sentry, Prometheus metrics fully integrated.
- Alerts configured for failures, high no-show rates, provider outages.

**Compliance**
- GDPR flows for export/delete implemented per tenant and per customer.
- Marketing opt-in enforced for notifications.
- Audit logs capture PII access and changes.

**CI/CD**
- Linting, unit tests, contract tests, pgTAP validation pass before merge.
- Integration tests run in staging.
- Canary/feature flag deployment supported.
- Rollback plan tested and documented.

**Phase Completion Criteria:**
- All NFRs verified via automated tests and staging verification.
- CI/CD pipelines fully operational; deployments to production follow safe, repeatable steps.
- Observability and alerting systems operational.
- GDPR, PCI, and other compliance requirements validated.

---

## Phase 11 — Cross-Cutting Utilities

### Task 11.1: Audit Logging
**Context:** Every critical action (booking, refund, staff edit) must be logged.

**Deliverable:**
- `audit_logs` table
- Middleware to write logs

**Constraints:**
- Logs immutable
- Must include actor_id, timestamp

**Inputs/Outputs:**
- Input: {action, entity, actor_id}
- Output: log_id

**Validation:** Log cannot be altered

**Testing:** Booking creation → log exists

**Dependencies:** All prior phases

**Executive Rationale:** Audit logs provide compliance & traceability.

**North-Star Invariants:** Logs immutable

**Contract Tests (Black-box):** Given admin edits booking, When logs queried, Then entry exists with type = BOOKING_EDIT.

**Schema/DTO Freeze Note:** `audit_logs` schema frozen.

**Observability Hooks:** Emit `AUDIT_LOG_WRITTEN`

**Error Model Enforcement:** `TITHI_AUDIT_WRITE_FAILED`

**Idempotency & Retry Guarantee:** Idempotent by action + entity_id + timestamp

---

### Task 11.2: Rate Limiting
**Context:** Prevent abuse of APIs by enforcing tenant + user-level rate limits.

**Deliverable:**
- Rate limiter middleware
- Config per endpoint

**Constraints:**
- Global default: 100 req/min
- Configurable per tenant

**Inputs/Outputs:**
- Input: API request
- Output: allow/deny

**Validation:** Exceeding requests blocked

**Testing:** 101 requests → last one denied

**Dependencies:** None

**Executive Rationale:** Rate limits protect stability and prevent abuse.

**North-Star Invariants:** Limits must apply consistently

**Contract Tests (Black-box):** Given tenant exceeds 100 requests, When 101st sent, Then system responds 429.

**Schema/DTO Freeze Note:** `rate_limit_config` schema frozen.

**Observability Hooks:** Emit `RATE_LIMIT_TRIGGERED`

**Error Model Enforcement:** `TITHI_RATE_LIMIT_EXCEEDED`

**Idempotency & Retry Guarantee:** Rate limits deterministic

---

### Task 11.3: Timezone Handling
**Context:** Bookings, staff schedules, and analytics must support tenant timezones.

**Deliverable:**
- Global timezone config per tenant
- Helpers for conversions

**Constraints:** All timestamps stored UTC

**Inputs/Outputs:**
- Input: {datetime, tenant_timezone}
- Output: UTC datetime

**Validation:** Conversion correct

**Testing:** Booking at 9am EST → stored as 14:00 UTC

**Dependencies:** Task 4.2

**Executive Rationale:** Timezone handling ensures accuracy across geographies.

**North-Star Invariants:** UTC is always storage format

**Contract Tests (Black-box):** Given tenant in PST, When booking at 9am PST, Then stored datetime = 17:00 UTC.

**Schema/DTO Freeze Note:** `tenant_settings.timezone` frozen.

**Observability Hooks:** Emit `TIMEZONE_CONVERTED`

**Error Model Enforcement:** `TITHI_TIMEZONE_INVALID`

**Idempotency & Retry Guarantee:** Conversions deterministic

---

### Task 11.4: Idempotency Keys
**Context:** Critical endpoints (bookings, payments) must support idempotency for retries.

**Deliverable:**
- Idempotency middleware
- `idempotency_keys` table

**Constraints:** Client must send `Idempotency-Key`

**Inputs/Outputs:**
- Input: request + key
- Output: cached or new response

**Validation:** Repeat request returns same response

**Testing:** Duplicate booking request → same booking_id

**Dependencies:** Task 4.3, Task 5.1

**Executive Rationale:** Idempotency ensures exactly-once semantics.

**North-Star Invariants:** Same key = same result

**Contract Tests (Black-box):** Given booking created with key X, When retry sent with key X, Then same booking_id returned.

**Schema/DTO Freeze Note:** `idempotency_keys` schema frozen.

**Observability Hooks:** Emit `IDEMPOTENCY_KEY_USED`

**Error Model Enforcement:** `TITHI_IDEMPOTENCY_REUSE_ERROR`

**Idempotency & Retry Guarantee:** Core function of this task

---

### Task 11.5: Error Monitoring & Alerts
**Context:** Monitor system errors and notify developers.

**Deliverable:**
- Integration with Sentry
- Error alerting via Slack

**Constraints:** Must scrub PII

**Inputs/Outputs:**
- Input: exception
- Output: alert

**Validation:** Error logs visible in Sentry

**Testing:** Simulate error → alert fired

**Dependencies:** All tasks

**Executive Rationale:** Error monitoring enables rapid issue resolution.

**North-Star Invariants:** No error silently dropped

**Contract Tests (Black-box):** Given simulated 500 error, When system processes, Then Sentry alert created.

**Schema/DTO Freeze Note:** N/A (external system)

**Observability Hooks:** Emit `ERROR_REPORTED`

**Error Model Enforcement:** Centralized error codes enforced

**Idempotency & Retry Guarantee:** Error events retried until delivered

---

## Phase 7 — End-to-End Integration, Polish, & Final Validation - COMPLETION CRITERIA

**End Goal:** Tithi backend is fully integrated, tested, and production-ready. Business users can onboard, configure branding, services, staff, booking, payments, promotions, notifications, analytics, and admin dashboards without errors.

**Requirements:**

**Full end-to-end test coverage:** booking → payment → notifications → analytics → reporting.
- Contract, unit, integration, and pgTAP tests fully passing.
- Load, stress, and edge case testing completed.
- Admin dashboards validated for all workflows.
- Observability metrics verified in staging and production-like environments.
- Rollback and recovery procedures tested.
- All micro-tickets completed and documentation updated.

**Phase Completion Criteria:**
- Business can sign up, configure, and go live fully on Tithi.
- Customers can book, pay, receive notifications, and loyalty/rewards tracked.
- Admins can manage all modules through dashboards.
- System is reliable, observant, secure, GDPR/PCI compliant, and fully monitored.

---

## Summary

This document provides a complete reference for building the Tithi backend across 7 phases with detailed end goals and completion criteria:

1. **Phase 1 — Foundation, Auth & Onboarding (Modules A, B, C)** - Multi-tenant architecture, auth, and tenant onboarding
2. **Phase 2 — Core Booking System (Modules D, E, F, G)** - Services, staff, schedules, availability, and booking lifecycle
3. **Phase 3 — Payments & Business Logic (Modules H, I, J)** - Payments, billing, promotions, and notifications
4. **Phase 4 — CRM, Analytics & Admin Dashboard (Modules K, L, M)** - Customer management, analytics, and admin UI
5. **Phase 5 — Operations, Events & Audit (Module N)** - System reliability, external integrations, audit logging
6. **Phase 6 — NFRs, Testing, CI/CD, Deployment** - Performance, security, reliability, maintainability, observability, compliance
7. **Phase 7 — End-to-End Integration, Polish, & Final Validation** - Full integration, testing, and production readiness

Each phase includes:
- **End Goals** - Clear objectives for what the phase achieves
- **Module Requirements** - Specific deliverables for each module
- **Phase Completion Criteria** - Measurable success criteria that must be met before proceeding

Each task includes complete specifications for implementation, testing, and validation with frozen DTOs, contract tests, observability hooks, and idempotency guarantees.
