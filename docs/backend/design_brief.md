# Tithi Backend — Master Design Brief (FINAL — exhaustive)

> **IMPORTANT**: I re-read the full backend plan, the database spec, and the Tithi instructions line-by-line and merged every requirement from those sources plus the rubric. This is the final single-source-of-truth design brief for the backend. It contains the North-Star principles, full architecture, data model highlights, every module (with user stories, data needs, APIs, permissions, and edge cases), NFRs, testing, CI/CD, deployment, observability, admin UX guarantees, quotas, GDPR/PCI requirements, and an ordered implementation roadmap with micro-ticket templates. You can paste this into design-brief.md and start breaking each module into atomic prompts/tasks.

## 1. Project Overview

### What Tithi is

Tithi is an end-to-end, white-labeled booking and business management platform for service-based businesses (salons, clinics, studios, trainers, etc.). Each tenant (business) gets a branded public booking page (subdomain like business.tithi.com or a custom domain) and an admin dashboard. Customers booking services see only the tenant's brand unless the tenant opts to show Tithi.

### Primary business goals

- Enable businesses to launch a branded booking system in minutes.
- Replace disparate tools with one integrated system (booking, CRM, payments, notifications, analytics).
- Automate policy enforcement (cancellations, no-shows) and payments.
- Improve retention with reminders, loyalty, and targeted promotions.
- Scale multi-tenant operations with strong isolation, auditability, and observability.

### Target users

- **Business owners / Admins**: onboarding, branding, staff and schedule management, analytics, payouts.
- **Staff**: schedules, availability, booking management.
- **Customers**: book services, pay, receive reminders, save preferences.
- **Tithi Platform Operators**: manage infra, quotas, observability, support.

### Core philosophy

- **Multi-tenant by construction**: shared schema, every data row includes tenant_id (UUID), enforced by RLS.
- **API-first BFF**: Frontends talk only to Flask BFF endpoints; no direct browser DB reads (except auth flow where Supabase is used).
- **Extreme modularity**: Each feature is implemented as a self-contained backend blueprint + frontend feature folder.
- **White-labeling**: tenant themes, custom domains, runtime CSS tokens; customers should perceive the tenant brand as independent.
- **Determinism over cleverness**: constraints and schema enforce invariants; avoid ad-hoc client state logic.
- **Trust & Compliance**: GDPR, PCI minimization (Stripe), explicit consent for communications.
- **Observability & Safety**: Audit trails, structured logs, Sentry, rate limits, idempotency, outbox/inbox design for reliable side effects.
- **Execution Discipline**: Frozen interfaces, contract tests, micro-tickets, feature flags, and rollback-ready releases.

## 2. Backend Purpose

The backend provides:

- Authentication/authorization and tenant resolution.
- All business logic for onboarding, scheduling, booking lifecycle, payments, promotions, notifications, analytics, and admin operations.
- Database contracts, RLS enforcement, migrations, and event reliability (outbox).
- Integration with external providers: Stripe, Twilio, SendGrid, Google Calendar, Supabase Storage.
- Observability, operational tooling, quotas, audit logs, and CI/CD gating.

## 3. Tech Stack & Rationale

- **Python 3.11+**: modern language features, performance.
- **Flask 3 + Flask-Smorest**: modular blueprint pattern and OpenAPI generation.
- **SQLAlchemy 2.x (sync) + psycopg3**: typed DB interactions and efficient Postgres access.
- **Postgres (Supabase)**: RLS, extensions, managed Postgres experience.
- **Redis**: caching, locks, pub/sub for real-time and distributed locks.
- **Celery (or equivalent worker)**: background jobs, scheduled tasks (reminders), retries.
- **Socket.IO / Flask-SocketIO**: real-time subscriptions (availability, bookings).
- **Pydantic v2**: DTOs driving OpenAPI, contract tests and typed validation.
- **Stripe**: payments, SetupIntents for authorizations (no-show fees), Stripe Connect for tenant payouts.
- **Twilio & SendGrid**: SMS and email channels.
- **Sentry + structlog + Prometheus/Grafana**: error tracking, structured logs, metrics.
- **pgTAP**: DB-level tests for RLS & constraints (run in CI).
- **Supabase Storage/CDN**: tenant assets.
- **Docker, Terraform/Simple infra scripts**: reproducible deployments.

