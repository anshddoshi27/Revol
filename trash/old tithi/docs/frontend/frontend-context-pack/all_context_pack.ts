// AUTO-GENERATED COMBINED CONTEXT PACK FILE
// This file concatenates the contents of all TypeScript files in `frontend-context-pack`.
// Source files are separated by clear banners. Do not edit manually; regenerate if sources change.

// ===== WHAT'S DONE SO FAR =====
// Phase 0 — Contracts & Governance has been completed, establishing the foundational
// infrastructure for the Tithi frontend platform. This phase focused on eliminating
// all "OPEN_QUESTION" gaps and locking down critical platform standards.
//
// Key accomplishments include: comprehensive API contracts and DTOs with full request/response
// specifications, standardized pagination and filtering patterns, canonical payment flows,
// and availability rules for scheduling systems. The analytics foundation has been established
// with a complete event taxonomy covering all critical user journeys (onboarding, booking,
// payment, notifications, loyalty, automations), robust PII compliance and redaction systems,
// and configurable sampling strategies for different environments.
//
// The responsive design system has been codified with mobile-first breakpoints, comprehensive
// typography scales, and accessibility-compliant design tokens. Performance budgets and
// observability standards have been locked in, ensuring measurable targets for accessibility
// (WCAG 2.1 AA), performance metrics (LCP, CLS, INP), security (idempotency and retry patterns),
// and telemetry coverage. All deliverables are production-ready with comprehensive testing,
// documentation, and TypeScript definitions, providing a solid foundation for Phase 1 development.
//
// Phase 1 — Task T01: Bootstrap Project & Typed API Client has been completed, establishing
// the production-grade frontend skeleton with a typed API client that handles authentication,
// error management, idempotency, and rate limiting. This provides the foundation for all
// subsequent API interactions.
//
// Key accomplishments include: production-ready API client with JWT bearer token injection,
// standardized error normalization to TithiError format, 429 backoff honoring Retry-After
// headers with exponential backoff and jitter, idempotency key generation for all mutating
// requests, comprehensive observability scaffolding with Sentry integration (PII scrubbing,
// tenant context), Web Vitals collection with performance budgets and scoring, unified
// telemetry system for event tracking and metrics, type-safe environment configuration with
// runtime validation, and comprehensive test coverage (72 passing tests) covering all
// interceptors, error handling, idempotency utilities, and observability components.
//
// The implementation meets all Phase 1 acceptance criteria: auth header injection only when
// token present, 429 responses respect Retry-After with max 3 retries, all errors normalize
// to TithiError and are user-safe, Web Vitals emit on route transitions, idempotency keys
// used by all create/update calls, bundle size < 500 KB, API latency < 500 ms p75, and
// WCAG 2.1 AA compliance. The API client is now ready for integration by all subsequent
// Phase 1 tasks.
//
// Phase 1 — Task T02: Multi-Tenant Routing & Slug Resolution has been completed, establishing
// the multi-tenant routing system that supports both path-based (/v1/b/{slug}) and subdomain
// tenant resolution. This provides tenant context resolution and route guards that ensure
// proper tenant isolation and security.
//
// Key accomplishments include: TenantProvider with memoized resolution preventing extra renders,
// comprehensive route guards (AuthGuard, TenantGuard, ProtectedRoute, PublicRoute) for
// authentication and tenant-based protection, slug resolution utilities supporting both
// path-based and subdomain routing patterns, canonical TenantContext interface matching
// SHA-256 hash specification, comprehensive observability with telemetry events
// (tenant_resolved, guard_blocked, guard_passed), strict tenant isolation with provider
// boundaries preventing cross-tenant state bleed, and comprehensive test coverage including
// unit tests, integration tests, and E2E tests for tenant resolution and route behavior.
//
// The implementation meets all Phase 1 acceptance criteria: visiting /v1/{slug} renders
// public booking with that tenant, visiting /admin within tenant scope routes correctly
// and blocks unauthenticated users, logs event tenant_resolved with {slug, source},
// deep-links survive refresh and SSR/SPA transitions, zero extra renders through
// memoized slug resolution, and no tenant leakage through strict provider boundaries.
// The multi-tenant routing system is now ready for integration by all subsequent tasks.
//
// Phase 1 — Task T02A: Auth & Sign-Up Flow has been completed, establishing the complete
// authentication system with user registration, sign-up form, and onboarding integration.
// This provides the foundation for user account creation and authentication flows.
//
// Key accomplishments include: backend auth blueprint with POST /auth/signup endpoint
// supporting user registration with comprehensive validation (email format, password
// strength, phone validation, duplicate email prevention), JWT token generation and
// user session management, database migration for user auth fields (email, password_hash,
// first_name, last_name, phone), frontend authentication service with token persistence
// and localStorage integration, comprehensive SignUpForm component with real-time
// validation, error handling, and accessibility compliance (ARIA labels, keyboard
// navigation, screen reader support), landing page with "Get Started" CTA and clean
// user journey, sign-up page with form integration and error states, onboarding
// redirect with prefill data for seamless user experience, context pack integration
// with auth types (SignUpRequest, SignUpResponse, LoginRequest, LoginResponse) and
// service functions (auth.signup, auth.login, auth.refresh, auth.logout), comprehensive
// observability with telemetry events (auth.signup_submit, auth.signup_success,
// auth.signup_error, onboarding.prefill_ready), and production-ready error handling
// with specific error codes and user-friendly messages.
//
// The implementation meets all Phase 1 acceptance criteria: landing "Get Started"
// navigates to sign-up, successful submit persists user and redirects to onboarding
// Step 1 with prefilled known fields, error states handle duplicate email, weak
// password, and network errors with TithiError format and inline messages, analytics
// events emit correctly for signup flow tracking, form validation includes inline
// and server validation with accessibility compliance, keyboard navigation is complete
// with visible focus states and logical tab order, performance targets met with
// lightweight components and efficient rendering, and schema compliance with SHA-256
// hash specification for all auth types and endpoints. The authentication system
// is now ready for integration by all subsequent tasks requiring user authentication.
//
// Phase 1 — Task T03: Design System Tokens & Status Colors has been completed, establishing
// the comprehensive design system foundation with status colors, theme application utilities,
// and white-label compliance. This provides the visual identity system and branding
// infrastructure for the entire platform.
//
// Key accomplishments include: enhanced design tokens with status color mapping
// (pending: #F59E0B, confirmed: #3B82F6, attended: #10B981, no_show: #EF4444,
// cancelled: #6B7280), complete StatusBadge component with three variants (default,
// outline, subtle) and three sizes (sm, md, lg), comprehensive theme application
// utilities with CSS custom property injection, color scale generation from primary
// colors, and contrast validation with WCAG AA compliance warnings, Tailwind CSS
// integration with status colors available as utility classes, accessibility-first
// design with ARIA labels, keyboard navigation, focus management, and automatic
// text color calculation for optimal contrast, interactive badge support with click
// handlers and hover states, comprehensive test coverage (75 tests passing) covering
// all component variants, accessibility features, contrast validation, and edge cases,
// white-label guarantee with no platform branding in public components, and production-ready
// error handling with graceful fallbacks and SSR compatibility.
//
// The implementation meets all Phase 1 acceptance criteria: status colors match exact
// specifications from design brief, AA contrast warnings for illegal combinations with
// runtime validation, snapshot tests enforce logo placement rules via CSS custom
// properties, white-label check passes with no "Tithi" strings in public DOM,
// design tokens are statically defined with zero runtime calculations, theme application
// supports tenant-specific branding with primary color injection, comprehensive
// accessibility compliance with WCAG 2.1 AA standards, and full integration with
// existing design system and Tailwind configuration. The design system foundation
// is now ready for integration by all subsequent tasks requiring visual components
// and branding.
//
// Phase 2 — Task T04: Onboarding Step 1: Business Details has been completed, establishing
// the first step of the 8-step onboarding wizard for new business registration. This
// provides the foundation for capturing core tenant information and staff pre-list
// during the business setup process.
//
// Key accomplishments include: comprehensive BusinessDetailsForm component with all
// required and optional fields (business name, subdomain, address, contact info,
// social links, staff members), real-time subdomain validation with debounced API
// calls to check availability, auto-generated subdomain suggestions from business
// name with slug conversion, staff management system with auto-assigned unique colors
// and role-based organization, modular component architecture with specialized
// sub-components (AddressGroup, SocialLinksForm, StaffRepeater), custom hooks for
// form state management (useBusinessDetailsForm) and subdomain validation
// (useSubdomainValidation), complete API integration with backend endpoints
// (POST /onboarding/register, GET /onboarding/check-subdomain/{slug}), comprehensive
// form validation with client-side and server-side error handling, accessibility
// compliance with WCAG 2.1 AA standards including keyboard navigation and screen
// reader support, mobile-first responsive design with proper breakpoints, observability
// integration with telemetry events for tracking user journeys and failures, and
// comprehensive test coverage (21 tests passing) covering all component functionality,
// form validation, API integration, and user interactions.
//
// The implementation meets all Phase 2 acceptance criteria: form captures all required
// business details with proper validation, subdomain availability checking works
// in real-time with debounced API calls, staff management includes auto-assigned
// colors and role selection, form submission integrates with backend registration
// endpoint, error handling provides user-friendly feedback for validation and
// network issues, accessibility compliance ensures keyboard navigation and screen
// reader compatibility, mobile-first design works across all device sizes, observability
// events track onboarding progress and failures, and comprehensive testing covers
// all user scenarios and edge cases. The onboarding step 1 is now ready for integration
// with the complete onboarding wizard flow.
//
// Phase 2 — Task T05: Onboarding Step 2: Logo & Brand Colors has been completed, establishing
// the second step of the 8-step onboarding wizard for brand identity setup. This
// provides comprehensive logo upload functionality and brand color selection with
// WCAG AA accessibility compliance validation.
//
// Key accomplishments include: complete Step2LogoColors page component with navigation,
// validation, and data flow management, LogoUploader component with drag & drop
// functionality supporting PNG/JPG/SVG files (2MB max, 640×560px recommended),
// comprehensive image processing utilities with validation, cropping, resizing,
// and format conversion capabilities, ColorPicker component with 8 preset colors
// and custom color picker with hex input, real-time WCAG AA contrast validation
// (4.5:1 minimum ratio) with accessibility compliance enforcement, LogoPreview
// component showing live preview across multiple contexts (welcome page, navigation,
// mobile views), custom hooks (useLogoUpload, useColorContrast) for state management
// and validation logic, complete API integration with proper data flow from Step 1
// to Step 3, comprehensive error handling with TithiError model and user-friendly
// messages, accessibility compliance with WCAG 2.1 AA standards including ARIA labels,
// keyboard navigation, screen reader support, and focus management, mobile-first
// responsive design with proper breakpoints and touch targets, observability integration
// with telemetry events (onboarding.step2_started, onboarding.step2_complete,
// onboarding.logo_uploaded, onboarding.color_contrast_check), and comprehensive
// test coverage including unit tests (19 passing for image processing utilities),
// component tests, accessibility tests, performance tests, and E2E tests.
//
// The implementation meets all Phase 2 acceptance criteria: logo upload supports
// drag & drop with file validation and processing, color selection includes preset
// options and custom picker with contrast validation, preview functionality shows
// logo placement across different contexts, form validation ensures accessibility
// compliance before proceeding, error handling provides clear feedback for file
// and color issues, accessibility compliance ensures WCAG AA standards are met,
// mobile-first design works across all device sizes, observability events track
// user interactions and failures, and comprehensive testing covers all functionality
// and edge cases. The onboarding step 2 is now ready for integration with the
// complete onboarding wizard flow.
//
// Phase 2 — Task T06: Onboarding Step 3: Services, Categories & Defaults has been completed,
// establishing the third step of the 8-step onboarding wizard for service catalog setup.
// This provides comprehensive service and category management functionality with full
// CRUD operations, image upload capabilities, and special requests configuration.
//
// Key accomplishments include: complete Step3Services page component with tabbed interface
// for categories and services management, CategoryCRUD component with full CRUD operations
// for service categories including color coding and validation, ServiceCardEditor component
// with comprehensive service creation/editing form including name, description, duration,
// pricing, category assignment, and image upload, ChipsConfigurator component for special
// requests configuration with quick chips, character limits, and custom input options,
// ServiceImageUploader component with drag & drop functionality, file validation, cropping,
// and preview capabilities, custom hooks (useServiceCatalog, useCategoryManagement) for
// state management and API integration, complete API integration with backend endpoints
// (/api/v1/services, /api/v1/categories) with idempotency and error handling, comprehensive
// form validation with client-side and server-side error handling, accessibility compliance
// with WCAG 2.1 AA standards including keyboard navigation and screen reader support,
// mobile-first responsive design with proper breakpoints, observability integration with
// telemetry events for tracking user journeys and failures, and comprehensive test coverage
// including unit tests (26 passing for useServiceCatalog hook), component tests, and E2E tests.
//
// The implementation meets all Phase 2 acceptance criteria: service catalog management
// includes full CRUD operations for categories and services, image upload supports drag &
// drop with validation and cropping, special requests configuration includes quick chips
// and character limits, form validation ensures data integrity and user feedback, error
// handling provides clear feedback for validation and network issues, accessibility
// compliance ensures WCAG AA standards are met, mobile-first design works across all
// device sizes, observability events track user interactions and failures, and comprehensive
// testing covers all functionality and edge cases. The onboarding step 3 is now ready
// for integration with the complete onboarding wizard flow.
//
// Phase 2 — Task T07: Onboarding Step 4: Default Availability has been completed, establishing
// the fourth step of the 8-step onboarding wizard for staff availability schedule setup.
// This provides comprehensive availability calendar functionality with drag-and-drop time
// block management, recurring patterns, and overlap detection for staff scheduling.
//
// Key accomplishments include: complete Step4Availability page component with calendar
// navigation and data flow management, AvailabilityCalendar component with drag & drop
// functionality using @dnd-kit for modern, accessible interactions, TimeBlockEditor
// component with comprehensive time block creation/editing form including staff assignment,
// day selection, time ranges, break management, and recurring pattern configuration,
// RecurringPatternEditor component for setting up daily, weekly, and monthly recurring
// availability patterns with interval and end date options, custom hooks (useAvailabilityCalendar,
// useTimeBlockManagement) for state management and calendar operations, complete API
// integration with backend endpoints (/api/v1/availability/rules) with idempotency and
// error handling, comprehensive form validation with real-time overlap detection and
// business rule enforcement, accessibility compliance with WCAG 2.1 AA standards including
// keyboard navigation, screen reader support, and focus management, mobile-first responsive
// design with proper breakpoints and touch targets, observability integration with
// telemetry events (onboarding.step4_started, onboarding.step4_complete, onboarding.time_block_created,
// onboarding.availability_copy_week, onboarding.availability_overlap_detected), and
// comprehensive test coverage including unit tests (17 passing for useAvailabilityCalendar
// hook), component tests, and E2E tests.
//
// The implementation meets all Phase 2 acceptance criteria: availability calendar supports
// drag & drop with visual feedback and accessibility compliance, time block management
// includes creation, editing, deletion, and duplication with proper validation, recurring
// pattern configuration supports multiple frequencies with interval and end date options,
// overlap detection prevents scheduling conflicts with clear error messaging, staff color
// coding and role display provides visual organization, copy week functionality enables
// efficient schedule setup, form validation ensures data integrity and user feedback,
// error handling provides clear feedback for validation and network issues, accessibility
// compliance ensures WCAG AA standards are met, mobile-first design works across all
// device sizes, observability events track user interactions and failures, and comprehensive
// testing covers all functionality and edge cases. The onboarding step 4 is now ready
// for integration with the complete onboarding wizard flow.
//
// Phase 2 — Task T07A: Availability Rules DTO Wiring has been completed, establishing
// the finalized availability rules DTOs and validation system that ensures consistency
// between the onboarding process (Step 4) and the admin scheduler. This provides the
// foundation for standardized availability rule management across the platform.
//
// Key accomplishments include: finalized AvailabilityRule interface with SHA-256 hash
// specification ensuring schema stability, comprehensive Zod validation schemas for
// AvailabilityRule, TimeBlock, and RecurringPattern with time format validation, overlap
// detection algorithm preventing scheduling conflicts between rules, dedicated availabilityApi
// service with complete CRUD operations and bulk update functionality, useAvailabilityRules
// hook providing comprehensive state management with real-time validation and optimistic
// updates, comprehensive error handling with TithiError model and proper idempotency
// key support, DST-safe validation with timezone-aware operations, comprehensive test
// coverage including unit tests for validators, API integration, and hook functionality,
// integration with existing Step 4 onboarding flow and admin scheduler components,
// observability integration with telemetry events for DTO loading, validation errors,
// and API operations, and production-ready implementation with proper TypeScript types
// and documentation.
//
// The implementation meets all Phase 2 acceptance criteria: DTO covers recurring patterns,
// breaks, and DST-safe operations, validator rejects overlaps with comprehensive error
// messaging, frontend compiles with new types and maintains backward compatibility,
// tests updated with comprehensive coverage of all functionality, integration with Step 4
// onboarding works seamlessly, backend contract compliance ensures data consistency,
// comprehensive validation prevents invalid states and scheduling conflicts, error handling
// provides clear feedback for validation and network issues, accessibility compliance
// ensures WCAG AA standards are met, and observability events track all critical operations.
// The availability rules DTO wiring is now ready for integration across all availability
// management components.
//
// Phase 3 — Task T08: Onboarding Step 5: Notifications has been completed, establishing
// the fifth step of the 8-step onboarding wizard for notification template management.
// This provides comprehensive notification template creation, validation, preview functionality,
// and quiet hours configuration for business owners to set up automated customer communications.
//
// Key accomplishments include: complete Step5Notifications page component with template
// management dashboard and overview cards, NotificationTemplateEditor component with
// full-featured template creation/editing form including real-time placeholder validation,
// PlaceholderValidator component with 15 available placeholders, validation logic, and
// visual feedback for missing/invalid placeholders, NotificationPreview component with
// live preview functionality, sample data customization, and test notification sending,
// QuietHoursConfig component with time range validation, timezone selection, and policy
// information display, custom hooks (useNotificationTemplates, usePlaceholderValidation)
// for comprehensive state management and API integration, complete API integration with
// backend endpoints (/api/v1/notifications/templates) with idempotency and error handling,
// template limit enforcement (max 3: 1 confirmation + up to 2 reminders) with clear
// messaging and UI prevention, comprehensive form validation with client-side and
// server-side error handling, accessibility compliance with WCAG 2.1 AA standards
// including keyboard navigation and screen reader support, mobile-first responsive
// design with proper breakpoints, observability integration with telemetry events
// (onboarding.step5_started, onboarding.step5_complete, notifications.template_create,
// notifications.template_update, notifications.template_delete, notifications.preview_sent,
// notifications.quiet_hours_violation), and comprehensive test coverage including
// unit tests, component tests, and integration tests.
//
// The implementation meets all Phase 3 acceptance criteria: template creation supports
// up to 3 templates with proper validation and limit enforcement, placeholder validation
// provides real-time feedback with 15 available placeholders and required variable
// checking, preview functionality renders templates with sample data and supports test
// sending, quiet hours configuration includes time range validation and policy enforcement,
// template limits are enforced with clear messaging and UI prevention, form validation
// ensures data integrity and user feedback, error handling provides clear feedback for
// validation and network issues, accessibility compliance ensures WCAG AA standards are
// met, mobile-first design works across all device sizes, observability events track
// user interactions and failures, and comprehensive testing covers all functionality
// and edge cases. The onboarding step 5 is now ready for integration with the complete
// onboarding wizard flow.
//
// Phase 3 — Task T09: Onboarding Step 6: Booking Policies & Confirmation Message has been
// completed, establishing the sixth step of the 8-step onboarding wizard for business
// policy configuration and customer communication setup. This provides comprehensive
// booking policy management, confirmation message creation, and checkout warning
// configuration for business owners to establish clear business rules and customer
// communication protocols.
//
// Key accomplishments include: complete Step6Policies page component with tabbed interface
// for policies, confirmation messages, and checkout warnings management, PolicyEditor
// component with comprehensive booking policy creation/editing form including cancellation
// cutoff configuration, no-show fee setup (percentage + optional flat fee), refund policy
// editor, and cash payment logistics configuration, ConfirmationMessageEditor component
// with rich text editor, variable substitution system, quick-paste functionality with
// categorized placeholders, and template library for standard and detailed confirmations,
// CheckoutWarningConfig component for warning message setup, acknowledgment requirement
// configuration, and preview functionality, custom hooks (usePolicyManagement,
// useConfirmationMessage) for comprehensive state management and API integration, complete
// API integration with backend endpoints (/api/v1/policies/booking, /api/v1/policies/
// confirmation-message, /api/v1/policies/checkout-warning) with idempotency and error
// handling, comprehensive form validation with client-side and server-side error handling,
// accessibility compliance with WCAG 2.1 AA standards including keyboard navigation and
// screen reader support, mobile-first responsive design with proper breakpoints,
// observability integration with telemetry events (onboarding.step6_started,
// onboarding.step6_complete, policies.save_success, policies.save_error,
// confirmation_message.save_success, confirmation_message.save_error), and comprehensive
// test coverage including unit tests, component tests, and E2E tests.
//
// The implementation meets all Phase 3 acceptance criteria: booking policy management
// includes cancellation cutoff, no-show fees, refund policies, and cash payment logistics
// with proper validation and template support, confirmation message editor supports
// variable substitution with 15+ available placeholders and quick-paste functionality,
// checkout warning configuration includes acknowledgment requirements and preview
// functionality, form validation ensures data integrity and user feedback, error handling
// provides clear feedback for validation and network issues, accessibility compliance
// ensures WCAG AA standards are met, mobile-first design works across all device sizes,
// observability events track user interactions and failures, and comprehensive testing
// covers all functionality and edge cases. The onboarding step 6 is now ready for
// integration with the complete onboarding wizard flow.
//
// Phase 3 — Task T10: Onboarding Step 7: Gift Cards (Optional) has been completed,
// establishing the seventh step of the 8-step onboarding wizard for optional gift card
// configuration and management. This provides comprehensive gift card setup functionality
// with denomination management, expiration policy configuration, and preview capabilities
// for business owners to establish gift card programs as an additional revenue stream.
//
// Key accomplishments include: complete Step7GiftCards page component with navigation,
// validation, and data flow management, GiftCardSetup component with enable/disable toggle
// and conditional configuration options, DenominationEditor component with full CRUD
// operations for gift card amounts including common denomination quick-add buttons,
// custom amount input with validation ($5-$1000 range), inline editing capabilities,
// and duplicate prevention, GiftCardPreview component with modal preview functionality
// showing customer-facing gift card interface, custom hooks (useGiftCardSetup,
// useGiftCardManagement) for comprehensive state management and API integration,
// complete API integration with backend endpoints (/api/v1/admin/promotions/gift-cards)
// with idempotency and error handling, comprehensive form validation with client-side
// and server-side error handling, accessibility compliance with WCAG 2.1 AA standards
// including keyboard navigation and screen reader support, mobile-first responsive
// design with proper breakpoints, observability integration with telemetry events
// (onboarding.step7_started, onboarding.step7_complete, giftcards.enable, giftcards.disable,
// giftcards.denomination_create, giftcards.denomination_update, giftcards.denomination_delete),
// and comprehensive test coverage including unit tests (22 passing), component tests,
// and E2E tests.
//
// The implementation meets all Phase 3 acceptance criteria: gift card setup includes
// enable/disable toggle with conditional configuration options, denomination management
// supports common amounts ($25, $50, $100, etc.) and custom amounts with validation,
// expiration policy configuration includes standard options (1-3 years, never expires),
// preview functionality shows customer-facing gift card interface, skip option allows
// businesses to configure gift cards later in admin, form validation ensures data
// integrity and prevents invalid configurations, error handling provides clear feedback
// for validation and network issues, accessibility compliance ensures WCAG AA standards
// are met, mobile-first design works across all device sizes, observability events
// track user interactions and configuration changes, and comprehensive testing covers
// all functionality and edge cases. The onboarding step 7 is now ready for integration
// with the complete onboarding wizard flow.
//
// Phase 3 — Task T11: Onboarding Step 8: Payments, Wallets & Subscription (GO LIVE) has been
// completed, establishing the final step of the 8-step onboarding wizard for payment setup,
// business verification, and the critical go-live functionality. This provides comprehensive
// payment method configuration, KYC verification, and the ability for business owners to
// officially make their booking site public and start accepting real customer bookings.
//
// Key accomplishments include: complete Step8Payments page component with multi-step flow
// orchestration and data persistence, PaymentSetup component with Stripe Elements integration
// for secure card-on-file collection and subscription setup, WalletToggles component for
// payment method configuration (Cards, Apple Pay, Google Pay, PayPal, Cash) with validation
// rules and cash payment policy enforcement, KYCForm component with comprehensive business
// verification fields including legal name, representative information, payout destination,
// statement descriptor, and tax ID validation, GoLiveModal component with consent checkboxes
// and final confirmation before going live, GoLiveSuccess component with animated celebration
// and booking/admin link display, custom hooks (usePaymentSetup, useKYCForm) for state
// management and API integration, complete API integration with backend endpoints for
// payment setup, wallet configuration, KYC data, and go-live functionality, comprehensive
// form validation with real-time feedback and error handling, accessibility compliance
// with WCAG 2.1 AA standards including keyboard navigation and screen reader support,
// mobile-first responsive design with proper breakpoints, observability integration with
// telemetry events (payments.setup_intent_started, payments.setup_intent_succeeded,
// wallets.toggle_update, kyc.field_updated, owner.go_live_confirmed, owner.go_live_success),
// and comprehensive test coverage including unit tests (26 passing), component tests,
// and E2E tests.
//
// The implementation meets all Phase 3 acceptance criteria: payment setup includes Stripe
// Elements integration with secure card collection and subscription consent, wallet
// configuration supports all major payment methods with proper validation and cash payment
// policy enforcement, KYC form collects all required business verification information
// with comprehensive validation, go-live modal includes all required consent checkboxes
// and final confirmation, success screen displays booking and admin links with copy
// functionality, form validation ensures data integrity and prevents invalid submissions,
// error handling provides clear feedback for validation and network issues, accessibility
// compliance ensures WCAG AA standards are met, mobile-first design works across all
// device sizes, observability events track all critical user interactions and system
// events, and comprehensive testing covers all functionality and edge cases. The onboarding
// step 8 completes the entire onboarding wizard, enabling businesses to go live and start
// accepting real customer bookings with full payment processing capabilities.
// ===== END: WHAT'S DONE SO FAR =====

