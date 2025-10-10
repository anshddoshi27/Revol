/**
 * Availability Validators Tests - T07A Finalized DTO Wiring
 * 
 * Comprehensive test suite for availability validation functions.
 * Tests all validation scenarios including edge cases and error conditions.
 */

import {
  availabilityRuleSchema,
  recurringPatternSchema,
  timeBlockSchema,
  validateAvailabilityRule,
  validateAvailabilityRules,
  validateRecurringPattern,
  validateTimeBlock,
  isValidTimeFormat,
  isValidTimeRange,
  isValidDayOfWeek,
  calculateDuration,
  generateTimeSlots,
  isTimeInRange,
  getTimeRangeOverlap,
} from '../availabilityValidators';
import type { AvailabilityRule, RecurringPattern, TimeBlock } from '../../api/types/availability';

// ===== TEST DATA =====

const validAvailabilityRule: AvailabilityRule = {
  id: 'rule-1',
  tenant_id: 'tenant-1',
  staff_id: 'staff-1',
  day_of_week: 1, // Monday
  start_time: '09:00',
  end_time: '17:00',
  is_recurring: true,
  break_start: '12:00',
  break_end: '13:00',
  is_active: true,
  created_at: '2025-01-27T10:00:00Z',
  updated_at: '2025-01-27T10:00:00Z',
};

const validRecurringPattern: RecurringPattern = {
  id: 'pattern-1',
  staff_id: 'staff-1',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
  break_start: '12:00',
  break_end: '13:00',
  is_active: true,
  pattern_type: 'weekly',
  end_date: '2025-12-31T23:59:59Z',
};

const validTimeBlock: TimeBlock = {
  id: 'block-1',
  staff_id: 'staff-1',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
  break_start: '12:00',
  break_end: '13:00',
  is_recurring: true,
  is_active: true,
  color: '#3B82F6',
  staff_name: 'John Doe',
  staff_role: 'Stylist',
};

// ===== AVAILABILITY RULE TESTS =====

describe('availabilityRuleSchema', () => {
  it('should validate a correct availability rule', () => {
    const result = availabilityRuleSchema.safeParse(validAvailabilityRule);
    expect(result.success).toBe(true);
  });

  it('should reject rule with invalid time format', () => {
    const invalidRule = {
      ...validAvailabilityRule,
      start_time: '25:00', // Invalid hour
    };
    const result = availabilityRuleSchema.safeParse(invalidRule);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Time must be in HH:MM format');
    }
  });

  it('should reject rule with end time before start time', () => {
    const invalidRule = {
      ...validAvailabilityRule,
      start_time: '17:00',
      end_time: '09:00',
    };
    const result = availabilityRuleSchema.safeParse(invalidRule);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('End time must be after start time');
    }
  });

  it('should reject rule with invalid day of week', () => {
    const invalidRule = {
      ...validAvailabilityRule,
      day_of_week: 7, // Invalid day
    };
    const result = availabilityRuleSchema.safeParse(invalidRule);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('must be less than or equal to 6');
    }
  });

  it('should reject rule with break time outside availability hours', () => {
    const invalidRule = {
      ...validAvailabilityRule,
      break_start: '08:00', // Before start time
      break_end: '18:00',   // After end time
    };
    const result = availabilityRuleSchema.safeParse(invalidRule);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Break time must be within availability hours');
    }
  });

  it('should reject rule with break end before break start', () => {
    const invalidRule = {
      ...validAvailabilityRule,
      break_start: '13:00',
      break_end: '12:00',
    };
    const result = availabilityRuleSchema.safeParse(invalidRule);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Break time must be within availability hours');
    }
  });

  it('should accept rule without break times', () => {
    const ruleWithoutBreak = {
      ...validAvailabilityRule,
      break_start: undefined,
      break_end: undefined,
    };
    const result = availabilityRuleSchema.safeParse(ruleWithoutBreak);
    expect(result.success).toBe(true);
  });
});

// ===== RECURRING PATTERN TESTS =====

