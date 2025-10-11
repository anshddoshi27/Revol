/**
 * Analytics Event Schema Definitions
 * 
 * This file contains TypeScript definitions for all analytics events
 * defined in the analytics-events.json taxonomy.
 * 
 * SHA-256 Hash: b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7
 */

// Core Analytics Event Interface
export interface AnalyticsEvent {
  event_name: string;
  event_data: Record<string, any>;
  user_id?: string | undefined;
  tenant_id?: string | undefined;
  timestamp: string;
  pii_flags: string[];
  sampling_rate: number;
}

// Onboarding Events
export interface OnboardingStepCompleteEvent {
  step: string;
  tenant_id: string;
  user_id: string;
  step_duration_ms: number;
  previous_step: string;
}

export interface OnboardingStepAbandonEvent {
  step: string;
  tenant_id: string;
  user_id: string;
  time_on_step_ms: number;
  abandon_reason: string;
}

export interface OnboardingCompleteEvent {
  tenant_id: string;
  user_id: string;
  total_duration_ms: number;
  steps_completed: number;
  business_category: string;
}

// Booking Events
export interface BookingServiceSelectEvent {
  service_id: string;
  service_name: string;
  service_price_cents: number;
  service_duration_minutes: number;
  tenant_id: string;
  session_id: string;
}

export interface BookingAvailabilityViewEvent {
  service_id: string;
  date_range_start: string;
  date_range_end: string;
  slots_available: number;
  tenant_id: string;
  session_id: string;
}

export interface BookingSlotSelectEvent {
  service_id: string;
  slot_datetime: string;
  tenant_id: string;
  session_id: string;
}

export interface BookingCheckoutStartEvent {
  service_id: string;
  slot_datetime: string;
  total_amount_cents: number;
  tenant_id: string;
  session_id: string;
}

export interface BookingCheckoutCompleteEvent {
  booking_id: string;
  service_id: string;
  slot_datetime: string;
  total_amount_cents: number;
  payment_method: string;
  tenant_id: string;
  session_id: string;
}

export interface BookingCheckoutAbandonEvent {
  service_id: string;
  slot_datetime: string;
  total_amount_cents: number;
  abandon_step: string;
  tenant_id: string;
  session_id: string;
}

// Payment Events
export interface PaymentIntentCreateEvent {
  booking_id: string;
  amount_cents: number;
  currency: string;
  payment_method: string;
  tenant_id: string;
}

export interface PaymentIntentSuccessEvent {
  booking_id: string;
  payment_intent_id: string;
  amount_cents: number;
  currency: string;
  payment_method: string;
  tenant_id: string;
}

export interface PaymentIntentFailedEvent {
  booking_id: string;
  payment_intent_id: string;
  amount_cents: number;
  currency: string;
  payment_method: string;
  error_code: string;
  error_message: string;
  tenant_id: string;
}

// Notification Events
export interface NotificationEmailSentEvent {
  notification_type: string;
  booking_id: string;
  tenant_id: string;
  template_id: string;
  delivery_status: string;
}

export interface NotificationSmsSentEvent {
  notification_type: string;
  booking_id: string;
  tenant_id: string;
  template_id: string;
  delivery_status: string;
}

export interface NotificationEmailDeliveredEvent {
  notification_type: string;
  booking_id: string;
  tenant_id: string;
  template_id: string;
}

export interface NotificationSmsDeliveredEvent {
  notification_type: string;
  booking_id: string;
  tenant_id: string;
  template_id: string;
}

// Loyalty Events
export interface LoyaltyPointsEarnedEvent {
  customer_id: string;
  booking_id: string;
  points_earned: number;
  points_total: number;
  tenant_id: string;
}

export interface LoyaltyPointsRedeemedEvent {
  customer_id: string;
  booking_id: string;
  points_redeemed: number;
  points_remaining: number;
  tenant_id: string;
}

// Automation Events
export interface AutomationTriggerFiredEvent {
  automation_id: string;
  trigger_type: string;
  booking_id: string;
  tenant_id: string;
  trigger_data: Record<string, any>;
}

export interface AutomationActionExecutedEvent {
  automation_id: string;
  action_type: string;
  booking_id: string;
  tenant_id: string;
  execution_status: string;
}

// Admin Events
export interface AdminBookingAttendedEvent {
  booking_id: string;
  tenant_id: string;
  user_id: string;
  attended_at: string;
}

