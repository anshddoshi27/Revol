# Next Session Prompt - Availability Data Loss Fix

## Context

I'm working on fixing a critical bug where availability data (and potentially other onboarding data) is being lost after the Stripe API onboarding redirect. The data appears to save initially, but after returning from Stripe, the database returns empty arrays.

## The Problem

1. User fills availability data and clicks "Save Availability" - appears successful
2. User proceeds through onboarding to Stripe payment setup
3. After Stripe redirect, availability data is empty - API returns `{"availability": []}`
4. User cannot launch business because availability is required

**Root Cause Identified**: Staff IDs (and possibly service IDs) sent from frontend don't match database IDs. Frontend uses temporary IDs like `staff_324b0196-d7d2-4d00-b469-1155adf33818`, but when staff is saved, the database generates new UUIDs. When availability is saved, the IDs don't match, so all entries are skipped and nothing is saved to the database.

## What Has Been Tried

1. ✅ Fixed frontend state initialization from defaultValues
2. ✅ Enhanced staff ID matching logic with fallback to first staff member
3. ✅ Added reload mechanism in handleLaunch
4. ✅ Fixed React rendering warnings
5. ❌ **Still not working** - Database still returns empty arrays

## Current State

### Key Files
- `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` - PUT handler with staff ID matching logic (lines 357-432)
- `apps/web/src/components/onboarding/availability-step.tsx` - Frontend save logic (lines 503-656)
- `apps/web/src/app/api/business/onboarding/step-4-team/route.ts` - Staff save handler
- `apps/web/src/lib/onboarding-context.tsx` - State management

### Current Staff ID Matching Logic
The API tries:
1. Exact match
2. Strip `staff_` prefix and match UUID
3. Fallback to first staff member

But it's still not working - likely because:
- Service IDs also don't match
- `allStaff` array might be empty when availability is saved
- Database insert might be failing for other reasons (RLS, constraints)

## What Needs to Be Done

### Priority 1: Fix ID Synchronization (CRITICAL)

**The Real Fix**: After staff is saved in `step-4-team`, the frontend should update all staff IDs in context to use the real database IDs returned by the API. Same for services.

**Steps**:
1. Check `step-4-team/route.ts` - does it return the staff IDs that were saved?
2. Check where staff is saved in frontend - does it update the context with real IDs?
3. Ensure availability uses the updated real IDs, not temporary ones
4. Do the same for service IDs

### Priority 2: Add Comprehensive Logging (DEBUGGING)

Add detailed logging to trace the exact flow:
1. What staff IDs are in the database when availability is saved?
2. What staff IDs is the frontend sending?
3. Which entries are being matched vs skipped?
4. What is the final `rulesToInsert` array?
5. Does the database insert succeed or fail?

### Priority 3: Verify Database State (IMMEDIATE)

Run these SQL queries to see what's actually in the database:
```sql
-- Replace <business_id> with actual business ID from logs
SELECT id, name, created_at FROM staff WHERE business_id = '<business_id>' ORDER BY created_at;
SELECT id, name, created_at FROM services WHERE business_id = '<business_id>' ORDER BY created_at;
SELECT * FROM availability_rules WHERE business_id = '<business_id>';
```

## Your Task

1. **First**: Verify what's in the database vs what frontend is sending
   - Add logging to show exact IDs being sent vs IDs in database
   - Check if staff/services are actually being saved

2. **Then**: Fix the ID synchronization
   - Ensure frontend updates to real IDs after staff/services are saved
   - Ensure availability uses these real IDs

3. **Finally**: Test the complete flow
   - Save staff → verify IDs updated
   - Save services → verify IDs updated  
   - Save availability → verify it uses real IDs
   - Check database → verify rules are saved
   - Go through Stripe → verify data persists

## Expected Behavior After Fix

1. User saves staff → Frontend receives real database IDs → Updates context with real IDs
2. User saves services → Frontend receives real database IDs → Updates context with real IDs
3. User saves availability → Uses real IDs from context → All entries match database → All rules saved successfully
4. User goes through Stripe → Returns → Data loads correctly → Availability persists

## Files to Focus On

1. `apps/web/src/app/api/business/onboarding/step-4-team/route.ts` - Check what it returns
2. `apps/web/src/components/onboarding/team-step.tsx` - Check if it updates context with real IDs
3. `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` - Current matching logic
4. `apps/web/src/components/onboarding/availability-step.tsx` - Where availability is saved

## Additional Context

See `AVAILABILITY_DATA_LOSS_INVESTIGATION.md` for complete details of:
- All attempts made
- Why they didn't work
- Detailed code analysis
- Full debugging steps

## Console Logs to Look For

The user's logs show:
```
load-onboarding-data.ts:242 [loadOnboardingData] ✅ Loaded availability data: Object
  count: 0
  fullData: "[]"
  services: []
  totalSlots: 0
```

This confirms the database is returning empty arrays. The fix must ensure data is actually saved to the database in the first place.

---

**Start by**: Adding comprehensive logging to see exactly what IDs are being sent vs what's in the database, then fix the ID synchronization issue.
