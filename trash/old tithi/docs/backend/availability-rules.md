# Availability Rules DTO

**Document Purpose**: Defines the Availability Rules DTO for recurring schedules, copy-week functionality, and DST-safe availability management used by onboarding and admin calendars.

**Version**: 1.0.0  
**Last Updated**: January 27, 2025  
**Status**: Finalized

---

## Overview

The Availability Rules system provides flexible scheduling capabilities for businesses, supporting recurring schedules, exception handling, and timezone-aware operations. This document defines the canonical data structures and business logic for availability management.

---

## Core Availability Concepts

### 1. Availability Rules

**Definition**: Recurring patterns that define when a resource (staff member or business) is available for bookings.

### 2. Resource Types

```typescript
type ResourceType = 'business' | 'staff' | 'room' | 'equipment';
```

### 3. Rule Types

```typescript
type AvailabilityRuleType = 
  | 'recurring_weekly'    // Weekly recurring pattern
  | 'recurring_daily'     // Daily recurring pattern
  | 'one_time'           // Single occurrence
  | 'exception'          // Exception to recurring rules
  | 'holiday'            // Holiday schedule
  | 'break'              // Break time within availability
  | 'copy_week';         // Copy from previous week
```

---

## Availability Rules DTO

### Base Availability Rule

```typescript
interface AvailabilityRule {
  id: string;
  tenant_id: string;
  resource_id: string;
  resource_type: ResourceType;
  rule_type: AvailabilityRuleType;
  
  // Time definition
  start_time: string;        // HH:MM format (24-hour)
  end_time: string;          // HH:MM format (24-hour)
  timezone: string;          // IANA timezone identifier
  
  // Recurring pattern
  days_of_week?: number[];   // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_date?: string;       // ISO 8601 date (inclusive)
  end_date?: string;         // ISO 8601 date (inclusive, null = indefinite)
  
  // Service restrictions
  service_ids?: string[];    // Specific services this rule applies to
  exclude_service_ids?: string[]; // Services excluded from this rule
  
  // Status and metadata
  is_active: boolean;
  priority: number;          // Higher number = higher priority
  notes?: string;
  
  // Audit fields
  created_at: string;
  updated_at: string;
  created_by: string;
}
```

### Recurring Weekly Rule

```typescript
interface RecurringWeeklyRule extends AvailabilityRule {
  rule_type: 'recurring_weekly';
  days_of_week: number[];    // Required for weekly rules
  
  // Example: Monday to Friday, 9 AM to 5 PM
  // {
  //   "rule_type": "recurring_weekly",
  //   "days_of_week": [1, 2, 3, 4, 5],
  //   "start_time": "09:00",
  //   "end_time": "17:00",
  //   "timezone": "America/New_York"
  // }
}
```

### Recurring Daily Rule

```typescript
interface RecurringDailyRule extends AvailabilityRule {
  rule_type: 'recurring_daily';
  days_of_week: number[];    // All 7 days for daily rules
  
  // Example: Every day, 8 AM to 8 PM
  // {
  //   "rule_type": "recurring_daily",
  //   "days_of_week": [0, 1, 2, 3, 4, 5, 6],
  //   "start_time": "08:00",
  //   "end_time": "20:00",
  //   "timezone": "America/New_York"
  // }
}
```

### One-Time Rule

```typescript
interface OneTimeRule extends AvailabilityRule {
  rule_type: 'one_time';
  start_date: string;        // Required for one-time rules
  end_date: string;          // Same as start_date for single day
  
  // Example: Special hours on New Year's Day
  // {
  //   "rule_type": "one_time",
  //   "start_date": "2025-01-01",
  //   "end_date": "2025-01-01",
  //   "start_time": "12:00",
  //   "end_time": "18:00",
  //   "timezone": "America/New_York"
  // }
}
```

### Exception Rule

```typescript
interface ExceptionRule extends AvailabilityRule {
  rule_type: 'exception';
  start_date: string;        // Required for exceptions
  end_date: string;          // Can be same as start_date
  
  // Example: Closed on Christmas Day
  // {
  //   "rule_type": "exception",
  //   "start_date": "2025-12-25",
  //   "end_date": "2025-12-25",
  //   "start_time": "00:00",
  //   "end_time": "00:00",
  //   "is_active": false,
  //   "notes": "Closed for Christmas Day"
  // }
}
```

