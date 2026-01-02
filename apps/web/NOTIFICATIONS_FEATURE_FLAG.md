# Notifications Feature Flag - v2 Disable

This document explains how notifications (SMS & Email) have been disabled for v2 while keeping all code intact for easy re-enablement.

## Feature Flag Location

The feature flag is defined in `apps/web/src/lib/feature-flags.ts`:

```typescript
export const FEATURES = {
  NOTIFICATIONS_ENABLED: false, // v2: Disabled, coming soon
  NOTIFICATIONS_COMING_SOON: true, // v2: Show coming soon
} as const;
```

## What's Disabled

When `NOTIFICATIONS_ENABLED` is `false`:

1. **Onboarding**: The notifications step (Step 8) is skipped in the onboarding flow
2. **Admin Navigation**: The notifications page is hidden from the admin sidebar
3. **Pro Plan**: Pro Plan selection is disabled - shows "Coming Soon" message
4. **All Businesses**: Default to Basic Plan ($11.99/month) with `notifications_enabled = false`
5. **API Enforcement**: The step-8-notifications API automatically forces `notifications_enabled = false` even if frontend tries to set it to true

## What's Still Intact

All notification code remains in place:
- ✅ Notification templates system
- ✅ SendGrid email integration
- ✅ Twilio SMS integration
- ✅ Notification job queue system
- ✅ Placeholder replacement logic
- ✅ All database schemas and migrations
- ✅ All API endpoints
- ✅ All UI components

## How to Re-Enable

To re-enable notifications for v3 or later:

1. **Update Feature Flag**:
   ```typescript
   // In apps/web/src/lib/feature-flags.ts
   export const FEATURES = {
     NOTIFICATIONS_ENABLED: true,  // Change to true
     NOTIFICATIONS_COMING_SOON: false, // Change to false
   } as const;
   ```

2. **That's it!** All the code will automatically:
   - Show notifications step in onboarding
   - Show notifications page in admin
   - Allow Pro Plan selection
   - Process notification jobs
   - Send emails and SMS

## Files Modified

1. **`apps/web/src/lib/feature-flags.ts`** - New file with feature flag configuration
2. **`apps/web/src/app/onboarding/page.tsx`** - Conditionally includes/excludes notifications step
3. **`apps/web/src/components/onboarding/notifications-step.tsx`** - Shows "Coming Soon" when disabled
4. **`apps/web/src/app/app/b/[businessId]/layout.tsx`** - Hides notifications nav item when disabled
5. **`apps/web/src/app/app/b/[businessId]/notifications/page.tsx`** - Shows "Coming Soon" message when disabled
6. **`apps/web/src/app/api/business/onboarding/step-8-notifications/route.ts`** - Enforces Basic Plan when disabled

## Testing

To test the disabled state:
1. Run the app - notifications step should be skipped in onboarding
2. Complete onboarding - should default to Basic Plan
3. Check admin - notifications page should not appear in sidebar
4. If you manually navigate to `/app/b/[businessId]/notifications` - should show "Coming Soon"

To test re-enablement:
1. Change `NOTIFICATIONS_ENABLED` to `true` in feature-flags.ts
2. Restart the app
3. Notifications step should appear in onboarding
4. Pro Plan should be selectable
5. Notifications page should appear in admin

## Notes

- The feature flag is checked at runtime, so no build-time changes needed
- All notification-related database queries and API calls still work - they just won't be accessible through the UI
- The cron job for processing notifications will still run, but won't process any jobs since no businesses will have `notifications_enabled = true`

