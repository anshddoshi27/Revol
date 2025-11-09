# Tithi Backend — Complete Context Pack (v1.1)

## Purpose

This pack gives engineers and codegen the full, compiled context to implement Tithi's backend correctly, end-to-end, while staying 1:1 aligned with the canonical Supabase/Postgres database. It merges the canonical spec, the master design brief, DB alignment report, operational playbooks, and a deprecations appendix. Treat it as the starter kit for every module, PR, and Cursor session.

---

## 0) North-Star & Delivery Discipline

### Product North-Star

- **Extreme modularity:** Flask blueprint per domain; no cross-module reach-ins.
- **API-first BFF:** mobile-optimized round-trips.
- **Multi-tenant by construction:** strict RLS everywhere.
- **Mobile/offline-first:** background sync & idempotency for POSTs.
- **Trust-first:** clear pricing/policies, GDPR export/delete, PCI minimization.
- **Observability & safety baked in:** structured logs, traces, metrics, rate limits, idempotency, outbox/inbox.
- **Determinism over cleverness:** schema/constraints enforce invariants.
- **White-label platform:** Complete branding control for each tenant with custom domains.
- **Offline-first PWA:** Full offline capability for core booking flow with background sync.
- **Apple-quality UX:** Intuitive, clean, elderly-friendly interface design with black/white theme.

### Engineering Discipline

- Always load Master Design Brief → DB Alignment → Cheat Sheets before coding.
- Contracts frozen in `/src/types` (Pydantic DTOs generate OpenAPI).
- Test layers: unit, integration (RLS ON), contract, adversarial, property-based.
- Definition of Done: updated brief, OpenAPI, metrics, RLS tests green, error codes mapped.
- **100% Confidence Requirement:** No code or deliverables may be produced below 100% confidence.
- **Task Prioritization:** Every executor must prioritize task completion and ensure perfect execution.

---

## 1) Architecture, Stack, Repo Layout

### Stack
- **Python 3.11+**, Flask 3, Flask-Smorest (OpenAPI), SQLAlchemy 2.x, psycopg3, Pydantic v2, Redis, Celery, Socket.IO, Sentry, structlog, tenacity, httpx.

### Providers
- **Stripe**, Twilio, SendGrid.

### Auth
- **Supabase Auth JWT.**

### Routing
- **Public tenant routes:** `/v1/b/{slug}`
- **Member routes:** `/v1/tenants/{tenantId}`
- **Auth/admin:** `/api/...`

### Repo Layout (Indicative)

```
backend/
  app/
    __init__.py config.py
    middleware/ (auth, rls, errors, logging, rate_limit)
    blueprints/ (auth, tenants, catalog, availability, bookings, payments,
                 promos, notifications, analytics, admin)
    events/ realtime/ jobs/
  db/ (models, migrations, queries)
  tests/ (unit, integration, e2e, property)
  docs/ (interfaces.md, flows.md, constraints.md)
  openapi/ (tithi-v1.json)
```

### Health
- `/health/live`, `/health/ready`

---

## 2) Identity, Tenancy, Roles, RLS

### Auth & Claims
- **Supabase Auth JWT** (JWKS verify). Claims include `tenant_id`, `membership_role`.

### RLS Context
- `SET LOCAL "request.jwt.claims" = <claims>` with helpers `public.current_tenant_id()` and `public.current_user_id()`.

### RBAC
- Decorators enforce roles; RLS policies enforce tenant isolation.

### Privacy
- Optional field-level encryption; logs redact PII; audit who viewed PII.

### Memberships & Invites
- Tokenized invite → accept → `membership_role` row. Offboarding revokes memberships and reassigns bookings.

---

## 3) Database Canon (Supabase Postgres + RLS)

### Extensions
- `pgcrypto`, `citext`, `btree_gist`, `pg_trgm`.

### Enums

```sql
booking_status: pending|confirmed|checked_in|completed|canceled|no_show|failed
payment_status: requires_action|authorized|captured|refunded|canceled|failed
membership_role: owner|admin|staff|viewer
resource_type: staff|room (extensible)
notification_channel: email|sms|push
notification_status: queued|sent|failed
payment_method: card|cash|apple_pay|paypal|other
```

### Core Tables
- `tenants`, `users`, `memberships`, `customers`, `resources` (unified staff/room via `resource_type`), `services`, `service_resources`, `availability_rules`, `availability_exceptions`, `bookings`, `payments` (3 partial uniques), `coupons`, `gift_cards`, `referrals`, `notifications`, `audit_logs`, `events_outbox`, `webhook_events_inbox`, `quotas`, `usage_counters`.

