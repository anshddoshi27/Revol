# Tithi Frontend Ticketed Prompts - Phase 0 & 1

**Document Purpose**: Mature ticketed prompts for Phase 0 (Contracts & Governance) and Phase 1 (Foundation & Infrastructure) tasks from the approved Frontend Task Graph.

**Implementation Guide**: Each task below provides complete implementation instructions using the Design Brief and Context Pack as the single source of truth.

---

## Phase 0 — Contracts & Governance

### T00 — API Contracts Addendum & Governance

You are implementing Task T00: API Contracts Addendum & Governance from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context (quote IDs)
- **Brief §2.1**: "Backend Integration Points" - Authentication Flow, Multi-Tenant Routing, Payment Integration
- **Brief §3.1**: "Technical Architecture" - Backend Integration Points, API Client Configuration
- **CP §"API Client"**: Axios-based client with JWT bearer injection, uniform error shape, idempotency helper
- **CP §"endpoints"**: Core API endpoints structure for tenants, services, bookings, payments

**Narrative**: This task establishes the foundational API contracts that eliminate all "OPEN_QUESTION" gaps and provide type-safe interfaces for the entire frontend. It creates the contract layer that prevents schema drift and ensures backend stability.

#### 1. Deliverables
**Code:**
- `/docs/api-contracts-addendum.md` - Definitive request/response DTOs
- `/docs/pagination-filtering.md` - Standard query params and error handling
- `/docs/payments-canonical.md` - Final single path for payments
- `/docs/availability-rules.md` - Default/staff schedule model

**Contracts:**
- TypeScript interfaces for all API endpoints
- OpenAPI 3.0 specifications
- Zod schemas for runtime validation
- Sample payloads for each endpoint

**Docs:**
- API contract versioning strategy
- Error response standardization
- Idempotency key requirements
- Rate limiting documentation

**Tests:**
- Contract tests for all endpoints
- Schema validation tests
- Sample payload validation

#### 2. Constraints
- **Do-Not-Invent**: All field names must match backend exactly
- **Type Safety**: All DTOs must be strongly typed with no `any` types
- **Idempotency**: Every create/update endpoint must specify Idempotency-Key behavior
- **Error Handling**: Standard 429 strategy must respect Retry-After header
- **OPEN_QUESTION Resolution**: Zero unresolved contract questions allowed

#### 3. Inputs → Outputs
**Inputs:**
- Backend API documentation
- Existing OPEN_QUESTION items from requirements audit
- Context Pack API client structure
- Design Brief integration points

**Outputs:**
- Complete API contract documentation
- TypeScript type definitions
- Validation schemas
- Contract test suite

#### 4. Validation & Testing
**Acceptance Criteria:**
- All previously open contracts resolved (onboarding/register, availability rules, customers DTO, subscriptions DTO, payments/process schema)
- Pagination & filtering params standardized for all list endpoints
- Idempotency behavior documented for every create/update endpoint
- Retry strategy documented with Retry-After respect
- Canonical payments flow chosen and signed off

**Unit Tests:**
- Schema validation for all DTOs
- Contract compliance tests
- Error response format validation

**Contract Tests:**
- API endpoint schema validation
- Request/response payload validation
- Error response structure validation

**E2E Tests:**
- Full API contract compliance
- Error handling validation
- Rate limiting behavior

**Manual QA:**
- [ ] All contracts reviewed and approved
- [ ] No OPEN_QUESTION items remain
- [ ] Backend team sign-off received

#### 5. Dependencies
**DependsOn:** None (kick-off task)

**Exposes:**
- Complete API contract documentation
- TypeScript type definitions for all endpoints
- Validation schemas for runtime checking
- Contract test framework

#### 6. Executive Rationale
**Why this exists:** Prevents schema drift and "blockers later" by establishing a single source of truth for all API contracts. Provides frontend type-safety and backend stability.

**Risk/Impact if wrong:** Schema mismatches will cause runtime errors, integration failures, and development delays across all subsequent phases.

**Rollback plan:** Revert to previous contract version and re-audit all OPEN_QUESTION items.

#### 7. North-Star Invariants
- No API contract changes without frontend/backend team approval
- All DTOs must be strongly typed with no `any` types
- Idempotency keys required for all mutating operations
- Rate limiting strategy must be consistent across all endpoints

#### 8. Schema/DTO Freeze Note
**Canonical DTOs with SHA-256 hash:**
```typescript
// Core API Response Structure
interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    version: string;
  };
  errors?: ApiError[];
}

// SHA-256: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Breaking Change:** No - this is the initial contract establishment.

#### 9. Observability Hooks
**UI Events:**
- `api_contracts.version_published` - When contract documentation is finalized
- `api_contracts.validation_failed` - When contract validation fails

**Metrics:**
- Contract validation success rate
- API endpoint coverage percentage
- Schema compliance score

**Trace Boundaries:**
- Contract generation → validation → documentation → approval

#### 10. Error Model Enforcement
**Error Classes:**
- **Validation Error**: Invalid contract format
- **Missing Contract**: Required endpoint not documented
- **Schema Mismatch**: Frontend/backend schema inconsistency

**Mapping:**
- Validation Error → "Contract validation failed" → `contract_validation_error`
- Missing Contract → "Required contract missing" → `missing_contract_error`
- Schema Mismatch → "Schema inconsistency detected" → `schema_mismatch_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- Contract documentation generation
- Schema validation
- Type definition generation

**Retry Strategy:**
- No retries needed (documentation generation is idempotent)
- Validation failures should be fixed, not retried