### Holiday Rule

```typescript
interface HolidayRule extends AvailabilityRule {
  rule_type: 'holiday';
  holiday_name: string;      // Name of the holiday
  start_date: string;        // Required for holidays
  end_date: string;          // Can be same as start_date
  
  // Example: Thanksgiving Day
  // {
  //   "rule_type": "holiday",
  //   "holiday_name": "Thanksgiving Day",
  //   "start_date": "2025-11-27",
  //   "end_date": "2025-11-27",
  //   "start_time": "00:00",
  //   "end_time": "00:00",
  //   "is_active": false,
  //   "notes": "Closed for Thanksgiving"
  // }
}
```

### Break Rule

```typescript
interface BreakRule extends AvailabilityRule {
  rule_type: 'break';
  days_of_week: number[];    // Days when break applies
  break_duration_minutes: number; // Length of break
  
  // Example: 1-hour lunch break Monday to Friday
  // {
  //   "rule_type": "break",
  //   "days_of_week": [1, 2, 3, 4, 5],
  //   "start_time": "12:00",
  //   "end_time": "13:00",
  //   "break_duration_minutes": 60,
  //   "timezone": "America/New_York"
  // }
}
```

### Copy Week Rule

```typescript
interface CopyWeekRule extends AvailabilityRule {
  rule_type: 'copy_week';
  source_week_start: string; // ISO 8601 date of source week
  target_week_start: string; // ISO 8601 date of target week
  
  // Example: Copy previous week's schedule
  // {
  //   "rule_type": "copy_week",
  //   "source_week_start": "2025-01-20", // Monday of source week
  //   "target_week_start": "2025-01-27", // Monday of target week
  //   "timezone": "America/New_York"
  // }
}
```

---

## Availability Calculation

### Rule Priority System

Rules are applied in priority order (higher number = higher priority):

```typescript
const RULE_PRIORITIES = {
  holiday: 100,           // Highest priority
  exception: 90,          // High priority
  one_time: 80,           // Medium-high priority
  break: 70,              // Medium priority
  recurring_weekly: 50,   // Default priority
  recurring_daily: 40,    // Lower priority
  copy_week: 30           // Lowest priority
};
```

### Availability Calculation Algorithm

```typescript
interface AvailabilityCalculation {
  // Calculate available slots for a given date range
  calculateAvailability(
    resourceId: string,
    startDate: string,
    endDate: string,
    serviceDurationMinutes: number,
    timezone: string
  ): AvailabilitySlot[];
}

interface AvailabilitySlot {
  resource_id: string;
  service_id: string;
  start_at: string;        // ISO 8601 datetime
  end_at: string;          // ISO 8601 datetime
  is_available: boolean;
  reason?: string;         // Why slot is unavailable
  rule_applied?: string;   // Which rule created this slot
}
```

### Calculation Steps

1. **Load Rules**: Get all active rules for the resource and date range
2. **Sort by Priority**: Apply rules in priority order
3. **Generate Base Slots**: Create slots from recurring rules
4. **Apply Exceptions**: Override slots with exception rules
5. **Apply Breaks**: Remove break times from available slots
6. **Filter by Service**: Remove slots that don't support the requested service
7. **Check Conflicts**: Remove slots that conflict with existing bookings

---

## DST (Daylight Saving Time) Handling

### Timezone-Aware Operations

```typescript
interface DSTHandling {
  // Convert times to UTC for storage
  convertToUTC(localTime: string, timezone: string, date: string): string;
  
  // Convert UTC times back to local timezone
  convertFromUTC(utcTime: string, timezone: string): string;
  
  // Handle DST transitions
  handleDSTTransition(
    rule: AvailabilityRule,
    transitionDate: string
  ): AvailabilityRule[];
}

// Example: DST transition handling
const handleDSTTransition = (rule: AvailabilityRule, date: string) => {
  const timezone = rule.timezone;
  const transitionDate = new Date(date);
  
  // Check if date falls on DST transition
  if (isDSTTransition(transitionDate, timezone)) {
    // Create two rules: one for standard time, one for daylight time
    return [
      { ...rule, end_date: getDSTStartDate(date, timezone) },
      { ...rule, start_date: getDSTEndDate(date, timezone) }
    ];
  }
  
  return [rule];
};
```

