/**
 * Availability API Tests - T07A Finalized DTO Wiring
 * 
 * Comprehensive test suite for availability API integration functions.
 * Tests all API operations with proper mocking and error handling.
 */

import { jest } from '@jest/globals';
import { availabilityApi } from '../availabilityApi';
import type { 
  AvailabilityRule, 
  CreateAvailabilityRuleRequest,
  UpdateAvailabilityRuleRequest,
  BulkAvailabilityUpdateRequest 
} from '../types/availability';

// Mock the API client
jest.mock('../client', () => ({
  apiClient: {
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
  },
  generateIdempotencyKey: jest.fn(() => 'test-idempotency-key'),
}));

// Mock the validators
jest.mock('../../validators/availabilityValidators', () => ({
  validateAvailabilityRules: jest.fn(),
  validateAvailabilityRule: jest.fn(),
}));

import { apiClient } from '../client';
import { validateAvailabilityRule, validateAvailabilityRules } from '../../validators/availabilityValidators';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockValidateAvailabilityRule = validateAvailabilityRule as jest.MockedFunction<typeof validateAvailabilityRule>;
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

const mockUpdateRequest: UpdateAvailabilityRuleRequest = {
  id: 'rule-1',
  start_time: '10:00',
  end_time: '18:00',
};

const mockBulkRequest: BulkAvailabilityUpdateRequest = {
  rules: [mockCreateRequest],
  replace_existing: false,
};

// ===== SETUP =====

beforeEach(() => {
  jest.clearAllMocks();
  
  // Default successful validation
  mockValidateAvailabilityRule.mockReturnValue({
    isValid: true,
    errors: [],
  });
  
  mockValidateAvailabilityRules.mockReturnValue({
    isValid: true,
    errors: [],
    overlaps: [],
  });
});

// ===== CREATE RULE TESTS =====

describe('createAvailabilityRule', () => {
  it('should create a rule successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: mockAvailabilityRule,
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    const result = await availabilityApi.createRule(mockCreateRequest);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/availability/rules',
      mockCreateRequest,
      {
        headers: {
          'Idempotency-Key': 'test-idempotency-key',
        },
      }
    );
    expect(result).toEqual(mockAvailabilityRule);
  });

  it('should handle API errors', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Validation failed',
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    await expect(availabilityApi.createRule(mockCreateRequest))
      .rejects
      .toThrow('Failed to create availability rule');
  });

  it('should handle network errors', async () => {
    mockApiClient.post.mockRejectedValue(new Error('Network error'));

    await expect(availabilityApi.createRule(mockCreateRequest))
      .rejects
      .toThrow('Network error');
  });

  it('should use custom idempotency key when provided', async () => {
    const customKey = 'custom-key';
    const mockResponse = {
      data: {
        success: true,
        data: mockAvailabilityRule,
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    await availabilityApi.createRule(mockCreateRequest, customKey);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/availability/rules',
      mockCreateRequest,
      {
        headers: {
          'Idempotency-Key': customKey,
        },
      }
    );
  });
});

// ===== UPDATE RULE TESTS =====

describe('updateAvailabilityRule', () => {
  it('should update a rule successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: mockAvailabilityRule,
      },
    };
    
    mockApiClient.put.mockResolvedValue(mockResponse);

    const result = await availabilityApi.updateRule('rule-1', mockUpdateRequest);

    expect(mockApiClient.put).toHaveBeenCalledWith(
      '/api/v1/availability/rules/rule-1',
      mockUpdateRequest,
      {
        headers: {
          'Idempotency-Key': 'test-idempotency-key',
        },
      }
    );
    expect(result).toEqual(mockAvailabilityRule);
  });

  it('should handle update errors', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Rule not found',
      },
    };
    
    mockApiClient.put.mockResolvedValue(mockResponse);

    await expect(availabilityApi.updateRule('rule-1', mockUpdateRequest))
      .rejects
      .toThrow('Failed to update availability rule');
  });
});

// ===== DELETE RULE TESTS =====