#### 12. Output Bundle
**Final Code:**
```typescript
// /docs/api-contracts-addendum.md
export interface OnboardingRegisterRequest {
  business_name: string;
  slug: string;
  timezone: string;
  // ... complete interface
}

export interface OnboardingRegisterResponse {
  tenant_id: string;
  slug: string;
  status: 'created' | 'pending_verification';
  // ... complete interface
}

// /src/types/api-contracts.ts
export * from './onboarding';
export * from './tenants';
export * from './services';
export * from './bookings';
export * from './payments';
export * from './availability';
```

**How to verify:**
1. Run contract validation tests: `npm run test:contracts`
2. Verify all OPEN_QUESTION items are resolved
3. Confirm backend team approval
4. Check that all DTOs are strongly typed

---

### T39 — Analytics Event Taxonomy & PII Policy

Define the event names, payload schemas, PII flags, sampling, and retention for all critical journeys. Must run after T00 so names/fields align with finalized DTOs. Apps emit

#### 0. Context (quote IDs)
- **Brief §2.1**: "Backend Integration Points" - Analytics & Reporting interfaces
- **Brief §3.1**: "Technical Architecture" - Monitoring & Analytics requirements
- **CP §"analytics"**: Revenue analytics, booking analytics, customer analytics endpoints
- **CP §"observability"**: Event tracking and telemetry requirements

**Narrative**: This task establishes the analytics event taxonomy and PII policy that ensures observability coverage and compliance before any tracking code ships. It defines event names, payloads, and privacy rules for all critical user journeys.

#### 1. Deliverables
**Code:**
- `/docs/analytics-events.json` - Event names, payload fields & types, PII flags, sampling rules
- `/src/analytics/event-schema.ts` - TypeScript definitions for all events
- `/src/analytics/pii-policy.ts` - PII handling and redaction utilities

**Contracts:**
- Event schema definitions with required/optional fields
- PII flag definitions and redaction rules
- Sampling strategy configuration
- Data retention policy documentation

**Docs:**
- Analytics event taxonomy documentation
- PII policy and compliance guidelines
- Data retention and privacy notes
- Sampling rules documentation

**Tests:**
- Event schema validation tests
- PII redaction tests
- Sampling rule tests
- Privacy compliance tests

#### 2. Constraints
- **PII Compliance**: No PII leaks in analytics payloads
- **Event Coverage**: Every critical journey must have events defined
- **Sampling Rules**: Clear sampling strategy (100% prod, 10% staging)
- **Schema Validation**: All events must validate against schema
- **Privacy First**: PII fields must be marked and stripped as needed

#### 3. Inputs → Outputs
**Inputs:**
- Observability requirements from Design Brief
- Privacy requirements and compliance needs
- Critical user journey definitions
- Backend analytics endpoints

**Outputs:**
- Complete analytics event taxonomy
- PII policy and redaction rules
- Event schema validation
- Sampling configuration

#### 4. Validation & Testing
**Acceptance Criteria:**
- Every critical journey (onboarding, booking, payment, notifications, loyalty, automations) has events defined
- No PII leaks (fields marked & stripped as needed)
- Sampling rules clear (e.g., 100% prod, 10% staging)
- Apps emit `analytics.schema_loaded` on boot to verify schema availability

**Unit Tests:**
- Event schema validation
- PII redaction functionality
- Sampling rule application
- Privacy compliance checks

**Contract Tests:**
- Event payload validation
- PII flag enforcement
- Schema compliance verification

**E2E Tests:**
- End-to-end event tracking
- PII redaction in production
- Sampling rule enforcement

**Manual QA:**
- [ ] All critical journeys have events defined
- [ ] PII policy reviewed and approved
- [ ] Sampling rules tested
- [ ] Privacy compliance verified

#### 5. Dependencies
**DependsOn:** T00 (API Contracts Addendum)

**Exposes:**
- Complete analytics event taxonomy
- PII policy and redaction utilities
- Event schema validation framework
- Sampling configuration

#### 6. Executive Rationale
**Why this exists:** Ensures observability coverage and compliance before any tracking code ships. Prevents PII leaks and ensures proper event tracking across all user journeys.

**Risk/Impact if wrong:** PII compliance violations, incomplete observability, privacy regulation violations, and inability to track critical user journeys.

**Rollback plan:** Revert to previous event schema and re-audit all PII handling.

#### 7. North-Star Invariants
- No PII in analytics payloads
- All critical journeys must have events
- Event schemas must be strongly typed
- Sampling rules must be consistent

#### 8. Schema/DTO Freeze Note
**Canonical Event Schema with SHA-256 hash:**
```typescript
interface AnalyticsEvent {
  event_name: string;
  event_data: Record<string, any>;
  user_id?: string;
  tenant_id?: string;
  timestamp: string;
  pii_flags: string[];
  sampling_rate: number;
}

// SHA-256: b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7
```

**Breaking Change:** No - this is the initial event schema establishment.

#### 9. Observability Hooks
**UI Events:**
- `analytics.schema_loaded` - When analytics schema is loaded
- `analytics.event_emitted` - When an event is successfully emitted
- `analytics.pii_violation` - When PII is detected in event payload

**Metrics:**
- Event emission success rate
- PII violation count
- Schema validation failure rate
- Sampling rule compliance

**Trace Boundaries:**
- Event generation → PII check → schema validation → emission

#### 10. Error Model Enforcement
**Error Classes:**
- **PII Violation**: PII detected in event payload
- **Schema Violation**: Event doesn't match schema
- **Sampling Error**: Sampling rule misconfiguration

**Mapping:**
- PII Violation → "PII detected in event" → `pii_violation_error`
- Schema Violation → "Event schema mismatch" → `schema_violation_error`
- Sampling Error → "Sampling rule error" → `sampling_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- Event emission (deduplicated by event ID)
- Schema validation
- PII redaction

**Retry Strategy:**
- Event emission failures should be retried with exponential backoff
- PII violations should not be retried (fixed and re-emitted)

#### 12. Output Bundle
**Final Code:**
```typescript
// /docs/analytics-events.json
{
  "events": {
    "onboarding.step_complete": {
      "payload": {
        "step": "string",
        "tenant_id": "string",
        "user_id": "string"
      },
      "pii_flags": ["user_id"],
      "sampling_rate": 1.0
    }
    // ... complete event taxonomy
  }
}