### DST-Safe Rule Creation

```typescript
// Create DST-safe recurring rule
const createDSTSafeRule = (
  resourceId: string,
  daysOfWeek: number[],
  startTime: string,
  endTime: string,
  timezone: string
): AvailabilityRule[] => {
  const currentYear = new Date().getFullYear();
  const rules: AvailabilityRule[] = [];
  
  // Get DST transition dates for the year
  const dstTransitions = getDSTTransitions(currentYear, timezone);
  
  // Create rules for each period between DST transitions
  let currentStart = `${currentYear}-01-01`;
  
  for (const transition of dstTransitions) {
    rules.push({
      id: generateId(),
      tenant_id: getCurrentTenantId(),
      resource_id: resourceId,
      resource_type: 'staff',
      rule_type: 'recurring_weekly',
      days_of_week: daysOfWeek,
      start_time: startTime,
      end_time: endTime,
      timezone: timezone,
      start_date: currentStart,
      end_date: transition.date,
      is_active: true,
      priority: 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: getCurrentUserId()
    });
    
    currentStart = transition.date;
  }
  
  // Add final rule for end of year
  rules.push({
    ...rules[0],
    id: generateId(),
    start_date: currentStart,
    end_date: `${currentYear}-12-31`
  });
  
  return rules;
};
```

---

## Copy Week Functionality

### Copy Week Implementation

```typescript
interface CopyWeekRequest {
  resource_id: string;
  source_week_start: string; // Monday of source week
  target_week_start: string; // Monday of target week
  copy_breaks: boolean;      // Whether to copy break rules
  copy_exceptions: boolean;  // Whether to copy exception rules
  idempotency_key: string;
}

interface CopyWeekResponse {
  rules_copied: number;
  rules_created: AvailabilityRule[];
  conflicts_resolved: number;
  warnings: string[];
}

// Copy week implementation
const copyWeek = async (request: CopyWeekRequest): Promise<CopyWeekResponse> => {
  const sourceRules = await getRulesForWeek(
    request.resource_id,
    request.source_week_start
  );
  
  const targetRules: AvailabilityRule[] = [];
  let conflictsResolved = 0;
  const warnings: string[] = [];
  
  for (const sourceRule of sourceRules) {
    // Skip rules that shouldn't be copied
    if (sourceRule.rule_type === 'break' && !request.copy_breaks) continue;
    if (sourceRule.rule_type === 'exception' && !request.copy_exceptions) continue;
    
    // Create new rule for target week
    const targetRule: AvailabilityRule = {
      ...sourceRule,
      id: generateId(),
      start_date: request.target_week_start,
      end_date: addDays(request.target_week_start, 6), // End of week
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Check for conflicts with existing rules
    const conflicts = await checkRuleConflicts(targetRule);
    if (conflicts.length > 0) {
      conflictsResolved += conflicts.length;
      warnings.push(`Resolved ${conflicts.length} conflicts for rule ${sourceRule.id}`);
    }
    
    targetRules.push(targetRule);
  }
  
  // Save new rules
  await saveRules(targetRules);
  
  return {
    rules_copied: sourceRules.length,
    rules_created: targetRules,
    conflicts_resolved: conflictsResolved,
    warnings: warnings
  };
};
```

---

## API Endpoints

### Create Availability Rule

```typescript
// POST /api/v1/availability/rules
interface CreateAvailabilityRuleRequest {
  resource_id: string;
  resource_type: ResourceType;
  rule_type: AvailabilityRuleType;
  start_time: string;
  end_time: string;
  timezone: string;
  days_of_week?: number[];
  start_date?: string;
  end_date?: string;
  service_ids?: string[];
  exclude_service_ids?: string[];
  is_active?: boolean;
  priority?: number;
  notes?: string;
  idempotency_key: string;
}

// Response
interface CreateAvailabilityRuleResponse {
  rule: AvailabilityRule;
  conflicts_detected: number;
  warnings: string[];
}
```

### List Availability Rules

```typescript
// GET /api/v1/availability/rules
interface ListAvailabilityRulesRequest {
  resource_id?: string;
  resource_type?: ResourceType;
  rule_type?: AvailabilityRuleType;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

// Response
interface ListAvailabilityRulesResponse {
  rules: AvailabilityRule[];
  pagination: PaginationMeta;
}
```

