# Tithi Manual Testing Procedure v1.0

**Note**: v1.0 includes **email notifications only** (SMS will be added in a future version).

This document provides a comprehensive, step-by-step manual testing procedure to verify all functionality of the Tithi booking platform. Follow this procedure to test the complete user journey from account creation through customer bookings and payment processing.

---

## 📋 Pre-Testing Setup

### Required Test Accounts & Tools
1. **Two email addresses** (use real emails you can access):
   - `owner@testtithi.com` (or use a real email you control)
   - `customer@testtithi.com` (or use a different real email)
   
2. **Stripe Test Mode**:
   - Use Stripe test card numbers (see below)
   - Ensure Stripe webhook endpoint is configured for local testing
   - Have Stripe Dashboard open to monitor transactions

3. **Test Card Numbers** (Stripe Test Mode):
   - Success: `4242 4242 4242 4242`
   - Requires 3D Secure: `4000 0025 0000 3155`
   - Declined: `4000 0000 0000 0002`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

4. **Browser Setup**:
   - Use Chrome/Firefox with DevTools open
   - Clear cookies/cache before starting
   - Use Incognito/Private mode for customer testing
   - Have Network tab open to monitor API calls

---

## 🎯 PART 1: OWNER ONBOARDING & SETUP

### Test 1.1: Account Creation & Landing Page

**Objective**: Verify new owner can create account and access onboarding

**Steps**:
1. Navigate to `tithi.com` (or your local dev URL)
2. **Verify Landing Page**:
   - ✅ See "Join Tithi Now" button
   - ✅ See "Login" button
   - ✅ Page is clean and simple (no dashboard)
3. Click "Join Tithi Now"
4. **Fill Signup Form**:
   - Email: `owner@testtithi.com`
   - Password: `TestPassword123!`
   - First Name: `Test`
   - Last Name: `Owner`
5. Submit form
6. **Verify**:
   - ✅ Redirected to Step 1 of onboarding (Business Basics)
   - ✅ No admin dashboard shown
   - ✅ Progress indicator shows "Step 1 of 8" (or similar)

---

### Test 1.2: Step 1 - Business Basics

**Objective**: Verify business information collection

**Steps**:
1. **Fill Business Information**:
   - Business Name: `Test Salon`
   - Description: `A beautiful test salon for manual testing`
   - DBA (Doing Business As): `Test Salon DBA`
   - Legal Business Name: `Test Salon LLC`
   - Industry: Select from dropdown (e.g., "Beauty & Wellness")
2. Click "Continue" or "Next"
3. **Verify**:
   - ✅ Data is saved (check Network tab for API call)
   - ✅ Progress indicator advances
   - ✅ Can navigate back and edit

---

### Test 1.3: Step 2 - Booking Website (Subdomain)

**Objective**: Verify subdomain selection and validation

**Steps**:
1. **Enter Subdomain**:
   - Try: `testsalon` (should become `testsalon.tithi.com`)
2. **Test Validation**:
   - Try reserved word: `admin` → Should show error
   - Try taken subdomain: If exists, should show error
   - Try valid: `testsalon` → Should show success/checkmark
3. Click "Continue"
4. **Verify**:
   - ✅ Subdomain is reserved
   - ✅ Preview URL shown: `testsalon.tithi.com`
   - ✅ Can edit before finalizing

---

### Test 1.4: Step 3 - Location & Contacts

**Objective**: Verify location and contact information

**Steps**:
1. **Fill Location Information**:
   - Timezone: `America/New_York` (or your local timezone)
   - Phone: `+1 (555) 123-4567`
   - Support Email: `support@testsalon.com`
   - Website: `https://testsalon.com` (optional)
   - Street Address: `123 Test Street`
   - City: `New York`
   - State/Province: `NY`
   - Postal Code: `10001`
   - Country: `United States`
2. Click "Continue"
3. **Verify**:
   - ✅ All fields save correctly
   - ✅ Timezone is stored properly

---

### Test 1.5: Step 4 - Team Members

**Objective**: Verify staff member creation for scheduling

**Steps**:
1. **Add First Team Member**:
   - Name: `Sarah Johnson`
   - Role: `Senior Stylist`
   - Color: Select a color (e.g., Blue) - this will be used for calendar display
   - Click "Add Team Member"
2. **Add Second Team Member**:
   - Name: `Mike Chen`
   - Role: `Junior Stylist`
   - Color: Select different color (e.g., Green)
   - Click "Add Team Member"
3. **Verify**:
   - ✅ Both team members appear in list
   - ✅ Can edit team members
   - ✅ Can delete team members
   - ✅ Colors are assigned correctly
4. Click "Continue"
5. **Note**: Team members are for scheduling only - they don't get login access

---

### Test 1.6: Step 5 - Branding

**Objective**: Verify logo upload and brand color theming

**Steps**:
1. **Upload Logo**:
   - Click "Upload Logo"
   - Select a test image file (PNG/JPG, recommended size)
   - Verify image preview appears
2. **Set Brand Color**:
   - Pick a primary brand color (e.g., `#FF6B6B`)
   - Verify color picker works
   - See preview of how it affects booking site
3. Click "Continue"
4. **Verify**:
   - ✅ Logo uploads successfully
   - ✅ Brand color is saved
   - ✅ Preview shows branding applied

---

### Test 1.7: Step 6 - Services & Categories

**Objective**: Verify category and service creation hierarchy

**Steps**:
1. **Create First Category**:
   - Category Name: `Hair Services`
   - Description: `Professional hair styling and cutting services` (optional)
   - Category Color: Select color (e.g., Purple)
   - **Add Services to Category**:
     - Service 1:
       - Name: `Haircut`
       - Description: `Professional haircut and styling`
       - Duration: `60 minutes`
       - Price: `$50.00`
       - Pre-appointment Instructions: `Please arrive 10 minutes early`
       - Click "Add Service"
     - Service 2:
       - Name: `Hair Color`
       - Description: `Full hair coloring service`
       - Duration: `120 minutes`
       - Price: `$150.00`
       - Pre-appointment Instructions: `Please bring reference photos`
       - Click "Add Service"
   - Click "Create Category" (or "Save Category")
2. **Create Second Category**:
   - Category Name: `Facial Services`
   - Category Color: Select different color (e.g., Pink)
   - **Add Service**:
     - Name: `Basic Facial`
     - Description: `Deep cleansing facial treatment`
     - Duration: `90 minutes`
       - Price: `$80.00`
       - Pre-appointment Instructions: `Avoid makeup on day of appointment`
       - Click "Add Service"
   - Click "Create Category"
