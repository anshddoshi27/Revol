/**
 * useTimeBlockManagement Hook
 * 
 * Custom hook for managing individual time block operations and editing.
 * Provides time block creation, editing, and validation functionality.
 */

import { useState, useCallback, useMemo } from 'react';
import { onboardingStep4Observability } from '../observability/step4-availability';
import type {
  TimeBlock,
  TimeBlockFormData,
  RecurringPatternFormData,
} from '../api/types/availability';
import type { StaffMember } from '../api/types/onboarding';
import {
  createTimeBlock,
  timeBlockToAvailabilityRule,
  isValidTimeRange,
  isValidTimeBlockDuration,
  timeRangesOverlaps,
  formatTime,
  calculateDuration,
} from '../utils/availabilityHelpers';

interface UseTimeBlockManagementOptions {
  staffMembers: StaffMember[];
  existingTimeBlocks: TimeBlock[];
  onTimeBlockChange?: (timeBlock: TimeBlock) => void;
  onError?: (error: Error) => void;
}

interface UseTimeBlockManagementReturn {
  // Form state
  formData: TimeBlockFormData;
  isEditing: boolean;
  editingBlockId: string | null;
  
  // Form operations
  startEditing: (timeBlock: TimeBlock) => void;
  startCreating: (staffId: string, dayOfWeek: number) => void;
  cancelEditing: () => void;
  updateFormData: (updates: Partial<TimeBlockFormData>) => void;
  
  // Validation
  validationErrors: string[];
  isValid: boolean;
  validateForm: () => boolean;
  
  // Time block operations
  saveTimeBlock: () => TimeBlock | null;
  duplicateTimeBlock: (timeBlock: TimeBlock, targetDay?: number) => TimeBlock;
  
  // Utility functions
  getAvailableStaff: () => StaffMember[];
  getStaffById: (staffId: string) => StaffMember | undefined;
  formatTimeForDisplay: (time: string) => string;
  calculateBlockDuration: () => number;
  
  // Break management
  hasBreak: boolean;
  toggleBreak: () => void;
  isBreakValid: boolean;
  
  // Recurring pattern management
  recurringPattern: RecurringPatternFormData | null;
  setRecurringPattern: (pattern: RecurringPatternFormData | null) => void;
  isRecurringValid: boolean;
}

