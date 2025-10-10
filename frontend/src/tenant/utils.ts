/**
 * Tenant Resolution Utilities
 * 
 * Provides tenant slug resolution from both path-based and subdomain routing.
 * Memoized for performance and zero extra renders.
 */

import { TenantResolutionResult } from './types';

// Cache for memoized tenant resolution
let cachedResolution: TenantResolutionResult | null = null;
let lastLocation: string | null = null;

/**
 * Get tenant slug from current location
 * Supports both path-based (/v1/b/{slug}) and subdomain routing
 */
export const getTenantSlug = (): string | null => {
  const currentLocation = `${window.location.hostname}${window.location.pathname}`;
  
  // Return cached result if location hasn't changed
  if (cachedResolution && lastLocation === currentLocation) {
    return cachedResolution.slug;
  }
  
  // Resolve tenant from current location
  const resolution = resolveTenantFromLocation();
  
  // Cache the result
  cachedResolution = resolution;
  lastLocation = currentLocation;
  
  return resolution.slug;
};

/**
 * Require tenant slug, throwing error if not found
 */
export const requireTenantSlug = (): string => {
  const slug = getTenantSlug();
  if (!slug) {
    throw new Error('Tenant slug not found in URL or subdomain');
  }
  return slug;
};

/**
 * Resolve tenant from current browser location
 */
export const resolveTenantFromLocation = (): TenantResolutionResult => {
  // Try path-based resolution first (/v1/b/{slug})
  const pathMatch = window.location.pathname.match(/\/v1\/b\/([^\/]+)/);
  if (pathMatch) {
    return {
      slug: pathMatch[1] || null,
      source: 'path',
      isResolved: true
    };
  }
  
  // Try subdomain resolution
  const hostname = window.location.hostname;
  if (hostname.includes('.')) {
    const subdomain = hostname.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      return {
        slug: subdomain,
        source: 'subdomain',
        isResolved: true
      };
    }
  }
  
  return {
    slug: null,
    source: null,
    isResolved: false
  };
};

/**
 * Clear tenant resolution cache
 * Useful for testing or when location changes programmatically
 */
export const clearTenantCache = (): void => {
  cachedResolution = null;
  lastLocation = null;
};

/**
 * Check if current route is a public booking route
 */
export const isPublicBookingRoute = (): boolean => {
  return window.location.pathname.startsWith('/v1/b/');
};

/**
 * Check if current route is an admin route
 */
export const isAdminRoute = (): boolean => {
  return window.location.pathname.startsWith('/admin');
};

/**
 * Check if current route is a landing/auth route
 */
export const isLandingRoute = (): boolean => {
  const path = window.location.pathname;
  return path === '/' || path.startsWith('/auth');
};
