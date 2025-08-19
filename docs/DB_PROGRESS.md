# Tithi DB — Progress Log (Root Convenience Copy)

This file mirrors the comprehensive P0005 report from `docs/database/DB_PROGRESS.md` for quick review.

---

## 0005 — Customers & Resources

### Inputs consulted
- `infra/supabase/migrations/0005_customers_resources.sql` — implementation for customers, resources, and customer_metrics
- `docs/database/design_brief.md` — Customers & Resources requirements: soft-delete, tenant scoping, `resource_type`, money as integer cents, triggers, additive-only
- `docs/database/database_context_pack.md` — Execution Context Rule; idempotent, transactional migrations; partial uniques for soft-delete; read-model guidance
- `docs/database/canon/interfaces.md` — Existing interfaces and P0005 placeholders
- `docs/database/canon/constraints.md` — Counts and prior constraints; target to append P0005
- `docs/database/canon/critical_flows.md` — Patterns and counts; target to add P0005 flows
- Prior migrations: `0001_extensions.sql`, `0002_types.sql`, `0003_helpers.sql`, `0004_core_tenancy.sql`, `0004_hotfix_touch_updated_at.sql`

Execution Context Rule honored: authoritative order Design Brief → Context Pack → Cheat Sheets. No deviations.

### Reasoning and intermediate steps
- Verified table DDL in `0005_customers_resources.sql` aligns with Brief: tenant-scoped `customers` and `resources`, plus read-model `customer_metrics`.
- Confirmed idempotency:
  - Tables created with `IF NOT EXISTS`.
  - CHECK constraints added via DO blocks guarded by `pg_constraint` name checks.
  - Partial unique index on `(tenant_id, email)` guarded by `IF NOT EXISTS`.
  - Triggers created via DO block conditioned on `pg_trigger` name existence.
- Confirmed additive-only and transactional: file begins with `BEGIN;` and ends with `COMMIT;`; no destructive ops.
- Mapped each constraint to canon entries to ensure coverage (uniques, FKs, PKs, CHECKs).
- Ensured soft-delete pattern consistency: `deleted_at` present on `customers`/`resources` and temporal sanity checks `deleted_at >= created_at`.
- Ensured performance and correctness: per-tenant uniqueness for `customers.email` uses `citext` for case-insensitivity and excludes soft-deleted rows and NULL emails.
- Ensured read-model metrics non-negativity via explicit CHECK constraints for counts and spend.
- Attached `public.touch_updated_at()` triggers on all three new tables.
- Updated canon docs for constraints and flows; validated counts.

### Actions taken (outputs produced)
- Migration verified: `infra/supabase/migrations/0005_customers_resources.sql` — no changes needed.
- Canon updated:
  - `docs/database/canon/constraints.md` → Added P0005 constraints (partial unique, FKs/PKs, CHECKs). Count: 13
  - `docs/database/canon/critical_flows.md` → Added P0005 flows for Customers and Resources. Count: 2
  - `docs/database/canon/interfaces.md` → P0005 interfaces present for customers/resources/customer_metrics. Count: 3 (verified)
- Progress log updated: this P0005 section appended in `docs/database/DB_PROGRESS.md`.

### Plain-language description
We introduced tenant-scoped Customers and Resources and a Customer Metrics read model. Customers have optional PII (email/phone), marketing and notification preferences, soft-delete, and an index that keeps active emails unique per tenant (ignoring NULLs and deleted rows). Resources are typed (`resource_type`), have a required time zone and capacity validated to be at least 1, plus metadata. Metrics roll up customer activity with non-negative counters and a composite key of `(tenant_id, customer_id)`. All tables auto-update `updated_at` on writes.

### Rationale and connection to the Design Brief
- Multi-tenant CRM: `customers` keyed by tenant, with soft-delete and email uniqueness to avoid conflicts in active records while preserving history.
- Scheduling primitives: `resources` typed as `staff` or `room`, with time zone and capacity to support availability and booking logic (P0007–P0008).
- Read-model metrics: `customer_metrics` supports fast CRM views and reporting without complex joins; checks ensure invariants (no negative counts/spend).
- Additive-only, idempotent, and transactional: required by the Brief to ensure safe re-runs and drift-free environments.
- Triggers re-use the standardized `touch_updated_at()` ensuring observability and cache invalidation signals.

### Decisions made
- Use `citext` for `customers.email` to enforce case-insensitivity at the DB layer.
- Partial unique index excludes `deleted_at IS NOT NULL` and `email IS NULL` to enable soft-delete and email-optional customers.
- Keep `customer_metrics` as a pure read model (no soft-delete, composite PK) with explicit non-negativity checks.
- Attach `touch_updated_at` triggers via idempotent DO block; consistent naming `<table>_touch_updated_at`.
- No RLS yet; defer to P0014–P0016 as per plan; helpers remain ready for fail-closed policies.

