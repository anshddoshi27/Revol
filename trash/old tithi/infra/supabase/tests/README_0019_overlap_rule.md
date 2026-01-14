# Migration 0019: Update Bookings Overlap Rule

## Overview

This migration updates the bookings overlap rule to exclude `completed` status from overlap prevention, allowing completed bookings to not block future bookings.

## What Changed

### Before (Current State)
- **Constraint**: `bookings_excl_resource_time` 
- **Status Filter**: `status IN ('pending', 'confirmed', 'checked_in', 'completed')`
- **Behavior**: Completed bookings block future bookings on the same resource

### After (New State)
- **Constraint**: `bookings_excl_resource_time` (same name, updated definition)
- **Status Filter**: `status IN ('pending', 'confirmed', 'checked_in')`
- **Behavior**: Completed bookings do NOT block future bookings on the same resource

## Business Rationale

**Goal**: A booking with status `completed` must NOT block future bookings. Only truly active statuses should participate in the GiST exclusion.

**Why This Matters**:
- Aligns DB with spec intent and business rule: "completed means end time passed or payment captured; it does not block future booking creation"
- Allows businesses to reuse time slots after completion
- Prevents unnecessary scheduling conflicts for historical data

## Technical Implementation

### Migration Steps

1. **Detect and Drop Current Constraint**
   - Safely finds the existing exclusion constraint by signature
   - Uses `pg_constraint` lookup to identify the constraint regardless of name
   - Drops the constraint safely

2. **Recreate with Updated Filter**
   - Creates new exclusion constraint with same name
   - Only includes: `pending`, `confirmed`, `checked_in`
   - Explicitly excludes: `completed`, `canceled`, `no_show`, `failed`

3. **Validation**
   - Verifies constraint was created correctly
   - Confirms the new definition matches expectations

### Constraint Definition

```sql
EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (
    status IN ('pending', 'confirmed', 'checked_in') 
    AND resource_id IS NOT NULL
);
```

## Testing

### pgTAP Test Suite: `0019_overlap_rule_validation.sql`

**Test 1**: Two non-overlapping completed bookings can coexist with future pending booking
- Creates completed bookings at 9:00-9:30 AM and 10:00-10:30 AM
- Successfully creates pending booking at 11:00-11:30 AM
- **Expected**: Should pass (completed status excluded from overlap)

**Test 2**: Overlapping confirmed and pending bookings still conflict
- Attempts to create confirmed booking overlapping with pending booking
- **Expected**: Should fail with exclusion constraint violation

**Test 3**: Verify start_at < end_at invariant still holds
- Attempts to create booking with invalid time ordering
- **Expected**: Should fail with CHECK constraint violation

**Test 4**: Verify constraint definition is correct
- Checks constraint exists and has correct status filter
- Verifies completed status is NOT included
- **Expected**: Constraint should only include pending, confirmed, checked_in

**Test 5**: Verify completed bookings don't block each other
- Creates overlapping completed bookings
- **Expected**: Should succeed (completed status excluded from overlap)

## Roll-forward Expectations

- **Reindex**: Only as needed for the dropped constraint
- **Data Changes**: None required
- **Downtime**: Minimal (constraint recreation)
- **Backward Compatibility**: Fully maintained

## Safety Features

### Idempotency
- Migration can be run multiple times safely
- Constraint lookup handles different constraint names gracefully
- No data loss or corruption possible

### Validation
- Verifies `start_at` and `end_at` columns exist before constraint creation
- Confirms constraint was created successfully
- Provides detailed logging of operations

### Rollback Safety
- Original constraint is dropped before new one is created
- If migration fails, no constraint exists (safe state)
- Can be manually reverted by recreating original constraint

## Dependencies

- **Required**: `0008_bookings.sql` (original constraint)
- **Extensions**: `btree_gist` (already installed)
- **Tables**: `public.bookings` with `start_at`, `end_at`, `status`, `resource_id` columns

## Impact Assessment

### Low Risk
- **Data Integrity**: No data changes, only constraint modification
- **Performance**: Minimal impact (same GiST index structure)
- **Application**: No code changes required

### Benefits
- **Business Logic**: Aligns with intended behavior
- **Scheduling**: Allows reuse of completed time slots
- **Maintenance**: Cleaner separation of active vs. historical bookings

## Monitoring

After migration, verify:
1. Constraint exists with correct definition
2. Completed bookings don't block future bookings
3. Active statuses still prevent overlaps
4. No performance degradation on booking operations

## Related Documentation

- **Design Brief**: §15 Overlap Prevention (Exclusions)
- **Context Pack**: Business rules for booking lifecycle
- **Canon**: C-OVERLAP-001 constraint definition
- **DB Progress**: P0008 implementation details
