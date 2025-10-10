/**
 * Step3Services Page
 * 
 * Third step of the onboarding wizard - Services, Categories & Defaults.
 * This page allows business owners to create their service catalog with
 * categories, services, pricing, and special requests configuration.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CategoryCRUD } from '../../components/onboarding/CategoryCRUD';
import { ServiceCardEditor } from '../../components/onboarding/ServiceCardEditor';
import { useServiceCatalog } from '../../hooks/useServiceCatalog';
import { useCategoryManagement } from '../../hooks/useCategoryManagement';
import { onboardingStep3Observability, onboardingStep3ErrorTracking, onboardingStep3PerformanceTracking } from '../../observability/onboarding';
import type { ServiceData, CategoryData, ServiceFormData } from '../../api/types/services';

interface Step3ServicesState {
  step1Data?: any;
  step2Data?: any;
  prefill?: any;
}

export const Step3Services: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<Step3ServicesState>({});
  const [currentView, setCurrentView] = useState<'categories' | 'services' | 'editor'>('categories');
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

  // Service catalog management
  const {
    services,
    createService,
    updateService,
    deleteService,
    formatPrice,
    formatDuration,
  } = useServiceCatalog({
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

  const handleServiceSave = useCallback(async (serviceData: ServiceFormData) => {
    try {
      setIsSubmitting(true);
      setError('');

      if (editingService) {
        await updateService(editingService.id!, serviceData);
      } else {
        await createService(serviceData);
      }

      setCurrentView('services');
      setEditingService(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save service');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingService, createService, updateService]);

  const handleServiceEdit = useCallback((service: ServiceData) => {
    setEditingService(service);
    setCurrentView('editor');
  }, []);

  const handleServiceDelete = useCallback(async (serviceId: string) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      await deleteService(serviceId);
    }
  }, [deleteService]);

  const handleAddService = useCallback(() => {
    setEditingService(undefined);
    setCurrentView('editor');
  }, []);

  const handleBack = useCallback(() => {
    if (currentView === 'editor') {
      setCurrentView('services');
      setEditingService(undefined);
    } else if (currentView === 'services') {
      setCurrentView('categories');
    } else {
      navigate('/onboarding/logo-colors', { state });
    }
  }, [currentView, navigate, state]);

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

      // Navigate to next step with all data
      navigate('/onboarding/availability', {
        state: {
          ...state,
          step3Data: {
            categories,
            services,
          },
        },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to proceed to next step');
    } finally {
      setIsSubmitting(false);
    }
  }, [services, categories, state, navigate]);

  const canProceed = services.length > 0;

  if (currentView === 'editor') {
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
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ServiceCardEditor
            service={editingService}
            categories={categories}
            onSave={handleServiceSave}
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

          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
                  onClick={() => setCurrentView('categories')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    currentView === 'categories'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Categories
                </button>
                <button
                  onClick={() => setCurrentView('services')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    currentView === 'services'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Services ({services.length})
                </button>
              </nav>
            </div>

            <div className="p-6">
              {currentView === 'categories' && (
                <CategoryCRUD
                  initialCategories={categories}
                  onCategoriesChange={() => {}} // Categories are managed by the hook
                  onError={(error) => setError(error.message)}
                  disabled={isSubmitting}
                />
              )}

              {currentView === 'services' && (
                <div className="space-y-6">
                  {/* Services Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Services</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Create services that customers can book
                      </p>
                    </div>
                    <button
                      onClick={handleAddService}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Service
                    </button>
                  </div>

                  {/* Services List */}
                  {services.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No services yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Get started by creating your first service.
                      </p>
                      <div className="mt-6">
                        <button
                          onClick={handleAddService}
                          disabled={isSubmitting}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Service
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {services.map((service) => (
                        <div key={service.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{service.name}</h4>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                <span>{formatDuration(service.duration_minutes)}</span>
                                <span>{formatPrice(service.price_cents)}</span>
                                {service.category && (
                                  <span className="px-2 py-1 bg-gray-100 rounded-full">{service.category}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => handleServiceEdit(service)}
                                disabled={isSubmitting}
                                className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                                aria-label={`Edit ${service.name}`}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleServiceDelete(service.id!)}
                                disabled={isSubmitting}
                                className="text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                                aria-label={`Delete ${service.name}`}
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
