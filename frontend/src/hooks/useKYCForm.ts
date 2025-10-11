/**
 * useKYCForm Hook
 * 
 * Custom hook for managing KYC form state, validation, and submission.
 * Handles business verification form data and validation logic.
 */

import { useState, useCallback, useMemo } from 'react';
import { telemetry } from '../services/telemetry';
import type {
  KYCFormData,
  KYCValidationErrors,
  KYCAddress,
  PayoutDestination,
} from '../api/types/payments';
import {
  validateEmail,
  validatePhone,
  validateStatementDescriptor,
  validateTaxId,
  validateRoutingNumber,
  validateAccountNumber,
} from '../api/types/payments';

interface UseKYCFormOptions {
  tenantId: string;
  initialData?: Partial<KYCFormData>;
  onError?: (error: string) => void;
  onSuccess?: (data: KYCFormData) => void;
}

interface UseKYCFormReturn {
  // State
  formData: KYCFormData;
  errors: KYCValidationErrors;
  isSubmitting: boolean;
  isValid: boolean;

  // Form Actions
  updateField: (field: keyof KYCFormData, value: any) => void;
  updateAddress: (field: keyof KYCAddress, value: string) => void;
  updatePayoutDestination: (field: keyof PayoutDestination, value: any) => void;
  setPayoutType: (type: 'bank_account' | 'card') => void;
  
  // Validation
  validateField: (field: keyof KYCFormData) => boolean;
  validateForm: () => boolean;
  validateAddress: () => boolean;
  validatePayoutDestination: () => boolean;
  
  // Utilities
  clearErrors: () => void;
  reset: () => void;
  getFieldError: (field: string) => string | undefined;
}

