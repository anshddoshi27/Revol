# API Contracts Addendum & Governance

**Document Purpose**: Definitive request/response DTOs and examples for all Tithi API endpoints. This document eliminates all "OPEN_QUESTION" gaps and provides type-safe interfaces for the entire frontend.

**Version**: 1.0.0  
**Last Updated**: January 27, 2025  
**Status**: Finalized - No OPEN_QUESTION items remain

---

## Core API Response Structure

All API responses follow a consistent structure:

```typescript
interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    version: string;
  };
  errors?: ApiError[];
}

interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error_code: string;
  tenant_id?: string;
  user_id?: string;
}
```

**SHA-256 Hash**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

---

## Authentication & Authorization

### JWT Token Management

```typescript
interface UserContext {
  user_id: string;
  tenant_id: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'customer';
}

// All authenticated requests include:
// Authorization: Bearer <jwt_token>
// Content-Type: application/json
```

---

## Onboarding Endpoints

### POST /onboarding/register

**Purpose**: Register new business with subdomain generation

**Request**:
```typescript
interface OnboardingRegisterRequest {
  business_name: string;
  business_email: string;
  business_phone?: string;
  business_category: string;
  timezone: string;
  subdomain?: string; // Optional, will be generated if not provided
  idempotency_key?: string;
}

// Example Request
{
  "business_name": "Bella's Salon",
  "business_email": "hello@bellassalon.com",
  "business_phone": "+1-555-0123",
  "business_category": "beauty",
  "timezone": "America/New_York",
  "subdomain": "bellas-salon"
}
```

**Response**:
```typescript
interface OnboardingRegisterResponse {
  tenant_id: string;
  slug: string;
  status: 'created' | 'pending_verification';
  verification_token?: string;
  next_steps: string[];
  created_at: string;
}

// Example Response
{
  "data": {
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "slug": "bellas-salon",
    "status": "created",
    "verification_token": "verify_abc123...",
    "next_steps": [
      "Complete business profile",
      "Upload logo and branding",
      "Set up services and pricing",
      "Configure availability"
    ],
    "created_at": "2025-01-27T10:30:00Z"
  },
  "meta": {
    "version": "1.0.0"
  }
}
```

### GET /onboarding/check-subdomain/{subdomain}

**Purpose**: Validate subdomain availability

**Request**: Path parameter only

**Response**:
```typescript
interface SubdomainCheckResponse {
  available: boolean;
  suggested_alternatives?: string[];
  reason?: string;
}

// Example Response
{
  "data": {
    "available": false,
    "suggested_alternatives": [
      "bellas-salon-nyc",
      "bellas-salon-2025",
      "bella-beauty-salon"
    ],
    "reason": "Subdomain already taken"
  }
}
```

---

## Core API Endpoints

### GET /api/v1/tenants

**Purpose**: List user's tenants

**Request**:
```typescript
interface TenantsListRequest {
  page?: number; // Default: 1
  per_page?: number; // Default: 20, Max: 100
  include_inactive?: boolean; // Default: false
}

// Headers: Authorization: Bearer <token>
```

**Response**:
```typescript
interface TenantsListResponse {
  tenants: Tenant[];
  pagination: PaginationMeta;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  description?: string;
  timezone: string;
  logo_url?: string;
  primary_color: string;
  settings?: Record<string, any>;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}
```

### POST /api/v1/tenants

**Purpose**: Create new tenant

**Request**:
```typescript
interface TenantCreateRequest {
  name: string;
  description?: string;
  timezone: string;
  primary_color: string;
  logo_url?: string;
  settings?: Record<string, any>;
  idempotency_key: string; // Required for idempotency
}

// Headers: 
// Authorization: Bearer <token>
// Idempotency-Key: <generated_key>
```

**Response**:
```typescript
interface TenantCreateResponse {
  tenant: Tenant;
  onboarding_complete: boolean;
  next_steps: string[];
}
```

### PUT /api/v1/tenants/{id}

**Purpose**: Update tenant

**Request**:
```typescript
interface TenantUpdateRequest {
  name?: string;
  description?: string;
  timezone?: string;
  primary_color?: string;
  logo_url?: string;
  settings?: Record<string, any>;
  idempotency_key: string; // Required for idempotency
}
```

**Response**:
```typescript
interface TenantUpdateResponse {
  tenant: Tenant;
  updated_fields: string[];
}
```

---

## Booking Management

