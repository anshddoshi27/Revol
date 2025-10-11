/**
 * usePolicyManagement Hook
 * 
 * Custom hook for managing booking policy state and operations.
 * Handles policy CRUD operations, validation, and form state management.
 */

import { useState, useCallback, useMemo } from 'react';
import { policiesService, policiesUtils } from '../api/services/policies';
import { telemetry } from '../services/telemetry';
import type {
  BookingPolicy,
  BookingPolicyFormData,
  BookingPolicyValidationError,
  CreateBookingPolicyRequest,
  UpdateBookingPolicyRequest,
} from '../api/types/policies';

interface UsePolicyManagementOptions {
  initialPolicy?: BookingPolicy;
  onPolicyCreated?: (policy: BookingPolicy) => void;
  onPolicyUpdated?: (policy: BookingPolicy) => void;
  onPolicyDeleted?: (policyId: string) => void;
  onError?: (error: Error) => void;
}

interface UsePolicyManagementReturn {
  // State
  policy: BookingPolicy | null;
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  validationErrors: BookingPolicyValidationError[];

  // Operations
  createOrUpdatePolicy: (policyData: BookingPolicyFormData) => Promise<BookingPolicy | null>;
  updatePolicy: (policyId: string, policyData: Partial<BookingPolicyFormData>) => Promise<BookingPolicy | null>;
  deletePolicy: (policyId: string) => Promise<boolean>;
  loadPolicy: () => Promise<void>;
  clearErrors: () => void;

  // Validation
  validatePolicy: (policyData: BookingPolicyFormData) => BookingPolicyValidationError[];
  isPolicyValid: (policyData: BookingPolicyFormData) => boolean;

  // Utilities
  formatPolicyForDisplay: (policy: BookingPolicy) => string;
}

