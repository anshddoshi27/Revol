/**
 * Customer API Service
 * 
 * Service functions for customer management and operations.
 * Connects to the real backend customer APIs.
 */

import { apiClient } from '../client';

// Types
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  memberSince: string;
  totalBookings: number;
  favoriteBusinesses: string[];
  preferences: CustomerPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  reminders: {
    bookingReminder: boolean;
    followUp: boolean;
  };
  privacy: {
    shareData: boolean;
    marketing: boolean;
  };
}

export interface CustomerBooking {
  id: string;
  businessName: string;
  businessSlug: string;
  serviceName: string;
  staffName: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'completed' | 'cancelled' | 'no_show';
  amount: number;
  notes?: string;
  canCancel: boolean;
  canReschedule: boolean;
  createdAt: string;
}

export interface CustomerFilters {
  status?: string;
  businessId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GiftCard {
  id: string;
  code: string;
  amount: number;
  remainingAmount: number;
  businessName: string;
  businessSlug: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  isDefault: boolean;
  expiresAt?: string;
  createdAt: string;
}

// Customer Profile API
export const getCustomerProfile = async (): Promise<Customer> => {
  try {
    const response = await apiClient.get('/customer/profile');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch customer profile:', error);
    throw error;
  }
};

export const updateCustomerProfile = async (profileData: Partial<Customer>): Promise<Customer> => {
  try {
    const response = await apiClient.put('/customer/profile', profileData);
    return response.data;
  } catch (error) {
    console.error('Failed to update customer profile:', error);
    throw error;
  }
};

export const updateCustomerPreferences = async (preferences: Partial<CustomerPreferences>): Promise<Customer> => {
  try {
    const response = await apiClient.put('/customer/preferences', preferences);
    return response.data;
  } catch (error) {
    console.error('Failed to update customer preferences:', error);
    throw error;
  }
};

// Customer Bookings API
export const getCustomerBookings = async (filters: CustomerFilters = {}): Promise<{ bookings: CustomerBooking[]; total: number; page: number; limit: number }> => {
  try {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.businessId) params.append('business_id', filters.businessId);
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/customer/bookings?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch customer bookings:', error);
    throw error;
  }
};

export const getCustomerBookingById = async (bookingId: string): Promise<CustomerBooking> => {
  try {
    const response = await apiClient.get(`/customer/bookings/${bookingId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch customer booking:', error);
    throw error;
  }
};

export const cancelCustomerBooking = async (bookingId: string, reason?: string): Promise<CustomerBooking> => {
  try {
    const response = await apiClient.patch(`/customer/bookings/${bookingId}/cancel`, { reason });
    return response.data;
  } catch (error) {
    console.error('Failed to cancel customer booking:', error);
    throw error;
  }
};

export const rescheduleCustomerBooking = async (bookingId: string, newStartTime: string, newEndTime: string): Promise<CustomerBooking> => {
  try {
    const response = await apiClient.patch(`/customer/bookings/${bookingId}/reschedule`, {
      start_time: newStartTime,
      end_time: newEndTime
    });
    return response.data;
  } catch (error) {
    console.error('Failed to reschedule customer booking:', error);
    throw error;
  }
};

// Gift Cards API
export const getCustomerGiftCards = async (): Promise<GiftCard[]> => {
  try {
    const response = await apiClient.get('/customer/gift-cards');
    return response.data.gift_cards;
  } catch (error) {
    console.error('Failed to fetch customer gift cards:', error);
    throw error;
  }
};

export const getGiftCardByCode = async (code: string): Promise<GiftCard> => {
  try {
    const response = await apiClient.get(`/customer/gift-cards/${code}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch gift card:', error);
    throw error;
  }
};

export const redeemGiftCard = async (code: string): Promise<GiftCard> => {
  try {
    const response = await apiClient.post('/customer/gift-cards/redeem', { code });
    return response.data;
  } catch (error) {
    console.error('Failed to redeem gift card:', error);
    throw error;
  }
};

// Payment Methods API
export const getCustomerPaymentMethods = async (): Promise<PaymentMethod[]> => {
  try {
    const response = await apiClient.get('/customer/payment-methods');
    return response.data.payment_methods;
  } catch (error) {
    console.error('Failed to fetch customer payment methods:', error);
    throw error;
  }
};

export const addPaymentMethod = async (paymentMethodData: any): Promise<PaymentMethod> => {
  try {
    const response = await apiClient.post('/customer/payment-methods', paymentMethodData);
    return response.data;
  } catch (error) {
    console.error('Failed to add payment method:', error);
    throw error;
  }
};

export const updatePaymentMethod = async (paymentMethodId: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod> => {
  try {
    const response = await apiClient.put(`/customer/payment-methods/${paymentMethodId}`, updates);
    return response.data;
  } catch (error) {
    console.error('Failed to update payment method:', error);
    throw error;
  }
};

export const deletePaymentMethod = async (paymentMethodId: string): Promise<void> => {
  try {
    await apiClient.delete(`/customer/payment-methods/${paymentMethodId}`);
  } catch (error) {
    console.error('Failed to delete payment method:', error);
    throw error;
  }
};

export const setDefaultPaymentMethod = async (paymentMethodId: string): Promise<PaymentMethod> => {
  try {
    const response = await apiClient.patch(`/customer/payment-methods/${paymentMethodId}/set-default`);
    return response.data;
  } catch (error) {
    console.error('Failed to set default payment method:', error);
    throw error;
  }
};

// Customer Analytics
export const getCustomerAnalytics = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/customer/analytics');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch customer analytics:', error);
    throw error;
  }
};

// Favorite Businesses
export const getFavoriteBusinesses = async (): Promise<any[]> => {
  try {
    const response = await apiClient.get('/customer/favorites');
    return response.data.businesses;
  } catch (error) {
    console.error('Failed to fetch favorite businesses:', error);
    throw error;
  }
};

export const addFavoriteBusiness = async (businessId: string): Promise<void> => {
  try {
    await apiClient.post('/customer/favorites', { business_id: businessId });
  } catch (error) {
    console.error('Failed to add favorite business:', error);
    throw error;
  }
};

export const removeFavoriteBusiness = async (businessId: string): Promise<void> => {
  try {
    await apiClient.delete(`/customer/favorites/${businessId}`);
  } catch (error) {
    console.error('Failed to remove favorite business:', error);
    throw error;
  }
};

// Account Management
export const deleteCustomerAccount = async (): Promise<void> => {
  try {
    await apiClient.delete('/customer/account');
  } catch (error) {
    console.error('Failed to delete customer account:', error);
    throw error;
  }
};

export const exportCustomerData = async (): Promise<Blob> => {
  try {
    const response = await apiClient.get('/customer/export', {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Failed to export customer data:', error);
    throw error;
  }
};