export const useTimeBlockManagement = ({
  staffMembers,
  existingTimeBlocks,
  onTimeBlockChange,
  onError,
}: UseTimeBlockManagementOptions): UseTimeBlockManagementReturn => {
  // Form state
  const [formData, setFormData] = useState<TimeBlockFormData>({
    staff_id: '',
    day_of_week: 0,
    start_time: '09:00',
    end_time: '17:00',
    break_start: undefined,
    break_end: undefined,
    is_recurring: true,
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [recurringPattern, setRecurringPattern] = useState<RecurringPatternFormData | null>(null);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    
    // Required fields
    if (!formData.staff_id) {
      errors.push('Staff member is required');
    }
    
    if (!formData.start_time) {
      errors.push('Start time is required');
    }
    
    if (!formData.end_time) {
      errors.push('End time is required');
    }
    
    // Time format validation
    if (formData.start_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.start_time)) {
      errors.push('Invalid start time format');
    }
    
    if (formData.end_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.end_time)) {
      errors.push('Invalid end time format');
    }
    
    // Time range validation
    if (formData.start_time && formData.end_time) {
      if (!isValidTimeRange(formData.start_time, formData.end_time)) {
        errors.push('End time must be after start time');
      }
      
      if (!isValidTimeBlockDuration(formData.start_time, formData.end_time)) {
        errors.push('Time block must be at least 30 minutes long');
      }
    }
    
    // Break validation
    if (formData.break_start && formData.break_end) {
      if (!isValidTimeRange(formData.break_start, formData.break_end)) {
        errors.push('Break end time must be after break start time');
      }
      
      if (formData.start_time && formData.end_time) {
        // Check if break is within the time block
        if (formData.break_start < formData.start_time || formData.break_end > formData.end_time) {
          errors.push('Break must be within the time block');
        }
      }
    }
    
    // Overlap validation
    if (formData.staff_id && formData.start_time && formData.end_time) {
      const conflictingBlocks = existingTimeBlocks.filter(block => 
        block.staff_id === formData.staff_id &&
        block.day_of_week === formData.day_of_week &&
        block.id !== editingBlockId &&
        timeRangesOverlaps(
          formData.start_time,
          formData.end_time,
          block.start_time,
          block.end_time
        )
      );
      
      if (conflictingBlocks.length > 0) {
        errors.push(`Time block overlaps with existing schedule for ${getStaffById(formData.staff_id)?.name || 'staff member'}`);
      }
    }
    
    return errors;
  }, [formData, existingTimeBlocks, editingBlockId]);

  const isValid = validationErrors.length === 0;

  // Form operations
  const startEditing = useCallback((timeBlock: TimeBlock) => {
    setFormData({
      staff_id: timeBlock.staff_id,
      day_of_week: timeBlock.day_of_week,
      start_time: timeBlock.start_time,
      end_time: timeBlock.end_time,
      break_start: timeBlock.break_start,
      break_end: timeBlock.break_end,
      is_recurring: timeBlock.is_recurring,
    });
    setIsEditing(true);
    setEditingBlockId(timeBlock.id);
    
    // Track analytics
    onboardingStep4Observability.trackTimeBlockUpdated({
      time_block_id: timeBlock.id,
      staff_id: timeBlock.staff_id,
      day_of_week: timeBlock.day_of_week,
      start_time: timeBlock.start_time,
      end_time: timeBlock.end_time,
    });
  }, []);

  const startCreating = useCallback((staffId: string, dayOfWeek: number) => {
    setFormData({
      staff_id: staffId,
      day_of_week: dayOfWeek,
      start_time: '09:00',
      end_time: '17:00',
      break_start: undefined,
      break_end: undefined,
      is_recurring: true,
    });
    setIsEditing(true);
    setEditingBlockId(null);
    
    // Track analytics
    onboardingStep4Observability.trackTimeBlockCreated({
      staff_id: staffId,
      day_of_week: dayOfWeek,
      start_time: '09:00',
      end_time: '17:00',
      is_recurring: true,
    });
  }, []);

  const cancelEditing = useCallback(() => {
    setFormData({
      staff_id: '',
      day_of_week: 0,
      start_time: '09:00',
      end_time: '17:00',
      break_start: undefined,
      break_end: undefined,
      is_recurring: true,
    });
    setIsEditing(false);
    setEditingBlockId(null);
    setRecurringPattern(null);
  }, []);

  const updateFormData = useCallback((updates: Partial<TimeBlockFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // Validation
  const validateForm = useCallback((): boolean => {
    if (!isValid) {
      // Track validation errors
      validationErrors.forEach(error => {
        onboardingStep4Observability.trackValidationError({
          error_type: 'form_validation',
          message: error,
          field: 'time_block_form',
        });
      });
      return false;
    }
    return true;
  }, [isValid, validationErrors]);

  // Time block operations
  const saveTimeBlock = useCallback((): TimeBlock | null => {
    if (!validateForm()) {
      return null;
    }

    const staff = getStaffById(formData.staff_id);
    if (!staff) {
      onError?.(new Error('Staff member not found'));
      return null;
    }

    const timeBlock = createTimeBlock(
      formData.staff_id,
      formData.day_of_week,
      formData.start_time,
      formData.end_time,
      {
        breakStart: formData.break_start,
        breakEnd: formData.break_end,
        isRecurring: formData.is_recurring,
        staffName: staff.name,
        staffRole: staff.role,
        color: staff.color,
      }
    );

    // If editing, preserve the original ID
    if (editingBlockId) {
      timeBlock.id = editingBlockId;
    }

    onTimeBlockChange?.(timeBlock);
    cancelEditing();
    
    return timeBlock;
  }, [formData, validateForm, editingBlockId, onTimeBlockChange, cancelEditing, onError]);

  const duplicateTimeBlock = useCallback((timeBlock: TimeBlock, targetDay?: number): TimeBlock => {
    const newBlock = createTimeBlock(
      timeBlock.staff_id,
      targetDay ?? timeBlock.day_of_week,
      timeBlock.start_time,
      timeBlock.end_time,
      {
        breakStart: timeBlock.break_start,
        breakEnd: timeBlock.break_end,
        isRecurring: timeBlock.is_recurring,
        staffName: timeBlock.staff_name,
        staffRole: timeBlock.staff_role,
        color: timeBlock.color,
      }
    );

    onTimeBlockChange?.(newBlock);
    return newBlock;
  }, [onTimeBlockChange]);

  // Utility functions
  const getAvailableStaff = useCallback((): StaffMember[] => {
    return staffMembers.filter(staff => staff.id && staff.name);
  }, [staffMembers]);

  const getStaffById = useCallback((staffId: string): StaffMember | undefined => {
    return staffMembers.find(staff => staff.id === staffId);
  }, [staffMembers]);

  const formatTimeForDisplay = useCallback((time: string): string => {
    return formatTime(time, '12h');
  }, []);

  const calculateBlockDuration = useCallback((): number => {
    if (!formData.start_time || !formData.end_time) {
      return 0;
    }
    
    const totalDuration = calculateDuration(formData.start_time, formData.end_time);
    const breakDuration = formData.break_start && formData.break_end 
      ? calculateDuration(formData.break_start, formData.break_end)
      : 0;
    
    return totalDuration - breakDuration;
  }, [formData]);

  // Break management
  const hasBreak = !!(formData.break_start && formData.break_end);
  
  const toggleBreak = useCallback(() => {
    if (hasBreak) {
      updateFormData({
        break_start: undefined,
        break_end: undefined,
      });
    } else {
      // Set default break time (1 hour lunch break in the middle)
      if (formData.start_time && formData.end_time) {
        const startMinutes = calculateDuration('00:00', formData.start_time);
        const endMinutes = calculateDuration('00:00', formData.end_time);
        const middleMinutes = Math.floor((startMinutes + endMinutes) / 2);
        const breakStart = Math.floor(middleMinutes / 60).toString().padStart(2, '0') + ':' + 
                          (middleMinutes % 60).toString().padStart(2, '0');
        const breakEnd = Math.floor((middleMinutes + 60) / 60).toString().padStart(2, '0') + ':' + 
                        ((middleMinutes + 60) % 60).toString().padStart(2, '0');
        
        updateFormData({
          break_start: breakStart,
          break_end: breakEnd,
        });
      }
    }
  }, [hasBreak, formData.start_time, formData.end_time, updateFormData]);

  const isBreakValid = useMemo(() => {
    if (!hasBreak) return true;
    
    if (!formData.break_start || !formData.break_end) return false;
    
    return isValidTimeRange(formData.break_start, formData.break_end) &&
           formData.break_start >= formData.start_time &&
           formData.break_end <= formData.end_time;
  }, [hasBreak, formData.break_start, formData.break_end, formData.start_time, formData.end_time]);

  // Recurring pattern management
  const isRecurringValid = useMemo(() => {
    if (!recurringPattern) return true;
    
    return !!(
      recurringPattern.pattern_type &&
      recurringPattern.start_time &&
      recurringPattern.end_time &&
      isValidTimeRange(recurringPattern.start_time, recurringPattern.end_time)
    );
  }, [recurringPattern]);

  return {
    // Form state
    formData,
    isEditing,
    editingBlockId,
    
    // Form operations
    startEditing,
    startCreating,
    cancelEditing,
    updateFormData,
    
    // Validation
    validationErrors,
    isValid,
    validateForm,
    
    // Time block operations
    saveTimeBlock,
    duplicateTimeBlock,
    
    // Utility functions
    getAvailableStaff,
    getStaffById,
    formatTimeForDisplay,
    calculateBlockDuration,
    
    // Break management
    hasBreak,
    toggleBreak,
    isBreakValid,
    
    // Recurring pattern management
    recurringPattern,
    setRecurringPattern,
    isRecurringValid,
  };
};
