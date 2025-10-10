/**
 * API Client Tests
 * 
 * Comprehensive tests for the API client including interceptors,
 * error handling, rate limiting, and idempotency.
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { apiClient, createApiClient, TithiApiClient } from '../client';
import { handleApiError } from '../errors';
import { generateIdempotencyKey } from '../idempotency';
import { setTokenProvider, getToken } from '@/lib/env';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(),
  default: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment configuration
jest.mock('@/lib/env', () => ({
  config: {
    API_BASE_URL: 'http://localhost:5000/api/v1',
    IS_DEVELOPMENT: true,
    IS_PRODUCTION: false,
  },
  getToken: jest.fn(),
  setTokenProvider: jest.fn(),
  DEFAULT_RATE_LIMIT_BACKOFF_MS: 1000,
  IDEMPOTENCY_KEY_HEADER: 'Idempotency-Key',
}));

describe('API Client', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios instance
    mockAxiosInstance = {
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      request: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Mock the default export
    (mockedAxios as any).default = mockedAxios;
  });

  describe('createApiClient', () => {
    it('should create axios instance with correct base URL', () => {
      createApiClient();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:5000/api/v1',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    });

    it('should set up request interceptor', () => {
      createApiClient();
      
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should set up response interceptor', () => {
      createApiClient();
      
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  describe('Request Interceptor', () => {
    let requestInterceptor: Function;

    beforeEach(() => {
      createApiClient();
      requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    });

    it('should add authorization header when token is available', () => {
      const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
      mockGetToken.mockReturnValue('test-token');

      const config = {
        headers: {},
        method: 'GET',
      };

      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('should not add authorization header when token is not available', () => {
      const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
      mockGetToken.mockReturnValue(null);

      const config = {
        headers: {},
        method: 'GET',
      };

      const result = requestInterceptor(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should add idempotency key for mutating requests', () => {
      const config = {
        headers: {},
        method: 'POST',
      };

      const result = requestInterceptor(config);

      expect(result.headers['Idempotency-Key']).toBeDefined();
      expect(typeof result.headers['Idempotency-Key']).toBe('string');
    });

    it('should not add idempotency key for GET requests', () => {
      const config = {
        headers: {},
        method: 'GET',
      };

      const result = requestInterceptor(config);

      expect(result.headers['Idempotency-Key']).toBeUndefined();
    });

    it('should not override existing idempotency key', () => {
      const existingKey = 'existing-key';
      const config = {
        headers: {
          'Idempotency-Key': existingKey,
        },
        method: 'POST',
      };

      const result = requestInterceptor(config);

      expect(result.headers['Idempotency-Key']).toBe(existingKey);
    });

    it('should add request metadata', () => {
      const config = {
        headers: {},
        method: 'GET',
      };

      const result = requestInterceptor(config);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.startTime).toBeDefined();
      expect(typeof result.metadata.startTime).toBe('number');
    });
  });

  describe('Response Interceptor', () => {
    let responseInterceptor: Function;
    let errorInterceptor: Function;

    beforeEach(() => {
      createApiClient();
      responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
    });

    it('should add response metadata', () => {
      const response = {
        config: {
          metadata: {
            startTime: Date.now() - 100,
          },
        },
      };

      const result = responseInterceptor(response);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.duration).toBeDefined();
      expect(typeof result.metadata.duration).toBe('number');
    });

    it('should handle 429 errors with retry', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ data: 'success' });
      mockAxiosInstance.request = mockRequest;

      const error = {
        response: {
          status: 429,
          headers: {
            'retry-after': '2',
          },
        },
        config: {
          method: 'GET',
          url: '/test',
        },
      };

      // Mock setTimeout to resolve immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return {} as any;
      });

      const result = await errorInterceptor(error);

      expect(mockRequest).toHaveBeenCalledWith(error.config);
      expect(result).toEqual({ data: 'success' });

      jest.restoreAllMocks();
    });

    it('should handle 429 errors with exponential backoff', async () => {
      const mockRequest = jest.fn().mockResolvedValue({ data: 'success' });
      mockAxiosInstance.request = mockRequest;

      const error = {
        response: {
          status: 429,
          headers: {},
        },
        config: {
          method: 'GET',
          url: '/test',
          _retryCount: 1,
        },
      };

      // Mock setTimeout to resolve immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        callback();
        return {} as any;
      });

      const result = await errorInterceptor(error);

      expect(mockRequest).toHaveBeenCalledWith(error.config);
      expect(result).toEqual({ data: 'success' });

      jest.restoreAllMocks();
    });

    it('should not retry after max retries', async () => {
      const error = {
        response: {
          status: 429,
          headers: {},
        },
        config: {
          method: 'GET',
          url: '/test',
          _retryCount: 3,
        },
      };

      await expect(errorInterceptor(error)).rejects.toBeDefined();
    });

    it('should handle non-429 errors', async () => {
      const error = {
        response: {
          status: 500,
          data: {
            error_code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        },
        config: {
          method: 'GET',
          url: '/test',
        },
      };

      await expect(errorInterceptor(error)).rejects.toBeDefined();
    });
  });

  describe('TithiApiClient', () => {
    let client: TithiApiClient;

    beforeEach(() => {
      client = new TithiApiClient(mockAxiosInstance);
    });

    it('should make GET request', async () => {
      const mockResponse = { data: 'test data' };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.get('/test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', undefined);
      expect(result).toBe('test data');
    });

    it('should make POST request', async () => {
      const mockResponse = { data: 'created' };
      const requestData = { name: 'test' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.post('/test', requestData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toBe('created');
    });

    it('should make PUT request', async () => {
      const mockResponse = { data: 'updated' };
      const requestData = { name: 'test' };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await client.put('/test', requestData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toBe('updated');
    });

    it('should make PATCH request', async () => {
      const mockResponse = { data: 'patched' };
      const requestData = { name: 'test' };
      mockAxiosInstance.patch.mockResolvedValue(mockResponse);

      const result = await client.patch('/test', requestData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test', requestData, undefined);
      expect(result).toBe('patched');
    });

    it('should make DELETE request', async () => {
      const mockResponse = { data: 'deleted' };
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const result = await client.delete('/test');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test', undefined);
      expect(result).toBe('deleted');
    });

    it('should make request with custom idempotency key', async () => {
      const mockResponse = { data: 'success' };
      const requestConfig = { method: 'POST', url: '/test' };
      const idempotencyKey = 'custom-key';
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const result = await client.request(requestConfig, idempotencyKey);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        ...requestConfig,
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      expect(result).toBe('success');
    });

    it('should return axios instance', () => {
      const instance = client.getAxiosInstance();
      expect(instance).toBe(mockAxiosInstance);
    });
  });
});
