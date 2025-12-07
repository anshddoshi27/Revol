# Booking Flow Authentication Guide

This guide explains what authentication you need (or don't need) for testing the booking flow.

---

## ✅ Public Booking Page: NO LOGIN REQUIRED

**You're correct!** The public booking page is designed for customers who don't have accounts. You don't need to log in to create a booking.

### How It Works:

1. **Navigate to Public Booking Page:**
   ```
   http://localhost:3000/[subdomain]
   ```
   Example: `http://localhost:3000/demo`

2. **Fill out the booking form:**
   - Select service
   - Select staff
   - Choose date/time
   - Enter customer details (name, email, phone)
   - Enter payment card details

3. **Submit the booking:**
   - No login required!
   - Booking is created as a "guest" customer
   - Payment method is saved (via Stripe SetupIntent)
   - You'll see a confirmation

### What Happens Behind the Scenes:

- The API endpoint `/api/public/{slug}/bookings` is **public** (no auth required)
- A customer record is created automatically (or found if email exists)
- The booking is created with status `pending`
- Payment method is saved but **not charged yet**

---

## 🔐 Admin Panel: LOGIN REQUIRED

To **complete/charge** a booking, you need to log in as the **business owner**.

### Step 1: Create a Business Owner Account

You have two options:

#### Option A: Use the Seed Script (Recommended)

The seed script creates a demo business owner account:

```bash
cd apps/web
npm run seed
```

This creates:
- **Email:** `demo@tithi.com`
- **Password:** `Tithi2025$Demo`
- **Business:** "Demo Salon" with subdomain `demo`

#### Option B: Create Account Manually

1. Go to your app's sign-up page (if you have one)
2. Create a business owner account
3. Complete business setup

### Step 2: Log In as Business Owner

1. **Navigate to login page:**
   ```
   http://localhost:3000/login
   ```
   (or wherever your login page is)

2. **Log in with:**
   - Email: `demo@tithi.com` (or your business owner email)
   - Password: `Tithi2025$Demo` (or your password)

3. **You'll be redirected to admin panel**

### Step 3: Complete/Charge the Booking

1. **Navigate to Bookings:**
   - Go to admin panel → Bookings section
   - Find the booking you created (as a customer)
   - Click on it to view details

2. **Complete the Booking:**
   - Click "Complete" or "Charge" button
   - This will create a PaymentIntent and charge the saved card
   - Requires authentication (you're logged in as business owner)

---

## 📋 Complete Testing Flow

Here's the complete flow for testing:

### Phase 1: Create Booking (No Login)

1. **Open incognito/private browser window** (to simulate a customer)
2. Navigate to: `http://localhost:3000/demo` (or your subdomain)
3. Fill out booking form:
   - Service: Select any service
   - Staff: Select any staff member
   - Date/Time: Pick a future date/time
   - Customer:
     - Name: `Test Customer`
     - Email: `test@example.com` (use your real email for notifications)
     - Phone: `+1234567890` (use your real phone for SMS)
   - Card: `4242 4242 4242 4242` (Stripe test card)
4. Submit booking
5. **Note the booking ID** (from confirmation or URL)

### Phase 2: Complete Booking (Login Required)

1. **Open regular browser window** (or different browser)
2. Navigate to: `http://localhost:3000/login`
3. Log in as business owner:
   - Email: `demo@tithi.com`
   - Password: `Tithi2025$Demo`
4. Navigate to Bookings section
5. Find the booking you just created
6. Click "Complete" to charge the payment
7. Verify payment in Stripe Dashboard

---

## 🔍 How to Find Your Login Page

If you're not sure where the login page is:

1. **Check your app routes:**
   ```bash
   # Look for login/auth pages
   ls apps/web/src/app/
   ```

2. **Common locations:**
   - `/login`
   - `/auth/login`
   - `/signin`
   - `/admin/login`

3. **Or check your navigation/routing:**
   - Look for links to "Login" or "Sign In"
   - Check if there's a redirect when accessing `/admin` without auth

---

## 🧪 Testing Without UI (API Only)

If you want to test via API without using the UI:

### 1. Create Booking (No Auth):

```bash
curl -X POST "http://localhost:3000/api/public/demo/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "your-service-id",
    "staff_id": "your-staff-id",
    "start_at": "2024-12-20T10:00:00Z",
    "customer": {
      "name": "Test Customer",
      "email": "test@example.com",
      "phone": "+1234567890"
    }
  }'
```

**Response includes:**
- `booking.id` - Save this!
- `setupIntent.clientSecret` - For completing card setup

### 2. Complete Booking (Requires Auth):

You'll need to get a session cookie first. Options:

#### Option A: Use Browser DevTools
1. Log in via browser
2. Open DevTools → Application/Storage → Cookies
3. Copy the session cookie
4. Use it in your API call:

```bash
BOOKING_ID="your-booking-id"
SESSION_COOKIE="your-session-cookie-from-browser"
IDEMPOTENCY_KEY="unique-key-$(date +%s)"

curl -X POST "http://localhost:3000/api/admin/bookings/${BOOKING_ID}/complete" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${SESSION_COOKIE}" \
  -H "X-Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{}'
```

#### Option B: Create Auth Token Programmatically

Check if your app has an auth API endpoint to get tokens.

---

## 🎯 Quick Start Checklist

For testing the booking flow:

- [ ] **Seed the database** (creates demo business owner):
  ```bash
  npm run seed
  ```

- [ ] **Create booking as customer** (no login):
  - Go to `http://localhost:3000/demo`
  - Fill form and submit
  - Note booking ID

- [ ] **Log in as business owner**:
  - Go to `http://localhost:3000/login`
  - Email: `demo@tithi.com`
  - Password: `Tithi2025$Demo`

- [ ] **Complete booking** (charge payment):
  - Go to Bookings in admin panel
  - Find your booking
  - Click "Complete"

- [ ] **Verify in Stripe Dashboard**:
  - Check Payment Intents
  - Verify payment succeeded
  - Verify transfer to connected account

---

## ❓ Common Questions

### Q: Do I need to create a customer account first?

**A:** No! The public booking flow creates customer records automatically. When a customer enters their email, the system:
- Checks if a customer with that email exists
- Creates one if it doesn't exist
- Links the booking to that customer

### Q: Can I test without running the seed script?

**A:** Yes, but you'll need:
1. A business owner account (create manually or use seed)
2. A business with at least one service and staff member
3. The business subdomain

The seed script just makes this easier by creating everything for you.

### Q: What if I don't have a login page?

**A:** You might need to:
1. Check if authentication is handled differently (e.g., magic links)
2. Create a simple login page
3. Or use API calls with session cookies from browser

### Q: Can I test the complete flow without logging in?

**A:** No. The `/api/admin/bookings/{id}/complete` endpoint requires authentication. This is by design - only business owners should be able to charge customers.

---

## 📝 Summary

**For Creating Bookings:**
- ✅ **NO login required**
- ✅ Use public booking page: `http://localhost:3000/[subdomain]`
- ✅ Fill form and submit
- ✅ Works as a "guest" customer

**For Completing/Charging Bookings:**
- 🔐 **Login required** (business owner)
- 🔐 Use admin panel
- 🔐 Navigate to Bookings → Complete
- 🔐 Requires authentication

**Recommended Flow:**
1. Run seed script: `npm run seed`
2. Create booking as customer (no login): `http://localhost:3000/demo`
3. Log in as owner: `demo@tithi.com` / `Tithi2025$Demo`
4. Complete booking in admin panel
5. Verify in Stripe Dashboard

---

**You're all set!** The public booking page works exactly as you thought - no customer login needed. You only need to log in as the business owner to complete/charge bookings.


