/**
 * useSubdomainValidation Hook
 * 
 * Custom hook for validating subdomain availability with debounced API calls.
 */

import { useState, useEffect, useCallback } from 'react';
import { onboardingService, onboardingUtils } from '../api/services/onboarding';
import type { SubdomainCheckResponse } from '../api/types/onboarding';

interface UseSubdomainValidationOptions {
  debounceMs?: number;
  minLength?: number;
}

interface UseSubdomainValidationReturn {
  subdomain: string;
  setSubdomain: (value: string) => void;
  isValid: boolean;
  isChecking: boolean;
  isAvailable: boolean | null;
  error: string | null;
  suggestion: string | null;
}

export const useSubdomainValidation = (
  options: UseSubdomainValidationOptions = {}
): UseSubdomainValidationReturn => {
  const { debounceMs = 500, minLength = 2 } = options;
  
  const [subdomain, setSubdomain] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Debounced validation function
  const validateSubdomain = useCallback(
    async (value: string) => {
      if (!value || value.length < minLength) {
        setIsValid(false);
        setIsAvailable(null);
        setError(null);
        setSuggestion(null);
        return;
      }

      // Client-side validation first
      const validation = onboardingUtils.validateSubdomain(value);
      if (!validation.isValid) {
        setIsValid(false);
        setIsAvailable(false);
        setError(validation.error || 'Invalid subdomain format');
        setSuggestion(null);
        return;
      }

      setIsValid(true);
      setIsChecking(true);
      setError(null);

      try {
        const response: SubdomainCheckResponse = await onboardingService.checkSubdomain(value);
        setIsAvailable(response.available);
        setSuggestion(response.suggested_url || null);
        
        if (!response.available) {
          setError('This subdomain is already taken');
        }
      } catch (err: any) {
        console.error('Subdomain validation error:', err);
        setError('Failed to check subdomain availability');
        setIsAvailable(null);
        setSuggestion(null);
      } finally {
        setIsChecking(false);
      }
    },
    [minLength]
  );

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      validateSubdomain(subdomain);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [subdomain, debounceMs, validateSubdomain]);

  return {
    subdomain,
    setSubdomain,
    isValid,
    isChecking,
    isAvailable,
    error,
    suggestion,
  };
};
