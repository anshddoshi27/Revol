# Issue Report: Plan Type (notifications_enabled) Not Saving Correctly

## Executive Summary

Users are selecting the Basic plan during onboarding, but the database is storing `notifications_enabled: true` (Pro plan) instead of `false` (Basic plan). The selected plan type is not being persisted correctly, causing the admin dashboard to display the wrong plan.

## Problem Description

When a user completes onboarding and selects the Basic plan ($11.99/month), the system should save `notifications_enabled: false` to the database. However, the database shows `notifications_enabled: true`, causing the account to be treated as Pro plan ($21.99/month) throughout the application.

Evidence:
- User selected Basic plan during onboarding Step 8 (Notifications step)
- Database record shows: `notifications_enabled: true`
- Admin dashboard displays "Pro Plan - $21.99/month" instead of "Basic Plan - $11.99/month"
- Business ID: `9d0c423f-775e-479f-a285-7e6d0e1a6463` (DAMBOX)

## Current Data Flow

### Onboarding Step 8 Flow
1. User interface presents two options: Basic Plan (false) or Pro Plan (true)
2. When Basic is selected, frontend component calls `onNext([], false)`
3. `handleNotificationsNext` receives `enabled: false`
4. Makes API call to `PUT /api/business/onboarding/step-8-notifications` with `notifications_enabled: false`
5. API endpoint receives the value and attempts to save to database
6. Database record shows `notifications_enabled: true` (incorrect)

## Root Causes Identified

### Issue 0: CRITICAL BUG - Early Return Prevents Saving notifications_enabled

**This is the root cause of the issue.**

When Basic plan is selected, the frontend sends an empty templates array (`templates: []`) and `notifications_enabled: false`. The API endpoint has an early return at lines 169-175 that returns success without updating the `notifications_enabled` field:

```typescript
if (templates.length === 0) {
  return NextResponse.json({
    success: true,
    templateIds: [],
    message: 'Notification templates cleared',
  });
}
```

**Impact**: When Basic plan is selected, the templates array is empty, causing the API to return immediately without ever executing the code that updates `notifications_enabled` in the database. The update code (lines 222-276) is never reached because the function returns early. This means the database value remains unchanged (stays `true` from the default), even though the user selected Basic plan (`false`).

**Why this happens**:
1. User selects Basic plan
2. Frontend calls `onNext([], false)` - empty templates array, `false` for notifications_enabled
3. API receives request with `templates: []` and `notifications_enabled: false`
4. API checks `if (templates.length === 0)` - condition is true
5. API returns immediately with success, never reaching the code that updates `notifications_enabled`
6. Database value remains unchanged (stays `true` from default)

**Location**: `apps/web/src/app/api/business/onboarding/step-8-notifications/route.ts` lines 169-175

**Why previous attempts didn't work**: All previous fixes attempted to ensure the update code worked correctly, but they didn't address the fact that the update code is never reached when Basic plan is selected due to the early return.

### Issue 1: Database Default Value
The database column `businesses.notifications_enabled` has a default value of `true` (Pro plan). This is set in migration `20250101000002_add_notifications_enabled.sql`:
```sql
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;
```

**Impact**: When a business record is created during signup, if `notifications_enabled` is not explicitly set, it defaults to `true` (Pro plan). This means new businesses start as Pro plan unless explicitly changed.

### Issue 2: Business Creation During Signup
When a user signs up, a business record is created in `apps/web/src/app/api/auth/signup/route.ts`. The insertion does not include `notifications_enabled`:
```typescript
.insert({
  user_id: userId,
  name: '',
  subdomain: `temp-${Date.now()}`,
  timezone: 'America/New_York',
  industry: 'other',
  // notifications_enabled is missing - uses database default (true)
})
```

**Impact**: The business is created with `notifications_enabled: true` by default, before the user even reaches Step 8 to make their selection.

### Issue 3: GET Endpoint Default Behavior
The GET endpoint for step 8 notifications (`apps/web/src/app/api/business/onboarding/step-8-notifications/route.ts`) previously had logic that defaults to `true`:
```typescript
notificationsEnabled: business?.notifications_enabled !== false
```

This means if the value is `null` or `undefined`, it returns `true`. This could cause the UI to show Pro plan as selected when the user hasn't made a choice yet.

**Impact**: The frontend might receive `true` as the default value, potentially causing confusion or incorrect state.

### Issue 4: No Verification of Saved Value
The PUT endpoint for step 8 notifications saves the value but the original implementation did not verify that the saved value matches what was intended to be saved. The code saves the value and returns success without confirming the database actually contains the correct value.