// /src/analytics/event-schema.ts
export interface OnboardingStepCompleteEvent {
  step: string;
  tenant_id: string;
  user_id: string;
}

export const emitEvent = (eventName: string, data: any) => {
  // Implementation with PII redaction and schema validation
};
```

**How to verify:**
1. Run analytics tests: `npm run test:analytics`
2. Verify PII policy compliance
3. Check event schema validation
4. Confirm sampling rules work correctly

---

### T43 — Breakpoints & Typography Scale Tokens

You are implementing Task T43: Breakpoints & Typography Scale Tokens from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context (quote IDs)
- **Brief §2.2**: "Design System" - Color Palette, Typography, Component Library
- **Brief §3.1**: "Technical Architecture" - Styling with Tailwind CSS
- **CP §"config"**: Environment configuration and design token requirements
- **CP §"types"**: Design system type definitions

**Narrative**: This task establishes the responsive breakpoints and typography scale tokens that unlock mobile-first development and cross-browser QA. It provides the foundation for consistent, accessible design across all screen sizes.

#### 1. Deliverables
**Code:**
- `/src/styles/tokens.ts` - XS/SM/MD/LG/XL breakpoints + type scale
- `/tailwind.config.ts` - Tailwind theme extension with custom tokens
- `/docs/responsive.md` - Design guidance for developers & QA

**Contracts:**
- Breakpoint definitions with exact pixel values
- Typography scale with font sizes, line heights, weights
- Spacing scale for consistent margins and padding
- Color token definitions

**Docs:**
- Responsive design guidelines
- Typography usage examples
- Breakpoint usage patterns
- Accessibility considerations

**Tests:**
- Token export validation
- Breakpoint consistency tests
- Typography scale tests
- Visual regression baselines

#### 2. Constraints
- **Mobile First**: Must support mobile-first design approach
- **No Horizontal Scroll**: No horizontal scroll on XS breakpoint
- **Accessibility**: Must meet WCAG 2.1 AA contrast requirements
- **Performance**: Zero runtime calculations for responsive values
- **Consistency**: All breakpoints must be consistent across components

#### 3. Inputs → Outputs
**Inputs:**
- Design system requirements from Design Brief
- Accessibility requirements (WCAG 2.1 AA)
- Mobile-first design principles
- Typography and spacing requirements

**Outputs:**
- Complete responsive token system
- Typography scale definitions
- Tailwind configuration
- Design documentation

#### 4. Validation & Testing
**Acceptance Criteria:**
- XS/SM/MD/LG/XL breakpoints and full type scale codified
- Visual regression baselines/screenshots for each primary route
- Supports mobile-first; no horizontal scroll on XS
- All tokens are strongly typed and exported

**Unit Tests:**
- Token export validation
- Breakpoint value consistency
- Typography scale validation
- Spacing scale validation

**Visual Tests:**
- Screenshot baselines for all breakpoints
- Typography rendering tests
- Layout consistency tests

**E2E Tests:**
- Responsive behavior across breakpoints
- Mobile-first functionality
- Accessibility compliance

**Manual QA:**
- [ ] All breakpoints work correctly
- [ ] Typography scale is consistent
- [ ] No horizontal scroll on mobile
- [ ] Visual regression baselines recorded

#### 5. Dependencies
**DependsOn:** None (can run parallel with T00/T39)

**Exposes:**
- Complete responsive token system
- Typography scale definitions
- Tailwind configuration
- Design documentation

#### 6. Executive Rationale
**Why this exists:** Unlocks mobile-first development and later cross-browser QA. Provides consistent, accessible design foundation for all components.

**Risk/Impact if wrong:** Inconsistent responsive behavior, accessibility violations, poor mobile experience, and design system fragmentation.

**Rollback plan:** Revert to previous token definitions and re-audit all responsive components.

#### 7. North-Star Invariants
- All breakpoints must be consistent across components
- Typography scale must be accessible and readable
- No horizontal scroll on any breakpoint
- All tokens must be strongly typed

#### 8. Schema/DTO Freeze Note
**Canonical Token Schema with SHA-256 hash:**
```typescript
interface DesignTokens {
  breakpoints: {
    xs: '320px';
    sm: '640px';
    md: '768px';
    lg: '1024px';
    xl: '1280px';
  };
  typography: {
    scale: Record<string, string>;
    weights: Record<string, number>;
  };
}

// SHA-256: c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8
```

**Breaking Change:** No - this is the initial token establishment.

#### 9. Observability Hooks
**UI Events:**
- `design.tokens_loaded` - When design tokens are loaded
- `design.breakpoint_changed` - When breakpoint changes
- `design.typography_rendered` - When typography is rendered

**Metrics:**
- Token usage frequency
- Breakpoint distribution
- Typography rendering performance
- Accessibility compliance score

**Trace Boundaries:**
- Token loading → validation → application → rendering

#### 10. Error Model Enforcement
**Error Classes:**
- **Token Validation Error**: Invalid token value
- **Breakpoint Error**: Breakpoint configuration issue
- **Typography Error**: Typography scale problem

**Mapping:**
- Token Validation Error → "Invalid token value" → `token_validation_error`
- Breakpoint Error → "Breakpoint configuration issue" → `breakpoint_error`
- Typography Error → "Typography scale problem" → `typography_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- Token loading
- Breakpoint calculation
- Typography rendering

**Retry Strategy:**
- Token loading failures should be retried
- Breakpoint calculations are deterministic

