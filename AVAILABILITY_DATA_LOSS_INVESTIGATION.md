# Availability Data Loss Investigation - Complete Summary

## Executive Summary

**Problem**: Availability data (and potentially other onboarding data) is being lost after the Stripe API onboarding redirect. The data appears to be saved initially, but after returning from Stripe, the database returns empty arrays for availability.

**Status**: UNRESOLVED - Multiple attempts have been made but the root cause persists.

**Critical Finding**: The API is returning `{"availability": []}` from the database, indicating the data is either:
1. Not being saved to the database in the first place
2. Being deleted/cleared during the Stripe redirect process
3. Being saved with incorrect IDs that don't match database records

---

## The Problem

### User's Experience
1. User fills in availability data (either manually or using "Fill with test data")
2. User clicks "Save Availability" - appears to save successfully
3. User proceeds through onboarding to Stripe payment setup
4. After Stripe redirect, user returns to onboarding
5. Availability data is empty - API returns `{"availability": []}`
6. User cannot launch business because availability is required

### Console Logs Show
```
load-onboarding-data.ts:242 [loadOnboardingData] ✅ Loaded availability data: Object
  count: 0
  fullData: "[]"
  services: []
  servicesDetail: []
  totalSlots: 0
  totalStaffEntries: 0
```

The API is returning an empty array from the database, meaning **no availability rules exist in the database**.

---

## Root Cause Analysis

### Primary Issue: Staff ID Mismatch

**The Core Problem**:
1. **Frontend sends staff IDs with `staff_` prefix**: When staff is created in the frontend, IDs are generated as `staff_324b0196-d7d2-4d00-b469-1155adf33818` (temporary IDs with `staff_` prefix)
2. **Database generates new UUIDs**: When staff is saved in `step-4-team` API, if the ID has `staff_` prefix, it's not a valid UUID format, so the database generates a completely new UUID (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
3. **Availability uses old IDs**: When availability is saved, it uses the original frontend IDs (`staff_324b0196...`) which don't exist in the database
4. **All availability entries are skipped**: The API tries to match staff IDs, fails, and skips all availability entries
5. **Result**: No availability rules are saved to the database

### Secondary Issues

1. **Service ID Mismatch**: Similar issue with service IDs - frontend uses temporary IDs like `service-1768345351377-0-0` which may not match database UUIDs
2. **State Management**: Frontend state may not be properly syncing with backend after Stripe redirect
3. **No Error Feedback**: The API silently skips invalid entries without clear error messages

---

## What Was Tried

### Attempt 1: Frontend State Initialization Fix
**What was done**:
- Modified `availability-step.tsx` to initialize `savedAvailability` state from `defaultValues` prop
- Added `useEffect` to update state when `defaultValues` changes
- Enhanced logging in `onboarding-context.tsx` and `load-onboarding-data.ts`

**Why it didn't work**:
- The issue wasn't frontend state - the database was actually empty
- State initialization works, but there's no data to initialize from because it was never saved

### Attempt 2: Staff ID Matching Logic Enhancement
**What was done**:
- Enhanced staff ID matching in `step-7-availability/route.ts`:
  - Try exact match
  - Try stripping `staff_` prefix and matching UUID
  - Use first staff member as fallback if no match found
- Added comprehensive logging throughout the matching process

**Why it didn't work**:
- The fallback logic was added, but there may be edge cases where:
  - `allStaff` array is empty when availability is saved
  - Service IDs also don't match, causing entire service entries to be skipped
  - The matching happens but then the insert fails for other reasons (RLS, constraints, etc.)

### Attempt 3: Reload Mechanism in handleLaunch
**What was done**:
- Added retry logic in `page.tsx` `handleLaunch` function to reload availability from API if empty
- Enhanced validation to check for actual slots, not just array presence

**Why it didn't work**:
- This only addresses the symptom, not the root cause
- If the database is empty, reloading won't help

### Attempt 4: React Rendering Fixes
**What was done**:
- Fixed React Fragment key warnings
- Fixed duplicate props error on button element
- Added proper React imports

**Why it didn't work**:
- These were separate issues, not related to data persistence

---

## Current Code State

### Key Files Modified

