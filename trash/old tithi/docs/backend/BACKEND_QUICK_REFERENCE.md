# ⚡ Tithi Backend Quick Reference

**Quick lookup guide for AI executors building the frontend**

---

## 🔗 Essential API Endpoints

### Authentication
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/auth/register` | No | Create user account |
| POST | `/auth/login` | No | Login, get JWT |
| GET | `/auth/me` | Yes | Get current user |

### Onboarding (8-12 Steps)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/onboarding/step1/business-account` | Yes | Create business |
| POST | `/api/v1/onboarding/step2/booking-website` | Yes | Set subdomain |
| POST | `/api/v1/onboarding/step3/location-contacts` | Yes | Location info |
| POST | `/api/v1/onboarding/step4/team-members` | Yes | Add staff |
| POST | `/api/v1/onboarding/step5/branding` | Yes | Logo & colors |
| POST | `/api/v1/onboarding/step6/services-categories` | Yes | Add services |
| POST | `/api/v1/onboarding/step7/availability` | Yes | Set availability |
| POST | `/api/v1/onboarding/step8/notifications` | Yes | Notification templates |
| POST | `/api/v1/onboarding/step9/policies` | Yes | Policies & fees |
| POST | `/api/v1/onboarding/step10/gift-cards` | Yes | Gift cards (opt) |
| POST | `/api/v1/onboarding/step11/payment-setup` | Yes | Stripe Connect |
| POST | `/api/v1/onboarding/step12/go-live` | Yes | Go live |
| GET | `/api/v1/onboarding/progress` | Yes | Get progress |

### Booking Flow (Public)
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/booking/tenant-data/{tenant_id}` | No | Get booking site data |
| POST | `/booking/availability` | No | Check availability |
| POST | `/booking/create` | No | Create booking |

### Admin Dashboard
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/admin/bookings` | Yes | List bookings |
| POST | `/api/v1/admin/bookings/{id}/complete` | Yes | Complete (charge) |
| POST | `/api/v1/admin/bookings/{id}/no-show` | Yes | No-show (charge fee) |
| POST | `/api/v1/admin/bookings/{id}/cancel` | Yes | Cancel (charge fee) |
| POST | `/api/v1/admin/bookings/{id}/refund` | Yes | Refund payment |

### Payments
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/payments/stripe/connect/setup` | Yes | Setup Stripe Connect |
| POST | `/api/payments/stripe/subscription/create` | Yes | Create subscription |
| POST | `/api/payments/webhook` | No | Stripe webhooks |

---

## 📊 Database Models Quick Reference

### Core Models
```
Tenant → Businesses (subdomain, branding, policies)
User → Platform users (owners/admins)
Membership → User-Tenant relationship (roles)
Customer → End customers (name, email, phone)
```

### Business Models
```
Service → Bookable services (name, duration, price)
ServiceCategory → Organizes services
TeamMember → Staff members
Booking → Appointments (customer, service, time, status)
```

### Financial Models
```
Payment → Transactions (booking_id, amount, status)
Refund → Refund records
TenantBilling → Subscriptions ($11.99/month)
GiftCard → Gift cards (code, discount/amount)
```

### Onboarding Models
```
OnboardingProgress → Tracks steps (current_step, completed_steps)
NotificationTemplate → Notification templates
BusinessPolicy → Policies and fees
```

### Key Fields
```
All models: id (UUID), created_at, updated_at
TenantModel: tenant_id (scoped to business)
GlobalModel: No tenant_id (platform-wide)
```

---

## 🔄 Status Enums

### Booking Status
```
pending → confirmed → checked_in → completed
  ↓         ↓
canceled   no_show
```

### Payment Status
```
requires_action → authorized → captured
  ↓               ↓
failed           refunded
```

### Subscription Status
```
trial → active → paused
  ↓       ↓
canceled (deprovisioned)
```

### Membership Role
```
owner > admin > staff > viewer
(permissions hierarchy)
```

---

## 🔐 Authentication Flow

```typescript
// 1. Register
POST /auth/register
{ email, password, first_name, last_name }
→ Returns JWT

// 2. Store JWT
localStorage.setItem("token", jwt)

// 3. Include in requests
headers: { Authorization: `Bearer ${jwt}` }

// 4. JWT contains:
{
  "sub": "user-uuid",
  "tenant_id": "business-uuid",
  "membership_role": "owner",
  "email": "user@example.com"
}
```

---

## 💰 Payment Flow (CRITICAL)

```
Booking Created → SetupIntent → Save Payment Method
                 NO CHARGE

Admin clicks "Completed" → Capture PaymentIntent
                          → Charge card
                          → Deduct 1% platform fee
                          → Send receipt
```

**Key Rule**: NEVER charge at booking time. Only charge when admin clicks a button.

---

## 📝 Request/Response Examples

### Create Booking (Public)
```typescript
POST /booking/create
{
  "tenant_id": "uuid",
  "service_id": "uuid",
  "team_member_id": "uuid",
  "start_time": "2025-01-15T10:00:00Z",
  "customer_info": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "payment_method": {
    "stripe_payment_method_id": "pm_xxx"
  },
  "gift_card_code": "optional"
}

Response:
{
  "success": true,
  "data": {
    "booking_id": "uuid",
    "status": "pending",
    "payment_status": "requires_action",
    "confirmation_number": "ABC123"
  }
}
```

### Complete Booking (Admin)
```typescript
POST /api/v1/admin/bookings/{id}/complete
{
  "idempotency_key": "unique-key-123"
}