### Constraints
- Composite indexes on `(tenant_id, created_at)`
- GiST exclusion on `(resource_id, tstzrange(start_at,end_at))` for active statuses
- Booking idempotency: unique `(tenant_id, client_generated_id)`
- Payments replay safety: 3 partial uniques
- RLS: deny-by-default, helpers authoritative.

---

## 4) API & Contract Conventions

### DTOs
- **Pydantic v2**, generate OpenAPI under `/v1`.

### Problem+JSON
- `{ type, title, detail, fieldErrors, code }`. Error codes locked.

### Field Naming
- Canonical `start_at`/`end_at`. Legacy `start_ts`/`end_ts` accepted one cycle, emit Deprecation header.

### Offline Semantics

- Queue `POST /api/bookings` while offline.
- On reconnect:
  - `201 Created` → replace pending with confirmed.
  - `409 Conflict` → mark failed, prompt reschedule.

### Example Payload

```json
{
  "client_generated_id": "uuid-1234",
  "service_id": "svc-5678",
  "resource_id": "res-42",
  "start_at": "2025-05-01T10:00:00Z",
  "end_at": "2025-05-01T11:00:00Z"
}
```

---

## 5) Domain Modules

### 5.1 Catalog & CRM

- Tenant-scoped CRUD for customers/resources/services.
- Events: `customer_created`/`updated`, `service_created`/`updated`, `resource_updated`.
- Failures: `409 CUSTOMER_DUPLICATE`, `422 VALIDATION_ERROR`, `403 RLS_DENIED`.

### 5.2 Availability

- Slot computation, 15-minute granularity, DST-safe.
- Failures: `400`/`422` invalid windows, `429 RATE_LIMITED`.

### 5.3 Bookings

- `POST /api/bookings/compose` validates slot, inserts transactionally, emits outbox.
- Lifecycle: cancel, no-show, reschedule (`rescheduled_from`).
- Status precedence: `canceled` > `no_show` > `completed` > `checked_in` > `confirmed` > `pending` > `failed`.
- Offline handling as in section 4.
- Failures: `409 BOOKING_CONFLICT` (suggest slots), `422 INVALID_SLOT`, `403 RLS_DENIED`.

### 5.4 Payments & Monetization

- APIs: intent, confirm, refund, no-show-fee, webhook.
- Policy copy:
  > "All missed appointments without cancellation at least 24h before will incur a 3% no-show fee."
- Future-proof DTOs: tips and Stripe Tax fields reserved.
- Failures: `402 PAYMENT_REQUIRES_ACTION`, `409` replay.

### 5.5 Promotions

- Coupons, gift cards, referrals. Precedence: gift → percent → fixed.

### 5.6 Notifications & Scheduling

- Celery + Redis with retries/backoff.
- Quiet hours default: 08:00 local.
- Providers: SendGrid, Twilio with 10DLC compliance.

### 5.7 Analytics, Usage & Quotas

- Quotas enforced via `quotas` + `usage_counters`.
- Views nightly refreshed, with staleness indicator.
- **Comprehensive Analytics System (40+ Metrics)**:
  - Revenue Analytics: Total revenue, revenue by service/staff, average transaction value, seasonal patterns
  - Customer Analytics: New vs. returning customers, lifetime value, retention rates, churn analysis
  - Booking Analytics: Conversion rates, peak hours, cancellation patterns, source tracking
  - Service Analytics: Popular services, profitability analysis, cross-selling success rates
  - Staff Performance: Bookings per staff, revenue generation, utilization rates, customer ratings
  - Operational Analytics: No-show rates, wait times, capacity utilization, scheduling optimization
  - Marketing Analytics: Promotion effectiveness, referral performance, social media impact
  - Financial Analytics: Cash flow analysis, tax tracking, profit margins, cost analysis
  - Competitive Intelligence: Market analysis, pricing insights, demand forecasting

### 5.8 Events/Realtime/Offline

- Outbox for all side effects.
- Inbox for replay protection.
- Realtime broadcasts over tenant Socket.IO rooms.

### 5.9 Admin & Ops

- Quotas CRUD, audit log queries, billing portal, maintenance toggle, impersonation (audited).
- Compliance endpoints: `/internal/gdpr/export`, `/internal/gdpr/delete`.
- **Admin Dashboard (13 Core Modules)**:
  - Availability Scheduler: Drag-and-drop time slot creation, Google Calendar sync
  - Services & Pricing: CRUD interface, bulk updates, category management
  - Booking Management: Sortable table, bulk actions, payment tracking
  - Visual Calendar: FullCalendar integration, drag-and-drop management
  - Analytics Dashboard: Modular widgets, customizable dashboards
  - Client CRM: Customer database, lifetime value, segmentation
  - Promotions Engine: Coupon creation, referral programs, A/B testing
  - Gift Card Management: Creation, sales tracking, redemption history
  - Notification Settings: Template editor, timing configuration
  - Team Management: Staff profiles, schedules, performance tracking
  - Branding Controls: Live preview, color management, custom CSS
  - Financial Reports: Revenue reporting, Stripe integration, tax tracking
  - Customer Database: No customer logins - CRM records only

