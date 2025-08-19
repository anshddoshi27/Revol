Title: interfaces.md
Source of Truth: contracts in /src/types/** and /infra/supabase/migrations/**
Edit Policy: Append-only; deprecate instead of delete
Last Updated: 2025-08-19

## Global Rules
- Append-only history. If behavior changes, add a new versioned entry and mark the old one Deprecated (keep history).
- Deterministic order. Sections sorted by feature: Tenancy, Availability, Bookings, Payments, Notifications, Usage, Audit, Policies. Within each section, A→Z by type name.
- Anchors & IDs:
  - Interfaces: I-<FEATURE>-<NAME>-vN
  - Flows: F-<FEATURE>-<NAME>
  - Constraints: C-<TOPIC>-NNN
- Cross-links. Link by ID (e.g., “See C-IDEMP-001”, “See I-BOOKINGS-CreateBookingRequest-v1”).
- Formatting. H2 = sections. H3 = items. Fenced code blocks for JSON. Monospace for paths (`/api/...`, `/src/...`). Bullet lists ≤ 10 items.
- Examples are canonical. One valid JSON example per interface/event; timestamps are ISO-8601 UTC; money = integer cents; enums mirror DB.

## Purpose
Contracts for cross-boundary surfaces: API request/response DTOs, events, and minimal DB rows you read/write.

## Organization
- ## Tenancy
- ## Availability
- ## Bookings
- ## Payments
- ## Notifications
- ## Usage
- ## Audit
- ## Policies (Auth helpers that cross boundaries)

Within each section, sort items A→Z by type name.

## Item Template
### I-<FEATURE>-<Name>-v1
**Kind:** <RequestDTO | ResponseDTO | EventPayload | EventUnion | DbRowMinimal>  
**Path / Topic:** `<HTTP METHOD> /api/<...>` | `<event.topic>`  
**Fields:**
- `field_name` (type) — short meaning. **Required.**
- `optional_field` (type) — when/why present. *Optional.*
**References:** See C-<TOPIC>-NNN, F-<FEATURE>-<FlowName>  
**Example:**
```json
{
  "field_name": "value",
  "optional_field": null
}
```
**Change Log:**  
- 2025-08-17 — Added (v1)

## Append Rules
- New surface? Add a new H3 item with -v1.
- Backward-compatible field? Add a new version block with bumped -vN, copy prior block, and mark the old block Deprecated with reason and link to new ID.
- Never remove enum members here; mirror DB enums exactly.

## Windsurf Prompt: “Append to interfaces.md”
Goal: Append professionally formatted entries to `docs/canon/interfaces.md`  
Rules:
- Keep header; update “Last Updated” to today.
- Insert under the correct ## <Feature> section (create if missing); sort items A→Z by type name.
- Use the “Item Template” verbatim.
- Enums mirror DB; timestamps ISO-8601 UTC; money in integer cents.
- Cross-link referenced constraints/flows by ID.
Inputs:
- Feature: <FEATURE>
- Items to add: <bulleted list: name, kind, path/topic, fields, example JSON, references>
Output:
- A single patch that appends new H3 blocks in the right section.

## Safe Update with Deprecation (when changes are required)
- Do not delete/overwrite the old block.
- Create a new versioned block (e.g., `I-<FEATURE>-<Name>-v2`).
- Mark the previous block “Deprecated — superseded by <new ID>”.
- Only edit the old block’s Status/Note line to add deprecation info.

## Quality Checklist
- Header present; Last Updated = today
- Correct section and alphabetical ordering
- IDs unique; cross-links valid
- Exactly one JSON example; valid & minimal
- Enums mirror DB; timestamps UTC; money integer cents
- No deletions; clear deprecations

### P0001 — Interfaces
- No new schema interfaces introduced in this prompt. Enabled PostgreSQL extensions to support future features: `pgcrypto`, `citext`, `btree_gist`, `pg_trgm`.
Count: 0

### P0002 — Interfaces
- Enum: booking_status
- Enum: membership_role
- Enum: notification_channel
- Enum: notification_status
- Enum: payment_method
- Enum: payment_status
- Enum: resource_type
Count: 7

### P0003 — Interfaces
- Function: public.current_tenant_id() → uuid (STABLE, SECURITY INVOKER, NULL-safe)
- Function: public.current_user_id() → uuid (STABLE, SECURITY INVOKER, NULL-safe)
Count: 2

### P0004 — Interfaces
- Function: public.touch_updated_at() → trigger `<table>_touch_updated_at` (keeps `updated_at` fresh on INSERT/UPDATE)
- Hotfix: `public.touch_updated_at()` updated in `0004_hotfix_touch_updated_at.sql` to use `clock_timestamp()`, guard on presence of `updated_at` column, and ensure monotonic advancement on UPDATE; triggers reasserted idempotently on `tenants`, `users`, `memberships`, `themes`.
- Table: tenants — fields: `id uuid PK`, `slug text UNIQUE (partial on deleted_at)`, `tz text`, `trust_copy_json jsonb`, `is_public_directory boolean`, `public_blurb text`, `billing_json jsonb`, timestamps, `deleted_at timestamptz`
- Table: users (global) — fields: `id uuid PK`, `display_name text`, `primary_email citext`, `avatar_url text`, timestamps; no `tenant_id` column by design
- Table: memberships — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `user_id uuid FK → users(id)`, `role membership_role`, `permissions_json jsonb`, timestamps; UNIQUE `(tenant_id, user_id)`
- Table: themes (1:1) — fields: `tenant_id uuid PK/FK → tenants(id)`, `brand_color text`, `logo_url text`, `theme_json jsonb`, timestamps
Count: 5

### P0005 — Interfaces
- Table: customers — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `display_name text`, `email citext`, `phone text`, `marketing_opt_in boolean`, `notification_preferences jsonb`, `is_first_time boolean`, `pseudonymized_at timestamptz`, `customer_first_booking_at timestamptz`, timestamps, `deleted_at timestamptz`
- Table: resources — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `type resource_type NOT NULL`, `tz text NOT NULL`, `capacity int NOT NULL`, `metadata jsonb`, `name text NOT NULL DEFAULT ''`, `is_active boolean NOT NULL DEFAULT true`, timestamps, `deleted_at timestamptz`
- Table: customer_metrics — fields: `tenant_id uuid FK → tenants(id)`, `customer_id uuid FK → customers(id)`, `total_bookings_count int`, `first_booking_at timestamptz`, `last_booking_at timestamptz`, `total_spend_cents int`, `no_show_count int`, `canceled_count int`, timestamps; PK `(tenant_id, customer_id)`
Count: 3
