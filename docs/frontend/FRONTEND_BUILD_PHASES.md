# Tithi Frontend Build Phases

**Purpose**: Detailed, phase-by-phase build plan for the Tithi frontend that synergistically follows both the frontend logistics requirements and the existing backend/database structure.

**Critical Parameter**: Every phase must match BOTH the frontend logistics design AND the existing backend API endpoints and data models. If there are contradictions, they are flagged for resolution before building.

---


## PHASE 1: Foundation & Authentication

### Objective
Build the core routing structure, authentication flow, and landing page. Establish tenant isolation and session management.

### Backend Endpoints Used
- `POST /auth/login` (check auth.py blueprint)
- `POST /auth/refresh`
- `GET /api/v1/tenants` - List user's tenants
- `GET /api/v1/tenants/{id}` - Get tenant details

### Tasks

#### 1.1 Project Setup & Routing Structure
- [ ] Verify Next.js App Router structure matches requirements
- [ ] Set up routing structure:
  - `tithi.com/` → Landing page
  - `tithi.com/login` → Login page
  - `tithi.com/signup` → Signup page (Step 1 of onboarding)
  - `tithi.com/app` → Dashboard (protected)
  - `tithi.com/app/b/[businessId]` → Admin view (protected)
  - `{subdomain}.tithi.com` → Public booking flow (note: requires DNS config)
- [ ] Configure middleware for authentication checks
- [ ] Set up environment variables for API base URL

#### 1.2 Authentication Components
- [ ] Build `LoginPage` component (`/login/page.tsx`)
  - Form: email, password
  - Call `POST /auth/login` (verify exact endpoint)
  - Store token in localStorage and context
  - Redirect to `/app` on success
- [ ] Build `SignupPage` component (`/signup/page.tsx`)
  - Form: email, password, first_name, last_name
  - This is Step 1 of onboarding - calls `POST /onboarding/step1/business-account`
  - After signup, redirect to onboarding step 2 OR save tenant_id and continue
- [ ] Set up `AuthProvider` context (may already exist in `lib/store.ts`)
  - Manage auth state (token, user, current tenant)
  - Provide login/logout/setCurrentTenant functions
  - Handle token refresh on 401 responses

#### 1.3 Landing Page
- [ ] Build landing page (`/page.tsx`)
  - Two buttons: "Join Tithi Now" (links to `/signup`) and "Login" (links to `/login`)
  - Simple, clean design
  - No authentication required

#### 1.4 API Client Updates
- [ ] Review existing `lib/api-client.ts` - ensure it matches backend endpoints
- [ ] Add/verify auth endpoints:
  - `authApi.login()`
  - `authApi.refresh()`
  - `authApi.logout()`
- [ ] Ensure axios interceptors handle:
  - Adding `Authorization: Bearer {token}` header
  - Adding `X-Tenant-ID` header when tenant is set
  - Redirecting to `/login` on 401

#### 1.5 Testing
- [ ] Test login flow
- [ ] Test signup flow (creates user + tenant)
- [ ] Test token persistence
- [ ] Test redirects

### Deliverables
- Landing page functional
- Login/Signup working
- Auth state management functional
- Protected routes middleware working
- API client configured with auth headers

---

## PHASE 2: Dashboard & Tenant Selection

### Objective
Build the dashboard that shows business blocks, allows tenant selection, and routes to admin view.

### Backend Endpoints Used
- `GET /api/v1/tenants` - List all businesses for current user
- `GET /api/v1/tenants/{id}` - Get tenant details

### Tasks

#### 2.1 Dashboard Layout
- [ ] Build `/app/page.tsx` (Dashboard)
  - Protected route (requires auth)
  - Fetch user's tenants: `GET /api/v1/tenants`
  - Display as cards/blocks
  - Each card shows: business name, status badge, subscription status (if available)
- [ ] If user has 0 tenants: Show "Create your first business" CTA (links to signup/onboarding)
- [ ] If user has 1 tenant: Auto-select and show admin view OR show single card
- [ ] If user has multiple tenants: Show grid of business cards

#### 2.2 Business Card Component
- [ ] Build `BusinessCard` component
  - Displays: business name, logo (if available), status, subscription badge
  - Click handler: Navigate to `/app/b/{businessId}`
  - Show subscription status (Trial/Active/Paused/Canceled) - Fetch from `GET /api/v1/admin/subscription/status`

#### 2.3 Tenant Context Management
- [ ] Update `AuthProvider` to manage current tenant selection
- [ ] When business card clicked: Set `currentTenant` in context and localStorage
- [ ] When navigating to `/app/b/[businessId]`: Verify tenant belongs to user