describe('deleteAvailabilityRule', () => {
  it('should delete a rule successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
      },
    };
    
    mockApiClient.delete.mockResolvedValue(mockResponse);

    await availabilityApi.deleteRule('rule-1');

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      '/api/v1/availability/rules/rule-1',
      {
        headers: {
          'Idempotency-Key': 'test-idempotency-key',
        },
      }
    );
  });

  it('should handle delete errors', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Rule not found',
      },
    };
    
    mockApiClient.delete.mockResolvedValue(mockResponse);

    await expect(availabilityApi.deleteRule('rule-1'))
      .rejects
      .toThrow('Failed to delete availability rule');
  });
});

// ===== GET RULES TESTS =====

describe('getAvailabilityRules', () => {
  it('should fetch all rules successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: [mockAvailabilityRule],
      },
    };
    
    mockApiClient.get.mockResolvedValue(mockResponse);

    const result = await availabilityApi.getRules();

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/availability/rules');
    expect(result).toEqual([mockAvailabilityRule]);
  });

  it('should handle fetch errors', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Unauthorized',
      },
    };
    
    mockApiClient.get.mockResolvedValue(mockResponse);

    await expect(availabilityApi.getRules())
      .rejects
      .toThrow('Failed to fetch availability rules');
  });
});

describe('getAvailabilityRulesForStaff', () => {
  it('should fetch staff rules successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: [mockAvailabilityRule],
      },
    };
    
    mockApiClient.get.mockResolvedValue(mockResponse);

    const result = await availabilityApi.getRulesForStaff('staff-1');

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/v1/availability/rules?staff_id=staff-1');
    expect(result).toEqual([mockAvailabilityRule]);
  });
});

// ===== BULK UPDATE TESTS =====

describe('bulkUpdateAvailabilityRules', () => {
  it('should bulk update rules successfully', async () => {
    const mockBulkResponse = {
      created_rules: [mockAvailabilityRule],
      updated_rules: [],
      deleted_rules: [],
      errors: [],
    };
    
    const mockResponse = {
      data: {
        success: true,
        data: mockBulkResponse,
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    const result = await availabilityApi.bulkUpdateRules(mockBulkRequest);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/availability/rules/bulk',
      mockBulkRequest,
      {
        headers: {
          'Idempotency-Key': 'test-idempotency-key',
        },
      }
    );
    expect(result).toEqual(mockBulkResponse);
  });

  it('should handle bulk update errors', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Bulk update failed',
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    await expect(availabilityApi.bulkUpdateRules(mockBulkRequest))
      .rejects
      .toThrow('Failed to bulk update availability rules');
  });
});

// ===== VALIDATION TESTS =====

describe('validateAvailabilityRulesAPI', () => {
  it('should validate rules successfully', async () => {
    const mockValidationResult = {
      isValid: true,
      errors: [],
      overlaps: [],
    };
    
    const mockResponse = {
      data: {
        success: true,
        data: mockValidationResult,
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    const result = await availabilityApi.validateRules([mockCreateRequest]);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/availability/rules/validate',
      { rules: [mockCreateRequest] }
    );
    expect(result).toEqual(mockValidationResult);
  });
});

// ===== COPY WEEK TESTS =====

describe('copyWeekAvailability', () => {
  it('should copy week successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: [mockAvailabilityRule],
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    const copyRequest = {
      source_week_start: '2025-01-27',
      target_week_start: '2025-02-03',
      staff_ids: ['staff-1'],
    };

    const result = await availabilityApi.copyWeek(copyRequest);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/v1/availability/rules/copy-week',
      copyRequest,
      {
        headers: {
          'Idempotency-Key': 'test-idempotency-key',
        },
      }
    );
    expect(result).toEqual([mockAvailabilityRule]);
  });
});

// ===== SUMMARY TESTS =====

