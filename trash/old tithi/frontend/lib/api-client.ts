/**
 * API Client for Tithi Backend
 * 
 * This file contains all fetch functions that exactly match the backend endpoints.
 * Backend field names are preserved exactly as returned.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add tenant context if available (backend expects X-Tenant-ID header)
    const tenantId = localStorage.getItem('current_tenant_id');
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
  }
  return config;
});

// Response interceptor for error handling and token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until token refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // BACKEND GAP: Refresh endpoint not implemented
          // For now, redirect to login if token expires
          processQueue(new Error('Token expired - please login again'), null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('current_tenant_id');
            localStorage.removeItem('current_tenant');
            window.location.href = '/login';
          }
          return Promise.reject(new Error('Token expired'));
        } else {
          // No refresh token, redirect to login
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('current_tenant_id');
            localStorage.removeItem('current_tenant');
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('current_tenant_id');
          localStorage.removeItem('current_tenant');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Generate idempotency key for mutating operations
 */
export const generateIdempotencyKey = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user_id: string;
  session_token: string; // Backend returns session_token, not access_token
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    created_at: string;
  };
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    // Backend endpoint: POST /api/v1/auth/login
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', data);
    return response.data;
  },

  refresh: async (): Promise<{ session_token: string }> => {
    // BACKEND GAP: /api/v1/auth/refresh endpoint not implemented yet
    // For now, we'll handle token refresh via interceptors
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    // TODO: Implement once backend adds /api/v1/auth/refresh
    // For now, return error to trigger re-login
    throw new Error('Token refresh not yet implemented - please log in again');
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout');
  },
};

// ============================================================================
// TENANT ENDPOINTS
// ============================================================================

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description?: string;
  timezone: string;
  logo_url?: string;
  primary_color: string;
  settings?: Record<string, any>;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface TenantsListRequest {
  page?: number;
  per_page?: number;
  include_inactive?: boolean;
}

export interface TenantsListResponse {
  tenants: Tenant[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface TenantCreateRequest {
  name: string;
  description?: string;
  timezone: string;
  primary_color: string;
  logo_url?: string;
  settings?: Record<string, any>;
}

export interface TenantUpdateRequest {
  name?: string;
  description?: string;
  timezone?: string;
  primary_color?: string;
  logo_url?: string;
  settings?: Record<string, any>;
}

// Backend endpoint: GET /api/v1/tenants
export const tenantsApi = {
  list: async (params?: TenantsListRequest): Promise<TenantsListResponse> => {
    const response = await apiClient.get<TenantsListResponse>('/api/v1/tenants', { params });
    return response.data;
  },

  // BACKEND GAP: /api/v1/tenants/me endpoint not found
  // Using list endpoint and filtering client-side for now
  getMe: async (): Promise<{ tenant: Tenant | null }> => {
    // For now, get first tenant from list (backend should provide /me endpoint)
    const response = await tenantsApi.list({ per_page: 1 });
    return { tenant: response.tenants.length > 0 ? response.tenants[0] : null };
  },

  get: async (id: string): Promise<{ tenant: Tenant }> => {
    const response = await apiClient.get<{ tenant: Tenant }>(`/api/v1/tenants/${id}`);
    return response.data;
  },

  create: async (data: TenantCreateRequest): Promise<{ tenant: Tenant }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post<{ tenant: Tenant }>('/api/v1/tenants', data, { headers });
    return response.data;
  },

  update: async (id: string, data: TenantUpdateRequest): Promise<{ tenant: Tenant }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.put<{ tenant: Tenant }>(`/api/v1/tenants/${id}`, data, { headers });
    return response.data;
  },
};

// ============================================================================
// BRANDING ENDPOINTS
// ============================================================================

export interface BrandingUpdateRequest {
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
  custom_css?: string;
}

export interface BrandingUpdateResponse {
  branding: {
    primary_color: string;
    secondary_color?: string;
    font_family?: string;
    logo_url?: string;
    favicon_url?: string;
  };
}

