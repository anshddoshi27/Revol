# Tithi Frontend Phase 8 & 9 Ticketed Prompts

**Purpose**: Mature ticketed prompts for Phase 8 (Production Hardening) and Phase 9 (Release & Growth) tasks from the approved Frontend Task Graph.

**Source**: Frontend Task Graph, TITHI_FRONTEND_DESIGN_BRIEF.md, frontend-context-pack/all_context_pack.ts

---

## Phase 8 — Production Hardening

### Phase 8 Goal & Exit Criteria

**Goal**: Ship a production-grade frontend that consistently meets WCAG 2.1 AA, Web Vitals targets, browser/device coverage, stable pagination/filtering, canonicalized payments flow, and fully wired telemetry with schema guarantees.

**Exit Criteria to Phase 9**:
- Axe CI ≥ 98% per route; no keyboard traps; all interactive controls labeled
- Web Vitals thresholds met: Public: LCP p75 < 2.5s, CLS p75 < 0.1, INP p75 < 200ms. Admin: LCP p75 < 2.0s
- Initial bundle < 500KB; major route bundles < 250KB
- i18n foundation in place (ICU messages; locale, currency, timezone correctness throughout booking)
- Cross-browser matrix green on Chromium/Firefox/WebKit + iOS/Android emulations; flake < 2%
- Event taxonomy enforced at runtime; 0 schema validation errors in CI replay; event drop rate < 1%
- Shared pagination/filtering implemented across lists; URL-synced and idempotent
- Canonical payments abstraction used across Public Checkout and Admin Attendance; idempotent + 3DS + 429/backoff proven in tests

---

## Task T26 — A11y & Perf Hardening (P8)

You are implementing Task T26: A11y & Perf Hardening from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.4**: "Performance Requirements: Page Load Time < 2 seconds, Bundle Size < 500KB initial load"
- **Brief §4.5**: "Accessibility Requirements: WCAG Compliance 2.1 AA level, Keyboard Navigation, Screen Reader compatibility"
- **CP §"apiClient"**: Rate limiting and retry logic with Retry-After header support
- **Task Graph T26**: "Bake in WCAG 2.1 AA compliance and Web Vitals budgets across all critical routes"

This task ensures production-grade accessibility and performance across all routes with automated CI enforcement.

### 1. Deliverables
**Code**:
- `/src/hooks/useWebVitals.ts` - Web Vitals collection and reporting
- `/src/components/accessibility/AccessibilityProvider.tsx` - A11y context and utilities
- `/src/utils/performance.ts` - Performance monitoring utilities
- `/src/styles/accessibility.css` - Focus management and reduced motion styles
- `/playwright.config.ts` - Updated with accessibility and performance tests
- `/vitest.config.ts` - Updated with coverage thresholds

**Contracts**:
- `WebVitalsMetrics` interface with LCP, CLS, INP, FCP fields
- `AccessibilityAudit` interface with Axe results structure
- Performance budget configuration schema

**Docs**:
- `/docs/accessibility-guidelines.md` - WCAG 2.1 AA implementation guide
- `/docs/performance-budgets.md` - Web Vitals targets and measurement
- Storybook stories for accessibility components

**Tests**:
- `__tests__/accessibility/axe-audit.test.ts` - Automated accessibility testing
- `__tests__/performance/web-vitals.test.ts` - Performance monitoring tests
- `e2e/accessibility.spec.ts` - End-to-end accessibility validation
- `e2e/performance.spec.ts` - End-to-end performance validation

### 2. Constraints
- **WCAG 2.1 AA**: All interactive elements must be keyboard accessible, color contrast ≥ 4.5:1
- **Performance**: Public routes LCP p75 < 2.5s, Admin routes LCP p75 < 2.0s, CLS p75 < 0.1, INP p75 < 200ms
- **Bundle Size**: Initial bundle < 500KB, route bundles < 250KB
- **Branding**: Visual snapshots must prevent white-label regressions (logo placement rules)
- **Do-Not-Invent**: Use only performance metrics defined in Web Vitals spec; flag any custom metrics as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- Current route components and layouts
- Web Vitals API and browser performance APIs
- Axe-core accessibility testing library
- Tailwind CSS configuration for responsive breakpoints
- Branding placement rules from design system

**Outputs**:
- Automated CI pipeline with accessibility and performance gates
- Real-time performance monitoring with alerting
- Accessibility audit reports with actionable remediation
- Visual regression snapshots for branding consistency
- Performance budget enforcement with build failures

### 4. Validation & Testing
**Acceptance Criteria**:
- Axe score ≥ 98% on every route with zero critical violations
- No keyboard traps; all form fields programmatically labeled
- Web Vitals thresholds met across all supported browsers
- Visual snapshots prevent white-label regressions
- Performance budgets enforced in CI with build failures

**Unit Test Matrix**:
- Web Vitals collection accuracy across different browsers
- Accessibility utility functions with edge cases
- Performance monitoring with mock data
- Focus management with keyboard navigation
- Color contrast validation with various color combinations

**Contract Tests**:
- Web Vitals payload schema validation
- Accessibility audit result structure
- Performance budget configuration schema

**E2E Steps**:
- Given a user navigates to any route, When accessibility audit runs, Then all WCAG 2.1 AA criteria pass
- Given a user loads any page, When Web Vitals are measured, Then all thresholds are met
- Given a user uses keyboard navigation, When tabbing through interface, Then focus is visible and logical

**Manual QA Checklist**:
- [ ] Screen reader compatibility (NVDA, JAWS, VoiceOver)
- [ ] Keyboard-only navigation through all flows
- [ ] Color contrast validation with color picker tool
- [ ] Performance measurement on slow 3G connection
- [ ] Visual regression check for logo placement

### 5. Dependencies
**DependsOn**:
- T01 (API Client) - For performance monitoring API calls
- T03 (Design System) - For branding tokens and visual regression baselines
- All previous route implementations - For comprehensive testing coverage

**Exposes**:
- `useWebVitals()` hook for performance monitoring
- `useAccessibility()` hook for a11y utilities
- Performance budget configuration for CI
- Accessibility audit utilities for testing

### 6. Executive Rationale
This task is critical for production readiness and legal compliance. Poor accessibility can result in lawsuits and exclusion of users, while performance issues directly impact conversion rates and user experience. The automated CI enforcement prevents regressions and ensures consistent quality standards.

**Risk/Impact**: High - Accessibility violations can result in legal action; performance issues directly impact business metrics
**Rollback Plan**: Disable CI gates temporarily while fixing issues; maintain performance budgets as warnings initially

### 7. North-Star Invariants
- **Accessibility First**: All new components must pass WCAG 2.1 AA before merge
- **Performance Budgets**: No route can exceed established performance thresholds
- **Branding Consistency**: Visual snapshots prevent logo placement regressions
- **Cross-Browser Parity**: All features work identically across supported browsers
- **Progressive Enhancement**: Core functionality works without JavaScript

### 8. Schema/DTO Freeze Note
```typescript
interface WebVitalsMetrics {
  lcp: number; // Largest Contentful Paint in ms
  cls: number; // Cumulative Layout Shift
  inp: number; // Interaction to Next Paint in ms
  fcp: number; // First Contentful Paint in ms
  ttfb: number; // Time to First Byte in ms
  route: string;
  timestamp: number;
}

interface AccessibilityAudit {
  score: number; // 0-100
  violations: Array<{
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    nodes: Array<{ target: string[]; html: string }>;
  }>;
  route: string;
  timestamp: number;
}
```

**SHA-256 Hash**: `a1b2c3d4e5f6...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `perf.vitals_measured` - { route, lcp, cls, inp, fcp, ttfb }
- `a11y.audit_completed` - { route, score, violation_count }
- `perf.budget_exceeded` - { route, metric, actual, threshold }
- `a11y.violation_detected` - { route, violation_id, impact }

**Metrics**:
- Performance budget compliance rate
- Accessibility score distribution
- Web Vitals percentile tracking
- CI pipeline success rate

**Trace Boundaries**:
- `pageLoad` → `vitalsCollected` → `auditCompleted` → `reportGenerated`

### 10. Error Model Enforcement
**Error Classes**:
- `PerformanceError` - Budget exceeded, slow API responses
- `AccessibilityError` - WCAG violations, keyboard traps
- `MonitoringError` - Failed to collect metrics, API unavailable

**Mapping**:
- Performance budget exceeded → Warning toast + telemetry → `perf.budget_exceeded`
- Accessibility violation → Error in CI + detailed report → `a11y.violation_detected`
- Monitoring failure → Fallback to basic metrics → `monitoring.fallback_used`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Performance metric collection (same route = same measurement window)
- Accessibility audit (same DOM = same results)
- Visual regression snapshots (same viewport = same image)

**Retry Strategy**:
- Performance monitoring: Exponential backoff for failed API calls
- Accessibility audits: Retry once on timeout, then use cached results
- Visual snapshots: No retry needed (deterministic)

### 12. Output Bundle

```typescript
// /src/hooks/useWebVitals.ts
import { useEffect, useState } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

interface WebVitalsMetrics {
  lcp: number;
  cls: number;
  inp: number;
  fcp: number;
  ttfb: number;
  route: string;
  timestamp: number;
}

export const useWebVitals = (route: string) => {
  const [metrics, setMetrics] = useState<WebVitalsMetrics | null>(null);

  useEffect(() => {
    const collectMetrics = () => {
      const vitals: Partial<WebVitalsMetrics> = {
        route,
        timestamp: Date.now(),
      };

      getCLS((metric) => { vitals.cls = metric.value; });
      getFCP((metric) => { vitals.fcp = metric.value; });
      getLCP((metric) => { vitals.lcp = metric.value; });
      getTTFB((metric) => { vitals.ttfb = metric.value; });
      
      // INP is the new FID
      getFID((metric) => { vitals.inp = metric.value; });

      setMetrics(vitals as WebVitalsMetrics);
    };

    // Collect metrics after page load
    const timer = setTimeout(collectMetrics, 1000);
    return () => clearTimeout(timer);
  }, [route]);

  return metrics;
};
```

```typescript
// /src/components/accessibility/AccessibilityProvider.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { axe, toHaveNoViolations } from 'jest-axe';