## 4. High-Level Architecture

```
Frontend (tenant UI / admin UI / public booking page)
→ Flask BFF (blueprints + OpenAPI)
→ Postgres (RLS) + Redis + Celery
→ External providers (Stripe, Twilio, SendGrid, Google APIs, Supabase Storage)
```

### Key infra patterns:

- **Outbox / Inbox**: write events to events_outbox for reliable background delivery to external systems.
- **Idempotency**: payments/bookings use client_generated_id + DB partial unique indexes.
- **GiST exclusion**: bookings use tstzrange & GiST exclude constraints to prevent overlapping bookings.
- **Rate limiting**: apply token bucket per IP, per user, per tenant.
- **Feature flags**: feature.<key> gating in config/DB for rollouts.
- **Health endpoints**: /health/live and /health/ready.

## 5. Authentication, Tenancy & RBAC

### Auth

- Integrate Supabase Auth: validate JWTs via JWKS; support rotation.
- Required JWT claims: tenant_id: UUID, roles: [owner|admin|staff|viewer], sub (user_id).
- Flask middleware verifies and injects current_user, current_tenant, roles.

### Tenancy resolution

- Primary: path-based GET /v1/b/{slug} and host-based GET /api/resolve-tenant?host=...
- Tenant object returns theme, wording, assets, feature_flags.

### RBAC + RLS

- Route-level decorators for role checks.
- RLS policies in Postgres using current_setting('request.jwt.claims', true) or request.jwt.claims.tenant_id.
- All writes must pass WITH CHECK policies ensuring tenant_id equality.
- Owners have billing & admin-level APIs; staff only relevant staff-scoped routes.

## 6. Error Model & API Versioning

- Use Problem+JSON error model with stable error codes: { type, title, detail, status, code, fieldErrors }.
- Error codes should be namespaced: TITHI_{MODULE}_{SHORTCODE} (ex: TITHI_BOOKING_OVERLAP).
- API versioning: /v1/... default; breaking changes require /v2/....
- Validation errors return 400 with fieldErrors array.

## 7. Database Design (summary + critical constraints)

### Extensions required

- pgcrypto, citext, pg_trgm, btree_gist.

### Core tables (high-level)

- **tenants** — id, slug, timezone, billing_json, created_at, deleted_at
- **users** — id, display_name, primary_email, avatar_url, created_at
- **memberships** — id, tenant_id, user_id, role, permissions_json
- **tenant_themes** — id, tenant_id, version, status (draft/published), tokens_json, created_by
- **customers** — id, tenant_id, display_name, email, phone, marketing_opt_in, created_at
- **resources** — id, tenant_id, type (staff/room), name, capacity
- **services** — id, tenant_id, slug, name, duration_min, price_cents, buffer_before_min, buffer_after_min
- **staff_profiles** — id, tenant_id, membership_id, resource_id, hourly_rate_cents, specialties
- **work_schedules** — id, staff_profile_id, schedule_type, rrule, work_hours
- **availability_rules, availability_exceptions**
- **bookings** — id, tenant_id, customer_id, start_at, end_at, status, client_generated_id, service_snapshot
- **booking_items**
- **payments** — id, tenant_id, booking_id, status, provider, provider_payment_id, amount_cents, idempotency_key, no_show_fee
- **payment_methods**
- **coupons, gift_cards, referrals**
- **notification_templates, notifications**
- **analytics_events, usage_counters, quotas**
- **events_outbox, webhook_events_inbox**
- **audit_logs** — record_id, table_name, old_data, new_data, user_id, action, created_at

### Critical DB constraints & indexes

