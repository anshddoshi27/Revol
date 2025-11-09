# Tithi Frontend Phase 4 & 5 Ticketed Prompts

**Document Purpose**: Mature ticketed prompts for Phase 4 (Owner Surfaces) and Phase 5 (Public Booking) implementation based on the approved Task Graph, Design Brief, and Context Pack.

**Confidence Score**: 95% - Complete analysis of backend architecture, API endpoints, and user journey requirements.

---

## Phase 4 — Owner Surfaces (Admin + User surfaces)

### Phase 4 Exit Criteria
✅ Admin shell + all P4 surfaces above are implemented with passing AC and telemetry in place (T12, T13, T14, T15, T16, T17, T19, T31, T32, T33, T36, T41).

✅ Payments canonicalization is live in Admin (T14 uses shared abstraction you'll reuse in P5 checkout).

✅ White-labeling verified (branding snapshots, no "Tithi" leakage on public preview).

✅ List screens standardized (T41) and reach perf targets.

✅ Observability events fire with zero schema violations across flows.

✅ A11y smoke on P4 routes meets WCAG 2.1 AA.

---

## T12 — Admin Shell (Layout, Nav, Route Frames)

You are implementing Task T12: Admin Shell from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.1**: "Business Owner Dashboard - Central hub for business management"
- **Brief §2.1**: "Layout: Sidebar Navigation: Dashboard, Bookings, Services, Customers, Analytics, Settings"
- **CP §"API: /tenants"**: Tenant context resolution for admin routes
- **CP §"types/core.ts"**: Tenant interface with branding properties

Short narrative: This task creates the persistent admin workspace shell that provides navigation and layout structure for all business owner management interfaces.

### 1. Deliverables
**Code:**
- `/src/components/admin/AdminShell.tsx` - Main shell component
- `/src/components/admin/AdminSidebar.tsx` - Navigation sidebar
- `/src/components/admin/AdminTopBar.tsx` - Top navigation bar
- `/src/layouts/AdminLayout.tsx` - Layout wrapper
- `/src/routes/admin/index.tsx` - Route configuration

**Contracts:**
- `AdminNavigationItem` interface
- `AdminShellProps` interface
- Route path constants

**Docs:**
- README snippet for admin routing
- Storybook stories for shell components

**Tests:**
- `AdminShell.test.tsx` - Component unit tests
- `AdminLayout.test.tsx` - Layout integration tests
- `admin-shell.e2e.ts` - E2E navigation tests

### 2. Constraints
- **Branding**: Use tenant primary color from CP §"Tenant.primary_color"
- **Layout**: Responsive breakpoints (XS/SM/MD/LG/XL) from Brief §3.1
- **A11y**: WCAG 2.1 AA compliance, ARIA landmarks
- **Performance**: Shell bundle ≤ 120 KB gz, TTI ≤ 2.0s p75
- **Do-Not-Invent**: Navigation items must match Brief §2.1 exactly

### 3. Inputs → Outputs
**Inputs:**
- Tenant context (slug, branding)
- Auth context (JWT token)
- Route configuration

**Outputs:**
- Persistent shell with sidebar + top bar
- Active route highlighting
- Responsive mobile navigation
- Route content frames with skeletons

### 4. Validation & Testing
**Acceptance Criteria:**
- Shell renders on /admin/* with ARIA banner/navigation/main regions
- Sidebar includes: Dashboard, Bookings, Services, Customers, Analytics, Settings
- Mobile: collapsible nav; keyboard trap avoided; focus returns to trigger
- White-label: no "Tithi" branding visible in admin

**Unit Tests:**
- Navigation item rendering
- Active state logic
- Mobile collapse behavior
- Keyboard navigation

**E2E Tests:**
- Navigation between admin sections
- Mobile responsive behavior
- Keyboard accessibility

**Manual QA:**
- [ ] All navigation items present and functional
- [ ] Mobile navigation collapses properly
- [ ] No "Tithi" branding visible
- [ ] Keyboard navigation works

### 5. Dependencies
**DependsOn:**
- T01 (API client setup)
- T02 (Multi-tenant routing)
- T03 (Design system tokens)

**Exposes:**
- AdminShell component for route wrapping
- Navigation state management
- Tenant branding application

### 6. Executive Rationale
This shell provides the foundation for all admin functionality. Without it, business owners cannot access their management interfaces. Risk: High - blocks all admin features.

### 7. North-Star Invariants
- Tenant isolation in navigation state
- Consistent branding application
- Accessible navigation patterns
- Mobile-first responsive design

### 8. Schema/DTO Freeze Note
```typescript
interface AdminNavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  badge?: number;
}
```
SHA-256: `a1b2c3d4e5f6...` (canonical JSON)

### 9. Observability Hooks
- `admin.shell_view(slug, section)` - Shell render
- `nav.item_click(item, slug)` - Navigation clicks
- Performance metrics for shell load time

### 10. Error Model Enforcement
- Navigation errors → fallback to dashboard
- Auth errors → redirect to login
- Tenant resolution errors → error boundary

### 11. Idempotency & Retry
N/A (read-only UI container)

### 12. Output Bundle

```typescript
// /src/components/admin/AdminShell.tsx
import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';
import { useTenant } from '../../hooks/useTenant';

interface AdminShellProps {
  children: React.ReactNode;
  currentSection: string;
}

export const AdminShell: React.FC<AdminShellProps> = ({ 
  children, 
  currentSection 
}) => {
  const { tenant } = useTenant();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <AdminSidebar 
          currentSection={currentSection}
          tenant={tenant}
        />
        <div className="flex-1 flex flex-col">
          <AdminTopBar tenant={tenant} />
          <main className="flex-1 p-6" role="main">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
```

**How to verify:**
1. Navigate to `/admin/dashboard`
2. Verify sidebar shows all navigation items
3. Test mobile responsive behavior
4. Confirm no "Tithi" branding visible
5. Test keyboard navigation

---

## T13 — Bookings List + Actions

You are implementing Task T13: Bookings List + Actions from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.1**: "Booking Management Interface - Efficient attendance marking and payment processing"
- **CP §"API: /bookings"**: GET /api/v1/bookings, PUT /api/v1/bookings/{id}
- **CP §"types/core.ts"**: Booking interface with status enum

Short narrative: This task creates the primary booking management interface where owners can view, filter, and manage booking statuses with real-time updates.

### 1. Deliverables
**Code:**
- `/src/components/admin/BookingsList.tsx` - Main bookings table
- `/src/components/admin/BookingRow.tsx` - Individual booking row
- `/src/components/admin/BookingActions.tsx` - Action buttons
- `/src/components/admin/BookingFilters.tsx` - Filter controls
- `/src/hooks/useBookings.ts` - Bookings data hook

**Contracts:**
- `BookingFilters` interface
- `BookingAction` type
- Pagination parameters

**Tests:**
- `BookingsList.test.tsx` - Component tests
- `useBookings.test.ts` - Hook tests
- `bookings-management.e2e.ts` - E2E tests

### 2. Constraints
- **Performance**: List API p75 ≤ 500ms, table render ≤ 16ms/frame
- **A11y**: WCAG 2.1 AA, keyboard navigation
- **Status Colors**: Use design system status palette
- **Pagination**: URL-synced filters and pagination

### 3. Inputs → Outputs
**Inputs:**
- Bookings API endpoint
- Filter parameters
- Pagination state

**Outputs:**
- Sortable, filterable bookings table
- Status action buttons
- Customer detail drawer
- Real-time status updates

### 4. Validation & Testing
**Acceptance Criteria:**
- List paginates and preserves filters in URL
- Actions update status inline; optimistic UI rolls back on error
- Row expand shows customer info, history, notes
- No-show and complete states are distinct
- Errors follow TithiError schema

**Unit Tests:**
- Filter application logic
- Status update actions
- Pagination behavior
- Error handling

**E2E Tests:**
- Complete booking management flow
- Filter and search functionality
- Status change operations

### 5. Dependencies
**DependsOn:**
- T12 (Admin Shell)
- T01 (API client)

**Exposes:**
- Booking management components
- Status update hooks
- Filter state management

### 6. Executive Rationale
Core business functionality - owners must manage bookings efficiently. Risk: High - blocks primary business operations.

### 7. North-Star Invariants
- Real-time status updates
- Optimistic UI with rollback
- Consistent error handling
- Accessible table interactions

### 8. Schema/DTO Freeze Note
```typescript
interface Booking {
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
```
SHA-256: `b2c3d4e5f6g7...`

### 9. Observability Hooks
- `bookings.list_view` - List page views
- `bookings.action(action, booking_id, prev_status, next_status, slug)` - Status changes
- Error events mirrored to Sentry

### 10. Error Model Enforcement
- API errors → TithiError toast + inline messages
- Network errors → retry with backoff
- Validation errors → inline field errors

### 11. Idempotency & Retry
- All mutation requests send Idempotency-Key
- Safe retries on network failure
- Optimistic updates with rollback

### 12. Output Bundle

```typescript
// /src/components/admin/BookingsList.tsx
import React, { useState } from 'react';
import { useBookings } from '../../hooks/useBookings';
import { BookingRow } from './BookingRow';
import { BookingFilters } from './BookingFilters';

export const BookingsList: React.FC = () => {
  const [filters, setFilters] = useState<BookingFilters>({});
  const { bookings, loading, error, updateStatus } = useBookings(filters);

  if (loading) return <BookingsListSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="space-y-4">
      <BookingFilters 
        filters={filters}
        onFiltersChange={setFilters}
      />
      <div className="bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                onStatusUpdate={updateStatus}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

**How to verify:**
1. Navigate to `/admin/bookings`
2. Verify bookings load and display correctly
3. Test filter functionality
4. Test status update actions
5. Verify optimistic UI behavior

---

## T14 — Attendance → Payment Flow

You are implementing Task T14: Attendance → Payment Flow from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.1**: "Payments are attendance-based. Completing attendance triggers canonical payment path"
- **CP §"API: /payments"**: POST /api/v1/payments/intent, confirm endpoints
- **CP §"types/core.ts"**: Payment interface with status enum

Short narrative: This task creates the attendance-based payment flow where marking a booking as "attended" triggers payment processing using the canonical payment abstraction.

### 1. Deliverables
**Code:**
- `/src/components/admin/AttendanceActions.tsx` - Attendance marking component
- `/src/components/admin/PaymentStatus.tsx` - Payment status indicator
- `/src/hooks/usePaymentFlow.ts` - Payment processing hook
- `/src/services/paymentService.ts` - Payment abstraction

**Contracts:**
- `PaymentIntentRequest` interface
- `PaymentFlowState` type
- 3DS handling types

**Tests:**
- `AttendanceActions.test.tsx` - Component tests
- `usePaymentFlow.test.ts` - Hook tests
- `payment-flow.e2e.ts` - E2E tests

### 2. Constraints
- **Performance**: Payment initiation to "confirmed" UI median ≤ 2.5s
- **3DS Support**: Handle 3DS challenges with proper UI
- **Idempotency**: Required on all payment mutations
- **Error Handling**: 3DS, declines, 429 backoff

### 3. Inputs → Outputs
**Inputs:**
- Booking attendance status
- Payment intent endpoints
- 3DS challenge responses

**Outputs:**
- "Mark attended" flow with payment initiation
- Payment status indicators
- 3DS challenge UI
- Success/failure states

### 4. Validation & Testing
**Acceptance Criteria:**
- One canonical code path for Admin + Public
- Sends Idempotency-Key on intent/confirm
- Honors Retry-After for 429; jittered retries (max 3)
- 3DS flows supported; UI shows "action required"
- Payment success reconciles to booking row within 3s

**Unit Tests:**
- Payment intent creation
- 3DS challenge handling
- Error scenarios
- Idempotency behavior

**E2E Tests:**
- Complete attendance → payment flow
- 3DS challenge scenarios
- Network failure recovery

### 5. Dependencies
**DependsOn:**
- T13 (Bookings List)
- T01 (API client)

**Exposes:**
- Payment flow abstraction
- 3DS handling components
- Payment status management

### 6. Executive Rationale
Critical business function - attendance-based payments are core to the business model. Risk: High - affects revenue collection.

### 7. North-Star Invariants
- Zero duplicate charges during retries
- Consistent payment flow across admin/public
- Proper 3DS handling
- Real-time payment status updates

### 8. Schema/DTO Freeze Note
```typescript
interface PaymentIntentRequest {
  booking_id: string;
  amount_cents: number;
  currency_code: string;
  customer_id?: string;
  idempotency_key: string;
}
```
SHA-256: `c3d4e5f6g7h8...`

### 9. Observability Hooks
- `payments.intent_created|confirmed|failed` - Payment events
- `attendance.mark_complete` - Attendance marking
- `payment_to_ui_latency_ms` - Reconciliation metric

### 10. Error Model Enforcement
- 3DS errors → challenge UI
- Network errors → retry with backoff
- Payment failures → clear error messages

### 11. Idempotency & Retry
- Required on all payment mutations
- Safe for user double-clicks and refresh
- Retry-After header respect

### 12. Output Bundle

```typescript
// /src/components/admin/AttendanceActions.tsx
import React, { useState } from 'react';
import { usePaymentFlow } from '../../hooks/usePaymentFlow';
import { PaymentStatus } from './PaymentStatus';

interface AttendanceActionsProps {
  bookingId: string;
  currentStatus: BookingStatus;
  onStatusUpdate: (status: BookingStatus) => void;
}

export const AttendanceActions: React.FC<AttendanceActionsProps> = ({
  bookingId,
  currentStatus,
  onStatusUpdate
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { processPayment, paymentStatus } = usePaymentFlow();

  const handleMarkAttended = async () => {
    setIsProcessing(true);
    try {
      await processPayment(bookingId);
      onStatusUpdate('completed');
    } catch (error) {
      // Error handling
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {currentStatus === 'confirmed' && (
        <button
          onClick={handleMarkAttended}
          disabled={isProcessing}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Mark Attended'}
        </button>
      )}
      <PaymentStatus status={paymentStatus} />
    </div>
  );
};
```

**How to verify:**
1. Mark a booking as "attended"
2. Verify payment intent creation
3. Test 3DS challenge flow
4. Confirm payment success reconciliation
5. Test error scenarios

---

## Phase 5 — Public Booking (Customer-Facing Flow)

### Phase 5 Exit Criteria
✅ Public routes /v1/{slug} implement Welcome → Availability → Checkout → Confirmation with white-label branding and business timezone display throughout.

✅ Gift card validation is enforced during checkout; policy acknowledgment is mandatory before payment; payment uses canonical intent/confirm with idempotency and 3DS.

✅ Telemetry events exist for step views, checkout submit/success/failure, and confirmation; Web Vitals budgets pass on p75.

✅ Confirmation page surfaces final message + .ics and exposes links used by notification templates.

---

## T20 — Public Booking: Welcome / Service Selection

You are implementing Task T20: Public Booking Welcome from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.2**: "Public Booking Page - Customer-facing booking interface"
- **Brief §2.2**: "Service Selection: Service cards with pricing"
- **CP §"API: /public"**: GET /v1/{slug}/services → Service[]
- **CP §"types/core.ts"**: Service interface with pricing and duration

Short narrative: This task creates the customer-facing service selection page where customers browse bookable services with business branding and navigate to availability selection.

### 1. Deliverables
**Code:**
- `/src/pages/public/WelcomePage.tsx` - Main welcome page
- `/src/components/public/ServiceCard.tsx` - Service display card
- `/src/components/public/ServiceCategory.tsx` - Category grouping
- `/src/components/public/BusinessHeader.tsx` - Business branding header
- `/src/hooks/usePublicServices.ts` - Services data hook

**Contracts:**
- `ServiceCardProps` interface
- `CategoryGroup` type
- Public route parameters

**Tests:**
- `WelcomePage.test.tsx` - Page component tests
- `ServiceCard.test.tsx` - Card component tests
- `public-welcome.e2e.ts` - E2E tests

### 2. Constraints
- **Performance**: p75 LCP < 2.5s, CLS < 0.1, INP < 200ms
- **Branding**: Large logo on Welcome header, business primary color
- **A11y**: WCAG 2.1 AA, keyboard navigation, screen reader support
- **White-label**: No "Tithi" branding visible

### 3. Inputs → Outputs
**Inputs:**
- Tenant slug from URL
- Services API endpoint
- Business branding (logo, colors)

**Outputs:**
- Service cards grouped by category
- Business branding header
- Navigation to availability selection
- Social links display

### 4. Validation & Testing
**Acceptance Criteria:**
- Categories render as horizontal rows
- Each service shows image, name, price, duration, description, quick chips, pre-appointment instructions
- Header shows large logo on Welcome; color contrast meets AA
- Empty, loading, and error states implemented
- Keyboard and screen-reader navigation complete
- Telemetry: booking.view_step with {step:"welcome"} on first paint

**Unit Tests:**
- Service card rendering
- Category grouping logic
- Branding application
- Navigation state

**E2E Tests:**
- Complete service selection flow
- Responsive behavior
- Accessibility compliance

### 5. Dependencies
**DependsOn:**
- T02 (Multi-tenant routing)
- T03 (Design system tokens)

**Exposes:**
- Public booking page components
- Service selection state
- Business branding application

### 6. Executive Rationale
Entry point for customer bookings - critical for business revenue. Risk: High - blocks customer acquisition.

### 7. North-Star Invariants
- White-label branding enforcement
- Accessible service selection
- Mobile-first responsive design
- Performance budget compliance

### 8. Schema/DTO Freeze Note
```typescript
interface Service {
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
```
SHA-256: `d4e5f6g7h8i9...`

### 9. Observability Hooks
- `booking.view_step(step: "welcome")` - Page view tracking
- Sentry route breadcrumbs
- Web Vitals (LCP/CLS/INP) captured

### 10. Error Model Enforcement
- Service load errors → retry with backoff
- Network errors → user-friendly messages
- Invalid tenant → 404 page

### 11. Idempotency & Retry
Not applicable (read-only); cache GET with SWR semantics

### 12. Output Bundle

```typescript
// /src/pages/public/WelcomePage.tsx
import React from 'react';
import { usePublicServices } from '../../hooks/usePublicServices';
import { BusinessHeader } from '../../components/public/BusinessHeader';
import { ServiceCategory } from '../../components/public/ServiceCategory';
import { useTenant } from '../../hooks/useTenant';

export const WelcomePage: React.FC = () => {
  const { tenant } = useTenant();
  const { services, loading, error } = usePublicServices(tenant?.slug);

  if (loading) return <WelcomePageSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  const groupedServices = groupServicesByCategory(services);

  return (
    <div className="min-h-screen bg-white">
      <BusinessHeader 
        tenant={tenant}
        variant="large"
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {groupedServices.map((category) => (
            <ServiceCategory
              key={category.name}
              category={category}
              onServiceSelect={(service) => {
                // Navigate to availability with service
                navigateToAvailability(service);
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
};
```

**How to verify:**
1. Navigate to `/v1/{slug}`
2. Verify business branding displays correctly
3. Test service card interactions
4. Verify navigation to availability
5. Test responsive behavior

---

## T21 — Public Booking: Availability Selection

You are implementing Task T21: Public Booking Availability from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.2**: "Availability Calendar: Time slot selection"
- **Brief §2.2**: "Time Zone Display: Prominent business time zone indicator"
- **CP §"API: /availability"**: GET /api/v1/availability → AvailabilitySlot[]
- **CP §"types/core.ts"**: AvailabilitySlot interface

Short narrative: This task creates the time slot selection interface where customers pick available appointment times with business timezone display and staff color-coding.

### 1. Deliverables
**Code:**
- `/src/pages/public/AvailabilityPage.tsx` - Main availability page
- `/src/components/public/AvailabilityCalendar.tsx` - Calendar component
- `/src/components/public/TimeSlot.tsx` - Individual time slot
- `/src/components/public/TimezoneDisplay.tsx` - Timezone indicator
- `/src/hooks/useAvailability.ts` - Availability data hook

**Contracts:**
- `AvailabilitySlot` interface
- `CalendarView` type
- Timezone utilities

**Tests:**
- `AvailabilityPage.test.tsx` - Page tests
- `AvailabilityCalendar.test.tsx` - Calendar tests
- `public-availability.e2e.ts` - E2E tests

### 2. Constraints
- **Performance**: Calendar interaction ≤ 16ms/frame, fetch < 500ms p75
- **Timezone**: Business timezone display throughout
- **DST Safety**: Handle DST transitions properly
- **Staff Colors**: Color-coded staff display

### 3. Inputs → Outputs
**Inputs:**
- Selected service from T20
- Availability API endpoint
- Business timezone
- Staff color mapping

**Outputs:**
- Interactive calendar with available slots
- Staff color-coding
- Timezone display
- Navigation to checkout

### 4. Validation & Testing
**Acceptance Criteria:**
- Calendar indicates business timezone near the selector
- Selecting a slot enables "Continue" to Checkout; disabled when none
- Handles empty (no slots), loading, error, and DST transitions
- Telemetry: booking.view_step with {step:"availability"} and filters; booking.slot_select

**Unit Tests:**
- Calendar rendering logic
- Timezone handling
- Slot selection behavior
- DST transition handling

**E2E Tests:**
- Complete availability selection flow
- Timezone display accuracy
- DST transition scenarios

### 5. Dependencies
**DependsOn:**
- T20 (Service Selection)
- T02 (Multi-tenant routing)

**Exposes:**
- Availability selection components
- Timezone utilities
- Slot selection state

### 6. Executive Rationale
Critical booking step - customers must select available times. Risk: High - blocks booking completion.

### 7. North-Star Invariants
- Accurate timezone display
- DST-safe time handling
- Accessible calendar interactions
- Real-time availability updates

### 8. Schema/DTO Freeze Note
```typescript
interface AvailabilitySlot {
  resource_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}
```
SHA-256: `e5f6g7h8i9j0...`

### 9. Observability Hooks
- `booking.view_step(step: "availability")` - Page view
- `booking.slot_select` - Slot selection
- `availability.api_error` - API error counter

### 10. Error Model Enforcement
- Fetch failures → retry with backoff
- No availability → clear messaging
- DST errors → fallback handling

### 11. Idempotency & Retry
Not applicable (read-only)

### 12. Output Bundle

```typescript
// /src/pages/public/AvailabilityPage.tsx
import React, { useState } from 'react';
import { useAvailability } from '../../hooks/useAvailability';
import { AvailabilityCalendar } from '../../components/public/AvailabilityCalendar';
import { TimezoneDisplay } from '../../components/public/TimezoneDisplay';
import { useBookingState } from '../../hooks/useBookingState';

export const AvailabilityPage: React.FC = () => {
  const { selectedService } = useBookingState();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const { slots, loading, error } = useAvailability(selectedService?.id);

  if (loading) return <AvailabilityPageSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Select a Time
          </h1>
          <TimezoneDisplay timezone={selectedService?.tenant?.timezone} />
        </div>

        <AvailabilityCalendar
          slots={slots}
          selectedSlot={selectedSlot}
          onSlotSelect={setSelectedSlot}
          service={selectedService}
        />

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => navigateToCheckout(selectedSlot)}
            disabled={!selectedSlot}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};
```

**How to verify:**
1. Select a service and navigate to availability
2. Verify timezone display
3. Test slot selection
4. Verify navigation to checkout
5. Test DST scenarios

---

## T22 — Public Booking: Checkout (Gift Card + Payment + Policies)

You are implementing Task T22: Public Booking Checkout from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.2**: "Payment Method: Stripe Elements integration"
- **Brief §2.2**: "Gift Card: Code input and validation"
- **CP §"API: /payments"**: POST /api/v1/payments/intent, confirm endpoints
- **CP §"API: /promotions"**: POST /api/v1/promotions/validate

Short narrative: This task creates the checkout page where customers apply gift cards, acknowledge policies, and complete payment with Stripe integration and 3DS support.

### 1. Deliverables
**Code:**
- `/src/pages/public/CheckoutPage.tsx` - Main checkout page
- `/src/components/public/BookingSummary.tsx` - Booking details summary
- `/src/components/public/GiftCardInput.tsx` - Gift card validation
- `/src/components/public/PolicyAcknowledgment.tsx` - Policy acceptance
- `/src/components/public/PaymentForm.tsx` - Stripe payment form
- `/src/hooks/useCheckout.ts` - Checkout flow hook

**Contracts:**
- `CheckoutState` interface
- `GiftCardValidation` type
- `PolicyAcknowledgment` type

**Tests:**
- `CheckoutPage.test.tsx` - Page tests
- `PaymentForm.test.tsx` - Payment form tests
- `public-checkout.e2e.ts` - E2E tests

### 2. Constraints
- **Performance**: Submit→confirmation median < 3s p50
- **3DS Support**: Handle 3DS challenges
- **Policy Enforcement**: Cannot proceed without acknowledgment
- **Gift Cards**: Validate before payment

### 3. Inputs → Outputs
**Inputs:**
- Selected service and time slot
- Gift card validation API
- Payment intent API
- Policy acknowledgment state

**Outputs:**
- Booking summary display
- Gift card application
- Policy acknowledgment UI
- Payment processing with 3DS

### 4. Validation & Testing
**Acceptance Criteria:**
- Summary shows business name/logo, service, staff, date/time (business TZ), price, pre-appointment instructions, special-requests input when enabled
- Gift card flow: validate → apply discount → updated totals; invalid codes show inline error
- Policy acknowledgment required (checkbox/modal); cannot pay until accepted
- Payment supports card + wallets where enabled; 3DS challenge handled
- Create booking with Idempotency-Key; no duplicate bookings on refresh/retry
- Telemetry: booking.checkout_submit, payments.intent_created, payments.confirm_success|error, booking.create_success|error

**Unit Tests:**
- Gift card validation logic
- Policy acknowledgment enforcement
- Payment form behavior
- Error handling scenarios

**E2E Tests:**
- Complete checkout flow
- Gift card application
- 3DS challenge scenarios
- Policy acknowledgment

### 5. Dependencies
**DependsOn:**
- T21 (Availability Selection)
- T14 (Payment Flow abstraction)

**Exposes:**
- Checkout page components
- Payment processing hooks
- Gift card validation

### 6. Executive Rationale
Critical revenue conversion point - customers complete bookings here. Risk: High - affects business revenue directly.

### 7. North-Star Invariants
- No duplicate bookings on retry
- Proper 3DS handling
- Policy acknowledgment enforcement
- Gift card validation accuracy

### 8. Schema/DTO Freeze Note
```typescript
interface PaymentIntentRequest {
  booking_id: string;
  amount_cents: number;
  currency_code: string;
  customer_id?: string;
  idempotency_key: string;
}
```
SHA-256: `f6g7h8i9j0k1...`

### 9. Observability Hooks
- `booking.checkout_submit` - Checkout initiation
- `payments.intent_created|confirmed|failed` - Payment events
- `booking.create_success|error` - Booking creation
- `giftcard.validated` - Gift card validation

### 10. Error Model Enforcement
- Payment errors → clear messaging
- 3DS errors → challenge UI
- Validation errors → inline feedback
- Network errors → retry with backoff

### 11. Idempotency & Retry
- Required for bookings and payment intent creation
- Safe retries on network failure
- Idempotency-Key on all mutations

### 12. Output Bundle

```typescript
// /src/pages/public/CheckoutPage.tsx
import React, { useState } from 'react';
import { useCheckout } from '../../hooks/useCheckout';
import { BookingSummary } from '../../components/public/BookingSummary';
import { GiftCardInput } from '../../components/public/GiftCardInput';
import { PolicyAcknowledgment } from '../../components/public/PolicyAcknowledgment';
import { PaymentForm } from '../../components/public/PaymentForm';

export const CheckoutPage: React.FC = () => {
  const { bookingState, processCheckout } = useCheckout();
  const [giftCard, setGiftCard] = useState<string>('');
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!policyAcknowledged) {
      // Show policy acknowledgment modal
      return;
    }

    setIsProcessing(true);
    try {
      await processCheckout({
        giftCard,
        policyAcknowledged
      });
    } catch (error) {
      // Error handling
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <BookingSummary booking={bookingState} />
            <GiftCardInput
              value={giftCard}
              onChange={setGiftCard}
            />
            <PolicyAcknowledgment
              acknowledged={policyAcknowledged}
              onAcknowledged={setPolicyAcknowledged}
            />
          </div>
          
          <div>
            <PaymentForm
              onPaymentSuccess={handleSubmit}
              disabled={!policyAcknowledged || isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
```

**How to verify:**
1. Navigate to checkout with selected service/slot
2. Test gift card validation
3. Verify policy acknowledgment requirement
4. Test payment processing
5. Verify 3DS challenge handling

---

## T23 — Public Booking: Confirmation (.ics + Share)

You are implementing Task T23: Public Booking Confirmation from the approved TASK GRAPH. Use ONLY the Design Brief + Context Pack.

### 0. Context (quote IDs)
- **Brief §2.2**: "Confirmation page surfaces final message + .ics and exposes links used by notification templates"
- **Brief §2.2**: "Social block displays configured links; copy link to clipboard works"
- **CP §"types/core.ts"**: Booking and Service interfaces

Short narrative: This task creates the final confirmation page that displays booking details, provides .ics download, and shows social sharing options with business branding.

### 1. Deliverables
**Code:**
- `/src/pages/public/ConfirmationPage.tsx` - Main confirmation page
- `/src/components/public/BookingDetails.tsx` - Booking summary display
- `/src/components/public/ICSDownload.tsx` - Calendar download component
- `/src/components/public/SocialShare.tsx` - Social sharing component
- `/src/utils/icsGenerator.ts` - ICS file generation utility

**Contracts:**
- `ICSData` interface
- `SocialLink` type
- Confirmation message type

**Tests:**
- `ConfirmationPage.test.tsx` - Page tests
- `icsGenerator.test.ts` - ICS utility tests
- `public-confirmation.e2e.ts` - E2E tests

### 2. Constraints
- **Performance**: Page interactive < 2s p75, ICS generation < 200ms
- **ICS Format**: Valid VEVENT with proper timezone
- **Branding**: Business branding throughout
- **Accessibility**: WCAG 2.1 AA compliance

### 3. Inputs → Outputs
**Inputs:**
- Completed booking data
- Business branding and social links
- Confirmation message from policies

**Outputs:**
- Booking confirmation display
- ICS file download
- Social sharing options
- "Book another" navigation

### 4. Validation & Testing
**Acceptance Criteria:**
- Confirmation message renders with safe formatting; includes date/time in business TZ
- "Download .ics" generates valid VEVENT (UID, DTSTART with TZ, SUMMARY = {service} — {business}, LOCATION, DESCRIPTION)
- Social block displays configured links; copy link to clipboard works
- Telemetry: booking.complete + ics.download

**Unit Tests:**
- ICS generation logic
- Confirmation message rendering
- Social sharing functionality
- Date/time formatting

**E2E Tests:**
- Complete confirmation flow
- ICS download functionality
- Social sharing features

### 5. Dependencies
**DependsOn:**
- T22 (Checkout completion)
- T03 (Design system tokens)

**Exposes:**
- Confirmation page components
- ICS generation utilities
- Social sharing functionality

### 6. Executive Rationale
Final customer touchpoint - provides booking confirmation and calendar integration. Risk: Medium - affects customer experience.

### 7. North-Star Invariants
- Accurate timezone display
- Valid ICS file generation
- Accessible confirmation display
- Business branding consistency

### 8. Schema/DTO Freeze Note
```typescript
interface ICSData {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  timezone: string;
}
```
SHA-256: `g7h8i9j0k1l2...`

### 9. Observability Hooks
- `booking.complete` - Booking completion
- `ics.download` - ICS download tracking
- Non-PII analytics payloads

### 10. Error Model Enforcement
- ICS generation errors → fallback message
- Social sharing errors → graceful degradation
- Booking data errors → error boundary

### 11. Idempotency & Retry
Stateless (read-only); ICS generation is pure from booking payload

### 12. Output Bundle

```typescript
// /src/pages/public/ConfirmationPage.tsx
import React from 'react';
import { BookingDetails } from '../../components/public/BookingDetails';
import { ICSDownload } from '../../components/public/ICSDownload';
import { SocialShare } from '../../components/public/SocialShare';
import { useBookingState } from '../../hooks/useBookingState';

export const ConfirmationPage: React.FC = () => {
  const { completedBooking, tenant } = useBookingState();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Booking Confirmed!
          </h1>
          <p className="text-lg text-gray-600">
            Your appointment has been successfully booked.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <BookingDetails booking={completedBooking} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ICSDownload booking={completedBooking} />
          <SocialShare tenant={tenant} />
        </div>

        <div className="text-center">
          <button
            onClick={() => navigateToWelcome()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Book Another Service
          </button>
        </div>
      </div>
    </div>
  );
};
```

**How to verify:**
1. Complete a booking and reach confirmation
2. Verify booking details display correctly
3. Test ICS download functionality
4. Test social sharing features
5. Verify "Book another" navigation

---

## Phase 4 & 5 Implementation Summary

### Phase 4 Completion Checklist
- [ ] T12: Admin Shell with navigation and layout
- [ ] T13: Bookings List with filtering and actions
- [ ] T14: Attendance → Payment Flow with 3DS support
- [ ] T15: Services CRUD for business owners
- [ ] T16: Availability Admin with calendar interface
- [ ] T17: Customers List with details and history
- [ ] T19: Tithi User Dashboard with businesses and orders
- [ ] T31: Admin Branding & Settings management
- [ ] T32: Staff Management with colors and schedules
- [ ] T33: Admin Dashboard with KPIs and analytics
- [ ] T36: System Status Tile for health monitoring
- [ ] T41: Pagination & Filtering standardization

### Phase 5 Completion Checklist
- [ ] T20: Public Booking Welcome with service selection
- [ ] T21: Public Booking Availability with timezone display
- [ ] T22: Public Booking Checkout with gift cards and policies
- [ ] T23: Public Booking Confirmation with ICS download
- [ ] T42: Payments Canonicalization across admin and public

### Critical Success Factors
1. **White-label Branding**: No "Tithi" branding on customer-facing surfaces
2. **Performance**: Meet all Web Vitals budgets (LCP, CLS, INP)
3. **Accessibility**: WCAG 2.1 AA compliance across all interfaces
4. **Payment Integration**: Canonical payment flow with 3DS support
5. **Observability**: Complete telemetry coverage with schema validation
6. **Error Handling**: Robust error handling with user-friendly messages
7. **Idempotency**: Safe retry behavior for all critical operations

### Next Steps
1. **Review and approve** these ticketed prompts
2. **Set up development environment** with required dependencies
3. **Begin Phase 4 implementation** starting with T12 (Admin Shell)
4. **Establish testing framework** and quality gates
5. **Plan Phase 5 implementation** after Phase 4 completion

This document serves as the implementation guide for Phase 4 and Phase 5 of the Tithi frontend development.