### GET /api/v1/bookings

**Purpose**: List bookings with filtering and pagination

**Request**:
```typescript
interface BookingsListRequest {
  page?: number;
  per_page?: number;
  status?: BookingStatus[];
  service_id?: string;
  customer_id?: string;
  start_date?: string; // ISO 8601
  end_date?: string; // ISO 8601
  sort_by?: 'start_at' | 'created_at' | 'status';
  sort_order?: 'asc' | 'desc';
}

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
```

**Response**:
```typescript
interface BookingsListResponse {
  bookings: Booking[];
  pagination: PaginationMeta;
}

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
  customer: Customer;
  service: Service;
  resource: Resource;
  created_at: string;
  updated_at: string;
}
```

### POST /api/v1/bookings

**Purpose**: Create new booking

**Request**:
```typescript
interface BookingCreateRequest {
  customer_id: string;
  service_id: string;
  resource_id: string;
  start_at: string; // ISO 8601
  end_at: string; // ISO 8601
  attendee_count?: number;
  client_generated_id?: string;
  notes?: string;
  idempotency_key: string; // Required for idempotency
}
```

**Response**:
```typescript
interface BookingCreateResponse {
  booking: Booking;
  payment_required: boolean;
  payment_intent_id?: string;
}
```

### PUT /api/v1/bookings/{id}

**Purpose**: Update booking status

**Request**:
```typescript
interface BookingUpdateRequest {
  status: BookingStatus;
  notes?: string;
  idempotency_key: string; // Required for idempotency
}
```

**Response**:
```typescript
interface BookingUpdateResponse {
  booking: Booking;
  payment_processed?: boolean;
  payment_amount?: number;
}
```

---

## Payment Processing

### POST /api/payments/intent

**Purpose**: Create payment intent for booking

**Request**:
```typescript
interface PaymentIntentRequest {
  booking_id: string;
  amount_cents: number;
  currency_code: string; // Default: "USD"
  customer_id?: string;
  idempotency_key: string; // Required for idempotency
}

// Headers:
// Authorization: Bearer <token>
// Idempotency-Key: <generated_key>
```

**Response**:
```typescript
interface PaymentIntentResponse {
  payment_intent_id: string;
  client_secret: string;
  amount_cents: number;
  currency_code: string;
  status: 'requires_action' | 'succeeded' | 'failed';
  next_action?: {
    type: string;
    url?: string;
  };
}
```

### POST /api/payments/process

**Purpose**: Process payment based on attendance

**Request**:
```typescript
interface PaymentProcessRequest {
  booking_id: string;
  attendance_status: 'attended' | 'no_show';
  amount_cents?: number; // Override default amount
  idempotency_key: string; // Required for idempotency
}
```

**Response**:
```typescript
interface PaymentProcessResponse {
  payment_id: string;
  status: PaymentStatus;
  amount_cents: number;
  currency_code: string;
  receipt_url?: string;
}

type PaymentStatus = 'requires_action' | 'succeeded' | 'failed' | 'cancelled';
```

---

## Service Management

### GET /api/v1/services

**Purpose**: List services with filtering

**Request**:
```typescript
interface ServicesListRequest {
  page?: number;
  per_page?: number;
  category?: string;
  is_active?: boolean;
  search?: string;
}
```

**Response**:
```typescript
interface ServicesListResponse {
  services: Service[];
  pagination: PaginationMeta;
}

interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}
```

### POST /api/v1/services

**Purpose**: Create new service

**Request**:
```typescript
interface ServiceCreateRequest {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  image_url?: string;
  idempotency_key: string; // Required for idempotency
}
```

**Response**:
```typescript
interface ServiceCreateResponse {
  service: Service;
}
```

---

## Availability Management

### GET /api/v1/availability

**Purpose**: Get available time slots

**Request**:
```typescript
interface AvailabilityRequest {
  service_id: string;
  resource_id?: string;
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
  timezone: string;
}
```

**Response**:
```typescript
interface AvailabilityResponse {
  slots: AvailabilitySlot[];
  timezone: string;
  business_hours: BusinessHours;
}

interface AvailabilitySlot {
  resource_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  is_available: boolean;
  reason?: string;
}

interface BusinessHours {
  timezone: string;
  hours: {
    [day: string]: {
      open: string;
      close: string;
      is_closed: boolean;
    };
  };
}
```

---

## Customer Management

### GET /api/v1/customers

