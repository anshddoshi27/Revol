/**
 * Admin API Service
 * 
 * Service functions for admin dashboard and business management.
 * Connects to the real backend APIs for business operations.
 */

import { apiClient } from '../client';

// Types
export interface DashboardStats {
  totalBookings: number;
  todayBookings: number;
  totalRevenue: number;
  activeCustomers: number;
  pendingBookings: number;
  completedBookings: number;
}

export interface RecentBooking {
  id: string;
  customerName: string;
  serviceName: string;
  startTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  amount: number;
}

export interface BusinessAnalytics {
  revenue: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  customers: {
    total: number;
    new: number;
    returning: number;
  };
}

// Dashboard API
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const response = await apiClient.get('/admin/dashboard/stats');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    throw error;
  }
};

export const getRecentBookings = async (limit: number = 10): Promise<RecentBooking[]> => {
  try {
    const response = await apiClient.get(`/admin/bookings/recent?limit=${limit}`);
    return response.data.bookings;
  } catch (error) {
    console.error('Failed to fetch recent bookings:', error);
    throw error;
  }
};

export const getBusinessAnalytics = async (period: 'week' | 'month' | 'year' = 'month'): Promise<BusinessAnalytics> => {
  try {
    const response = await apiClient.get(`/admin/analytics?period=${period}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch business analytics:', error);
    throw error;
  }
};

// Business Settings API
export const getBusinessSettings = async () => {
  try {
    const response = await apiClient.get('/admin/settings');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch business settings:', error);
    throw error;
  }
};

export const updateBusinessSettings = async (settings: any) => {
  try {
    const response = await apiClient.put('/admin/settings', settings);
    return response.data;
  } catch (error) {
    console.error('Failed to update business settings:', error);
    throw error;
  }
};

// Staff Management API
export const getStaffMembers = async () => {
  try {
    const response = await apiClient.get('/admin/staff');
    return response.data.staff;
  } catch (error) {
    console.error('Failed to fetch staff members:', error);
    throw error;
  }
};

export const createStaffMember = async (staffData: any) => {
  try {
    const response = await apiClient.post('/admin/staff', staffData);
    return response.data;
  } catch (error) {
    console.error('Failed to create staff member:', error);
    throw error;
  }
};

export const updateStaffMember = async (staffId: string, staffData: any) => {
  try {
    const response = await apiClient.put(`/admin/staff/${staffId}`, staffData);
    return response.data;
  } catch (error) {
    console.error('Failed to update staff member:', error);
    throw error;
  }
};

export const deleteStaffMember = async (staffId: string) => {
  try {
    const response = await apiClient.delete(`/admin/staff/${staffId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete staff member:', error);
    throw error;
  }
};

// Business Profile API
export const getBusinessProfile = async () => {
  try {
    const response = await apiClient.get('/admin/profile');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch business profile:', error);
    throw error;
  }
};

export const updateBusinessProfile = async (profileData: any) => {
  try {
    const response = await apiClient.put('/admin/profile', profileData);
    return response.data;
  } catch (error) {
    console.error('Failed to update business profile:', error);
    throw error;
  }
};

// Upload API
export const uploadBusinessLogo = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('logo', file);
    
    const response = await apiClient.post('/admin/upload/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to upload business logo:', error);
    throw error;
  }
};

export const uploadBusinessCover = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('cover', file);
    
    const response = await apiClient.post('/admin/upload/cover', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to upload business cover:', error);
    throw error;
  }
};