### Update Availability Rule

```typescript
// PUT /api/v1/availability/rules/{id}
interface UpdateAvailabilityRuleRequest {
  start_time?: string;
  end_time?: string;
  timezone?: string;
  days_of_week?: number[];
  start_date?: string;
  end_date?: string;
  service_ids?: string[];
  exclude_service_ids?: string[];
  is_active?: boolean;
  priority?: number;
  notes?: string;
  idempotency_key: string;
}

// Response
interface UpdateAvailabilityRuleResponse {
  rule: AvailabilityRule;
  conflicts_resolved: number;
  warnings: string[];
}
```

### Delete Availability Rule

```typescript
// DELETE /api/v1/availability/rules/{id}
interface DeleteAvailabilityRuleRequest {
  idempotency_key: string;
}

// Response
interface DeleteAvailabilityRuleResponse {
  deleted: boolean;
  affected_bookings: number;
  warnings: string[];
}
```

### Copy Week

```typescript
// POST /api/v1/availability/copy-week
interface CopyWeekRequest {
  resource_id: string;
  source_week_start: string;
  target_week_start: string;
  copy_breaks?: boolean;
  copy_exceptions?: boolean;
  idempotency_key: string;
}

// Response
interface CopyWeekResponse {
  rules_copied: number;
  rules_created: AvailabilityRule[];
  conflicts_resolved: number;
  warnings: string[];
}
```

### Get Availability Slots

```typescript
// GET /api/v1/availability/slots
interface GetAvailabilitySlotsRequest {
  resource_id: string;
  service_id: string;
  start_date: string;
  end_date: string;
  timezone: string;
  duration_minutes?: number;
}

// Response
interface GetAvailabilitySlotsResponse {
  slots: AvailabilitySlot[];
  timezone: string;
  business_hours: BusinessHours;
  rules_applied: string[];
}
```

---

## Business Hours

### Business Hours DTO

```typescript
interface BusinessHours {
  timezone: string;
  hours: {
    [day: string]: {
      open: string;        // HH:MM format
      close: string;       // HH:MM format
      is_closed: boolean;
      breaks?: {
        start: string;     // HH:MM format
        end: string;       // HH:MM format
      }[];
    };
  };
}

// Example business hours
const exampleBusinessHours: BusinessHours = {
  timezone: "America/New_York",
  hours: {
    monday: {
      open: "09:00",
      close: "17:00",
      is_closed: false,
      breaks: [
        { start: "12:00", end: "13:00" }
      ]
    },
    tuesday: {
      open: "09:00",
      close: "17:00",
      is_closed: false,
      breaks: [
        { start: "12:00", end: "13:00" }
      ]
    },
    // ... other days
    sunday: {
      open: "00:00",
      close: "00:00",
      is_closed: true
    }
  }
};
```

---

## Validation Rules

### Rule Validation

```typescript
interface ValidationRules {
  // Time validation
  start_time: {
    format: 'HH:MM';
    required: true;
  };
  end_time: {
    format: 'HH:MM';
    required: true;
    must_be_after: 'start_time';
  };
  
  // Date validation
  start_date: {
    format: 'ISO 8601';
    required_for: ['one_time', 'exception', 'holiday'];
  };
  end_date: {
    format: 'ISO 8601';
    must_be_after_or_equal: 'start_date';
  };
  
  // Days validation
  days_of_week: {
    required_for: ['recurring_weekly', 'recurring_daily', 'break'];
    values: [0, 1, 2, 3, 4, 5, 6];
  };
  
  // Timezone validation
  timezone: {
    format: 'IANA timezone identifier';
    required: true;
    must_be_valid: true;
  };
  
  // Priority validation
  priority: {
    range: [1, 100];
    default: 50;
  };
}

// Validation function
const validateAvailabilityRule = (rule: AvailabilityRule): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate time format
  if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(rule.start_time)) {
    errors.push('start_time must be in HH:MM format');
  }
  
  if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(rule.end_time)) {
    errors.push('end_time must be in HH:MM format');
  }
  
  // Validate end time is after start time
  if (rule.start_time >= rule.end_time) {
    errors.push('end_time must be after start_time');
  }
  
  // Validate days of week
  if (['recurring_weekly', 'recurring_daily', 'break'].includes(rule.rule_type)) {
    if (!rule.days_of_week || rule.days_of_week.length === 0) {
      errors.push('days_of_week is required for this rule type');
    }
    
    if (rule.days_of_week) {
      const invalidDays = rule.days_of_week.filter(day => day < 0 || day > 6);
      if (invalidDays.length > 0) {
        errors.push('days_of_week must contain values between 0 and 6');
      }
    }
  }
  
  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: rule.timezone });
  } catch (error) {
    errors.push('timezone must be a valid IANA timezone identifier');
  }
  
  // Validate date ranges
  if (rule.start_date && rule.end_date) {
    if (new Date(rule.start_date) > new Date(rule.end_date)) {
      errors.push('start_date must be before or equal to end_date');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};
```

