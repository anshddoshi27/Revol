/**
 * NotificationTemplateEditor Component
 * 
 * Component for creating and editing notification templates.
 * Includes form fields, placeholder validation, and preview functionality.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { usePlaceholderValidation } from '../../hooks/usePlaceholderValidation';
import { PlaceholderValidator } from './PlaceholderValidator';
import { NotificationPreview } from './NotificationPreview';
import type { 
  NotificationTemplate, 
  NotificationTemplateFormData,
  PlaceholderKey 
} from '../../api/types/notifications';

interface NotificationTemplateEditorProps {
  template?: NotificationTemplate;
  onSave: (template: NotificationTemplateFormData) => Promise<boolean>;
  onCancel: () => void;
  onPreview?: (template: NotificationTemplateFormData) => void;
  className?: string;
  isSubmitting?: boolean;
  errors?: Record<string, string>;
  showPreview?: boolean;
  showPlaceholderValidator?: boolean;
}

export const NotificationTemplateEditor: React.FC<NotificationTemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  onPreview,
  className = '',
  isSubmitting = false,
  errors = {},
  showPreview = true,
  showPlaceholderValidator = true,
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors, isValid: isFormValid },
  } = useForm<NotificationTemplateFormData>({
    defaultValues: {
      name: template?.name || '',
      channel: template?.channel || 'email',
      subject: template?.subject || '',
      content: template?.content || '',
      required_variables: template?.required_variables || [],
      trigger_event: template?.trigger_event || '',
      category: template?.category || 'confirmation',
      is_active: template?.is_active ?? true,
    },
  });

  const watchedContent = watch('content');
  const watchedRequiredVariables = watch('required_variables');
  const watchedChannel = watch('channel');

  // Placeholder validation
  const {
    isValid: isPlaceholderValid,
    missingPlaceholders,
    invalidPlaceholders,
  } = usePlaceholderValidation({
    initialContent: watchedContent,
    initialRequiredVariables: watchedRequiredVariables,
  });

  // Update required variables when content changes
  useEffect(() => {
    if (watchedContent) {
      // Extract placeholders from content
      const placeholderRegex = /\{([^}]+)\}/g;
      const placeholders: string[] = [];
      let match;

      while ((match = placeholderRegex.exec(watchedContent)) !== null) {
        if (!placeholders.includes(match[1])) {
          placeholders.push(match[1]);
        }
      }

      // Update required variables to include all found placeholders
      setValue('required_variables', placeholders);
    }
  }, [watchedContent, setValue]);

  // Handle form submission
  const onSubmit = useCallback(async (data: NotificationTemplateFormData) => {
    const success = await onSave(data);
    if (success) {
      // Form will be closed by parent component
    }
  }, [onSave]);

  // Handle preview
  const handlePreview = useCallback(() => {
    const formData = watch();
    const previewData: NotificationTemplate = {
      id: template?.id || 'preview',
      tenant_id: template?.tenant_id || 'preview',
      name: formData.name,
      channel: formData.channel,
      subject: formData.subject,
      content: formData.content,
      variables: {},
      required_variables: formData.required_variables,
      trigger_event: formData.trigger_event,
      category: formData.category,
      is_active: formData.is_active,
      created_at: template?.created_at,
      updated_at: template?.updated_at,
    };

    setPreviewTemplate(previewData);
    setIsPreviewMode(true);

    if (onPreview) {
      onPreview(formData);
    }
  }, [watch, template, onPreview]);

  // Get channel options
  const getChannelOptions = () => [
    { value: 'email', label: 'Email', description: 'Send via email' },
    { value: 'sms', label: 'SMS', description: 'Send via text message' },
    { value: 'push', label: 'Push', description: 'Send as push notification' },
  ];

  // Get category options
  const getCategoryOptions = () => [
    { value: 'confirmation', label: 'Confirmation', description: 'Booking confirmation' },
    { value: 'reminder', label: 'Reminder', description: 'Booking reminder' },
    { value: 'follow_up', label: 'Follow-up', description: 'Post-booking follow-up' },
    { value: 'cancellation', label: 'Cancellation', description: 'Booking cancellation' },
    { value: 'reschedule', label: 'Reschedule', description: 'Booking reschedule' },
  ];

  // Get trigger event options
  const getTriggerEventOptions = () => [
    { value: 'booking_created', label: 'Booking Created' },
    { value: 'booking_confirmed', label: 'Booking Confirmed' },
    { value: 'booking_reminder_24h', label: '24 Hour Reminder' },
    { value: 'booking_reminder_1h', label: '1 Hour Reminder' },
    { value: 'booking_cancelled', label: 'Booking Cancelled' },
    { value: 'booking_rescheduled', label: 'Booking Rescheduled' },
    { value: 'booking_completed', label: 'Booking Completed' },
  ];

  // Check if form is valid
  const isFormReady = isFormValid && isPlaceholderValid && missingPlaceholders.length === 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {!isPreviewMode ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {template ? 'Edit Template' : 'Create Template'}
              </h2>
              <p className="text-sm text-gray-500">
                {template ? 'Update your notification template' : 'Create a new notification template'}
              </p>
            </div>
            {showPreview && (
              <button
                type="button"
                onClick={handlePreview}
                disabled={!watchedContent || !isPlaceholderValid}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  {...register('name', { required: 'Template name is required' })}
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Booking Confirmation"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name.message}</p>
                )}
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel *
                </label>
                <select
                  {...register('channel', { required: 'Channel is required' })}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.channel ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  {getChannelOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
                {formErrors.channel && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.channel.message}</p>
                )}
              </div>
            </div>

            {/* Email Subject (only for email channel) */}
            {watchedChannel === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject *
                </label>
                <input
                  {...register('subject', { 
                    required: watchedChannel === 'email' ? 'Email subject is required' : false 
                  })}
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.subject ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Your booking is confirmed!"
                />
                {formErrors.subject && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.subject.message}</p>
                )}
              </div>
            )}

            {/* Category and Trigger Event */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  {...register('category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {getCategoryOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trigger Event */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Event
                </label>
                <select
                  {...register('trigger_event')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select trigger event</option>
                  {getTriggerEventOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Content *
              </label>
              <textarea
                {...register('content', { required: 'Content is required' })}
                rows={8}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.content ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter your template content here. Use {placeholder} for dynamic content..."
              />
              {formErrors.content && (
                <p className="mt-1 text-sm text-red-600">{formErrors.content.message}</p>
              )}
            </div>

            {/* Placeholder Validator */}
            {showPlaceholderValidator && (
              <PlaceholderValidator
                content={watchedContent}
                requiredVariables={watchedRequiredVariables}
                onContentChange={(content) => setValue('content', content)}
                onRequiredVariablesChange={(variables) => setValue('required_variables', variables)}
                showAvailablePlaceholders={true}
                showRequiredVariables={true}
                showValidationErrors={true}
              />
            )}

            {/* Active Status */}
            <div className="flex items-center">
              <input
                {...register('is_active')}
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Template is active
              </label>
            </div>

            {/* General Errors */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormReady || isSubmitting}
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
                  'Save Template'
                )}
              </button>
            </div>
          </form>
        </>
      ) : (
        /* Preview Mode */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Template Preview</h2>
            <button
              type="button"
              onClick={() => setIsPreviewMode(false)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Edit
            </button>
          </div>

          {previewTemplate && (
            <NotificationPreview
              template={previewTemplate}
              showSendTest={false}
              showSampleDataEditor={true}
            />
          )}
        </div>
      )}
    </div>
  );
};
