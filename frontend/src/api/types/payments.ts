/**
 * Payment API Types
 * 
 * Type definitions for payment-related API endpoints and data structures.
 * These types align with the backend payment models and Stripe integration.
 */

// ===== PAYMENT SETUP DATA TYPES =====

export interface PaymentSetupData {
  id?: string;
  tenant_id: string;
  setup_intent_id: string;
  subscription_card_id: string;
  wallets: WalletConfig;
  kyc_data: KYCData;
  is_live: boolean;
  go_live_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WalletConfig {
  cards: boolean;
  apple_pay: boolean;
  google_pay: boolean;
  paypal: boolean;
  cash: boolean;
  cash_requires_card: boolean;
}

export interface KYCData {
  id?: string;
  tenant_id: string;
  legal_name: string;
  dba_name?: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string;
  business_type: string;
  tax_id?: string;
  address: KYCAddress;
  payout_destination: PayoutDestination;
  statement_descriptor: string;
  tax_display: 'inclusive' | 'exclusive';
  currency: string;
  created_at?: string;
  updated_at?: string;
}

export interface KYCAddress {
  street: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
}

export interface PayoutDestination {
  type: 'bank_account' | 'card';
  account_holder_name: string;
  account_holder_type: 'individual' | 'company';
  routing_number?: string;
  account_number?: string;
  card_number?: string;
  expiry_month?: number;
  expiry_year?: number;
}

export interface GoLiveData {
  tenant_id: string;
  business_name: string;
  booking_url: string;
  admin_url: string;
  go_live_date: string;
  is_live: boolean;
}

// ===== STRIPE INTEGRATION TYPES =====

export interface StripeSetupIntent {
  id: string;
  client_secret: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  payment_method?: string;
  created: number;
}

export interface StripePaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

// ===== API REQUEST/RESPONSE TYPES =====

export interface CreatePaymentSetupRequest {
  tenant_id: string;
  subscription_amount_cents: number;
  currency: string;
}

export interface CreatePaymentSetupResponse {
  setup_intent: StripeSetupIntent;
  client_secret: string;
}

export interface UpdateWalletConfigRequest {
  wallets: WalletConfig;
}

export interface CreateKYCRequest {
  legal_name: string;
  dba_name?: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string;
  business_type: string;
  tax_id?: string;
  address: KYCAddress;
  payout_destination: PayoutDestination;
  statement_descriptor: string;
  tax_display: 'inclusive' | 'exclusive';
  currency: string;
}

export interface UpdateKYCRequest {
  legal_name?: string;
  dba_name?: string;
  representative_name?: string;
  representative_email?: string;
  representative_phone?: string;
  business_type?: string;
  tax_id?: string;
  address?: KYCAddress;
  payout_destination?: PayoutDestination;
  statement_descriptor?: string;
  tax_display?: 'inclusive' | 'exclusive';
  currency?: string;
}

export interface GoLiveRequest {
  consent_terms: boolean;
  consent_privacy: boolean;
  consent_subscription: boolean;
  confirm_go_live: boolean;
}

export interface GoLiveResponse {
  success: boolean;
  business_name: string;
  booking_url: string;
  admin_url: string;
  go_live_date: string;
}

// ===== FORM DATA TYPES =====

export interface PaymentSetupFormData {
  subscription_consent: boolean;
  terms_consent: boolean;
  privacy_consent: boolean;
}

export interface WalletConfigFormData {
  cards: boolean;
  apple_pay: boolean;
  google_pay: boolean;
  paypal: boolean;
  cash: boolean;
}

export interface KYCFormData {
  legal_name: string;
  dba_name: string;
  representative_name: string;
  representative_email: string;
  representative_phone: string;
  business_type: string;
  tax_id: string;
  address: KYCAddress;
  payout_destination: PayoutDestination;
  statement_descriptor: string;
  tax_display: 'inclusive' | 'exclusive';
  currency: string;
}

export interface GoLiveFormData {
  consent_terms: boolean;
  consent_privacy: boolean;
  consent_subscription: boolean;
  confirm_go_live: boolean;
}

// ===== VALIDATION TYPES =====

export interface PaymentValidationErrors {
  subscription_consent?: string;
  terms_consent?: string;
  privacy_consent?: string;
}

export interface WalletValidationErrors {
  cards?: string;
  apple_pay?: string;
  google_pay?: string;
  paypal?: string;
  cash?: string;
}

export interface KYCValidationErrors {
  legal_name?: string;
  dba_name?: string;
  representative_name?: string;
  representative_email?: string;
  representative_phone?: string;
  business_type?: string;
  tax_id?: string;
  address?: {
    street?: string;
    city?: string;
    state_province?: string;
    postal_code?: string;
    country?: string;
  };
  payout_destination?: {
    type?: string;
    account_holder_name?: string;
    account_holder_type?: string;
    routing_number?: string;
    account_number?: string;
    card_number?: string;
    expiry_month?: string;
    expiry_year?: string;
  };
  statement_descriptor?: string;
  tax_display?: string;
  currency?: string;
}

export interface GoLiveValidationErrors {
  consent_terms?: string;
  consent_privacy?: string;
  consent_subscription?: string;
  confirm_go_live?: string;
}

// ===== CONSTANTS =====

export const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llc', label: 'Limited Liability Company (LLC)' },
  { value: 'corporation', label: 'Corporation' },
  { value: 's_corporation', label: 'S Corporation' },
  { value: 'nonprofit', label: 'Nonprofit Organization' },
  { value: 'other', label: 'Other' },
] as const;

export const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'CAD', label: 'Canadian Dollar (C$)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'AUD', label: 'Australian Dollar (A$)' },
] as const;

export const TAX_DISPLAY_OPTIONS = [
  { value: 'inclusive', label: 'Tax included in prices' },
  { value: 'exclusive', label: 'Tax added at checkout' },
] as const;

export const PAYOUT_DESTINATION_TYPES = [
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'card', label: 'Debit Card' },
] as const;

export const ACCOUNT_HOLDER_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
] as const;

// ===== SUBSCRIPTION CONSTANTS =====

export const SUBSCRIPTION_AMOUNT_CENTS = 1199; // $11.99
export const SUBSCRIPTION_CURRENCY = 'USD';

// ===== UTILITY FUNCTIONS =====

export const formatCurrency = (amountCents: number, currency: string = 'USD'): string => {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const validateStatementDescriptor = (descriptor: string): boolean => {
  // Stripe statement descriptor requirements
  return descriptor.length >= 5 && descriptor.length <= 22 && /^[a-zA-Z0-9\s]*$/.test(descriptor);
};

export const validateTaxId = (taxId: string): boolean => {
  // Basic validation for US tax ID (EIN or SSN format)
  const cleaned = taxId.replace(/[^0-9]/g, '');
  return cleaned.length === 9;
};

export const validateRoutingNumber = (routingNumber: string): boolean => {
  const cleaned = routingNumber.replace(/[^0-9]/g, '');
  return cleaned.length === 9;
};

export const validateAccountNumber = (accountNumber: string): boolean => {
  const cleaned = accountNumber.replace(/[^0-9]/g, '');
  return cleaned.length >= 4 && cleaned.length <= 17;
};

