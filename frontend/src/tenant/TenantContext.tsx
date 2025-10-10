/**
 * Tenant Context Provider
 * 
 * Provides tenant context to the entire application with memoized resolution
 * to prevent extra renders and ensure tenant isolation.
 */

import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { TenantContext as TenantContextType, TenantProviderProps } from './types';
import { resolveTenantFromLocation } from './utils';
// import { telemetry } from '@/observability';

const TenantContext = createContext<TenantContextType | null>(null);

/**
 * Tenant Provider Component
 * 
 * Provides tenant context with memoized resolution to prevent extra renders.
 * Emits telemetry events for tenant resolution tracking.
 */
export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const context = useMemo(() => {
    const resolution = resolveTenantFromLocation();
    
    return {
      slug: resolution.slug || '',
      isResolved: resolution.isResolved,
      source: resolution.source || 'path',
    };
  }, []);

  // Emit telemetry event when tenant is resolved
  useEffect(() => {
    if (context.isResolved && context.slug) {
      // telemetry.track('routing.tenant_resolved', {
      //   slug: context.slug,
      //   source: context.source,
      //   timestamp: Date.now(),
      // });
    }
  }, [context.slug, context.isResolved, context.source]);

  return (
    <TenantContext.Provider value={context}>
      {children}
    </TenantContext.Provider>
  );
};

/**
 * Hook to get tenant slug
 * Returns null if no tenant is resolved
 */
export const useTenantSlug = (): string | null => {
  const context = useContext(TenantContext);
  return context?.slug || null;
};

/**
 * Hook to require tenant slug
 * Throws error if no tenant is resolved
 */
export const requireTenantSlug = (): string => {
  const slug = useTenantSlug();
  if (!slug) {
    throw new Error('Tenant slug not found in URL or subdomain');
  }
  return slug;
};

/**
 * Hook to get full tenant context
 */
export const useTenantContext = (): TenantContextType | null => {
  return useContext(TenantContext);
};

/**
 * Hook to check if tenant is resolved
 */
export const useTenantResolved = (): boolean => {
  const context = useContext(TenantContext);
  return context?.isResolved || false;
};
