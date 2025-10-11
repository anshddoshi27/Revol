/**
 * Gift Card API Types
 * 
 * Type definitions for gift card-related API endpoints and data structures.
 * These types align with the backend promotion/coupon models and API contracts.
 */

// ===== GIFT CARD DATA TYPES =====

export interface GiftCardConfig {
  id?: string;
  tenant_id: string;
  is_enabled: boolean;
  denominations: Denomination[];
  expiration_policy: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Denomination {
  id?: string;
  amount_cents: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GiftCardLifecycle {
  id?: string;
  tenant_id: string;
  denomination_id: string;
  code: string;
  initial_amount_cents: number;
  remaining_amount_cents: number;
  purchased_by?: string;
  purchased_at?: string;
  expires_at?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GiftCardFormData {
  is_enabled: boolean;
  denominations: DenominationFormData[];
  expiration_policy: string;
}

export interface DenominationFormData {
  amount_cents: number;
  is_active: boolean;
}

export interface GiftCardValidationRequest {
  code: string;
  amount_cents?: number;
}

export interface GiftCardValidationResponse {
  is_valid: boolean;
  remaining_amount_cents?: number;
  expires_at?: string;
  error_message?: string;
}

export interface GiftCardStats {
  total_issued: number;
  total_redeemed: number;
  total_value_cents: number;
  active_cards: number;
  expired_cards: number;
}

// ===== API REQUEST/RESPONSE TYPES =====

export interface CreateGiftCardConfigRequest {
  is_enabled: boolean;
  denominations: DenominationFormData[];
  expiration_policy: string;
}

export interface UpdateGiftCardConfigRequest {
  is_enabled?: boolean;
  denominations?: DenominationFormData[];
  expiration_policy?: string;
}

export interface CreateDenominationRequest {
  amount_cents: number;
  is_active?: boolean;
}

export interface UpdateDenominationRequest {
  amount_cents?: number;
  is_active?: boolean;
}

// ===== FORM VALIDATION TYPES =====

export interface GiftCardValidationErrors {
  is_enabled?: string;
  denominations?: string;
  expiration_policy?: string;
}

export interface DenominationValidationErrors {
  amount_cents?: string;
  is_active?: string;
}

// ===== COMMON DENOMINATIONS =====

export const COMMON_DENOMINATIONS = [
  { amount_cents: 2500, label: '$25' },
  { amount_cents: 5000, label: '$50' },
  { amount_cents: 10000, label: '$100' },
  { amount_cents: 15000, label: '$150' },
  { amount_cents: 25000, label: '$250' },
  { amount_cents: 50000, label: '$500' },
];

// ===== EXPIRATION POLICIES =====

export const EXPIRATION_POLICIES = [
  { value: '1 year from purchase', label: '1 year from purchase' },
  { value: '2 years from purchase', label: '2 years from purchase' },
  { value: '3 years from purchase', label: '3 years from purchase' },
  { value: 'Never expires', label: 'Never expires' },
];

// ===== UTILITY FUNCTIONS =====

export const formatAmount = (amountCents: number): string => {
  return `$${(amountCents / 100).toFixed(2)}`;
};

export const parseAmount = (amountString: string): number => {
  const cleaned = amountString.replace(/[^0-9.]/g, '');
  return Math.round(parseFloat(cleaned) * 100);
};

export const validateDenomination = (amountCents: number): string | null => {
  if (amountCents <= 0) {
    return 'Amount must be greater than $0';
  }
  if (amountCents < 500) {
    return 'Minimum amount is $5.00';
  }
  if (amountCents > 100000) {
    return 'Maximum amount is $1,000.00';
  }
  return null;
};


