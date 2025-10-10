/**
 * CheckoutWarningConfig Component
 * 
 * Component for configuring checkout warnings and acknowledgments.
 * Provides template selection and preview capabilities.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type {
  CheckoutWarning,
  CheckoutWarningFormData,
  CheckoutWarningValidationError,
} from '../../api/types/policies';
import { DEFAULT_CHECKOUT_WARNING_TEMPLATES } from '../../api/types/policies';

interface CheckoutWarningConfigProps {
  warning?: CheckoutWarning;
  onSave: (warning: CheckoutWarningFormData) => Promise<boolean>;
  onCancel: () => void;
  onPreview?: (warning: CheckoutWarningFormData) => Promise<string | null>;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
  validationErrors?: CheckoutWarningValidationError[];
  className?: string;
}

export const CheckoutWarningConfig: React.FC<CheckoutWarningConfigProps> = ({
  warning,
  onSave,
  onCancel,
  onPreview,
  isSubmitting = false,
  errors = {},
  validationErrors = [],
  className = '',
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors, isValid: isFormValid },
  } = useForm<CheckoutWarningFormData>({
    defaultValues: {
      title: warning?.title || 'Important Information',
      message: warning?.message || '',
      acknowledgment_required: warning?.acknowledgment_required ?? true,
      acknowledgment_text: warning?.acknowledgment_text || 'I understand and agree to the terms above.',
      is_active: warning?.is_active ?? true,
    },
  });

  const watchedTitle = watch('title');
  const watchedMessage = watch('message');
  const watchedAcknowledgmentText = watch('acknowledgment_text');
  const watchedAcknowledgmentRequired = watch('acknowledgment_required');

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      setValue('title', selectedTemplate.title);
      setValue('message', selectedTemplate.message);
      setValue('acknowledgment_required', selectedTemplate.acknowledgment_required);
      setValue('acknowledgment_text', selectedTemplate.acknowledgment_text);
      setSelectedTemplate(null);
      setShowTemplates(false);
    }
  }, [selectedTemplate, setValue]);

  // Handle form submission
  const onSubmit = useCallback(async (data: CheckoutWarningFormData) => {
    const success = await onSave(data);
    if (success) {
      // Form will be closed by parent component
    }
  }, [onSave]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: any) => {
    setSelectedTemplate(template);
  }, []);

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!onPreview) return;

    const formData: CheckoutWarningFormData = {
      title: watchedTitle,
      message: watchedMessage,
      acknowledgment_required: watchedAcknowledgmentRequired,
      acknowledgment_text: watchedAcknowledgmentText,
      is_active: true,
    };

    setIsPreviewing(true);
    try {
      const preview = await onPreview(formData);
      setPreviewContent(preview);
    } catch (error) {
      console.error('Failed to preview warning:', error);
    } finally {
      setIsPreviewing(false);
    }
  }, [onPreview, watchedTitle, watchedMessage, watchedAcknowledgmentRequired, watchedAcknowledgmentText]);

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
            Checkout Warning
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure the warning message and acknowledgment shown during checkout
          </p>
        </div>
        <div className="flex space-x-2">
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
          {onPreview && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={!watchedTitle.trim() || !watchedMessage.trim() || isPreviewing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPreviewing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Previewing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Template Selection */}
      {showTemplates && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-3">
            Warning Templates
          </h3>
          <div className="space-y-2">
            {DEFAULT_CHECKOUT_WARNING_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateSelect(template)}
                className="w-full text-left p-3 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="font-medium text-sm text-gray-900">
                  {template.name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {template.title}
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
        {/* Warning Title */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Warning Title
          </h3>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="title"
                {...register('title', {
                  required: 'Warning title is required',
                  minLength: { value: 3, message: 'Must be at least 3 characters' },
                  maxLength: { value: 100, message: 'Cannot exceed 100 characters' },
                })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  getFieldError('title')
                    ? 'border-red-300'
                    : 'border-gray-300'
                }`}
                placeholder="e.g., Payment Information, Cancellation Policy"
              />
              {getFieldError('title') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('title')}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {watchedTitle.length}/100 characters
            </p>
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Warning Message
          </h3>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              Message
            </label>
            <div className="mt-1">
              <textarea
                id="message"
                rows={4}
                {...register('message', {
                  required: 'Warning message is required',
                  minLength: { value: 10, message: 'Must be at least 10 characters' },
                  maxLength: { value: 500, message: 'Cannot exceed 500 characters' },
                })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  getFieldError('message')
                    ? 'border-red-300'
                    : 'border-gray-300'
                }`}
                placeholder="Enter the warning message that customers will see..."
              />
              {getFieldError('message') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('message')}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {watchedMessage.length}/500 characters
            </p>
          </div>
        </div>

        {/* Acknowledgment Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Acknowledgment Configuration
          </h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="acknowledgment_required"
                {...register('acknowledgment_required')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="acknowledgment_required" className="ml-2 block text-sm text-gray-900">
                Require customer acknowledgment
              </label>
            </div>
            <p className="text-xs text-gray-500">
              Customers must acknowledge this warning before proceeding with checkout
            </p>

            {watchedAcknowledgmentRequired && (
              <div>
                <label htmlFor="acknowledgment_text" className="block text-sm font-medium text-gray-700">
                  Acknowledgment Text
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="acknowledgment_text"
                    {...register('acknowledgment_text', {
                      required: watchedAcknowledgmentRequired ? 'Acknowledgment text is required' : false,
                      minLength: { value: 5, message: 'Must be at least 5 characters' },
                      maxLength: { value: 200, message: 'Cannot exceed 200 characters' },
                    })}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      getFieldError('acknowledgment_text')
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    placeholder="e.g., I understand and agree to the terms above."
                  />
                  {getFieldError('acknowledgment_text') && (
                    <p className="mt-1 text-sm text-red-600">
                      {getFieldError('acknowledgment_text')}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {watchedAcknowledgmentText.length}/200 characters
                </p>
              </div>
            )}
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
              Activate this checkout warning
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            The warning must be active to be shown during checkout
          </p>
        </div>

        {/* Preview */}
        {previewContent && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Preview
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h4 className="font-medium text-yellow-800 mb-2">
                  {watchedTitle}
                </h4>
                <p className="text-yellow-700 text-sm mb-4">
                  {watchedMessage}
                </p>
                {watchedAcknowledgmentRequired && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="preview_acknowledgment"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="preview_acknowledgment" className="ml-2 block text-sm text-yellow-800">
                      {watchedAcknowledgmentText}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
              'Save Warning'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

