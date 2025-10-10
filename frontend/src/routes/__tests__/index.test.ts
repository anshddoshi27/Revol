/**
 * Route Definitions Tests
 * 
 * Tests for route configuration and validation utilities.
 */

import { 
  routes, 
  routePatterns, 
  matchesRoute, 
  extractTenantSlugFromPath, 
  requiresAuth, 
  requiresTenant 
} from '../index';

describe('Route Definitions', () => {
  describe('routes', () => {
    it('should have correct route definitions', () => {
      expect(routes.public).toBe('/v1/:slug/*');
      expect(routes.landing).toBe('/');
      expect(routes.auth.signUp).toBe('/auth/sign-up');
      expect(routes.admin.dashboard).toBe('/admin');
      expect(routes.booking.services).toBe('/v1/:slug/services');
    });
  });

  describe('routePatterns', () => {
    it('should have correct regex patterns', () => {
      expect(routePatterns.publicBooking.test('/v1/b/acme-salon')).toBe(true);
      expect(routePatterns.publicBooking.test('/v1/b/acme-salon/services')).toBe(true);
      expect(routePatterns.publicBooking.test('/admin')).toBe(false);
      
      expect(routePatterns.adminRoute.test('/admin')).toBe(true);
      expect(routePatterns.adminRoute.test('/admin/dashboard')).toBe(true);
      expect(routePatterns.adminRoute.test('/v1/b/acme-salon')).toBe(false);
      
      expect(routePatterns.authRoute.test('/auth/sign-up')).toBe(true);
      expect(routePatterns.authRoute.test('/auth/sign-in')).toBe(true);
      expect(routePatterns.authRoute.test('/admin')).toBe(false);
      
      expect(routePatterns.landingRoute.test('/')).toBe(true);
      expect(routePatterns.landingRoute.test('/admin')).toBe(false);
    });
  });

  describe('matchesRoute', () => {
    it('should match routes correctly', () => {
      expect(matchesRoute('/v1/b/acme-salon', routePatterns.publicBooking)).toBe(true);
      expect(matchesRoute('/admin/dashboard', routePatterns.adminRoute)).toBe(true);
      expect(matchesRoute('/auth/sign-up', routePatterns.authRoute)).toBe(true);
      expect(matchesRoute('/', routePatterns.landingRoute)).toBe(true);
      
      expect(matchesRoute('/admin', routePatterns.publicBooking)).toBe(false);
      expect(matchesRoute('/v1/b/acme-salon', routePatterns.adminRoute)).toBe(false);
    });
  });

  describe('extractTenantSlugFromPath', () => {
    it('should extract tenant slug from public booking routes', () => {
      expect(extractTenantSlugFromPath('/v1/b/acme-salon')).toBe('acme-salon');
      expect(extractTenantSlugFromPath('/v1/b/acme-salon/services')).toBe('acme-salon');
      expect(extractTenantSlugFromPath('/v1/b/test-salon/checkout')).toBe('test-salon');
    });

    it('should return null for non-public booking routes', () => {
      expect(extractTenantSlugFromPath('/admin')).toBe(null);
      expect(extractTenantSlugFromPath('/auth/sign-up')).toBe(null);
      expect(extractTenantSlugFromPath('/')).toBe(null);
    });
  });

  describe('requiresAuth', () => {
    it('should return true for admin routes', () => {
      expect(requiresAuth('/admin')).toBe(true);
      expect(requiresAuth('/admin/dashboard')).toBe(true);
      expect(requiresAuth('/admin/services')).toBe(true);
    });

    it('should return false for non-admin routes', () => {
      expect(requiresAuth('/v1/b/acme-salon')).toBe(false);
      expect(requiresAuth('/auth/sign-up')).toBe(false);
      expect(requiresAuth('/')).toBe(false);
    });
  });

  describe('requiresTenant', () => {
    it('should return true for public booking routes', () => {
      expect(requiresTenant('/v1/b/acme-salon')).toBe(true);
      expect(requiresTenant('/v1/b/acme-salon/services')).toBe(true);
    });

    it('should return true for admin routes', () => {
      expect(requiresTenant('/admin')).toBe(true);
      expect(requiresTenant('/admin/dashboard')).toBe(true);
    });

    it('should return false for auth and landing routes', () => {
      expect(requiresTenant('/auth/sign-up')).toBe(false);
      expect(requiresTenant('/')).toBe(false);
    });
  });
});
