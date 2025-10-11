/**
 * Telemetry System
 * 
 * Unified telemetry system for collecting and reporting application metrics,
 * events, and performance data. Integrates with Sentry and Web Vitals.
 */

import { config } from '../lib/env';
import { initSentry, captureException, captureMessage, addBreadcrumb } from './sentry';
import { initWebVitals, addWebVitalsCallback, WebVitalsMetrics, getPerformanceScore } from './webVitals';

// Telemetry event types
export interface TelemetryEvent {
  type: string;
  name: string;
  data?: Record<string, any>;
  timestamp: number;
  route?: string;
  userId?: string | undefined;
  tenantId?: string | undefined;
}

// Telemetry configuration
export interface TelemetryConfig {
  enableSentry: boolean;
  enableWebVitals: boolean;
  enableConsoleLogging: boolean;
  samplingRate: number;
}

// Default telemetry configuration
const defaultConfig: TelemetryConfig = {
  enableSentry: !!config.SENTRY_DSN,
  enableWebVitals: true,
  enableConsoleLogging: config.IS_DEVELOPMENT,
  samplingRate: config.IS_PRODUCTION ? 0.1 : 1.0, // 10% in production, 100% in dev
};

// Global telemetry state
let telemetryConfig = { ...defaultConfig };
let isInitialized = false;

/**
 * Initialize the telemetry system
 * @param options - Optional configuration overrides
 */
export const initTelemetry = (options: Partial<TelemetryConfig> = {}): void => {
  if (isInitialized) {
    console.warn('Telemetry already initialized');
    return;
  }

  // Merge configuration
  telemetryConfig = { ...defaultConfig, ...options };

  // Initialize Sentry if enabled
  if (telemetryConfig.enableSentry) {
    initSentry();
  }

  // Initialize Web Vitals if enabled
  if (telemetryConfig.enableWebVitals) {
    initWebVitals();
    
    // Add Web Vitals callback for performance monitoring
    addWebVitalsCallback((metrics: WebVitalsMetrics) => {
      const score = getPerformanceScore(metrics);
      
      // Log performance metrics
      if (telemetryConfig.enableConsoleLogging) {
        console.log('Performance Score:', score, metrics);
      }

      // Send to Sentry if enabled
      if (telemetryConfig.enableSentry) {
        captureMessage('Web Vitals collected', 'info', {
          performance_score: score,
          metrics,
        });
      }
    });
  }

  isInitialized = true;

  if (telemetryConfig.enableConsoleLogging) {
    console.log('Telemetry system initialized', telemetryConfig);
  }
};

/**
 * Track a custom event
 * @param name - Event name
 * @param data - Event data
 * @param options - Additional options
 */
export const trackEvent = (
  name: string,
  data?: Record<string, any>,
  options?: {
    userId?: string;
    tenantId?: string;
    route?: string;
  }
): void => {
  if (!isInitialized) {
    console.warn('Telemetry not initialized, skipping event tracking');
    return;
  }

  // Apply sampling
  if (Math.random() > telemetryConfig.samplingRate) {
    return;
  }

  const event: TelemetryEvent = {
    type: 'custom',
    name,
    data: data || {},
    timestamp: Date.now(),
    route: options?.route || window.location.pathname,
    userId: options?.userId || undefined,
    tenantId: options?.tenantId || undefined,
  };

  // Log to console in development
  if (telemetryConfig.enableConsoleLogging) {
    console.log('Telemetry Event:', event);
  }

  // Send to Sentry if enabled
  if (telemetryConfig.enableSentry) {
    addBreadcrumb({
      message: event.name,
      category: 'telemetry',
      level: 'info',
      data: event.data || {},
    });
  }
};

/**
 * Track an error
 * @param error - Error to track
 * @param context - Additional context
 * @param options - Additional options
 */
export const trackError = (
  error: Error,
  context?: Record<string, any>,
  options?: {
    userId?: string;
    tenantId?: string;
    route?: string;
  }
): void => {
  if (!isInitialized) {
    console.warn('Telemetry not initialized, skipping error tracking');
    return;
  }

  // Log to console in development
  if (telemetryConfig.enableConsoleLogging) {
    console.error('Telemetry Error:', error, context);
  }

  // Send to Sentry if enabled
  if (telemetryConfig.enableSentry) {
    const errorContext = {
      ...context,
      route: options?.route || window.location.pathname,
      userId: options?.userId,
      tenantId: options?.tenantId,
    };
    
    captureException(error, errorContext);
  }
};

