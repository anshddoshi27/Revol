# Notification System V1 Verification Prompt

## Objective
Verify that the email and SMS notification system works correctly for v1, ensuring that:
1. Notifications are enabled and functional (not disabled/coming soon)
2. Pro Plan businesses can configure and send notifications
3. Basic Plan businesses cannot send notifications (only booking confirmations)
4. Notifications are sent at the correct times according to configuration
5. Notifications use the configured content/templates
6. SendGrid and Twilio integrations work correctly
7. Placeholder replacement works correctly
8. Notifications are queued and processed by cron jobs

## Prerequisites Check

### 1. Feature Flags
**File**: `apps/web/src/lib/feature-flags.ts`

Verify:
- `NOTIFICATIONS_ENABLED: true` (not false)
- `NOTIFICATIONS_COMING_SOON: false` (not true)

**Action if wrong**: Update flags to enable notifications for v1.

### 2. Environment Variables
**File**: `apps/web/.env`

Verify all required variables are set:
- `SENDGRID_API_KEY` - Valid API key
- `SENDGRID_FROM_EMAIL` - Verified sender email (or defaults to noreply@tithi.com)
- `TWILIO_ACCOUNT_SID` - Valid account SID
- `TWILIO_AUTH_TOKEN` - Valid auth token
- `TWILIO_FROM_NUMBER` - Valid phone number in E.164 format (e.g., +18666166044)

**Action if missing**: Add missing variables or verify credentials.

### 3. SendGrid Sender Verification
**Check**: https://app.sendgrid.com/settings/sender_auth

Verify:
- The email address in `SENDGRID_FROM_EMAIL` (or `noreply@tithi.com`) is verified
- Status shows "Verified" (not "Pending" or "Unverified")

**Action if not verified**: Verify the sender identity in SendGrid dashboard.

### 4. Twilio Phone Number
**Check**: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

Verify:
- Phone number in `TWILIO_FROM_NUMBER` exists and is active
- Number has SMS capability enabled

**Action if missing**: Purchase/activate a phone number with SMS capability.

## Verification Steps

### Step 1: Run Verification Script
```bash
cd /path/to/Tithi
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

**Expected Results**:
- ✅ SendGrid email test passed
- ✅ Twilio SMS test passed (or skipped if TEST_PHONE not set)
- ✅ Placeholder replacement test passed
- ✅ Placeholder validation test passed
- ✅ Overall verification: PASSED

**If failed**: Fix the issues shown in the output (API keys, sender verification, etc.)

### Step 2: Database Setup Verification

**Check Business Configuration**:
```sql
-- Check if businesses exist with notifications enabled
SELECT id, name, notifications_enabled, user_id 
FROM businesses 
WHERE notifications_enabled = true 
LIMIT 1;
```

**If no Pro Plan business exists**:
1. Create a test business OR
2. Update an existing business:
   ```sql
   UPDATE businesses 
   SET notifications_enabled = true 
   WHERE id = 'your-business-id';
   ```

**Check Notification Templates**:
```sql
-- Check if notification templates exist for a business
SELECT id, business_id, trigger, channel, enabled, subject, body
FROM notification_templates
WHERE business_id = 'your-business-id'
ORDER BY trigger, channel;
```

**If no templates exist**: Templates should be created during onboarding Step 8 (Notifications).

### Step 3: Test Onboarding Flow (Pro Plan)

**Test Path**:
1. Go through onboarding process
2. Reach Step 8: Notifications
3. **Verify**: Should show Pro Plan and Basic Plan options (NOT "Coming Soon")
4. Select **Pro Plan** ($21.99/month)
5. Configure at least one notification template:
   - Select trigger: `booking_created`
   - Select channel: `email` or `sms`
   - Add message with placeholders: `Hi ${customer.name}, your ${service.name} booking is confirmed for ${booking.date} at ${booking.time}.`
   - Enable the template
6. Complete onboarding

**Verify in Database**:
```sql
-- Check business has notifications enabled
SELECT notifications_enabled FROM businesses WHERE id = 'new-business-id';
-- Should return: true

