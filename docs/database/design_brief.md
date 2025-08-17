# Tithi DB — Final Design Brief (Supabase/Postgres + RLS)

**Goal:** Production-grade, strictly isolated multi-tenant schema with offline-safe idempotency, overlap guarantees, payments boundaries, auditing, notifications, usage quotas, and comprehensive RLS. All work is produced by executing prompts 00–19 in sequence from the integrated Cursor pack. These prompts define the complete canonical schema — there is no separate post-0019 migration phase.

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

## 1) Canonical Multitenancy Model

Tenant resolution (canonical): Path-based `/b/{slug}`. No domains table.

Optional host/subdomain support can be added later without breaking the model by adding columns to tenants:

```sql
domain TEXT UNIQUE NULL
subdomain TEXT UNIQUE NULL
```
Partial uniques with `WHERE deleted_at IS NULL` recommended.

Resolution order at API edge:
- Host → domain/subdomain
- Else path → `/b/{slug}`

User model: `users` is global (no `tenant_id`); membership via `memberships`.

Branding: `themes` is 1:1 with tenants.

RLS identity helpers: `public.current_tenant_id()`, `public.current_user_id()` (NULL-safe) used by all policies.

## 2) Enumerations (0002)

Create exact enums below (use `CREATE TYPE IF NOT EXISTS`). Do not reorder or add values later.

```sql
booking_status: pending, confirmed, checked_in, completed, canceled, no_show, failed
payment_status: requires_action, authorized, captured, refunded, canceled, failed
membership_role: owner, admin, staff, viewer
resource_type: staff, room
notification_channel: email, sms, push
notification_status: queued, sent, failed
payment_method: card, cash, apple_pay, paypal, other
```

(Enums remain unchanged; mapping to providers is handled in app code.)

## 3) Core Schema (High Level)

- **Tenancy:** `tenants` (slug, billing, soft-delete), `users` (global), `memberships` (role, permissions)
- **Branding:** `themes` (1:1)
- **Catalog:** `customers` (soft-delete, first-time flag), `resources` (type, tz)
- **Services:** `services` (+ `service_resources`), soft-delete
- **Scheduling:** `availability_rules`, `availability_exceptions`
- **Bookings:** `bookings` (+ `booking_items`), overlap exclusion, idempotency key, `booking_tz`
- **Payments:** `payments` (PCI boundary), `tenant_billing`
- **Promos:** `coupons`, `gift_cards`, `referrals` (XOR checks, no self-referrals)
- **Notifications:** `notification_event_type`, `notification_templates`, `notifications`
- **Usage & Quotas:** `usage_counters`, `quotas`
- **Audit:** `audit_logs` (+ triggers)
- **Eventing:** `webhook_events_inbox`, `events_outbox`
- **RLS:** enabled everywhere, deny by default

## 4) Time & Timezone Rules (Final)

Availability DOW: ISO weekday 1–7 (Mon=1…Sun=7). Constraint: `dow BETWEEN 1 AND 7`.

Bookings timestamps: `start_at`, `end_at` stored as `timestamptz` (UTC).
`booking_tz TEXT` is REQUIRED. Fill order on insert:

1. `NEW.booking_tz` (if provided)
2. `resource.tz`
3. `tenant.tz`
4. If still NULL → `RAISE EXCEPTION`.

Outcome: deterministic wall-time reconstruction; DST-safe.

## 5) Booking Status Precedence (Final)

Deterministic order (high → low):
`canceled_at` → `no_show_flag` → expired → completed → confirmed → pending.

Trigger `public.sync_booking_status()` enforces:

- If `canceled_at IS NOT NULL` ⇒ `status='canceled'` (wins)
- Else if `no_show_flag` ⇒ `status='no_show'`

## 6) Promotions Rules (Final)

**Coupons (XOR):** exactly one of (`percent_off` ∈ [1..100]) or (`amount_off_cents` > 0). No zero fixed amounts.

**Gift cards:** non-negative balances; unique `(tenant_id, code)`.

**Referrals:** unique `(tenant_id, referrer_customer_id, referred_customer_id)`; no self-referrals; unique `(tenant_id, code)`.

## 7) Notifications Model (Final)

Keep `notification_channel` and `notification_status` enums.

Event types: `notification_event_type(code TEXT PRIMARY KEY, description TEXT)`

Seed (extensible): `booking_created`, `booking_confirmed`, `booking_rescheduled`, `reminder_24h`, `reminder_2h`, `reminder_1h`, `no_show_marked`, `booking_canceled`, `refund_issued`

`notification_templates.event_code` and `notifications.event_code` → FK to lookup.

Format check: `event_code ~ '^[a-z][a-z0-9_]*$'` (enforced via lookup or explicit checks).

## 8) Usage & Quotas (Final)

`usage_counters` are application-managed (jobs/transactions).
No DB triggers for increments (preserves idempotency; supports backfills).

## 9) Auditing & Retention (Final)

`audit_logs` with `public.log_audit()` on: `bookings`, `services`, `payments`, `themes`, `quotas`.

