/**
 * ServiceCardEditor Component
 * 
 * Component for creating and editing service details including
 * basic info, pricing, duration, and special requests configuration.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { ServiceImageUploader } from './ServiceImageUploader';
import { ChipsConfigurator } from './ChipsConfigurator';
import type { ServiceData, ServiceFormData, CategoryData, ChipsConfiguration } from '../../api/types/services';
import { 
  DEFAULT_SERVICE_DURATION_MINUTES, 
  DEFAULT_SERVICE_PRICE_CENTS,
  MAX_SERVICE_DURATION_HOURS,
  MIN_SERVICE_DURATION_MINUTES 
} from '../../api/types/services';

interface ServiceCardEditorProps {
  service?: ServiceData;
  categories: CategoryData[];
  onSave: (serviceData: ServiceFormData) => void;
  onCancel: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

interface ServiceFormState {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category: string;
  image_url?: string;
  special_requests_enabled: boolean;
  special_requests_limit?: number;
  quick_chips: string[];
  pre_appointment_instructions?: string;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
}

export const ServiceCardEditor: React.FC<ServiceCardEditorProps> = ({
  service,
  categories,
  onSave,
  onCancel,
  onError,
  disabled = false,
}) => {
  const [formData, setFormData] = useState<ServiceFormState>({
    name: service?.name || '',
    description: service?.description || '',
    duration_minutes: service?.duration_minutes || DEFAULT_SERVICE_DURATION_MINUTES,
    price_cents: service?.price_cents || DEFAULT_SERVICE_PRICE_CENTS,
    category: service?.category || '',
    image_url: service?.image_url,
    special_requests_enabled: service?.special_requests_enabled || false,
    special_requests_limit: service?.special_requests_limit || 200,
    quick_chips: service?.quick_chips || [],
    pre_appointment_instructions: service?.pre_appointment_instructions || '',
    buffer_before_minutes: service?.buffer_before_minutes || 0,
    buffer_after_minutes: service?.buffer_after_minutes || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when service prop changes
  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        duration_minutes: service.duration_minutes || DEFAULT_SERVICE_DURATION_MINUTES,
        price_cents: service.price_cents || DEFAULT_SERVICE_PRICE_CENTS,
        category: service.category || '',
        image_url: service.image_url,
        special_requests_enabled: service.special_requests_enabled || false,
        special_requests_limit: service.special_requests_limit || 200,
        quick_chips: service.quick_chips || [],
        pre_appointment_instructions: service.pre_appointment_instructions || '',
        buffer_before_minutes: service.buffer_before_minutes || 0,
        buffer_after_minutes: service.buffer_after_minutes || 0,
      });
    }
  }, [service]);

  const updateField = useCallback((field: keyof ServiceFormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Service name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Service name must be at least 2 characters long';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Service name cannot exceed 255 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Service description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Service description must be at least 10 characters long';
    } else if (formData.description.length > 1000) {
      newErrors.description = 'Service description cannot exceed 1000 characters';
    }

    // Duration validation
    if (formData.duration_minutes < MIN_SERVICE_DURATION_MINUTES) {
      newErrors.duration_minutes = `Duration must be at least ${MIN_SERVICE_DURATION_MINUTES} minutes`;
    } else if (formData.duration_minutes > MAX_SERVICE_DURATION_HOURS * 60) {
      newErrors.duration_minutes = `Duration cannot exceed ${MAX_SERVICE_DURATION_HOURS} hours`;
    }

    // Price validation
    if (formData.price_cents < 0) {
      newErrors.price_cents = 'Price cannot be negative';
    }

    // Buffer validation
    if (formData.buffer_before_minutes && formData.buffer_before_minutes < 0) {
      newErrors.buffer_before_minutes = 'Buffer time cannot be negative';
    }

    if (formData.buffer_after_minutes && formData.buffer_after_minutes < 0) {
      newErrors.buffer_after_minutes = 'Buffer time cannot be negative';
    }

    // Special requests validation
    if (formData.special_requests_enabled && formData.special_requests_limit) {
      if (formData.special_requests_limit < 10) {
        newErrors.special_requests_limit = 'Special requests limit must be at least 10 characters';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const serviceFormData: ServiceFormData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        duration_minutes: formData.duration_minutes,
        price_cents: formData.price_cents,
        category: formData.category,
        image_url: formData.image_url,
        special_requests_enabled: formData.special_requests_enabled,
        special_requests_limit: formData.special_requests_enabled ? formData.special_requests_limit : undefined,
        quick_chips: formData.special_requests_enabled ? formData.quick_chips : [],
        pre_appointment_instructions: formData.pre_appointment_instructions?.trim() || undefined,
        buffer_before_minutes: formData.buffer_before_minutes || undefined,
        buffer_after_minutes: formData.buffer_after_minutes || undefined,
      };

      await onSave(serviceFormData);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to save service'));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSave, onError]);

  const handleImageUploaded = useCallback((imageUrl: string) => {
    updateField('image_url', imageUrl);
  }, [updateField]);

  const handleChipsConfigChange = useCallback((config: ChipsConfiguration) => {
    updateField('special_requests_enabled', config.enabled);
    updateField('special_requests_limit', config.limit);
    updateField('quick_chips', config.quick_chips);
  }, [updateField]);

  const formatPrice = useCallback((cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }, []);

  const formatDuration = useCallback((minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  }, []);

  const chipsConfig: ChipsConfiguration = {
    enabled: formData.special_requests_enabled,
    limit: formData.special_requests_limit,
    quick_chips: formData.quick_chips,
    allow_custom: true,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {service ? 'Edit Service' : 'Add New Service'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {service ? 'Update service details and settings' : 'Create a new service for your customers to book'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || isSubmitting}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Basic Information */}
          <div className="space-y-6">
            {/* Service Name */}
            <div>
              <label htmlFor="service-name" className="block text-sm font-medium text-gray-700">
                Service Name *
              </label>
              <input
                id="service-name"
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                placeholder="e.g., Haircut & Style, Deep Tissue Massage"
                required
                disabled={disabled || isSubmitting}
                aria-describedby={errors.name ? 'service-name-error' : undefined}
              />
              {errors.name && (
                <p id="service-name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Service Description */}
            <div>
              <label htmlFor="service-description" className="block text-sm font-medium text-gray-700">
                Description *
              </label>
              <textarea
                id="service-description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                  errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                placeholder="Describe what this service includes and what customers can expect..."
                required
                disabled={disabled || isSubmitting}
                aria-describedby={errors.description ? 'service-description-error' : undefined}
              />
              {errors.description && (
                <p id="service-description-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label htmlFor="service-category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="service-category"
                value={formData.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled || isSubmitting}
              >
                <option value="">Select a category (optional)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Duration and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="service-duration" className="block text-sm font-medium text-gray-700">
                  Duration (minutes) *
                </label>
                <input
                  id="service-duration"
                  type="number"
                  min={MIN_SERVICE_DURATION_MINUTES}
                  max={MAX_SERVICE_DURATION_HOURS * 60}
                  value={formData.duration_minutes}
                  onChange={(e) => updateField('duration_minutes', parseInt(e.target.value, 10) || 0)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.duration_minutes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  required
                  disabled={disabled || isSubmitting}
                  aria-describedby={errors.duration_minutes ? 'service-duration-error' : undefined}
                />
                {errors.duration_minutes && (
                  <p id="service-duration-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.duration_minutes}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formatDuration(formData.duration_minutes)}
                </p>
              </div>

              <div>
                <label htmlFor="service-price" className="block text-sm font-medium text-gray-700">
                  Price (cents) *
                </label>
                <input
                  id="service-price"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.price_cents}
                  onChange={(e) => updateField('price_cents', parseInt(e.target.value, 10) || 0)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.price_cents ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  required
                  disabled={disabled || isSubmitting}
                  aria-describedby={errors.price_cents ? 'service-price-error' : undefined}
                />
                {errors.price_cents && (
                  <p id="service-price-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.price_cents}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {formatPrice(formData.price_cents)}
                </p>
              </div>
            </div>

            {/* Buffer Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="buffer-before" className="block text-sm font-medium text-gray-700">
                  Buffer Before (minutes)
                </label>
                <input
                  id="buffer-before"
                  type="number"
                  min="0"
                  value={formData.buffer_before_minutes || 0}
                  onChange={(e) => updateField('buffer_before_minutes', parseInt(e.target.value, 10) || 0)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.buffer_before_minutes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={disabled || isSubmitting}
                  aria-describedby={errors.buffer_before_minutes ? 'buffer-before-error' : undefined}
                />
                {errors.buffer_before_minutes && (
                  <p id="buffer-before-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.buffer_before_minutes}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="buffer-after" className="block text-sm font-medium text-gray-700">
                  Buffer After (minutes)
                </label>
                <input
                  id="buffer-after"
                  type="number"
                  min="0"
                  value={formData.buffer_after_minutes || 0}
                  onChange={(e) => updateField('buffer_after_minutes', parseInt(e.target.value, 10) || 0)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.buffer_after_minutes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={disabled || isSubmitting}
                  aria-describedby={errors.buffer_after_minutes ? 'buffer-after-error' : undefined}
                />
                {errors.buffer_after_minutes && (
                  <p id="buffer-after-error" className="mt-1 text-sm text-red-600" role="alert">
                    {errors.buffer_after_minutes}
                  </p>
                )}
              </div>
            </div>

            {/* Pre-appointment Instructions */}
            <div>
              <label htmlFor="pre-appointment-instructions" className="block text-sm font-medium text-gray-700">
                Pre-appointment Instructions
              </label>
              <textarea
                id="pre-appointment-instructions"
                value={formData.pre_appointment_instructions || ''}
                onChange={(e) => updateField('pre_appointment_instructions', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Any special instructions customers should know before their appointment..."
                disabled={disabled || isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                These instructions will be shown to customers when they book and in confirmation emails
              </p>
            </div>
          </div>

          {/* Right Column - Image and Special Requests */}
          <div className="space-y-6">
            {/* Service Image */}
            <ServiceImageUploader
              serviceId={service?.id}
              initialImageUrl={formData.image_url}
              onImageUploaded={handleImageUploaded}
              onError={onError}
              disabled={disabled || isSubmitting}
            />

            {/* Special Requests Configuration */}
            <div className="border-t border-gray-200 pt-6">
              <ChipsConfigurator
                initialConfig={chipsConfig}
                onConfigChange={handleChipsConfigChange}
                disabled={disabled || isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || isSubmitting}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disabled || isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : (service ? 'Update Service' : 'Create Service')}
          </button>
        </div>
      </form>
    </div>
  );
};
