# Production Smoke Test Plan
## Post-Deployment Validation for Stripe, SendGrid, and Twilio

**Purpose:** Validate that all integrations work correctly in production after deployment.

**Prerequisites:**
- Production environment is deployed
- All environment variables are set (see PRODUCTION_INTEGRATION_VALIDATION_REPORT.md)
- You have access to:
  - Stripe Dashboard (live mode)
  - SendGrid Dashboard
  - Twilio Console
  - Your production app

---

## 🔴 STRIPE SMOKE TESTS

### Test 1: Stripe Connect Account Creation & Onboarding

**Objective:** Verify business owners can create Stripe Connect accounts and complete onboarding.

**Steps:**
1. Log in to your production app as a business owner
2. Navigate to onboarding flow (Step 11: Payment Setup)
3. Enter your email address
4. Click "Connect Stripe Account" or similar button
5. **Expected:** You should be redirected to Stripe Connect onboarding page
6. Complete the Stripe onboarding form:
   - Business type
   - Business details
   - Bank account information (use test bank account in test mode)
   - Identity verification
7. **Expected:** After completing, you should be redirected back to your app
8. **Expected:** Your app should show "Stripe account connected" or similar success message

**Verification:**
- ✅ Check Stripe Dashboard → Connect → Accounts
- ✅ Find your account (search by email)
- ✅ Verify account status shows "Active" or "Onboarding complete"
- ✅ Verify account has `type: express`
- ✅ Check your app's database: `businesses.stripe_connect_account_id` should be set

**Success Criteria:**
- ✅ Redirect to Stripe onboarding works
- ✅ Account is created in Stripe
- ✅ Account ID is saved in database
- ✅ Return URL works correctly

---

### Test 2: Subscription Creation

**Objective:** Verify subscription is created when business completes payment setup.

**Steps:**
1. Complete Test 1 (Connect account onboarding)
2. After returning from Stripe, your app should create a subscription
3. **Expected:** Subscription should be created with 7-day trial period

**Verification:**
- ✅ Check Stripe Dashboard → Customers → Find your customer
- ✅ Check Subscriptions tab
- ✅ Verify subscription exists with status "trialing" or "incomplete"
- ✅ Verify `trial_end` is set to 7 days from now
- ✅ Check your app's database: `businesses.stripe_subscription_id` should be set
- ✅ Check `businesses.subscription_status` should be "trial"

**Success Criteria:**
- ✅ Subscription created in Stripe
- ✅ Subscription ID saved in database
- ✅ Trial period is 7 days
- ✅ Status is correctly set

---

### Test 3: Payment Intent Creation (Booking Charge)

**Objective:** Verify a booking payment can be charged to a customer and funds transferred to connected account.

**Prerequisites:**
- Business owner has completed Connect onboarding
- Business owner has an active subscription
- You have a test customer with a saved payment method

**Steps:**
1. Create a new booking through the public booking flow
2. Complete the booking with a test card (use Stripe test cards)
3. **Expected:** Payment should be processed

**Verification:**
- ✅ Check Stripe Dashboard → Payments → Payment Intents
- ✅ Find the payment intent for your booking
- ✅ Verify status is "succeeded"
- ✅ Verify `on_behalf_of` is set to the connected account ID
- ✅ Verify `transfer_data.destination` is the connected account ID
- ✅ Verify `application_fee_amount` is set (1% of amount)
- ✅ Check your app's database:
  - `booking_payments.status` should be "charged"
  - `bookings.payment_status` should be "charged"
  - `bookings.status` should be "completed" (if it was a completion charge)

**Success Criteria:**
- ✅ Payment intent created successfully
- ✅ Payment charged to customer
- ✅ Funds transferred to connected account
- ✅ Application fee deducted
- ✅ Database records updated correctly

**Test Cards to Use:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires 3D Secure: `4000 0025 0000 3155`

---

### Test 4: No-Show Fee Charge

**Objective:** Verify no-show fees can be charged automatically.

**Prerequisites:**
- Booking exists with saved payment method
- Booking is marked as no-show

**Steps:**
1. Mark a booking as "no-show" in the admin panel
2. **Expected:** System should attempt to charge the no-show fee

**Verification:**
- ✅ Check Stripe Dashboard → Payments
- ✅ Find the payment intent with metadata `money_action: "no_show_fee"`
- ✅ Verify payment succeeded
- ✅ Check your app's database:
  - `bookings.status` should be "no_show"
  - `bookings.last_money_action` should be "no_show_fee"
  - `booking_payments.status` should be "charged"

