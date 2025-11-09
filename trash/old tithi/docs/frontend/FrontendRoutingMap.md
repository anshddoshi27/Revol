# Tithi Frontend Routing Map

**Purpose**: Maps frontend pages, components, and hooks to backend endpoints and database tables.

**Confidence Score**: 90% - Based on comprehensive backend analysis and common frontend patterns.

## Frontend Architecture Overview

### Technology Stack
- **Framework**: React with TypeScript
- **Routing**: React Router v6
- **State Management**: React Query + Zustand
- **UI Components**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios with interceptors

### Authentication Flow
```typescript
// Frontend Hook → Backend Endpoint → Database Table
useAuth() → POST /api/v1/auth/login → users, memberships
useTenant() → GET /api/v1/tenants → tenants
usePermissions() → JWT token → memberships.permissions_json
```

## Page-Level Routing

### 1. Authentication Pages

#### Login Page (`/login`)
```typescript
// Component: LoginForm
// Hook: useAuth()
// Backend: POST /api/v1/auth/login
// Database: users, memberships
// Payload:
{
  "email": "user@example.com",
  "password": "password123"
}
// Response: JWT token + user data
```

#### Register Page (`/register`)
```typescript
// Component: RegisterForm
// Hook: useAuth()
// Backend: POST /api/v1/auth/register
// Database: users, memberships
// Payload:
{
  "email": "user@example.com",
  "password": "password123",
  "display_name": "John Doe"
}
// Response: JWT token + user data
```

### 2. Onboarding Flow

#### Business Registration (`/onboarding/register`)
```typescript
// Component: BusinessRegistrationForm
// Hook: useOnboarding()
// Backend: POST /onboarding/register
// Database: tenants, themes, policies
// Payload:
{
  "business_name": "My Salon",
  "business_type": "salon",
  "owner_name": "John Doe",
  "email": "owner@mysalon.com",
  "phone": "+1234567890",
  "timezone": "America/New_York"
}
// Response: tenant data + subdomain
```

#### Subdomain Check (`/onboarding/check-subdomain`)
```typescript
// Component: SubdomainInput
// Hook: useSubdomainCheck()
// Backend: GET /onboarding/check-subdomain/{subdomain}
// Database: tenants.slug
// Response: { "available": true/false }
```

### 3. Dashboard Pages

#### Main Dashboard (`/dashboard`)
```typescript
// Component: DashboardLayout
// Hook: useDashboard()
// Backend: GET /api/v1/admin/analytics/dashboard
// Database: bookings, payments, customers, services
// Response: Comprehensive dashboard metrics
```

#### Services Management (`/dashboard/services`)
```typescript
// Component: ServicesList, ServiceForm
// Hook: useServices()
// Backend: GET /api/v1/services, POST /api/v1/services
// Database: services
// Payload (Create):
{
  "name": "Haircut",
  "description": "Professional haircut",
  "duration_min": 60,
  "price_cents": 5000,
  "category": "hair"
}
```

#### Bookings Management (`/dashboard/bookings`)
```typescript
// Component: BookingsList, BookingForm
// Hook: useBookings()
// Backend: GET /api/v1/bookings, POST /api/v1/bookings
// Database: bookings, customers, services, resources
// Payload (Create):
{
  "customer_id": "uuid",
  "resource_id": "uuid",
  "service_id": "uuid",
  "start_at": "2024-01-15T10:00:00Z",
  "end_at": "2024-01-15T11:00:00Z",
  "attendee_count": 1
}
```

#### Staff Management (`/dashboard/staff`)
```typescript
// Component: StaffList, StaffForm
// Hook: useStaff()
// Backend: GET /api/v1/staff, POST /api/v1/staff
// Database: staff_profiles, memberships, resources
// Payload (Create):
{
  "user_id": "uuid",
  "resource_id": "uuid",
  "role": "staff",
  "permissions": ["read:bookings", "write:bookings"]
}
```

#### Calendar View (`/dashboard/calendar`)
```typescript
// Component: CalendarView
// Hook: useCalendar()
// Backend: GET /api/v1/calendar/events
// Database: bookings, staff_availability, work_schedules
// Response: Calendar events with availability
```

### 4. Customer-Facing Pages

#### Public Booking Page (`/book/{slug}`)
```typescript
// Component: PublicBookingForm
// Hook: usePublicBooking()
// Backend: GET /v1/{slug}/services, POST /api/v1/bookings
// Database: tenants, services, resources, bookings
// Payload:
{
  "customer_name": "Jane Doe",
  "customer_email": "jane@example.com",
  "customer_phone": "+1234567890",
  "service_id": "uuid",
  "resource_id": "uuid",
  "start_at": "2024-01-15T10:00:00Z",
  "end_at": "2024-01-15T11:00:00Z"
}
```

#### Service Selection (`/book/{slug}/services`)
```typescript
// Component: ServiceSelection
// Hook: usePublicServices()
// Backend: GET /v1/{slug}/services
// Database: services
// Response: Available services for booking
```

