# Tithi Frontend Design Brief

**Purpose**: Comprehensive design specification for building the Tithi frontend based on backend capabilities and user requirements.

**Confidence Score**: 95% - Complete analysis of backend architecture, API endpoints, and user journey requirements.

---

## Executive Summary

Tithi is a multi-tenant white-label booking platform that enables independent professionals and small businesses to create branded booking pages with automated attendance-based payments. The frontend must support two distinct user types: Business Owners (Admins) and Customers, with clear separation of concerns and streamlined user journeys.

### Key Design Principles
- **Simplicity First**: Minimal clicks for core actions
- **Brand Identity**: White-label customization with logo and color
- **Attendance-Based Payments**: No pre-charging, payment only after attendance marking
- **Time Zone Transparency**: Always display business time zone
- **Notification Control**: Business-owned notification management with 3-notification limit

---

## Target Users & User Journeys

### 1. Business Owners (Admins)

#### Profile
- Independent professionals & small businesses
- Subscription: $11.99/month per business
- Needs: Fast setup, branded pages, automated payments, simple analytics

#### User Journey A: Onboarding (< 10 minutes)
```
1. Business Details → 2. Logo & Colors → 3. Services & Pricing → 4. Default Availability → 5. Notifications → 6. Booking Policies → 7. Gift Cards (Optional) → 8. Payment Setup
```

**Backend Integration**:
- `POST /onboarding/register` - Create tenant with subdomain
- `GET /onboarding/check-subdomain/{subdomain}` - Validate subdomain
- `POST /api/v1/tenants` - Complete tenant setup
- `POST /api/v1/services` - Create initial services
- `POST /api/v1/availability/rules` - Set default availability
- `POST /api/v1/notifications/templates` - Create notification templates
- `PUT /api/v1/tenants/{id}` - Update branding and policies
- `POST /api/payments/setup-intent` - Setup payment method for subscription

**UI Requirements**:
- **Step 1**: Business name, description, timezone selection
- **Step 2**: Logo upload with preview + primary color picker with live preview
- **Step 3**: Service creation form (name, duration, price, description) - multiple services
- **Step 4**: Default availability calendar (can be customized later)
- **Step 5**: Notification settings (timing, content, email templates) - max 3 per booking
- **Step 6**: Booking policies (cancellation fees, cancellation timeframes, other booking rules)
- **Step 7**: Gift cards setup (optional) - create initial gift cards if desired
- **Step 8**: Payment setup - enter credit card for $11.99/month subscription

#### User Journey B: Managing Bookings (< 3 clicks)
```
View Bookings → Select Booking → Mark Attendance Status
```

**Backend Integration**:
- `GET /api/v1/bookings` - List all bookings
- `PUT /api/v1/bookings/{id}` - Update booking status
- `POST /api/payments/process` - Process payment based on attendance

**UI Requirements**:
- **Booking List**: Clear status indicators (Pending, Confirmed, Completed, Cancelled)
- **Attendance Actions**: One-click buttons for ✅ Attended, ❌ No-show, ❎ Cancelled
- **Payment Status**: Clear indication of payment processing state
- **Customer Info**: Quick access to customer details

#### User Journey C: Gift Card Management
```
Generate Code → Enable/Disable → Delete Code
```

**Backend Integration**:
- `POST /api/v1/promotions/coupons` - Create gift card
- `PUT /api/v1/promotions/coupons/{id}` - Enable/disable gift card
- `DELETE /api/v1/promotions/coupons/{id}` - Delete gift card

**UI Requirements**:
- **Code Generation**: Automatic code generation with copy functionality
- **Status Toggle**: Simple enable/disable switch
- **Usage Tracking**: Display redemption count and remaining value

#### User Journey D: Analytics Dashboard
```
Revenue Tracking → No-show Rate → Top Customers → Booking Volume
```

**Backend Integration**:
- `GET /api/v1/analytics/revenue` - Revenue metrics
- `GET /api/v1/analytics/bookings` - Booking analytics
- `GET /api/v1/analytics/customers` - Customer analytics

**UI Requirements**:
- **Revenue Chart**: Time-based revenue visualization
- **Key Metrics**: No-show rate, booking volume, top customers
- **Export Options**: Data export capabilities

### 2. Tithi Users (General Dashboard Users)

