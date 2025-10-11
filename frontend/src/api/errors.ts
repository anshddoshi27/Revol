/**
 * API Error Handling
 * 
 * Centralized error handling for API responses with TithiError normalization.
 * Provides consistent error handling across the application.
 */

import { AxiosError } from 'axios';
import { TithiError } from './types';

/**
 * Normalizes Axios errors to TithiError format
 * @param error - Axios error instance
 * @returns Normalized TithiError
 */
export const handleApiError = (error: AxiosError): TithiError => {
  // If the response contains structured error data, use it
  if (error.response?.data && typeof error.response.data === 'object') {
    const errorData = error.response.data as any;
    
    // Check if it's already a TithiError format
    if (errorData.error_code || errorData.type) {
      return {
        type: errorData.type || 'about:blank',
        title: errorData.title || 'API Error',
        status: error.response.status,
        detail: errorData.detail || errorData.message || 'An error occurred',
        instance: errorData.instance || error.config?.url || '',
        error_code: errorData.error_code || errorData.code || 'UNKNOWN_ERROR',
        tenant_id: errorData.tenant_id,
        user_id: errorData.user_id,
      };
    }
  }

  // Handle specific HTTP status codes
  const status = error.response?.status || 500;
  let errorCode = 'UNKNOWN_ERROR';
  let title = 'Unknown Error';
  let detail = error.message;

  switch (status) {
    case 400:
      errorCode = 'BAD_REQUEST';
      title = 'Bad Request';
      detail = 'The request was invalid or cannot be served';
      break;
    case 401:
      errorCode = 'UNAUTHORIZED';
      title = 'Unauthorized';
      detail = 'Authentication is required';
      break;
    case 403:
      errorCode = 'FORBIDDEN';
      title = 'Forbidden';
      detail = 'You do not have permission to access this resource';
      break;
    case 404:
      errorCode = 'NOT_FOUND';
      title = 'Not Found';
      detail = 'The requested resource was not found';
      break;
    case 409:
      errorCode = 'CONFLICT';
      title = 'Conflict';
      detail = 'The request conflicts with the current state';
      break;
    case 422:
      errorCode = 'VALIDATION_ERROR';
      title = 'Validation Error';
      detail = 'The request data is invalid';
      break;
    case 429:
      errorCode = 'RATE_LIMIT_EXCEEDED';
      title = 'Rate Limit Exceeded';
      detail = 'Too many requests, please try again later';
      break;
    case 500:
      errorCode = 'INTERNAL_SERVER_ERROR';
      title = 'Internal Server Error';
      detail = 'An unexpected error occurred on the server';
      break;
    case 502:
      errorCode = 'BAD_GATEWAY';
      title = 'Bad Gateway';
      detail = 'The server received an invalid response';
      break;
    case 503:
      errorCode = 'SERVICE_UNAVAILABLE';
      title = 'Service Unavailable';
      detail = 'The service is temporarily unavailable';
      break;
    case 504:
      errorCode = 'GATEWAY_TIMEOUT';
      title = 'Gateway Timeout';
      detail = 'The request timed out';
      break;
  }

  // Handle network errors
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      errorCode = 'REQUEST_TIMEOUT';
      title = 'Request Timeout';
      detail = 'The request timed out';
    } else if (error.code === 'NETWORK_ERROR') {
      errorCode = 'NETWORK_ERROR';
      title = 'Network Error';
      detail = 'Unable to connect to the server';
    } else {
      errorCode = 'NETWORK_ERROR';
      title = 'Connection Error';
      detail = 'Unable to connect to the server';
    }
  }

  return {
    type: 'about:blank',
    title,
    status,
    detail,
    instance: error.config?.url || '',
    error_code: errorCode,
  };
};

/**
 * Checks if an error is a specific TithiError type
 * @param error - Error to check
 * @param errorCode - Expected error code
 * @returns True if error matches the code
 */
export const isErrorCode = (error: TithiError, errorCode: string): boolean => {
  return error.error_code === errorCode;
};

/**
 * Checks if an error is a network error
 * @param error - Error to check
 * @returns True if it's a network error
 */
export const isNetworkError = (error: TithiError): boolean => {
  return ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'CONNECTION_ERROR'].includes(error.error_code);
};

/**
 * Checks if an error is a client error (4xx)
 * @param error - Error to check
 * @returns True if it's a client error
 */
export const isClientError = (error: TithiError): boolean => {
  return error.status >= 400 && error.status < 500;
};

/**
 * Checks if an error is a server error (5xx)
 * @param error - Error to check
 * @returns True if it's a server error
 */
export const isServerError = (error: TithiError): boolean => {
  return error.status >= 500;
};

/**
 * Checks if an error is a rate limit error
 * @param error - Error to check
 * @returns True if it's a rate limit error
 */
export const isRateLimitError = (error: TithiError): boolean => {
  return error.status === 429 || error.error_code === 'RATE_LIMIT_EXCEEDED';
};

/**
 * Checks if an error is an authentication error
 * @param error - Error to check
 * @returns True if it's an authentication error
 */
export const isAuthError = (error: TithiError): boolean => {
  return error.status === 401 || error.error_code === 'UNAUTHORIZED';
};

/**
 * Checks if an error is an authorization error
 * @param error - Error to check
 * @returns True if it's an authorization error
 */
export const isAuthorizationError = (error: TithiError): boolean => {
  return error.status === 403 || error.error_code === 'FORBIDDEN';
};
