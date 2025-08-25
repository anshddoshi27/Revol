## Tithi Database Report — End-to-End Explanation (M0001–M0021)

### How to use this report
- This report explains every part of the database: extensions, types, helpers, tables, constraints, triggers, RLS, policies, indexes, seed data, and their purposes.
- It follows the chronological migration order to show how the system accumulates capabilities.
- Each section ends with how it contributes to Tithi's ulterior functionality: multi-tenant salons booking, payments, notifications, promotions, auditability, and operational reliability.

---

### 0001_extensions.sql — Core PostgreSQL capabilities
What it does:
- Installs extensions: `pgcrypto`, `citext`, `btree_gist`, `pg_trgm`.
- Wrapped in a transaction; idempotent.

Why it matters to Tithi:
- `pgcrypto`: UUID generation, secure tokens.
- `citext`: case-insensitive emails and slugs.
- `btree_gist`: enables GiST exclusion constraints used for "no overlapping bookings".
- `pg_trgm`: enables fuzzy search later if needed.

---

### 0002_types.sql — Canonical enums
What it does:
- Defines enums: `booking_status`, `payment_status`, `membership_role`, `resource_type`, `notification_channel`, `notification_status`, `payment_method`.
- Idempotent creation in one transaction.

Why it matters to Tithi:
- Strongly typed lifecycles for bookings and payments; policy and constraint clarity.
- Roles power authorization (later RLS policies).
- Resource types enable staff/room scheduling semantics.
- Notification channel/status support outbox and worker logic.

---

### 0003_helpers.sql — Auth context helpers
What it does:
- `public.current_tenant_id()` and `public.current_user_id()` from JWT claims with UUID validation.

Why it matters to Tithi:
- Foundation for deny-by-default RLS: policies compare table `tenant_id` to current claims safely.

---

### 0004_core_tenancy.sql — Tenancy backbone and touch trigger
What it does:
- `public.touch_updated_at()` trigger function.
- Tables: `tenants` (soft-delete with partial unique on slug), `users` (global), `memberships` (tenant↔user with role and permissions), `themes` (1:1 branding).
- Attaches `touch_updated_at` triggers.

Why it matters to Tithi:
- Establishes per-tenant isolation and membership model that the entire product relies on for access and configuration.
- Branding (themes) supports tenant-specific landing/booking UIs.

---

### 0005_customers_resources.sql — CRM + schedulable resources
What it does:
- `customers` (soft-delete, PII-ready, unique email per tenant ignoring deleted/NULL).
- `resources` (type, tz, capacity≥1, name, is_active, soft-delete).
- `customer_metrics` read model (non-negative counters, composite PK `(tenant_id, customer_id)`).
- Touch triggers on all.

Why it matters to Tithi:
- Customers: CRM and booking ownership.
- Resources: staff/rooms to schedule, with capacity and time zone.
- Metrics: fast CRM dashboards and segmentation.

---

### 0006_services.sql — Catalog and service-resource mapping
What it does:
- `services` with tenant slug (partial unique when not deleted), price/duration/buffers, active flag, soft-delete.
- `service_resources` M:N mapping with composite FKs to preserve cross-tenant integrity.
- Non-negative/positive checks; touch trigger.

Why it matters to Tithi:
- Defines what can be booked, for how long, and at what price.
- Connects services to resources that deliver them, enabling availability/booking logic.

---

### 0007_availability.sql — Recurring rules and date exceptions
What it does:
- `availability_rules` per resource: weekday, start/end minutes, unique per resource/dow/time.
- `availability_exceptions` per resource/date: closed all day or special hours; unique with NULL-safe coalesce.
- Touch triggers and supporting indexes.

Why it matters to Tithi:
- Encodes working hours and closures to generate 15-min slots and validate booking windows.

---

### 0008_bookings.sql — Booking engine, overlap safety, lifecycle
What it does:
- Functions: `sync_booking_status()`, `fill_booking_tz()`.
- `bookings`: tenant/customer/resource, client idempotency key, start/end, status, canceled/no-show flags, attendee_count, rescheduled_from.
- `booking_items`: per-resource segments with buffers and price snapshot.
- Constraints: idempotency `(tenant_id, client_generated_id)`, time order, non-negative buffer/price/attendees.
- Exclusion constraint: no-overlap on `(resource_id, tstzrange(start,end '[)'))` for active statuses (includes completed per spec).
- Touch triggers and fill/status triggers.