#### 12. Output Bundle
**Final Code:**
```typescript
// /src/styles/tokens.ts
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export const typography = {
  scale: {
    'text-xs': '0.75rem',
    'text-sm': '0.875rem',
    'text-base': '1rem',
    'text-lg': '1.125rem',
    'text-xl': '1.25rem',
    'text-2xl': '1.5rem',
    'text-3xl': '1.875rem',
    'text-4xl': '2.25rem',
  },
  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// /tailwind.config.ts
export default {
  theme: {
    extend: {
      screens: breakpoints,
      fontSize: typography.scale,
      fontWeight: typography.weights,
    },
  },
};
```

**How to verify:**
1. Run token tests: `npm run test:tokens`
2. Verify responsive behavior across breakpoints
3. Check typography rendering
4. Confirm visual regression baselines

---

## Phase 1 — Foundation & Infrastructure

### T01 — Bootstrap Project & Typed API Client

You are implementing Task T01: Bootstrap Project & Typed API Client from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context (quote IDs)
- **Brief §2.1**: "Backend Integration Points" - API Client Configuration, JWT Token Management
- **Brief §3.1**: "Technical Architecture" - Frontend Technology Stack, API Client setup
- **CP §"apiClient"**: Axios-based client with interceptors, error handling, idempotency
- **CP §"config"**: Environment configuration, token provider, rate limiting

**Narrative**: This task establishes the production-grade frontend skeleton with a typed API client that handles authentication, error management, idempotency, and rate limiting. It provides the foundation for all subsequent API interactions.

#### 1. Deliverables
**Code:**
- `/src/api/client.ts` - Base instance + interceptors (Authorization, Idempotency-Key, 429 retry)
- `/src/api/types/*.ts` - Re-exporting DTOs from contracts
- `/src/lib/env.ts` - Type-safe runtime environment configuration
- `/src/observability/{telemetry,webVitals,sentry}.ts` - Observability scaffolding

**Contracts:**
- TithiError interface and error handling
- Idempotency key generation and management
- Rate limiting and retry strategy
- Environment variable validation

**Docs:**
- API client usage documentation
- Error handling guidelines
- Environment configuration guide
- Observability setup instructions

**Tests:**
- Unit tests for interceptors and error handling
- Integration tests for API client behavior
- E2E tests for error scenarios
- Contract tests for API responses

#### 2. Constraints
- **Bundle Size**: Initial bundle < 500 KB (lazy-split routes/components)
- **Performance**: API latency budget < 500 ms p75 (surface in dev overlay)
- **Accessibility**: WCAG 2.1 AA compliance (focus styles, color contrast)
- **Error Handling**: All errors must normalize to TithiError
- **Idempotency**: All create/update calls must use idempotency keys

#### 3. Inputs → Outputs
**Inputs:**
- Environment variables (API base, Supabase, Stripe, Sentry DSN)
- Contracts from Phase 0 (T00)
- Sentry DSN (optional)
- Backend API endpoints

**Outputs:**
- Typed API client with interceptors
- Global error types and handlers
- Environment configuration
- Observability setup

#### 4. Validation & Testing
**Acceptance Criteria:**
- Auth header injected only when token present; token refresh path doesn't loop
- 429 responses respect Retry-After; jitter applied; max 3 retries
- All errors normalize to TithiError and are user-safe (no PII)
- Web Vitals emit FCP/LCP/CLS/INP on route transitions (feature-flagged)
- generateIdempotencyKey() used by all create/update calls

**Unit Tests:**
- Interceptor behavior validation
- Error adapter functionality
- Idempotency key format validation
- Environment variable validation

**Integration Tests:**
- Mock 401/403/429/5xx responses
- Ensure retries and error mapping work correctly
- Test token refresh flow
- Validate rate limiting behavior

**E2E Tests:**
- App boots with environment variables
- Network error banner shows TithiError detail
- API client handles all error scenarios
- Observability events fire correctly

**Manual QA:**
- [ ] API client works with all endpoints
- [ ] Error handling is consistent
- [ ] Rate limiting works correctly
- [ ] Observability events fire

#### 5. Dependencies
**DependsOn:** None (root of Phase 1)

**Exposes:**
- Typed API client for all subsequent tasks
- Error handling framework
- Environment configuration
- Observability setup

#### 6. Executive Rationale
**Why this exists:** A stable, observable API layer prevents rework across every surface. Provides consistent error handling, authentication, and rate limiting for all API interactions.

**Risk/Impact if wrong:** Inconsistent API behavior, authentication failures, poor error handling, and observability gaps across the entire application.

**Rollback plan:** Revert to previous API client implementation and re-audit all API interactions.

#### 7. North-Star Invariants
- No silent failures; every failure is typed and observable
- Idempotency on all mutating requests
- Rate-limit resilience by default
- All errors must be user-safe (no PII)

#### 8. Schema/DTO Freeze Note
**Canonical API Client Schema with SHA-256 hash:**
```typescript
interface TithiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error_code: string;
  tenant_id?: string;
  user_id?: string;
}

// SHA-256: d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9
```

**Breaking Change:** No - this is the initial API client establishment.

#### 9. Observability Hooks
**UI Events:**
- `http.request` - When API request is made
- `http.response` - When API response is received
- `http.retry` - When request is retried
- `http.error` - When API error occurs

**Metrics:**
- API request success rate
- Error rate by endpoint
- Retry count and frequency
- Response time distribution

**Trace Boundaries:**
- Request initiation → interceptor → API call → response → error handling

#### 10. Error Model Enforcement
**Error Classes:**
- **Network Error**: Connection or timeout issues
- **Authentication Error**: 401/403 responses
- **Rate Limit Error**: 429 responses
- **Server Error**: 5xx responses
- **Validation Error**: 4xx responses