1. **`apps/web/src/app/api/business/onboarding/step-7-availability/route.ts`**
   - Lines 357-432: Staff ID matching logic with fallback
   - Lines 263-265: Enhanced logging for services and staff
   - Lines 301-305: Initial processing logs

2. **`apps/web/src/components/onboarding/availability-step.tsx`**
   - Lines 63-80: State initialization from defaultValues
   - Lines 100-115: useEffect to sync with defaultValues changes
   - Lines 503-656: handleSaveAvailability function

3. **`apps/web/src/app/onboarding/page.tsx`**
   - Lines 990-1050: Reload mechanism in handleLaunch
   - Lines 274-299: restoreAllOnboardingData enhancement

4. **`apps/web/src/lib/load-onboarding-data.ts`**
   - Lines 202-256: Detailed availability loading logs

5. **`apps/web/src/lib/onboarding-context.tsx`**
   - Lines 215-224: Reducer logging for SAVE_AVAILABILITY
   - Lines 704-709: State change tracking

### Current Staff ID Matching Logic

```typescript
// Strategy 1: Exact match
matchedStaffId = allStaff.find(s => s.id === staffId)?.id;

// Strategy 2: Strip staff_ prefix and match
if (!matchedStaffId && staffId.startsWith('staff_')) {
  const cleanedStaffId = staffId.substring(6);
  if (isValidUUID(cleanedStaffId)) {
    matchedStaffId = allStaff.find(s => s.id === cleanedStaffId)?.id;
  }
}

// Strategy 3: Fallback to first staff member
if (!matchedStaffId && allStaff && allStaff.length > 0) {
  matchedStaffId = allStaff[0].id;
}
```

---

## What Needs to Be Done

### Critical Fixes Required

#### 1. **Fix Staff ID Synchronization** (HIGHEST PRIORITY)

**Problem**: Frontend staff IDs don't match database IDs after staff is saved.

**Solution Options**:

**Option A: Update Frontend IDs After Staff Save** (Recommended)
- When staff is saved in `step-4-team`, the API returns the actual database IDs
- The frontend should update all staff IDs in context and components to use these real IDs
- This ensures availability uses correct IDs from the start

**Implementation**:
1. In `step-4-team/route.ts`, ensure the response includes the mapping of old IDs to new IDs
2. In `team-step.tsx` (or wherever staff is saved), update the context with real IDs
3. Update all references to staff IDs throughout the onboarding flow

**Option B: Match by Position/Index** (Fallback)
- Since staff are saved in order, match availability staff IDs by their position in the array
- More fragile but works if Option A is too complex

**Option C: Match by Name** (Alternative)
- Match staff IDs by staff name (assuming names are unique)
- Less reliable but could work as a fallback

#### 2. **Fix Service ID Synchronization** (HIGH PRIORITY)

**Problem**: Similar to staff IDs - service IDs may not match.

**Solution**:
- Same approach as staff IDs - update frontend service IDs after services are saved
- Or enhance matching logic to handle temporary service IDs

#### 3. **Add Comprehensive Error Handling** (MEDIUM PRIORITY)

**Problem**: API silently fails without clear error messages.

**Solution**:
- Add validation before processing
- Return detailed error messages when IDs don't match
- Log warnings when using fallback strategies
- Return partial success responses if some entries fail

#### 4. **Verify Database State** (IMMEDIATE)

**Action Required**:
- Check the database directly to confirm:
  - Are staff records being saved? (Check `staff` table)
  - Are service records being saved? (Check `services` table)
  - Are ANY availability_rules being saved? (Check `availability_rules` table)
  - What IDs are actually in the database vs what the frontend is sending?

**SQL Queries to Run**:
```sql
-- Check staff
SELECT id, name, created_at FROM staff WHERE business_id = '<business_id>' ORDER BY created_at;

-- Check services
SELECT id, name, created_at FROM services WHERE business_id = '<business_id>' ORDER BY created_at;

-- Check availability rules
SELECT * FROM availability_rules WHERE business_id = '<business_id>';
```

#### 5. **Add Request/Response Logging** (DEBUGGING)

**Action Required**:
- Add detailed logging in `step-7-availability/route.ts` PUT handler to log:
  - Exact payload received from frontend
  - Staff IDs in the request vs staff IDs in database
  - Service IDs in the request vs service IDs in database
  - Which entries are being skipped and why
  - Final `rulesToInsert` array before database insert
  - Database insert result (success/failure, error messages)

