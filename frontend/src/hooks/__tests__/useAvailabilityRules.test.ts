/**
 * useAvailabilityRules Hook Tests - T07A Finalized DTO Wiring
 * 
 * Comprehensive test suite for the useAvailabilityRules hook.
 * Tests all hook functionality including state management, API integration, and validation.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { useAvailabilityRules } from '../useAvailabilityRules';
import { availabilityApi } from '../../api/availabilityApi';
import { validateAvailabilityRules } from '../../validators/availabilityValidators';
import type { AvailabilityRule, CreateAvailabilityRuleRequest } from '../../api/types/availability';

// Mock the API and validators
jest.mock('../../api/availabilityApi');
jest.mock('../../validators/availabilityValidators');

const mockAvailabilityApi = availabilityApi as jest.Mocked<typeof availabilityApi>;
const mockValidateAvailabilityRules = validateAvailabilityRules as jest.MockedFunction<typeof validateAvailabilityRules>;

// ===== TEST DATA =====

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

const mockCreateRequest: CreateAvailabilityRuleRequest = {
  staff_id: 'staff-1',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
  is_recurring: true,
  break_start: '12:00',
  break_end: '13:00',
  is_active: true,
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
});

// ===== BASIC FUNCTIONALITY TESTS =====

describe('useAvailabilityRules', () => {
  it('should initialize with empty rules by default', () => {
    const { result } = renderHook(() => useAvailabilityRules());

    expect(result.current.rules).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should initialize with provided initial rules', () => {
    const initialRules = [mockAvailabilityRule];
    const { result } = renderHook(() => useAvailabilityRules({ initialRules }));

    expect(result.current.rules).toEqual(initialRules);
  });

  it('should auto-load rules when autoLoad is true', async () => {
    const { result } = renderHook(() => useAvailabilityRules({ autoLoad: true }));

    await waitFor(() => {
      expect(mockAvailabilityApi.getRules).toHaveBeenCalled();
    });

    expect(result.current.rules).toEqual([mockAvailabilityRule]);
  });

  it('should not auto-load rules when autoLoad is false', () => {
    renderHook(() => useAvailabilityRules({ autoLoad: false }));

    expect(mockAvailabilityApi.getRules).not.toHaveBeenCalled();
  });
});

// ===== CRUD OPERATIONS TESTS =====

describe('CRUD Operations', () => {
  it('should create a rule successfully', async () => {
    const { result } = renderHook(() => useAvailabilityRules());

    await act(async () => {
      const newRule = await result.current.createRule(mockCreateRequest);
      expect(newRule).toEqual(mockAvailabilityRule);
    });

    expect(result.current.rules).toContain(mockAvailabilityRule);
    expect(mockAvailabilityApi.createRuleWithValidation).toHaveBeenCalledWith(mockCreateRequest);
  });

  it('should handle create rule errors', async () => {
    const error = new Error('Create failed');
    mockAvailabilityApi.createRuleWithValidation.mockRejectedValue(error);
    
    const onError = jest.fn();
    const { result } = renderHook(() => useAvailabilityRules({ onError }));

    await act(async () => {
      await expect(result.current.createRule(mockCreateRequest))
        .rejects
        .toThrow('Create failed');
    });

    expect(result.current.error).toBe('Create failed');
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should update a rule successfully', async () => {
    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [mockAvailabilityRule] 
    }));

    const updates = { start_time: '10:00' };

    await act(async () => {
      const updatedRule = await result.current.updateRule('rule-1', updates);
      expect(updatedRule).toEqual(mockAvailabilityRule);
    });

    expect(mockAvailabilityApi.updateRule).toHaveBeenCalledWith('rule-1', updates);
  });

  it('should delete a rule successfully', async () => {
    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [mockAvailabilityRule] 
    }));

    await act(async () => {
      await result.current.deleteRule('rule-1');
    });

    expect(result.current.rules).not.toContain(mockAvailabilityRule);
    expect(mockAvailabilityApi.deleteRule).toHaveBeenCalledWith('rule-1');
  });

  it('should bulk update rules successfully', async () => {
    const { result } = renderHook(() => useAvailabilityRules());

    const bulkRequest = {
      rules: [mockCreateRequest],
      replace_existing: false,
    };

    await act(async () => {
      await result.current.bulkUpdateRules(bulkRequest);
    });

    expect(result.current.rules).toContain(mockAvailabilityRule);
    expect(mockAvailabilityApi.bulkUpdateWithValidation).toHaveBeenCalledWith(bulkRequest);
  });
});

// ===== UTILITY OPERATIONS TESTS =====

describe('Utility Operations', () => {
  it('should copy week successfully', async () => {
    const { result } = renderHook(() => useAvailabilityRules());

    await act(async () => {
      await result.current.copyWeek('2025-01-27', '2025-02-03', ['staff-1']);
    });

    expect(result.current.rules).toContain(mockAvailabilityRule);
    expect(mockAvailabilityApi.copyWeek).toHaveBeenCalledWith({
      source_week_start: '2025-01-27',
      target_week_start: '2025-02-03',
      staff_ids: ['staff-1'],
    });
  });

  it('should clear all rules successfully', async () => {
    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [mockAvailabilityRule] 
    }));

    await act(async () => {
      await result.current.clearAllRules();
    });

    expect(result.current.rules).toEqual([]);
    expect(mockAvailabilityApi.deleteRule).toHaveBeenCalledWith('rule-1');
  });
});

// ===== VALIDATION TESTS =====

describe('Validation', () => {
  it('should validate rules and update validation result', async () => {
    const validationResult = {
      isValid: false,
      errors: ['Overlap detected'],
      overlaps: [],
    };
    mockValidateAvailabilityRules.mockReturnValue(validationResult);

    const onValidationChange = jest.fn();
    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [mockAvailabilityRule],
      onValidationChange 
    }));

    await waitFor(() => {
      expect(result.current.validationResult).toEqual(validationResult);
      expect(onValidationChange).toHaveBeenCalledWith(false, ['Overlap detected']);
    });
  });

  it('should validate individual rules', () => {
    const { result } = renderHook(() => useAvailabilityRules());

    const isValid = result.current.validateRule(mockAvailabilityRule);
    expect(isValid).toBe(true);
  });

  it('should validate all rules', async () => {
    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [mockAvailabilityRule] 
    }));

    await act(async () => {
      const isValid = await result.current.validateRules();
      expect(isValid).toBe(true);
    });
  });
});

// ===== DATA ACCESS TESTS =====

describe('Data Access', () => {
  const rules = [
    mockAvailabilityRule,
    {
      ...mockAvailabilityRule,
      id: 'rule-2',
      staff_id: 'staff-2',
      day_of_week: 2,
    },
    {
      ...mockAvailabilityRule,
      id: 'rule-3',
      is_active: false,
    },
  ];

  it('should get rules for specific staff', () => {
    const { result } = renderHook(() => useAvailabilityRules({ initialRules: rules }));

    const staffRules = result.current.getRulesForStaff('staff-1');
    expect(staffRules).toHaveLength(1);
    expect(staffRules[0].staff_id).toBe('staff-1');
  });

  it('should get rules for specific day', () => {
    const { result } = renderHook(() => useAvailabilityRules({ initialRules: rules }));

    const dayRules = result.current.getRulesForDay(1);
    expect(dayRules).toHaveLength(1);
    expect(dayRules[0].day_of_week).toBe(1);
  });

  it('should get active rules', () => {
    const { result } = renderHook(() => useAvailabilityRules({ initialRules: rules }));

    const activeRules = result.current.getActiveRules();
    expect(activeRules).toHaveLength(2);
    expect(activeRules.every(rule => rule.is_active)).toBe(true);
  });

  it('should get inactive rules', () => {
    const { result } = renderHook(() => useAvailabilityRules({ initialRules: rules }));

    const inactiveRules = result.current.getInactiveRules();
    expect(inactiveRules).toHaveLength(1);
    expect(inactiveRules[0].is_active).toBe(false);
  });
});

// ===== STATE MANAGEMENT TESTS =====

describe('State Management', () => {
  it('should refresh rules', async () => {
    const { result } = renderHook(() => useAvailabilityRules());

    await act(async () => {
      await result.current.refreshRules();
    });

    expect(mockAvailabilityApi.getRules).toHaveBeenCalled();
    expect(result.current.rules).toEqual([mockAvailabilityRule]);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useAvailabilityRules());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should set rules directly', () => {
    const { result } = renderHook(() => useAvailabilityRules());

    act(() => {
      result.current.setRules([mockAvailabilityRule]);
    });

    expect(result.current.rules).toEqual([mockAvailabilityRule]);
  });
});

// ===== CALLBACK TESTS =====

describe('Callbacks', () => {
  it('should call onRulesChange when rules change', () => {
    const onRulesChange = jest.fn();
    const { result } = renderHook(() => useAvailabilityRules({ onRulesChange }));

    act(() => {
      result.current.setRules([mockAvailabilityRule]);
    });

    expect(onRulesChange).toHaveBeenCalledWith([mockAvailabilityRule]);
  });

  it('should call onError when error occurs', async () => {
    const error = new Error('Test error');
    mockAvailabilityApi.getRules.mockRejectedValue(error);
    
    const onError = jest.fn();
    renderHook(() => useAvailabilityRules({ autoLoad: true, onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});

// ===== LOADING STATES TESTS =====

describe('Loading States', () => {
  it('should set loading state during API calls', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockAvailabilityApi.getRules.mockReturnValue(promise);

    const { result } = renderHook(() => useAvailabilityRules({ autoLoad: true }));

    expect(result.current.isLoading).toBe(true);

    act(() => {
      resolvePromise!([mockAvailabilityRule]);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should set saving state during create operations', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockAvailabilityApi.createRuleWithValidation.mockReturnValue(promise);

    const { result } = renderHook(() => useAvailabilityRules());

    act(() => {
      result.current.createRule(mockCreateRequest);
    });

    expect(result.current.isSaving).toBe(true);

    act(() => {
      resolvePromise!(mockAvailabilityRule);
    });

    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });
  });
});

// ===== EDGE CASES TESTS =====

describe('Edge Cases', () => {
  it('should handle empty rules array', () => {
    const { result } = renderHook(() => useAvailabilityRules({ initialRules: [] }));

    expect(result.current.rules).toEqual([]);
    expect(result.current.getActiveRules()).toEqual([]);
    expect(result.current.getInactiveRules()).toEqual([]);
  });

  it('should handle validation errors gracefully', async () => {
    const error = new Error('Validation error');
    mockValidateAvailabilityRules.mockImplementation(() => {
      throw error;
    });

    const onError = jest.fn();
    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [mockAvailabilityRule],
      onError 
    }));

    await waitFor(() => {
      expect(result.current.error).toBe('Validation error');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  it('should handle bulk update with mixed results', async () => {
    const bulkResponse = {
      created_rules: [mockAvailabilityRule],
      updated_rules: [],
      deleted_rules: ['rule-2'],
      errors: [],
    };
    mockAvailabilityApi.bulkUpdateWithValidation.mockResolvedValue(bulkResponse);

    const { result } = renderHook(() => useAvailabilityRules({ 
      initialRules: [
        mockAvailabilityRule,
        { ...mockAvailabilityRule, id: 'rule-2' }
      ]
    }));

    const bulkRequest = {
      rules: [mockCreateRequest],
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
