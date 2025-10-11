/**
 * Availability API Service
 * 
 * Service functions for availability management and booking slots.
 * Connects to the real backend availability APIs.
 */

import { apiClient } from '../client';

// Types
export interface AvailabilityRule {
  id: string;
  staffId: string;
  staffName: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  time: string; // HH:MM format
  available: boolean;
  staffId: string;
  staffName: string;
  bookingId?: string;
}

export interface AvailabilityFilters {
  staffId?: string;
  date?: string;
  serviceId?: string;
  duration?: number;
}

export interface CreateAvailabilityRuleData {
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface BulkAvailabilityRule {
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// Availability Rules API
export const getAvailabilityRules = async (filters: AvailabilityFilters = {}): Promise<AvailabilityRule[]> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.staffId) params.append('staff_id', filters.staffId);

    const response = await apiClient.get(`/availability/rules?${params.toString()}`);
    return response.data.rules;
  } catch (error) {
    console.error('Failed to fetch availability rules:', error);
    throw error;
  }
};

export const getAvailabilityRuleById = async (ruleId: string): Promise<AvailabilityRule> => {
  try {
    const response = await apiClient.get(`/api/v1/availability/rules/${ruleId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch availability rule:', error);
    throw error;
  }
};

export const createAvailabilityRule = async (ruleData: CreateAvailabilityRuleData): Promise<AvailabilityRule> => {
  try {
    const response = await apiClient.post('/api/v1/availability/rules', ruleData);
    return response.data;
  } catch (error) {
    console.error('Failed to create availability rule:', error);
    throw error;
  }
};

export const updateAvailabilityRule = async (ruleId: string, ruleData: Partial<CreateAvailabilityRuleData>): Promise<AvailabilityRule> => {
  try {
    const response = await apiClient.put(`/api/v1/availability/rules/${ruleId}`, ruleData);
    return response.data;
  } catch (error) {
    console.error('Failed to update availability rule:', error);
    throw error;
  }
};

export const deleteAvailabilityRule = async (ruleId: string): Promise<void> => {
  try {
    await apiClient.delete(`/api/v1/availability/rules/${ruleId}`);
  } catch (error) {
    console.error('Failed to delete availability rule:', error);
    throw error;
  }
};

// Bulk Operations
export const createBulkAvailabilityRules = async (rules: BulkAvailabilityRule[]): Promise<AvailabilityRule[]> => {
  try {
    const response = await apiClient.post('/api/v1/availability/rules/bulk', { rules });
    return response.data.rules;
  } catch (error) {
    console.error('Failed to create bulk availability rules:', error);
    throw error;
  }
};

export const updateBulkAvailabilityRules = async (updates: { ruleId: string; updates: Partial<CreateAvailabilityRuleData> }[]): Promise<AvailabilityRule[]> => {
  try {
    const response = await apiClient.put('/api/v1/availability/rules/bulk', { updates });
    return response.data.rules;
  } catch (error) {
    console.error('Failed to update bulk availability rules:', error);
    throw error;
  }
};

export const deleteBulkAvailabilityRules = async (ruleIds: string[]): Promise<void> => {
  try {
    await apiClient.delete('/api/v1/availability/rules/bulk', { 
      data: { rule_ids: ruleIds } 
    });
  } catch (error) {
    console.error('Failed to delete bulk availability rules:', error);
    throw error;
  }
};

// Time Slots API
export const getAvailableTimeSlots = async (filters: AvailabilityFilters): Promise<TimeSlot[]> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.staffId) params.append('staff_id', filters.staffId);
    if (filters.date) params.append('date', filters.date);
    if (filters.serviceId) params.append('service_id', filters.serviceId);
    if (filters.duration) params.append('duration', filters.duration.toString());

    const response = await apiClient.get(`/api/v1/availability/slots?${params.toString()}`);
    return response.data.slots;
  } catch (error) {
    console.error('Failed to fetch available time slots:', error);
    throw error;
  }
};

export const getTimeSlotsForDate = async (date: string, staffId?: string): Promise<TimeSlot[]> => {
  try {
    const params = new URLSearchParams();
    params.append('date', date);
    if (staffId) params.append('staff_id', staffId);

    const response = await apiClient.get(`/api/v1/availability/slots?${params.toString()}`);
    return response.data.slots;
  } catch (error) {
    console.error('Failed to fetch time slots for date:', error);
    throw error;
  }
};

// Availability Summary
export const getAvailabilitySummary = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/api/v1/availability/summary');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch availability summary:', error);
    throw error;
  }
};

// Public Availability API
export const getPublicAvailableTimeSlots = async (businessSlug: string, filters: AvailabilityFilters): Promise<TimeSlot[]> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.staffId) params.append('staff_id', filters.staffId);
    if (filters.date) params.append('date', filters.date);
    if (filters.serviceId) params.append('service_id', filters.serviceId);
    if (filters.duration) params.append('duration', filters.duration.toString());

    const response = await apiClient.get(`/v1/${businessSlug}/availability/slots?${params.toString()}`);
    return response.data.slots;
  } catch (error) {
    console.error('Failed to fetch public available time slots:', error);
    throw error;
  }
};

export const getPublicAvailabilityCalendar = async (businessSlug: string, month: string, year: string): Promise<any> => {
  try {
    const response = await apiClient.get(`/v1/${businessSlug}/availability/calendar?month=${month}&year=${year}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch public availability calendar:', error);
    throw error;
  }
};

// Staff Availability
export const getStaffAvailability = async (staffId: string, date?: string): Promise<AvailabilityRule[]> => {
  try {
    const params = new URLSearchParams();
    params.append('staff_id', staffId);
    if (date) params.append('date', date);

    const response = await apiClient.get(`/api/v1/availability/staff?${params.toString()}`);
    return response.data.rules;
  } catch (error) {
    console.error('Failed to fetch staff availability:', error);
    throw error;
  }
};

export const updateStaffAvailability = async (staffId: string, rules: BulkAvailabilityRule[]): Promise<AvailabilityRule[]> => {
  try {
    const response = await apiClient.put(`/api/v1/availability/staff/${staffId}`, { rules });
    return response.data.rules;
  } catch (error) {
    console.error('Failed to update staff availability:', error);
    throw error;
  }
};

// Validation
export const validateAvailabilityRule = async (ruleData: CreateAvailabilityRuleData): Promise<{ valid: boolean; conflicts?: any[] }> => {
  try {
    const response = await apiClient.post('/api/v1/availability/validate', ruleData);
    return response.data;
  } catch (error) {
    console.error('Failed to validate availability rule:', error);
    throw error;
  }
};
