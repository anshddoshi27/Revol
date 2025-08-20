Title: interfaces.md
Source of Truth: contracts in /src/types/** and /infra/supabase/migrations/**
Edit Policy: Append-only; deprecate instead of delete
Last Updated: 2025-01-16

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

### P0006 — Interfaces
- Table: services — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `slug text NOT NULL`, `name text NOT NULL DEFAULT ''`, `description text DEFAULT ''`, `duration_min int NOT NULL DEFAULT 60`, `price_cents int NOT NULL DEFAULT 0`, `buffer_before_min int NOT NULL DEFAULT 0`, `buffer_after_min int NOT NULL DEFAULT 0`, `category text DEFAULT ''`, `active boolean NOT NULL DEFAULT true`, `metadata jsonb DEFAULT '{}'`, timestamps, `deleted_at timestamptz`
- Table: service_resources — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `service_id uuid` (composite FK with tenant_id), `resource_id uuid` (composite FK with tenant_id), `created_at timestamptz NOT NULL DEFAULT now()`
Count: 2

### P0007 — Interfaces
- Table: availability_rules — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `resource_id uuid FK → resources(id)`, `dow int NOT NULL` (1-7 ISO weekday), `start_minute int NOT NULL` (0-1439), `end_minute int NOT NULL` (0-1439), `rrule_json jsonb DEFAULT '{}'`, `metadata jsonb DEFAULT '{}'`, timestamps
- Table: availability_exceptions — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `resource_id uuid FK → resources(id)`, `date date NOT NULL`, `start_minute int` (NULL=closed, 0-1439), `end_minute int` (NULL=closed, 0-1439), `description text DEFAULT ''`, `metadata jsonb DEFAULT '{}'`, timestamps
Count: 2

### P0008 — Interfaces
- Function: public.sync_booking_status() → trigger `bookings_status_sync_biur` (enforces status precedence: canceled_at → no_show_flag → preserved status)
- Function: public.fill_booking_tz() → trigger `bookings_fill_tz_bi` (timezone resolution: NEW.booking_tz → resource.tz → tenant.tz → error)
- Table: bookings — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `customer_id uuid FK → customers(id)`, `resource_id uuid FK → resources(id)`, `client_generated_id text NOT NULL` (idempotency), `service_snapshot jsonb NOT NULL DEFAULT '{}'` (pricing audit), `start_at timestamptz NOT NULL`, `end_at timestamptz NOT NULL`, `booking_tz text NOT NULL` (IANA timezone), `status booking_status NOT NULL DEFAULT 'pending'`, `canceled_at timestamptz`, `no_show_flag boolean NOT NULL DEFAULT false`, `attendee_count int NOT NULL DEFAULT 1`, `rescheduled_from uuid FK → bookings(id)`, timestamps
- Table: booking_items — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `booking_id uuid FK → bookings(id)`, `resource_id uuid FK → resources(id)`, `service_id uuid FK → services(id)` (optional), `start_at timestamptz NOT NULL`, `end_at timestamptz NOT NULL`, `buffer_before_min int NOT NULL DEFAULT 0`, `buffer_after_min int NOT NULL DEFAULT 0`, `price_cents int NOT NULL DEFAULT 0`, timestamps
Count: 4

### P0009 — Interfaces
- Table: payments — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `booking_id uuid FK → bookings(id)` (optional), `customer_id uuid FK → customers(id)` (optional), `status payment_status NOT NULL DEFAULT 'requires_action'`, `method payment_method NOT NULL DEFAULT 'card'`, `currency_code text NOT NULL DEFAULT 'USD'`, `amount_cents int NOT NULL`, `tip_cents int NOT NULL DEFAULT 0`, `tax_cents int NOT NULL DEFAULT 0`, `application_fee_cents int NOT NULL DEFAULT 0`, `provider text NOT NULL DEFAULT 'stripe'`, `provider_payment_id text`, `provider_charge_id text`, `provider_setup_intent_id text`, `provider_metadata jsonb DEFAULT '{}'`, `idempotency_key text`, `backup_setup_intent_id text`, `explicit_consent_flag boolean NOT NULL DEFAULT false`, `no_show_fee_cents int NOT NULL DEFAULT 0`, `royalty_applied boolean NOT NULL DEFAULT false`, `royalty_basis text`, `metadata jsonb DEFAULT '{}'`, timestamps
- Table: tenant_billing — fields: `tenant_id uuid PK/FK → tenants(id)`, `stripe_connect_id text`, `stripe_connect_enabled boolean NOT NULL DEFAULT false`, `billing_email text`, `billing_address_json jsonb DEFAULT '{}'`, `trial_ends_at timestamptz`, `monthly_price_cents int NOT NULL DEFAULT 1199`, `trust_messaging_variant text DEFAULT 'standard'`, `default_payment_method_id text`, `metadata jsonb DEFAULT '{}'`, timestamps
Count: 2

### P0010 — Interfaces
- Table: coupons — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `code text NOT NULL`, `name text NOT NULL DEFAULT ''`, `description text DEFAULT ''`, `percent_off int` (1-100 if used), `amount_off_cents int` (>0 if used), `minimum_amount_cents int NOT NULL DEFAULT 0`, `maximum_discount_cents int`, `usage_limit int`, `usage_count int NOT NULL DEFAULT 0`, `starts_at timestamptz`, `expires_at timestamptz`, `active boolean NOT NULL DEFAULT true`, `metadata jsonb DEFAULT '{}'`, timestamps, `deleted_at timestamptz`
- Table: gift_cards — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `code text NOT NULL`, `initial_balance_cents int NOT NULL`, `current_balance_cents int NOT NULL`, `purchaser_customer_id uuid FK → customers(id)`, `recipient_customer_id uuid FK → customers(id)`, `expires_at timestamptz`, `active boolean NOT NULL DEFAULT true`, `metadata jsonb DEFAULT '{}'`, timestamps
- Table: referrals — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `code text NOT NULL`, `referrer_customer_id uuid FK → customers(id)`, `referred_customer_id uuid FK → customers(id)`, `reward_amount_cents int NOT NULL DEFAULT 0`, `referrer_reward_cents int NOT NULL DEFAULT 0`, `referred_reward_cents int NOT NULL DEFAULT 0`, `status text NOT NULL DEFAULT 'pending'` (pending/completed/expired), `completed_at timestamptz`, `expires_at timestamptz`, `metadata jsonb DEFAULT '{}'`, timestamps
Count: 3

### P0011 — Interfaces
- Table: notification_event_type — fields: `code text PK`, `description text NOT NULL DEFAULT ''`; enforces format `^[a-z][a-z0-9_]*$`
- Table: notification_templates — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `event_code text FK → notification_event_type(code)`, `channel notification_channel NOT NULL`, `name text NOT NULL DEFAULT ''`, `subject text DEFAULT ''`, `body text NOT NULL DEFAULT ''`, `is_active boolean NOT NULL DEFAULT true`, `metadata jsonb DEFAULT '{}'`, timestamps
- Table: notifications — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `event_code text FK → notification_event_type(code)`, `channel notification_channel NOT NULL`, `status notification_status NOT NULL DEFAULT 'queued'`, `to_email text`, `to_phone text`, `target_json jsonb DEFAULT '{}'`, `subject text DEFAULT ''`, `body text NOT NULL DEFAULT ''`, `scheduled_at timestamptz NOT NULL DEFAULT now()`, `sent_at timestamptz`, `failed_at timestamptz`, `attempts int NOT NULL DEFAULT 0`, `max_attempts int NOT NULL DEFAULT 3`, `last_attempt_at timestamptz`, `error_message text`, `dedupe_key text`, `provider_message_id text`, `provider_metadata jsonb DEFAULT '{}'`, `metadata jsonb DEFAULT '{}'`, timestamps
Count: 3

### P0012 — Interfaces
- Table: usage_counters — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `code text NOT NULL`, `period_start date NOT NULL`, `period_end date NOT NULL`, `current_count int NOT NULL DEFAULT 0`, `metadata jsonb DEFAULT '{}'`, timestamps; application-managed counters with no DB triggers to preserve idempotency and support backfills
- Table: quotas — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `code text NOT NULL`, `limit_value int NOT NULL`, `period_type text NOT NULL DEFAULT 'monthly'`, `is_active boolean NOT NULL DEFAULT true`, `metadata jsonb DEFAULT '{}'`, timestamps; sets up enforcement envelopes with touch trigger for updated_at
Count: 2

### P0013 — Interfaces
- Function: public.log_audit() → trigger `<table>_audit_aiud` (generic audit logging for AFTER INSERT/UPDATE/DELETE on key business tables)
- Function: public.purge_audit_older_than_12m() → int (removes audit records older than 12 months, returns deleted count)
- Function: public.anonymize_customer(p_tenant_id uuid, p_customer_id uuid) → void (GDPR-compliant PII scrubbing with audit trail)
- Table: audit_logs — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `table_name text NOT NULL`, `operation text NOT NULL` (INSERT/UPDATE/DELETE), `record_id uuid`, `old_data jsonb`, `new_data jsonb`, `user_id uuid`, `created_at timestamptz NOT NULL DEFAULT now()`
- Table: events_outbox — fields: `id uuid PK`, `tenant_id uuid FK → tenants(id)`, `event_code text NOT NULL`, `payload jsonb NOT NULL DEFAULT '{}'`, `status text NOT NULL DEFAULT 'ready'` (ready/delivered/failed), `ready_at timestamptz`, `delivered_at timestamptz`, `failed_at timestamptz`, `attempts int NOT NULL DEFAULT 0`, `max_attempts int NOT NULL DEFAULT 3`, `last_attempt_at timestamptz`, `error_message text`, `key text` (optional unique key), `metadata jsonb DEFAULT '{}'`, timestamps
- Table: webhook_events_inbox — fields: `provider text NOT NULL`, `id text NOT NULL`, `payload jsonb NOT NULL DEFAULT '{}'`, `processed_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`; PK `(provider, id)` for idempotent inbound processing
Count: 6
