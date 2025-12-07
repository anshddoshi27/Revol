# Guide: Setting Up Demo Business for Testing

The error "Page not found" occurs because the business with subdomain "demo" doesn't exist yet. Here's how to set it up.

---

## Option 1: Run Seed Script (Recommended)

The seed script creates a complete demo business in your database:

### Step 1: Check Environment Variables

Make sure you have `.env` or `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 2: Run Seed Script

```bash
cd apps/web
npm run seed
```

This creates:
- ✅ Demo business owner: `demo@tithi.com` / `Tithi2025$Demo`
- ✅ Business: "Demo Salon" with subdomain `demo`
- ✅ Services, staff, availability, etc.

### Step 3: Access Booking Page

After seeding, try:
```
http://localhost:3000/demo
```

**Note:** The public booking page uses a "fake business" system. If it still doesn't work, see Option 2 below.

---

## Option 2: Use API Endpoints Directly

If the UI page doesn't work, you can test via API endpoints which use the real database:

### Step 1: Get Business Info

First, check if business exists:

```bash
# Get catalog (this will tell you if business exists)
curl http://localhost:3000/api/public/demo/catalog
```

If you get a 404, the business doesn't exist. Run the seed script first.

### Step 2: Create Booking via API

```bash
# First, get the catalog to find service_id and staff_id
curl http://localhost:3000/api/public/demo/catalog | jq

# Then create booking
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "service-id-from-catalog",
    "staff_id": "staff-id-from-catalog",
    "start_at": "2024-12-20T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }'
```

---

## Option 3: Create Business Manually

If you prefer to create a business manually:

### Step 1: Sign Up

1. Go to: `http://localhost:3000/signup`
2. Create an account
3. Complete onboarding steps

### Step 2: Set Subdomain

During onboarding (or in business settings), set subdomain to `demo` (or any name you want).

### Step 3: Access Booking Page

Use your chosen subdomain:
```
http://localhost:3000/your-subdomain
```

---

## Troubleshooting

### Issue: "Page not found" after seeding

**Possible causes:**
1. The public page uses "fake business" system (localStorage), not database
2. Business exists in database but page is looking for it in localStorage

**Solution:**
- Use API endpoints directly: `/api/public/demo/catalog`
- Or check if there's a way to load real businesses in the public page component

### Issue: Seed script fails

**Check:**
1. Environment variables are set correctly
2. Supabase connection works
3. Service role key has proper permissions

**Test connection:**
```bash
# Test database connection
curl http://localhost:3000/api/test-db
```

### Issue: Business exists but page still shows error

The public booking page (`/public/[slug]/page.tsx`) uses `useFakeBusiness` hook which stores businesses in localStorage, not the database.

**Workaround:**
1. Use API endpoints for testing
2. Or modify the page to load from database (requires code changes)

---

## Quick Test: Verify Business Exists

After running seed script, verify the business exists:

```bash
# Test catalog endpoint (uses real database)
curl http://localhost:3000/api/public/demo/catalog

# Should return JSON with business, categories, services, staff
```

If this works, the business exists in the database. The UI page issue is separate.

---

## Recommended Approach for Testing

Since you're testing Stripe/SendGrid/Twilio integrations:

1. **Run seed script** to create business in database
2. **Use API endpoints** for testing (they use real database):
   - `GET /api/public/demo/catalog` - Get business info
   - `POST /api/public/demo/bookings` - Create booking
   - `POST /api/admin/bookings/{id}/complete` - Charge booking

3. **Skip the UI page** if it's using fake businesses - the API endpoints work with real database

---

## Next Steps

1. Run: `npm run seed`
2. Test: `curl http://localhost:3000/api/public/demo/catalog`
3. If catalog works, proceed with booking creation via API
4. Complete bookings via admin API (requires login)

The API endpoints are what matter for Stripe/SendGrid/Twilio testing - the UI page is just a frontend wrapper.