export const useKYCForm = (options: UseKYCFormOptions): UseKYCFormReturn => {
  const { tenantId, initialData, onError, onSuccess } = options;

  // State
  const [formData, setFormData] = useState<KYCFormData>({
    legal_name: '',
    dba_name: '',
    representative_name: '',
    representative_email: '',
    representative_phone: '',
    business_type: 'llc',
    tax_id: '',
    address: {
      street: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: 'US',
    },
    payout_destination: {
      type: 'bank_account',
      account_holder_name: '',
      account_holder_type: 'company',
      routing_number: '',
      account_number: '',
    },
    statement_descriptor: '',
    tax_display: 'inclusive',
    currency: 'USD',
    ...initialData
  });

  const [errors, setErrors] = useState<KYCValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Reset form to initial state
  const reset = useCallback(() => {
    setFormData({
      legal_name: '',
      dba_name: '',
      representative_name: '',
      representative_email: '',
      representative_phone: '',
      business_type: 'llc',
      tax_id: '',
      address: {
        street: '',
        city: '',
        state_province: '',
        postal_code: '',
        country: 'US',
      },
      payout_destination: {
        type: 'bank_account',
        account_holder_name: '',
        account_holder_type: 'company',
        routing_number: '',
        account_number: '',
      },
      statement_descriptor: '',
      tax_display: 'inclusive',
      currency: 'USD',
      ...initialData
    });
    setErrors({});
  }, [initialData]);

  // Update a form field
  const updateField = useCallback((field: keyof KYCFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Emit analytics event for field changes
    telemetry.track('kyc.field_updated', {
      tenant_id: tenantId,
      field,
      has_value: !!value,
    });
  }, [errors, tenantId]);

  // Update address field
  const updateAddress = useCallback((field: keyof KYCAddress, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
    
    // Clear error when user starts typing
    if (errors.address?.[field]) {
      setErrors(prev => ({
        ...prev,
        address: { ...prev.address, [field]: undefined }
      }));
    }

    // Emit analytics event
    telemetry.track('kyc.address_field_updated', {
      tenant_id: tenantId,
      field,
      has_value: !!value,
    });
  }, [errors.address, tenantId]);

  // Update payout destination field
  const updatePayoutDestination = useCallback((field: keyof PayoutDestination, value: any) => {
    setFormData(prev => ({
      ...prev,
      payout_destination: { ...prev.payout_destination, [field]: value }
    }));
    
    // Clear error when user starts typing
    if (errors.payout_destination?.[field]) {
      setErrors(prev => ({
        ...prev,
        payout_destination: { ...prev.payout_destination, [field]: undefined }
      }));
    }

    // Emit analytics event
    telemetry.track('kyc.payout_field_updated', {
      tenant_id: tenantId,
      field,
      has_value: !!value,
    });
  }, [errors.payout_destination, tenantId]);

  // Set payout type and reset related fields
  const setPayoutType = useCallback((type: 'bank_account' | 'card') => {
    const newPayoutDestination: PayoutDestination = {
      type,
      account_holder_name: formData.payout_destination.account_holder_name,
      account_holder_type: formData.payout_destination.account_holder_type,
    };

    if (type === 'bank_account') {
      newPayoutDestination.routing_number = '';
      newPayoutDestination.account_number = '';
    } else {
      newPayoutDestination.card_number = '';
      newPayoutDestination.expiry_month = undefined;
      newPayoutDestination.expiry_year = undefined;
    }

    setFormData(prev => ({
      ...prev,
      payout_destination: newPayoutDestination
    }));

    // Clear payout destination errors
    setErrors(prev => ({
      ...prev,
      payout_destination: {}
    }));

    // Emit analytics event
    telemetry.track('kyc.payout_type_changed', {
      tenant_id: tenantId,
      payout_type: type,
    });
  }, [formData.payout_destination, tenantId]);

  // Validate a single field
  const validateField = useCallback((field: keyof KYCFormData): boolean => {
    const newErrors: KYCValidationErrors = { ...errors };

    switch (field) {
      case 'legal_name':
        if (!formData.legal_name.trim()) {
          newErrors.legal_name = 'Legal business name is required';
        } else {
          delete newErrors.legal_name;
        }
        break;

      case 'representative_name':
        if (!formData.representative_name.trim()) {
          newErrors.representative_name = 'Representative name is required';
        } else {
          delete newErrors.representative_name;
        }
        break;

      case 'representative_email':
        if (!formData.representative_email.trim()) {
          newErrors.representative_email = 'Representative email is required';
        } else if (!validateEmail(formData.representative_email)) {
          newErrors.representative_email = 'Please enter a valid email address';
        } else {
          delete newErrors.representative_email;
        }
        break;

      case 'representative_phone':
        if (!formData.representative_phone.trim()) {
          newErrors.representative_phone = 'Representative phone is required';
        } else if (!validatePhone(formData.representative_phone)) {
          newErrors.representative_phone = 'Please enter a valid phone number';
        } else {
          delete newErrors.representative_phone;
        }
        break;

      case 'tax_id':
        if (formData.tax_id && !validateTaxId(formData.tax_id)) {
          newErrors.tax_id = 'Please enter a valid tax ID (9 digits)';
        } else {
          delete newErrors.tax_id;
        }
        break;

      case 'statement_descriptor':
        if (!formData.statement_descriptor.trim()) {
          newErrors.statement_descriptor = 'Statement descriptor is required';
        } else if (!validateStatementDescriptor(formData.statement_descriptor)) {
          newErrors.statement_descriptor = 'Statement descriptor must be 5-22 characters, letters and numbers only';
        } else {
          delete newErrors.statement_descriptor;
        }
        break;
    }

    setErrors(newErrors);
    return !newErrors[field];
  }, [formData, errors]);

  // Validate address
  const validateAddress = useCallback((): boolean => {
    const newErrors: KYCValidationErrors = { ...errors };
    const addressErrors: any = {};

    if (!formData.address.street.trim()) {
      addressErrors.street = 'Street address is required';
    }
    if (!formData.address.city.trim()) {
      addressErrors.city = 'City is required';
    }
    if (!formData.address.state_province.trim()) {
      addressErrors.state_province = 'State/Province is required';
    }
    if (!formData.address.postal_code.trim()) {
      addressErrors.postal_code = 'Postal code is required';
    }

    if (Object.keys(addressErrors).length > 0) {
      newErrors.address = addressErrors;
    } else {
      delete newErrors.address;
    }

    setErrors(newErrors);
    return Object.keys(addressErrors).length === 0;
  }, [formData.address, errors]);

  // Validate payout destination
  const validatePayoutDestination = useCallback((): boolean => {
    const newErrors: KYCValidationErrors = { ...errors };
    const payoutErrors: any = {};

    if (!formData.payout_destination.account_holder_name.trim()) {
      payoutErrors.account_holder_name = 'Account holder name is required';
    }

    if (formData.payout_destination.type === 'bank_account') {
      if (!formData.payout_destination.routing_number?.trim()) {
        payoutErrors.routing_number = 'Routing number is required';
      } else if (!validateRoutingNumber(formData.payout_destination.routing_number)) {
        payoutErrors.routing_number = 'Please enter a valid 9-digit routing number';
      }

      if (!formData.payout_destination.account_number?.trim()) {
        payoutErrors.account_number = 'Account number is required';
      } else if (!validateAccountNumber(formData.payout_destination.account_number)) {
        payoutErrors.account_number = 'Please enter a valid account number';
      }
    }

    if (Object.keys(payoutErrors).length > 0) {
      newErrors.payout_destination = payoutErrors;
    } else {
      delete newErrors.payout_destination;
    }

    setErrors(newErrors);
    return Object.keys(payoutErrors).length === 0;
  }, [formData.payout_destination, errors]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    const newErrors: KYCValidationErrors = {};

    // Validate main fields
    if (!formData.legal_name.trim()) {
      newErrors.legal_name = 'Legal business name is required';
    }

    if (!formData.representative_name.trim()) {
      newErrors.representative_name = 'Representative name is required';
    }

    if (!formData.representative_email.trim()) {
      newErrors.representative_email = 'Representative email is required';
    } else if (!validateEmail(formData.representative_email)) {
      newErrors.representative_email = 'Please enter a valid email address';
    }

    if (!formData.representative_phone.trim()) {
      newErrors.representative_phone = 'Representative phone is required';
    } else if (!validatePhone(formData.representative_phone)) {
      newErrors.representative_phone = 'Please enter a valid phone number';
    }

    if (formData.tax_id && !validateTaxId(formData.tax_id)) {
      newErrors.tax_id = 'Please enter a valid tax ID (9 digits)';
    }

    // Validate address
    const addressErrors: any = {};
    if (!formData.address.street.trim()) {
      addressErrors.street = 'Street address is required';
    }
    if (!formData.address.city.trim()) {
      addressErrors.city = 'City is required';
    }
    if (!formData.address.state_province.trim()) {
      addressErrors.state_province = 'State/Province is required';
    }
    if (!formData.address.postal_code.trim()) {
      addressErrors.postal_code = 'Postal code is required';
    }
    if (Object.keys(addressErrors).length > 0) {
      newErrors.address = addressErrors;
    }

    // Validate payout destination
    const payoutErrors: any = {};
    if (!formData.payout_destination.account_holder_name.trim()) {
      payoutErrors.account_holder_name = 'Account holder name is required';
    }

    if (formData.payout_destination.type === 'bank_account') {
      if (!formData.payout_destination.routing_number?.trim()) {
        payoutErrors.routing_number = 'Routing number is required';
      } else if (!validateRoutingNumber(formData.payout_destination.routing_number)) {
        payoutErrors.routing_number = 'Please enter a valid 9-digit routing number';
      }

      if (!formData.payout_destination.account_number?.trim()) {
        payoutErrors.account_number = 'Account number is required';
      } else if (!validateAccountNumber(formData.payout_destination.account_number)) {
        payoutErrors.account_number = 'Please enter a valid account number';
      }
    }

    if (Object.keys(payoutErrors).length > 0) {
      newErrors.payout_destination = payoutErrors;
    }

    // Validate statement descriptor
    if (!formData.statement_descriptor.trim()) {
      newErrors.statement_descriptor = 'Statement descriptor is required';
    } else if (!validateStatementDescriptor(formData.statement_descriptor)) {
      newErrors.statement_descriptor = 'Statement descriptor must be 5-22 characters, letters and numbers only';
    }

    setErrors(newErrors);

    // Emit analytics event
    telemetry.track('kyc.form_validated', {
      tenant_id: tenantId,
      is_valid: Object.keys(newErrors).length === 0,
      error_count: Object.keys(newErrors).length,
    });

    return Object.keys(newErrors).length === 0;
  }, [formData, tenantId]);

  // Get error for a specific field
  const getFieldError = useCallback((field: string): string | undefined => {
    const fieldParts = field.split('.');
    if (fieldParts.length === 1) {
      return errors[fieldParts[0] as keyof KYCValidationErrors] as string;
    } else if (fieldParts.length === 2) {
      const parentField = fieldParts[0] as keyof KYCValidationErrors;
      const childField = fieldParts[1];
      const parentError = errors[parentField];
      if (parentError && typeof parentError === 'object') {
        return (parentError as any)[childField];
      }
    }
    return undefined;
  }, [errors]);

  // Computed values
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0 && 
           formData.legal_name.trim() !== '' &&
           formData.representative_name.trim() !== '' &&
           formData.representative_email.trim() !== '' &&
           formData.representative_phone.trim() !== '' &&
           formData.address.street.trim() !== '' &&
           formData.address.city.trim() !== '' &&
           formData.address.state_province.trim() !== '' &&
           formData.address.postal_code.trim() !== '' &&
           formData.payout_destination.account_holder_name.trim() !== '' &&
           formData.statement_descriptor.trim() !== '';
  }, [errors, formData]);

  return {
    // State
    formData,
    errors,
    isSubmitting,
    isValid,

    // Form Actions
    updateField,
    updateAddress,
    updatePayoutDestination,
    setPayoutType,
    
    // Validation
    validateField,
    validateForm,
    validateAddress,
    validatePayoutDestination,
    
    // Utilities
    clearErrors,
    reset,
    getFieldError,
  };
};