**Success Criteria:**
- ✅ No-show fee charged successfully
- ✅ Database records updated correctly

---

### Test 5: Refund Processing

**Objective:** Verify refunds can be processed and webhook updates the database.

**Prerequisites:**
- A completed booking with a successful payment

**Steps:**
1. Navigate to booking details in admin panel
2. Click "Refund" button
3. Confirm refund (full or partial)
4. **Expected:** Refund should be processed

**Verification:**
- ✅ Check Stripe Dashboard → Payments → Refunds
- ✅ Find the refund for your payment intent
- ✅ Verify refund status is "succeeded"
- ✅ Check your app's database:
  - New `booking_payments` record with `money_action: "refund"`
  - `bookings.status` should be "refunded"
  - `bookings.payment_status` should be "refunded"

**Success Criteria:**
- ✅ Refund created in Stripe
- ✅ Refund record created in database
- ✅ Booking status updated correctly

---

### Test 6: Webhook Event Processing

**Objective:** Verify webhook events are received and processed correctly.

**Steps:**
1. Perform any action that triggers a webhook (e.g., subscription update, payment success)
2. Check webhook logs

**Verification:**
- ✅ Check Stripe Dashboard → Developers → Webhooks
- ✅ Click on your webhook endpoint
- ✅ Check "Recent events" tab
- ✅ Verify events are being received (green checkmarks)
- ✅ Click on an event to see request/response
- ✅ Verify response status is 200
- ✅ Check your app logs for webhook processing
- ✅ Verify database was updated correctly (e.g., subscription status)

**Success Criteria:**
- ✅ Webhooks are being received
- ✅ Webhooks return 200 status
- ✅ Database is updated correctly
- ✅ No webhook errors in logs

**Manual Webhook Test (if needed):**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Send test webhook"
3. Select event type (e.g., `payment_intent.succeeded`)
4. Send test webhook
5. Verify it's received and processed

---

## 📧 SENDGRID SMOKE TESTS

### Test 7: Email Notification - Booking Created

**Objective:** Verify email notifications are sent when bookings are created.

**Prerequisites:**
- SendGrid API key is configured
- Email template is enabled for "booking created"
- You have a real email address to test with

**Steps:**
1. Enable "booking created" email notification in admin panel
2. Create a new booking through the public booking flow
3. Use your real email address as the customer email
4. Complete the booking
5. **Expected:** Email should be sent within 2 minutes (cron job runs every 2 minutes)

**Verification:**
- ✅ Check your email inbox (and spam folder)
- ✅ Verify email was received
- ✅ Verify email contains correct booking details:
  - Customer name
  - Booking date/time
  - Service name
  - Business name
  - Placeholders are replaced (not showing `{{customer_name}}`)
- ✅ Check SendGrid Dashboard → Activity
- ✅ Find your email in the activity feed
- ✅ Verify status is "Delivered" (green)
- ✅ Check your app's database:
  - `notification_jobs.status` should be "sent"
  - `notification_events.status` should be "sent"
  - `provider_message_id` should be set

**Success Criteria:**
- ✅ Email is received
- ✅ Email content is correct (placeholders replaced)
- ✅ SendGrid shows "Delivered" status
- ✅ Database records show "sent" status

---

### Test 8: Email Notification - Template Disabled

**Objective:** Verify emails are NOT sent when template is disabled.

**Steps:**
1. Disable "booking created" email notification in admin panel
2. Create a new booking
3. **Expected:** No email should be sent

**Verification:**
- ✅ Check your email inbox - no new email
- ✅ Check SendGrid Dashboard → Activity - no new email
- ✅ Check your app's database:
  - `notification_jobs` should not have a record for this booking
  - OR if record exists, it should not be processed

**Success Criteria:**
- ✅ No email sent when template is disabled
- ✅ No notification job created (or job not processed)

---

### Test 9: Email Notification - Retry Logic

**Objective:** Verify failed emails are retried with exponential backoff.

**Steps:**
1. Temporarily set an invalid `SENDGRID_API_KEY` (or use a test that will fail)
2. Create a booking that should trigger an email
3. Wait for cron job to process
4. **Expected:** Job should fail and be scheduled for retry