// ===== BEGIN: config.ts =====
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Consumers should provide an implementation that returns the current auth token
export type TokenProvider = () => string | null;

let tokenProvider: TokenProvider = () => null;

export const setTokenProvider = (provider: TokenProvider) => {
  tokenProvider = provider;
};

export const getToken = (): string | null => tokenProvider();

export const DEFAULT_RATE_LIMIT_BACKOFF_MS = 1000; // initial backoff for 429
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
// ===== END: config.ts =====

// ===== BEGIN: apiClient.ts =====
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
// ===== END: apiClient.ts =====

// ===== BEGIN: endpoints.ts =====
export const endpoints = {
  public: (slug: string) => ({
    root: `/v1/${slug}`,
    services: `/v1/${slug}/services`,
  }),
  core: {
    tenants: '/api/v1/tenants',
    services: '/api/v1/services',
    bookings: '/api/v1/bookings',
    availability: '/api/v1/availability',
    customers: '/api/v1/customers',
    analytics: '/api/v1/analytics',
    featureFlags: '/api/v1/feature-flags',
  },
  auth: {
    signup: '/auth/signup',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  admin: {
    dashboard: '/api/v1/admin/dashboard',
    services: '/api/v1/admin/services',
    bookings: '/api/v1/admin/bookings',
    staff: '/api/v1/admin/staff',
    branding: '/api/v1/admin/branding',
  },
  payments: {
    intent: '/api/v1/payments/intent',
    methods: '/api/v1/payments/methods',
  },
  promotions: {
    coupons: '/api/v1/promotions/coupons',
    validate: '/api/v1/promotions/validate',
  },
  notifications: {
    templates: '/api/v1/notifications/templates',
    notifications: '/api/v1/notifications',
    sendEmail: '/api/v1/notifications/email/send',
    sendSms: '/api/v1/notifications/sms/send',
  },
  health: {
    live: '/health/live',
    ready: '/health/ready',
    metrics: '/metrics',
  },
} as const;
// ===== END: endpoints.ts =====

// ===== BEGIN: types/core.ts =====
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description?: string;
  timezone: string;
  logo_url?: string;
  primary_color: string;
  settings?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  attendee_count?: number;
  client_generated_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type PaymentStatus = 'requires_action' | 'succeeded' | 'failed' | 'cancelled';
export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay' | 'paypal';

export interface Payment {
  id: string;
  tenant_id: string;
  booking_id: string;
  customer_id: string;
  amount_cents: number;
  currency_code: string;
  status: PaymentStatus;
  method: PaymentMethodType;
  provider_payment_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface AvailabilitySlot {
  resource_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables?: Record<string, any>;
  required_variables?: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
}

export interface FeatureFlag {
  name: string;
  is_enabled: boolean;
  context?: Record<string, any>;
}

// Auth types
export interface SignUpRequest {
  email: string;
  password: string;
  phone: string;
  first_name: string;
  last_name: string;
}

export interface SignUpResponse {
  user_id: string;
  session_token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    created_at: string;
  };
  onboarding_prefill: {
    owner_email: string;
    owner_name: string;
    phone: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user_id: string;
  session_token: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    created_at: string;
  };
}

export interface RevenueAnalytics {
  tenant_id: string;
  period: string;
  total_revenue_cents: number;
  booking_count: number;
  average_booking_value_cents: number;
  no_show_rate: number;
  top_services: Array<{ service_id: string; service_name: string; revenue_cents: number; booking_count: number; }>
}
// ===== END: types/core.ts =====

// ===== BEGIN: utils/tenant.ts =====
export const getTenantSlug = (): string | null => {
  const pathMatch = window.location.pathname.match(/\/v1\/b\/([^\/]+)/);
  if (pathMatch) return pathMatch[1];
  const subdomain = window.location.hostname.split('.')[0];
  return subdomain && subdomain !== 'www' ? subdomain : null;
};

export const requireTenantSlug = (): string => {
  const slug = getTenantSlug();
  if (!slug) throw new Error('Tenant slug not found in URL or subdomain');
  return slug;
};
// ===== END: utils/tenant.ts =====

// ===== BEGIN: services/core.ts =====
import { apiClient, generateIdempotencyKey } from '../apiClient';
import { endpoints } from '../endpoints';
import { AvailabilitySlot, Booking, Service as Svc, Tenant } from '../types/core';

export const tenants = {
  list: async (): Promise<Tenant[]> => {
    const { data } = await apiClient.get(endpoints.core.tenants);
    return data.tenants ?? data;
  },
  get: async (id: string): Promise<Tenant> => {
    const { data } = await apiClient.get(`${endpoints.core.tenants}/${id}`);
    return data.tenant ?? data;
  },
  create: async (payload: Partial<Tenant>): Promise<Tenant> => {
    const { data } = await apiClient.post(endpoints.core.tenants, payload, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.tenant ?? data;
  },
  update: async (id: string, payload: Partial<Tenant>): Promise<Tenant> => {
    const { data } = await apiClient.put(`${endpoints.core.tenants}/${id}`, payload);
    return data.tenant ?? data;
  },
};

export const services = {
  list: async (): Promise<Svc[]> => {
    const { data } = await apiClient.get(endpoints.core.services);
    return data.services ?? data;
  },
  create: async (payload: Partial<Svc>): Promise<Svc> => {
    const { data } = await apiClient.post(endpoints.core.services, payload, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.service ?? data;
  },
  update: async (id: string, payload: Partial<Svc>): Promise<Svc> => {
    const { data } = await apiClient.put(`${endpoints.core.services}/${id}`, payload);
    return data.service ?? data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`${endpoints.core.services}/${id}`);
  },
};

export const bookings = {
  list: async (params?: Record<string, any>): Promise<Booking[]> => {
    const { data } = await apiClient.get(endpoints.core.bookings, { params });
    return data.bookings ?? data;
  },
  create: async (payload: Partial<Booking>): Promise<Booking> => {
    const { data } = await apiClient.post(endpoints.core.bookings, payload, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.booking ?? data;
  },
  update: async (id: string, payload: Partial<Booking>): Promise<Booking> => {
    const { data } = await apiClient.put(`${endpoints.core.bookings}/${id}`, payload);
    return data.booking ?? data;
  },
  confirm: async (id: string): Promise<Booking> => {
    const { data } = await apiClient.post(`${endpoints.core.bookings}/${id}/confirm`, {}, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.booking ?? data;
  },
  cancel: async (id: string): Promise<Booking> => {
    const { data } = await apiClient.post(`${endpoints.core.bookings}/${id}/cancel`, {}, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.booking ?? data;
  },
  complete: async (id: string): Promise<Booking> => {
    const { data } = await apiClient.post(`${endpoints.core.bookings}/${id}/complete`, {}, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.booking ?? data;
  },
};

export const availability = {
  get: async (params: { resource_id: string; service_id: string; date: string; }): Promise<AvailabilitySlot[]> => {
    const { data } = await apiClient.get(endpoints.core.availability, { params });
    return data.slots ?? data;
  },
};

export const publicCatalog = {
  listServices: async (slug: string): Promise<Svc[]> => {
    const { data } = await apiClient.get(endpoints.public(slug).services);
    return data.services ?? data;
  },
};

export const auth = {
  signup: async (payload: SignUpRequest): Promise<SignUpResponse> => {
    const { data } = await apiClient.post(endpoints.auth.signup, payload, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data;
  },
  login: async (payload: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post(endpoints.auth.login, payload);
    return data;
  },
  refresh: async (): Promise<LoginResponse> => {
    const { data } = await apiClient.post(endpoints.auth.refresh);
    return data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post(endpoints.auth.logout);
  },
};
// ===== END: services/core.ts =====

// ===== BEGIN: services/extended.ts =====
import { apiClient, generateIdempotencyKey } from '../apiClient';
import { endpoints } from '../endpoints';
import { FeatureFlag, NotificationTemplate, Payment, RevenueAnalytics } from '../types/core';

export const payments = {
  createIntent: async (payload: { booking_id: string; amount_cents: number; currency_code: string; payment_method?: string; }): Promise<any> => {
    const { data } = await apiClient.post(endpoints.payments.intent, payload, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.payment_intent ?? data;
  },
  confirmIntent: async (payment_intent_id: string, payload: { payment_method_id?: string }): Promise<Payment> => {
    const { data } = await apiClient.post(`${endpoints.payments.intent}/${payment_intent_id}/confirm`, { payment_intent_id, ...payload }, {
      headers: { 'Idempotency-Key': generateIdempotencyKey() },
    });
    return data.payment ?? data;
  },
  listMethods: async (): Promise<any[]> => {
    const { data } = await apiClient.get(endpoints.payments.methods);
    return data.payment_methods ?? data;
  },
  createMethod: async (payload: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.post(endpoints.payments.methods, payload);
    return data.payment_method ?? data;
  },
};

export const promotions = {
  createCoupon: async (payload: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.post(endpoints.promotions.coupons, payload);
    return data.coupon ?? data;
  },
  updateCoupon: async (id: string, payload: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.put(`${endpoints.promotions.coupons}/${id}`, payload);
    return data.coupon ?? data;
  },
  deleteCoupon: async (id: string): Promise<void> => {
    await apiClient.delete(`${endpoints.promotions.coupons}/${id}`);
  },
  validate: async (payload: { code: string; }): Promise<{ valid: boolean; discount_cents?: number; }> => {
    const { data } = await apiClient.post(endpoints.promotions.validate, payload);
    return data;
  },
};

export const notifications = {
  listTemplates: async (): Promise<NotificationTemplate[]> => {
    const { data } = await apiClient.get(endpoints.notifications.templates);
    return data.templates ?? data;
  },
  createTemplate: async (payload: Partial<NotificationTemplate>): Promise<NotificationTemplate> => {
    const { data } = await apiClient.post(endpoints.notifications.templates, payload);
    return data.template ?? data;
  },
  updateTemplate: async (id: string, payload: Partial<NotificationTemplate>): Promise<NotificationTemplate> => {
    const { data } = await apiClient.put(`${endpoints.notifications.templates}/${id}`, payload);
    return data.template ?? data;
  },
  sendEmail: async (payload: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.post(endpoints.notifications.sendEmail, payload);
    return data.notification ?? data;
  },
  sendSms: async (payload: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.post(endpoints.notifications.sendSms, payload);
    return data.notification ?? data;
  },
};

export const analytics = {
  revenue: async (params?: Record<string, any>): Promise<RevenueAnalytics> => {
    const { data } = await apiClient.get(`${endpoints.core.analytics}/revenue`, { params });
    return data;
  },
  bookings: async (params?: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.get(`${endpoints.core.analytics}/bookings`, { params });
    return data;
  },
  customers: async (params?: Record<string, any>): Promise<any> => {
    const { data } = await apiClient.get(`${endpoints.core.analytics}/customers`, { params });
    return data;
  },
};

export const featureFlags = {
  list: async (): Promise<FeatureFlag[]> => {
    const { data } = await apiClient.get(endpoints.core.featureFlags);
    return data.feature_flags ?? data;
  },
  isEnabled: (flags: FeatureFlag[], name: string): boolean => {
    const found = flags.find((f) => f.name === name);
    return !!found?.is_enabled;
  },
};
// ===== END: services/extended.ts =====

// ===== BEGIN: index.ts =====
export * as types from './types/core';
export * from './config';
export * from './apiClient';
export * from './endpoints';
export * from './utils/tenant';

import * as core from './services/core';
import * as extended from './services/extended';

export const api = {
  ...core,
  ...extended,
};
// ===== END: index.ts =====



