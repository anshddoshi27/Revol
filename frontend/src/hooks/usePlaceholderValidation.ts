/**
 * usePlaceholderValidation Hook
 * 
 * Custom hook for managing placeholder validation in notification templates.
 * Handles placeholder extraction, validation, and required variable checking.
 */

import { useState, useCallback, useMemo } from 'react';
import { notificationsUtils } from '../api/services/notifications';
import type {
  PlaceholderData,
  PlaceholderValidationResult,
  PlaceholderKey,
} from '../api/types/notifications';

interface UsePlaceholderValidationOptions {
  initialContent?: string;
  initialRequiredVariables?: string[];
  onValidationChange?: (result: PlaceholderValidationResult) => void;
}

interface UsePlaceholderValidationReturn {
  // State
  content: string;
  requiredVariables: string[];
  validationResult: PlaceholderValidationResult;

  // Actions
  updateContent: (content: string) => void;
  updateRequiredVariables: (variables: string[]) => void;
  addRequiredVariable: (variable: string) => void;
  removeRequiredVariable: (variable: string) => void;

  // Validation
  validateContent: () => PlaceholderValidationResult;
  validatePlaceholders: (placeholders: string[]) => { isValid: boolean; invalidPlaceholders: string[] };

  // Utility functions
  extractPlaceholders: (content: string) => string[];
  getMissingPlaceholders: (content: string, required: string[]) => string[];
  getInvalidPlaceholders: (placeholders: string[]) => string[];
  isPlaceholderValid: (placeholder: string) => boolean;

  // Computed values
  extractedPlaceholders: string[];
  missingPlaceholders: string[];
  invalidPlaceholders: string[];
  isValid: boolean;
  availablePlaceholders: PlaceholderKey[];
}

export const usePlaceholderValidation = (
  options: UsePlaceholderValidationOptions = {}
): UsePlaceholderValidationReturn => {
  const { 
    initialContent = '', 
    initialRequiredVariables = [], 
    onValidationChange 
  } = options;

  // State
  const [content, setContent] = useState(initialContent);
  const [requiredVariables, setRequiredVariables] = useState<string[]>(initialRequiredVariables);

  // Extract placeholders from current content
  const extractedPlaceholders = useMemo(() => {
    return notificationsUtils.extractPlaceholders(content);
  }, [content]);

  // Get missing required placeholders
  const missingPlaceholders = useMemo(() => {
    return getMissingPlaceholders(content, requiredVariables);
  }, [content, requiredVariables]);

  // Get invalid placeholders
  const invalidPlaceholders = useMemo(() => {
    return getInvalidPlaceholders(extractedPlaceholders);
  }, [extractedPlaceholders]);

  // Validation result
  const validationResult = useMemo((): PlaceholderValidationResult => {
    const isValid = missingPlaceholders.length === 0 && invalidPlaceholders.length === 0;
    
    return {
      isValid,
      missingPlaceholders,
      invalidPlaceholders,
      errors: [
        ...missingPlaceholders.map(placeholder => ({
          field: 'content',
          message: `Missing required placeholder: {${placeholder}}`,
          code: 'MISSING_PLACEHOLDER',
        })),
        ...invalidPlaceholders.map(placeholder => ({
          field: 'content',
          message: `Invalid placeholder: {${placeholder}}`,
          code: 'INVALID_PLACEHOLDER',
        })),
      ],
    };
  }, [missingPlaceholders, invalidPlaceholders]);

  // Overall validation state
  const isValid = useMemo(() => {
    return validationResult.isValid;
  }, [validationResult]);

  // Available placeholders (from types)
  const availablePlaceholders = useMemo(() => {
    const { AVAILABLE_PLACEHOLDERS } = require('../api/types/notifications');
    return AVAILABLE_PLACEHOLDERS as PlaceholderKey[];
  }, []);

  // Actions
  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const updateRequiredVariables = useCallback((variables: string[]) => {
    setRequiredVariables(variables);
  }, []);

  const addRequiredVariable = useCallback((variable: string) => {
    if (!requiredVariables.includes(variable)) {
      setRequiredVariables(prev => [...prev, variable]);
    }
  }, [requiredVariables]);

  const removeRequiredVariable = useCallback((variable: string) => {
    setRequiredVariables(prev => prev.filter(v => v !== variable));
  }, []);

  // Validation functions
  const validateContent = useCallback((): PlaceholderValidationResult => {
    return validationResult;
  }, [validationResult]);

  const validatePlaceholders = useCallback((placeholders: string[]) => {
    return notificationsUtils.validatePlaceholders(placeholders);
  }, []);

  // Utility functions
  const extractPlaceholders = useCallback((contentToExtract: string) => {
    return notificationsUtils.extractPlaceholders(contentToExtract);
  }, []);

  const getMissingPlaceholders = useCallback((contentToCheck: string, required: string[]) => {
    return required.filter(placeholder => !contentToCheck.includes(`{${placeholder}}`));
  }, []);

  const getInvalidPlaceholders = useCallback((placeholders: string[]) => {
    const validation = notificationsUtils.validatePlaceholders(placeholders);
    return validation.invalidPlaceholders;
  }, []);

  const isPlaceholderValid = useCallback((placeholder: string) => {
    const { AVAILABLE_PLACEHOLDERS } = require('../api/types/notifications');
    return AVAILABLE_PLACEHOLDERS.includes(placeholder as any);
  }, []);

  // Notify parent of validation changes
  useMemo(() => {
    if (onValidationChange) {
      onValidationChange(validationResult);
    }
  }, [validationResult, onValidationChange]);

  return {
    // State
    content,
    requiredVariables,
    validationResult,

    // Actions
    updateContent,
    updateRequiredVariables,
    addRequiredVariable,
    removeRequiredVariable,

    // Validation
    validateContent,
    validatePlaceholders,

    // Utility functions
    extractPlaceholders,
    getMissingPlaceholders,
    getInvalidPlaceholders,
    isPlaceholderValid,

    // Computed values
    extractedPlaceholders,
    missingPlaceholders,
    invalidPlaceholders,
    isValid,
    availablePlaceholders,
  };
};