---

## Debugging Steps for Next Session

### Step 1: Verify Database State
1. Get the business_id from the console logs
2. Run SQL queries to check what's actually in the database
3. Compare with what the frontend is sending

### Step 2: Add Request Logging
1. Add console.log at the start of PUT handler showing:
   ```typescript
   console.log('[step-7-availability] PUT Request received:', {
     availabilityLength: availability.length,
     availability: JSON.stringify(availability, null, 2),
     allStaffInDB: allStaff?.map(s => ({ id: s.id, name: s.name })),
     allServicesInDB: allServices?.map(s => ({ id: s.id, name: s.name }))
   });
   ```

### Step 3: Trace Each Entry
1. For each service in availability:
   - Log the serviceId from request
   - Log whether it matches any service in database
   - Log the matched serviceId (or "NO MATCH")
2. For each staff in each service:
   - Log the staffId from request
   - Log all matching attempts
   - Log the final matched staffId (or "NO MATCH - SKIPPED")

### Step 4: Verify Insert
1. Log the final `rulesToInsert` array
2. Log the database insert result
3. If insert fails, log the exact error

### Step 5: Test the Flow
1. Create a test business
2. Save staff (note the IDs returned)
3. Save services (note the IDs returned)
4. Save availability (check what IDs are being sent)
5. Check database after each step
6. Go through Stripe redirect
7. Check database again after redirect

---

## Files to Review

### Critical Files
1. `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` - PUT handler (lines 171-550)
2. `apps/web/src/app/api/business/onboarding/step-4-team/route.ts` - Staff save handler
3. `apps/web/src/components/onboarding/availability-step.tsx` - Frontend save logic (lines 503-656)
4. `apps/web/src/lib/onboarding-context.tsx` - State management

### Related Files
1. `apps/web/src/app/onboarding/page.tsx` - Main onboarding page
2. `apps/web/src/lib/load-onboarding-data.ts` - Data loading utility
3. `apps/web/src/lib/test-data-generator.ts` - Test data generation (uses staff IDs)

---

## Expected Behavior After Fix

1. User saves staff → Frontend receives real database IDs → Updates context
2. User saves services → Frontend receives real database IDs → Updates context
3. User saves availability → Uses real IDs from context → All entries match database → All rules saved
4. User goes through Stripe → Returns → Data loads correctly → Availability persists

---

## Additional Context

### Database Schema
- `staff` table: `id` (UUID), `name`, `business_id`, `user_id`
- `services` table: `id` (UUID), `name`, `business_id`, `user_id`
- `availability_rules` table: `staff_id` (UUID FK), `service_id` (UUID FK), `weekday`, `start_time`, `end_time`

### API Endpoints
- `GET /api/business/onboarding/step-7-availability` - Returns availability from database
- `PUT /api/business/onboarding/step-7-availability` - Saves availability to database
- `GET /api/business/onboarding/step-4-team` - Returns staff from database
- `PUT /api/business/onboarding/step-4-team` - Saves staff to database

### Frontend State Flow
1. User interacts with availability calendar
2. Clicks "Save Availability" → `handleSaveAvailability()` called
3. Sends PUT request with `savedAvailability` state (contains temporary IDs)
4. API tries to match IDs, uses fallback if needed
5. Updates `savedAvailability` state with same temporary IDs (doesn't update to real IDs)
6. User clicks "Continue" → `handleContinue()` called
7. Calls `onNext(result)` with availability data
8. Context saves via `saveAvailability()` action
9. User proceeds to Stripe
10. After redirect, `loadOnboardingData()` fetches from API
11. API returns empty array (because nothing was saved)
12. Context initialized with empty array

---

## Conclusion

The root cause is **ID mismatch between frontend and database**. The frontend uses temporary IDs (`staff_xxx`, `service-xxx`) but the database generates new UUIDs. When availability is saved, the IDs don't match, so entries are skipped, and nothing is saved to the database.

The fix requires **synchronizing IDs after staff/services are saved** so that availability uses the correct database IDs from the start.

---

## Next Session Prompt

See `NEXT_SESSION_PROMPT.md` for a ready-to-use prompt for continuing this work.