- Composite indexes on (tenant_id, created_at) and (tenant_id, start_ts) for time series.
- Uniqueness per tenant: (tenant_id, code) for coupons, gift cards, referrals.
- Idempotency uniqueness: partial unique (tenant_id, client_generated_id) where not null.
- Provider replay safety: unique (tenant_id, provider, provider_payment_id).
- GiST exclusion constraint to prevent overlapping bookings per resource: EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at, end_at) WITH &&) WHERE (status IN ('confirmed','held')).
- Text indexes for full-text search on customers & services (pg_trgm).

### DB helper functions

- public.current_tenant_id() and public.current_user_id() wrappers for RLS.

### DB tests

- pgTAP suites to validate RLS, exclusion constraints, idempotency, and quotas.

## 8. Core Modules — full details

For each module below I include: short description, user stories (representative), required tables/fields, core API endpoints (CRUD + special operations), permissions, edge cases & acceptance criteria.

### Module A — Foundation Setup & Execution Discipline (global)

**Description**: foundational infra, engineering rules, observability, and governance that every developer must follow.

**Key deliverables / enforcement**:
- App factory, config management, health endpoints, logging middleware (request-id), structured logs including tenant_id and user_id redaction rules.
- **Execution Context Rule**: before any implementation, the team must consult:
  - This Master Design Brief
  - DB Migrations Report
  - Frozen interfaces (Pydantic + TypeScript DTOs)
  - Micro-tickets created from the brief
- Frozen interfaces: DTOs are the contract — changes must update OpenAPI and run contract tests.
- Definition of Done checklist must be attached to PRs.

**APIs / Endpoints**: N/A (governance)

**Permissions**: N/A

**Edge cases & Acceptance**: CI must fail on interface drift, missing tests, or failing pgTAP.

### Module B — Auth & Tenancy

**Description**: Supabase JWT validation, tenant resolution, invite flow, membership management.

**User stories**: Invite staff; owner resolves branding; staff login and only see tenant data.

**Tables**: users, memberships, tenants, tenant_themes.

**APIs**:
- POST /auth/login (delegates to Supabase; validate JWT)
- POST /auth/invite — creates invite token (tenant_id, role)
- POST /auth/invite/accept — accept invite and create membership
- GET /api/resolve-tenant?slug=...|host=...
- GET /v1/b/{slug} — public tenant bootstrap (theme + services + wording)

**Permissions**: Owners only create invites; invite acceptance available to recipients.

**Edge cases**: expired invites, invite token reuse, membership role changes, revoked JWTs — all audited.

**Acceptance**: RLS policies in place that constrain memberships and users to tenant scope; invite flow tested end-to-end.

### Module C — Onboarding & Branding (white-label)

**Description**: business creation wizard (name, type, address, phone, logo, theme, policy, Stripe set-up), custom domains, and theme publishing.

**User stories**: Onboard in <10 minutes, edit branding, publish theme.

**Tables**: tenants, tenant_themes, tenant_billing, audit_logs.

**APIs**:
- POST /v1/tenants — create tenant + subdomain auto-generation
- PUT /v1/tenants/{id}/branding — upload logo, colors, fonts (signed URLs storage)
- POST /v1/tenants/{id}/themes — create versioned theme (draft)
- POST /v1/tenants/{id}/themes/{id}/publish — set published theme
- POST /api/resolve-tenant?host=...
- POST /v1/tenants/{id}/domain — connect custom domain (verify DNS, provision SSL)

**Permissions**: Tenant owner & admins.

**Edge cases**: domain conflicts, SSL provisioning failures, theme preview isolation for unpublished themes.

**Acceptance**: theme preview sandbox endpoint returns preview safely without affecting published site. Asset URLs are signed and expire.

### Module D — Services & Catalog

**Description**: define services, durations, pricing, buffers, categories, and which resources/staff can provide them.

**User stories**: create services, display them on public booking page.

**Tables**: services, service_resources, categories.