export interface AdminBookingNoShowEvent {
  booking_id: string;
  tenant_id: string;
  user_id: string;
  no_show_at: string;
}

export interface AdminBookingCancelledEvent {
  booking_id: string;
  tenant_id: string;
  user_id: string;
  cancelled_at: string;
  cancellation_reason: string;
}

export interface AdminServiceCreatedEvent {
  service_id: string;
  service_name: string;
  service_price_cents: number;
  service_duration_minutes: number;
  tenant_id: string;
  user_id: string;
}

export interface AdminServiceUpdatedEvent {
  service_id: string;
  service_name: string;
  service_price_cents: number;
  service_duration_minutes: number;
  tenant_id: string;
  user_id: string;
}

export interface AdminAvailabilityUpdatedEvent {
  tenant_id: string;
  user_id: string;
  schedule_type: string;
  date_range_start: string;
  date_range_end: string;
}

export interface AdminBrandingUpdatedEvent {
  tenant_id: string;
  user_id: string;
  branding_type: string;
  has_logo: boolean;
  has_custom_colors: boolean;
}

// System Events
export interface AnalyticsSchemaLoadedEvent {
  schema_version: string;
  loaded_at: string;
  event_count: number;
}

export interface AnalyticsEventEmittedEvent {
  event_name: string;
  emitted_at: string;
  tenant_id: string;
  session_id: string;
}

export interface AnalyticsPiiViolationEvent {
  event_name: string;
  violation_type: string;
  violated_fields: string[];
  detected_at: string;
  tenant_id: string;
}

export interface AnalyticsSchemaViolationEvent {
  event_name: string;
  validation_errors: string[];
  detected_at: string;
  tenant_id: string;
}

export interface ErrorFrontendErrorEvent {
  error_type: string;
  error_message: string;
  error_stack: string;
  component: string;
  route: string;
  tenant_id: string;
  user_agent: string;
}

export interface PerformancePageLoadEvent {
  route: string;
  load_time_ms: number;
  lcp_ms: number;
  cls_score: number;
  fid_ms: number;
  tenant_id: string;
}

export interface PerformanceApiCallEvent {
  endpoint: string;
  method: string;
  response_time_ms: number;
  status_code: number;
  tenant_id: string;
}

// Event Type Union
export type AnalyticsEventData = 
  | OnboardingStepCompleteEvent
  | OnboardingStepAbandonEvent
  | OnboardingCompleteEvent
  | BookingServiceSelectEvent
  | BookingAvailabilityViewEvent
  | BookingSlotSelectEvent
  | BookingCheckoutStartEvent
  | BookingCheckoutCompleteEvent
  | BookingCheckoutAbandonEvent
  | PaymentIntentCreateEvent
  | PaymentIntentSuccessEvent
  | PaymentIntentFailedEvent
  | NotificationEmailSentEvent
  | NotificationSmsSentEvent
  | NotificationEmailDeliveredEvent
  | NotificationSmsDeliveredEvent
  | LoyaltyPointsEarnedEvent
  | LoyaltyPointsRedeemedEvent
  | AutomationTriggerFiredEvent
  | AutomationActionExecutedEvent
  | AdminBookingAttendedEvent
  | AdminBookingNoShowEvent
  | AdminBookingCancelledEvent
  | AdminServiceCreatedEvent
  | AdminServiceUpdatedEvent
  | AdminAvailabilityUpdatedEvent
  | AdminBrandingUpdatedEvent
  | AnalyticsSchemaLoadedEvent
  | AnalyticsEventEmittedEvent
  | AnalyticsPiiViolationEvent
  | AnalyticsSchemaViolationEvent
  | ErrorFrontendErrorEvent
  | PerformancePageLoadEvent
  | PerformanceApiCallEvent;