describe('recurringPatternSchema', () => {
  it('should validate a correct recurring pattern', () => {
    const result = recurringPatternSchema.safeParse(validRecurringPattern);
    expect(result.success).toBe(true);
  });

  it('should reject pattern with invalid pattern type', () => {
    const invalidPattern = {
      ...validRecurringPattern,
      pattern_type: 'invalid' as any,
    };
    const result = recurringPatternSchema.safeParse(invalidPattern);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('Invalid enum value');
    }
  });

  it('should accept pattern without end date', () => {
    const patternWithoutEndDate = {
      ...validRecurringPattern,
      end_date: undefined,
    };
    const result = recurringPatternSchema.safeParse(patternWithoutEndDate);
    expect(result.success).toBe(true);
  });
});

// ===== TIME BLOCK TESTS =====

describe('timeBlockSchema', () => {
  it('should validate a correct time block', () => {
    const result = timeBlockSchema.safeParse(validTimeBlock);
    expect(result.success).toBe(true);
  });

  it('should accept time block without optional fields', () => {
    const minimalTimeBlock = {
      id: 'block-1',
      staff_id: 'staff-1',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      is_recurring: true,
      is_active: true,
    };
    const result = timeBlockSchema.safeParse(minimalTimeBlock);
    expect(result.success).toBe(true);
  });
});

// ===== VALIDATION FUNCTION TESTS =====

