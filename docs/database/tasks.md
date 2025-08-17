# Prompts

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

---

## Global Rules

**Migration Rule**  
All migrations are additive-only. No destructive changes (`DROP`, `ALTER COLUMN`, `DROP TABLE`, etc.) are permitted. If schema evolution is needed, executor must propose a safe additive pattern (new column/table/enum + backfill if required).

**Testing Rule**  
Executor must produce or extend pgTAP tests whenever invariants, constraints, or flows are introduced. Tests must verify isolation, overlap, RLS policies, enum validity, PCI boundaries, and fail-safe behavior.

**Indexing Rule**  
Only create indexes explicitly permitted in the Design Brief or Context Pack. No speculative or redundant indexes.

**Environment Rule**  
Seed data (Task 18) and any debug/dev-only constructs must be strictly isolated from production. All migrations must be production-safe by default.

**RLS Rule**  
All tables must have Row Level Security enabled, deny-by-default. Policies must be fail-closed, NULL-safe, and built on the standard helpers.

---

**Applies to all tasks 00–19:**  
Before generating, always load and align with the Design Brief, Context Pack, and Cheat Sheets.  
Resolve conflicts in this order: Design Brief > Context Pack > Cheat Sheets.  
If alignment fails or invariants conflict, executor must halt and surface the violation instead of generating output.


## 00 — Initialize DB folder + progress doc (no SQL)


Task:

```
You are writing repository files for the database. Create:
Folder infra/supabase/migrations/
 Folder docs/
 File docs/DB_PROGRESS.md with a title and a short "How to read this" section.
Output one fenced block containing the full contents of docs/DB_PROGRESS.md. Do not output anything else.
```

## 01 — Extensions (pgcrypto, citext, btree_gist, pg_trgm)


Task:

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
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0001 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0001 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0001 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0001 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 02 — Enum types (expanded)


Task:

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
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0002 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0002 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0002 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0002 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 03 — RLS helper functions (hardened)


Task:

```
Create infra/supabase/migrations/0003_helpers.sql with:
public.current_tenant_id() STABLE, SECURITY INVOKER, RETURNS uuid with RETURNS NULL ON NULL INPUT, implementation: ((auth.jwt() ->> 'tenant_id'))::uuid, but returns NULL if the claim is missing or not a valid UUID.


public.current_user_id() STABLE, SECURITY INVOKER, RETURNS uuid with RETURNS NULL ON NULL INPUT, implementation: ((auth.jwt() ->> 'sub'))::uuid, returning NULL if absent/invalid.


Use CREATE OR REPLACE FUNCTION and wrap in a transaction.
Output two fenced blocks:
 – SQL
 – MD appending ## 0003 – RLS Helper Functions describing how Supabase injects JWT claims and how these helpers get used in policies; note the NULL-on-missing behavior.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0003 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0003 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0003 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0003 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 04 — Core tenancy (no domains; path slugs) + updated_at trigger (+ trust copy, public directory, granular permissions)


Task:

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
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0004 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0004 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0004 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0004 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 05 — Customers & resources (FKs + soft-delete pattern) (+ customer_metrics table)


Task:

```
Create infra/supabase/migrations/0005_customers_resources.sql:
[original definitions...]
Attach public.touch_updated_at() triggers.
Output:
 – SQL
 – MD appending ## 0005 – Customers & Resources explaining first-time flag and resource types, and why customer_metrics exists for fast CRM (app-managed, not DB-autoincrement).
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0005 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0005 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0005 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0005 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 06 — Services & service↔resource mapping (FKs + slugs)


Task:

```
Create infra/supabase/migrations/0006_services.sql:
[original definitions...]
Attach public.touch_updated_at() on services.
Output:
 – SQL
 – MD appending ## 0006 – Services clarifying per-tenant slugs and mapping to staff/rooms.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0006 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0006 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0006 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0006 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 07 — Availability (rules + exceptions) with time checks


Task:

```
Create infra/supabase/migrations/0007_availability.sql:
[original definitions...]
Attach public.touch_updated_at().
Output:
 – SQL
 – MD appending ## 0007 – Availability with how rules, exceptions, and bookings form 15-min slots.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0007 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0007 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0007 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0007 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 08 — Bookings & booking_items + overlap + status sync (+ attendee_count, rescheduled_from)


Task:

```
Create infra/supabase/migrations/0008_bookings.sql:
[original definitions...]
Attach public.touch_updated_at() to bookings and booking_items.
Output:
 – SQL
 – MD appending ## 0008 – Bookings explaining idempotency, no-overlap/status-sync logic, and why attendee_count + rescheduled_from are needed (capacity, pricing, audit).
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0008 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0008 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0008 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0008 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 09 — Payments & tenant_billing (enums + FKs) (+ cash/no-show fields)


Task:

```
Create infra/supabase/migrations/0009_payments_billing.sql:
[original definitions...]
Attach public.touch_updated_at().
Output:
 – SQL
 – MD appending ## 0009 – Payments & Billing with PCI boundary notes (Stripe only), enum usage, and cash/no-show policy fields (SetupIntent link, consent flag, fee cents).
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0009 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0009 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0009 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0009 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 10 — Promotions (coupons, gift cards, referrals) with key checks


