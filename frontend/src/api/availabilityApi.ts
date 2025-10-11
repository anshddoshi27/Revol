/**
 * Availability API - T07A Finalized DTO Wiring
 * 
 * API integration functions for availability rules management.
 * Provides comprehensive CRUD operations with proper error handling and idempotency.
 */

import { apiClient } from './client';
import { generateIdempotencyKey } from './idempotency';
import { validateAvailabilityRules, validateAvailabilityRule } from '../validators/availabilityValidators';
import type { AvailabilityRule, RecurringPattern, TimeBlock } from '../api/types/availability';
import type { ApiResponse, TithiError } from '../api/types';

// ===== API ENDPOINTS =====

const ENDPOINTS = {
  RULES: '/availability/rules',
  RULES_BULK: '/availability/rules/bulk',
  RULES_VALIDATE: '/availability/rules/validate',
  RULES_COPY_WEEK: '/availability/rules/copy-week',
  RULES_SUMMARY: '/availability/summary',
  CALENDAR: '/availability/calendar',
} as const;

// ===== REQUEST/RESPONSE TYPES =====

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

export interface BulkAvailabilityUpdateRequest {
  rules: CreateAvailabilityRuleRequest[];
  replace_existing?: boolean;
}

export interface BulkAvailabilityUpdateResponse {
  created_rules: AvailabilityRule[];
  updated_rules: AvailabilityRule[];
  deleted_rules: string[];
  errors: Array<{
    rule: CreateAvailabilityRuleRequest;
    error: string;
  }>;
}

export interface AvailabilityValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    rule_id?: string;
  }>;
  overlaps: Array<{
    rule1_id: string;
    rule2_id: string;
    day_of_week: number;
    overlap_start: string;
    overlap_end: string;
  }>;
}

export interface CopyWeekRequest {
  source_week_start: string;
  target_week_start: string;
  staff_ids?: string[];
}

export interface AvailabilitySummary {
  total_hours: number;
  staff_summary: Array<{
    staff_id: string;
    staff_name: string;
    total_hours: number;
    days_available: number;
  }>;
}

// ===== API FUNCTIONS =====

/**
 * Create a new availability rule
 */
export async function createAvailabilityRule(
  rule: CreateAvailabilityRuleRequest,
  idempotencyKey?: string
): Promise<AvailabilityRule> {
  const key = idempotencyKey || generateIdempotencyKey();

  try {
    const response = await apiClient.post<ApiResponse<AvailabilityRule>>(
      ENDPOINTS.RULES,
      rule,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to create availability rule');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error creating availability rule:', error);
    throw error;
  }
}

/**
 * Update an existing availability rule
 */
export async function updateAvailabilityRule(
  ruleId: string,
  updates: UpdateAvailabilityRuleRequest,
  idempotencyKey?: string
): Promise<AvailabilityRule> {
  const key = idempotencyKey || generateIdempotencyKey();

  try {
    const response = await apiClient.put<ApiResponse<AvailabilityRule>>(
      `${ENDPOINTS.RULES}/${ruleId}`,
      updates,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to update availability rule');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error updating availability rule:', error);
    throw error;
  }
}

/**
 * Delete an availability rule
 */
export async function deleteAvailabilityRule(
  ruleId: string,
  idempotencyKey?: string
): Promise<void> {
  const key = idempotencyKey || generateIdempotencyKey();

  try {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${ENDPOINTS.RULES}/${ruleId}`,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete availability rule');
    }
  } catch (error) {
    console.error('Error deleting availability rule:', error);
    throw error;
  }
}

/**
 * Get all availability rules for a tenant
 */
export async function getAvailabilityRules(): Promise<AvailabilityRule[]> {
  try {
    const response = await apiClient.get<ApiResponse<AvailabilityRule[]>>(
      ENDPOINTS.RULES
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch availability rules');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error fetching availability rules:', error);
    throw error;
  }
}

/**
 * Get availability rules for a specific staff member
 */
export async function getAvailabilityRulesForStaff(staffId: string): Promise<AvailabilityRule[]> {
  try {
    const response = await apiClient.get<ApiResponse<AvailabilityRule[]>>(
      `${ENDPOINTS.RULES}?staff_id=${staffId}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch staff availability rules');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error fetching staff availability rules:', error);
    throw error;
  }
}

/**
 * Bulk update availability rules
 */
export async function bulkUpdateAvailabilityRules(
  request: BulkAvailabilityUpdateRequest,
  idempotencyKey?: string
): Promise<BulkAvailabilityUpdateResponse> {
  const key = idempotencyKey || generateIdempotencyKey();

  try {
    const response = await apiClient.post<ApiResponse<BulkAvailabilityUpdateResponse>>(
      ENDPOINTS.RULES_BULK,
      request,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to bulk update availability rules');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error bulk updating availability rules:', error);
    throw error;
  }
}