**Mapping:**
- Network Error → "Connection failed" → `network_error`
- Authentication Error → "Authentication required" → `auth_error`
- Rate Limit Error → "Rate limit exceeded" → `rate_limit_error`
- Server Error → "Server error occurred" → `server_error`
- Validation Error → "Invalid request" → `validation_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- All POST/PUT/PATCH/DELETE requests
- Payment processing
- Booking creation
- User registration

**Retry Strategy:**
- 429 responses: Respect Retry-After header, exponential backoff with jitter
- Network errors: Exponential backoff with jitter
- Max 3 retries for any request
- Idempotency keys prevent duplicate operations

#### 12. Output Bundle
**Final Code:**
```typescript
// /src/api/client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { API_BASE_URL, getToken, DEFAULT_RATE_LIMIT_BACKOFF_MS } from './config';

export interface TithiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error_code: string;
  tenant_id?: string;
  user_id?: string;
}

export const handleApiError = (error: AxiosError): TithiError => {
  if (error.response?.data) {
    return error.response.data as TithiError;
  }
  return {
    type: 'about:blank',
    title: 'Unknown Error',
    status: error.response?.status || 500,
    detail: error.message,
    instance: error.config?.url || '',
    error_code: 'UNKNOWN_ERROR',
  };
};

export const generateIdempotencyKey = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      if (status === 429) {
        const retryAfterHeader = (error.response?.headers || {})['retry-after'];
        const retryAfterSec = retryAfterHeader ? parseInt(String(retryAfterHeader)) : 0;
        const delayMs = retryAfterSec > 0 ? retryAfterSec * 1000 : DEFAULT_RATE_LIMIT_BACKOFF_MS;
        await new Promise((r) => setTimeout(r, delayMs));
        return client.request(error.config!);
      }
      return Promise.reject(handleApiError(error));
    }
  );

  return client;
};

export const apiClient = createApiClient();
```

**How to verify:**
1. Run API client tests: `npm run test:api-client`
2. Verify error handling works correctly
3. Check rate limiting behavior
4. Confirm observability events fire

---

### T02 — Multi-Tenant Routing & Slug Resolution

You are implementing Task T02: Multi-Tenant Routing & Slug Resolution from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context (quote IDs)
- **Brief §2.1**: "Backend Integration Points" - Multi-Tenant Routing, Tenant Context Resolution
- **Brief §3.1**: "Technical Architecture" - Multi-tenant architecture with tenant isolation
- **CP §"utils/tenant"**: getTenantSlug, requireTenantSlug functions
- **CP §"endpoints"**: Public and admin endpoint structures

**Narrative**: This task establishes the multi-tenant routing system that supports both path-based and subdomain tenants for admin and public booking. It provides tenant context resolution and route guards that ensure proper tenant isolation.

#### 1. Deliverables
**Code:**
- `/src/routes` - Route definitions for public booking and admin app
- `/src/tenant/{TenantContext,useTenantSlug,requireTenantSlug}.ts` - Tenant context management
- Route guards that block until slug is known
- Redirector for subdomain cases (if applicable)

**Contracts:**
- Tenant context interface and provider
- Route guard components
- Slug resolution utilities
- Tenant isolation mechanisms

**Docs:**
- Multi-tenant routing documentation
- Tenant context usage guide
- Route guard implementation
- Slug resolution strategy

**Tests:**
- Unit tests for slug resolution
- Integration tests for route guards
- E2E tests for tenant isolation
- Route behavior tests

#### 2. Constraints
- **Zero Extra Renders**: Slug resolution must be memoized to prevent extra renders
- **No Tenant Leakage**: Strict provider boundaries to prevent cross-tenant state bleed
- **Route Guards**: Must block unauthenticated users from admin routes
- **Deep Links**: Must survive refresh and SSR/SPA transitions
- **Performance**: Tenant resolution must be fast and efficient

#### 3. Inputs → Outputs
**Inputs:**
- Location (host + path) for tenant resolution
- Contracts for tenant lookup if needed
- Authentication state for route guards
- Route configuration

**Outputs:**
- Resolved tenant slug and context
- Route guards for admin protection
- Tenant context provider
- Slug resolution utilities

#### 4. Validation & Testing
**Acceptance Criteria:**
- Visiting `/v1/{slug}` renders public booking with that tenant
- Visiting `/admin` within a tenant scope routes correctly and blocks unauthenticated users
- Logs event `tenant_resolved` with `{slug, source:"path|subdomain"}`
- Deep-links survive refresh and SSR/SPA transitions

**Unit Tests:**
- Path parser functionality
- Subdomain parser functionality
- Slug resolution logic
- Tenant context management

**Integration Tests:**
- Guard behavior with/without auth
- Slug changes and context updates
- Route transitions
- Tenant isolation

**E2E Tests:**
- Direct navigation to `/v1/acme`
- Navigation into checkout
- Page reload and state persistence
- Admin route protection

**Manual QA:**
- [ ] Tenant resolution works correctly
- [ ] Route guards block unauthorized access
- [ ] Deep links work after refresh
- [ ] No cross-tenant state leakage

#### 5. Dependencies
**DependsOn:** T01 (API client and error handling)

**Exposes:**
- Tenant context for all subsequent tasks
- Route guards for admin protection
- Slug resolution utilities
- Multi-tenant routing system

#### 6. Executive Rationale
**Why this exists:** Correct tenant resolution is prerequisite for every page and for RLS-aligned calls. Ensures proper tenant isolation and routing behavior.

**Risk/Impact if wrong:** Cross-tenant data leakage, incorrect routing, security vulnerabilities, and poor user experience.

**Rollback plan:** Revert to previous routing implementation and re-audit all tenant-related functionality.

#### 7. North-Star Invariants
- One (and only one) active tenant context at any time
- No cross-tenant state bleed
- All routes must respect tenant boundaries
- Tenant resolution must be fast and reliable

#### 8. Schema/DTO Freeze Note
**Canonical Tenant Context Schema with SHA-256 hash:**
```typescript
interface TenantContext {
  slug: string;
  tenantId?: string;
  isResolved: boolean;
  source: 'path' | 'subdomain';
}