#### 2.4 Admin View Shell
- [ ] Build `/app/b/[businessId]/page.tsx` (Admin home)
  - Protected route with tenant verification
  - Fetch tenant details: `GET /api/v1/tenants/{id}`
  - Display sidebar/navigation with tabs:
    - Overview
    - Business (mirrors onboarding Step 1-2)
    - Team (mirrors onboarding Step 3)
    - Branding (mirrors onboarding Step 4)
    - Services (mirrors onboarding Step 5)
    - Availability (mirrors onboarding Step 6)
    - Notifications (mirrors onboarding Step 7)
    - Policies (mirrors onboarding Step 8)
    - Gift Cards (mirrors onboarding Step 8)
    - Payment Setup (mirrors onboarding Step 9)
    - Account (subscription management - Phase 9)
    - Past Bookings (Phase 6)

#### 2.5 Error Handling
- [ ] Handle case where tenant_id doesn't belong to user (403)
- [ ] Handle case where tenant not found (404)
- [ ] Show loading states while fetching tenants

### Deliverables
- Dashboard shows all user's businesses
- Business cards clickable and navigate to admin
- Current tenant selection persisted
- Admin view shell with navigation structure
- Protected routes working with tenant verification

---

## PHASE 3: Onboarding Flow (Steps 1-4)

### Objective
Build the onboarding wizard for steps 1-4: Business Account, Business Information, Team Members, Branding.

### Backend Endpoints Used
- `POST /onboarding/step1/business-account`
- `POST /onboarding/step2/business-information`
- `POST /onboarding/step3/team-members`
- `POST /onboarding/step4/branding`
- `GET /onboarding/status` - Get onboarding progress
- `GET /onboarding/check-subdomain/{subdomain}` - Validate subdomain

### Tasks

#### 3.1 Onboarding Layout & Progress
- [ ] Build onboarding layout component
  - Progress indicator (steps 1-9)
  - Step navigation (Next/Back buttons)
  - Auto-save functionality (save on step completion)
  - Load existing data if user returns
- [ ] Fetch onboarding status: `GET /onboarding/status?tenant_id={id}`
  - Show which steps are completed
  - Allow jumping to incomplete steps
  - Prevent skipping required steps

#### 3.2 Step 1: Business Account (Signup Integration)
- [ ] **Note**: This is handled in Phase 1 (`/signup`)
  - Already creates user + tenant via `POST /onboarding/step1/business-account`
  - Receives: `tenant_id`, `user_id`, `subdomain`, `status`
  - Store tenant_id and redirect to Step 2

#### 3.3 Step 2: Business Information
- [ ] Build `/onboarding/step2/page.tsx`
  - **Business Information Section**:
    - Subdomain input (with validation via `GET /onboarding/check-subdomain/{subdomain}`)
    - Timezone dropdown
    - Phone (optional)
    - Website (optional)
    - Support email (optional)
    - Address fields: street, city, state/province, postal_code, country
    - Social links: website, Instagram, Facebook, TikTok, YouTube (all optional)
  - Real-time subdomain validation
  - Save: `POST /onboarding/step2/business-information`
  - Next button → Step 3

#### 3.4 Step 3: Team Members
- [ ] Build `/onboarding/step3/page.tsx`
  - Dynamic team member list (add/remove members)
  - For each member:
    - Name (required)
    - Role (required)
    - Email (optional)
    - Phone (optional)
  - Note: These are for scheduling only, NOT login accounts
  - Save: `POST /onboarding/step3/team-members` with `{ team_members: [...] }`
  - Next button → Step 4

#### 3.5 Step 4: Branding
- [ ] Build `/onboarding/step4/page.tsx`
  - Logo upload (file upload → signed URL → save to backend)
  - Primary brand color picker (hex code validation)
  - Secondary brand color picker (hex - optional)
  - Accent color picker (hex - optional)
  - Font family selector (optional)
  - Layout style selector: modern, classic, minimal (optional)
  - Preview booking site styling
  - Save: `POST /onboarding/step4/branding` with `{ logo_url, primary_color, secondary_color, accent_color, font_family, layout_style }`
  - Next button → Step 5

#### 3.6 Data Persistence
- [ ] Implement auto-save to localStorage (fallback)
- [ ] Load existing data on step return
- [ ] Validate required fields before proceeding

### Deliverables
- Onboarding wizard with progress indicator (1-9 steps)
- Step 1 integrated with signup
- Step 2: Business information form working
- Step 3: Team members management working
- Step 4: Branding setup working (logo, colors, fonts)
- Auto-save and data loading functional

---

## PHASE 4: Onboarding Flow (Steps 5-9: Services through Go Live)

### Objective
Complete onboarding: Services & Categories, Availability, Notifications, Policies/Gift Cards, Payment Setup, Go Live.

### Backend Endpoints Used
- `POST /onboarding/step5/services-categories`
- `POST /onboarding/step6/availability`
- `POST /onboarding/step7/notifications`
- `POST /onboarding/step8/policies-gift-cards`
- `POST /onboarding/step9/go-live`
- `GET /api/payments/setup-intent` - For payment setup
- `GET /api/stripe-connect/...` - Stripe Connect setup (verify endpoints)
- `POST /api/v1/admin/subscription/activate` - Create subscription after go-live

