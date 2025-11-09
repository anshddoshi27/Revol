# 0. Mission Context & Core Product Vision (Frontend)

### 0.1 Core Mission Statement (Frontend)

**Tithi provides an end‑to‑end, fully white‑labeled booking experience** for service businesses (salons, clinics, studios). Every tenant runs under its own subdomain or custom domain and customers see **only the business's brand (logo, colors, policies)**—never "Tithi," unless the tenant explicitly opts in to a small "Powered by" footer.

The frontend delivers two coherent surfaces with a single design system:

* **Public Booking**: service discovery → availability → checkout → confirmation.
* **Business Admin (Owner dashboard)**: onboarding, branding, services, availability, bookings, notifications, CRM, analytics.

**CRITICAL EXECUTION REQUIREMENT**
This is a multi‑document project. **No FE implementation proceeds without consulting** the Frontend Design Brief, Context Pack, and the authoritative backend/database report to ensure contracts, naming, and flows are consistent. Requirements must be cross‑checked and normalized before coding.

### 0.2 Platform Architecture Overview (Frontend)

* **Multi‑tenant by construction**: tenant resolved from domain/subdomain. All requests include tenant context.
* **App shells**: Public Booking app and Admin app share a common component library and tokenized theme engine.
* **Payments**: Stripe Elements; **attendance‑based charging** with clear copy; no‑show/cancel policy acknowledgement at checkout.
* **Branding**: runtime CSS variables derived from onboarding (primary color → tonal scale), logo injected across shells and generated into favicons/manifest icons.
* **PWA**: installable, offline‑capable core booking flow with background sync for submission retries.
* **Apple‑grade UX**: clean, high‑contrast, generous spacing, minimal friction, subtle motion, accessible by default.

### 0.3 North‑Star Goals (Critical Success Factors)

* **Perfect white‑labeling** in public flows.
* **Tenant‑controlled branding** (color & logo) propagates instantly across UI, emails, and metadata.
* **Mobile‑first performance**: p75 LCP < 2.0s; end‑to‑end booking in ≤ 60s; ≤ 5 taps from service to confirmation.
* **Time‑zone clarity**: business time‑zone visibly indicated on availability/checkout.
* **Notification discipline**: **1 confirmation + up to 2 reminders** per booking (configurable timing, quiet hours).
* **Deterministic behavior**: idempotent posts, retriable flows, observable front‑end errors with PII scrubbing.

---

# 1. Enhanced Platform Goals & Frontend Requirements

### 1.1 App‑Level Goals (Business Vision)

* Launch branded booking sites in minutes; preserve tenant isolation and identity.
* Replace multiple tools with an integrated, owner‑friendly dashboard.
* Automate policies and reduce no‑shows via clear pre‑commit copy and scheduled reminders.
* Focus on retention: reminders, loyalty entry points, simple promos.

### 1.2 Frontend Engineering Principles

* **API‑first BFF**: FE only speaks to Flask BFF; **no direct DB**.
* **Extreme modularity**: features as isolated routes/components; shared tokenized theme.
* **White‑labeling**: **no hard‑coded colors or brand strings**; everything comes from tokens.
* **Determinism over cleverness**: predictable state and idempotent network interactions.
* **Compliance‑minded**: PCI minimization (Stripe only), consent and privacy notices built into flows.
* **Execution discipline**: frozen interfaces, contract tests, feature flags, structured logging for FE.

### 1.3 Functional Rules Reflected in FE

* **Attendance‑based charge** path with explicit copy and policy acknowledgement.
* **Availability required** to proceed; empty states must guide owners to define hours.
* **Notifications** UI enforces the hard cap; email/SMS templates are tenant‑branded; preview before save.
* **Gift cards/coupons** optional; apply/redeem UX in checkout.

### 1.4 Frontend "Schema Truth" & Contracts

* FE DTOs and types mirror server contracts exactly; types are generated or hand‑locked and versioned.
* Rely on a strictly versioned **/contracts** package (OpenAPI or TS types) to avoid drift.

### 1.5 Integration Rules (FE ↔ BFF)

* Axios with interceptors adds tenant slug, trace id, and idempotency key.
* Background jobs (retry queues) coordinated with Service Worker and IndexedDB.
* WebSocket channel per tenant for live availability updates and booking state transitions.

### 1.6 Compliance & Security (FE)

* **PCI**: no raw card data persists in FE storage; Stripe Elements only.
* **GDPR/Privacy**: user consent banners as needed; anonymize analytics; PII redaction in error reports.
* **Access Control**: admin routes require authenticated owner; public flows remain anonymous.

