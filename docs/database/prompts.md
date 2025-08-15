# Prompts

## 00 — Initialize DB folder + progress doc (no SQL)

Before generating, analyze the Tithi DB context pack and final design brief to ensure full alignment with the existing multi-tenant architecture, invariants, naming conventions, RLS rules, and additive-only migration policy.

Prompt:

```
You are writing repository files for the database. Create:
Folder infra/supabase/migrations/
 Folder docs/
 File docs/DB_PROGRESS.md with a title and a short "How to read this" section.
Output one fenced block containing the full contents of docs/DB_PROGRESS.md. Do not output anything else.
```

## 01 — Extensions (pgcrypto, citext, btree_gist, pg_trgm)

Before generating, analyze the Tithi DB context pack and final design brief to ensure extension usage aligns with the architecture, constraints, and existing migrations.

Prompt:

```
Create infra/supabase/migrations/0001_extensions.sql.
Requirements:
 BEGIN; … COMMIT;
 CREATE EXTENSION IF NOT EXISTS pgcrypto;
 CREATE EXTENSION IF NOT EXISTS citext;
 CREATE EXTENSION IF NOT EXISTS btree_gist;
 CREATE EXTENSION IF NOT EXISTS pg_trgm;
Output two fenced blocks:
 – SQL with the entire migration
 – MD with the entire updated docs/DB_PROGRESS.md, appending a new section titled ## 0001 – Extensions that explains why each extension is needed in 4–6 lines.
```

## 02 — Enum types (expanded)

Before generating, analyze the Tithi DB context pack and final design brief to ensure enums match exactly, are in correct order, and comply with the immutability rule.

Prompt:

```
Create infra/supabase/migrations/0002_types.sql defining these enums with CREATE TYPE IF NOT EXISTS:
booking_status: pending, confirmed, checked_in, completed, canceled, no_show, failed


payment_status: requires_action, authorized, captured, refunded, canceled, failed


membership_role: owner, admin, staff, viewer


resource_type: staff, room


NEW: notification_channel: email, sms, push


NEW: notification_status: queued, sent, failed


NEW: payment_method: card, cash, apple_pay, paypal, other


Use BEGIN; … COMMIT;.
Output two fenced blocks:
 – SQL (full migration)
 – MD (full docs/DB_PROGRESS.md) appending ## 0002 – Types with a short rationale for each enum and where it's used.
```

## 03 — RLS helper functions (hardened)

Before generating, analyze the Tithi DB context pack and final design brief to ensure helper functions follow the NULL-safe, fail-closed rules and naming conventions.

Prompt:

```
Create infra/supabase/migrations/0003_helpers.sql with:
public.current_tenant_id() STABLE, SECURITY INVOKER, RETURNS uuid with RETURNS NULL ON NULL INPUT, implementation: ((auth.jwt() ->> 'tenant_id'))::uuid, but returns NULL if the claim is missing or not a valid UUID.


public.current_user_id() STABLE, SECURITY INVOKER, RETURNS uuid with RETURNS NULL ON NULL INPUT, implementation: ((auth.jwt() ->> 'sub'))::uuid, returning NULL if absent/invalid.


Use CREATE OR REPLACE FUNCTION and wrap in a transaction.
Output two fenced blocks:
 – SQL
 – MD appending ## 0003 – RLS Helper Functions describing how Supabase injects JWT claims and how these helpers get used in policies; note the NULL-on-missing behavior.
```

## 04 — Core tenancy (no domains; path slugs) + updated_at trigger (+ trust copy, public directory, granular permissions)

Before generating, analyze the Tithi DB context pack and final design brief to ensure tenancy structure, path-based slug handling, and updated_at trigger match canonical rules.

Prompt:

```
Create infra/supabase/migrations/0004_core_tenancy.sql.
Create a generic updated_at auto-touch trigger once:
public.touch_updated_at() (plpgsql) that sets NEW.updated_at = now() on INSERT/UPDATE when an updated_at column exists.

[full original table definitions here]

Attach public.touch_updated_at() to all tables above that have updated_at.
Use transactions. No domains table (tenants resolved by slug in URL).
Output:
 – SQL
 – MD appending ## 0004 – Core Tenancy detailing path-based multitenancy under /b/{slug}, why we don't need a domains table, the global updated_at trigger, and the new fields (trust_copy_json, is_public_directory/public_blurb, permissions_json).
```