-- Check templates were created
SELECT COUNT(*) FROM notification_templates WHERE business_id = 'new-business-id';
-- Should return: > 0
```

### Step 4: Test Admin Notifications Page

**Test Path**:
1. Login to admin dashboard
2. Navigate to: `/app/b/[businessId]/notifications`
3. **Verify**: Page loads and shows notification templates (NOT "Coming Soon" message)
4. Edit a template:
   - Change message content
   - Toggle enabled/disabled
   - Add/remove placeholders
5. Save changes

**Verify in Database**:
```sql
-- Check template was updated
SELECT body, enabled FROM notification_templates 
WHERE business_id = 'business-id' AND trigger = 'booking_created' AND channel = 'email';
-- Should show updated content
```

### Step 5: Test Booking Flow - Notification Triggering

**Test Path**:
1. Create a booking through the public booking flow:
   - Go to: `/public/[businessSlug]/bookings`
   - Select service
   - Select date/time
   - Enter customer info (name, email, phone)
   - Complete booking

2. **Verify Notification Job Created**:
```sql
-- Check notification job was created
SELECT id, business_id, trigger, channel, status, scheduled_at, created_at
FROM notification_jobs
WHERE booking_id = 'booking-id'
ORDER BY created_at DESC;
-- Should show jobs with status = 'pending' or 'processing'
```

3. **Verify Job Details**:
```sql
-- Check job has correct data
SELECT 
  nj.id,
  nj.trigger,
  nj.channel,
  nj.status,
  nj.to_email,
  nj.to_phone,
  nj.subject,
  nj.body,
  nj.scheduled_at
FROM notification_jobs nj
WHERE nj.booking_id = 'booking-id'
LIMIT 5;
```

**Verify Placeholder Replacement**:
- Check `nj.body` - should have placeholders replaced (e.g., `${customer.name}` → actual customer name)
- Check `nj.subject` (for email) - should have placeholders replaced
- Check `nj.to_email` - should match customer email
- Check `nj.to_phone` - should match customer phone (for SMS)

### Step 6: Test Cron Job Processing

**Manual Trigger** (for testing):
```bash
# Test the cron endpoint directly
curl -X GET "http://localhost:3000/api/cron/notifications" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Or check cron job status**:
```sql
-- Check pending jobs
SELECT id, trigger, channel, status, retry_count, scheduled_at, created_at
FROM notification_jobs
WHERE status = 'pending'
  AND scheduled_at <= NOW()
ORDER BY scheduled_at ASC
LIMIT 10;
```

**Verify Processing**:
```sql
-- Check recently processed jobs
SELECT id, trigger, channel, status, error_message, processed_at
FROM notification_jobs
WHERE status IN ('completed', 'failed')
ORDER BY processed_at DESC
LIMIT 10;
```

**Expected**:
- Jobs with `status = 'completed'` should have `processed_at` set
- Jobs with `status = 'failed'` should have `error_message` with details
- Check SendGrid/Twilio logs to confirm actual sends

### Step 7: Test Notification Timing

**Test Reminder Notifications**:

1. Create a booking scheduled for 24+ hours in the future
2. **Verify**: `reminder_24h` job should be created with `scheduled_at` = booking time - 24 hours

```sql
-- Check reminder jobs
SELECT 
  nj.id,
  nj.trigger,
  nj.scheduled_at,
  b.start_at as booking_time,
  nj.scheduled_at + INTERVAL '24 hours' as expected_booking_time
FROM notification_jobs nj
JOIN bookings b ON b.id = nj.booking_id
WHERE nj.trigger = 'reminder_24h'
  AND nj.status = 'pending';
```

**Verify Timing Logic**:
- `reminder_24h`: Should be scheduled 24 hours before booking
- `reminder_1h`: Should be scheduled 1 hour before booking
- `booking_created`: Should be scheduled immediately (or at booking time)

### Step 8: Test Basic Plan (Notifications Disabled)

**Test Path**:
1. Create/update a business with `notifications_enabled = false`
2. Create a booking for this business
3. **Verify**: No notification jobs should be created

```sql
-- Verify no jobs created for Basic Plan business
SELECT COUNT(*) 
FROM notification_jobs nj
JOIN bookings b ON b.id = nj.booking_id
WHERE b.business_id = 'basic-plan-business-id';
-- Should return: 0
```

4. **Verify Admin Page**: Should show "Basic Plan - Notifications Not Available" message

### Step 9: Test Placeholder Replacement