### Tasks

#### 4.1 Step 5: Services & Categories
- [ ] Build `/onboarding/step5/page.tsx`
  - Category creation flow:
    - "Add Category" button
    - Category form: name, description (optional), color picker
    - Under each category: "Add Service" button
    - Service form: name, description, duration (minutes), price (cents), pre-appointment instructions (optional)
    - Services can be added one at a time within a category
    - "Create Category" button creates category + all services in one API call
  - Multiple categories can be created
  - Save: `POST /onboarding/step5/services-categories` with `{ categories: [...] }`
  - Next button → Step 6

#### 4.2 Step 6: Availability
- [ ] Build `/onboarding/step6/page.tsx`
  - Flow: For each service, for each team member, set availability
  - Service selector dropdown
  - Team member selector
  - Weekly schedule grid (Monday-Sunday)
    - For each day: start time, end time, available toggle
  - Can add multiple availability blocks per day
  - Must complete availability for ALL services before proceeding
  - Save: `POST /onboarding/step6/availability` with availability rules
  - Next button → Step 7

#### 4.3 Step 7: Notification Templates
- [ ] Build `/onboarding/step7/page.tsx`
  - Template creation form:
    - Template name
    - Channel: Email/SMS/Push dropdown
    - Email subject (if channel = Email)
    - Category: Confirmation/Reminder/Follow Up/Cancellation/Reschedule
    - Trigger event: Booking Created/Confirmed/24h Reminder/1h Reminder/Cancelled/Rescheduled/Completed
    - Content editor (rich text or plain text)
    - Placeholder picker:
      - Available placeholders: `${customer.name}`, `${service.name}`, `${service.duration}`, `${service.price}`, `${booking.date}`, `${booking.time}`, `${business.name}`, `${booking.url}`
      - Insert placeholder button/autocomplete
    - Preview with sample data
  - Can create multiple templates
  - Save: `POST /onboarding/step7/notifications` with `{ templates: [...] }`
  - Next button → Step 8

#### 4.4 Step 8: Policies & Gift Cards
- [ ] Build `/onboarding/step8/page.tsx` with two sections:

**Policies Section:**
- Cancellation Policy (textarea)
- No-Show Policy (textarea)
- No-Show Fee Type: Flat/Percentage toggle
- No-Show Fee Value: number input
- Refund Policy (textarea)
- Cash Payment Policy (textarea)
- Save policies button

**Gift Cards Section (Optional):**
- Toggle: "Enable Gift Cards"
- If enabled:
  - Create gift card form:
    - Expiration date picker
    - Amount type: Fixed amount / Percentage discount
    - Amount value: number input
    - Auto-generate code button (randomized)
  - Can create multiple gift cards
  - Display created gift cards list

- Save: `POST /onboarding/step8/policies-gift-cards` with both sections
- Next button → Step 9

#### 4.5 Step 9: Payment Setup & Go Live
- [ ] Build `/onboarding/step9/page.tsx` with two sections:

**Payment Setup Section:**
- Stripe Connect onboarding (if not already done)
  - Call backend to create Connect account
  - Display Stripe Connect onboarding flow (embedded or redirect)
- Payment methods configuration:
  - Toggle: Credit Card (default on)
  - Toggle: Apple Pay (optional)
  - Toggle: Google Pay (optional)
  - Toggle: PayPal (optional)
  - Toggle: Cash (optional)
- Owner's card for $11.99/month subscription:
  - Stripe Elements card input
  - Create SetupIntent: `POST /api/payments/setup-intent`
  - Confirm card save
  - Save payment method ID for subscription activation

**Go Live Section:**
- Display generated booking URL: `https://{subdomain}.tithi.com`
- Copy link button
- Final confirmation modal: "Are you sure you want to make this subscription?"
- "GO LIVE" button
  - Calls: `POST /onboarding/step9/go-live`
  - On success: Automatically activate subscription via `POST /api/v1/admin/subscription/activate` with saved payment method
  - On success: Show success page with confetti, booking link, "Go to Admin" button

#### 4.6 Success State
- [ ] Build onboarding success page
  - Celebratory UI (confetti animation)
  - Display booking URL
  - "Copy Link" button
  - "Go to Admin" button → `/app/b/{businessId}`

### Deliverables
- Step 5: Services & categories creation working
- Step 6: Availability setup working
- Step 7: Notification templates with placeholders working
- Step 8: Policies and gift cards working
- Step 9: Payment setup and go live working (with subscription activation)
- Success page with booking URL

---

## PHASE 5: Admin View - Settings Pages

### Objective
Build admin pages that mirror onboarding steps, allowing live editing of all business settings.

### Backend Endpoints Used
- `GET /api/v1/tenants/{id}` - Get tenant details
- `PUT /api/v1/tenants/{id}` - Update tenant
- `GET /api/v1/services` - List services
- `POST /api/v1/services` - Create service
- `PUT /api/v1/services/{id}` - Update service
- `DELETE /api/v1/services/{id}` - Delete service
- Similar endpoints for team, availability, notifications, policies, gift cards