interface AccessibilityContextType {
  auditRoute: (route: string) => Promise<void>;
  isKeyboardUser: boolean;
  reducedMotion: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Detect keyboard user
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true);
      }
    };

    // Detect reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const auditRoute = async (route: string) => {
    const results = await axe(document.body);
    if (results.violations.length > 0) {
      console.error('Accessibility violations:', results.violations);
    }
  };

  return (
    <AccessibilityContext.Provider value={{ auditRoute, isKeyboardUser, reducedMotion }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};
```

**How to Verify**:
1. Run `npm run test:accessibility` - should pass all Axe audits
2. Run `npm run test:performance` - should meet all Web Vitals thresholds
3. Navigate through all routes using only keyboard - focus should be visible and logical
4. Check CI pipeline - should fail build if accessibility or performance thresholds not met
5. Verify visual regression snapshots prevent logo placement changes

---

## Task T27 — Observability & Analytics Wiring (P8)

You are implementing Task T27: Observability & Analytics Wiring from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.6**: "Monitoring & Analytics: Error Tracking with Sentry integration, Performance Monitoring with Web Vitals tracking"
- **CP §"apiClient"**: Error handling with TithiError interface and structured error responses
- **Task Graph T27**: "Provide a single useTelemetry() hook that validates event payloads against the approved taxonomy"

This task creates a unified telemetry system that validates all analytics events against a schema and ensures PII compliance.

### 1. Deliverables
**Code**:
- `/src/hooks/useTelemetry.ts` - Main telemetry hook with schema validation
- `/src/utils/telemetry.ts` - Event validation and PII redaction utilities
- `/src/services/analytics.ts` - Analytics service with sampling and batching
- `/src/types/analytics.ts` - Event taxonomy and schema definitions
- `/src/providers/TelemetryProvider.tsx` - Context provider for telemetry

**Contracts**:
- `AnalyticsEvent` interface with PII flags and validation
- `EventTaxonomy` schema with all approved event names and payloads
- Sentry integration configuration

**Docs**:
- `/docs/analytics-events.json` - Complete event taxonomy with examples
- `/docs/telemetry-implementation.md` - Implementation guide for developers
- Storybook stories for telemetry components

**Tests**:
- `__tests__/telemetry/event-validation.test.ts` - Schema validation tests
- `__tests__/telemetry/pii-redaction.test.ts` - PII compliance tests
- `__tests__/telemetry/sampling.test.ts` - Sampling logic tests
- `e2e/telemetry.spec.ts` - End-to-end telemetry validation

### 2. Constraints
- **Schema Validation**: All events must validate against approved taxonomy
- **PII Compliance**: No sensitive data in telemetry payloads
- **Performance**: Telemetry must be non-blocking with < 10ms overhead
- **Sampling**: Production 100%, staging 10% event sampling
- **Do-Not-Invent**: Use only event names from approved taxonomy; flag new events as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- Approved analytics event taxonomy
- Sentry DSN configuration
- PII redaction rules and field mappings
- Sampling configuration by environment

**Outputs**:
- Unified telemetry system with runtime validation
- CI replay system for schema validation
- Sentry integration with structured error reporting
- Analytics dashboard with event tracking

### 4. Validation & Testing
**Acceptance Criteria**:
- 0 invalid events in CI replay with schema validation
- Event drop rate < 1% in staging environment
- All critical flows emit required events
- PII flags respected with automatic redaction

**Unit Test Matrix**:
- Event schema validation with valid and invalid payloads
- PII redaction with various data types
- Sampling logic with different rates
- Sentry integration with mock errors
- Event batching and retry logic

**Contract Tests**:
- Event taxonomy schema validation
- PII field mapping verification
- Sentry error payload structure

**E2E Steps**:
- Given a user completes onboarding, When events are emitted, Then all required events validate against schema
- Given a user makes a booking, When payment succeeds, Then success events are tracked with correct payload
- Given an error occurs, When telemetry processes it, Then PII is redacted and Sentry receives structured data

**Manual QA Checklist**:
- [ ] Verify no PII in network requests to analytics endpoints
- [ ] Check Sentry dashboard for structured error reports
- [ ] Validate event sampling rates in different environments
- [ ] Test telemetry performance impact on page load
- [ ] Verify CI replay catches schema violations

### 5. Dependencies
**DependsOn**:
- T01 (API Client) - For error handling and retry logic
- T26 (A11y & Perf) - For performance monitoring integration

**Exposes**:
- `useTelemetry()` hook for event tracking
- `analytics.schema_loaded` event for system initialization
- Event validation utilities for testing
- PII redaction utilities for data protection

### 6. Executive Rationale
This task is essential for data-driven decision making and compliance. Without proper telemetry, we cannot measure product success or debug issues effectively. The schema validation prevents data quality issues that could lead to incorrect business decisions.

**Risk/Impact**: High - Poor telemetry leads to blind spots in product analytics and compliance violations
**Rollback Plan**: Disable telemetry temporarily while fixing schema issues; maintain basic error tracking

### 7. North-Star Invariants
- **Schema Compliance**: All events must validate against approved taxonomy
- **PII Protection**: No sensitive data ever leaves the client
- **Performance First**: Telemetry never blocks user interactions
- **Data Quality**: Invalid events are rejected, not silently dropped
- **Observability**: All system events are trackable and debuggable

### 8. Schema/DTO Freeze Note
```typescript
interface AnalyticsEvent {
  name: string;
  payload: Record<string, any>;
  timestamp: number;
  session_id: string;
  user_id?: string;
  tenant_id?: string;
  pii_fields: string[];
}

interface EventTaxonomy {
  [eventName: string]: {
    schema: Record<string, any>;
    required_fields: string[];
    pii_fields: string[];
    sampling_rate: number;
  };
}
```

**SHA-256 Hash**: `b2c3d4e5f6g7...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `analytics.schema_loaded` - { version, event_count }
- `telemetry.emit_failed` - { event_name, error, retry_count }
- `telemetry.pii_detected` - { field_name, redaction_applied }
- `analytics.sampling_applied` - { event_name, rate, decision }

**Metrics**:
- Event validation success rate
- PII redaction frequency
- Telemetry performance overhead
- Sentry error reporting rate

**Trace Boundaries**:
- `eventEmit` → `schemaValidate` → `piiRedact` → `batchSend` → `sentryReport`

### 10. Error Model Enforcement
**Error Classes**:
- `SchemaValidationError` - Event doesn't match approved taxonomy
- `PIILeakError` - Sensitive data detected in payload
- `TelemetryError` - Failed to send event, network issues

**Mapping**:
- Schema validation failure → Event rejected + logged → `telemetry.schema_error`
- PII detection → Data redacted + alert → `telemetry.pii_detected`
- Send failure → Retry with backoff → `telemetry.emit_failed`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Event emission (same event + timestamp = deduplicated)
- Schema validation (same payload = same result)
- PII redaction (same data = same redacted output)

**Retry Strategy**:
- Event sending: Exponential backoff with jitter, max 3 retries
- Schema validation: No retry needed (deterministic)
- Sentry reporting: Immediate retry on network failure

### 12. Output Bundle

```typescript
// /src/hooks/useTelemetry.ts
import { useCallback, useContext } from 'react';
import { TelemetryContext } from '../providers/TelemetryProvider';
import { validateEvent, redactPII } from '../utils/telemetry';

export const useTelemetry = () => {
  const { emit, isEnabled } = useContext(TelemetryContext);

  const track = useCallback(async (eventName: string, payload: Record<string, any> = {}) => {
    if (!isEnabled) return;

    try {
      // Validate against schema
      const validation = validateEvent(eventName, payload);
      if (!validation.valid) {
        console.error('Event validation failed:', validation.errors);
        return;
      }

      // Redact PII
      const redactedPayload = redactPII(payload, validation.piiFields);

      // Emit event
      await emit({
        name: eventName,
        payload: redactedPayload,
        timestamp: Date.now(),
        session_id: getSessionId(),
        pii_fields: validation.piiFields,
      });
    } catch (error) {
      console.error('Telemetry error:', error);
    }
  }, [emit, isEnabled]);

  return { track };
};
```

```typescript
// /src/utils/telemetry.ts
import { EventTaxonomy } from '../types/analytics';

export const validateEvent = (eventName: string, payload: Record<string, any>) => {
  const taxonomy = getEventTaxonomy();
  const eventSchema = taxonomy[eventName];
  
  if (!eventSchema) {
    return { valid: false, errors: [`Unknown event: ${eventName}`] };
  }

  const errors: string[] = [];
  
  // Check required fields
  for (const field of eventSchema.required_fields) {
    if (!(field in payload)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate field types (simplified)
  for (const [field, value] of Object.entries(payload)) {
    const expectedType = eventSchema.schema[field];
    if (expectedType && typeof value !== expectedType) {
      errors.push(`Invalid type for ${field}: expected ${expectedType}, got ${typeof value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    piiFields: eventSchema.pii_fields,
  };
};

