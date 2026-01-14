# Availability Save Flow Diagnostic Map

## Data Flow Overview

This document maps the complete data flow when saving availability slots in the admin calendar view.

## Flow Steps

### 1. User Interaction (Frontend)
**Location:** `apps/web/src/app/app/b/[businessId]/calendar/page.tsx`

**Action:** User clicks empty time slot
- **Function:** `handleEmptySlotClick(day: Date, hour: number)`
- **Logs:** `[calendar] handleEmptySlotClick called:`
- **What happens:**
  - Checks if service is selected
  - If staff is selected (not "any"), adds to `pendingAvailabilityAdditions` state
  - If staff is "any", opens modal to select staff
- **State Update:** `setPendingAvailabilityAdditions([...prev, { staffId, date: day, hour }])`
- **Logs:** `[calendar] Added to pending:` with full details

### 2. Save Button Click (Frontend)
**Location:** `apps/web/src/app/app/b/[businessId]/calendar/page.tsx`

**Action:** User clicks "Save Availability" button
- **Function:** `handleSaveAvailability()`
- **Logs:** `[calendar] ===== SAVE AVAILABILITY CALLED =====`
- **Early Exit Check:**
  - If no `selectedServiceId` OR no pending changes → exits with log: `[calendar] ❌ No pending changes to save - EXITING EARLY`
  - **This is a critical check point!**

### 3. Fetch Current Availability (Frontend → Backend)
**Location:** `apps/web/src/app/app/b/[businessId]/calendar/page.tsx` (line ~682)

**Action:** GET request to fetch existing availability
- **Endpoint:** `GET /api/business/onboarding/step-7-availability`
- **Purpose:** Get all existing availability rules to merge with new changes
- **Logs:** `[calendar] Fetching current availability...`
- **Response:** Array of services with their staff and slots
- **Data Format:**
  ```json
  {
    "availability": [
      {
        "serviceId": "uuid",
        "staff": [
          {
            "staffId": "uuid",
            "slots": [
              {
                "day": "monday",
                "startTime": "09:00",
                "endTime": "10:00"
              }
            ]
          }
        ]
      }
    ]
  }
  ```

### 4. Process Additions (Frontend)
**Location:** `apps/web/src/app/app/b/[businessId]/calendar/page.tsx` (line ~775)

**Action:** Merge pending additions with existing data
- **Logs:** `[calendar] ===== PROCESSING ADDITIONS =====`
- **For each pending addition:**
  1. Extract: `staffId`, `date`, `hour`
  2. Calculate weekday: `formatInTimeZone(date, timezone, { weekday: "long" }).toLowerCase()`
  3. Calculate times: `startTime = "HH:00"`, `endTime = startTime + duration`
  4. Find or create staff availability entry
  5. Check for duplicates
  6. Add new slot if not duplicate
- **Logs:** `[calendar] ✅ Added slot:` with full details
- **Critical:** Weekday must be lowercase (e.g., "tuesday" not "Tuesday")

### 5. Send PUT Request (Frontend → Backend)
**Location:** `apps/web/src/app/app/b/[businessId]/calendar/page.tsx` (line ~879)

**Action:** Send merged availability data to backend
- **Endpoint:** `PUT /api/business/onboarding/step-7-availability`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body:**
  ```json
  {
    "availability": [
      {
        "serviceId": "uuid",
        "staff": [
          {
            "staffId": "uuid",
            "slots": [
              {
                "day": "tuesday",
                "startTime": "08:00",
                "endTime": "08:30"
              }
            ]
          }
        ]
      }
    ]
  }
  ```
- **Logs:** `[calendar] Sending PUT request to /api/business/onboarding/step-7-availability`

### 6. Backend Receives Request
**Location:** `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` (line ~135)

**Action:** Process PUT request
- **Logs:** `[step-7-availability] ===== RECEIVED PUT REQUEST =====`
- **Validation:**
  - Check authentication (userId)
  - Check business exists (businessId)
  - Validate `availability` is an array
- **Logs:** `[step-7-availability] ✅ Processing availability rules:`

### 7. Delete Existing Rules (Backend → Database)
**Location:** `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` (line ~225)

**Action:** Delete all existing availability rules for this business
- **Query:** `DELETE FROM availability_rules WHERE user_id = ? AND business_id = ?`
- **Purpose:** Replace-all strategy (not merge)
- **Note:** Uses admin client if RLS errors occur