---

## 6) Error Taxonomy

### Stable Problem+JSON Codes

- `RLS_DENIED` (403)
- `RATE_LIMITED` (429)
- `BOOKING_CONFLICT` (409)
- `INVALID_SLOT` (422)
- `QUOTA_EXCEEDED` (403)
- `PAYMENT_REQUIRES_ACTION` (402)
- `PAYMENT_DECLINED` (402)
- `PROMO_INVALID` (422)
- `COUPON_EXHAUSTED` (409)
- `GIFT_INSUFFICIENT_BALANCE` (409)
- `WEBHOOK_REPLAY` (409)
- `GDPR_PENDING` (409)
- `INVALID_STATE` (409)
- `VALIDATION_ERROR` (422)

---

## 7) Observability & Security

### Logs
- `trace_id`, `span_id`, `tenant_id`, `user_id`, `route`, `status_code`, `latency`, `error_code`; redact PII.

### Metrics
- Route latency, job success/fail, queue depth, provider latency.

### Compliance
- GDPR export/delete endpoints, PCI minimization, 10DLC + quiet hours defaults.

---

## 8) Testing Strategy & CI/CD

- Unit, integration (RLS ON), pgTAP, contract, E2E, property-based, adversarial.
- CI: lint, typecheck, unit/integration, DB tests, OpenAPI diff guard.
- Coverage: offline queue/resync flows, alias headers, no-show fee policy copy.

---

## 9) Delivery Phases

1. **Scaffolding & Contracts**
2. **Identity & Tenancy**
3. **Catalog**
4. **Availability**
5. **Bookings** (with offline semantics)
6. **Payments** (intents, webhooks, no-show fee, tips/tax DTO hooks)
7. **Promotions**
8. **Notifications**
9. **Public/White-Label** (ETag/304, asset signing, auto-palette)
10. **Analytics**
11. **Admin & Ops**

**Gate to v1 Stable:** all contracts frozen, e2e green.

---

## 10) Decisions That Bind

- **Time fields:** canonical `start_at`/`end_at`. Aliases once with Deprecation header.
- **Resources:** unified `resources` + `service_resources`; no split staff/room tables.
- **Roles enum:** canonical `membership_role`; map from old `role_kind`.
- **RLS:** helper-based policies are authoritative.
- **Payments:** enforce 3 partial uniques.

---

## 11) API Index (Authoritative v1)

### Auth
- `/api/auth/me`, `/api/auth/roles`

### Tenants
- `/api/tenants/current`, `/api/resolve-tenant`

### Memberships
- Invites + memberships CRUD

### Catalog
- Customers/resources/services CRUD

### Availability
- Rules/exceptions, `GET /api/availability`

### Bookings
- Compose, cancel, no-show, reschedule

### Payments
- Intent, confirm, refund, no-show-fee, webhook

### Promos
- Validate, giftcards issue/redeem

### Notifications
- Templates CRUD, send-test, list status

### Analytics
- Overview, new-vs-repeat

### Admin
- Quotas, audit logs, billing portal, maintenance, impersonation

### Public
- `/v1/b/{slug}` storefront

### Compliance
- `/internal/gdpr/export`, `/internal/gdpr/delete`

---

## 12) Public End-Customer Journey

- Discover services, slots, checkout.
- Checkout policy copy displayed: "3% no-show fee if not canceled at least 24h before."
- Confirmation: ICS add, reminders (24h email, 24h/1h SMS).

---

## 13) Ops Playbooks (Summaries)

- **Redis outage:** failover Celery, buffer to DB, reconcile on recovery.
- **Stripe backlog/outage:** queue intents, show "Payments delayed," reconcile via webhook replay.
- **SMS provider block:** circuit breaker, failover to secondary, re-register 10DLC.
- **Quota exhaustion:** block costly ops, show admin banner, allow exports.
- **GDPR export/delete:** export bundle, tombstone deletes, purge nightly.
- **Migration rollback:** maintenance mode, rollback one pack, smoke test, reopen.

---

## 14) SLOs & Performance Targets

- Booking create < 300ms p95.
- Email dispatch < 60s.
- Uptime 99.9%.
- Calendar queries < 150ms p95 for P1000 tenants.
- **Enhanced Performance Targets**:
  - Booking Flow Performance: <60 seconds completion time (even offline)
  - App Load Performance: <2 seconds on 3G networks
  - Data Security: Zero data leakage across tenants
  - Admin Efficiency: Configure coupons/forms without developer assistance
  - Subscription Management: Graceful enforcement after 30-day trial period
  - Trial Visibility: Countdown visible to tenants
  - Feature Extensibility: Feature toggles extensible without system rewrite