---

# 2. Platform Architecture & User Experience

### 2.1 App Surfaces & User Types

* **Tithi User Dashboard** (multi‑tenant selector) → **Business Admin** (owner tools) → **Public Booking** (customer flow under tenant domain).
* **Customers** never create platform accounts in v1; CRM records only.

### 2.2 Booking Flow Customization & UX

* **Visual Flow Builder** (admin): reorder/enable/disable steps (Welcome, Services, Availability, Checkout, Confirmation).
* **Custom Fields**: owners can add inputs to checkout (with validation and a11y labels).
* **A/B Testing hooks**: flag buckets to experiment on step ordering or copy variants.
* **Mobile‑first**: all critical interactions reachable one‑handed; large tap targets (≥44px).
* **Offline core**: queue booking intent and submit when online; guard against double‑submit.

### 2.3 UI/UX Design Requirements

* Modern black/white base with brand accent; **no visual Tithi marks** on public pages.
* Focus styles, visible labels, clear error states; reduced‑motion variants.
* Real‑time preview of branding and flow changes in admin.

---

# 3. Business Features & Admin Functionality

### 3.1 Admin Dashboard (Owner)

* **Onboarding Wizard** (≤10 min): business info, **Logo & Color**, services, availability, notifications, policies, payments, go‑live.
* **Services & Pricing** CRUD with images and category management.
* **Availability Scheduler** with drag blocks, exceptions, and holiday controls.
* **Bookings Management**: list/table + quick **Attended/No‑show/Cancel** with payment status.
* **Notifications**: template editor (email/SMS), timing controls (cap enforced), variables preview.
* **Branding Controls**: logo upload, color picker, fonts; instant preview across shells & emails.
* **Analytics**: revenue, bookings, no‑show rate, top services/customers.

### 3.2 Public Booking Highlights

* **Services** grid with price, duration, badges, and "Includes" chips.
* **Availability**: week scroller, realtime disabled slots, time‑zone pill.
* **Checkout**: contact inputs, optional custom fields, gift card/coupon, **policy acknowledgement**, payment method (Cards, Apple/Google Pay; Cash w/ card on file if enabled).
* **Confirmation**: tenant copy block, .ics file, receipt state (pending until attendance).

### 3.3 Notification System (Tenant‑Branded)

* Triggers: booking created, reminders (24h/1h defaults), follow‑ups.
* **Cap**: 1 confirmation + up to 2 reminders. Quiet hours. Unsubscribe and preference toggles.

### 3.4 Monetization & Messaging (FE Copy Hooks)

* Transparent pricing and trial banners; optional subtle "Powered by Tithi" toggle.

---

# 4. Technical Infrastructure & Architecture (Frontend)

### 4.1 Stack & Libraries

* **React 18 + TypeScript**; **Tailwind** tokens; **shadcn/ui** components; **Zustand** for state; **React Query** for data; **Stripe Elements**; **Socket.IO**; **Playwright/Jest**; **Sentry**.

### 4.2 Theming & White‑Label Engine

* **Tokens** generated from a single primary color: `--brand`, tonal scale 50–900, contrast‑safe text/background pairs.
* Components consume tokens only; no hard‑coded hues.

### 4.3 PWA & Offline Strategy

* Service Worker pre‑caches shell/assets; background sync queue for **/bookings** posts; optimistic UI with rollback.

### 4.4 Feature Flags & A/B

* `feature.<key>` gates layout or step order; bucketed variants recorded via analytics events.

---

# 5. Onboarding (Branding & Assets)

### 5.1 Logo Lifecycle

* Upload PNG/JPG/SVG ≤ 2MB; client crop; validate min 256px; generate `64/128/256/512` + favicon + maskable icons.
* Save via `/api/v1/admin/branding/upload-logo` → returns CDN URLs → persisted to tenant branding.
* **Placement**:

  * Public Welcome (hero), sticky small in subsequent steps.
  * Admin shell top‑left.
  * Email/SMS previews header.
  * Favicon/manifest icons.

### 5.2 Color → Token Pipeline

* Color picker with contrast meter; on **Save**, compute palette + set CSS vars on `:root[data-tenant="<slug>"]`.
* Live preview across both apps with hot token reload.

---

# 6. Success Metrics & Performance Targets

