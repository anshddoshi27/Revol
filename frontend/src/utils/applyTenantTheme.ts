/**
 * Tenant Theme Application Utilities
 * 
 * This module provides utilities for applying tenant-specific branding and themes
 * to the application. It handles CSS custom property injection, color scale generation,
 * and contrast validation to ensure accessible and consistent theming across the platform.
 * 
 * SHA-256 Hash: b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9
 */

import type { Tenant } from '../api/types';

// ===== TYPES =====

export interface TenantTheme {
  primaryColor: string;
  logoUrl?: string;
  secondaryColor?: string;
  fontFamily?: string;
}

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  level: 'AA' | 'AAA' | 'FAIL';
}

// ===== COLOR UTILITIES =====

/**
 * Convert hex color to RGB values
 */
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1] || '0', 16),
    g: parseInt(result[2] || '0', 16),
    b: parseInt(result[3] || '0', 16)
  } : null;
};

/**
 * Convert RGB values to hex color
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

/**
 * Convert RGB to HSL
 */
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 };
};

/**
 * Convert HSL to RGB
 */
const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360;
  s /= 100;
  l /= 100;
  
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
};

/**
 * Calculate relative luminance of a color
 */
const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * (rs || 0) + 0.7152 * (gs || 0) + 0.0722 * (bs || 0);
};

/**
 * Calculate contrast ratio between two colors
 */
const getContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 1;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Validate contrast ratio against WCAG standards
 */
export const validateContrast = (foreground: string, background: string): ContrastResult => {
  const ratio = getContrastRatio(foreground, background);
  const passesAA = ratio >= 4.5;
  const passesAAA = ratio >= 7;
  
  let level: 'AA' | 'AAA' | 'FAIL';
  if (passesAAA) level = 'AAA';
  else if (passesAA) level = 'AA';
  else level = 'FAIL';
  
  return { ratio, passesAA, passesAAA, level };
};

/**
 * Generate a color scale from a primary color
 */
export const generateColorScale = (primaryColor: string): ColorScale => {
  const rgb = hexToRgb(primaryColor);
  if (!rgb) {
    throw new Error(`Invalid color format: ${primaryColor}`);
  }
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  
  // Generate color scale by adjusting lightness
  const lightnessValues = [95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];
  
  return lightnessValues.reduce((scale, lightness, index) => {
    const shade = (index * 100) as keyof ColorScale;
    const newRgb = hslToRgb(hsl.h, hsl.s, lightness);
    scale[shade] = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    return scale;
  }, {} as ColorScale);
};

/**
 * Get appropriate text color for a background color
 */
export const getTextColor = (backgroundColor: string): string => {
  const whiteContrast = getContrastRatio(backgroundColor, '#ffffff');
  const blackContrast = getContrastRatio(backgroundColor, '#000000');
  
  // Return the color with better contrast (AA standard is 4.5:1)
  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
};

// ===== THEME APPLICATION =====

/**
 * Apply tenant theme to the document
 */
export const applyTenantTheme = (tenant: Tenant): void => {
  if (typeof document === 'undefined') {
    console.warn('applyTenantTheme: document is not available (SSR)');
    return;
  }
  
  const root = document.documentElement;
  
  try {
    // Generate color scale from primary color
    const colorScale = generateColorScale(tenant.primary_color);
    
    // Apply CSS custom properties for color scale
    Object.entries(colorScale).forEach(([shade, color]) => {
      root.style.setProperty(`--color-primary-${shade}`, color);
    });
    
    // Set primary color
    root.style.setProperty('--color-primary', tenant.primary_color);
    
    // Set logo URL if available
    if (tenant.logo_url) {
      root.style.setProperty('--logo-url', `url(${tenant.logo_url})`);
    } else {
      root.style.removeProperty('--logo-url');
    }
    
    // Set tenant slug for CSS targeting
    root.setAttribute('data-tenant', tenant.slug);
    
    // Validate contrast and warn if needed
    const textColor = getTextColor(tenant.primary_color);
    const contrastResult = validateContrast(textColor, tenant.primary_color);
    
    if (!contrastResult.passesAA) {
      console.warn(
        `Low contrast ratio (${contrastResult.ratio.toFixed(2)}:1) for primary color ${tenant.primary_color}. ` +
        `Consider using a different color for better accessibility.`
      );
    }
    
    // Emit theme application event for analytics
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('tenant-theme-applied', {
        detail: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          primaryColor: tenant.primary_color,
          contrastRatio: contrastResult.ratio,
          contrastLevel: contrastResult.level,
        }
      }));
    }
    
  } catch (error) {
    console.error('Failed to apply tenant theme:', error);
    
    // Emit error event for monitoring
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('tenant-theme-error', {
        detail: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }));
    }
  }
};

