# Guide: Testing as a Customer

This guide shows you how to test the booking flow as a customer (no login required).

---

## ✅ Fixed: Policies Issue

The policies query has been fixed. The code now uses `.maybeSingle()` instead of `.single()` to properly handle cases where policies might not exist.

---

## 🧪 Testing as a Customer

### Method 1: Using API Endpoints (Recommended)

Since the UI page uses fake businesses, use the API endpoints which work with your real database:

#### Step 1: Get Available Services & Staff

```bash
curl http://localhost:3000/api/public/demo/catalog | jq
```

This returns:
- Services with IDs and prices
- Staff members with IDs
- Categories

#### Step 2: Get Available Time Slots

```bash
# Get availability for a specific service and date
curl "http://localhost:3000/api/public/demo/availability?service_id=6cca8944-c73a-444e-a96c-39a6f5fcd613&date=2025-01-15" | jq
```

Replace:
- `service_id` with a service ID from the catalog
- `date` with a date in the future (YYYY-MM-DD format)

#### Step 3: Create a Booking

```bash
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
    "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
    "start_at": "2025-01-15T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "your-real-email@example.com",
      "phone": "+1234567890"
    }
  }' | jq
```

**Important:**
- Use your **real email** if you want to test email notifications
- Use your **real phone** if you want to test SMS notifications
- Use a **future date/time** for `start_at` (ISO 8601 format)

**Response will include:**
```json
{
  "booking": {
    "id": "booking-id-here",
    "status": "pending",
    "service_id": "...",
    "customer_id": "...",
    ...
  },
  "setupIntent": {
    "clientSecret": "seti_xxx_secret_xxx",
    "setupIntentId": "seti_xxx"
  }
}
```

#### Step 4: Complete Payment Setup (Frontend)

The booking is created, but you need to complete the Stripe SetupIntent to save the payment method. This is typically done on the frontend using Stripe.js.

**For testing purposes**, you can:
1. Use Stripe Dashboard to test the SetupIntent
2. Or proceed to complete the booking as the business owner (which will handle payment)

---

### Method 2: Using the UI (If Available)

If the UI page works:

1. **Navigate to:**
   ```
   http://localhost:3000/demo
   ```

2. **Fill out the booking form:**
   - Select a service
   - Select a staff member
   - Choose a date and time
   - Enter your details:
     - Name
     - Email (use your real email for notifications)
     - Phone (use your real phone for SMS)
   - Enter payment card: `4242 4242 4242 4242` (Stripe test card)

3. **Submit the booking**

---

## 📋 Complete Customer Test Flow

### 1. Create Booking (No Login Required)

```bash
# Get catalog
curl http://localhost:3000/api/public/demo/catalog | jq '.services[0].id, .staff[0].id'

# Create booking (replace with IDs from above)
curl -X POST http://localhost:3000/api/public/demo/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "6cca8944-c73a-444e-a96c-39a6f5fcd613",
    "staff_id": "98e11fe0-de84-4d98-b6f6-2c2640a27f48",
    "start_at": "2025-01-15T10:00:00Z",
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+15551234567"
    }
  }' | jq '.booking.id'
```

**Save the booking ID from the response!**

### 2. Verify Booking Created

Check your database or use the admin API (requires login) to see the booking.

### 3. Complete Booking (Business Owner)

As the business owner, you'll complete the booking to charge the payment:

1. **Log in:**
   - Go to: `http://localhost:3000/login`
   - Email: `demo@tithi.com`
   - Password: `Tithi2025$Demo`

2. **Navigate to Bookings** in admin panel

3. **Find your booking** and click "Complete"

4. **Verify in Stripe Dashboard:**
   - Payment Intent created
   - Payment succeeded
   - Transfer to connected account

---

## 🎯 Quick Test Script

Here's a complete test script you can run:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
SUBDOMAIN="demo"

echo "1. Getting catalog..."
SERVICE_ID=$(curl -s "${BASE_URL}/api/public/${SUBDOMAIN}/catalog" | jq -r '.categories[0].services[0].id')
STAFF_ID=$(curl -s "${BASE_URL}/api/public/${SUBDOMAIN}/catalog" | jq -r '.staff[0].id')

echo "   Service ID: ${SERVICE_ID}"
echo "   Staff ID: ${STAFF_ID}"

echo ""
echo "2. Creating booking..."
BOOKING_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/public/${SUBDOMAIN}/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"service_id\": \"${SERVICE_ID}\",
    \"staff_id\": \"${STAFF_ID}\",
    \"start_at\": \"2025-01-15T10:00:00Z\",
    \"customer\": {
      \"name\": \"Test Customer\",
      \"email\": \"test@example.com\",
      \"phone\": \"+1234567890\"
    }
  }")

echo "$BOOKING_RESPONSE" | jq

BOOKING_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.booking.id')

if [ "$BOOKING_ID" != "null" ] && [ -n "$BOOKING_ID" ]; then
  echo ""
  echo "✅ Booking created successfully!"
  echo "   Booking ID: ${BOOKING_ID}"
  echo ""
  echo "Next steps:"
  echo "1. Log in as business owner: http://localhost:3000/login"
  echo "2. Find booking ${BOOKING_ID} in admin panel"
  echo "3. Click 'Complete' to charge payment"
else
  echo ""
  echo "❌ Booking creation failed"
  echo "$BOOKING_RESPONSE" | jq '.error'
fi
```

Save this as `test-booking.sh`, make it executable, and run it:

```bash
chmod +x test-booking.sh
./test-booking.sh
```

---

## 🔍 Troubleshooting

### Issue: "Business policies not found"

**Fixed!** The code now properly handles missing policies. If you still see this error:
1. Re-run seed script: `npm run seed`
2. Check database directly to verify policies exist

### Issue: "Service not found"

**Check:**
- Service ID is correct (from catalog)
- Service is active (`is_active: true`)
- Service belongs to the business

### Issue: "Time slot not available"

**Check:**
- Date is in the future
- Time slot isn't already booked
- Staff member is available at that time
- Availability rules allow that time slot

### Issue: Booking created but no payment method

**This is expected!** The booking creates a SetupIntent to save the payment method. You need to:
1. Complete the SetupIntent on the frontend (using Stripe.js)
2. Or complete the booking as business owner (which will handle payment)

---

## ✅ Summary

**To test as a customer:**

1. ✅ **No login required** - Public booking API is open
2. ✅ **Use API endpoints** - `/api/public/demo/*`
3. ✅ **Create booking** - POST to `/api/public/demo/bookings`
4. ✅ **Complete as owner** - Log in and complete booking to charge payment

**Main Endpoints:**
- Catalog: `GET /api/public/demo/catalog`
- Availability: `GET /api/public/demo/availability?service_id=...&date=...`
- Create Booking: `POST /api/public/demo/bookings`

**Policies Issue:** ✅ **FIXED** - Code now properly handles policies query

You're ready to test! 🚀


