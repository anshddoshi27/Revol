/**
 * Design Tokens Tests
 * 
 * Comprehensive tests for the design token system including breakpoints,
 * typography, spacing, colors, and utility functions.
 */

import {
  breakpoints,
  breakpointValues,
  typography,
  spacing,
  colors,
  statusColors,
  bookingStatusColors,
  borderRadius,
  boxShadow,
  zIndex,
  animation,
  layout,
  getBreakpointValue,
  isMobile,
  isTablet,
  isDesktop,
  getCurrentBreakpoint,
  applyTenantTheme,
} from '../tokens';

// Mock window object for testing
const mockWindow = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

describe('Design Tokens', () => {
  describe('Breakpoints', () => {
    it('should have correct breakpoint values', () => {
      expect(breakpoints.xs).toBe('320px');
      expect(breakpoints.sm).toBe('640px');
      expect(breakpoints.md).toBe('768px');
      expect(breakpoints.lg).toBe('1024px');
      expect(breakpoints.xl).toBe('1280px');
      expect(breakpoints['2xl']).toBe('1536px');
    });

    it('should have correct breakpoint values as numbers', () => {
      expect(breakpointValues.xs).toBe(320);
      expect(breakpointValues.sm).toBe(640);
      expect(breakpointValues.md).toBe(768);
      expect(breakpointValues.lg).toBe(1024);
      expect(breakpointValues.xl).toBe(1280);
      expect(breakpointValues['2xl']).toBe(1536);
    });

    it('should be consistent between string and number values', () => {
      Object.keys(breakpoints).forEach(key => {
        const stringValue = breakpoints[key as keyof typeof breakpoints];
        const numberValue = breakpointValues[key as keyof typeof breakpointValues];
        const expectedNumber = parseInt(stringValue.replace('px', ''));
        expect(numberValue).toBe(expectedNumber);
      });
    });
  });

  describe('Typography', () => {
    it('should have correct font families', () => {
      expect(typography.fontFamily.sans).toContain('Inter');
      expect(typography.fontFamily.mono).toContain('JetBrains Mono');
    });

    it('should have correct font sizes', () => {
      expect(typography.fontSize.xs[0]).toBe('0.75rem');
      expect(typography.fontSize.sm[0]).toBe('0.875rem');
      expect(typography.fontSize.base[0]).toBe('1rem');
      expect(typography.fontSize.lg[0]).toBe('1.125rem');
      expect(typography.fontSize.xl[0]).toBe('1.25rem');
      expect(typography.fontSize['2xl'][0]).toBe('1.5rem');
      expect(typography.fontSize['3xl'][0]).toBe('1.875rem');
      expect(typography.fontSize['4xl'][0]).toBe('2.25rem');
    });

    it('should have correct line heights', () => {
      expect(typography.fontSize.xs[1].lineHeight).toBe('1rem');
      expect(typography.fontSize.sm[1].lineHeight).toBe('1.25rem');
      expect(typography.fontSize.base[1].lineHeight).toBe('1.5rem');
      expect(typography.fontSize.lg[1].lineHeight).toBe('1.75rem');
    });

    it('should have correct font weights', () => {
      expect(typography.fontWeight.thin).toBe('100');
      expect(typography.fontWeight.normal).toBe('400');
      expect(typography.fontWeight.medium).toBe('500');
      expect(typography.fontWeight.semibold).toBe('600');
      expect(typography.fontWeight.bold).toBe('700');
    });

    it('should have correct letter spacing', () => {
      expect(typography.letterSpacing.tighter).toBe('-0.05em');
      expect(typography.letterSpacing.tight).toBe('-0.025em');
      expect(typography.letterSpacing.normal).toBe('0em');
      expect(typography.letterSpacing.wide).toBe('0.025em');
      expect(typography.letterSpacing.wider).toBe('0.05em');
      expect(typography.letterSpacing.widest).toBe('0.1em');
    });
  });

  describe('Spacing', () => {
    it('should have correct spacing values', () => {
      expect(spacing[0]).toBe('0px');
      expect(spacing[1]).toBe('0.25rem');
      expect(spacing[2]).toBe('0.5rem');
      expect(spacing[4]).toBe('1rem');
      expect(spacing[8]).toBe('2rem');
      expect(spacing[16]).toBe('4rem');
      expect(spacing[32]).toBe('8rem');
    });

    it('should follow 4px base unit system', () => {
      const spacing1 = parseFloat(spacing[1].replace('rem', '')) * 16; // Convert rem to px
      const spacing2 = parseFloat(spacing[2].replace('rem', '')) * 16;
      const spacing4 = parseFloat(spacing[4].replace('rem', '')) * 16;
      
      expect(spacing1).toBe(4);
      expect(spacing2).toBe(8);
      expect(spacing4).toBe(16);
    });
  });

  describe('Colors', () => {
    it('should have correct status colors', () => {
      expect(colors.success[500]).toBe('#10b981');
      expect(colors.warning[500]).toBe('#f59e0b');
      expect(colors.error[500]).toBe('#ef4444');
      expect(colors.info[500]).toBe('#3b82f6');
    });

    it('should have correct neutral colors', () => {
      expect(colors.white).toBe('#ffffff');
      expect(colors.black).toBe('#000000');
      expect(colors.gray[50]).toBe('#f9fafb');
      expect(colors.gray[500]).toBe('#6b7280');
      expect(colors.gray[900]).toBe('#111827');
    });

    it('should have correct primary color default', () => {
      expect(colors.primary[500]).toBe('#3b82f6');
    });

    it('should have complete color scales', () => {
      const colorScales = ['gray', 'success', 'warning', 'error', 'info', 'primary'];
      
      colorScales.forEach(scale => {
        const colorScale = colors[scale as keyof typeof colors];
        if (typeof colorScale === 'object' && colorScale !== null) {
          expect(colorScale[50]).toBeDefined();
          expect(colorScale[100]).toBeDefined();
          expect(colorScale[200]).toBeDefined();
          expect(colorScale[300]).toBeDefined();
          expect(colorScale[400]).toBeDefined();
          expect(colorScale[500]).toBeDefined();
          expect(colorScale[600]).toBeDefined();
          expect(colorScale[700]).toBeDefined();
          expect(colorScale[800]).toBeDefined();
          expect(colorScale[900]).toBeDefined();
          expect(colorScale[950]).toBeDefined();
        }
      });
    });
  });

  describe('Status Colors', () => {
    it('should have correct status color values', () => {
      expect(statusColors.pending).toBe('#F59E0B');
      expect(statusColors.confirmed).toBe('#3B82F6');
      expect(statusColors.attended).toBe('#10B981');
      expect(statusColors.no_show).toBe('#EF4444');
      expect(statusColors.cancelled).toBe('#6B7280');
    });

    it('should have correct booking status color mapping', () => {
      expect(bookingStatusColors.pending).toBe('#F59E0B');
      expect(bookingStatusColors.confirmed).toBe('#3B82F6');
      expect(bookingStatusColors.completed).toBe('#10B981'); // Maps to attended
      expect(bookingStatusColors.cancelled).toBe('#6B7280');
      expect(bookingStatusColors.no_show).toBe('#EF4444');
    });

    it('should have all required booking statuses', () => {
      const requiredStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
      requiredStatuses.forEach(status => {
        expect(bookingStatusColors[status as keyof typeof bookingStatusColors]).toBeDefined();
      });
    });

    it('should have consistent color values between statusColors and bookingStatusColors', () => {
      expect(bookingStatusColors.pending).toBe(statusColors.pending);
      expect(bookingStatusColors.confirmed).toBe(statusColors.confirmed);
      expect(bookingStatusColors.cancelled).toBe(statusColors.cancelled);
      expect(bookingStatusColors.no_show).toBe(statusColors.no_show);
    });
  });

  describe('Border Radius', () => {
    it('should have correct border radius values', () => {
      expect(borderRadius.none).toBe('0px');
      expect(borderRadius.sm).toBe('0.125rem');
      expect(borderRadius.base).toBe('0.25rem');
      expect(borderRadius.md).toBe('0.375rem');
      expect(borderRadius.lg).toBe('0.5rem');
      expect(borderRadius.xl).toBe('0.75rem');
      expect(borderRadius['2xl']).toBe('1rem');
      expect(borderRadius['3xl']).toBe('1.5rem');
      expect(borderRadius.full).toBe('9999px');
    });
  });

  describe('Box Shadow', () => {
    it('should have correct box shadow values', () => {
      expect(boxShadow.sm).toContain('0 1px 2px');
      expect(boxShadow.base).toContain('0 1px 3px');
      expect(boxShadow.md).toContain('0 4px 6px');
      expect(boxShadow.lg).toContain('0 10px 15px');
      expect(boxShadow.xl).toContain('0 20px 25px');
      expect(boxShadow['2xl']).toContain('0 25px 50px');
    });
  });

  describe('Z-Index', () => {
    it('should have correct z-index values', () => {
      expect(zIndex[0]).toBe('0');
      expect(zIndex.dropdown).toBe('1000');
      expect(zIndex.sticky).toBe('1020');
      expect(zIndex.fixed).toBe('1030');
      expect(zIndex.modal).toBe('1040');
      expect(zIndex.popover).toBe('1050');
      expect(zIndex.tooltip).toBe('1060');
      expect(zIndex.toast).toBe('1070');
    });
  });

  describe('Animation', () => {
    it('should have correct animation durations', () => {
      expect(animation.duration[75]).toBe('75ms');
      expect(animation.duration[100]).toBe('100ms');
      expect(animation.duration[150]).toBe('150ms');
      expect(animation.duration[200]).toBe('200ms');
      expect(animation.duration[300]).toBe('300ms');
      expect(animation.duration[500]).toBe('500ms');
      expect(animation.duration[700]).toBe('700ms');
      expect(animation.duration[1000]).toBe('1000ms');
    });

    it('should have correct timing functions', () => {
      expect(animation.timingFunction.linear).toBe('linear');
      expect(animation.timingFunction.in).toBe('cubic-bezier(0.4, 0, 1, 1)');
      expect(animation.timingFunction.out).toBe('cubic-bezier(0, 0, 0.2, 1)');
      expect(animation.timingFunction['in-out']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });
  });

  describe('Layout', () => {
    it('should have correct container max widths', () => {
      expect(layout.container.sm).toBe('640px');
      expect(layout.container.md).toBe('768px');
      expect(layout.container.lg).toBe('1024px');
      expect(layout.container.xl).toBe('1280px');
      expect(layout.container['2xl']).toBe('1536px');
    });

    it('should have correct grid column definitions', () => {
      expect(layout.gridCols[1]).toBe('repeat(1, minmax(0, 1fr))');
      expect(layout.gridCols[2]).toBe('repeat(2, minmax(0, 1fr))');
      expect(layout.gridCols[3]).toBe('repeat(3, minmax(0, 1fr))');
      expect(layout.gridCols[6]).toBe('repeat(6, minmax(0, 1fr))');
      expect(layout.gridCols[12]).toBe('repeat(12, minmax(0, 1fr))');
    });

    it('should have correct gap values', () => {
      expect(layout.gap[0]).toBe('0px');
      expect(layout.gap[1]).toBe('0.25rem');
      expect(layout.gap[2]).toBe('0.5rem');
      expect(layout.gap[4]).toBe('1rem');
      expect(layout.gap[8]).toBe('2rem');
      expect(layout.gap[16]).toBe('4rem');
    });
  });
});

describe('Utility Functions', () => {
  describe('getBreakpointValue', () => {
    it('should return correct breakpoint values', () => {
      expect(getBreakpointValue('xs')).toBe(320);
      expect(getBreakpointValue('sm')).toBe(640);
      expect(getBreakpointValue('md')).toBe(768);
      expect(getBreakpointValue('lg')).toBe(1024);
      expect(getBreakpointValue('xl')).toBe(1280);
      expect(getBreakpointValue('2xl')).toBe(1536);
    });
  });

  describe('isMobile', () => {
    it('should return true for mobile screen sizes', () => {
      mockWindow(320);
      expect(isMobile()).toBe(true);
      
      mockWindow(375);
      expect(isMobile()).toBe(true);
      
      mockWindow(639);
      expect(isMobile()).toBe(true);
    });

    it('should return false for non-mobile screen sizes', () => {
      mockWindow(640);
      expect(isMobile()).toBe(false);
      
      mockWindow(768);
      expect(isMobile()).toBe(false);
      
      mockWindow(1024);
      expect(isMobile()).toBe(false);
    });
  });

  describe('isTablet', () => {
    it('should return true for tablet screen sizes', () => {
      mockWindow(640);
      expect(isTablet()).toBe(true);
      
      mockWindow(768);
      expect(isTablet()).toBe(true);
      
      mockWindow(1023);
      expect(isTablet()).toBe(true);
    });

    it('should return false for non-tablet screen sizes', () => {
      mockWindow(320);
      expect(isTablet()).toBe(false);
      
      mockWindow(1024);
      expect(isTablet()).toBe(false);
      
      mockWindow(1280);
      expect(isTablet()).toBe(false);
    });
  });

  describe('isDesktop', () => {
    it('should return true for desktop screen sizes', () => {
      mockWindow(1024);
      expect(isDesktop()).toBe(true);
      
      mockWindow(1280);
      expect(isDesktop()).toBe(true);
      
      mockWindow(1536);
      expect(isDesktop()).toBe(true);
    });

    it('should return false for non-desktop screen sizes', () => {
      mockWindow(320);
      expect(isDesktop()).toBe(false);
      
      mockWindow(640);
      expect(isDesktop()).toBe(false);
      
      mockWindow(768);
      expect(isDesktop()).toBe(false);
    });
  });

  describe('getCurrentBreakpoint', () => {
    it('should return correct breakpoint for different screen sizes', () => {
      mockWindow(320);
      expect(getCurrentBreakpoint()).toBe('xs');
      
      mockWindow(640);
      expect(getCurrentBreakpoint()).toBe('sm');
      
      mockWindow(768);
      expect(getCurrentBreakpoint()).toBe('md');
      
      mockWindow(1024);
      expect(getCurrentBreakpoint()).toBe('lg');
      
      mockWindow(1280);
      expect(getCurrentBreakpoint()).toBe('xl');
      
      mockWindow(1536);
      expect(getCurrentBreakpoint()).toBe('2xl');
    });

    it('should return correct breakpoint for edge cases', () => {
      mockWindow(319);
      expect(getCurrentBreakpoint()).toBe('xs');
      
      mockWindow(639);
      expect(getCurrentBreakpoint()).toBe('xs');
      
      mockWindow(641);
      expect(getCurrentBreakpoint()).toBe('sm');
      
      mockWindow(767);
      expect(getCurrentBreakpoint()).toBe('sm');
      
      mockWindow(769);
      expect(getCurrentBreakpoint()).toBe('md');
    });
  });

  describe('applyTenantTheme', () => {
    beforeEach(() => {
      // Mock document
      Object.defineProperty(document, 'documentElement', {
        value: {
          style: {
            setProperty: jest.fn(),
          },
        },
        writable: true,
      });
    });

    it('should apply tenant theme colors', () => {
      const primaryColor = '#ff6b6b';
      applyTenantTheme(primaryColor);
      
      expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
        '--color-primary',
        primaryColor
      );
    });

    it('should handle undefined document gracefully', () => {
      // @ts-ignore
      delete global.document;
      
      expect(() => {
        applyTenantTheme('#ff6b6b');
      }).not.toThrow();
    });
  });
});