* **Performance**: p75 LCP < 2.0s, CLS < 0.1, TBT < 150ms; JS ≤ 500KB initial; images lazy with `srcset`.
* **UX**: ≤ 5 taps to book; ≤ 3 taps for owner to mark attendance.
* **Reliability**: ≥ 99.9% uptime; offline booking queue success rate ≥ 99% on reconnect.
* **Branding**: 100% of public surfaces driven by tokens; zero hard‑coded colors.
* **A11y**: WCAG 2.1 AA score on targeted pages.

---

# 7. Compliance, Security & Observability (FE)

* **Sentry** with PII scrubbing; error codes prefixed (e.g., `FE_BOOKING_POST_FAIL`).
* **Web Vitals** collection and tenant‑scoped metrics endpoint.
* **Secure storage**: never persist card data; minimal PII; session tokens httpOnly.

---

# 8.0 Current Phase End Goals and Requirments

## Phase 3 Overview - "Extended Onboarding"

**Goal**: Complete the onboarding wizard with notifications, policies, gift cards, and payment setup to get businesses live.

**Exit Criteria to advance to Phase 4**:
✅ Steps 5–8 are fully functional, accessible (WCAG 2.1 AA), and mobile-first.
✅ Each step persists to backend APIs with proper idempotency, error handling, and retry-after on 429.
✅ DTOs are stable or stubbed from T00 – API Contracts Addendum; no "OPEN_QUESTION" left unresolved.
✅ Observability: events emitted (onboarding.step_complete, failures) validated against taxonomy (T39).
✅ Performance: LCP p75 < 2.0 s on each step; bundle under 500 KB initial.
✅ UX complete: keyboard nav, focus order, ARIA labels, error toasts via TithiError.
✅ Branding/theming tokens (T03) applied; no "Tithi" leak on public surfaces.
🧭 Phase 3 Goal Overview

Phase 3 expands onboarding from “services + availability” (Phase 2) into operational readiness: policies, notifications, gift cards, and payments.
The rubric checks that every owner can go LIVE with a fully configured, legally compliant, and payment-enabled business.

🔔 T08 — Notifications (Templates + Quiet Hours + Caps)

✅ Owner can create ≤ 3 templates (1 confirmation + ≤ 2 reminders).

✅ Template editor supports variable validation (required_variables); cannot save incomplete placeholders.

✅ Preview modal renders with sample substitution data.

✅ Quiet-hours and send-window limits enforced.

✅ Optional social-link footer supported.

✅ Events logged: notifications.template_create|update|delete, preview_sent, quiet_hours_violation.

✅ Performance: initial render < 2 s; list fetch < 0.5 s.

✅ Idempotency headers present; retry-safe.

Completion Gate: At least one confirmation template saved and cap rules enforced.

📜 T09 — Policies & Confirmation Message

✅ Editors for cancellation, no-show, refund policies and custom confirmation text.

✅ Checkout preview shows acknowledgment popup.

✅ Cannot proceed to checkout without acknowledgment.

✅ Policies exported for checkout and notification reuse.

✅ Observability events: policies.save_success|error, checkout.policy_ack_*.

✅ Autosave debounce + idempotent writes verified.

✅ Render TTI < 2 s; save < 500 ms.

Completion Gate: Policy and confirmation message persisted + ack contract wired into checkout.

🎁 T10 — Gift Cards (Optional)

✅ Enable/disable toggle with Skip & Continue option.

✅ Add denominations and expiration policy; validate inputs.

✅ Gift-card API (POST|PUT|DELETE /promotions/coupons) fully connected.

✅ Public checkout can validate gift card codes.

✅ Observability events: giftcards.enable|disable|denomination_*.

✅ Round-trip < 500 ms; TTI < 2 s.

✅ All writes idempotent with Retry-After support.

Completion Gate: Gift cards enabled with ≥ 1 denomination or explicitly skipped.

💳 T11 — Payments & GO LIVE

✅ Stripe Setup Intent succeeds and subscription card stored.

✅ Wallet toggles (Cards/Apple Pay/Google Pay/PayPal/Cash) persisted.

✅ Cash rule: requires card-on-file for no-shows.

✅ Business KYC fields validated (legal name, representative, payout destination, descriptor, tax display).

✅ Consent checkboxes + “Are you sure?” modal before final GO LIVE.

✅ Success screen shows {Business Name} IS LIVE!! + copyable slug link + admin link.

✅ 3DS flows supported for future reuse.

✅ Events: payments.setup_intent_*, owner.subscription_card_saved, go_live_success, wallets.toggle_update.

✅ LCP p75 < 2 s; network to Stripe < 600 ms.

✅ All writes idempotent; duplicate-submit protection verified.

