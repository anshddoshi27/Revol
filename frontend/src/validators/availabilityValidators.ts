/**
 * Availability Validators - T07A Finalized DTO Wiring
 * 
 * Zod schemas and validation functions for availability rules.
 * Provides comprehensive validation for availability data structures.
 */

import { z } from 'zod';
import type { AvailabilityRule, RecurringPattern, TimeBlock } from '../api/types/availability';

// ===== ZOD SCHEMAS =====

/**
 * Time format validation (HH:MM)
 */
const timeFormatSchema = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  'Time must be in HH:MM format (24-hour)'
);

/**
 * Day of week validation (0-6, Sunday-Saturday)
 */
const dayOfWeekSchema = z.number().min(0).max(6);

/**
 * AvailabilityRule Zod schema - matches the finalized DTO specification
 */
export const availabilityRuleSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  staff_id: z.string().min(1, 'Staff ID is required'),
  day_of_week: dayOfWeekSchema,
  start_time: timeFormatSchema,
  end_time: timeFormatSchema,
  is_recurring: z.boolean(),
  break_start: timeFormatSchema.optional(),
  break_end: timeFormatSchema.optional(),
  is_active: z.boolean(),
  created_at: z.string().datetime('Invalid created_at format'),
  updated_at: z.string().datetime('Invalid updated_at format'),
}).refine(
  (data) => {
    // Validate that end_time is after start_time
    const startMinutes = timeToMinutes(data.start_time);
    const endMinutes = timeToMinutes(data.end_time);
    return endMinutes > startMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
).refine(
  (data) => {
    // Validate break times if provided
    if (data.break_start && data.break_end) {
      const breakStartMinutes = timeToMinutes(data.break_start);
      const breakEndMinutes = timeToMinutes(data.break_end);
      const startMinutes = timeToMinutes(data.start_time);
      const endMinutes = timeToMinutes(data.end_time);
      
      return breakStartMinutes >= startMinutes && 
             breakEndMinutes <= endMinutes && 
             breakEndMinutes > breakStartMinutes;
    }
    return true;
  },
  {
    message: 'Break time must be within availability hours and end after start',
    path: ['break_start', 'break_end'],
  }
);

/**
 * RecurringPattern Zod schema
 */
export const recurringPatternSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  staff_id: z.string().min(1, 'Staff ID is required'),
  day_of_week: dayOfWeekSchema,
  start_time: timeFormatSchema,
  end_time: timeFormatSchema,
  break_start: timeFormatSchema.optional(),
  break_end: timeFormatSchema.optional(),
  is_active: z.boolean(),
  pattern_type: z.enum(['weekly', 'biweekly', 'monthly']),
  end_date: z.string().datetime().optional(),
}).refine(
  (data) => {
    const startMinutes = timeToMinutes(data.start_time);
    const endMinutes = timeToMinutes(data.end_time);
    return endMinutes > startMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
);

/**
 * TimeBlock Zod schema
 */
export const timeBlockSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  staff_id: z.string().min(1, 'Staff ID is required'),
  day_of_week: dayOfWeekSchema,
  start_time: timeFormatSchema,
  end_time: timeFormatSchema,
  break_start: timeFormatSchema.optional(),
  break_end: timeFormatSchema.optional(),
  is_recurring: z.boolean(),
  is_active: z.boolean(),
  color: z.string().optional(),
  staff_name: z.string().optional(),
  staff_role: z.string().optional(),
}).refine(
  (data) => {
    const startMinutes = timeToMinutes(data.start_time);
    const endMinutes = timeToMinutes(data.end_time);
    return endMinutes > startMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
);

// ===== VALIDATION FUNCTIONS =====

/**
 * Convert time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
}

/**
 * Validate a single availability rule
 */
export function validateAvailabilityRule(rule: AvailabilityRule): {
  isValid: boolean;
  errors: string[];
} {
  try {
    availabilityRuleSchema.parse(rule);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate multiple availability rules and check for overlaps
 */
export function validateAvailabilityRules(rules: AvailabilityRule[]): {
  isValid: boolean;
  errors: string[];
  overlaps: Array<{
    rule1_id: string;
    rule2_id: string;
    day_of_week: number;
    overlap_start: string;
    overlap_end: string;
  }>;
} {
  const errors: string[] = [];
  const overlaps: Array<{
    rule1_id: string;
    rule2_id: string;
    day_of_week: number;
    overlap_start: string;
    overlap_end: string;
  }> = [];

  // Validate each rule individually
  for (const rule of rules) {
    const validation = validateAvailabilityRule(rule);
    if (!validation.isValid) {
      errors.push(...validation.errors.map(err => `Rule ${rule.id}: ${err}`));
    }
  }

  // Check for overlaps between rules
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const rule1 = rules[i];
      const rule2 = rules[j];

      // Only check overlaps for the same staff member and day
      if (rule1.staff_id === rule2.staff_id && rule1.day_of_week === rule2.day_of_week) {
        if (timeRangesOverlap(rule1.start_time, rule1.end_time, rule2.start_time, rule2.end_time)) {
          const overlapStart = minutesToTime(Math.max(
            timeToMinutes(rule1.start_time),
            timeToMinutes(rule2.start_time)
          ));
          const overlapEnd = minutesToTime(Math.min(
            timeToMinutes(rule1.end_time),
            timeToMinutes(rule2.end_time)
          ));

          overlaps.push({
            rule1_id: rule1.id,
            rule2_id: rule2.id,
            day_of_week: rule1.day_of_week,
            overlap_start: overlapStart,
            overlap_end: overlapEnd,
          });

          errors.push(
            `Overlap detected between rules ${rule1.id} and ${rule2.id} on day ${rule1.day_of_week} from ${overlapStart} to ${overlapEnd}`
          );
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    overlaps,
  };
}

/**
 * Validate a recurring pattern
 */
export function validateRecurringPattern(pattern: RecurringPattern): {
  isValid: boolean;
  errors: string[];
} {
  try {
    recurringPatternSchema.parse(pattern);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate a time block
 */
export function validateTimeBlock(timeBlock: TimeBlock): {
  isValid: boolean;
  errors: string[];
} {
  try {
    timeBlockSchema.parse(timeBlock);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
    };
  }
}

/**
 * Validate time format (HH:MM)
 */
export function isValidTimeFormat(time: string): boolean {
  return timeFormatSchema.safeParse(time).success;
}

/**
 * Validate time range (start < end)
 */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    return false;
  }
  return timeToMinutes(startTime) < timeToMinutes(endTime);
}

/**
 * Validate day of week (0-6)
 */
export function isValidDayOfWeek(day: number): boolean {
  return dayOfWeekSchema.safeParse(day).success;
}

/**
 * Calculate duration between two times in minutes
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return endMinutes - startMinutes;
}

/**
 * Generate time slots between start and end time
 */
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 15
): string[] {
  const slots: string[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
}

/**
 * Check if a time falls within a time range
 */
export function isTimeInRange(time: string, startTime: string, endTime: string): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

/**
 * Get the overlap between two time ranges
 */
export function getTimeRangeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): { start: string; end: string } | null {
  if (!timeRangesOverlap(start1, end1, start2, end2)) {
    return null;
  }

  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  const overlapStart = Math.max(start1Minutes, start2Minutes);
  const overlapEnd = Math.min(end1Minutes, end2Minutes);

  return {
    start: minutesToTime(overlapStart),
    end: minutesToTime(overlapEnd),
  };
}

// ===== EXPORT TYPES =====

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;
export type RecurringPatternInput = z.infer<typeof recurringPatternSchema>;
export type TimeBlockInput = z.infer<typeof timeBlockSchema>;