Task:

```
Create infra/supabase/migrations/0010_promotions.sql:
[original definitions...]
Attach public.touch_updated_at() on coupons/gift_cards.
Output:
 – SQL
 – MD appending ## 0010 – Promotions clarifying 3% new-customer royalty vs coupons/gift cards.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0010 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0010 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0010 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0010 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 11 — Notifications (templates + queue) using enums


Task:

```
Create infra/supabase/migrations/0011_notifications.sql:
[original definitions...]
Attach public.touch_updated_at() to both tables.
Output:
 – SQL
 – MD appending ## 0011 – Notifications covering preview/render + worker consumption and the new enums.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0011 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0011 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0011 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0011 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 12 — Usage counters & quotas


Task:

```
Create infra/supabase/migrations/0012_usage_quotas.sql:
[original definitions...]
Attach public.touch_updated_at() on quotas.
Output:
 – SQL
 – MD appending ## 0012 – Usage & Quotas explaining monthly envelopes and enforcement points.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0012 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0012 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0012 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0012 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 13 — Audit logs + generic trigger (FKs + BRIN) (+ events_outbox)


Task:

```
Create infra/supabase/migrations/0013_audit_logs.sql:
[original definitions...]
Output:
 – SQL
 – MD appending ## 0013 – Audit Logs & Events Outbox noting 12-month retention and why outbox is better than scraping audit logs.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0013 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0013 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0013 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0013 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 14 — Enable RLS on all tables


Task:

```
Create infra/supabase/migrations/0014_enable_rls.sql enabling RLS on every table created so far (including the new customer_metrics and events_outbox) with ALTER TABLE ... ENABLE ROW LEVEL SECURITY;. Wrap in a transaction.
Output:
 – SQL
 – MD appending ## 0014 – RLS Enabled with one paragraph on "deny by default".
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0014 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0014 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0014 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0014 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 15 — Standard tenant-scoped policies (+ DELETE) (include new tables)


Task:

```
Create infra/supabase/migrations/0015_policies_standard.sql adding four policies per table (list below) with CREATE POLICY IF NOT EXISTS:
[original definitions...]
Wrap in a transaction.
Output:
 – SQL
 – MD appending ## 0015 – Standard Policies with a short example query flow and note that DELETE is included, and that customer_metrics/events_outbox follow the same tenant-scoped pattern.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0015 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0015 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0015 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0015 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 16 — Special policies (tenants, users, memberships, themes, tenant_billing, quotas) + DELETE & role gates


Task:

```
Create infra/supabase/migrations/0016_policies_special.sql:
[original definitions...]
All policies use the helper functions and explicit EXISTS subqueries. Wrap in a transaction.
Output:
 – SQL
 – MD appending ## 0016 – Special Policies summarizing admin vs staff capabilities and DELETE gates.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0016 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0016 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0016 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0016 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 17 — Performance indexes (unchanged + practicals) (+ services category/active, reschedule & attendees)


Task:

```
Create infra/supabase/migrations/0017_indexes.sql adding CREATE INDEX IF NOT EXISTS:
[original definitions...]
Output:
 – SQL
 – MD appending ## 0017 – Index Pass with brief guidance on when to add trigram/fuzzy indexes and why category/active & reschedule/attendees indexes help the UX.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0017 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0017 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0017 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0017 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 18 — Seed dev data (single tenant, resource, service)


Task:

```
Create infra/supabase/migrations/0018_seed_dev.sql inserting:
[original definitions...]
Use ON CONFLICT DO NOTHING where appropriate. Wrap in transaction.
Output:
 – SQL
 – MD appending ## 0018 – Dev Seed with notes on local testing.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0018 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0018 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0018 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0018 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
```

## 19 — Test scripts (pgTAP) for isolation & overlap


Task:

```
Add two files under infra/supabase/tests/:
[original definitions...]
Output two fenced blocks, each beginning with a comment line showing the file path, and containing the full SQL of that test. Then output a third fenced MD block with the entire updated docs/DB_PROGRESS.md appending ## 0019 – Tests.
Also append three fenced Markdown blocks:

1) Append to docs/canon/interfaces.md:
       - Add section "### P0019 — Interfaces"
       - Bullet any new interfaces created in this task.
       - End with "Count: X".

2) Append to docs/canon/constraints.md:
       - Add section "### P0019 — Constraints"
       - Bullet any new constraints created in this task.
       - End with "Count: Y".

3) Append to docs/canon/critical_flows.md:
       - Add section "### P0019 — Critical Flows"
       - Bullet any new critical flows or triggers created in this task.
       - End with "Count: Z".

In docs/DB_PROGRESS.md, under this prompt, also add:
"Canon updates for P0019 → interfaces: X, constraints: Y, flows: Z".

IMPORTANT: Before adding bullets, consult the example coverage lists in the Context Pack 
(interfaces, constraints, critical flows). 
Use those examples as guidance to decide what counts, so you don’t miss anything.