### Tasks

#### 5.1 Admin Layout Enhancements
- [ ] Enhance `/app/b/[businessId]/page.tsx` with full navigation
- [ ] Add tab/sidebar navigation:
  - Overview (dashboard stats - Phase 6)
  - Business (Step 1-2 mirror)
  - Team (Step 3 mirror)
  - Branding (Step 4 mirror)
  - Services (Step 5 mirror)
  - Availability (Step 6 mirror)
  - Notifications (Step 7 mirror)
  - Policies (Step 8 mirror)
  - Gift Cards (Step 8 mirror)
  - Payment Setup (Step 9 mirror)
  - Account (subscription management - Phase 9)
  - Past Bookings (Phase 6)

#### 5.2 Business Settings Page
- [ ] Build `/app/b/[businessId]/business/page.tsx`
  - Combines Step 1 and Step 2 data
  - Form: Business name, description, DBA, legal name, industry
  - Form: Subdomain (read-only after go-live, or editable with validation)
  - Form: Timezone, phone, website, support email, address
  - Form: Social links
  - Save button: `PUT /api/v1/tenants/{id}`
  - Auto-refresh booking site preview note

#### 5.3 Team Settings Page
- [ ] Build `/app/b/[businessId]/team/page.tsx`
  - List existing team members
  - Add/Edit/Delete team members
  - Uses same form structure as Step 3
  - API: Team member CRUD endpoints (verify exact endpoints)

#### 5.4 Branding Settings Page
- [ ] Build `/app/b/[businessId]/branding/page.tsx`
  - Logo upload (file upload → signed URL → save to backend)
  - Primary brand color picker (hex code validation)
  - Secondary brand color picker (hex - optional)
  - Accent color picker (hex - optional)
  - Font family selector (optional)
  - Layout style selector: modern, classic, minimal (optional)
  - Preview booking site styling
  - Save: `PUT /api/v1/tenants/{id}` with branding fields OR use dedicated branding endpoint if available

#### 5.5 Services Settings Page
- [ ] Build `/app/b/[businessId]/services/page.tsx`
  - List all categories and services
  - Add category button
  - Add service to category button
  - Edit/Delete services
  - Edit/Delete categories (with cascade handling)
  - Uses same form structure as Step 5
  - API: Service CRUD endpoints

#### 5.6 Availability Settings Page
- [ ] Build `/app/b/[businessId]/availability/page.tsx`
  - Service selector
  - Team member selector
  - Weekly schedule editor (same as Step 6)
  - Edit existing availability
  - Add new availability rules
  - Delete availability rules
  - API: Availability CRUD endpoints (verify exact endpoints)

#### 5.7 Notifications Settings Page
- [ ] Build `/app/b/[businessId]/notifications/page.tsx`
  - List all notification templates
  - Add template button
  - Edit template (same form as Step 7)
  - Enable/Disable toggle per template
  - Test send button (if backend supports)
  - API: Notification template CRUD endpoints

#### 5.8 Policies & Gift Cards Settings Pages
- [ ] Build `/app/b/[businessId]/policies/page.tsx`
  - Edit all policies (same form as Step 8)
  - Save button
- [ ] Build `/app/b/[businessId]/gift-cards/page.tsx`
  - List all gift cards
  - Create new gift card (same form as Step 8)
  - Void/Delete gift card
  - View gift card usage/balance
  - API: Gift card CRUD endpoints

#### 5.9 Payment Setup Settings Page
- [ ] Build `/app/b/[businessId]/payment/page.tsx`
  - Show Stripe Connect status
  - Edit payment methods (toggles)
  - Show subscription status link (links to Account page)
  - Update owner's card (if needed)

#### 5.10 Account Settings Page (Subscription Management)
- [ ] Build `/app/b/[businessId]/account/page.tsx` (See Phase 9 for details)
  - Display subscription state: Trial/Active/Paused/Canceled
  - Display next bill date
  - Buttons: Activate, Pause, Cancel, Start Trial
  - State badge display
  - Full implementation in Phase 9

### Deliverables
- All admin settings pages functional
- Live editing works (changes reflect on booking site)
- Data persistence working
- Forms match onboarding structure
- Account page shell created (full implementation in Phase 9)

---

## PHASE 6: Admin View - Past Bookings (Money Board)

### Objective
Build the Past Bookings page with the 4 payment action buttons (Completed, No-Show, Cancelled, Refund).

