/**
 * Observability Module
 * 
 * Main export file for the observability module, providing access to all
 * monitoring, logging, and telemetry functionality.
 */

// Sentry integration
export {
  initSentry,
  setSentryUser,
  setSentryTenant,
  setSentryContext,
  captureException,
  captureMessage,
  addBreadcrumb,
  startTransaction,
  getCurrentScope,
  isSentryInitialized,
} from './sentry';

// Web Vitals integration
export {
  initWebVitals,
  addWebVitalsCallback,
  removeWebVitalsCallback,
  getCurrentMetrics,
  checkPerformanceBudgets,
  getPerformanceScore,
  formatMetricValue,
  PERFORMANCE_BUDGETS,
  type WebVitalsMetrics,
  type BudgetStatus,
  type WebVitalsCallback,
} from './webVitals';

// Telemetry system
export {
  initTelemetry,
  trackEvent,
  trackError,
  trackMetric,
  trackUserAction,
  trackPageView,
  trackApiRequest,
  trackApiError,
  setUserContext,
  setTenantContext,
  isTelemetryInitialized,
  getTelemetryConfig,
  type TelemetryEvent,
  type TelemetryConfig,
} from './telemetry';
