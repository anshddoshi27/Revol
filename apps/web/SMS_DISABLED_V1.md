# SMS Notifications Disabled for v1

## Summary
SMS/text notifications have been disabled for v1. Only email notifications are enabled. SMS will be re-enabled in v2.

## Changes Made

### 1. Notification Emission Logic (`apps/web/src/lib/notifications.ts`)
- ✅ SMS template loading is commented out
- ✅ SMS notification enqueueing is commented out
- ✅ Only email notifications are processed

### 2. Onboarding Notifications Step (`apps/web/src/components/onboarding/notifications-step.tsx`)
- ✅ SMS channel option removed from `CHANNEL_OPTIONS`
- ✅ All UI text updated to only mention "email" (removed "SMS and email" references)
- ✅ Push notifications also removed (only email available)

### 3. Admin Notifications Page (`apps/web/src/app/app/b/[businessId]/notifications/page.tsx`)
- ✅ SMS templates are filtered out (only email templates shown)
- ✅ All UI text updated to only mention "email"
- ✅ Channel type still includes 'sms' in TypeScript for future compatibility, but SMS templates are filtered out

## What Still Works

✅ **Email notifications** - Fully functional
✅ **Email templates** - Can be created, edited, and enabled/disabled
✅ **Notification system** - All triggers work (booking_created, reminders, etc.)
✅ **Cron job** - Processes email notifications correctly

## What's Disabled

❌ **SMS notifications** - Not sent, even if templates exist
❌ **SMS templates** - Not shown in UI (filtered out)
❌ **SMS channel option** - Removed from onboarding

## For v2

To re-enable SMS notifications in v2:

1. **Uncomment SMS code in `apps/web/src/lib/notifications.ts`**:
   - Uncomment `smsTemplate` loading
   - Uncomment SMS notification enqueueing

2. **Re-add SMS to `CHANNEL_OPTIONS` in `apps/web/src/components/onboarding/notifications-step.tsx`**:
   ```typescript
   { value: "sms", label: "SMS", icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> },
   ```

3. **Remove SMS filtering in `apps/web/src/app/app/b/[businessId]/notifications/page.tsx`**:
   - Remove `.filter((t: any) => t.channel === 'email')` from template fetching

4. **Update UI text** to mention "SMS and email" again

## Notes

- Existing SMS templates in the database are not deleted, just hidden
- The cron job will still process SMS jobs if they exist (from old data), but no new SMS jobs will be created
- Phone number collection in booking flow is still functional (for future use)

