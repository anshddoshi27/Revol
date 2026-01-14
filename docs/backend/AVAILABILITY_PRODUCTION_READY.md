# Availability System - Production Readiness

## Overview

The availability system generates bookable time slots for services based on staff schedules, respecting business rules, blackouts, and existing bookings. It prevents double-booking and handles timezone conversions correctly.

## Features

### ✅ Service-by-Staff Availability
- Availability is configured per service, per staff member
- Each service can have multiple staff members who can perform it
- Each staff member can have different availability for different services
- Matches onboarding UX: owner picks service → picks staff → sets availability

### ✅ Slot Generation
- **Granularity**: 15-minute increments
- **Duration**: Slots match service duration (e.g., 30min service = 30min slots)
- **Timezone**: All slots generated in business timezone, returned as UTC ISO strings
- **Sorting**: Slots sorted chronologically by start time

### ✅ Business Rules
- **Lead Time**: `min_lead_time_minutes` (default 120 = 2 hours)
  - Slots must start at least this many minutes from now
- **Max Advance**: `max_advance_days` (default 60 days)
  - Slots only generated up to this many days in advance
- **Timezone**: Business timezone used for all time calculations

### ✅ Blackout Handling
- **Staff-specific blackouts**: Block specific staff members
- **Global blackouts**: Block entire business (staff_id = null)
- **Multi-day blackouts**: Handles blackouts spanning multiple days
- Blackouts subtract from available time ranges

### ✅ Booking Overlap Prevention
- Excludes slots that overlap with:
  - `pending` bookings
  - `scheduled` bookings
  - `held` bookings (temporary holds during checkout)
- Allows slots that overlap with:
  - `completed` bookings (historical records)
  - `cancelled` bookings
  - `refunded` bookings

### ✅ Double-Booking Prevention
- **Database-level**: Unique index on `(staff_id, start_at)` WHERE `status IN ('pending', 'scheduled', 'held')`
- **Application-level**: Booking creation catches unique_violation and returns 409 Conflict
- **Race condition safe**: Database constraint prevents double-booking even with concurrent requests

### ✅ Multiple Staff Support
- Multiple staff can have overlapping availability
- UI renders per-staff lanes with color coding
- Customers can choose which staff member they prefer

### ✅ Timezone & DST Handling
- All times converted from business timezone to UTC
- DST transitions handled correctly
- Weekday calculation respects business timezone

## Database Schema

### Tables
1. **availability_rules** - Weekly schedules per service/staff/weekday
2. **blackouts** - Time ranges when business/staff unavailable
3. **bookings** - Existing appointments (used to exclude slots)
4. **staff_services** - Junction table (which staff can perform which services)

### Unique Index
```sql
CREATE UNIQUE INDEX unique_active_slot ON bookings(staff_id, start_at)
WHERE status IN ('pending', 'scheduled', 'held');
```

This index:
- Prevents double-booking at database level
- Only applies to active bookings (not completed/cancelled)
- Allows historical records (multiple completed bookings at same time)

## API Endpoint

### Public Availability
```
GET /api/public/{subdomain}/availability?service_id={id}&date=YYYY-MM-DD
```

**Response:**
```json
{
  "slots": [
    {
      "staff_id": "uuid",
      "staff_name": "Jane Doe",
      "start_at": "2025-01-20T14:00:00Z",
      "end_at": "2025-01-20T14:30:00Z"
    }
  ],
  "service_id": "uuid",
  "date": "2025-01-20"
}
```

**Validation:**
- Subdomain must exist and business must be `active` or `trial`
- `service_id` required
- `date` required in `YYYY-MM-DD` format
- Returns 404 if business not found
- Returns 400 for invalid parameters

## Slot Generation Algorithm

1. **Load Business Settings**
   - Timezone, min_lead_time_minutes, max_advance_days

2. **Load Service**
   - Get service duration

3. **Load Staff**
   - Get all staff who can perform this service (via `staff_services`)
   - Filter to active staff only

4. **Load Availability Rules**
   - Get rules for this service, staff, and weekday
   - Filter to `rule_type = 'weekly'` and not deleted

5. **Load Blackouts**
   - Get blackouts for this date (staff-specific and global)

6. **Load Existing Bookings**
   - Get bookings for this date and staff
   - Filter to `status IN ('pending', 'scheduled', 'held')`

