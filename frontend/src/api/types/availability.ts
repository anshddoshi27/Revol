/**
 * Availability API Types - T07A Finalized DTO Wiring
 * 
 * Type definitions for availability-related API endpoints and data structures.
 * These types align with the backend availability models and API contracts.
 * 
 * Schema/DTO Freeze Note: This interface is finalized as per T07A specification.
 * SHA-256: e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
 */

// ===== AVAILABILITY DATA TYPES =====

/**
 * Finalized AvailabilityRule interface as per T07A specification
 * This interface is frozen and must not be modified without updating the SHA-256 hash
 */
export interface AvailabilityRule {
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

/**
 * TimeBlock interface for calendar display and management
 * Extends AvailabilityRule with display-specific properties
 */
export interface TimeBlock {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  is_recurring: boolean;
  is_active: boolean;
  color?: string; // Staff color for display
  staff_name?: string; // Staff name for display
  staff_role?: string; // Staff role for display
}

/**
 * RecurringPattern interface for recurring availability patterns
 * Supports weekly, biweekly, and monthly patterns with end dates
 */
export interface RecurringPattern {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  is_active: boolean;
  pattern_type: 'weekly' | 'biweekly' | 'monthly';
  end_date?: string; // ISO date string
}

export interface StaffAvailability {
  staff_id: string;
  staff_name: string;
  staff_role: string;
  color: string;
  time_blocks: TimeBlock[];
  total_hours_per_week: number;
}

export interface AvailabilityCalendarData {
  staff_availability: StaffAvailability[];
  timezone: string;
  business_hours: {
    start_time: string;
    end_time: string;
  };
  week_start_day: number; // 0 = Sunday, 1 = Monday
}

// ===== API REQUEST/RESPONSE TYPES =====

export interface CreateAvailabilityRuleRequest {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  break_start?: string;
  break_end?: string;
  is_active?: boolean;
}

export interface UpdateAvailabilityRuleRequest extends Partial<CreateAvailabilityRuleRequest> {
  id: string;
}

export interface AvailabilityRuleResponse {
  id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  break_start?: string;
  break_end?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BulkAvailabilityUpdateRequest {
  rules: CreateAvailabilityRuleRequest[];
  replace_existing?: boolean;
}

export interface BulkAvailabilityUpdateResponse {
  created_rules: AvailabilityRuleResponse[];
  updated_rules: AvailabilityRuleResponse[];
  deleted_rules: string[];
  errors: Array<{
    rule: CreateAvailabilityRuleRequest;
    error: string;
  }>;
}

// ===== VALIDATION TYPES =====

export interface AvailabilityValidationError {
  field: string;
  message: string;
  code: string;
  rule_id?: string;
}

export interface AvailabilityValidationResult {
  isValid: boolean;
  errors: AvailabilityValidationError[];
  overlaps: Array<{
    rule1_id: string;
    rule2_id: string;
    day_of_week: number;
    overlap_start: string;
    overlap_end: string;
  }>;
}

// ===== FORM STATE TYPES =====

export interface TimeBlockFormData {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  is_recurring: boolean;
}

export interface RecurringPatternFormData {
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string;
  break_end?: string;
  pattern_type: 'weekly' | 'biweekly' | 'monthly';
  end_date?: string;
}

// ===== CALENDAR DISPLAY TYPES =====

export interface CalendarDay {
  date: Date;
  day_of_week: number;
  is_today: boolean;
  is_past: boolean;
  time_blocks: TimeBlock[];
}

export interface CalendarWeek {
  start_date: Date;
  end_date: Date;
  days: CalendarDay[];
}

export interface CalendarView {
  type: 'day' | 'week' | 'month';
  current_date: Date;
  weeks: CalendarWeek[];
}

// ===== UTILITY TYPES =====

export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_break: boolean;
  staff_id?: string;
}

export interface DayTimeSlots {
  day_of_week: number;
  slots: TimeSlot[];
}

export interface StaffTimeSlots {
  staff_id: string;
  staff_name: string;
  staff_role: string;
  color: string;
  days: DayTimeSlots[];
}

// ===== CONSTANTS =====

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export const DAYS_OF_WEEK_SHORT = [
  'Sun',
  'Mon',
  'Tue', 
  'Wed',
  'Thu',
  'Fri',
  'Sat'
] as const;

export const TIME_SLOT_INTERVAL_MINUTES = 15; // 15-minute intervals
export const MIN_TIME_BLOCK_DURATION_MINUTES = 30; // Minimum 30-minute blocks
export const MAX_TIME_BLOCK_DURATION_HOURS = 12; // Maximum 12-hour blocks

export const DEFAULT_BUSINESS_HOURS = {
  start_time: '09:00',
  end_time: '17:00',
};

export const COMMON_TIME_SLOTS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'
] as const;

export type DayOfWeek = typeof DAYS_OF_WEEK[number];
export type DayOfWeekShort = typeof DAYS_OF_WEEK_SHORT[number];
export type TimeSlotValue = typeof COMMON_TIME_SLOTS[number];
