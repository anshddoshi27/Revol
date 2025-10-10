/**
 * Tenant Utilities Tests
 * 
 * Comprehensive tests for tenant resolution utilities.
 */

import { 
  getTenantSlug, 
  requireTenantSlug, 
  resolveTenantFromLocation, 
  clearTenantCache,
  isPublicBookingRoute,
  isAdminRoute,
  isLandingRoute
} from '../utils';

// Mock window.location
const mockLocation = (hostname: string, pathname: string) => {
  Object.defineProperty(window, 'location', {
    value: {
      hostname,
      pathname,
    },
    writable: true,
  });
};

describe('Tenant Utilities', () => {
  beforeEach(() => {
    clearTenantCache();
  });

  describe('getTenantSlug', () => {
    it('should resolve tenant from path-based routing', () => {
      mockLocation('tithi.com', '/v1/b/acme-salon');
      expect(getTenantSlug()).toBe('acme-salon');
    });

    it('should resolve tenant from subdomain routing', () => {
      mockLocation('acme-salon.tithi.com', '/');
      expect(getTenantSlug()).toBe('acme-salon');
    });

    it('should return null for www subdomain', () => {
      mockLocation('www.tithi.com', '/');
      expect(getTenantSlug()).toBe(null);
    });

    it('should return null for api subdomain', () => {
      mockLocation('api.tithi.com', '/');
      expect(getTenantSlug()).toBe(null);
    });

    it('should return null when no tenant found', () => {
      mockLocation('www.example.com', '/');
      expect(getTenantSlug()).toBe(null);
    });

    it('should cache results for performance', () => {
      mockLocation('tithi.com', '/v1/b/test-salon');
      const firstCall = getTenantSlug();
      const secondCall = getTenantSlug();
      expect(firstCall).toBe(secondCall);
      expect(firstCall).toBe('test-salon');
    });
  });

  describe('requireTenantSlug', () => {
    it('should return slug when tenant is resolved', () => {
      mockLocation('tithi.com', '/v1/b/acme-salon');
      expect(requireTenantSlug()).toBe('acme-salon');
    });

    it('should throw error when no tenant found', () => {
      mockLocation('www.example.com', '/');
      expect(() => requireTenantSlug()).toThrow('Tenant slug not found in URL or subdomain');
    });
  });

  describe('resolveTenantFromLocation', () => {
    it('should resolve from path with correct source', () => {
      mockLocation('tithi.com', '/v1/b/acme-salon');
      const result = resolveTenantFromLocation();
      expect(result).toEqual({
        slug: 'acme-salon',
        source: 'path',
        isResolved: true
      });
    });

    it('should resolve from subdomain with correct source', () => {
      mockLocation('acme-salon.tithi.com', '/');
      const result = resolveTenantFromLocation();
      expect(result).toEqual({
        slug: 'acme-salon',
        source: 'subdomain',
        isResolved: true
      });
    });

    it('should return unresolved state when no tenant found', () => {
      mockLocation('www.example.com', '/');
      const result = resolveTenantFromLocation();
      expect(result).toEqual({
        slug: null,
        source: null,
        isResolved: false
      });
    });
  });

  describe('Route Detection', () => {
    it('should detect public booking routes', () => {
      mockLocation('tithi.com', '/v1/b/acme-salon/services');
      expect(isPublicBookingRoute()).toBe(true);
    });

    it('should detect admin routes', () => {
      mockLocation('tithi.com', '/admin/dashboard');
      expect(isAdminRoute()).toBe(true);
    });

    it('should detect landing routes', () => {
      mockLocation('tithi.com', '/');
      expect(isLandingRoute()).toBe(true);
    });

    it('should detect auth routes as landing routes', () => {
      mockLocation('tithi.com', '/auth/sign-up');
      expect(isLandingRoute()).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', () => {
      mockLocation('tithi.com', '/v1/b/test-salon');
      getTenantSlug(); // Populate cache
      clearTenantCache();
      
      // Change location and verify cache is cleared
      mockLocation('tithi.com', '/v1/b/different-salon');
      expect(getTenantSlug()).toBe('different-salon');
    });
  });
});