### Pitfalls / tricky parts
- Email uniqueness vs. soft-delete: forgetting the partial predicate would block re-creating customers after deletion; ensured `WHERE email IS NOT NULL AND deleted_at IS NULL`.
- Capacity domain: ensured `capacity >= 1` CHECK rather than relying on application logic.
- Trigger idempotency: verified creation guards via `pg_trigger` name checks to avoid duplicates.
- Temporal sanity: replicated the `deleted_at >= created_at` pattern for both `customers` and `resources` via named CHECKs.

### Questions for Future Me
- Should we also enforce per-tenant uniqueness on phone numbers, or allow duplicates for households/shared lines?
- Do we need a `pseudonymized_by` column or audit trail for GDPR workflows when RLS/policies land?
- Will we add capacity-based scheduling rules (e.g., resource can handle `capacity > 1` bookings simultaneously) that interact with overlap checks in P0008?
- Should we compute and maintain `customer_first_booking_at` via trigger once bookings exist, or leave as application-maintained?

### State Snapshot (after P0005)
- Extensions: pgcrypto, citext, btree_gist, pg_trgm
- Enums: booking_status, payment_status, membership_role, resource_type, notification_channel, notification_status, payment_method
- Functions: `public.current_tenant_id()`, `public.current_user_id()`, `public.touch_updated_at()` (hotfixed in `0004_hotfix_touch_updated_at.sql`)
- Tables:
  - Core: `public.tenants`, `public.users`, `public.memberships`, `public.themes`
  - P0005: `public.customers`, `public.resources`, `public.customer_metrics`
- Indexes/Constraints (selected):
  - Partial UNIQUE: `tenants(slug)` WHERE `deleted_at IS NULL`
  - UNIQUE: `memberships(tenant_id, user_id)`
  - Partial UNIQUE: `customers(tenant_id, email)` WHERE `email IS NOT NULL AND deleted_at IS NULL`
  - CHECKs: `customers_deleted_after_created_chk`; `resources_capacity_ge_1_chk`; `resources_deleted_after_created_chk`
  - PKs/FKs: `customer_metrics` PK `(tenant_id, customer_id)`; FKs to `tenants(id)` and `customers(id)`
  - Non-negativity: `customer_metrics_*_nonneg_chk` for spend and counters
- Triggers: `tenants_touch_updated_at`, `users_touch_updated_at`, `memberships_touch_updated_at`, `themes_touch_updated_at`, `customers_touch_updated_at`, `resources_touch_updated_at`, `customer_metrics_touch_updated_at`
- Policies (RLS): none yet (planned P0014–P0016; deny-by-default posture later)
- Migrations present: `0001_extensions.sql`, `0002_types.sql`, `0003_helpers.sql`, `0004_core_tenancy.sql`, `0004_hotfix_touch_updated_at.sql`, `0005_customers_resources.sql`
- Tests (pgTAP): none yet (planned P0019)
- Documentation: canon interfaces/constraints/flows updated for P0005

### Visual representation (schema and relationships after P0005)
```mermaid
erDiagram
  TENANTS ||--o{ MEMBERSHIPS : "has"
  USERS ||--o{ MEMBERSHIPS : "joins"
  TENANTS ||--o{ THEMES : "brands"
  TENANTS ||--o{ CUSTOMERS : "owns"
  TENANTS ||--o{ RESOURCES : "owns"
  TENANTS ||--o{ CUSTOMER_METRICS : "rolls up"
  CUSTOMERS ||--o{ CUSTOMER_METRICS : "has metrics"

  TENANTS {
    uuid id PK
    text slug
  }
  USERS {
    uuid id PK
  }
  MEMBERSHIPS {
    uuid id PK
    uuid tenant_id FK
    uuid user_id FK
  }
  THEMES {
    uuid tenant_id PK/FK
  }
  CUSTOMERS {
    uuid id PK
    uuid tenant_id FK
    citext email
    timestamptz deleted_at
  }
  RESOURCES {
    uuid id PK
    uuid tenant_id FK
    resource_type type
    int capacity
  }
  CUSTOMER_METRICS {
    uuid tenant_id PK/FK
    uuid customer_id PK/FK
    int total_bookings_count
    int total_spend_cents
  }
```

### Canon updates for P0005
- Interfaces: +3 (customers, resources, customer_metrics)
- Constraints: +13 (partial unique; FKs/PKs; soft-delete checks; capacity and non-negativity checks)
- Flows: +2 (Customers create/update; Resource create)

Cumulative canon counts (P0000–P0005): interfaces: 17, constraints: 19, flows: 5
