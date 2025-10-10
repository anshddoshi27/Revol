/**
 * Apply Tenant Theme Utility Tests
 * 
 * Comprehensive tests for tenant theme application utilities including
 * color scale generation, contrast validation, and CSS custom property injection.
 */

import {
  applyTenantTheme,
  applyTheme,
  resetTheme,
  getCurrentTheme,
  generateColorScale,
  validateContrast,
  getTextColor,
  type TenantTheme,
  type ColorScale,
  type ContrastResult,
} from '../applyTenantTheme';
import type { Tenant } from '../../api/types';

// ===== MOCK SETUP =====

// Mock document and window
const mockDocument = {
  documentElement: {
    style: {
      setProperty: jest.fn(),
      removeProperty: jest.fn(),
    },
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
  },
};

const mockWindow = {
  dispatchEvent: jest.fn(),
};

// Mock getComputedStyle
const mockGetComputedStyle = jest.fn();

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  
  // Setup global mocks
  Object.defineProperty(global, 'document', {
    value: mockDocument,
    writable: true,
  });
  
  Object.defineProperty(global, 'window', {
    value: mockWindow,
    writable: true,
  });
  
  Object.defineProperty(global, 'getComputedStyle', {
    value: mockGetComputedStyle,
    writable: true,
  });
});

// ===== TEST DATA =====

