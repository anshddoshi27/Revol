# Backend Build Blueprint (Modular, Robust, Supabase/Postgres)

## Guiding Principles
- **RLS-first security**: Deny-by-default with policies from migrations 0014–0016; every query is tenant-scoped.
- **Idempotent, deterministic writes**: Use database uniqueness/idempotency keys (e.g., `(tenant_id, client_generated_id)` for `bookings`).
- **Clean modular boundaries**: Domain modules map 1:1 to schema areas and business capabilities.
- **Contracts before code**: OpenAPI schema and typed SDKs for the frontend.
- **Observability-by-default**: Structured logs, metrics, traces, audit hooks.
- **Minimal backend logic where DB enforces invariants**: Let constraints/triggers handle correctness; keep services thin.

## Architecture Overview
- **API layer**: Fastify/NestJS (TypeScript) or Supabase Edge Functions as entrypoints.
- **Application services**: Orchestrate transactions, validate inputs, call domain repositories.
- **Domain modules**: Encapsulate business rules per capability (see Modules below).
- **Data access**: Kysely/Drizzle SQL builder or Supabase client; all calls RLS-scoped.
- **Background jobs**: BullMQ/Cloud Tasks for async work (notifications, audit purge, metrics backfills).
- **Eventing**: DB outbox (`events_outbox`) → worker dispatch → external providers.
- **Config**: Typed environment config, secrets via platform vault.

Recommended repo structure (monorepo or service):
```
backend/
  src/
    api/            # http handlers, routers, OpenAPI adapters
    app/            # application services (use-cases)
    domain/         # entities, policies, value objects, ports
    infra/          # db, queues, providers, telemetry, config
    modules/
      tenancy/
      users/
      memberships/
      themes/
      customers/
      resources/
      services/
      availability/
      bookings/
      payments/
      promotions/
      notifications/
      quotas/
      audit/
      events/
  test/
  openapi/
```

Routing conventions:
- Public tenant routes: `/b/{tenantSlug}/...`
- Admin routes (authenticated): `/api/tenants/{tenantId}/...`
- Versioning: `/v1/...` on all API routes.

## Cross-Cutting Concerns
- **Authentication**: Supabase Auth JWT. Include custom claims: `tenant_id`, roles. Verify JWT, extract `user_id`, `tenant_id`.
- **RLS context**: All queries run under JWT with claims; policies rely on `public.current_tenant_id()`/`public.current_user_id()` helpers.
- **Validation**: zod/yup for inputs; map to DB constraints for consistent errors.
- **Error model**: Problem+JSON `{ type, title, detail, fieldErrors, code }` with stable `code`s.
- **Pagination & filtering**: Keyset pagination by `(created_at, id)`, common filters on indexed columns.
- **Idempotency**: For create/update where supported by DB unique keys (e.g., `bookings`, `payments`).
- **Rate limiting**: Token bucket per user/tenant; backpressure on hot endpoints.
- **Telemetry**: pino logs with request ids; OpenTelemetry traces; metrics (histograms, counters).
- **Secrets/config**: Dotenv for local; cloud secrets in prod; typed configuration loader.
- **Migrations**: Use existing `infra/supabase/migrations` only; no ad-hoc schema drift.

## Modules (Responsibilities, APIs, DB Alignment)
Below, each module lists responsibilities, representative APIs, and how the DB enforces rules. All tables, enums, constraints, and triggers reference the canonical migrations (0001–0019) and canon docs.

### 1) Tenancy & Themes
- **DB**: `tenants`, `themes` (1:1), partial unique `slug`, soft delete.
- **APIs**:
  - GET `/v1/b/{slug}` → tenant+theme for public landing.
  - GET `/v1/tenants/{id}` (member only).
  - PATCH `/v1/tenants/{id}` (owner/admin): branding, billing JSON.
- **Enforcement**: RLS special policies (0016). `themes` writable by owner/admin only.

