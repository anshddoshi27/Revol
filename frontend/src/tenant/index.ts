/**
 * Tenant Module Exports
 * 
 * Centralized exports for all tenant-related functionality.
 */

// Types
export type { 
  TenantContext, 
  TenantResolutionResult, 
  RouteGuardProps, 
  TenantProviderProps 
} from './types';

// Context and Hooks
export { 
  TenantProvider, 
  useTenantSlug, 
  requireTenantSlug, 
  useTenantContext, 
  useTenantResolved 
} from './TenantContext';

// Route Guards
export { 
  AuthGuard, 
  TenantGuard, 
  ProtectedRoute, 
  PublicRoute 
} from './RouteGuards';

// Utilities
export { 
  getTenantSlug, 
  requireTenantSlug as requireTenantSlugUtil, 
  resolveTenantFromLocation, 
  clearTenantCache, 
  isPublicBookingRoute, 
  isAdminRoute, 
  isLandingRoute 
} from './utils';