**Verification:**
- ✅ Check your app's database:
  - `notification_jobs.status` should be "failed"
  - `attempt_count` should be 1
  - `next_retry_at` should be set to 15 minutes from now
- ✅ Wait 15 minutes (or manually trigger cron)
- ✅ Check again:
  - `attempt_count` should be 2
  - `next_retry_at` should be set to 30 minutes from now
- ✅ After 3 failed attempts:
  - `status` should be "dead"
  - `next_retry_at` should be null

**Success Criteria:**
- ✅ Failed jobs are retried
- ✅ Exponential backoff works (15min, 30min, 45min)
- ✅ Jobs are marked as "dead" after 3 attempts

---

## 📱 TWILIO SMOKE TESTS

### Test 10: SMS Notification - Booking Created

**Objective:** Verify SMS notifications are sent when bookings are created.

**Prerequisites:**
- Twilio credentials are configured
- SMS template is enabled for "booking created"
- You have a real phone number to test with (your own phone)

**Steps:**
1. Enable "booking created" SMS notification in admin panel
2. Create a new booking through the public booking flow
3. Use your real phone number as the customer phone
4. Complete the booking
5. **Expected:** SMS should be sent within 2 minutes (cron job runs every 2 minutes)

**Verification:**
- ✅ Check your phone - SMS should be received
- ✅ Verify SMS contains correct booking details:
  - Customer name
  - Booking date/time
  - Service name
  - Business name
  - Placeholders are replaced (not showing `{{customer_name}}`)
- ✅ Check Twilio Console → Monitor → Logs → Messaging
- ✅ Find your SMS in the logs
- ✅ Verify status is "delivered" or "sent"
- ✅ Check your app's database:
  - `notification_jobs.status` should be "sent"
  - `notification_events.status` should be "sent"
  - `provider_message_id` should be set (Twilio SID)

**Success Criteria:**
- ✅ SMS is received
- ✅ SMS content is correct (placeholders replaced)
- ✅ Twilio shows "delivered" status
- ✅ Database records show "sent" status

---

### Test 11: SMS Notification - Template Disabled

**Objective:** Verify SMS are NOT sent when template is disabled.

**Steps:**
1. Disable "booking created" SMS notification in admin panel
2. Create a new booking
3. **Expected:** No SMS should be sent

**Verification:**
- ✅ Check your phone - no new SMS
- ✅ Check Twilio Console → Logs - no new SMS
- ✅ Check your app's database:
  - `notification_jobs` should not have a record for this booking
  - OR if record exists, it should not be processed

**Success Criteria:**
- ✅ No SMS sent when template is disabled
- ✅ No notification job created (or job not processed)

---

### Test 12: SMS Notification - Invalid Phone Number

**Objective:** Verify system handles invalid phone numbers gracefully.

**Steps:**
1. Create a booking with an invalid phone number (e.g., "123" or "invalid")
2. Enable SMS notification
3. **Expected:** SMS should fail gracefully

**Verification:**
- ✅ Check your app's database:
  - `notification_jobs.status` should be "failed" or "dead"
  - `last_error` should contain error message
- ✅ Check Twilio Console → Logs
- ✅ Verify error is logged (e.g., "Invalid 'To' number")

**Success Criteria:**
- ✅ Invalid phone numbers are handled gracefully
- ✅ Error is logged
- ✅ Job is marked as failed

---

## 🔄 INTEGRATION TESTS

### Test 13: End-to-End Booking Flow with Notifications

**Objective:** Verify complete booking flow works with all integrations.

**Steps:**
1. **Setup:**
   - Business owner has completed Stripe Connect onboarding
   - Business owner has active subscription
   - Email and SMS notifications are enabled
2. **Create Booking:**
   - Navigate to public booking page
   - Select service and time slot
   - Enter customer details (real email and phone)
   - Complete booking with test card
3. **Expected Results:**
   - ✅ Payment is processed successfully
   - ✅ Booking is created
   - ✅ Email is sent to customer
   - ✅ SMS is sent to customer
   - ✅ Business owner receives notification (if enabled)

**Verification:**
- ✅ Stripe: Payment intent succeeded
- ✅ SendGrid: Email delivered
- ✅ Twilio: SMS delivered
- ✅ Database: All records created correctly

**Success Criteria:**
- ✅ All integrations work together
- ✅ No errors in any service
- ✅ Customer receives both email and SMS

---

## 📊 MONITORING CHECKLIST

