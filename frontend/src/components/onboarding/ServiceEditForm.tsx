/**
 * ServiceEditForm Component
 * 
 * A form component for editing individual services within a category.
 * Allows users to update service details without affecting the category.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { ServiceData, ServiceFormData } from '../../api/types/services';

interface ServiceEditFormProps {
  service: ServiceData;
  onSave: (serviceId: string, serviceData: ServiceFormData) => Promise<void>;
  onDelete?: (serviceId: string) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export const ServiceEditForm: React.FC<ServiceEditFormProps> = ({
  service,
  onSave,
  onDelete,
  onCancel,
  onError,
  disabled = false,
}) => {
  const [serviceData, setServiceData] = useState<ServiceFormData>({
    name: service.name,
    description: service.description,
    duration_minutes: service.duration_minutes,
    price_cents: service.price_cents,
    category: service.category,
    pre_appointment_instructions: service.pre_appointment_instructions || '',
    special_requests_enabled: service.special_requests_enabled || false,
    quick_chips: service.quick_chips || [],
    buffer_before_minutes: service.buffer_before_minutes || 0,
    buffer_after_minutes: service.buffer_after_minutes || 0,
    image_url: service.image_url,
    special_requests_limit: service.special_requests_limit || 100,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateServiceField = useCallback((field: keyof ServiceFormData, value: string | number | boolean | string[]) => {
    setServiceData(prev => ({ ...prev, [field]: value }));
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

    if (!serviceData.name.trim()) {
      newErrors.name = 'Service name is required';
    }

    if (!serviceData.description.trim()) {
      newErrors.description = 'Service description is required';
    }

    if (serviceData.duration_minutes < 15) {
      newErrors.duration_minutes = 'Duration must be at least 15 minutes';
    }

    if (serviceData.duration_minutes > 480) {
      newErrors.duration_minutes = 'Duration cannot exceed 8 hours';
    }

    if (serviceData.price_cents < 0) {
      newErrors.price_cents = 'Price cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [serviceData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSave(service.id!, serviceData);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to update service'));
    } finally {
      setIsSubmitting(false);
    }
  }, [serviceData, validateForm, onSave, onError, service.id]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    
    if (window.confirm(`Are you sure you want to delete "${service.name}"? This action cannot be undone.`)) {
      setIsSubmitting(true);
      try {
        await onDelete(service.id!);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to delete service'));
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [onDelete, onError, service.id, service.name]);

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

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h6 className="text-sm font-medium text-gray-900">Edit Service</h6>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || isSubmitting}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            <span className="sr-only">Close</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Service Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Service Name *
          </label>
          <input
            type="text"
            value={serviceData.name}
            onChange={(e) => updateServiceField('name', e.target.value)}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="e.g., Haircut & Style, Deep Tissue Massage"
            required
            disabled={disabled || isSubmitting}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Service Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description *
          </label>
          <textarea
            value={serviceData.description}
            onChange={(e) => updateServiceField('description', e.target.value)}
            rows={2}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
              errors.description ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            placeholder="Describe what this service includes..."
            required
            disabled={disabled || isSubmitting}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Duration and Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Duration (minutes) *
            </label>
            <input
              type="number"
              min="15"
              max="480"
              value={serviceData.duration_minutes}
              onChange={(e) => updateServiceField('duration_minutes', parseInt(e.target.value, 10) || 0)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.duration_minutes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              required
              disabled={disabled || isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              {formatDuration(serviceData.duration_minutes)}
            </p>
            {errors.duration_minutes && (
              <p className="mt-1 text-sm text-red-600">{errors.duration_minutes}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Price (cents) *
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={serviceData.price_cents}
              onChange={(e) => updateServiceField('price_cents', parseInt(e.target.value, 10) || 0)}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                errors.price_cents ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              required
              disabled={disabled || isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              {formatPrice(serviceData.price_cents)}
            </p>
            {errors.price_cents && (
              <p className="mt-1 text-sm text-red-600">{errors.price_cents}</p>
            )}
          </div>
        </div>

        {/* Pre-appointment Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pre-appointment Instructions
          </label>
          <textarea
            value={serviceData.pre_appointment_instructions}
            onChange={(e) => updateServiceField('pre_appointment_instructions', e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Any special instructions for customers..."
            disabled={disabled || isSubmitting}
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-between pt-3 border-t border-gray-200">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Service'}
            </button>
          )}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={disabled || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating...' : 'Update Service'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