3. **Verify**:
   - ✅ Categories appear in list
   - ✅ Services are nested under correct categories
   - ✅ Can edit categories and services
   - ✅ Can delete services (but not if they have bookings)
   - ✅ Hierarchy is clear (category → services)
4. Click "Continue"
5. **Note**: Must have at least one service to proceed

---

### Test 1.8: Step 7 - Availability

**Objective**: Verify availability setup per service per staff

**Steps**:
1. **For Each Service, Set Availability for Each Staff Member**:
   
   **Service: Haircut**
   - Select "Haircut" from dropdown
   - **For Sarah Johnson**:
     - Select "Sarah Johnson" from staff dropdown
     - Set weekly schedule:
       - Monday: `9:00 AM - 5:00 PM`
       - Tuesday: `9:00 AM - 5:00 PM`
       - Wednesday: `9:00 AM - 5:00 PM`
       - Thursday: `9:00 AM - 5:00 PM`
       - Friday: `9:00 AM - 5:00 PM`
       - Saturday: `10:00 AM - 3:00 PM`
       - Sunday: `Closed`
     - Click "Save Availability" or "Add Schedule"
   - **For Mike Chen**:
     - Select "Mike Chen" from staff dropdown
     - Set weekly schedule:
       - Monday: `10:00 AM - 6:00 PM`
       - Tuesday: `10:00 AM - 6:00 PM`
       - Wednesday: `Closed`
       - Thursday: `10:00 AM - 6:00 PM`
       - Friday: `10:00 AM - 6:00 PM`
       - Saturday: `9:00 AM - 4:00 PM`
       - Sunday: `Closed`
     - Click "Save Availability"
   
   **Service: Hair Color**
   - Select "Hair Color" from dropdown
   - **For Sarah Johnson only**:
     - Select "Sarah Johnson"
     - Set schedule: Same as above
     - Click "Save Availability"
   
   **Service: Basic Facial**
   - Select "Basic Facial" from dropdown
   - **For Sarah Johnson**:
     - Set schedule: Same as above
     - Click "Save Availability"
2. **Verify**:
   - ✅ Each service-staff combination is saved
   - ✅ Can see which staff offers which services
   - ✅ Calendar preview shows availability
   - ✅ Cannot proceed until ALL services have at least one staffed availability window
3. Click "Continue"
4. **Note**: This is a hard requirement - must complete for all services

---

### Test 1.9: Step 8 - Notifications & Subscription Plan

**Objective**: Verify plan selection and notification template creation (Pro Plan only)

**Steps**:
1. **Select Subscription Plan**:
   - **Option A: Pro Plan ($21.99/month)** - Select this for full testing
     - ✅ Notifications enabled
     - ✅ Can create email templates
   - **Option B: Basic Plan ($13.99/month)** - Test separately
     - ✅ Notifications disabled
     - ✅ Cannot create templates (page should be disabled/hidden in admin)
2. **If Pro Plan Selected, Create Notification Templates**:
   
   **Template 1: Booking Confirmation Email**
   - Template Name: `Booking Confirmation`
   - Channel: `Email` (SMS not available in v1.0)
   - Category: `Confirmation`
   - Trigger Event: `Booking Created`
   - Email Subject: `Your appointment at {{business.name}} is confirmed!`
   - Content Body:
     ```
     Hi {{customer.name}},
     
     Your booking for {{service.name}} is confirmed!
     
     Date: {{booking.date}}
     Time: {{booking.time}}
     Duration: {{service.duration}} minutes
     Price: ${{service.price}}
     
     We'll see you at {{business.name}}!
     
     View your booking: {{booking.url}}
     ```
   - **Test Placeholders**:
     - ✅ Can insert placeholders from dropdown
     - ✅ Placeholders show as variables (e.g., `{{customer.name}}`)
     - ✅ Preview shows sample data
   - Click "Save Template"
   
   **Template 2: 24-Hour Reminder**
   - Template Name: `24-Hour Reminder`
   - Channel: `Email`
   - Category: `Reminder`
   - Trigger Event: `24-Hour Reminder`
   - Email Subject: `Reminder: Your appointment tomorrow at {{booking.time}}`
   - Content Body:
     ```
     Hi {{customer.name}},
     
     This is a reminder that you have an appointment tomorrow:
     
     Service: {{service.name}}
     Date: {{booking.date}}
     Time: {{booking.time}}
     
     See you soon!
     ```
   - Click "Save Template"
   
   **Template 3: Booking Completed Receipt**
   - Template Name: `Booking Completed`
   - Channel: `Email`
   - Category: `Completion`
   - Trigger Event: `Booking Completed`
   - Email Subject: `Thank you for your visit!`
   - Content Body:
     ```
     Hi {{customer.name}},
     
     Thank you for visiting {{business.name}}!
     
     Service: {{service.name}}
     Amount Charged: ${{service.price}}
     
     We hope to see you again soon!
     ```
   - Click "Save Template"
3. **Verify**:
   - ✅ Templates save successfully
   - ✅ Placeholders are validated (unknown placeholders show error)
   - ✅ Preview works with sample data
   - ✅ Can enable/disable templates
   - ✅ Can edit templates
4. Click "Continue"

---

### Test 1.10: Step 9 - Policies & Confirmation

**Objective**: Verify policy creation and fee configuration

**Steps**:
1. **Fill Policy Information**:
   - **Cancellation Policy**:
     - Text: `Cancellations must be made at least 24 hours in advance. Cancellations made less than 24 hours before the appointment will incur a cancellation fee.`
     - Cancellation Fee Type: `Percentage`
     - Cancellation Fee Amount: `50%` (or `$25.00` if flat fee)
   - **No-Show Policy**:
     - Text: `If you do not show up for your appointment without canceling, a no-show fee will be charged to your card on file.`
     - No-Show Fee Type: `Flat Fee`
     - No-Show Fee Amount: `$30.00` (or `25%` if percentage)
   - **Refund Policy**:
     - Text: `Refunds are available within 7 days of service completion. Refund requests must be submitted via email.`
   - **Cash Payment Policy**:
     - Text: `We accept cash payments at the time of service. Card payments are processed after service completion.`
2. Click "Save Policies"
3. **Verify**:
   - ✅ All policies save correctly
   - ✅ Fee types and amounts are stored
   - ✅ Policies will appear in checkout modal for customers
4. Click "Continue"

---

### Test 1.11: Step 10 - Gift Cards (Optional)

**Objective**: Verify gift card creation

