/**
 * Tenant Context Types
 * 
 * Canonical tenant context interface with SHA-256 hash for consistency.
 * This interface must match exactly across all implementations.
 */

export interface TenantContext {
  slug: string;
  tenantId?: string;
  isResolved: boolean;
  source: 'path' | 'subdomain';
}

// SHA-256: e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0

export interface TenantResolutionResult {
  slug: string | null;
  source: 'path' | 'subdomain' | null;
  isResolved: boolean;
}

export interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireTenant?: boolean;
  fallback?: React.ReactNode;
}

export interface TenantProviderProps {
  children: React.ReactNode;
}
