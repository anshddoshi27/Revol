# Task 4: Onboarding API Routes - Started 🚧

## What Was Created

### 1. Authentication Helper (`apps/web/src/lib/auth.ts`)

Two utility functions:
- `getCurrentUserId()` - Gets the authenticated user ID from Supabase JWT
- `getCurrentBusinessId()` - Gets the user's business ID

### 2. First Onboarding Endpoint (`apps/web/src/app/api/business/onboarding/step-1-business/route.ts`)

- **Route**: `PUT /api/business/onboarding/step-1-business`
- **Purpose**: Saves business basic information (name, description, DBA, legal name, industry)
- **Behavior**: 
  - Creates a draft business if none exists
  - Updates existing business if it exists
  - Uses temporary subdomain/timezone (will be updated in later steps)

## Next Steps

### 1. Set Up Real Authentication (Required)

The frontend currently uses `fake-session.tsx`. Before these endpoints will work, you need to:

**Option A: Use Supabase Auth (Recommended)**
- Replace fake session with Supabase Auth
- Add login/signup pages that use Supabase
- Frontend will send JWT tokens in API requests

**Option B: Test with Service Role (Development Only)**
- For testing, you can temporarily bypass auth
- Use `createAdminClient()` instead of `createServerClient()`
- ⚠️ **Never do this in production**

### 2. Create Remaining Onboarding Endpoints

You need to create endpoints for:
- `PUT /api/business/onboarding/step-2-website` - Subdomain validation & reservation
- `PUT /api/business/onboarding/step-3-location` - Address, timezone, contacts
- `PUT /api/business/onboarding/step-4-team` - Staff members
- `PUT /api/business/onboarding/step-5-branding` - Logo, colors
- `PUT /api/business/onboarding/step-6-services` - Categories & services
- `PUT /api/business/onboarding/step-7-availability` - Availability rules
- `PUT /api/business/onboarding/step-8-notifications` - Notification templates
- `PUT /api/business/onboarding/step-9-policies` - Business policies
- `PUT /api/business/onboarding/step-10-gift-cards` - Gift card config
- `POST /api/business/onboarding/step-11-payment-setup` - Stripe Connect + subscription
- `POST /api/business/onboarding/complete` - Finalize onboarding (Go Live)

### 3. Update Frontend to Call Real APIs

Replace the fake context calls with real API calls:
- `onboarding.saveBusiness()` → `PUT /api/business/onboarding/step-1-business`
- etc.

## Current Status

✅ Database schema created and migrated
✅ Auth helper functions created
✅ First endpoint (step-1-business) created
⏳ Need to set up real authentication
⏳ Need to create remaining 10 endpoints
⏳ Need to wire frontend to call APIs

## Testing the First Endpoint

Once you have authentication set up, you can test:

```bash
# With a valid JWT token
curl -X PUT http://localhost:3000/api/business/onboarding/step-1-business \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "businessName": "Test Business",
    "description": "A test business",
    "doingBusinessAs": "Test DBA",
    "legalName": "Test Business LLC",
    "industry": "Salon"
  }'
```

## Notes

- All endpoints require authentication (user must be logged in)
- Business is created as a "draft" during onboarding
- Final "Go Live" step will mark business as active and make it public
- Each step can be called multiple times (idempotent - updates existing data)