#### Time Slot Selection (`/book/{slug}/time-slots`)
```typescript
// Component: TimeSlotPicker
// Hook: useAvailability()
// Backend: GET /api/v1/availability/{resource_id}/slots
// Database: staff_availability, work_schedules, bookings
// Response: Available time slots
```

### 5. Payment Pages

#### Payment Form (`/payment/{booking_id}`)
```typescript
// Component: PaymentForm
// Hook: usePayment()
// Backend: POST /api/payments/intent
// Database: payments, bookings
// Payload:
{
  "booking_id": "uuid",
  "amount_cents": 5000,
  "currency": "USD",
  "customer_id": "uuid",
  "idempotency_key": "unique_key"
}
// Response: Payment intent with client secret
```

#### Payment Confirmation (`/payment/{payment_id}/confirm`)
```typescript
// Component: PaymentConfirmation
// Hook: usePaymentConfirmation()
// Backend: POST /api/payments/intent/{id}/confirm
// Database: payments
// Payload:
{
  "payment_method_id": "pm_stripe_id"
}
// Response: Payment status
```

#### Stored Payment Methods (`/payment/methods`)
```typescript
// Component: PaymentMethodsList
// Hook: usePaymentMethods()
// Backend: GET /api/payments/methods/{customer_id}
// Database: payment_methods
// Response: Customer's stored payment methods
```

### 6. Notification Pages

#### Notification Templates (`/dashboard/notifications/templates`)
```typescript
// Component: NotificationTemplatesList
// Hook: useNotificationTemplates()
// Backend: GET /api/v1/notifications/templates
// Database: notification_templates
// Response: List of notification templates
```

#### Notification Preferences (`/dashboard/notifications/preferences`)
```typescript
// Component: NotificationPreferencesForm
// Hook: useNotificationPreferences()
// Backend: GET /api/v1/notifications/preferences
// Database: notification_preferences
// Payload (Update):
{
  "email_enabled": true,
  "sms_enabled": true,
  "booking_notifications": true,
  "payment_notifications": true,
  "digest_frequency": "immediate"
}
```

## Component-Level Mapping

### 1. Form Components

#### ServiceForm Component
```typescript
// Frontend Component: ServiceForm
// Backend Endpoint: POST /api/v1/services
// Database Table: services
// Validation: Zod schema
// Fields:
- name (required)
- description (optional)
- duration_min (required, min: 15, max: 480)
- price_cents (required, min: 0)
- category (optional)
- active (boolean, default: true)
```

#### BookingForm Component
```typescript
// Frontend Component: BookingForm
// Backend Endpoint: POST /api/v1/bookings
// Database Table: bookings
// Validation: Zod schema
// Fields:
- customer_id (required)
- resource_id (required)
- service_id (required)
- start_at (required, future date)
- end_at (required, after start_at)
- attendee_count (required, min: 1)
```

#### PaymentForm Component
```typescript
// Frontend Component: PaymentForm
// Backend Endpoint: POST /api/payments/intent
// Database Table: payments
// Validation: Zod schema
// Fields:
- booking_id (required)
- amount_cents (required, min: 0)
- currency (required, default: USD)
- customer_id (required)
- idempotency_key (required, unique)
```

### 2. List Components

#### ServicesList Component
```typescript
// Frontend Component: ServicesList
// Backend Endpoint: GET /api/v1/services
// Database Table: services
// Query Parameters:
- page (optional, default: 1)
- limit (optional, default: 20)
- category (optional)
- active (optional, default: true)
// Response: Paginated list of services
```

#### BookingsList Component
```typescript
// Frontend Component: BookingsList
// Backend Endpoint: GET /api/v1/bookings
// Database Table: bookings
// Query Parameters:
- page (optional, default: 1)
- limit (optional, default: 20)
- status (optional)
- start_date (optional)
- end_date (optional)
- resource_id (optional)
// Response: Paginated list of bookings
```

### 3. Calendar Components

#### CalendarView Component
```typescript
// Frontend Component: CalendarView
// Backend Endpoint: GET /api/v1/calendar/events
// Database Table: bookings, staff_availability
// Query Parameters:
- start_date (required)
- end_date (required)
- resource_id (optional)
// Response: Calendar events with availability
```

#### TimeSlotPicker Component
```typescript
// Frontend Component: TimeSlotPicker
// Backend Endpoint: GET /api/v1/availability/{resource_id}/slots
// Database Table: staff_availability, work_schedules, bookings
// Query Parameters:
- date (required)
- duration_min (required)
- resource_id (required)
// Response: Available time slots
```

## Hook-Level Mapping

### 1. Data Fetching Hooks

#### useServices Hook
```typescript
// Hook: useServices()
// Backend: GET /api/v1/services
// Database: services
// Cache Key: ['services', tenantId]
// Stale Time: 5 minutes
// Refetch: On window focus
```