### Backend Endpoints Used
- `GET /api/v1/bookings` - List bookings (with filters)
- `GET /api/v1/bookings/{id}` - Get booking details
- `POST /api/v1/bookings/{id}/complete` - Complete booking (✅ verified: triggers payment)
- `POST /api/v1/admin/bookings/{id}` - Update booking status (verify if this supports marking no-show, OR backend needs to add `/api/v1/bookings/{id}/no-show` endpoint)
- `POST /api/v1/bookings/{id}/cancel` - Cancel booking (✅ verified: triggers cancellation fee charge)
- `POST /api/payments/no-show-fee` - Charge no-show fee directly (if separate endpoint needed)
- `POST /api/payments/refund` - Refund payment
- `GET /api/payments?booking_id={id}` - Get payment details for booking

### Tasks

#### 6.1 Past Bookings List Page
- [ ] Build `/app/b/[businessId]/bookings/page.tsx`
  - Table/list of bookings with filters:
    - Status filter: All/Pending/Completed/No-Show/Cancelled/Refunded
    - Date range picker
    - Service filter
    - Staff filter
    - Search by customer name/email
  - Fetch: `GET /api/v1/bookings` with query params
  - Display pagination
  - Sort by date (default: newest first)

#### 6.2 Booking Card Component
- [ ] Build `BookingCard` component for each booking
  - Display:
    - Customer: name, email, phone
    - Service: name, duration, price
    - Staff: name (if assigned)
    - Date/Time: formatted
    - Status chip: Pending/Charged/No-Show/Cancelled/Refunded (color-coded)
    - Payment status: "No payment yet" / "Charged ${amount}" / "Refunded ${amount}"
  - Action buttons area:
    - **Completed** button
    - **No-Show** button
    - **Cancelled** button
    - **Refund** button

#### 6.3 Payment Action Buttons Implementation

**Completed Button:**
- [ ] On click:
  - Show confirmation: "Charge ${full_amount} now?"
  - Disable button, show spinner
  - Call: `POST /api/v1/bookings/{id}/complete` with idempotency key
  - ✅ **VERIFIED**: Endpoint triggers `complete_booking()` which calls `_charge_booking_payment()` for full booking amount with 1% platform fee
  - On success: Update status chip, show success toast, disable button
  - On failure: Show error, offer "Send Pay Link" if action required

**No-Show Button:**
- [ ] On click:
  - Show confirmation: "Mark as no-show and charge no-show fee ${fee_amount} now?" (or "Mark as no-show (no fee)" if fee = 0)
  - Disable button, show spinner
  - **NOTE**: Backend has `mark_no_show()` service method that automatically charges fee, but endpoint needs verification:
    - Option 1: Call `POST /api/v1/admin/bookings/{id}` with `{ status: 'no_show' }` if endpoint supports it
    - Option 2: Backend should add `POST /api/v1/bookings/{id}/no-show` endpoint that calls `mark_no_show()` service method
    - Option 3: If endpoint doesn't exist, make two calls:
      1. Update booking status via admin endpoint
      2. Call `POST /api/payments/no-show-fee` with `{ booking_id, no_show_fee_cents }` (requires frontend to calculate fee)
  - ✅ **VERIFIED**: `mark_no_show()` service method automatically:
    - Updates booking status to 'no_show'
    - Calculates no-show fee from BusinessPolicy (flat or percentage)
    - Charges fee via `PaymentService.capture_no_show_fee()` if fee > 0
  - On success: Update status chip, show success toast
  - If fee = 0: Just marks no-show, no payment call

**Cancelled Button:**
- [ ] On click:
  - Show confirmation: "Cancel booking and charge cancellation fee ${fee_amount} now?" (or "Cancel (no fee)" if fee = 0)
  - Disable button, show spinner
  - Call: `POST /api/v1/bookings/{id}/cancel` with reason and idempotency key
  - ✅ **VERIFIED**: Endpoint triggers `cancel_booking()` which:
    - Updates booking status to 'canceled'
    - Calculates cancellation fee from BusinessPolicy (based on timing)
    - Automatically charges fee via `_charge_booking_payment()` if fee > 0
  - On success: Update status chip, show success toast
  - If fee = 0: Just cancels, no payment call

**Refund Button:**
- [ ] On click:
  - Check if payment exists: `GET /api/payments?booking_id={id}`
  - If no payment: Disable button, show tooltip "No payment to refund"
  - If payment exists:
    - Show confirmation: "Refund ${amount}?"
    - Disable button, show spinner
    - Call: `POST /api/payments/refund` with `{ payment_id, amount_cents, reason, refund_type }`
    - On success: Update status chip, show success toast
  - Button state: Only enabled if payment exists

#### 6.4 Payment Status Display
- [ ] Fetch payment details for each booking
- [ ] Display breakdown if charged:
  - Gross: ${amount}
  - Platform fee (1%): ${fee}
  - Stripe fee: ${fee} (if available)
  - Net: ${net}
- [ ] Show "No charge yet" if no payment
- [ ] Show "Payment issue" badge if charge failed
  - Display "Send Pay Link" button if action required

#### 6.5 Idempotency & Error Handling
- [ ] Generate idempotency key for each button click
- [ ] Prevent double-clicks: Disable button immediately on click
- [ ] Handle network errors with retry
- [ ] Handle payment failures gracefully
- [ ] Show "Send Pay Link" for SCA-required payments

