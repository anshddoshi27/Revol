/**
 * PolicyEditor Component
 * 
 * Component for editing booking policies including cancellation, no-show, refund, and cash policies.
 * Provides form validation and policy template selection.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type {
  BookingPolicy,
  BookingPolicyFormData,
  BookingPolicyValidationError,
  PolicyTemplate,
} from '../../api/types/policies';
import { DEFAULT_POLICY_TEMPLATES } from '../../api/types/policies';

interface PolicyEditorProps {
  policy?: BookingPolicy;
  onSave: (policy: BookingPolicyFormData) => Promise<boolean>;
  onCancel: () => void;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
  validationErrors?: BookingPolicyValidationError[];
  className?: string;
}

export const PolicyEditor: React.FC<PolicyEditorProps> = ({
  policy,
  onSave,
  onCancel,
  isSubmitting = false,
  errors = {},
  validationErrors = [],
  className = '',
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<PolicyTemplate | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors, isValid: isFormValid },
  } = useForm<BookingPolicyFormData>({
    defaultValues: {
      cancellation_cutoff_hours: policy?.cancellation_cutoff_hours || 24,
      no_show_fee_percent: policy?.no_show_fee_percent || 50,
      no_show_fee_flat_cents: policy?.no_show_fee_flat_cents,
      refund_policy: policy?.refund_policy || '',
      cash_logistics: policy?.cash_logistics || '',
      is_active: policy?.is_active ?? true,
    },
  });

  const watchedRefundPolicy = watch('refund_policy');
  const watchedCashLogistics = watch('cash_logistics');

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      switch (selectedTemplate.category) {
        case 'cancellation':
          setValue('cancellation_cutoff_hours', 24);
          break;
        case 'no_show':
          setValue('no_show_fee_percent', 50);
          break;
        case 'refund':
          setValue('refund_policy', selectedTemplate.template);
          break;
        case 'cash':
          setValue('cash_logistics', selectedTemplate.template);
          break;
      }
      setSelectedTemplate(null);
      setShowTemplates(false);
    }
  }, [selectedTemplate, setValue]);

  // Handle form submission
  const onSubmit = useCallback(async (data: BookingPolicyFormData) => {
    const success = await onSave(data);
    if (success) {
      // Form will be closed by parent component
    }
  }, [onSave]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: PolicyTemplate) => {
    setSelectedTemplate(template);
  }, []);

  // Get field error
  const getFieldError = useCallback((field: string): string | undefined => {
    // Check form validation errors first
    if (formErrors[field as keyof typeof formErrors]) {
      return formErrors[field as keyof typeof formErrors]?.message;
    }

    // Check validation errors from API
    const validationError = validationErrors.find(err => err.field === field);
    if (validationError) {
      return validationError.message;
    }

    // Check general errors
    if (errors[field]) {
      return errors[field];
    }

    return undefined;
  }, [formErrors, validationErrors, errors]);

  // Get general error
  const getGeneralError = useCallback((): string | undefined => {
    return errors.general || validationErrors.find(err => err.field === 'general')?.message;
  }, [errors, validationErrors]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Booking Policies
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Set up your cancellation, no-show, refund, and payment policies
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Templates
        </button>
      </div>

      {/* Template Selection */}
      {showTemplates && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-3">
            Policy Templates
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEFAULT_POLICY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateSelect(template)}
                className="text-left p-3 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="font-medium text-sm text-gray-900">
                  {template.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* General Error */}
      {getGeneralError() && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">
                {getGeneralError()}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Cancellation Policy */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Cancellation Policy
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="cancellation_cutoff_hours" className="block text-sm font-medium text-gray-700">
                Cancellation Cutoff (hours)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="cancellation_cutoff_hours"
                  min="0"
                  max="168"
                  {...register('cancellation_cutoff_hours', {
                    required: 'Cancellation cutoff is required',
                    min: { value: 0, message: 'Must be at least 0 hours' },
                    max: { value: 168, message: 'Cannot exceed 168 hours (1 week)' },
                  })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    getFieldError('cancellation_cutoff_hours')
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {getFieldError('cancellation_cutoff_hours') && (
                  <p className="mt-1 text-sm text-red-600">
                    {getFieldError('cancellation_cutoff_hours')}
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Customers must cancel at least this many hours before their appointment
              </p>
            </div>
          </div>
        </div>

        {/* No-Show Policy */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            No-Show Policy
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="no_show_fee_percent" className="block text-sm font-medium text-gray-700">
                No-Show Fee (percentage)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="no_show_fee_percent"
                  min="0"
                  max="100"
                  {...register('no_show_fee_percent', {
                    required: 'No-show fee percentage is required',
                    min: { value: 0, message: 'Must be at least 0%' },
                    max: { value: 100, message: 'Cannot exceed 100%' },
                  })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    getFieldError('no_show_fee_percent')
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {getFieldError('no_show_fee_percent') && (
                  <p className="mt-1 text-sm text-red-600">
                    {getFieldError('no_show_fee_percent')}
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Percentage of service fee to charge for no-shows
              </p>
            </div>

            <div>
              <label htmlFor="no_show_fee_flat_cents" className="block text-sm font-medium text-gray-700">
                No-Show Flat Fee (optional)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="no_show_fee_flat_cents"
                  min="0"
                  step="1"
                  {...register('no_show_fee_flat_cents', {
                    min: { value: 0, message: 'Must be at least $0.00' },
                  })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    getFieldError('no_show_fee_flat_cents')
                      ? 'border-red-300'
                      : 'border-gray-300'
                  }`}
                />
                {getFieldError('no_show_fee_flat_cents') && (
                  <p className="mt-1 text-sm text-red-600">
                    {getFieldError('no_show_fee_flat_cents')}
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Fixed fee in cents (e.g., 1000 = $10.00). Leave empty to use percentage only.
              </p>
            </div>
          </div>
        </div>

        {/* Refund Policy */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Refund Policy
          </h3>
          <div>
            <label htmlFor="refund_policy" className="block text-sm font-medium text-gray-700">
              Refund Policy Text
            </label>
            <div className="mt-1">
              <textarea
                id="refund_policy"
                rows={4}
                {...register('refund_policy', {
                  required: 'Refund policy is required',
                  minLength: { value: 10, message: 'Must be at least 10 characters' },
                  maxLength: { value: 1000, message: 'Cannot exceed 1000 characters' },
                })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  getFieldError('refund_policy')
                    ? 'border-red-300'
                    : 'border-gray-300'
                }`}
                placeholder="Describe your refund policy clearly..."
              />
              {getFieldError('refund_policy') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('refund_policy')}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {watchedRefundPolicy.length}/1000 characters
            </p>
          </div>
        </div>

        {/* Cash Logistics */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Cash Payment Policy
          </h3>
          <div>
            <label htmlFor="cash_logistics" className="block text-sm font-medium text-gray-700">
              Cash Payment Information
            </label>
            <div className="mt-1">
              <textarea
                id="cash_logistics"
                rows={3}
                {...register('cash_logistics', {
                  required: 'Cash payment information is required',
                  minLength: { value: 10, message: 'Must be at least 10 characters' },
                  maxLength: { value: 500, message: 'Cannot exceed 500 characters' },
                })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  getFieldError('cash_logistics')
                    ? 'border-red-300'
                    : 'border-gray-300'
                }`}
                placeholder="Describe your cash payment policy..."
              />
              {getFieldError('cash_logistics') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('cash_logistics')}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {watchedCashLogistics.length}/500 characters
            </p>
          </div>
        </div>

        {/* Active Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              {...register('is_active')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
              Activate these policies
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Policies must be active to be enforced during checkout
          </p>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Policies'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

