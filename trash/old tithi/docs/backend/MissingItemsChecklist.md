# Tithi Missing Items Checklist

**Purpose**: Comprehensive checklist of missing endpoints, fields, and functionality for the Tithi backend.

**Confidence Score**: 90% - Based on comprehensive backend analysis and frontend requirements.

## Missing Endpoints

### 1. Customer Management
```typescript
// ⚠️ MISSING: Customer CRUD operations
// Suggested Backend Signatures:

GET    /api/v1/customers                    # List customers
POST   /api/v1/customers                    # Create customer
GET    /api/v1/customers/{id}               # Get customer
PUT    /api/v1/customers/{id}               # Update customer
DELETE /api/v1/customers/{id}               # Delete customer
GET    /api/v1/customers/{id}/bookings      # Get customer bookings
GET    /api/v1/customers/{id}/payments      # Get customer payments
POST   /api/v1/customers/{id}/merge         # Merge duplicate customers
```

**Payload Examples:**
```json
// POST /api/v1/customers
{
  "display_name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "marketing_opt_in": true,
  "notification_preferences": {
    "email_enabled": true,
    "sms_enabled": true,
    "booking_notifications": true
  }
}

// PUT /api/v1/customers/{id}
{
  "display_name": "John Smith",
  "email": "johnsmith@example.com",
  "phone": "+1234567890",
  "marketing_opt_in": false,
  "notification_preferences": {
    "email_enabled": true,
    "sms_enabled": false,
    "booking_notifications": true
  }
}
```

### 2. Resource Management
```typescript
// ⚠️ MISSING: Resource CRUD operations
// Suggested Backend Signatures:

GET    /api/v1/resources                    # List resources
POST   /api/v1/resources                    # Create resource
GET    /api/v1/resources/{id}               # Get resource
PUT    /api/v1/resources/{id}               # Update resource
DELETE /api/v1/resources/{id}               # Delete resource
GET    /api/v1/resources/{id}/availability  # Get resource availability
POST   /api/v1/resources/{id}/availability  # Set resource availability
GET    /api/v1/resources/{id}/bookings       # Get resource bookings
```

**Payload Examples:**
```json
// POST /api/v1/resources
{
  "name": "Hair Stylist 1",
  "type": "staff",
  "tz": "America/New_York",
  "capacity": 1,
  "metadata": {
    "skills": ["haircut", "coloring", "styling"],
    "experience_years": 5,
    "specialties": ["men_haircuts", "women_haircuts"]
  }
}

// PUT /api/v1/resources/{id}
{
  "name": "Senior Hair Stylist",
  "type": "staff",
  "tz": "America/New_York",
  "capacity": 1,
  "is_active": true,
  "metadata": {
    "skills": ["haircut", "coloring", "styling", "extensions"],
    "experience_years": 8,
    "specialties": ["men_haircuts", "women_haircuts", "bridal"]
  }
}
```

### 3. Availability Management
```typescript
// ⚠️ MISSING: Real-time availability updates
// Suggested Backend Signatures:

GET    /api/v1/availability/{resource_id}/slots     # Get available slots
POST   /api/v1/availability/{resource_id}/hold     # Hold a time slot
DELETE /api/v1/availability/{resource_id}/hold/{id} # Release hold
GET    /api/v1/availability/{resource_id}/conflicts # Check conflicts
POST   /api/v1/availability/{resource_id}/bulk-update # Bulk update availability
GET    /api/v1/availability/{resource_id}/calendar  # Get calendar view
```

**Payload Examples:**
```json
// POST /api/v1/availability/{resource_id}/hold
{
  "start_at": "2024-01-15T10:00:00Z",
  "end_at": "2024-01-15T11:00:00Z",
  "hold_duration_min": 15,
  "customer_id": "uuid"
}

// POST /api/v1/availability/{resource_id}/bulk-update
{
  "updates": [
    {
      "day_of_week": 1,
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": true
    },
    {
      "day_of_week": 2,
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": true
    }
  ]
}
```

### 4. Calendar Integration
```typescript
// ⚠️ MISSING: External calendar sync
// Suggested Backend Signatures:

GET    /api/v1/calendar/integrations        # List calendar integrations
POST   /api/v1/calendar/integrations        # Create calendar integration
PUT    /api/v1/calendar/integrations/{id}   # Update integration
DELETE /api/v1/calendar/integrations/{id}   # Delete integration
POST   /api/v1/calendar/integrations/{id}/sync # Sync calendar
GET    /api/v1/calendar/integrations/{id}/events # Get external events
POST   /api/v1/calendar/integrations/{id}/events # Create external event
```