**Steps**:
1. **Create Gift Card**:
   - Click "Create Gift Card" (optional step)
   - **Gift Card Type: Fixed Amount**
     - Amount: `$100.00`
     - Expiration Date: `12/31/2025` (or 1 year from now)
     - Click "Generate Code"
     - ✅ Code is generated (e.g., `GIFT-ABC123XYZ`)
     - **SAVE THIS CODE** - you'll need it for customer testing
   - Click "Save Gift Card"
2. **Create Second Gift Card (Percentage Discount)**:
   - Click "Create Gift Card"
   - **Gift Card Type: Percentage Discount**
     - Discount: `20%`
     - Expiration Date: `12/31/2025`
     - Click "Generate Code"
     - ✅ Code is generated (e.g., `GIFT-PERCENT20`)
     - **SAVE THIS CODE**
   - Click "Save Gift Card"
3. **Verify**:
   - ✅ Gift cards appear in list
   - ✅ Codes are unique
   - ✅ Can view gift card details
   - ✅ Can void gift cards (if needed)
4. Click "Continue" (or "Skip" if optional)

---

### Test 1.12: Step 11 - Payment Setup (Stripe Connect)

**Objective**: Verify Stripe Connect setup and subscription creation

**Steps**:
1. **Stripe Connect Onboarding**:
   - Click "Connect Stripe Account" or "Set Up Payments"
   - **If Stripe Express Flow**:
     - Complete Stripe Express onboarding form
     - Business type, bank account, etc.
     - **Note**: In test mode, use test data
   - **Verify**:
     - ✅ Stripe Connect account is created
     - ✅ Account ID is stored
     - ✅ Returns to Tithi after completion
2. **Configure Payment Methods**:
   - Select accepted payment methods:
     - ✅ Credit Cards (default, required)
     - ✅ Debit Cards
     - (Other methods if available)
3. **Subscription Creation**:
   - **Verify Subscription**:
     - ✅ Subscription is created automatically based on plan selected in Step 8
     - ✅ If Pro Plan: Subscription shows `$21.99/month`
     - ✅ If Basic Plan: Subscription shows `$13.99/month`
     - ✅ Trial period: 7 days free trial starts
     - ✅ Next bill date shown
4. **Verify**:
   - ✅ Payment setup is complete
   - ✅ Can see subscription status
   - ✅ Stripe account is linked
5. Click "Continue" or "Go Live"

---

### Test 1.13: Go Live & Verification

**Objective**: Verify business goes live and public site is accessible

**Steps**:
1. **Final Review**:
   - Review all steps completed
   - Verify all required data is filled
2. Click "Go Live" or "Publish"
3. **Verify**:
   - ✅ Success message appears
   - ✅ Public booking URL is shown: `testsalon.tithi.com` (or your subdomain)
   - ✅ Redirected to admin dashboard
   - ✅ Business status is "Active" or "Live"
4. **Test Public Site Access**:
   - Open new incognito/private window
   - Navigate to `{subdomain}.tithi.com`
   - **Verify**:
     - ✅ Public booking site loads
     - ✅ Shows business name: "Test Salon"
     - ✅ Shows business description
     - ✅ Shows address
     - ✅ Shows categories and services
     - ✅ Branding is applied (logo, colors)
     - ✅ No "Tithi" branding visible (white-labeled)

---

## 🎯 PART 2: ADMIN FUNCTIONALITY TESTING

### Test 2.1: Admin Dashboard Access

**Objective**: Verify admin access after onboarding

**Steps**:
1. **Login as Owner**:
   - Navigate to `tithi.com/login`
   - Email: `owner@testtithi.com`
   - Password: `TestPassword123!`
   - Click "Login"
2. **Verify**:
   - ✅ Redirected directly to admin (no dashboard interstitial)
   - ✅ URL: `tithi.com/app/b/{businessId}` (or similar)
   - ✅ See admin navigation/sidebar
   - ✅ See business name in header
3. **Verify Admin Pages Available**:
   - ✅ Overview (mirrors onboarding tabs)
   - ✅ Past Bookings
   - ✅ Account (subscription management)
   - ✅ All onboarding sections are editable

---

### Test 2.2: Admin - Edit Business Information

**Objective**: Verify can edit all onboarding settings post-launch

**Steps**:
1. Navigate to "Business Info" or "Overview" in admin
2. **Edit Business Name**:
   - Change: `Test Salon` → `Test Salon Updated`
   - Click "Save"
3. **Verify**:
   - ✅ Change saves successfully
   - ✅ Public site updates immediately (check `{subdomain}.tithi.com`)
   - ✅ Business name changes on public site
4. **Test Other Edits**:
   - Edit description
   - Edit address
   - Edit contact info
   - **Verify**: All changes reflect on public site immediately

---

### Test 2.3: Admin - Edit Services & Categories

**Objective**: Verify service management in admin

**Steps**:
1. Navigate to "Services" or "Catalog" in admin
2. **Edit Existing Service**:
   - Click on "Haircut" service
   - Change price: `$50.00` → `$55.00`
   - Change duration: `60 minutes` → `45 minutes`
   - Click "Save"
3. **Add New Service**:
   - Click "Add Service"
   - Select category: `Hair Services`
   - Name: `Beard Trim`
   - Description: `Professional beard trimming`
   - Duration: `30 minutes`
   - Price: `$25.00`
   - Click "Save"
4. **Verify**:
   - ✅ Changes save successfully
   - ✅ New service appears on public site
   - ✅ Price changes reflect on public site
   - ✅ Can delete services (if no bookings)

---

### Test 2.4: Admin - Edit Staff & Availability

**Objective**: Verify staff and availability management

**Steps**:
1. Navigate to "Team" or "Staff" in admin
2. **Edit Staff Member**:
   - Click on "Sarah Johnson"
   - Change role: `Senior Stylist` → `Master Stylist`
   - Change color
   - Click "Save"
3. **Add New Staff Member**:
   - Click "Add Team Member"
   - Name: `Emma Davis`
   - Role: `Color Specialist`
   - Color: Select color
   - Click "Save"
4. **Edit Availability**:
   - Navigate to "Availability" section
   - Select service: `Haircut`
   - Select staff: `Emma Davis`
   - Set availability: Monday-Friday, 9 AM - 5 PM
   - Click "Save"
5. **Verify**:
   - ✅ Staff changes save
   - ✅ New staff appears in booking flow
   - ✅ Availability updates reflect on public site

---

### Test 2.5: Admin - Edit Branding

**Objective**: Verify branding updates

**Steps**:
1. Navigate to "Branding" in admin
2. **Change Brand Color**:
   - Select new color: `#4ECDC4` (teal)
   - Click "Save"
3. **Change Logo**:
   - Upload new logo
   - Click "Save"
4. **Verify**:
   - ✅ Changes save
   - ✅ Public site updates with new branding immediately
   - ✅ Logo and colors change on booking site

