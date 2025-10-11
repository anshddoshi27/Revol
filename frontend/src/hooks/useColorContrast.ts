/**
 * useColorContrast Hook
 * 
 * Custom hook for handling color selection and contrast validation in onboarding Step 2.
 * Provides color picker functionality with WCAG AA compliance checking.
 */

import { useState, useCallback, useMemo } from 'react';
import { trackEvent } from '../observability';

// ===== TYPES =====

export interface ContrastValidationResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  level: 'AA' | 'AAA' | 'FAIL';
  recommendation?: string;
}

export interface ColorSelectionState {
  selectedColor: string;
  contrastResult: ContrastValidationResult | null;
  isValid: boolean;
  error: string | null;
}

export interface ColorSelectionActions {
  setColor: (color: string) => void;
  validateContrast: (backgroundColor?: string) => void;
  reset: () => void;
}

export interface UseColorContrastReturn {
  state: ColorSelectionState;
  actions: ColorSelectionActions;
}

// ===== CONSTANTS =====

const DEFAULT_BACKGROUND_COLOR = '#ffffff'; // White background
const MIN_AA_RATIO = 4.5; // WCAG AA minimum contrast ratio
const MIN_AAA_RATIO = 7.0; // WCAG AAA minimum contrast ratio

// ===== UTILITY FUNCTIONS =====

/**
 * Converts hex color to RGB values
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Converts RGB values to relative luminance
 */
const getRelativeLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Calculates contrast ratio between two colors
 */
const calculateContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) {
    return 0;
  }
  
  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Validates contrast ratio against WCAG standards
 */
const validateContrastRatio = (ratio: number): ContrastValidationResult => {
  const passesAA = ratio >= MIN_AA_RATIO;
  const passesAAA = ratio >= MIN_AAA_RATIO;
  
  let level: 'AA' | 'AAA' | 'FAIL';
  let recommendation: string | undefined;
  
  if (passesAAA) {
    level = 'AAA';
    recommendation = 'Excellent contrast! Meets WCAG AAA standards.';
  } else if (passesAA) {
    level = 'AA';
    recommendation = 'Good contrast! Meets WCAG AA standards.';
  } else {
    level = 'FAIL';
    recommendation = 'Poor contrast. Consider using a darker or lighter color.';
  }
  
  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA,
    passesAAA,
    level,
    recommendation,
  };
};

/**
 * Generates a color scale from a primary color
 */
const generateColorScale = (primaryColor: string): Record<string, string> => {
  const rgb = hexToRgb(primaryColor);
  if (!rgb) return {};

  // Simple color scale generation (can be enhanced with more sophisticated algorithms)
  const { r, g, b } = rgb;
  
  return {
    50: `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.9))}, ${Math.min(255, Math.round(g + (255 - g) * 0.9))}, ${Math.min(255, Math.round(b + (255 - b) * 0.9))})`,
    100: `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.8))}, ${Math.min(255, Math.round(g + (255 - g) * 0.8))}, ${Math.min(255, Math.round(b + (255 - b) * 0.8))})`,
    200: `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.6))}, ${Math.min(255, Math.round(g + (255 - g) * 0.6))}, ${Math.min(255, Math.round(b + (255 - b) * 0.6))})`,
    300: `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.4))}, ${Math.min(255, Math.round(g + (255 - g) * 0.4))}, ${Math.min(255, Math.round(b + (255 - b) * 0.4))})`,
    400: `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.2))}, ${Math.min(255, Math.round(g + (255 - g) * 0.2))}, ${Math.min(255, Math.round(b + (255 - b) * 0.2))})`,
    500: primaryColor,
    600: `rgb(${Math.max(0, Math.round(r * 0.8))}, ${Math.max(0, Math.round(g * 0.8))}, ${Math.max(0, Math.round(b * 0.8))})`,
    700: `rgb(${Math.max(0, Math.round(r * 0.6))}, ${Math.max(0, Math.round(g * 0.6))}, ${Math.max(0, Math.round(b * 0.6))})`,
    800: `rgb(${Math.max(0, Math.round(r * 0.4))}, ${Math.max(0, Math.round(g * 0.4))}, ${Math.max(0, Math.round(b * 0.4))})`,
    900: `rgb(${Math.max(0, Math.round(r * 0.2))}, ${Math.max(0, Math.round(g * 0.2))}, ${Math.max(0, Math.round(b * 0.2))})`,
  };
};

// ===== HOOK IMPLEMENTATION =====

export const useColorContrast = (): UseColorContrastReturn => {
  const [state, setState] = useState<ColorSelectionState>(() => {
    // Initialize with default color and validate contrast immediately
    const defaultColor = '#3B82F6';
    const ratio = calculateContrastRatio(defaultColor, DEFAULT_BACKGROUND_COLOR);
    const result = validateContrastRatio(ratio);
    
    return {
      selectedColor: defaultColor,
      contrastResult: result,
      isValid: result.passesAA,
      error: null,
    };
  });

  const setColor = useCallback((color: string) => {
    setState(prev => ({
      ...prev,
      selectedColor: color,
      error: null,
    }));
  }, []);

  const validateContrast = useCallback((backgroundColor: string = DEFAULT_BACKGROUND_COLOR) => {
    try {
      setState(prev => {
        const ratio = calculateContrastRatio(prev.selectedColor, backgroundColor);
        const result = validateContrastRatio(ratio);
        
        // Emit analytics event
        trackEvent('onboarding.color_contrast_check', {
          selected_color: prev.selectedColor,
          background_color: backgroundColor,
          contrast_ratio: result.ratio,
          passes_aa: result.passesAA,
          passes_aaa: result.passesAAA,
          level: result.level,
        });
        
        return {
          ...prev,
          contrastResult: result,
          isValid: result.passesAA,
          error: null,
        };
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate contrast';
      
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isValid: false,
      }));
    }
  }, [state.selectedColor]);

  const reset = useCallback(() => {
    setState({
      selectedColor: '#3B82F6',
      contrastResult: null,
      isValid: false,
      error: null,
    });
  }, []);

  // Generate color scale when color changes
  const colorScale = useMemo(() => {
    return generateColorScale(state.selectedColor);
  }, [state.selectedColor]);

  return {
    state,
    actions: {
      setColor,
      validateContrast,
      reset,
    },
  };
};