## 05 — Customers & resources (FKs + soft-delete pattern) (+ customer_metrics table)

Before generating, analyze the Tithi DB context pack and final design brief to ensure soft-delete patterns, first-time flag, and CRM denormalization match requirements.

Prompt:

```
Create infra/supabase/migrations/0005_customers_resources.sql:
[original definitions...]
Attach public.touch_updated_at() triggers.
Output:
 – SQL
 – MD appending ## 0005 – Customers & Resources explaining first-time flag and resource types, and why customer_metrics exists for fast CRM (app-managed, not DB-autoincrement).
```

## 06 — Services & service↔resource mapping (FKs + slugs)

Before generating, analyze the Tithi DB context pack and final design brief to ensure service mapping, slugs, and constraints follow canonical schema.

Prompt:

```
Create infra/supabase/migrations/0006_services.sql:
[original definitions...]
Attach public.touch_updated_at() on services.
Output:
 – SQL
 – MD appending ## 0006 – Services clarifying per-tenant slugs and mapping to staff/rooms.
```

## 07 — Availability (rules + exceptions) with time checks

Before generating, analyze the Tithi DB context pack and final design brief to ensure DOW ISO checks, minute bounds, and constraint logic match requirements.

Prompt:

```
Create infra/supabase/migrations/0007_availability.sql:
[original definitions...]
Attach public.touch_updated_at().
Output:
 – SQL
 – MD appending ## 0007 – Availability with how rules, exceptions, and bookings form 15-min slots.
```

## 08 — Bookings & booking_items + overlap + status sync (+ attendee_count, rescheduled_from)

Before generating, analyze the Tithi DB context pack and final design brief to ensure overlap exclusion, idempotency, booking_tz fill, and status precedence rules are enforced.

Prompt:

```
Create infra/supabase/migrations/0008_bookings.sql:
[original definitions...]
Attach public.touch_updated_at() to bookings and booking_items.
Output:
 – SQL
 – MD appending ## 0008 – Bookings explaining idempotency, no-overlap/status-sync logic, and why attendee_count + rescheduled_from are needed (capacity, pricing, audit).
```

## 09 — Payments & tenant_billing (enums + FKs) (+ cash/no-show fields)

Before generating, analyze the Tithi DB context pack and final design brief to ensure PCI boundaries, replay-safe uniqueness, and cash/no-show handling match requirements.

Prompt:

```
Create infra/supabase/migrations/0009_payments_billing.sql:
[original definitions...]
Attach public.touch_updated_at().
Output:
 – SQL
 – MD appending ## 0009 – Payments & Billing with PCI boundary notes (Stripe only), enum usage, and cash/no-show policy fields (SetupIntent link, consent flag, fee cents).
```

## 10 — Promotions (coupons, gift cards, referrals) with key checks

Before generating, analyze the Tithi DB context pack and final design brief to ensure coupon XOR, positive amount checks, non-negative balances, and no self-referrals are implemented exactly.

Prompt:

```
Create infra/supabase/migrations/0010_promotions.sql:
[original definitions...]
Attach public.touch_updated_at() on coupons/gift_cards.
Output:
 – SQL
 – MD appending ## 0010 – Promotions clarifying 3% new-customer royalty vs coupons/gift cards.
```

## 11 — Notifications (templates + queue) using enums

Before generating, analyze the Tithi DB context pack and final design brief to ensure event_code format checks, lookup seeding, and enums are implemented correctly.

Prompt:

```
Create infra/supabase/migrations/0011_notifications.sql:
[original definitions...]
Attach public.touch_updated_at() to both tables.
Output:
 – SQL
 – MD appending ## 0011 – Notifications covering preview/render + worker consumption and the new enums.
```

## 12 — Usage counters & quotas

Before generating, analyze the Tithi DB context pack and final design brief to ensure usage counters remain app-managed, quotas align with envelope enforcement, and retention logic is preserved.

Prompt:

