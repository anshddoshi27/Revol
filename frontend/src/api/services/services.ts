/**
 * Services API Service
 * 
 * Service functions for service-related API endpoints.
 * Handles service CRUD operations, category management, and image uploads.
 */

import { tithiApiClient } from '../client';
import type {
  ServiceData,
  CategoryData,
  ServiceCatalogData,
  CreateServiceRequest,
  UpdateServiceRequest,
  ServiceResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryResponse,
  ServiceCatalogResponse,
  ServiceImageUploadData,
  ServiceImageUploadResponse,
} from '../types/services';

/**
 * Services API service
 */
export const servicesService = {
  /**
   * Get all services for the current tenant
   */
  getServices: async (): Promise<ServiceResponse[]> => {
    const client = tithiApiClient();
    const response = await client.get<{ services: ServiceResponse[] }>('/services');
    return response.services;
  },

  /**
   * Get a specific service by ID
   */
  getService: async (serviceId: string): Promise<ServiceResponse> => {
    const client = tithiApiClient();
    return client.get<ServiceResponse>(`/services/${serviceId}`);
  },

  /**
   * Create a new service
   */
  createService: async (serviceData: CreateServiceRequest): Promise<ServiceResponse> => {
    const client = tithiApiClient();
    return client.post<ServiceResponse>('/services', serviceData);
  },

  /**
   * Update an existing service
   */
  updateService: async (serviceId: string, serviceData: UpdateServiceRequest): Promise<ServiceResponse> => {
    const client = tithiApiClient();
    return client.put<ServiceResponse>(`/services/${serviceId}`, serviceData);
  },

  /**
   * Delete a service
   */
  deleteService: async (serviceId: string): Promise<void> => {
    const client = tithiApiClient();
    await client.delete(`/services/${serviceId}`);
  },

  /**
   * Get service catalog (services and categories)
   */
  getServiceCatalog: async (): Promise<ServiceCatalogResponse> => {
    const client = tithiApiClient();
    return client.get<ServiceCatalogResponse>('/services/catalog');
  },

  /**
   * Upload service image
   */
  uploadServiceImage: async (uploadData: ServiceImageUploadData): Promise<ServiceImageUploadResponse> => {
    const client = tithiApiClient();
    const formData = new FormData();
    formData.append('image', uploadData.file);
    if (uploadData.service_id) {
      formData.append('service_id', uploadData.service_id);
    }
    if (uploadData.cropped_data_url) {
      formData.append('cropped_data_url', uploadData.cropped_data_url);
    }

    return client.post<ServiceImageUploadResponse>('/services/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

/**
 * Categories API service
 */
export const categoriesService = {
  /**
   * Get all categories for the current tenant
   */
  getCategories: async (): Promise<CategoryResponse[]> => {
    const client = tithiApiClient();
    const response = await client.get<{ categories: CategoryResponse[] }>('/categories');
    return response.categories;
  },

  /**
   * Get a specific category by ID
   */
  getCategory: async (categoryId: string): Promise<CategoryResponse> => {
    const client = tithiApiClient();
    return client.get<CategoryResponse>(`/categories/${categoryId}`);
  },

  /**
   * Create a new category
   */
  createCategory: async (categoryData: CreateCategoryRequest): Promise<CategoryResponse> => {
    const client = tithiApiClient();
    return client.post<CategoryResponse>('/categories', categoryData);
  },

  /**
   * Update an existing category
   */
  updateCategory: async (categoryId: string, categoryData: UpdateCategoryRequest): Promise<CategoryResponse> => {
    const client = tithiApiClient();
    return client.put<CategoryResponse>(`/categories/${categoryId}`, categoryData);
  },

  /**
   * Delete a category
   */
  deleteCategory: async (categoryId: string): Promise<void> => {
    const client = tithiApiClient();
    await client.delete(`/categories/${categoryId}`);
  },
};

/**
 * Utility functions for services
 */
export const servicesUtils = {
  /**
   * Format price in cents to display format
   */
  formatPrice: (priceCents: number, currency: string = 'USD'): string => {
    const price = priceCents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  },

  /**
   * Format duration in minutes to display format
   */
  formatDuration: (durationMinutes: number): string => {
    if (durationMinutes < 60) {
      return `${durationMinutes} min`;
    }
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (minutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${minutes}m`;
  },

  /**
   * Generate service slug from name
   */
  generateServiceSlug: (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  },

  /**
   * Validate service data
   */
  validateServiceData: (data: Partial<ServiceData>): string[] => {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length < 2) {
      errors.push('Service name must be at least 2 characters long');
    }

    if (!data.description || data.description.trim().length < 10) {
      errors.push('Service description must be at least 10 characters long');
    }

    if (!data.duration_minutes || data.duration_minutes < 15) {
      errors.push('Service duration must be at least 15 minutes');
    }

    if (data.duration_minutes && data.duration_minutes > 480) {
      errors.push('Service duration cannot exceed 8 hours');
    }

    if (data.price_cents !== undefined && data.price_cents < 0) {
      errors.push('Service price cannot be negative');
    }

    if (data.special_requests_limit && data.special_requests_limit < 10) {
      errors.push('Special requests limit must be at least 10 characters');
    }

    if (data.quick_chips && data.quick_chips.length > 10) {
      errors.push('Cannot have more than 10 quick chips');
    }

    return errors;
  },

  /**
   * Validate category data
   */
  validateCategoryData: (data: Partial<CategoryData>): string[] => {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length < 2) {
      errors.push('Category name must be at least 2 characters long');
    }

    if (data.description && data.description.length > 500) {
      errors.push('Category description cannot exceed 500 characters');
    }

    return errors;
  },

  /**
   * Convert service data to API request format
   */
  toCreateServiceRequest: (data: ServiceData): CreateServiceRequest => {
    return {
      name: data.name,
      description: data.description,
      duration_minutes: data.duration_minutes,
      price_cents: data.price_cents,
      category: data.category,
      image_url: data.image_url,
      special_requests_enabled: data.special_requests_enabled,
      special_requests_limit: data.special_requests_limit,
      quick_chips: data.quick_chips,
      pre_appointment_instructions: data.pre_appointment_instructions,
      buffer_before_minutes: data.buffer_before_minutes,
      buffer_after_minutes: data.buffer_after_minutes,
      active: data.active ?? true,
    };
  },

  /**
   * Convert service data to API update request format
   */
  toUpdateServiceRequest: (data: ServiceData): UpdateServiceRequest => {
    if (!data.id) {
      throw new Error('Service ID is required for update');
    }

    return {
      id: data.id,
      ...servicesUtils.toCreateServiceRequest(data),
    };
  },

  /**
   * Convert category data to API request format
   */
  toCreateCategoryRequest: (data: CategoryData): CreateCategoryRequest => {
    return {
      name: data.name,
      description: data.description,
      color: data.color,
      sort_order: data.sort_order,
    };
  },

  /**
   * Convert category data to API update request format
   */
  toUpdateCategoryRequest: (data: CategoryData): UpdateCategoryRequest => {
    if (!data.id) {
      throw new Error('Category ID is required for update');
    }

    return {
      id: data.id,
      ...servicesUtils.toCreateCategoryRequest(data),
    };
  },
};
