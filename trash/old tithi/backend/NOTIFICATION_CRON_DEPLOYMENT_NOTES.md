# Notification Cron Deployment Notes

## Overview

This document provides deployment instructions for the standardized notification system with cron integration.

## Changes Made

### 1. Standardized Template Fields
- Renamed `body` column to `content` in `notification_templates` table
- Renamed `event_code` column to `trigger_event` in `notification_templates` table
- Enforced `{{snake_case}}` placeholder format with database constraints

### 2. Immediate Confirmation Sending
- Booking confirmation now triggers immediate notification sending
- Added error handling to prevent confirmation failure due to notification issues

### 3. Reminder Scheduling System
- Added `process_due_notifications()` method for cron processing
- Added 24h/1h reminder scheduling system
- Implemented deduplication to prevent spam

### 4. Standardized Placeholders
- All templates now use `{{snake_case}}` format
- Standardized variable mapping for booking events
- Template validation and rendering improvements

## Database Migration

Run the following migration to apply schema changes:

```bash
# Apply the standardization migration
alembic upgrade head
```

## Cron Job Setup

### 1. Process Due Notifications (Every Minute)

Add this cron job to process due notifications:

```bash
# Process due notifications every minute
* * * * * cd /path/to/backend && python -c "from app.jobs.notification_cron_runner import process_due_notifications_cron; process_due_notifications_cron()"
```

### 2. Schedule Booking Reminders (Daily)

Add this cron job to schedule booking reminders:

```bash
# Schedule booking reminders daily at 6 AM
0 6 * * * cd /path/to/backend && python -c "from app.jobs.notification_cron_runner import schedule_booking_reminders_cron; schedule_booking_reminders_cron()"
```

### 3. Alternative: Using Flask CLI

You can also use the Flask CLI commands:

```bash
# Process due notifications
flask notifications process-due --tenant-id <tenant-id>

# Schedule reminders
flask notifications schedule-reminders

# Create default templates
flask notifications create-default-templates --tenant-id <tenant-id>
```

## Environment Variables

Ensure the following environment variables are set for notification providers:

```bash
# Email provider (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key

# SMS provider (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# For development/testing
NOTIFICATION_PROVIDER=console  # Use console output instead of real providers
```

## Testing

### 1. Test Template Validation

```bash
# Test placeholder validation
flask notifications validate-placeholders --content "Hello {{customer_name}}, your {{service_name}} is confirmed"
```

### 2. Test Booking Notification

```bash
# Test booking notification sending
flask notifications test-booking-notification --tenant-id <tenant-id> --booking-id <booking-id>
```

### 3. Test Cron Processing

```bash
# Test due notifications processing
flask notifications process-due --tenant-id <tenant-id>
```

## Monitoring

### 1. Check Notification Status

Monitor notification processing through the database:

```sql
-- Check pending notifications
SELECT COUNT(*) FROM notifications WHERE status = 'pending';

-- Check failed notifications
SELECT COUNT(*) FROM notifications WHERE status = 'failed';

-- Check notification delivery stats
SELECT 
    channel,
    status,
    COUNT(*) as count
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY channel, status;
```

### 2. Log Monitoring

Monitor application logs for notification processing:

```bash
# Check for notification errors
grep "notification" /path/to/logs/app.log | grep -i error

# Check for cron processing
grep "due notifications processing" /path/to/logs/app.log
```

## Rollback Plan

If issues occur, you can rollback the changes:

1. **Rollback Database Migration**:
   ```bash
   alembic downgrade -1
   ```

2. **Disable Cron Jobs**:
   Comment out or remove the cron job entries

3. **Revert Code Changes**:
   Revert the changes to the notification services

## Performance Considerations

- The `process_due_notifications` method processes up to 100 notifications per run
- Reminder scheduling is optimized to avoid duplicate scheduling
- Database indexes are in place for efficient notification processing

## Security Considerations

- All notifications are tenant-scoped
- Deduplication prevents spam
- Template validation prevents injection attacks
- Provider credentials are externalized to environment variables

## Support

For issues or questions:
1. Check the application logs
2. Verify environment variables are set correctly
3. Test individual components using the CLI commands
4. Monitor database for notification status