#### Profile
- Anyone with a Tithi account (business owners, customers, or both)
- Dashboard shows owned businesses + previous orders from any business
- Business ownership requires $11.99/month subscription per business
- Users can have multiple businesses under one account (each charged separately)

#### User Journey A: Dashboard Navigation
```
Login → Tithi User Dashboard → My Businesses (owned) + Previous Orders (scrollable feed)
```

**Backend Integration**:
- `GET /api/v1/tenants` - List user's businesses
- `GET /api/v1/bookings` - List past bookings with business info

**UI Requirements**:
- **Two-Section Layout**: Clear separation between owned businesses and past orders
- **Business Cards**: Quick access to business admin views
- **Order History**: Scrollable feed with business name + service booked (can be empty if user never booked)
- **Quick Actions**: Direct booking links for owned businesses
- **Subscription Status**: Clear indication of active subscriptions and billing

#### User Journey B: Booking Flow (< 5 clicks)
```
Select Service → Choose Slot → Apply Gift Card → Confirm Booking
```

**Backend Integration**:
- `GET /v1/{slug}/services` - Public service catalog
- `GET /api/v1/availability` - Check available slots
- `POST /api/v1/bookings` - Create booking
- `POST /api/v1/promotions/validate` - Validate gift card

**UI Requirements**:
- **Service Selection**: Clear service cards with pricing and duration
- **Time Zone Display**: Prominent business time zone indicator
- **Availability Calendar**: Real-time slot availability
- **Gift Card Input**: Code entry with validation
- **Booking Confirmation**: Clear confirmation with next steps

#### User Journey C: Payment Processing
```
Attendance Marked → Payment Charged → Confirmation Received
```

**Backend Integration**:
- Webhook processing for payment status updates
- `GET /api/v1/payments/{id}` - Payment status check

**UI Requirements**:
- **Payment Status**: Clear indication of payment processing
- **Receipt Display**: Payment confirmation with details
- **No-show Policy**: Clear display of cancellation fee policy

---

## Technical Architecture

### Frontend Technology Stack
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for global state
- **API Client**: Axios with interceptors
- **Authentication**: Supabase Auth integration
- **Payment**: Stripe Elements integration
- **Testing**: Jest + React Testing Library + Playwright

### Backend Integration Points

#### Authentication Flow
```typescript
// JWT Token Management
interface UserContext {
  user_id: string;
  tenant_id: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'customer';
}

// API Client Configuration
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  }
});
```

#### Multi-Tenant Routing
```typescript
// Tenant Context Resolution
const getTenantContext = () => {
  const pathMatch = window.location.pathname.match(/\/v1\/b\/([^\/]+)/);
  if (pathMatch) return pathMatch[1];
  
  const subdomain = window.location.hostname.split('.')[0];
  return subdomain !== 'www' ? subdomain : null;
};
```

#### Payment Integration
```typescript
// Stripe Payment Intent Creation
interface PaymentIntentRequest {
  booking_id: string;
  amount_cents: number;
  currency_code: string;
  customer_id?: string;
  idempotency_key: string;
}

const createPaymentIntent = async (request: PaymentIntentRequest) => {
  const response = await apiClient.post('/api/payments/intent', request, {
    headers: {
      'Idempotency-Key': generateIdempotencyKey()
    }
  });
  return response.data;
};
```

#### Backend Architecture Overview
The Tithi backend is a **production-ready multi-tenant Flask application** with comprehensive features:

**Current Status**: 100% Production Ready
- **Phase 1**: Foundation Setup & Execution Discipline ✅ Complete
- **Phase 2**: Core Booking System ✅ Complete  
- **Phase 3**: Payments & Business Logic ✅ Complete
- **Phase 4**: Service Catalog ✅ Complete
- **Phase 5**: Production Readiness ✅ Complete
- **Phase 9**: Analytics & Reporting ✅ Complete
- **Phase 10**: Admin Dashboard & Operations ✅ Complete
- **Phase 11**: Cross-Cutting Utilities ✅ Complete