---

### Test 2.6: Admin - Edit Policies

**Objective**: Verify policy management

**Steps**:
1. Navigate to "Policies" in admin
2. **Edit No-Show Fee**:
   - Change: `$30.00` → `$40.00`
   - Click "Save"
3. **Edit Cancellation Policy Text**:
   - Update text
   - Click "Save"
4. **Verify**:
   - ✅ Changes save
   - ✅ New bookings will see updated policies
   - ✅ Existing bookings keep old policy snapshot

---

### Test 2.7: Admin - Gift Card Management

**Objective**: Verify gift card admin features

**Steps**:
1. Navigate to "Gift Cards" in admin
2. **View Gift Cards**:
   - ✅ See list of all gift cards
   - ✅ See codes, amounts, expiration dates
   - ✅ See balance status
3. **Create New Gift Card**:
   - Click "Create Gift Card"
   - Amount: `$50.00`
   - Expiration: Future date
   - Generate code
   - **SAVE CODE** for customer testing
   - Click "Save"
4. **Void Gift Card** (if needed):
   - Select gift card
   - Click "Void" or "Deactivate"
   - ✅ Gift card is voided
5. **Verify**:
   - ✅ Can view gift card ledger/history
   - ✅ Can see which bookings used gift cards

---

### Test 2.8: Admin - Notifications (Pro Plan Only)

**Objective**: Verify notification template management

**Steps**:
1. **If Pro Plan**:
   - Navigate to "Notifications" in admin
   - ✅ Page is visible and accessible
2. **Edit Template**:
   - Click on "Booking Confirmation" template
   - Edit content
   - Add/remove placeholders
   - Click "Save"
3. **Test Preview**:
   - Click "Preview"
   - ✅ Shows sample email with placeholder data filled in
4. **Enable/Disable Template**:
   - Toggle template on/off
   - ✅ Template status changes
5. **Create New Template**:
   - Click "Create Template"
   - Fill in details
   - Click "Save"
6. **If Basic Plan**:
   - ✅ "Notifications" page is NOT visible in navigation
   - ✅ Or page shows "Upgrade to Pro" message

---

### Test 2.9: Admin - Account & Subscription Management

**Objective**: Verify subscription controls

**Steps**:
1. Navigate to "Account" in admin
2. **View Subscription Status**:
   - ✅ See current plan: "Pro Plan - $21.99/month" (or Basic)
   - ✅ See subscription status: "Trial" (if within 7 days)
   - ✅ See next bill date
   - ✅ See trial end date (if applicable)
3. **Test Subscription Controls**:
   - **If Trial**:
     - ✅ See "Start Trial" button (if not started)
     - ✅ See trial countdown
   - **If Active**:
     - ✅ See "Pause" button
     - ✅ See "Cancel" button
     - Click "Pause" → ✅ Subscription pauses, site may stay up
     - Click "Activate" → ✅ Subscription resumes
   - **If Paused**:
     - ✅ See "Activate" button
     - ✅ Status shows "Paused"
4. **Verify**:
   - ✅ Subscription state changes reflect correctly
   - ✅ Billing information is accurate

---

## 🎯 PART 3: CUSTOMER BOOKING FLOW

### Test 3.1: Public Booking Site - Homepage

**Objective**: Verify public booking site displays correctly

**Steps**:
1. Open new incognito/private browser window
2. Navigate to `{subdomain}.tithi.com` (e.g., `testsalon.tithi.com`)
3. **Verify Homepage**:
   - ✅ Business name displays: "Test Salon Updated"
   - ✅ Business description displays
   - ✅ Business address displays
   - ✅ Industry/business type displays
   - ✅ Logo displays (if uploaded)
   - ✅ Brand colors applied
   - ✅ Categories and services are visible
   - ✅ No "Tithi" branding visible (white-labeled)
4. **Verify Service Display**:
   - ✅ Categories are shown (e.g., "Hair Services", "Facial Services")
   - ✅ Services are nested under categories
   - ✅ Each service shows:
     - Service name
     - Description
     - Duration
     - Price
   - ✅ Services are clickable

---

### Test 3.2: Customer Booking - Select Service

**Objective**: Verify service selection and details

**Steps**:
1. On public booking site, click on "Haircut" service
2. **Verify Service Details Page**:
   - ✅ Service name: "Haircut"
   - ✅ Description displays
   - ✅ Duration: "45 minutes" (or updated duration)
   - ✅ Price: "$55.00" (or updated price)
   - ✅ Pre-appointment instructions display
   - ✅ "Book Now" or "Select Time" button visible
3. Click "Book Now" or "Select Time"

---

### Test 3.3: Customer Booking - Availability Selection

**Objective**: Verify availability calendar and staff selection

**Steps**:
1. **Verify Availability Calendar**:
   - ✅ Calendar displays (week or day view)
   - ✅ Available time slots are shown
   - ✅ Slots match service duration (45 minutes)
   - ✅ Staff members are color-coded
   - ✅ Can see which staff is available for each slot
2. **Select Date**:
   - Navigate to a future date (e.g., tomorrow or next week)
   - ✅ Available dates are highlighted
   - ✅ Past dates are disabled
3. **Select Time Slot**:
   - Click on an available time slot (e.g., "10:00 AM")
   - ✅ Slot is selected/highlighted
   - ✅ Staff member name shows (e.g., "Sarah Johnson" or "Mike Chen")
4. **Verify Staff Selection** (if multiple staff available):
   - ✅ Can see all available staff for that time
   - ✅ Can select specific staff member
   - ✅ Staff colors match admin settings
5. Click "Continue" or "Next"

---

### Test 3.4: Customer Booking - Checkout & Customer Info

**Objective**: Verify checkout form and policy consent

**Steps**:
1. **Fill Customer Information**:
   - Name: `John Customer`
   - Email: `customer@testtithi.com` (use real email you can access)
   - Phone: `+1 (555) 987-6543`
2. **Verify Policies Modal**:
   - ✅ Policies modal appears (or link to view policies)
   - Click "View Policies" or policies auto-display
   - ✅ See all policies:
     - Cancellation Policy
     - No-Show Policy (with fee amount)
     - Refund Policy
     - Cash Payment Policy
   - ✅ Policies are scrollable
   - ✅ Must check consent checkbox: "I agree to the policies"
   - Check the consent checkbox
3. **Test Gift Card Application** (Optional):
   - Enter gift card code: `GIFT-ABC123XYZ` (from Test 1.11)
   - Click "Apply" or "Redeem"
   - ✅ Gift card is validated
   - ✅ Final price updates (reduced by gift card amount)
   - ✅ See updated total
   - **OR Test Percentage Discount**:
     - Enter code: `GIFT-PERCENT20`
     - ✅ Price reduces by 20%