```
Create infra/supabase/migrations/0012_usage_quotas.sql:
[original definitions...]
Attach public.touch_updated_at() on quotas.
Output:
 – SQL
 – MD appending ## 0012 – Usage & Quotas explaining monthly envelopes and enforcement points.
```

## 13 — Audit logs + generic trigger (FKs + BRIN) (+ events_outbox)

Before generating, analyze the Tithi DB context pack and final design brief to ensure audit log retention, purge function, GDPR anonymization, and outbox reliability match requirements.

Prompt:

```
Create infra/supabase/migrations/0013_audit_logs.sql:
[original definitions...]
Output:
 – SQL
 – MD appending ## 0013 – Audit Logs & Events Outbox noting 12-month retention and why outbox is better than scraping audit logs.
```

## 14 — Enable RLS on all tables

Before generating, analyze the Tithi DB context pack and final design brief to ensure RLS is deny-by-default and enabled on all applicable tables.

Prompt:

```
Create infra/supabase/migrations/0014_enable_rls.sql enabling RLS on every table created so far (including the new customer_metrics and events_outbox) with ALTER TABLE ... ENABLE ROW LEVEL SECURITY;. Wrap in a transaction.
Output:
 – SQL
 – MD appending ## 0014 – RLS Enabled with one paragraph on "deny by default".
```

## 15 — Standard tenant-scoped policies (+ DELETE) (include new tables)

Before generating, analyze the Tithi DB context pack and final design brief to ensure tenant-scoped policy predicates match helpers and follow fail-closed behavior.

Prompt:

```
Create infra/supabase/migrations/0015_policies_standard.sql adding four policies per table (list below) with CREATE POLICY IF NOT EXISTS:
[original definitions...]
Wrap in a transaction.
Output:
 – SQL
 – MD appending ## 0015 – Standard Policies with a short example query flow and note that DELETE is included, and that customer_metrics/events_outbox follow the same tenant-scoped pattern.
```

## 16 — Special policies (tenants, users, memberships, themes, tenant_billing, quotas) + DELETE & role gates

Before generating, analyze the Tithi DB context pack and final design brief to ensure all EXISTS subqueries, role gates, and self-access rules follow canonical special policy rules.

Prompt:

```
Create infra/supabase/migrations/0016_policies_special.sql:
[original definitions...]
All policies use the helper functions and explicit EXISTS subqueries. Wrap in a transaction.
Output:
 – SQL
 – MD appending ## 0016 – Special Policies summarizing admin vs staff capabilities and DELETE gates.
```

## 17 — Performance indexes (unchanged + practicals) (+ services category/active, reschedule & attendees)

Before generating, analyze the Tithi DB context pack and final design brief to ensure only approved indexes are created and align with performance guidelines.

Prompt:

```
Create infra/supabase/migrations/0017_indexes.sql adding CREATE INDEX IF NOT EXISTS:
[original definitions...]
Output:
 – SQL
 – MD appending ## 0017 – Index Pass with brief guidance on when to add trigram/fuzzy indexes and why category/active & reschedule/attendees indexes help the UX.
```

## 18 — Seed dev data (single tenant, resource, service)

Before generating, analyze the Tithi DB context pack and final design brief to ensure seed data follows the canonical development tenant pattern.

Prompt:

```
Create infra/supabase/migrations/0018_seed_dev.sql inserting:
[original definitions...]
Use ON CONFLICT DO NOTHING where appropriate. Wrap in transaction.
Output:
 – SQL
 – MD appending ## 0018 – Dev Seed with notes on local testing.
```

## 19 — Test scripts (pgTAP) for isolation & overlap

Before generating, analyze the Tithi DB context pack and final design brief to ensure test coverage includes isolation, overlap, status precedence, DOW/minute checks, booking_tz fill, coupon XOR, notification dedupe/retry, and payment idempotency.

Prompt:

```
Add two files under infra/supabase/tests/:
[original definitions...]
Output two fenced blocks, each beginning with a comment line showing the file path, and containing the full SQL of that test. Then output a third fenced MD block with the entire updated docs/DB_PROGRESS.md appending ## 0019 – Tests.
```