## 15) Monetization & Business Model

- **Flat Monthly Pricing**: First month free, then $11.99/month
- **Stripe Connect**: Per-tenant payouts and subscription management
- **Payment Methods**: Cards, Apple Pay, Google Pay, PayPal, cash (with no-show collateral)
- **Cash Payment Policy**: 3% no-show fee with card on file via SetupIntent
- **Gift Cards & Promotions**: Digital gift cards, coupon system, referral programs
- **Trust-First Messaging**: "Transform your booking process with zero risk. No setup fees, no monthly costs for 90 days, no contracts."
- **Trial Period**: 30-day free trial with clear countdown and upgrade prompts

---

## 16) Onboarding Flow Requirements (12 Steps)

- **Business Information**: Name, type, address, phone, email, website, subdomain generation
- **Owner Details & Team Setup**: Primary admin account, team invitations, role assignment
- **Services & Pricing**: Dynamic service creation, categories, bulk import, image management
- **Availability & Scheduling**: Weekly schedule builder, holiday management, time zone handling
- **Team Member Management**: Staff profiles, scheduling preferences, service assignments
- **Branding & Customization**: Color picker, logo upload, font selection, custom domain setup
- **Promotions & Marketing**: Coupon creation, referral programs, discount rules
- **Gift Card Configuration**: Denomination setup, digital delivery, redemption tracking
- **Notification Settings**: SMS/email templates, timing configuration, opt-in management
- **Payment Methods & Billing**: Stripe Connect, payment options, no-show fee policies
- **Review & Go Live**: Comprehensive review, test booking flow, domain activation
- **Modularity**: Each step is a separate React component that can be reordered, skipped, or extended

## 17) UI/UX Design Requirements

- **Apple-Quality UX**: Intuitive, clean, elderly-friendly interface design
- **Black/White Theme**: Modern, high-contrast, professional appearance
- **Touch-Optimized**: Large tap targets, responsive layouts for mobile-first design
- **Sub-2s Load Time**: Optimized for 3G networks with fast loading
- **Fully Offline-Capable**: Core booking flow works without internet connection
- **Visual Flow Builder**: Drag-and-drop interface for booking flow customization
- **Real-Time Preview**: Live preview of branding changes and booking flow modifications
- **Accessibility**: ARIA compliance, screen reader support, keyboard navigation

## 18) Cursor & Codegen Usage Notes

- Start each module with one-screen design brief; freeze DTOs.
- Generate Pydantic schemas → OpenAPI → FE SDK.
- Always wire RLS helpers before writing queries.
- Enforce idempotency everywhere.
- Emit outbox events for all external side effects.
- **100% Confidence Requirement**: No code or deliverables may be produced below 100% confidence.
- **Task Prioritization**: Every executor must prioritize task completion and ensure perfect execution.

## 19) Platform Architecture & User Management

- **Main Tithi Platform**: Homepage with "Get on Tithi" and "Login" buttons
- **User Types**: Tithi users (business owners/staff) vs. Customers (no platform accounts)
- **Business Selection**: Multi-business access for users with multiple tenant relationships
- **Role Management**: Owner, Admin, Staff roles with permission matrices
- **Customer System**: No customer logins - customers exist only as CRM records in business databases
- **Booking Flow Customization**: Complete customization with visual flow builder, custom fields, A/B testing
- **Mobile-First Design**: Apple-quality UX with black/white theme, touch-optimized interface

## 20) Deprecations & Aliases

- `start_ts`/`end_ts` → alias accepted one cycle, canonical `start_at`/`end_at`.
- `service_staff`/`service_rooms` → deprecated, canonical unified `resources`.
- `role_kind` → deprecated, canonical `membership_role`.
- Direct `current_setting` RLS → doc only; helpers canonical.
- Payments idempotency weaker uniques → deprecated, canonical 3 partial uniques.

---

## 21) Open Questions / TODOs

- Stripe Tax integration (hooks reserved).
- Tips support (DTOs reserved).
- Multi-service cart & group bookings (future feature flag).
- Field-level encryption scope (phone, notes TBD).
- Token revocation/jti blacklist (optional).

---

## Related Documentation

- **[Master Design Brief](design_brief.md)** - Complete backend design specifications
- **[Database Context Pack](../database/database_context_pack.md)** - Database design and constraints
- **[Backend Build Blueprint](../database/backend_build_blueprint.md)** - Implementation roadmap
- **[Critical Flows](../database/canon/critical_flows.md)** - Key business process flows

---

*This context pack serves as the complete implementation guide for Tithi's backend. Always reference this document alongside the Master Design Brief and database documentation before starting any new module or feature.*
