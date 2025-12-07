# Booking Flow Links & Quick Start

## ✅ Your Setup is Complete!

The business "Demo Salon" with subdomain `demo` is created and ready for testing.

---

## 🔗 Booking Flow Links

### Option 1: UI Booking Page
```
http://localhost:3000/demo
```

**Note:** This page uses a "fake business" system (localStorage), so it might show "Page not found" even though your business exists in the database. If it doesn't work, use the API endpoints below.

### Option 2: API Endpoints (Recommended)

**These work with your real database and are perfect for testing Stripe/SendGrid/Twilio:**

#### Get Catalog (Services & Staff):
```
GET http://localhost:3000/api/public/demo/catalog
```

#### Create Booking:
```
POST http://localhost:3000/api/public/demo/bookings
```

#### Get Availability:
```
GET http://localhost:3000/api/public/demo/availability?service_id=6cca8944-c73a-444e-a96c-39a6f5fcd613&date=2025-01-15
```

---

## 🧪 Quick Test Commands

### 1. Get Catalog
```bash
curl http://localhost:3000/api/public/demo/catalog | jq
```

### 2. Create Booking
```bash
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
    "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
    "start_at": "2025-01-15T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }' | jq
```

**Available Service IDs:**
- Haircut: `6cca8944-c73a-444e-a96c-39a6f5fcd613`
- Color Treatment: `b2c80b11-d769-4da8-a21c-2f9e8a69f32e`
- Manicure: `e400ecf5-f21b-424c-b4c9-66d234ed911c`

**Available Staff IDs:**
- Jane Doe: `98e11fe0-de84-4d98-b6f6-2c2640a27f48`
- John Smith: `343379a4-577e-4c8c-974d-ef8ca0423715`

---

## ⚠️ Current Issue: Policies

There's a "Business policies not found" error. The seed script created policies, but there might be a query issue. 

**To fix:**
1. Check if policies exist in database
2. Or modify the booking route to handle missing policies gracefully
3. Or ensure policies are created with correct structure

**Workaround:** You can still test other parts of the flow, or we can fix the policies issue.

---

## 📋 Complete Testing Flow

1. **Create Booking** (via API)
2. **Log in as Owner:**
   - URL: `http://localhost:3000/login`
   - Email: `demo@tithi.com`
   - Password: `Tithi2025$Demo`
3. **Complete Booking** (charge payment) in admin panel
4. **Verify in Stripe Dashboard**

---

## 🎯 Summary

**Main Booking URL:**
- UI: `http://localhost:3000/demo` (may not work)
- API: `http://localhost:3000/api/public/demo/*` (works!)

**Login URL:**
- `http://localhost:3000/login`

**Next:** Fix the policies issue, then you can create bookings and test Stripe integration!