/**
 * Validate availability rules for overlaps and conflicts
 */
export async function validateAvailabilityRulesAPI(
  rules: CreateAvailabilityRuleRequest[]
): Promise<AvailabilityValidationResult> {
  try {
    const response = await apiClient.post<ApiResponse<AvailabilityValidationResult>>(
      ENDPOINTS.RULES_VALIDATE,
      { rules }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to validate availability rules');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error validating availability rules:', error);
    throw error;
  }
}

/**
 * Copy availability rules from one week to another
 */
export async function copyWeekAvailability(
  request: CopyWeekRequest,
  idempotencyKey?: string
): Promise<AvailabilityRule[]> {
  const key = idempotencyKey || generateIdempotencyKey();

  try {
    const response = await apiClient.post<ApiResponse<AvailabilityRule[]>>(
      ENDPOINTS.RULES_COPY_WEEK,
      request,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to copy week availability');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error copying week availability:', error);
    throw error;
  }
}

/**
 * Get availability summary for a date range
 */
export async function getAvailabilitySummary(
  startDate: string,
  endDate: string,
  staffIds?: string[]
): Promise<AvailabilitySummary> {
  try {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    
    if (staffIds?.length) {
      staffIds.forEach(id => params.append('staff_ids', id));
    }

    const response = await apiClient.get<ApiResponse<AvailabilitySummary>>(
      `${ENDPOINTS.RULES_SUMMARY}?${params.toString()}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch availability summary');
    }

    return response.data.data;
  } catch (error) {
    console.error('Error fetching availability summary:', error);
    throw error;
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Convert TimeBlock to CreateAvailabilityRuleRequest
 */
export function timeBlockToCreateRequest(timeBlock: TimeBlock): CreateAvailabilityRuleRequest {
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
}

/**
 * Convert AvailabilityRule to TimeBlock
 */
export function availabilityRuleToTimeBlock(
  rule: AvailabilityRule,
  staffName?: string,
  staffRole?: string,
  staffColor?: string
): TimeBlock {
  return {
    id: rule.id,
    staff_id: rule.staff_id,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    break_start: rule.break_start,
    break_end: rule.break_end,
    is_recurring: rule.is_recurring,
    is_active: rule.is_active,
    staff_name: staffName,
    staff_role: staffRole,
    color: staffColor,
  };
}

/**
 * Validate and create availability rule with client-side validation
 */
export async function createAvailabilityRuleWithValidation(
  rule: CreateAvailabilityRuleRequest,
  idempotencyKey?: string
): Promise<AvailabilityRule> {
  // Client-side validation first
  const tempRule: AvailabilityRule = {
    id: 'temp',
    tenant_id: 'temp',
    staff_id: rule.staff_id,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_recurring: rule.is_recurring,
    break_start: rule.break_start,
    break_end: rule.break_end,
    is_active: rule.is_active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const validation = validateAvailabilityRule(tempRule);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  return createAvailabilityRule(rule, idempotencyKey);
}

/**
 * Validate and bulk update availability rules with client-side validation
 */
export async function bulkUpdateAvailabilityRulesWithValidation(
  request: BulkAvailabilityUpdateRequest,
  idempotencyKey?: string
): Promise<BulkAvailabilityUpdateResponse> {
  // Client-side validation first
  const tempRules: AvailabilityRule[] = request.rules.map((rule, index) => ({
    id: `temp-${index}`,
    tenant_id: 'temp',
    staff_id: rule.staff_id,
    day_of_week: rule.day_of_week,
    start_time: rule.start_time,
    end_time: rule.end_time,
    is_recurring: rule.is_recurring,
    break_start: rule.break_start,
    break_end: rule.break_end,
    is_active: rule.is_active ?? true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const validation = validateAvailabilityRules(tempRules);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  return bulkUpdateAvailabilityRules(request, idempotencyKey);
}

// ===== EXPORTS =====

export const availabilityApi = {
  createRule: createAvailabilityRule,
  updateRule: updateAvailabilityRule,
  deleteRule: deleteAvailabilityRule,
  getRules: getAvailabilityRules,
  getRulesForStaff: getAvailabilityRulesForStaff,
  bulkUpdateRules: bulkUpdateAvailabilityRules,
  validateRules: validateAvailabilityRulesAPI,
  copyWeek: copyWeekAvailability,
  getSummary: getAvailabilitySummary,
  createRuleWithValidation: createAvailabilityRuleWithValidation,
  bulkUpdateWithValidation: bulkUpdateAvailabilityRulesWithValidation,
  timeBlockToCreateRequest,
  availabilityRuleToTimeBlock,
};
