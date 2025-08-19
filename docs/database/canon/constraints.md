Title: constraints.md
Source of Truth: /infra/supabase/migrations/**, triggers/functions, /src/types/**
Edit Policy: Append-only; add new IDs and deprecate old ones rather than editing in place
Last Updated: 2025-08-19

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