const mockTenant: Tenant = {
  id: 'test-tenant-id',
  slug: 'test-tenant',
  name: 'Test Tenant',
  description: 'Test Description',
  timezone: 'UTC',
  primary_color: '#3B82F6',
  logo_url: 'https://example.com/logo.png',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockTheme: TenantTheme = {
  primaryColor: '#FF6B6B',
  logoUrl: 'https://example.com/theme-logo.png',
  secondaryColor: '#4ECDC4',
  fontFamily: 'Inter, sans-serif',
};

// ===== COLOR SCALE GENERATION TESTS =====

describe('generateColorScale', () => {
  it('should generate a complete color scale from primary color', () => {
    const colorScale = generateColorScale('#3B82F6');
    
    expect(colorScale).toHaveProperty('50');
    expect(colorScale).toHaveProperty('100');
    expect(colorScale).toHaveProperty('200');
    expect(colorScale).toHaveProperty('300');
    expect(colorScale).toHaveProperty('400');
    expect(colorScale).toHaveProperty('500');
    expect(colorScale).toHaveProperty('600');
    expect(colorScale).toHaveProperty('700');
    expect(colorScale).toHaveProperty('800');
    expect(colorScale).toHaveProperty('900');
    expect(colorScale).toHaveProperty('950');
  });

  it('should generate valid hex colors', () => {
    const colorScale = generateColorScale('#3B82F6');
    
    Object.values(colorScale).forEach(color => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should throw error for invalid color format', () => {
    expect(() => generateColorScale('invalid-color')).toThrow('Invalid color format');
    expect(() => generateColorScale('#GGGGGG')).toThrow('Invalid color format');
    expect(() => generateColorScale('')).toThrow('Invalid color format');
  });

  it('should generate different shades for different lightness values', () => {
    const colorScale = generateColorScale('#3B82F6');
    
    // 50 should be lighter than 500
    expect(colorScale[50]).not.toBe(colorScale[500]);
    // 900 should be darker than 500
    expect(colorScale[900]).not.toBe(colorScale[500]);
  });
});

// ===== CONTRAST VALIDATION TESTS =====

describe('validateContrast', () => {
  it('should validate high contrast combinations', () => {
    const result = validateContrast('#000000', '#FFFFFF');
    
    expect(result.ratio).toBeGreaterThan(20);
    expect(result.passesAA).toBe(true);
    expect(result.passesAAA).toBe(true);
    expect(result.level).toBe('AAA');
  });

  it('should validate low contrast combinations', () => {
    const result = validateContrast('#CCCCCC', '#DDDDDD');
    
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.passesAA).toBe(false);
    expect(result.passesAAA).toBe(false);
    expect(result.level).toBe('FAIL');
  });

  it('should validate medium contrast combinations', () => {
    const result = validateContrast('#666666', '#FFFFFF');
    
    expect(result.ratio).toBeGreaterThan(4.5);
    expect(result.ratio).toBeLessThan(7);
    expect(result.passesAA).toBe(true);
    expect(result.passesAAA).toBe(false);
    expect(result.level).toBe('AA');
  });

  it('should handle edge cases', () => {
    // Same color
    const sameColorResult = validateContrast('#FF0000', '#FF0000');
    expect(sameColorResult.ratio).toBe(1);
    expect(sameColorResult.passesAA).toBe(false);
    
    // Invalid colors should not throw
    expect(() => validateContrast('invalid', '#FFFFFF')).not.toThrow();
  });
});

// ===== TEXT COLOR UTILITIES =====

describe('getTextColor', () => {
  it('should return white for dark backgrounds', () => {
    expect(getTextColor('#000000')).toBe('#ffffff');
    expect(getTextColor('#333333')).toBe('#ffffff');
  });

  it('should return black for light backgrounds', () => {
    expect(getTextColor('#FFFFFF')).toBe('#000000');
    expect(getTextColor('#CCCCCC')).toBe('#000000');
  });

  it('should handle edge cases', () => {
    // Medium gray should return the color with better contrast
    const result = getTextColor('#808080');
    expect(['#ffffff', '#000000']).toContain(result);
  });
});

// ===== THEME APPLICATION TESTS =====

describe('applyTenantTheme', () => {
  it('should apply tenant theme to document', () => {
    applyTenantTheme(mockTenant);
    
    // Should set primary color
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary',
      '#3B82F6'
    );
    
    // Should set logo URL
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--logo-url',
      'url(https://example.com/logo.png)'
    );
    
    // Should set tenant attribute
    expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith(
      'data-tenant',
      'test-tenant'
    );
  });

  it('should generate and apply color scale', () => {
    applyTenantTheme(mockTenant);
    
    // Should set color scale properties
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary-50',
      expect.any(String)
    );
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary-500',
      expect.any(String)
    );
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary-950',
      expect.any(String)
    );
  });

  it('should handle tenant without logo', () => {
    const tenantWithoutLogo = { ...mockTenant, logo_url: undefined };
    applyTenantTheme(tenantWithoutLogo);
    
    // Should remove logo URL property
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--logo-url'
    );
  });

  it('should emit theme application event', () => {
    applyTenantTheme(mockTenant);
    
    expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tenant-theme-applied',
        detail: expect.objectContaining({
          tenantId: 'test-tenant-id',
          tenantSlug: 'test-tenant',
          primaryColor: '#3B82F6',
        })
      })
    );
  });

  it('should handle errors gracefully', () => {
    // Mock generateColorScale to throw
    const originalGenerateColorScale = generateColorScale;
    jest.spyOn(require('../applyTenantTheme'), 'generateColorScale').mockImplementation(() => {
      throw new Error('Color generation failed');
    });
    
    applyTenantTheme(mockTenant);
    
    // Should emit error event
    expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tenant-theme-error',
        detail: expect.objectContaining({
          tenantId: 'test-tenant-id',
          error: 'Color generation failed',
        })
      })
    );
    
    // Restore original function
    jest.spyOn(require('../applyTenantTheme'), 'generateColorScale').mockImplementation(originalGenerateColorScale);
  });

  it('should handle SSR environment', () => {
    // Mock undefined document
    const originalDocument = global.document;
    // @ts-ignore
    delete global.document;
    
    expect(() => applyTenantTheme(mockTenant)).not.toThrow();
    
    // Restore document
    global.document = originalDocument;
  });
});

// ===== THEME APPLICATION TESTS =====

describe('applyTheme', () => {
  it('should apply theme object to document', () => {
    applyTheme(mockTheme);
    
    // Should set primary color
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary',
      '#FF6B6B'
    );
    
    // Should set secondary color
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-secondary',
      '#4ECDC4'
    );
    
    // Should set logo URL
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--logo-url',
      'url(https://example.com/theme-logo.png)'
    );
    
    // Should set font family
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--font-family-primary',
      'Inter, sans-serif'
    );
  });

  it('should handle partial theme object', () => {
    const partialTheme = { primaryColor: '#FF6B6B' };
    applyTheme(partialTheme);
    
    // Should set primary color
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary',
      '#FF6B6B'
    );
    
    // Should not set optional properties
    expect(mockDocument.documentElement.style.setProperty).not.toHaveBeenCalledWith(
      '--color-secondary',
      expect.any(String)
    );
  });

  it('should handle SSR environment', () => {
    // Mock undefined document
    const originalDocument = global.document;
    // @ts-ignore
    delete global.document;
    
    expect(() => applyTheme(mockTheme)).not.toThrow();
    
    // Restore document
    global.document = originalDocument;
  });
});