**APIs**:
- GET /v1/tenants/{tenantId}/services
- POST /v1/tenants/{tenantId}/services
- PUT /v1/tenants/{tenantId}/services/{id}
- DELETE /v1/tenants/{tenantId}/services/{id}
- POST /v1/tenants/{tenantId}/services/bulk-update

**Permissions**: tenant owner/admin.

**Edge cases**: service deleted with active bookings — restrict delete (soft delete + mark archived & notify bookings team). Seasonal pricing overrides.

**Acceptance**: services visible on public /v1/b/{slug}/services and include service snapshot saved on booking.

### Module E — Staff & Work Schedules

**Description**: staff profiles, specialties, commissions, work schedules (RRULE), time off overrides.

**User stories**: create staff, set weekly availability, approve time off.

**Tables**: staff_profiles, work_schedules, staff_assignment_history.

**APIs**:
- GET /v1/tenants/{tenantId}/staff
- POST /v1/tenants/{tenantId}/staff
- PUT /v1/tenants/{tenantId}/staff/{id}
- POST /v1/tenants/{tenantId}/staff/{id}/schedule
- POST /v1/tenants/{tenantId}/staff/{id}/schedule/override

**Permissions**: owners/admins.

**Edge cases**: overlapping schedules, staff deleted while bookings exist — on offboarding reassign or notify.

**Acceptance**: Google Calendar two-way sync option with OAuth and conflict resolution.

### Module F — Availability & Scheduling Engine

**Description**: compute availability from recurring rules, exceptions, resource calendars, buffer times, capacity, and constraints.

**User stories**: display available slots in tenant timezone, respect buffer times, join waitlist.

**Tables**: availability_rules, availability_exceptions, work_schedules, bookings.

**APIs**:
- GET /api/availability?service_id=&date_from=&date_to=&resource_id=&tz=
- POST /api/availability/hold — hold a slot for short time (idempotent)
- POST /api/availability/release — release hold
- POST /api/availability/waitlist — join waitlist

**Mechanics & Constraints**:
- RRULE support for recurring patterns.
- Buffer times: before/after in minutes stored on service.
- Holds: short TTL (e.g., 5–10 minutes), stored with idempotency and automatic release via Celery.
- GiST exclusion to prevent confirmed/held overlaps.

**Edge cases**: DST transitions, timezone conversions, simultaneous holds, race conditions — require distributed locks (Redis) + DB exclusion constraint.

**Acceptance**: availability API returns accurate, deterministic slots given same inputs; hold API returns TTL and idempotent.

### Module G — Booking Lifecycle

**Description**: bookings creation, confirmation, cancel/reschedule flows, no-show handling, group bookings, add-ons.

**User stories**: book service, get confirmation, admin reschedule.

**Tables**: bookings, booking_items, booking_history (audit), events_outbox.

**APIs**:
- POST /api/bookings — create booking (client_generated_id supported)
- GET /api/bookings/{id}
- POST /api/bookings/{id}/confirm
- POST /api/bookings/{id}/cancel
- POST /api/bookings/{id}/reschedule
- POST /api/bookings/{id}/no-show — mark as no-show, trigger no-show fees

**Permissions**: customers create bookings; admins/owners manage all bookings.

**Edge cases**:
- Overlapping bookings (prevention via DB constraints and availability checks).
- Late cancellations: apply tenant cancellation policy.
- No-shows: charge via Stripe SetupIntent if authorized.
- Partial failures (payment success but notification fails) must be retried via outbox.
- Reschedule to slot later validated against availability.

**Acceptance**: bookings are atomic and idempotent; all booking events are emitted to outbox for notifications and analytics.

### Module H — Payments & Billing

**Description**: handle payment intents, captures, refunds, setup intents for authorizations (no-show fees), Stripe Connect for tenant payouts, gift cards, coupons.

**User stories**: accept card payment, hold card for cash payment, auto-enforce no-show fees.

**Tables**: payments, payment_methods, tenant_billing, gift_cards.