Why it matters to Tithi:
- Guarantees schedule correctness (no double-booking) and reproducible timezone handling.
- Supports multi-resource services and rescheduling lineage.

---

### 0009_payments_billing.sql — Payments and tenant billing
What it does:
- `payments`: links to bookings/customers, `payment_status` and `payment_method`, non-negative amounts/tips/taxes, provider ids, idempotency key, no-show fee, royalty fields.
- `tenant_billing`: Stripe Connect, pricing, trials, trust messaging variants.
- Touch triggers and uniques for idempotency and provider references.

Why it matters to Tithi:
- Enables revenue capture, refunds, fees, and Stripe Connect onboarding at the tenant level.
- Supports idempotent processing and reconciliation.

---

### 0010_promotions.sql — Coupons, gift cards, referrals
What it does:
- `coupons`: XOR discount type (percent 1–100 or amount>0), temporal and soft-delete constraints, unique `(tenant_id, code)` active-only.
- `gift_cards`: initial/current balance (non-negative, current ≤ initial), tenant unique code; purchaser/recipient FKs.
- `referrals`: unique pair `(tenant_id, referrer, referred)`, no self-referrals, unique code, non-negative rewards.
- Touch triggers.

Why it matters to Tithi:
- Promos reduce price, track balances, and drive growth via referrals under strong invariants.

---

### 0011_notifications.sql — Event types, templates, queue
What it does:
- `notification_event_type` with code format check and seeds.
- `notification_templates` unique per `(tenant_id, event_code, channel)`.
- `notifications` queue with dedupe `(tenant_id, channel, dedupe_key)`, attempts/max_attempts, scheduled_at checks, channel-specific recipient checks, worker indexes.
- Touch triggers.

Why it matters to Tithi:
- Drives automated reminders, confirmations, and operational alerts with reliable, deduplicated delivery.

---

### 0012_usage_quotas.sql — Usage counters and quotas
What it does:
- `usage_counters`: application-managed counters per `(tenant_id, code, period_start)`; non-negative.
- `quotas`: per-tenant limits with period types; non-negative; touch trigger.

Why it matters to Tithi:
- Enforces fair-use, plan limits, and operational guardrails (e.g., notification sends, bookings per month).

---

### 0013_audit_logs.sql and 0013a_audit_logs_fix.sql — Auditing and outbox
What it does:
- `audit_logs`: immutable audit trail per operation; FK to tenants.
- `events_outbox`: reliable events table with status, attempts, optional unique key; tenant FK; `touch_updated_at` trigger.
- `webhook_events_inbox`: idempotent inbound events `(provider, id)` PK.
- `log_audit()` trigger function (fixed in 0013a) that handles tables with/without `id` column; `purge_audit_older_than_12m()`; `anonymize_customer(...)` GDPR helper.
- Attaches audit triggers to key tables: bookings, services, payments, themes, quotas.

Why it matters to Tithi:
- Compliance and forensics via audit trail; reliable integration via outbox/inbox; GDPR workflows.

---

### 0014_enable_rls.sql — RLS everywhere
What it does:
- Enables Row Level Security on all tables, adopting deny-by-default posture.

Why it matters to Tithi:
- Fundamental security boundary for multi-tenant isolation across the entire schema.

---

### 0015_policies_standard.sql — Standard tenant policies
What it does:
- For tenant-scoped tables, adds SELECT/INSERT/UPDATE/DELETE policies with predicate `tenant_id = current_tenant_id()`.
- Covers: customers, resources, customer_metrics, services, service_resources, availability_rules, availability_exceptions, bookings, booking_items, payments, coupons, gift_cards, referrals, notification_templates, notifications, usage_counters, audit_logs, events_outbox.

Why it matters to Tithi:
- Enforces strict tenant isolation consistently with minimal policy surface area.

---

### 0016_policies_special.sql — Special cross-tenant policies
What it does:
- `tenants`: member-gated SELECT; writes via service role only.
- `users`: self or users who share a tenant with requester.
- `memberships`: members can read; owners/admins can write.
- `themes`, `tenant_billing`, `quotas`: members read; owners/admins write.
- `webhook_events_inbox`: service-role only.
- `events_outbox`: members can read/write their tenant events.

Why it matters to Tithi:
- Captures nuanced access needs beyond simple tenant_id equality while preserving least privilege.

---

### 0017_indexes.sql — Performance layer
What it does:
- Adds time and status indexes for bookings, services, payments, customers, memberships.
- Outbox worker and audit log indexes (BRIN and BTREE) for scale.
- Leverages partial indexes for active statuses and ready events.

