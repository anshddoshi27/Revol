# 🎯 Tithi Backend-Frontend Integration Guide

**Quick navigation for building the Tithi frontend**

## 📋 What Has Been Created

Three comprehensive documents have been created to help AI executors understand and build the complimentary frontend:

### 1. **BACKEND_EXECUTOR_MAP.md** (Main Guide)
**Location**: `docs/backend/BACKEND_EXECUTOR_MAP.md`

**The complete reference** for understanding how the Tithi backend works:

✅ **Architecture Overview**
- Tech stack breakdown
- Project structure
- Design principles
- Multi-tenancy architecture

✅ **Database Models & Relationships** 
- Core entities (Tenant, User, Membership, Customer)
- Business entities (Service, Booking, TeamMember)
- Financial entities (Payment, Refund, Subscription)
- Onboarding entities (OnboardingProgress, etc.)
- Complete model relationships diagram

✅ **API Endpoints Reference**
- Authentication endpoints
- Onboarding flow (8-12 steps)
- Booking flow (public endpoints)
- Admin dashboard
- Payment processing
- Analytics & reporting

✅ **Business Logic Flow**
- Complete onboarding flow diagram
- Booking flow (customer side)
- Admin actions (money movement)
- Payment processing flow

✅ **Frontend Integration Guide**
- TypeScript/JavaScript examples
- Complete request/response samples
- Stripe integration
- Error handling
- Authentication flow

### 2. **BACKEND_QUICK_REFERENCE.md** (Quick Lookup)
**Location**: `docs/backend/BACKEND_QUICK_REFERENCE.md`

**Fast lookup tables** for common tasks:

✅ **Endpoint Tables**
- Organized by category
- Method, endpoint, auth requirements
- Purpose for each endpoint

✅ **Database Models Quick Reference**
- Condensed model summaries
- Key fields highlighted
- Relationships summarized

✅ **Status Enums**
- Booking status flow
- Payment status flow
- Subscription states
- Role hierarchy

✅ **Request/Response Examples**
- Complete TypeScript examples
- JSON payloads
- Common patterns

✅ **Frontend Checklist**
- Feature-by-feature checklist
- Implementation reminders
- Testing notes

### 3. **README.md** (Navigation Hub)
**Location**: `docs/backend/README.md`

**Documentation index** pointing to all backend docs

## 🎯 Key Concepts for Frontend Builders

### 1. Manual Payment Capture ⚠️ CRITICAL

**The most important concept**:

```
❌ WRONG: Charge customer when they book
✅ CORRECT: Only charge when admin clicks "Completed", "No-Show", or "Cancelled"
```

**Flow**:
1. Customer books → PaymentMethod saved (SetupIntent)
2. NO CHARGE YET
3. Admin clicks button → PaymentIntent captured → Charge happens

### 2. Multi-Tenancy

Every piece of data belongs to a `tenant_id`:
- Businesses are isolated
- Users can own multiple businesses
- Each business has separate subscription
- Database enforces isolation (RLS)

### 3. Onboarding Flow (8-12 Steps)

1. **Business Account** - Create tenant
2. **Booking Website** - Set subdomain
3. **Location & Contacts** - Address, timezone, contact info
4. **Team Members** - Add staff
5. **Branding** - Logo, colors
6. **Services & Categories** - Create services
7. **Availability** - Set staff availability per service
8. **Notifications** - Create templates
9. **Policies** - Set fees and policies
10. **Gift Cards** - Optional
11. **Payment Setup** - Stripe Connect
12. **Go Live** - Make site public

### 4. Booking Flow

**Public endpoints (no auth required)**:
1. Load booking site data
2. Show services by category
3. Customer selects service
4. Show availability (color-coded by staff)
5. Customer selects time
6. Collect customer info + payment method
7. Create booking (NO CHARGE)
8. Show confirmation

**Admin actions**:
- View all bookings
- Click "Completed" → Charge full amount
- Click "No-Show" → Charge no-show fee
- Click "Cancelled" → Charge cancellation fee
- Click "Refund" → Refund payment

### 5. Subscription Management

**States**:
- `trial` → 7 days free
- `active` → $11.99/month billing
- `paused` → No billing, site stays up
- `canceled` → No billing, site deprovisioned