**APIs**:
- POST /api/payments/intent — create payment intent (client side uses Stripe)
- POST /api/payments/confirm — confirm payment intent
- POST /api/payments/refund
- POST /api/payments/setup-intent — SetupIntent to authorize a card
- POST /api/payments/capture-no-show — capture no-show fee (idempotent)
- POST /api/gift-cards/redeem
- POST /api/coupons/validate

**Mechanics**:
- Support Apple Pay, Google Pay, PayPal.
- Support cash bookings with SetupIntent authorization and potential capture on no-show (tenant configurable).
- Stripe Connect: tenant_billing includes stripe_connect_id for direct payouts (optional).
- Payment idempotency via idempotency_key and verification of provider IDs.

**Edge cases**:
- Payment provider webhooks (Stripe) must be processed idempotently and validated (signature).
- Failed card at capture must notify admin and retry policy applied.
- Partial refunds and tip handling.
- Provider replay protection.

**Acceptance**: payments are reconciled; refunds work and no-show charges are auditable.

### Module I — Promotions & Gift Cards

**Description**: coupons, gift cards, referrals, promotions engine with conditional rules and A/B testing.

**User stories**: create promo codes, apply discount at checkout, track referral reward.

**Tables**: coupons, gift_cards, referrals, promotion_variants, ab_tests.

**APIs**:
- POST /v1/tenants/{tenantId}/promotions
- POST /v1/tenants/{tenantId}/promotions/{id}/validate
- POST /v1/tenants/{tenantId}/promotions/{id}/apply
- POST /v1/tenants/{tenantId}/promotions/ab-tests

**Mechanics**:
- Conditional logic: min amount, service applicability, per-customer usage limit.
- Coupon stacking rules with deterministic precedence.
- Referral code issuance and reward distribution (wallet/gift card or credit).
- A/B testing: random assignment within tenant, statistical tracking, significance checks.

**Edge cases**: coupon expiry, simultaneous redemption, fraud detection.

**Acceptance**: analytics report on promotion performance, A/B test tooling shows significance results.

### Module J — Notifications & Messaging

**Description**: tenant-specific templates and scheduling for email and SMS notifications. Delivery via Twilio (SMS) and SendGrid (email).

**User stories**: confirmation after booking, SMS reminders 24h & 1h, follow-ups for review.

**Tables**: notification_templates, notifications, notification_event_type.

**APIs**:
- POST /v1/tenants/{tenantId}/notification-templates
- POST /v1/tenants/{tenantId}/notifications/send — enqueue manual sends
- System triggers to enqueue notifications for booking events into notifications table (outbox via Celery)

**Mechanics**:
- Template variables with autocomplete (e.g., {customer_name}, {start_time}).
- Template versioning and rollback.
- Multi-language templates.
- Deduplication (dedupe_key) to prevent duplicate sends.
- Retry policy with exponential backoff in Celery; failure notifications to admin.

**Edge cases**: SMS opt-out/consent management, failed provider delivery, rate limits by provider.

**Acceptance**: reminders are delivered within SLA, with deliverability metrics logged and alerts for high failures.

### Module K — CRM & Customer Management

**Description**: customer profiles created at first booking (no forced login), segmentation, notes, loyalty programs, merge/duplicate handling.

**User stories**: see customer booking history, segment by LTV.

**Tables**: customers, customer_notes, customer_segments, loyalty_accounts.

**APIs**:
- POST /v1/tenants/{tenantId}/customers — create/lookup
- GET /v1/tenants/{tenantId}/customers/{id}/history
- POST /v1/tenants/{tenantId}/customers/merge

**Mechanics**:
- Automatic deduplication heuristics (email/phone fuzzy match).
- Opt-in management for marketing messages (GDPR).
- Loyalty points accrual & redemption APIs.

**Edge cases**: GDPR export/delete flows, merging duplicates preserving history.

**Acceptance**: Accurate customer history and segmentation for campaigns.

### Module L — Analytics & Reporting

**Description**: revenue, bookings, customer retention, staff performance, promotion ROI, operational KPIs.

