/**
 * useAvailabilityRules Hook - T07A Finalized DTO Wiring
 * 
 * Custom hook for managing availability rules with comprehensive state management,
 * validation, and API integration. Provides a clean interface for availability
 * rule operations with proper error handling and observability.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { availabilityApi } from '../api/availabilityApi';
import { validateAvailabilityRules, validateAvailabilityRule } from '../validators/availabilityValidators';
import type { 
  AvailabilityRule, 
  CreateAvailabilityRuleRequest, 
  UpdateAvailabilityRuleRequest,
  BulkAvailabilityUpdateRequest,
  AvailabilityValidationResult 
} from '../api/types/availability';

// ===== HOOK OPTIONS =====

interface UseAvailabilityRulesOptions {
  initialRules?: AvailabilityRule[];
  autoLoad?: boolean;
  onError?: (error: Error) => void;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
  onRulesChange?: (rules: AvailabilityRule[]) => void;
}

// ===== HOOK RETURN TYPE =====

interface UseAvailabilityRulesReturn {
  // State
  rules: AvailabilityRule[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  validationResult: AvailabilityValidationResult | null;
  
  // CRUD Operations
  createRule: (rule: CreateAvailabilityRuleRequest) => Promise<AvailabilityRule>;
  updateRule: (ruleId: string, updates: UpdateAvailabilityRuleRequest) => Promise<AvailabilityRule>;
  deleteRule: (ruleId: string) => Promise<void>;
  bulkUpdateRules: (request: BulkAvailabilityUpdateRequest) => Promise<void>;
  
  // Utility Operations
  copyWeek: (sourceWeekStart: string, targetWeekStart: string, staffIds?: string[]) => Promise<void>;
  clearAllRules: () => Promise<void>;
  
  // Validation
  validateRules: () => Promise<boolean>;
  validateRule: (rule: AvailabilityRule) => boolean;
  
  // Data Access
  getRulesForStaff: (staffId: string) => AvailabilityRule[];
  getRulesForDay: (dayOfWeek: number) => AvailabilityRule[];
  getActiveRules: () => AvailabilityRule[];
  getInactiveRules: () => AvailabilityRule[];
  
  // State Management
  refreshRules: () => Promise<void>;
  clearError: () => void;
  setRules: (rules: AvailabilityRule[]) => void;
}

// ===== HOOK IMPLEMENTATION =====

export const useAvailabilityRules = ({
  initialRules = [],
  autoLoad = true,
  onError,
  onValidationChange,
  onRulesChange,
}: UseAvailabilityRulesOptions = {}): UseAvailabilityRulesReturn => {
  
  // ===== STATE =====
  
  const [rules, setRules] = useState<AvailabilityRule[]>(initialRules);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<AvailabilityValidationResult | null>(null);

  // ===== EFFECTS =====

  // Auto-load rules on mount
  useEffect(() => {
    if (autoLoad && initialRules.length === 0) {
      refreshRules();
    }
  }, [autoLoad, initialRules.length]);

  // Validate rules whenever they change
  useEffect(() => {
    const validateRulesAsync = async () => {
      if (rules.length === 0) {
        setValidationResult(null);
        onValidationChange?.(true, []);
        return;
      }

      try {
        const result = validateAvailabilityRules(rules);
        setValidationResult(result);
        onValidationChange?.(result.isValid, result.errors);
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        onError?.(error);
      }
    };

    validateRulesAsync();
  }, [rules, onValidationChange, onError]);

  // Notify parent of rules changes
  useEffect(() => {
    onRulesChange?.(rules);
  }, [rules, onRulesChange]);

  // ===== CRUD OPERATIONS =====

  const createRule = useCallback(async (ruleData: CreateAvailabilityRuleRequest): Promise<AvailabilityRule> => {
    try {
      setIsSaving(true);
      setError(null);

      const newRule = await availabilityApi.createRuleWithValidation(ruleData);
      
      setRules(prev => [...prev, newRule]);
      
      return newRule;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  const updateRule = useCallback(async (
    ruleId: string, 
    updates: UpdateAvailabilityRuleRequest
  ): Promise<AvailabilityRule> => {
    try {
      setIsSaving(true);
      setError(null);

      const updatedRule = await availabilityApi.updateRule(ruleId, updates);
      
      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? updatedRule : rule
      ));
      
      return updatedRule;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  const deleteRule = useCallback(async (ruleId: string): Promise<void> => {
    try {
      setIsSaving(true);
      setError(null);

      await availabilityApi.deleteRule(ruleId);
      
      setRules(prev => prev.filter(rule => rule.id !== ruleId));
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  const bulkUpdateRules = useCallback(async (request: BulkAvailabilityUpdateRequest): Promise<void> => {
    try {
      setIsSaving(true);
      setError(null);

      const result = await availabilityApi.bulkUpdateWithValidation(request);
      
      // Update local state based on bulk operation result
      setRules(prev => {
        let updatedRules = [...prev];
        
        // Remove deleted rules
        updatedRules = updatedRules.filter(rule => !result.deleted_rules.includes(rule.id));
        
        // Add created rules
        updatedRules = [...updatedRules, ...result.created_rules];
        
        // Update existing rules
        result.updated_rules.forEach(updatedRule => {
          const index = updatedRules.findIndex(rule => rule.id === updatedRule.id);
          if (index !== -1) {
            updatedRules[index] = updatedRule;
          }
        });
        
        return updatedRules;
      });
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  // ===== UTILITY OPERATIONS =====

  const copyWeek = useCallback(async (
    sourceWeekStart: string,
    targetWeekStart: string,
    staffIds?: string[]
  ): Promise<void> => {
    try {
      setIsSaving(true);
      setError(null);

      const copiedRules = await availabilityApi.copyWeek({
        source_week_start: sourceWeekStart,
        target_week_start: targetWeekStart,
        staff_ids: staffIds,
      });
      
      setRules(prev => [...prev, ...copiedRules]);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [onError]);

  const clearAllRules = useCallback(async (): Promise<void> => {
    try {
      setIsSaving(true);
      setError(null);

      const deletePromises = rules.map(rule => availabilityApi.deleteRule(rule.id));
      await Promise.all(deletePromises);
      
      setRules([]);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [rules, onError]);

  // ===== VALIDATION =====

  const validateRules = useCallback(async (): Promise<boolean> => {
    if (rules.length === 0) return true;

    try {
      const result = validateAvailabilityRules(rules);
      setValidationResult(result);
      return result.isValid;
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
      return false;
    }
  }, [rules, onError]);

  const validateRule = useCallback((rule: AvailabilityRule): boolean => {
    const result = validateAvailabilityRule(rule);
    return result.isValid;
  }, []);

  // ===== DATA ACCESS =====

  const getRulesForStaff = useCallback((staffId: string): AvailabilityRule[] => {
    return rules.filter(rule => rule.staff_id === staffId);
  }, [rules]);

  const getRulesForDay = useCallback((dayOfWeek: number): AvailabilityRule[] => {
    return rules.filter(rule => rule.day_of_week === dayOfWeek);
  }, [rules]);

  const getActiveRules = useCallback((): AvailabilityRule[] => {
    return rules.filter(rule => rule.is_active);
  }, [rules]);

  const getInactiveRules = useCallback((): AvailabilityRule[] => {
    return rules.filter(rule => !rule.is_active);
  }, [rules]);

  // ===== STATE MANAGEMENT =====

  const refreshRules = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedRules = await availabilityApi.getRules();
      setRules(fetchedRules);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setRulesDirect = useCallback((newRules: AvailabilityRule[]) => {
    setRules(newRules);
  }, []);

  // ===== MEMOIZED VALUES =====

  const totalRules = useMemo(() => rules.length, [rules]);
  const activeRulesCount = useMemo(() => getActiveRules().length, [getActiveRules]);
  const inactiveRulesCount = useMemo(() => getInactiveRules().length, [getInactiveRules]);

  // ===== RETURN =====

  return {
    // State
    rules,
    isLoading,
    isSaving,
    error,
    validationResult,
    
    // CRUD Operations
    createRule,
    updateRule,
    deleteRule,
    bulkUpdateRules,
    
    // Utility Operations
    copyWeek,
    clearAllRules,
    
    // Validation
    validateRules,
    validateRule,
    
    // Data Access
    getRulesForStaff,
    getRulesForDay,
    getActiveRules,
    getInactiveRules,
    
    // State Management
    refreshRules,
    clearError,
    setRules: setRulesDirect,
    
    // Computed values (for convenience)
    totalRules,
    activeRulesCount,
    inactiveRulesCount,
  } as UseAvailabilityRulesReturn & {
    totalRules: number;
    activeRulesCount: number;
    inactiveRulesCount: number;
  };
};
