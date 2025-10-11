/**
 * Policies API Types
 * 
 * Type definitions for booking policies, confirmation messages, and checkout warnings.
 * These types align with the backend policies blueprint.
 */

// ===== BOOKING POLICY TYPES =====

export interface BookingPolicy {
  id?: string;
  tenant_id: string;
  cancellation_cutoff_hours: number;
  no_show_fee_percent: number;
  no_show_fee_flat_cents?: number;
  refund_policy: string;
  cash_logistics: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BookingPolicyFormData {
  cancellation_cutoff_hours: number;
  no_show_fee_percent: number;
  no_show_fee_flat_cents?: number;
  refund_policy: string;
  cash_logistics: string;
  is_active: boolean;
}

export interface CreateBookingPolicyRequest {
  cancellation_cutoff_hours: number;
  no_show_fee_percent: number;
  no_show_fee_flat_cents?: number;
  refund_policy: string;
  cash_logistics: string;
  is_active: boolean;
}

export interface UpdateBookingPolicyRequest {
  cancellation_cutoff_hours?: number;
  no_show_fee_percent?: number;
  no_show_fee_flat_cents?: number;
  refund_policy?: string;
  cash_logistics?: string;
  is_active?: boolean;
}

export interface BookingPolicyResponse {
  id: string;
  tenant_id: string;
  cancellation_cutoff_hours: number;
  no_show_fee_percent: number;
  no_show_fee_flat_cents?: number;
  refund_policy: string;
  cash_logistics: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== CONFIRMATION MESSAGE TYPES =====

export interface ConfirmationMessage {
  id?: string;
  tenant_id: string;
  content: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ConfirmationMessageFormData {
  content: string;
  is_active: boolean;
}

export interface CreateConfirmationMessageRequest {
  content: string;
  is_active: boolean;
}

export interface UpdateConfirmationMessageRequest {
  content?: string;
  is_active?: boolean;
}

export interface ConfirmationMessageResponse {
  id: string;
  tenant_id: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== CHECKOUT WARNING TYPES =====

export interface CheckoutWarning {
  id?: string;
  tenant_id: string;
  title: string;
  message: string;
  acknowledgment_required: boolean;
  acknowledgment_text: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CheckoutWarningFormData {
  title: string;
  message: string;
  acknowledgment_required: boolean;
  acknowledgment_text: string;
  is_active: boolean;
}

export interface CreateCheckoutWarningRequest {
  title: string;
  message: string;
  acknowledgment_required: boolean;
  acknowledgment_text: string;
  is_active: boolean;
}

export interface UpdateCheckoutWarningRequest {
  title?: string;
  message?: string;
  acknowledgment_required?: boolean;
  acknowledgment_text?: string;
  is_active?: boolean;
}

export interface CheckoutWarningResponse {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  acknowledgment_required: boolean;
  acknowledgment_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== VALIDATION TYPES =====

export interface BookingPolicyValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ConfirmationMessageValidationError {
  field: string;
  message: string;
  code: string;
}

export interface CheckoutWarningValidationError {
  field: string;
  message: string;
  code: string;
}

// ===== QUICK PASTE TYPES =====

export interface QuickPasteOption {
  id: string;
  label: string;
  value: string;
  description?: string;
  category: 'service' | 'time' | 'price' | 'contact' | 'business';
}

export interface ServiceDetails {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  instructions?: string;
}

export interface AvailabilityDetails {
  date: string;
  time: string;
  timezone: string;
  duration_minutes: number;
}

export interface BusinessDetails {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

// ===== POLICY TEMPLATES =====

export interface PolicyTemplate {
  id: string;
  name: string;
  category: 'cancellation' | 'no_show' | 'refund' | 'cash';
  template: string;
  variables: string[];
  description: string;
}

export const DEFAULT_POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'cancellation_24h',
    name: '24-Hour Cancellation',
    category: 'cancellation',
    template: 'Cancellations must be made at least 24 hours in advance. Late cancellations may be subject to a fee.',
    variables: ['hours'],
    description: 'Standard 24-hour cancellation policy',
  },
  {
    id: 'no_show_50_percent',
    name: '50% No-Show Fee',
    category: 'no_show',
    template: 'No-shows will be charged 50% of the service fee. Please arrive on time for your appointment.',
    variables: ['fee_percent'],
    description: '50% fee for no-shows',
  },
  {
    id: 'refund_attendance',
    name: 'Attendance-Based Refunds',
    category: 'refund',
    template: 'Refunds are only available for services not yet performed. Once service begins, no refunds will be issued.',
    variables: [],
    description: 'Refunds only before service begins',
  },
  {
    id: 'cash_payment',
    name: 'Cash Payment Policy',
    category: 'cash',
    template: 'Cash payments are accepted. Please bring exact change. Credit card on file required for no-show protection.',
    variables: [],
    description: 'Cash payment with card backup',
  },
];

// ===== CONFIRMATION MESSAGE TEMPLATES =====

export const DEFAULT_CONFIRMATION_TEMPLATES = [
  {
    id: 'standard_confirmation',
    name: 'Standard Confirmation',
    template: `Thank you for booking with {business_name}!

Your appointment details:
• Service: {service_name}
• Date: {appointment_date}
• Time: {appointment_time}
• Duration: {service_duration}
• Total: {service_price}

Please arrive 10 minutes early for your appointment.

We look forward to seeing you!

Best regards,
{business_name}`,
    variables: ['business_name', 'service_name', 'appointment_date', 'appointment_time', 'service_duration', 'service_price'],
  },
  {
    id: 'detailed_confirmation',
    name: 'Detailed Confirmation',
    template: `Hello {customer_name},

Thank you for choosing {business_name} for your {service_name} appointment!

📅 Appointment Details:
• Date: {appointment_date}
• Time: {appointment_time} ({timezone})
• Duration: {service_duration}
• Service: {service_name}
• Price: {service_price}

📍 Location:
{business_address}

📞 Contact: {business_phone}

Please arrive 10-15 minutes early for your appointment. If you need to reschedule or cancel, please contact us at least 24 hours in advance.

We can't wait to see you!

Best regards,
{business_name}`,
    variables: ['customer_name', 'business_name', 'service_name', 'appointment_date', 'appointment_time', 'timezone', 'service_duration', 'service_price', 'business_address', 'business_phone'],
  },
];

// ===== CHECKOUT WARNING TEMPLATES =====

export const DEFAULT_CHECKOUT_WARNING_TEMPLATES = [
  {
    id: 'attendance_charging',
    name: 'Attendance-Based Charging',
    title: 'Payment Information',
    message: 'You will be charged after your appointment is completed and marked as attended. A credit card is required to secure your booking.',
    acknowledgment_text: 'I understand that I will be charged after my appointment is completed.',
    acknowledgment_required: true,
  },
  {
    id: 'cancellation_policy',
    name: 'Cancellation Policy',
    title: 'Cancellation Policy',
    message: 'Please review our cancellation policy. Cancellations made less than 24 hours in advance may be subject to a fee.',
    acknowledgment_text: 'I have read and agree to the cancellation policy.',
    acknowledgment_required: true,
  },
  {
    id: 'no_show_fee',
    name: 'No-Show Fee',
    title: 'No-Show Policy',
    message: 'No-shows will be charged 50% of the service fee. Please arrive on time for your appointment.',
    acknowledgment_text: 'I understand the no-show policy and fee.',
    acknowledgment_required: true,
  },
];


