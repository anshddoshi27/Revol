# 📊 Tithi Database Map for Frontend Development

**Purpose**: Complete database schema mapping for AI executor to build the complementary frontend for Tithi booking platform.

---

## 🎯 Executive Summary

This document maps every database table, field, relationship, and data flow pattern in the Tithi platform. It serves as the single source of truth for frontend developers and AI executors to understand:

1. **What data exists** - All tables and their fields
2. **How data relates** - Complete relationship mapping
3. **Where data flows** - Data lifecycle and query patterns
4. **Frontend integration** - How frontend should interact with data

---

## 🗂️ Table of Contents

1. [Core Multi-Tenant Architecture](#1-core-multi-tenant-architecture)
2. [User & Authentication Tables](#2-user--authentication-tables)
3. [Business & Onboarding Tables](#3-business--onboarding-tables)
4. [Service & Catalog Tables](#4-service--catalog-tables)
5. [Team & Staff Tables](#5-team--staff-tables)
6. [Booking Flow Tables](#6-booking-flow-tables)
7. [Financial & Payment Tables](#7-financial--payment-tables)
8. [Notification & Communication Tables](#8-notification--communication-tables)
9. [Promotions & Marketing Tables](#9-promotions--marketing-tables)
10. [Analytics & Reporting Tables](#10-analytics--reporting-tables)
11. [System & Configuration Tables](#11-system--configuration-tables)
12. [Data Flow Patterns](#12-data-flow-patterns)
13. [Frontend Integration Guide](#13-frontend-integration-guide)

---

## 1. Core Multi-Tenant Architecture

### Tenant Isolation Model

**Key Principle**: Every business is a separate "tenant" with complete data isolation.

```
Platform → Tenants → Users → Businesses
                      ↓
                Memberships (roles)
```

### `tenants` (Global Table)
**Primary business/organization record**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | Tenant identification |
| `slug` | String | URL-friendly identifier | subdomain.tithi.com routing |
| `name` | String | Business name | Display on booking site |
| `email` | String | Business email | Contact information |
| `phone` | String | Business phone | Contact display |
| `legal_name` | String | Legal business name (DBA) | Onboarding Step 1 |
| `category` | String | Business category/industry | Categorization |
| `subdomain` | String | Custom subdomain | subdomain.tithi.com |
| `business_timezone` | String | Timezone | Availability calculations |
| `address_json` | JSON | Full address | Display on booking site |
| `social_links_json` | JSON | Social media links | Profile display |
| `branding_json` | JSON | Brand colors, fonts | Theming booking site |
| `policies_json` | JSON | Cancellation, no-show policies | Checkout display |
| `logo_url` | String | Logo URL | Branding display |
| `status` | String | onboarding/ready/active | UI state management |
| `tz` | String | Timezone | Availability calculations |
| `deleted_at` | DateTime | Soft delete | Archive management |

**Frontend Queries**:
```typescript
// Get tenant by subdomain (public booking site)
GET /api/tenants/by-slug/{subdomain}

// Get tenant details (admin)
GET /api/tenants/me

// Update tenant (admin)
PUT /api/tenants/me
{
  name, email, phone, logo_url, branding_json, etc.
}
```

**Relationships**:
- One-to-many: customers, services, bookings, payments, team_members
- One-to-one: onboarding_progress, business_branding, business_policies

---

### `users` (Global Table)
**Owner/admin user accounts**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | User identification |
| `email` | String | Login email | Authentication |
| `password_hash` | String | Encrypted password | Auth (backend only) |
| `display_name` | String | Display name | Profile display |
| `first_name` | String | First name | User profile |
| `last_name` | String | Last name | User profile |
| `phone` | String | Phone number | Contact info |
| `primary_email` | String | Primary email | Notifications |
| `avatar_url` | String | Profile picture | UI display |

**Frontend Queries**:
```typescript
// Login
POST /api/auth/login { email, password }

// Get current user
GET /api/users/me

// Update profile
PUT /api/users/me { display_name, phone, avatar_url }
```

**Relationships**:
- Many-to-many: tenants (via memberships)
- One-to-many: memberships, dashboard_widgets

**Important**: Users can belong to multiple businesses (tenants). The current active tenant is determined by the JWT token.

---

### `memberships` (Tenant-Scoped Table)
**User-tenant relationships with roles**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | Membership identification |
| `tenant_id` | UUID FK | Business reference | Tenant isolation |
| `user_id` | UUID FK | User reference | User assignment |
| `role` | Enum | owner/admin/staff/viewer | Permission control |

**Frontend Use**: Determine what UI elements to show based on role.

**Relationships**:
- Many-to-one: tenant, user

---

## 2. Onboarding & Business Setup Tables

### `onboarding_progress` (Tenant-Scoped)
**Tracks 8-step onboarding completion**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `current_step` | Enum | Current step | Show correct UI step |
| `completed_steps` | JSON Array | Completed steps | Progress bar |
| `step_data` | JSON | Data from all steps | Prefill forms |
| `started_at` | DateTime | Start time | - |
| `completed_at` | DateTime | Completion | - |

**Frontend Flow**:
```typescript
// Get onboarding progress
GET /api/onboarding/progress
// Returns: { current_step, completed_steps, step_data }

// Save step data
POST /api/onboarding/steps/{step}
// Body: { business_name, description, etc. }

// Mark step complete
POST /api/onboarding/steps/{step}/complete

// Go live (final step)
POST /api/onboarding/go-live
```

**Supported Steps**:
1. `business_info` - Name, description, DBA, category
2. `booking_website` - Subdomain selection
3. `location_contacts` - Address, phone, timezone
4. `team_setup` - Add team members
5. `services_categories` - Create service catalog
6. `availability` - Set staff availability
7. `notifications` - Email/SMS templates
8. `policies` - Cancellation, no-show policies
9. `gift_cards` - Gift card templates (optional)
10. `payment_setup` - Stripe Connect setup
11. `go_live` - Generate booking URL

---

### `business_branding` (Tenant-Scoped)
**Visual branding for booking site**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `primary_color` | String | Hex color | Theme booking site |
| `secondary_color` | String | Hex color | Accent colors |
| `logo_url` | String | Logo | Header display |
| `font_family` | String | Font | Typography |
| `layout_style` | Enum | modern/classic/minimal | UI theme |
| `button_style` | Enum | rounded/square/pill | Component style |

**Frontend Application**:
```css
/* Apply branding dynamically */
:root {
  --primary-color: ${branding.primary_color};
  --secondary-color: ${branding.secondary_color};
}
```

---

### `business_policies` (Tenant-Scoped)
**Booking policies displayed to customers**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `cancellation_policy` | Text | Cancellation terms | Checkout modal |
| `no_show_policy` | Text | No-show terms | Checkout modal |
| `no_show_fee_percent` | Decimal | No-show fee % | Fee calculation |
| `no_show_fee_flat_cents` | Integer | No-show flat fee | Fee calculation |
| `refund_policy` | Text | Refund terms | Checkout modal |
| `cash_payment_policy` | Text | Cash terms | Checkout modal |
| `cancellation_hours_required` | Integer | Hours before cancel | Policy logic |

**Frontend Display**:
- Show as scrollable modal in checkout
- Require checkbox consent
- Store policy hash with booking
- Display again in booking confirmation

---

## 3. Service & Catalog Tables

### `service_categories` (Tenant-Scoped)
**Organizes services into groups**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `name` | String | Category name | Booking flow display |
| `description` | Text | Category description | Category page |
| `color` | String | Hex color | Visual grouping |
| `sort_order` | Integer | Display order | Category list |
| `is_active` | Boolean | Active status | Hide inactive |
| `deleted_at` | DateTime | Soft delete | Archive |

**Frontend Display**: Grid of categories → Click → Show services

---

### `services` (Tenant-Scoped)
**Individual services offered**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `category_id` | UUID FK | Category | Grouping |
| `slug` | String | URL-friendly name | Public URLs |
| `name` | String | Service name | Display |
| `description` | Text | Full description | Details page |
| `short_description` | Text | Brief | Card display |
| `duration_min` | Integer | Minutes | Time selection |
| `price_cents` | Integer | Price | Price display |
| `instructions` | Text | Pre-appointment | Confirmation |
| `image_url` | String | Service image | Gallery |
| `is_featured` | Boolean | Featured | Prominent display |
| `sort_order` | Integer | Display order | Listing order |
| `active` | Boolean | Active | Hide inactive |

**Frontend Queries**:
```typescript
// Get services by category (public)
GET /api/public/tenants/{slug}/services?category_id={id}

// Get single service
GET /api/public/tenants/{slug}/services/{service_id}

// Admin: Create/Update service
POST /api/services
PUT /api/services/{id}
```

**Relationships**:
- Many-to-one: category, tenant
- One-to-many: team_assignments, bookings

---

## 4. Team & Staff Tables

### `team_members` (Tenant-Scoped)
**Staff members (NOT login users)**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `user_id` | UUID FK (optional) | Linked user | Optional user link |
| `name` | String | Full name | Display |
| `email` | String | Email | Contact |
| `phone` | String | Phone | Contact |
| `role` | String | staff/admin | Permissions |
| `bio` | Text | Bio | Profile page |
| `avatar_url` | String | Photo | Display |
| `specialties` | Array | Specialties | Filter display |
| `is_active` | Boolean | Active | Hide inactive |
| `deleted_at` | DateTime | Soft delete | Archive |

**Frontend Display**: Team selector in booking flow (optional)

---

### `team_member_availability` (Tenant-Scoped)
**Staff availability per service per day**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `team_member_id` | UUID FK | Staff | - |
| `service_id` | UUID FK | Service | - |
| `day_of_week` | Integer | 1=Mon, 7=Sun | Calendar |
| `start_time` | String | HH:MM format | Slot generation |
| `end_time` | String | HH:MM format | Slot generation |
| `is_available` | Boolean | Available | Filter display |
| `max_bookings` | Integer | Capacity | Overlap prevention |

**Frontend Integration**: Availability engine generates slots from this data

---

## 5. Booking Flow Tables

### `booking_sessions` (Tenant-Scoped)
**Tracks customer booking flow progress**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `session_id` | String | Session ID | State management |
| `tenant_id` | UUID FK | Business | - |
| `current_step` | Enum | Current step | Show correct UI |
| `customer_email` | String | Email | Contact |
| `customer_first_name` | String | Name | Personalization |
| `selected_service_id` | UUID | Service | Display |
| `selected_team_member_id` | UUID | Staff | Display |
| `selected_start_time` | DateTime | Start time | Display |
| `flow_data` | JSON | All data | Prefill forms |
| `started_at` | DateTime | Start | Analytics |
| `is_completed` | Boolean | Complete | State |

**Frontend Flow**:
1. Create session → Select service → Select time → Enter info → Payment → Confirm

---

### `availability_slots` (Tenant-Scoped)
**Generated available time slots**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `service_id` | UUID FK | Service | - |
| `team_member_id` | UUID FK | Staff | - |
| `date` | DateTime | Date | Calendar |
| `start_time` | DateTime | Start | Selection |
| `end_time` | DateTime | End | Selection |
| `is_available` | Boolean | Available | Display |
| `is_booked` | Boolean | Booked | Hide booked |
| `max_bookings` | Integer | Capacity | Group bookings |

**Frontend Query**:
```typescript
// Get available slots
GET /api/availability/slots?service_id={id}&date={date}&team_member_id={id}

// Response:
{
  slots: [
    { id, start_time, end_time, team_member_id, team_member_color }
  ]
}
```

---

### `customers` (Tenant-Scoped)
**Customer records created during booking**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `display_name` | String | Name | Display |
| `email` | String | Email | Notifications |
| `phone` | String | Phone | SMS |
| `marketing_opt_in` | Boolean | Consent | Marketing |
| `notification_preferences` | JSON | Preferences | Notifications |
| `is_first_time` | Boolean | First booking | Special flow |
| `deleted_at` | DateTime | Soft delete | GDPR |

**Frontend Creation**: Automatically when booking is placed

---

### `bookings` (Tenant-Scoped)
**The main booking record**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `customer_id` | UUID FK | Customer | Display customer |
| `resource_id` | UUID FK | Resource | Display staff |
| `start_at` | DateTime | Start | Calendar |
| `end_at` | DateTime | End | Calendar |
| `status` | Enum | Booking status | State management |
| `no_show_flag` | Boolean | No-show | Fee charge |
| `service_snapshot` | JSON | Service at booking | Historical |
| `attendee_count` | Integer | Group size | - |
| `rescheduled_from` | UUID | Reschedule | History |

**Booking Status Flow**:
```
pending → authorized → completed → captured
         ↓
       no_show → charged_no_show
         ↓
       canceled (with/without fee)
         ↓
       refunded
```

**Frontend Display** (Admin Past Bookings):
```typescript
// Get all bookings
GET /api/bookings?status=completed&from={date}&to={date}

// Display each booking with:
- Customer name, email, phone
- Service, staff, time, price
- Status chip (Pending, Charged, No-Show, Refunded)
- Action buttons (Completed, No-Show, Cancelled, Refund)
```

**Action Buttons Behavior**:
- **Completed**: Charge full amount now from saved card
- **No-Show**: Charge no-show fee from saved card (or $0)
- **Cancelled**: Charge cancellation fee (or $0)
- **Refund**: Refund prior charge (or disabled if no charge)

---

## 6. Financial & Payment Tables

### `tenant_billing` (Tenant-Scoped)
**Stripe Connect & subscription**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `stripe_connect_id` | String | Stripe account | Payment routing |
| `stripe_customer_id` | String | Platform customer | Subscription |
| `subscription_status` | String | active/paused/canceled | UI state |
| `subscription_id` | String | Stripe subscription | Status tracking |
| `subscription_price_cents` | Integer | $11.99/month | Display |
| `next_billing_date` | DateTime | Next charge | Display |

**Subscription States**:
- `trial` - 7 days free
- `active` - Charging $11.99/month
- `paused` - Not charging, site up
- `canceled` - No charge, subdomain removed

**Frontend Display** (Account tab):
```typescript
// Show current state, next bill date
// Buttons: Activate, Pause, Cancel, Start Trial
```

---

### `payments` (Tenant-Scoped)
**Payment transactions**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `tenant_id` | UUID FK | Business | - |
| `booking_id` | UUID FK | Booking | Link booking |
| `customer_id` | UUID FK | Customer | Link customer |
| `status` | Enum | Payment status | State display |
| `method` | Enum | card/cash/apple_pay | Display |
| `amount_cents` | Integer | Amount | Display |
| `tip_cents` | Integer | Tip | Display |
| `application_fee_cents` | Integer | Platform fee (1%) | Breakdown |
| `no_show_fee_cents` | Integer | No-show fee | Display |
| `provider_payment_id` | String | Stripe PaymentIntent | Link to Stripe |
| `provider_setup_intent_id` | String | Saved card | Charge later |

**Payment Status**:
- `requires_action` - Customer action needed (SCA)
- `authorized` - Card authorized, not charged yet
- `captured` - Payment collected
- `refunded` - Refunded
- `failed` - Payment failed

**Frontend Display** (Payment breakdown):
```typescript
Gross: $120.00
- Platform fee (1%): $1.20
- Stripe fee: $3.60
= Net to business: $115.20
```

---

### `payment_methods` (Tenant-Scoped)
**Saved customer payment methods**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `customer_id` | UUID FK | Customer | - |
| `stripe_payment_method_id` | String | Stripe reference | Charge later |
| `type` | String | card | Display |
| `last4` | String | Last 4 digits | Display |
| `brand` | String | visa/mastercard | Icon |
| `is_default` | Boolean | Default | Selection |

**Frontend Use**: Show saved cards in checkout (optional)

---

### `refunds` (Tenant-Scoped)
**Refund transactions**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `payment_id` | UUID FK | Original payment | - |
| `booking_id` | UUID FK | Booking | - |
| `amount_cents` | Integer | Refund amount | Display |
| `reason` | Text | Reason | Admin notes |
| `status` | String | succeeded/failed | State |
| `provider_refund_id` | String | Stripe refund | Link |

---

## 7. Gift Cards & Promotions Tables

### `gift_cards` (Tenant-Scoped)
**Digital gift cards**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `code` | String | Unique code | Customer entry |
| `amount_cents` | Integer | Total value | Display |
| `balance_cents` | Integer | Remaining | Calculation |
| `expiry_date` | Date | Expiration | Validation |
| `is_active` | Boolean | Active | Validation |

**Frontend Integration** (Checkout):
```typescript
// Validate code
POST /api/public/tenants/{slug}/gift-cards/validate
{ code }

// Response: { is_valid, discount_amount_cents, final_price }

// Apply discount to total
Final Price = Service Price - Gift Card Balance
```

---

### `coupons` (Tenant-Scoped)
**Percentage or fixed discounts**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `code` | String | Coupon code | Customer entry |
| `discount_type` | Enum | percentage/fixed_amount | Calculation |
| `discount_value` | Decimal | % or cents | Calculation |
| `min_amount_cents` | Integer | Minimum | Validation |
| `usage_limit` | Integer | Max uses | Validation |
| `used_count` | Integer | Current uses | Validation |
| `expiry_date` | Date | Expiration | Validation |

---

## 8. Notification Tables

### `notification_templates_enhanced` (Tenant-Scoped)
**Email/SMS template system**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `name` | String | Template name | Display |
| `trigger_event` | Enum | booking_created, etc | Automation |
| `category` | Enum | confirmation/reminder | Grouping |
| `subject_template` | String | Email subject | Template editor |
| `content_template` | Text | Message body | Template editor |
| `content_type` | String | text/plain/html | Format |
| `available_placeholders` | JSON | Placeholder list | UI selector |

**Available Placeholders**:
- `${customer.name}` - Customer full name
- `${service.name}` - Service name
- `${service.duration}` - Duration in minutes
- `${service.price}` - Price
- `${booking.date}` - Booking date
- `${booking.time}` - Booking time
- `${business.name}` - Business name

**Frontend Editor**:
```typescript
// Template editor with:
- Placeholder insertion buttons
- Live preview with sample data
- Validation for unknown placeholders
```

---

### `notification_queue_enhanced` (Tenant-Scoped)
**Outbound notification queue**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `id` | UUID | Primary key | - |
| `template_id` | UUID FK | Template | - |
| `recipient_email` | String | Email | Delivery |
| `recipient_phone` | String | Phone | SMS |
| `subject` | String | Processed subject | - |
| `content` | Text | Processed content | - |
| `status` | String | sent/failed/pending | Admin display |
| `sent_at` | DateTime | Sent time | Logs |

---

## 9. Analytics Tables

### `booking_flow_analytics` (Tenant-Scoped)
**Booking flow conversion data**

| Column | Type | Purpose | Frontend Use |
|--------|------|---------|--------------|
| `date` | DateTime | Report date | Reports |
| `period_type` | String | daily/weekly/monthly | Grouping |
| `sessions_started` | Integer | Total sessions | Conversion |
| `sessions_completed` | Integer | Completed | Conversion |
| `conversion_rate` | Decimal | % converted | Dashboard |
| `most_popular_service_id` | UUID | Top service | Insights |

---

## 10. Data Flow Patterns

### Onboarding Flow
```
1. User creates account → `users` table
2. Creates business → `tenants` table
3. Owner membership → `memberships` table
4. Proceeds through 8 steps:
   - Business info → `tenants` fields
   - Subdomain → `tenants.subdomain`
   - Team → `team_members` + `team_member_availability`
   - Services → `service_categories` + `services`
   - Availability → `team_member_availability`
   - Notifications → `notification_templates_enhanced`
   - Policies → `business_policies`
   - Gift cards → `gift_card_templates`
   - Payment → `tenant_billing` (Stripe Connect)
5. Go Live → `tenants.status = 'active'`
```

### Booking Flow
```
1. Customer visits: {subdomain}.tithi.com
2. Selects category → Fetches `services` by `category_id`
3. Selects service → Fetches `availability_slots` for that service
4. Selects time → Creates `booking_session`
5. Enters info → Updates `booking_session.customer_*`
6. Payment → Creates `payment` with SetupIntent (save card only)
7. Confirmation → Creates `booking` (status=pending), creates `customer`
8. Notification sent → `notification_queue_enhanced`
```

### Payment Capture Flow
```
1. Admin marks booking "Completed"
   POST /api/admin/bookings/{id}/complete
2. Backend:
   - Creates PaymentIntent from saved SetupIntent
   - Charges full amount
   - Updates `payment.status = 'captured'`
   - Updates `booking.status = 'completed'`
3. Updates UI to show "Charged" status
```

### Refund Flow
```
1. Admin clicks "Refund"
   POST /api/admin/bookings/{id}/refund
2. Backend:
   - Creates `refund` record
   - Calls Stripe refund API
   - Updates `payment.status = 'refunded'`
   - Updates `booking.status = 'refunded'`
```

---

## 11. Frontend Integration Guide

### Tenant Resolution

**Public Booking Site** (subdomain.tithi.com):
```typescript
// Route: /b/{slug} or {subdomain}.tithi.com
const tenant = await fetch(`/api/public/tenants/${slug}/info`)
// Returns all tenant data needed for booking site
```

**Admin Site** (tithi.com/app):
```typescript
// JWT contains tenant_id
const bookings = await fetch(`/api/bookings`, {
  headers: { 'X-Tenant-ID': currentTenantId }
})
```

### Data Fetching Patterns

```typescript
// 1. Get all services for booking flow
const services = await fetch(`/api/public/tenants/${slug}/services`)
// Returns: { categories: [{ id, name, services: [...] }] }

// 2. Get availability for service
const slots = await fetch(
  `/api/availability/slots?service_id=${serviceId}&date=${date}`
)
// Returns: { slots: [{ id, start_time, team_member_id, color }] }

// 3. Create booking
const booking = await fetch('/api/public/bookings', {
  method: 'POST',
  body: {
    service_id, team_member_id, start_time,
    customer: { name, email, phone },
    payment_method_id // from Stripe Elements
  }
})
// Returns: { booking_id, booking_code, confirmation_url }

// 4. Admin: Get all bookings
const bookings = await fetch('/api/bookings?status=completed&from=2024-01-01')
// Returns: [{ id, customer, service, start_at, price, status, ... }]

// 5. Admin: Capture payment
await fetch(`/api/admin/bookings/${bookingId}/complete`, {
  method: 'POST',
  headers: { 'X-Idempotency-Key': generateIdempotencyKey() }
})
```

### State Management

```typescript
// Booking flow state
interface BookingFlowState {
  session_id: string
  current_step: 'service' | 'time' | 'info' | 'payment' | 'confirm'
  selected_service: Service | null
  selected_slot: Slot | null
  customer_info: { name, email, phone }
  payment_intent: PaymentIntent | null
}

// Admin booking management
interface BookingListItem {
  id: string
  customer: { name, email, phone }
  service: { name, price_cents }
  start_at: string
  status: 'pending' | 'charged' | 'no_show' | 'refunded'
  can_complete: boolean
  can_no_show: boolean
  can_refund: boolean
}
```

### UI Component Mapping

| Component | Data Source | Key Fields |
|-----------|-------------|------------|
| **Landing Page** | None | Join/Login buttons |
| **Dashboard** | `tenants` via memberships | List user's businesses |
| **Onboarding Wizard** | `onboarding_progress`, various tables | 8-step form flow |
| **Booking Site** (public) | `tenants`, `services`, `availability_slots` | Browse, select, book |
| **Service Catalog** | `service_categories`, `services` | Categories grid |
| **Time Selector** | `availability_slots` | Color-coded by staff |
| **Checkout** | `business_policies`, `payment_methods` | Policies modal, card entry |
| **Confirmation** | `bookings`, `services` | Booking details |
| **Admin Past Bookings** | `bookings`, `customers`, `payments` | Booking list + actions |
| **Booking Detail** | `bookings`, `payments`, `refunds` | Full history + actions |
| **Payment Breakdown** | `payments` | Gross, fees, net |

### Error Handling

```typescript
// Handle payment failures
if (payment.status === 'requires_action') {
  // Show "Send Pay Link" button
  showPayLinkModal(bookingId)
}

// Handle no refund available
if (booking.payment_status !== 'captured') {
  disableRefundButton()
  showTooltip("No payment to refund")
}

// Handle double-click protection
let isProcessing = false
async function handleComplete() {
  if (isProcessing) return
  isProcessing = true
  disableButton()
  try {
    await capturePayment(bookingId)
    updateStatusChip('Charged')
  } finally {
    isProcessing = false
  }
}
```

---

## 12. Critical Frontend Considerations

### Payment Security
- **Never charge at checkout** - Only save card with SetupIntent
- **All charges from admin buttons** - Completed, No-Show, Cancelled
- **Idempotency keys** - Prevent double charges on all payment actions
- **Clear messaging** - "Card saved securely, not charged yet"

### Multi-Tenancy
- **Tenant isolation** - Every API call scoped to tenant
- **Subdomain routing** - {subdomain}.tithi.com for public sites
- **JWT tenant context** - Backend enforces isolation

### Availability Generation
- **Backend generates slots** - Frontend just renders
- **Staff color coding** - Use team_member colors from availability
- **Time calculations** - Use business timezone, not user's

### Notifications
- **Templates in onboarding** - Admin creates in Step 8
- **Placeholder substitution** - Backend handles at send time
- **Frontend preview** - Show template with sample data

### Gift Cards
- **Validate before checkout** - Show updated price immediately
- **Balance deduction** - Only on actual charge, not on pending
- **Percentage vs fixed** - Different calculation logic

---

## 13. Quick Reference

### Common Queries

| Use Case | Endpoint | Method | Returns |
|----------|----------|--------|---------|
| Get public tenant info | `/api/public/tenants/{slug}/info` | GET | Tenant details |
| Get services | `/api/public/tenants/{slug}/services` | GET | Service catalog |
| Get availability | `/api/availability/slots` | GET | Available slots |
| Create booking | `/api/public/bookings` | POST | Booking + PaymentIntent |
| Get bookings (admin) | `/api/bookings` | GET | Booking list |
| Capture payment | `/api/admin/bookings/{id}/complete` | POST | Updated booking |
| Refund payment | `/api/admin/bookings/{id}/refund` | POST | Refund record |
| Validate gift card | `/api/public/gift-cards/validate` | POST | Discount amount |

### Key Relationships

```
Tenant (1) → (N) Services
Tenant (1) → (N) Team Members
Tenant (1) → (N) Customers
Tenant (1) → (N) Bookings
Tenant (1) → (1) Business Policies
Tenant (1) → (1) Business Branding
Tenant (1) → (1) Onboarding Progress

Service (1) → (N) Bookings
Service (1) → (N) Team Assignments
Category (1) → (N) Services

Team Member (1) → (N) Availability Rules
Team Member (1) → (N) Bookings

Booking (1) → (1) Customer
Booking (1) → (1) Service
Booking (1) → (1) Team Member
Booking (1) → (N) Payments

Payment (1) → (N) Refunds
Payment (1) → (1) Booking
Payment (1) → (1) Customer
```

---

## 14. Frontend Build Checklist

- [ ] User authentication (login, signup, JWT)
- [ ] Multi-tenant dashboard (list user's businesses)
- [ ] Onboarding wizard (8 steps with progress tracking)
- [ ] Public booking site (subdomain routing)
- [ ] Service catalog (categories + services grid)
- [ ] Availability calendar (staff color coding, slot selection)
- [ ] Checkout flow (policies modal, card entry, gift card)
- [ ] Booking confirmation page
- [ ] Admin booking list (past bookings with filters)
- [ ] Payment action buttons (Completed, No-Show, Cancelled, Refund)
- [ ] Payment breakdown display (fees, net)
- [ ] Notification template editor (with placeholders)
- [ ] Gift card validation and discount application
- [ ] Team member management
- [ ] Service CRUD (create, update, delete)
- [ ] Policy management
- [ ] Branding customization (colors, logo, fonts)
- [ ] Analytics dashboard (conversion rates, revenue)
- [ ] Subscription management (trial, active, paused, canceled)

---

**End of Database Map**

*This document is the complete reference for building the Tithi frontend. Every database table, relationship, and data flow pattern is documented here for AI executors and developers.*