After completing smoke tests, set up ongoing monitoring:

### Stripe Monitoring:
- [ ] Set up Stripe Dashboard alerts for:
  - Failed payments
  - Webhook failures
  - Disputes
- [ ] Monitor Connect account onboarding completion rate
- [ ] Monitor subscription churn rate

### SendGrid Monitoring:
- [ ] Set up SendGrid alerts for:
  - Bounce rate > 5%
  - Spam complaints
  - API errors
- [ ] Monitor email delivery rate
- [ ] Check sender reputation

### Twilio Monitoring:
- [ ] Set up Twilio alerts for:
  - Failed SMS deliveries
  - Low account balance
  - API errors
- [ ] Monitor SMS delivery rate
- [ ] Check phone number status

### Application Monitoring:
- [ ] Monitor notification cron job execution
- [ ] Check for failed notification jobs
- [ ] Monitor webhook processing errors
- [ ] Set up alerts for critical failures

---

## 🐛 TROUBLESHOOTING GUIDE

### Stripe Issues:

**Problem:** Webhook not receiving events
- **Check:** Webhook URL is correct in Stripe Dashboard
- **Check:** `STRIPE_WEBHOOK_SECRET` is set correctly
- **Check:** Webhook endpoint is publicly accessible
- **Check:** SSL certificate is valid

**Problem:** Payment fails
- **Check:** Connected account is active and charges_enabled
- **Check:** Customer has valid payment method
- **Check:** Payment intent metadata is correct
- **Check:** Application fee calculation is correct

### SendGrid Issues:

**Problem:** Emails not being sent
- **Check:** `SENDGRID_API_KEY` is valid and has permissions
- **Check:** `SENDGRID_FROM_EMAIL` is verified in SendGrid
- **Check:** Notification cron job is running
- **Check:** Notification jobs are being created
- **Check:** SendGrid activity logs for errors

**Problem:** Emails going to spam
- **Check:** SPF/DKIM records are set up
- **Check:** Sender reputation in SendGrid
- **Check:** Email content (avoid spam trigger words)

### Twilio Issues:

**Problem:** SMS not being sent
- **Check:** `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are correct
- **Check:** `TWILIO_FROM_NUMBER` is verified and active
- **Check:** Phone number format is correct (+country code)
- **Check:** Twilio account has sufficient credits
- **Check:** Notification cron job is running
- **Check:** Twilio logs for errors

**Problem:** SMS delivery fails
- **Check:** Recipient phone number is valid
- **Check:** Phone number is in correct format
- **Check:** Twilio account restrictions (geographic, etc.)

---

## ✅ FINAL CHECKLIST

Before considering production fully validated:

- [ ] All Stripe smoke tests passed
- [ ] All SendGrid smoke tests passed
- [ ] All Twilio smoke tests passed
- [ ] End-to-end integration test passed
- [ ] Monitoring is set up
- [ ] Error alerts are configured
- [ ] Documentation is updated
- [ ] Team is trained on troubleshooting

---

## 📝 TEST RESULTS TEMPLATE

Use this template to record your test results:

```
Date: ___________
Tester: ___________
Environment: Production

Stripe Tests:
- [ ] Test 1: Connect Account Creation - PASS / FAIL
- [ ] Test 2: Subscription Creation - PASS / FAIL
- [ ] Test 3: Payment Intent Creation - PASS / FAIL
- [ ] Test 4: No-Show Fee Charge - PASS / FAIL
- [ ] Test 5: Refund Processing - PASS / FAIL
- [ ] Test 6: Webhook Event Processing - PASS / FAIL

SendGrid Tests:
- [ ] Test 7: Email Notification - Booking Created - PASS / FAIL
- [ ] Test 8: Email Notification - Template Disabled - PASS / FAIL
- [ ] Test 9: Email Notification - Retry Logic - PASS / FAIL

Twilio Tests:
- [ ] Test 10: SMS Notification - Booking Created - PASS / FAIL
- [ ] Test 11: SMS Notification - Template Disabled - PASS / FAIL
- [ ] Test 12: SMS Notification - Invalid Phone Number - PASS / FAIL

Integration Tests:
- [ ] Test 13: End-to-End Booking Flow - PASS / FAIL

Issues Found:
1. 
2. 
3. 

Overall Status: ✅ PASS / ❌ FAIL
```

---

**Note:** Run these tests immediately after deployment and again after any changes to integration code or environment variables.


