/**
 * ConfirmationMessageEditor Component
 * 
 * Component for editing confirmation messages with quick-paste functionality.
 * Provides template selection, variable insertion, and preview capabilities.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type {
  ConfirmationMessage,
  ConfirmationMessageFormData,
  ConfirmationMessageValidationError,
  QuickPasteOption,
  ServiceDetails,
  AvailabilityDetails,
  BusinessDetails,
} from '../../api/types/policies';
import { DEFAULT_CONFIRMATION_TEMPLATES } from '../../api/types/policies';

interface ConfirmationMessageEditorProps {
  message?: ConfirmationMessage;
  onSave: (message: ConfirmationMessageFormData) => Promise<boolean>;
  onCancel: () => void;
  onPreview?: (content: string) => Promise<string | null>;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
  validationErrors?: ConfirmationMessageValidationError[];
  serviceDetails?: ServiceDetails;
  availabilityDetails?: AvailabilityDetails;
  businessDetails?: BusinessDetails;
  className?: string;
}

export const ConfirmationMessageEditor: React.FC<ConfirmationMessageEditorProps> = ({
  message,
  onSave,
  onCancel,
  onPreview,
  isSubmitting = false,
  errors = {},
  validationErrors = [],
  serviceDetails,
  availabilityDetails,
  businessDetails,
  className = '',
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors, isValid: isFormValid },
  } = useForm<ConfirmationMessageFormData>({
    defaultValues: {
      content: message?.content || '',
      is_active: message?.is_active ?? true,
    },
  });

  const watchedContent = watch('content');

  // Generate quick paste options
  const quickPasteOptions: QuickPasteOption[] = React.useMemo(() => {
    const options: QuickPasteOption[] = [];

    // Service details
    if (serviceDetails) {
      options.push(
        {
          id: 'service_name',
          label: 'Service Name',
          value: `{service_name}`,
          description: serviceDetails.name,
          category: 'service',
        },
        {
          id: 'service_description',
          label: 'Service Description',
          value: `{service_description}`,
          description: serviceDetails.description,
          category: 'service',
        },
        {
          id: 'service_duration',
          label: 'Service Duration',
          value: `{service_duration}`,
          description: `${serviceDetails.duration_minutes} minutes`,
          category: 'service',
        },
        {
          id: 'service_price',
          label: 'Service Price',
          value: `{service_price}`,
          description: `$${(serviceDetails.price_cents / 100).toFixed(2)}`,
          category: 'price',
        }
      );

      if (serviceDetails.instructions) {
        options.push({
          id: 'service_instructions',
          label: 'Service Instructions',
          value: `{service_instructions}`,
          description: serviceDetails.instructions,
          category: 'service',
        });
      }
    }

    // Availability details
    if (availabilityDetails) {
      options.push(
        {
          id: 'appointment_date',
          label: 'Appointment Date',
          value: `{appointment_date}`,
          description: availabilityDetails.date,
          category: 'time',
        },
        {
          id: 'appointment_time',
          label: 'Appointment Time',
          value: `{appointment_time}`,
          description: availabilityDetails.time,
          category: 'time',
        },
        {
          id: 'timezone',
          label: 'Timezone',
          value: `{timezone}`,
          description: availabilityDetails.timezone,
          category: 'time',
        }
      );
    }

    // Business details
    if (businessDetails) {
      options.push(
        {
          id: 'business_name',
          label: 'Business Name',
          value: `{business_name}`,
          description: businessDetails.name,
          category: 'business',
        }
      );

      if (businessDetails.address) {
        options.push({
          id: 'business_address',
          label: 'Business Address',
          value: `{business_address}`,
          description: businessDetails.address,
          category: 'business',
        });
      }

      if (businessDetails.phone) {
        options.push({
          id: 'business_phone',
          label: 'Business Phone',
          value: `{business_phone}`,
          description: businessDetails.phone,
          category: 'contact',
        });
      }

      if (businessDetails.email) {
        options.push({
          id: 'business_email',
          label: 'Business Email',
          value: `{business_email}`,
          description: businessDetails.email,
          category: 'contact',
        });
      }
    }

    // Common options
    options.push({
      id: 'customer_name',
      label: 'Customer Name',
      value: `{customer_name}`,
      description: 'Customer\'s name',
      category: 'contact',
    });

    return options;
  }, [serviceDetails, availabilityDetails, businessDetails]);

  // Apply template when selected
  useEffect(() => {
    if (selectedTemplate) {
      setValue('content', selectedTemplate.template);
      setSelectedTemplate(null);
      setShowTemplates(false);
    }
  }, [selectedTemplate, setValue]);

  // Handle form submission
  const onSubmit = useCallback(async (data: ConfirmationMessageFormData) => {
    const success = await onSave(data);
    if (success) {
      // Form will be closed by parent component
    }
  }, [onSave]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: any) => {
    setSelectedTemplate(template);
  }, []);

  // Handle quick paste insertion
  const handleQuickPaste = useCallback((option: QuickPasteOption) => {
    const currentContent = watchedContent;
    const before = currentContent.substring(0, cursorPosition);
    const after = currentContent.substring(cursorPosition);
    const newContent = before + option.value + after;
    
    setValue('content', newContent);
    setShowQuickPaste(false);
    
    // Focus back to textarea and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPosition = cursorPosition + option.value.length;
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        setCursorPosition(newCursorPosition);
      }
    }, 0);
  }, [watchedContent, cursorPosition, setValue]);

  // Handle textarea cursor position tracking
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCursorPosition(e.target.selectionStart);
  }, []);

  const handleTextareaClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart);
  }, []);

  const handleTextareaKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart);
  }, []);

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!onPreview || !watchedContent.trim()) return;

    setIsPreviewing(true);
    try {
      const preview = await onPreview(watchedContent);
      setPreviewContent(preview);
    } catch (error) {
      console.error('Failed to preview message:', error);
    } finally {
      setIsPreviewing(false);
    }
  }, [onPreview, watchedContent]);

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

  // Group quick paste options by category
  const groupedQuickPasteOptions = React.useMemo(() => {
    const grouped: Record<string, QuickPasteOption[]> = {};
    quickPasteOptions.forEach(option => {
      if (!grouped[option.category]) {
        grouped[option.category] = [];
      }
      grouped[option.category].push(option);
    });
    return grouped;
  }, [quickPasteOptions]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Confirmation Message
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Create the message customers see when they complete their booking
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
          <button
            type="button"
            onClick={() => setShowQuickPaste(!showQuickPaste)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Quick Paste
          </button>
        </div>
      </div>

      {/* Template Selection */}
      {showTemplates && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-3">
            Message Templates
          </h3>
          <div className="space-y-2">
            {DEFAULT_CONFIRMATION_TEMPLATES.map((template) => (
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
                  Variables: {template.variables.join(', ')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Paste Options */}
      {showQuickPaste && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-green-800 mb-3">
            Quick Paste Variables
          </h3>
          <div className="space-y-4">
            {Object.entries(groupedQuickPasteOptions).map(([category, options]) => (
              <div key={category}>
                <h4 className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">
                  {category}
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleQuickPaste(option)}
                      className="text-left p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <div className="font-medium text-sm text-gray-900">
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
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
        {/* Message Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Message Content
            </h3>
            {onPreview && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!watchedContent.trim() || isPreviewing}
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
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Confirmation Message
            </label>
            <div className="mt-1">
              <textarea
                ref={textareaRef}
                id="content"
                rows={12}
                {...register('content', {
                  required: 'Confirmation message is required',
                  minLength: { value: 10, message: 'Must be at least 10 characters' },
                  maxLength: { value: 2000, message: 'Cannot exceed 2000 characters' },
                })}
                onChange={(e) => {
                  register('content').onChange(e);
                  handleTextareaChange(e);
                }}
                onClick={handleTextareaClick}
                onKeyUp={handleTextareaKeyUp}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono ${
                  getFieldError('content')
                    ? 'border-red-300'
                    : 'border-gray-300'
                }`}
                placeholder="Enter your confirmation message here. Use {variable_name} for dynamic content..."
              />
              {getFieldError('content') && (
                <p className="mt-1 text-sm text-red-600">
                  {getFieldError('content')}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {watchedContent.length}/2000 characters
            </p>
          </div>
        </div>

        {/* Preview */}
        {previewContent && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Preview
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">
                {previewContent}
              </pre>
            </div>
          </div>
        )}

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
              Activate this confirmation message
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            The message must be active to be sent to customers
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
              'Save Message'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};


