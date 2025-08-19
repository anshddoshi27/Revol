Title: critical_flows.md
Source of Truth: /src, /infra/supabase/migrations/**, /src/types/**
Edit Policy: Append-only; revise by adding a new version and archiving the old one
Last Updated: 2025-08-19

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