**User stories**: owner sees weekly revenue vs last week, staff utilization charts.

**Tables**: analytics_events, usage_counters, aggregated materialized views for dashboards.

**APIs**:
- GET /v1/tenants/{tenantId}/analytics/overview
- GET /v1/tenants/{tenantId}/analytics/revenue
- POST /v1/tenants/{tenantId}/analytics/export (CSV/PDF)

**Mechanics**:
- Event ingestion pipeline from booking/payment/notification events to analytics store.
- Materialized view refresh strategies and caching.
- Permissions: only tenant owners/admins see tenant analytics.

**Acceptance**: dashboards load with aggregated data within target latency (configurable refresh intervals).

### Module M — Admin Dashboard / UI Backends (13 core modules)

**Description**: APIs and backend logic supporting the admin dashboard features:

- Availability Scheduler
- Services & Pricing Management
- Booking Management Table
- Visual Calendar
- Analytics Dashboard
- CRM
- Promotion Engine
- Gift Card Management
- Notification Templates & Settings
- Team Management
- Branding Controls & Theming
- Payouts & Tenant Billing
- Audit & Operations (audit logs, webhooks, CSV exports)

**APIs & acceptance**: each item maps to the modules above; dashboard actions are transactional, audited, and enforce RLS.

**Admin UX guarantees (must be implemented as backend features)**:
- Visual calendar supports drag-and-drop reschedule (backend must accept a reschedule event and validate conflicts).
- Booking table supports bulk actions (confirm, cancel, reschedule), inline message send (enqueue notification).
- Live previews for branding and theme editing endpoints (sandboxed).
- Staff scheduling drag-and-drop that writes consistent work_schedules.

### Module N — Operations, Events & Audit

**Description**: reliability for external integrations, webhooks, quotas, audit logs.

**Tables**: events_outbox, webhook_events_inbox, audit_logs, quotas, usage_counters.

**APIs / Background workers**:
- Outbox poller (Celery worker) sends events (email, SMS, webhook) and marks delivery status.
- Webhook inbox processes incoming provider webhooks (Stripe, Twilio), validates signature, writes events, idempotently processes.
- Quota enforcement service: checks usage_counters before allowing promotions/notifications above tenant plan.

**Edge cases**: provider outages, replayed webhooks, partial side-effects — outbox/inbox ensures at-least-once delivery with idempotency keys. Admin UI exposes retry queues.

**Acceptance**: message guaranteed delivery metrics & admin controls for retries.

## 9. Non-Functional Requirements (NFRs)

### Performance

- **Response time**: API median < 500ms; public booking flow < 2s on 3G for critical paths (service listing & availability).
- **Scalability**: horizontally scalable BFF + queue workers; caching layer (Redis) for tenant bootstrap & availability cache.

### Security

- **RLS enforced** for all tenant-scoped tables.
- **JWT verification** via JWKS; short-lived tokens recommended.
- **Field-level encryption** for sensitive PII (e.g., phone if tenant opts in).
- **Redact PII** from logs and queries; structured logs must not leak full PII.
- **PCI**: minimize card data handling; use Stripe Elements and tokenized PMs. Do not store raw card data.

### Reliability

- **Outbox/inbox event pattern** for external side effects.
- **Retries with exponential backoff** (tenacity / Celery built-ins).
- **Backup schedule and restore plan** (daily backups, point-in-time recovery configured).
- **RTO / RPO** documented in infra playbook.

### Maintainability

- **Frozen interfaces** (Pydantic + TypeScript DTOs).
- **Contract tests** and OpenAPI auto-generation.
- **One-page design briefs** per module and micro-tickets per feature.

### Observability

- **Structured logs** (tenant_id, user_id, request_id), Sentry for error capture.
- **Metrics (Prometheus)**: request latency, bookings/sec, failed payments, notification failures.
- **Alerts for SFAs** (high error rates, provider outage, high no-show rates).

### Compliance

