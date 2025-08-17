# Tithi DB — Context Pack (Build Guardrails) — Integrated 00–19

## Purpose
Production-grade, strictly isolated, path-based multi-tenant DB on Supabase/Postgres with RLS everywhere, offline-safe idempotency, no-overlap booking guarantees, PCI boundaries (Stripe), notifications, quotas, auditing, and exhaustive policies.  
Migrations **00–19** are the canonical core. Post-0019 changes must be additive, not breaking.

**Core boundaries include:**
- Web boundaries in-core: durable webhook inbox (idempotent inbound) and events outbox (exactly-once outbound)
- Capacity/buffer-aware availability
- Payment idempotency at provider boundary
- Notification dedupe + retry
- All hardening stays within 00–19; any future changes remain additive

---

# How to Use This Context Pack to Build Tithi’s Database

This pack is a step-by-step set of Cursor prompts that generate a production-grade, path-based multi-tenant schema on Supabase/Postgres with RLS everywhere, strict idempotency, booking overlap guarantees, notifications, quotas, auditing, and hardened policies. For each step, paste the prompt into Cursor and output exactly what the step asks for (file paths, fenced blocks, and docs updates). Keep migrations idempotent and wrapped in `BEGIN; … COMMIT;`. Append rationale to `docs/DB_PROGRESS.md` at every step.

---

## Execution Context Rule

When carrying out any task or generating files, migrations, or tests, **the AI executor (Cursor, Windsurf, or equivalent)** must always ground its work in all three canonical knowledge sources:

1. **Design Brief** → final schema, enumerations, policies, constraints, and post-0019 amendments  
2. **Context Pack** → guardrails, invariants, canon appends, migration sequence 00–19, CI rules  
3. **Cheat Sheets** →  
   - `interfaces.md` (contract surfaces, enums, tables, helpers)  
   - `constraints.md` (CHECKs, uniques, exclusions, NOT NULLs, partials)  
   - `critical_flows.md` (multi-step flows, precedence, triggers, lifecycle order)

### Executor Obligations
- **Load all three** into context before implementing.  
- **Check alignment**: ensure outputs match the Design Brief and do not violate Context Pack invariants or Cheat Sheet entries.  
- **Resolve conflicts with this priority order:**  
  1. Design Brief (final authoritative)  
  2. Context Pack (guardrails)  
  3. Cheat Sheets (coverage/expansion)  
- **Fail safe**: if any invariant or constraint would be broken, do not produce the output—surface the violation instead.  
- **Emit canon updates** (interfaces/constraints/flows counts) after each step, ensuring they reflect knowledge across all sources.

### Human Reviewers’ Role
- Confirm that each PR shows evidence the executor applied all three sources (citations to Brief, Pack, Cheat Sheets).  
- Reject outputs that rely only on partial context or contradict the Brief/Pack/Cheat Sheets.  
- CI should enforce by checking for presence of:  
  - Canon update blocks with counts  
  - “Execution Context Rule” mention in `docs/DB_PROGRESS.md`

## Ground Rules from the Context Pack (read once, follow always)

- **Multitenancy:** canonical path-slug `/b/{slug}`; no `domains` table pre-0019.  
- **RLS:** enabled on every table (deny-by-default), with standard tenant-scoped policies and special policies for tenancy tables.  
- **Helpers:** `public.current_tenant_id()` / `public.current_user_id()` return `NULL` on missing/invalid JWT; comparisons fail closed.  
- **Idempotency & No-overlap:**  
  - `bookings(tenant_id, client_generated_id)` unique  
  - exclusion constraint on `(resource_id, tstzrange(start_at,end_at,'[)'))` for active statuses  
- **Money & PCI:** integer cents only; Stripe boundary—no PAN in DB; provider idempotency keys and unique guards.  
- **Soft-delete:** partial uniques gated with `WHERE deleted_at IS NULL`.  
- **Events:** durable inbound webhook inbox + reliable `events_outbox` for exactly-once fan-out.

**Definition of Done:** wrap in transactions, attach `touch_updated_at` where present, enable RLS, add policies, add minimal indexes, update docs, and add/maintain pgTAP tests for isolation/overlap/idempotency/constraints.

---

## Prompt Index (What Each Step Produces)

**00 — Initialize DB folder + progress doc (no SQL)**  
Creates folder scaffolding and `docs/DB_PROGRESS.md` with a “How to read this” section. Output only one fenced block: the full MD file. Sets the documentation backbone for all later steps.