export const redactPII = (payload: Record<string, any>, piiFields: string[]): Record<string, any> => {
  const redacted = { ...payload };
  
  for (const field of piiFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  
  return redacted;
};
```

**How to Verify**:
1. Run `npm run test:telemetry` - should pass all schema validation tests
2. Check network requests - no PII should be visible in analytics calls
3. Verify Sentry dashboard shows structured error reports
4. Test event sampling rates in different environments
5. Run CI replay - should catch any schema violations

---

## Task T28 — Test Suite & CI Gates (P8)

You are implementing Task T28: Test Suite & CI Gates from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.7**: "Testing Strategy: Unit Testing 90%+ coverage for React components, Integration Testing 80%+ coverage for API endpoints"
- **CP §"apiClient"**: Error handling patterns and retry logic for testing
- **Task Graph T28**: "Raise quality bars across unit, hooks, API integration, E2E, and visual regression"

This task establishes comprehensive testing infrastructure with automated CI gates to prevent regressions.

### 1. Deliverables
**Code**:
- `/jest.config.js` - Jest configuration with coverage thresholds
- `/playwright.config.ts` - Playwright E2E configuration
- `/vitest.config.ts` - Vitest configuration for unit tests
- `/src/test-utils/` - Testing utilities and helpers
- `/src/__mocks__/` - Mock implementations for external dependencies
- `/e2e/` - End-to-end test suites
- `/tests/` - Unit and integration test suites

**Contracts**:
- Test coverage configuration with thresholds
- E2E test data fixtures and seed data
- Mock server configuration for API testing

**Docs**:
- `/docs/testing-strategy.md` - Comprehensive testing guide
- `/docs/ci-gates.md` - CI pipeline configuration
- Storybook stories with test scenarios

**Tests**:
- Complete test suite covering all critical user journeys
- Visual regression tests for branding consistency
- Performance tests for Web Vitals compliance
- Accessibility tests with Axe integration

### 2. Constraints
- **Coverage Targets**: Components 90%+, Hooks 95%+, API 80%+
- **E2E Coverage**: All critical flows (Onboarding, Booking, Payment, Admin)
- **CI Performance**: Complete test suite must run in < 10 minutes
- **Flake Rate**: < 2% flaky test rate across all environments
- **Do-Not-Invent**: Use only established testing patterns; flag new testing approaches as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- All existing components and pages
- API endpoints and data models
- User journey specifications
- Performance and accessibility requirements

**Outputs**:
- Automated test suite with CI integration
- Coverage reports and quality gates
- E2E test results with screenshots
- Visual regression baselines

### 4. Validation & Testing
**Acceptance Criteria**:
- All coverage bars pass with enforced thresholds
- E2E tests green for all critical user journeys
- Visual regression tests prevent branding changes
- CI pipeline fails on test failures or coverage drops

**Unit Test Matrix**:
- Component rendering with various props
- Hook behavior with different state scenarios
- API integration with success and error cases
- Utility functions with edge cases
- Error handling and retry logic

**Contract Tests**:
- API response schema validation
- Component prop type checking
- Event payload structure validation

**E2E Steps**:
- Given a new user, When they complete onboarding, Then they can create their first booking
- Given a business owner, When they mark attendance, Then payment is processed correctly
- Given a customer, When they book a service, Then they receive confirmation

**Manual QA Checklist**:
- [ ] Run full test suite locally - should pass all tests
- [ ] Check coverage reports - should meet all thresholds
- [ ] Verify E2E tests work in different browsers
- [ ] Test CI pipeline with intentional failures
- [ ] Validate visual regression baselines

### 5. Dependencies
**DependsOn**:
- All previous tasks - For comprehensive test coverage
- T26 (A11y & Perf) - For accessibility and performance tests
- T27 (Observability) - For telemetry testing

**Exposes**:
- Test utilities for other developers
- CI configuration for automated testing
- Coverage reports for quality tracking
- E2E test data for manual testing

### 6. Executive Rationale
This task is critical for maintaining code quality and preventing regressions. Without comprehensive testing, bugs can reach production and impact user experience. The CI gates ensure that quality standards are maintained as the codebase grows.

**Risk/Impact**: High - Poor testing leads to production bugs and technical debt
**Rollback Plan**: Temporarily lower coverage thresholds while fixing issues; maintain critical E2E tests

### 7. North-Star Invariants
- **Quality First**: No code merges without passing tests
- **Coverage Enforcement**: Coverage thresholds are non-negotiable
- **E2E Reliability**: Critical user journeys must always work
- **Visual Consistency**: Branding changes must be intentional
- **Performance Standards**: Tests must not slow down development

### 8. Schema/DTO Freeze Note
```typescript
interface TestConfig {
  coverage: {
    components: number; // 90
    hooks: number; // 95
    api: number; // 80
  };
  e2e: {
    timeout: number; // 30000
    retries: number; // 2
    browsers: string[]; // ['chromium', 'firefox', 'webkit']
  };
  visual: {
    threshold: number; // 0.2
    viewports: Array<{ width: number; height: number }>;
  };
}
```

**SHA-256 Hash**: `c3d4e5f6g7h8...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `qa.test_suite_started` - { suite_type, test_count }
- `qa.test_failed` - { test_name, error, retry_count }
- `qa.coverage_report` - { coverage_percentages, thresholds }
- `qa.e2e_completed` - { journey, duration, screenshots }

**Metrics**:
- Test execution time and success rate
- Coverage trend over time
- E2E test flake rate
- CI pipeline performance

**Trace Boundaries**:
- `testStart` → `testExecution` → `coverageCollection` → `reportGeneration`

### 10. Error Model Enforcement
**Error Classes**:
- `TestFailureError` - Unit or integration test failure
- `CoverageError` - Coverage threshold not met
- `E2EError` - End-to-end test failure
- `VisualRegressionError` - Visual test failure

**Mapping**:
- Test failure → CI build failure + detailed logs → `qa.test_failed`
- Coverage drop → Build failure + coverage report → `qa.coverage_error`
- E2E failure → Retry + screenshot → `qa.e2e_failed`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Test execution (same code = same results)
- Coverage collection (same code = same coverage)
- Visual regression (same viewport = same image)

**Retry Strategy**:
- E2E tests: Retry twice on failure, then fail
- API tests: Retry on network errors
- Visual tests: No retry (deterministic)

### 12. Output Bundle

```typescript
// /jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-utils/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-utils/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/components/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/hooks/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
};
```

```typescript
// /playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

```typescript
// /e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('complete onboarding journey', async ({ page }) => {
    // Step 1: Business Details
    await page.goto('/onboarding/details');
    await page.fill('[data-testid="business-name"]', 'Test Salon');
    await page.selectOption('[data-testid="timezone"]', 'America/New_York');
    await page.click('[data-testid="save-continue"]');

    // Step 2: Logo & Colors
    await page.goto('/onboarding/logo-colors');
    await page.setInputFiles('[data-testid="logo-upload"]', 'test-logo.png');
    await page.click('[data-testid="color-picker"]');
    await page.click('[data-testid="save-continue"]');

    // Step 3: Services
    await page.goto('/onboarding/services');
    await page.fill('[data-testid="service-name"]', 'Haircut');
    await page.fill('[data-testid="service-price"]', '50');
    await page.fill('[data-testid="service-duration"]', '60');
    await page.click('[data-testid="save-continue"]');

    // Continue through all steps...
    
    // Final: GO LIVE
    await page.goto('/onboarding/payments');
    await page.click('[data-testid="go-live"]');
    
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-link"]')).toBeVisible();
  });
});
```

**How to Verify**:
1. Run `npm run test` - should pass all unit tests with coverage
2. Run `npm run test:e2e` - should pass all E2E tests
3. Run `npm run test:visual` - should pass visual regression tests
4. Check CI pipeline - should fail on test failures
5. Verify coverage reports meet all thresholds

---

## Task T37 — Cross-Browser & Mobile QA Gates (P8)

You are implementing Task T37: Cross-Browser & Mobile QA Gates from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.8**: "Browser Support: Modern Browsers Chrome 90+, Firefox 88+, Safari 14+, Edge 90+, Mobile Browsers iOS Safari 14+, Chrome Mobile 90+"
- **Brief §4.9**: "Responsive Design: Mobile-first approach with responsive breakpoints"
- **Task Graph T37**: "Guarantee consistent UX on modern desktop & mobile"

This task ensures consistent user experience across all supported browsers and devices with automated testing.

### 1. Deliverables
**Code**:
- `/playwright.config.ts` - Updated with cross-browser matrix
- `/e2e/cross-browser/` - Browser-specific test suites
- `/e2e/mobile/` - Mobile device test suites
- `/src/test-utils/browser-helpers.ts` - Browser detection and utilities
- `/src/hooks/useBrowserDetection.ts` - Browser capability detection

**Contracts**:
- Browser support matrix configuration
- Device viewport specifications
- Cross-browser compatibility test data

**Docs**:
- `/docs/browser-support.md` - Supported browsers and devices
- `/docs/mobile-testing.md` - Mobile testing guidelines
- Storybook stories for responsive components

**Tests**:
- Cross-browser E2E test suites
- Mobile device simulation tests
- Responsive design validation tests
- Browser-specific feature tests

### 2. Constraints
- **Browser Matrix**: Chromium, WebKit, Firefox, iOS Safari, Chrome Mobile
- **Flake Rate**: < 2% across all browser combinations
- **Mobile First**: All components must work on mobile devices
- **Responsive**: No horizontal scroll on XS breakpoints
- **Do-Not-Invent**: Use only established browser testing patterns; flag new browser requirements as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- All existing components and pages
- Responsive breakpoint definitions
- Browser capability requirements
- Mobile device specifications

**Outputs**:
- Automated cross-browser test suite
- Mobile device test results
- Browser compatibility reports
- Responsive design validation

### 4. Validation & Testing
**Acceptance Criteria**:
- All key routes pass smoke tests on browser matrix
- Screenshot diffs approved for visual consistency
- Flake rate < 2% across all environments
- Mobile first paint meets performance budgets

**Unit Test Matrix**:
- Browser detection accuracy
- Responsive breakpoint behavior
- Mobile-specific component variants
- Cross-browser API compatibility

**Contract Tests**:
- Browser capability detection
- Device viewport handling
- Responsive image loading

**E2E Steps**:
- Given a user on Chrome, When they complete booking flow, Then all features work correctly
- Given a user on mobile Safari, When they navigate the app, Then layout is responsive
- Given a user on Firefox, When they use keyboard navigation, Then focus management works

**Manual QA Checklist**:
- [ ] Test all critical flows on each supported browser
- [ ] Verify responsive design on various screen sizes
- [ ] Check mobile touch interactions and gestures
- [ ] Validate keyboard navigation across browsers
- [ ] Test performance on mobile devices

### 5. Dependencies
**DependsOn**:
- T26 (A11y & Perf) - For accessibility and performance testing
- T28 (Test Suite) - For E2E test infrastructure

**Exposes**:
- Cross-browser test utilities
- Mobile testing helpers
- Browser compatibility reports
- Responsive design validation tools

### 6. Executive Rationale
This task is essential for ensuring broad user accessibility and preventing browser-specific bugs. Different browsers have varying capabilities and behaviors, and mobile devices have unique constraints that must be addressed.

**Risk/Impact**: High - Browser compatibility issues can exclude users and damage brand reputation
**Rollback Plan**: Disable problematic browser tests temporarily while fixing issues; maintain core browser support

### 7. North-Star Invariants
- **Universal Access**: All features work on all supported browsers
- **Mobile First**: Mobile experience is never compromised
- **Responsive Design**: Layout adapts correctly to all screen sizes
- **Performance Parity**: Similar performance across all browsers
- **Feature Consistency**: Same functionality regardless of browser

### 8. Schema/DTO Freeze Note
```typescript
interface BrowserSupport {
  desktop: {
    chromium: { min_version: string; features: string[] };
    firefox: { min_version: string; features: string[] };
    webkit: { min_version: string; features: string[] };
  };
  mobile: {
    ios_safari: { min_version: string; devices: string[] };
    chrome_mobile: { min_version: string; devices: string[] };
  };
  viewports: Array<{ name: string; width: number; height: number }>;
}
```

**SHA-256 Hash**: `d4e5f6g7h8i9...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `qa.browser_test_started` - { browser, version, device }
- `qa.browser_test_failed` - { browser, test_name, error }
- `qa.mobile_test_completed` - { device, viewport, performance }
- `qa.responsive_validation` - { breakpoint, layout_issues }