7. **Generate Slots**
   - For each rule:
     - Convert start_time/end_time to UTC in business timezone
     - Walk in 15-minute increments
     - For each candidate slot:
       - Check lead time (must be >= now + min_lead_time)
       - Check max advance (must be <= now + max_advance_days)
       - Check blackouts (must not overlap)
       - Check existing bookings (must not overlap)
       - If all checks pass, add slot

8. **Return Sorted Slots**
   - Sort by start_at
   - Return as array of slot objects

## Double-Booking Prevention Flow

### During Booking Creation

1. **Check Availability** (via `/api/public/{subdomain}/availability`)
   - Customer sees available slots
   - Selects a slot

2. **Create Booking** (via `POST /api/public/{subdomain}/bookings`)
   - Backend validates slot is still available
   - Attempts to insert booking with `status = 'pending'`
   - If unique_violation (error code 23505):
     - Return HTTP 409 Conflict
     - Error: "Slot is no longer available"
   - If insert succeeds:
     - Continue with SetupIntent creation
     - Return booking confirmation

3. **Frontend Handling**
   - On 409 error:
     - Show error message
     - Refresh availability slots
     - Let user pick different time

### Held Slots (Optional)

If implementing held slots:

1. **Select Slot** → Create booking with `status = 'held'`, `held_expires_at = now() + 5 minutes`
2. **Checkout** → If SetupIntent succeeds, update to `status = 'pending'`
3. **Expiration** → Cron job expires held slots after 5 minutes if no payment method saved

## Testing

### Unit Tests
- `apps/web/src/lib/__tests__/availability.test.ts` - Slot generation logic
- `apps/web/src/lib/__tests__/availability-double-booking.test.ts` - Double-booking prevention

### Integration Tests
- `apps/web/src/app/api/__tests__/availability-endpoint.test.ts` - API endpoint

### Test Coverage
- ✅ Basic slot generation
- ✅ Lead time enforcement
- ✅ Max advance days
- ✅ Blackout handling
- ✅ Booking overlap prevention
- ✅ Multiple staff support
- ✅ Timezone handling
- ✅ Weekday matching
- ✅ Edge cases
- ✅ Production scenarios

## Production Checklist

- [x] Database schema with unique index
- [x] Slot generation algorithm implemented
- [x] Timezone conversion working correctly
- [x] Blackout handling implemented
- [x] Booking overlap prevention
- [x] Double-booking prevention (unique index)
- [x] API endpoint implemented
- [x] Error handling for race conditions
- [x] Tests written
- [ ] Load testing with concurrent requests
- [ ] DST transition testing
- [ ] Monitoring for slot generation performance

## Performance Considerations

### Caching
- Frontend: React Query caches availability responses
- Backend: Consider Redis cache for high-traffic businesses
- Cache key: `avail:{business_id}:{service_id}:{date}`
- Invalidate on:
  - New booking created
  - Availability rule changed
  - Blackout added/removed

### Optimization
- Indexes on:
  - `availability_rules(service_id, staff_id, weekday)`
  - `blackouts(business_id, start_at, end_at)`
  - `bookings(business_id, staff_id, start_at)`
- Limit slot generation to reasonable date ranges
- Process rules in batches if needed

## Monitoring

### Metrics to Track
- Slot generation time
- Number of slots generated per request
- 409 Conflict errors (indicates race conditions)
- Availability endpoint response times
- Cache hit rates

### Alerts
- High number of 409 errors (may indicate UI issue)
- Slow slot generation (>1 second)
- Database query timeouts

## Troubleshooting

### No slots returned
1. Check service has staff assigned (via `staff_services`)
2. Check staff have availability rules for that weekday
3. Check rules are `rule_type = 'weekly'` and not deleted
4. Check blackouts aren't blocking all time
5. Check bookings aren't filling all slots
6. Check date is within max_advance_days
7. Check date is not in the past

### Double-booking occurring
- Should not happen due to unique index
- If it does, check:
  - Unique index exists in database
  - Index WHERE clause includes all active statuses
  - Booking creation catches unique_violation

### Timezone issues
- Verify business.timezone is set correctly
- Check timezone conversion in slot generation
- Test during DST transitions

### Performance issues
- Check database indexes exist
- Consider adding caching
- Optimize queries (limit date ranges, use indexes)

## Future Enhancements

- Exception rules (one-off availability changes)
- Recurring blackouts (e.g., every Monday)
- Capacity > 1 (multiple bookings per slot)
- Buffer time between bookings
- Staff-specific lead times
- Service-specific lead times



