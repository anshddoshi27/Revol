Title: constraints.md
Source of Truth: /infra/supabase/migrations/**, triggers/functions, /src/types/**
Edit Policy: Append-only; add new IDs and deprecate old ones rather than editing in place
Last Updated: 2025-01-16

## Global Rules
- Append-only history; new IDs for changed behavior; mark old entries Deprecated with SupersededBy.
- Deterministic order. Sections by topic; within each, constraints ordered by ascending ID (C-<TOPIC>-NNN).
- Anchors & IDs:
  - Constraints: C-<TOPIC>-NNN
  - Flows: F-<FEATURE>-<Name>
  - Interfaces: I-<FEATURE>-<Name>-vN
- Cross-links. Use IDs (e.g., See F-Bookings-CreateBooking).
- Formatting. H2 = sections; H3 = constraints. Keep Enforced By and Tests explicit.
- Examples are canonical. Always include Enforced By, Tests, and Violation Behavior.

## Purpose
Hard rules that must not drift (RLS, idempotency, overlap, time/zone, money/PCI, quotas, retention, performance, SLAs, observability).

## Organization
- ## RLS & Policies
- ## Idempotency
- ## Overlap / Scheduling Safety
- ## Time & Timezones
- ## Money & PCI
- ## Rate Limits & Retries
- ## Queues & Workers
- ## Quotas & Usage
- ## Retention & Privacy
- ## Performance & Indexes
- ## Observability & Audit
- ## SLAs / SLOs

Within each section, list constraints by ascending ID.

## Constraint Template
### C-<TOPIC>-NNN — <Short Title>
**Rule:** <imperative one-liner>  
**Where:** tables `<t1>`, `<t2>`; endpoints `/api/...`  
**Enforced By:** `<migration.sql>`; trigger `<fn_name>`; policy `<policy_name>`  
**Violation Behavior:** <deny|raise> (<HTTP/SQL code>, "<message>")  
**Notes:**
- <bullet 1>
- <bullet 2>
**Tests:** `tests/pg_tap/<topic>_*.sql`  
**Status:** Active

## Append Rules
- Allocate the next ID in the section automatically; never reuse numbers.
- If changing behavior, add a new constraint and mark the old one Deprecated with “SupersededBy C-<...>”.
- Keep “Where” and “Enforced By” explicit (file/function/policy names).

## Windsurf Prompt: “Append to constraints.md”
Goal: Append constraints to `docs/canon/constraints.md`  
Rules:
- Preserve header; update “Last Updated”.
- Insert under the correct ## section; allocate the next C-<TOPIC>-NNN automatically.
- Use the Constraint Template verbatim, including Enforced By and Tests.
- If superseding an older rule, mark the old entry Deprecated and add “SupersededBy C-<...>”.
Inputs:
- Topic: <RLS | IDEMP | OVERLAP | TIME | MONEY | RATE | QUEUE | QUOTA | RETAIN | PERF | OBS | SLA>
- Title, Rule, Where, Enforced By, Violation Behavior, Notes, Tests, Status
Output:
- A patch that appends the new constraints and updates statuses where applicable.

## Quick Examples (ready to append)

### RLS & Policies
#### C-RLS-001 — Deny-by-Default Tenant Isolation
**Rule:** Enforce tenant isolation with positive RLS policies only; access is denied unless an allow policy matches.  
**Where:** all tenant-scoped tables  
**Enforced By:** `0014_enable_rls.sql`, `0015_standard_policies.sql` (policy `allow_tenant_member`)  
**Violation Behavior:** deny (403, "forbidden")  
**Notes:**
- Security helpers return NULL on invalid claims; comparisons fail closed.
- Admin/system tables may have special policies; document exceptions per-table.
**Tests:** `tests/pg_tap/rls_isolation.sql`  
**Status:** Active

### Idempotency
#### C-IDEMP-001 — Idempotent Booking Creation
**Rule:** Reject duplicate create-booking requests within a tenant using a unique key on `(tenant_id, client_generated_id)`.  
**Where:** table `bookings`; endpoint `POST /api/bookings`  
**Enforced By:** `0008_bookings.sql` (unique index `u_bookings_tenant_client_key`)  
**Violation Behavior:** raise (409, "duplicate client_generated_id for tenant")  
**Notes:**
- Client retries must reuse the same `client_generated_id`.
- Response should return the existing booking reference on conflict.
**Tests:** `tests/pg_tap/idempotency_booking.sql`  
**Status:** Active

### Overlap / Scheduling Safety
#### C-OVERLAP-001 — No Overlapping Active Bookings
**Rule:** Prevent insertion of bookings that overlap on the same `resource_id` for active statuses using an exclusion constraint on a time range.  
**Where:** table `bookings`  
**Enforced By:** `0008_bookings.sql` (exclusion on `USING gist(resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&)` when status in ACTIVE)  
**Violation Behavior:** raise (409, "overlapping booking on resource")  
**Notes:**
- ACTIVE = {pending, confirmed, checked_in}; canceled/no_show/completed excluded.
- Time range is half-open `[start_at, end_at)`.
**Tests:** `tests/pg_tap/overlap_booking.sql`  
**Status:** Active

### Time & Timezones
#### C-TIME-003 — UTC Storage & Booking Timezone Required
**Rule:** Store timestamps as UTC and require `booking_tz`; fill from request → resource → tenant, else raise.  
**Where:** table `bookings`; endpoint `POST /api/bookings`  
**Enforced By:** trigger `trg_bookings_fill_tz()` in `0008_bookings.sql`  
**Violation Behavior:** raise (400, "booking time zone required")  
**Notes:**
- All client inputs must be converted to UTC before persistence.
- `booking_tz` must be an IANA zone identifier.
**Tests:** `tests/pg_tap/timezone_fill.sql`  
**Status:** Active

## Quality Checklist
- Correct section; next numeric ID assigned
- “Where” and “Enforced By” are concrete (file/trigger/policy names)
- Violation behavior defined (deny vs raise + code/message)
- Tests listed; Status accurate
- Old rules deprecated with clear supersession links

### P0001 — Constraints
- None introduced in this prompt (extensions only).
Count: 0

### P0002 — Constraints
- None introduced in this prompt (enum definitions only; constraints arrive with tables and flows in later prompts).
Count: 0

### P0003 — Constraints
- None introduced in this prompt. Added JWT-derived helper functions for RLS (`public.current_tenant_id()`, `public.current_user_id()`); constraints will appear alongside tables and policies in later prompts.
Count: 0

### P0004 — Constraints
- Partial UNIQUE: `tenants(slug)` WHERE `deleted_at IS NULL` (soft-delete aware uniqueness)
- UNIQUE: `memberships(tenant_id, user_id)` (one membership per user per tenant)
- FK: `memberships.tenant_id → tenants(id)`
- FK: `memberships.user_id → users(id)`
- FK/PK: `themes.tenant_id → tenants(id)` (1:1 via primary key)
- CHECK: `tenants.deleted_at IS NULL OR deleted_at >= created_at` (temporal sanity; idempotent block in `0004_core_tenancy.sql`)
Count: 6

### P0005 — Constraints
- Partial UNIQUE: `customers(tenant_id, email)` WHERE `email IS NOT NULL AND deleted_at IS NULL` (per-tenant, soft-delete aware, case-insensitive via `citext`)
- FK: `customers.tenant_id → tenants(id)`
- CHECK: `customers.deleted_at IS NULL OR deleted_at >= created_at` (temporal sanity; idempotent DO block in `0005_customers_resources.sql`)
- FK: `resources.tenant_id → tenants(id)`
- CHECK: `resources.capacity >= 1`
- CHECK: `resources.deleted_at IS NULL OR deleted_at >= created_at` (temporal sanity; idempotent DO block)
- PK: `customer_metrics(tenant_id, customer_id)` (composite primary key)
- FK: `customer_metrics.tenant_id → tenants(id)`
- FK: `customer_metrics.customer_id → customers(id)`
- CHECK: `customer_metrics.total_spend_cents >= 0`
- CHECK: `customer_metrics.no_show_count >= 0`
- CHECK: `customer_metrics.canceled_count >= 0`
- CHECK: `customer_metrics.total_bookings_count >= 0`
Count: 13

### P0006 — Constraints
- Partial UNIQUE: `services(tenant_id, slug)` WHERE `deleted_at IS NULL` (per-tenant slug uniqueness excluding soft-deleted services)
- UNIQUE: `services(id, tenant_id)` (composite unique to support composite FK for cross-tenant integrity)
- UNIQUE: `resources(id, tenant_id)` (composite unique to support composite FK for cross-tenant integrity)
- UNIQUE: `service_resources(service_id, resource_id)` (prevents duplicate service-resource mappings)
- FK: `services.tenant_id → tenants(id)`
- FK: `service_resources.tenant_id → tenants(id)` (required for cross-tenant integrity)
- Composite FK: `service_resources(service_id, tenant_id) → services(id, tenant_id) ON DELETE CASCADE` (ensures tenant match)
- Composite FK: `service_resources(resource_id, tenant_id) → resources(id, tenant_id) ON DELETE CASCADE` (ensures tenant match)
- CHECK: `services.price_cents >= 0` (non-negative pricing)
- CHECK: `services.duration_min > 0` (positive service duration required)
- CHECK: `services.buffer_before_min >= 0` (non-negative buffer time)
- CHECK: `services.buffer_after_min >= 0` (non-negative buffer time)
- CHECK: `services.deleted_at IS NULL OR deleted_at >= created_at` (temporal sanity for soft-delete)
Count: 13

### P0007 — Constraints
- UNIQUE: `availability_rules(resource_id, dow, start_minute, end_minute)` (prevents duplicate availability rules for same resource/time)
- UNIQUE: `availability_exceptions(resource_id, date, coalesce(start_minute,-1), coalesce(end_minute,-1))` (prevents duplicate exceptions for same resource/date/time)
- FK: `availability_rules.tenant_id → tenants(id) ON DELETE CASCADE`
- FK: `availability_rules.resource_id → resources(id) ON DELETE CASCADE`
- FK: `availability_exceptions.tenant_id → tenants(id) ON DELETE CASCADE`
- FK: `availability_exceptions.resource_id → resources(id) ON DELETE CASCADE`
- CHECK: `availability_rules.dow BETWEEN 1 AND 7` (ISO weekday validation)
- CHECK: `availability_rules.start_minute BETWEEN 0 AND 1439` (minute-of-day range)
- CHECK: `availability_rules.end_minute BETWEEN 0 AND 1439` (minute-of-day range)
- CHECK: `availability_rules.start_minute < end_minute` (valid time ordering)
- CHECK: `availability_exceptions.start_minute IS NULL OR (start_minute BETWEEN 0 AND 1439)` (optional minute validation)
- CHECK: `availability_exceptions.end_minute IS NULL OR (end_minute BETWEEN 0 AND 1439)` (optional minute validation)
- CHECK: `availability_exceptions.(start_minute IS NULL AND end_minute IS NULL) OR (start_minute IS NOT NULL AND end_minute IS NOT NULL AND start_minute < end_minute)` (NULL handling and time ordering)
Count: 13

### P0008 — Constraints
- UNIQUE: `bookings(tenant_id, client_generated_id)` (idempotency constraint for offline-safe booking creation)
- EXCLUDE: `bookings USING gist(resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&) WHERE (status IN ('pending','confirmed','checked_in','completed') AND resource_id IS NOT NULL)` (overlap prevention for active statuses including completed, following Design Brief priority)
- FK: `bookings.tenant_id → tenants(id) ON DELETE CASCADE`
- FK: `bookings.customer_id → customers(id) ON DELETE CASCADE`
- FK: `bookings.resource_id → resources(id) ON DELETE CASCADE`
- FK: `bookings.rescheduled_from → bookings(id)`
- FK: `booking_items.tenant_id → tenants(id) ON DELETE CASCADE`
- FK: `booking_items.booking_id → bookings(id) ON DELETE CASCADE`
- FK: `booking_items.resource_id → resources(id) ON DELETE CASCADE`
- FK: `booking_items.service_id → services(id) ON DELETE SET NULL`
- CHECK: `bookings.start_at < end_at` (time ordering validation)
- CHECK: `booking_items.start_at < end_at` (time ordering validation)
- CHECK: `bookings.attendee_count > 0` (positive attendee count)
- CHECK: `booking_items.buffer_before_min >= 0 AND buffer_after_min >= 0` (non-negative buffer times)
- CHECK: `booking_items.price_cents >= 0` (non-negative pricing)
Count: 15

### P0009 — Constraints
- FK: `payments.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `payments.booking_id → bookings(id) ON DELETE SET NULL` (optional booking association)
- FK: `payments.customer_id → customers(id) ON DELETE SET NULL` (optional customer association)
- FK: `tenant_billing.tenant_id → tenants(id) ON DELETE CASCADE` (1:1 tenant billing relationship)
- UNIQUE: `payments_tenant_provider_idempotency_uniq(tenant_id, provider, idempotency_key) WHERE idempotency_key IS NOT NULL` (payment idempotency for replay safety)
- UNIQUE: `payments_tenant_provider_charge_uniq(tenant_id, provider, provider_charge_id) WHERE provider_charge_id IS NOT NULL` (charge uniqueness for replay safety)
- UNIQUE: `payments_tenant_provider_payment_uniq(tenant_id, provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL` (payment ID uniqueness for replay safety)
- CHECK: `payments.amount_cents >= 0` (non-negative payment amount)
- CHECK: `payments.tip_cents >= 0` (non-negative tip amount)
- CHECK: `payments.tax_cents >= 0` (non-negative tax amount)
- CHECK: `payments.application_fee_cents >= 0` (non-negative application fee)
- CHECK: `payments.no_show_fee_cents >= 0` (non-negative no-show fee)
- CHECK: `payments.royalty_basis IN ('new_customer', 'referral', 'other')` (valid royalty basis values)
- CHECK: `tenant_billing.monthly_price_cents >= 0` (non-negative monthly pricing)
- CHECK: `tenant_billing.trust_messaging_variant IN ('standard', 'first_month_free', '90_day_no_monthly')` (valid trust messaging variants)
Count: 15

### P0010 — Constraints
- FK: `coupons.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `gift_cards.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `gift_cards.purchaser_customer_id → customers(id) ON DELETE SET NULL` (optional purchaser tracking)
- FK: `gift_cards.recipient_customer_id → customers(id) ON DELETE SET NULL` (optional recipient tracking)
- FK: `referrals.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `referrals.referrer_customer_id → customers(id) ON DELETE CASCADE` (referrer must exist)
- FK: `referrals.referred_customer_id → customers(id) ON DELETE CASCADE` (referred customer must exist)
- Partial UNIQUE: `coupons_tenant_code_uniq(tenant_id, code) WHERE deleted_at IS NULL` (tenant-scoped code uniqueness excluding soft-deleted)
- UNIQUE: `gift_cards_tenant_code_uniq(tenant_id, code)` (tenant-scoped gift card code uniqueness)
- UNIQUE: `referrals_tenant_referrer_referred_uniq(tenant_id, referrer_customer_id, referred_customer_id)` (unique referral pairs per tenant)
- UNIQUE: `referrals_tenant_code_uniq(tenant_id, code)` (tenant-scoped referral code uniqueness)
- CHECK: `coupons_discount_xor` (exactly one of percent_off OR amount_off_cents must be specified)
- CHECK: `coupons_percent_off_range` (percent_off must be between 1 and 100 if specified)
- CHECK: `coupons_amount_off_positive` (amount_off_cents must be > 0 if specified)
- CHECK: `coupons_minimum_amount_non_negative` (minimum_amount_cents >= 0)
- CHECK: `coupons_maximum_discount_non_negative` (maximum_discount_cents >= 0 if specified)
- CHECK: `coupons_usage_limit_positive` (usage_limit > 0 if specified)
- CHECK: `coupons_usage_count_non_negative` (usage_count >= 0)
- CHECK: `coupons_expires_after_starts` (expires_at > starts_at if both specified)
- CHECK: `coupons_soft_delete_temporal` (deleted_at >= created_at if specified)
- CHECK: `gift_cards_initial_balance_non_negative` (initial_balance_cents >= 0)
- CHECK: `gift_cards_current_balance_non_negative` (current_balance_cents >= 0)
- CHECK: `gift_cards_current_lte_initial` (current_balance_cents <= initial_balance_cents)
- CHECK: `referrals_no_self_referral` (referrer_customer_id != referred_customer_id)
- CHECK: `referrals_reward_amount_non_negative` (reward_amount_cents >= 0)
- CHECK: `referrals_referrer_reward_non_negative` (referrer_reward_cents >= 0)
- CHECK: `referrals_referred_reward_non_negative` (referred_reward_cents >= 0)
- CHECK: `referrals_valid_status` (status IN ('pending', 'completed', 'expired'))
Count: 28

### P0011 — Constraints
- FK: `notification_templates.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `notification_templates.event_code → notification_event_type(code) ON DELETE CASCADE` (event code must exist)
- FK: `notifications.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `notifications.event_code → notification_event_type(code) ON DELETE CASCADE` (event code must exist)
- UNIQUE: `notification_templates_tenant_event_channel_uniq(tenant_id, event_code, channel)` (one template per tenant/event/channel)
- Partial UNIQUE: `notifications_tenant_channel_dedupe_uniq(tenant_id, channel, dedupe_key) WHERE dedupe_key IS NOT NULL` (deduplication constraint)
- CHECK: `notification_event_type_code_format` (code ~ '^[a-z][a-z0-9_]*$')
- CHECK: `notifications_scheduled_at_reasonable` (scheduled_at <= now() + interval '1 year')
- CHECK: `notifications_attempts_non_negative` (attempts >= 0)
- CHECK: `notifications_max_attempts_positive` (max_attempts > 0)
- CHECK: `notifications_attempts_lte_max` (attempts <= max_attempts)
- CHECK: `notifications_email_when_email_channel` (channel != 'email' OR to_email IS NOT NULL)
- CHECK: `notifications_phone_when_sms_channel` (channel != 'sms' OR to_phone IS NOT NULL)
Count: 13

### P0012 — Constraints
- FK: `usage_counters.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `quotas.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- UNIQUE: `usage_counters(tenant_id, code, period_start)` (unique period-based counting per tenant)
- UNIQUE: `quotas(tenant_id, code)` (unique quota per tenant and code)
- CHECK: `usage_counters_current_count_non_negative` (current_count >= 0)
- CHECK: `usage_counters_period_order` (period_start <= period_end)
- CHECK: `quotas_limit_value_non_negative` (limit_value >= 0)
- CHECK: `quotas_period_type_valid` (period_type IN ('daily', 'weekly', 'monthly', 'yearly'))
Count: 8

### P0013 — Constraints
- FK: `audit_logs.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- FK: `events_outbox.tenant_id → tenants(id) ON DELETE CASCADE` (required tenant relationship)
- PK: `webhook_events_inbox(provider, id)` (composite primary key for idempotent inbound processing)
- UNIQUE: `events_outbox_tenant_key_uniq(tenant_id, key) WHERE key IS NOT NULL` (exactly-once delivery when key provided)
- CHECK: `audit_logs.operation IN ('INSERT', 'UPDATE', 'DELETE')` (valid audit operation types)
- CHECK: `events_outbox.status IN ('ready', 'delivered', 'failed')` (valid outbox status values)
- CHECK: `events_outbox.attempts >= 0` (non-negative attempt count)
- CHECK: `events_outbox.max_attempts >= 0` (non-negative max attempts)
Count: 8