#### useBookings Hook
```typescript
// Hook: useBookings()
// Backend: GET /api/v1/bookings
// Database: bookings
// Cache Key: ['bookings', tenantId, filters]
// Stale Time: 1 minute
// Refetch: On window focus, every 30 seconds
```

#### useStaff Hook
```typescript
// Hook: useStaff()
// Backend: GET /api/v1/staff
// Database: staff_profiles, memberships
// Cache Key: ['staff', tenantId]
// Stale Time: 10 minutes
// Refetch: On window focus
```

### 2. Mutation Hooks

#### useCreateBooking Hook
```typescript
// Hook: useCreateBooking()
// Backend: POST /api/v1/bookings
// Database: bookings
// Optimistic Update: Add to bookings list
// Error Handling: Rollback optimistic update
// Success: Invalidate bookings cache
```

#### useCreatePayment Hook
```typescript
// Hook: useCreatePayment()
// Backend: POST /api/payments/intent
// Database: payments
// Optimistic Update: Add to payments list
// Error Handling: Show error message
// Success: Redirect to payment confirmation
```

#### useUpdateService Hook
```typescript
// Hook: useUpdateService()
// Backend: PUT /api/v1/services/{id}
// Database: services
// Optimistic Update: Update service in list
// Error Handling: Rollback optimistic update
// Success: Invalidate services cache
```

### 3. Real-time Hooks

#### useBookingUpdates Hook
```typescript
// Hook: useBookingUpdates()
// Backend: WebSocket connection
// Database: bookings
// Events: booking_created, booking_updated, booking_cancelled
// Action: Update bookings cache
```

#### useAvailabilityUpdates Hook
```typescript
// Hook: useAvailabilityUpdates()
// Backend: WebSocket connection
// Database: staff_availability, bookings
// Events: availability_changed, booking_confirmed
// Action: Update availability cache
```

## Error Handling Patterns

### 1. API Error Handling
```typescript
// Frontend: Error Boundary
// Backend: Problem+JSON format
// Database: Constraint violations
// Error Codes:
- TITHI_VALIDATION_ERROR (400)
- TITHI_AUTH_ERROR (401)
- TITHI_TENANT_NOT_FOUND (404)
- TITHI_BOOKING_NOT_FOUND (404)
- TITHI_PAYMENT_STRIPE_ERROR (402)
- TITHI_NOTIFICATION_ERROR (500)
```

### 2. Form Validation
```typescript
// Frontend: Zod schemas
// Backend: Marshmallow schemas
// Database: Constraints
// Validation Rules:
- Required fields
- Data types
- Business rules
- Unique constraints
```

### 3. Network Error Handling
```typescript
// Frontend: Retry logic
// Backend: Idempotency keys
// Database: Transaction rollback
// Error Types:
- Network timeout
- Server error
- Rate limiting
- Authentication expired
```

## State Management Patterns

### 1. Global State
```typescript
// Store: useAuthStore
// Data: user, tenant, permissions
// Backend: JWT token
// Database: users, memberships
// Persistence: localStorage
```

### 2. Server State
```typescript
// Store: React Query
// Data: services, bookings, staff
// Backend: REST API
// Database: All tables
// Persistence: Memory cache
```

### 3. Form State
```typescript
// Store: React Hook Form
// Data: Form inputs
// Backend: Validation schemas
// Database: Constraints
// Persistence: Component state
```

## Performance Optimizations

### 1. Caching Strategy
```typescript
// Static Data: services, staff (5-10 minutes)
// Dynamic Data: bookings, availability (1-2 minutes)
// Real-time Data: WebSocket updates
// Cache Keys: tenantId + resource type
```

### 2. Pagination
```typescript
// Frontend: Virtual scrolling
// Backend: Cursor-based pagination
// Database: LIMIT/OFFSET
// Page Size: 20-50 items
```

### 3. Lazy Loading
```typescript
// Routes: React.lazy()
// Components: Dynamic imports
// Images: Lazy loading
// Data: Infinite queries
```

## Security Considerations

### 1. Authentication
```typescript
// Frontend: JWT token storage
// Backend: JWT validation
// Database: RLS policies
// Security: HTTPS only, secure storage
```

### 2. Authorization
```typescript
// Frontend: Role-based rendering
// Backend: Permission checks
// Database: RLS enforcement
// Security: Principle of least privilege
```

### 3. Data Validation
```typescript
// Frontend: Zod schemas
// Backend: Marshmallow schemas
// Database: Constraints
// Security: Input sanitization
```

## Testing Strategy

### 1. Unit Tests
```typescript
// Components: React Testing Library
// Hooks: React Hooks Testing Library
// Utils: Jest
// Coverage: 80%+
```

### 2. Integration Tests
```typescript
// API: MSW (Mock Service Worker)
// Database: Test database
// E2E: Playwright
// Coverage: Critical paths
```

### 3. E2E Tests
```typescript
// Flows: Booking, Payment, Admin
// Scenarios: Happy path, error cases
// Tools: Playwright
// Coverage: User journeys
```

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
**Confidence Score**: 90%