- **GDPR**: export/delete per tenant and per customer flows (audit).
- **Data retention policy** for PII and logs per tenant.
- **Audit logging** for PII access and changes.

## 10. Testing Strategy & Quality Gates

### Tests required

- **Unit tests** for all endpoints and services.
- **Integration tests** for end-to-end booking → payment → notifications.
- **Contract tests**: Pydantic DTO ↔ OpenAPI validation, TypeScript DTO sync.
- **Property-based tests** for slot arithmetic, money math, idempotency.
- **pgTAP DB tests** for RLS, constraints, exclusion constraints.
- **Adversarial tests**: JWT tampering, RLS bypass attempts, provider replay attempts.
- **E2E in staging** to exercise provider interactions (stripe/test keys).

### CI gates

- Lint, unit tests, contract tests, db migrations validation, pgTAP must pass before merging to main.
- OpenAPI spec validated and published to /openapi/tithi-v1.json.
- Release pipeline runs integration tests in staging and requires manual approval for production deployments.

## 11. Deployment, Migrations & CI/CD

### Environments

- dev (local), ci (test), staging, production.

### Migrations

- Use Supabase CLI / Alembic packs; migrations are idempotent and tested via pgTAP.
- Migration run steps: backup → apply migrations on staging (CI) → run pgTAP → manual approval → apply to prod.

### Release strategy

- **Canary / feature flag rollouts**: feature flags default off and toggled after smoke tests.
- **Automatic rollback** if critical errors/failure thresholds breach.

### CI/CD pipeline

- **PR passes**: lint → unit tests → contract tests → run pgTAP against test DB → static analysis → build Docker images → push.
- **On merge**: run integration tests in staging; after manual approval, deploy to production with DB migrations and feature flag toggles as needed.

## 12. Quotas, Plans & Billing

- **Per-tenant quotas**: bookings/month, notifications/day, promotions per month.
- **usage_counters & quotas tables** track use; jobs generate alerts when approaching limits.
- **Billing**: tenant_billing table includes stripe_connect_id, trial period, monthly fee.
- **Automatic throttle/deny policy** on exceeded quotas with admin notifications.

## 13. Data Privacy, GDPR & Compliance

- **Export**: POST /v1/tenants/{tenantId}/export to generate tenant data export (customers, bookings, payments) in standard formats.
- **Delete**: DELETE /v1/tenants/{tenantId}/customers/{id} implements GDPR-safe deletion (soft delete then purge after retention).
- **Consent**: store marketing opt-in per customer; enforce on notification sends.
- **Audit trail**: store who viewed/changed PII; admin search for PII access logs.

## 14. Observability, Monitoring & Alerting

- **Structured logs** with request_id, tenant_id, user_id (PII redacted).
- **Sentry for exceptions**; severity mapping; exact workflow for SRE/ops.
- **Metrics (Prometheus)**: request latency, bookings rate, failed payments, SMS fails, worker queue backlog.
- **Dashboards (Grafana)**: uptime, error rates, provider latencies, queue lags.
- **Alerts**: on provider outages, high error rates, backup failures, high no-show charge spikes.

## 15. Admin & UX Guarantees (required backend support)

- **Visual calendar backend** supports drag-and-drop rescheduling with server-side conflict detection and atomic updates.
- **Booking table** supports bulk actions and inline communications APIs.
- **Live theme preview endpoints** that sandbox unpublished themes.
- **All admin actions** are audited (audit_logs) with rollback where applicable.

## 16. Deliverables (explicit)

- **Fully implemented modular backend** (blueprints) for all modules above.
- **Supabase migrations + pgTAP test suite**.
- **Versioned OpenAPI spec**: /openapi/tithi-v1.json.
- **CI/CD with contract tests** and migration validation.
- **Observability tooling** (Sentry, Prometheus, structured logs).
- **/docs with up-to-date module briefs**, DB_PROGRESS.md, interfaces.md, flows.md, constraints.md.
- **Admin tooling** for retries, queue management, and billing dashboards.
