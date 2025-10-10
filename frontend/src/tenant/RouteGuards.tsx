/**
 * Route Guards
 * 
 * Provides route protection for admin routes and tenant-specific functionality.
 * Blocks unauthenticated users and ensures proper tenant context.
 */

import React, { useEffect, useState } from 'react';
import { RouteGuardProps } from './types';
import { useTenantContext, useTenantResolved } from './TenantContext';
// import { telemetry } from '@/observability';
import { getToken } from '@/lib/env';

/**
 * Authentication Guard
 * Blocks access to routes that require authentication
 */
export const AuthGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  requireAuth = true, 
  fallback = <div>Access denied. Please log in.</div> 
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = getToken();
      const authenticated = !!token;
      setIsAuthenticated(authenticated);
      
      if (requireAuth && !authenticated) {
        // telemetry.track('routing.guard_blocked', {
        //   reason: 'authentication_required',
        //   route: window.location.pathname,
        //   timestamp: Date.now(),
        // });
      } else if (requireAuth && authenticated) {
        // telemetry.track('routing.guard_passed', {
        //   reason: 'authenticated',
        //   route: window.location.pathname,
        //   timestamp: Date.now(),
        // });
      }
    };

    checkAuth();
  }, [requireAuth]);

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return <div>Loading...</div>;
  }

  // Block access if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Tenant Guard
 * Blocks access to routes that require tenant context
 */
export const TenantGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  requireTenant = true, 
  fallback = <div>Business not found.</div> 
}) => {
  const tenantContext = useTenantContext();
  const isResolved = useTenantResolved();

  useEffect(() => {
    if (requireTenant && !isResolved) {
      // telemetry.track('routing.guard_blocked', {
      //   reason: 'tenant_required',
      //   route: window.location.pathname,
      //   timestamp: Date.now(),
      // });
    } else if (requireTenant && isResolved) {
      // telemetry.track('routing.guard_passed', {
      //   reason: 'tenant_resolved',
      //   route: window.location.pathname,
      //   tenant_slug: tenantContext?.slug,
      //   timestamp: Date.now(),
      // });
    }
  }, [requireTenant, isResolved, tenantContext?.slug]);

  // Block access if tenant is required but not resolved
  if (requireTenant && !isResolved) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Combined Guard
 * Provides both authentication and tenant protection
 */
export const ProtectedRoute: React.FC<RouteGuardProps> = ({ 
  children, 
  requireAuth = true, 
  requireTenant = true, 
  fallback 
}) => {
  return (
    <AuthGuard requireAuth={requireAuth} fallback={fallback}>
      <TenantGuard requireTenant={requireTenant} fallback={fallback}>
        {children}
      </TenantGuard>
    </AuthGuard>
  );
};

/**
 * Public Route Guard
 * Ensures routes are accessible without authentication
 */
export const PublicRoute: React.FC<RouteGuardProps> = ({ children }) => {
  return <>{children}</>;
};