### 2) Users & Memberships
- **DB**: Global `users`, `memberships(role, permissions_json)`.
- **APIs**:
  - GET `/v1/me` → user + memberships.
  - POST `/v1/tenants/{tenantId}/memberships` (owner/admin) → invite/add.
  - PATCH `/v1/tenants/{tenantId}/memberships/{id}` → change role/permissions.
- **Enforcement**: Role checks in app; RLS grants per 0016 policies.

### 3) Customers & CRM
- **DB**: `customers`, `customer_metrics` (denormalized rollups), soft delete, unique `(tenant_id, LOWER(email))`.
- **APIs**:
  - GET `/v1/tenants/{tenantId}/customers` (filters: email, name; pagination).
  - POST `/v1/tenants/{tenantId}/customers` → create (first-time flag).
  - GET `/v1/tenants/{tenantId}/customers/{id}` with metrics.
- **Enforcement**: Checks for email uniqueness, soft-delete awareness; metrics maintained by jobs or triggers as designed.

### 4) Resources (Staff/Rooms)
- **DB**: `resources(type enum, tz, capacity, metadata)`.
- **APIs**:
  - CRUD resources; list by type; availability lookups join with rules/exceptions.
- **Enforcement**: Capacity >= 1; TZ defaults; tenant scoping.

### 5) Services & Mapping
- **DB**: `services` (+ `service_resources`), unique `(tenant_id, slug)`, price in cents, duration in minutes.
- **APIs**:
  - CRUD services; attach resources; list by category.
- **Enforcement**: Non-negative price, positive duration, buffers; soft-delete.

### 6) Availability
- **DB**: `availability_rules` (ISO DOW 1–7, minutes), `availability_exceptions` (closures/windows, unique key across date/range).
- **APIs**:
  - POST rules, POST exceptions, GET merged view for a date range.
- **Enforcement**: Checks on DOW/minute bounds; schema supports 15-min slot generation logic in app.

### 7) Bookings
- **DB**: `bookings` (+ `booking_items`), `booking_tz` fill trigger, status sync trigger, GiST exclusion on active statuses, idempotency `(tenant_id, client_generated_id)`.
- **APIs**:
  - POST create booking (idempotent).
  - PATCH status transitions (cancel, check-in, complete, no-show).
  - GET calendars by resource, by customer; reschedule with `rescheduled_from` linking.
- **Enforcement**: Overlap prevention via exclusion; `start_at < end_at`; deterministic status precedence (Design Brief §5).

### 8) Payments & Billing
- **DB**: `payments`, `tenant_billing`, enums for `payment_status`, provider/idempotency unique partials.
- **APIs**:
  - POST intent (create authorized); POST capture/refund; GET list; webhook intake.
- **Enforcement**: Replay-safe via unique `(tenant_id, provider, provider_payment_id)` and `(tenant_id, provider, idempotency_key)`; PCI isolation at table boundary.

### 9) Promotions (Coupons, Gift Cards, Referrals)
- **DB**: `coupons` (XOR checks), `gift_cards` (non-negative, unique code), `referrals` (no self-referrals, unique code/pairs).
- **APIs**:
  - Coupons: CRUD, apply/validate.
  - Gift cards: issue, redeem, balance lookup. (Transaction history deferred to v2.)
  - Referrals: issue code, redeem, stats.
- **Enforcement**: CHECKs: XOR on coupons, non-negative balances, referral uniqueness and self-ban.

### 10) Notifications
- **DB**: `notification_event_type` (seeded), `notification_templates`, `notifications`.
- **APIs**:
  - Templates: CRUD; send test.
  - Notifications: enqueue (app), worker dispatch to provider; status updates.
- **Enforcement**: Enums `notification_channel/status`; valid `event_code` format and FK.

### 11) Usage & Quotas
- **DB**: `usage_counters`, `quotas`.
- **APIs**:
  - Quotas: set/update per tenant; counters: read/report.
- **Enforcement**: No auto-increment triggers; increments via app/jobs to preserve idempotency.