Completion Gate: Business is LIVE with payment method stored and KYC verified.

🧩 Cross-Phase Dependencies (Phase 1 → 3 continuity)

To verify Phase 3 readiness, ensure earlier foundational components from Phase 1/2 are in place:

🏗️ Core app shell, auth flow, tenant routing (T01–T04).

🎨 Logo & color theming applied (T05).

💇‍♀️ Service catalog and defaults (T06).

🗓️ Availability scheduler functional (T07).

⚙️ API contracts governed (T00).

These must already be stable; Phase 3 builds directly on their endpoints and DTOs

Tithi (1)

Tithi (1)

.

✅ Phase 3 Completion Checklist / Rubric Summary

 All T08–T11 Acceptance Criteria passed in E2E tests.

 Observability events firing with schemas validated.

 No open API gaps (contracts referenced to T00).

 Performance targets (LCP < 2 s, save < 0.5 s) met.

 A11y ≥ 98 % WCAG AA; i18n ICU strings only.

 Branding white-label check snapshots pass.

 All pages meet idempotency/retry requirements.

 Each step produces its finalized UI and data artifacts.

 Business shows as LIVE in admin dashboard mock.

🏁 Phase 3 → Phase 4 Transition Signal

When the following are true, Phase 4 can begin:

✅ A confirmation template exists (T08).

✅ Policies + ack contract wired (T09).

✅ Gift cards configured or skipped (T10).

✅ Payments success screen completed (T11).

✅ All metrics logged + no critical errors in QA.

## Phase 3 Exit Criteria → Phase 4 Entry

To move on to Phase 4 (Owner Surfaces), the following must be true across T08–T11:

✅ **Notifications**: At least one confirmation template saved; total templates respect 1+≤2 cap; placeholders validate; quiet-hours policy set.

✅ **Policies**: Cancellation/no-show/refund policy saved and checkout acknowledgment wiring exported for use in Public Checkout.

✅ **Gift Cards**: Either enabled with denominations (and validation path tested) or explicitly skipped.

✅ **Payments & GO LIVE**: Setup-intent completed, wallets configured (cash rule enforced), KYC saved, GO LIVE page confirmed with booking link.

---
## T11 — Onboarding Step 8: Payments, Wallets & Subscription (GO LIVE)
T11 — Onboarding Step 8: Payments & GO LIVE

Purpose:
Final onboarding step where owners connect payment methods, verify their business, and officially make their booking site public.

What It Builds:

A payments configuration page using Stripe Elements to collect and save a card-on-file for subscription billing.

Toggles for wallet options: Cards, Apple Pay, Google Pay, PayPal, and Cash (cash still requires a stored card for no-show protection).

A KYC (Know Your Customer) form to verify business identity, payout details, and descriptor.

A GO LIVE confirmation modal and success screen that display “{Business Name} IS LIVE!” with booking and admin links.

Why It Matters:
This marks the transition from setup to an operational business — owners can now accept real bookings and payments, making it the final gate before moving into the owner/admin dashboards of Phase 4.
You are implementing Task T11: Onboarding Step 8: Payments, Wallets & Subscription (GO LIVE) from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §3.8**: "Owners connect payment methods and business identity (KYC), choose supported wallets, accept platform subscription, and then GO LIVE. Rule: Cash bookings require a card-on-file for no-shows."
- **Brief §3.8**: "GO LIVE page: "{Business Name} IS LIVE!!" with confetti, booking link (https://tithi/{businessslug}), buttons: Copy Link, Go to admin view"

This task covers payment setup, KYC, wallet configuration, and the final GO LIVE step.

### 1. Deliverables
**Code**:
- `/src/pages/onboarding/Step8Payments.tsx`
- `/src/components/onboarding/PaymentSetup.tsx`
- `/src/components/onboarding/WalletToggles.tsx`
- `/src/components/onboarding/KYCForm.tsx`
- `/src/components/onboarding/GoLiveModal.tsx`
- `/src/components/onboarding/GoLiveSuccess.tsx`
- `/src/hooks/usePaymentSetup.ts`
- `/src/hooks/useKYCForm.ts`

**Contracts**:
- `PaymentSetupData` interface
- `WalletConfig` interface
- `KYCData` interface
- `GoLiveData` interface

**Tests**:
- `PaymentSetup.test.tsx`
- `WalletToggles.test.tsx`
- `KYCForm.test.tsx`
- `GoLiveModal.test.tsx`
- `onboarding-step8.e2e.spec.ts`