---

## Error Handling

### Availability Rule Errors

```typescript
interface AvailabilityRuleError {
  type: 'availability_rule_error';
  title: string;
  status: number;
  detail: string;
  error_code: string;
  rule_id?: string;
  resource_id?: string;
  validation_errors?: {
    field: string;
    message: string;
    value: any;
  }[];
}

// Common error codes
const AVAILABILITY_ERROR_CODES = {
  INVALID_TIME_FORMAT: 'invalid_time_format',
  INVALID_DATE_RANGE: 'invalid_date_range',
  INVALID_DAYS_OF_WEEK: 'invalid_days_of_week',
  INVALID_TIMEZONE: 'invalid_timezone',
  RULE_CONFLICT: 'rule_conflict',
  RESOURCE_NOT_FOUND: 'resource_not_found',
  COPY_WEEK_FAILED: 'copy_week_failed',
  DST_TRANSITION_ERROR: 'dst_transition_error'
};
```

---

## Testing

### Availability Rule Tests

```typescript
describe('Availability Rules', () => {
  it('should create recurring weekly rule', async () => {
    const rule = await createAvailabilityRule({
      resource_id: 'staff_123',
      resource_type: 'staff',
      rule_type: 'recurring_weekly',
      days_of_week: [1, 2, 3, 4, 5], // Monday to Friday
      start_time: '09:00',
      end_time: '17:00',
      timezone: 'America/New_York'
    });
    
    expect(rule.rule_type).toBe('recurring_weekly');
    expect(rule.days_of_week).toEqual([1, 2, 3, 4, 5]);
  });
  
  it('should handle DST transitions', async () => {
    const rules = await createDSTSafeRule(
      'staff_123',
      [1, 2, 3, 4, 5],
      '09:00',
      '17:00',
      'America/New_York'
    );
    
    // Should create multiple rules for DST periods
    expect(rules.length).toBeGreaterThan(1);
    
    // All rules should have valid date ranges
    rules.forEach(rule => {
      expect(new Date(rule.start_date)).toBeLessThanOrEqual(new Date(rule.end_date));
    });
  });
  
  it('should copy week successfully', async () => {
    const result = await copyWeek({
      resource_id: 'staff_123',
      source_week_start: '2025-01-20',
      target_week_start: '2025-01-27',
      copy_breaks: true,
      copy_exceptions: false,
      idempotency_key: 'copy_abc123'
    });
    
    expect(result.rules_copied).toBeGreaterThan(0);
    expect(result.rules_created.length).toBeGreaterThan(0);
  });
  
  it('should calculate availability slots', async () => {
    const slots = await calculateAvailability(
      'staff_123',
      '2025-01-27',
      '2025-01-31',
      60, // 60-minute service
      'America/New_York'
    );
    
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach(slot => {
      expect(slot.resource_id).toBe('staff_123');
      expect(slot.is_available).toBe(true);
    });
  });
});
```

---

## Completion Criteria

This document is **complete** when:
- ✅ Availability Rules DTO is fully defined
- ✅ All rule types are documented with examples
- ✅ DST handling is specified
- ✅ Copy week functionality is defined
- ✅ API endpoints are documented
- ✅ Validation rules are specified
- ✅ Error handling is covered
- ✅ Testing strategies are outlined

**Status**: ✅ COMPLETE - Availability Rules DTO finalized

---

**Event**: `availability_rules_dto_published` - Emitted when availability rules DTO is finalized
