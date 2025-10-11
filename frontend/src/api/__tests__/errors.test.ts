/**
 * API Error Handling Tests
 * 
 * Tests for error handling, normalization, and error type checking.
 */

import { AxiosError } from 'axios';
import { 
  handleApiError, 
  isErrorCode, 
  isNetworkError, 
  isClientError, 
  isServerError, 
  isRateLimitError, 
  isAuthError, 
  isAuthorizationError 
} from '../errors';
import { TithiError } from '../types';

describe('API Error Handling', () => {
  describe('handleApiError', () => {
    it('should handle structured TithiError response', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            type: 'https://tithi.com/errors/validation',
            title: 'Validation Error',
            detail: 'Invalid input data',
            status: 400,
            error_code: 'VALIDATION_ERROR',
            instance: '/api/v1/test',
            tenant_id: 'tenant-123',
            user_id: 'user-456',
          },
        },
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result).toEqual({
        type: 'https://tithi.com/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'Invalid input data',
        instance: '/api/v1/test',
        error_code: 'VALIDATION_ERROR',
        tenant_id: 'tenant-123',
        user_id: 'user-456',
      });
    });

    it('should handle 400 Bad Request', () => {
      const axiosError = {
        response: {
          status: 400,
        },
        message: 'Bad Request',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(400);
      expect(result.error_code).toBe('BAD_REQUEST');
      expect(result.title).toBe('Bad Request');
    });

    it('should handle 401 Unauthorized', () => {
      const axiosError = {
        response: {
          status: 401,
        },
        message: 'Unauthorized',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(401);
      expect(result.error_code).toBe('UNAUTHORIZED');
      expect(result.title).toBe('Unauthorized');
    });

    it('should handle 403 Forbidden', () => {
      const axiosError = {
        response: {
          status: 403,
        },
        message: 'Forbidden',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(403);
      expect(result.error_code).toBe('FORBIDDEN');
      expect(result.title).toBe('Forbidden');
    });

    it('should handle 404 Not Found', () => {
      const axiosError = {
        response: {
          status: 404,
        },
        message: 'Not Found',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(404);
      expect(result.error_code).toBe('NOT_FOUND');
      expect(result.title).toBe('Not Found');
    });

    it('should handle 409 Conflict', () => {
      const axiosError = {
        response: {
          status: 409,
        },
        message: 'Conflict',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(409);
      expect(result.error_code).toBe('CONFLICT');
      expect(result.title).toBe('Conflict');
    });

    it('should handle 422 Validation Error', () => {
      const axiosError = {
        response: {
          status: 422,
        },
        message: 'Validation Error',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(422);
      expect(result.error_code).toBe('VALIDATION_ERROR');
      expect(result.title).toBe('Validation Error');
    });

    it('should handle 429 Rate Limit Exceeded', () => {
      const axiosError = {
        response: {
          status: 429,
        },
        message: 'Rate Limit Exceeded',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(429);
      expect(result.error_code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.title).toBe('Rate Limit Exceeded');
    });

    it('should handle 500 Internal Server Error', () => {
      const axiosError = {
        response: {
          status: 500,
        },
        message: 'Internal Server Error',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(500);
      expect(result.error_code).toBe('INTERNAL_SERVER_ERROR');
      expect(result.title).toBe('Internal Server Error');
    });

    it('should handle 502 Bad Gateway', () => {
      const axiosError = {
        response: {
          status: 502,
        },
        message: 'Bad Gateway',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(502);
      expect(result.error_code).toBe('BAD_GATEWAY');
      expect(result.title).toBe('Bad Gateway');
    });

    it('should handle 503 Service Unavailable', () => {
      const axiosError = {
        response: {
          status: 503,
        },
        message: 'Service Unavailable',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(503);
      expect(result.error_code).toBe('SERVICE_UNAVAILABLE');
      expect(result.title).toBe('Service Unavailable');
    });

    it('should handle 504 Gateway Timeout', () => {
      const axiosError = {
        response: {
          status: 504,
        },
        message: 'Gateway Timeout',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(504);
      expect(result.error_code).toBe('GATEWAY_TIMEOUT');
      expect(result.title).toBe('Gateway Timeout');
    });

    it('should handle network errors', () => {
      const axiosError = {
        code: 'NETWORK_ERROR',
        message: 'Network Error',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(500);
      expect(result.error_code).toBe('NETWORK_ERROR');
      expect(result.title).toBe('Network Error');
    });

    it('should handle request timeout', () => {
      const axiosError = {
        code: 'ECONNABORTED',
        message: 'Request Timeout',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(500);
      expect(result.error_code).toBe('REQUEST_TIMEOUT');
      expect(result.title).toBe('Request Timeout');
    });

    it('should handle unknown errors', () => {
      const axiosError = {
        message: 'Unknown Error',
        config: {
          url: '/api/v1/test',
        },
      } as AxiosError;

      const result = handleApiError(axiosError);

      expect(result.status).toBe(500);
      expect(result.error_code).toBe('NETWORK_ERROR');
      expect(result.title).toBe('Connection Error');
    });
  });

  describe('Error Type Checking', () => {
    const mockError: TithiError = {
      type: 'about:blank',
      title: 'Test Error',
      status: 400,
      detail: 'Test error detail',
      instance: '/api/v1/test',
      error_code: 'TEST_ERROR',
    };

    it('should check error code', () => {
      expect(isErrorCode(mockError, 'TEST_ERROR')).toBe(true);
      expect(isErrorCode(mockError, 'OTHER_ERROR')).toBe(false);
    });

    it('should check network errors', () => {
      const networkError = { ...mockError, error_code: 'NETWORK_ERROR' };
      const timeoutError = { ...mockError, error_code: 'REQUEST_TIMEOUT' };
      const connectionError = { ...mockError, error_code: 'CONNECTION_ERROR' };

      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(timeoutError)).toBe(true);
      expect(isNetworkError(connectionError)).toBe(true);
      expect(isNetworkError(mockError)).toBe(false);
    });

    it('should check client errors', () => {
      const clientError = { ...mockError, status: 400 };
      const serverError = { ...mockError, status: 500 };

      expect(isClientError(clientError)).toBe(true);
      expect(isClientError(serverError)).toBe(false);
    });

    it('should check server errors', () => {
      const clientError = { ...mockError, status: 400 };
      const serverError = { ...mockError, status: 500 };

      expect(isServerError(clientError)).toBe(false);
      expect(isServerError(serverError)).toBe(true);
    });

    it('should check rate limit errors', () => {
      const rateLimitError = { ...mockError, status: 429, error_code: 'RATE_LIMIT_EXCEEDED' };
      const otherError = { ...mockError, status: 400 };

      expect(isRateLimitError(rateLimitError)).toBe(true);
      expect(isRateLimitError(otherError)).toBe(false);
    });

    it('should check authentication errors', () => {
      const authError = { ...mockError, status: 401, error_code: 'UNAUTHORIZED' };
      const otherError = { ...mockError, status: 400 };

      expect(isAuthError(authError)).toBe(true);
      expect(isAuthError(otherError)).toBe(false);
    });

    it('should check authorization errors', () => {
      const authError = { ...mockError, status: 403, error_code: 'FORBIDDEN' };
      const otherError = { ...mockError, status: 400 };

      expect(isAuthorizationError(authError)).toBe(true);
      expect(isAuthorizationError(otherError)).toBe(false);
    });
  });
});
