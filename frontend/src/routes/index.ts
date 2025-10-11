/**
 * Route Definitions
 * 
 * Centralized route configuration for the multi-tenant application.
 * Supports both public booking and admin routes.
 */

export const routes = {
  // Public routes
  public: '/v1/:slug/*',
  landing: '/',
  
  // Authentication routes
  auth: {
    signUp: '/auth/sign-up',
    signIn: '/auth/sign-in',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
  
  // Admin routes (require authentication and tenant context)
  admin: {
    dashboard: '/admin',
    onboarding: '/admin/onboarding',
    services: '/admin/services',
    availability: '/admin/availability',
    bookings: '/admin/bookings',
    notifications: '/admin/notifications',
    branding: '/admin/branding',
    analytics: '/admin/analytics',
    settings: '/admin/settings',
  },
  
  // Public booking routes (require tenant context only)
  booking: {
    services: '/v1/:slug/services',
    availability: '/v1/:slug/availability',
    checkout: '/v1/:slug/checkout',
    confirmation: '/v1/:slug/confirmation',
  },
} as const;

/**
 * Route patterns for validation and matching
 */
export const routePatterns = {
  publicBooking: /^\/v1\/b\/([^\/]+)(?:\/.*)?$/,
  adminRoute: /^\/admin(?:\/.*)?$/,
  authRoute: /^\/auth(?:\/.*)?$/,
  landingRoute: /^\/$/,
} as const;

/**
 * Check if a path matches a route pattern
 */
export const matchesRoute = (path: string, pattern: RegExp): boolean => {
  return pattern.test(path);
};

/**
 * Extract tenant slug from public booking route
 */
export const extractTenantSlugFromPath = (path: string): string | null => {
  const match = path.match(routePatterns.publicBooking);
  return match ? match[1] || null : null;
};

/**
 * Check if route requires authentication
 */
export const requiresAuth = (path: string): boolean => {
  return matchesRoute(path, routePatterns.adminRoute);
};

/**
 * Check if route requires tenant context
 */
export const requiresTenant = (path: string): boolean => {
  return matchesRoute(path, routePatterns.publicBooking) || 
         matchesRoute(path, routePatterns.adminRoute);
};