Nightly purge function (12-month retention) via pg_cron/Supabase: `public.purge_audit_older_than_12m()`.

Indexing: BTREE `(tenant_id, created_at)` + BRIN on `created_at`.

GDPR helper: `public.anonymize_customer(p_tenant_id uuid, p_customer_id uuid)` scrubs PII (keeps aggregates). RBAC guarded; audited.

## 10) RLS & Policies (Final)

**0014:** Enable RLS on every table.

**0015:** Standard policies (`_sel` / `_ins` / `_upd` / `_del`) for all tenant-scoped tables: predicate → `tenant_id = public.current_tenant_id()`.

**0016:** Special policies:

- `tenants`: SELECT if requester is a member (EXISTS in `memberships`); no writes from anon/auth.
- `users`: SELECT self or if requester shares a tenant with target.
- `memberships`: SELECT if in tenant and (self OR requester is owner/admin); writes only owner/admin.
- `themes`, `tenant_billing`, `quotas`: SELECT for members; UPDATE/DELETE owner/admin only.

Helpers return NULL on missing/invalid claims; comparisons fail closed → deny by default.

## 11) Performance & Indexing (Final)

Only create indexes listed in 0017 (plus those mandated below).

`pg_trgm` is enabled in 0001; add GIN/trgm later when search needs justify it.

Ensure `(tenant_id, created_at)` exists on all high-write tables.

## 12) Deterministic Object Names

**Functions & Triggers:**

- Timestamp touch: `public.touch_updated_at()` → trigger: `<table>_touch_updated_at`
- Booking status sync: `public.sync_booking_status()` → trigger: `bookings_status_sync_biur` (BEFORE INSERT/UPDATE)
- Booking tz fill: `public.fill_booking_tz()` → trigger: `bookings_fill_tz_bi`
- Audit: `public.log_audit()` → triggers: `<table>_audit_aiud` (AFTER I/U/D)
- Audit purge: `public.purge_audit_older_than_12m()`

## 13) Constraints (selected)

- **Availability:** DOW between 1 and 7; minute bounds valid; start < end
- **Bookings:** start < end; exclusion partial on active statuses; `booking_tz` required via trigger
- **Coupons:** XOR + positive fixed amount
- **Gift cards:** non-negative balances
- **Referrals:** no self-referrals; unique `(tenant_id, code)`
- **Notifications:** valid `event_code` format
- **Money:** integer cents, NOT NULL where applicable; non-negative checks enforced

## 14) Uniques / Indexes (selected)

- `tenants` unique partial: `(slug) WHERE deleted_at IS NULL`
- `customers` unique partial: `(tenant_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL`
- `services` unique partial: `(tenant_id, slug) WHERE deleted_at IS NULL`
- `bookings` idempotency unique: `(tenant_id, client_generated_id)`
- `availability_exceptions` unique: `(resource_id, date, coalesce(start_minute,-1), coalesce(end_minute,-1))`
- `service_resources` unique: `(service_id, resource_id)`
- `referrals`: UNIQUE `(tenant_id, code)`
- **Payments:** replay-safe partials on `(tenant_id, provider, provider_payment_id)` and `(tenant_id, provider, idempotency_key)`

## 15) Overlap Prevention (Exclusions)

`bookings_excl_resource_time` on `bookings`:

```sql
EXCLUDE USING gist (
  resource_id WITH =,
  tstzrange(start_at,end_at,'[)') WITH &&
)
WHERE status IN ('pending','confirmed','checked_in','completed')
  AND resource_id IS NOT NULL;
```

Optional `booking_items` exclusion for multi-resource overlaps (included in prompts). Requires `btree_gist`.

## 16) Amendments by Migration Number (exact places to apply)

Constraints, triggers, seeds, indexes, and checks are implemented exactly where specified in the relevant prompt (e.g., 0007 constraints, 0008 triggers, 0011 seeds, etc.).

All canonical features are delivered by the 00–19 run.

## 17) Testing & Acceptance

**0019 pgTAP tests include:**

- Tenant isolation
- Overlap & status sync
- Idempotency enforcement
- Constraint validation
- Service-role access restrictions

All acceptance criteria are satisfied within the 00–19 sequence.

## 18) CI/CD & Docs

Each migration wrapped in `BEGIN; … COMMIT;` and idempotent where practical.

`docs/DB_PROGRESS.md` updated per prompt (append sections `## 000N – …` with rationale).

No extra core schema files or sections beyond what's defined here.

## 19) Final Notes (do not change)

- Do not introduce a `domains` table.
- Do not add enum values or extra core tables beyond those defined in 00–19.
- Do not weaken the bookings exclusion constraint or status precedence.
- Do not autoincrement usage counters in DB.

**Payments/App Mapping Note (non-schema):**
If a provider reports succeeded, map it to enum `captured` at the app layer. Use `currency_code` and provider/idempotency unique indexes to ensure replay safety and multi-currency readiness without enum changes.