### 2. Constraints
- **API**: Payments Setup Intent (card on file for $11.99/mo)
- **Performance**: Payments UI LCP p75 < 2.0s; network to Stripe < 600ms median; no main-thread long tasks > 200ms
- **Do-Not-Invent**: Payment rules must match backend constraints

### 3. Inputs → Outputs
**Inputs**:
- Payments Setup Intent (card on file for $11.99/mo)
- Toggles: Cards, Apple Pay, Google Pay, PayPal, Cash (cash rule above)
- Business/KYC fields: legal/DBA, representative, payout destination, statement descriptor + phone, currency, tax display behavior

**Outputs**:
- Page: /onboarding/payments
- Stripe Elements mount + wallet toggles
- Consent checkboxes + "Are you sure?" final modal
- GO LIVE success screen: "{Business Name} IS LIVE!!", booking link, Copy Link, Go to Admin
- Navigation to business admin dashboard

### 4. Validation & Testing
**Acceptance Criteria**:
- Setup Intent succeeds; subscription card stored; wallets toggles persisted
- Cash requires card-on-file constraint enforced at save time
- GO LIVE screen appears with working public booking link and admin link
- 3DS flows supported at checkout (prepared for Phase 5 reuse)

**Unit Tests**:
- Payment setup and validation
- Wallet configuration
- KYC form validation
- Go Live modal functionality
- 3DS flow handling

**E2E Tests**:
- Complete payment setup
- Wallet configuration
- KYC form submission
- Go Live flow
- Navigation to admin dashboard

**Manual QA**:
- [ ] Payment setup works
- [ ] Wallet toggles work
- [ ] KYC form validation works
- [ ] Go Live modal works
- [ ] Success screen displays correctly
- [ ] Mobile responsive design

### 5. Dependencies
**DependsOn**: T07 (gift cards), T08 (policies)
**Exposes**: Payment configuration, KYC data, business live status

### 6. Executive Rationale
This completes the onboarding and makes the business live. If this fails, business cannot accept payments. Risk: payment setup failure. Rollback: disable payments, show error toast.

### 7. North-Star Invariants
- Payment setup must be secure
- KYC data must be valid
- Cash rule must be enforced
- Go Live must be irreversible

### 8. Schema/DTO Freeze Note
```typescript
interface PaymentSetupData {
  id?: string;
  tenant_id: string;
  setup_intent_id: string;
  subscription_card_id: string;
  wallets: WalletConfig;
  kyc_data: KYCData;
  is_live: boolean;
  go_live_date?: string;
}

interface WalletConfig {
  cards: boolean;
  apple_pay: boolean;
  google_pay: boolean;
  paypal: boolean;
  cash: boolean;
  cash_requires_card: boolean;
}

// SHA-256: c3d4e5f6a1b2... (to be calculated from canonical JSON)
```

### 9. Observability Hooks
- `onboarding.step8_started` - when step loads
- `onboarding.step8_complete` - when step completes
- `payments.setup_intent_started` - when setup intent starts
- `payments.setup_intent_succeeded` - when setup intent succeeds
- `payments.setup_intent_failed` - when setup intent fails
- `owner.subscription_card_saved` - when subscription card is saved
- `owner.go_live_success` - when business goes live
- `wallets.toggle_update` - when wallet toggles are updated

### 10. Error Model Enforcement
- **Payment Errors**: Clear error messages for payment failures
- **KYC Errors**: Inline field errors with clear messages
- **Network Errors**: TithiError toast with retry
- **Server Errors**: Generic error toast with support contact

### 11. Idempotency & Retry
- Payment setup: POST with idempotency key
- Wallet updates: PUT with idempotency key
- Go Live: POST with idempotency key
- Retry strategy: 429 backoff with Retry-After header

