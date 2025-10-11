/**
 * Analytics Module Index
 * 
 * This file exports all analytics functionality including event schemas,
 * PII policy utilities, and the main analytics service.
 */

// Export event schemas and types
export * from './event-schema';

// Export PII policy utilities
export * from './pii-policy';

// Export analytics service
export * from './analytics-service';

// Re-export commonly used items for convenience
export {
  analyticsService,
  emitEvent,
  setTenantContext,
  setUserContext,
} from './analytics-service';

export type {
  PiiRedactionMethod,
  PiiPolicyConfig,
} from './pii-policy';

export type {
  AnalyticsEvent,
  AnalyticsEventData,
} from './event-schema';