**01 — Extensions (pgcrypto, citext, btree_gist, pg_trgm)**  
Adds `0001_extensions.sql` with `BEGIN/COMMIT` and four `CREATE EXTENSION IF NOT EXISTS` statements. Update docs with “0001 – Extensions” explaining why each is required (UUIDs/crypto, case-insensitive email, exclusion constraints, trigram search).

**02 — Enum types (expanded)**  
Adds `0002_types.sql` defining core enums (booking/payment/membership/resource) plus notification and payment method enums. Update docs with usage per table/domain. Keep order stable.

**03 — RLS helper functions (hardened)**  
Adds `0003_helpers.sql` defining `current_tenant_id()` and `current_user_id()` as STABLE, SECURITY INVOKER, NULL-on-missing/invalid JWT. Docs explain claim injection and NULL behavior.

**04 — Core tenancy (path slugs) + updated_at trigger**  
Adds `0004_core_tenancy.sql`: `touch_updated_at()` trigger, tenants (billing, trust copy, public directory flags), users, memberships (role + permissions_json), themes (1:1). Explains path-based multitenancy under `/b/{slug}` and why no domains table is needed pre-0019.

**05 — Customers & resources (+ customer_metrics)**  
Adds customers (soft-delete, first-time flag, unique email per tenant) and resources (type, tz, metadata), plus denormalized customer_metrics for fast CRM rollups.

**06 — Services & mapping**  
Adds services (per-tenant slug, price/duration, category, soft-delete) and service_resources (service↔resource mapping). Emphasizes chips/carousels via category/active.

**07 — Availability (rules + exceptions)**  
Adds availability_rules with DOW/minute checks and optional RRULE JSON; availability_exceptions for closures/windows with validation. Sets the backbone for 15-minute slot generation.

**08 — Bookings & booking_items + overlap + status sync**  
Adds bookings (snapshots, status, start_at/end_at, idempotency key, attendee_count, rescheduled_from) + exclusion constraint to block overlaps; `sync_booking_status()` trigger for canceled/no_show. booking_items captures priced segments.

**09 — Payments & tenant_billing (+ cash/no-show fields)**  
Adds payments (statuses/methods, tip/tax support, provider IDs, SetupIntent, consent flag, no-show fee) and tenant_billing. PCI boundary notes: Stripe only; idempotency & provider uniques applied later.

**10 — Promotions (coupons, gift cards, referrals)**  
Adds tables with XOR checks (percent vs amount), non-negative balances, and unique referral pairs/codes. Clarifies separation from 3% new-customer royalty logic.

**11 — Notifications (templates + queue)**  
Adds notification_templates and notifications using channel/status enums, plus indexes for scheduled processing and worker consumption/dedupe.

**12 — Usage counters & quotas**  
Adds usage_counters (periodic, per-tenant) and quotas with updated_at. Sets up envelopes and enforcement points.

**13 — Audit logs + generic trigger (+ events_outbox)**  
Adds audit_logs (BRIN on created_at) and log_audit() triggers on key tables, plus events_outbox for reliable outbound integration/webhooks. Includes 12-month retention guidance.

**14 — Enable RLS on all tables**  
Globally enables RLS (deny-by-default) across every table introduced so far, including customer_metrics and events_outbox.

**15 — Standard tenant-scoped policies (+ DELETE)**  
Adds four policies per tenant-scoped table (SELECT/INSERT/UPDATE/DELETE) all gated by `tenant_id = current_tenant_id()`. Covers the core list including events_outbox and customer_metrics.

**16 — Special policies (tenants, users, memberships, themes, tenant_billing, quotas)**  
Adds member-gated SELECT for tenants, shared-tenant/self reads for users, owner/admin write gates for memberships/themes/tenant_billing/quotas. Uses helpers + EXISTS subqueries.

**17 — Performance indexes**  
Adds pragmatic indexes for common paths: bookings by time/status/reschedules/attendees, audit BRIN, customers/services, notifications. Notes where trigram/GIN search is beneficial.

**18 — Seed dev data**  
Seeds a single dev tenant (`salonx`) with theme, a staff resource, and a baseline service for local testing. Uses `ON CONFLICT DO NOTHING`.

**19 — Test scripts (pgTAP) for isolation & overlap**  
Adds `infra/supabase/tests/tenant_isolation.sql` and `overlap.sql` to prove cross-tenant isolation, booking exclusion correctness, status sync behavior, and idempotency. Appends docs with a “0019 – Tests” section.

