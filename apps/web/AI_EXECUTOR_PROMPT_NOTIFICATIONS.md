# AI Executor Prompt: Verify Notifications V1

## Your Task
Verify that the email and SMS notification system works correctly for v1. Ensure notifications are sent successfully for bookings according to configured time and content.

## Quick Start

1. **Check Feature Flags** (`apps/web/src/lib/feature-flags.ts`):
   - `NOTIFICATIONS_ENABLED` must be `true`
   - `NOTIFICATIONS_COMING_SOON` must be `false`
   - If wrong, fix them.

2. **Run Verification**:
   ```bash
   npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
   ```
   Must show: `✅ Overall verification: PASSED`

3. **Test End-to-End**:
   ```bash
   npx tsx apps/web/src/lib/__tests__/test-notifications-live.ts
   ```
   This creates a real booking and sends notifications.

## Critical Checks

### ✅ Pro Plan Businesses
- Can configure notification templates in onboarding Step 8
- Can edit templates in admin `/app/b/[businessId]/notifications`
- Templates are saved to `notification_templates` table
- Business has `notifications_enabled = true` in database

### ✅ Booking Flow
- When a booking is created, `emitNotification()` is called
- Notification jobs are created in `notification_jobs` table
- Jobs have correct `to_email` and `to_phone` from booking
- Placeholders in templates are replaced (e.g., `${customer.name}` → actual name)
- Jobs have correct `scheduled_at` time based on trigger type

### ✅ Notification Timing
- `booking_created`: Sent immediately (or at booking time)
- `reminder_24h`: Scheduled 24 hours before booking
- `reminder_1h`: Scheduled 1 hour before booking
- Other triggers: Scheduled according to their logic

### ✅ Cron Job Processing
- Cron endpoint `/api/cron/notifications` processes pending jobs
- Jobs with `status = 'pending'` and `scheduled_at <= NOW()` are processed
- SendGrid API is called for email jobs
- Twilio API is called for SMS jobs
- Jobs are marked `completed` on success or `failed` on error
- Failed jobs are retried (up to 3 times) with exponential backoff

### ✅ Actual Delivery
- Emails are actually sent via SendGrid (check customer inbox)
- SMS are actually sent via Twilio (check customer phone)
- Message content matches configured templates
- All placeholders are replaced correctly

### ✅ Basic Plan Businesses
- Cannot configure notifications (shows "Basic Plan" message)
- No notification jobs created when bookings are made
- Only booking confirmations shown (no automated emails/SMS)

## Database Queries to Verify

```sql
-- Check Pro Plan business exists
SELECT id, name, notifications_enabled FROM businesses WHERE notifications_enabled = true LIMIT 1;

-- Check templates exist
SELECT id, trigger, channel, enabled, body FROM notification_templates WHERE business_id = 'business-id';

-- Check jobs created for a booking
SELECT id, trigger, channel, status, to_email, to_phone, scheduled_at 
FROM notification_jobs 
WHERE booking_id = 'booking-id' 
ORDER BY created_at DESC;

-- Check for unreplaced placeholders
SELECT id, body FROM notification_jobs WHERE body LIKE '%${%' AND status = 'pending';

-- Check pending jobs ready to process
SELECT COUNT(*) FROM notification_jobs 
WHERE status = 'pending' AND scheduled_at <= NOW();
```

## Common Issues to Fix

1. **"Coming Soon" shown**: Update `feature-flags.ts` to enable notifications
2. **SendGrid 403**: Verify sender at https://app.sendgrid.com/settings/sender_auth
3. **Twilio 401**: Check API credentials in `.env`
4. **No jobs created**: Check `notifications_enabled = true` and `emitNotification()` is called
5. **Jobs not processing**: Check cron job is running and `CRON_SECRET` is set
6. **Placeholders not replaced**: Check `renderTemplate()` function

## Success Criteria

All of these must be true:
- ✅ Feature flags enable notifications
- ✅ Verification script passes
- ✅ Pro Plan businesses can configure templates
- ✅ Bookings create notification jobs
- ✅ Jobs are processed by cron
- ✅ Emails/SMS are actually sent
- ✅ Content matches templates
- ✅ Timing is correct
- ✅ Basic Plan businesses don't send notifications

## Report Format

After verification, report:
1. Feature flag status
2. Verification script results
3. Database checks (businesses, templates, jobs)
4. End-to-end test results
5. Any issues found and fixes applied
6. Final status: ✅ PASS or ❌ FAIL

