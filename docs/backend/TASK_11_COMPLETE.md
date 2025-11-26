# Task 11: Background Jobs & Cron Endpoints - COMPLETE ✅

## Overview
Task 11 implements the complete background job system, cron endpoints, and notification engine for production use. All components are tested and ready for deployment.

## What Was Implemented

### 1. Database Schema Updates
**Migration**: `supabase/migrations/20250101000008_add_job_fields.sql`
- Added `held_expires_at` to `bookings` table for temporary holds during checkout
- Added `next_retry_at` to `notification_jobs` table for exponential backoff retry scheduling
- Added indexes for efficient querying

### 2. Cron Endpoints

#### `/api/cron/reminders` (Runs every 10 minutes)
- Finds bookings happening in 24h window (±5 minutes)
- Finds bookings happening in 1h window (±5 minutes)
- Checks for existing reminders to prevent duplicates
- Calls `emitNotification` to create notification jobs
- Returns count of scheduled reminders

#### `/api/cron/subscription-health` (Runs daily at 2 AM UTC)
- Syncs Stripe subscription status with database
- Updates `next_bill_at` from Stripe `current_period_end`
- Handles canceled subscriptions:
  - Soft deletes business (`deleted_at = now()`)
  - Marks subscription as canceled
  - Note: Actual subdomain deprovisioning would require DNS management service
- Reactivates businesses if Stripe status is active but DB says canceled

#### `/api/cron/cleanup` (Runs daily at 3 AM UTC)
- **Expired held bookings**: Deletes held bookings without cards, updates held bookings with cards to `pending`
- **Old idempotency keys**: Deletes keys older than 30 days
- **Dead notification jobs**: Marks failed jobs (retry_count >= 3, older than 7 days) as `dead`
- **Archive old events**: Counts notification_events older than 1 year (actual archiving to cold storage would be separate process)

#### `/api/cron/notifications` (Runs every 2 minutes)
- Processes pending notification jobs
- Processes failed jobs ready for retry (attempt_count < 3, next_retry_at <= now)
- Sends via SendGrid (email) or Twilio (SMS)
- Implements exponential backoff: 15min, 30min, 45min
- Marks jobs as `dead` after 3 failed attempts
- Creates audit trail in `notification_events` table

### 3. Notification System

#### Template Rendering (`lib/notifications.ts`)
- **Placeholder validation**: Validates only allowed placeholders
- **Template rendering**: Resolves all placeholders:
  - `${customer.name}`, `${customer.email}`, `${customer.phone}`
  - `${service.name}`, `${service.duration}`, `${service.price}`
  - `${staff.name}`
  - `${booking.code}`, `${booking.date}`, `${booking.time}`, `${booking.amount}`, `${booking.url}`
  - `${business.name}`, `${business.phone}`, `${business.support_email}`
  - `${amount}` (for fee_charged and refunded)
- **Timezone-aware**: Formats dates/times in business timezone

#### Event Emission
- `emitNotification()` function loads complete booking data and enqueues notifications
- Wired in all endpoints:
  - `booking_created`: Public booking creation
  - `booking_completed`: Admin complete action
  - `booking_cancelled`: Admin cancel action
  - `fee_charged`: Admin no-show/cancel with fee
  - `refunded`: Admin refund action
  - `reminder_24h`: Reminders cron
  - `reminder_1h`: Reminders cron

#### Job Queue
- `enqueueNotification()` creates jobs in `notification_jobs` table
- Idempotency: Unique constraint on `(booking_id, trigger, channel)` prevents duplicates
- Sets `next_retry_at = null` initially (set on first failure)

### 4. Notification Senders (`lib/notification-senders.ts`)
- **SendGrid integration**: Sends HTML and plain text emails
- **Twilio integration**: Sends SMS messages
- Returns success/failure with provider message IDs
- Handles errors gracefully

## Vercel Cron Configuration

All cron endpoints are configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "*/2 * * * *"  // Every 2 minutes
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "*/10 * * * *"  // Every 10 minutes
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * *"  // Daily at 3 AM UTC
    },
    {
      "path": "/api/cron/subscription-health",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    }
  ]
}
```

## Security

All cron endpoints are protected by `CRON_SECRET` environment variable:
- Checks `Authorization: Bearer ${CRON_SECRET}` header
- Returns 401 if missing or incorrect
- Set in production environment variables

## Testing

### Unit Tests
- `apps/web/src/app/api/cron/__tests__/cron-endpoints.test.ts`
  - Tests all cron endpoints
  - Tests authorization
  - Tests business logic
  - Tests error handling

- `apps/web/src/lib/__tests__/notifications-production.test.ts`
  - Tests placeholder validation
  - Tests template rendering
  - Tests job enqueueing
  - Tests idempotency
  - Tests full `emitNotification` flow

### Test Coverage
- ✅ Reminders scheduling
- ✅ Subscription health sync
- ✅ Cleanup operations
- ✅ Notification job processing
- ✅ Template rendering
- ✅ Placeholder resolution
- ✅ Error handling

## Production Readiness Checklist

- ✅ All cron endpoints implemented
- ✅ Database schema updated with required fields
- ✅ Notification system fully functional
- ✅ All notification triggers wired correctly
- ✅ Exponential backoff implemented
- ✅ Idempotency enforced
- ✅ Error handling and logging
- ✅ Comprehensive tests
- ✅ Vercel cron configuration
- ✅ Security (CRON_SECRET protection)

## Environment Variables Required

```bash
# Cron security
CRON_SECRET=your-secret-key-here

# Notification providers
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@tithi.com
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Next Steps for Production

1. **Set environment variables** in Vercel dashboard
2. **Run migration**: Apply `20250101000008_add_job_fields.sql` to production database
3. **Verify cron jobs**: Check Vercel cron logs after deployment
4. **Monitor notification delivery**: Check `notification_events` table for delivery status
5. **Set up alerts**: Monitor failed notification jobs and subscription sync issues

## Notes

- **Subdomain deprovisioning**: Currently marks business as deleted. Actual DNS/subdomain removal would require integration with domain management service (e.g., Cloudflare API, Route53)
- **Event archiving**: Currently counts old events. Actual archiving to S3/cold storage would require separate process
- **Notification providers**: Can be swapped by updating `notification-senders.ts` (e.g., use Resend instead of SendGrid)

## Files Created/Modified

### Created
- `supabase/migrations/20250101000008_add_job_fields.sql`
- `apps/web/src/app/api/cron/__tests__/cron-endpoints.test.ts`
- `apps/web/src/lib/__tests__/notifications-production.test.ts`
- `docs/backend/TASK_11_COMPLETE.md`

### Modified
- `apps/web/src/app/api/cron/reminders/route.ts`
- `apps/web/src/app/api/cron/subscription-health/route.ts`
- `apps/web/src/app/api/cron/cleanup/route.ts`
- `apps/web/src/app/api/cron/notifications/route.ts`
- `apps/web/src/lib/notifications.ts`

## Status: ✅ PRODUCTION READY

All components are implemented, tested, and ready for production deployment.