### 8. Process and Insert Rules (Backend → Database)
**Location:** `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` (line ~260)

**Action:** Transform frontend data to database format
- **Logs:** `[step-7-availability] ===== PROCESSING SERVICES =====`
- **For each service:**
  - Validate `serviceId` is UUID (or map temporary ID)
  - For each staff:
    - Validate `staffId` is UUID (or map temporary ID)
    - For each slot:
      - Map `day` string to weekday number: `WEEKDAY_MAP[day.toLowerCase()]`
      - Create rule object:
        ```javascript
        {
          user_id: userId,
          business_id: businessId,
          staff_id: staffId,
          service_id: serviceId,
          rule_type: 'weekly',
          weekday: 0-6, // 0=Sunday, 6=Saturday
          start_time: "HH:mm",
          end_time: "HH:mm",
          capacity: 1
        }
        ```
- **Logs:** `[step-7-availability] ✅ Adding rule to insert:`

### 9. Database Insert (Backend → Database)
**Location:** `apps/web/src/app/api/business/onboarding/step-7-availability/route.ts` (line ~380)

**Action:** Insert all rules in batch
- **Query:** `INSERT INTO availability_rules (...) VALUES (...)`
- **Logs:** `[step-7-availability] ===== INSERTING RULES TO DATABASE =====`
- **Logs:** Insert result with count and any errors
- **Returns:** Success response with count of inserted rules

### 10. Frontend Refetch (Frontend → Backend)
**Location:** `apps/web/src/app/app/b/[businessId]/calendar/page.tsx` (line ~914)

**Action:** Refetch availability to show updated data
- **Wait:** 500ms delay for database commit
- **Function:** `fetchAvailability()`
- **Endpoint:** `GET /api/public/{slug}/availability?service_id={id}&date={date}`
- **Purpose:** Generate slots from newly saved rules
- **Updates:** `setFetchedSlots(allSlots)`

## Potential Failure Points

### 1. Early Exit in Save Function
- **Check:** `pendingAvailabilityAdditions.length === 0`
- **Cause:** State not updated when clicking slots
- **Fix:** Ensure `setPendingAvailabilityAdditions` is called correctly

### 2. Weekday Case Mismatch
- **Check:** Day name format (must be lowercase)
- **Cause:** `formatInTimeZone` returns capitalized, but API expects lowercase
- **Fix:** Already fixed with `.toLowerCase()`

### 3. UUID Validation Failure
- **Check:** `serviceId` and `staffId` must be valid UUIDs
- **Cause:** Temporary IDs from frontend not mapped correctly
- **Fix:** Backend tries to map temporary IDs to real UUIDs

### 4. Database Insert Failure
- **Check:** RLS policies or database constraints
- **Cause:** Missing permissions or invalid data
- **Fix:** Uses admin client if RLS errors occur

### 5. Refetch Not Showing New Data
- **Check:** Cache or timing issues
- **Cause:** Refetch happens before database commit
- **Fix:** Added 500ms delay and cache-busting headers

## Debugging Checklist

When availability doesn't save, check these logs in order:

1. ✅ `[calendar] handleEmptySlotClick called:` - Did click register?
2. ✅ `[calendar] Added to pending:` - Was it added to state?
3. ✅ `[calendar] ===== SAVE AVAILABILITY CALLED =====` - Did save function run?
4. ✅ `[calendar] ✅ Proceeding with save:` - Did it pass early exit check?
5. ✅ `[calendar] ===== PROCESSING ADDITIONS =====` - Are additions being processed?
6. ✅ `[calendar] ✅ Added slot:` - Was slot added to data structure?
7. ✅ `[calendar] Sending PUT request:` - Was request sent?
8. ✅ `[step-7-availability] ===== RECEIVED PUT REQUEST =====` - Did backend receive it?
9. ✅ `[step-7-availability] ===== INSERTING RULES TO DATABASE =====` - Was insert attempted?
10. ✅ `[step-7-availability] Insert result:` - Did insert succeed?

## Next Steps

With the enhanced logging in place, when you try to add availability again, the console logs will show exactly where the flow breaks. Look for:
- Missing logs (indicates function not called)
- Error logs (indicates failure at that step)
- Data mismatches (indicates transformation issue)

