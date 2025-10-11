/**
 * Service API Types
 * 
 * Type definitions for service-related API endpoints and data structures.
 * These types align with the backend service models and API contracts.
 */

// ===== SERVICE DATA TYPES =====

export interface ServiceData {
  id?: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  image_url?: string;
  special_requests_enabled: boolean;
  special_requests_limit?: number;
  quick_chips: string[];
  pre_appointment_instructions?: string;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryData {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChipsConfiguration {
  enabled: boolean;
  limit?: number;
  quick_chips: string[];
  allow_custom: boolean;
}

// ===== SERVICE API REQUEST/RESPONSE TYPES =====

export interface CreateServiceRequest {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  image_url?: string;
  special_requests_enabled: boolean;
  special_requests_limit?: number;
  quick_chips: string[];
  pre_appointment_instructions?: string;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  active?: boolean;
}

export interface UpdateServiceRequest extends Partial<CreateServiceRequest> {
  id: string;
}

export interface ServiceResponse {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category?: string;
  image_url?: string;
  special_requests_enabled: boolean;
  special_requests_limit?: number;
  quick_chips: string[];
  pre_appointment_instructions?: string;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {
  id: string;
}

export interface CategoryResponse {
  id: string;
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

// ===== SERVICE CATALOG TYPES =====

export interface ServiceCatalogData {
  categories: CategoryData[];
  services: ServiceData[];
  default_chips_config: ChipsConfiguration;
}

export interface ServiceCatalogResponse {
  categories: CategoryResponse[];
  services: ServiceResponse[];
  total_services: number;
  total_categories: number;
}

// ===== VALIDATION TYPES =====

export interface ServiceValidationError {
  field: keyof ServiceData;
  message: string;
  code: string;
}

export interface CategoryValidationError {
  field: keyof CategoryData;
  message: string;
  code: string;
}

// ===== IMAGE UPLOAD TYPES =====

export interface ServiceImageUploadData {
  file: File;
  service_id?: string;
  cropped_data_url?: string;
}

export interface ServiceImageUploadResponse {
  image_url: string;
  thumbnail_url: string;
  service_id: string;
}

// ===== FORM STATE TYPES =====

export interface ServiceFormData {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  category: string;
  image_url?: string;
  special_requests_enabled: boolean;
  special_requests_limit?: number;
  quick_chips: string[];
  pre_appointment_instructions?: string;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
}

export interface CategoryFormData {
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
}

// ===== CONSTANTS =====

export const DEFAULT_SERVICE_DURATION_MINUTES = 60;
export const DEFAULT_SERVICE_PRICE_CENTS = 5000; // $50.00
export const MAX_SERVICE_DURATION_HOURS = 8;
export const MIN_SERVICE_DURATION_MINUTES = 15;
export const MAX_SPECIAL_REQUESTS_LENGTH = 500;
export const MAX_QUICK_CHIPS = 10;

export const CATEGORY_COLORS = [
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

export type CategoryColor = typeof CATEGORY_COLORS[number];

// ===== COMMON QUICK CHIPS =====

export const COMMON_QUICK_CHIPS = [
  'Hair wash included',
  'Blow dry included',
  'Deep conditioning',
  'Hair treatment',
  'Scalp massage',
  'Eyebrow shaping',
  'Facial cleansing',
  'Moisturizing',
  'Exfoliation',
  'Massage therapy',
  'Hot stone therapy',
  'Aromatherapy',
  'Consultation included',
  'Follow-up care',
  'Take-home products',
] as const;

// ===== SERVICE VALIDATION RULES =====

export const SERVICE_VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 255,
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 1000,
  },
  duration_minutes: {
    required: true,
    min: MIN_SERVICE_DURATION_MINUTES,
    max: MAX_SERVICE_DURATION_HOURS * 60,
  },
  price_cents: {
    required: true,
    min: 0,
    max: 1000000, // $10,000 max
  },
  special_requests_limit: {
    min: 10,
    max: MAX_SPECIAL_REQUESTS_LENGTH,
  },
  quick_chips: {
    maxItems: MAX_QUICK_CHIPS,
    maxLength: 50,
  },
} as const;

export const CATEGORY_VALIDATION_RULES = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  description: {
    maxLength: 500,
  },
} as const;
