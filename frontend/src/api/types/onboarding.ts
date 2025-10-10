/**
 * Onboarding API Types
 * 
 * Type definitions for onboarding-related API endpoints and data structures.
 * These types align with the backend onboarding blueprint.
 */

// ===== ONBOARDING REQUEST/RESPONSE TYPES =====

export interface OnboardingRegisterRequest {
  business_name: string;
  category?: string;
  logo?: string; // base64 or URL
  policies?: {
    cancellation_policy?: string;
    no_show_policy?: string;
    rescheduling_policy?: string;
    payment_policy?: string;
    refund_policy?: string;
  };
  owner_email: string;
  owner_name: string;
  timezone?: string; // default: UTC
  currency?: string; // default: USD
  locale?: string; // default: en_US
}

export interface OnboardingRegisterResponse {
  id: string;
  business_name: string;
  slug: string;
  subdomain: string;
  category?: string;
  logo?: string;
  timezone: string;
  currency: string;
  locale: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_existing: boolean;
}

export interface SubdomainCheckResponse {
  subdomain: string;
  available: boolean;
  suggested_url?: string;
}

// ===== BUSINESS DETAILS FORM TYPES =====

export interface AddressData {
  street?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
}

export interface StaffMember {
  id?: string;
  role: string;
  name: string;
  color: string; // auto-assigned color
}

export interface SocialLinksData {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  x?: string; // Twitter/X
  website?: string;
}

export interface BusinessDetailsFormData {
  name: string;
  description?: string;
  timezone: string;
  slug: string;
  dba?: string; // Doing Business As
  industry?: string;
  address?: AddressData;
  website?: string;
  phone?: string;
  support_email?: string;
  staff: StaffMember[];
  social_links: SocialLinksData;
}

// ===== VALIDATION TYPES =====

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ===== OBSERVABILITY TYPES =====

export interface OnboardingEvent {
  event_type: string;
  tenant_id?: string;
  step?: number;
  data?: Record<string, any>;
  timestamp: string;
}

// ===== STAFF COLOR ASSIGNMENT =====

export const STAFF_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
] as const;

export type StaffColor = typeof STAFF_COLORS[number];

// ===== TIMEZONE OPTIONS =====

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)', offset: 'UTC-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKST)', offset: 'UTC-9/-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)', offset: 'UTC+1/+2' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', offset: 'UTC+9' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)', offset: 'UTC+8' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AEST)', offset: 'UTC+10/+11' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', offset: 'UTC+0' },
];

// ===== INDUSTRY OPTIONS =====

export const INDUSTRY_OPTIONS = [
  'Beauty & Wellness',
  'Healthcare',
  'Fitness & Sports',
  'Education & Training',
  'Professional Services',
  'Entertainment',
  'Food & Beverage',
  'Retail',
  'Technology',
  'Other',
] as const;

export type IndustryOption = typeof INDUSTRY_OPTIONS[number];

// ===== LOGO & BRANDING TYPES =====

export interface LogoUploadData {
  file: File;
  cropped_data_url: string;
  placement_preview: {
    large_logo: string;
    small_logo: string;
  };
}

export interface ColorSelectionData {
  primary_color: string;
  contrast_ratio: number;
  passes_aa: boolean;
}

export interface ContrastValidationResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  level: 'AA' | 'AAA' | 'FAIL';
  recommendation?: string;
}

export interface BrandingData {
  logo?: LogoUploadData;
  primary_color: string;
  contrast_result?: ContrastValidationResult;
}