4. **Verify Payment Notice**:
   - ✅ See clear message: "You're not charged now. Your card is saved securely. You'll be charged after your appointment is completed or if a fee applies (see policies)."
5. **Enter Payment Method**:
   - Stripe Elements/Payment Element should appear
   - Enter test card: `4242 4242 4242 4242`
   - Expiry: `12/34`
   - CVC: `123`
   - ZIP: `12345`
   - ✅ Card form validates
6. Click "Complete Booking" or "Confirm Booking"

---

### Test 3.5: Customer Booking - Confirmation

**Objective**: Verify booking confirmation and email notification

**Steps**:
1. **After Submitting Booking**:
   - ✅ Loading spinner appears
   - ✅ Booking processes
2. **Verify Confirmation Page**:
   - ✅ Success message: "Booking Confirmed!" or similar
   - ✅ Booking code/reference number shown (e.g., `BOOK-12345`)
   - ✅ **SAVE THIS BOOKING CODE** - needed for admin testing
   - ✅ Service details:
     - Service name
     - Date and time
     - Duration
     - Staff member name
   - ✅ Customer information:
     - Name
     - Email
     - Phone
   - ✅ Price information:
     - Service price
     - Gift card discount (if applied)
     - Final amount
   - ✅ Pre-appointment instructions
   - ✅ Policies shown again
   - ✅ Clear message: "No charge yet - payment will be processed after your appointment"
3. **Verify Email Notification** (Pro Plan only):
   - Check email inbox: `customer@testtithi.com`
   - ✅ Email received: "Your appointment at Test Salon Updated is confirmed!"
   - ✅ Email subject matches template
   - ✅ Email content shows:
     - Customer name: "John Customer"
     - Service name: "Haircut"
     - Booking date and time (formatted correctly)
     - Duration: "45 minutes"
     - Price: "$55.00"
     - Business name: "Test Salon Updated"
     - Booking URL (if included in template)
   - ✅ Placeholders are replaced with actual data
4. **Verify Booking Status**:
   - ✅ Status is "Pending" (no charge yet)
   - ✅ Card is saved on file

---

## 🎯 PART 4: ADMIN - BOOKING MANAGEMENT & PAYMENTS

### Test 4.1: Admin - View Past Bookings

**Objective**: Verify bookings list and details

**Steps**:
1. Login to admin as owner
2. Navigate to "Past Bookings" or "Bookings" page
3. **Verify Booking Appears**:
   - ✅ Booking from Test 3.5 appears in list
   - ✅ Shows:
     - Customer name: "John Customer"
     - Customer email: `customer@testtithi.com`
     - Customer phone: `+1 (555) 987-6543`
     - Service: "Haircut"
     - Staff: Staff member name
     - Date and time
     - Price: "$55.00"
     - Status: "Pending" (or "Authorized")
     - Booking code/reference
4. **Click on Booking** to view details:
   - ✅ Full booking details shown
   - ✅ All customer information
   - ✅ Payment status
   - ✅ Card on file indicator

---

### Test 4.2: Admin - Complete Booking & Charge Payment

**Objective**: Verify "Completed" button charges full amount

**Steps**:
1. In Past Bookings, find the booking from Test 3.5
2. **Verify Booking Status**:
   - ✅ Status shows "Pending"
   - ✅ "Completed" button is enabled
   - ✅ "No-Show" button is enabled
   - ✅ "Cancelled" button is enabled
   - ✅ "Refund" button is disabled (no charge yet) or shows tooltip "No payment to refund"
3. **Click "Completed" Button**:
   - Click "Completed"
   - ✅ Button shows spinner/loading state
   - ✅ Button is disabled (prevents double-click)
   - ✅ Success message appears: "Booking marked as completed. Payment processed."
4. **Verify Payment Processing**:
   - ✅ Status chip updates to "Completed" or "Charged"
   - ✅ Payment is processed via Stripe
   - ✅ Full amount is charged: $55.00 (or adjusted amount if gift card used)
   - ✅ Check Stripe Dashboard:
     - ✅ PaymentIntent is created
     - ✅ Charge is successful
     - ✅ Amount is correct
     - ✅ Platform fee (1%) is applied
     - ✅ Transfer to Connect account is correct
5. **Verify Email Notification** (Pro Plan):
   - Check customer email: `customer@testtithi.com`
   - ✅ Receipt email received: "Thank you for your visit!"
   - ✅ Email shows:
     - Service name
     - Amount charged
     - Business name
     - Placeholders replaced correctly
6. **Verify Booking Details**:
   - ✅ Booking shows payment breakdown:
     - Gross amount
     - Platform fee (1%)
     - Stripe fees
     - Net to business
   - ✅ "Refund" button is now enabled

---

### Test 4.3: Admin - No-Show Fee Charge

**Objective**: Verify "No-Show" button charges no-show fee

**Steps**:
1. **Create Another Booking** (for testing no-show):
   - Go to public site as customer
   - Book another appointment (different service/time)
   - Use different customer email or same
   - Complete booking
   - **SAVE BOOKING CODE**
2. **In Admin, Mark as No-Show**:
   - Find the new booking in Past Bookings
   - Click "No-Show" button
   - ✅ Button shows spinner
   - ✅ Button is disabled
3. **Verify No-Show Fee Charge**:
   - ✅ Status updates to "No-Show"
   - ✅ No-show fee is charged: $40.00 (from updated policy in Test 2.6)
   - ✅ Check Stripe Dashboard:
     - ✅ PaymentIntent created for no-show fee
     - ✅ Charge is successful
     - ✅ Amount is $40.00
   - ✅ Full service price is NOT charged (only no-show fee)
4. **Verify Email Notification** (Pro Plan):
   - Check customer email
   - ✅ No-show notification received (if template exists)
   - ✅ Shows no-show fee charged
5. **Test Zero No-Show Fee** (Optional):
   - Edit policy: Set no-show fee to $0.00
   - Create new booking
   - Mark as no-show
   - ✅ No charge occurs
   - ✅ Status updates to "No-Show" only

---

### Test 4.4: Admin - Cancellation Fee Charge

**Objective**: Verify "Cancelled" button charges cancellation fee

**Steps**:
1. **Create Another Booking** (for testing cancellation):
   - Book another appointment as customer
   - **SAVE BOOKING CODE**
2. **In Admin, Cancel Booking**:
   - Find the booking in Past Bookings
   - Click "Cancelled" button
   - ✅ Button shows spinner
   - ✅ Button is disabled
