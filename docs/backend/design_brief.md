# Tithi Backend Master Design Brief (v1.4)

This **Master Brief** merges the original design brief's clarity and narrative style with the extended v1.2 brief's breadth, guardrails, and database alignment details. It is a single authoritative reference for Cursor/codegen and developers to build the backend correctly, 1:1 with the production schema, while covering the full feature set beyond Bookings.

---

## Introduction

**Tithi Bookings Module — Compose & Lifecycle (v1).** This module provides the authoritative API, schema, RLS, and event flows to create, manage, and observe bookings across multi-tenant salons/studios. It guarantees conflict-free slot allocation, deterministic status transitions, mobile-optimized round trips, and safe side effects (payments, notifications, realtime). It is the canonical source for booking time windows (`start_at`, `end_at`), overlap prevention (GiST exclusion on active statuses), and idempotent creation via `client_generated_id`.

**Extended:** This Master Brief expands scope beyond bookings, detailing identity/tenancy, catalog/CRM, availability, payments, promotions, notifications, analytics/quotas, events/realtime, and admin/ops. It also encodes alignment guardrails so the backend maps 1:1 with the database.

---

## North Star Fit

- **Extreme modularity:** Flask blueprints per domain; no cross-module reach-ins; DTO/event interfaces only.
- **Determinism > cleverness:** Constraints, RLS, exclusion index enforce invariants; thin orchestration layer.
- **API-first BFF:** Composite endpoints (`/api/bookings/compose`) minimize mobile round trips; OpenAPI-first with Pydantic DTOs.
- **Multi-tenant:** `tenant_id` on every row; canonical helpers `public.current_tenant_id()` and `public.current_user_id()`.
- **Mobile/offline-first:** Idempotent POST with `client_generated_id`; background sync safe; realtime updates via Socket.IO.
- **Trust-first:** Clear Problem+JSON taxonomy, quotas, rate limits, retry-safe semantics, audit logs.
- **Observability & safety:** Structured logs, metrics, traces; outbox/inbox for reliable side effects; SLO-aligned performance targets.

---

## Scope

- **Bookings:** composition, creation, list/filter, cancel, no-show, reschedule.
- **Identity & Tenancy:** JWT auth, memberships, roles (`membership_role`).
- **Catalog & CRM:** customers, services, resources, service-resource compatibility.
- **Availability:** rules/exceptions, slot engine with DST-safe UTC slots.
- **Payments:** intents, confirm, refunds, replay safety via 3 partial uniques.
- **Promotions:** coupons, gift cards, referrals (gift → percent → fixed precedence, floor=0).
- **Notifications:** templates, reminders, retries, quiet hours, provider failover.
- **Analytics & Quotas:** counters, dashboards, quota enforcement.
- **Events/Realtime/Offline:** outbox/inbox, Socket.IO tenant rooms, offline queue replay.
- **Admin & Ops:** quotas, audit logs, impersonation, billing, maintenance toggles.

---

## Backend-DB Alignment Guardrails

- **RLS:** Canonical policies = helper functions; deny-by-default.
- **Field names:** Always `start_at`/`end_at`; accept `*_ts` aliases for one release with Deprecation header.
- **Resources:** Unified resources table (`resource_type` enum) + `service_resources` mapping.
- **Overlap semantics:** Exclusion applies only to `pending`, `confirmed`, `checked_in`; completed does not block future bookings.
- **Payments:** Enforce 3 partial uniques (`idempotency_key`, `provider_payment_id`, `provider_charge_id`).
- **Outbox/inbox:** Use DB names (`event_code`, `payload`, `id`). No legacy names in code.
- **Audit logs:** `{table_name, operation, record_id, old_data, new_data}`.
- **Quotas:** `quotas` + `usage_counters` (not limits).
- **Promotions:** enforce precedence order; atomic gift card redemption.
- **Notifications:** quiet hours default 08:00–08:59; suppression lists enforced; circuit breaker failover.
- **API versioning:** v1 stable; aliases accepted for one cycle only; CI guard prevents drift.
- **Cursor hints:** generate DTOs from OpenAPI; always send `client_generated_id`; return `suggested_slots` on conflict.

---

## BFF Contracts

- **Bookings:** `POST /api/bookings/compose`; `GET /api/bookings`; lifecycle endpoints (cancel, no-show, reschedule).
- **Catalog:** CRUD for customers, services, resources; public catalog endpoints.
- **Availability:** CRUD rules/exceptions; slot query with validation.
- **Payments:** intent, confirm, refund, no-show-fee, webhook.
- **Promotions:** validate, issue/redeem gift cards, referrals.
- **Notifications:** templates CRUD, send-test, status list.
- **Analytics:** new-vs-repeat metrics, overview dashboard.
- **Admin:** quotas, audit logs, billing portal, maintenance toggle.

---

## Routes

- **Bookings:** `POST /api/bookings/compose` → 201 create, 200 idempotent repeat, 409 `BOOKING_CONFLICT`, 422 `INVALID_SLOT`, 403 `RLS_DENIED`, 429 `RATE_LIMITED`, 403 `QUOTA_EXCEEDED`.
- **Payments:** may return 402 `PAYMENT_REQUIRES_ACTION` (3DS).
- **Promotions:** 422 `PROMO_INVALID`, 409 `COUPON_EXHAUSTED`.
- **Notifications:** 429 `RATE_LIMITED`; provider failover circuit breaker semantics.

---