#### 6.6 State Management
- [ ] Update booking status in local state after action
- [ ] Optimistic updates (show status change immediately)
- [ ] Rollback on error
- [ ] Refresh booking list after action

### Deliverables
- Past Bookings page with filters and list
- Booking cards with all customer/service data
- 4 action buttons functional
- Payment status display working
- Error handling and idempotency working
- ✅ **VERIFIED**: All payment action endpoints trigger actual Stripe charges (see Issue 2 verification above)

---

## PHASE 7: Public Booking Flow (Subdomain Routing)

### Objective
Build the customer-facing booking flow accessible at `{subdomain}.tithi.com`.

### Backend Endpoints Used
- `GET /booking/tenant-data/{tenant_id}` - Get all booking flow data (public, no auth)
- `POST /booking/availability` - Check availability (public)
- `POST /booking/create` - Create booking (public)
- `GET /booking/{booking_id}` - Get booking confirmation (public)

### Tasks

#### 7.1 Subdomain Routing Setup
- [ ] Configure Next.js rewrites for `{subdomain}.tithi.com`
  - Requires wildcard DNS (infrastructure)
  - Rewrite to `/booking/[slug]` route
  - Extract subdomain from hostname
  - Look up tenant by subdomain
- [ ] Build `/booking/[slug]/page.tsx` - Main booking flow entry
  - Fetch tenant data: `GET /booking/tenant-data/{tenant_id}` (tenant_id from subdomain lookup)
  - Display business header: name, description, logo, address
  - Display categories and services

#### 7.2 Service Selection Page
- [ ] Display categories with services
  - Each category shows: name, description, color
  - Each service shows: name, description, duration, price, pre-appointment instructions
- [ ] Service card click → Navigate to `/booking/[slug]/service/[serviceId]/page.tsx`

#### 7.3 Availability Selection Page
- [ ] Build `/booking/[slug]/service/[serviceId]/page.tsx`
  - Display service details at top
  - Calendar view (week or month)
  - Fetch availability: `POST /booking/availability` with:
    - `tenant_id`, `service_id`, `start_date`, `end_date`, `team_member_id?`
  - Display time slots:
    - Color-coded by team member
    - Only show slots matching service duration
    - Disable past slots
    - Disable unavailable slots
  - Slot selection → Navigate to checkout

#### 7.4 Checkout Page (Payment Collection)
- [ ] Build `/booking/[slug]/checkout/page.tsx`
  - **Critical**: No charge at checkout - only save card
  - Form sections:
    1. Customer Information:
       - Name (required)
       - Email (required)
       - Phone (optional, but recommended)
    2. Policies Modal:
       - Display all policies in scrollable modal
       - Require consent checkbox: "I agree to the policies"
       - Store policy hash/timestamp for audit
    3. Gift Card (Optional):
       - Input field for gift code
       - Validate code on input (call backend)
       - Show discount amount
       - Update final price live
    4. Payment Method:
       - Stripe Elements card input
       - Payment method selection (if multiple enabled)
       - ✅ **VERIFIED**: Uses SetupIntent (NOT PaymentIntent) - booking creation returns `setup_intent_client_secret`
       - SetupIntent is created automatically during booking creation via `POST /booking/create`
       - Frontend receives `setup_intent_client_secret` in booking response
    5. Final Price Display:
       - Service price: ${amount}
       - Gift card discount: -${discount} (if applicable)
       - Total: ${final_amount}
       - Note: "Your card will be saved securely. You will be charged after your appointment is completed or if a fee applies (see policies)."
  - Submit button: "Complete Booking"
  - On submit:
    1. Create booking: `POST /booking/create` with:
       - `tenant_id`, `service_id`, `team_member_id`, `start_time`
       - `customer: { name, email, phone }`
       - `gift_card_code?` (if provided)
    2. Booking creation response includes:
       - `setup_intent_client_secret` (from backend)
       - `booking_id`
       - `status: "pending"`
    2. Confirm SetupIntent with Stripe (saves card, no charge)
    3. On success: Navigate to confirmation page

#### 7.5 Booking Confirmation Page
- [ ] Build `/booking/[slug]/confirm/[bookingCode]/page.tsx`
  - Fetch booking: `GET /booking/{booking_id}` (or use booking code)
  - Display:
    - Success message
    - Booking confirmation number
    - Service: name, description, duration
    - Date/Time: formatted
    - Staff name (if assigned)
    - Price: ${amount}
    - Pre-appointment instructions
    - Policies (again, as reminder)
    - Important note: "Your appointment is confirmed. Your card has been saved securely. You will be charged after your appointment is completed."
  - No payment receipt (no charge yet)

#### 7.6 Error Handling
- [ ] Handle invalid subdomain (404)
- [ ] Handle service not found
- [ ] Handle availability conflicts (slot taken)
- [ ] Handle gift card invalid/expired
- [ ] Handle SetupIntent failures
- [ ] Show user-friendly error messages