export interface LogoUploadResponse {
  logo_url: string;
  file_checksum: string;
  file_size: number;
}

export const brandingApi = {
  update: async (data: BrandingUpdateRequest): Promise<BrandingUpdateResponse> => {
    // Backend endpoint: PUT /api/admin/branding (requires X-Tenant-ID header)
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.put<BrandingUpdateResponse>('/api/admin/branding', data, { headers });
    return response.data;
  },

  uploadLogo: async (file: File): Promise<LogoUploadResponse> => {
    // Backend endpoint: POST /api/admin/branding/upload-logo (multipart/form-data)
    const formData = new FormData();
    formData.append('logo', file);
    
    const headers = {
      'Idempotency-Key': generateIdempotencyKey(),
      'Content-Type': 'multipart/form-data',
    };
    
    const response = await apiClient.post<LogoUploadResponse>(
      '/api/admin/branding/upload-logo',
      formData,
      { headers }
    );
    return response.data;
  },
};

// ============================================================================
// ONBOARDING ENDPOINTS
// ============================================================================

export interface OnboardingStep1Request {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  business_name: string;
  business_type: string;
  business_description?: string;
  legal_name?: string;
  industry: string;
}

export interface OnboardingStep1Response {
  tenant_id: string;
  user_id: string;
  subdomain: string;
  status: string;
}

export interface OnboardingStep2Request {
  subdomain: string;
  timezone: string;
  phone?: string;
  website?: string;
  support_email?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    province?: string;
    postal_code: string;
    country: string;
  };
}

export interface OnboardingStep3Request {
  team_members: Array<{
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }>;
}

export interface OnboardingStep4Request {
  categories: Array<{
    name: string;
    description?: string;
    color: string;
    services: Array<{
      name: string;
      description: string;
      duration: number;
      price_cents: number;
      pre_appointment_instructions?: string;
    }>;
  }>;
}

export interface OnboardingStep5Request {
  availability: Array<{
    service_id: string;
    team_member_id: string;
    availability_rules: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
}

export interface OnboardingStep6Request {
  templates: Array<{
    template_name: string;
    channel: 'email' | 'sms' | 'push';
    email_subject?: string;
    category: 'confirmation' | 'reminder' | 'follow_up' | 'cancellation' | 'reschedule';
    trigger_event: string;
    content: string;
    placeholders?: string[];
  }>;
}

export interface OnboardingStep7Request {
  policies: {
    cancellation_policy?: string;
    no_show_policy?: string;
    no_show_fee_type?: 'flat' | 'percentage';
    no_show_fee_value?: number;
    refund_policy?: string;
    cash_payment_policy?: string;
  };
  gift_cards?: Array<{
    expiration_date?: string;
    amount_type: 'fixed' | 'percentage';
    amount_value: number;
    code?: string;
  }>;
}

export interface OnboardingStep8Request {
  payment_setup: {
    stripe_account_id?: string;
    payment_methods: string[];
  };
}

export interface OnboardingStatusResponse {
  current_step: number;
  completed_steps: number[];
  tenant_id: string;
  is_complete: boolean;
}

export const onboardingApi = {
  step1: async (data: OnboardingStep1Request): Promise<OnboardingStep1Response> => {
    const response = await apiClient.post<OnboardingStep1Response>(
      '/onboarding/step1/business-account',
      data
    );
    return response.data;
  },

  step2: async (data: OnboardingStep2Request): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/onboarding/step2/business-information', data);
    return response.data;
  },