Why it matters to Tithi:
- Ensures fast calendars, BI queries, worker throughput, and retention management at scale.

---

### 0018_seed_dev.sql — Developer seed data
What it does:
- Seeds one tenant `salonx` with theme, one staff resource, one service, and their mapping.

Why it matters to Tithi:
- Instant local environment to validate flows end-to-end.

---

### 0019_update_bookings_overlap_rule.sql — Update bookings overlap rule
What it does:
- Updates the exclusion constraint `bookings_excl_resource_time` to exclude `completed` status from overlap prevention
- Changes status filter from `('pending', 'confirmed', 'checked_in', 'completed')` to `('pending', 'confirmed', 'checked_in')`
- Safely drops existing constraint and recreates with updated definition
- Maintains same constraint name and GiST index structure

Why it matters to Tithi:
- Allows completed bookings to not block future bookings on the same resource
- Aligns with business rule: "completed means end time passed or payment captured; it does not block future booking creation"
- Enables better resource utilization by allowing time slot reuse after completion
- Maintains safety for active statuses while removing unnecessary historical conflicts

---

### 0020_versioned_themes.sql — Versioned themes with publish/rollback
What it does:
- Creates `tenant_themes` table with versioning support: `draft`, `published`, `archived` statuses
- Implements append-friendly design (themes never deleted, only archived)
- Enforces one published theme per tenant via unique constraint
- Provides `themes_current` compatibility view for backward compatibility
- Includes helper functions: `get_next_theme_version()`, `publish_theme()`, `rollback_theme()`
- Migrates legacy themes data to version 1 published status
- Attaches audit triggers and RLS policies for secure access

Why it matters to Tithi:
- Enables tenants to save multiple theme versions and experiment with branding
- Supports A/B testing and seasonal theme changes
- Maintains backward compatibility for existing theme consumers
- Provides safe rollback capabilities for theme changes
- Integrates with audit system for compliance and change tracking

---

### 0021_update_helpers_app_claims.sql — Enhanced helper functions for app claims
What it does:
- Updates `current_tenant_id()` and `current_user_id()` to prioritize app-set JWT claims over Supabase Auth
- Implements dual-source claim reading: first tries `current_setting('request.jwt.claims')`, then falls back to `auth.jwt()`
- Maintains fail-closed security: invalid claims result in NULL for RLS denial
- Preserves backward compatibility with existing RLS policies
- Enables middleware to override authentication claims for testing and custom flows

Why it matters to Tithi:
- Provides flexibility for custom authentication flows and middleware integration
- Maintains security model while enabling development and testing scenarios
- Supports both Supabase Auth and custom JWT claim sources
- No breaking changes to existing RLS policies or security posture

---

### End-to-end data model (conceptual)
- Core tenancy: `tenants` ← `memberships` → `users`; `tenant_themes` (versioned) and `tenant_billing` 1:1 with tenants.
- CRM and scheduling: `customers`, `resources`, `services`, `service_resources`, `availability_rules`, `availability_exceptions`.
- Bookings and operations: `bookings`, `booking_items`, `payments`, `customer_metrics`.
- Growth and engagement: `coupons`, `gift_cards`, `referrals`, `notifications` (+ event types/templates).
- Operations and governance: `usage_counters`, `quotas`, `audit_logs`, `events_outbox`, `webhook_events_inbox`.
- Security: RLS enabled everywhere with standard and special policies, enhanced helper functions.
- Performance: targeted indexes supporting common UX and worker paths.
- Branding: versioned themes with publish/rollback capabilities and backward compatibility.

### How this database serves Tithi's ulterior functionality
- Multi-tenant isolation: Strict RLS with enhanced helpers guarantees data safety across salons.
- Reliable booking engine: Overlap prevention (excluding completed), timezone filling, buffers, multi-resource items.
- Payments and monetization: Full lifecycle states, idempotency, Stripe alignment, tenant-level billing.
- Promotions and loyalty: Coupons, gift cards, referrals under robust constraints.
- Notifications: Template-driven, deduplicated, scheduled messaging for confirmations/reminders.
- Governance and operations: Audits, quotas, usage counters, and outbox for reliable integrations.
- Performance: Indexes for calendars, BI, and worker processing keep UX snappy as data grows.
- Branding flexibility: Versioned themes enable experimentation while maintaining stability.
- Authentication flexibility: Enhanced helpers support both Supabase Auth and custom claim sources.