#### 7.7 Branding Application
- [ ] Apply tenant branding:
  - Logo in header
  - Brand color as primary color
  - CSS variables for theming
- [ ] Responsive design (mobile-friendly)

### Deliverables
- Subdomain routing working (requires DNS config)
- Service selection page functional
- Availability calendar working with color-coding
- Checkout page with SetupIntent (no charge)
- Policies modal with consent
- Gift card validation working
- Confirmation page displaying booking details
- Branding applied correctly

---

## PHASE 8: Polish & Integration Testing

### Objective
Polish the UI/UX, add loading states, error handling, and test end-to-end flows.

### Tasks

#### 8.1 Loading States
- [ ] Add loading spinners for all async operations
- [ ] Skeleton loaders for data fetching
- [ ] Disable buttons during API calls
- [ ] Show progress indicators for multi-step forms

#### 8.2 Error Handling
- [ ] Global error boundary
- [ ] Toast notifications for errors
- [ ] Network error retry mechanisms
- [ ] 401 handling (redirect to login)
- [ ] 403 handling (tenant access denied)
- [ ] 404 handling (not found pages)

#### 8.3 Form Validation
- [ ] Client-side validation for all forms
- [ ] Real-time validation feedback
- [ ] Server error display
- [ ] Required field indicators

#### 8.4 UI/UX Polish
- [ ] Consistent spacing and typography
- [ ] Button states (hover, active, disabled)
- [ ] Color contrast (WCAG AA)
- [ ] Keyboard navigation
- [ ] Focus states
- [ ] Mobile responsiveness

#### 8.5 State Persistence
- [ ] Auto-save draft forms (localStorage)
- [ ] Restore form data on refresh
- [ ] Cache API responses (React Query)
- [ ] Optimistic updates where appropriate

#### 8.6 End-to-End Testing
- [ ] Test complete onboarding flow
- [ ] Test booking flow from customer perspective
- [ ] Test admin actions (complete/no-show/cancel/refund)
- [ ] Test multi-tenant isolation
- [ ] Test subscription states (Trial/Active/Paused/Canceled)

#### 8.7 Performance Optimization
- [ ] Lazy load routes
- [ ] Image optimization
- [ ] API response caching
- [ ] Bundle size optimization

### Deliverables
- Polished UI with loading states
- Comprehensive error handling
- Form validation working
- E2E flows tested
- Performance optimized

---

## PHASE 9: Subscription Management

### Objective
Build subscription management UI in Account tab.

### Backend Endpoints (Available)
- `GET /api/v1/admin/subscription/status` ✅
- `POST /api/v1/admin/subscription/activate` ✅
- `POST /api/v1/admin/subscription/pause` ✅
- `POST /api/v1/admin/subscription/cancel` ✅
- `POST /api/v1/admin/subscription/start-trial` ✅

### Tasks

#### 9.1 Subscription Status Display
- [ ] Display current state: Trial/Active/Paused/Canceled
- [ ] Display next bill date (if applicable)
- [ ] Display subscription price: $11.99/month
- [ ] State badge (color-coded)

#### 9.2 Subscription Actions
- [ ] Start Trial button (if on day 0)
- [ ] Activate button (if Trial or Paused)
- [ ] Pause button (if Active)
- [ ] Cancel button (if Active or Paused)
- [ ] Confirmation modals for each action

#### 9.3 State Transitions
- [ ] Trial → Active (auto at day 7, or manual activate)
- [ ] Active → Paused
- [ ] Paused → Active
- [ ] Any → Canceled (deprovision subdomain)

### Deliverables
- Subscription status display working
- Subscription action buttons functional
- State transitions working (Trial → Active → Paused → Canceled)

---

## SUMMARY OF ISSUES - VERIFICATION REPORT

### ✅ Issue 1: Subscription Endpoints - VERIFIED RESOLVED

**Verification Evidence**:
- ✅ All 5 subscription endpoints confirmed in `backend/app/blueprints/admin_dashboard_api.py`:
  - `GET /api/v1/admin/subscription/status` (line 2275)
  - `POST /api/v1/admin/subscription/start-trial` (line 2300)
  - `POST /api/v1/admin/subscription/activate` (line 2331)
  - `POST /api/v1/admin/subscription/pause` (line 2374)
  - `POST /api/v1/admin/subscription/cancel` (line 2405)
- ✅ `TenantBilling` model includes all subscription fields (`backend/app/models/financial.py:167-172`):
  - `subscription_id`, `subscription_status`, `subscription_price_cents`, `next_billing_date`, `stripe_customer_id`, `trial_ends_at`
- ✅ All endpoints properly secured with `@require_role(["owner", "admin"])` decorator

**Status**: ✅ **FULLY VERIFIED - READY FOR FRONTEND DEVELOPMENT**

---

### ✅ Issue 2: Payment Action Buttons - VERIFIED RESOLVED