// SHA-256: e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

**Breaking Change:** No - this is the initial tenant context establishment.

#### 9. Observability Hooks
**UI Events:**
- `routing.tenant_resolved` - When tenant is successfully resolved
- `routing.guard_blocked` - When route guard blocks access
- `routing.guard_passed` - When route guard allows access

**Metrics:**
- Tenant resolution success rate
- Route guard block rate
- Tenant context performance
- Cross-tenant access attempts

**Trace Boundaries:**
- Route navigation → tenant resolution → context update → guard check

#### 10. Error Model Enforcement
**Error Classes:**
- **Missing Slug**: No tenant slug found in URL
- **Invalid Slug**: Tenant slug doesn't exist
- **Unauthorized Access**: User not authorized for tenant
- **Context Error**: Tenant context resolution failed

**Mapping:**
- Missing Slug → "Select a business" (owner) / friendly 404 (public) → `missing_slug_error`
- Invalid Slug → "Business not found" → `invalid_slug_error`
- Unauthorized Access → "Access denied" → `unauthorized_access_error`
- Context Error → "Failed to load business" → `context_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- Tenant resolution (cached by slug)
- Route guard checks
- Context updates

**Retry Strategy:**
- Tenant resolution failures should be retried
- Route guard checks are deterministic
- Context updates are idempotent

#### 12. Output Bundle
**Final Code:**
```typescript
// /src/tenant/TenantContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { getTenantSlug, requireTenantSlug } from './utils';

interface TenantContext {
  slug: string;
  tenantId?: string;
  isResolved: boolean;
  source: 'path' | 'subdomain';
}