**Impact**: If the save fails silently or is blocked by RLS (Row Level Security), the API returns success but the database value remains unchanged.

### Issue 5: Row Level Security (RLS) Potential Blocking
The update operation uses a regular Supabase client, which is subject to RLS policies. If RLS blocks the update, the operation might fail silently or the error might not be properly handled.

**Impact**: The update might be blocked by RLS, leaving the database value unchanged, but the API might still return success.

## What Was Attempted

### Attempt 1: Changed Business Creation Default
**Observation**: Modified `apps/web/src/app/api/auth/signup/route.ts` to explicitly set `notifications_enabled: false` when creating business during signup.

**Outcome**: This change ensures new businesses start with Basic plan by default. However, it does not address existing businesses that were already created with the default `true` value.

**Why it didn't resolve the issue**: This only affects new signups. Even if the initial value is `false`, when the user reaches Step 8 and selects Basic plan, the Step 8 save operation should still be working to persist that choice. The fact that the database shows `true` suggests the Step 8 save operation itself may be failing or not executing. Additionally, if a user selects Pro plan, the value needs to change from `false` to `true`, which requires the Step 8 save to work correctly.

### Attempt 2: Created Database Migration
**Observation**: Created migration file `supabase/migrations/20250104000001_fix_notifications_enabled_default.sql` to change the database default to `false`.

**Outcome**: Migration file exists but may not have been executed against the database yet. The default value in the schema definition remains `true`.

**Why it didn't resolve the issue**: Even if the database default were changed to `false`, the core problem is that when a user explicitly selects Basic plan in Step 8, the PUT request to save that selection is not successfully updating the database. The save operation appears to succeed (returns 200), but the database value remains unchanged. The migration only affects the default for new records, not the save operation for existing records.

### Attempt 3: Fixed GET Endpoint Default
**Observation**: Changed the GET endpoint to only return `true` if explicitly set to `true`, otherwise defaulting to `false`.

**Outcome**: This change affects what value the frontend receives when loading Step 8, but does not address the save operation.

**Why it didn't resolve the issue**: This is a display/read-side fix. It doesn't address why the write operation (PUT request) is not successfully saving the user's selection to the database. The read-side fix doesn't solve the write-side problem. Even if the GET returns the correct default, when the user selects Basic and the PUT saves it, the database should be updated - but it's not.

### Attempt 4: Added Verification Logic
**Observation**: Added verification step after saving to check if the saved value matches what was sent.

**Outcome**: This verification would detect a mismatch after the fact, but the verification code was added after the user's onboarding session, so we don't have verification logs from when the issue occurred.

**Why it didn't resolve the issue**: Verification can detect the problem after it happens, but it doesn't prevent it. The verification happens after the save operation completes. If the save operation is silently failing or being blocked, verification will only detect it after the fact. The root cause of why the save operation isn't working remains unknown. Additionally, we don't have logs from the user's session showing what value was sent or what verification found.

### Attempt 5: Added Admin Client Fallback
**Observation**: Added fallback to use admin client (bypasses RLS) if the regular client update fails.

**Outcome**: This would work around RLS blocking issues, but this code was added after the user's session, so we don't know if RLS was blocking the update.

**Why it didn't resolve the issue**: If RLS is blocking the update, using admin client bypasses the security check. While this might allow the save to succeed, it suggests there's a deeper RLS policy configuration issue. Additionally, we don't have evidence that RLS was the problem - the logs don't show RLS errors, and the API returned 200 (success). The fact that the API returns success suggests the update is being accepted, but the value isn't actually changing in the database.

## Current State