**Payload Examples:**
```json
// POST /api/v1/calendar/integrations
{
  "provider": "google_calendar",
  "credentials": {
    "access_token": "encrypted_token",
    "refresh_token": "encrypted_refresh_token",
    "calendar_id": "primary"
  },
  "sync_settings": {
    "sync_direction": "bidirectional",
    "sync_frequency": "15_minutes",
    "exclude_events": ["busy", "tentative"]
  }
}
```

### 5. Analytics Endpoints
```typescript
// ⚠️ MISSING: Detailed analytics queries
// Suggested Backend Signatures:

GET    /api/v1/analytics/revenue/daily       # Daily revenue analytics
GET    /api/v1/analytics/revenue/monthly     # Monthly revenue analytics
GET    /api/v1/analytics/revenue/yearly      # Yearly revenue analytics
GET    /api/v1/analytics/bookings/trends     # Booking trends
GET    /api/v1/analytics/customers/growth    # Customer growth analytics
GET    /api/v1/analytics/staff/performance   # Staff performance analytics
GET    /api/v1/analytics/services/popularity # Service popularity analytics
GET    /api/v1/analytics/cancellations/rate  # Cancellation rate analytics
```

**Payload Examples:**
```json
// GET /api/v1/analytics/revenue/daily?start_date=2024-01-01&end_date=2024-01-31
{
  "period": "daily",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "data": [
    {
      "date": "2024-01-01",
      "revenue_cents": 15000,
      "booking_count": 5,
      "average_booking_value": 3000
    }
  ],
  "totals": {
    "total_revenue_cents": 465000,
    "total_bookings": 155,
    "average_daily_revenue": 15000
  }
}
```

### 6. File Upload Endpoints
```typescript
// ⚠️ MISSING: File upload functionality
// Suggested Backend Signatures:

POST   /api/v1/upload/logo                  # Upload tenant logo
POST   /api/v1/upload/favicon              # Upload tenant favicon
POST   /api/v1/upload/documents            # Upload documents
GET    /api/v1/upload/{id}                 # Get uploaded file
DELETE /api/v1/upload/{id}                 # Delete uploaded file
GET    /api/v1/upload/{id}/download        # Download file
```

**Payload Examples:**
```json
// POST /api/v1/upload/logo
{
  "file": "base64_encoded_image",
  "file_type": "image/png",
  "file_size": 1024000,
  "upload_type": "logo"
}

// Response
{
  "id": "uuid",
  "url": "https://cdn.tithi.com/logos/tenant_id/logo.png",
  "file_type": "image/png",
  "file_size": 1024000,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### 7. Webhook Management
```typescript
// ⚠️ MISSING: Webhook configuration
// Suggested Backend Signatures:

GET    /api/v1/webhooks                    # List webhooks
POST   /api/v1/webhooks                    # Create webhook
GET    /api/v1/webhooks/{id}               # Get webhook
PUT    /api/v1/webhooks/{id}               # Update webhook
DELETE /api/v1/webhooks/{id}               # Delete webhook
POST   /api/v1/webhooks/{id}/test          # Test webhook
GET    /api/v1/webhooks/{id}/logs          # Get webhook logs
```

**Payload Examples:**
```json
// POST /api/v1/webhooks
{
  "url": "https://example.com/webhook",
  "events": ["booking.created", "booking.updated", "payment.succeeded"],
  "secret": "webhook_secret",
  "is_active": true,
  "retry_count": 3,
  "timeout_seconds": 30
}
```

## Missing Database Fields

### 1. Tenant Settings
```sql
-- ⚠️ MISSING: Additional tenant configuration fields
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS 
  business_hours jsonb DEFAULT '{}',
  timezone_offset integer DEFAULT 0,
  currency_code text DEFAULT 'USD',
  date_format text DEFAULT 'MM/DD/YYYY',
  time_format text DEFAULT '12h',
  language_code text DEFAULT 'en',
  country_code text DEFAULT 'US',
  tax_rate_percent decimal(5,2) DEFAULT 0.00,
  service_fee_percent decimal(5,2) DEFAULT 0.00,
  cancellation_policy_hours integer DEFAULT 24,
  no_show_fee_percent decimal(5,2) DEFAULT 0.00,
  max_advance_booking_days integer DEFAULT 30,
  min_advance_booking_hours integer DEFAULT 2,
  allow_waitlist boolean DEFAULT true,
  require_payment_confirmation boolean DEFAULT false,
  send_confirmation_emails boolean DEFAULT true,
  send_reminder_emails boolean DEFAULT true,
  reminder_hours_before integer DEFAULT 24;