---

## How Cursor Should Execute This Pack

1. Paste each prompt in order (00 → 19) to generate files/migrations/docs exactly as specified.  
2. Maintain invariants: updated_at trigger, RLS everywhere, tenant-scoped policies, idempotency, and exclusion constraints; keep money as integer cents and never store card data.  

**After each migration:**
- Confirm BEGIN/COMMIT, idempotent IF NOT EXISTS where applicable.  
- Attach `public.touch_updated_at()` when an `updated_at` column exists.  
- Append to `docs/DB_PROGRESS.md` with the named section and concise rationale.  

**After policies (15–16):**
- Verify “deny by default” holds—only positive policies allow access.  

**Run the pgTAP tests (19)** and ensure isolation/overlap/idempotency constraints pass. Expand tests when you add functionality.

---

## Post-0019 Rule

Future changes must be additive, not breaking. Extend with new migrations, do not mutate earlier contracts or enum order.

---

## Outcome

Following these prompts and the context pack yields a production-ready, path-based multi-tenant database for Tithi, with robust RLS, safe offline flows, strict booking guarantees, PCI-clean payments, reliable notifications/eventing, and auditable operations—ready for real-world scale.

---

## Canon Appends & Coverage Guide (STRICT)

**When this applies:** every prompt **P0000 → P0019 (core)** and any **post-0019 additive migration**.  
**Goal:** never miss a contract, rule, or flow defined by the pack (enums, RLS, overlap, idempotency, outbox, PCI, etc.).

---

### A. What to output in every prompt

Immediately after the normal SQL and `docs/DB_PROGRESS.md` update, append three fenced Markdown blocks:

1. **docs/canon/interfaces.md**  
   - Section: `### P000N — Interfaces`  
   - Bullet **every new interface** created in this prompt (see coverage list).  
   - End with: `Count: X` (exact number of bullets).

2. **docs/canon/constraints.md**  
   - Section: `### P000N — Constraints`  
   - Bullet **every new CHECK / UNIQUE / PARTIAL UNIQUE / EXCLUDE / NOT NULL / FK / DEFERRABLE** rule.  
   - End with: `Count: Y`.

3. **docs/canon/critical_flows.md**  
   - Section: `### P000N — Critical Flows`  
   - Bullet **every new flow/trigger/procedure** (3–6 lines; include precedence/order if relevant).  
   - End with: `Count: Z`.

In `docs/DB_PROGRESS.md` (this prompt’s section), append:  
`Canon updates for P000N → interfaces: X, constraints: Y, flows: Z`.

**Strict instruction:** Before deciding what to add, **consult the Coverage Lists below**.  
If something matches any example shape, include it. This step is **mandatory**.

---

### B. Coverage list — Interfaces (must be considered)

An “interface” is any contract surface other code depends on.

- **Schema:** tables, views/materialized views, enums, domains, composite types, sequences, identity columns.  
- **RLS & access:** standard tenant policies, special cross-tenant cases, role grants/visibility.  
- **Helpers & APIs:** `public.current_tenant_id()`, `public.current_user_id()`, `public.now_utc()`.  
- **Triggers/contracts:** `touch_updated_at`, `sync_booking_status`, `fill_booking_tz`, `log_audit`.  
- **Time & TZ:** UTC storage, required `booking_tz` (NEW→resource→tenant→error).  
- **Idempotency:** booking `(tenant_id, client_generated_id)`, payment/provider idempotency keys, webhook inbox PKs.  
- **No-overlap indexing:** EXCLUDE shapes, public availability read models.  
- **Eventing:** webhook inbox (idempotent), `events_outbox` topics/payload skeleton, delivery states.  
- **Catalog/CRM:** `customer_metrics` read model, search vectors, category/active flags.  
- **Monetary/PCI:** integer cents, provider IDs only, Stripe Connect metadata, no PAN in DB.  
- **Naming conventions:** deterministic triggers/functions, snake_case, generated columns (e.g., `start_date`).  

**Examples:**  
- Enums: `booking_status`, `payment_status`, `membership_role`, `resource_type`, `notification_*`, `payment_method`.  
- Helper functions: STABLE, SECURITY INVOKER, NULL-safe.  
- Eventing: `events_outbox(tenant_id, event_code, payload, status)`, webhook inbox `(provider, id)` PK.  

