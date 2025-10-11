/**
 * Service API Service
 * 
 * Service functions for service management and operations.
 * Connects to the real backend service APIs.
 */

import { apiClient } from '../client';

// Types
export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: number; // in minutes
  price: number;
  isActive: boolean;
  maxBookingsPerSlot: number;
  requiresStaff: boolean;
  staffMembers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFilters {
  category?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateServiceData {
  name: string;
  description: string;
  category: string;
  duration: number;
  price: number;
  maxBookingsPerSlot: number;
  requiresStaff: boolean;
  staffMemberIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
}

// Service Management API
export const getServices = async (filters: ServiceFilters = {}): Promise<{ services: Service[]; total: number; page: number; limit: number }> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.isActive !== undefined) params.append('is_active', filters.isActive.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/admin/services?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch services:', error);
    throw error;
  }
};

export const getServiceById = async (serviceId: string): Promise<Service> => {
  try {
    const response = await apiClient.get(`/admin/services/${serviceId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch service:', error);
    throw error;
  }
};

export const createService = async (serviceData: CreateServiceData): Promise<Service> => {
  try {
    const response = await apiClient.post('/admin/services', serviceData);
    return response.data;
  } catch (error) {
    console.error('Failed to create service:', error);
    throw error;
  }
};

export const updateService = async (serviceId: string, serviceData: Partial<CreateServiceData>): Promise<Service> => {
  try {
    const response = await apiClient.put(`/admin/services/${serviceId}`, serviceData);
    return response.data;
  } catch (error) {
    console.error('Failed to update service:', error);
    throw error;
  }
};

export const toggleServiceStatus = async (serviceId: string): Promise<Service> => {
  try {
    const response = await apiClient.patch(`/admin/services/${serviceId}/toggle-status`);
    return response.data;
  } catch (error) {
    console.error('Failed to toggle service status:', error);
    throw error;
  }
};

export const deleteService = async (serviceId: string): Promise<void> => {
  try {
    await apiClient.delete(`/admin/services/${serviceId}`);
  } catch (error) {
    console.error('Failed to delete service:', error);
    throw error;
  }
};

// Categories API
export const getCategories = async (): Promise<Category[]> => {
  try {
    const response = await apiClient.get('/categories');
    return response.data.categories;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
};

export const createCategory = async (categoryData: { name: string; description?: string; color?: string }): Promise<Category> => {
  try {
    const response = await apiClient.post('/categories', categoryData);
    return response.data;
  } catch (error) {
    console.error('Failed to create category:', error);
    throw error;
  }
};

export const updateCategory = async (categoryId: string, categoryData: Partial<{ name: string; description?: string; color?: string }>): Promise<Category> => {
  try {
    const response = await apiClient.put(`/categories/${categoryId}`, categoryData);
    return response.data;
  } catch (error) {
    console.error('Failed to update category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  try {
    await apiClient.delete(`/categories/${categoryId}`);
  } catch (error) {
    console.error('Failed to delete category:', error);
    throw error;
  }
};

// Service Analytics
export const getServiceAnalytics = async (serviceId?: string): Promise<any> => {
  try {
    const url = serviceId ? `/admin/services/${serviceId}/analytics` : '/admin/services/analytics';
    const response = await apiClient.get(url);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch service analytics:', error);
    throw error;
  }
};

// Public Service API
export const getPublicServices = async (businessSlug: string, filters: ServiceFilters = {}): Promise<{ services: Service[]; total: number }> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.isActive !== undefined) params.append('is_active', filters.isActive.toString());
    if (filters.search) params.append('search', filters.search);

    const response = await apiClient.get(`/v1/${businessSlug}/services?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch public services:', error);
    throw error;
  }
};

export const getPublicServiceById = async (businessSlug: string, serviceId: string): Promise<Service> => {
  try {
    const response = await apiClient.get(`/v1/${businessSlug}/services/${serviceId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch public service:', error);
    throw error;
  }
};

// Bulk Operations
export const bulkUpdateServices = async (serviceIds: string[], updates: Partial<CreateServiceData>): Promise<void> => {
  try {
    await apiClient.patch('/admin/services/bulk', { 
      service_ids: serviceIds, 
      updates 
    });
  } catch (error) {
    console.error('Failed to bulk update services:', error);
    throw error;
  }
};

export const bulkDeleteServices = async (serviceIds: string[]): Promise<void> => {
  try {
    await apiClient.delete('/admin/services/bulk', { 
      data: { service_ids: serviceIds } 
    });
  } catch (error) {
    console.error('Failed to bulk delete services:', error);
    throw error;
  }
};

export const bulkToggleServiceStatus = async (serviceIds: string[], isActive: boolean): Promise<void> => {
  try {
    await apiClient.patch('/admin/services/bulk/toggle-status', { 
      service_ids: serviceIds, 
      is_active: isActive 
    });
  } catch (error) {
    console.error('Failed to bulk toggle service status:', error);
    throw error;
  }
};
