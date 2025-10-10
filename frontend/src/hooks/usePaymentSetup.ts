/**
 * usePaymentSetup Hook
 * 
 * Custom hook for managing payment setup state and operations.
 * Handles Stripe setup intent, wallet configuration, and payment validation.
 */

import { useState, useCallback, useMemo } from 'react';
import { paymentService } from '../api/services/payments';
import { telemetry } from '../services/telemetry';
import type {
  PaymentSetupData,
  WalletConfig,
  KYCData,
  GoLiveData,
  CreatePaymentSetupRequest,
  UpdateWalletConfigRequest,
  CreateKYCRequest,
  GoLiveRequest,
  StripeSetupIntent,
  PaymentSetupFormData,
  WalletConfigFormData,
  KYCFormData,
  GoLiveFormData,
} from '../api/types/payments';

interface UsePaymentSetupOptions {
  tenantId: string;
  onError?: (error: string) => void;
  onSuccess?: (data: any) => void;
}

interface UsePaymentSetupReturn {
  // State
  paymentSetup: PaymentSetupData | null;
  walletConfig: WalletConfig | null;
  kycData: KYCData | null;
  goLiveData: GoLiveData | null;
  isLoading: boolean;
  isSubmitting: boolean;
  errors: Record<string, string>;

  // Payment Setup
  createSetupIntent: () => Promise<StripeSetupIntent | null>;
  confirmSetupIntent: (setupIntentId: string, paymentMethodId: string) => Promise<boolean>;
  
  // Wallet Configuration
  updateWalletConfig: (config: WalletConfigFormData) => Promise<boolean>;
  
  // KYC Management
  createKYC: (data: KYCFormData) => Promise<boolean>;
  updateKYC: (data: Partial<KYCFormData>) => Promise<boolean>;
  
  // Go Live
  goLive: (data: GoLiveFormData) => Promise<boolean>;
  
  // Validation
  validatePaymentSetup: () => Promise<{
    is_complete: boolean;
    missing_fields: string[];
    can_go_live: boolean;
  }>;
  
  // Utilities
  clearErrors: () => void;
  reset: () => void;
}

