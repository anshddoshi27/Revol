# 🚀 Tithi Database Quick Reference for AI Executors

**This is your cheat sheet** for building the Tithi frontend. Know what data exists and how it flows.

---

## 🎯 The Big Picture

```
Landing → Login → Dashboard → Admin View → [Edit Settings OR View Bookings]
                                    ↓
                          Public Booking Site
                         (subdomain.tithi.com)
```

**One user can own multiple businesses. Each business gets its own onboarding flow and $11.99/month subscription.**

---

## 📊 Core Data Model (5-Minute Read)

### 1. Tenants = Businesses
```typescript
interface Tenant {
  id: string
  name: string              // "ABC Salon"
  subdomain: string         // "abc-salon" → abc-salon.tithi.com
  business_timezone: string  // "America/New_York"
  logo_url: string
  branding_json: { primary_color: "#FF5733", ... }
  status: "onboarding" | "ready" | "active"
}
```

### 2. Users = Owners/Admins
```typescript
interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  // Can belong to multiple tenants via memberships
}
```

### 3. Services = What You Sell
```typescript
interface Service {
  id: string
  name: string              // "Haircut"
  category_id: string
  duration_min: number      // 60
  price_cents: number       // 12000 (=$120.00)
  description: string
  instructions: string      // "Arrive 10 min early"
  image_url: string
}
```

### 4. Team Members = Staff
```typescript
interface TeamMember {
  id: string
  name: string              // "Sarah"
  role: "staff" | "admin"
  bio: string
  avatar_url: string
  specialties: string[]
  // Availability defined in team_member_availability
}
```

### 5. Bookings = Customer Appointments
```typescript
interface Booking {
  id: string
  customer_id: string
  service_id: string
  team_member_id: string
  start_at: "2024-01-15T10:00:00Z"
  end_at: "2024-01-15T11:00:00Z"
  status: "pending" | "authorized" | "completed" | "no_show" | "canceled"
  service_snapshot: {...}   // Service data at booking time
}
```

### 6. Payments = Money
```typescript
interface Payment {
  id: string
  booking_id: string
  amount_cents: number      // Gross amount
  status: "authorized" | "captured" | "refunded"
  provider_payment_id: string    // Stripe PaymentIntent ID
  provider_setup_intent_id: string  // Saved card for later
  application_fee_cents: number  // 1% platform fee
}

// CRITICAL: No charge at checkout!
// Status flow: authorized (after booking) → captured (admin clicks "Completed")
```

---

## 🔑 Critical Rules (Read This First!)

### Payment Flow (MOST IMPORTANT)
```
❌ WRONG: Charge at checkout
✅ CORRECT: Save card at checkout, charge later from admin buttons

At Checkout:
- Create SetupIntent (save card only)
- Booking status = "pending"
- Payment status = "authorized" (not charged)

Admin Actions:
- "Completed" button → Charge full amount now
- "No-Show" button → Charge no-show fee now
- "Refund" button → Refund any previous charge
```

### Multi-Tenancy
```
Every data row has tenant_id
Backend enforces isolation (RLS)
Frontend: Include 'X-Tenant-ID' header or use JWT tenant context
```

### Onboarding = Business Setup
```
8 steps to configure one business:
1. Business info (name, description, DBA, category)
2. Booking website (subdomain selection)
3. Location & contacts (address, phone, timezone)
4. Team setup (add staff members)
5. Branding (logo, colors)
6. Services & categories
7. Availability (per service per staff)
8. Notifications (email/SMS templates)
9. Policies (cancellation, no-show, refund)
10. Gift cards (optional)
11. Payment setup (Stripe Connect + subscription)
12. Go Live (generate booking URL)
```

---

## 🔀 Data Flow Patterns

### Onboarding → Admin → Booking Site