```

### 2. Customer Preferences
```sql
-- ⚠️ MISSING: More detailed customer preferences
ALTER TABLE customers ADD COLUMN IF NOT EXISTS
  preferred_contact_method text DEFAULT 'email',
  preferred_contact_time text DEFAULT 'anytime',
  preferred_service_types text[] DEFAULT '{}',
  preferred_staff_ids uuid[] DEFAULT '{}',
  preferred_time_slots text[] DEFAULT '{}',
  allergies text,
  medical_conditions text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  vip_status boolean DEFAULT false,
  loyalty_points integer DEFAULT 0,
  total_spent_cents integer DEFAULT 0,
  last_visit_at timestamptz,
  visit_count integer DEFAULT 0;
```

### 3. Service Categories
```sql
-- ⚠️ MISSING: Service categorization system
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color_code text DEFAULT '#000000',
  icon_name text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add category_id to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS
  category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL;
```

### 4. Staff Skills
```sql
-- ⚠️ MISSING: Staff skill and specialty management
CREATE TABLE IF NOT EXISTS staff_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  skill_level text DEFAULT 'intermediate', -- beginner, intermediate, advanced, expert
  years_experience integer DEFAULT 0,
  certification_date date,
  certification_expiry date,
  is_primary_skill boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, staff_id, skill_name)
);

CREATE TABLE IF NOT EXISTS staff_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  specialty_name text NOT NULL,
  description text,
  price_premium_cents integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, staff_id, specialty_name)
);
```

### 5. Booking Notes
```sql
-- ⚠️ MISSING: Customer and staff notes for bookings
CREATE TABLE IF NOT EXISTS booking_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'general', -- general, customer, staff, medical, follow_up
  content text NOT NULL,
  is_private boolean DEFAULT false,
  is_visible_to_customer boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add notes to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  customer_notes text,
  staff_notes text,
  follow_up_notes text,
  special_requests text;
```

## Missing Validation Rules

### 1. Booking Overlap Prevention
```typescript
// ⚠️ MISSING: Real-time conflict detection
// Suggested Backend Implementation:

const validateBookingOverlap = async (resourceId, startAt, endAt, excludeBookingId = null) => {
  const overlappingBookings = await db.query(`
    SELECT id, start_at, end_at, status
    FROM bookings
    WHERE resource_id = $1
      AND status IN ('pending', 'confirmed', 'in_progress')
      AND (
        (start_at < $3 AND end_at > $2) OR
        (start_at < $3 AND end_at > $2)
      )
      ${excludeBookingId ? 'AND id != $4' : ''}
  `, [resourceId, startAt, endAt, excludeBookingId]);
  
  if (overlappingBookings.length > 0) {
    throw new ValidationError('Booking time conflicts with existing booking');
  }
};
```

### 2. Service Duration Validation
```typescript
// ⚠️ MISSING: Minimum/maximum duration limits
// Suggested Backend Implementation:

const validateServiceDuration = (serviceId, durationMin) => {
  const service = await Service.findById(serviceId);
  
  if (durationMin < service.min_duration_min) {
    throw new ValidationError(`Service duration must be at least ${service.min_duration_min} minutes`);
  }
  
  if (durationMin > service.max_duration_min) {
    throw new ValidationError(`Service duration cannot exceed ${service.max_duration_min} minutes`);
  }
};
```

### 3. Payment Amount Validation
```typescript
// ⚠️ MISSING: Business rule validation
// Suggested Backend Implementation:

const validatePaymentAmount = (amountCents, serviceId, tenantId) => {
  const service = await Service.findById(serviceId);
  const tenant = await Tenant.findById(tenantId);
  
  // Check minimum payment amount
  if (amountCents < tenant.min_payment_amount_cents) {
    throw new ValidationError(`Payment amount must be at least $${tenant.min_payment_amount_cents / 100}`);
  }
  
  // Check maximum payment amount
  if (amountCents > tenant.max_payment_amount_cents) {
    throw new ValidationError(`Payment amount cannot exceed $${tenant.max_payment_amount_cents / 100}`);
  }
  
  // Check service price match
  if (amountCents !== service.price_cents) {
    throw new ValidationError('Payment amount does not match service price');
  }
};
```

### 4. Notification Rate Limiting
```typescript
// ⚠️ MISSING: Prevent notification spam
// Suggested Backend Implementation:

const validateNotificationRate = async (recipientEmail, notificationType) => {
  const rateLimits = {
    'booking_confirmation': { max: 5, window: 3600 }, // 5 per hour
    'booking_reminder': { max: 3, window: 3600 },   // 3 per hour
    'payment_receipt': { max: 10, window: 3600 },    // 10 per hour
    'marketing': { max: 1, window: 86400 }            // 1 per day
  };
  
  const limit = rateLimits[notificationType];
  if (!limit) return;
  
  const recentCount = await db.query(`
    SELECT COUNT(*) as count
    FROM notifications
    WHERE recipient_email = $1
      AND notification_type = $2
      AND created_at > NOW() - INTERVAL '${limit.window} seconds'
  `, [recipientEmail, notificationType]);
  
  if (recentCount[0].count >= limit.max) {
    throw new ValidationError('Notification rate limit exceeded');
  }
};
```

### 5. File Upload Validation
```typescript
// ⚠️ MISSING: File type and size restrictions
// Suggested Backend Implementation:

const validateFileUpload = (file, uploadType) => {
  const allowedTypes = {
    'logo': ['image/png', 'image/jpeg', 'image/svg+xml'],
    'favicon': ['image/png', 'image/x-icon'],
    'documents': ['application/pdf', 'image/png', 'image/jpeg']
  };
  
  const maxSizes = {
    'logo': 2 * 1024 * 1024,      // 2MB
    'favicon': 1 * 1024 * 1024,   // 1MB
    'documents': 10 * 1024 * 1024 // 10MB
  };
  
  if (!allowedTypes[uploadType].includes(file.mimetype)) {
    throw new ValidationError(`File type not allowed for ${uploadType}`);
  }
  
  if (file.size > maxSizes[uploadType]) {
    throw new ValidationError(`File size exceeds maximum for ${uploadType}`);
  }
};
```

## Missing Business Logic

### 1. Waitlist Management
```typescript
// ⚠️ MISSING: Waitlist functionality
// Suggested Backend Implementation:

const addToWaitlist = async (customerId, serviceId, preferredDate, preferredTime) => {
  const waitlistEntry = await WaitlistEntry.create({
    customer_id: customerId,
    service_id: serviceId,
    preferred_date: preferredDate,
    preferred_time: preferredTime,
    status: 'waiting',
    position: await getNextWaitlistPosition(serviceId, preferredDate)
  });
  
  // Notify customer of waitlist position
  await sendWaitlistNotification(waitlistEntry);
  
  return waitlistEntry;
};

const processWaitlist = async (serviceId, availableDate) => {
  const waitlistEntries = await WaitlistEntry.find({
    service_id: serviceId,
    preferred_date: availableDate,
    status: 'waiting'
  }).sort({ position: 1 });
  
  for (const entry of waitlistEntries) {
    try {
      await createBookingFromWaitlist(entry);
      await updateWaitlistEntry(entry.id, { status: 'converted' });
      break; // Only convert first available entry
    } catch (error) {
      // Skip if booking creation fails
      continue;
    }
  }
};
```

### 2. Loyalty Program
```typescript
// ⚠️ MISSING: Customer loyalty system
// Suggested Backend Implementation:

const calculateLoyaltyPoints = (bookingAmount, customerTier) => {
  const pointRates = {
    'bronze': 1,    // 1 point per dollar
    'silver': 1.5,  // 1.5 points per dollar
    'gold': 2,      // 2 points per dollar
    'platinum': 2.5 // 2.5 points per dollar
  };
  
  return Math.floor(bookingAmount * pointRates[customerTier]);
};