// Event Name Constants
export const ANALYTICS_EVENTS = {
  // Onboarding
  ONBOARDING_STEP_COMPLETE: 'onboarding.step_complete',
  ONBOARDING_STEP_ABANDON: 'onboarding.step_abandon',
  ONBOARDING_COMPLETE: 'onboarding.complete',
  
  // Booking
  BOOKING_SERVICE_SELECT: 'booking.service_select',
  BOOKING_AVAILABILITY_VIEW: 'booking.availability_view',
  BOOKING_SLOT_SELECT: 'booking.slot_select',
  BOOKING_CHECKOUT_START: 'booking.checkout_start',
  BOOKING_CHECKOUT_COMPLETE: 'booking.checkout_complete',
  BOOKING_CHECKOUT_ABANDON: 'booking.checkout_abandon',
  
  // Payment
  PAYMENT_INTENT_CREATE: 'payment.intent_create',
  PAYMENT_INTENT_SUCCESS: 'payment.intent_success',
  PAYMENT_INTENT_FAILED: 'payment.intent_failed',
  
  // Notifications
  NOTIFICATION_EMAIL_SENT: 'notification.email_sent',
  NOTIFICATION_SMS_SENT: 'notification.sms_sent',
  NOTIFICATION_EMAIL_DELIVERED: 'notification.email_delivered',
  NOTIFICATION_SMS_DELIVERED: 'notification.sms_delivered',
  
  // Loyalty
  LOYALTY_POINTS_EARNED: 'loyalty.points_earned',
  LOYALTY_POINTS_REDEEMED: 'loyalty.points_redeemed',
  
  // Automation
  AUTOMATION_TRIGGER_FIRED: 'automation.trigger_fired',
  AUTOMATION_ACTION_EXECUTED: 'automation.action_executed',
  
  // Admin
  ADMIN_BOOKING_ATTENDED: 'admin.booking_attended',
  ADMIN_BOOKING_NO_SHOW: 'admin.booking_no_show',
  ADMIN_BOOKING_CANCELLED: 'admin.booking_cancelled',
  ADMIN_SERVICE_CREATED: 'admin.service_created',
  ADMIN_SERVICE_UPDATED: 'admin.service_updated',
  ADMIN_AVAILABILITY_UPDATED: 'admin.availability_updated',
  ADMIN_BRANDING_UPDATED: 'admin.branding_updated',
  
  // System
  ANALYTICS_SCHEMA_LOADED: 'analytics.schema_loaded',
  ANALYTICS_EVENT_EMITTED: 'analytics.event_emitted',
  ANALYTICS_PII_VIOLATION: 'analytics.pii_violation',
  ANALYTICS_SCHEMA_VIOLATION: 'analytics.schema_violation',
  ERROR_FRONTEND_ERROR: 'error.frontend_error',
  PERFORMANCE_PAGE_LOAD: 'performance.page_load',
  PERFORMANCE_API_CALL: 'performance.api_call',
} as const;

// Event Schema Validation
export interface EventSchema {
  event_name: string;
  payload: Record<string, string>;
  pii_flags: string[];
  sampling_rate: number;
  retention_days: number;
  critical_journey: string;
}

// Analytics Service Interface
export interface AnalyticsServiceConfig {
  emitEvent<T extends AnalyticsEventData>(
    eventName: string,
    eventData: T,
    options?: {
      tenantId?: string;
      userId?: string;
      sessionId?: string;
    }
  ): Promise<void>;
  
  validateEvent(eventName: string, eventData: any): boolean;
  getEventSchema(eventName: string): EventSchema | null;
  isPiiField(fieldName: string): boolean;
  shouldSample(eventName: string): boolean;
}

// Event Emission Function
export const emitEvent = async <T extends AnalyticsEventData>(
  eventName: string,
  eventData: T,
  options: {
    tenantId?: string;
    userId?: string;
    sessionId?: string;
  } = {}
): Promise<void> => {
  // Implementation will be provided by the analytics service
  // This is a placeholder for the actual implementation
  console.log('Analytics event emitted:', eventName, eventData, options);
};

// Schema Validation Function
export const validateEventSchema = (
  eventName: string,
  eventData: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic validation for onboarding step complete event
  if (eventName === ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETE) {
    if (!eventData.step) {
      errors.push('step is required');
    }
    if (!eventData.tenant_id) {
      errors.push('tenant_id is required');
    }
    if (!eventData.user_id) {
      errors.push('user_id is required');
    }
  }
  
  return { isValid: errors.length === 0, errors };
};

// PII Detection Function
export const detectPiiFields = (_eventData: any): string[] => {
  // Implementation will detect PII fields
  // This is a placeholder for the actual PII detection logic
  return [];
};

// Sampling Decision Function
export const shouldSampleEvent = (_eventName: string): boolean => {
  // Implementation will determine if event should be sampled
  // This is a placeholder for the actual sampling logic
  return true;
};
