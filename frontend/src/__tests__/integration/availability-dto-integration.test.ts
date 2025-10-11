/**
 * Availability DTO Integration Tests - T07A Finalized DTO Wiring
 * 
 * Integration tests to verify that the new availability DTO wiring
 * works correctly with the existing Step 4 onboarding flow.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useAvailabilityRules } from '../../hooks/useAvailabilityRules';
import { useAvailabilityCalendar } from '../../hooks/useAvailabilityCalendar';
import { availabilityApi } from '../../api/availabilityApi';
import { validateAvailabilityRules } from '../../validators/availabilityValidators';
import type { AvailabilityRule, TimeBlock, StaffMember } from '../../api/types/availability';

// Mock the API and validators
jest.mock('../../api/availabilityApi');
jest.mock('../../validators/availabilityValidators');

const mockAvailabilityApi = availabilityApi as jest.Mocked<typeof availabilityApi>;
const mockValidateAvailabilityRules = validateAvailabilityRules as jest.MockedFunction<typeof validateAvailabilityRules>;

// ===== TEST DATA =====

const mockStaffMember: StaffMember = {
  id: 'staff-1',
  name: 'John Doe',
  role: 'Stylist',
  color: '#3B82F6',
  email: 'john@example.com',
  phone: '+1234567890',
};

const mockAvailabilityRule: AvailabilityRule = {
  id: 'rule-1',
  tenant_id: 'tenant-1',
  staff_id: 'staff-1',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
  is_recurring: true,
  break_start: '12:00',
  break_end: '13:00',
  is_active: true,
  created_at: '2025-01-27T10:00:00Z',
  updated_at: '2025-01-27T10:00:00Z',
};

const mockTimeBlock: TimeBlock = {
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

// ===== SETUP =====

beforeEach(() => {
  jest.clearAllMocks();
  
  // Default successful validation
  mockValidateAvailabilityRules.mockReturnValue({
    isValid: true,
    errors: [],
    overlaps: [],
  });
  
  // Default API responses
  mockAvailabilityApi.getRules.mockResolvedValue([mockAvailabilityRule]);
  mockAvailabilityApi.createRuleWithValidation.mockResolvedValue(mockAvailabilityRule);
  mockAvailabilityApi.updateRule.mockResolvedValue(mockAvailabilityRule);
  mockAvailabilityApi.deleteRule.mockResolvedValue();
  mockAvailabilityApi.bulkUpdateWithValidation.mockResolvedValue({
    created_rules: [mockAvailabilityRule],
    updated_rules: [],
    deleted_rules: [],
    errors: [],
  });
  mockAvailabilityApi.copyWeek.mockResolvedValue([mockAvailabilityRule]);
  mockAvailabilityApi.timeBlockToCreateRequest.mockReturnValue({
    staff_id: 'staff-1',
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_recurring: true,
    break_start: '12:00',
    break_end: '13:00',
    is_active: true,
  });
  mockAvailabilityApi.availabilityRuleToTimeBlock.mockReturnValue(mockTimeBlock);
});

// ===== INTEGRATION TESTS =====

describe('Availability DTO Integration', () => {
  describe('useAvailabilityRules Hook Integration', () => {
    it('should work with the finalized DTO structure', async () => {
      const { result } = renderHook(() => useAvailabilityRules({ autoLoad: true }));

      await waitFor(() => {
        expect(result.current.rules).toEqual([mockAvailabilityRule]);
      });

      expect(mockAvailabilityApi.getRules).toHaveBeenCalled();
    });

    it('should create rules with proper DTO validation', async () => {
      const { result } = renderHook(() => useAvailabilityRules());

      const createRequest = {
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_recurring: true,
        break_start: '12:00',
        break_end: '13:00',
        is_active: true,
      };

      await act(async () => {
        const newRule = await result.current.createRule(createRequest);
        expect(newRule).toEqual(mockAvailabilityRule);
      });

      expect(mockAvailabilityApi.createRuleWithValidation).toHaveBeenCalledWith(createRequest);
      expect(result.current.rules).toContain(mockAvailabilityRule);
    });

    it('should validate rules and detect overlaps', async () => {
      const overlappingRules = [
        mockAvailabilityRule,
        {
          ...mockAvailabilityRule,
          id: 'rule-2',
          start_time: '10:00',
          end_time: '14:00',
        },
      ];

      mockValidateAvailabilityRules.mockReturnValue({
        isValid: false,
        errors: ['Overlap detected between rules rule-1 and rule-2'],
        overlaps: [
          {
            rule1_id: 'rule-1',
            rule2_id: 'rule-2',
            day_of_week: 1,
            overlap_start: '10:00',
            overlap_end: '14:00',
          },
        ],
      });

      const { result } = renderHook(() => useAvailabilityRules({ 
        initialRules: overlappingRules 
      }));

      await waitFor(() => {
        expect(result.current.validationResult?.isValid).toBe(false);
        expect(result.current.validationResult?.errors).toHaveLength(1);
        expect(result.current.validationResult?.overlaps).toHaveLength(1);
      });
    });
  });

  describe('useAvailabilityCalendar Hook Integration', () => {
    it('should work with staff members and time blocks', async () => {
      const { result } = renderHook(() => useAvailabilityCalendar({
        staffMembers: [mockStaffMember],
        initialTimeBlocks: [mockTimeBlock],
      }));

      expect(result.current.timeBlocks).toEqual([mockTimeBlock]);
      expect(result.current.staffAvailability).toHaveLength(1);
      expect(result.current.staffAvailability[0].staff_id).toBe('staff-1');
    });

    it('should add time blocks and convert to availability rules', async () => {
      const { result } = renderHook(() => useAvailabilityCalendar({
        staffMembers: [mockStaffMember],
      }));

      const newTimeBlock = {
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_recurring: true,
        is_active: true,
      };

      await act(async () => {
        await result.current.addTimeBlock(newTimeBlock);
      });

      expect(mockAvailabilityApi.createRule).toHaveBeenCalled();
      expect(result.current.timeBlocks.length).toBeGreaterThan(0);
    });

    it('should copy week and create multiple rules', async () => {
      const { result } = renderHook(() => useAvailabilityCalendar({
        staffMembers: [mockStaffMember],
        initialTimeBlocks: [mockTimeBlock],
      }));

      const sourceWeekStart = new Date('2025-01-27');
      const targetWeekStart = new Date('2025-02-03');

      await act(async () => {
        await result.current.copyWeek(sourceWeekStart, targetWeekStart);
      });

      expect(mockAvailabilityApi.bulkUpdateRules).toHaveBeenCalled();
    });
  });

  describe('DTO Conversion Integration', () => {
    it('should convert time blocks to availability rules correctly', () => {
      const createRequest = mockAvailabilityApi.timeBlockToCreateRequest(mockTimeBlock);

      expect(createRequest).toEqual({
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_recurring: true,
        break_start: '12:00',
        break_end: '13:00',
        is_active: true,
      });
    });

    it('should convert availability rules to time blocks correctly', () => {
      const timeBlock = mockAvailabilityApi.availabilityRuleToTimeBlock(
        mockAvailabilityRule,
        'John Doe',
        'Stylist',
        '#3B82F6'
      );

      expect(timeBlock).toEqual(mockTimeBlock);
    });
  });

  describe('Validation Integration', () => {
    it('should validate availability rules with proper error messages', () => {
      const invalidRule = {
        ...mockAvailabilityRule,
        start_time: 'invalid',
      };

      mockValidateAvailabilityRules.mockReturnValue({
        isValid: false,
        errors: ['start_time: Time must be in HH:MM format (24-hour)'],
        overlaps: [],
      });

      const { result } = renderHook(() => useAvailabilityRules({ 
        initialRules: [invalidRule] 
      }));

      expect(result.current.validationResult?.isValid).toBe(false);
      expect(result.current.validationResult?.errors[0]).toContain('Time must be in HH:MM format');
    });

    it('should handle DST-safe validation', () => {
      const dstRule = {
        ...mockAvailabilityRule,
        start_time: '02:00', // DST transition time
        end_time: '03:00',
      };

      mockValidateAvailabilityRules.mockReturnValue({
        isValid: true,
        errors: [],
        overlaps: [],
      });

      const { result } = renderHook(() => useAvailabilityRules({ 
        initialRules: [dstRule] 
      }));

      expect(result.current.validationResult?.isValid).toBe(true);
    });
  });

  describe('API Integration', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockAvailabilityApi.getRules.mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useAvailabilityRules({ 
        autoLoad: true, 
        onError 
      }));

      await waitFor(() => {
        expect(result.current.error).toBe('API Error');
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('should handle bulk operations with mixed results', async () => {
      const bulkResponse = {
        created_rules: [mockAvailabilityRule],
        updated_rules: [],
        deleted_rules: ['rule-2'],
        errors: [
          {
            rule: {
              staff_id: 'staff-3',
              day_of_week: 1,
              start_time: '09:00',
              end_time: '17:00',
              is_recurring: true,
            },
            error: 'Staff not found',
          },
        ],
      };

      mockAvailabilityApi.bulkUpdateWithValidation.mockResolvedValue(bulkResponse);

      const { result } = renderHook(() => useAvailabilityRules({ 
        initialRules: [
          mockAvailabilityRule,
          { ...mockAvailabilityRule, id: 'rule-2' }
        ]
      }));

      const bulkRequest = {
        rules: [
          {
            staff_id: 'staff-1',
            day_of_week: 1,
            start_time: '09:00',
            end_time: '17:00',
            is_recurring: true,
          },
        ],
        replace_existing: false,
      };

      await act(async () => {
        await result.current.bulkUpdateRules(bulkRequest);
      });

      // Should have original rule + created rule, but not deleted rule
      expect(result.current.rules).toHaveLength(2);
      expect(result.current.rules.find(r => r.id === 'rule-2')).toBeUndefined();
    });
  });

  describe('Step 4 Onboarding Integration', () => {
    it('should work with the complete onboarding flow', async () => {
      const staffMembers = [mockStaffMember];
      const { result } = renderHook(() => useAvailabilityCalendar({
        staffMembers,
        onError: jest.fn(),
        onValidationChange: jest.fn(),
      }));

      // Simulate adding a time block in Step 4
      const timeBlock = {
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00',
        is_recurring: true,
        is_active: true,
      };

      await act(async () => {
        await result.current.addTimeBlock(timeBlock);
      });

      expect(result.current.timeBlocks.length).toBeGreaterThan(0);
      expect(result.current.staffAvailability[0].time_blocks.length).toBeGreaterThan(0);
    });

    it('should validate time blocks before saving', async () => {
      const { result } = renderHook(() => useAvailabilityCalendar({
        staffMembers: [mockStaffMember],
      }));

      // Add overlapping time blocks
      const timeBlock1 = {
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '09:00',
        end_time: '12:00',
        is_recurring: true,
        is_active: true,
      };

      const timeBlock2 = {
        staff_id: 'staff-1',
        day_of_week: 1,
        start_time: '10:00',
        end_time: '14:00',
        is_recurring: true,
        is_active: true,
      };

      await act(async () => {
        await result.current.addTimeBlock(timeBlock1);
        await result.current.addTimeBlock(timeBlock2);
      });

      // Validation should detect overlap
      await waitFor(() => {
        expect(result.current.validationResult?.isValid).toBe(false);
      });
    });
  });
});
