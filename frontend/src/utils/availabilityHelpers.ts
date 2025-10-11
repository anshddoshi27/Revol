/**
 * Availability Helper Utilities
 * 
 * Utility functions for availability calendar management, validation, and display.
 * Provides helper functions for time calculations, overlap detection, and calendar operations.
 */

import type {
  TimeBlock,
  AvailabilityRule,
  StaffAvailability,
  CalendarDay,
  CalendarWeek,
  CalendarView,
  TimeSlot,
  DayTimeSlots,
  StaffTimeSlots,
  AvailabilityValidationResult,
  CreateAvailabilityRuleRequest,
} from '../api/types/availability';
import type { StaffMember } from '../api/types/onboarding';

// ===== TIME UTILITIES =====

/**
 * Convert time string to minutes since midnight
 */
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Format time for display (12h or 24h format)
 */
export const formatTime = (time: string, format: '12h' | '24h' = '12h'): string => {
  const [hours, minutes] = time.split(':').map(Number);
  
  if (format === '24h') {
    return time;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Calculate duration between two times in minutes
 */
export const calculateDuration = (startTime: string, endTime: string): number => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return endMinutes - startMinutes;
};

/**
 * Generate time slots between start and end time
 */
export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  intervalMinutes: number = 15
): string[] => {
  const slots: string[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    slots.push(minutesToTime(minutes));
  }

  return slots;
};

// ===== VALIDATION UTILITIES =====

/**
 * Check if two time ranges overlap
 */
export const timeRangesOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
};

/**
 * Validate time format (HH:MM)
 */
export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

/**
 * Validate time range (start < end)
 */
export const isValidTimeRange = (startTime: string, endTime: string): boolean => {
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    return false;
  }

  return timeToMinutes(startTime) < timeToMinutes(endTime);
};

/**
 * Validate time block duration (minimum 30 minutes)
 */
export const isValidTimeBlockDuration = (startTime: string, endTime: string): boolean => {
  const duration = calculateDuration(startTime, endTime);
  return duration >= 30; // Minimum 30 minutes
};

/**
 * Check for overlaps in time blocks for the same staff member
 */
export const detectTimeBlockOverlaps = (timeBlocks: TimeBlock[]): Array<{
  block1: TimeBlock;
  block2: TimeBlock;
  overlapStart: string;
  overlapEnd: string;
}> => {
  const overlaps: Array<{
    block1: TimeBlock;
    block2: TimeBlock;
    overlapStart: string;
    overlapEnd: string;
  }> = [];

  for (let i = 0; i < timeBlocks.length; i++) {
    for (let j = i + 1; j < timeBlocks.length; j++) {
      const block1 = timeBlocks[i];
      const block2 = timeBlocks[j];

      // Only check overlaps for the same staff member and day
      if (block1.staff_id !== block2.staff_id || block1.day_of_week !== block2.day_of_week) {
        continue;
      }

      if (timeRangesOverlap(block1.start_time, block1.end_time, block2.start_time, block2.end_time)) {
        // Calculate overlap range
        const overlapStart = minutesToTime(Math.max(
          timeToMinutes(block1.start_time),
          timeToMinutes(block2.start_time)
        ));
        const overlapEnd = minutesToTime(Math.min(
          timeToMinutes(block1.end_time),
          timeToMinutes(block2.end_time)
        ));

        overlaps.push({
          block1,
          block2,
          overlapStart,
          overlapEnd,
        });
      }
    }
  }

  return overlaps;
};

// ===== CALENDAR UTILITIES =====

/**
 * Get day name from day of week number
 */
export const getDayName = (dayOfWeek: number, short: boolean = false): string => {
  const days = short 
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return days[dayOfWeek] || 'Unknown';
};

/**
 * Get week start date for a given date
 */
