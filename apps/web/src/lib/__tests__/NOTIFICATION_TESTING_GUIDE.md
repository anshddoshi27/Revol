# Notification System Testing Guide

This guide explains how to test the complete notification system from configuration to delivery.

## Overview

The notification system handles:
1. **Template Configuration** - During onboarding Step 8 and in admin
2. **Template Storage** - Saved to `notification_templates` table
3. **Notification Triggering** - When booking events occur
4. **Job Enqueueing** - Creates jobs in `notification_jobs` table
5. **Job Processing** - Cron job processes and sends notifications
6. **Email Delivery** - Via SendGrid API
7. **SMS Delivery** - Via Twilio API

## Prerequisites

1. **Environment Variables** (already configured):
   - `SENDGRID_API_KEY` - SendGrid API key
   - `SENDGRID_FROM_EMAIL` - From email address
   - `TWILIO_ACCOUNT_SID` - Twilio Account SID
   - `TWILIO_AUTH_TOKEN` - Twilio Auth Token
   - `TWILIO_FROM_NUMBER` - Twilio phone number

2. **Database Tables**:
   - `businesses` - Must have `notifications_enabled` flag
   - `notification_templates` - Stores templates
   - `notification_jobs` - Queues notification jobs
   - `bookings` - Booking records
   - `customers` - Customer records with email/phone

## Test Scenarios

### 1. Template Configuration (Onboarding Step 8)

**Test**: Configure notification templates during onboarding

**Steps**:
1. Complete onboarding steps 1-7
2. Reach Step 8 (Notifications)
3. Select **Pro Plan** ($21.99/month) - enables notifications
4. Create email template:
   - Name: "Booking Confirmation Email"
   - Channel: Email
   - Trigger: Booking Created
   - Subject: "Your booking at ${business.name} is confirmed"
   - Body: "Hi ${customer.name}, your ${service.name} booking on ${booking.date} at ${booking.time} is confirmed."
5. Create SMS template:
   - Name: "Booking Confirmation SMS"
   - Channel: SMS
   - Trigger: Booking Created
   - Body: "Hi ${customer.name}, your ${service.name} booking on ${booking.date} at ${booking.time} is confirmed. ${business.name}"
6. Save and continue

**Expected Result**:
- Templates saved to `notification_templates` table
- `businesses.notifications_enabled` = `true`
- Templates have correct `business_id`, `user_id`, `trigger`, `channel`

**Verify in Database**:
```sql
SELECT * FROM notification_templates 
WHERE business_id = 'your-business-id' 
AND trigger = 'booking_created';

SELECT notifications_enabled FROM businesses 
WHERE id = 'your-business-id';
```

### 2. Template Configuration (Admin Page)

**Test**: Edit templates in admin after onboarding

**Steps**:
1. Navigate to `/app/b/{businessId}/notifications`
2. Verify templates from onboarding are displayed
3. Edit email template body
4. Toggle template enabled/disabled
5. Save changes

**Expected Result**:
- Changes saved to database
- Templates updated in `notification_templates` table

**Verify in Database**:
```sql
SELECT * FROM notification_templates 
WHERE business_id = 'your-business-id' 
AND id = 'template-id';
```

### 3. Booking Creation Triggers Notification

**Test**: Create a booking and verify notification is triggered

**Steps**:
1. Use public booking flow: `POST /api/public/{slug}/bookings`
2. Create booking with customer email and phone:
   ```json
   {
     "service_id": "service-123",
     "staff_id": "staff-123",
     "start_at": "2025-03-18T14:00:00Z",
     "customer": {
       "name": "Jordan Blake",
       "email": "jordan@example.com",
       "phone": "+1987654321"
     }
   }
   ```
3. Verify booking is created

**Expected Result**:
- Booking created in `bookings` table
- `emitNotification()` called with `booking_created` trigger
- Notification jobs created in `notification_jobs` table

**Verify in Database**:
```sql
-- Check booking was created
SELECT * FROM bookings WHERE id = 'booking-id';

-- Check notification jobs were created
SELECT * FROM notification_jobs 
WHERE booking_id = 'booking-id' 
AND trigger = 'booking_created';
```

### 4. Notification Job Processing (Cron)

**Test**: Process pending notification jobs

