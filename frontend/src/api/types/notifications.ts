/**
 * Notification API Types
 * 
 * Type definitions for notification-related API endpoints and data structures.
 * These types align with the backend notification models and API contracts.
 */

// ===== NOTIFICATION TEMPLATE TYPES =====

export interface NotificationTemplate {
  id?: string;
  tenant_id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables: Record<string, any>;
  required_variables: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlaceholderData {
  customer_name: string;
  service_name: string;
  service_duration: string;
  price: string;
  booking_date: string;
  booking_time: string;
  business_name: string;
  address: string;
  staff_name: string;
  instructions: string;
  special_requests: string;
  cancel_policy: string;
  refund_policy: string;
  booking_link: string;
  ics_link: string;
}

export interface QuietHoursConfig {
  enabled: boolean;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  timezone: string;
}

export interface NotificationTemplateFormData {
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  required_variables: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
}

// ===== API REQUEST/RESPONSE TYPES =====

export interface CreateNotificationTemplateRequest {
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  required_variables: string[];
  trigger_event?: string;
  category?: string;
  is_active?: boolean;
}

export interface UpdateNotificationTemplateRequest {
  name?: string;
  channel?: 'email' | 'sms' | 'push';
  subject?: string;
  content?: string;
  required_variables?: string[];
  trigger_event?: string;
  category?: string;
  is_active?: boolean;
}

export interface NotificationTemplateResponse {
  id: string;
  tenant_id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string;
  content: string;
  variables: Record<string, any>;
  required_variables: string[];
  trigger_event?: string;
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplatesListResponse {
  templates: NotificationTemplateResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface PreviewNotificationRequest {
  template_id: string;
  sample_data: PlaceholderData;
}

export interface PreviewNotificationResponse {
  rendered_content: string;
  rendered_subject?: string;
  preview_sent: boolean;
}

export interface UpdateQuietHoursRequest {
  enabled: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
}

export interface UpdateQuietHoursResponse {
  enabled: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
  updated_at: string;
}

// ===== VALIDATION TYPES =====

export interface NotificationValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PlaceholderValidationResult {
  isValid: boolean;
  missingPlaceholders: string[];
  invalidPlaceholders: string[];
  errors: NotificationValidationError[];
}

// ===== CONSTANTS =====

export const NOTIFICATION_CHANNELS = ['email', 'sms', 'push'] as const;

export const NOTIFICATION_CATEGORIES = [
  'confirmation',
  'reminder',
  'follow_up',
  'cancellation',
  'reschedule',
] as const;

export const NOTIFICATION_TRIGGER_EVENTS = [
  'booking_created',
  'booking_confirmed',
  'booking_reminder_24h',
  'booking_reminder_1h',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_completed',
] as const;

export const AVAILABLE_PLACEHOLDERS = [
  'customer_name',
  'service_name',
  'service_duration',
  'price',
  'booking_date',
  'booking_time',
  'business_name',
  'address',
  'staff_name',
  'instructions',
  'special_requests',
  'cancel_policy',
  'refund_policy',
  'booking_link',
  'ics_link',
] as const;

export const TEMPLATE_LIMITS = {
  MAX_TEMPLATES: 3,
  MAX_CONFIRMATION_TEMPLATES: 1,
  MAX_REMINDER_TEMPLATES: 2,
} as const;

// ===== SAMPLE DATA =====

export const SAMPLE_PLACEHOLDER_DATA: PlaceholderData = {
  customer_name: 'John Doe',
  service_name: 'Haircut & Style',
  service_duration: '60 minutes',
  price: '$75.00',
  booking_date: 'March 15, 2024',
  booking_time: '2:00 PM',
  business_name: 'Bella Salon',
  address: '123 Main St, New York, NY 10001',
  staff_name: 'Sarah Johnson',
  instructions: 'Please arrive 10 minutes early. Bring a photo of your desired style.',
  special_requests: 'Trim beard, use organic products',
  cancel_policy: 'Cancel or reschedule at least 24 hours in advance to avoid charges.',
  refund_policy: 'Full refund if cancelled 24+ hours in advance. 50% refund if cancelled 2-24 hours in advance.',
  booking_link: 'https://bella-salon.tithi.app/booking/abc123',
  ics_link: 'https://bella-salon.tithi.app/booking/abc123/calendar',
};

// ===== UTILITY TYPES =====

export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];
export type NotificationTriggerEvent = typeof NOTIFICATION_TRIGGER_EVENTS[number];
export type PlaceholderKey = typeof AVAILABLE_PLACEHOLDERS[number];