/**
 * Apply theme from theme object
 */
export const applyTheme = (theme: TenantTheme): void => {
  if (typeof document === 'undefined') {
    console.warn('applyTheme: document is not available (SSR)');
    return;
  }
  
  const root = document.documentElement;
  
  try {
    // Generate color scale from primary color
    const colorScale = generateColorScale(theme.primaryColor);
    
    // Apply CSS custom properties for color scale
    Object.entries(colorScale).forEach(([shade, color]) => {
      root.style.setProperty(`--color-primary-${shade}`, color);
    });
    
    // Set primary color
    root.style.setProperty('--color-primary', theme.primaryColor);
    
    // Set secondary color if provided
    if (theme.secondaryColor) {
      root.style.setProperty('--color-secondary', theme.secondaryColor);
    }
    
    // Set logo URL if available
    if (theme.logoUrl) {
      root.style.setProperty('--logo-url', `url(${theme.logoUrl})`);
    } else {
      root.style.removeProperty('--logo-url');
    }
    
    // Set font family if provided
    if (theme.fontFamily) {
      root.style.setProperty('--font-family-primary', theme.fontFamily);
    }
    
    // Validate contrast and warn if needed
    const textColor = getTextColor(theme.primaryColor);
    const contrastResult = validateContrast(textColor, theme.primaryColor);
    
    if (!contrastResult.passesAA) {
      console.warn(
        `Low contrast ratio (${contrastResult.ratio.toFixed(2)}:1) for primary color ${theme.primaryColor}. ` +
        `Consider using a different color for better accessibility.`
      );
    }
    
  } catch (error) {
    console.error('Failed to apply theme:', error);
  }
};

/**
 * Reset theme to default values
 */
export const resetTheme = (): void => {
  if (typeof document === 'undefined') {
    console.warn('resetTheme: document is not available (SSR)');
    return;
  }
  
  const root = document.documentElement;
  
  // Remove all custom properties
  const customProperties = [
    '--color-primary',
    '--color-secondary',
    '--logo-url',
    '--font-family-primary',
  ];
  
  // Remove color scale properties
  for (let i = 0; i <= 950; i += 50) {
    customProperties.push(`--color-primary-${i}`);
  }
  
  customProperties.forEach(prop => {
    root.style.removeProperty(prop);
  });
  
  // Remove tenant attribute
  root.removeAttribute('data-tenant');
};

/**
 * Get current theme from CSS custom properties
 */
export const getCurrentTheme = (): Partial<TenantTheme> => {
  if (typeof document === 'undefined') {
    return {};
  }
  
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  
  const primaryColor = computedStyle.getPropertyValue('--color-primary').trim();
  const secondaryColor = computedStyle.getPropertyValue('--color-secondary').trim();
  const logoUrl = computedStyle.getPropertyValue('--logo-url').trim();
  const fontFamily = computedStyle.getPropertyValue('--font-family-primary').trim();
  
  return {
    primaryColor: primaryColor || '',
    secondaryColor: secondaryColor || '',
    logoUrl: logoUrl ? logoUrl.replace(/^url\(|\)$/g, '') : '',
    fontFamily: fontFamily || '',
  };
};

// ===== EXPORTS =====

export default {
  applyTenantTheme,
  applyTheme,
  resetTheme,
  getCurrentTheme,
  generateColorScale,
  validateContrast,
  getTextColor,
};
