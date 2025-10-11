/**
 * Analytics Service Implementation
 * 
 * This file provides the main analytics service that handles event emission,
 * schema validation, PII compliance, and sampling for all analytics events.
 */

import { 
  AnalyticsEvent, 
  AnalyticsEventData, 
  ANALYTICS_EVENTS,
  validateEventSchema,
  detectPiiFields
} from './event-schema';
import { 
  PiiPolicyValidator,
  PiiViolation,
  PiiPolicyConfig 
} from './pii-policy';

// Analytics Configuration
export interface AnalyticsConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  retryAttempts: number;
  piiPolicy: PiiPolicyConfig;
  sampling: {
    production: number;
    staging: number;
    development: number;
  };
}

// Default Analytics Configuration
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  endpoint: '/api/v1/analytics/events',
  batchSize: 10,
  flushInterval: 5000, // 5 seconds
  retryAttempts: 3,
  piiPolicy: {
    enableDetection: true,
    enableRedaction: true,
    enableValidation: true,
    strictMode: true,
    logViolations: true,
    allowedPiiFields: [],
    blockedPiiFields: [],
  },
  sampling: {
    production: 1.0,
    staging: 0.1,
    development: 0.01,
  },
};

// Event Queue Item
interface QueuedEvent {
  event: AnalyticsEvent;
  timestamp: number;
  retryCount: number;
}