---

### C. Coverage list — Constraints (must be considered)

Anything the database enforces:

- **PK/FK & actions:** explicit FKs with `ON DELETE`/`ON UPDATE`; deferrable when needed.  
- **UNIQUE & partial UNIQUE:** soft-delete aware `(… WHERE deleted_at IS NULL)`; idempotency uniques; provider/idempotency partials.  
- **EXCLUDE (overlap):** resource/time exclusion for active statuses; post-0019 booking_items exclusion.  
- **CHECKs & ranges:** `start_at < end_at`, availability minutes within `[0..1440]`, ISO DOW 1–7, XOR (coupons), no self-referrals, event code format.  
- **NOT NULL & defaults:** required timestamps, cents, booking_tz.  
- **Security/visibility:** RLS deny-by-default, FORCE RLS, soft-deleted visibility rules.  
- **Indices mandated by UX:** tenant/time/status/reschedules, services category/active, outbox status/ready_at.  

**Examples:**  
- Availability: `dow BETWEEN 1 AND 7`, `start_minute < end_minute`.  
- Bookings: EXCLUDE `(resource_id, tstzrange(...))` for active statuses; `start_at < end_at`.  
- Coupons: XOR rule; amount > 0.  
- Gift cards: balance non-negative.  
- Referrals: unique pairs + code unique.  
- Notifications: dedupe key partial unique.  

---

### D. Coverage list — Critical Flows (must be considered)

Multi-step logic where order/precedence matters. Write each in 3–6 lines.

- **Booking lifecycle:** status sync (canceled > no_show), overlap prevention, reschedule handling, attendee counts.  
- **Timezone resolution:** `booking_tz` fill order; deterministic wall-time; DST-safe.  
- **Payments:** auth→capture; refunds; idempotency/replay safety; no-show fee logic.  
- **Promotions:** apply in order (gift card → percent → amount); enforce XOR; floor at zero.  
- **Availability generation:** rules + exceptions + booking exclusion → 15-min slots.  
- **Notifications:** template→queue; retries; dedupe via `(tenant_id, channel, dedupe_key)`.  
- **RLS enforcement:** deny-by-default; tenant policies; special tables (tenants, users, memberships, themes, billing, quotas).  
- **Eventing:** inbox idempotency; outbox exactly-once semantics; retries/backoff.  
- **Audit & retention:** AFTER I/U/D logs; nightly purge; GDPR scrubbing.  
- **Quotas:** app-managed counters; enforcement points; no DB autoincrement.  

---

### E. Anchors & CI (guardrails)

- Every canon file must have `### P000N — …` for each prompt.  
- Bullet counts (X/Y/Z) must match the summary line in `DB_PROGRESS.md`.  
- CI should fail if a prompt number is missing or counts mismatch.  

---


## Non-Negotiables (Invariants)

### Tenant Resolution
- Canonical `/b/{slug}` (no `domains` table).  
- Optional host fields come post-0019.

### RLS
- Enabled on every table (0014) with deny-by-default; all access via positive policies (0015/0016).

### Helpers
- `public.current_tenant_id()` & `public.current_user_id()`:
  - Return NULL on missing/invalid JWT
  - Comparisons fail closed
  - Helpers are STABLE, SECURITY INVOKER, and NULL on bad claims

### Idempotency
- `bookings` has `(tenant_id, client_generated_id)` unique.

### No Overlap
- `bookings` exclusion on `(resource_id, tstzrange(start_at,end_at,'[)'))` for active statuses.

### Explicit Partial Exclusion Scope
- Active statuses = (`'pending'`, `'confirmed'`, `'checked_in'`) (historical statuses never block).

### Time Rules
- Store `start_at` / `end_at` as `timestamptz` (UTC)
- Require `booking_tz` (fill via trigger: NEW → `resource.tz` → `tenant.tz` → else raise)

### Money
- Integer cents everywhere; NOT NULL where applicable; Stripe only (no PAN in DB)

### Soft-delete
- Partial uniques use `WHERE deleted_at IS NULL`
- `CHECK (deleted_at IS NULL OR deleted_at >= created_at)`

### Deterministic Names
- `touch_updated_at`
- `bookings_status_sync_biur`
- `bookings_fill_tz_bi`
- `<table>_audit_aiud`

### Primary Keys
- Accept client-generated ULIDs/UUIDs for offline merges; server default OK

