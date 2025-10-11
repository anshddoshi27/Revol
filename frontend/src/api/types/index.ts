/**
 * API Types
 * 
 * Re-exporting DTOs from contracts and defining core API types.
 * This file serves as the single source of truth for API type definitions.
 */

// Core error interface matching backend TithiError
export interface TithiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error_code: string;
  tenant_id?: string;
  user_id?: string;
}

// API response wrapper
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// Pagination interface
export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Common API request/response types
export interface IdempotentRequest {
  idempotency_key?: string;
}

export interface TenantScopedRequest {
  tenant_id?: string;
}

export interface UserScopedRequest {
  user_id?: string;
}

// Error response types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  error_code: string;
  tenant_id?: string;
  user_id?: string;
  validation_errors?: ValidationError[];
}

// Tenant interface (matches backend Tenant model)
export interface Tenant {
  id: string;
  slug: string;
  name: string;
  description?: string;
  timezone: string;
  logo_url?: string;
  primary_color: string;
  settings?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// Booking status types
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// Re-export commonly used types
export type { TithiError as ApiError };
export type { ErrorResponse as ApiErrorResponse };

// Re-export onboarding types
export * from './onboarding';

// Re-export service types
export * from './services';

// Re-export availability types
export * from './availability';

// Re-export policies types
export * from './policies';
