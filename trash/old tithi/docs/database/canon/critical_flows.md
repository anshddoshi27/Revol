Title: critical_flows.md
Source of Truth: /src, /infra/supabase/migrations/**, /src/types/**
Edit Policy: Append-only; revise by adding a new version and archiving the old one
Last Updated: 2025-01-16

## Global Rules
- Append-only history; add Revised versions and archive prior flows.
- Deterministic order. Sections by feature: Tenancy, Availability, Bookings, Payments, Notifications, Usage, Audit, Policies. Keep flows alphabetically by ID within a section.
- Anchors & IDs:
  - Flows: F-<FEATURE>-<Name>
  - Constraints: C-<TOPIC>-NNN
  - Interfaces: I-<FEATURE>-<Name>-vN
- Cross-links. Use IDs (e.g., See C-RLS-001).
- Formatting. H2 = sections; H3 = flows. 5–10 primary bullets. Use monospace for paths/tables.
- Examples are canonical. Steps list concrete paths/tables and referenced IDs.

## Purpose
Document the 4–6 most important flows per subsystem so implementers and prompts have a shared path.

## Organization
- ## Tenancy — up to 2 flows
- ## Availability — up to 2 flows
- ## Bookings — up to 3 flows
- ## Payments — up to 2 flows
- ## Notifications — up to 2 flows
- ## Usage / Audit / Policies — up to 2 flows combined
- ## Archive (keep old/revised flows here)

If a subsystem exceeds limits, move older flows to Archive.

## Flow Template
### F-<FEATURE>-<FlowName>
**Goal:** <one sentence>  
**Actors:** <caller>, <service>, <worker>  
**Preconditions:** 
- <bullet 1>
- <bullet 2>

**Primary Path:**
- Step 1: <verb + object> (`<METHOD> /api/...`; tables: `<t1>`)
- Step 2: <...>
- Step N: <...>

**Alternate/Error Paths:**
- A1: <condition> → <behavior> (See C-<TOPIC>-NNN)
- A2: <...>

**Data Touchpoints:** `/api/...`; tables: `<t1>`, `<t2>`  
**Policies Enforced:** C-RLS-001, C-POLICY-002  
**Events & Side Effects:** `<event.topic>` emitted; `<queue>` job scheduled  
**Tests/Acceptance:** `tests/acceptance/<feature>/<flow>_spec.sql`

**Revised:** YYYY-MM-DD (optional)

## Append Rules
- Add new flows under the correct ## <Feature> section (create if missing).
- If a feature exceeds 6 flows, move the oldest to Archive (add a date line).
- Never delete; archive instead.

## Windsurf Prompt: “Append to critical_flows.md”
Goal: Append flows to `docs/canon/critical_flows.md`  
Rules:
- Preserve header; update “Last Updated”.
- Insert under the correct ## section; keep flow IDs alphabetical.
- Use the Flow Template verbatim; 5–10 primary bullets max.
- Cross-link constraints and interfaces by ID; list test files.
Inputs:
- Feature: <FEATURE>
- Flows to add: <for each: name, goal, actors, preconditions, primary bullets, alt paths, touchpoints, policies, events, tests>
Output:
- A single patch appending the new H3 blocks in order (no deletions).

## Quick Example (ready to append)
### F-Bookings-CreateBooking
**Goal:** Create a booking without overlaps and with idempotent client retries  
**Actors:** Web Client, API, DB Worker  
**Preconditions:** 
- Authenticated member in tenant scope
- Resource and service exist and are available

**Primary Path:**
- Step 1: POST `/api/bookings` with `client_generated_id`, `resource_id`, `service_snapshot`, `start_at`, `end_at`, `booking_tz`
- Step 2: Validate tenant scope; resolve time zone; compute UTC range
- Step 3: Enforce idempotency on `(tenant_id, client_generated_id)` (See C-IDEMP-001)
- Step 4: Insert `bookings` row; exclusion prevents overlaps for active statuses (See C-OVERLAP-001)
- Step 5: Trigger sets status and fills tz if missing (See C-TIME-003)
- Step 6: Emit `booking_created` event; enqueue notification job

**Alternate/Error Paths:**
- A1: Overlap detected → 409 with existing booking ref (See C-OVERLAP-001)
- A2: Bad claims/tenant mismatch → 403 deny (See C-RLS-001)

**Data Touchpoints:** `/api/bookings`; tables: `bookings`, `notifications_outbox`  
**Policies Enforced:** C-RLS-001, C-POLICY-002  
**Events & Side Effects:** `booking_created` emitted; queue `notify.booking_created`  
**Tests/Acceptance:** `tests/acceptance/bookings/create_booking_spec.sql`

## Quality Checklist
- Header present; Last Updated = today
- Right feature section; ID stable; ≤ 10 primary bullets
- Each step starts with a verb and lists paths/tables
- Cross-links to constraint/interface IDs; tests listed
- Revisions archived, not overwritten

### P0001 — Critical Flows
- None introduced in this prompt. Extensions enable future triggers/functions and exclusion constraints.
Count: 0

### P0002 — Critical Flows
- None introduced in this prompt (enum definitions only; flows arrive with tables and workers in later prompts).
Count: 0

### P0003 — Critical Flows
- RLS identity resolution: policies compare `tenant_id`/`user_id` to helpers; NULL claims deny access (fail closed).
Count: 1

### P0004 — Critical Flows
- Tenancy resolution: path `/b/{slug}` resolves tenant; no domains table pre-0019 (See Design Brief §1). Members join via `memberships(role, permissions_json)`.
- Timestamp freshness: `public.touch_updated_at()` attached as `<table>_touch_updated_at` on `tenants`, `users`, `memberships`, `themes` (See `0004_core_tenancy.sql`). Hotfix in `0004_hotfix_touch_updated_at.sql` ensures `clock_timestamp()` usage and monotonic `updated_at` on UPDATE; triggers reasserted idempotently.
Count: 2

### P0005 — Critical Flows
- Customers: create/update customer with per-tenant email uniqueness ignoring NULL and soft-deleted rows; soft-delete preserves historical uniqueness (index `customers_tenant_email_uniq`). Triggers: `customers_touch_updated_at`.
- Resources: create resource with required `type`, `tz`, `capacity>=1`, `metadata`; set UX label `name` and manage visibility with `is_active` toggle (non-destructive disable); enforce `capacity >= 1` and soft-delete temporal sanity; triggers: `resources_touch_updated_at`.
Count: 2

### P0006 — Critical Flows
- Service creation: create service with tenant-scoped slug uniqueness (partial index excludes soft-deleted); validate pricing (non-negative), duration (positive), buffer times (non-negative); populate category for UI chips/filters; set active flag for visibility control; triggers: `services_touch_updated_at`.
- Service-resource mapping: establish many-to-many relationship between services and resources via `service_resources` junction table with tenant_id for cross-tenant integrity; unique constraint prevents duplicate mappings; composite foreign keys ensure tenant_id matches referenced service/resource tenants; CASCADE deletes maintain referential integrity when services or resources are removed; supports flexible delivery models (service by multiple staff or in multiple rooms).
Count: 2

### P0007 — Critical Flows
- Availability rules management: create/update recurring weekly availability patterns per resource using ISO weekdays (1=Monday through 7=Sunday) and minute-of-day ranges (0-1439); enforce DOW validation, minute bounds, and time ordering constraints; prevent duplicate rules via unique constraint on `(resource_id, dow, start_minute, end_minute)`; support optional RRULE JSON for complex recurrence patterns; triggers: `availability_rules_touch_updated_at`.
- Availability exceptions handling: manage date-specific overrides for closures (NULL minutes) or special hours (specific minute ranges) that supersede weekly patterns; validate date boundaries and minute ranges when specified; enforce unique constraint on `(resource_id, date, coalesce(start_minute,-1), coalesce(end_minute,-1))` to prevent conflicts; support descriptions for business context (holidays, maintenance, etc.); triggers: `availability_exceptions_touch_updated_at`.
Count: 2

### P0008 — Critical Flows
- Booking creation with overlap prevention: create new booking with idempotency via `(tenant_id, client_generated_id)` unique constraint enabling offline queueing and safe retries; enforce no-overlap exclusion constraint using GiST on `(resource_id, tstzrange(start_at,end_at,'[)'))` for active statuses only (`pending`, `confirmed`, `checked_in`); allow historical statuses (`completed`, `canceled`, `no_show`, `failed`) to not block future scheduling; capture service snapshot for pricing audit integrity; validate time ordering and positive attendee count; triggers: `bookings_touch_updated_at`, `bookings_status_sync_biur`, `bookings_fill_tz_bi`.
- Status synchronization and precedence: enforce deterministic booking status via `sync_booking_status()` trigger on BEFORE INSERT/UPDATE; apply precedence order where `canceled_at IS NOT NULL` → `status='canceled'` (highest precedence), then `no_show_flag=true` → `status='no_show'` (second precedence), otherwise preserve explicitly set status; ensure status changes follow business rules regardless of direct field manipulation; enables reliable status tracking for notifications, billing, and reporting.
- Timezone resolution and wall-time reconstruction: automatically fill `booking_tz` via `fill_booking_tz()` trigger on BEFORE INSERT following Design Brief priority order: use explicit `NEW.booking_tz` if provided, else query `resource.tz`, else query `tenant.tz`, else raise exception; store all timestamps as UTC (`timestamptz`) while preserving deterministic wall-time via IANA timezone identifier; enables DST-safe scheduling and cross-timezone business operations; supports calendar display and reminder scheduling in customer's local time.
Count: 3

### P0009 — Critical Flows
- None introduced in this prompt. Added payments and tenant_billing tables with constraints for PCI compliance, replay safety, and billing configuration. Critical payment flows will be developed at the application layer using these data structures.
Count: 0

### P0010 — Critical Flows
- None introduced in this prompt. Added promotions tables (coupons, gift_cards, referrals) with comprehensive constraints for business rule enforcement. Critical flows for coupon application, gift card redemption, and referral reward processing will be implemented at the application layer using these foundational data structures.
Count: 0

### P0011 — Critical Flows
- Notification queuing and deduplication: create notification records with event_code FK to notification_event_type lookup; enforce deduplication via partial unique on `(tenant_id, channel, dedupe_key)` where dedupe_key IS NOT NULL; queue for worker consumption via status='queued' and scheduled_at filtering; support retry logic with attempts tracking and configurable max_attempts; validate channel-specific recipients (email for email channel, phone for SMS channel); enable efficient worker queries via indexed status and scheduling fields; triggers: `notification_templates_touch_updated_at`, `notifications_touch_updated_at`.
Count: 1

### P0012 — Critical Flows
- Usage tracking and quota enforcement: application-managed usage_counters track periodic consumption (no DB triggers for increments to preserve idempotency and support backfills); quotas table defines limits and enforcement points with period types (daily/weekly/monthly/yearly); unique constraints prevent duplicate periods and codes per tenant; non-negative checks ensure valid counts and limits; enforcement occurs at application layer using counter/quota comparisons; triggers: `quotas_touch_updated_at` maintains timestamp consistency.
Count: 1

### P0013 — Critical Flows
- Audit logging and compliance: generic `log_audit()` function triggers on AFTER INSERT/UPDATE/DELETE for key business tables (bookings, services, payments, themes, quotas); captures operation type, old/new data snapshots in JSON, tenant context, and user identification from JWT helpers; enables comprehensive change tracking for compliance, debugging, and business intelligence; automated retention via `purge_audit_older_than_12m()` function maintains 12-month sliding window; triggers: `bookings_audit_aiud`, `services_audit_aiud`, `payments_audit_aiud`, `themes_audit_aiud`, `quotas_audit_aiud`.
- Event-driven architecture: `events_outbox` provides reliable exactly-once delivery semantics for outbound integrations with status tracking (ready/delivered/failed), retry logic with configurable max_attempts, and optional unique keys; worker processes query by status and ready_at for efficient job processing; delivery confirmation updates status and timestamps; failure handling captures error messages and increments attempt counters; supports both fire-and-forget and guaranteed delivery patterns.
- GDPR compliance and data privacy: `anonymize_customer()` function provides compliant PII scrubbing while preserving aggregate analytics data; updates customer records to remove display_name, email, phone while maintaining referential integrity; stamps pseudonymized_at timestamp for audit trail; generates audit log entry documenting anonymization action; enables right-to-be-forgotten compliance without breaking historical business metrics.
Count: 3

### P0014 — Critical Flows
- No new critical flows introduced in this prompt. Enabled Row Level Security on all 26 tables to establish deny-by-default security foundation; existing helper functions `current_tenant_id()` and `current_user_id()` are now ready for policy predicate evaluation in P0015-P0016.
Count: 0

### P0016 — Critical Flows
- Special authorization patterns: cross-tenant tables (tenants, users, memberships, themes, tenant_billing, quotas) use member-gated SELECT policies with EXISTS subqueries to verify tenant membership; owner/admin role restrictions applied for write operations via role enumeration checks in membership lookups; service-role granted unrestricted access to webhook_events_inbox; events_outbox allows tenant-scoped member access plus service-role delivery reads; all policies use helper functions `current_tenant_id()` and `current_user_id()` for JWT claim extraction with NULL-safe fail-closed semantics.
Count: 1

### P0017 — Critical Flows
- No new critical flows introduced in this prompt. Added performance indexes to optimize existing data access patterns without changing business logic or operational flows; indexes support tenant-first query optimization for RLS policy evaluation and partial indexing for common filter patterns.
Count: 0

### P0018 — Critical Flows
- No new critical flows introduced in this prompt. Added development seed data for local testing that demonstrates proper use of existing flows: tenant creation with themes, staff resource provisioning, service configuration with pricing, and service-resource mapping following established multi-tenant patterns.
Count: 0

### P0019 — Critical Flows
- No new critical flows introduced in this prompt. Added comprehensive pgTAP test suite to validate all existing critical flows end-to-end: tenant isolation via RLS policies, booking overlap prevention with exclusion constraints, status synchronization with precedence rules, idempotency enforcement, timezone resolution cascade, and constraint boundary validation.
Count: 0