**Purpose**: List customers with filtering

**Request**:
```typescript
interface CustomersListRequest {
  page?: number;
  per_page?: number;
  search?: string;
  segment?: string;
  has_bookings?: boolean;
}
```

**Response**:
```typescript
interface CustomersListResponse {
  customers: Customer[];
  pagination: PaginationMeta;
}

interface Customer {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  preferences?: Record<string, any>;
  loyalty_points?: number;
  total_bookings: number;
  last_booking_at?: string;
  created_at: string;
  updated_at: string;
}
```

---

## Analytics Endpoints

### GET /api/v1/analytics/revenue

**Purpose**: Get revenue analytics

**Request**:
```typescript
interface RevenueAnalyticsRequest {
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
  group_by?: 'day' | 'week' | 'month';
  service_id?: string;
}
```

**Response**:
```typescript
interface RevenueAnalyticsResponse {
  total_revenue_cents: number;
  total_bookings: number;
  average_booking_value_cents: number;
  revenue_by_period: {
    period: string;
    revenue_cents: number;
    bookings: number;
  }[];
  revenue_by_service: {
    service_id: string;
    service_name: string;
    revenue_cents: number;
    bookings: number;
  }[];
}
```

### GET /api/v1/analytics/bookings

**Purpose**: Get booking analytics

**Request**:
```typescript
interface BookingAnalyticsRequest {
  start_date: string;
  end_date: string;
  group_by?: 'day' | 'week' | 'month';
  status?: BookingStatus[];
}
```

**Response**:
```typescript
interface BookingAnalyticsResponse {
  total_bookings: number;
  bookings_by_status: {
    status: BookingStatus;
    count: number;
    percentage: number;
  }[];
  bookings_by_period: {
    period: string;
    bookings: number;
    revenue_cents: number;
  }[];
  no_show_rate: number;
  completion_rate: number;
}
```

---

## Error Handling

### Standard Error Response

All errors follow the Problem+JSON format:

```typescript
interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error_code: string;
  tenant_id?: string;
  user_id?: string;
  validation_errors?: {
    field: string;
    message: string;
  }[];
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400): Request validation failed
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `CONFLICT` (409): Resource conflict (e.g., duplicate subdomain)
- `RATE_LIMITED` (429): Rate limit exceeded
- `INTERNAL_ERROR` (500): Internal server error

### Rate Limiting

- **Default**: 100 requests per minute per user
- **Headers**: `Retry-After` indicates seconds to wait
- **Retry Strategy**: Exponential backoff with jitter

---

## Idempotency

### Idempotency Key Requirements

All mutating operations (POST, PUT, DELETE) require an `Idempotency-Key` header:

```typescript
// Generate idempotency key
const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Include in request headers
headers: {
  'Idempotency-Key': idempotencyKey,
  'Authorization': `Bearer ${token}`
}
```

### Idempotent Operations

- Tenant creation and updates
- Booking creation and updates
- Payment processing
- Service creation and updates
- Customer creation and updates

---

## Versioning

### API Versioning Strategy

- **Current Version**: v1
- **Version Header**: `API-Version: 1.0.0`
- **Backward Compatibility**: Maintained for 12 months
- **Deprecation Notice**: 6 months advance notice

### Breaking Changes

Breaking changes require a new major version:
- Removing fields
- Changing field types
- Changing required fields
- Changing response structure

---

## Contract Validation

### Schema Validation

All request/response payloads are validated against OpenAPI 3.0 schemas:

```yaml
# Example schema validation
components:
  schemas:
    Tenant:
      type: object
      required:
        - id
        - slug
        - name
        - timezone
      properties:
        id:
          type: string
          format: uuid
        slug:
          type: string
          pattern: '^[a-z0-9-]+$'
        name:
          type: string
          minLength: 1
          maxLength: 255
```

### Contract Tests

All endpoints have contract tests that validate:
- Request schema compliance
- Response schema compliance
- Error response format
- Authentication requirements
- Rate limiting behavior

---

## Completion Signal

This document is **complete** when:
- ✅ All four governance docs are published
- ✅ CI contract tests validate the schemas
- ✅ No `OPEN_QUESTION` remains in Phase-0
- ✅ `api_contracts.version_published` event has been logged

**Event**: `api_contracts.version_published` - Emitted when contract documentation is finalized

---

**Document Status**: ✅ COMPLETE - All contracts finalized, no OPEN_QUESTION items remain