  step3: async (data: OnboardingStep3Request): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/onboarding/step3/team-members', data);
    return response.data;
  },

  step4: async (data: OnboardingStep4Request): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/onboarding/step4/services-categories', data);
    return response.data;
  },

  step5: async (data: OnboardingStep5Request): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/onboarding/step5/availability', data);
    return response.data;
  },

  step6: async (data: OnboardingStep6Request): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/onboarding/step6/notifications', data);
    return response.data;
  },

  step7: async (data: OnboardingStep7Request): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/onboarding/step7/policies-gift-cards', data);
    return response.data;
  },

  step8: async (data: OnboardingStep8Request): Promise<{ booking_url: string }> => {
    const response = await apiClient.post('/onboarding/step8/go-live', data);
    return response.data;
  },

  getStatus: async (tenantId: string): Promise<OnboardingStatusResponse> => {
    const response = await apiClient.get<OnboardingStatusResponse>(
      `/onboarding/status?tenant_id=${tenantId}`
    );
    return response.data;
  },

  checkSubdomain: async (subdomain: string): Promise<{ available: boolean; suggested_alternatives?: string[] }> => {
    const response = await apiClient.get(`/onboarding/check-subdomain/${subdomain}`);
    return response.data;
  },
};

// ============================================================================
// BOOKING FLOW ENDPOINTS (Public)
// ============================================================================

export interface TenantBookingDataResponse {
  business_info: {
    name: string;
    description?: string;
    address: any;
    phone?: string;
    email?: string;
    website?: string;
    logo_url?: string;
    primary_color: string;
  };
  categories: Array<{
    id: string;
    name: string;
    description?: string;
    color: string;
    services: Array<{
      id: string;
      name: string;
      description: string;
      duration_minutes: number;
      price_cents: number;
      pre_appointment_instructions?: string;
    }>;
  }>;
  team_members: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  policies: {
    cancellation_policy?: string;
    no_show_policy?: string;
    refund_policy?: string;
    cash_payment_policy?: string;
  };
  booking_url: string;
}

export interface AvailabilityRequest {
  tenant_id: string;
  service_id: string;
  start_date: string;
  end_date: string;
  team_member_id?: string;
}

export interface AvailabilitySlot {
  start_time: string;
  end_time: string;
  team_member_id: string;
  team_member_name: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  price_cents: number;
}

export interface CreateBookingRequest {
  tenant_id: string;
  service_id: string;
  team_member_id?: string;
  start_time: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  gift_card_code?: string;
  payment_method_id?: string;
}

export interface CreateBookingResponse {
  booking_id: string;
  booking_code: string;
  status: 'pending' | 'confirmed';
  payment_status: 'requires_action' | 'authorized' | 'confirmed';
  setup_intent_client_secret?: string;
}