**Verify All Placeholders Work**:

Create a test template with all placeholders:
```
Hi ${customer.name},

Your ${service.name} appointment with ${staff.name} is confirmed.

Service: ${service.name}
Duration: ${service.duration}
Price: ${service.price}
Date: ${booking.date}
Time: ${booking.time}

Business: ${business.name}
Booking URL: ${booking.url}
```

**Test**:
1. Create a booking
2. Check notification job body - all placeholders should be replaced
3. Verify no `${...}` placeholders remain in the final message

```sql
-- Check for unreplaced placeholders
SELECT id, body
FROM notification_jobs
WHERE body LIKE '%${%'
  AND status = 'pending';
-- Should return: 0 rows (no unreplaced placeholders)
```

### Step 10: Test Error Handling

**Test Failed Sends**:

1. Temporarily break SendGrid API key (use invalid key)
2. Create a booking
3. Let cron job process
4. **Verify**: Job status should be `failed` with error message

```sql
-- Check failed jobs
SELECT id, trigger, channel, status, error_message, retry_count
FROM notification_jobs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
```

5. **Verify Retry Logic**: Jobs with `retry_count < 3` should have `next_retry_at` set
6. Restore valid API key
7. **Verify**: Retry should eventually succeed

### Step 11: End-to-End Test

**Complete Flow Test**:

1. **Setup**:
   - Business with Pro Plan (`notifications_enabled = true`)
   - Templates configured for `booking_created` (email and SMS)
   - Valid SendGrid and Twilio credentials

2. **Create Booking**:
   - Use public booking flow
   - Customer: Real email and phone number
   - Service: Any service
   - Date/Time: Current time or near future

3. **Verify**:
   - ✅ Notification jobs created in database
   - ✅ Jobs have correct `to_email` and `to_phone`
   - ✅ Placeholders replaced in message
   - ✅ Cron job processes jobs
   - ✅ Email received at customer email
   - ✅ SMS received at customer phone
   - ✅ Jobs marked as `completed` in database

4. **Check Actual Delivery**:
   - Check customer email inbox
   - Check customer phone for SMS
   - Verify message content matches template
   - Verify placeholders are replaced correctly

## Success Criteria

✅ **Feature Flags**: Notifications enabled (not coming soon)  
✅ **Credentials**: SendGrid and Twilio properly configured  
✅ **Onboarding**: Pro Plan selection works, templates can be configured  
✅ **Admin Page**: Templates can be edited and saved  
✅ **Booking Flow**: Creates notification jobs when bookings are made  
✅ **Placeholders**: All placeholders replaced correctly  
✅ **Timing**: Jobs scheduled at correct times  
✅ **Cron Job**: Processes pending jobs successfully  
✅ **Delivery**: Emails and SMS actually sent and received  
✅ **Basic Plan**: No notifications sent for Basic Plan businesses  
✅ **Error Handling**: Failed sends are retried and logged  

## Common Issues & Fixes

### Issue: "Coming Soon" message shown
**Fix**: Check `feature-flags.ts` - set `NOTIFICATIONS_ENABLED: true` and `NOTIFICATIONS_COMING_SOON: false`

### Issue: SendGrid 403 error
**Fix**: Verify sender identity at https://app.sendgrid.com/settings/sender_auth

### Issue: Twilio 401 error
**Fix**: Regenerate API keys in Twilio Console

### Issue: No notification jobs created
**Fix**: 
- Check business has `notifications_enabled = true`
- Check `emitNotification()` is called after booking creation
- Check feature flag is enabled

### Issue: Jobs not processing
**Fix**:
- Check cron job is running (Vercel cron or manual trigger)
- Check `CRON_SECRET` is set correctly
- Check jobs have `scheduled_at <= NOW()`

### Issue: Placeholders not replaced
**Fix**: Check `renderTemplate()` function and `NotificationData` structure

## Final Verification Command

Run this comprehensive check:

```bash
# 1. Verify feature flags
grep -A 2 "NOTIFICATIONS_ENABLED" apps/web/src/lib/feature-flags.ts

# 2. Run verification script
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts

# 3. Run end-to-end test
npx tsx apps/web/src/lib/__tests__/test-notifications-live.ts
```

All three should pass for v1 to be fully functional.

