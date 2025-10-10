/**
 * useAvailabilityCalendar Hook
 * 
 * Custom hook for managing availability calendar state and operations.
 * Provides calendar view management, time block operations, and validation.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { availabilityService } from '../api/services/availability';
import { onboardingStep4Observability } from '../observability/step4-availability';
import type {
  TimeBlock,
  AvailabilityRule,
  StaffAvailability,
  CalendarView,
  CalendarWeek,
  AvailabilityValidationResult,
  CreateAvailabilityRuleRequest,
} from '../api/types/availability';
import type { StaffMember } from '../api/types/onboarding';
import {
  generateCalendarWeeks,
  convertStaffToAvailability,
  detectTimeBlockOverlaps,
  timeBlockToAvailabilityRule,
  availabilityRuleToTimeBlock,
  copyTimeBlocksToWeek,
  getWeekStartDate,
  getWeekEndDate,
  calculateStaffTotalHours,
  sortTimeBlocksByStartTime,
} from '../utils/availabilityHelpers';

interface UseAvailabilityCalendarOptions {
  staffMembers: StaffMember[];
  initialTimeBlocks?: TimeBlock[];
  onError?: (error: Error) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

interface UseAvailabilityCalendarReturn {
  // Calendar state
  calendarView: CalendarView;
  currentDate: Date;
  timeBlocks: TimeBlock[];
  staffAvailability: StaffAvailability[];
  
  // Calendar operations
  setCurrentDate: (date: Date) => void;
  setCalendarView: (view: 'day' | 'week' | 'month') => void;
  navigateCalendar: (direction: 'prev' | 'next') => void;
  
  // Time block operations
  addTimeBlock: (timeBlock: Omit<TimeBlock, 'id'>) => Promise<void>;
  updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => Promise<void>;
  deleteTimeBlock: (id: string) => Promise<void>;
  duplicateTimeBlock: (id: string, targetDay?: number) => Promise<void>;
  
  // Bulk operations
  copyWeek: (sourceWeekStart: Date, targetWeekStart: Date) => Promise<void>;
  clearAllTimeBlocks: () => Promise<void>;
  
  // Validation
  validationResult: AvailabilityValidationResult | null;
  validateTimeBlocks: () => Promise<boolean>;
  
  // Loading and error states
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Utility functions
  getTimeBlocksForStaff: (staffId: string) => TimeBlock[];
  getTimeBlocksForDay: (dayOfWeek: number) => TimeBlock[];
  getTotalHoursForStaff: (staffId: string) => number;
  getTotalHoursForAllStaff: () => number;
}

export const useAvailabilityCalendar = ({
  staffMembers,
  initialTimeBlocks = [],
  onError,
  onValidationChange,
}: UseAvailabilityCalendarOptions): UseAvailabilityCalendarReturn => {
  // State
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>(initialTimeBlocks);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView['type']>('week');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<AvailabilityValidationResult | null>(null);

  // Memoized staff availability
  const staffAvailability = useMemo(() => {
    return convertStaffToAvailability(staffMembers, timeBlocks);
  }, [staffMembers, timeBlocks]);

  // Memoized calendar weeks
  const calendarWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return generateCalendarWeeks(year, month, 1); // Week starts on Monday
  }, [currentDate]);

  // Memoized calendar view
  const calendarViewData: CalendarView = useMemo(() => ({
    type: calendarView,
    current_date: currentDate,
    weeks: calendarWeeks,
  }), [calendarView, currentDate, calendarWeeks]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (initialTimeBlocks.length === 0) {
        try {
          setIsLoading(true);
          const rules = await availabilityService.getRules();
          const blocks = rules.map(rule => {
            const staff = staffMembers.find(s => s.id === rule.staff_id);
            return availabilityRuleToTimeBlock(
              rule,
              staff?.name,
              staff?.role,
              staff?.color
            );
          });
          setTimeBlocks(blocks);
        } catch (err) {
          const error = err as Error;
          setError(error.message);
          onError?.(error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadInitialData();
  }, [initialTimeBlocks, staffMembers, onError]);

  // Validate time blocks whenever they change
  useEffect(() => {
    const validateBlocks = async () => {
      if (timeBlocks.length === 0) {
        setValidationResult(null);
        onValidationChange?.(true, []);
        return;
      }

      try {
        const rules = timeBlocks.map(timeBlockToAvailabilityRule);
        const result = await availabilityService.validateRules(rules);
        setValidationResult(result);
        onValidationChange?.(result.isValid, result.errors.map(e => e.message));
      } catch (err) {
        // If validation fails, check for local overlaps
        const overlaps = detectTimeBlockOverlaps(timeBlocks);
        const hasOverlaps = overlaps.length > 0;
        const errorMessages = overlaps.map(overlap => 
          `Overlap detected for ${overlap.block1.staff_name} on ${overlap.overlapStart}-${overlap.overlapEnd}`
        );
        
        setValidationResult({
          isValid: !hasOverlaps,
          errors: errorMessages.map(message => ({
            field: 'time_blocks',
            message,
            code: 'OVERLAP_DETECTED',
          })),
          overlaps: overlaps.map(overlap => ({
            rule1_id: overlap.block1.id,
            rule2_id: overlap.block2.id,
            day_of_week: overlap.block1.day_of_week,
            overlap_start: overlap.overlapStart,
            overlap_end: overlap.overlapEnd,
          })),
        });
        
        onValidationChange?.(!hasOverlaps, errorMessages);
      }
    };

    validateBlocks();
  }, [timeBlocks, onValidationChange]);

  // Calendar navigation
  const navigateCalendar = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (calendarView) {
      case 'day':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  }, [currentDate, calendarView]);

  // Time block operations
  const addTimeBlock = useCallback(async (timeBlockData: Omit<TimeBlock, 'id'>) => {
    try {
      setIsSaving(true);
      setError(null);

      const newTimeBlock: TimeBlock = {
        ...timeBlockData,
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      // Add to local state immediately for optimistic UI
      setTimeBlocks(prev => [...prev, newTimeBlock]);

      // Track analytics
      onboardingStep4Observability.trackTimeBlockCreated({
        time_block_id: newTimeBlock.id,
        staff_id: newTimeBlock.staff_id,
        staff_name: newTimeBlock.staff_name,
        day_of_week: newTimeBlock.day_of_week,
        start_time: newTimeBlock.start_time,
        end_time: newTimeBlock.end_time,
        has_break: !!(newTimeBlock.break_start && newTimeBlock.break_end),
        is_recurring: newTimeBlock.is_recurring,
      });

      // Save to backend
      const rule = timeBlockToAvailabilityRule(newTimeBlock);
      await availabilityService.createRule(rule);

    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      
      // Remove from local state on error
      setTimeBlocks(prev => prev.filter(block => block.id !== timeBlockData.id));
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  const updateTimeBlock = useCallback(async (id: string, updates: Partial<TimeBlock>) => {
    try {
      setIsSaving(true);
      setError(null);

      // Update local state immediately
      setTimeBlocks(prev => prev.map(block => 
        block.id === id ? { ...block, ...updates } : block
      ));

      // Track analytics
      onboardingStep4Observability.trackTimeBlockUpdated({
        time_block_id: id,
        staff_id: updates.staff_id,
        day_of_week: updates.day_of_week,
        start_time: updates.start_time,
        end_time: updates.end_time,
      });

      // Save to backend
      const rule = timeBlockToAvailabilityRule({ ...updates, id } as TimeBlock);
      await availabilityService.updateRule(id, rule);

    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  const deleteTimeBlock = useCallback(async (id: string) => {
    try {
      setIsSaving(true);
      setError(null);

      const timeBlock = timeBlocks.find(block => block.id === id);
      if (!timeBlock) return;

      // Remove from local state immediately
      setTimeBlocks(prev => prev.filter(block => block.id !== id));

      // Track analytics
      onboardingStep4Observability.trackTimeBlockDeleted({
        time_block_id: id,
        staff_id: timeBlock.staff_id,
      });

      // Delete from backend
      await availabilityService.deleteRule(id);

    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [timeBlocks, onError]);

  const duplicateTimeBlock = useCallback(async (id: string, targetDay?: number) => {
    const sourceBlock = timeBlocks.find(block => block.id === id);
    if (!sourceBlock) return;

    const newBlock: Omit<TimeBlock, 'id'> = {
      ...sourceBlock,
      day_of_week: targetDay ?? sourceBlock.day_of_week,
    };

    await addTimeBlock(newBlock);
  }, [timeBlocks, addTimeBlock]);

  // Bulk operations
  const copyWeek = useCallback(async (sourceWeekStart: Date, targetWeekStart: Date) => {
    try {
      setIsSaving(true);
      setError(null);

      const sourceWeekEnd = getWeekEndDate(sourceWeekStart);
      const sourceBlocks = timeBlocks.filter(block => {
        // Filter blocks that fall within the source week
        // This is a simplified implementation - in reality, you'd need to check actual dates
        return true; // For now, copy all blocks
      });

      const copiedBlocks = copyTimeBlocksToWeek(sourceBlocks, targetWeekStart);
      
      // Add copied blocks to local state
      setTimeBlocks(prev => [...prev, ...copiedBlocks]);

      // Track analytics
      onboardingStep4Observability.trackCopyWeek({
        source_week_start: sourceWeekStart.toISOString(),
        target_week_start: targetWeekStart.toISOString(),
        staff_count: staffMembers.length,
        rules_copied: copiedBlocks.length,
      });

      // Save to backend
      const rules = copiedBlocks.map(timeBlockToAvailabilityRule);
      await availabilityService.bulkUpdateRules({ rules });

    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [timeBlocks, staffMembers, onError]);

  const clearAllTimeBlocks = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Clear local state
      setTimeBlocks([]);

      // Delete all rules from backend
      const deletePromises = timeBlocks.map(block => 
        availabilityService.deleteRule(block.id)
      );
      await Promise.all(deletePromises);

    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [timeBlocks, onError]);

  // Validation
  const validateTimeBlocks = useCallback(async (): Promise<boolean> => {
    if (timeBlocks.length === 0) return true;

    try {
      const rules = timeBlocks.map(timeBlockToAvailabilityRule);
      const result = await availabilityService.validateRules(rules);
      setValidationResult(result);
      return result.isValid;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      return false;
    }
  }, [timeBlocks, onError]);

  // Utility functions
  const getTimeBlocksForStaff = useCallback((staffId: string): TimeBlock[] => {
    return timeBlocks.filter(block => block.staff_id === staffId);
  }, [timeBlocks]);

  const getTimeBlocksForDay = useCallback((dayOfWeek: number): TimeBlock[] => {
    return timeBlocks.filter(block => block.day_of_week === dayOfWeek);
  }, [timeBlocks]);

  const getTotalHoursForStaff = useCallback((staffId: string): number => {
    const staffBlocks = getTimeBlocksForStaff(staffId);
    return calculateStaffTotalHours(staffBlocks);
  }, [getTimeBlocksForStaff]);

  const getTotalHoursForAllStaff = useCallback((): number => {
    return calculateStaffTotalHours(timeBlocks);
  }, [timeBlocks]);

  return {
    // Calendar state
    calendarView: calendarViewData,
    currentDate,
    timeBlocks,
    staffAvailability,
    
    // Calendar operations
    setCurrentDate,
    setCalendarView,
    navigateCalendar,
    
    // Time block operations
    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
    duplicateTimeBlock,
    
    // Bulk operations
    copyWeek,
    clearAllTimeBlocks,
    
    // Validation
    validationResult,
    validateTimeBlocks,
    
    // Loading and error states
    isLoading,
    isSaving,
    error,
    
    // Utility functions
    getTimeBlocksForStaff,
    getTimeBlocksForDay,
    getTotalHoursForStaff,
    getTotalHoursForAllStaff,
  };
};