// Analytics Service Class
export class AnalyticsService {
  private config: AnalyticsConfig;
  private eventQueue: QueuedEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private sessionId: string;
  private tenantId: string | null = null;
  private userId: string | null = null;
  private piiValidator: PiiPolicyValidator;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.piiValidator = new PiiPolicyValidator();
    this.initialize();
  }

  /**
   * Initialize the analytics service
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load analytics schema
      await this.loadSchema();
      
      // Emit schema loaded event
      await this.emitEvent(ANALYTICS_EVENTS.ANALYTICS_SCHEMA_LOADED, {
        schema_version: '1.0.0',
        loaded_at: new Date().toISOString(),
        event_count: Object.keys(ANALYTICS_EVENTS).length,
      });

      // Start flush timer
      this.startFlushTimer();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize analytics service:', error);
    }
  }

  /**
   * Set tenant context
   */
  setTenantContext(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Set user context
   */
  setUserContext(userId: string): void {
    this.userId = userId;
  }

  /**
   * Track an analytics event (alias for emitEvent)
   */
  async track<T extends AnalyticsEventData>(
    eventName: string,
    eventData: T,
    options: {
      tenantId?: string;
      userId?: string;
      sessionId?: string;
      skipSampling?: boolean;
    } = {}
  ): Promise<void> {
    return this.emitEvent(eventName, eventData, options);
  }

  /**
   * Emit an analytics event
   */
  async emitEvent<T extends AnalyticsEventData>(
    eventName: string,
    eventData: T,
    options: {
      tenantId?: string;
      userId?: string;
      sessionId?: string;
      skipSampling?: boolean;
    } = {}
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Validate event schema
      const schemaValidation = validateEventSchema(eventName, eventData);
      if (!schemaValidation.isValid) {
        await this.handleSchemaViolation(eventName, schemaValidation.errors);
        return;
      }

      // Check sampling
      if (!options.skipSampling && !this.shouldSample(eventName)) {
        return;
      }

      // Validate PII policy
      const piiValidation = this.piiValidator.validateEvent(eventName, eventData);
      if (!piiValidation.isValid) {
        await this.handlePiiViolation(eventName, piiValidation.violations);
        return;
      }

      // Use redacted data if available
      const finalEventData = piiValidation.redactedData || eventData;

      // Create analytics event
      const analyticsEvent: AnalyticsEvent = {
        event_name: eventName,
        event_data: finalEventData,
        user_id: options.userId || this.userId || undefined,
        tenant_id: options.tenantId || this.tenantId || undefined,
        timestamp: new Date().toISOString(),
        pii_flags: this.detectPiiFlags(finalEventData),
        sampling_rate: this.getSamplingRate(eventName),
      };

      // Queue the event
      this.queueEvent(analyticsEvent);

      // Emit event emitted event (with low sampling)
      if (Math.random() < 0.01) {
        await this.emitEvent(ANALYTICS_EVENTS.ANALYTICS_EVENT_EMITTED, {
          event_name: eventName,
          emitted_at: new Date().toISOString(),
          tenant_id: analyticsEvent.tenant_id || '',
          session_id: options.sessionId || this.sessionId || '',
        }, { skipSampling: true });
      }

    } catch (error) {
      console.error('Failed to emit analytics event:', error);
      await this.handleError('analytics.emit_failed', error);
    }
  }

  /**
   * Queue an event for batch processing
   */
  private queueEvent(event: AnalyticsEvent): void {
    this.eventQueue.push({
      event,
      timestamp: Date.now(),
      retryCount: 0,
    });

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flushEvents();
    }
  }

  /**
   * Flush queued events to the server
   */
  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(eventsToFlush);
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      
      // Retry failed events
      for (const queuedEvent of eventsToFlush) {
        if (queuedEvent.retryCount < this.config.retryAttempts) {
          queuedEvent.retryCount++;
          this.eventQueue.push(queuedEvent);
        }
      }
    }
  }

  /**
   * Send events to the analytics endpoint
   */
  private async sendEvents(events: QueuedEvent[]): Promise<void> {
    const payload = {
      events: events.map(qe => qe.event),
      session_id: this.sessionId || '',
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.flushInterval);
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Check if an event should be sampled
   */
  private shouldSample(eventName: string): boolean {
    const environment = this.getEnvironment();
    const baseRate = this.config.sampling[environment];
    
    // Some events have different sampling rates
    const eventSamplingRates: Record<string, number> = {
      [ANALYTICS_EVENTS.BOOKING_AVAILABILITY_VIEW]: 0.1,
      [ANALYTICS_EVENTS.NOTIFICATION_EMAIL_SENT]: 0.1,
      [ANALYTICS_EVENTS.NOTIFICATION_SMS_SENT]: 0.1,
      [ANALYTICS_EVENTS.PERFORMANCE_PAGE_LOAD]: 0.1,
      [ANALYTICS_EVENTS.PERFORMANCE_API_CALL]: 0.1,
    };

    const eventRate = eventSamplingRates[eventName] || baseRate;
    return Math.random() < eventRate;
  }

  /**
   * Get sampling rate for an event
   */
  private getSamplingRate(eventName: string): number {
    const environment = this.getEnvironment();
    const baseRate = this.config.sampling[environment];
    
    const eventSamplingRates: Record<string, number> = {
      [ANALYTICS_EVENTS.BOOKING_AVAILABILITY_VIEW]: 0.1,
      [ANALYTICS_EVENTS.NOTIFICATION_EMAIL_SENT]: 0.1,
      [ANALYTICS_EVENTS.NOTIFICATION_SMS_SENT]: 0.1,
      [ANALYTICS_EVENTS.PERFORMANCE_PAGE_LOAD]: 0.1,
      [ANALYTICS_EVENTS.PERFORMANCE_API_CALL]: 0.1,
    };

    return eventSamplingRates[eventName] || baseRate;
  }

  /**
   * Detect PII flags in event data
   */
  private detectPiiFlags(eventData: any): string[] {
    return detectPiiFields(eventData);
  }

  /**
   * Handle schema validation violations
   */
  private async handleSchemaViolation(eventName: string, errors: string[]): Promise<void> {
    await this.emitEvent(ANALYTICS_EVENTS.ANALYTICS_SCHEMA_VIOLATION, {
      event_name: eventName,
      validation_errors: errors,
      detected_at: new Date().toISOString(),
      tenant_id: this.tenantId || '',
    }, { skipSampling: true });
  }

  /**
   * Handle PII violations
   */
  private async handlePiiViolation(eventName: string, violations: PiiViolation[]): Promise<void> {
    await this.emitEvent(ANALYTICS_EVENTS.ANALYTICS_PII_VIOLATION, {
      event_name: eventName,
      violation_type: 'pii_detected',
      violated_fields: violations.map(v => v.field),
      detected_at: new Date().toISOString(),
      tenant_id: this.tenantId || '',
    }, { skipSampling: true });
  }

  /**
   * Handle errors
   */
  private async handleError(errorType: string, error: any): Promise<void> {
    await this.emitEvent(ANALYTICS_EVENTS.ERROR_FRONTEND_ERROR, {
      error_type: errorType,
      error_message: error.message || 'Unknown error',
      error_stack: error.stack || '',
      component: 'analytics-service',
      route: window.location.pathname,
      tenant_id: this.tenantId || '',
      user_agent: navigator.userAgent,
    }, { skipSampling: true });
  }

  /**
   * Load analytics schema
   */
  private async loadSchema(): Promise<void> {
    // In a real implementation, this would load the schema from the server
    // For now, we'll just validate that our local schema is available
    if (!ANALYTICS_EVENTS) {
      throw new Error('Analytics schema not available');
    }
  }

  /**
   * Get the current environment
   */
  private getEnvironment(): 'production' | 'staging' | 'development' {
    const hostname = window.location.hostname;
    
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
      return 'development';
    } else if (hostname.includes('staging') || hostname.includes('dev')) {
      return 'staging';
    } else {
      return 'production';
    }
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    // In a real implementation, this would get the JWT token from storage
    return localStorage.getItem('auth_token') || '';
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy the analytics service
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flushEvents(); // Flush any remaining events
    this.isInitialized = false;
  }
}

// Export default instance
export const analyticsService = new AnalyticsService();

// Export utility functions
export const emitEvent = <T extends AnalyticsEventData>(
  eventName: string,
  eventData: T,
  options?: {
    tenantId?: string;
    userId?: string;
    sessionId?: string;
    skipSampling?: boolean;
  }
): Promise<void> => {
  return analyticsService.emitEvent(eventName, eventData, options);
};

export const setTenantContext = (tenantId: string): void => {
  analyticsService.setTenantContext(tenantId);
};

export const setUserContext = (userId: string): void => {
  analyticsService.setUserContext(userId);
};

// AnalyticsService is already exported above