export const usePolicyManagement = (options: UsePolicyManagementOptions = {}): UsePolicyManagementReturn => {
  const { initialPolicy, onPolicyCreated, onPolicyUpdated, onPolicyDeleted, onError } = options;

  // State
  const [policy, setPolicy] = useState<BookingPolicy | null>(initialPolicy || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<BookingPolicyValidationError[]>([]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors({});
    setValidationErrors([]);
  }, []);

  // Validate policy data
  const validatePolicy = useCallback((policyData: BookingPolicyFormData): BookingPolicyValidationError[] => {
    const errors: BookingPolicyValidationError[] = [];
    const validationErrors = policiesUtils.validateBookingPolicy(policyData);

    validationErrors.forEach((error, index) => {
      errors.push({
        field: 'general',
        message: error,
        code: `VALIDATION_ERROR_${index}`,
      });
    });

    return errors;
  }, []);

  // Check if policy is valid
  const isPolicyValid = useCallback((policyData: BookingPolicyFormData): boolean => {
    return validatePolicy(policyData).length === 0;
  }, [validatePolicy]);

  // Load policy
  const loadPolicy = useCallback(async () => {
    try {
      setIsLoading(true);
      clearErrors();

      const response = await policiesService.getBookingPolicy();
      if (response) {
        const policyData: BookingPolicy = {
          id: response.id,
          tenant_id: response.tenant_id,
          cancellation_cutoff_hours: response.cancellation_cutoff_hours,
          no_show_fee_percent: response.no_show_fee_percent,
          no_show_fee_flat_cents: response.no_show_fee_flat_cents,
          refund_policy: response.refund_policy,
          cash_logistics: response.cash_logistics,
          is_active: response.is_active,
          created_at: response.created_at,
          updated_at: response.updated_at,
        };
        setPolicy(policyData);
      }
    } catch (error: any) {
      console.error('Failed to load policy:', error);
      setErrors({ general: error.message || 'Failed to load policy' });
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearErrors, onError]);

  // Create or update policy
  const createOrUpdatePolicy = useCallback(async (policyData: BookingPolicyFormData): Promise<BookingPolicy | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate policy data
      const validationErrors = validatePolicy(policyData);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        return null;
      }

      // Convert to API request format
      const createRequest: CreateBookingPolicyRequest = {
        cancellation_cutoff_hours: policyData.cancellation_cutoff_hours,
        no_show_fee_percent: policyData.no_show_fee_percent,
        no_show_fee_flat_cents: policyData.no_show_fee_flat_cents,
        refund_policy: policyData.refund_policy,
        cash_logistics: policyData.cash_logistics,
        is_active: policyData.is_active,
      };

      // Create or update policy via API
      const response = await policiesService.createOrUpdateBookingPolicy(createRequest);
      
      // Convert response to BookingPolicy
      const newPolicy: BookingPolicy = {
        id: response.id,
        tenant_id: response.tenant_id,
        cancellation_cutoff_hours: response.cancellation_cutoff_hours,
        no_show_fee_percent: response.no_show_fee_percent,
        no_show_fee_flat_cents: response.no_show_fee_flat_cents,
        refund_policy: response.refund_policy,
        cash_logistics: response.cash_logistics,
        is_active: response.is_active,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setPolicy(newPolicy);

      // Track success event
      telemetry.trackPolicyEvent('save_success', {
        policy_id: newPolicy.id,
        has_cancellation_cutoff: newPolicy.cancellation_cutoff_hours > 0,
        has_no_show_fee: newPolicy.no_show_fee_percent > 0,
        is_active: newPolicy.is_active,
      });

      // Call success callback
      if (policy?.id) {
        if (onPolicyUpdated) {
          onPolicyUpdated(newPolicy);
        }
      } else {
        if (onPolicyCreated) {
          onPolicyCreated(newPolicy);
        }
      }

      return newPolicy;
    } catch (error: any) {
      console.error('Failed to create/update policy:', error);
      
      // Handle validation errors
      if (error.status === 422 && error.validation_errors) {
        const validationErrors: BookingPolicyValidationError[] = error.validation_errors.map((err: any) => ({
          field: err.field,
          message: err.message,
          code: err.code,
        }));
        setValidationErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to save policy. Please try again.' 
        });
      }

      // Track error event
      telemetry.trackPolicyEvent('save_error', {
        error_code: error.error_code || 'UNKNOWN_ERROR',
        error_message: error.message,
      });

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [policy, validatePolicy, clearErrors, onPolicyCreated, onPolicyUpdated, onError]);

  // Update existing policy
  const updatePolicy = useCallback(async (policyId: string, policyData: Partial<BookingPolicyFormData>): Promise<BookingPolicy | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Convert to API request format
      const updateRequest: UpdateBookingPolicyRequest = {};
      
      if (policyData.cancellation_cutoff_hours !== undefined) {
        updateRequest.cancellation_cutoff_hours = policyData.cancellation_cutoff_hours;
      }
      if (policyData.no_show_fee_percent !== undefined) {
        updateRequest.no_show_fee_percent = policyData.no_show_fee_percent;
      }
      if (policyData.no_show_fee_flat_cents !== undefined) {
        updateRequest.no_show_fee_flat_cents = policyData.no_show_fee_flat_cents;
      }
      if (policyData.refund_policy !== undefined) {
        updateRequest.refund_policy = policyData.refund_policy;
      }
      if (policyData.cash_logistics !== undefined) {
        updateRequest.cash_logistics = policyData.cash_logistics;
      }
      if (policyData.is_active !== undefined) {
        updateRequest.is_active = policyData.is_active;
      }

      // Update policy via API
      const response = await policiesService.updateBookingPolicy(policyId, updateRequest);
      
      // Convert response to BookingPolicy
      const updatedPolicy: BookingPolicy = {
        id: response.id,
        tenant_id: response.tenant_id,
        cancellation_cutoff_hours: response.cancellation_cutoff_hours,
        no_show_fee_percent: response.no_show_fee_percent,
        no_show_fee_flat_cents: response.no_show_fee_flat_cents,
        refund_policy: response.refund_policy,
        cash_logistics: response.cash_logistics,
        is_active: response.is_active,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setPolicy(updatedPolicy);

      // Call success callback
      if (onPolicyUpdated) {
        onPolicyUpdated(updatedPolicy);
      }

      return updatedPolicy;
    } catch (error: any) {
      console.error('Failed to update policy:', error);
      
      // Handle validation errors
      if (error.status === 422 && error.validation_errors) {
        const validationErrors: BookingPolicyValidationError[] = error.validation_errors.map((err: any) => ({
          field: err.field,
          message: err.message,
          code: err.code,
        }));
        setValidationErrors(validationErrors);
      } else {
        setErrors({ 
          general: error.message || 'Failed to update policy. Please try again.' 
        });
      }

      if (onError) {
        onError(error);
      }

      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [clearErrors, onPolicyUpdated, onError]);

  // Delete policy
  const deletePolicy = useCallback(async (policyId: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      await policiesService.deleteBookingPolicy(policyId);
      
      // Update local state
      setPolicy(null);

      // Call success callback
      if (onPolicyDeleted) {
        onPolicyDeleted(policyId);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to delete policy:', error);
      setErrors({ 
        general: error.message || 'Failed to delete policy. Please try again.' 
      });

      if (onError) {
        onError(error);
      }

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [clearErrors, onPolicyDeleted, onError]);

  // Format policy for display
  const formatPolicyForDisplay = useCallback((policy: BookingPolicy): string => {
    return policiesUtils.formatPolicyForDisplay(policy);
  }, []);

  return {
    // State
    policy,
    isLoading,
    isSubmitting,
    errors,
    validationErrors,

    // Operations
    createOrUpdatePolicy,
    updatePolicy,
    deletePolicy,
    loadPolicy,
    clearErrors,

    // Validation
    validatePolicy,
    isPolicyValid,

    // Utilities
    formatPolicyForDisplay,
  };
};