### 12. Output Bundle
(note that things might have to be changed around based on the docuentation and context you read before executing, this is a example of something I'd like. )

```typescript
// PaymentSetup.tsx
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

export const PaymentSetup: React.FC<{
  onSetupComplete: (setupData: PaymentSetupData) => void;
  onError: (error: string) => void;
}> = ({ onSetupComplete, onError }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      // Stripe setup intent logic
      const setupData = await createSetupIntent();
      onSetupComplete(setupData);
    } catch (error) {
      onError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Elements stripe={stripePromise}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Card Information</label>
          <CardElement />
        </div>
        
        <div>
          <label className="flex items-center">
            <input type="checkbox" required />
            <span className="ml-2">I agree to the $11.99/month subscription</span>
          </label>
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Setting up...' : 'Setup Payment'}
        </button>
      </form>
    </Elements>
  );
};
```

**How to verify**:
1. Navigate to /onboarding/payments
2. Setup payment method
3. Configure wallets
4. Complete KYC form
5. Test Go Live modal
6. Verify success screen
7. Navigate to admin dashboard
8. Verify business is live

---
---
### 10.2 Task Execution Excellence & Progress Alignment

#### Task Prioritization & Perfect Execution

**Every executor must prioritize task completion and ensure perfect execution that directly advances the current phase toward its end goals.**

##### Task Understanding & Prioritization

* **Deep Task Analysis**: Before starting any work, thoroughly understand what the task requires and how it fits into the broader phase objectives.
* **Phase Goal Alignment**: Every task must be executed with the explicit understanding of how it contributes to fulfilling the current phase's requirements.
* **Dependency Mapping**: Identify all prerequisites and dependencies to ensure smooth execution and avoid blocking other tasks.
* **Progress Maximization**: Prioritize task execution to achieve maximum progress toward phase completion criteria.

##### Perfect Execution Standards

* **100% Requirement Fulfillment**: Every task must be completed to 100% of its specified requirements with no shortcuts or compromises.
* **Production‑Ready Quality**: All deliverables must meet production standards for reliability, security, and maintainability.
* **Comprehensive Implementation**: Address all aspects of the task including business logic, error handling, testing, documentation, and observability.
* **Zero Technical Debt**: Implement solutions that don't create future maintenance burden or architectural inconsistencies.

##### Phase Progress Alignment

* **Goal‑Oriented Execution**: Every task execution must be consciously aligned with advancing the current phase toward its end goals.
* **Success Criteria Focus**: Understand the phase completion criteria and ensure each task contributes meaningfully to achieving them.
* **Incremental Value**: Each task should build upon previous work and create a solid foundation for subsequent tasks.
* **Cohesive Integration**: Ensure all task deliverables integrate seamlessly with existing systems and planned future work.

##### Quality Assurance & Validation

* **Comprehensive Testing**: Implement thorough unit, integration, and contract tests that validate all functionality.
* **Error Handling**: Address all possible error scenarios with appropriate error codes and user‑friendly messages.
* **Security Validation**: Ensure all security requirements are met including RLS, data isolation, and compliance.
* **Performance Considerations**: Implement solutions that meet performance requirements and don't introduce bottlenecks.

##### Documentation & Knowledge Transfer

* **Complete Documentation**: Document all implementation decisions, patterns, and architectural choices.
* **Clear Rationale**: Provide clear explanations for why specific approaches were chosen.
* **Integration Guidance**: Include clear instructions for how the deliverable integrates with existing systems.
* **Future Considerations**: Document any assumptions or limitations that may affect future development.

**CRITICAL SUCCESS FACTOR: Every task execution must be viewed as a strategic step toward Tithi's overall success. The quality and completeness of each task directly impacts the platform's ability to deliver on its mission and serve its users effectively.**

## Acceptance Checklist (Quick PR Gate)

* [ ] Public flows show only tenant branding; favicon & og tags derived from logo.
* [ ] Primary color → token scale; contrast ≥ 4.5:1 enforced at save.
* [ ] Booking flow ≤ 5 taps; time‑zone chip visible on availability & checkout.
* [ ] Checkout copy states **charged after attendance**; policies acknowledged.
* [ ] Notifications limited to **1 + 2**, templates previewed, quiet hours enforced.
* [ ] Admin: **Attended/No‑show/Cancel** in ≤ 3 taps; payment status pill renders.
* [ ] PWA installable; offline queue for booking posts; replay on reconnect.
* [ ] A11y (AA) and Web Vitals budgets pass.
* [ ] Sentry errors scrub PII; events include tenant slug & trace id.

---

## **BACKEND BUSINESS LOGIC ANALYSIS & INFRASTRUCTURE GAP RESOLUTION**

### **Executive Summary of Backend Analysis**

After comprehensive analysis of the backend codebase, I can confirm that **the backend business logic for the onboarding infrastructure is actually COMPLETE and well-implemented**. The issue identified in the frontend report is not missing business logic, but rather a **mismatch between frontend API expectations and backend endpoint routing**.

### **✅ What Business Logic Actually Exists (COMPLETE)**

#### **1. Core Onboarding Business Logic - FULLY IMPLEMENTED**
**File**: `backend/app/blueprints/onboarding.py`
- ✅ Business registration with subdomain generation
- ✅ Default theme creation and branding setup
- ✅ Default policies configuration
- ✅ Tenant creation with comprehensive validation
- ✅ Idempotent registration handling
- ✅ Observability and audit logging

#### **2. Services & Catalog Management - FULLY IMPLEMENTED**
**File**: `backend/app/blueprints/api_v1.py` (lines 272-1362)
- ✅ Complete CRUD operations for services
- ✅ Service image upload functionality
- ✅ Service catalog management
- ✅ Category association and management
- ✅ Pricing and duration validation
- ✅ Service metadata and configuration

#### **3. Staff & Availability Management - FULLY IMPLEMENTED**
**File**: `backend/app/blueprints/api_v1.py` (lines 722-1317)
- ✅ Staff profile creation and management
- ✅ Work schedule configuration
- ✅ Availability slot calculation
- ✅ Staff assignment to services
- ✅ Real-time availability updates
- ✅ Multi-staff scheduling support

#### **4. Notification Templates - FULLY IMPLEMENTED**
**File**: `backend/app/blueprints/notification_api.py`
- ✅ Template CRUD operations
- ✅ Multi-channel support (email, SMS, push)
- ✅ Template preview and testing
- ✅ Quiet hours configuration
- ✅ Variable substitution and validation
- ✅ Template categorization and limits

#### **5. Gift Cards & Promotions - FULLY IMPLEMENTED**
**File**: `backend/app/blueprints/promotion_api.py`
- ✅ Gift card creation and management
- ✅ Balance tracking and validation
- ✅ Coupon system implementation
- ✅ Promotion application logic
- ✅ Expiration and usage tracking
- ✅ Bulk operations support

#### **6. Payment Setup & Processing - FULLY IMPLEMENTED**
**File**: `backend/app/blueprints/payment_api.py`
- ✅ Stripe integration and setup intents
- ✅ Wallet configuration management
- ✅ KYC data collection and validation
- ✅ Go-live functionality
- ✅ Payment method management
- ✅ Subscription handling

#### **7. Business Services Layer - COMPREHENSIVE**
**File**: `backend/app/services/business_phase2.py`
- ✅ ServiceService: Complete service management
- ✅ StaffService: Staff profile and scheduling
- ✅ AvailabilityService: Real-time availability calculation
- ✅ BookingService: Booking lifecycle management
- ✅ CustomerService: Customer relationship management
- ✅ StaffAvailabilityService: Availability rule management

### **❌ The Real Issue: Endpoint Mapping Gaps**

The problem is **NOT missing business logic** but **missing endpoint mappings** that connect existing business logic to frontend expectations:

#### **1. Categories Management Gap**
**Frontend Expects**: `/api/v1/categories/*` endpoints
**Backend Has**: Service management with category fields, but no dedicated categories CRUD
**Solution**: Add categories endpoints to `api_v1.py`

#### **2. Availability Rules Structure Gap**
**Frontend Expects**: `/api/v1/availability/rules/*` endpoints
**Backend Has**: `/api/v1/availability/{resource_id}/slots` (different structure)
**Solution**: Add availability rules endpoints with proper routing

#### **3. Admin Payment Endpoints Gap**
**Frontend Expects**: `/admin/payments/*` endpoints
**Backend Has**: Payment API but needs admin-specific routing
**Solution**: Add admin payment endpoints or configure proper routing

#### **4. Notification Endpoint Routing Gap**
**Frontend Expects**: `/notifications/*` endpoints
**Backend Has**: Same endpoints but may need URL prefix configuration
**Solution**: Configure proper URL routing for notification endpoints

### **🔧 Specific Implementation Plan to Resolve Gaps**

#### **Phase 1: Add Missing Endpoint Mappings (Immediate - 2-3 days)**

**1. Categories Endpoints**
```python
# Add to backend/app/blueprints/api_v1.py
@api_v1_bp.route("/categories", methods=["GET"])
@require_auth
@require_tenant
def list_categories():
    # Implementation using existing ServiceService

@api_v1_bp.route("/categories", methods=["POST"])
@require_auth
@require_tenant
def create_category():
    # Implementation using existing business logic

@api_v1_bp.route("/categories/<category_id>", methods=["GET", "PUT", "DELETE"])
# Similar implementations
```

**2. Availability Rules Endpoints**
```python
# Add to backend/app/blueprints/api_v1.py
@api_v1_bp.route("/availability/rules", methods=["GET", "POST"])
@api_v1_bp.route("/availability/rules/bulk", methods=["POST"])
@api_v1_bp.route("/availability/rules/validate", methods=["POST"])
@api_v1_bp.route("/availability/summary", methods=["GET"])
# Implementation using existing AvailabilityService
```

**3. Admin Payment Endpoints**
```python
# Add to backend/app/blueprints/admin_dashboard_api.py or create new admin_payment_api.py
@admin_bp.route("/payments/setup-intent", methods=["POST"])
@admin_bp.route("/payments/setup-intent/<id>/confirm", methods=["POST"])
@admin_bp.route("/payments/wallets/<tenant_id>", methods=["PUT"])
@admin_bp.route("/payments/kyc/<tenant_id>", methods=["POST", "PUT", "GET"])
@admin_bp.route("/payments/go-live/<tenant_id>", methods=["POST", "GET"])
# Implementation using existing PaymentService
```

**4. Fix Notification Routing**
```python
# Configure proper URL prefix in backend/app/__init__.py
app.register_blueprint(notification_bp, url_prefix='/notifications')
```

#### **Phase 2: Business Owner Dashboard Implementation (1-2 weeks)**

**Leverage Existing Business Logic**:
- Use existing `ServiceService` for service management
- Use existing `StaffService` for staff management
- Use existing `BookingService` for booking management
- Use existing `CustomerService` for customer management
- Use existing `AnalyticsService` for reporting

**Implementation Strategy**:
1. Create admin dashboard routes in `admin_dashboard_api.py`
2. Implement dashboard data aggregation endpoints
3. Add booking management interface endpoints
4. Create analytics and reporting endpoints
5. Implement settings management endpoints

#### **Phase 3: Customer Interface Implementation (1-2 weeks)**

**Leverage Existing Business Logic**:
- Use existing `AvailabilityService` for public booking
- Use existing `BookingService` for booking creation
- Use existing `PaymentService` for customer payments
- Use existing `PromotionService` for gift card redemption

**Implementation Strategy**:
1. Create public booking routes
2. Implement customer dashboard endpoints
3. Add payment processing for customers
4. Create gift card redemption flow
5. Implement booking confirmation system

### **📊 Infrastructure Integration Assessment**

#### **What's Already Working**
- ✅ **Multi-tenant Architecture**: Properly implemented with RLS
- ✅ **Authentication & Authorization**: JWT-based with role management
- ✅ **Database Models**: Comprehensive business models
- ✅ **Service Layer**: Well-structured business logic services
- ✅ **Error Handling**: Consistent error codes and messages
- ✅ **Audit Logging**: Complete audit trail implementation
- ✅ **API Structure**: RESTful API design patterns

#### **What Needs Connection**
- 🔄 **Endpoint Routing**: Map frontend expectations to existing logic
- 🔄 **Admin Dashboard**: Connect business logic to admin interface
- 🔄 **Public Booking**: Connect availability logic to customer interface
- 🔄 **Payment Flow**: Connect payment logic to customer checkout
- 🔄 **Analytics**: Connect business logic to reporting interface

### **🎯 Success Metrics for Gap Resolution**

#### **Technical Metrics**
- [ ] All frontend API calls resolve to working endpoints
- [ ] Business logic services are properly exposed via API
- [ ] Admin dashboard shows real business data
- [ ] Customer booking flow works end-to-end
- [ ] Payment processing works for both admin and customer

#### **Business Metrics**
- [ ] Business owners can manage their services post-onboarding
- [ ] Customers can book services through public interface
- [ ] Payment processing works for customer bookings
- [ ] Gift cards can be redeemed by customers
- [ ] Analytics show real business metrics

### **🚀 Implementation Priority**

#### **Immediate (Week 1)**
1. Add missing endpoint mappings
2. Fix notification routing
3. Test onboarding flow end-to-end
4. Verify all frontend API calls work

#### **Short-term (Weeks 2-3)**
1. Implement admin dashboard endpoints
2. Create booking management interface
3. Add customer booking endpoints
4. Implement payment processing for customers

#### **Medium-term (Weeks 4-6)**
1. Complete analytics and reporting
2. Add advanced booking features
3. Implement customer dashboard
4. Add gift card redemption flow

### **💡 Key Insight**

**The backend is not missing business logic - it's missing the API endpoints that expose the existing business logic to the frontend.** This is actually a much simpler problem to solve than building business logic from scratch. The comprehensive business logic already exists and is well-implemented; it just needs to be properly exposed through the API layer.

**This represents a significant opportunity**: Instead of building new business logic, we can leverage the existing, well-tested business logic and simply add the missing API endpoints to connect it to the frontend infrastructure.
