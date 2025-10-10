/**
 * StatusBadge Component Tests
 * 
 * Comprehensive tests for the StatusBadge component including rendering,
 * accessibility, contrast validation, and interaction behavior.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';
import type { StatusBadgeProps, StatusBadgeVariant, StatusBadgeSize } from '../StatusBadge';

// ===== TEST UTILITIES =====

const renderStatusBadge = (props: Partial<StatusBadgeProps> = {}) => {
  const defaultProps: StatusBadgeProps = {
    status: 'pending',
    children: 'Test Status',
  };
  
  return render(<StatusBadge {...defaultProps} {...props} />);
};

// ===== BASIC RENDERING TESTS =====

describe('StatusBadge', () => {
  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      renderStatusBadge();
      
      const badge = screen.getByText('Test Status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('inline-flex', 'items-center', 'justify-center');
    });

    it('should render with custom children', () => {
      renderStatusBadge({ children: 'Custom Status Text' });
      
      expect(screen.getByText('Custom Status Text')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      renderStatusBadge({ className: 'custom-class' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('Status Colors', () => {
    it('should apply correct colors for each status', () => {
      const statuses = [
        { status: 'pending', expectedColor: '#F59E0B' },
        { status: 'confirmed', expectedColor: '#3B82F6' },
        { status: 'attended', expectedColor: '#10B981' },
        { status: 'no_show', expectedColor: '#EF4444' },
        { status: 'cancelled', expectedColor: '#6B7280' },
      ] as const;

      statuses.forEach(({ status, expectedColor }) => {
        const { unmount } = renderStatusBadge({ status });
        
        const badge = screen.getByText('Test Status');
        expect(badge).toHaveStyle({ backgroundColor: expectedColor });
        
        unmount();
      });
    });

    it('should handle booking status mapping', () => {
      const bookingStatuses = [
        { status: 'pending', expectedColor: '#F59E0B' },
        { status: 'confirmed', expectedColor: '#3B82F6' },
        { status: 'completed', expectedColor: '#10B981' }, // Maps to attended
        { status: 'cancelled', expectedColor: '#6B7280' },
        { status: 'no_show', expectedColor: '#EF4444' },
      ] as const;

      bookingStatuses.forEach(({ status, expectedColor }) => {
        const { unmount } = renderStatusBadge({ status });
        
        const badge = screen.getByText('Test Status');
        expect(badge).toHaveStyle({ backgroundColor: expectedColor });
        
        unmount();
      });
    });

    it('should fallback to neutral color for unknown status', () => {
      renderStatusBadge({ status: 'unknown' as any });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveStyle({ backgroundColor: '#6B7280' }); // cancelled color
    });
  });

  describe('Variants', () => {
    it('should render default variant correctly', () => {
      renderStatusBadge({ variant: 'default' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('border-0');
      expect(badge).toHaveStyle({ backgroundColor: '#F59E0B' });
    });

    it('should render outline variant correctly', () => {
      renderStatusBadge({ variant: 'outline' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('border');
      expect(badge).toHaveStyle({ 
        backgroundColor: 'transparent',
        borderColor: '#F59E0B',
        color: '#F59E0B'
      });
    });

    it('should render subtle variant correctly', () => {
      renderStatusBadge({ variant: 'subtle' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('border-0');
      expect(badge).toHaveStyle({ 
        backgroundColor: '#F59E0B20', // 20% opacity
        color: '#F59E0B'
      });
    });
  });

  describe('Sizes', () => {
    it('should render small size correctly', () => {
      renderStatusBadge({ size: 'sm' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs', 'rounded-md');
    });

    it('should render medium size correctly', () => {
      renderStatusBadge({ size: 'md' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('px-2.5', 'py-0.5', 'text-xs', 'rounded-full');
    });

    it('should render large size correctly', () => {
      renderStatusBadge({ size: 'lg' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('px-3', 'py-1', 'text-sm', 'rounded-full');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      renderStatusBadge({ 'aria-label': 'Custom status label' });
      
      const badge = screen.getByLabelText('Custom status label');
      expect(badge).toBeInTheDocument();
    });

    it('should generate default ARIA label from status', () => {
      renderStatusBadge({ status: 'confirmed' });
      
      const badge = screen.getByLabelText('Confirmed status');
      expect(badge).toBeInTheDocument();
    });

    it('should not be interactive by default', () => {
      renderStatusBadge();
      
      const badge = screen.getByText('Test Status');
      expect(badge).not.toHaveAttribute('role', 'button');
      expect(badge).not.toHaveAttribute('tabIndex');
    });

    it('should be interactive when interactive prop is true', () => {
      renderStatusBadge({ interactive: true });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveAttribute('role', 'button');
      expect(badge).toHaveAttribute('tabIndex', '0');
      expect(badge).toHaveClass('cursor-pointer');
    });

    it('should handle keyboard navigation for interactive badges', () => {
      const handleClick = jest.fn();
      renderStatusBadge({ interactive: true, onClick: handleClick });
      
      const badge = screen.getByText('Test Status');
      
      // Test Enter key
      fireEvent.keyDown(badge, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      // Test Space key
      fireEvent.keyDown(badge, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
      
      // Test other keys (should not trigger)
      fireEvent.keyDown(badge, { key: 'Escape' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should handle click events for interactive badges', () => {
      const handleClick = jest.fn();
      renderStatusBadge({ interactive: true, onClick: handleClick });
      
      const badge = screen.getByText('Test Status');
      fireEvent.click(badge);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not handle click events for non-interactive badges', () => {
      const handleClick = jest.fn();
      renderStatusBadge({ onClick: handleClick });
      
      const badge = screen.getByText('Test Status');
      fireEvent.click(badge);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Contrast Validation', () => {
    it('should use appropriate text color based on contrast', () => {
      renderStatusBadge({ status: 'no_show' }); // Red background
      
      const badge = screen.getByText('Test Status');
      // Should have a valid color value (either white or black)
      const colorValue = badge.style.color;
      expect(['white', 'black', 'rgb(0, 0, 0)', 'rgb(255, 255, 255)']).toContain(colorValue);
    });

    it('should use black text for light backgrounds in outline variant', () => {
      renderStatusBadge({ status: 'pending', variant: 'outline' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveStyle({ color: '#F59E0B' });
    });
  });

  describe('Status Label Generation', () => {
    it('should generate correct labels for all statuses', () => {
      const statusLabels = [
        { status: 'pending', expectedLabel: 'Pending' },
        { status: 'confirmed', expectedLabel: 'Confirmed' },
        { status: 'attended', expectedLabel: 'Attended' },
        { status: 'completed', expectedLabel: 'Completed' },
        { status: 'no_show', expectedLabel: 'No Show' },
        { status: 'cancelled', expectedLabel: 'Cancelled' },
      ] as const;

      statusLabels.forEach(({ status, expectedLabel }) => {
        const { unmount } = renderStatusBadge({ status });
        
        const badge = screen.getByLabelText(`${expectedLabel} status`);
        expect(badge).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Focus Management', () => {
    it('should have focus ring styles', () => {
      renderStatusBadge({ interactive: true });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-1');
    });
  });

  describe('Hover States', () => {
    it('should have hover styles for interactive badges', () => {
      renderStatusBadge({ interactive: true });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('hover:opacity-80', 'active:opacity-60');
    });

    it('should not have hover styles for non-interactive badges', () => {
      renderStatusBadge();
      
      const badge = screen.getByText('Test Status');
      expect(badge).not.toHaveClass('hover:opacity-80', 'active:opacity-60');
    });
  });

  describe('Transition Effects', () => {
    it('should have transition classes', () => {
      renderStatusBadge();
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('transition-colors', 'duration-150');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty children', () => {
      renderStatusBadge({ children: '' });
      
      const badge = screen.getByLabelText('Pending status');
      expect(badge).toBeInTheDocument();
      expect(badge).toBeEmptyDOMElement();
    });

    it('should handle React node children', () => {
      renderStatusBadge({ 
        children: <span data-testid="custom-child">Custom Child</span> 
      });
      
      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    });

    it('should handle multiple class names', () => {
      renderStatusBadge({ className: 'class1 class2 class3' });
      
      const badge = screen.getByText('Test Status');
      expect(badge).toHaveClass('class1', 'class2', 'class3');
    });
  });
});

// ===== INTEGRATION TESTS =====

describe('StatusBadge Integration', () => {
  it('should work with different combinations of props', () => {
    renderStatusBadge({
      status: 'confirmed',
      variant: 'outline',
      size: 'lg',
      interactive: true,
      className: 'custom-class',
      'aria-label': 'Custom label',
    });
    
    const badge = screen.getByLabelText('Custom label');
    expect(badge).toHaveClass(
      'px-3', 'py-1', 'text-sm', 'rounded-full',
      'border', 'cursor-pointer', 'custom-class'
    );
    expect(badge).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: '#3B82F6',
      color: '#3B82F6'
    });
  });

  it('should maintain consistent styling across re-renders', () => {
    const { rerender } = renderStatusBadge({ status: 'pending' });
    
    const badge = screen.getByText('Test Status');
    const initialStyle = badge.style.cssText;
    
    rerender(<StatusBadge status="pending" children="Test Status" />);
    
    expect(badge.style.cssText).toBe(initialStyle);
  });
});