describe('getAvailabilitySummary', () => {
  it('should get summary successfully', async () => {
    const mockSummary = {
      total_hours: 40,
      staff_summary: [
        {
          staff_id: 'staff-1',
          staff_name: 'John Doe',
          total_hours: 40,
          days_available: 5,
        },
      ],
    };
    
    const mockResponse = {
      data: {
        success: true,
        data: mockSummary,
      },
    };
    
    mockApiClient.get.mockResolvedValue(mockResponse);

    const result = await availabilityApi.getSummary('2025-01-27', '2025-02-03', ['staff-1']);

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/api/v1/availability/summary?start_date=2025-01-27&end_date=2025-02-03&staff_ids=staff-1'
    );
    expect(result).toEqual(mockSummary);
  });

  it('should get summary without staff filter', async () => {
    const mockSummary = {
      total_hours: 40,
      staff_summary: [],
    };
    
    const mockResponse = {
      data: {
        success: true,
        data: mockSummary,
      },
    };
    
    mockApiClient.get.mockResolvedValue(mockResponse);

    const result = await availabilityApi.getSummary('2025-01-27', '2025-02-03');

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/api/v1/availability/summary?start_date=2025-01-27&end_date=2025-02-03'
    );
    expect(result).toEqual(mockSummary);
  });
});

// ===== VALIDATION WITH CLIENT-SIDE VALIDATION TESTS =====

describe('createAvailabilityRuleWithValidation', () => {
  it('should create rule with successful validation', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: mockAvailabilityRule,
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    const result = await availabilityApi.createRuleWithValidation(mockCreateRequest);

    expect(mockValidateAvailabilityRule).toHaveBeenCalled();
    expect(result).toEqual(mockAvailabilityRule);
  });

  it('should reject rule with failed validation', async () => {
    mockValidateAvailabilityRule.mockReturnValue({
      isValid: false,
      errors: ['Invalid time format'],
    });

    await expect(availabilityApi.createRuleWithValidation(mockCreateRequest))
      .rejects
      .toThrow('Validation failed: Invalid time format');
  });
});

describe('bulkUpdateAvailabilityRulesWithValidation', () => {
  it('should bulk update with successful validation', async () => {
    const mockBulkResponse = {
      created_rules: [mockAvailabilityRule],
      updated_rules: [],
      deleted_rules: [],
      errors: [],
    };
    
    const mockResponse = {
      data: {
        success: true,
        data: mockBulkResponse,
      },
    };
    
    mockApiClient.post.mockResolvedValue(mockResponse);

    const result = await availabilityApi.bulkUpdateWithValidation(mockBulkRequest);

    expect(mockValidateAvailabilityRules).toHaveBeenCalled();
    expect(result).toEqual(mockBulkResponse);
  });

  it('should reject bulk update with failed validation', async () => {
    mockValidateAvailabilityRules.mockReturnValue({
      isValid: false,
      errors: ['Overlap detected'],
      overlaps: [],
    });

    await expect(availabilityApi.bulkUpdateWithValidation(mockBulkRequest))
      .rejects
      .toThrow('Validation failed: Overlap detected');
  });
});

// ===== UTILITY FUNCTION TESTS =====

describe('timeBlockToCreateRequest', () => {
  it('should convert time block to create request', () => {
    const timeBlock = {
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

    const result = availabilityApi.timeBlockToCreateRequest(timeBlock);

    expect(result).toEqual({
      staff_id: 'staff-1',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '13:00',
      is_recurring: true,
      is_active: true,
    });
  });
});

describe('availabilityRuleToTimeBlock', () => {
  it('should convert availability rule to time block', () => {
    const result = availabilityApi.availabilityRuleToTimeBlock(
      mockAvailabilityRule,
      'John Doe',
      'Stylist',
      '#3B82F6'
    );

    expect(result).toEqual({
      id: 'rule-1',
      staff_id: 'staff-1',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '13:00',
      is_recurring: true,
      is_active: true,
      staff_name: 'John Doe',
      staff_role: 'Stylist',
      color: '#3B82F6',
    });
  });

  it('should convert availability rule to time block without optional fields', () => {
    const result = availabilityApi.availabilityRuleToTimeBlock(mockAvailabilityRule);

    expect(result).toEqual({
      id: 'rule-1',
      staff_id: 'staff-1',
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      break_start: '12:00',
      break_end: '13:00',
      is_recurring: true,
      is_active: true,
      staff_name: undefined,
      staff_role: undefined,
      color: undefined,
    });
  });
});