**Metrics**:
- Browser test success rate by browser
- Mobile performance metrics
- Responsive design validation results
- Cross-browser feature compatibility

**Trace Boundaries**:
- `browserTestStart` → `featureValidation` → `performanceCheck` → `reportGeneration`

### 10. Error Model Enforcement
**Error Classes**:
- `BrowserCompatibilityError` - Feature not supported in browser
- `MobileLayoutError` - Responsive design issues
- `PerformanceError` - Browser-specific performance issues

**Mapping**:
- Browser compatibility issue → Test failure + browser report → `qa.browser_incompatible`
- Mobile layout issue → Screenshot diff + layout report → `qa.mobile_layout_error`
- Performance issue → Performance report + optimization suggestions → `qa.browser_performance_issue`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Browser capability detection (same browser = same capabilities)
- Responsive layout testing (same viewport = same layout)
- Mobile performance testing (same device = same performance)

**Retry Strategy**:
- Browser tests: Retry twice on flaky failures
- Mobile tests: Retry on network issues
- Screenshot tests: No retry (deterministic)

### 12. Output Bundle

```typescript
// /playwright.config.ts (updated)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Mobile Safari iPad',
      use: { ...devices['iPad Pro'] },
    },
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

```typescript
// /src/hooks/useBrowserDetection.ts
import { useState, useEffect } from 'react';

interface BrowserInfo {
  name: string;
  version: string;
  isMobile: boolean;
  isTouch: boolean;
  viewport: { width: number; height: number };
}

export const useBrowserDetection = (): BrowserInfo => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>({
    name: 'unknown',
    version: 'unknown',
    isMobile: false,
    isTouch: false,
    viewport: { width: 0, height: 0 },
  });

  useEffect(() => {
    const detectBrowser = () => {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      let name = 'unknown';
      let version = 'unknown';
      
      if (userAgent.includes('Chrome')) {
        name = 'chrome';
        version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
      } else if (userAgent.includes('Firefox')) {
        name = 'firefox';
        version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'unknown';
      } else if (userAgent.includes('Safari')) {
        name = 'safari';
        version = userAgent.match(/Version\/(\d+)/)?.[1] || 'unknown';
      }

      setBrowserInfo({
        name,
        version,
        isMobile,
        isTouch,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });
    };

    detectBrowser();
    window.addEventListener('resize', detectBrowser);
    return () => window.removeEventListener('resize', detectBrowser);
  }, []);

  return browserInfo;
};
```

```typescript
// /e2e/cross-browser/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Booking Flow Cross-Browser', () => {
  test('complete booking on all browsers', async ({ page, browserName }) => {
    await page.goto('/v1/test-salon');
    
    // Service selection
    await page.click('[data-testid="service-card"]');
    await expect(page.locator('[data-testid="service-selected"]')).toBeVisible();
    
    // Availability selection
    await page.click('[data-testid="time-slot"]');
    await expect(page.locator('[data-testid="time-selected"]')).toBeVisible();
    
    // Customer info
    await page.fill('[data-testid="customer-name"]', 'Test Customer');
    await page.fill('[data-testid="customer-email"]', 'test@example.com');
    
    // Payment (if applicable)
    if (await page.locator('[data-testid="payment-section"]').isVisible()) {
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');
    }
    
    // Submit booking
    await page.click('[data-testid="book-now"]');
    
    // Verify success
    await expect(page.locator('[data-testid="booking-success"]')).toBeVisible();
    
    // Take screenshot for visual regression
    await page.screenshot({ 
      path: `screenshots/booking-success-${browserName}.png`,
      fullPage: true 
    });
  });
});
```

**How to Verify**:
1. Run `npm run test:cross-browser` - should pass on all supported browsers
2. Run `npm run test:mobile` - should pass on all mobile devices
3. Check screenshot diffs - should show consistent layouts
4. Verify responsive design on various screen sizes
5. Test touch interactions on mobile devices

---

## Task T38 — i18n Foundation (P8)

You are implementing Task T38: i18n Foundation from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.10**: "Localization: Support for multiple languages and regions with proper date/time formatting"
- **CP §"types/core"**: Tenant timezone and currency fields
- **Task Graph T38**: "Localize strings and normalize date/time/currency; show tenant timezone consistently in booking"

This task establishes internationalization foundation with proper locale handling and tenant-specific formatting.

### 1. Deliverables
**Code**:
- `/src/i18n/` - Internationalization configuration and utilities
- `/src/hooks/useLocale.ts` - Locale detection and management
- `/src/utils/formatting.ts` - Date, time, and currency formatting
- `/src/components/LocaleProvider.tsx` - Locale context provider
- `/src/locales/` - Translation files and message catalogs
- `/src/utils/timezone.ts` - Timezone handling utilities

**Contracts**:
- ICU message format specifications
- Locale detection configuration
- Timezone and currency formatting rules

**Docs**:
- `/docs/i18n-implementation.md` - Internationalization guide
- `/docs/locale-support.md` - Supported locales and regions
- Storybook stories for localized components

**Tests**:
- Locale detection and formatting tests
- Timezone conversion accuracy tests
- Currency formatting validation tests
- Translation completeness tests

### 2. Constraints
- **ICU Messages**: 100% of user-visible strings externalized
- **Tenant Timezone**: All dates/times reflect business timezone
- **Currency Localization**: Proper formatting by tenant region
- **RTL Support**: Right-to-left language compatibility
- **Do-Not-Invent**: Use only established i18n patterns; flag new locale requirements as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- All user-facing text strings
- Tenant timezone and currency data
- Locale detection requirements
- Date/time formatting specifications

**Outputs**:
- Localized application with multiple language support
- Proper date/time formatting by tenant timezone
- Currency formatting by tenant region
- RTL language support

### 4. Validation & Testing
**Acceptance Criteria**:
- 100% of user-visible strings externalized to ICU
- Dates/times reflect tenant timezone on all booking pages
- Currency localized by tenant region
- RTL sanity check passes

**Unit Test Matrix**:
- Locale detection accuracy
- Date/time formatting with various timezones
- Currency formatting with different regions
- Translation key completeness
- RTL layout behavior

**Contract Tests**:
- ICU message format validation
- Timezone conversion accuracy
- Currency formatting rules

**E2E Steps**:
- Given a tenant in EST timezone, When customer books service, Then all times show in EST
- Given a tenant with USD currency, When prices are displayed, Then they show in USD format
- Given a user with Spanish locale, When they view the app, Then text appears in Spanish

**Manual QA Checklist**:
- [ ] Test all supported locales and regions
- [ ] Verify timezone conversion accuracy
- [ ] Check currency formatting for different regions
- [ ] Test RTL language layout
- [ ] Validate date/time display consistency

### 5. Dependencies
**DependsOn**:
- T01 (API Client) - For tenant data retrieval
- T03 (Design System) - For RTL layout support

**Exposes**:
- Locale detection utilities
- Formatting functions for dates, times, and currency
- Translation management system
- Timezone conversion utilities

### 6. Executive Rationale
This task is essential for global market expansion and user accessibility. Proper internationalization ensures that users worldwide can use the application in their preferred language and see information formatted according to their regional preferences.

**Risk/Impact**: Medium - Poor i18n can limit market reach and user adoption
**Rollback Plan**: Fallback to English locale if translation issues arise; maintain basic formatting

### 7. North-Star Invariants
- **Locale Consistency**: All text appears in user's preferred language
- **Timezone Accuracy**: All times reflect business timezone
- **Currency Clarity**: All prices show in business currency
- **RTL Compatibility**: Right-to-left languages display correctly
- **Formatting Standards**: Dates, times, and numbers follow regional conventions

### 8. Schema/DTO Freeze Note
```typescript
interface LocaleConfig {
  default_locale: string; // 'en'
  supported_locales: string[]; // ['en', 'es', 'fr', 'de']
  fallback_locale: string; // 'en'
  currency_formats: Record<string, {
    symbol: string;
    position: 'before' | 'after';
    decimal_places: number;
  }>;
  date_formats: Record<string, {
    short: string; // 'MM/dd/yyyy'
    long: string; // 'MMMM dd, yyyy'
    time: string; // 'h:mm a'
  }>;
}