/**
 * Track a performance metric
 * @param name - Metric name
 * @param value - Metric value
 * @param unit - Metric unit
 * @param options - Additional options
 */
export const trackMetric = (
  name: string,
  value: number,
  unit: string = 'ms',
  options?: {
    userId?: string;
    tenantId?: string;
    route?: string;
  }
): void => {
  if (!isInitialized) {
    console.warn('Telemetry not initialized, skipping metric tracking');
    return;
  }

  // Apply sampling
  if (Math.random() > telemetryConfig.samplingRate) {
    return;
  }

  const metricData = {
    name,
    value,
    unit,
    route: options?.route || window.location.pathname,
    userId: options?.userId,
    tenantId: options?.tenantId,
  };

  // Log to console in development
  if (telemetryConfig.enableConsoleLogging) {
    console.log('Telemetry Metric:', metricData);
  }

  // Send to Sentry if enabled
  if (telemetryConfig.enableSentry) {
    captureMessage(`Metric: ${name}`, 'info', metricData);
  }
};

/**
 * Track a user action
 * @param action - Action name
 * @param target - Action target
 * @param data - Additional data
 * @param options - Additional options
 */
export const trackUserAction = (
  action: string,
  target?: string,
  data?: Record<string, any>,
  options?: {
    userId?: string;
    tenantId?: string;
    route?: string;
  }
): void => {
  trackEvent('user_action', {
    action,
    target,
    ...data,
  }, options);
};

/**
 * Track a page view
 * @param route - Route path
 * @param data - Additional data
 * @param options - Additional options
 */
export const trackPageView = (
  route: string,
  data?: Record<string, any>,
  options?: {
    userId?: string;
    tenantId?: string;
  }
): void => {
  trackEvent('page_view', {
    route,
    ...data,
  }, { ...options, route });
};

/**
 * Track an API request
 * @param method - HTTP method
 * @param url - Request URL
 * @param status - Response status
 * @param duration - Request duration
 * @param options - Additional options
 */
export const trackApiRequest = (
  method: string,
  url: string,
  status: number,
  duration: number,
  options?: {
    userId?: string;
    tenantId?: string;
    route?: string;
  }
): void => {
  trackEvent('api_request', {
    method,
    url,
    status,
    duration,
  }, options);
};

/**
 * Track an API error
 * @param method - HTTP method
 * @param url - Request URL
 * @param status - Response status
 * @param error - Error details
 * @param options - Additional options
 */
export const trackApiError = (
  method: string,
  url: string,
  status: number,
  error: string,
  options?: {
    userId?: string;
    tenantId?: string;
    route?: string;
  }
): void => {
  trackEvent('api_error', {
    method,
    url,
    status,
    error,
  }, options);
};

/**
 * Set user context for telemetry
 * @param userId - User ID
 * @param userData - Additional user data
 */
export const setUserContext = (userId: string, userData?: Record<string, any>): void => {
  if (telemetryConfig.enableSentry) {
    const { setSentryUser } = require('./sentry');
    setSentryUser({ id: userId, ...userData });
  }
};

/**
 * Set tenant context for telemetry
 * @param tenantId - Tenant ID
 * @param tenantSlug - Tenant slug
 */
export const setTenantContext = (tenantId: string, tenantSlug: string): void => {
  if (telemetryConfig.enableSentry) {
    const { setSentryTenant } = require('./sentry');
    setSentryTenant(tenantId, tenantSlug);
  }
};

/**
 * Check if telemetry is initialized
 * @returns True if telemetry is initialized
 */
export const isTelemetryInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Get telemetry configuration
 * @returns Current telemetry configuration
 */
export const getTelemetryConfig = (): TelemetryConfig => {
  return { ...telemetryConfig };
};

// Export telemetry object for easy access
export const telemetry = {
  track: trackEvent,
  trackError: trackError,
  trackMetric: trackMetric,
  trackUserAction: trackUserAction,
  trackPageView: trackPageView,
  trackApiRequest: trackApiRequest,
  trackApiError: trackApiError,
  setUserContext: setUserContext,
  setTenantContext: setTenantContext,
};