export const usePaymentSetup = (options: UsePaymentSetupOptions): UsePaymentSetupReturn => {
  const { tenantId, onError, onSuccess } = options;

  // State
  const [paymentSetup, setPaymentSetup] = useState<PaymentSetupData | null>(null);
  const [walletConfig, setWalletConfig] = useState<WalletConfig | null>(null);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [goLiveData, setGoLiveData] = useState<GoLiveData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setPaymentSetup(null);
    setWalletConfig(null);
    setKycData(null);
    setGoLiveData(null);
    setErrors({});
  }, []);

  // Create Stripe setup intent
  const createSetupIntent = useCallback(async (): Promise<StripeSetupIntent | null> => {
    try {
      setIsLoading(true);
      clearErrors();

      // Emit analytics event
      telemetry.track('payments.setup_intent_started', {
        tenant_id: tenantId,
      });

      const request: CreatePaymentSetupRequest = {
        tenant_id: tenantId,
        subscription_amount_cents: 1199, // $11.99
        currency: 'USD',
      };

      const response = await paymentService.createSetupIntent(request);

      // Emit analytics event
      telemetry.track('payments.setup_intent_created', {
        tenant_id: tenantId,
        setup_intent_id: response.setup_intent.id,
        status: response.setup_intent.status,
      });

      return response.setup_intent;

    } catch (error: any) {
      console.error('Failed to create setup intent:', error);
      const errorMessage = error.message || 'Failed to create payment setup';
      setErrors({ setup_intent: errorMessage });
      onError?.(errorMessage);

      // Emit analytics event
      telemetry.track('payments.setup_intent_failed', {
        tenant_id: tenantId,
        error: errorMessage,
      });

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, onError, clearErrors]);

  // Confirm Stripe setup intent
  const confirmSetupIntent = useCallback(async (
    setupIntentId: string, 
    paymentMethodId: string
  ): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      const confirmedSetupIntent = await paymentService.confirmSetupIntent(setupIntentId, paymentMethodId);

      // Update payment setup data
      setPaymentSetup(prev => ({
        ...prev,
        setup_intent_id: confirmedSetupIntent.id,
        subscription_card_id: confirmedSetupIntent.payment_method || '',
        is_live: false,
      } as PaymentSetupData));

      // Emit analytics event
      telemetry.track('payments.setup_intent_succeeded', {
        tenant_id: tenantId,
        setup_intent_id: confirmedSetupIntent.id,
        status: confirmedSetupIntent.status,
      });

      onSuccess?.({ setup_intent: confirmedSetupIntent });
      return true;

    } catch (error: any) {
      console.error('Failed to confirm setup intent:', error);
      const errorMessage = error.message || 'Failed to confirm payment setup';
      setErrors({ setup_intent: errorMessage });
      onError?.(errorMessage);

      // Emit analytics event
      telemetry.track('payments.setup_intent_failed', {
        tenant_id: tenantId,
        error: errorMessage,
      });

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [tenantId, onError, onSuccess, clearErrors]);

  // Update wallet configuration
  const updateWalletConfig = useCallback(async (config: WalletConfigFormData): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      const walletConfig: WalletConfig = {
        ...config,
        cash_requires_card: config.cash && config.cards,
      };

      const request: UpdateWalletConfigRequest = { wallets: walletConfig };
      const updatedConfig = await paymentService.updateWalletConfig(tenantId, request);

      setWalletConfig(updatedConfig);

      // Emit analytics event
      telemetry.track('wallets.config_updated', {
        tenant_id: tenantId,
        wallets: updatedConfig,
      });

      onSuccess?.({ wallet_config: updatedConfig });
      return true;

    } catch (error: any) {
      console.error('Failed to update wallet config:', error);
      const errorMessage = error.message || 'Failed to update wallet configuration';
      setErrors({ wallet_config: errorMessage });
      onError?.(errorMessage);

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [tenantId, onError, onSuccess, clearErrors]);

  // Create KYC data
  const createKYC = useCallback(async (data: KYCFormData): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      const request: CreateKYCRequest = {
        legal_name: data.legal_name,
        dba_name: data.dba_name,
        representative_name: data.representative_name,
        representative_email: data.representative_email,
        representative_phone: data.representative_phone,
        business_type: data.business_type,
        tax_id: data.tax_id,
        address: data.address,
        payout_destination: data.payout_destination,
        statement_descriptor: data.statement_descriptor,
        tax_display: data.tax_display,
        currency: data.currency,
      };

      const createdKYC = await paymentService.createKYC(tenantId, request);
      setKycData(createdKYC);

      // Emit analytics event
      telemetry.track('kyc.created', {
        tenant_id: tenantId,
        business_type: data.business_type,
        has_tax_id: !!data.tax_id,
      });

      onSuccess?.({ kyc_data: createdKYC });
      return true;

    } catch (error: any) {
      console.error('Failed to create KYC:', error);
      const errorMessage = error.message || 'Failed to create business verification';
      setErrors({ kyc: errorMessage });
      onError?.(errorMessage);

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [tenantId, onError, onSuccess, clearErrors]);

  // Update KYC data
  const updateKYC = useCallback(async (data: Partial<KYCFormData>): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      const request: Partial<CreateKYCRequest> = {};
      if (data.legal_name) request.legal_name = data.legal_name;
      if (data.dba_name) request.dba_name = data.dba_name;
      if (data.representative_name) request.representative_name = data.representative_name;
      if (data.representative_email) request.representative_email = data.representative_email;
      if (data.representative_phone) request.representative_phone = data.representative_phone;
      if (data.business_type) request.business_type = data.business_type;
      if (data.tax_id) request.tax_id = data.tax_id;
      if (data.address) request.address = data.address;
      if (data.payout_destination) request.payout_destination = data.payout_destination;
      if (data.statement_descriptor) request.statement_descriptor = data.statement_descriptor;
      if (data.tax_display) request.tax_display = data.tax_display;
      if (data.currency) request.currency = data.currency;

      const updatedKYC = await paymentService.updateKYC(tenantId, request);
      setKycData(updatedKYC);

      // Emit analytics event
      telemetry.track('kyc.updated', {
        tenant_id: tenantId,
        updated_fields: Object.keys(data),
      });

      onSuccess?.({ kyc_data: updatedKYC });
      return true;

    } catch (error: any) {
      console.error('Failed to update KYC:', error);
      const errorMessage = error.message || 'Failed to update business verification';
      setErrors({ kyc: errorMessage });
      onError?.(errorMessage);

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [tenantId, onError, onSuccess, clearErrors]);

  // Go live
  const goLive = useCallback(async (data: GoLiveFormData): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      clearErrors();

      const request: GoLiveRequest = {
        consent_terms: data.consent_terms,
        consent_privacy: data.consent_privacy,
        consent_subscription: data.consent_subscription,
        confirm_go_live: data.confirm_go_live,
      };

      const response = await paymentService.goLive(tenantId, request);

      const goLiveData: GoLiveData = {
        tenant_id: tenantId,
        business_name: response.business_name,
        booking_url: response.booking_url,
        admin_url: response.admin_url,
        go_live_date: response.go_live_date,
        is_live: true,
      };

      setGoLiveData(goLiveData);

      // Emit analytics event
      telemetry.track('owner.go_live_success', {
        tenant_id: tenantId,
        business_name: response.business_name,
        booking_url: response.booking_url,
        go_live_date: response.go_live_date,
      });

      onSuccess?.({ go_live_data: goLiveData });
      return true;

    } catch (error: any) {
      console.error('Failed to go live:', error);
      const errorMessage = error.message || 'Failed to go live';
      setErrors({ go_live: errorMessage });
      onError?.(errorMessage);

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [tenantId, onError, onSuccess, clearErrors]);

  // Validate payment setup
  const validatePaymentSetup = useCallback(async () => {
    try {
      setIsLoading(true);
      clearErrors();

      const validation = await paymentService.validatePaymentSetup(tenantId);

      // Emit analytics event
      telemetry.track('payments.validation_completed', {
        tenant_id: tenantId,
        is_complete: validation.is_complete,
        can_go_live: validation.can_go_live,
        missing_fields: validation.missing_fields,
      });

      return validation;

    } catch (error: any) {
      console.error('Failed to validate payment setup:', error);
      const errorMessage = error.message || 'Failed to validate payment setup';
      setErrors({ validation: errorMessage });
      onError?.(errorMessage);

      return {
        is_complete: false,
        missing_fields: [],
        can_go_live: false,
      };
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, onError, clearErrors]);

  // Computed values
  const isPaymentSetupComplete = useMemo(() => {
    return !!(
      paymentSetup?.setup_intent_id &&
      paymentSetup?.subscription_card_id &&
      walletConfig &&
      kycData
    );
  }, [paymentSetup, walletConfig, kycData]);

  const canGoLive = useMemo(() => {
    return isPaymentSetupComplete && !goLiveData?.is_live;
  }, [isPaymentSetupComplete, goLiveData]);

  return {
    // State
    paymentSetup,
    walletConfig,
    kycData,
    goLiveData,
    isLoading,
    isSubmitting,
    errors,

    // Payment Setup
    createSetupIntent,
    confirmSetupIntent,
    
    // Wallet Configuration
    updateWalletConfig,
    
    // KYC Management
    createKYC,
    updateKYC,
    
    // Go Live
    goLive,
    
    // Validation
    validatePaymentSetup,
    
    // Utilities
    clearErrors,
    reset,
  };
};