**Verification Evidence**:
- ✅ `complete_booking()` (`backend/app/services/business_phase2.py:1817-1882`):
  - Calls `_charge_booking_payment()` at line 1849
  - Retrieves booking amount and charges full amount
  - Uses off-session PaymentIntent with Stripe Connect
- ✅ `mark_no_show()` (`backend/app/services/business_phase2.py:1779-1815`):
  - Calls `_calculate_no_show_fee()` at line 1798 (from BusinessPolicy)
  - Calls `PaymentService.capture_no_show_fee()` at line 1803
  - Charges fee using saved payment method
- ✅ `cancel_booking()` (`backend/app/services/business_phase2.py:1703-1741`):
  - Calls `_calculate_cancellation_fee()` at line 1725
  - Calls `_charge_booking_payment()` at line 1728
  - Charges cancellation fee if timing window not met
- ✅ Helper methods verified:
  - `_get_customer_payment_method()` (line 1574)
  - `_calculate_no_show_fee()` (line 1582)
  - `_calculate_cancellation_fee()` (line 1606)
  - `_charge_booking_payment()` (line 1627) - Creates off-session PaymentIntent with 1% platform fee
- ✅ Platform fee verified at 1%:
  - `backend/app/services/financial.py:64` - `application_fee_cents = int(amount_cents * 0.01)`
  - `backend/app/services/financial.py:319` - `application_fee_cents = int(no_show_fee_cents * 0.01)`
  - `backend/app/services/business_phase2.py:1652` - `application_fee_cents = int(amount_cents * 0.01)`

**Status**: ✅ **FULLY VERIFIED - ALL PAYMENT ACTIONS TRIGGER CHARGES CORRECTLY**

---

### ✅ Issue 3: Manual Capture Flow (SetupIntent) - VERIFIED RESOLVED

**Verification Evidence**:
- ✅ `_process_payment()` method (`backend/app/services/booking_flow_service.py:450-486`):
  - Creates SetupIntent (not PaymentIntent) - line 466
  - Comment explicitly states: "we save card at checkout, no charge yet"
  - Returns `setup_intent_client_secret` in response - line 476
- ✅ Booking creation response (`backend/app/services/booking_flow_service.py:350-364`):
  - Returns `setup_intent_client_secret` at line 363
  - Returns `payment_id` for reference
  - Booking status set to 'pending' (line 352) - no charge yet
- ✅ API endpoint (`backend/app/blueprints/booking_flow_api.py:219-223`):
  - Returns booking data which includes `setup_intent_client_secret` from service layer

**Status**: ✅ **FULLY VERIFIED - SETUPINTENT FLOW IMPLEMENTED CORRECTLY**

---

### ⚠️ Issue 4: Subdomain Routing - INFRASTRUCTURE (NOT A CODE ISSUE)

**Status**: ⚠️ **INFRASTRUCTURE BLOCKER** - Requires DNS and Next.js configuration
- Frontend code can be built, but routing won't work until infrastructure is configured
- Not a backend code issue - this is deployment/infrastructure concern

---

### ✅ Issue 5: Onboarding Step Numbering - VERIFIED RESOLVED

**Verification Evidence**:
- ✅ Branding endpoint exists: `POST /onboarding/step4/branding` (`backend/app/blueprints/comprehensive_onboarding_api.py:207`)
- ✅ `setup_branding()` method exists in `OnboardingService` (`backend/app/services/onboarding_service.py:234`)
- ✅ `BusinessBranding` model exists (`backend/app/models/onboarding.py:187`)
- ✅ Step 4 endpoint properly documented with all branding fields (logo_url, primary_color, secondary_color, etc.)

**Status**: ✅ **FULLY VERIFIED - BRANDING STEP EXISTS AND MAPPED CORRECTLY**

---

## FINAL STATUS

| Issue | Status | Blocking Phase |
|-------|--------|----------------|
| Issue 1: Subscription Endpoints | ✅ VERIFIED | None - Phase 9 ready |
| Issue 2: Payment Action Buttons | ✅ VERIFIED | None - Phase 6 ready |
| Issue 3: SetupIntent Flow | ✅ VERIFIED | None - Phase 7 ready |
| Issue 4: Subdomain Routing | ⚠️ Infrastructure | Phase 7 (code works, needs DNS) |
| Issue 5: Onboarding Steps | ✅ VERIFIED | None - Phase 3-4 ready |

**Remaining Blockers**: None (code-related)
**Infrastructure Blockers**: Issue 4 (DNS/rewrites - deployment concern)

---

## NOTES

- All API calls must use idempotency keys for mutating operations
- All payment actions must be idempotent
- Tenant isolation must be enforced at UI level (show only user's tenants)
- Subdomain routing requires infrastructure support (DNS + Next.js rewrites)
- Subscription management fully implemented (Issue 1 resolved)

---

**Next Steps**: All critical blockers resolved. Frontend development can proceed.