3. **Verify Cancellation Fee Charge**:
   - ✅ Status updates to "Cancelled"
   - ✅ Cancellation fee is charged: 50% of service price (from policy)
   - ✅ Check Stripe Dashboard:
     - ✅ PaymentIntent created for cancellation fee
     - ✅ Charge is successful
     - ✅ Amount is 50% of service price
4. **Verify Email Notification** (Pro Plan):
   - Check customer email
   - ✅ Cancellation notification received
   - ✅ Shows cancellation fee charged
5. **Test Zero Cancellation Fee** (Optional):
   - Edit policy: Set cancellation fee to $0.00
   - Create new booking
   - Cancel booking
   - ✅ No charge occurs
   - ✅ Status updates to "Cancelled" only

---

### Test 4.5: Admin - Refund Processing

**Objective**: Verify "Refund" button processes refunds

**Steps**:
1. **Find a Completed Booking**:
   - Use booking from Test 4.2 (marked as Completed)
   - ✅ "Refund" button is enabled (payment exists)
2. **Process Refund**:
   - Click "Refund" button
   - ✅ Confirmation dialog appears (optional)
   - Confirm refund
   - ✅ Button shows spinner
   - ✅ Button is disabled
3. **Verify Refund Processing**:
   - ✅ Status updates to "Refunded"
   - ✅ Refund is processed via Stripe
   - ✅ Check Stripe Dashboard:
     - ✅ Refund is created
     - ✅ Amount is correct (full or partial)
     - ✅ Refund status is "succeeded"
4. **Verify Email Notification** (Pro Plan):
   - Check customer email
   - ✅ Refund notification received (if template exists)
   - ✅ Shows refund amount
5. **Test Refund on No Payment**:
   - Find a Pending booking (never charged)
   - ✅ "Refund" button is disabled
   - ✅ Or shows tooltip: "No payment to refund"
   - Click button (if enabled) → ✅ No-op or error message

---

### Test 4.6: Admin - Payment Failure Handling

**Objective**: Verify payment failure scenarios

**Steps**:
1. **Test Failed Charge** (if possible):
   - Use declined card in booking: `4000 0000 0000 0002`
   - Or simulate payment failure
   - Mark booking as Completed
   - ✅ Error message appears
   - ✅ Status shows "Payment Issue" or similar
   - ✅ "Send Pay Link" button appears (if implemented)
2. **Test 3D Secure** (if applicable):
   - Use card requiring 3D Secure: `4000 0025 0000 3155`
   - Complete booking
   - Mark as Completed
   - ✅ 3D Secure challenge appears
   - ✅ Or "Send Pay Link" for customer to complete
3. **Verify Error Handling**:
   - ✅ Clear error messages
   - ✅ Retry options available
   - ✅ Customer can complete payment

---

### Test 4.7: Admin - Booking Search & Filters

**Objective**: Verify booking search and filtering

**Steps**:
1. Navigate to Past Bookings
2. **Test Search**:
   - Search by customer name: "John"
   - ✅ Relevant bookings appear
   - Search by email: "customer@testtithi.com"
   - ✅ Bookings filtered
   - Search by booking code
   - ✅ Booking found
3. **Test Filters**:
   - Filter by status: "Pending", "Completed", "No-Show", "Cancelled"
   - ✅ Bookings filtered correctly
   - Filter by date range
   - ✅ Bookings filtered by date
   - Filter by staff member
   - ✅ Bookings filtered by staff
   - Filter by service
   - ✅ Bookings filtered by service
4. **Verify**:
   - ✅ Filters work in combination
   - ✅ Clear filters button works
   - ✅ Results update correctly

---

### Test 4.8: Admin - Booking Details & Actions

**Objective**: Verify booking detail view and additional actions

**Steps**:
1. Click on a booking to view details
2. **Verify Detail View**:
   - ✅ All booking information displayed
   - ✅ Customer information
   - ✅ Service details
   - ✅ Payment information
   - ✅ Status history
   - ✅ Timestamps
3. **Test Additional Actions** (if available):
   - "Resend Confirmation" → ✅ Email resent
   - "Resend Receipt" → ✅ Receipt email resent
   - "Send Pay Link" → ✅ Payment link sent to customer
   - "Edit Customer Info" → ✅ Can update customer details
   - "Add Note" → ✅ Note saved to booking
4. **Verify**:
   - ✅ All actions work correctly
   - ✅ Changes are saved
   - ✅ Customer receives emails (if applicable)

---

## 🎯 PART 5: ADVANCED SCENARIOS & EDGE CASES

### Test 5.1: Multiple Bookings - Same Customer

**Objective**: Verify customer can make multiple bookings

**Steps**:
1. As customer, book another service
2. Use same email: `customer@testtithi.com`
3. **Verify**:
   - ✅ Booking is created
   - ✅ Customer record is reused (not duplicated)
   - ✅ Both bookings appear in admin
   - ✅ Customer history shows multiple bookings

---

### Test 5.2: Gift Card Balance Deduction

**Objective**: Verify gift card balance updates correctly

**Steps**:
1. **Use Fixed Amount Gift Card**:
   - Book service with gift card: `GIFT-ABC123XYZ` ($100.00)
   - Service price: $55.00
   - ✅ Final price: $0.00 (gift card covers it)
   - Complete booking in admin
   - ✅ Gift card balance: $45.00 remaining
2. **Use Remaining Balance**:
   - Book another service: $30.00
   - Apply same gift card
   - ✅ Final price: $0.00 (covered by remaining balance)
   - ✅ Gift card balance: $15.00 remaining
3. **Verify Gift Card Ledger**:
   - In admin, view gift card details
   - ✅ See transaction history
   - ✅ See balance deductions
   - ✅ See booking references

---

### Test 5.3: Percentage Discount Gift Card

**Objective**: Verify percentage discount gift cards

**Steps**:
1. Book service: $55.00
2. Apply percentage discount code: `GIFT-PERCENT20`
3. **Verify**:
   - ✅ Price reduces by 20%: $44.00
   - ✅ Discount amount shown: $11.00
   - ✅ Final price is correct
4. Complete booking
5. **Verify**:
   - ✅ Charge is for discounted amount: $44.00
   - ✅ Gift card can be reused (percentage discounts typically reusable)

---

### Test 5.4: Availability Updates & Real-Time Reflection

**Objective**: Verify availability updates reflect immediately

**Steps**:
1. **As Admin**:
   - Edit availability for a service
   - Remove a time slot (e.g., block 2-3 PM)
   - Save changes
2. **As Customer** (in new incognito window):
   - Navigate to booking site
   - Select same service
   - **Verify**:
     - ✅ Blocked time slot is NOT available
     - ✅ Other slots still available
     - ✅ Changes reflect immediately (no cache delay)
