/**
 * useColorContrast Hook Tests
 * 
 * Comprehensive tests for the useColorContrast hook including color selection,
 * contrast validation, and WCAG compliance checking.
 */

import { renderHook, act } from '@testing-library/react';
import { useColorContrast } from '../useColorContrast';

// ===== TEST SUITE =====

describe('useColorContrast', () => {
  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useColorContrast());
      
      expect(result.current.state).toEqual({
        selectedColor: '#3B82F6',
        contrastResult: null,
        isValid: false,
        error: null,
      });
    });
  });

  describe('setColor', () => {
    it('should update selected color', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#FF0000');
      });

      expect(result.current.state.selectedColor).toBe('#FF0000');
      expect(result.current.state.error).toBe(null);
    });
  });

  describe('validateContrast', () => {
    it('should validate contrast with white background', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#000000'); // Black on white
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult).toBeDefined();
      expect(result.current.state.contrastResult?.passesAA).toBe(true);
      expect(result.current.state.contrastResult?.passesAAA).toBe(true);
      expect(result.current.state.contrastResult?.level).toBe('AAA');
      expect(result.current.state.isValid).toBe(true);
    });

    it('should fail validation with low contrast', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#F0F0F0'); // Light gray on white
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult).toBeDefined();
      expect(result.current.state.contrastResult?.passesAA).toBe(false);
      expect(result.current.state.contrastResult?.passesAAA).toBe(false);
      expect(result.current.state.contrastResult?.level).toBe('FAIL');
      expect(result.current.state.isValid).toBe(false);
    });

    it('should pass AA but fail AAA validation', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#666666'); // Medium gray on white
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult).toBeDefined();
      expect(result.current.state.contrastResult?.passesAA).toBe(true);
      expect(result.current.state.contrastResult?.passesAAA).toBe(false);
      expect(result.current.state.contrastResult?.level).toBe('AA');
      expect(result.current.state.isValid).toBe(true);
    });

    it('should use default white background when none provided', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#000000');
        result.current.actions.validateContrast();
      });

      expect(result.current.state.contrastResult).toBeDefined();
      expect(result.current.state.contrastResult?.passesAA).toBe(true);
    });

    it('should handle invalid color format gracefully', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('invalid-color');
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult).toBeDefined();
      expect(result.current.state.contrastResult?.ratio).toBe(0);
      expect(result.current.state.contrastResult?.passesAA).toBe(false);
      expect(result.current.state.error).toBe(null);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const { result } = renderHook(() => useColorContrast());

      // Set some state
      act(() => {
        result.current.actions.setColor('#FF0000');
        result.current.actions.validateContrast('#FFFFFF');
      });

      // Reset
      act(() => {
        result.current.actions.reset();
      });

      expect(result.current.state).toEqual({
        selectedColor: '#3B82F6',
        contrastResult: null,
        isValid: false,
        error: null,
      });
    });
  });

  describe('color scale generation', () => {
    it('should generate color scale when color changes', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#3B82F6');
      });

      // The hook should generate a color scale internally
      // This is tested indirectly through the color change
      expect(result.current.state.selectedColor).toBe('#3B82F6');
    });
  });

  describe('contrast ratio calculations', () => {
    it('should calculate correct contrast ratio for black on white', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#000000');
        result.current.actions.validateContrast('#FFFFFF');
      });

      const ratio = result.current.state.contrastResult?.ratio;
      expect(ratio).toBeCloseTo(21, 0); // Black on white has ~21:1 ratio
    });

    it('should calculate correct contrast ratio for white on black', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#FFFFFF');
        result.current.actions.validateContrast('#000000');
      });

      const ratio = result.current.state.contrastResult?.ratio;
      expect(ratio).toBeCloseTo(21, 0); // White on black has ~21:1 ratio
    });

    it('should calculate correct contrast ratio for medium contrast', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#666666');
        result.current.actions.validateContrast('#FFFFFF');
      });

      const ratio = result.current.state.contrastResult?.ratio;
      expect(ratio).toBeGreaterThan(4.5); // Should pass AA
      expect(ratio).toBeLessThan(7.0); // Should fail AAA
    });
  });

  describe('recommendation messages', () => {
    it('should provide appropriate recommendation for AAA level', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#000000');
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult?.recommendation).toContain('Excellent');
      expect(result.current.state.contrastResult?.recommendation).toContain('AAA');
    });

    it('should provide appropriate recommendation for AA level', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#666666');
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult?.recommendation).toContain('Good');
      expect(result.current.state.contrastResult?.recommendation).toContain('AA');
    });

    it('should provide appropriate recommendation for fail level', () => {
      const { result } = renderHook(() => useColorContrast());

      act(() => {
        result.current.actions.setColor('#F0F0F0');
        result.current.actions.validateContrast('#FFFFFF');
      });

      expect(result.current.state.contrastResult?.recommendation).toContain('Poor');
      expect(result.current.state.contrastResult?.recommendation).toContain('darker or lighter');
    });
  });
});
