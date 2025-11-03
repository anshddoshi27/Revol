/**
 * Custom React hooks for data fetching and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  tenantsApi,
  bookingsApi,
  servicesApi,
  onboardingApi,
  bookingFlowApi,
  paymentsApi,
  Tenant,
  Booking,
  Service,
  BookingsListRequest,
} from './api-client';

// ============================================================================
// TENANTS HOOKS
// ============================================================================

export const useTenants = (params?: { page?: number; per_page?: number }) => {
  return useQuery({
    queryKey: ['tenants', params],
    queryFn: () => tenantsApi.list(params),
  });
};

export const useTenant = (id: string) => {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () => tenantsApi.get(id),
    enabled: !!id,
  });
};

export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: tenantsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
};

export const useUpdateTenant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => tenantsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', variables.id] });
    },
  });
};

// ============================================================================
// BOOKINGS HOOKS
// ============================================================================

export const useBookings = (params?: BookingsListRequest) => {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: () => bookingsApi.list(params),
  });
};

export const useBooking = (id: string) => {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
    enabled: !!id,
  });
};

export const useCompleteBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsApi.complete,
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
  });
};

export const useMarkNoShow = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsApi.markNoShow,
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: bookingsApi.cancel,
    onSuccess: (_, bookingId) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    },
  });
};

// ============================================================================
// SERVICES HOOKS
// ============================================================================

export const useServices = (params?: { category?: string; is_active?: boolean }) => {
  return useQuery({
    queryKey: ['services', params],
    queryFn: () => servicesApi.list(params),
  });
};

export const useService = (id: string) => {
  return useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesApi.get(id),
    enabled: !!id,
  });
};

export const useCreateService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: servicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => servicesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['service', variables.id] });
    },
  });
};

// ============================================================================
// ONBOARDING HOOKS
// ============================================================================

export const useOnboardingStatus = (tenantId: string) => {
  return useQuery({
    queryKey: ['onboarding-status', tenantId],
    queryFn: () => onboardingApi.getStatus(tenantId),
    enabled: !!tenantId,
  });
};

export const useOnboardingStep1 = () => {
  return useMutation({
    mutationFn: onboardingApi.step1,
  });
};

export const useOnboardingStep2 = () => {
  return useMutation({
    mutationFn: onboardingApi.step2,
  });
};

export const useOnboardingStep3 = () => {
  return useMutation({
    mutationFn: onboardingApi.step3,
  });
};

export const useOnboardingStep4 = () => {
  return useMutation({
    mutationFn: onboardingApi.step4,
  });
};

export const useOnboardingStep5 = () => {
  return useMutation({
    mutationFn: onboardingApi.step5,
  });
};

export const useOnboardingStep6 = () => {
  return useMutation({
    mutationFn: onboardingApi.step6,
  });
};

export const useOnboardingStep7 = () => {
  return useMutation({
    mutationFn: onboardingApi.step7,
  });
};

export const useOnboardingStep8 = () => {
  return useMutation({
    mutationFn: onboardingApi.step8,
  });
};

export const useCheckSubdomain = () => {
  return useMutation({
    mutationFn: onboardingApi.checkSubdomain,
  });
};

// ============================================================================
// BOOKING FLOW HOOKS (Public)
// ============================================================================

export const useTenantBookingData = (tenantId: string) => {
  return useQuery({
    queryKey: ['tenant-booking-data', tenantId],
    queryFn: () => bookingFlowApi.getTenantData(tenantId),
    enabled: !!tenantId,
  });
};

export const useAvailability = () => {
  return useMutation({
    mutationFn: bookingFlowApi.checkAvailability,
  });
};

export const useCreateBooking = () => {
  return useMutation({
    mutationFn: bookingFlowApi.createBooking,
  });
};

// ============================================================================
// PAYMENT HOOKS
// ============================================================================

export const useCreatePaymentIntent = () => {
  return useMutation({
    mutationFn: paymentsApi.createIntent,
  });
};

export const useProcessPayment = () => {
  return useMutation({
    mutationFn: paymentsApi.process,
  });
};

export const useRefundPayment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: paymentsApi.refund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
};