## 🔗 Essential Links

### For Development
- **Main Guide**: `docs/backend/BACKEND_EXECUTOR_MAP.md`
- **Quick Ref**: `docs/backend/BACKEND_QUICK_REFERENCE.md`
- **API Docs**: `http://localhost:5001/api/docs` (OpenAPI/Swagger)

### Backend Code
- **Entry Point**: `backend/index.py`
- **App Factory**: `backend/app/__init__.py`
- **Config**: `backend/app/config.py`
- **Models**: `backend/app/models/`
- **Services**: `backend/app/services/`
- **Blueprints**: `backend/app/blueprints/`

### Environment Setup
```bash
# Backend runs on port 5001
export DATABASE_URL="postgresql://user:pass@localhost:5432/tithi"
export SECRET_KEY="your-secret-key"
export STRIPE_SECRET_KEY="sk_test_xxx"

# Health checks
GET http://localhost:5001/health/live
GET http://localhost:5001/health/ready
```

## 📊 Data Flow Summary

```
User Registration
  ↓
Business Onboarding (Steps 1-12)
  ↓ Creates: Tenant, TeamMember, Service, Availability, Policies
  ↓
Customer Books Service
  ↓ Uses: Public booking flow
  ↓ Creates: Booking (pending), Payment (requires_action), Customer
  ↓ NO CHARGE
  ↓
Admin Reviews Booking
  ↓
Admin Clicks "Completed"
  ↓ Captures: PaymentIntent
  ↓ Charges: Card
  ↓ Transfers: To Connect account (minus fees)
```

## 🛠️ Implementation Checklist

### Phase 1: Authentication
- [ ] User registration UI
- [ ] Login UI
- [ ] JWT token storage
- [ ] Auth middleware integration

### Phase 2: Onboarding
- [ ] Step 1: Business account creation
- [ ] Step 2: Subdomain selection
- [ ] Step 3: Location & contacts
- [ ] Step 4: Team members
- [ ] Step 5: Branding
- [ ] Step 6: Services & categories
- [ ] Step 7: Availability setup
- [ ] Step 8: Notifications
- [ ] Step 9: Policies
- [ ] Step 10: Gift cards (optional)
- [ ] Step 11: Stripe Connect setup
- [ ] Step 12: Go live

### Phase 3: Booking Flow
- [ ] Public booking page
- [ ] Service selection
- [ ] Availability calendar
- [ ] Customer info collection
- [ ] Policies display
- [ ] Gift card input
- [ ] Stripe Elements integration
- [ ] Booking confirmation

### Phase 4: Admin Dashboard
- [ ] Booking list view
- [ ] Booking details
- [ ] "Completed" button with charge
- [ ] "No-Show" button with fee
- [ ] "Cancelled" button with fee
- [ ] "Refund" button
- [ ] Customer management
- [ ] Analytics dashboard

### Phase 5: Subscription
- [ ] Status display
- [ ] Billing information
- [ ] Activate/Pause/Cancel controls

## ⚠️ Common Pitfalls

1. **Charging at booking time** → Only charge on admin action
2. **Missing tenant context** → Always include tenant_id
3. **Forgetting idempotency** → Add idempotency_key to all money actions
4. **Not validating gift cards** → Validate on backend
5. **Ignoring manual capture** → Use capture_method="manual"

## 📞 Getting Help

1. **Check**: `docs/backend/BACKEND_QUICK_REFERENCE.md` for endpoint details
2. **Read**: `docs/backend/BACKEND_EXECUTOR_MAP.md` for architecture
3. **Test**: Use `/health` endpoints to verify backend is up
4. **Debug**: Check backend logs at `backend/backend.log`

## 🎉 Next Steps

1. **Read the executor map**: `docs/backend/BACKEND_EXECUTOR_MAP.md`
2. **Start with auth**: Implement registration and login
3. **Build onboarding**: Step by step, following the 12-step flow
4. **Create booking flow**: Public-facing customer booking
5. **Add admin panel**: Dashboard with booking management
6. **Integrate payments**: Stripe Connect and subscriptions

---

**Happy Building! 🚀**

Remember: The backend is designed to support the frontend, not control it. Use the documented APIs, follow the flows, and reference the examples. Everything you need is in these documents.