## DB Schema

- **Bookings table** (full spec preserved).
- **Resources table** (unified: staff/room via `resource_type`).
- **Service_resources mapping.**
- **Payments table** with 3 partial uniques.
- **Promotions:** coupons, `gift_cards`(balance≥0), referrals.
- **Notifications:** notifications table + templates.
- **Quotas:** `quotas` + `usage_counters`.
- **Events:** `events_outbox`(`event_code`,`payload`,`ready_at`,`status`); `webhook_events_inbox`(`provider`,`id`,...).
- **Audit logs:** `table_name`, `operation`, `record_id`, `old_data`, `new_data`.

---

## Contract Invariants

- `start_at` < `end_at` (UTC).
- Exclusion applies only to active statuses.
- Prices ≥0; promo math enforces precedence and floor=0.
- `client_generated_id` ensures idempotency.
- Status precedence: `canceled` > `no_show` > `completed` > `checked_in` > `confirmed` > `pending` > `failed`.

---

## Events

- **Outbox:** `booking_created`, `booking_updated`, `booking_hold_expired`, `availability_changed`, `payment_*`, `notification_*`.
- **Realtime:** broadcasts to tenant rooms.
- **Inbox:** payments webhooks, dedup via `(provider,id)`.

---

## Failure and Recovery

- **Conflict:** 409 `BOOKING_CONFLICT` with suggested slots.
- **Invalid slot:** 422 `INVALID_SLOT`.
- **Payments:** 402 `PAYMENT_REQUIRES_ACTION` for 3DS.
- **Notifications:** failover to backup provider.
- **Quotas:** 403 `QUOTA_EXCEEDED`.
- **Offline:** queued POSTs replay safely with idempotency.

---

## Observability

- **Logs:** `trace_id`, `tenant_id`, `user_id`, `route`, `booking_id`, `status_code`, `latency`, `error_code`.
- **Metrics:** latency histograms, conflicts_rate, idempotent_hit_rate.
- **Traces:** API→DB→outbox→Socket.IO.
- **Audit:** change-log entries on all lifecycle changes.

---

## Security

- JWT verification via JWKS.
- RLS helpers always enforced.
- Rate limits: 5/min IP (public), 30/min user (member).
- PII optional encryption (notes, phone).

---

## Testing Strategy

- **Unit:** slot arithmetic, buffers, DST, promo math.
- **Integration:** booking flows with RLS, payments 3DS, notifications dedupe.
- **pgTAP:** RLS, uniques, FK, exclusion index, payments constraints.
- **Contract:** OpenAPI validation (Problem+JSON codes).
- **E2E:** mobile compose, offline replay, reschedule saga.
- **Property-based:** random calendars, discount stacking, money math.
- **Adversarial:** JWT tampering, cross-tenant abuse, replay mismatch.

---

## CI Integration

- OpenAPI regenerated; SDK refreshed.
- DB migrations appended; `DB_PROGRESS.md` updated.
- CI jobs: lint, typecheck, unit, integration, pgTAP; coverage ≥85% unit, ≥70% integration.
- Load smoke: compose p95 < 300ms.

---

## Feature Flags

- `feature.multi_service_cart` (future reference).
- `feature.pwa_installable` (offline QA).
- `feature.bookings.read_only` (maintenance kill-switch).

---

## Ready to Verify Checklist

- ✅ DTOs use `start_at`/`end_at` only; aliases accepted for one cycle.
- ✅ GiST exclusion ignores completed.
- ✅ Outbox/inbox field names aligned to DB.
- ✅ Quotas enforced via `quotas`/`usage_counters`.
- ✅ Audit logs match DB schema.
- ✅ RLS helpers active + middleware claims set.

---

## Acceptance Criteria

- **Functional:** Create/list/cancel/no-show/reschedule 200/201; overlap 409; invalid slot 422; idempotency replay 200.
- **Security:** RLS enforced; JWT verified; rate limits active; no PII in logs.
- **Reliability:** Outbox delivery ≥99.9%; offline replay safe.
- **Performance:** compose p95 ≤300ms; list p95 ≤150ms.
- **Observability:** logs, metrics, traces, audits complete.
- **Contracts:** OpenAPI frozen v1; DTOs/Problem+JSON stable.

---

## Notes

- **Payments saga:** pending→confirmed transitions may be webhook-lagged; reconciliation workers must be idempotent.
- **DST edge cases:** slot engine returns canonical UTC; compose rejects ambiguous/nonexistent local times.
- **Scalability:** shard keys for high-traffic tenants; keep exclusion index lean.
- **Future:** multi-service cart & group bookings via `booking_items` child table.

---

## Database Schema Reference

For the complete database schema, migrations, and constraints, refer to:
- `infra/supabase/migrations/` - All database migrations
- `docs/database/` - Database design documentation
- `docs/DB_PROGRESS.md` - Implementation progress tracking

## Implementation Priority

1. **Core Tenancy & RLS** (migrations 0004-0014)
2. **Bookings & Availability** (migrations 0007-0008)
3. **Payments & Billing** (migration 0009)
4. **Promotions & Notifications** (migrations 0010-0011)
5. **Analytics & Quotas** (migration 0012)
6. **Audit & Security** (migrations 0013-0016)
7. **Performance & Indexes** (migration 0017)
8. **Testing & Validation** (migration 0018)

---

*This document serves as the single source of truth for backend development. All implementations must align with these specifications and the corresponding database schema.*