const redeemLoyaltyPoints = async (customerId, pointsToRedeem) => {
  const customer = await Customer.findById(customerId);
  
  if (customer.loyalty_points < pointsToRedeem) {
    throw new ValidationError('Insufficient loyalty points');
  }
  
  const discountAmount = pointsToRedeem * 0.01; // 1 point = $0.01
  
  await Customer.update(customerId, {
    loyalty_points: customer.loyalty_points - pointsToRedeem
  });
  
  return discountAmount;
};
```

### 3. Recurring Bookings
```typescript
// ⚠️ MISSING: Recurring booking functionality
// Suggested Backend Implementation:

const createRecurringBooking = async (bookingData, recurrenceRule) => {
  const bookings = [];
  const startDate = new Date(bookingData.start_at);
  const endDate = new Date(bookingData.end_at);
  
  // Parse recurrence rule (RRULE format)
  const rrule = new RRule(recurrenceRule);
  const occurrences = rrule.between(startDate, new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000));
  
  for (const occurrence of occurrences) {
    const bookingStart = new Date(occurrence);
    const bookingEnd = new Date(occurrence.getTime() + (endDate.getTime() - startDate.getTime()));
    
    const booking = await Booking.create({
      ...bookingData,
      start_at: bookingStart,
      end_at: bookingEnd,
      is_recurring: true,
      recurrence_rule: recurrenceRule,
      parent_booking_id: bookings[0]?.id
    });
    
    bookings.push(booking);
  }
  
  return bookings;
};
```

## Missing API Documentation

### 1. OpenAPI Specification
```yaml
# ⚠️ MISSING: Complete OpenAPI 3.0 specification
# Suggested Implementation:

openapi: 3.0.0
info:
  title: Tithi API
  version: 1.0.0
  description: Multi-tenant booking platform API
  contact:
    name: Tithi Support
    email: support@tithi.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.tithi.com/api/v1
    description: Production server
  - url: https://staging-api.tithi.com/api/v1
    description: Staging server

paths:
  /tenants:
    get:
      summary: List tenants
      description: Get list of tenants for authenticated user
      security:
        - bearerAuth: []
      responses:
        '200':
          description: List of tenants
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Tenant'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

### 2. API Versioning
```typescript
// ⚠️ MISSING: API versioning strategy
// Suggested Implementation:

// URL versioning: /api/v1/, /api/v2/
// Header versioning: Accept: application/vnd.tithi.v1+json
// Query parameter versioning: ?version=1.0
// Backward compatibility: Maintain old versions for 12 months
```

## Missing Monitoring and Observability

### 1. Health Checks
```typescript
// ⚠️ MISSING: Comprehensive health checks
// Suggested Backend Implementation:

const healthChecks = {
  database: async () => {
    const result = await db.query('SELECT 1');
    return { status: 'healthy', response_time: Date.now() - start };
  },
  redis: async () => {
    const result = await redis.ping();
    return { status: 'healthy', response_time: Date.now() - start };
  },
  stripe: async () => {
    const result = await stripe.balance.retrieve();
    return { status: 'healthy', response_time: Date.now() - start };
  },
  sendgrid: async () => {
    const result = await sendgrid.client.mail.get();
    return { status: 'healthy', response_time: Date.now() - start };
  }
};
```

### 2. Metrics Collection
```typescript
// ⚠️ MISSING: Application metrics
// Suggested Backend Implementation:

const metrics = {
  booking_created: new Counter('bookings_created_total'),
  payment_processed: new Counter('payments_processed_total'),
  payment_failed: new Counter('payments_failed_total'),
  notification_sent: new Counter('notifications_sent_total'),
  api_request_duration: new Histogram('api_request_duration_seconds'),
  database_query_duration: new Histogram('database_query_duration_seconds')
};
```

## Priority Implementation Order

### Phase 1 (Critical - 2 weeks)
1. Customer CRUD endpoints
2. Resource CRUD endpoints
3. Booking overlap validation
4. Payment amount validation
5. Basic health checks

### Phase 2 (Important - 4 weeks)
1. Availability management endpoints
2. File upload functionality
3. Service duration validation
4. Notification rate limiting
5. Waitlist management

### Phase 3 (Enhancement - 6 weeks)
1. Calendar integration
2. Analytics endpoints
3. Webhook management
4. Loyalty program
5. Recurring bookings

### Phase 4 (Advanced - 8 weeks)
1. Complete OpenAPI specification
2. Advanced monitoring
3. Performance optimization
4. Security enhancements
5. Documentation completion

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
**Confidence Score**: 90%