const TenantContext = createContext<TenantContext | null>(null);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const context = useMemo(() => {
    const slug = getTenantSlug();
    return {
      slug: slug || '',
      isResolved: !!slug,
      source: window.location.pathname.includes('/v1/') ? 'path' : 'subdomain',
    };
  }, []);

  return (
    <TenantContext.Provider value={context}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenantSlug = (): string | null => {
  const context = useContext(TenantContext);
  return context?.slug || null;
};

export const requireTenantSlug = (): string => {
  const slug = useTenantSlug();
  if (!slug) throw new Error('Tenant slug not found in URL or subdomain');
  return slug;
};

// /src/routes/index.tsx
export const routes = {
  public: '/v1/:slug/*',
  admin: '/admin/*',
  landing: '/',
  auth: '/auth/*',
} as const;
```

**How to verify:**
1. Run routing tests: `npm run test:routing`
2. Verify tenant resolution works
3. Check route guards block unauthorized access
4. Confirm deep links work after refresh

---

### T02A — Auth & Sign-Up Flow (Landing → Sign Up → Onboarding Redirect)

You are implementing Task T02A: Auth & Sign-Up Flow from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context (quote IDs)
- **Brief §2.1**: "User Journey A: Onboarding" - Sign-up flow and onboarding redirect
- **Brief §3.1**: "Technical Architecture" - Authentication with Supabase Auth integration
- **CP §"apiClient"**: Authentication headers and token management
- **CP §"endpoints"**: Auth-related endpoint structures

**Narrative**: This task provides a clean entry to the product with a landing page, sign-up form, and automatic redirect to onboarding. It establishes the authentication flow and prepares users for the onboarding process.

#### 1. Deliverables
**Code:**
- `/src/routes` - Routes for `/` (Landing) and `/auth/sign-up`
- `/src/components/SignUpForm.tsx` - Sign-up form with validation
- `/src/pages/Landing.tsx` - Landing page with "Get Started" CTA
- `/src/pages/SignUp.tsx` - Sign-up page with form

**Contracts:**
- Sign-up form validation schema
- Authentication response handling
- Onboarding prefill payload
- Error handling for auth failures

**Docs:**
- Authentication flow documentation
- Sign-up form validation rules
- Onboarding redirect strategy
- Error handling guidelines

**Tests:**
- Unit tests for form validation
- Integration tests for auth flow
- E2E tests for sign-up process
- Accessibility tests for forms

#### 2. Constraints
- **Performance**: LCP p75 < 2.0s on landing page
- **Accessibility**: AA contrast, visible focus, logical tab order
- **No Booking Link**: No link to public booking from homepage
- **Form Validation**: Inline + server validation for duplicate/weak password
- **Keyboard Navigation**: Complete keyboard and screen-reader support

#### 3. Inputs → Outputs
**Inputs:**
- Auth service (JWT) from API client
- Contracts for onboarding Step 1 fields
- User registration data
- Validation rules

**Outputs:**
- Created user session
- Prefill payload to onboarding
- Authentication state
- Error handling

#### 4. Validation & Testing
**Acceptance Criteria:**
- Landing "Get Started" → navigates to Sign-Up
- Successful submit persists user and redirects to Step 1 with prefilled known fields
- Error states: duplicate email, weak password, network errors (TithiError toast + inline messages)
- Analytics: `auth.signup_submit`, `auth.signup_success|error`

**Unit Tests:**
- Field validators functionality
- Focus management
- A11y roles and attributes
- Form validation logic

**Integration Tests:**
- Success/error flows
- Redirect with prefill state
- Authentication state management
- Error message display

**E2E Tests:**
- Complete sign-up flow
- Reload on onboarding with fields remaining
- Error handling scenarios
- Accessibility compliance

**Manual QA:**
- [ ] Sign-up form works correctly
- [ ] Validation messages are clear
- [ ] Redirect to onboarding works
- [ ] Accessibility requirements met

#### 5. Dependencies
**DependsOn:** T01 (API client and error handling)

**Exposes:**
- Authentication flow for subsequent tasks
- User session management
- Onboarding prefill system
- Error handling for auth

#### 6. Executive Rationale
**Why this exists:** Removes ambiguity on entry path and prepares onboarding with context. Provides clear user journey from landing to sign-up to onboarding.

**Risk/Impact if wrong:** Poor user experience, authentication failures, onboarding confusion, and user drop-off.

**Rollback plan:** Revert to previous auth implementation and re-audit all authentication flows.

#### 7. North-Star Invariants
- Fast paint, clear path, zero confusion
- Accessible form by default
- Secure authentication flow
- Clear error messaging

#### 8. Schema/DTO Freeze Note
**Canonical Sign-Up Schema with SHA-256 hash:**
```typescript
interface SignUpRequest {
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
}

interface SignUpResponse {
  user_id: string;
  session_token: string;
  onboarding_prefill: Partial<OnboardingStep1>;
}

// SHA-256: f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1
```

**Breaking Change:** No - this is the initial sign-up schema establishment.

#### 9. Observability Hooks
**UI Events:**
- `auth.signup_submit` - When sign-up form is submitted
- `auth.signup_success` - When sign-up is successful
- `auth.signup_error` - When sign-up fails
- `onboarding.prefill_ready` - When onboarding prefill is ready

**Metrics:**
- Sign-up conversion rate
- Form validation error rate
- Authentication success rate
- Onboarding prefill success rate

**Trace Boundaries:**
- Form submission → validation → API call → response → redirect

#### 10. Error Model Enforcement
**Error Classes:**
- **Validation Error**: Form validation failures
- **Duplicate Email**: Email already exists
- **Weak Password**: Password doesn't meet requirements
- **Network Error**: API connection issues

**Mapping:**
- Validation Error → Inline form messages → `validation_error`
- Duplicate Email → "Email already exists" → `duplicate_email_error`
- Weak Password → "Password too weak" → `weak_password_error`
- Network Error → "Connection failed" → `network_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- Sign-up POST (uses email + timestamp hash for idempotency key)
- Onboarding prefill generation
- Session creation

**Retry Strategy:**
- Network errors should be retried
- Validation errors should not be retried
- Duplicate email errors should not be retried

#### 12. Output Bundle
**Final Code:**
(note that things might have to be changed around based on the docuentation and context you read before executing, this is a example of something I'd like. )
```typescript
// /src/components/SignUpForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, generateIdempotencyKey } from '../api/client';

interface SignUpFormData {
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
}

export const SignUpForm: React.FC = () => {
  const [formData, setFormData] = useState<SignUpFormData>({
    email: '',
    password: '',
    phone: '',
    first_name: '',
    last_name: '',
  });
  const [errors, setErrors] = useState<Partial<SignUpFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await apiClient.post('/auth/signup', formData, {
        headers: { 'Idempotency-Key': generateIdempotencyKey() },
      });

      // Redirect to onboarding with prefill data
      navigate('/onboarding/step-1', {
        state: { prefill: response.data.onboarding_prefill },
      });
    } catch (error) {
      // Handle errors with TithiError
      setErrors({ email: 'Sign-up failed. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          required
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>
      {/* Additional form fields */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        {isSubmitting ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>
  );
};
```

**How to verify:**
1. Run auth tests: `npm run test:auth`
2. Verify sign-up form works
3. Check validation messages
4. Confirm redirect to onboarding works

---

### T03 — Design System Tokens & Status Colors (White-Label Guardrails)

You are implementing Task T03: Design System Tokens & Status Colors from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

#### 0. Context (quote IDs)
- **Brief §2.2**: "Design System" - Color Palette, Typography, Component Library
- **Brief §3.1**: "Technical Architecture" - Styling with Tailwind CSS with custom design system
- **CP §"types"**: Design system type definitions and token structures
- **CP §"config"**: Design token configuration requirements

**Narrative**: This task enforces the business's primary color and status palette across components and public pages, with explicit white-label guarantees. It provides AA contrast enforcement and snapshot coverage for logo placement rules.

#### 1. Deliverables
**Code:**
- `/tailwind.config.ts` - Tailwind theme extension
- `/src/styles/tokens.ts` - Primary color (tenant) + semantic tokens
- `/src/components/StatusBadge.tsx` - Status colors for pending|confirmed|attended|no-show|cancelled
- `/src/utils/applyTenantTheme.ts` - Brand application utilities

**Contracts:**
- Status color mapping interface
- Tenant theme application interface
- Contrast validation utilities
- Logo placement rules

**Docs:**
- Design system documentation
- Status color usage guide
- White-label implementation guide
- Contrast compliance documentation

**Tests:**
- Unit tests for token exports
- Visual regression tests for status badges
- Contrast validation tests
- White-label compliance tests

#### 2. Constraints
- **Contrast**: ≥ 4.5:1 for text/UI against backgrounds
- **Performance**: Zero runtime color calculations on every render; CSS variables preferred
- **White-Label**: Public pages never show platform brand
- **Accessibility**: AA contrast warnings for illegal combinations
- **Consistency**: Status colors must match spec mapping

#### 3. Inputs → Outputs
**Inputs:**
- Branding from Phase 0 contracts
- Palette specification
- Logo asset requirements
- Contrast requirements

**Outputs:**
- Design tokens and utilities
- Status badge component
- Theme application system
- Visual regression baselines

#### 4. Validation & Testing
**Acceptance Criteria:**
- StatusBadge colors match the spec mapping
- AA contrast warnings for illegal combinations (build-time check + runtime dev warning)
- Snapshot tests enforce large logo on Public "Welcome" header and small logo top-left on all other booking pages
- White-label check: no "Tithi" strings in public DOM

**Unit Tests:**
- Token exports validation
- StatusBadge variants
- Contrast calculation
- Theme application

**Visual Tests:**
- Snapshots for public routes (welcome/availability/checkout/confirmation)
- Status badge rendering
- Logo placement verification
- White-label compliance

**A11y Tests:**
- Axe pass for color/contrast on sample screens
- Contrast ratio validation
- Color blindness compatibility

**Manual QA:**
- [ ] Status colors are correct
- [ ] Contrast meets AA standards
- [ ] Logo placement is correct
- [ ] No platform branding on public pages

#### 5. Dependencies
**DependsOn:** None (can progress in parallel with T01/T02)

**Exposes:**
- Design tokens for all subsequent tasks
- Status badge component
- Theme application utilities
- White-label compliance system

#### 6. Executive Rationale
**Why this exists:** Locked tokens + snapshots = stable visual identity and brand safety. Ensures consistent branding and accessibility across all surfaces.

**Risk/Impact if wrong:** Inconsistent branding, accessibility violations, poor visual identity, and brand safety issues.

**Rollback plan:** Revert to previous design tokens and re-audit all visual components.

#### 7. North-Star Invariants
- Brand-true, accessible, and consistent on every surface
- Public pages are 100% business-branded
- All colors meet AA contrast requirements
- Status colors are consistent across all components

#### 8. Schema/DTO Freeze Note
**Canonical Design Token Schema with SHA-256 hash:**
```typescript
interface DesignTokens {
  colors: {
    primary: string;
    status: {
      pending: string;
      confirmed: string;
      attended: string;
      no_show: string;
      cancelled: string;
    };
  };
  spacing: Record<string, string>;
  typography: Record<string, any>;
}

// SHA-256: g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Breaking Change:** No - this is the initial design token establishment.

#### 9. Observability Hooks
**UI Events:**
- `branding.theme_applied` - When tenant theme is applied
- `branding.contrast_check` - When contrast is validated
- `branding.logo_placed` - When logo is placed

**Metrics:**
- Theme application success rate
- Contrast compliance rate
- Logo placement accuracy
- White-label compliance score

**Trace Boundaries:**
- Theme loading → validation → application → rendering

#### 10. Error Model Enforcement
**Error Classes:**
- **Contrast Error**: Insufficient contrast ratio
- **Theme Error**: Theme application failure
- **Logo Error**: Logo placement issue
- **Brand Error**: White-label violation

**Mapping:**
- Contrast Error → Dev warning (never block user) → `contrast_warning`
- Theme Error → "Theme failed to load" → `theme_error`
- Logo Error → "Logo placement failed" → `logo_error`
- Brand Error → "Brand violation detected" → `brand_error`

#### 11. Idempotency & Retry
**Idempotent Actions:**
- Theme application
- Logo placement
- Contrast validation

**Retry Strategy:**
- Theme loading failures should be retried
- Contrast validation is deterministic
- Logo placement is idempotent

#### 12. Output Bundle
**Final Code:**
```typescript
// /src/styles/tokens.ts
export const statusColors = {
  pending: '#F59E0B',    // Yellow
  confirmed: '#3B82F6',  // Blue
  attended: '#10B981',   // Green
  no_show: '#EF4444',    // Red
  cancelled: '#6B7280',  // Gray
} as const;

export const applyTenantTheme = (tenant: { primary_color: string }) => {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', tenant.primary_color);
};

// /src/components/StatusBadge.tsx
import React from 'react';
import { statusColors } from '../styles/tokens';

interface StatusBadgeProps {
  status: keyof typeof statusColors;
  children: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children }) => {
  const color = statusColors[status];
  
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color, color: 'white' }}
    >
      {children}
    </span>
  );
};

