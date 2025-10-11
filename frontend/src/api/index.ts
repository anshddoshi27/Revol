/**
 * API Module
 * 
 * Main export file for the API module, providing access to all API-related
 * functionality including the client, error handling, and utilities.
 */

// Core API client
export { apiClient, createApiClient, TithiApiClient, tithiApiClient } from './client';

// Error handling
export { 
  handleApiError,
  isErrorCode,
  isNetworkError,
  isClientError,
  isServerError,
  isRateLimitError,
  isAuthError,
  isAuthorizationError,
} from './errors';

// Idempotency utilities
export {
  generateIdempotencyKey,
  generateIdempotencyKeyWithPrefix,
  generateOperationIdempotencyKey,
  isValidIdempotencyKey,
  extractTimestampFromIdempotencyKey,
  isIdempotencyKeyExpired,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_OPERATIONS,
  type IdempotencyOperation,
} from './idempotency';

// Types
export type {
  TithiError,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  IdempotentRequest,
  TenantScopedRequest,
  UserScopedRequest,
  ValidationError,
  ErrorResponse,
  ApiError,
  ApiErrorResponse,
} from './types';

// Services
export { onboardingService, onboardingUtils } from './services/onboarding';
export { servicesService, categoriesService, servicesUtils } from './services/services';

// Re-export Axios types for convenience
export type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