describe('validateAvailabilityRule', () => {
  it('should return valid for correct rule', () => {
    const result = validateAvailabilityRule(validAvailabilityRule);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return invalid with errors for incorrect rule', () => {
    const invalidRule = {
      ...validAvailabilityRule,
      start_time: 'invalid',
    };
    const result = validateAvailabilityRule(invalidRule);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('validateAvailabilityRules', () => {
  it('should return valid for non-overlapping rules', () => {
    const rules = [
      validAvailabilityRule,
      {
        ...validAvailabilityRule,
        id: 'rule-2',
        start_time: '18:00',
        end_time: '22:00',
      },
    ];
    const result = validateAvailabilityRules(rules);
    expect(result.isValid).toBe(true);
    expect(result.overlaps).toHaveLength(0);
  });

  it('should detect overlaps between rules', () => {
    const overlappingRules = [
      validAvailabilityRule,
      {
        ...validAvailabilityRule,
        id: 'rule-2',
        start_time: '10:00',
        end_time: '14:00',
      },
    ];
    const result = validateAvailabilityRules(overlappingRules);
    expect(result.isValid).toBe(false);
    expect(result.overlaps.length).toBeGreaterThan(0);
    expect(result.overlaps[0].rule1_id).toBe('rule-1');
    expect(result.overlaps[0].rule2_id).toBe('rule-2');
  });

  it('should not detect overlaps for different staff members', () => {
    const rules = [
      validAvailabilityRule,
      {
        ...validAvailabilityRule,
        id: 'rule-2',
        staff_id: 'staff-2',
        start_time: '10:00',
        end_time: '14:00',
      },
    ];
    const result = validateAvailabilityRules(rules);
    expect(result.isValid).toBe(true);
    expect(result.overlaps).toHaveLength(0);
  });

  it('should not detect overlaps for different days', () => {
    const rules = [
      validAvailabilityRule,
      {
        ...validAvailabilityRule,
        id: 'rule-2',
        day_of_week: 2, // Tuesday
        start_time: '10:00',
        end_time: '14:00',
      },
    ];
    const result = validateAvailabilityRules(rules);
    expect(result.isValid).toBe(true);
    expect(result.overlaps).toHaveLength(0);
  });
});

describe('validateRecurringPattern', () => {
  it('should return valid for correct pattern', () => {
    const result = validateRecurringPattern(validRecurringPattern);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return invalid with errors for incorrect pattern', () => {
    const invalidPattern = {
      ...validRecurringPattern,
      start_time: 'invalid',
    };
    const result = validateRecurringPattern(invalidPattern);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('validateTimeBlock', () => {
  it('should return valid for correct time block', () => {
    const result = validateTimeBlock(validTimeBlock);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return invalid with errors for incorrect time block', () => {
    const invalidTimeBlock = {
      ...validTimeBlock,
      start_time: 'invalid',
    };
    const result = validateTimeBlock(invalidTimeBlock);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe('isValidTimeFormat', () => {
  it('should return true for valid time formats', () => {
    expect(isValidTimeFormat('09:00')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
    expect(isValidTimeFormat('00:00')).toBe(true);
    expect(isValidTimeFormat('12:30')).toBe(true);
  });

  it('should return false for invalid time formats', () => {
    expect(isValidTimeFormat('25:00')).toBe(false);
    expect(isValidTimeFormat('12:60')).toBe(false);
    expect(isValidTimeFormat('9:00')).toBe(false);
    expect(isValidTimeFormat('12:5')).toBe(false);
    expect(isValidTimeFormat('invalid')).toBe(false);
  });
});

describe('isValidTimeRange', () => {
  it('should return true for valid time ranges', () => {
    expect(isValidTimeRange('09:00', '17:00')).toBe(true);
    expect(isValidTimeRange('00:00', '23:59')).toBe(true);
  });

  it('should return false for invalid time ranges', () => {
    expect(isValidTimeRange('17:00', '09:00')).toBe(false);
    expect(isValidTimeRange('12:00', '12:00')).toBe(false);
    expect(isValidTimeRange('invalid', '17:00')).toBe(false);
    expect(isValidTimeRange('09:00', 'invalid')).toBe(false);
  });
});

describe('isValidDayOfWeek', () => {
  it('should return true for valid days', () => {
    expect(isValidDayOfWeek(0)).toBe(true);
    expect(isValidDayOfWeek(6)).toBe(true);
    expect(isValidDayOfWeek(3)).toBe(true);
  });

  it('should return false for invalid days', () => {
    expect(isValidDayOfWeek(-1)).toBe(false);
    expect(isValidDayOfWeek(7)).toBe(false);
    expect(isValidDayOfWeek(10)).toBe(false);
  });
});

describe('calculateDuration', () => {
  it('should calculate duration correctly', () => {
    expect(calculateDuration('09:00', '17:00')).toBe(480); // 8 hours
    expect(calculateDuration('12:00', '13:00')).toBe(60);  // 1 hour
    expect(calculateDuration('09:30', '10:15')).toBe(45);  // 45 minutes
  });
});

describe('generateTimeSlots', () => {
  it('should generate time slots with default interval', () => {
    const slots = generateTimeSlots('09:00', '10:00');
    expect(slots).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });

  it('should generate time slots with custom interval', () => {
    const slots = generateTimeSlots('09:00', '10:00', 30);
    expect(slots).toEqual(['09:00', '09:30']);
  });

  it('should generate empty array for invalid range', () => {
    const slots = generateTimeSlots('10:00', '09:00');
    expect(slots).toEqual([]);
  });
});

describe('isTimeInRange', () => {
  it('should return true for time within range', () => {
    expect(isTimeInRange('12:00', '09:00', '17:00')).toBe(true);
    expect(isTimeInRange('09:00', '09:00', '17:00')).toBe(true);
  });

  it('should return false for time outside range', () => {
    expect(isTimeInRange('08:00', '09:00', '17:00')).toBe(false);
    expect(isTimeInRange('18:00', '09:00', '17:00')).toBe(false);
    expect(isTimeInRange('17:00', '09:00', '17:00')).toBe(false);
  });
});

describe('getTimeRangeOverlap', () => {
  it('should return overlap for overlapping ranges', () => {
    const overlap = getTimeRangeOverlap('09:00', '17:00', '10:00', '14:00');
    expect(overlap).toEqual({ start: '10:00', end: '14:00' });
  });

  it('should return null for non-overlapping ranges', () => {
    const overlap = getTimeRangeOverlap('09:00', '12:00', '13:00', '17:00');
    expect(overlap).toBeNull();
  });

  it('should return partial overlap', () => {
    const overlap = getTimeRangeOverlap('09:00', '15:00', '12:00', '18:00');
    expect(overlap).toEqual({ start: '12:00', end: '15:00' });
  });
});

// ===== EDGE CASE TESTS =====

describe('Edge Cases', () => {
  it('should handle midnight crossover', () => {
    const result = isValidTimeRange('23:30', '00:30');
    expect(result).toBe(false); // This is actually invalid in our current implementation
  });

  it('should handle same start and end times', () => {
    const result = isValidTimeRange('12:00', '12:00');
    expect(result).toBe(false);
  });

  it('should handle very short durations', () => {
    const result = calculateDuration('12:00', '12:01');
    expect(result).toBe(1);
  });

  it('should handle break times at exact boundaries', () => {
    const rule = {
      ...validAvailabilityRule,
      break_start: '09:00',
      break_end: '17:00',
    };
    const result = availabilityRuleSchema.safeParse(rule);
    expect(result.success).toBe(true);
  });
});