**Steps**:
1. Wait for cron job to run (or manually trigger): `GET /api/cron/notifications`
2. Cron job processes pending jobs from `notification_jobs` table
3. For each job:
   - If `channel = 'email'`: Call `sendEmailViaSendGrid()`
   - If `channel = 'sms'`: Call `sendSMSViaTwilio()`
4. Update job status to `sent` or `failed`

**Expected Result**:
- Jobs with `status = 'pending'` are processed
- Email sent via SendGrid API
- SMS sent via Twilio API
- Job status updated to `sent`
- `notification_events` record created

**Verify in Database**:
```sql
-- Check processed jobs
SELECT * FROM notification_jobs 
WHERE booking_id = 'booking-id' 
AND status = 'sent';

-- Check notification events
SELECT * FROM notification_events 
WHERE booking_id = 'booking-id';
```

### 5. Email Delivery (SendGrid)

**Test**: Verify email is sent with correct recipient and content

**Steps**:
1. Check SendGrid dashboard for sent emails
2. Verify email recipient matches customer email
3. Verify email subject contains replaced placeholders
4. Verify email body contains replaced placeholders

**Expected Result**:
- Email sent to `jordan@example.com`
- Subject: "Your booking at Studio Nova is confirmed"
- Body: "Hi Jordan Blake, your Signature Cut booking on March 18, 2025 at 2:00 PM is confirmed."
- No placeholder syntax (${...}) in final email

**Verify in SendGrid Dashboard**:
- Go to SendGrid Activity Feed
- Find email sent to customer email
- Verify subject and body content

### 6. SMS Delivery (Twilio)

**Test**: Verify SMS is sent with correct recipient and content

**Steps**:
1. Check Twilio console for sent messages
2. Verify SMS recipient matches customer phone
3. Verify SMS body contains replaced placeholders

**Expected Result**:
- SMS sent to `+1987654321`
- Body: "Hi Jordan Blake, your Signature Cut booking on March 18, 2025 at 2:00 PM is confirmed. Studio Nova"
- No placeholder syntax (${...}) in final SMS

**Verify in Twilio Console**:
- Go to Twilio Console > Messaging > Logs
- Find message sent to customer phone
- Verify body content

### 7. Placeholder Replacement

**Test**: Verify all placeholders are replaced correctly

**Available Placeholders**:
- `${customer.name}` - Customer name
- `${customer.email}` - Customer email
- `${customer.phone}` - Customer phone
- `${service.name}` - Service name
- `${service.duration}` - Service duration in minutes
- `${service.price}` - Service price (formatted)
- `${staff.name}` - Staff member name
- `${booking.code}` - Booking code (REVOL-XXXX)
- `${booking.date}` - Booking date (formatted)
- `${booking.time}` - Booking time (formatted)
- `${booking.amount}` - Final booking amount
- `${business.name}` - Business name
- `${business.phone}` - Business phone
- `${business.support_email}` - Business support email
- `${booking.url}` - Booking confirmation URL

**Test Template**:
```
Hi ${customer.name},

Your ${service.name} appointment with ${staff.name} is confirmed.

Date: ${booking.date}
Time: ${booking.time}
Amount: ${booking.amount}

${business.name}
${business.support_email}
```

**Expected Result**:
All placeholders replaced with actual values, no `${...}` syntax remaining.

### 8. Pro Plan vs Basic Plan

**Test**: Verify Basic Plan skips notifications

**Steps**:
1. Create business with `notifications_enabled = false` (Basic Plan)
2. Create booking
3. Verify no notification jobs created

**Expected Result**:
- `emitNotification()` returns early
- No templates loaded
- No jobs enqueued
- No emails/SMS sent

**Verify in Database**:
```sql
-- Check business plan
SELECT notifications_enabled FROM businesses WHERE id = 'business-id';

-- Verify no jobs created
SELECT COUNT(*) FROM notification_jobs 
WHERE business_id = 'business-id';
```

### 9. All Notification Triggers

**Test**: Verify all triggers work correctly

