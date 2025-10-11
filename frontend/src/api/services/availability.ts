/**
 * Availability Service
 * 
 * API service for managing availability rules and time blocks.
 * Provides CRUD operations for availability management.
 */

import { apiClient } from '../client';
import { generateOperationIdempotencyKey, IDEMPOTENCY_OPERATIONS } from '../idempotency';
import type {
  AvailabilityRule,
  CreateAvailabilityRuleRequest,
  UpdateAvailabilityRuleRequest,
  AvailabilityRuleResponse,
  BulkAvailabilityUpdateRequest,
  BulkAvailabilityUpdateResponse,
  AvailabilityValidationResult,
  AvailabilityCalendarData,
} from '../types/availability';
import type { ApiResponse, TithiError } from '../types';

// Re-export the new API for backward compatibility
export { availabilityApi } from '../availabilityApi';

/**
 * Availability API Service
 */
export const availabilityService = {
  /**
   * Create a new availability rule
   */
  async createRule(
    rule: CreateAvailabilityRuleRequest,
    idempotencyKey?: string
  ): Promise<AvailabilityRuleResponse> {
    const key = idempotencyKey || generateOperationIdempotencyKey(
      IDEMPOTENCY_OPERATIONS.AVAILABILITY_UPDATE,
      rule.staff_id
    );

    const response = await apiClient.post<ApiResponse<AvailabilityRuleResponse>>(
      '/availability/rules',
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
  },

  /**
   * Update an existing availability rule
   */
  async updateRule(
    ruleId: string,
    updates: UpdateAvailabilityRuleRequest,
    idempotencyKey?: string
  ): Promise<AvailabilityRuleResponse> {
    const key = idempotencyKey || generateOperationIdempotencyKey(
      IDEMPOTENCY_OPERATIONS.AVAILABILITY_UPDATE,
      ruleId
    );

    const response = await apiClient.put<ApiResponse<AvailabilityRuleResponse>>(
      `/api/v1/availability/rules/${ruleId}`,
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
  },

  /**
   * Delete an availability rule
   */
  async deleteRule(
    ruleId: string,
    idempotencyKey?: string
  ): Promise<void> {
    const key = idempotencyKey || generateOperationIdempotencyKey(
      IDEMPOTENCY_OPERATIONS.AVAILABILITY_UPDATE,
      ruleId
    );

    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/v1/availability/rules/${ruleId}`,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete availability rule');
    }
  },

  /**
   * Get all availability rules for a tenant
   */
  async getRules(): Promise<AvailabilityRuleResponse[]> {
    const response = await apiClient.get<ApiResponse<AvailabilityRuleResponse[]>>(
      '/availability/rules'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch availability rules');
    }

    return response.data.data;
  },

  /**
   * Get availability rules for a specific staff member
   */
  async getRulesForStaff(staffId: string): Promise<AvailabilityRuleResponse[]> {
    const response = await apiClient.get<ApiResponse<AvailabilityRuleResponse[]>>(
      `/api/v1/availability/rules?staff_id=${staffId}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch staff availability rules');
    }

    return response.data.data;
  },

  /**
   * Bulk update availability rules
   */
  async bulkUpdateRules(
    request: BulkAvailabilityUpdateRequest,
    idempotencyKey?: string
  ): Promise<BulkAvailabilityUpdateResponse> {
    const key = idempotencyKey || generateOperationIdempotencyKey(
      IDEMPOTENCY_OPERATIONS.AVAILABILITY_UPDATE,
      'bulk'
    );

    const response = await apiClient.post<ApiResponse<BulkAvailabilityUpdateResponse>>(
      '/api/v1/availability/rules/bulk',
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
  },

  /**
   * Validate availability rules for overlaps and conflicts
   */
  async validateRules(rules: CreateAvailabilityRuleRequest[]): Promise<AvailabilityValidationResult> {
    const response = await apiClient.post<ApiResponse<AvailabilityValidationResult>>(
      '/api/v1/availability/rules/validate',
      { rules }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to validate availability rules');
    }

    return response.data.data;
  },

  /**
   * Get calendar data for availability display
   */
  async getCalendarData(
    startDate?: string,
    endDate?: string,
    staffIds?: string[]
  ): Promise<AvailabilityCalendarData> {
    const params = new URLSearchParams();
    
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (staffIds?.length) {
      staffIds.forEach(id => params.append('staff_ids', id));
    }

    const response = await apiClient.get<ApiResponse<AvailabilityCalendarData>>(
      `/api/v1/availability/calendar?${params.toString()}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch calendar data');
    }

    return response.data.data;
  },

  /**
   * Copy availability rules from one week to another
   */
  async copyWeek(
    sourceWeekStart: string,
    targetWeekStart: string,
    staffIds?: string[],
    idempotencyKey?: string
  ): Promise<AvailabilityRuleResponse[]> {
    const key = idempotencyKey || generateOperationIdempotencyKey(
      IDEMPOTENCY_OPERATIONS.AVAILABILITY_UPDATE,
      'copy-week'
    );

    const response = await apiClient.post<ApiResponse<AvailabilityRuleResponse[]>>(
      '/api/v1/availability/rules/copy-week',
      {
        source_week_start: sourceWeekStart,
        target_week_start: targetWeekStart,
        staff_ids: staffIds,
      },
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
  },

  /**
   * Get availability summary for a date range
   */
  async getAvailabilitySummary(
    startDate: string,
    endDate: string,
    staffIds?: string[]
  ): Promise<{
    total_hours: number;
    staff_summary: Array<{
      staff_id: string;
      staff_name: string;
      total_hours: number;
      days_available: number;
    }>;
  }> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    
    if (staffIds?.length) {
      staffIds.forEach(id => params.append('staff_ids', id));
    }

    const response = await apiClient.get<ApiResponse<{
      total_hours: number;
      staff_summary: Array<{
        staff_id: string;
        staff_name: string;
        total_hours: number;
        days_available: number;
      }>;
    }>>(
      `/api/v1/availability/summary?${params.toString()}`
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch availability summary');
    }

    return response.data.data;
  },
};

/**
 * Availability utility functions
 */
export const availabilityUtils = {
  /**
   * Convert time string to minutes since midnight
   */
  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  },

  /**
   * Convert minutes since midnight to time string
   */
  minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * Check if two time ranges overlap
   */
  timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  },

  /**
   * Calculate duration between two times in minutes
   */
  calculateDuration(startTime: string, endTime: string): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    return endMinutes - startMinutes;
  },

  /**
   * Generate time slots between start and end time
   */
  generateTimeSlots(
    startTime: string,
    endTime: string,
    intervalMinutes: number = 15
  ): string[] {
    const slots: string[] = [];
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
      slots.push(this.minutesToTime(minutes));
    }

    return slots;
  },

  /**
   * Format time for display
   */
  formatTime(time: string, format: '12h' | '24h' = '12h'): string {
    const [hours, minutes] = time.split(':').map(Number);
    
    if (format === '24h') {
      return time;
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  },

  /**
   * Get day name from day of week number
   */
  getDayName(dayOfWeek: number, short: boolean = false): string {
    const days = short 
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return days[dayOfWeek] || 'Unknown';
  },

  /**
   * Validate time format (HH:MM)
   */
  isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  },

  /**
   * Validate time range (start < end)
   */
  isValidTimeRange(startTime: string, endTime: string): boolean {
    if (!this.isValidTimeFormat(startTime) || !this.isValidTimeFormat(endTime)) {
      return false;
    }

    return this.timeToMinutes(startTime) < this.timeToMinutes(endTime);
  },
};
