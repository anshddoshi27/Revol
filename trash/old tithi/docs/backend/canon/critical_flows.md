Title: critical_flows.md
Source of Truth: /src, /src/api/**, /src/services/**, /src/types/**
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
- Formatting. H2 = sections; H3 = flows. 5–10 primary bullets. Use monospace for paths/services.
- Examples are canonical. Steps list concrete paths/services and referenced IDs.

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
- Step 1: <verb + object> (`<METHOD> /api/...`; services: `<service>`)
- Step 2: <...>
- Step N: <...>

**Alternate/Error Paths:**
- A1: <condition> → <behavior> (See C-<TOPIC>-NNN)
- A2: <...>

**Data Touchpoints:** `/api/...`; services: `<service1>`, `<service2>`  
**Policies Enforced:** C-RLS-001, C-POLICY-002  
**Events & Side Effects:** `<event.topic>` emitted; `<queue>` job scheduled  
**Tests/Acceptance:** `tests/acceptance/<feature>/<flow>_spec.ts`

**Revised:** YYYY-MM-DD (optional)

## Append Rules
- Add new flows under the correct ## <Feature> section (create if missing).
- If a feature exceeds 6 flows, move the oldest to Archive (add a date line).
- Never delete; archive instead.

## Windsurf Prompt: "Append to critical_flows.md"
Goal: Append flows to `docs/canon/critical_flows.md`  
Rules:
- Preserve header; update "Last Updated".
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
**Actors:** Web Client, API, BookingService  
**Preconditions:** 
- Authenticated member in tenant scope
- Resource and service exist and are available

**Primary Path:**
- Step 1: POST `/api/bookings` with `client_generated_id`, `resource_id`, `service_snapshot`, `start_at`, `end_at`, `booking_tz`
- Step 2: Validate tenant scope; resolve time zone; compute UTC range
- Step 3: Enforce idempotency on `(tenant_id, client_generated_id)` (See C-IDEMP-001)
- Step 4: Call BookingService.create() with overlap validation
- Step 5: Emit `booking_created` event; enqueue notification job

**Alternate/Error Paths:**
- A1: Overlap detected → 409 with existing booking ref (See C-OVERLAP-001)
- A2: Bad claims/tenant mismatch → 403 deny (See C-RLS-001)

**Data Touchpoints:** `/api/bookings`; services: `BookingService`, `NotificationService`  
**Policies Enforced:** C-RLS-001, C-POLICY-002  
**Events & Side Effects:** `booking_created` emitted; queue `notify.booking_created`  
**Tests/Acceptance:** `tests/acceptance/bookings/create_booking_spec.ts`

## Quality Checklist
- Header present; Last Updated = today
- Right feature section; ID stable; ≤ 10 primary bullets
- Each step starts with a verb and lists paths/services
- Cross-links to constraint/interface IDs; tests listed
- Revisions archived, not overwritten