Response:
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "amount_charged_cents": 3000,
    "platform_fee_cents": 30,
    "stripe_fee_cents": 92,
    "net_amount_cents": 2878,
    "receipt_url": "https://..."
  }
}
```

### Add Service (Onboarding)
```typescript
POST /api/v1/onboarding/step6/services-categories
{
  "category": {
    "name": "Haircuts",
    "color": "#FF5733",
    "services": [
      {
        "name": "Men's Cut",
        "description": "Quick men's haircut",
        "duration_min": 30,
        "price_cents": 3000,
        "instructions": "Arrive 5 minutes early"
      }
    ]
  }
}
```

### Set Availability (Onboarding)
```typescript
POST /api/v1/onboarding/step7/availability
{
  "service_id": "uuid",
  "team_member_id": "uuid",
  "availabilities": [
    {
      "day_of_week": 1,      // Monday
      "start_time": "09:00",
      "end_time": "17:00"
    },
    {
      "day_of_week": 2,      // Tuesday
      "start_time": "09:00",
      "end_time": "17:00"
    }
  ]
}
```

### Check Availability (Public)
```typescript
POST /booking/availability
{
  "tenant_id": "uuid",
  "service_id": "uuid",
  "start_date": "2025-01-15",
  "end_date": "2025-01-20",
  "team_member_id": "optional"
}

Response:
{
  "success": true,
  "data": {
    "slots": [
      {
        "start_time": "2025-01-15T10:00:00Z",
        "end_time": "2025-01-15T10:30:00Z",
        "team_member_id": "uuid",
        "team_member_name": "Sarah",
        "available": true
      }
    ]
  }
}
```

---

## ⚠️ Common Errors

| Error Code | Status | Meaning | Solution |
|------------|--------|---------|----------|
| `TITHI_VALIDATION_ERROR` | 400 | Missing/invalid fields | Check request body |
| `TITHI_AUTH_REQUIRED` | 401 | No JWT token | Add Authorization header |
| `TITHI_RLS_DENIED` | 403 | Not your tenant's data | Check tenant_id |
| `TITHI_NOT_FOUND` | 404 | Resource doesn't exist | Verify IDs |
| `TITHI_BOOKING_CONFLICT` | 409 | Slot already booked | Show new slots |
| `TITHI_PAYMENT_REQUIRES_ACTION` | 402 | Payment needs action | Handle 3DS |
| `TITHI_STRIPE_ERROR` | 500 | Stripe issue | Check webhook logs |

---

## 🎯 Frontend Checklist

### Onboarding Page
- [ ] Step 1: Create business account
- [ ] Step 2: Set subdomain (validate uniqueness)
- [ ] Step 3: Location & contacts
- [ ] Step 4: Add team members
- [ ] Step 5: Upload logo, pick colors
- [ ] Step 6: Create categories & services
- [ ] Step 7: Set availability per staff per service
- [ ] Step 8: Create notification templates
- [ ] Step 9: Set policies & fees
- [ ] Step 10: Optional gift cards
- [ ] Step 11: Setup Stripe Connect
- [ ] Step 12: Go live button

### Booking Flow
- [ ] Display business info from `/booking/tenant-data`
- [ ] Show services grouped by categories
- [ ] Customer selects service
- [ ] Show availability calendar (color-coded by staff)
- [ ] Customer selects time slot
- [ ] Collect customer info (name, email, phone)
- [ ] Show policies modal with checkbox
- [ ] Optional gift card input (live price update)
- [ ] Stripe Elements for card input
- [ ] Create booking (NO CHARGE)
- [ ] Show confirmation page

### Admin Dashboard
- [ ] List all bookings (filterable, sortable)
- [ ] Show booking details (customer, service, time)
- [ ] Four action buttons:
  - [ ] "Completed" → Charge full amount
  - [ ] "No-Show" → Charge no-show fee
  - [ ] "Cancelled" → Charge cancellation fee
  - [ ] "Refund" → Refund payment
- [ ] Show payment status chips
- [ ] Display receipt/charge details
- [ ] Toast notifications on actions
- [ ] Prevent double-clicks (idempotency)

### Subscription Management
- [ ] Show current subscription status
- [ ] Display next billing date
- [ ] Trial → Active → Paused → Canceled flow
- [ ] Warning before canceling
- [ ] Subscription controls (Activate, Pause, Cancel)

---

## 🔧 Environment Variables

```bash
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/tithi"
SECRET_KEY="your-secret-key"
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_KEY="eyJxxx"
STRIPE_SECRET_KEY="sk_test_xxx"

# Optional
REDIS_URL="redis://localhost:6379/0"
FLASK_HOST="0.0.0.0"
FLASK_PORT="5001"
FLASK_DEBUG="True"
LOG_LEVEL="INFO"
```

---

## 📦 Key Dependencies

```python
# Backend (requirements.txt)
Flask==2.3.3
SQLAlchemy==2.0.23
stripe==7.8.0
redis==5.0.1
celery==5.3.4
Flask-Smorest==0.42.0
```

---

## 🧭 Navigation Guide

1. **Starting frontend?** → Start with Authentication section
2. **Building onboarding?** → See Onboarding endpoints + Examples
3. **Building booking flow?** → See Booking Flow + Payment Flow
4. **Building admin panel?** → See Admin Dashboard + Payment Flow
5. **Stuck on a model?** → See Database Models Quick Reference
6. **Payment issues?** → See Payment Flow + Key Rule

---

**Full Documentation**: See `docs/backend/BACKEND_EXECUTOR_MAP.md`