```
Onboarding Steps → Save to Tables → Admin mirrors UI → Booking site reads same data

Example:
Step 1: Business name → tenants.name
Step 2: Subdomain → tenants.subdomain
Step 3: Address → tenants.address_json
Step 4: Add Sarah as staff → team_members
Step 5: Logo upload → business_branding.logo_url
Step 6: "Haircut" service → services
Step 7: Sarah's availability → team_member_availability
Step 8: Email template → notification_templates_enhanced
Step 9: Policies → business_policies
Step 10: Stripe Connect → tenant_billing.stripe_connect_id
Step 11: Go Live → tenants.status = "active"

Admin: Can edit any of the above in real-time
Booking Site: Reads tenants, services, availability to display
```

### Booking Flow (Customer Side)
```
1. Customer visits abc-salon.tithi.com
   → Fetches: Tenant info, Services, Categories
   
2. Clicks "Haircut" service
   → Fetches: Availability slots for that service
   
3. Selects time slot
   → Creates: booking_session
   
4. Enters name/email/phone
   → Updates: booking_session.customer_*
   
5. Sees policies modal, enters card
   → Creates: Payment with SetupIntent (save only)
   → Creates: Booking (status=pending)
   → Creates: Customer record
   
6. Confirmation page
   → Shows: Booking details, "Not charged yet" message
```

### Admin Booking Management
```
List of bookings:
- Customer: John Doe
- Service: Haircut ($120)
- Time: Jan 15, 10:00 AM
- Status: Pending
- Actions: [Completed] [No-Show] [Cancelled] [Refund]

Completed button clicked:
- Backend: Create PaymentIntent from saved SetupIntent
- Charge: $120.00
- Fees: Platform 1% = $1.20, Stripe ~3% = $3.60
- Net: $115.20
- Status: "Charged"
- Button: Disabled
```

---

## 🔌 Essential API Calls

### Public Booking Site
```typescript
// Get tenant info
GET /api/public/tenants/{slug}/info

// Get services
GET /api/public/tenants/{slug}/services?category_id={id}

// Get availability
GET /api/availability/slots?service_id={id}&date={date}&team_member_id={id}

// Create booking
POST /api/public/bookings
{
  service_id,
  team_member_id,
  start_time,
  customer: { name, email, phone },
  payment_method_id  // from Stripe Elements
}

// Validate gift card
POST /api/public/gift-cards/validate
{ code }
```

### Admin Dashboard
```typescript
// Get all bookings
GET /api/bookings?status=completed&from={date}&to={date}

// Capture payment
POST /api/admin/bookings/{bookingId}/complete

// Charge no-show fee
POST /api/admin/bookings/{bookingId}/no-show

// Refund
POST /api/admin/bookings/{bookingId}/refund

// Get services
GET /api/services

// Update service
PUT /api/services/{id}
```

### Onboarding
```typescript
// Get progress
GET /api/onboarding/progress

// Save step
POST /api/onboarding/steps/{step}
{ step_data }

// Go live
POST /api/onboarding/go-live
```

---

## 📱 UI Component Mapping

| Screen | Data Source | Key Fields |
|--------|-------------|------------|
| Landing | - | Join/Login buttons |
| Dashboard | `tenants` via `memberships` | List businesses |
| Onboarding | `onboarding_progress`, various tables | 8-step wizard |
| Booking Site | `tenants`, `services`, `availability_slots` | Browse & book |
| Service Grid | `service_categories`, `services` | Categories → Services |
| Time Selector | `availability_slots` | Color-coded by staff |
| Checkout | `business_policies`, Stripe Elements | Policies + card entry |
| Booking Confirmation | `bookings`, `services` | All booking details |
| Admin Bookings List | `bookings`, `customers`, `payments` | Past/future bookings |
| Payment Actions | `payments` | Buttons + status chips |
| Team Management | `team_members`, `team_member_availability` | CRUD staff |
| Service Management | `services`, `service_categories` | CRUD services |

---

## 🚨 Common Gotchas