// ===== THEME RESET TESTS =====

describe('resetTheme', () => {
  it('should remove all custom properties', () => {
    resetTheme();
    
    // Should remove primary color
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--color-primary'
    );
    
    // Should remove logo URL
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--logo-url'
    );
    
    // Should remove color scale properties
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--color-primary-50'
    );
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--color-primary-500'
    );
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--color-primary-950'
    );
    
    // Should remove tenant attribute
    expect(mockDocument.documentElement.removeAttribute).toHaveBeenCalledWith(
      'data-tenant'
    );
  });

  it('should handle SSR environment', () => {
    // Mock undefined document
    const originalDocument = global.document;
    // @ts-ignore
    delete global.document;
    
    expect(() => resetTheme()).not.toThrow();
    
    // Restore document
    global.document = originalDocument;
  });
});

// ===== CURRENT THEME TESTS =====

describe('getCurrentTheme', () => {
  it('should return current theme from CSS properties', () => {
    mockGetComputedStyle.mockReturnValue({
      getPropertyValue: jest.fn((prop) => {
        const values: Record<string, string> = {
          '--color-primary': '#FF6B6B',
          '--color-secondary': '#4ECDC4',
          '--logo-url': 'url(https://example.com/logo.png)',
          '--font-family-primary': 'Inter, sans-serif',
        };
        return values[prop] || '';
      }),
    });
    
    const currentTheme = getCurrentTheme();
    
    expect(currentTheme).toEqual({
      primaryColor: '#FF6B6B',
      secondaryColor: '#4ECDC4',
      logoUrl: 'https://example.com/logo.png',
      fontFamily: 'Inter, sans-serif',
    });
  });

  it('should return empty object for SSR environment', () => {
    // Mock undefined document
    const originalDocument = global.document;
    // @ts-ignore
    delete global.document;
    
    const currentTheme = getCurrentTheme();
    expect(currentTheme).toEqual({});
    
    // Restore document
    global.document = originalDocument;
  });

  it('should handle empty CSS properties', () => {
    mockGetComputedStyle.mockReturnValue({
      getPropertyValue: jest.fn(() => ''),
    });
    
    const currentTheme = getCurrentTheme();
    
    expect(currentTheme).toEqual({
      primaryColor: undefined,
      secondaryColor: undefined,
      logoUrl: undefined,
      fontFamily: undefined,
    });
  });
});

// ===== INTEGRATION TESTS =====

describe('Theme Application Integration', () => {
  it('should work with complete theme workflow', () => {
    // Apply theme
    applyTenantTheme(mockTenant);
    
    // Verify properties were set
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary',
      '#3B82F6'
    );
    
    // Reset theme
    resetTheme();
    
    // Verify properties were removed
    expect(mockDocument.documentElement.style.removeProperty).toHaveBeenCalledWith(
      '--color-primary'
    );
  });

  it('should handle theme switching', () => {
    // Apply first theme
    applyTenantTheme(mockTenant);
    
    // Apply second theme
    const secondTenant = { ...mockTenant, primary_color: '#FF6B6B' };
    applyTenantTheme(secondTenant);
    
    // Should set new primary color
    expect(mockDocument.documentElement.style.setProperty).toHaveBeenCalledWith(
      '--color-primary',
      '#FF6B6B'
    );
  });
});

// ===== ERROR HANDLING TESTS =====

describe('Error Handling', () => {
  it('should handle invalid tenant data', () => {
    const invalidTenant = { ...mockTenant, primary_color: 'invalid-color' };
    
    expect(() => applyTenantTheme(invalidTenant)).not.toThrow();
    
    // Should emit error event
    expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tenant-theme-error',
      })
    );
  });

  it('should handle missing window object', () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;
    
    expect(() => applyTenantTheme(mockTenant)).not.toThrow();
    
    // Restore window
    global.window = originalWindow;
  });
});
