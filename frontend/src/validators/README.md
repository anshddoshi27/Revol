# Availability Validators - T07A Finalized DTO Wiring

This directory contains the finalized availability validation system as specified in Task T07A. The implementation provides comprehensive validation for availability rules, recurring patterns, and time blocks with proper error handling and overlap detection.

## Overview

The availability validators ensure data integrity and consistency across the availability management system. They provide both client-side validation using Zod schemas and comprehensive business logic validation for availability rules.

## Files

- `availabilityValidators.ts` - Main validation functions and Zod schemas
- `__tests__/availabilityValidators.test.ts` - Comprehensive test suite

## Key Features

### 1. Zod Schema Validation

- **availabilityRuleSchema**: Validates the finalized AvailabilityRule DTO
- **recurringPatternSchema**: Validates recurring availability patterns
- **timeBlockSchema**: Validates time blocks for calendar display

### 2. Business Logic Validation

- **Time Format Validation**: Ensures HH:MM format (24-hour)
- **Time Range Validation**: Ensures end time is after start time
- **Break Time Validation**: Ensures breaks are within availability hours
- **Overlap Detection**: Prevents scheduling conflicts between rules
- **Day of Week Validation**: Ensures valid day values (0-6)

### 3. Utility Functions

- **Time Conversion**: Convert between time strings and minutes
- **Duration Calculation**: Calculate time block durations
- **Time Slot Generation**: Generate time slots with custom intervals
- **Range Operations**: Check overlaps and intersections

## Usage

### Basic Validation

```typescript
import { validateAvailabilityRule, validateAvailabilityRules } from '../validators/availabilityValidators';

// Validate a single rule
const result = validateAvailabilityRule(availabilityRule);
if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}

// Validate multiple rules with overlap detection
const validation = validateAvailabilityRules(rules);
if (!validation.isValid) {
  console.error('Overlaps detected:', validation.overlaps);
}
```

### Schema Validation

```typescript
import { availabilityRuleSchema } from '../validators/availabilityValidators';

const result = availabilityRuleSchema.safeParse(ruleData);
if (!result.success) {
  console.error('Schema validation failed:', result.error.errors);
}
```

### Utility Functions

```typescript
import { 
  isValidTimeFormat, 
  calculateDuration, 
  generateTimeSlots 
} from '../validators/availabilityValidators';

// Check time format
const isValid = isValidTimeFormat('09:00'); // true

// Calculate duration
const duration = calculateDuration('09:00', '17:00'); // 480 minutes

// Generate time slots
const slots = generateTimeSlots('09:00', '12:00', 30); // ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
```

## Validation Rules

### Time Format
- Must be in HH:MM format (24-hour)
- Hours: 00-23
- Minutes: 00-59

### Time Ranges
- End time must be after start time
- Break times must be within availability hours
- Break end must be after break start

### Day of Week
- Must be 0-6 (Sunday-Saturday)
- 0 = Sunday, 1 = Monday, ..., 6 = Saturday

### Overlap Detection
- Rules for the same staff member and day cannot overlap
- Overlaps are detected and reported with specific time ranges
- Different staff members can have overlapping schedules

## Error Handling

All validation functions return structured error information:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  overlaps?: Array<{
    rule1_id: string;
    rule2_id: string;
    day_of_week: number;
    overlap_start: string;
    overlap_end: string;
  }>;
}
```

## Testing

The validation system includes comprehensive tests covering:

- Valid and invalid time formats
- Time range validation
- Break time validation
- Overlap detection
- Edge cases (midnight crossover, DST, etc.)
- Utility function accuracy

Run tests with:
```bash
npm test -- availabilityValidators.test.ts
```

## Integration

The validators integrate with:

- **API Layer**: Client-side validation before API calls
- **Hooks**: Real-time validation in useAvailabilityRules
- **Components**: Form validation in availability forms
- **Calendar**: Overlap detection in calendar views

## DTO Compliance

The validators ensure compliance with the finalized AvailabilityRule DTO:

```typescript
interface AvailabilityRule {
  id: string;
  tenant_id: string;
  staff_id: string;
  day_of_week: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_recurring: boolean;
  break_start?: string; // HH:MM format
  break_end?: string; // HH:MM format
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

## Performance

- Client-side validation provides immediate feedback
- Overlap detection is optimized for typical use cases
- Validation results are cached when possible
- Minimal memory footprint with efficient algorithms

## Future Enhancements

- DST-aware validation for timezone handling
- Advanced recurring pattern validation
- Performance optimizations for large rule sets
- Custom validation rules per tenant