export const getWeekStartDate = (date: Date, weekStartDay: number = 1): Date => {
  const day = date.getDay();
  const diff = day - weekStartDay;
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

/**
 * Get week end date for a given date
 */
export const getWeekEndDate = (date: Date, weekStartDay: number = 1): Date => {
  const weekStart = getWeekStartDate(date, weekStartDay);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

/**
 * Generate calendar weeks for a given month
 */
export const generateCalendarWeeks = (
  year: number,
  month: number,
  weekStartDay: number = 1
): CalendarWeek[] => {
  const weeks: CalendarWeek[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  const startDate = getWeekStartDate(firstDay, weekStartDay);
  const endDate = getWeekEndDate(lastDay, weekStartDay);

  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 6);
    
    const days: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(currentDate);
      dayDate.setDate(currentDate.getDate() + i);
      
      days.push({
        date: dayDate,
        day_of_week: dayDate.getDay(),
        is_today: isToday(dayDate),
        is_past: isPast(dayDate),
        time_blocks: [],
      });
    }
    
    weeks.push({
      start_date: new Date(currentDate),
      end_date: weekEnd,
      days,
    });
    
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
};

/**
 * Check if a date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

/**
 * Check if a date is in the past
 */
export const isPast = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// ===== STAFF UTILITIES =====

/**
 * Convert staff members to staff availability format
 */
export const convertStaffToAvailability = (
  staffMembers: StaffMember[],
  timeBlocks: TimeBlock[] = []
): StaffAvailability[] => {
  return staffMembers.map(staff => {
    const staffTimeBlocks = timeBlocks.filter(block => block.staff_id === staff.id);
    const totalHours = staffTimeBlocks.reduce((total, block) => {
      return total + calculateDuration(block.start_time, block.end_time) / 60;
    }, 0);

    return {
      staff_id: staff.id || '',
      staff_name: staff.name,
      staff_role: staff.role,
      color: staff.color,
      time_blocks: staffTimeBlocks,
      total_hours_per_week: totalHours,
    };
  });
};

/**
 * Get staff member by ID
 */
export const getStaffById = (staffMembers: StaffMember[], staffId: string): StaffMember | undefined => {
  return staffMembers.find(staff => staff.id === staffId);
};

/**
 * Get staff color by ID
 */
export const getStaffColor = (staffMembers: StaffMember[], staffId: string): string => {
  const staff = getStaffById(staffMembers, staffId);
  return staff?.color || '#6B7280'; // Default gray color
};

// ===== TIME BLOCK UTILITIES =====

/**
 * Create a new time block
 */
export const createTimeBlock = (
  staffId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  options: {
    breakStart?: string;
    breakEnd?: string;
    isRecurring?: boolean;
    staffName?: string;
    staffRole?: string;
    color?: string;
  } = {}
): TimeBlock => {
  return {
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    staff_id: staffId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    break_start: options.breakStart,
    break_end: options.breakEnd,
    is_recurring: options.isRecurring ?? true,
    is_active: true,
    color: options.color,
    staff_name: options.staffName,
    staff_role: options.staffRole,
  };
};

/**
 * Convert time block to availability rule
 */
export const timeBlockToAvailabilityRule = (timeBlock: TimeBlock): CreateAvailabilityRuleRequest => {
  return {
    staff_id: timeBlock.staff_id,
    day_of_week: timeBlock.day_of_week,
    start_time: timeBlock.start_time,
    end_time: timeBlock.end_time,
    is_recurring: timeBlock.is_recurring,
    break_start: timeBlock.break_start,
    break_end: timeBlock.break_end,
    is_active: timeBlock.is_active,
  };
};

/**
 * Convert availability rule to time block
 */
export const availabilityRuleToTimeBlock = (
  rule: AvailabilityRule,
  staffName?: string,
  staffRole?: string,
  color?: string
): TimeBlock => {
  return {
    id: rule.id || `temp-${Date.now()}`,
    staff_id: rule.staff_id,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    break_start: rule.break_start,
    break_end: rule.break_end,
    is_recurring: rule.is_recurring,
    is_active: rule.is_active,
    color,
    staff_name: staffName,
    staff_role: staffRole,
  };
};

// ===== COPY WEEK UTILITIES =====

/**
 * Copy time blocks from one week to another
 */
export const copyTimeBlocksToWeek = (
  sourceBlocks: TimeBlock[],
  targetWeekStart: Date,
  weekStartDay: number = 1
): TimeBlock[] => {
  const targetWeekStartDay = targetWeekStart.getDay();
  const dayOffset = targetWeekStartDay - weekStartDay;
  
  return sourceBlocks.map(block => {
    const targetDate = new Date(targetWeekStart);
    targetDate.setDate(targetWeekStart.getDate() + block.day_of_week - dayOffset);
    
    return {
      ...block,
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  });
};

// ===== DISPLAY UTILITIES =====

/**
 * Generate time slots for display
 */
export const generateDisplayTimeSlots = (
  startTime: string = '06:00',
  endTime: string = '22:00',
  intervalMinutes: number = 30
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    const time = minutesToTime(minutes);
    slots.push({
      start_time: time,
      end_time: minutesToTime(minutes + intervalMinutes),
      is_available: false,
      is_break: false,
    });
  }

  return slots;
};

/**
 * Calculate total hours for a staff member
 */
export const calculateStaffTotalHours = (timeBlocks: TimeBlock[]): number => {
  return timeBlocks.reduce((total, block) => {
    const duration = calculateDuration(block.start_time, block.end_time);
    const breakDuration = block.break_start && block.break_end 
      ? calculateDuration(block.break_start, block.break_end)
      : 0;
    
    return total + (duration - breakDuration) / 60; // Convert to hours
  }, 0);
};

/**
 * Get time blocks for a specific day
 */
export const getTimeBlocksForDay = (timeBlocks: TimeBlock[], dayOfWeek: number): TimeBlock[] => {
  return timeBlocks.filter(block => block.day_of_week === dayOfWeek);
};

/**
 * Sort time blocks by start time
 */
export const sortTimeBlocksByStartTime = (timeBlocks: TimeBlock[]): TimeBlock[] => {
  return [...timeBlocks].sort((a, b) => {
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
};