**Key Backend Features**:
- **Multi-tenant Architecture**: Complete tenant isolation with RLS policies
- **Authentication & Authorization**: JWT-based auth with Supabase integration
- **Payment Processing**: Stripe integration with webhook support
- **Notification System**: Multi-channel (SMS, Email, Push) with template system
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Event Processing**: Outbox pattern with Celery workers
- **Audit Logging**: Comprehensive audit trails
- **Rate Limiting**: Per-tenant and per-user request caps (100 req/min default)
- **Error Monitoring**: Sentry integration with Slack alerts
- **Performance**: Sub-150ms calendar queries, >80% cache hit rates
- **Admin Dashboard**: Complete admin operations with bulk actions
- **Branding Management**: Logo upload, color management, subdomain validation
- **Staff Management**: Complete staff CRUD with work schedules
- **Service Management**: Service catalog with pricing and duration
- **Loyalty System**: Points-based loyalty program with tier calculation
- **Automation System**: Cron-based automation with event triggers
- **Analytics**: Materialized views for performance-optimized reporting
- **Quota Management**: Usage tracking and quota enforcement
- **Idempotency**: Request deduplication for critical operations
- **Webhook Processing**: Idempotent webhook handling with signature validation

---

## UI/UX Design Specifications

### Design System

#### Color Palette
- **Primary**: Business-defined color (user-selected during onboarding)
- **Secondary**: Complementary colors derived from primary
- **Neutral**: Gray scale for text and backgrounds
- **Status Colors**:
  - Success: Green (#10B981)
  - Warning: Yellow (#F59E0B)
  - Error: Red (#EF4444)
  - Info: Blue (#3B82F6)

#### Typography
- **Headings**: Inter font family, 600-700 weight
- **Body**: Inter font family, 400-500 weight
- **Monospace**: JetBrains Mono for code/data

#### Component Library
- **Buttons**: Primary, secondary, ghost variants
- **Forms**: Input fields with validation states
- **Cards**: Service cards, booking cards, business cards
- **Modals**: Confirmation dialogs, forms
- **Navigation**: Sidebar, top bar, breadcrumbs
- **Status Indicators**: Booking status, payment status, attendance status

### Screen Specifications

#### Landing, Auth and Routing
• Landing CTA: "Get Started" navigates to Sign Up.
• Sign Up form fields: email, password, phone number, first name, last name. On success → redirect to Onboarding Step 1.
• Booking flow is only accessible via generated URL: https://tithi/{businessslug} (not linked from homepage).

#### 1. Onboarding Wizard
**Purpose**: Complete business setup in < 10 minutes

**Screens**:
1. **Business Information**
   - Business name; Doing Business As (optional); description
   - Timezone dropdown (searchable)
   - Business type and industry/category (dropdown with examples: Salon/Barbershop, Spa, Medical Clinic, Fitness Studio, Tutoring, Pet Grooming, Photography, Cleaning, Consulting, Other)
   - Business address: street, city, state/province, postal code, country
   - Website/public profile URL; customer-facing phone; support email
   - Staff list (repeatable rows): role/job, name; color is auto-assigned and can be edited in Step 4
   - Social links: Instagram, Facebook, TikTok, YouTube, X, Website (shown on booking Welcome + Confirmation pages)
   - Buttons: Save & Continue, Back, Add Staff, Remove Staff

2. **Logo & Brand Colors**
   - Drag & drop logo upload from local device (Downloads or any folder)
   - Standardized logo rectangle close to square (recommended 640×560); responsive thumbnails auto-generated
   - Image preview with crop; validation (PNG, JPG, SVG)
   - Primary color picker + live preview; contrast checks
   - Placement rules: very large logo on booking Welcome page header; small logo top-left on every booking page
   - Buttons: Upload Logo, Crop, Remove, Pick Color, Preview, Save & Continue, Back

3. **Services, Categories, Images & Defaults**
   - Categories CRUD; each service belongs to a category
   - Service creation: name, description, duration, default price, category, image upload (standardized near-square card)
   - Quick chips under description (e.g., Wheelchair ramp, Parking directions) – owner configurable
   - Special requests/notes field settings: show/hide, length limit, suggested quick chips; appears on booking checkout
   - Pre-appointment instructions per service (e.g., Arrive 10 min early, No caffeine 4h prior) – displayed on service cards, confirmation page, emails/SMS, and .ics
   - Booking flow UI: horizontally scrollable rows per category; infinite services supported; cards are responsive rectangles close to square
   - Buttons: Add Category, Add Service, Upload Image, Save Defaults, Save & Continue, Back

4. **Availability & Staff Colors**
   - Weekly visual calendar with block-based entry (drag to create blocks)
   - Staff color-coding (from Step 1 staff list); names + roles visible on blocks
   - Modes: Day/Week/Month; copy week; recurring; breaks; DST-safe
   - Buttons: Add Block, Recurring, Add Break, Copy Week, Save & Continue, Back

5. **Notifications (max 3 per booking)**
   - Slots: 1 Confirmation (immediate) + up to 2 Reminders with custom timing
   - Content editor with placeholders: {customer_name}, {service_name}, {service_duration}, {price}, {booking_date}, {booking_time}, {business_name}, {address}, {staff_name}, {instructions}, {special_requests}, {cancel_policy}, {refund_policy}, {booking_link}, {ics_link}
   - Email/SMS formatting presets; previews; quiet hours; opt-in compliance
   - Social links optionally appended to confirmation
   - Buttons: Add Reminder, Set Timing, Preview Email/SMS, Save Template, Save & Continue, Back

6. **Booking Policies & Confirmation Message**
   - Cancellation cutoff (e.g., 24h), no-show fee (percent/flat), refund presets (window + fee), pay-by-cash logistics copy
   - Confirmation message editor (same placeholders as Step 5) – can paste instructions, service description, price/duration, selected availability; persists for later reuse
   - Checkout warning popup configuration – shown on payment page; customer must acknowledge
   - Buttons: Save Policies, Preview Checkout Warning, Save & Continue, Back

7. **Gift Cards Setup (Optional)**
   - Create initial gift cards if desired
   - Gift card denominations
   - Skip option available
   - Continue button

8. **Payments, Wallets & Tithi Subscription**
   - Payment methods toggles: Cards, Apple Pay, Google Pay, PayPal, Cash (requires card-on-file for no-shows)
   - Business identity & KYC: legal name/DBA, representative info, payout destination, statement descriptor and phone, currency, tax display behavior
   - Policies at pay time: cancellation, no-show, refund – customer acknowledgment checkbox
   - Owner’s card for Tithi billing $11.99/month; explicit consent checkboxes
   - Final modal: “Are you sure you want to make this subscription?” + Yes checkbox + GO LIVE button
   - GO LIVE page: “{Business Name} IS LIVE!!” with confetti, booking link (https://tithi/{businessslug}), buttons: Copy Link, Go to admin view

**Backend Endpoints**:
- `POST /onboarding/register` - Create tenant with subdomain
- `GET /onboarding/check-subdomain/{subdomain}` - Validate subdomain
- `POST /api/v1/tenants` - Complete tenant setup
- `POST /api/v1/services` - Create initial services
- `POST /api/v1/availability/rules` - Set default availability
- `POST /api/v1/notifications/templates` - Create notification templates
- `PUT /api/v1/tenants/{id}` - Update branding and policies
- `POST /api/payments/setup-intent` - Setup payment method for subscription
- `POST /api/v1/promotions/coupons` - Create initial gift cards (optional)

#### 2. Business Owner Dashboard
**Purpose**: Central hub for business management

**Layout**:
- **Sidebar Navigation**: Dashboard, Bookings, Services, Customers, Analytics, Settings
- **Main Content Area**: Contextual content based on selection
- **Top Bar**: Business name, notifications, user menu

**Key Sections**:
- **Dashboard Overview**: Revenue metrics, upcoming bookings, quick actions
- **Bookings Management**: List view with attendance marking
- **Services Management**: CRUD operations for services
- **Customer Management**: Customer list and details
- **Analytics**: Revenue charts and key metrics
- **Settings**: Business info, branding, policies

Additional Admin Pages and Actions
- Bookings: view/confirm/cancel/reschedule/mark no-show; confirmation triggers payment; row reveals customer record (contact, history, preferences, notes)
- Availability: same visual scheduler as onboarding; color-coded per staff
- Services: full CRUD, categories, images, instructions, quick chips, price, duration, special requests settings
- Gift Cards: create/edit/enable/disable/delete, expiration, usage
- Notifications: templates, timing, placeholders, previews (enforce max 3)
- Branding: logo, colors, social links

**Backend Endpoints**:
- `GET /api/v1/tenants/{id}` - Get tenant details
- `GET /api/v1/bookings` - List all bookings
- `GET /api/v1/services` - List services
- `GET /api/v1/customers` - List customers
- `GET /api/v1/analytics/*` - Analytics endpoints
- `PUT /api/v1/bookings/{id}` - Update booking status
- `POST /api/payments/process` - Process payment based on attendance

#### 3. Booking Management Interface
**Purpose**: Efficient attendance marking and payment processing

**Components**:
- **Booking List**: Table view with status indicators
- **Attendance Actions**: One-click buttons for status changes
- **Payment Status**: Real-time payment processing indicators
- **Customer Details**: Quick access to customer information

**Attendance Marking Flow**:
```
Booking List → Select Booking → Mark Status → Payment Processing
```

**Status Indicators**:
- **Pending**: Yellow indicator, awaiting confirmation
- **Confirmed**: Blue indicator, ready for service
- **Attended**: Green indicator, payment processed
- **No-show**: Red indicator, cancellation fee charged
- **Cancelled**: Gray indicator, no charge

**Backend Endpoints**:
- `GET /api/v1/bookings` - List bookings
- `PUT /api/v1/bookings/{id}` - Update booking status
- `POST /api/payments/process` - Process payment based on attendance
- `POST /api/v1/bookings/{id}/confirm` - Confirm booking
- `POST /api/v1/bookings/{id}/cancel` - Cancel booking
- `POST /api/v1/bookings/{id}/complete` - Complete booking

#### 4. Tithi User Dashboard
**Purpose**: General dashboard for all Tithi users (business owners, customers, or both)

**Layout**:
- **Header**: Tithi branding, user menu, notifications
- **Main Content**: Two-section layout
  - **My Businesses Section**: Grid of owned business cards
  - **Previous Orders Section**: Scrollable list of past bookings
- **Sidebar**: Quick actions and navigation

**Key Sections**:
- **My Businesses**: 
  - Business cards with logo, name, and quick stats
  - "Create New Business" button
  - Subscription status indicators
  - Direct links to business admin views
- **Previous Orders**: 
  - Scrollable feed of past bookings
  - Business name, service, date, and status
  - Can be empty if user never booked from other businesses
- **Quick Actions**: 
  - Book from other businesses
  - Manage subscriptions
  - Account settings

**Business Cards**:
- Business logo and name
- Quick stats (upcoming bookings, revenue)
- Subscription status ($11.99/month indicator)
- Direct link to business admin view
- "Add Another Business" option

**Order History**:
- Business name and logo
- Service booked and date
- Status and amount paid
- Link to booking details
- Empty state if no previous orders

**Backend Endpoints**:
- `GET /api/v1/tenants` - List user's businesses
- `GET /api/v1/bookings` - List past bookings
- `GET /api/v1/subscriptions` - Subscription status
- `POST /api/v1/tenants` - Create new business
- `GET /api/v1/admin/dashboard` - Admin dashboard data

#### 5. Public Booking Page
**Purpose**: Customer-facing booking interface

**Layout**:
- **Header**: Business logo, name, and branding
- **Service Selection**: Service cards with pricing
- **Availability Calendar**: Time slot selection
- **Customer Information**: Contact details form
- **Payment Method**: Stripe Elements integration
- **Gift Card**: Code input and validation

**Key Features**:
- **Time Zone Display**: Prominent business time zone indicator
- **Real-time Availability**: Live slot updates
- **Gift Card Integration**: Code validation and discount application
- **Payment Processing**: Stripe Elements with 3D Secure support

User Flow Details
- Page 1 (Welcome): large logo header; services displayed as horizontal scroll rows per category; each card shows image, name, price, duration, description, quick chips, pre-appointment instructions; social links block. Selecting a service highlights it; top-right Confirm navigates to Availability.
- Page 2 (Availability): calendar with staff names and roles; slots click-to-select and highlight; top-right Confirm navigates to Checkout.
- Page 3 (Checkout): booking summary, customer info, special requests (if enabled), gift card input, payment methods. Before payment, show warning popup with cancellation cutoff, refund policy, no-show fee, and cash rules; user must accept to proceed.
- Page 4 (Confirmation): final message (from Step 6), instructions, .ics download, and social links.

**Backend Endpoints**:
- `GET /v1/{slug}` - Public tenant page
- `GET /v1/{slug}/services` - Public service catalog
- `GET /api/v1/availability` - Check available slots
- `POST /api/v1/bookings` - Create booking
- `POST /api/v1/promotions/validate` - Validate gift card
- `POST /api/payments/intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment

#### 6. Gift Card Management
**Purpose**: Simple gift card creation and management

**Components**:
- **Code Generation**: Automatic code creation with copy functionality
- **Status Management**: Enable/disable toggle
- **Usage Tracking**: Redemption count and remaining value
- **Bulk Operations**: Multiple gift card management

**Backend Endpoints**:
- `POST /api/v1/promotions/coupons` - Create gift card
- `PUT /api/v1/promotions/coupons/{id}` - Enable/disable gift card
- `DELETE /api/v1/promotions/coupons/{id}` - Delete gift card
- `GET /api/v1/promotions/coupons/{id}` - Get gift card details
- `GET /api/v1/promotions/coupons/{id}/stats` - Get usage statistics
- `POST /api/v1/promotions/coupons/validate` - Validate gift card code

#### Additional Backend API Endpoints

**Admin Dashboard APIs**:
- `GET /api/v1/admin/dashboard` - Admin dashboard overview
- `GET /api/v1/admin/services` - Admin services management
- `POST /api/v1/admin/services` - Create service via admin
- `PUT /api/v1/admin/services/{id}` - Update service via admin
- `DELETE /api/v1/admin/services/{id}` - Delete service via admin
- `POST /api/v1/admin/services/bulk-update` - Bulk update services
- `GET /api/v1/admin/staff` - Admin staff management
- `POST /api/v1/admin/staff` - Create staff via admin
- `PUT /api/v1/admin/staff/{id}` - Update staff via admin
- `DELETE /api/v1/admin/staff/{id}` - Delete staff via admin
- `GET /api/v1/admin/bookings` - Admin bookings management
- `PUT /api/v1/admin/bookings/{id}` - Update booking via admin
- `POST /api/v1/admin/bookings/bulk-actions` - Bulk booking actions

**Branding & White-Label APIs**:
- `GET /api/v1/admin/branding` - Get branding settings
- `PUT /api/v1/admin/branding` - Update branding settings
- `POST /api/v1/admin/branding/upload-logo` - Upload logo (2MB limit)
- `POST /api/v1/admin/branding/upload-favicon` - Upload favicon
- `POST /api/v1/admin/branding/validate-subdomain` - Validate subdomain

**Loyalty System APIs**:
- `GET /api/v1/loyalty` - Get loyalty summary
- `POST /api/v1/loyalty/award` - Award loyalty points
- `POST /api/v1/loyalty/redeem` - Redeem loyalty points
- `GET /api/v1/loyalty/stats` - Get loyalty statistics

**Automation APIs**:
- `GET /api/v1/automations` - List automations
- `POST /api/v1/automations` - Create automation
- `PUT /api/v1/automations/{id}` - Update automation
- `DELETE /api/v1/automations/{id}` - Delete automation
- `POST /api/v1/automations/{id}/execute` - Execute automation

**Analytics APIs**:
- `GET /api/v1/analytics/revenue` - Revenue analytics
- `GET /api/v1/analytics/bookings` - Booking analytics
- `GET /api/v1/analytics/customers` - Customer analytics
- `GET /api/v1/analytics/services` - Service analytics

**Notification APIs**:
- `GET /api/v1/notifications/templates` - List notification templates
- `POST /api/v1/notifications/templates` - Create notification template
- `PUT /api/v1/notifications/templates/{id}` - Update notification template
- `POST /api/v1/notifications/sms/send` - Send SMS notification
- `POST /api/v1/notifications/email/send` - Send email notification

**Health & Monitoring APIs**:
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Prometheus metrics
- `GET /api/v1/admin/outbox/events` - Outbox event management
- `POST /api/v1/admin/outbox/events/{id}/retry` - Retry failed events

---

## Data Models & API Integration

### Core Data Models

#### Tenant (Business)
```typescript
interface Tenant {
  id: string;
  slug: string;
  name: string;
  description: string;
  timezone: string;
  logo_url?: string;
  primary_color: string;
  settings: {
    cancellation_fee_percent: number;
    notification_defaults: {
      reminder_24h: boolean;
      reminder_1h: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}
```

#### Service
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
  created_at: string;
  updated_at: string;
}
```

#### Booking
```typescript
interface Booking {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  attendee_count: number;
  client_generated_id: string;
  created_at: string;
  updated_at: string;
}
```

#### Payment
```typescript
interface Payment {
  id: string;
  tenant_id: string;
  booking_id: string;
  customer_id: string;
  amount_cents: number;
  currency_code: string;
  status: 'requires_action' | 'succeeded' | 'failed' | 'cancelled';
  method: 'card' | 'apple_pay' | 'google_pay' | 'paypal';
  provider_payment_id: string;
  created_at: string;
  updated_at: string;
}
```

#### Analytics & Reporting
```typescript
interface AnalyticsEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  event_data: Record<string, any>;
  user_id?: string;
  customer_id?: string;
  booking_id?: string;
  created_at: string;
}

interface RevenueAnalytics {
  tenant_id: string;
  period: string;
  total_revenue_cents: number;
  booking_count: number;
  average_booking_value_cents: number;
  no_show_rate: number;
  top_services: Array<{
    service_id: string;
    service_name: string;
    revenue_cents: number;
    booking_count: number;
  }>;
}
```

#### Notification System
```typescript
interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables: Record<string, any>;
  required_variables: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
}

interface NotificationPreference {
  id: string;
  tenant_id: string;
  user_type: 'customer' | 'staff' | 'admin';
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  booking_notifications: boolean;
  payment_notifications: boolean;
  promotion_notifications: boolean;
  system_notifications: boolean;
  marketing_notifications: boolean;
  digest_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}
```

### API Integration Patterns

#### Error Handling
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

const handleApiError = (error: AxiosError): TithiError => {
  if (error.response?.data) {
    return error.response.data as TithiError;
  }
  return {
    type: 'about:blank',
    title: 'Unknown Error',
    status: error.response?.status || 500,
    detail: error.message,
    instance: error.config?.url || '',
    error_code: 'UNKNOWN_ERROR'
  };
};
```

#### Rate Limiting
```typescript
const apiClientWithRetry = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  }
});

apiClientWithRetry.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return apiClientWithRetry.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

#### Idempotency
```typescript
const generateIdempotencyKey = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const createBooking = async (booking: BookingRequest): Promise<Booking> => {
  const response = await apiClient.post('/api/v1/bookings', booking, {
    headers: {
      'Idempotency-Key': generateIdempotencyKey()
    }
  });
  return response.data.booking;
};
```

---

## Success Criteria & Metrics

### Business Owner Success Criteria
- **Onboarding Completion**: < 10 minutes from start to first booking
- **Attendance Marking**: < 3 clicks to mark attendance status
- **Payment Processing**: 100% attendance-based charging accuracy
- **Gift Card Management**: < 2 clicks to generate/manage gift cards

### Customer Success Criteria
- **Booking Flow**: < 5 clicks from service selection to confirmation
- **Time Zone Clarity**: Business time zone visible throughout booking
- **Dashboard Navigation**: Clear separation of owned businesses vs orders
- **Payment Transparency**: Clear understanding of payment timing
- **Account Flexibility**: Support for users who are business owners, customers, or both

### Platform Success Criteria
- **White-label Branding**: Automatic logo and color application
- **Notification Control**: Business-owned notification management
- **Performance**: < 2 second page load times
- **Accessibility**: WCAG 2.1 AA compliance

### Key Performance Indicators (KPIs)
- **Onboarding Completion Rate**: > 90%
- **Subscription Conversion Rate**: > 80% (onboarding to paid subscription)
- **Booking Conversion Rate**: > 15%
- **Payment Success Rate**: > 98%
- **Customer Satisfaction**: > 4.5/5
- **Time to First Booking**: < 15 minutes
- **Attendance Marking Efficiency**: < 30 seconds per booking
- **Multi-Business Adoption**: > 20% of users have multiple businesses

---

## Implementation Roadmap

### Phase 1: Core Foundation (Weeks 1-2)
- [ ] Project setup with React + TypeScript
- [ ] Authentication integration with Supabase
- [ ] Basic routing and navigation
- [ ] API client setup with error handling
- [ ] Design system implementation

### Phase 2: Business Owner Features (Weeks 3-4)
- [ ] Onboarding wizard implementation
- [ ] Business dashboard
- [ ] Booking management interface
- [ ] Attendance marking functionality
- [ ] Basic analytics dashboard

### Phase 3: Customer Features (Weeks 5-6)
- [ ] Customer dashboard
- [ ] Public booking page
- [ ] Payment integration with Stripe
- [ ] Gift card management
- [ ] Notification system

### Phase 4: Advanced Features (Weeks 7-8)
- [ ] Real-time availability updates
- [ ] Advanced analytics
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Testing and quality assurance

### Phase 5: Production Readiness (Weeks 9-10)
- [ ] Security hardening
- [ ] Performance monitoring
- [ ] Error tracking
- [ ] Documentation
- [ ] Deployment preparation

---

## Technical Requirements

### Performance Requirements
- **Page Load Time**: < 2 seconds
- **API Response Time**: < 500ms
- **Bundle Size**: < 500KB initial load
- **Time to Interactive**: < 3 seconds

### Security Requirements
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Data Protection**: HTTPS encryption
- **Input Validation**: Client and server-side validation

### Accessibility Requirements
- **WCAG Compliance**: 2.1 AA level
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Compatible with screen readers
- **Color Contrast**: Minimum 4.5:1 ratio

### Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Responsive Design**: Mobile-first approach

---

## Testing Strategy

### Unit Testing
- **Components**: 90%+ coverage for React components
- **Hooks**: 95%+ coverage for custom hooks
- **Services**: 100% coverage for API service functions
- **Utils**: 100% coverage for utility functions

### Integration Testing
- **API Integration**: 80%+ coverage for API endpoints
- **Authentication Flow**: Complete auth flow testing
- **Payment Processing**: End-to-end payment testing
- **Booking Flow**: Complete booking lifecycle testing

### End-to-End Testing
- **User Journeys**: Complete user workflow testing
- **Cross-browser**: Testing across supported browsers
- **Mobile Testing**: Mobile device testing
- **Performance Testing**: Load and stress testing

### Test Data Management
```typescript
// Test data factories
const createTestTenant = (overrides = {}) => ({
  id: 'tenant-123',
  slug: 'test-tenant',
  name: 'Test Tenant',
  timezone: 'UTC',
  primary_color: '#3B82F6',
  ...overrides
});

const createTestBooking = (overrides = {}) => ({
  id: 'booking-123',
  tenant_id: 'tenant-123',
  customer_id: 'customer-123',
  service_id: 'service-123',
  start_at: '2024-01-15T10:00:00Z',
  end_at: '2024-01-15T11:00:00Z',
  status: 'pending',
  ...overrides
});
```

---

## Deployment & Infrastructure

### Environment Configuration
```bash
# Production environment variables
REACT_APP_API_URL=https://api.tithi.com
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
REACT_APP_SENTRY_DSN=https://your-sentry-dsn
```

### Build Configuration
```json
{
  "scripts": {
    "build": "react-scripts build",
    "build:staging": "REACT_APP_ENV=staging react-scripts build",
    "build:production": "REACT_APP_ENV=production react-scripts build"
  }
}
```

### Monitoring & Analytics
- **Error Tracking**: Sentry integration
- **Performance Monitoring**: Web Vitals tracking
- **User Analytics**: Privacy-compliant analytics
- **Business Metrics**: Revenue and booking tracking

---

## Conclusion

This design brief provides a comprehensive specification for building the Tithi frontend that aligns with the backend capabilities and user requirements. The design emphasizes simplicity, brand identity, and attendance-based payments while maintaining a clear separation between business owner and customer experiences.

### Key Success Factors
1. **Follow the exact API signatures** and payload formats from the backend documentation
2. **Implement proper error handling** with structured error responses
3. **Ensure tenant isolation** and security compliance
4. **Use idempotency keys** for critical operations
5. **Implement comprehensive testing** coverage
6. **Follow production readiness** guidelines

### Next Steps
1. **Review and approve** this design brief
2. **Set up development environment** with required tools
3. **Begin Phase 1 implementation** with core foundation
4. **Establish testing framework** and quality gates
5. **Plan deployment strategy** and monitoring setup

This design brief serves as the single source of truth for frontend development and should be referenced throughout the implementation process.

---

*End of Tithi Frontend Design Brief*