### Webhook Inbound
- `webhook_events_inbox(provider,id)` PRIMARY KEY for inbound idempotency (service-role only)

### Outbox
- `events_outbox(tenant_id, key)` optional unique for exactly-once fan-out

---

## Business Rules & UX-Driven Constraints

- Booking defaults: 15-minute slots; default service window 10:00–23:00 (configurable per tenant/resource)
- Cash & no-show policy: For “cash” payments, store backup card via Stripe SetupIntent + explicit consent flag; apply 3% fee if no-show and not canceled day before
- Trial & pricing: Core = 30-day trial → $11.99/month; variants (“first month free,” “90-day no monthly costs”) configurable via `tenants.trust-messaging` fields
- Customer onboarding: Store “First time visiting?” flag (`is_first_time`) at registration
- Service organization: services include category and promo associations; support deals carousel & category chip filters in UI
- Calendar view: Must support resource view (staff/rooms) with service mapping; availability queries must filter by resource type efficiently
- Real-time events: Maintain event channels for `booking_created`, `booking_updated`, `availability_changed`, `client_arrived` to power live admin calendars and instant availability updates
- Resolve-tenant API: `/api/resolve-tenant?host=` returns `{tenant_id, branding, wording, features}` — schema must support all fields without joins across multiple tenants
- Offline flow: Bookings queued in IndexedDB with `client_generated_id` and full customer/service snapshot; upon reconnect, POST to server and reconcile status (`pending` → `confirmed`/`failed`)
- Analytics expectations: Frequent queries on revenue by service/staff, new vs repeat customers, no-show/cancel patterns — index accordingly
- Extensibility hooks: Keep schema boundaries clean for plugin-style feature modules; internal event bus should be able to consume from audit_logs or dedicated events without policy rewrites
- Capacity & buffers: `resources.capacity >= 1`; `services.buffer_before/after_min` (and `booking_items.buffer_*`) participate in overlap math
- Customer preferences: `marketing_opt_in` + `notification_preferences` (per-channel JSONB with validation)
- Royalty accounting (3% new-customer): stamp `customers.customer_first_booking_at`; payments include `royalty_applied` + `basis`
- Search UX: `services.search_vector` (GIN) + optional trigram on `name`/`category` for chips & search
- Ad-hoc blocks: `resource_blocks` for closures/breaks; respected by availability

---

## Enums (0002 — DO NOT REORDER/ADD)

**booking_status**  
`pending`, `confirmed`, `checked_in`, `completed`, `canceled`, `no_show`, `failed`

**payment_status**  
`requires_action`, `authorized`, `captured`, `refunded`, `canceled`, `failed`

**membership_role**  
`owner`, `admin`, `staff`, `viewer`

**resource_type**  
`staff`, `room`

**notification_channel**  
`email`, `sms`, `push`

**notification_status**  
`queued`, `sent`, `failed`

**payment_method**  
`card`, `cash`, `apple_pay`, `paypal`, `other`

Additional (additive enums or constrained text within 00–19):
- Optional enum or constrained text for `payment_settlement_status` (e.g., pending/available/paid_out/disputed/chargeback)
- Optional enum `usage_counter_code` (e.g., booking_created, sms_sent, email_sent, push_sent, api_call)

---

## Canonical Tables (High Level Map)

**Tenancy**:  
- `tenants` (slug, billing, tz, soft-delete, owner_user_id)  
- `users` (global)  
- `memberships` (role)  
- `themes` (1:1)  
- `invitations` (tenant_id, email, role, token, expires_at, accepted_at)

**Catalog**:  
- `customers` (soft-delete, first-time flag)  
- `resources` (type, tz, capacity)  
- `services` + `service_resources`

**Time**:  
- `availability_rules` (DOW 1–7, minute checks)  
- `availability_exceptions` (closed/window)  
- `resource_blocks` (start_at, end_at, reason)

**Bookings**:  
- `bookings` (+ snapshots, idempotency, exclusion, booking_tz, attendee_count, rescheduled_from, explicit partial exclusion on active statuses)  
- `booking_items` (multi-resource + buffers)

**Money**:  
- `payments` (currency_code, tip_cents, tax_cents, application_fee_cents, idempotency_key, provider_*_id, royalty_applied, basis)  
- `tenant_billing`  
- `tenants.stripe_connect_id`

**Promos**:  
- `coupons` (XOR)  
- `gift_cards`  
- `referrals` (pair uniq; code uniq)

