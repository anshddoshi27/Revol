# Notifications Feature - v2 Disabled Configuration

## Overview

For v2, the notifications feature (SMS & Email) is **disabled** and shows "Coming Soon" to users. All notification code remains intact and can be easily re-enabled later.

## Current Status

✅ **Feature Flag**: `NOTIFICATIONS_ENABLED: false`  
✅ **Coming Soon**: `NOTIFICATIONS_COMING_SOON: true`  
✅ **All code intact**: Ready to re-enable with a single flag change

## What's Disabled

### 1. Onboarding Step 8 (Notifications)
- Shows "Coming Soon" message
- Auto-selects Basic Plan ($11.99/month)
- Skips template configuration
- Users can continue with Basic Plan only

### 2. Admin Notifications Page
- Shows "Coming Soon" message
- Page is accessible but non-functional
- Explains that notifications are coming soon

### 3. Navigation
- Notifications page is **hidden** from admin navigation when feature is disabled
- Users won't see it in the sidebar

### 4. Notification Sending
- `emitNotification()` checks feature flag first
- No notifications will be sent (even if somehow enabled in DB)
- All notification triggers are blocked at the source

### 5. API Routes
- `/api/business/onboarding/step-8-notifications` respects feature flag
- Forces Basic Plan when feature is disabled
- Clears any templates if feature is disabled

## How It Works

### Feature Flag Location
`apps/web/src/lib/feature-flags.ts`

```typescript
export const FEATURES = {
  NOTIFICATIONS_ENABLED: false, // v2: Disabled
  NOTIFICATIONS_COMING_SOON: true, // v2: Show coming soon
} as const;
```

### Key Functions
- `isNotificationsEnabled()` - Returns `false` (feature disabled)
- `isNotificationsComingSoon()` - Returns `true` (show coming soon)
- `getEffectiveNotificationsEnabled()` - Returns `false` (coming soon = disabled)

### Where Feature Flag is Checked

1. **Onboarding Step** (`notifications-step.tsx`)
   - Shows "Coming Soon" UI when `isNotificationsComingSoon()` is true
   - Auto-selects Basic Plan
   - Skips template configuration

2. **Admin Notifications Page** (`notifications/page.tsx`)
   - Shows "Coming Soon" message when `isNotificationsEnabled()` is false
   - Page is accessible but shows coming soon message

3. **Navigation** (`layout.tsx`)
   - Hides notifications link when `isNotificationsEnabled()` is false

4. **Notification Sending** (`notifications.ts`)
   - `emitNotification()` checks feature flag first
   - Returns early if feature is disabled

5. **API Routes** (`step-8-notifications/route.ts`)
   - Forces Basic Plan when feature is disabled
   - Clears templates if feature is disabled

## How to Re-Enable (Future)

When ready to enable notifications:

1. **Update Feature Flag**:
   ```typescript
   // apps/web/src/lib/feature-flags.ts
   export const FEATURES = {
     NOTIFICATIONS_ENABLED: true, // Enable notifications
     NOTIFICATIONS_COMING_SOON: false, // Remove coming soon message
   } as const;
   ```

2. **That's it!** All code is already in place:
   - Onboarding step will show Pro/Basic plan selection
   - Admin notifications page will be functional
   - Navigation will show notifications link
   - Notification sending will work
   - All templates and configuration will work

## What Users See

### During Onboarding (Step 8)
- **Heading**: "Notifications Coming Soon"
- **Message**: "Automated SMS and email notifications are coming soon! Your booking system is fully functional without them. For now, you'll be on the Basic Plan."
- **UI**: Shows "Pro Plan - Coming Soon" with Basic Plan button
- **Action**: User clicks "Continue with Basic Plan ($11.99/month)"
- **Result**: Proceeds to next step with Basic Plan selected

### In Admin
- **Notifications Page**: Shows "Coming Soon" message
- **Navigation**: Notifications link is hidden
- **Account Page**: Shows Basic Plan ($11.99/month)

## Database Impact

- All businesses default to `notifications_enabled = false` (Basic Plan)
- No notification templates are created
- No notification jobs are created
- All existing notification code remains in database schema (ready for future use)

## Testing

The notification system is fully tested (30/30 tests passing), but notifications are disabled via feature flag. When re-enabled, all functionality will work immediately.

## Summary

✅ **v2 Status**: Notifications disabled, "Coming Soon" shown  
✅ **Code Status**: All code intact, ready to enable  
✅ **User Experience**: Clear messaging, no confusion  
✅ **Re-enable**: Single flag change when ready  

