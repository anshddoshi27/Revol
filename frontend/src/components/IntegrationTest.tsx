/**
 * Integration Test Component
 * 
 * Component to test and display frontend-backend integration status.
 */

import React, { useState, useEffect } from 'react';
import { runIntegrationTests, getIntegrationTestSummary, IntegrationTestResult } from '../api/services/integrationTest';
import { CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';

export const IntegrationTest: React.FC = () => {
  const [results, setResults] = useState<IntegrationTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runTests = async () => {
    setIsRunning(true);
    try {
      const testResults = await runIntegrationTests();
      setResults(testResults);
      setLastRun(new Date());
    } catch (error) {
      console.error('Integration tests failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const summary = getIntegrationTestSummary(results);

  const getStatusIcon = (status: 'pass' | 'fail') => {
    return status === 'pass' ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <XCircle className="h-5 w-5 text-red-500" />
    );
  };

  const getStatusColor = (status: 'pass' | 'fail') => {
    return status === 'pass' 
      ? 'bg-green-50 border-green-200 text-green-800'
      : 'bg-red-50 border-red-200 text-red-800';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Frontend-Backend Integration Test
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Verify connectivity between frontend and backend services
              </p>
            </div>
            <button
              onClick={runTests}
              disabled={isRunning}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Summary */}
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
                <div className="text-sm text-gray-600">Total Tests</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                <div className="text-sm text-green-600">Passed</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{summary.successRate.toFixed(1)}%</div>
                <div className="text-sm text-blue-600">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Overall Status */}
          <div className={`mb-6 p-4 rounded-lg border ${
            summary.status === 'healthy' 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center">
              {summary.status === 'healthy' ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500 mr-2" />
              )}
              <span className={`font-medium ${
                summary.status === 'healthy' ? 'text-green-800' : 'text-yellow-800'
              }`}>
                {summary.status === 'healthy' 
                  ? 'All systems operational' 
                  : 'Some issues detected'}
              </span>
            </div>
            <p className={`text-sm mt-1 ${
              summary.status === 'healthy' ? 'text-green-600' : 'text-yellow-600'
            }`}>
              {summary.status === 'healthy'
                ? 'Frontend and backend are properly connected and communicating.'
                : 'Please review the failed tests below for more details.'}
            </p>
          </div>

          {/* Test Results */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Test Results</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start">
                  {getStatusIcon(result.status)}
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{result.test}</h4>
                      <span className="text-sm font-medium">
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{result.message}</p>
                    {result.error && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-xs font-mono text-red-800">
                        {result.error}
                      </div>
                    )}
                    {result.response && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer">View Response</summary>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                          {JSON.stringify(result.response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Last Run Info */}
          {lastRun && (
            <div className="mt-6 text-xs text-gray-500 text-center">
              Last run: {lastRun.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationTest;
