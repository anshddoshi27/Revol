/**
 * Policies API Service
 * 
 * Service functions for policies-related API endpoints.
 * Handles booking policies, confirmation messages, and checkout warnings.
 */

import { tithiApiClient } from '../client';
import type {
  BookingPolicy,
  BookingPolicyResponse,
  CreateBookingPolicyRequest,
  UpdateBookingPolicyRequest,
  ConfirmationMessage,
  ConfirmationMessageResponse,
  CreateConfirmationMessageRequest,
  UpdateConfirmationMessageRequest,
  CheckoutWarning,
  CheckoutWarningResponse,
  CreateCheckoutWarningRequest,
  UpdateCheckoutWarningRequest,
} from '../types/policies';

/**
 * Policies API service
 */
export const policiesService = {
  // ===== BOOKING POLICIES =====

  /**
   * Get booking policy for the current tenant
   */
  getBookingPolicy: async (): Promise<BookingPolicyResponse | null> => {
    const client = tithiApiClient();
    try {
      return await client.get<BookingPolicyResponse>('/api/v1/admin/policies/booking');
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create or update booking policy
   */
  createOrUpdateBookingPolicy: async (policyData: CreateBookingPolicyRequest): Promise<BookingPolicyResponse> => {
    const client = tithiApiClient();
    return client.post<BookingPolicyResponse>('/api/v1/admin/policies/booking', policyData);
  },

  /**
   * Update existing booking policy
   */
  updateBookingPolicy: async (policyId: string, policyData: UpdateBookingPolicyRequest): Promise<BookingPolicyResponse> => {
    const client = tithiApiClient();
    return client.put<BookingPolicyResponse>(`/api/v1/admin/policies/booking/${policyId}`, policyData);
  },

  /**
   * Delete booking policy
   */
  deleteBookingPolicy: async (policyId: string): Promise<void> => {
    const client = tithiApiClient();
    await client.delete(`/api/v1/admin/policies/booking/${policyId}`);
  },

  // ===== CONFIRMATION MESSAGES =====

  /**
   * Get confirmation message for the current tenant
   */
  getConfirmationMessage: async (): Promise<ConfirmationMessageResponse | null> => {
    const client = tithiApiClient();
    try {
      return await client.get<ConfirmationMessageResponse>('/api/v1/admin/policies/confirmation-message');
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create or update confirmation message
   */
  createOrUpdateConfirmationMessage: async (messageData: CreateConfirmationMessageRequest): Promise<ConfirmationMessageResponse> => {
    const client = tithiApiClient();
    return client.post<ConfirmationMessageResponse>('/api/v1/admin/policies/confirmation-message', messageData);
  },

  /**
   * Update existing confirmation message
   */
  updateConfirmationMessage: async (messageId: string, messageData: UpdateConfirmationMessageRequest): Promise<ConfirmationMessageResponse> => {
    const client = tithiApiClient();
    return client.put<ConfirmationMessageResponse>(`/api/v1/admin/policies/confirmation-message/${messageId}`, messageData);
  },

  /**
   * Delete confirmation message
   */
  deleteConfirmationMessage: async (messageId: string): Promise<void> => {
    const client = tithiApiClient();
    await client.delete(`/api/v1/admin/policies/confirmation-message/${messageId}`);
  },

  // ===== CHECKOUT WARNINGS =====

  /**
   * Get checkout warning for the current tenant
   */
  getCheckoutWarning: async (): Promise<CheckoutWarningResponse | null> => {
    const client = tithiApiClient();
    try {
      return await client.get<CheckoutWarningResponse>('/api/v1/admin/policies/checkout-warning');
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create or update checkout warning
   */
  createOrUpdateCheckoutWarning: async (warningData: CreateCheckoutWarningRequest): Promise<CheckoutWarningResponse> => {
    const client = tithiApiClient();
    return client.post<CheckoutWarningResponse>('/api/v1/admin/policies/checkout-warning', warningData);
  },

  /**
   * Update existing checkout warning
   */
  updateCheckoutWarning: async (warningId: string, warningData: UpdateCheckoutWarningRequest): Promise<CheckoutWarningResponse> => {
    const client = tithiApiClient();
    return client.put<CheckoutWarningResponse>(`/api/v1/admin/policies/checkout-warning/${warningId}`, warningData);
  },

  /**
   * Delete checkout warning
   */
  deleteCheckoutWarning: async (warningId: string): Promise<void> => {
    const client = tithiApiClient();
    await client.delete(`/api/v1/admin/policies/checkout-warning/${warningId}`);
  },

  // ===== PREVIEW ENDPOINTS =====

  /**
   * Preview confirmation message with sample data
   */
  previewConfirmationMessage: async (content: string): Promise<{ preview: string }> => {
    const client = tithiApiClient();
    return client.post<{ preview: string }>('/api/v1/admin/policies/confirmation-message/preview', { content });
  },

  /**
   * Preview checkout warning
   */
  previewCheckoutWarning: async (warningData: CreateCheckoutWarningRequest): Promise<{ preview: string }> => {
    const client = tithiApiClient();
    return client.post<{ preview: string }>('/api/v1/admin/policies/checkout-warning/preview', warningData);
  },
};

/**
 * Utility functions for policies
 */
export const policiesUtils = {
  /**
   * Validate booking policy data
   */
  validateBookingPolicy: (policy: CreateBookingPolicyRequest): string[] => {
    const errors: string[] = [];

    if (policy.cancellation_cutoff_hours < 0) {
      errors.push('Cancellation cutoff hours must be non-negative');
    }

    if (policy.no_show_fee_percent < 0 || policy.no_show_fee_percent > 100) {
      errors.push('No-show fee percentage must be between 0 and 100');
    }

    if (policy.no_show_fee_flat_cents && policy.no_show_fee_flat_cents < 0) {
      errors.push('No-show flat fee must be non-negative');
    }

    if (!policy.refund_policy.trim()) {
      errors.push('Refund policy is required');
    }

    if (!policy.cash_logistics.trim()) {
      errors.push('Cash logistics information is required');
    }

    return errors;
  },

  /**
   * Validate confirmation message data
   */
  validateConfirmationMessage: (message: CreateConfirmationMessageRequest): string[] => {
    const errors: string[] = [];

    if (!message.content.trim()) {
      errors.push('Confirmation message content is required');
    }

    if (message.content.length > 2000) {
      errors.push('Confirmation message cannot exceed 2000 characters');
    }

    return errors;
  },

  /**
   * Validate checkout warning data
   */
  validateCheckoutWarning: (warning: CreateCheckoutWarningRequest): string[] => {
    const errors: string[] = [];

    if (!warning.title.trim()) {
      errors.push('Warning title is required');
    }

    if (!warning.message.trim()) {
      errors.push('Warning message is required');
    }

    if (warning.acknowledgment_required && !warning.acknowledgment_text.trim()) {
      errors.push('Acknowledgment text is required when acknowledgment is required');
    }

    if (warning.title.length > 100) {
      errors.push('Warning title cannot exceed 100 characters');
    }

    if (warning.message.length > 500) {
      errors.push('Warning message cannot exceed 500 characters');
    }

    if (warning.acknowledgment_text.length > 200) {
      errors.push('Acknowledgment text cannot exceed 200 characters');
    }

    return errors;
  },

  /**
   * Format policy for display
   */
  formatPolicyForDisplay: (policy: BookingPolicy): string => {
    const parts: string[] = [];

    if (policy.cancellation_cutoff_hours > 0) {
      parts.push(`Cancellations must be made at least ${policy.cancellation_cutoff_hours} hours in advance.`);
    }

    if (policy.no_show_fee_percent > 0) {
      parts.push(`No-shows will be charged ${policy.no_show_fee_percent}% of the service fee.`);
    }

    if (policy.no_show_fee_flat_cents && policy.no_show_fee_flat_cents > 0) {
      const fee = (policy.no_show_fee_flat_cents / 100).toFixed(2);
      parts.push(`No-shows will be charged a flat fee of $${fee}.`);
    }

    if (policy.refund_policy) {
      parts.push(`Refund Policy: ${policy.refund_policy}`);
    }

    if (policy.cash_logistics) {
      parts.push(`Cash Payment: ${policy.cash_logistics}`);
    }

    return parts.join(' ');
  },

  /**
   * Extract variables from confirmation message content
   */
  extractVariables: (content: string): string[] => {
    const variableRegex = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  },

  /**
   * Replace variables in confirmation message content
   */
  replaceVariables: (content: string, variables: Record<string, string>): string => {
    let result = content;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  },
};