// /tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        status: statusColors,
      },
    },
  },
};
```

**How to verify:**
1. Run design system tests: `npm run test:design-system`
2. Verify status colors are correct
3. Check contrast compliance
4. Confirm white-label compliance

---

## Phase 0 & 1 Exit Criteria

### Phase 0 Exit Criteria (Gate to Phase 1)
Phase 0 is considered DONE when:
- ✅ T00 merged and signed off — no "OPEN_QUESTION" left, all DTOs final
- ✅ T39 merged — full analytics taxonomy + PII rules accepted by both frontend & backend
- ✅ T43 merged — responsive tokens & typography scale in Tailwind and documented
- ✅ Budgets finalized: Performance (LCP p75 < 2.0s admin / < 2.5s public, CLS p75 < 0.1, INP p75 < 200ms, initial bundle < 500KB), Accessibility (WCAG 2.1 AA baseline + Axe CI gate targets ≥ 98%)
- ✅ Retry/Idempotency strategy is documented and implemented in the API client skeleton
- ✅ Observability: `api_contracts.version_published` & `analytics.schema_loaded` events fire successfully in dev

### Phase 1 Exit Criteria (Gate to Phase 2)
Phase 1 is considered DONE when:
- ✅ T01: client, env, observability, idempotency, 429 retry in place
- ✅ T02: tenant routing works for both admin and public; context isolation proven
- ✅ T02A: auth + sign-up live; LCP p75 < 2.0s on /; onboarding prefill verified
- ✅ T03: tokens + StatusBadge shipped; contrast ≥ 4.5:1 enforced; white-label snapshots pass
- ✅ CI: unit + integration green; Playwright visual baselines recorded; Web Vitals emitting in dev
- ✅ No "TBDs" remain from Phase 0 in these areas

Once these are delivered, Phase 2 (Onboarding Core — T04–T07 + T07A) can safely begin with no schema churn or unknown budgets.

---

*End of Tithi Frontend Ticketed Prompts - Phase 0 & 1*
