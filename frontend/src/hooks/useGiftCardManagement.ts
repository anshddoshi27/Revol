/**
 * useGiftCardManagement Hooks
 * 
 * Custom hooks for managing gift card configuration and denominations.
 * These hooks handle API calls and state management for gift card features.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getGiftCardConfig,
  createOrUpdateGiftCardConfig,
  updateGiftCardConfig,
  deleteGiftCardConfig,
  getDenominations,
  createDenomination,
  updateDenomination,
  deleteDenomination,
  createMultipleDenominations,
  updateMultipleDenominations,
  deleteMultipleDenominations,
} from '../api/services/giftCards';
import type {
  GiftCardConfig,
  Denomination,
  GiftCardFormData,
  DenominationFormData,
  GiftCardValidationErrors,
  DenominationValidationErrors,
} from '../api/types/giftCards';

// ===== GIFT CARD CONFIGURATION HOOK =====

interface UseGiftCardConfigOptions {
  onConfigCreated?: (config: GiftCardConfig) => void;
  onConfigUpdated?: (config: GiftCardConfig) => void;
  onError?: (error: Error) => void;
}

interface UseGiftCardConfigReturn {
  config: GiftCardConfig | null;
  isLoading: boolean;
  isSubmitting: boolean;
  errors: GiftCardValidationErrors;
  createOrUpdateConfig: (formData: GiftCardFormData) => Promise<boolean>;
  updateConfig: (id: string, formData: Partial<GiftCardFormData>) => Promise<boolean>;
  deleteConfig: (id: string) => Promise<boolean>;
  loadConfig: () => Promise<void>;
  clearErrors: () => void;
}

export const useGiftCardConfig = (options: UseGiftCardConfigOptions = {}): UseGiftCardConfigReturn => {
  const { onConfigCreated, onConfigUpdated, onError } = options;

  const [config, setConfig] = useState<GiftCardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<GiftCardValidationErrors>({});

  const loadConfig = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setErrors({});
      
      const configData = await getGiftCardConfig();
      setConfig(configData);
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const createOrUpdateConfig = useCallback(async (formData: GiftCardFormData): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const configData = await createOrUpdateGiftCardConfig(formData);
      setConfig(configData);

      if (config) {
        onConfigUpdated?.(configData);
      } else {
        onConfigCreated?.(configData);
      }

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [config, onConfigCreated, onConfigUpdated, onError]);

  const updateConfig = useCallback(async (id: string, formData: Partial<GiftCardFormData>): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const configData = await updateGiftCardConfig(id, formData);
      setConfig(configData);
      onConfigUpdated?.(configData);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onConfigUpdated, onError]);

  const deleteConfig = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      await deleteGiftCardConfig(id);
      setConfig(null);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onError]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    config,
    isLoading,
    isSubmitting,
    errors,
    createOrUpdateConfig,
    updateConfig,
    deleteConfig,
    loadConfig,
    clearErrors,
  };
};

// ===== DENOMINATION MANAGEMENT HOOK =====

interface UseDenominationManagementOptions {
  onDenominationCreated?: (denomination: Denomination) => void;
  onDenominationUpdated?: (denomination: Denomination) => void;
  onDenominationDeleted?: (id: string) => void;
  onError?: (error: Error) => void;
}

interface UseDenominationManagementReturn {
  denominations: Denomination[];
  isLoading: boolean;
  isSubmitting: boolean;
  errors: DenominationValidationErrors;
  addDenomination: (amountCents: number) => Promise<boolean>;
  updateDenomination: (id: string, amountCents: number) => Promise<boolean>;
  removeDenomination: (id: string) => Promise<boolean>;
  addMultipleDenominations: (amounts: number[]) => Promise<boolean>;
  updateMultipleDenominations: (updates: Array<{ id: string; amountCents: number }>) => Promise<boolean>;
  removeMultipleDenominations: (ids: string[]) => Promise<boolean>;
  loadDenominations: () => Promise<void>;
  clearErrors: () => void;
}

export const useDenominationManagement = (options: UseDenominationManagementOptions = {}): UseDenominationManagementReturn => {
  const { onDenominationCreated, onDenominationUpdated, onDenominationDeleted, onError } = options;

  const [denominations, setDenominations] = useState<Denomination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<DenominationValidationErrors>({});

  const loadDenominations = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setErrors({});
      
      const denominationsData = await getDenominations();
      setDenominations(denominationsData);
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const addDenomination = useCallback(async (amountCents: number): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const denomination = await createDenomination({ amount_cents: amountCents });
      setDenominations(prev => [...prev, denomination]);
      onDenominationCreated?.(denomination);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ amount_cents: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onDenominationCreated, onError]);

  const updateDenomination = useCallback(async (id: string, amountCents: number): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const denomination = await updateDenomination(id, { amount_cents: amountCents });
      setDenominations(prev => 
        prev.map(d => d.id === id ? denomination : d)
      );
      onDenominationUpdated?.(denomination);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ amount_cents: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onDenominationUpdated, onError]);

  const removeDenomination = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      await deleteDenomination(id);
      setDenominations(prev => prev.filter(d => d.id !== id));
      onDenominationDeleted?.(id);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onDenominationDeleted, onError]);

  const addMultipleDenominations = useCallback(async (amounts: number[]): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const denominationsData = await createMultipleDenominations(
        amounts.map(amount => ({ amount_cents: amount }))
      );
      setDenominations(prev => [...prev, ...denominationsData]);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onError]);

  const updateMultipleDenominations = useCallback(async (
    updates: Array<{ id: string; amountCents: number }>
  ): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const denominationsData = await updateMultipleDenominations(
        updates.map(update => ({ id: update.id, data: { amount_cents: update.amountCents } }))
      );
      setDenominations(denominationsData);

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onError]);

  const removeMultipleDenominations = useCallback(async (ids: string[]): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setErrors({});

      await deleteMultipleDenominations(ids);
      setDenominations(prev => prev.filter(d => !ids.includes(d.id!)));

      return true;
    } catch (error) {
      const err = error as Error;
      setErrors({ general: err.message });
      onError?.(err);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [onError]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    denominations,
    isLoading,
    isSubmitting,
    errors,
    addDenomination,
    updateDenomination,
    removeDenomination,
    addMultipleDenominations,
    updateMultipleDenominations,
    removeMultipleDenominations,
    loadDenominations,
    clearErrors,
  };
};


