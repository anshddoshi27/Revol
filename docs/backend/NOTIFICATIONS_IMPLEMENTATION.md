# Notifications Engine Implementation

## Overview

Complete notification system for Tithi that allows business owners to configure email and SMS templates with dynamic placeholders, and automatically sends notifications when booking events occur.

## Features Implemented

### 1. Template Management (CRUD)
- **GET** `/api/admin/notifications/templates` - List all templates
- **POST** `/api/admin/notifications/templates` - Create new template
- **PUT** `/api/admin/notifications/templates/[id]` - Update template
- **DELETE** `/api/admin/notifications/templates/[id]` - Soft delete template

### 2. Placeholder System
Supports the following placeholders:
- `${customer.name}`, `${customer.email}`, `${customer.phone}`
- `${service.name}`, `${service.duration}`, `${service.price}`
- `${staff.name}`
- `${booking.code}`, `${booking.date}`, `${booking.time}`, `${booking.amount}`, `${booking.url}`
- `${business.name}`, `${business.phone}`, `${business.support_email}`

All placeholders are validated on template creation/update to ensure only allowed placeholders are used.

### 3. Event Emission
Notifications are automatically emitted when:
- **Booking Created** - When a customer completes checkout
- **Booking Completed** - When owner marks booking as completed
- **Fee Charged** - When no-show or cancellation fee is charged
- **Booking Cancelled** - When booking is cancelled
- **Refunded** - When a refund is processed
- **Reminder 24h** - 24 hours before appointment (via cron)
- **Reminder 1h** - 1 hour before appointment (via cron)

### 4. Notification Channels
- **Email** - Via SendGrid API
- **SMS** - Via Twilio API

### 5. Job Queue & Processing
- Jobs are queued in `notification_jobs` table
- Cron endpoint `/api/cron/notifications` processes jobs every 2 minutes
- Exponential backoff: 15min, 30min, 45min
- Max 3 retry attempts before marking as "dead"
- Idempotency: Unique constraint on `(booking_id, trigger, channel)` prevents duplicate sends

### 6. Reminder System
- Cron endpoint `/api/cron/reminders` runs every 10 minutes
- Finds bookings happening in 24h and 1h
- Checks if reminder already sent (prevents duplicates)
- Emits `reminder_24h` and `reminder_1h` triggers

## Environment Variables Required

```bash
# SendGrid (for email)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@tithi.com  # Optional, defaults to noreply@tithi.com

# Twilio (for SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890  # Your Twilio phone number

# Cron Security
CRON_SECRET=your_random_secret_string  # For protecting cron endpoints
```

## Database Schema

The system uses three main tables:

1. **notification_templates** - Stores owner-configured templates
2. **notification_jobs** - Job queue for pending notifications
3. **notification_events** - Audit log of sent notifications

All tables have RLS enabled and are scoped by `user_id` and `business_id`.

## API Usage Examples

### Create Email Template

```bash
POST /api/admin/notifications/templates
Content-Type: application/json

{
  "name": "Booking Confirmation",
  "channel": "email",
  "category": "confirmation",
  "trigger": "booking_created",
  "subject": "Your booking with ${business.name} is confirmed!",
  "body": "Hello ${customer.name},\n\nYour booking ${booking.code} for ${service.name} on ${booking.date} at ${booking.time} is confirmed.\n\nSee you soon!\n${business.name}",
  "is_enabled": true
}
```

### Create SMS Template

```bash
POST /api/admin/notifications/templates
Content-Type: application/json

{
  "name": "24h Reminder SMS",
  "channel": "sms",
  "category": "reminder",
  "trigger": "reminder_24h",
  "body": "Reminder: ${service.name} with ${staff.name} tomorrow at ${booking.time}. ${business.name}",
  "is_enabled": true
}
```

## How It Works

1. **Template Configuration**: Owner creates templates in onboarding step 8 or admin settings
2. **Event Trigger**: When a booking event occurs (create, complete, etc.), `emitNotification()` is called
3. **Template Resolution**: System loads active templates for that trigger + channel
4. **Placeholder Replacement**: Template body/subject is rendered with actual booking data
5. **Job Enqueue**: Notification job is created in `notification_jobs` table
6. **Cron Processing**: Every 2 minutes, cron endpoint processes pending jobs
7. **Send**: Email sent via SendGrid or SMS sent via Twilio
8. **Audit**: Success/failure logged in `notification_events` table

## Timezone Handling

All date/time placeholders (`${booking.date}`, `${booking.time}`) are formatted in the business's timezone, ensuring customers see times in their local context.

## Error Handling

- Failed sends are retried with exponential backoff
- After 3 failed attempts, job is marked as "dead"
- Errors are logged in `notification_jobs.last_error`
- Notification failures don't block booking operations (async emission)

## Testing

Comprehensive test suite in:
- `apps/web/src/lib/__tests__/notifications.test.ts` - Template rendering and validation
- `apps/web/src/app/api/admin/notifications/templates/__tests__/route.test.ts` - API endpoint tests

## Production Readiness

✅ All endpoints implemented and tested
✅ SendGrid integration complete
✅ Twilio integration complete
✅ Idempotency protection
✅ Retry logic with exponential backoff
✅ Timezone-aware date/time formatting
✅ Placeholder validation
✅ RLS security policies
✅ Cron jobs configured in vercel.json

## Next Steps for Deployment

1. Add environment variables to Vercel/production environment
2. Verify SendGrid API key has proper permissions
3. Verify Twilio account is active and phone number is verified
4. Test end-to-end: Create booking → Check notification_jobs → Verify email/SMS received
5. Monitor `notification_events` table for delivery status

## Notes

- Notifications respect `businesses.notifications_enabled` flag
- If notifications are disabled, no emails/SMS are sent
- Templates can be enabled/disabled per template via `is_enabled` field
- Soft delete is used for templates (preserves history)



