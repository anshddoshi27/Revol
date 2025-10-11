/**
 * Telemetry Service
 * 
 * Service for tracking analytics events and observability.
 * Provides structured event tracking for onboarding and policy management.
 */

interface TelemetryEvent {
  event_type: string;
  tenant_id?: string;
  user_id?: string;
  step?: number;
  data?: Record<string, any>;
  timestamp: string;
}

interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
}

class TelemetryService {
  private config: TelemetryConfig;
  private queue: TelemetryEvent[] = [];
  private isProcessing = false;

  constructor(config: TelemetryConfig = { enabled: false }) {
    this.config = config;
  }

  /**
   * Track an event
   */
  track(eventType: string, data: Record<string, any> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    const event: TelemetryEvent = {
      event_type: eventType,
      tenant_id: this.getTenantId(),
      user_id: this.getUserId(),
      timestamp: new Date().toISOString(),
      data,
    };

    this.queue.push(event);
    this.processQueue();
  }

  /**
   * Track onboarding step events
   */
  trackOnboardingStep(step: number, action: 'started' | 'complete' | 'error', data: Record<string, any> = {}): void {
    this.track(`onboarding.step${step}_${action}`, {
      step,
      ...data,
    });
  }

  /**
   * Track policy management events
   */
  trackPolicyEvent(action: 'save_success' | 'save_error' | 'load_success' | 'load_error', data: Record<string, any> = {}): void {
    this.track(`policies.${action}`, data);
  }

  /**
   * Track confirmation message events
   */
  trackConfirmationMessageEvent(action: 'save_success' | 'save_error' | 'preview_success' | 'preview_error', data: Record<string, any> = {}): void {
    this.track(`confirmation_message.${action}`, data);
  }

  /**
   * Track checkout warning events
   */
  trackCheckoutWarningEvent(action: 'save_success' | 'save_error' | 'preview_success' | 'preview_error', data: Record<string, any> = {}): void {
    this.track(`checkout_warning.${action}`, data);
  }

  /**
   * Track checkout policy acknowledgment events
   */
  trackCheckoutPolicyAck(action: 'required' | 'confirmed' | 'declined', data: Record<string, any> = {}): void {
    this.track(`checkout.policy_ack_${action}`, data);
  }

  /**
   * Track payment setup events
   */
  trackPaymentEvent(action: 'setup_intent_started' | 'setup_intent_created' | 'setup_intent_succeeded' | 'setup_intent_failed', data: Record<string, any> = {}): void {
    this.track(`payments.${action}`, data);
  }

  /**
   * Track wallet configuration events
   */
  trackWalletEvent(action: 'toggle_update' | 'config_updated', data: Record<string, any> = {}): void {
    this.track(`wallets.${action}`, data);
  }

  /**
   * Track KYC events
   */
  trackKYCEvent(action: 'field_updated' | 'address_field_updated' | 'payout_field_updated' | 'payout_type_changed' | 'form_validated' | 'created' | 'updated', data: Record<string, any> = {}): void {
    this.track(`kyc.${action}`, data);
  }

  /**
   * Track go-live events
   */
  trackGoLiveEvent(action: 'confirmed' | 'success' | 'link_copied' | 'admin_dashboard_accessed' | 'booking_site_viewed', data: Record<string, any> = {}): void {
    this.track(`owner.go_live_${action}`, data);
  }

  /**
   * Track payment validation events
   */
  trackPaymentValidationEvent(action: 'completed', data: Record<string, any> = {}): void {
    this.track(`payments.validation_${action}`, data);
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = this.queue.splice(0, 10); // Process up to 10 events at a time

      if (this.config.endpoint) {
        await this.sendEvents(events);
      } else {
        // Log to console in development
        console.log('Telemetry Events:', events);
      }
    } catch (error) {
      console.error('Failed to send telemetry events:', error);
      // Re-queue events for retry
      this.queue.unshift(...events);
    } finally {
      this.isProcessing = false;

      // Process remaining events if any
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  /**
   * Send events to telemetry endpoint
   */
  private async sendEvents(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoint) {
      return;
    }

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      throw new Error(`Telemetry request failed: ${response.status}`);
    }
  }

  /**
   * Get current tenant ID
   */
  private getTenantId(): string | undefined {
    // This would typically come from the app context or URL
    const path = window.location.pathname;
    const match = path.match(/\/onboarding\/([^\/]+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Get current user ID
   */
  private getUserId(): string | undefined {
    // This would typically come from the auth context
    return localStorage.getItem('user_id') || undefined;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Clear the event queue
   */
  clearQueue(): void {
    this.queue = [];
  }
}

// Create and export the telemetry service instance
export const telemetry = new TelemetryService({
  enabled: import.meta.env.DEV,
  endpoint: import.meta.env.VITE_TELEMETRY_ENDPOINT,
  apiKey: import.meta.env.VITE_TELEMETRY_API_KEY,
});

// Export the service class for testing
export { TelemetryService };
export type { TelemetryEvent, TelemetryConfig };
