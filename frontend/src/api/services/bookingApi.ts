/**
 * Booking API Service
 * 
 * Service functions for booking management and operations.
 * Connects to the real backend booking APIs.
 */

import { apiClient } from '../client';

// Types
export interface Booking {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  staffName: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  amount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingFilters {
  status?: string;
  date?: string;
  staffId?: string;
  serviceId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface CreateBookingData {
  serviceId: string;
  staffId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

// Booking Management API
export const getBookings = async (filters: BookingFilters = {}): Promise<{ bookings: Booking[]; total: number; page: number; limit: number }> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.date) params.append('date', filters.date);
    if (filters.staffId) params.append('staff_id', filters.staffId);
    if (filters.serviceId) params.append('service_id', filters.serviceId);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/admin/bookings?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    throw error;
  }
};

export const getBookingById = async (bookingId: string): Promise<Booking> => {
  try {
    const response = await apiClient.get(`/admin/bookings/${bookingId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch booking:', error);
    throw error;
  }
};

export const createBooking = async (bookingData: CreateBookingData): Promise<Booking> => {
  try {
    const response = await apiClient.post('/admin/bookings', bookingData);
    return response.data;
  } catch (error) {
    console.error('Failed to create booking:', error);
    throw error;
  }
};

export const updateBooking = async (bookingId: string, bookingData: Partial<CreateBookingData>): Promise<Booking> => {
  try {
    const response = await apiClient.put(`/admin/bookings/${bookingId}`, bookingData);
    return response.data;
  } catch (error) {
    console.error('Failed to update booking:', error);
    throw error;
  }
};

export const updateBookingStatus = async (bookingId: string, status: string): Promise<Booking> => {
  try {
    const response = await apiClient.patch(`/admin/bookings/${bookingId}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('Failed to update booking status:', error);
    throw error;
  }
};

export const markAttendance = async (bookingId: string, attended: boolean): Promise<Booking> => {
  try {
    const response = await apiClient.patch(`/admin/bookings/${bookingId}/attendance`, { attended });
    return response.data;
  } catch (error) {
    console.error('Failed to mark attendance:', error);
    throw error;
  }
};

export const deleteBooking = async (bookingId: string): Promise<void> => {
  try {
    await apiClient.delete(`/admin/bookings/${bookingId}`);
  } catch (error) {
    console.error('Failed to delete booking:', error);
    throw error;
  }
};

export const getBookingStats = async (): Promise<BookingStats> => {
  try {
    const response = await apiClient.get('/admin/bookings/stats');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch booking stats:', error);
    throw error;
  }
};

// Bulk Operations
export const bulkUpdateBookingStatus = async (bookingIds: string[], status: string): Promise<void> => {
  try {
    await apiClient.patch('/admin/bookings/bulk/status', { 
      booking_ids: bookingIds, 
      status 
    });
  } catch (error) {
    console.error('Failed to bulk update booking status:', error);
    throw error;
  }
};

export const bulkDeleteBookings = async (bookingIds: string[]): Promise<void> => {
  try {
    await apiClient.delete('/admin/bookings/bulk', { 
      data: { booking_ids: bookingIds } 
    });
  } catch (error) {
    console.error('Failed to bulk delete bookings:', error);
    throw error;
  }
};

// Export/Import
export const exportBookings = async (filters: BookingFilters = {}): Promise<Blob> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.date) params.append('date', filters.date);
    if (filters.staffId) params.append('staff_id', filters.staffId);
    if (filters.serviceId) params.append('service_id', filters.serviceId);

    const response = await apiClient.get(`/admin/bookings/export?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to export bookings:', error);
    throw error;
  }
};

// Customer Booking API (Public)
export const getPublicBookings = async (businessSlug: string, filters: BookingFilters = {}): Promise<{ bookings: Booking[]; total: number }> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.date) params.append('date', filters.date);
    if (filters.search) params.append('search', filters.search);

    const response = await apiClient.get(`/v1/${businessSlug}/bookings?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch public bookings:', error);
    throw error;
  }
};

export const createPublicBooking = async (businessSlug: string, bookingData: CreateBookingData): Promise<Booking> => {
  try {
    const response = await apiClient.post(`/v1/${businessSlug}/bookings`, bookingData);
    return response.data;
  } catch (error) {
    console.error('Failed to create public booking:', error);
    throw error;
  }
};

export const cancelPublicBooking = async (businessSlug: string, bookingId: string): Promise<Booking> => {
  try {
    const response = await apiClient.patch(`/v1/${businessSlug}/bookings/${bookingId}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Failed to cancel public booking:', error);
    throw error;
  }
};

export const reschedulePublicBooking = async (businessSlug: string, bookingId: string, newStartTime: string, newEndTime: string): Promise<Booking> => {
  try {
    const response = await apiClient.patch(`/v1/${businessSlug}/bookings/${bookingId}/reschedule`, {
      start_time: newStartTime,
      end_time: newEndTime
    });
    return response.data;
  } catch (error) {
    console.error('Failed to reschedule public booking:', error);
    throw error;
  }
};