3. **Test Booking Conflict**:
   - Try to book a slot that was just blocked
   - ✅ Booking is prevented
   - ✅ Error message appears

---

### Test 5.5: Timezone Handling

**Objective**: Verify timezone handling across admin and booking site

**Steps**:
1. **Verify Admin Timezone**:
   - Admin shows times in business timezone (set in Step 3)
   - ✅ All times display correctly
2. **Verify Booking Site Timezone**:
   - Public site shows times in business timezone
   - ✅ Customer sees times in correct timezone
3. **Test Different Timezones** (if possible):
   - Change business timezone in admin
   - ✅ All times update correctly
   - ✅ Availability slots adjust
   - ✅ Bookings show correct times

---

### Test 5.6: Service Duration & Buffer Handling

**Objective**: Verify service duration and buffers prevent overlaps

**Steps**:
1. **Book Service**:
   - Book "Haircut" (45 minutes) at 10:00 AM
   - Complete booking
2. **Verify Availability Blocking**:
   - Try to book another service at 10:30 AM (same staff)
   - ✅ Slot is blocked (overlaps with 10:00-10:45 booking)
   - ✅ Next available slot is 10:45 AM or later
3. **Test Buffer Times** (if configured):
   - If service has 15-minute buffer
   - ✅ Availability accounts for buffer
   - ✅ No bookings can overlap with buffer

---

### Test 5.7: Multiple Staff Availability

**Objective**: Verify multiple staff can be available simultaneously

**Steps**:
1. **Verify Booking Site**:
   - Select service with multiple staff available
   - Select a time slot where both staff are free
   - ✅ See both staff options
   - ✅ Can select specific staff
   - ✅ Staff are color-coded
2. **Book with Specific Staff**:
   - Select "Sarah Johnson"
   - Complete booking
3. **Verify Other Staff Still Available**:
   - Same time slot still available for "Mike Chen"
   - ✅ Can book another customer with other staff
   - ✅ No conflict

---

### Test 5.8: Policy Snapshot on Booking

**Objective**: Verify policies are snapshotted at booking time

**Steps**:
1. **Create Booking with Current Policies**:
   - Book service as customer
   - Note current no-show fee: $40.00
   - Complete booking
2. **Change Policies in Admin**:
   - Edit no-show fee: $40.00 → $50.00
   - Save policies
3. **Verify Booking Keeps Old Policy**:
   - Find the booking created before policy change
   - ✅ Booking shows original no-show fee: $40.00
   - ✅ Policy text matches what customer saw
   - ✅ Policy hash/snapshot is stored
4. **Test New Booking**:
   - Create new booking
   - ✅ New booking uses updated policies: $50.00

---

### Test 5.9: Subscription State Changes

**Objective**: Verify subscription state management

**Steps**:
1. **Test Pause Subscription**:
   - In Account page, click "Pause"
   - ✅ Subscription pauses
   - ✅ Public site may show "Paused" status (if implemented)
   - ✅ No charges occur while paused
2. **Test Activate Subscription**:
   - Click "Activate"
   - ✅ Subscription resumes
   - ✅ Billing continues
3. **Test Cancel Subscription**:
   - Click "Cancel"
   - ✅ Confirmation dialog appears
   - ✅ Subscription is canceled
   - ✅ Subdomain may be deprovisioned (if implemented)
   - ✅ No further charges

---

### Test 5.10: Email Notification Placeholders

**Objective**: Verify all placeholders work correctly

**Steps**:
1. **Review Email Templates**:
   - Check all notification templates
   - Verify placeholders are used:
     - `{{customer.name}}`
     - `{{service.name}}`
     - `{{service.duration}}`
     - `{{service.price}}`
     - `{{booking.date}}`
     - `{{booking.time}}`
     - `{{business.name}}`
     - `{{booking.url}}`
2. **Trigger Each Notification Type**:
   - Booking Created → ✅ Email sent with correct data
   - Booking Completed → ✅ Email sent with correct data
   - 24-Hour Reminder → ✅ Email sent (if scheduled)
   - Cancellation → ✅ Email sent with correct data
3. **Verify Placeholder Replacement**:
   - ✅ All placeholders replaced with actual data
   - ✅ No `{{placeholder}}` text in final email
   - ✅ Data is formatted correctly (dates, prices, etc.)

---

## 🎯 PART 6: ERROR HANDLING & VALIDATION

### Test 6.1: Form Validation

**Objective**: Verify all form validations work

**Steps**:
1. **Test Required Fields**:
   - Try to submit forms with empty required fields
   - ✅ Validation errors appear
   - ✅ Cannot submit until fields filled
2. **Test Email Validation**:
   - Enter invalid email: "notanemail"
   - ✅ Error message appears
3. **Test Phone Validation**:
   - Enter invalid phone: "123"
   - ✅ Error message appears
4. **Test Price Validation**:
   - Enter negative price: "-10"
   - ✅ Error message appears
5. **Test Subdomain Validation**:
   - Enter invalid subdomain: "test-salon!" (special chars)
   - ✅ Error message appears

---

### Test 6.2: Network Error Handling

**Objective**: Verify error handling for network issues

**Steps**:
1. **Simulate Network Failure** (DevTools → Network → Offline):
   - Try to save form
   - ✅ Error message appears
   - ✅ Retry option available
2. **Test API Errors**:
   - Trigger 500 error (if possible)
   - ✅ User-friendly error message
   - ✅ No technical details exposed
3. **Test Timeout Handling**:
   - Slow network (throttle in DevTools)
   - ✅ Loading states show
   - ✅ Timeout handled gracefully

---

### Test 6.3: Payment Error Handling

**Objective**: Verify payment error scenarios

**Steps**:
1. **Test Declined Card**:
   - Use declined card: `4000 0000 0000 0002`
   - Try to complete booking
   - ✅ Error message appears
   - ✅ Can retry with different card
2. **Test Expired Card**:
   - Use expired date
   - ✅ Validation error appears
3. **Test Invalid CVC**:
   - Enter invalid CVC
   - ✅ Validation error appears

---

### Test 6.4: Availability Conflict Handling

**Objective**: Verify double-booking prevention

**Steps**:
1. **Test Simultaneous Bookings**:
   - Open two browser windows
   - Both select same time slot
   - Complete booking in first window
   - Try to complete in second window
   - ✅ Second booking fails or slot is removed
   - ✅ Error message: "This time slot is no longer available"
2. **Test Soft Hold** (if implemented):
   - Select time slot
   - Wait during checkout
   - ✅ Slot is held temporarily
   - ✅ Other customers cannot book during hold