**Notifications**:  
- `notification_templates`  
- `notifications` (dedupe_key, attempts, last_attempt_at, provider telemetry)

**Ops**:  
- `usage_counters`  
- `quotas`  
- `audit_logs` (+ purge fn)

**Eventing**:  
- `webhook_events_inbox` (idempotent inbound)  
- `events_outbox` (reliable outbound, lightweight UI stream)

**CRM**:  
- `customer_metrics` (denormalized loyalty/CRM rollups)

---

## Core Triggers & Functions (Templates)

- `public.touch_updated_at()` → attach to all with updated_at.
- `public.sync_booking_status()` (canceled wins → no_show).
- `public.fill_booking_tz()` (NEW.booking_tz → resource.tz → tenant.tz → error).
- `public.log_audit()` on bookings, services, payments, themes, quotas.
- `public.anonymize_customer()` clears PII, stamps pseudonymized_at, preserves aggregates.
- Notifications retry trigger: increment attempts, cap retries, mark failed.
- Outbox fields: ready/delivered/attempts for worker loops.

---

## RLS Policies (What “done” looks like)

**Standard tenant-scoped (0015)** — applies to all tables containing `tenant_id`:

```yaml
SELECT:
  USING: tenant_id = current_tenant_id()

INSERT:
  WITH CHECK: tenant_id = current_tenant_id()

UPDATE:
  USING: tenant_id = current_tenant_id()
  WITH CHECK: tenant_id = current_tenant_id()

DELETE:
  USING: tenant_id = current_tenant_id()
pgsql
Copy
Edit

**Special (0016)** policies apply in addition to the standard tenant-scoped (0015) rules:

- **`tenants`**:  
  - SELECT: only if requester is a member (EXISTS over memberships)  
  - Writes: service-role only

- **`users`**:  
  - SELECT: self or any user in a shared tenant

- **`memberships`**:  
  - Read: all members  
  - Write: owner/admin only  
  - Self: can read own membership

- **`themes`**, **`tenant_billing`**, **`quotas`**:  
  - Read: members  
  - Update/Delete: owner/admin only

- **`webhook_events_inbox`**: service-role only

- **`events_outbox`** / **`events`**:  
  - Tenant-scoped read/write for members  
  - Delivery reads allowed to service-role

- **FORCE RLS**: applied to all materialized views and partition parents

- **Soft-deleted row visibility**:  
  - Non-owners: SELECT excludes rows where `deleted_at IS NOT NULL`  
  - Owners/admins: may view deleted rows

---

## Constraints & Checks (Must-haves)

- **Availability**:  
  - `dow BETWEEN 1 AND 7`  
  - Minutes within valid bounds  
  - `start_at < end_at`

- **Bookings**:  
  - `start_at < end_at`  
  - Exclusion constraint partial on active statuses  
  - `booking_tz` required via trigger

- **Coupons**:  
  - Exactly one of:  
    - `percent_off` between 1 and 100  
    - `amount_off_cents > 0`

- **Gift cards**:  
  - Balance must be non-negative

- **Referrals**:  
  - Unique `(tenant_id, referrer_customer_id, referred_customer_id)`  
  - No self-referrals  
  - `(tenant_id, code)` unique

- **Notifications**:  
  - `scheduled_at <= now() + interval '1 year'`  
  - Unique partial `(tenant_id, channel, dedupe_key)` where `dedupe_key IS NOT NULL`

- **Payments**:  
  - Unique `(tenant_id, provider, idempotency_key)`  
  - Unique `(tenant_id, provider_charge_id)`  
  - Amount/tax/tip/application_fee_cents must be ≥ 0

- **Users**:  
  - `LOWER(email)` partial unique with soft-delete  
  - Optional index on phone

---

## Index Strategy (0017 + essentials)

- **High-write**: `(tenant_id, created_at)` across major tables

- **Bookings**:  
  - `(tenant_id, start_at DESC)`  
  - `(resource_id, start_at)`  
  - `(tenant_id, status, start_at DESC)` partial for active statuses  
  - `(tenant_id, rescheduled_from)`  
  - Optional generated `start_date` for analytics/partitioning

- **Services**:  
  - `(tenant_id, active)`  
  - `(tenant_id, category, active)`  
  - GIN index on `search_vector`

- **Payments**:  
  - `(tenant_id, created_at DESC)`  
  - `(tenant_id, payment_status)`

- **Customers**:  
  - `(tenant_id, is_first_time)`  
  - `(tenant_id, LOWER(email))` partial unique

- **Outbox**:  
  - `(tenant_id, status)`  
  - `(tenant_id, topic, ready_at)`  
  - Optional unique `(tenant_id, key)`

---

## Migration Flow 

Migrations **00 → 19** include:  
- Extensions  
- Enums  
- Helpers  
- Core tenancy  
- Customers/resources  
- Services map  
- Availability  
- Bookings/items + triggers  
- Payments/billing  
- Promos  
- Notifications  
- Usage/quotas  
- Audit  
- Enable RLS  
- Standard & special policies  
- Indexes  
- Seed data  
- pgTAP tests  

**Within this flow:**
- Tenants host fields optional post-0019  
- `booking_items` exclusion (multi-resource + buffers) implemented in bookings layer  
- Payments hardened with `currency_code`, idempotency, provider IDs + uniques  
- Referrals code unique  
- Notifications: seed `reminder_1h`, dedupe & retries  
- `anonymize_customer()` + `pseudonymized_at` in customers  
- Money `NOT NULL` + non-negative checks enforced  
- Inbound webhook inbox and events outbox in core

---

## pgTAP Acceptance (0019 Required)

- **Isolation**: switching JWT claims blocks cross-tenant SELECT/DELETE across standard tables  
- **Overlap**: second booking overlapping same resource/time → exclusion violation  
- **Status sync**: `no_show_flag` → `no_show`; `canceled_at` wins → `canceled`  
- **Idempotency**: duplicate `(tenant_id, client_generated_id)` → unique violation  
- **Time rules**: reject DOW 0/8; fill `booking_tz` from resource/tenant; error if absent  
- **Coupons**: fixed amount > 0; percent ≤ 100  
- **Webhook idempotency**: duplicate `(provider,id)` in inbox → unique violation  
- **Outbox dedupe**: duplicate `(tenant_id, key)` (when provided) → blocked  
- **Notifications dedupe/retry**: same `(tenant_id, channel, dedupe_key)` queues once; retries capped → failed  
- **DST edges**: fall-back overlap still blocked in UTC  
- **Soft-delete unique**: email reuse allowed after delete; duplicate with active blocked  
- **Service-role policies**: service-role can read/write inbox/outbox; normal users cannot

---

## PCI & Boundaries

- Stripe intent/charge IDs only; no card data stored  
- Map provider terminal states to enums in app layer  
- Store amounts as integer cents  
- Replay safety enforced via uniques: `(tenant_id, provider, idempotency_key)` and `(tenant_id, provider_charge_id)`  
- Stripe Connect: store `tenants.stripe_connect_id` for payouts  
- Inbound signatures verified into `webhook_events_inbox`  
- Outbound events drained from `events_outbox` with backoff and exactly-once delivery via optional key unique

---

## Naming & Style Quick-Refs

- **Tables**: snake_case plural; partial uniques on soft-deleted tables  
- **Triggers**: `<table>_touch_updated_at`, `bookings_status_sync_biur`, `bookings_fill_tz_bi`, `<table>_audit_aiud`  
- **Columns**: *_at timestamptz; *_cents ints; tz in Olson name format  
- **Primary Keys**: prefer ULIDs (offline-friendly, monotonic sort)  
- **Generated helpers**: e.g., `start_date DATE GENERATED ALWAYS AS (start_at::date) STORED`

---

## Definition of Done Checklist (per PR)

- Migration wrapped in `BEGIN; ... COMMIT;`  
- Idempotent where reasonable  
- Touch trigger attached when `updated_at` exists  
- RLS enabled + policies added/updated (0014/0015/0016 patterns)  
- Indexes appropriate and minimal (per 0017 guidelines)  
- Docs: append `docs/DB_PROGRESS.md` with rationale + where used  
- Tests: pgTAP updated or added; covers isolation, overlap/status, idempotency, constraints  
- Partial bookings exclusion on active statuses  
- Payments: provider/idempotency uniques + non-negative money checks  
- Notifications: dedupe_key + retry capping + scheduled_at sanity check  
- `webhook_events_inbox` + `events_outbox` tables with correct RLS & indexes  
- `anonymize_customer()` + `pseudonymized_at` on customers  
- Tests for webhook idempotency, outbox dedupe, notifications retry/dedupe, DST edges, service-role gates