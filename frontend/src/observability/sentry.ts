/**
 * Sentry Integration
 * 
 * Configures Sentry for error tracking and performance monitoring.
 * Provides PII scrubbing and tenant context for error reports.
 */

import * as Sentry from '@sentry/react';
import { config } from '../lib/env';

// Sentry configuration options
interface SentryConfig {
  dsn?: string;
  environment: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  beforeSend: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
  beforeBreadcrumb: (breadcrumb: Sentry.Breadcrumb) => Sentry.Breadcrumb | null;
}

/**
 * PII scrubbing function to remove sensitive data from Sentry events
 * @param event - Sentry event
 * @returns Scrubbed event or null if should be dropped
 */
const scrubPII = (event: Sentry.ErrorEvent, _hint: Sentry.EventHint): Sentry.ErrorEvent | null => {
  if (!event) return null;

  // Remove sensitive data from user context
  if (event.user && event.user.id) {
    event.user = {
      id: event.user.id,
      // Remove email, phone, and other PII
    };
  }

  // Remove sensitive data from extra context
  if (event.extra) {
    const sensitiveKeys = ['password', 'token', 'api_key', 'email', 'phone', 'ssn'];
    sensitiveKeys.forEach(key => {
      delete event.extra?.[key];
    });
  }

  // Remove sensitive data from tags
  if (event.tags) {
    const sensitiveKeys = ['email', 'phone', 'user_id'];
    sensitiveKeys.forEach(key => {
      delete event.tags?.[key];
    });
  }

  // Remove sensitive data from URLs
  if (event.request?.url) {
    event.request.url = event.request.url.replace(/[?&](token|key|password)=[^&]*/gi, '');
  }

  return event;
};

/**
 * Breadcrumb filtering to remove sensitive data
 * @param breadcrumb - Sentry breadcrumb
 * @returns Filtered breadcrumb or null if should be dropped
 */
const filterBreadcrumbs = (breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null => {
  if (!breadcrumb) return null;

  // Remove sensitive data from breadcrumb data
  if (breadcrumb.data) {
    const sensitiveKeys = ['password', 'token', 'api_key', 'email', 'phone'];
    sensitiveKeys.forEach(key => {
      if (breadcrumb.data && key in breadcrumb.data) {
        delete breadcrumb.data[key];
      }
    });
  }

  // Remove sensitive data from breadcrumb message
  if (breadcrumb.message) {
    breadcrumb.message = breadcrumb.message.replace(/[?&](token|key|password)=[^&]*/gi, '');
  }

  return breadcrumb;
};

/**
 * Create Sentry configuration
 * @param options - Optional configuration overrides
 * @returns Sentry configuration
 */
const createSentryConfig = (options: Partial<SentryConfig> = {}): SentryConfig => {
  return {
    dsn: config.SENTRY_DSN,
    environment: config.ENV,
    tracesSampleRate: config.IS_PRODUCTION ? 0.1 : 1.0, // 10% in production, 100% in dev
    replaysSessionSampleRate: config.IS_PRODUCTION ? 0.01 : 0.1, // 1% in production, 10% in dev
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors
    beforeSend: scrubPII,
    beforeBreadcrumb: filterBreadcrumbs,
    ...options,
  };
};

/**
 * Initialize Sentry
 * @param options - Optional configuration overrides
 */
export const initSentry = (options: Partial<SentryConfig> = {}): void => {
  const sentryConfig = createSentryConfig(options);

  // Only initialize Sentry if DSN is provided
  if (!sentryConfig.dsn) {
    console.warn('Sentry DSN not provided, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: sentryConfig.dsn,
    environment: sentryConfig.environment,
    tracesSampleRate: sentryConfig.tracesSampleRate,
    replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
    replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate,
    beforeSend: sentryConfig.beforeSend,
    beforeBreadcrumb: sentryConfig.beforeBreadcrumb,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
  });
};

/**
 * Set user context for Sentry
 * @param user - User information
 */
export const setSentryUser = (user: {
  id: string | number;
  email?: string;
  username?: string;
}): void => {
  Sentry.setUser({
    id: user.id,
    // Don't set email or other PII directly
    ...(user.username && { username: user.username }),
  });
};

/**
 * Set tenant context for Sentry
 * @param tenantId - Tenant ID
 * @param tenantSlug - Tenant slug
 */
export const setSentryTenant = (tenantId: string | undefined, tenantSlug: string | undefined): void => {
  if (tenantId && tenantSlug) {
    Sentry.setContext('tenant', {
      id: tenantId,
      slug: tenantSlug,
    });
  }
};

/**
 * Set additional context for Sentry
 * @param key - Context key
 * @param value - Context value
 */
export const setSentryContext = (key: string, value: any): void => {
  Sentry.setContext(key, value);
};

/**
 * Capture an exception in Sentry
 * @param error - Error to capture
 * @param context - Additional context
 */
export const captureException = (error: Error, context?: Record<string, any>): void => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
};

/**
 * Capture a message in Sentry
 * @param message - Message to capture
 * @param level - Log level
 * @param context - Additional context
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, any>
): void => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
  }
};

/**
 * Add a breadcrumb to Sentry
 * @param breadcrumb - Breadcrumb to add
 */
export const addBreadcrumb = (breadcrumb: Sentry.Breadcrumb): void => {
  Sentry.addBreadcrumb(breadcrumb);
};

/**
 * Get the current Sentry scope
 * @returns Sentry scope
 */
export const getCurrentScope = (): Sentry.Scope => {
  return Sentry.getCurrentScope();
};

/**
 * Start a Sentry transaction (deprecated in v7+, use startSpan instead)
 * @param name - Transaction name
 * @param op - Operation type
 * @returns Sentry transaction
 */
export const startTransaction = (_name: string, _op: string): any => {
  // Note: startTransaction is deprecated in Sentry v7+
  // Use startSpan or withScope for new implementations
  console.warn('startTransaction is deprecated. Use startSpan instead.');
  return null;
};

/**
 * Check if Sentry is initialized
 * @returns True if Sentry is initialized
 */
export const isSentryInitialized = (): boolean => {
  return !!Sentry.getClient();
};