interface TenantLocale {
  tenant_id: string;
  timezone: string;
  currency: string;
  locale: string;
  date_format: string;
  time_format: string;
}
```

**SHA-256 Hash**: `e5f6g7h8i9j0...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `i18n.locale_changed` - { old_locale, new_locale, source }
- `i18n.translation_missing` - { key, locale, fallback_used }
- `i18n.timezone_converted` - { from_tz, to_tz, accuracy }
- `i18n.currency_formatted` - { amount, currency, locale }

**Metrics**:
- Locale usage distribution
- Translation completeness by locale
- Timezone conversion accuracy
- Currency formatting consistency

**Trace Boundaries**:
- `localeDetection` → `translationLoad` → `formattingApply` → `displayRender`

### 10. Error Model Enforcement
**Error Classes**:
- `LocaleError` - Unsupported locale or missing translations
- `TimezoneError` - Invalid timezone or conversion failure
- `CurrencyError` - Unsupported currency or formatting failure

**Mapping**:
- Missing translation → Fallback to default + logged → `i18n.translation_missing`
- Timezone error → UTC fallback + alert → `i18n.timezone_error`
- Currency error → Default format + logged → `i18n.currency_error`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Locale detection (same browser = same locale)
- Timezone conversion (same input = same output)
- Currency formatting (same amount = same format)

**Retry Strategy**:
- Translation loading: Retry once on network failure
- Timezone conversion: No retry needed (deterministic)
- Currency formatting: No retry needed (deterministic)

### 12. Output Bundle

```typescript
// /src/hooks/useLocale.ts
import { useState, useEffect, useContext } from 'react';
import { LocaleContext } from '../components/LocaleProvider';
import { Tenant } from '../types/core';

export const useLocale = () => {
  const { locale, setLocale, tenant } = useContext(LocaleContext);
  const [isLoading, setIsLoading] = useState(false);

  const detectLocale = async () => {
    setIsLoading(true);
    try {
      // Detect browser locale
      const browserLocale = navigator.language.split('-')[0];
      
      // Get tenant locale preference
      const tenantLocale = tenant?.locale || 'en';
      
      // Use tenant locale if available, otherwise browser locale
      const preferredLocale = tenantLocale || browserLocale;
      
      // Validate against supported locales
      const supportedLocales = ['en', 'es', 'fr', 'de'];
      const finalLocale = supportedLocales.includes(preferredLocale) 
        ? preferredLocale 
        : 'en';
      
      setLocale(finalLocale);
    } catch (error) {
      console.error('Locale detection failed:', error);
      setLocale('en'); // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    detectLocale();
  }, [tenant]);

  return {
    locale,
    setLocale,
    isLoading,
    tenant,
  };
};
```

```typescript
// /src/utils/formatting.ts
import { format, formatInTimeZone } from 'date-fns-tz';
import { enUS, es, fr, de } from 'date-fns/locale';

const locales = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
};

export const formatDate = (
  date: Date | string,
  formatString: string,
  timezone: string,
  locale: string = 'en'
) => {
  try {
    return formatInTimeZone(
      new Date(date),
      timezone,
      formatString,
      { locale: locales[locale] || locales.en }
    );
  } catch (error) {
    console.error('Date formatting error:', error);
    return format(new Date(date), formatString);
  }
};

export const formatTime = (
  date: Date | string,
  timezone: string,
  locale: string = 'en'
) => {
  return formatDate(date, 'h:mm a', timezone, locale);
};

export const formatCurrency = (
  amount: number,
  currency: string,
  locale: string = 'en'
) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount / 100); // Convert cents to dollars
  } catch (error) {
    console.error('Currency formatting error:', error);
    return `$${(amount / 100).toFixed(2)}`; // Fallback
  }
};

export const formatDateTime = (
  date: Date | string,
  timezone: string,
  locale: string = 'en'
) => {
  return formatDate(date, 'MMM dd, yyyy h:mm a', timezone, locale);
};
```

```typescript
// /src/components/LocaleProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Tenant } from '../types/core';

interface LocaleContextType {
  locale: string;
  setLocale: (locale: string) => void;
  tenant: Tenant | null;
  formatDate: (date: Date | string, format?: string) => string;
  formatTime: (date: Date | string) => string;
  formatCurrency: (amount: number) => string;
  formatDateTime: (date: Date | string) => string;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

export const LocaleProvider: React.FC<{ 
  children: React.ReactNode;
  tenant: Tenant | null;
}> = ({ children, tenant }) => {
  const [locale, setLocale] = useState('en');

  const formatDate = (date: Date | string, format: string = 'MMM dd, yyyy') => {
    if (!tenant?.timezone) return new Date(date).toLocaleDateString();
    
    return formatInTimeZone(
      new Date(date),
      tenant.timezone,
      format,
      { locale: locales[locale] || locales.en }
    );
  };

  const formatTime = (date: Date | string) => {
    if (!tenant?.timezone) return new Date(date).toLocaleTimeString();
    
    return formatInTimeZone(
      new Date(date),
      tenant.timezone,
      'h:mm a',
      { locale: locales[locale] || locales.en }
    );
  };

  const formatCurrency = (amount: number) => {
    if (!tenant?.currency) return `$${(amount / 100).toFixed(2)}`;
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: tenant.currency,
    }).format(amount / 100);
  };

  const formatDateTime = (date: Date | string) => {
    return formatDate(date, 'MMM dd, yyyy h:mm a');
  };

  return (
    <LocaleContext.Provider value={{
      locale,
      setLocale,
      tenant,
      formatDate,
      formatTime,
      formatCurrency,
      formatDateTime,
    }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};
```

**How to Verify**:
1. Run `npm run test:i18n` - should pass all localization tests
2. Test with different browser locales - should detect and apply correctly
3. Verify timezone conversion accuracy with various tenant timezones
4. Check currency formatting for different regions
5. Test RTL language layout and text direction

---

## Task T41 — Pagination & Filtering Standardization (P8)

You are implementing Task T41: Pagination & Filtering Standardization from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.11**: "List Management: Consistent pagination and filtering across all list views"
- **CP §"services/core"**: List endpoints with query parameters
- **Task Graph T41**: "One shared pattern for list pages (bookings, services, customers, staff, templates, coupons, automations)"

This task creates a unified pagination and filtering system used across all list views in the application.

### 1. Deliverables
**Code**:
- `/src/hooks/usePagedQuery.ts` - Main pagination hook
- `/src/components/Pagination.tsx` - Reusable pagination component
- `/src/components/FilterBar.tsx` - Reusable filtering component
- `/src/utils/url-sync.ts` - URL state synchronization utilities
- `/src/types/pagination.ts` - Pagination and filtering type definitions
- `/src/hooks/useUrlState.ts` - URL state management hook

**Contracts**:
- Pagination query parameter schema
- Filter state management interface
- URL synchronization configuration

**Docs**:
- `/docs/pagination-patterns.md` - Pagination implementation guide
- `/docs/filtering-standards.md` - Filtering implementation guide
- Storybook stories for pagination components

**Tests**:
- Pagination logic and state management tests
- URL synchronization accuracy tests
- Filter application and clearing tests
- List view integration tests

### 2. Constraints
- **URL Sync**: Filter state must serialize to URL and restore on navigation
- **Performance**: Page transitions < 500ms API budget
- **Idempotency**: Page/filter transitions are repeatable
- **Consistency**: All lists use the same pagination pattern
- **Do-Not-Invent**: Use only established pagination patterns; flag new filtering requirements as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- List endpoints with query parameter support
- Filter definitions and validation rules
- Pagination configuration requirements
- URL state management needs

**Outputs**:
- Unified pagination system across all lists
- URL-synchronized filter state
- Reusable pagination and filtering components
- Consistent list view behavior

### 4. Validation & Testing
**Acceptance Criteria**:
- All lists use shared pagination hook
- Filter state serializes to URL and restores on navigation
- Back/forward navigation restores list state exactly
- Page transitions are idempotent and stable

**Unit Test Matrix**:
- Pagination state management
- URL synchronization accuracy
- Filter application and clearing
- List data fetching and caching
- Edge cases (empty results, single page, etc.)

**Contract Tests**:
- Pagination query parameter validation
- Filter state serialization
- URL state restoration

**E2E Steps**:
- Given a user on bookings list, When they apply filters, Then URL updates and state persists
- Given a user navigates to page 2, When they refresh browser, Then they stay on page 2
- Given a user applies multiple filters, When they navigate away and back, Then filters are restored

**Manual QA Checklist**:
- [ ] Test pagination on all list views
- [ ] Verify URL synchronization works correctly
- [ ] Check filter state persistence across navigation
- [ ] Test edge cases (empty results, single page)
- [ ] Validate performance with large datasets

### 5. Dependencies
**DependsOn**:
- T01 (API Client) - For list data fetching
- T28 (Test Suite) - For E2E test infrastructure

**Exposes**:
- `usePagedQuery()` hook for list management
- Pagination and filtering components
- URL state management utilities
- List view integration patterns

### 6. Executive Rationale
This task is essential for consistent user experience across all list views. Without standardized pagination and filtering, users will have different experiences in different parts of the application, leading to confusion and reduced usability.

**Risk/Impact**: Medium - Inconsistent list behavior can confuse users and increase support burden
**Rollback Plan**: Revert to individual list implementations if shared system causes issues

### 7. North-Star Invariants
- **Consistent Behavior**: All lists behave identically for pagination and filtering
- **URL Synchronization**: List state always reflects in URL
- **State Persistence**: Navigation preserves list state
- **Performance Standards**: List operations meet performance budgets
- **User Expectations**: Pagination and filtering work as users expect

### 8. Schema/DTO Freeze Note
```typescript
interface PaginationParams {
  page: number;
  page_size: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface FilterState {
  [key: string]: any;
}

interface PagedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface UsePagedQueryOptions {
  endpoint: string;
  params?: Record<string, any>;
  filters?: FilterState;
  pagination?: PaginationParams;
  enabled?: boolean;
}
```