**Triggers**:
- `booking_created` - When booking is created
- `booking_confirmed` - When booking is confirmed
- `reminder_24h` - 24 hours before appointment
- `reminder_1h` - 1 hour before appointment
- `booking_cancelled` - When booking is cancelled
- `booking_rescheduled` - When booking is rescheduled
- `booking_completed` - When booking is marked completed
- `fee_charged` - When no-show/cancel fee is charged
- `refunded` - When refund is issued
- `payment_issue` - When payment fails

**Steps**:
1. Create templates for each trigger
2. Trigger each event (e.g., mark booking completed)
3. Verify notification is sent

**Expected Result**:
- Each trigger creates appropriate notification job
- Correct template is loaded for each trigger
- Notification sent with correct content

### 10. Error Handling

**Test**: Verify error handling works correctly

**Scenarios**:
1. **Missing customer email**: Email notification skipped, SMS still sent
2. **Missing customer phone**: SMS notification skipped, email still sent
3. **Disabled template**: Template not used, no notification sent
4. **Missing template**: No notification sent (graceful)
5. **SendGrid API error**: Job marked as `failed`, retry scheduled
6. **Twilio API error**: Job marked as `failed`, retry scheduled
7. **Invalid placeholder**: Template validation fails, cannot save

**Expected Result**:
- Errors handled gracefully
- Failed jobs retry with exponential backoff
- Dead jobs (3+ failures) marked as `dead`

## Manual Testing Checklist

- [ ] Configure templates during onboarding (Pro Plan)
- [ ] Verify templates saved to database
- [ ] Create booking via public API
- [ ] Verify notification jobs created
- [ ] Trigger cron job to process jobs
- [ ] Verify email sent via SendGrid
- [ ] Verify SMS sent via Twilio
- [ ] Verify placeholders replaced correctly
- [ ] Test Basic Plan (no notifications)
- [ ] Test all notification triggers
- [ ] Test error scenarios

## Automated Testing

Run the comprehensive test suite:

```bash
npm test notifications-end-to-end-production.test.ts
```

This test covers:
- Template configuration and saving
- Placeholder replacement
- Job enqueueing
- SendGrid email sending
- Twilio SMS sending
- Pro vs Basic Plan behavior
- All notification triggers
- Error handling

## Troubleshooting

### Notifications not sending

1. **Check business plan**:
   ```sql
   SELECT notifications_enabled FROM businesses WHERE id = 'business-id';
   ```
   Must be `true` for Pro Plan.

2. **Check templates exist**:
   ```sql
   SELECT * FROM notification_templates 
   WHERE business_id = 'business-id' 
   AND trigger = 'booking_created' 
   AND is_enabled = true;
   ```

3. **Check jobs created**:
   ```sql
   SELECT * FROM notification_jobs 
   WHERE business_id = 'business-id' 
   AND status = 'pending';
   ```

4. **Check cron job running**:
   - Verify cron job is scheduled in `vercel.json`
   - Check cron job logs
   - Manually trigger: `GET /api/cron/notifications`

5. **Check API credentials**:
   - Verify `SENDGRID_API_KEY` is set
   - Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` are set

### Placeholders not replacing

1. **Check placeholder syntax**: Must be `${placeholder.name}`
2. **Check allowed placeholders**: See `ALLOWED_PLACEHOLDERS` in `notifications.ts`
3. **Check template validation**: Invalid placeholders should be rejected during save

### Wrong recipient

1. **Check customer data**:
   ```sql
   SELECT email, phone FROM customers WHERE id = 'customer-id';
   ```

2. **Check job data**:
   ```sql
   SELECT recipient_email, recipient_phone FROM notification_jobs 
   WHERE booking_id = 'booking-id';
   ```

## Database Queries for Verification

```sql
-- Check business notification settings
SELECT id, name, notifications_enabled FROM businesses WHERE id = 'business-id';

-- Check templates
SELECT id, name, channel, trigger, is_enabled 
FROM notification_templates 
WHERE business_id = 'business-id';

-- Check notification jobs
SELECT id, channel, trigger, status, recipient_email, recipient_phone, created_at
FROM notification_jobs 
WHERE business_id = 'business-id' 
ORDER BY created_at DESC;

-- Check notification events (sent notifications)
SELECT id, channel, to_address, status, sent_at
FROM notification_events 
WHERE business_id = 'business-id' 
ORDER BY sent_at DESC;
```

