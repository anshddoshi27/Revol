/**
 * useGiftCardSetup Hook
 * 
 * Custom hook for managing gift card configuration during onboarding.
 * Handles gift card setup, denomination management, and form validation.
 */

import { useState, useCallback, useEffect } from 'react';
import { useGiftCardConfig, useDenominationManagement } from './useGiftCardManagement';
import { telemetry } from '../services/telemetry';
import type {
  GiftCardConfig,
  GiftCardFormData,
  Denomination,
  GiftCardValidationErrors,
} from '../api/types/giftCards';

interface UseGiftCardSetupOptions {
  onConfigCreated?: (config: GiftCardConfig) => void;
  onConfigUpdated?: (config: GiftCardConfig) => void;
  onError?: (error: Error) => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

interface UseGiftCardSetupReturn {
  // Configuration state
  config: GiftCardConfig | null;
  isEnabled: boolean;
  denominations: Denomination[];
  expirationPolicy: string;
  
  // Loading states
  isLoading: boolean;
  isSubmitting: boolean;
  isSaving: boolean;
  
  // Error states
  errors: GiftCardValidationErrors;
  validationErrors: string[];
  
  // Actions
  setEnabled: (enabled: boolean) => void;
  setExpirationPolicy: (policy: string) => void;
  addDenomination: (amountCents: number) => Promise<boolean>;
  updateDenomination: (id: string, amountCents: number) => Promise<boolean>;
  removeDenomination: (id: string) => Promise<boolean>;
  saveConfig: () => Promise<boolean>;
  skipGiftCards: () => Promise<boolean>;
  clearErrors: () => void;
  
