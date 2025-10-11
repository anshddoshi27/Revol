/**
 * CategoryWithServicesForm Component
 * 
 * A single form that allows creating a category with multiple services within it.
 * This replaces the separate category and service forms with a unified interface.
 */

import React, { useState, useCallback } from 'react';
import type { CategoryData, ServiceFormData, CategoryColor } from '../../api/types/services';
import { CATEGORY_COLORS } from '../../api/types/services';

interface ServiceFormState {
  id?: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  pre_appointment_instructions: string;
  isSaved?: boolean;
}

interface CategoryWithServicesFormProps {
  category?: CategoryData;
  onSave: (categoryData: CategoryFormData, servicesData: ServiceFormData[]) => void;
  onSaveService?: (serviceData: ServiceFormData) => Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

interface CategoryFormData {
  name: string;
  description: string;
  color: CategoryColor;
}

export const CategoryWithServicesForm: React.FC<CategoryWithServicesFormProps> = ({
  category,
  onSave,
  onSaveService,
  onCancel,
  onError,
  disabled = false,
}) => {
  const [categoryData, setCategoryData] = useState<CategoryFormData>({
    name: category?.name || '',
    description: category?.description || '',
    color: category?.color || CATEGORY_COLORS[0],
  });

  const [services, setServices] = useState<ServiceFormState[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingServices, setSavingServices] = useState<Set<number>>(new Set());

  const updateCategoryField = useCallback((field: keyof CategoryFormData, value: string) => {
    setCategoryData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const addService = useCallback(() => {
    const newService: ServiceFormState = {
      name: '',
      description: '',
      duration_minutes: 60,
      price_cents: 5000,
      pre_appointment_instructions: '',
    };
    setServices(prev => [...prev, newService]);
  }, []);

  const updateService = useCallback((index: number, field: keyof ServiceFormState, value: string | number) => {
    setServices(prev => prev.map((service, i) => 
      i === index ? { ...service, [field]: value } : service
    ));
  }, []);

  const removeService = useCallback((index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  }, []);

  const validateService = useCallback((service: ServiceFormState, index: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (!service.name.trim()) {
      newErrors[`service_${index}_name`] = 'Service name is required';
    }

    if (!service.description.trim()) {
      newErrors[`service_${index}_description`] = 'Service description is required';
    }

    if (service.duration_minutes < 15) {
      newErrors[`service_${index}_duration`] = 'Duration must be at least 15 minutes';
    }

    if (service.price_cents < 0) {
      newErrors[`service_${index}_price`] = 'Price cannot be negative';
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }, []);

  const saveIndividualService = useCallback(async (index: number) => {
    if (!onSaveService) {
      console.log('onSaveService is not provided');
      return;
    }

    // Check if category name is filled
    if (!categoryData.name.trim()) {
      setErrors(prev => ({ ...prev, categoryName: 'Please enter a category name before adding services' }));
      return;
    }

    const service = services[index];
    if (!service) {
      console.log('Service not found at index:', index);
      return;
    }
    
    console.log('Attempting to save service:', service);
    console.log('Category name:', categoryData.name);
    
    if (!validateService(service, index)) {
      console.log('Service validation failed');
      return;
    }

    setSavingServices(prev => new Set(prev).add(index));

    try {
      const serviceData: ServiceFormData = {
        name: service.name.trim(),
        description: service.description.trim(),
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
        category: categoryData.name,
        pre_appointment_instructions: service.pre_appointment_instructions.trim() || '',
        special_requests_enabled: false,
        quick_chips: [],
      };

      console.log('Saving service data:', serviceData);
      await onSaveService(serviceData);
      console.log('Service saved successfully');
      
      // Mark the service as saved instead of removing it
      setServices(prev => prev.map((s, i) => 
        i === index ? { ...s, isSaved: true } : s
      ));
      
      // Clear any errors for this service
      setErrors(prev => {
        const newErrors = { ...prev };
        Object.keys(newErrors).forEach(key => {
          if (key.startsWith(`service_${index}_`)) {
            delete newErrors[key];
          }
        });
        return newErrors;
      });
    } catch (error) {
      console.error('Failed to save service:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to save service'));
    } finally {
      setSavingServices(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  }, [services, categoryData.name, onSaveService, onError, validateService]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate category
    if (!categoryData.name.trim()) {
      newErrors.categoryName = 'Category name is required';
    }

    // Validate services
    services.forEach((service, index) => {
      if (!service.name.trim()) {
        newErrors[`service_${index}_name`] = 'Service name is required';
      }
      if (!service.description.trim()) {
        newErrors[`service_${index}_description`] = 'Service description is required';
      }
      if (service.duration_minutes < 15) {
        newErrors[`service_${index}_duration`] = 'Duration must be at least 15 minutes';
      }
      if (service.price_cents < 0) {
        newErrors[`service_${index}_price`] = 'Price cannot be negative';
      }
    });

    if (services.length === 0) {
      newErrors.services = 'At least one service is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [categoryData, services]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started');
    console.log('Category data:', categoryData);
    console.log('Services:', services);
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const servicesData: ServiceFormData[] = services.map(service => ({
        name: service.name.trim(),
        description: service.description.trim(),
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
        category: categoryData.name, // Link service to category
        pre_appointment_instructions: service.pre_appointment_instructions.trim() || undefined,
        special_requests_enabled: false,
        quick_chips: [],
      }));

      console.log('Services data to save:', servicesData);
      await onSave(categoryData, servicesData);
      console.log('Save completed successfully');
    } catch (error) {
      console.error('Save failed:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to save category and services'));
    } finally {
      setIsSubmitting(false);
    }
  }, [categoryData, services, validateForm, onSave, onError]);

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
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {category ? 'Edit Category' : 'Add New Category'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Create a category and add services that customers can book
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
          {/* Left Column - Category Information */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Category Information</h3>
              
              {/* Category Name */}
              <div className="mb-4">
                <label htmlFor="category-name" className="block text-sm font-medium text-gray-700">
                  Category Name *
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={categoryData.name}
                  onChange={(e) => updateCategoryField('name', e.target.value)}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                    errors.categoryName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  placeholder="e.g., Hair Services, Massage, Facials"
                  required
                  disabled={disabled || isSubmitting}
                />
                {errors.categoryName && (
                  <p className="mt-1 text-sm text-red-600">{errors.categoryName}</p>
                )}
              </div>

              {/* Category Description */}
              <div className="mb-4">
                <label htmlFor="category-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="category-description"
                  value={categoryData.description}
                  onChange={(e) => updateCategoryField('description', e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Optional description for this category"
                  disabled={disabled || isSubmitting}
                />
              </div>

              {/* Category Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateCategoryField('color', color)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        categoryData.color === color ? 'border-gray-900' : 'border-gray-300'
                      } hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                      style={{ backgroundColor: color }}
                      disabled={disabled || isSubmitting}
                    >
                      {categoryData.color === color && (
                        <svg className="w-4 h-4 text-white mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Services */}
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Services</h3>
                <button
                  type="button"
                  onClick={addService}
                  disabled={disabled || isSubmitting}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Service
                </button>
              </div>

              {errors.services && (
                <p className="text-sm text-red-600 mb-4">{errors.services}</p>
              )}
              
              {/* General error display */}
              {Object.keys(errors).some(key => !key.startsWith('service_') && key !== 'services') && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">
                    {Object.entries(errors)
                      .filter(([key]) => !key.startsWith('service_') && key !== 'services')
                      .map(([, message]) => message)
                      .join(', ')}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">Service {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        disabled={disabled || isSubmitting}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Service Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Service Name *
                        </label>
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(index, 'name', e.target.value)}
                          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                            errors[`service_${index}_name`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          placeholder="e.g., Haircut & Style, Deep Tissue Massage"
                          disabled={disabled || isSubmitting}
                        />
                        {errors[`service_${index}_name`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`service_${index}_name`]}</p>
                        )}
                      </div>

                      {/* Service Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Description *
                        </label>
                        <textarea
                          value={service.description}
                          onChange={(e) => updateService(index, 'description', e.target.value)}
                          rows={2}
                          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                            errors[`service_${index}_description`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          placeholder="Describe what this service includes..."
                          disabled={disabled || isSubmitting}
                        />
                        {errors[`service_${index}_description`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`service_${index}_description`]}</p>
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
                            value={service.duration_minutes}
                            onChange={(e) => updateService(index, 'duration_minutes', parseInt(e.target.value, 10) || 0)}
                            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                              errors[`service_${index}_duration`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            disabled={disabled || isSubmitting}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {formatDuration(service.duration_minutes)}
                          </p>
                          {errors[`service_${index}_duration`] && (
                            <p className="mt-1 text-sm text-red-600">{errors[`service_${index}_duration`]}</p>
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
                            value={service.price_cents}
                            onChange={(e) => updateService(index, 'price_cents', parseInt(e.target.value, 10) || 0)}
                            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
                              errors[`service_${index}_price`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            disabled={disabled || isSubmitting}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {formatPrice(service.price_cents)}
                          </p>
                          {errors[`service_${index}_price`] && (
                            <p className="mt-1 text-sm text-red-600">{errors[`service_${index}_price`]}</p>
                          )}
                        </div>
                      </div>

                      {/* Pre-appointment Instructions */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Pre-appointment Instructions
                        </label>
                        <textarea
                          value={service.pre_appointment_instructions}
                          onChange={(e) => updateService(index, 'pre_appointment_instructions', e.target.value)}
                          rows={2}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Any special instructions for customers..."
                          disabled={disabled || isSubmitting}
                        />
                      </div>

                      {/* Add Service Button */}
                      {onSaveService && (
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                          {service.isSaved ? (
                            <div className="flex items-center text-green-600">
                              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm font-medium">Service Added Successfully</span>
                            </div>
                          ) : (
                            <div></div>
                          )}
                          <button
                            type="button"
                            onClick={() => saveIndividualService(index)}
                            disabled={disabled || isSubmitting || savingServices.has(index) || service.isSaved}
                            className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              service.isSaved 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            }`}
                          >
                            {savingServices.has(index) ? 'Adding...' : service.isSaved ? 'Added' : 'Add Service'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {services.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No services yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Add services to this category that customers can book.
                    </p>
                  </div>
                )}
              </div>
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
            {isSubmitting ? 'Saving...' : (category ? 'Update Category' : 'Create Category')}
          </button>
        </div>
      </form>
    </div>
  );
};
