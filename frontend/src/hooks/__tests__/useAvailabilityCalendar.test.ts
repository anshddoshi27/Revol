/**
 * useAvailabilityCalendar Hook Tests
 * 
 * Unit tests for the useAvailabilityCalendar hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useAvailabilityCalendar } from '../useAvailabilityCalendar';
import type { StaffMember, TimeBlock } from '../../api/types';

// Mock the availability service
jest.mock('../../api/services/availability', () => ({
  availabilityService: {
    getRules: jest.fn(),
    createRule: jest.fn(),
    updateRule: jest.fn(),
    deleteRule: jest.fn(),
    validateRules: jest.fn(),
    bulkUpdateRules: jest.fn(),
  },
}));

// Mock the observability module
jest.mock('../../observability/step4-availability', () => ({
  onboardingStep4Observability: {
    trackStepStarted: jest.fn(),
    trackStepCompleted: jest.fn(),
    trackTimeBlockCreated: jest.fn(),
    trackTimeBlockUpdated: jest.fn(),
    trackTimeBlockDeleted: jest.fn(),
    trackCopyWeek: jest.fn(),
    trackValidationError: jest.fn(),
  },
}));

// Mock the utility functions
jest.mock('../../utils/availabilityHelpers', () => ({
  convertStaffToAvailability: jest.fn((staff, blocks) => 
    staff.map(s => ({
      staff_id: s.id || '',
      staff_name: s.name,
      staff_role: s.role,
      color: s.color,
      time_blocks: blocks.filter((b: any) => b.staff_id === s.id),
      total_hours_per_week: 8,
    }))
  ),
  generateCalendarWeeks: jest.fn(() => []),
  detectTimeBlockOverlaps: jest.fn(() => []),
  timeBlockToAvailabilityRule: jest.fn((block) => ({
    staff_id: block.staff_id,
    day_of_week: block.day_of_week,
    start_time: block.start_time,
    end_time: block.end_time,
    is_recurring: block.is_recurring,
  })),
  availabilityRuleToTimeBlock: jest.fn((rule) => ({
    id: rule.id || 'temp-id',
    staff_id: rule.staff_id,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_recurring: rule.is_recurring,
    is_active: rule.is_active,
  })),
  copyTimeBlocksToWeek: jest.fn((blocks) => blocks.map((b: any) => ({ ...b, id: 'new-id' }))),
  calculateStaffTotalHours: jest.fn(() => 8),
  sortTimeBlocksByStartTime: jest.fn((blocks) => blocks),
}));

const mockStaffMembers: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'John Doe',
    role: 'Stylist',
    color: '#3B82F6',
  },
  {
    id: 'staff-2',
    name: 'Jane Smith',
    role: 'Manager',
    color: '#10B981',
  },
];

const mockTimeBlocks: TimeBlock[] = [
  {
    id: 'block-1',
    staff_id: 'staff-1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_recurring: true,
    is_active: true,
    color: '#3B82F6',
    staff_name: 'John Doe',
    staff_role: 'Stylist',
  },
];

describe('useAvailabilityCalendar', () => {
  const defaultOptions = {
    staffMembers: mockStaffMembers,
    initialTimeBlocks: mockTimeBlocks,
    onError: jest.fn(),
    onValidationChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    expect(result.current.timeBlocks).toEqual(mockTimeBlocks);
    expect(result.current.currentDate).toBeInstanceOf(Date);
    expect(result.current.calendarView.type).toBe('week');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('provides staff availability data', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    expect(result.current.staffAvailability).toHaveLength(2);
    expect(result.current.staffAvailability[0]).toMatchObject({
      staff_id: 'staff-1',
      staff_name: 'John Doe',
      staff_role: 'Stylist',
      color: '#3B82F6',
    });
  });

  it('handles calendar navigation', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const initialDate = result.current.currentDate;
    
    act(() => {
      result.current.navigateCalendar('next');
    });

    expect(result.current.currentDate).not.toEqual(initialDate);
  });

  it('handles calendar view changes', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    act(() => {
      result.current.setCalendarView('month');
    });

    expect(result.current.calendarView.type).toBe('month');
  });

  it('handles time block addition', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const newTimeBlock: Omit<TimeBlock, 'id'> = {
      staff_id: 'staff-2',
      day_of_week: 2,
      start_time: '10:00',
      end_time: '18:00',
      is_recurring: true,
      is_active: true,
      color: '#10B981',
      staff_name: 'Jane Smith',
      staff_role: 'Manager',
    };

    await act(async () => {
      await result.current.addTimeBlock(newTimeBlock);
    });

    expect(result.current.timeBlocks).toHaveLength(2);
  });

  it('handles time block updates', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const updates = {
      start_time: '10:00',
      end_time: '18:00',
    };

    await act(async () => {
      await result.current.updateTimeBlock('block-1', updates);
    });

    expect(result.current.timeBlocks[0]).toMatchObject(updates);
  });

  it('handles time block deletion', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    await act(async () => {
      await result.current.deleteTimeBlock('block-1');
    });

    expect(result.current.timeBlocks).toHaveLength(0);
  });

  it('handles time block duplication', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    await act(async () => {
      await result.current.duplicateTimeBlock('block-1', 3);
    });

    expect(result.current.timeBlocks).toHaveLength(2);
  });

  it('handles week copying', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const sourceWeekStart = new Date('2024-01-01');
    const targetWeekStart = new Date('2024-01-08');

    await act(async () => {
      await result.current.copyWeek(sourceWeekStart, targetWeekStart);
    });

    expect(result.current.timeBlocks.length).toBeGreaterThan(mockTimeBlocks.length);
  });

  it('handles clearing all time blocks', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    await act(async () => {
      await result.current.clearAllTimeBlocks();
    });

    expect(result.current.timeBlocks).toHaveLength(0);
  });

  it('provides utility functions', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    expect(typeof result.current.getTimeBlocksForStaff).toBe('function');
    expect(typeof result.current.getTimeBlocksForDay).toBe('function');
    expect(typeof result.current.getTotalHoursForStaff).toBe('function');
    expect(typeof result.current.getTotalHoursForAllStaff).toBe('function');
  });

  it('calculates total hours correctly', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const totalHours = result.current.getTotalHoursForAllStaff();
    expect(totalHours).toBe(8);
  });

  it('filters time blocks by staff', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const staffBlocks = result.current.getTimeBlocksForStaff('staff-1');
    expect(staffBlocks).toHaveLength(1);
    expect(staffBlocks[0].staff_id).toBe('staff-1');
  });

  it('filters time blocks by day', () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const dayBlocks = result.current.getTimeBlocksForDay(1);
    expect(dayBlocks).toHaveLength(1);
    expect(dayBlocks[0].day_of_week).toBe(1);
  });

  it('handles validation', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    const isValid = await act(async () => {
      return await result.current.validateTimeBlocks();
    });

    expect(typeof isValid).toBe('boolean');
  });

  it('handles errors gracefully', async () => {
    const onError = jest.fn();
    const { result } = renderHook(() => 
      useAvailabilityCalendar({ ...defaultOptions, onError })
    );

    // Mock an error in the service
    const { availabilityService } = require('../../api/services/availability');
    availabilityService.createRule.mockRejectedValue(new Error('API Error'));

    await act(async () => {
      await result.current.addTimeBlock({
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_recurring: true,
        is_active: true,
      });
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('tracks analytics events', async () => {
    const { result } = renderHook(() => useAvailabilityCalendar(defaultOptions));

    await act(async () => {
      await result.current.addTimeBlock({
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_recurring: true,
        is_active: true,
      });
    });

    const { onboardingStep4Observability } = require('../../observability/step4-availability');
    expect(onboardingStep4Observability.trackTimeBlockCreated).toHaveBeenCalled();
  });
});