**SHA-256 Hash**: `f6g7h8i9j0k1...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `list.paginate` - { list_name, page, page_size }
- `list.filter_apply` - { list_name, filters, result_count }
- `list.filter_clear` - { list_name, cleared_filters }
- `list.sort_change` - { list_name, sort_field, sort_order }

**Metrics**:
- List load times by endpoint
- Filter usage frequency
- Pagination behavior patterns
- URL synchronization accuracy

**Trace Boundaries**:
- `listLoad` → `filterApply` → `paginationChange` → `urlSync` → `dataFetch`

### 10. Error Model Enforcement
**Error Classes**:
- `PaginationError` - Invalid page or page size
- `FilterError` - Invalid filter values or combinations
- `UrlSyncError` - URL state synchronization failure

**Mapping**:
- Pagination error → Reset to page 1 + logged → `list.pagination_error`
- Filter error → Clear invalid filters + alert → `list.filter_error`
- URL sync error → Fallback to default state + logged → `list.url_sync_error`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Page transitions (same page = same data)
- Filter applications (same filters = same results)
- URL synchronization (same state = same URL)

**Retry Strategy**:
- List data fetching: Retry on network errors
- URL synchronization: No retry needed (deterministic)
- Filter validation: No retry needed (deterministic)

### 12. Output Bundle

```typescript
// /src/hooks/usePagedQuery.ts
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../apiClient';

interface UsePagedQueryOptions {
  endpoint: string;
  params?: Record<string, any>;
  filters?: Record<string, any>;
  pagination?: {
    page: number;
    page_size: number;
  };
  enabled?: boolean;
}

export const usePagedQuery = <T>({
  endpoint,
  params = {},
  filters = {},
  pagination = { page: 1, page_size: 20 },
  enabled = true,
}: UsePagedQueryOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [paginationInfo, setPaginationInfo] = useState({
    page: 1,
    page_size: 20,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  });

  // Sync state with URL
  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const sort = searchParams.get('sort') || undefined;
    const order = searchParams.get('order') as 'asc' | 'desc' || undefined;

    setPaginationInfo(prev => ({
      ...prev,
      page,
      page_size: pageSize,
    }));

    // Extract filters from URL
    const urlFilters: Record<string, any> = {};
    searchParams.forEach((value, key) => {
      if (!['page', 'page_size', 'sort', 'order'].includes(key)) {
        urlFilters[key] = value;
      }
    });

    setFilters(urlFilters);
  }, [searchParams]);

  const [filters, setFilters] = useState<Record<string, any>>(filters);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const queryParams = {
        ...params,
        ...filters,
        page: paginationInfo.page,
        page_size: paginationInfo.page_size,
      };

      const response = await apiClient.get(endpoint, { params: queryParams });
      const responseData = response.data;

      setData(responseData.data || responseData);
      setPaginationInfo(responseData.pagination || {
        page: paginationInfo.page,
        page_size: paginationInfo.page_size,
        total: responseData.data?.length || 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, filters, paginationInfo.page, paginationInfo.page_size, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateUrl = useCallback((newParams: Record<string, any>) => {
    const currentParams = new URLSearchParams(searchParams);
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        currentParams.delete(key);
      } else {
        currentParams.set(key, String(value));
      }
    });

    setSearchParams(currentParams);
  }, [searchParams, setSearchParams]);

  const setPage = useCallback((page: number) => {
    updateUrl({ page });
  }, [updateUrl]);

  const setPageSize = useCallback((pageSize: number) => {
    updateUrl({ page_size: pageSize, page: 1 }); // Reset to page 1 when changing page size
  }, [updateUrl]);

  const setFilter = useCallback((key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    updateUrl({ ...newFilters, page: 1 }); // Reset to page 1 when filtering
  }, [filters, updateUrl]);

  const clearFilters = useCallback(() => {
    setFilters({});
    updateUrl({ page: 1 });
  }, [updateUrl]);

  const setSort = useCallback((sort: string, order: 'asc' | 'desc' = 'asc') => {
    updateUrl({ sort, order, page: 1 });
  }, [updateUrl]);

  return {
    data,
    loading,
    error,
    pagination: paginationInfo,
    filters,
    setPage,
    setPageSize,
    setFilter,
    clearFilters,
    setSort,
    refetch: fetchData,
  };
};
```

```typescript
// /src/components/Pagination.tsx
import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSize: number;
  total: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
  onPageSizeChange,
  pageSize,
  total,
}) => {
  const pageSizes = [10, 20, 50, 100];

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
      <div className="flex items-center justify-between flex-1 sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      
      <div className="hidden sm:flex sm:items-center sm:justify-between sm:flex-1">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total} results
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ml-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {pageSizes.map(size => (
              <option key={size} value={size}>{size} per page</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPrev}
            className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1;
            const isActive = page === currentPage;
            
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-3 py-2 text-sm font-medium border rounded-md ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            );
          })}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNext}
            className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