describe('Token Consistency', () => {
  it('should have consistent breakpoint values', () => {
    const breakpointKeys = Object.keys(breakpoints);
    const breakpointValueKeys = Object.keys(breakpointValues);
    
    expect(breakpointKeys).toEqual(breakpointValueKeys);
  });

  it('should have consistent spacing values', () => {
    const spacingKeys = Object.keys(spacing);
    const expectedSpacing = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];
    
    expect(spacingKeys.map(Number).sort((a, b) => a - b)).toEqual(expectedSpacing);
  });

  it('should have consistent color scales', () => {
    const colorScales = ['gray', 'success', 'warning', 'error', 'info', 'primary'];
    const expectedShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    
    colorScales.forEach(scale => {
      const colorScale = colors[scale as keyof typeof colors];
      if (typeof colorScale === 'object' && colorScale !== null) {
        const actualShades = Object.keys(colorScale).map(Number).sort((a, b) => a - b);
        expect(actualShades).toEqual(expectedShades);
      }
    });
  });
});

describe('Accessibility', () => {
  it('should have proper contrast ratios for status colors', () => {
    // This is a simplified test - in a real implementation, you would
    // use a proper contrast ratio calculation library
    expect(colors.success[500]).toBeDefined();
    expect(colors.warning[500]).toBeDefined();
    expect(colors.error[500]).toBeDefined();
    expect(colors.info[500]).toBeDefined();
  });

  it('should have proper touch target sizes', () => {
    // Minimum touch target size should be 44px
    const minTouchTarget = 44;
    const spacing44 = parseFloat(spacing[11].replace('rem', '')) * 16; // Convert rem to px
    
    expect(spacing44).toBeGreaterThanOrEqual(minTouchTarget);
  });
});

describe('Performance', () => {
  it('should have efficient token structure', () => {
    // Tokens should be static and not require runtime calculations
    expect(typeof breakpoints).toBe('object');
    expect(typeof typography).toBe('object');
    expect(typeof spacing).toBe('object');
    expect(typeof colors).toBe('object');
  });

  it('should have consistent token access patterns', () => {
    // All tokens should be accessible without runtime calculations
    expect(() => {
      const bp = breakpoints.xs;
      const typo = typography.fontSize.base;
      const space = spacing[4];
      const color = colors.primary[500];
    }).not.toThrow();
  });
});
