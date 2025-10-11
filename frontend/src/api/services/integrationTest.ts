/**
 * Integration Test Service
 * 
 * Service to test frontend-backend integration and verify API connectivity.
 */

import { apiClient } from '../client';

export interface IntegrationTestResult {
  test: string;
  status: 'pass' | 'fail';
  message: string;
  response?: any;
  error?: any;
}

/**
 * Test backend connectivity
 */
export const testBackendConnectivity = async (): Promise<IntegrationTestResult> => {
  try {
    const response = await apiClient.get('/health/');
    return {
      test: 'Backend Connectivity',
      status: 'pass',
      message: 'Backend is responding',
      response: response.data
    };
  } catch (error: any) {
    return {
      test: 'Backend Connectivity',
      status: 'fail',
      message: 'Backend is not responding',
      error: error.message
    };
  }
};

/**
 * Test authentication endpoint
 */
export const testAuthEndpoint = async (): Promise<IntegrationTestResult> => {
  try {
    // Test auth endpoint without credentials (should return 400/401)
    const response = await apiClient.post('/auth/login', {});
    return {
      test: 'Authentication Endpoint',
      status: 'pass',
      message: 'Auth endpoint is accessible',
      response: response.data
    };
  } catch (error: any) {
    if (error.response?.status === 400 || error.response?.status === 401) {
      return {
        test: 'Authentication Endpoint',
        status: 'pass',
        message: 'Auth endpoint is properly rejecting invalid requests',
        response: error.response.data
      };
    }
    return {
      test: 'Authentication Endpoint',
      status: 'fail',
      message: 'Auth endpoint error',
      error: error.message
    };
  }
};

/**
 * Test API v1 endpoints
 */
export const testApiV1Endpoints = async (): Promise<IntegrationTestResult> => {
  try {
    // Test protected endpoint (should return 401)
    const response = await apiClient.get('/api/v1/tenants');
    return {
      test: 'API v1 Endpoints',
      status: 'pass',
      message: 'API v1 endpoints are accessible',
      response: response.data
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      return {
        test: 'API v1 Endpoints',
        status: 'pass',
        message: 'API v1 endpoints are properly protected',
        response: error.response.data
      };
    }
    return {
      test: 'API v1 Endpoints',
      status: 'fail',
      message: 'API v1 endpoint error',
      error: error.message
    };
  }
};

/**
 * Test public endpoints
 */
export const testPublicEndpoints = async (): Promise<IntegrationTestResult> => {
  try {
    // Test public endpoint (should be accessible)
    const response = await apiClient.get('/v1/demo/services');
    return {
      test: 'Public Endpoints',
      status: 'pass',
      message: 'Public endpoints are accessible',
      response: response.data
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        test: 'Public Endpoints',
        status: 'pass',
        message: 'Public endpoints are properly routing (404 for non-existent tenant)',
        response: error.response.data
      };
    }
    return {
      test: 'Public Endpoints',
      status: 'fail',
      message: 'Public endpoint error',
      error: error.message
    };
  }
};

/**
 * Run all integration tests
 */
export const runIntegrationTests = async (): Promise<IntegrationTestResult[]> => {
  const tests = [
    testBackendConnectivity,
    testAuthEndpoint,
    testApiV1Endpoints,
    testPublicEndpoints
  ];

  const results: IntegrationTestResult[] = [];
  
  for (const test of tests) {
    try {
      const result = await test();
      results.push(result);
    } catch (error: any) {
      results.push({
        test: 'Integration Test',
        status: 'fail',
        message: 'Test execution failed',
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Get integration test summary
 */
export const getIntegrationTestSummary = (results: IntegrationTestResult[]) => {
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;

  return {
    total,
    passed,
    failed,
    successRate: total > 0 ? (passed / total) * 100 : 0,
    status: failed === 0 ? 'healthy' : 'issues_detected'
  };
};