export const bookingFlowApi = {
  getTenantData: async (tenantId: string): Promise<TenantBookingDataResponse> => {
    const response = await apiClient.get<TenantBookingDataResponse>(
      `/booking/tenant-data/${tenantId}`
    );
    return response.data;
  },

  checkAvailability: async (data: AvailabilityRequest): Promise<{ slots: AvailabilitySlot[] }> => {
    const response = await apiClient.post<{ slots: AvailabilitySlot[] }>(
      '/booking/availability',
      data
    );
    return response.data;
  },

  createBooking: async (data: CreateBookingRequest): Promise<CreateBookingResponse> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post<CreateBookingResponse>(
      '/booking/create',
      data,
      { headers }
    );
    return response.data;
  },

  confirmBooking: async (bookingId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/booking/confirm/${bookingId}`);
    return response.data;
  },

  getBooking: async (bookingId: string): Promise<{ booking: any }> => {
    const response = await apiClient.get(`/booking/${bookingId}`);
    return response.data;
  },
};

// ============================================================================
// BOOKINGS ENDPOINTS (Admin)
// ============================================================================

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  tenant_id: string;
  customer_id: string;
  service_id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  attendee_count?: number;
  client_generated_id?: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  service: {
    id: string;
    name: string;
    price_cents: number;
    duration_minutes: number;
  };
  resource: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface BookingsListRequest {
  page?: number;
  per_page?: number;
  status?: BookingStatus[];
  service_id?: string;
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: 'start_at' | 'created_at' | 'status';
  sort_order?: 'asc' | 'desc';
}

export interface BookingsListResponse {
  bookings: Booking[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export const bookingsApi = {
  list: async (params?: BookingsListRequest): Promise<BookingsListResponse> => {
    const response = await apiClient.get<BookingsListResponse>('/api/v1/bookings', { params });
    return response.data;
  },

  get: async (id: string): Promise<{ booking: Booking }> => {
    const response = await apiClient.get<{ booking: Booking }>(`/api/v1/bookings/${id}`);
    return response.data;
  },

  create: async (data: {
    customer_id: string;
    service_id: string;
    resource_id: string;
    start_at: string;
    end_at: string;
    attendee_count?: number;
    notes?: string;
  }): Promise<{ booking: Booking }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post<{ booking: Booking }>('/api/v1/bookings', data, { headers });
    return response.data;
  },

  update: async (id: string, data: {
    status?: BookingStatus;
    notes?: string;
  }): Promise<{ booking: Booking }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.put<{ booking: Booking }>(`/api/v1/bookings/${id}`, data, { headers });
    return response.data;
  },

  // Payment action endpoints
  complete: async (bookingId: string): Promise<{ booking: Booking; payment_processed?: boolean }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post(`/api/v1/bookings/${bookingId}/complete`, {}, { headers });
    return response.data;
  },

  markNoShow: async (bookingId: string): Promise<{ booking: Booking; payment_processed?: boolean }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post(`/api/v1/bookings/${bookingId}/no-show`, {}, { headers });
    return response.data;
  },

  cancel: async (bookingId: string): Promise<{ booking: Booking }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post(`/api/v1/bookings/${bookingId}/cancel`, {}, { headers });
    return response.data;
  },
};

// ============================================================================
// PAYMENT ENDPOINTS
// ============================================================================

export interface PaymentIntentRequest {
  booking_id: string;
  amount_cents: number;
  currency_code?: string;
  customer_id?: string;
}

export interface PaymentIntentResponse {
  payment_intent_id: string;
  client_secret: string;
  amount_cents: number;
  currency_code: string;
  status: 'requires_action' | 'succeeded' | 'failed';
  next_action?: {
    type: string;
    url?: string;
  };
}

export interface PaymentProcessRequest {
  booking_id: string;
  attendance_status: 'attended' | 'no_show';
  amount_cents?: number;
}

export interface RefundRequest {
  payment_id: string;
  amount_cents?: number;
  reason?: string;
}

export const paymentsApi = {
  createIntent: async (data: PaymentIntentRequest): Promise<PaymentIntentResponse> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post<PaymentIntentResponse>(
      '/api/payments/intent',
      data,
      { headers }
    );
    return response.data;
  },

  process: async (data: PaymentProcessRequest): Promise<{ payment_id: string; status: string }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post('/api/payments/process', data, { headers });
    return response.data;
  },

  refund: async (data: RefundRequest): Promise<{ refund_id: string; status: string }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post('/api/payments/refund', data, { headers });
    return response.data;
  },
};

// ============================================================================
// SERVICES ENDPOINTS
// ============================================================================

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ServicesListRequest {
  page?: number;
  per_page?: number;
  category?: string;
  is_active?: boolean;
  search?: string;
}

export interface ServiceCreateRequest {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  image_url?: string;
}

export const servicesApi = {
  list: async (params?: ServicesListRequest): Promise<{ services: Service[]; pagination: any }> => {
    const response = await apiClient.get('/api/v1/services', { params });
    return response.data;
  },

  get: async (id: string): Promise<{ service: Service }> => {
    const response = await apiClient.get(`/api/v1/services/${id}`);
    return response.data;
  },

  create: async (data: ServiceCreateRequest): Promise<{ service: Service }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.post<{ service: Service }>('/api/v1/services', data, { headers });
    return response.data;
  },

  update: async (id: string, data: Partial<ServiceCreateRequest>): Promise<{ service: Service }> => {
    const headers = { 'Idempotency-Key': generateIdempotencyKey() };
    const response = await apiClient.put<{ service: Service }>(`/api/v1/services/${id}`, data, { headers });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/services/${id}`);
  },
};

export default apiClient;

