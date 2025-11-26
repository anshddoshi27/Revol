# Notification System - Production Readiness

## Overview

The notification system is production-ready and fully integrated with the Tithi booking platform. It handles email and SMS notifications for all booking lifecycle events.

## Features

### ✅ Template Management
- Owners can create notification templates during onboarding (Step 8)
- Templates support placeholders that are dynamically resolved at send time
- Templates can be enabled/disabled per business
- Templates are stored in `notification_templates` table with RLS

### ✅ Notification Triggers
All triggers are properly wired:
- `booking_created` - When a customer books an appointment
- `booking_completed` - When owner marks booking as completed
- `booking_cancelled` - When booking is cancelled
- `fee_charged` - When no-show or cancellation fee is charged
- `refunded` - When a booking is refunded
- `reminder_24h` - 24 hours before appointment
- `reminder_1h` - 1 hour before appointment

### ✅ Placeholders
All placeholders are supported and validated:
- `${customer.name}`, `${customer.email}`, `${customer.phone}`
- `${service.name}`, `${service.duration}`, `${service.price}`
- `${staff.name}`
- `${booking.code}`, `${booking.date}`, `${booking.time}`, `${booking.amount}`, `${booking.url}`
- `${business.name}`, `${business.phone}`, `${business.support_email}`
- `${amount}` - For fee_charged and refunded triggers

### ✅ Channels
- **Email**: Via SendGrid API
- **SMS**: Via Twilio API

### ✅ Job Queue System
- Notifications are queued in `notification_jobs` table
- Background cron processes jobs every 2 minutes
- Exponential backoff retry: 15min, 30min, 45min
- Max 3 attempts before marking as 'dead'
- Idempotency: Unique constraint on `(booking_id, trigger, channel)` prevents duplicates

### ✅ Reminder Scheduling
- Reminder cron runs every 10 minutes
- 24h reminders: Bookings starting between 23h55m and 24h5m from now
- 1h reminders: Bookings starting between 55m and 1h5m from now
- Prevents duplicate reminders via job queue idempotency

### ✅ Error Handling
- Graceful handling of missing templates (skips notification)
- Graceful handling of missing customer contact info (skips that channel)
- Respects `notifications_enabled` flag on business
- Comprehensive error logging for debugging

### ✅ Audit Trail
- All sent notifications logged in `notification_events` table
- Includes provider message IDs for tracking
- Status tracking: 'queued', 'sent', 'failed', 'dead'

## Database Schema

### Tables
1. **notification_templates** - Template definitions
2. **notification_jobs** - Job queue
3. **notification_events** - Audit log

### Indexes
- `idx_notification_templates_user_trigger_enabled` - Fast template lookup
- `idx_notification_jobs_status_scheduled` - Fast job processing
- `idx_notification_events_user_booking` - Fast event lookup

## API Endpoints

### Admin
- `GET /api/admin/notifications/templates` - List templates
- `POST /api/admin/notifications/templates` - Create template
- `PUT /api/admin/notifications/templates/[id]` - Update template
- `DELETE /api/admin/notifications/templates/[id]` - Delete template

### Onboarding
- `PUT /api/business/onboarding/step-8-notifications` - Save templates during onboarding

### Cron Jobs
- `GET /api/cron/notifications` - Process notification jobs (runs every 2 min)
- `GET /api/cron/reminders` - Schedule reminders (runs every 10 min)

## Environment Variables

Required for production:
```bash
# SendGrid (Email)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@tithi.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890

# Cron Security
CRON_SECRET=your_secure_random_string
```

## Cron Configuration

Configured in `vercel.json`:
- Notifications: Every 2 minutes (`*/2 * * * *`)
- Reminders: Every 10 minutes (`*/10 * * * *`)

## Testing

### Unit Tests
- `apps/web/src/lib/__tests__/notifications.test.ts` - Template rendering and validation
- `apps/web/src/lib/__tests__/notifications-integration.test.ts` - Integration tests

### E2E Tests
- `apps/web/src/app/api/__tests__/notifications-e2e.test.ts` - End-to-end flow tests

## Production Checklist

- [x] Database schema created with all tables and indexes
- [x] RLS policies enabled for tenant isolation
- [x] Template CRUD endpoints implemented
- [x] All triggers wired to booking lifecycle events
- [x] Job queue system with retry logic
- [x] Reminder scheduling with proper time windows
- [x] Error handling and logging
- [x] Idempotency to prevent duplicate sends
- [x] Audit trail for all notifications
- [x] Tests written and passing
- [x] Cron jobs configured in vercel.json
- [ ] Environment variables set in production
- [ ] SendGrid account configured and verified
- [ ] Twilio account configured and verified
- [ ] CRON_SECRET set in production environment

## Usage Flow

1. **Onboarding**: Owner creates notification templates in Step 8
2. **Booking Created**: Customer books → `booking_created` notification queued
3. **Reminders**: Cron checks for bookings 24h/1h away → reminders queued
4. **Money Actions**: Owner clicks Complete/No-Show/Cancel/Refund → appropriate notification queued
5. **Processing**: Cron processes jobs every 2 minutes → sends via SendGrid/Twilio
6. **Audit**: All sends logged to `notification_events` table

## Monitoring

To monitor notification health:
1. Check `notification_jobs` table for failed/dead jobs
2. Check `notification_events` table for sent notifications
3. Monitor cron job execution in Vercel logs
4. Check SendGrid/Twilio dashboards for delivery rates

## Troubleshooting

### Notifications not sending
1. Check `businesses.notifications_enabled` is `true`
2. Check templates exist and are enabled
3. Check customer has email/phone for the channel
4. Check `notification_jobs` table for errors
5. Verify SendGrid/Twilio credentials are correct

### Duplicate notifications
- Should not happen due to unique constraint on `(booking_id, trigger, channel)`
- If duplicates occur, check for race conditions in job creation

### Reminders not scheduling
1. Check reminder cron is running (every 10 minutes)
2. Verify bookings are in correct status (`pending` or `scheduled`)
3. Check time windows are correct (24h ± 5min, 1h ± 5min)

## Future Enhancements

- Push notifications (iOS/Android)
- Notification preferences per customer
- A/B testing for templates
- Delivery analytics dashboard
- Template preview with sample data



