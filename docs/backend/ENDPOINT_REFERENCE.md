# Tithi Backend API - Endpoint Reference

Complete reference for all backend API endpoints with detailed explanations, request/response examples, and error handling.

## Table of Contents

1. [Base URL & Authentication](#base-url--authentication)
2. [Onboarding Endpoints](#onboarding-endpoints)
3. [Public Booking Endpoints](#public-booking-endpoints)
4. [Admin Endpoints](#admin-endpoints)
5. [Webhook Endpoints](#webhook-endpoints)
6. [Cron Endpoints](#cron-endpoints)
7. [Error Responses](#error-responses)
8. [Testing](#testing)

---

## Base URL & Authentication

### Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://yourdomain.com`

### Authentication

**What**: Most endpoints require authentication to identify the current user.

**Why**: Backend needs to know which user is making the request to enforce Row Level Security (RLS) and ensure users can only access their own data.

**How**: Include Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer {access_token}
```

**How to get access token**:
- **From Frontend**: After Supabase Auth login/signup, token is in session
- **From API**: Call Supabase Auth API directly:
  ```bash
  curl -X POST "https://YOUR_PROJECT.supabase.co/auth/v1/token?grant_type=password" \
    -H "apikey: YOUR_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email": "user@example.com", "password": "password"}'
  ```
  Response contains `access_token` - use this as `{access_token}`

**Public Endpoints** (no authentication required):
- `/api/public/{slug}/catalog`
- `/api/public/{slug}/availability`
- `/api/public/{slug}/bookings`
- `/api/public/{slug}/gift-codes/preview`

**Protected Endpoints** (authentication required):
- All `/api/business/onboarding/*` endpoints
- All `/api/admin/*` endpoints

**Cron Endpoints** (special authentication):
- Use `Authorization: Bearer {CRON_SECRET}` header
- See [Cron Endpoints](#cron-endpoints) section

---

## Onboarding Endpoints

All onboarding endpoints are at `/api/business/onboarding/{step-name}` and require authentication.

## Onboarding Endpoints

All onboarding endpoints follow a similar pattern:
- **Method**: `PUT` (except Step 11 and Complete use `POST`)
- **Authentication**: Required (Bearer token)
- **Purpose**: Save configuration data for a specific onboarding step
- **Pattern**: Updates database tables related to that step

### Step 1: Business Basics

**Endpoint**: `PUT /api/business/onboarding/step-1-business`

**What it does**: Creates or updates the business's basic information (name, description, legal details, industry).

**Why**: This is the first step of onboarding - creates the business record that all other data links to.

**When to use**: When user completes Step 1 of onboarding form.

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "businessName": "My Business",
  "description": "Business description",
  "doingBusinessAs": "DBA Name",
  "legalName": "Legal Name LLC",
  "industry": "Beauty"
}
```

**Field Descriptions:**
- `businessName` (required): Display name of the business
- `description` (optional): Business description
- `doingBusinessAs` (optional): DBA name if different from legal name
- `legalName` (optional): Legal business name
- `industry` (required): Business industry (e.g., "Beauty", "Wellness", "Medical")

**Success Response** (200 OK):
```json
{
  "success": true,
  "businessId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Business information saved successfully"
}
```

**Response Fields:**
- `success`: Boolean indicating success
- `businessId`: UUID of the created/updated business record
- `message`: Success message

**Error Responses:**
- `400 Bad Request`: Missing required fields
  ```json
  {
    "error": "Missing required fields: businessName, industry"
  }
  ```
- `401 Unauthorized`: Missing or invalid access token
  ```json
  {
    "error": "Unauthorized"
  }
  ```
- `500 Internal Server Error`: Database error
  ```json
  {
    "error": "Failed to create business",
    "details": "Database connection failed"
  }
  ```

**Database Changes:**
- Creates or updates row in `businesses` table
- Sets `name`, `description`, `dba_name`, `legal_name`, `industry` fields
- Creates temporary subdomain if business is new

**Testing:**
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-1-business \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "businessName": "Test Business",
    "description": "A test business",
    "doingBusinessAs": "Test DBA",
    "legalName": "Test Business LLC",
    "industry": "Beauty"
  }'
```

### Step 2: Website/Subdomain

**Endpoint**: `PUT /api/business/onboarding/step-2-website`

**What it does**: Validates and reserves a subdomain for the business's public booking site.

**Why**: Each business needs a unique subdomain for their public booking site (e.g., `my-business.tithi.com`).

**When to use**: When user completes Step 2 of onboarding (website/subdomain selection).

**Request Headers:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "subdomain": "my-business",
  "status": "reserved"
}
```

**Field Descriptions:**
- `subdomain` (required): Desired subdomain (alphanumeric, hyphens, 3-63 chars)
- `status` (optional): Status indicator (not used by backend, for frontend state)

**Validation Rules:**
- Must be 3-63 characters
- Alphanumeric and hyphens only
- Must start and end with alphanumeric character
- Cannot contain consecutive hyphens

**Success Response** (200 OK):
```json
{
  "success": true,
  "subdomain": "my-business",
  "bookingUrl": "https://my-business.tithi.com",
  "message": "Subdomain reserved successfully"
}
```

**Response Fields:**
- `success`: Boolean indicating success
- `subdomain`: Normalized subdomain (lowercased)
- `bookingUrl`: Full URL for the booking site
- `message`: Success message

**Error Responses:**
- `400 Bad Request`: Invalid subdomain format
  ```json
  {
    "error": "Invalid subdomain format. Must be 3-63 characters, alphanumeric with hyphens only."
  }
  ```
- `409 Conflict`: Subdomain already taken
  ```json
  {
    "error": "Subdomain is already taken",
    "subdomain": "my-business"
  }
  ```

**Database Changes:**
- Updates `businesses.subdomain` field
- Uniqueness constraint ensures only one business per subdomain

**Testing:**
```bash
curl -X PUT http://localhost:3000/api/business/onboarding/step-2-website \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subdomain": "test-business",
    "status": "reserved"
  }'
```

### Step 3: Location & Contacts

**PUT** `/api/business/onboarding/step-3-location`

Updates location and contact information.

**Request Body:**
```json
{
  "timezone": "America/New_York",
  "phone": "+1234567890",
  "supportEmail": "support@example.com",
  "website": "https://example.com",
  "addressLine1": "123 Main St",
  "city": "New York",
  "stateProvince": "NY",
  "postalCode": "10001",
  "country": "US"
}
```

### Step 4: Team/Staff

**PUT** `/api/business/onboarding/step-4-team`

Updates staff members.

**Request Body:**
```json
{
  "staff": [
    {
      "id": "uuid",
      "name": "John Doe",
      "role": "Stylist",
      "color": "#FF5733",
      "active": true
    }
  ]
}
```

### Step 5: Branding

**PUT** `/api/business/onboarding/step-5-branding`

Updates branding (colors and logo).

**Request Body:**
```json
{
  "primaryColor": "#FF5733",
  "secondaryColor": "#33FF57",
  "logoUrl": "https://example.com/logo.png"
}
```

### Step 6: Services & Categories

**PUT** `/api/business/onboarding/step-6-services`

Creates or updates service categories and services.

**Request Body:**
```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "Hair Services",
      "color": "#FF5733",
      "services": [
        {
          "id": "uuid",
          "name": "Haircut",
          "durationMinutes": 30,
          "priceCents": 5000,
          "staffIds": ["staff-uuid"]
        }
      ]
    }
  ]
}
```

### Step 7: Availability

**PUT** `/api/business/onboarding/step-7-availability`

Updates availability rules.

**Request Body:**
```json
{
  "availability": [
    {
      "serviceId": "uuid",
      "staff": [
        {
          "staffId": "uuid",
          "slots": [
            {
              "day": "monday",
              "startTime": "09:00",
              "endTime": "17:00"
            }
          ]
        }
      ]
    }
  ]
}
```

### Step 8: Notifications

**PUT** `/api/business/onboarding/step-8-notifications`

Updates notification templates.

**Request Body:**
```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Booking Confirmation",
      "channel": "email",
      "category": "confirmation",
      "trigger": "booking_created",
      "subject": "Booking Confirmed",
      "body": "Your booking is confirmed for ${booking.date} at ${booking.time}",
      "enabled": true
    }
  ]
}
```

### Step 9: Policies

**PUT** `/api/business/onboarding/step-9-policies`

Creates a new version of business policies.

**Request Body:**
```json
{
  "cancellationPolicy": "Cancel 24h in advance",
  "cancellationFeeType": "percent",
  "cancellationFeeValue": 10,
  "noShowPolicy": "No-show fee applies",
  "noShowFeeType": "amount",
  "noShowFeeValue": 20,
  "refundPolicy": "Refunds available",
  "cashPolicy": "Cash accepted"
}
```

### Step 10: Gift Cards

**PUT** `/api/business/onboarding/step-10-gift-cards`

Configures gift cards and generates codes.

**Request Body:**
```json
{
  "enabled": true,
  "amountType": "amount",
  "amountValue": 50,
  "expirationEnabled": true,
  "expirationMonths": 12,
  "generatedCodes": ["WINTER50", "GIFT2025"]
}
```

### Step 11: Payment Setup

**POST** `/api/business/onboarding/step-11-payment-setup`

Sets up Stripe Connect account and subscription.

**Request Body:**
```json
{
  "email": "owner@example.com",
  "connectAccountId": "acct_xxx", // Optional, if returning from Stripe
  "returnUrl": "http://localhost:3000/onboarding/payment-setup",
  "refreshUrl": "http://localhost:3000/onboarding/payment-setup"
}
```

**Response (if account link needed):**
```json
{
  "success": true,
  "accountLinkUrl": "https://connect.stripe.com/...",
  "connectAccountId": "acct_xxx",
  "message": "Please complete Stripe Connect onboarding"
}
```

**Response (if complete):**
```json
{
  "success": true,
  "connectAccountId": "acct_xxx",
  "subscriptionId": "sub_xxx",
  "message": "Payment setup completed successfully"
}
```

### Complete Onboarding

**POST** `/api/business/onboarding/complete`

Finalizes onboarding and marks business as active.

**Response:**
```json
{
  "success": true,
  "businessId": "uuid",
  "bookingUrl": "https://my-business.tithi.com",
  "message": "Business is now live!"
}
```

---

## Public Booking Endpoints

### What These Endpoints Do

These endpoints are used by customers to browse services, check availability, and create bookings on the public booking site (e.g., `https://my-business.tithi.com`).

### Authentication

**Public endpoints** - No authentication required. Anyone can access these endpoints using the business subdomain.

### How They Work

Public endpoints identify the business by subdomain (slug) in the URL, not by authentication. This allows customers to book without logging in.

---

### Get Catalog

**Endpoint**: `GET /api/public/{slug}/catalog`

**What it does**: Returns the business catalog including business info, service categories, services, and staff.

**Why**: Customers need this to see what services are available and who can perform them.

**When to use**: When loading the public booking page - shows all available services and staff.

**Request Parameters:**
- `{slug}`: Business subdomain (e.g., `my-business`)

**No authentication required**

**Success Response** (200 OK):
```json
{
  "business": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Business",
    "subdomain": "my-business",
    "timezone": "America/New_York",
    "brand_primary_color": "#FF5733",
    "brand_secondary_color": "#33FF57",
    "logo_url": "https://example.com/logo.png",
    "support_email": "support@example.com",
    "phone": "+1234567890"
  },
  "categories": [
    {
      "id": "category-uuid",
      "name": "Hair Services",
      "description": "Hair-related services",
      "color": "#FF5733",
      "services": [
        {
          "id": "service-uuid",
          "name": "Haircut",
          "description": "Standard haircut",
          "duration_min": 30,
          "price_cents": 5000,
          "staffIds": ["staff-uuid-1", "staff-uuid-2"]
        }
      ]
    }
  ],
  "staff": [
    {
      "id": "staff-uuid-1",
      "name": "John Doe",
      "role": "Stylist",
      "color": "#FF5733"
    }
  ]
}
```

**Response Fields:**
- `business`: Business information and branding
- `categories`: Service categories with nested services
- `staff`: Active staff members who can perform services

**Error Responses:**
- `404 Not Found`: Business not found or subdomain doesn't exist
  ```json
  {
    "error": "Business not found"
  }
  ```

**Database Queries:**
- Queries `businesses` table by subdomain
- Queries `service_categories` and `services` (active only)
- Queries `staff` and `staff_services` for associations

**Testing:**
```bash
curl http://localhost:3000/api/public/my-business/catalog
```

---

### Get Availability

**Endpoint**: `GET /api/public/{slug}/availability?service_id={id}&date=YYYY-MM-DD`

**What it does**: Returns available time slots for a specific service on a specific date.

**Why**: Customers need to see when they can book a service.

**When to use**: When customer selects a service and date - shows available time slots.

**How it works**: Uses the availability engine to:
1. Load availability rules for the service/staff
2. Check blackouts for the date
3. Check existing bookings for the date
4. Generate 15-minute slots that are available
5. Filter by lead time and max advance days

**Request Parameters:**
- `{slug}`: Business subdomain
- `service_id` (query param, required): UUID of the service
- `date` (query param, required): Date in YYYY-MM-DD format

**No authentication required**

**Success Response** (200 OK):
```json
{
  "slots": [
    {
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "staff_name": "John Doe",
      "start_at": "2025-01-20T14:00:00Z",
      "end_at": "2025-01-20T14:30:00Z"
    },
    {
      "staff_id": "550e8400-e29b-41d4-a716-446655440000",
      "staff_name": "John Doe",
      "start_at": "2025-01-20T14:15:00Z",
      "end_at": "2025-01-20T14:45:00Z"
    }
  ],
  "service_id": "service-uuid",
  "date": "2025-01-20"
}
```

**Response Fields:**
- `slots`: Array of available time slots
  - `staff_id`: UUID of staff member
  - `staff_name`: Name of staff member
  - `start_at`: ISO timestamp of slot start
  - `end_at`: ISO timestamp of slot end
- `service_id`: The requested service ID
- `date`: The requested date

**Error Responses:**
- `400 Bad Request`: Missing or invalid parameters
  ```json
  {
    "error": "service_id query parameter is required"
  }
  ```
- `404 Not Found`: Business, service, or staff not found

**Algorithm Details:**
- Uses `generateAvailabilitySlots()` from `lib/availability.ts`
- Respects availability rules (weekly schedule)
- Excludes blackouts (global and staff-specific)
- Excludes existing bookings (pending, scheduled, held)
- Filters by minimum lead time (default 2 hours)
- Filters by maximum advance days (default 60 days)
- Generates slots in 15-minute increments

**Testing:**
```bash
curl "http://localhost:3000/api/public/my-business/availability?service_id=SERVICE_ID&date=2025-01-20"
```

### Preview Gift Code

**POST** `/api/public/{slug}/gift-codes/preview`

Validates a gift code and computes discount.

**Request Body:**
```json
{
  "code": "WINTER50",
  "base_price_cents": 5000
}
```

**Response:**
```json
{
  "discount_cents": 2500,
  "final_price_cents": 2500,
  "type": "percent",
  "gift_card_id": "uuid"
}
```

### Create Booking

**POST** `/api/public/{slug}/bookings`

Creates a new booking with card setup (no charge yet).

**Request Body:**
```json
{
  "service_id": "uuid",
  "staff_id": "uuid",
  "start_at": "2025-01-20T14:00:00Z",
  "customer": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1234567890"
  },
  "gift_card_code": "WINTER50",
  "consent_ip": "192.168.1.1",
  "consent_user_agent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "booking_id": "uuid",
  "booking_code": "TITHI-1234ABCD",
  "client_secret": "seti_xxx_secret_xxx",
  "setup_intent_id": "seti_xxx",
  "final_price_cents": 2500
}
```

---

## Admin Endpoints

All admin endpoints require authentication.

### List Bookings

**GET** `/api/admin/bookings?status={status}&from={date}&to={date}&cursor={id}&limit={n}`

Returns paginated list of bookings.

**Query Parameters:**
- `status` (optional): Filter by status (pending, completed, no_show, cancelled, refunded)
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `cursor` (optional): Pagination cursor
- `limit` (optional): Page size (default: 20)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "TITHI-1234ABCD",
      "status": "pending",
      "service": {
        "name": "Haircut",
        "duration_min": 30,
        "price_cents": 5000
      },
      "customer": {
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "start_at": "2025-01-20T14:00:00Z",
      "final_price_cents": 5000,
      "last_payment_status": "card_saved"
    }
  ],
  "next_page_token": "uuid"
}
```

### Complete Booking

**Endpoint**: `POST /api/admin/bookings/{id}/complete`

**What it does**: Charges the full booking amount when owner clicks "Completed" button.

**Why**: This is when money actually moves - customer is charged the full `final_price_cents` for the completed appointment.

**When to use**: When owner marks a booking as completed in the Money Board.

**Key Features:**
- Idempotency protection (prevents duplicate charges)
- Creates Stripe PaymentIntent with Connect destination
- Applies 1% platform fee automatically
- Updates booking status to "completed"
- Handles gift card balance deduction (if amount-type card used)
- Updates payment records

**Request Parameters:**
- `{id}`: Booking UUID

**Request Headers:**
```
Authorization: Bearer {access_token}
X-Idempotency-Key: unique-key-123
Content-Type: application/json
```

**Headers Explanation:**
- `Authorization`: Required - identifies the business owner
- `X-Idempotency-Key`: **REQUIRED** - Unique string to prevent duplicate charges
  - **Why**: If owner double-clicks or request retries, this prevents charging twice
  - **Format**: Any unique string (e.g., UUID, timestamp-based string)
  - **Example**: `X-Idempotency-Key: complete-booking-123-2025-01-20T14:00:00Z`
  - **⚠️ Important**: Must be unique for each request, but same key returns cached response

**Request Body**: None required

**Success Response** (200 OK):
```json
{
  "status": "CHARGED",
  "charge_amount": 5000,
  "currency": "usd",
  "stripe_payment_intent_id": "pi_1234567890abcdef",
  "receipt_url": "https://dashboard.stripe.com/payments/pi_1234567890abcdef"
}
```

**Response Fields:**
- `status`: Status of the charge ("CHARGED")
- `charge_amount`: Amount charged in cents
- `currency`: Currency code (always "usd")
- `stripe_payment_intent_id`: Stripe PaymentIntent ID
- `receipt_url`: Link to Stripe Dashboard payment page

**What Happens:**
1. Checks idempotency key - if exists, returns cached response
2. Looks up booking, business, customer
3. Gets payment method from SetupIntent
4. Calculates amount: `booking.final_price_cents`
5. Calculates platform fee: 1% of amount
6. Creates Stripe PaymentIntent with Connect destination
7. Creates `booking_payments` record
8. Updates booking status to "completed"
9. Deducts gift card balance if applicable
10. Stores idempotency key and response

**Error Responses:**
- `400 Bad Request`: Missing idempotency key or booking already completed
  ```json
  {
    "error": "X-Idempotency-Key header is required"
  }
  ```
- `401 Unauthorized`: Missing or invalid access token
- `404 Not Found`: Booking not found or doesn't belong to user
- `500 Internal Server Error`: Payment failed or database error

**Database Changes:**
- Creates row in `booking_payments` table (money_action='completed_charge')
- Updates `bookings.status` to 'completed'
- Updates `bookings.payment_status` to 'charged'
- Updates `bookings.last_money_action` to 'completed_charge'
- Updates `gift_cards.current_balance_cents` if amount-type card used
- Creates row in `gift_card_ledger` if gift card used
- Stores idempotency key in `idempotency_keys` table

**Idempotency:**
- Same `X-Idempotency-Key` for same booking returns cached response
- Prevents duplicate charges if request is retried
- Response is stored for future requests with same key

**Testing:**
```bash
curl -X POST http://localhost:3000/api/admin/bookings/BOOKING_ID/complete \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Idempotency-Key: unique-key-$(date +%s)"
```

### No-Show Booking

**POST** `/api/admin/bookings/{id}/no-show`

Charges no-show fee for a booking.

**Headers:**
- `X-Idempotency-Key`: Required

**Response:**
```json
{
  "status": "CHARGED",
  "charge_amount": 2000,
  "currency": "usd",
  "stripe_payment_intent_id": "pi_xxx",
  "receipt_url": "https://dashboard.stripe.com/payments/pi_xxx"
}
```

### Cancel Booking

**POST** `/api/admin/bookings/{id}/cancel`

Charges cancellation fee for a booking.

**Headers:**
- `X-Idempotency-Key`: Required

**Response:**
```json
{
  "status": "CHARGED",
  "charge_amount": 500,
  "currency": "usd",
  "stripe_payment_intent_id": "pi_xxx"
}
```

### Refund Booking

**POST** `/api/admin/bookings/{id}/refund`

Refunds a previous charge for a booking.

**Headers:**
- `X-Idempotency-Key`: Required

**Response:**
```json
{
  "status": "REFUNDED",
  "refund_amount": 5000,
  "currency": "usd",
  "stripe_refund_id": "re_xxx",
  "receipt_url": "https://dashboard.stripe.com/refunds/re_xxx"
}
```

---

## Webhook Endpoints

### Stripe Webhook

**POST** `/api/webhooks/stripe`

Handles Stripe webhook events. Requires Stripe signature verification.

**Headers:**
- `stripe-signature`: Stripe webhook signature (required)

---

## Cron Endpoints

All cron endpoints require authentication via `Authorization: Bearer {CRON_SECRET}` header.

### Process Notifications

**GET** `/api/cron/notifications`

Processes pending notification jobs. Should be called every 1-2 minutes.

### Schedule Reminders

**GET** `/api/cron/reminders`

Schedules 24h and 1h reminder notifications. Should be called every 5-10 minutes.

### Cleanup Held Bookings

**GET** `/api/cron/cleanup`

Expires held bookings older than 5 minutes. Should be called every minute.

### Subscription Health Check

**GET** `/api/cron/subscription-health`

Syncs Stripe subscription status with database. Should be called daily.

---

## Error Responses

### Standard Error Format

All endpoints return errors in a consistent format for easy handling in the frontend.

**Error Response Format:**
```json
{
  "error": "Error message",
  "details": "Optional detailed error information"
}
```

**Field Descriptions:**
- `error`: Main error message (user-friendly or technical)
- `details`: Additional error details (often technical, for debugging)

### HTTP Status Codes

Endpoints use standard HTTP status codes:

**2xx Success:**
- `200 OK`: Request succeeded
  - Most GET/PUT/POST requests return 200 on success
  - Response body contains success data

**4xx Client Errors:**
- `400 Bad Request`: Invalid request data
  - **Examples**: Missing required fields, invalid format, validation errors
  - **Response**: `{"error": "Missing required fields: businessName, industry"}`
  
- `401 Unauthorized`: Authentication required or failed
  - **Examples**: Missing `Authorization` header, invalid/expired token
  - **Response**: `{"error": "Unauthorized"}`
  
- `404 Not Found`: Resource not found
  - **Examples**: Business not found, booking not found, service not found
  - **Response**: `{"error": "Booking not found"}`
  
- `409 Conflict`: Resource conflict
  - **Examples**: Subdomain already taken, time slot already booked
  - **Response**: `{"error": "Subdomain is already taken", "subdomain": "my-business"}`

**5xx Server Errors:**
- `500 Internal Server Error`: Server-side error
  - **Examples**: Database connection failed, Stripe API error, unexpected exception
  - **Response**: `{"error": "Internal server error", "details": "Database connection failed"}`

### Error Handling in Frontend

**Best Practices:**
1. **Check status code first** - Handle different codes differently
2. **Show user-friendly messages** - Don't show technical details to users
3. **Log technical details** - Log `details` field for debugging
4. **Handle 401 specially** - Redirect to login if token expired
5. **Handle 409 specially** - Show specific conflict message

**Example Frontend Error Handling:**
```typescript
try {
  const response = await fetch('/api/business/onboarding/step-2-website', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subdomain: 'test' }),
  });

  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    } else if (response.status === 409) {
      // Show conflict message
      toast.error(error.error || 'Subdomain already taken');
    } else {
      // Show error message
      toast.error(error.error || 'An error occurred');
    }
    
    // Log details for debugging
    console.error('API Error:', error);
    return;
  }

  const data = await response.json();
  // Handle success...
} catch (error) {
  // Network error or other exception
  toast.error('Network error. Please try again.');
  console.error('Network Error:', error);
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding:
- Public endpoints: 60 requests/minute per IP
- Admin endpoints: 30 requests/minute per user
- Money actions: 10 requests/minute per user

---

## Testing

### Test Script (Recommended)

**What**: Automated test script that checks multiple endpoints.

**How to use**:
```bash
# Make script executable (one time)
chmod +x apps/web/scripts/test-backend.sh

# Run test script
./apps/web/scripts/test-backend.sh

# With authentication token
export ACCESS_TOKEN='your_access_token'
./apps/web/scripts/test-backend.sh

# With service ID for availability testing
export SERVICE_ID='service_uuid'
export DATE='2025-01-20'
./apps/web/scripts/test-backend.sh
```

**What it tests**:
- ✅ Database connection
- ✅ Public catalog endpoint
- ✅ Public availability endpoint (if SERVICE_ID provided)
- ✅ Admin endpoints (if ACCESS_TOKEN provided)

**Why**: Quick way to verify endpoints are working without manual curl commands.

---

### Manual Testing with curl

**Why**: Useful for testing specific endpoints or debugging issues.

**Basic curl command pattern**:
```bash
# GET request
curl http://localhost:3000/api/endpoint

# GET with authentication
curl http://localhost:3000/api/endpoint \
  -H "Authorization: Bearer YOUR_TOKEN"

# POST/PUT request
curl -X POST http://localhost:3000/api/endpoint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"field": "value"}'
```

**Common Examples**:

1. **Test database connection**:
   ```bash
   curl http://localhost:3000/api/test-db
   ```

2. **Test onboarding Step 1**:
   ```bash
   curl -X PUT http://localhost:3000/api/business/onboarding/step-1-business \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "businessName": "Test Business",
       "industry": "Beauty"
     }'
   ```

3. **Test public catalog**:
   ```bash
   curl http://localhost:3000/api/public/test-business/catalog
   ```

4. **Test admin list bookings**:
   ```bash
   curl http://localhost:3000/api/admin/bookings \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

5. **Test complete booking**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/bookings/BOOKING_ID/complete \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Idempotency-Key: unique-key-$(date +%s)"
   ```

---

### Testing with Postman

**Why**: Postman provides a better UI for testing APIs and organizing requests.

**Setup**:
1. Create a new Collection: "Tithi Backend"
2. Set Collection Variables:
   - `base_url`: `http://localhost:3000`
   - `access_token`: `YOUR_TOKEN`
3. Add requests for each endpoint
4. Use variables: `{{base_url}}/api/...`

**Benefits**:
- Save and organize requests
- Easy to switch between environments (dev/prod)
- Visual response inspection
- Can create test scripts
- Can share with team

---

### Testing with Automated Tests

**Why**: Automated tests catch regressions and verify endpoints work correctly.

**Consider creating**:
- **Unit tests**: Test individual functions (e.g., slot generation, pricing calculations)
- **Integration tests**: Test endpoints end-to-end
- **E2E tests**: Test full flows (onboarding → booking → payment)

**Test libraries** (for Next.js):
- `@testing-library/react` - Component testing
- `@testing-library/jest-dom` - DOM assertions
- `jest` - Test runner
- `supertest` - API testing

---

## Rate Limiting

### Current Status

**Currently**: No rate limiting is implemented.

**Why**: For v1, rate limiting may not be necessary depending on scale.

### Recommended Rate Limits

For production, consider adding rate limiting:

**Public Endpoints:**
- Availability endpoint: 60 requests/minute per IP
- Booking creation: 10 bookings/minute per IP
- Catalog endpoint: 100 requests/minute per IP

**Admin Endpoints:**
- List bookings: 30 requests/minute per user
- Money actions: 10 actions/minute per user

**Why**: Rate limiting protects against abuse and DoS attacks.

### Implementation Options

**Option 1: Next.js Middleware** (Recommended):
- Use middleware to check rate limits
- Store rate limit counters in Redis or database
- Return 429 Too Many Requests when limit exceeded

**Option 2: Third-Party Service**:
- Use Cloudflare, Vercel Edge, or similar
- Configure rate limits at infrastructure level

**Option 3: API Gateway**:
- Use AWS API Gateway, Kong, or similar
- Configure rate limits at gateway level

**Response when rate limited** (429 Too Many Requests):
```json
{
  "error": "Rate limit exceeded",
  "details": "Too many requests. Please try again later.",
  "retry_after": 60
}
```