  // Validation
  isValid: boolean;
  canProceed: boolean;
}

export const useGiftCardSetup = (options: UseGiftCardSetupOptions = {}): UseGiftCardSetupReturn => {
  const {
    onConfigCreated,
    onConfigUpdated,
    onError,
    autoSave = false,
    autoSaveDelay = 2000,
  } = options;

  // Gift card configuration hook
  const {
    config,
    isLoading: isConfigLoading,
    isSubmitting: isConfigSubmitting,
    errors: configErrors,
    createOrUpdateConfig,
    loadConfig,
    clearErrors: clearConfigErrors,
  } = useGiftCardConfig({
    onConfigCreated,
    onConfigUpdated,
    onError,
  });

  // Denomination management hook
  const {
    denominations,
    isLoading: isDenominationsLoading,
    isSubmitting: isDenominationsSubmitting,
    errors: denominationErrors,
    addDenomination: addDenominationAction,
    updateDenomination: updateDenominationAction,
    removeDenomination: removeDenominationAction,
    loadDenominations,
    clearErrors: clearDenominationErrors,
  } = useDenominationManagement({
    onError,
  });

  // Local state
  const [isEnabled, setIsEnabled] = useState(false);
  const [expirationPolicy, setExpirationPolicy] = useState('1 year from purchase');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing configuration on mount
  useEffect(() => {
    loadConfig();
    loadDenominations();
  }, [loadConfig, loadDenominations]);

  // Update local state when config loads
  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled);
      setExpirationPolicy(config.expiration_policy);
    }
  }, [config]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !config) return;

    const timeoutId = setTimeout(() => {
      if (isEnabled && denominations.length > 0) {
        saveConfig();
      }
    }, autoSaveDelay);

    return () => clearTimeout(timeoutId);
  }, [autoSave, autoSaveDelay, isEnabled, denominations, config]);

  // Validation
  const validateConfig = useCallback((): boolean => {
    const errors: string[] = [];

    if (isEnabled) {
      if (denominations.length === 0) {
        errors.push('At least one denomination is required when gift cards are enabled');
      }

      if (!expirationPolicy) {
        errors.push('Expiration policy is required');
      }

      // Validate denominations
      denominations.forEach((denomination, index) => {
        if (denomination.amount_cents <= 0) {
          errors.push(`Denomination ${index + 1}: Amount must be greater than $0`);
        }
        if (denomination.amount_cents < 500) {
          errors.push(`Denomination ${index + 1}: Minimum amount is $5.00`);
        }
        if (denomination.amount_cents > 100000) {
          errors.push(`Denomination ${index + 1}: Maximum amount is $1,000.00`);
        }
      });
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [isEnabled, denominations, expirationPolicy]);

  // Actions
  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    
    // Track analytics
    telemetry.track('giftcards.enable', {
      enabled,
      tenant_id: config?.tenant_id,
    });
  }, [config?.tenant_id]);

  const addDenomination = useCallback(async (amountCents: number): Promise<boolean> => {
    try {
      const result = await addDenominationAction(amountCents);
      if (result) {
        telemetry.track('giftcards.denomination_create', {
          amount_cents: amountCents,
          tenant_id: config?.tenant_id,
        });
      }
      return result;
    } catch (error) {
      onError?.(error as Error);
      return false;
    }
  }, [addDenominationAction, config?.tenant_id, onError]);

  const updateDenomination = useCallback(async (id: string, amountCents: number): Promise<boolean> => {
    try {
      const result = await updateDenominationAction(id, amountCents);
      if (result) {
        telemetry.track('giftcards.denomination_update', {
          denomination_id: id,
          amount_cents: amountCents,
          tenant_id: config?.tenant_id,
        });
      }
      return result;
    } catch (error) {
      onError?.(error as Error);
      return false;
    }
  }, [updateDenominationAction, config?.tenant_id, onError]);

  const removeDenomination = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await removeDenominationAction(id);
      if (result) {
        telemetry.track('giftcards.denomination_delete', {
          denomination_id: id,
          tenant_id: config?.tenant_id,
        });
      }
      return result;
    } catch (error) {
      onError?.(error as Error);
      return false;
    }
  }, [removeDenominationAction, config?.tenant_id, onError]);

  const saveConfig = useCallback(async (): Promise<boolean> => {
    if (!validateConfig()) {
      return false;
    }

    try {
      setIsSaving(true);
      
      const formData: GiftCardFormData = {
        is_enabled: isEnabled,
        denominations: denominations.map(d => ({
          amount_cents: d.amount_cents,
          is_active: d.is_active,
        })),
        expiration_policy: expirationPolicy,
      };

      const result = await createOrUpdateConfig(formData);
      
      if (result) {
        telemetry.track('giftcards.config_save', {
          is_enabled: isEnabled,
          denominations_count: denominations.length,
          expiration_policy: expirationPolicy,
          tenant_id: config?.tenant_id,
        });
      }
      
      return result;
    } catch (error) {
      onError?.(error as Error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [validateConfig, isEnabled, denominations, expirationPolicy, createOrUpdateConfig, config?.tenant_id, onError]);

  const skipGiftCards = useCallback(async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      
      const formData: GiftCardFormData = {
        is_enabled: false,
        denominations: [],
        expiration_policy: '1 year from purchase',
      };

      const result = await createOrUpdateConfig(formData);
      
      if (result) {
        telemetry.track('giftcards.skip', {
          tenant_id: config?.tenant_id,
        });
      }
      
      return result;
    } catch (error) {
      onError?.(error as Error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [createOrUpdateConfig, config?.tenant_id, onError]);

  const clearErrors = useCallback(() => {
    clearConfigErrors();
    clearDenominationErrors();
    setValidationErrors([]);
  }, [clearConfigErrors, clearDenominationErrors]);

  // Computed values
  const isLoading = isConfigLoading || isDenominationsLoading;
  const isSubmitting = isConfigSubmitting || isDenominationsSubmitting || isSaving;
  const errors = { ...configErrors, ...denominationErrors };
  const isValid = validateConfig();
  const canProceed = !isEnabled || (isEnabled && denominations.length > 0 && isValid);

  return {
    // Configuration state
    config,
    isEnabled,
    denominations,
    expirationPolicy,
    
    // Loading states
    isLoading,
    isSubmitting,
    isSaving,
    
    // Error states
    errors,
    validationErrors,
    
    // Actions
    setEnabled,
    setExpirationPolicy,
    addDenomination,
    updateDenomination,
    removeDenomination,
    saveConfig,
    skipGiftCards,
    clearErrors,
    
    // Validation
    isValid,
    canProceed,
  };
};

