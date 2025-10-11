/**
 * Step3Services Page
 * 
 * Third step of the onboarding wizard - Services, Categories & Defaults.
 * This page allows business owners to create their service catalog with
 * categories, services, pricing, and special requests configuration.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CategoryWithServicesForm } from '../../components/onboarding/CategoryWithServicesForm';
import { ServiceEditForm } from '../../components/onboarding/ServiceEditForm';
import { useServiceCatalog } from '../../hooks/useServiceCatalog';
import { useCategoryManagement } from '../../hooks/useCategoryManagement';
import { servicesService, categoriesService } from '../../api/services/services';
import { onboardingStep3Observability, onboardingStep3ErrorTracking, onboardingStep3PerformanceTracking } from '../../observability/onboarding';
import type { ServiceData, CategoryData, ServiceFormData, CategoryFormData } from '../../api/types/services';

interface Step3ServicesState {
  step1Data?: any;
  step2Data?: any;
  prefill?: any;
  existingServices?: ServiceData[];
  existingCategories?: CategoryData[];
}

export const Step3Services: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<Step3ServicesState>({});
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | undefined>();
  const [editingService, setEditingService] = useState<ServiceData | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Initialize state from navigation
  useEffect(() => {
    if (location.state) {
      setState(location.state as Step3ServicesState);
      
      // Track step started
      onboardingStep3Observability.trackStepStarted({
        has_step1_data: !!location.state.step1Data,
        has_step2_data: !!location.state.step2Data,
      });
    }
  }, [location.state]);

  // No need to load existing data here - the hooks will load it themselves

  // Service catalog management
  const {
    services,
    createService,
    updateService,
    deleteService,
    formatPrice,
    formatDuration,
  } = useServiceCatalog({
    initialServices: [], // Don't use initialServices to avoid circular dependency
    onServiceCreated: (service) => {
      onboardingStep3Observability.trackServiceCreated({
        service_id: service.id,
        service_name: service.name,
        has_image: !!service.image_url,
        has_special_requests: service.special_requests_enabled,
        category: service.category,
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
      });
    },
    onServiceUpdated: (service) => {
      onboardingStep3Observability.trackServiceUpdated({
        service_id: service.id,
        service_name: service.name,
        has_image: !!service.image_url,
        has_special_requests: service.special_requests_enabled,
        category: service.category,
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
      });
    },
    onServiceDeleted: (serviceId) => {
      onboardingStep3Observability.trackServiceDeleted({
        service_id: serviceId,
      });
    },
    onError: (error) => {
      setError(error.message);
      onboardingStep3ErrorTracking.trackApiError({
        endpoint: '/api/v1/services',
        status_code: 500,
        error_code: 'SERVICE_ERROR',
        message: error.message,
      });
    },
  });

  // Category management
  const {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useCategoryManagement({
    initialCategories: [], // Don't use initialCategories to avoid circular dependency
    onCategoryCreated: (category) => {
      onboardingStep3Observability.trackCategoryCreated({
        category_id: category.id,
        category_name: category.name,
        color: category.color,
      });
    },
    onCategoryUpdated: (category) => {
      onboardingStep3Observability.trackCategoryUpdated({
        category_id: category.id,
        category_name: category.name,
        color: category.color,
      });
    },
    onCategoryDeleted: (categoryId) => {
      onboardingStep3Observability.trackCategoryDeleted({
        category_id: categoryId,
      });
    },
    onError: (error) => {
      setError(error.message);
      onboardingStep3ErrorTracking.trackApiError({
        endpoint: '/api/v1/categories',
        status_code: 500,
        error_code: 'CATEGORY_ERROR',
        message: error.message,
      });
    },
  });

  const handleCategoryWithServicesSave = useCallback(async (categoryData: CategoryFormData, servicesData: ServiceFormData[]) => {
    try {
      console.log('Main component save handler called');
      console.log('Category data:', categoryData);
      console.log('Services data:', servicesData);
      
      setIsSubmitting(true);
      setError('');

      // Create the category first
      console.log('Creating category...');
      const category = await createCategory(categoryData);
      console.log('Category created:', category);

      if (category) {
        // Create all services for this category
        console.log('Creating services...');
        for (const serviceData of servicesData) {
          console.log('Creating service:', serviceData);
          const result = await createService(serviceData);
          console.log('Service created:', result);
        }
      }

      setShowForm(false);
      setEditingCategory(undefined);
      console.log('Save completed successfully');
    } catch (error) {
      console.error('Save failed in main component:', error);
      setError(error instanceof Error ? error.message : 'Failed to save category and services');
    } finally {
      setIsSubmitting(false);
    }
  }, [createCategory, createService]);

  const handleSaveIndividualService = useCallback(async (serviceData: ServiceFormData) => {
    try {
      console.log('Saving individual service:', serviceData);
      const result = await createService(serviceData);
      console.log('Individual service created:', result);
    } catch (error) {
      console.error('Failed to save individual service:', error);
      throw error; // Re-throw to let the form handle the error
    }
  }, [createService]);

  const handleAddCategory = useCallback(() => {
    setEditingCategory(undefined);
    setShowForm(true);
  }, []);

  const handleEditCategory = useCallback((category: CategoryData) => {
    setEditingCategory(category);
    setShowForm(true);
  }, []);

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    if (window.confirm('Are you sure you want to delete this category and all its services?')) {
      await deleteCategory(categoryId);
    }
  }, [deleteCategory]);

  const handleEditService = useCallback((service: ServiceData) => {
    setEditingService(service);
  }, []);

  const handleUpdateService = useCallback(async (serviceId: string, serviceData: ServiceFormData) => {
    try {
      setIsSubmitting(true);
      setError('');
      
      const updatedService = await updateService(serviceId, serviceData);
      if (updatedService) {
        setEditingService(undefined);
        console.log('Service updated successfully:', updatedService);
      }
    } catch (error) {
      console.error('Failed to update service:', error);
      setError(error instanceof Error ? error.message : 'Failed to update service');
    } finally {
      setIsSubmitting(false);
    }
  }, [updateService]);

  const handleCancelServiceEdit = useCallback(() => {
    setEditingService(undefined);
  }, []);

  const handleDeleteService = useCallback(async (serviceId: string) => {
    try {
      setIsSubmitting(true);
      setError('');
      
      const success = await deleteService(serviceId);
      if (success) {
        setEditingService(undefined);
        console.log('Service deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete service:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete service');
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteService]);

  const handleBack = useCallback(() => {
    if (showForm) {
      setShowForm(false);
      setEditingCategory(undefined);
    } else if (editingService) {
      setEditingService(undefined);
    } else {
      navigate('/onboarding/logo-colors', { state });
    }
  }, [showForm, editingService, navigate, state]);

  const handleNext = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setError('');

      // Validate that we have at least one service
      if (services.length === 0) {
        setError('Please create at least one service before continuing');
        return;
      }

      // Track step completion
      onboardingStep3Observability.trackStepCompleted({
        tenant_id: state.step1Data?.slug || 'unknown',
        total_services: services.length,
        total_categories: categories.length,
        services_with_images: services.filter(s => s.image_url).length,
        services_with_special_requests: services.filter(s => s.special_requests_enabled).length,
      });

      // Save to localStorage for persistence
      const onboardingData = {
        ...state,
        step3Data: {
          categories,
          services,
        },
      };
      localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));

      // Navigate to next step with all data
      navigate('/onboarding/availability', {
        state: onboardingData,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to proceed to next step');
    } finally {
      setIsSubmitting(false);
    }
  }, [services, categories, state, navigate]);

  const canProceed = services.length > 0;

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="ml-4 text-xl font-semibold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <CategoryWithServicesForm
            category={editingCategory}
            onSave={handleCategoryWithServicesSave}
            onSaveService={handleSaveIndividualService}
            onCancel={handleBack}
            onError={(error) => setError(error.message)}
            disabled={isSubmitting}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="ml-4 text-xl font-semibold text-gray-900">
                Step 3: Services & Categories
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">3 of 4</span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Progress Indicator */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Service Catalog Setup</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create categories and services that customers can book
                </p>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${categories.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  {categories.length} Categories
                </div>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${services.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  {services.length} Services
                </div>
              </div>
            </div>
          </div>

          {/* Categories and Services */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Service Categories</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Create categories and add services that customers can book
                  </p>
                </div>
                <button
                  onClick={handleAddCategory}
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Category
                </button>
              </div>

              {/* Categories List */}
              {categories.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No categories yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Get started by creating your first category with services.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={handleAddCategory}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Category
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {categories.map((category) => {
                    const categoryServices = services.filter(service => service.category === category.name);
                    return (
                      <div key={category.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: category.color }}
                              aria-label={`Category color: ${category.color}`}
                            />
                            <div>
                              <h4 className="text-lg font-medium text-gray-900">{category.name}</h4>
                              {category.description && (
                                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                              )}
                              <div className="flex items-center space-x-2 mt-1">
                                <p className="text-xs text-gray-400">
                                  {categoryServices.length} service{categoryServices.length !== 1 ? 's' : ''}
                                </p>
                                {categoryServices.length > 0 && (
                                  <span className="text-xs text-green-600 font-medium">• Active</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditCategory(category)}
                              className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                              aria-label={`Edit category ${category.name}`}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(category.id!)}
                              className="text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                              aria-label={`Delete category ${category.name}`}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Services in this category - Nested within the category */}
                        <div className="mt-4 border-t border-gray-200 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-sm font-medium text-gray-700">Services in this category</h5>
                            <span className="text-xs text-gray-500">
                              {categoryServices.length} service{categoryServices.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {categoryServices.length > 0 ? (
                            <div className="space-y-3">
                              {categoryServices.map((service) => (
                                <div key={service.id}>
                                  {editingService?.id === service.id ? (
                                    <ServiceEditForm
                                      service={service}
                                      onSave={handleUpdateService}
                                      onDelete={handleDeleteService}
                                      onCancel={handleCancelServiceEdit}
                                      onError={(error) => setError(error.message)}
                                      disabled={isSubmitting}
                                    />
                                  ) : (
                                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-3">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                            <div className="flex-1">
                                              <h6 className="text-sm font-medium text-gray-900">{service.name}</h6>
                                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center">
                                                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                  </svg>
                                                  {formatDuration(service.duration_minutes)}
                                                </span>
                                                <span className="flex items-center">
                                                  <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                  </svg>
                                                  {formatPrice(service.price_cents)}
                                                </span>
                                              </div>
                                              {service.pre_appointment_instructions && (
                                                <div className="mt-2 text-xs text-gray-500">
                                                  <span className="font-medium">Instructions:</span> {service.pre_appointment_instructions}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                          <button
                                            onClick={() => handleEditService(service)}
                                            className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                                            aria-label={`Edit service ${service.name}`}
                                          >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (window.confirm(`Are you sure you want to delete "${service.name}"?`)) {
                                                deleteService(service.id!);
                                              }
                                            }}
                                            className="text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                                            aria-label={`Delete service ${service.name}`}
                                          >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-6 bg-gray-50 border border-gray-200 rounded-lg">
                              <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <p className="mt-2 text-sm text-gray-500">No services in this category yet</p>
                              <p className="text-xs text-gray-400 mt-1">Edit the category to add services</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-6">
            <button
              onClick={handleBack}
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed || isSubmitting}
              className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Continue to Availability'}
              <svg className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
