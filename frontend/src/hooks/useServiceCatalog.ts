/**
 * useServiceCatalog Hook
 * 
 * Custom hook for managing service catalog state and operations.
 * Handles service CRUD operations, validation, and form state management.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { servicesService, servicesUtils } from '../api/services/services';
import type {
  ServiceData,
  ServiceFormData,
  ServiceValidationError,
  CreateServiceRequest,
  UpdateServiceRequest,
} from '../api/types/services';

interface UseServiceCatalogOptions {
  initialServices?: ServiceData[];
  onServiceCreated?: (service: ServiceData) => void;
  onServiceUpdated?: (service: ServiceData) => void;
  onServiceDeleted?: (serviceId: string) => void;
  onError?: (error: Error) => void;
}

interface UseServiceCatalogReturn {
  // State
  services: ServiceData[];
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;
  validationErrors: ServiceValidationError[];

  // Service operations
  createService: (serviceData: ServiceFormData) => Promise<ServiceData | null>;
  updateService: (serviceId: string, serviceData: ServiceFormData) => Promise<ServiceData | null>;
  deleteService: (serviceId: string) => Promise<boolean>;
  getService: (serviceId: string) => ServiceData | undefined;

  // Form operations
  validateService: (serviceData: Partial<ServiceFormData>) => ServiceValidationError[];
  clearErrors: () => void;
  setError: (field: string, message: string) => void;

  // Utility functions
  formatPrice: (priceCents: number) => string;
  formatDuration: (durationMinutes: number) => string;
  generateSlug: (name: string) => string;

  // Computed values
  totalServices: number;
  activeServices: number;
  servicesByCategory: Record<string, ServiceData[]>;
}

export const useServiceCatalog = (options: UseServiceCatalogOptions = {}): UseServiceCatalogReturn => {
  const { initialServices = [], onServiceCreated, onServiceUpdated, onServiceDeleted, onError } = options;

  // State
  const [services, setServices] = useState<ServiceData[]>(initialServices);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ServiceValidationError[]>([]);

  // Load services from API on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        setIsLoading(true);
        const response = await servicesService.getServices();
        const servicesData: ServiceData[] = response.map(service => ({
          id: service.id,
          name: service.name,
          description: service.description,
          duration_minutes: service.duration_minutes,
          price_cents: service.price_cents,
          category: service.category,
          image_url: service.image_url,
          special_requests_enabled: service.special_requests_enabled,
          special_requests_limit: service.special_requests_limit,
          quick_chips: service.quick_chips,
          pre_appointment_instructions: service.pre_appointment_instructions,
          buffer_before_minutes: service.buffer_before_minutes,
          buffer_after_minutes: service.buffer_after_minutes,
          active: service.active,
          created_at: service.created_at,
          updated_at: service.updated_at,
        }));
        setServices(servicesData);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to load services'));
      } finally {
        setIsLoading(false);
      }
    };

    loadServices();
  }, []); // Empty dependency array - only run on mount

  // Service operations
  const createService = useCallback(async (serviceData: ServiceFormData): Promise<ServiceData | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate service data
      const validationErrors = validateService(serviceData);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        return null;
      }

      // Convert to API request format - use duration_min instead of duration_minutes
      const createRequest: CreateServiceRequest = {
        name: serviceData.name,
        description: serviceData.description,
        duration_min: serviceData.duration_minutes, // Backend expects duration_min
        price_cents: serviceData.price_cents,
        category: serviceData.category,
        image_url: serviceData.image_url,
        special_requests_enabled: serviceData.special_requests_enabled,
        special_requests_limit: serviceData.special_requests_limit,
        quick_chips: serviceData.quick_chips,
        pre_appointment_instructions: serviceData.pre_appointment_instructions,
        buffer_before_minutes: serviceData.buffer_before_minutes,
        buffer_after_minutes: serviceData.buffer_after_minutes,
        active: true,
      };

      // Create service via API
      const response = await servicesService.createService(createRequest);
      
      // Convert response to ServiceData
      const newService: ServiceData = {
        id: response.id,
        name: response.name,
        description: response.description,
        duration_minutes: response.duration_minutes,
        price_cents: response.price_cents,
        category: response.category,
        image_url: response.image_url,
        special_requests_enabled: response.special_requests_enabled,
        special_requests_limit: response.special_requests_limit,
        quick_chips: response.quick_chips,
        pre_appointment_instructions: response.pre_appointment_instructions,
        buffer_before_minutes: response.buffer_before_minutes,
        buffer_after_minutes: response.buffer_after_minutes,
        active: response.active,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setServices(prev => [...prev, newService]);

      // Call success callback
      onServiceCreated?.(newService);

      return newService;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create service';
      setError('create', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [onServiceCreated, onError]);

  const updateService = useCallback(async (serviceId: string, serviceData: ServiceFormData): Promise<ServiceData | null> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Validate service data
      const validationErrors = validateService(serviceData);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        return null;
      }

      // Convert to API request format - use duration_min instead of duration_minutes
      const updateRequest: UpdateServiceRequest = {
        id: serviceId,
        name: serviceData.name,
        description: serviceData.description,
        duration_min: serviceData.duration_minutes, // Backend expects duration_min
        price_cents: serviceData.price_cents,
        category: serviceData.category,
        image_url: serviceData.image_url,
        special_requests_enabled: serviceData.special_requests_enabled,
        special_requests_limit: serviceData.special_requests_limit,
        quick_chips: serviceData.quick_chips,
        pre_appointment_instructions: serviceData.pre_appointment_instructions,
        buffer_before_minutes: serviceData.buffer_before_minutes,
        buffer_after_minutes: serviceData.buffer_after_minutes,
        active: true,
      };

      // Update service via API
      const response = await servicesService.updateService(serviceId, updateRequest);
      
      // Convert response to ServiceData
      const updatedService: ServiceData = {
        id: response.id,
        name: response.name,
        description: response.description,
        duration_minutes: response.duration_minutes,
        price_cents: response.price_cents,
        category: response.category,
        image_url: response.image_url,
        special_requests_enabled: response.special_requests_enabled,
        special_requests_limit: response.special_requests_limit,
        quick_chips: response.quick_chips,
        pre_appointment_instructions: response.pre_appointment_instructions,
        buffer_before_minutes: response.buffer_before_minutes,
        buffer_after_minutes: response.buffer_after_minutes,
        active: response.active,
        created_at: response.created_at,
        updated_at: response.updated_at,
      };

      // Update local state
      setServices(prev => prev.map(service => 
        service.id === serviceId ? updatedService : service
      ));

      // Call success callback
      onServiceUpdated?.(updatedService);

      return updatedService;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update service';
      setError('update', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [onServiceUpdated, onError]);

  const deleteService = useCallback(async (serviceId: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      // Delete service via API
      await servicesService.deleteService(serviceId);

      // Update local state
      setServices(prev => prev.filter(service => service.id !== serviceId));

      // Call success callback
      onServiceDeleted?.(serviceId);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete service';
      setError('delete', errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onServiceDeleted, onError]);

  const getService = useCallback((serviceId: string): ServiceData | undefined => {
    return services.find(service => service.id === serviceId);
  }, [services]);

  // Form operations
  const validateService = useCallback((serviceData: Partial<ServiceFormData>): ServiceValidationError[] => {
    const errors: ServiceValidationError[] = [];

    if (!serviceData.name || serviceData.name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'Service name must be at least 2 characters long',
        code: 'INVALID_NAME',
      });
    }

    if (!serviceData.description || serviceData.description.trim().length < 10) {
      errors.push({
        field: 'description',
        message: 'Service description must be at least 10 characters long',
        code: 'INVALID_DESCRIPTION',
      });
    }

    if (!serviceData.duration_minutes || serviceData.duration_minutes < 15) {
      errors.push({
        field: 'duration_minutes',
        message: 'Service duration must be at least 15 minutes',
        code: 'INVALID_DURATION',
      });
    }

    if (serviceData.duration_minutes && serviceData.duration_minutes > 480) {
      errors.push({
        field: 'duration_minutes',
        message: 'Service duration cannot exceed 8 hours',
        code: 'INVALID_DURATION',
      });
    }

    if (serviceData.price_cents !== undefined && serviceData.price_cents < 0) {
      errors.push({
        field: 'price_cents',
        message: 'Service price cannot be negative',
        code: 'INVALID_PRICE',
      });
    }

    if (serviceData.special_requests_limit && serviceData.special_requests_limit < 10) {
      errors.push({
        field: 'special_requests_limit',
        message: 'Special requests limit must be at least 10 characters',
        code: 'INVALID_SPECIAL_REQUESTS_LIMIT',
      });
    }

    if (serviceData.quick_chips && serviceData.quick_chips.length > 10) {
      errors.push({
        field: 'quick_chips',
        message: 'Cannot have more than 10 quick chips',
        code: 'INVALID_QUICK_CHIPS',
      });
    }

    return errors;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setValidationErrors([]);
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  // Utility functions
  const formatPrice = useCallback((priceCents: number): string => {
    return servicesUtils.formatPrice(priceCents);
  }, []);

  const formatDuration = useCallback((durationMinutes: number): string => {
    return servicesUtils.formatDuration(durationMinutes);
  }, []);

  const generateSlug = useCallback((name: string): string => {
    return servicesUtils.generateServiceSlug(name);
  }, []);

  // Computed values
  const totalServices = useMemo(() => services.length, [services]);
  
  const activeServices = useMemo(() => 
    services.filter(service => service.active !== false).length, 
    [services]
  );

  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, ServiceData[]> = {};
    services.forEach(service => {
      const category = service.category || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(service);
    });
    return grouped;
  }, [services]);

  return {
    // State
    services,
    isLoading,
    isSubmitting,
    errors,
    validationErrors,

    // Service operations
    createService,
    updateService,
    deleteService,
    getService,

    // Form operations
    validateService,
    clearErrors,
    setError,

    // Utility functions
    formatPrice,
    formatDuration,
    generateSlug,

    // Computed values
    totalServices,
    activeServices,
    servicesByCategory,
  };
};