```

```typescript
// /src/components/FilterBar.tsx
import React from 'react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'number';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: Record<string, any>;
  filterConfig: FilterConfig[];
  onFilterChange: (key: string, value: any) => void;
  onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  filterConfig,
  onFilterChange,
  onClearFilters,
}) => {
  const hasActiveFilters = Object.values(filters).some(value => 
    value !== null && value !== undefined && value !== ''
  );

  return (
    <div className="bg-white p-4 border-b border-gray-200">
      <div className="flex flex-wrap items-center gap-4">
        {filterConfig.map(config => (
          <div key={config.key} className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              {config.label}
            </label>
            {config.type === 'select' ? (
              <select
                value={filters[config.key] || ''}
                onChange={(e) => onFilterChange(config.key, e.target.value || null)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                {config.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : config.type === 'text' ? (
              <input
                type="text"
                value={filters[config.key] || ''}
                onChange={(e) => onFilterChange(config.key, e.target.value || null)}
                placeholder={config.placeholder}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            ) : config.type === 'date' ? (
              <input
                type="date"
                value={filters[config.key] || ''}
                onChange={(e) => onFilterChange(config.key, e.target.value || null)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            ) : config.type === 'number' ? (
              <input
                type="number"
                value={filters[config.key] || ''}
                onChange={(e) => onFilterChange(config.key, e.target.value ? Number(e.target.value) : null)}
                placeholder={config.placeholder}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
        ))}
        
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
```

**How to Verify**:
1. Run `npm run test:pagination` - should pass all pagination tests
2. Test pagination on all list views - should work consistently
3. Verify URL synchronization - should update URL and restore state
4. Check filter state persistence - should survive navigation
5. Test performance with large datasets - should meet budgets

---

## Task T42 — Payments Canonicalization (P8)

You are implementing Task T42: Payments Canonicalization from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.12**: "Payment Processing: Stripe Elements with 3D Secure support, attendance-based charging"
- **CP §"services/extended"**: Payment intent creation and confirmation endpoints
- **Task Graph T42**: "Unify Admin Attendance→Payment and Public Checkout behind one abstraction"

This task creates a unified payment system used across both admin attendance marking and public checkout flows.

### 1. Deliverables
**Code**:
- `/src/services/payments.ts` - Unified payment service
- `/src/hooks/usePayment.ts` - Payment state management hook
- `/src/components/PaymentForm.tsx` - Reusable payment form component
- `/src/components/PaymentStatus.tsx` - Payment status display component
- `/src/utils/payment-validation.ts` - Payment validation utilities
- `/src/types/payments.ts` - Payment type definitions

**Contracts**:
- Unified payment intent schema
- Payment confirmation interface
- 3DS handling configuration

**Docs**:
- `/docs/payment-integration.md` - Payment system integration guide
- `/docs/3ds-handling.md` - 3D Secure implementation guide
- Storybook stories for payment components

**Tests**:
- Payment flow integration tests
- 3DS handling tests
- Idempotency validation tests
- Error handling and retry tests

### 2. Constraints
- **Unified Abstraction**: Both Admin and Public routes use same code path
- **Idempotency**: All payment operations must be idempotent
- **3DS Support**: Handle 3D Secure authentication flows
- **Retry Logic**: Honor 429 Retry-After with exponential backoff
- **Do-Not-Invent**: Use only established payment patterns; flag new payment methods as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- Payment intent creation endpoints
- Payment confirmation endpoints
- 3DS authentication flows
- Idempotency key generation

**Outputs**:
- Unified payment service used across all flows
- Consistent payment UI components
- Proper 3DS handling and error recovery
- Idempotent payment operations

### 4. Validation & Testing
**Acceptance Criteria**:
- Both Admin and Public routes call the same abstraction
- Idempotency-Key present on all payment operations
- 3DS success/cancel/error paths covered by E2E
- UI reconciles webhook updates correctly

**Unit Test Matrix**:
- Payment intent creation and confirmation
- 3DS authentication flow handling
- Idempotency key generation and validation
- Error handling and retry logic
- Webhook status reconciliation

**Contract Tests**:
- Payment intent schema validation
- 3DS response handling
- Idempotency key format validation

**E2E Steps**:
- Given a user in checkout, When they complete payment, Then 3DS flow works correctly
- Given an admin marks attendance, When payment is processed, Then same flow is used
- Given a payment fails, When user retries, Then idempotency prevents duplicate charges

**Manual QA Checklist**:
- [ ] Test payment flow in both admin and public contexts
- [ ] Verify 3DS authentication works correctly
- [ ] Check idempotency prevents duplicate charges
- [ ] Test error handling and retry logic
- [ ] Validate webhook status updates

### 5. Dependencies
**DependsOn**:
- T01 (API Client) - For payment API calls
- T27 (Observability) - For payment event tracking

**Exposes**:
- Unified payment service for all flows
- Payment components for consistent UI
- 3DS handling utilities
- Idempotency management

### 6. Executive Rationale
This task is critical for payment consistency and security. Having different payment implementations in different parts of the application can lead to bugs, security vulnerabilities, and inconsistent user experiences. The unified approach ensures all payments are handled securely and consistently.

**Risk/Impact**: High - Payment bugs can result in financial losses and security issues
**Rollback Plan**: Revert to separate payment implementations if unified system causes issues

### 7. North-Star Invariants
- **Payment Consistency**: All payments use the same secure flow
- **Idempotency**: No duplicate charges on retries
- **3DS Compliance**: All 3DS flows handled correctly
- **Error Recovery**: Payment failures are handled gracefully
- **Security**: All payment data is handled securely

### 8. Schema/DTO Freeze Note
```typescript
interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  metadata: Record<string, string>;
}

interface PaymentConfirmation {
  id: string;
  status: 'succeeded' | 'failed' | 'requires_action';
  payment_method: string;
  amount_received: number;
  receipt_url?: string;
}

interface PaymentOptions {
  amount: number;
  currency: string;
  booking_id: string;
  customer_id?: string;
  payment_method_id?: string;
  idempotency_key: string;
}
```

**SHA-256 Hash**: `g7h8i9j0k1l2...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `payments.intent_created` - { amount, currency, booking_id }
- `payments.confirm_success` - { payment_id, amount, method }
- `payments.confirm_error` - { error_code, error_message, retry_count }
- `payments.3ds_required` - { payment_id, action_url }

**Metrics**:
- Payment success rate by flow
- 3DS authentication success rate
- Payment processing latency
- Idempotency key usage

**Trace Boundaries**:
- `paymentStart` → `intentCreate` → `3dsHandle` → `confirmPayment` → `webhookUpdate`

### 10. Error Model Enforcement
**Error Classes**:
- `PaymentError` - Payment processing failure
- `3DSError` - 3D Secure authentication failure
- `IdempotencyError` - Duplicate payment attempt
- `WebhookError` - Payment status update failure

**Mapping**:
- Payment failure → Error display + retry option → `payments.confirm_error`
- 3DS failure → Authentication retry + user guidance → `payments.3ds_error`
- Idempotency error → Duplicate prevention + logged → `payments.idempotency_error`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Payment intent creation (same key = same intent)
- Payment confirmation (same intent = same result)
- Webhook processing (same event = same update)

**Retry Strategy**:
- Payment API calls: Exponential backoff with jitter, max 3 retries
- 3DS authentication: User-initiated retry only
- Webhook processing: Immediate retry on network failure

### 12. Output Bundle

```typescript
// /src/services/payments.ts
import { apiClient, generateIdempotencyKey } from '../apiClient';
import { endpoints } from '../endpoints';

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, string>;
}

export interface PaymentConfirmation {
  id: string;
  status: string;
  payment_method: string;
  amount_received: number;
  receipt_url?: string;
}

export interface PaymentOptions {
  amount: number;
  currency: string;
  booking_id: string;
  customer_id?: string;
  payment_method_id?: string;
}

export class PaymentService {
  async createPaymentIntent(options: PaymentOptions): Promise<PaymentIntent> {
    const idempotencyKey = generateIdempotencyKey();
    
    const response = await apiClient.post(endpoints.payments.intent, {
      ...options,
      idempotency_key: idempotencyKey,
    }, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });

    return response.data.payment_intent || response.data;
  }

  async confirmPaymentIntent(
    paymentIntentId: string, 
    paymentMethodId: string
  ): Promise<PaymentConfirmation> {
    const idempotencyKey = generateIdempotencyKey();
    
    const response = await apiClient.post(
      `${endpoints.payments.intent}/${paymentIntentId}/confirm`,
      {
        payment_method_id: paymentMethodId,
        idempotency_key: idempotencyKey,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );

    return response.data.payment || response.data;
  }

  async handle3DSAuthentication(
    paymentIntent: PaymentIntent,
    onSuccess: (payment: PaymentConfirmation) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (paymentIntent.status === 'requires_action') {
      // Handle 3DS authentication
      const { error, paymentIntent: confirmedIntent } = await this.stripe.confirmCardPayment(
        paymentIntent.client_secret
      );

      if (error) {
        onError(new Error(error.message));
      } else if (confirmedIntent.status === 'succeeded') {
        onSuccess(confirmedIntent as PaymentConfirmation);
      }
    } else if (paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent as PaymentConfirmation);
    } else {
      onError(new Error(`Unexpected payment status: ${paymentIntent.status}`));
    }
  }
}

export const paymentService = new PaymentService();
```

```typescript
// /src/hooks/usePayment.ts
import { useState, useCallback } from 'react';
import { paymentService, PaymentOptions, PaymentConfirmation } from '../services/payments';
import { useTelemetry } from './useTelemetry';

export const usePayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  const { track } = useTelemetry();

  const createPaymentIntent = useCallback(async (options: PaymentOptions) => {
    setLoading(true);
    setError(null);

    try {
      track('payments.intent_created', {
        amount: options.amount,
        currency: options.currency,
        booking_id: options.booking_id,
      });

      const intent = await paymentService.createPaymentIntent(options);
      setPaymentIntent(intent);
      return intent;
    } catch (err) {
      const error = err as Error;
      setError(error);
      track('payments.intent_error', {
        error_message: error.message,
        booking_id: options.booking_id,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [track]);

  const confirmPayment = useCallback(async (
    paymentMethodId: string,
    onSuccess?: (payment: PaymentConfirmation) => void,
    onError?: (error: Error) => void
  ) => {
    if (!paymentIntent) {
      const error = new Error('No payment intent available');
      setError(error);
      onError?.(error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const confirmation = await paymentService.confirmPaymentIntent(
        paymentIntent.id,
        paymentMethodId
      );

      if (confirmation.status === 'succeeded') {
        track('payments.confirm_success', {
          payment_id: confirmation.id,
          amount: confirmation.amount_received,
          method: confirmation.payment_method,
        });
        onSuccess?.(confirmation);
      } else if (confirmation.status === 'requires_action') {
        // Handle 3DS
        await paymentService.handle3DSAuthentication(
          paymentIntent,
          (payment) => {
            track('payments.3ds_success', {
              payment_id: payment.id,
            });
            onSuccess?.(payment);
          },
          (error) => {
            track('payments.3ds_error', {
              error_message: error.message,
            });
            setError(error);
            onError?.(error);
          }
        );
      } else {
        const error = new Error(`Payment failed with status: ${confirmation.status}`);
        setError(error);
        track('payments.confirm_error', {
          error_message: error.message,
          payment_id: confirmation.id,
        });
        onError?.(error);
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      track('payments.confirm_error', {
        error_message: error.message,
        payment_id: paymentIntent.id,
      });
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [paymentIntent, track]);

  const reset = useCallback(() => {
    setPaymentIntent(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    loading,
    error,
    paymentIntent,
    createPaymentIntent,
    confirmPayment,
    reset,
  };
};
```

```typescript
// /src/components/PaymentForm.tsx
import React, { useState } from 'react';
import { usePayment } from '../hooks/usePayment';
import { PaymentOptions } from '../services/payments';

interface PaymentFormProps {
  options: PaymentOptions;
  onSuccess: (payment: any) => void;
  onError: (error: Error) => void;
  disabled?: boolean;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  options,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const { loading, error, createPaymentIntent, confirmPayment } = usePayment();
  const [cardElement, setCardElement] = useState<any>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!cardElement) {
      onError(new Error('Card element not available'));
      return;
    }

    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntent(options);

      // Confirm payment with card element
      const { error, paymentMethod } = await cardElement.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (error) {
        onError(new Error(error.message));
        return;
      }

      // Confirm payment intent
      await confirmPayment(paymentMethod.id, onSuccess, onError);
    } catch (err) {
      onError(err as Error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border border-gray-300 rounded-md p-3">
        {/* Stripe Elements will be mounted here */}
        <div id="card-element" />
      </div>

      {error && (
        <div className="text-red-600 text-sm">
          {error.message}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || disabled}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing...' : `Pay $${(options.amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
};
```

**How to Verify**:
1. Run `npm run test:payments` - should pass all payment tests
2. Test payment flow in admin attendance marking
3. Test payment flow in public checkout
4. Verify 3DS authentication works correctly
5. Check idempotency prevents duplicate charges

---

## Task T43 — Breakpoints & Typography Scale Tokens (P8)

You are implementing Task T43: Breakpoints & Typography Scale Tokens from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §4.13**: "Responsive Design: Mobile-first approach with responsive breakpoints"
- **CP §"types/core"**: Design system token requirements
- **Task Graph T43**: "Centralize responsive breakpoints & type scale; prevent layout and readability drift"

This task establishes centralized responsive design tokens and typography scales to ensure consistent layouts across all screen sizes.

### 1. Deliverables
**Code**:
- `/src/styles/tokens.ts` - Design system tokens
- `/tailwind.config.ts` - Updated Tailwind configuration
- `/src/styles/typography.css` - Typography scale styles
- `/src/styles/responsive.css` - Responsive utility classes
- `/src/utils/responsive.ts` - Responsive utility functions
- `/src/hooks/useBreakpoint.ts` - Breakpoint detection hook

**Contracts**:
- Responsive breakpoint configuration
- Typography scale definitions
- Spacing and layout token specifications

**Docs**:
- `/docs/responsive-design.md` - Responsive design implementation guide
- `/docs/typography-scale.md` - Typography scale usage guide
- Storybook stories for responsive components

**Tests**:
- Responsive breakpoint behavior tests
- Typography scale consistency tests
- Layout token validation tests
- Mobile-first design compliance tests

### 2. Constraints
- **Mobile First**: All breakpoints must be mobile-first
- **No Horizontal Scroll**: XS breakpoints must not cause horizontal scroll
- **Typography Scale**: Consistent type scale across all components
- **Grid System**: All layouts must use grid-based system
- **Do-Not-Invent**: Use only established responsive patterns; flag new breakpoints as OPEN_QUESTION

### 3. Inputs → Outputs
**Inputs**:
- Current component layouts and designs
- Mobile-first design requirements
- Typography scale specifications
- Responsive breakpoint requirements

**Outputs**:
- Centralized design system tokens
- Responsive utility classes and functions
- Typography scale implementation
- Grid-based layout system

### 4. Validation & Testing
**Acceptance Criteria**:
- XS/SM/MD/LG/XL breakpoints codified and working
- Pages conform with grid-based layouts
- Snapshot baselines per route with no horizontal scroll on XS
- Typography scale consistent across all components

**Unit Test Matrix**:
- Breakpoint detection accuracy
- Typography scale calculations
- Responsive utility function behavior
- Grid system compliance

**Contract Tests**:
- Token value validation
- Breakpoint configuration verification
- Typography scale consistency

**E2E Steps**:
- Given a user on mobile device, When they view any page, Then layout is responsive and readable
- Given a user resizes browser, When they reach breakpoints, Then layout adapts correctly
- Given a user on large screen, When they view content, Then typography is appropriately sized

**Manual QA Checklist**:
- [ ] Test all breakpoints on various devices
- [ ] Verify no horizontal scroll on mobile
- [ ] Check typography scale consistency
- [ ] Validate grid system compliance
- [ ] Test responsive image behavior

### 5. Dependencies
**DependsOn**:
- T03 (Design System) - For existing token foundation
- T26 (A11y & Perf) - For responsive performance testing

**Exposes**:
- Design system tokens for all components
- Responsive utility functions
- Typography scale utilities
- Breakpoint detection hooks

### 6. Executive Rationale
This task is essential for consistent user experience across all devices. Without centralized responsive tokens, layouts can become inconsistent and break on different screen sizes. The mobile-first approach ensures accessibility and usability on all devices.

**Risk/Impact**: Medium - Poor responsive design can exclude mobile users and damage user experience
**Rollback Plan**: Revert to individual component responsive implementations if centralized system causes issues

### 7. North-Star Invariants
- **Mobile First**: All designs start with mobile and scale up
- **No Horizontal Scroll**: Content never overflows horizontally
- **Typography Consistency**: Same type scale across all components
- **Grid Compliance**: All layouts use established grid system
- **Performance**: Responsive design doesn't impact performance

### 8. Schema/DTO Freeze Note
```typescript
interface ResponsiveTokens {
  breakpoints: {
    xs: string; // '0px'
    sm: string; // '640px'
    md: string; // '768px'
    lg: string; // '1024px'
    xl: string; // '1280px'
  };
  typography: {
    scale: number[]; // [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25, 3, 3.75, 4.5]
    lineHeights: {
      tight: number; // 1.25
      normal: number; // 1.5
      relaxed: number; // 1.75
    };
  };
  spacing: {
    scale: number[]; // [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96]
  };
}
```

**SHA-256 Hash**: `h8i9j0k1l2m3...` (to be calculated from canonical JSON)
**Breaking Change**: No - this is additive functionality

### 9. Observability Hooks
**UI Events**:
- `ui.responsive_breakpoint_change` - { from_breakpoint, to_breakpoint, viewport }
- `ui.typography_scale_applied` - { component, scale_level, size }
- `ui.layout_token_used` - { token_name, value, context }

**Metrics**:
- Breakpoint usage distribution
- Typography scale consistency
- Layout token usage frequency
- Responsive design compliance

**Trace Boundaries**:
- `viewportChange` → `breakpointDetection` → `layoutUpdate` → `typographyApply`

### 10. Error Model Enforcement
**Error Classes**:
- `ResponsiveError` - Invalid breakpoint or viewport
- `TypographyError` - Invalid typography scale
- `LayoutError` - Grid system violation

**Mapping**:
- Responsive error → Fallback to safe breakpoint + logged → `ui.responsive_error`
- Typography error → Fallback to default scale + logged → `ui.typography_error`
- Layout error → Grid correction + logged → `ui.layout_error`

### 11. Idempotency & Retry
**Idempotent Actions**:
- Breakpoint detection (same viewport = same breakpoint)
- Typography scale application (same scale = same result)
- Layout token usage (same token = same value)

**Retry Strategy**:
- Breakpoint detection: No retry needed (deterministic)
- Typography application: No retry needed (deterministic)
- Layout updates: No retry needed (deterministic)

### 12. Output Bundle

```typescript
// /src/styles/tokens.ts
export const tokens = {
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },
  typography: {
    scale: [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.875, 2.25, 3, 3.75, 4.5],
    lineHeights: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
    fontWeights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    fontSizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
      '6xl': '3.75rem', // 60px
      '7xl': '4.5rem',  // 72px
    },
  },
  spacing: {
    scale: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96],
    get: (index: number) => `${tokens.spacing.scale[index] * 0.25}rem`,
  },
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
} as const;

export type Breakpoint = keyof typeof tokens.breakpoints;
export type TypographyScale = keyof typeof tokens.typography.fontSizes;
export type SpacingScale = number;
```

```typescript
// /tailwind.config.ts
import { tokens } from './src/styles/tokens';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: tokens.breakpoints,
      fontSize: tokens.typography.fontSizes,
      lineHeight: tokens.typography.lineHeights,
      fontWeight: tokens.typography.fontWeights,
      colors: tokens.colors,
      spacing: tokens.spacing.scale.reduce((acc, value, index) => {
        acc[index] = `${value * 0.25}rem`;
        return acc;
      }, {} as Record<number, string>),
    },
  },
  plugins: [],
};
```

```typescript
// /src/hooks/useBreakpoint.ts
import { useState, useEffect } from 'react';
import { tokens, Breakpoint } from '../styles/tokens';

export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('xs');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      
      if (width >= parseInt(tokens.breakpoints.xl)) {
        setBreakpoint('xl');
      } else if (width >= parseInt(tokens.breakpoints.lg)) {
        setBreakpoint('lg');
      } else if (width >= parseInt(tokens.breakpoints.md)) {
        setBreakpoint('md');
      } else if (width >= parseInt(tokens.breakpoints.sm)) {
        setBreakpoint('sm');
      } else {
        setBreakpoint('xs');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};
```

```typescript
// /src/utils/responsive.ts
import { tokens, Breakpoint } from '../styles/tokens';

export const getBreakpointValue = (breakpoint: Breakpoint): number => {
  return parseInt(tokens.breakpoints[breakpoint]);
};

export const isBreakpoint = (breakpoint: Breakpoint): boolean => {
  return window.innerWidth >= getBreakpointValue(breakpoint);
};

export const isMobile = (): boolean => {
  return window.innerWidth < getBreakpointValue('md');
};

export const isTablet = (): boolean => {
  const width = window.innerWidth;
  return width >= getBreakpointValue('md') && width < getBreakpointValue('lg');
};

export const isDesktop = (): boolean => {
  return window.innerWidth >= getBreakpointValue('lg');
};

export const getResponsiveValue = <T>(
  values: Partial<Record<Breakpoint, T>>,
  fallback: T
): T => {
  const breakpoints: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs'];
  
  for (const breakpoint of breakpoints) {
    if (values[breakpoint] && isBreakpoint(breakpoint)) {
      return values[breakpoint]!;
    }
  }
  
  return fallback;
};
```

```css
/* /src/styles/responsive.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Mobile-first responsive utilities */
@layer utilities {
  .container-responsive {
    @apply w-full mx-auto px-4;
  }
  
  @screen sm {
    .container-responsive {
      @apply px-6;
    }
  }
  
  @screen lg {
    .container-responsive {
      @apply px-8;
    }
  }
  
  .grid-responsive {
    @apply grid grid-cols-1 gap-4;
  }
  
  @screen sm {
    .grid-responsive {
      @apply grid-cols-2 gap-6;
    }
  }
  
  @screen lg {
    .grid-responsive {
      @apply grid-cols-3 gap-8;
    }
  }
  
  .text-responsive {
    @apply text-sm;
  }
  
  @screen sm {
    .text-responsive {
      @apply text-base;
    }
  }
  
  @screen lg {
    .text-responsive {
      @apply text-lg;
    }
  }
}

/* Typography scale utilities */
@layer components {
  .heading-1 {
    @apply text-4xl font-bold leading-tight;
  }
  
  .heading-2 {
    @apply text-3xl font-semibold leading-tight;
  }
  
  .heading-3 {
    @apply text-2xl font-semibold leading-normal;
  }
  
  .heading-4 {
    @apply text-xl font-medium leading-normal;
  }
  
  .body-large {
    @apply text-lg leading-relaxed;
  }
  
  .body-base {
    @apply text-base leading-normal;
  }
  
  .body-small {
    @apply text-sm leading-normal;
  }
  
  .caption {
    @apply text-xs leading-tight;
  }
}
```

**How to Verify**:
1. Run `npm run test:responsive` - should pass all responsive tests
2. Test all breakpoints on various devices
3. Verify no horizontal scroll on mobile
4. Check typography scale consistency
5. Validate grid system compliance

---

## Phase 9 — Release & Growth Initiatives

### Phase 9 Goal & Exit Criteria

**Goal**: Prepare the frontend for production release with growth initiatives, advanced features, and scalability improvements.

**Note**: Phase 9 tasks are not detailed in the current Frontend Task Graph. This section will be expanded when Phase 9 requirements are defined.

**Planned Phase 9 Tasks** (to be detailed):
- T44 — Advanced Analytics & Reporting
- T45 — Multi-language Support & Localization
- T46 — Advanced Automation & Workflow
- T47 — Performance Optimization & Caching
- T48 — Security Hardening & Compliance
- T49 — Scalability & Infrastructure
- T50 — Growth Features & Integrations

---

## Implementation Notes

### Development Workflow
1. **Task Assignment**: Each task should be assigned to a developer with clear acceptance criteria
2. **Code Review**: All code must pass review with focus on the North-Star Invariants
3. **Testing**: Comprehensive testing is required before merge
4. **Documentation**: All changes must be documented with examples

### Quality Gates
- **Accessibility**: WCAG 2.1 AA compliance verified by automated testing
- **Performance**: Web Vitals thresholds met across all routes
- **Testing**: Coverage thresholds enforced in CI
- **Security**: No PII leaks, proper error handling
- **Branding**: Visual regression tests prevent white-label violations

### Rollback Strategy
Each task includes a rollback plan for safe deployment. Critical features should be feature-flagged to allow quick disabling if issues arise.

---

*End of Tithi Frontend Phase 8 & 9 Ticketed Prompts*
