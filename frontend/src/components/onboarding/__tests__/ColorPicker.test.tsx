/**
 * ColorPicker Component Tests
 * 
 * Comprehensive tests for the ColorPicker component including color selection,
 * contrast validation, and preset colors.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from '../ColorPicker';

// ===== MOCK SETUP =====

// Mock the useColorContrast hook
jest.mock('../../../hooks/useColorContrast', () => ({
  useColorContrast: jest.fn(),
}));

const mockUseColorContrast = require('../../../hooks/useColorContrast').useColorContrast;

beforeEach(() => {
  jest.clearAllMocks();
});

// ===== TEST SUITE =====

describe('ColorPicker', () => {
  const defaultProps = {
    onColorChange: jest.fn(),
    onError: jest.fn(),
  };

  const mockContrastResult = {
    ratio: 4.5,
    passesAA: true,
    passesAAA: false,
    level: 'AA' as const,
    recommendation: 'Good contrast! Meets WCAG AA standards.',
  };

  const defaultHookReturn = {
    state: {
      selectedColor: '#3B82F6',
      contrastResult: mockContrastResult,
      isValid: true,
      error: null,
    },
    actions: {
      setColor: jest.fn(),
      validateContrast: jest.fn(),
      reset: jest.fn(),
    },
  };

  beforeEach(() => {
    mockUseColorContrast.mockReturnValue(defaultHookReturn);
  });

  describe('rendering', () => {
    it('should render color picker with title and description', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('Choose your brand color')).toBeInTheDocument();
      expect(screen.getByText('Select a primary color that represents your brand. We\'ll ensure it meets accessibility standards.')).toBeInTheDocument();
    });

    it('should render preset colors section', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('Popular colors')).toBeInTheDocument();
      expect(screen.getByText('Blue')).toBeInTheDocument();
      expect(screen.getByText('Green')).toBeInTheDocument();
      expect(screen.getByText('Purple')).toBeInTheDocument();
    });

    it('should render custom color section', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('Custom color')).toBeInTheDocument();
      expect(screen.getByText('Choose custom color')).toBeInTheDocument();
    });

    it('should render accessibility info', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('Accessibility Standards')).toBeInTheDocument();
      expect(screen.getByText('We check your color against WCAG AA standards (4.5:1 contrast ratio)')).toBeInTheDocument();
    });
  });

  describe('preset color selection', () => {
    it('should handle preset color selection', async () => {
      const user = userEvent.setup();
      render(<ColorPicker {...defaultProps} />);
      
      const blueButton = screen.getByLabelText('Select Blue color');
      await user.click(blueButton);

      expect(defaultHookReturn.actions.setColor).toHaveBeenCalledWith('#3B82F6');
      expect(defaultHookReturn.actions.validateContrast).toHaveBeenCalled();
    });

    it('should show selected state for active color', () => {
      render(<ColorPicker {...defaultProps} />);
      
      const blueButton = screen.getByLabelText('Select Blue color');
      expect(blueButton).toHaveClass('border-blue-500');
    });
  });

  describe('custom color picker', () => {
    it('should show custom color picker when clicked', async () => {
      const user = userEvent.setup();
      render(<ColorPicker {...defaultProps} />);
      
      const customButton = screen.getByText('Choose custom color');
      await user.click(customButton);

      expect(screen.getByLabelText('Custom color picker')).toBeInTheDocument();
      expect(screen.getByDisplayValue('#3B82F6')).toBeInTheDocument();
      expect(screen.getByText('Apply')).toBeInTheDocument();
    });

    it('should handle color input change', async () => {
      const user = userEvent.setup();
      render(<ColorPicker {...defaultProps} />);
      
      const customButton = screen.getByText('Choose custom color');
      await user.click(customButton);

      const colorInput = screen.getByDisplayValue('#3B82F6');
      await user.clear(colorInput);
      await user.type(colorInput, '#FF0000');

      expect(defaultHookReturn.actions.setColor).toHaveBeenCalledWith('#FF0000');
      expect(defaultHookReturn.actions.validateContrast).toHaveBeenCalled();
    });

    it('should handle apply button click', async () => {
      const user = userEvent.setup();
      render(<ColorPicker {...defaultProps} />);
      
      const customButton = screen.getByText('Choose custom color');
      await user.click(customButton);

      const applyButton = screen.getByText('Apply');
      await user.click(applyButton);

      expect(defaultHookReturn.actions.setColor).toHaveBeenCalledWith('#3B82F6');
      expect(defaultHookReturn.actions.validateContrast).toHaveBeenCalled();
    });

    it('should handle cancel button click', async () => {
      const user = userEvent.setup();
      render(<ColorPicker {...defaultProps} />);
      
      const customButton = screen.getByText('Choose custom color');
      await user.click(customButton);

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(screen.getByText('Choose custom color')).toBeInTheDocument();
    });
  });

  describe('contrast validation display', () => {
    it('should show contrast validation result', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('Contrast Ratio: 4.5:1')).toBeInTheDocument();
      expect(screen.getByText('WCAG AA')).toBeInTheDocument();
      expect(screen.getByText('Good contrast! Meets WCAG AA standards.')).toBeInTheDocument();
    });

    it('should show AAA level badge', () => {
      const aaaContrastResult = {
        ...mockContrastResult,
        passesAAA: true,
        level: 'AAA' as const,
      };

      mockUseColorContrast.mockReturnValue({
        ...defaultHookReturn,
        state: {
          ...defaultHookReturn.state,
          contrastResult: aaaContrastResult,
        },
      });

      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('WCAG AAA')).toBeInTheDocument();
    });

    it('should show fail level badge', () => {
      const failContrastResult = {
        ...mockContrastResult,
        passesAA: false,
        level: 'FAIL' as const,
      };

      mockUseColorContrast.mockReturnValue({
        ...defaultHookReturn,
        state: {
          ...defaultHookReturn.state,
          contrastResult: failContrastResult,
        },
      });

      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByText('WCAG FAIL')).toBeInTheDocument();
    });

    it('should not show contrast result when null', () => {
      mockUseColorContrast.mockReturnValue({
        ...defaultHookReturn,
        state: {
          ...defaultHookReturn.state,
          contrastResult: null,
        },
      });

      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.queryByText('Contrast Ratio:')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle and display errors', () => {
      mockUseColorContrast.mockReturnValue({
        ...defaultHookReturn,
        state: {
          ...defaultHookReturn.state,
          error: 'Color validation failed',
        },
      });

      render(<ColorPicker {...defaultProps} />);
      
      expect(defaultProps.onError).toHaveBeenCalledWith('Color validation failed');
    });
  });

  describe('initial color', () => {
    it('should use provided initial color', () => {
      render(<ColorPicker {...defaultProps} initialColor="#FF0000" />);
      
      expect(defaultHookReturn.actions.setColor).toHaveBeenCalledWith('#FF0000');
      expect(defaultHookReturn.actions.validateContrast).toHaveBeenCalled();
    });
  });

  describe('color change notifications', () => {
    it('should notify parent of color changes', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(defaultProps.onColorChange).toHaveBeenCalledWith('#3B82F6', mockContrastResult);
    });

    it('should notify parent when contrast result changes', () => {
      const newContrastResult = {
        ...mockContrastResult,
        ratio: 7.0,
        passesAAA: true,
        level: 'AAA' as const,
      };

      mockUseColorContrast.mockReturnValue({
        ...defaultHookReturn,
        state: {
          ...defaultHookReturn.state,
          contrastResult: newContrastResult,
        },
      });

      render(<ColorPicker {...defaultProps} />);
      
      expect(defaultProps.onColorChange).toHaveBeenCalledWith('#3B82F6', newContrastResult);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ColorPicker {...defaultProps} />);
      
      expect(screen.getByLabelText('Select Blue color')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Green color')).toBeInTheDocument();
    });

    it('should have proper color input labels', async () => {
      const user = userEvent.setup();
      render(<ColorPicker {...defaultProps} />);
      
      const customButton = screen.getByText('Choose custom color');
      await user.click(customButton);

      expect(screen.getByLabelText('Custom color picker')).toBeInTheDocument();
    });
  });
});