1. **Never charge at checkout** - SetupIntent only
2. **All charges from admin buttons** - Completed/No-Show/Cancelled
3. **Gift cards** - Apply discount in checkout, deduct on charge
4. **Availability** - Backend generates slots, frontend just renders
5. **Notifications** - Templates created in onboarding, placeholders substituted at send time
6. **Timezone** - Always use business timezone, not user's
7. **Tenant isolation** - Every query scoped to tenant_id
8. **Idempotency** - Include 'X-Idempotency-Key' on payment mutations
9. **Status chips** - Show "Pending", "Charged", "No-Show", "Refunded"
10. **Refund button** - Disable if no charge exists

---

## 📚 Table Quick Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `tenants` | Businesses | name, subdomain, logo, branding_json |
| `users` | Owner accounts | email, first_name, last_name |
| `memberships` | User→Tenant | user_id, tenant_id, role |
| `onboarding_progress` | Onboarding state | current_step, step_data |
| `service_categories` | Service groups | name, color, sort_order |
| `services` | Service catalog | name, duration_min, price_cents |
| `team_members` | Staff | name, avatar_url, specialties |
| `team_member_availability` | Staff schedule | day_of_week, start_time, end_time |
| `customers` | Customer records | display_name, email, phone |
| `bookings` | Appointments | customer_id, service_id, start_at, status |
| `payments` | Transactions | amount_cents, status, provider_payment_id |
| `tenant_billing` | Subscriptions | stripe_connect_id, subscription_status |
| `gift_cards` | Gift cards | code, balance_cents |
| `business_policies` | Terms | cancellation_policy, no_show_fee_percent |
| `notification_templates_enhanced` | Email/SMS | trigger_event, content_template |
| `booking_flow_analytics` | Conversion data | sessions_started, conversion_rate |

---

## 🎨 Frontend State Management

```typescript
// Booking flow state
{
  session_id: string
  step: 'service' | 'time' | 'info' | 'payment' | 'confirm'
  selected_service: Service | null
  selected_slot: Slot | null
  customer: { name: string, email: string, phone: string }
  gift_card?: { code: string, discount: number }
  payment_intent?: PaymentIntent
}

// Admin booking list state
{
  bookings: Booking[]
  filters: { status, date_from, date_to }
  selected_booking: Booking | null
  action_processing: boolean
}

// Tenant/Business state
{
  current_tenant: Tenant
  tenants: Tenant[]  // User can own multiple
  onboarding_progress: OnboardingProgress
}
```

---

## ✅ Frontend Build Checklist

**Authentication & Navigation**
- [ ] Landing page (Join/Login)
- [ ] Login/Signup forms
- [ ] JWT token management
- [ ] Multi-tenant dashboard (list businesses)
- [ ] Business switcher if user owns multiple

**Onboarding (8 Steps)**
- [ ] Business info form
- [ ] Subdomain selector with validation
- [ ] Location & contacts form
- [ ] Team member CRUD
- [ ] Branding uploader (logo, colors)
- [ ] Service catalog builder
- [ ] Availability setter (per service per staff)
- [ ] Notification template editor with placeholders
- [ ] Policy editor
- [ ] Gift card template CRUD
- [ ] Stripe Connect setup
- [ ] Go Live confirmation

**Public Booking Site**
- [ ] Service catalog grid
- [ ] Time slot selector with staff colors
- [ ] Checkout flow with policies modal
- [ ] Gift card code entry
- [ ] Stripe Elements integration
- [ ] Booking confirmation page

**Admin Dashboard**
- [ ] Past bookings list with filters
- [ ] Booking detail view
- [ ] Payment action buttons (Completed/No-Show/Refund)
- [ ] Payment breakdown modal
- [ ] Service CRUD
- [ ] Team member CRUD
- [ ] Settings mirror (can edit onboarding data)
- [ ] Subscription management (trial/active/paused/canceled)
- [ ] Analytics dashboard

---

**Ready to build! Refer to the full DATABASE_MAP_FOR_FRONTEND.md for complete details.**