### 12) Audit & Events
- **DB**: `audit_logs` (triggers on key tables), `events_outbox`, `webhook_events_inbox`.
- **APIs**:
  - Audit: read streams (admin scoped).
  - Events: poll/consume outbox; webhook intake with signature verification.
- **Enforcement**: Purge function (12-month retention); indexes for efficient reads.

## API Design (Contract-First)
- **OpenAPI v3**: Define all routes, request/response schemas, error codes.
- **Typed SDK**: Generate TypeScript client for the frontend.
- **Path patterns**: Public `/v1/b/{slug}/...`; Authenticated `/v1/tenants/{tenantId}/...`.
- **Versioning**: `/v1` frozen contracts; additive changes only.

## Data Access Strategy
- Prefer parameterized SQL via Kysely/Drizzle over ORM magic.
- Use RLS with JWT; no service superuser in normal flows.
- Transactions for multi-step writes (e.g., booking + payment intent).
- Leverage DB constraints to simplify application code; handle violations to UX-friendly errors.

## Background Jobs & Scheduling
- **Queue**: BullMQ + Redis.
- **Jobs**:
  - Notification dispatch and retries.
  - Audit purge (or via pg_cron as per Design Brief).
  - Metrics rollups/backfills.
  - Reminders (24h/2h/1h) using `notification_event_type` schedule.
- **Idempotency**: Use stable job keys for retries.

## Observability & Operations
- **Logging**: Request-scoped correlation ids; redact PII.
- **Tracing**: OTEL instrumentation across API, DB, queue, providers.
- **Metrics**: p95 latencies per route, job success/fail counts, DB error rates.
- **SLOs**: Define per capability (e.g., booking create < 300ms p95, email dispatch < 1m).

## Security
- **JWT verification** with key rotation.
- **Least-privilege** DB roles; per-env service roles for migrations only.
- **Input sanitization** and output encoding.
- **Webhooks**: HMAC signatures per provider.
- **Secrets**: Never in logs; scoped runtime access.

## Testing Strategy
- **Unit**: Domain services with in-memory fakes.
- **Integration**: Against Supabase local with RLS on; seed from `0018_seed_dev.sql`.
- **pgTAP**: Use provided suites in `infra/supabase/tests` (0019) as DB contract.
- **Contract tests**: OpenAPI response validation with Dredd/Prism.
- **E2E**: Booking flow, payment happy-path, overlap rejection, RLS isolation.

## Delivery Plan (Phased)
1. Scaffold API, config, logging, OpenAPI, health checks.
2. Implement Tenancy/Auth plumbing; smoke test RLS context.
3. Ship Services, Resources, Availability modules.
4. Implement Bookings (idempotent create, status transitions, overlap handling).
5. Add Customers/CRM; expose metrics read-only first.
6. Add Promotions (coupons, gift cards basic) and Payments intents.
7. Add Notifications module + worker; wire booking events.
8. Add Usage/Quotas enforcement; admin controls.
9. Observability hardening, rate limiting, security reviews.
10. Complete test suites, load tests, and cut v1 stable API.

## Concrete Deliverables
- Running service with `/v1` routes and OpenAPI spec.
- Typed SDK consumed by `tithi lovable` frontend.
- Background worker with queue; dashboards for jobs.
- CI/CD: lint, typecheck, tests, DB tests, OpenAPI diff guard.
- Runbooks: on-call, incident playbooks, rollback guides.

## Alignment With V2 Deferrals
- Removed from v1 scope: service bundles/deals; service images/ratings UI; specialist selection; gift card transaction history. Core gift card issue/redeem/balance remain.
- The database fully supports all remaining frontend flows per `frontend_database_alignment_analysis.md` with RLS and constraints enforcing correctness.

---
This blueprint aligns with the Design Brief and canonical migrations. It leverages database-enforced rules to keep the backend modular, thin, and robust while providing the infrastructure needed for scale, security, and observability.
