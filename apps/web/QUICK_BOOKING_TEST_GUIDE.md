# Quick Booking Test Guide

## ✅ Your Business is Set Up!

The seed script ran successfully. Here's how to test the booking flow:

---

## 🔗 Booking Flow Links

### Option 1: UI Page (If Available)
```
http://localhost:3000/demo
```

**Note:** This page uses a "fake business" system (localStorage), so it might not work with your real database. If you see "Page not found", use Option 2.

### Option 2: API Endpoints (Recommended for Testing)

The API endpoints work with your real database and are perfect for testing Stripe/SendGrid/Twilio:

**Catalog (Get Services & Staff):**
```bash
curl http://localhost:3000/api/public/demo/catalog | jq
```

**Create Booking:**
```bash
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
    "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
    "start_at": "2024-12-20T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }'
```

---

## 🔧 Fix Policies Issue

If you get "Business policies not found", the policies might not have been created. Run the seed script again:

```bash
cd apps/web
npm run seed
```

This should create the policies. The seed script shows:
```
8️⃣ Creating policies...
   ✓ Created policies
```

---

## 📋 Available Services & Staff (From Your Catalog)

**Services:**
- **Haircut** - ID: `6cca8944-c73a-444e-a96c-39a6f5fcd613` - $50 (30 min)
- **Color Treatment** - ID: `b2c80b11-d769-4da8-a21c-2f9e8a69f32e` - $150 (90 min)
- **Manicure** - ID: `e400ecf5-f21b-424c-b4c9-66d234ed911c` - $35 (45 min)

**Staff:**
- **Jane Doe** (Senior Stylist) - ID: `98e11fe0-de84-4d98-b6f6-2c2640a27f48`
- **John Smith** (Color Specialist) - ID: `343379a4-577e-4c8c-974d-ef8ca0423715`

---

## 🧪 Complete Test Flow

### Step 1: Verify Policies Exist

```bash
# Re-run seed to ensure policies are created
npm run seed
```

### Step 2: Create a Booking

```bash
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
    "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
    "start_at": "2024-12-20T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "your-real-email@example.com",
      "phone": "+1234567890"
    }
  }' | jq
```

**Expected Response:**
```json
{
  "booking": {
    "id": "booking-id",
    "status": "pending",
    ...
  },
  "setupIntent": {
    "clientSecret": "seti_xxx_secret_xxx",
    "setupIntentId": "seti_xxx"
  }
}
```

### Step 3: Complete the Booking (Charge Payment)

1. **Log in as business owner:**
   - Go to: `http://localhost:3000/login`
   - Email: `demo@tithi.com`
   - Password: `Tithi2025$Demo`

2. **Navigate to Bookings** in admin panel

3. **Find your booking** and click "Complete"

4. **Verify in Stripe Dashboard:**
   - Check Payment Intents
   - Verify payment succeeded
   - Verify transfer to connected account

---

## 🎯 Quick Test Commands

```bash
# 1. Get catalog
curl http://localhost:3000/api/public/demo/catalog | jq '.services[0].id, .staff[0].id'

# 2. Create booking (replace IDs from step 1)
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "YOUR_SERVICE_ID",
    "staff_id": "YOUR_STAFF_ID",
    "start_at": "2024-12-20T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }' | jq

# 3. Check booking was created
# (Use the booking ID from step 2 response)
```

---

## ✅ Summary

**Booking Flow URL:**
- UI: `http://localhost:3000/demo` (may not work if using fake businesses)
- API: `http://localhost:3000/api/public/demo/*` (works with real database)

**Next Steps:**
1. Fix policies issue (re-run seed if needed)
2. Create booking via API
3. Log in as owner and complete booking
4. Verify in Stripe Dashboard

You're ready to test! 🚀


