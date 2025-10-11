/**
 * API Client
 * 
 * Production-grade API client with interceptors for authentication,
 * error handling, rate limiting, and idempotency.
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Extend Axios types to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime?: number;
    retryCount?: number;
  };
}

interface ExtendedAxiosResponse extends AxiosResponse {
  metadata?: {
    startTime?: number;
    retryCount?: number;
    duration?: number;
  };
}
// API client configuration for Tithi backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';

// Constants for rate limiting and idempotency
const DEFAULT_RATE_LIMIT_BACKOFF_MS = 1000;
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

// Simple token getter
const getToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Maximum number of retries for 429 responses
const MAX_RETRIES = 3;

// Retry delay with jitter
const getRetryDelay = (attempt: number, retryAfter?: number): number => {
  if (retryAfter) {
    return retryAfter * 1000; // Convert seconds to milliseconds
  }
  
  // Exponential backoff with jitter: baseDelay * (2^attempt) + random(0, 1000)
  const baseDelay = DEFAULT_RATE_LIMIT_BACKOFF_MS;
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return exponentialDelay + jitter;
};

/**
 * Creates a configured Axios instance with interceptors
 * @returns Configured Axios instance
 */
export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
  });

  // Request interceptor for authentication and idempotency
  client.interceptors.request.use(
    (config: ExtendedAxiosRequestConfig) => {
      // Add authentication token if available
      const token = getToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      // Add tenant context if available
      const userStr = localStorage.getItem('auth_user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.tenantId) {
            config.headers = config.headers || {};
            config.headers['X-Tenant-ID'] = user.tenantId;
          }
          if (user.id) {
            config.headers = config.headers || {};
            config.headers['X-User-ID'] = user.id;
          }
        } catch (error) {
          console.error('Failed to parse user data:', error);
        }
      }

      // Add request timestamp for observability
      config.metadata = {
        ...config.metadata,
        startTime: Date.now(),
      };

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling and rate limiting
  client.interceptors.response.use(
    (response: ExtendedAxiosResponse) => {
      // Add response metadata for observability
      const endTime = Date.now();
      const startTime = (response.config as ExtendedAxiosRequestConfig).metadata?.startTime;
      if (startTime) {
        response.metadata = {
          ...response.metadata,
          duration: endTime - startTime,
        };
      }

      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };
      
      // Handle 429 (Rate Limit) responses with retry logic
      if (error.response?.status === 429 && originalRequest) {
        const retryCount = originalRequest._retryCount || 0;
        
        if (retryCount < MAX_RETRIES) {
          originalRequest._retryCount = retryCount + 1;
          
          // Get retry-after header or use exponential backoff
          const retryAfterHeader = error.response.headers['retry-after'];
          const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
          
          const delay = getRetryDelay(retryCount, retryAfter);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          return client.request(originalRequest);
        }
      }

      // For all other errors, return as is
      return Promise.reject(error);
    }
  );

  return client;
};

// Create and export the default API client instance (lazy initialization)
let _apiClient: AxiosInstance | null = null;
export const apiClient: AxiosInstance = (() => {
  if (!_apiClient) {
    _apiClient = createApiClient();
  }
  return _apiClient;
})();

/**
 * Enhanced API client with additional utilities
 */
export class TithiApiClient {
  private client: AxiosInstance;

  constructor(client: AxiosInstance = apiClient) {
    this.client = client;
  }

  /**
   * Makes a GET request
   * @param url - Request URL
   * @param config - Axios request config
   * @returns Promise resolving to response data
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * Makes a POST request
   * @param url - Request URL
   * @param data - Request data
   * @param config - Axios request config
   * @returns Promise resolving to response data
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * Makes a PUT request
   * @param url - Request URL
   * @param data - Request data
   * @param config - Axios request config
   * @returns Promise resolving to response data
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * Makes a PATCH request
   * @param url - Request URL
   * @param data - Request data
   * @param config - Axios request config
   * @returns Promise resolving to response data
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * Makes a DELETE request
   * @param url - Request URL
   * @param config - Axios request config
   * @returns Promise resolving to response data
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  /**
   * Makes a request with custom idempotency key
   * @param config - Axios request config
   * @param idempotencyKey - Custom idempotency key
   * @returns Promise resolving to response data
   */
  async request<T = any>(
    config: AxiosRequestConfig,
    idempotencyKey?: string
  ): Promise<T> {
    if (idempotencyKey) {
      config.headers = {
        ...config.headers,
        [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
      };
    }
    
    const response = await this.client.request<T>(config);
    return response.data;
  }

  /**
   * Gets the underlying Axios instance
   * @returns Axios instance
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}

// Export the enhanced API client (lazy initialization)
let _tithiApiClient: TithiApiClient | null = null;
export const tithiApiClient = (): TithiApiClient => {
  if (!_tithiApiClient) {
    _tithiApiClient = new TithiApiClient();
  }
  return _tithiApiClient;
};

// Export types for external use
export type { AxiosRequestConfig, AxiosResponse } from 'axios';