The system has been modified in several places:
- Business creation now sets `notifications_enabled: false` by default (in code, but may not be applied to database yet)
- GET endpoint defaults to `false` (code changed)
- Verification and logging added to Step 8 endpoint (code changed, but logs from user's session don't show these)
- Admin client fallback added (code changed, but we don't know if this addresses the root cause)

However, the fundamental issue persists: when a user selects Basic plan during Step 8, the database is not correctly storing `notifications_enabled: false`. 

The logs from the user's session show:
- Line 246: `PUT /api/business/onboarding/step-8-notifications 200 in 875ms` - Step 8 PUT was called and returned success
- Line 374: `notifications_enabled: true` - Database still shows Pro plan

This suggests either:
1. The request isn't actually being made with the correct value
2. The request is being made but the value isn't being sent correctly
3. The save operation is silently failing
4. The value is being overwritten after Step 8
5. The logging added wasn't present when the user went through onboarding, so we can't see what value was received

## Investigation Needed

The following areas need investigation:

1. **Step 8 Save Operation**: Why is the PUT request to `/api/business/onboarding/step-8-notifications` not successfully saving `false` when Basic plan is selected? The API code appears correct, but the database value remains `true`. The API returns 200 (success), but the database value doesn't change.

2. **Frontend State Management**: Is the frontend correctly maintaining the `enabled` state when Basic plan is selected? The component code shows `onNext([], false)` being called when Basic is selected (line 149 of `notifications-step.tsx`), but we need to verify this is actually being executed and that the value `false` is being passed correctly through the call chain.

3. **API Request Execution**: Are the API requests to Step 8 actually being made with the correct value? The user's logs show Step 8 GET requests and a PUT request that returned 200, but there are no logs showing what value was received in the request body. The logging that would show the received value was added after the user's session.

4. **Value Overwriting**: Is `notifications_enabled` being overwritten after Step 8? For example, during payment setup (Step 11) or business launch (onboarding complete), could the value be reset or modified? The payment setup step reads `notifications_enabled` to determine which Stripe price ID to use, but does it modify it?

5. **Database Triggers or Constraints**: Are there any database triggers, constraints, or policies that might be modifying or blocking the `notifications_enabled` value? For example, could there be a trigger that sets it back to `true` under certain conditions?

6. **RLS Policies**: What are the RLS policies on the `businesses` table? Could they be blocking the update, and if so, why would they allow reads but block writes? The API returns 200 (success), which suggests the update isn't being rejected by RLS, but the value isn't changing.

7. **Race Conditions**: Is there a timing issue where the value is being read or written concurrently, causing the wrong value to be saved? For example, if Step 8 saves `false`, but then another process reads the old value (`true`) and overwrites it?

8. **Transaction Isolation**: Could there be transaction isolation issues where the save appears to succeed but isn't committed? The API returns success, but the database value remains unchanged.

9. **Request Body Parsing**: Is the request body being parsed correctly? The API extracts `notifications_enabled` from the request body, but if the body isn't being parsed correctly, it might be receiving `undefined` or a different value than what was sent.

10. **Silent Failures**: Could the update operation be failing silently? The Supabase update returns an error object, but if that error isn't being checked properly, the API might return success even if the update failed.

## Evidence from Logs

From the terminal logs provided:
- Line 246: `PUT /api/business/onboarding/step-8-notifications 200 in 875ms` - Step 8 PUT was called and returned success (200 status code)
- Line 374: `notifications_enabled: true` - Database shows Pro plan when business is loaded later
- However, there are no logs showing:
  - What value was received in the request body
  - What value was attempted to be saved
  - Whether the update operation succeeded or failed
  - What value was actually saved to the database
  - Verification results

This suggests either:
- The logging that would show these details wasn't present when the user went through onboarding
- The logs are being filtered or not captured
- The request is succeeding but the value isn't actually being saved
- The value is being overwritten after the save

## Critical Observation

The most critical observation is that the API returns 200 (success) for the PUT request, but the database value remains `true`. This suggests one of the following:

1. The update operation is being accepted but not actually changing the database value
2. The value being sent is not `false` as expected
3. The value is being changed after the save operation
4. There's a database-level constraint or trigger preventing the change
5. The update is happening in a transaction that's being rolled back

## Data Integrity Concern

The core issue is a data integrity problem: the user's explicit selection during onboarding is not being persisted. This affects:
- Billing accuracy (wrong plan price)
- Feature access (notifications page visibility)
- User trust (system not respecting their choices)

## No Seed Data or LocalStorage

Confirmed that:
- No seed data is being used (removed from all locations)
- No localStorage is being used (removed from all locations)
- All data flows through API endpoints only
- The issue is specifically with the `notifications_enabled` field not being saved correctly

The problem is isolated to the save operation for this specific field during onboarding Step 8.

## Additional Observations

1. The user went through the entire onboarding flow, which means Step 8 was completed
2. The PUT request to Step 8 returned 200 (success)
3. Yet the database shows the wrong value
4. This suggests the save operation is either:
   - Not actually executing the update
   - Being blocked at the database level
   - Having its value overwritten immediately after
   - Receiving a different value than expected

The code changes made appear correct on the surface, but the database value doesn't reflect the user's choice. This indicates a deeper issue in the save/update mechanism that needs to be identified and fixed at the root cause level.