---

## 🎯 PART 7: DATA INTEGRITY & SECURITY

### Test 7.1: Tenant Isolation

**Objective**: Verify data isolation between businesses

**Steps**:
1. **Create Second Business** (if possible):
   - Create new account
   - Complete onboarding for second business
   - Create bookings
2. **Verify Isolation**:
   - Login as first business owner
   - ✅ Cannot see second business data
   - ✅ Cannot access second business admin
   - ✅ Bookings are isolated
3. **Test Public Site Isolation**:
   - Visit first business subdomain
   - ✅ Only see first business services
   - ✅ Cannot access second business data

---

### Test 7.2: Authentication & Authorization

**Objective**: Verify access control

**Steps**:
1. **Test Login Required**:
   - Try to access admin without login
   - ✅ Redirected to login page
2. **Test Invalid Credentials**:
   - Enter wrong password
   - ✅ Error message appears
   - ✅ Cannot login
3. **Test Session Expiry**:
   - Login
   - Wait for session to expire (if configured)
   - Try to access admin
   - ✅ Redirected to login
4. **Test Logout**:
   - Click logout
   - ✅ Session cleared
   - ✅ Redirected to landing page
   - ✅ Cannot access admin after logout

---

### Test 7.3: Data Persistence

**Objective**: Verify data is saved correctly

**Steps**:
1. **Test Autosave** (if implemented):
   - Fill onboarding form
   - Close browser without clicking save
   - Reopen and login
   - ✅ Data is preserved
2. **Test Database Persistence**:
   - Create booking
   - Restart server (if local)
   - ✅ Booking still exists
   - ✅ All data intact

---

## 🎯 PART 8: PERFORMANCE & UX

### Test 8.1: Page Load Performance

**Objective**: Verify pages load quickly

**Steps**:
1. **Test Public Site Load**:
   - Open public booking site
   - ✅ Page loads in < 3 seconds
   - ✅ Images load properly
2. **Test Admin Load**:
   - Open admin dashboard
   - ✅ Dashboard loads quickly
   - ✅ Data appears without long delays
3. **Test Availability Calendar**:
   - Select service
   - ✅ Calendar loads quickly
   - ✅ Slots appear without delay

---

### Test 8.2: Mobile Responsiveness

**Objective**: Verify mobile experience

**Steps**:
1. **Test on Mobile Device or DevTools Mobile View**:
   - Open public booking site on mobile
   - ✅ Site is responsive
   - ✅ Text is readable
   - ✅ Buttons are tappable
   - ✅ Forms are usable
2. **Test Admin on Mobile**:
   - Open admin on mobile
   - ✅ Admin is usable (may have mobile menu)
   - ✅ Can manage bookings
   - ✅ Can edit settings

---

### Test 8.3: User Experience Flow

**Objective**: Verify smooth user experience

**Steps**:
1. **Test Onboarding Flow**:
   - Complete full onboarding
   - ✅ Progress is clear
   - ✅ Can navigate back/forward
   - ✅ No confusing steps
2. **Test Booking Flow**:
   - Complete customer booking
   - ✅ Flow is intuitive
   - ✅ Clear next steps
   - ✅ No dead ends
3. **Test Error Messages**:
   - Trigger various errors
   - ✅ Error messages are clear
   - ✅ Users know how to fix issues

---

## 📊 TEST SUMMARY CHECKLIST

Use this checklist to track your testing progress:

### Onboarding (Part 1)
- [ ] Account creation
- [ ] Step 1: Business basics
- [ ] Step 2: Subdomain selection
- [ ] Step 3: Location & contacts
- [ ] Step 4: Team members
- [ ] Step 5: Branding
- [ ] Step 6: Services & categories
- [ ] Step 7: Availability
- [ ] Step 8: Notifications & plan selection
- [ ] Step 9: Policies
- [ ] Step 10: Gift cards
- [ ] Step 11: Payment setup
- [ ] Go live

### Admin Functionality (Part 2)
- [ ] Admin dashboard access
- [ ] Edit business information
- [ ] Edit services & categories
- [ ] Edit staff & availability
- [ ] Edit branding
- [ ] Edit policies
- [ ] Gift card management
- [ ] Notifications (Pro plan)
- [ ] Account & subscription management

### Customer Booking (Part 3)
- [ ] Public site homepage
- [ ] Service selection
- [ ] Availability selection
- [ ] Checkout & customer info
- [ ] Booking confirmation
- [ ] Email notifications

### Booking Management (Part 4)
- [ ] View past bookings
- [ ] Complete booking & charge
- [ ] No-show fee charge
- [ ] Cancellation fee charge
- [ ] Refund processing
- [ ] Payment failure handling
- [ ] Booking search & filters
- [ ] Booking details & actions

### Advanced Scenarios (Part 5)
- [ ] Multiple bookings
- [ ] Gift card balance deduction
- [ ] Percentage discount
- [ ] Availability updates
- [ ] Timezone handling
- [ ] Service duration & buffers
- [ ] Multiple staff availability
- [ ] Policy snapshots
- [ ] Subscription states
- [ ] Email placeholders

### Error Handling (Part 6)
- [ ] Form validation
- [ ] Network errors
- [ ] Payment errors
- [ ] Availability conflicts

### Security (Part 7)
- [ ] Tenant isolation
- [ ] Authentication
- [ ] Data persistence

### Performance (Part 8)
- [ ] Page load performance
- [ ] Mobile responsiveness
- [ ] User experience

---

## 🐛 BUG REPORTING TEMPLATE

When you find issues, document them using this format:

```
**Bug Title**: [Brief description]

**Severity**: [Critical / High / Medium / Low]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Screenshots/Logs**:
[Attach if available]

**Environment**:
- Browser: 
- OS: 
- Test Mode: [Stripe Test / Production]
```

---

## 📝 NOTES

- **v1.0 Limitation**: SMS notifications are NOT included. Only email notifications are available.
- **Stripe Test Mode**: Always use Stripe test mode for testing. Never use real cards.
- **Email Testing**: Use real email addresses you can access to verify notifications.
- **Data Cleanup**: After testing, you may want to clean up test data or use a separate test environment.
- **Documentation**: Keep notes of any issues, edge cases, or improvements needed.

---

## ✅ SIGN-OFF

After completing all tests, sign off:

**Tester Name**: _________________

**Date**: _________________

**Overall Status**: [ ] Pass [ ] Pass with Issues [ ] Fail

**Critical Issues Found**: _______

**Recommendation**: [ ] Ready for Production [ ] Needs Fixes [ ] Major Rework Required

---

**End of Manual Testing Procedure**

