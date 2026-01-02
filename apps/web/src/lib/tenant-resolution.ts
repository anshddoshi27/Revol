import type { NextRequest } from 'next/server';
import { extractTenantSlug, CUSTOMER_DOMAIN_SUFFIX } from './domain-utils';

/**
 * Resolve tenant slug from request
 * 
 * Supports two methods:
 * 1. From Host header (for subdomain-based routing: {businessname}.main.tld)
 * 2. From URL parameter (for path-based routing: /api/public/{slug}/...)
 * 
 * Priority: Host header > URL parameter
 */
export function resolveTenantSlug(
  request: NextRequest,
  slugParam?: string
): string | null {
  // Method 1: Extract from Host header (subdomain-based)
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];
  
  if (hostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
    const tenantSlug = extractTenantSlug(hostname);
    if (tenantSlug) {
      return tenantSlug;
    }
  }
  
  // Method 2: Use slug from URL parameter (path-based, for backward compatibility)
  if (slugParam) {
    return slugParam.toLowerCase();
  }
  
  // Method 3: Check x-tenant-slug header (set by middleware)
  const headerSlug = request.headers.get('x-tenant-slug');
  if (headerSlug) {
    return headerSlug.toLowerCase();
  }
  
  return null;
}

