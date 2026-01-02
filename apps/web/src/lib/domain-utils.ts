/**
 * Domain utilities for dual-domain architecture
 * 
 * Handles detection of app domain vs customer website domain
 */

export const APP_DOMAINS = ['revol.app', 'www.revol.app', 'app.revol.app'];
export const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Replace with actual domain when known

export type DomainType = 'app' | 'customer' | 'unknown';

/**
 * Extract tenant slug from hostname
 * @param hostname - The hostname from the request
 * @returns The tenant slug or null if not a customer domain
 */
export function extractTenantSlug(hostname: string): string | null {
  if (hostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
    const slug = hostname.replace(CUSTOMER_DOMAIN_SUFFIX, '').toLowerCase();
    return slug.length > 0 ? slug : null;
  }
  return null;
}

/**
 * Determine domain type from hostname
 * @param hostname - The hostname from the request
 * @returns The domain type
 */
export function getDomainType(hostname: string): DomainType {
  // Check if it's an app domain
  if (APP_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return 'app';
  }
  
  // Check if it's a customer website domain
  if (hostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
    const slug = extractTenantSlug(hostname);
    return slug ? 'customer' : 'unknown';
  }
  
  return 'unknown';
}

/**
 * Check if hostname is a customer website domain
 */
export function isCustomerDomain(hostname: string): boolean {
  return getDomainType(hostname) === 'customer';
}

/**
 * Check if hostname is an app domain
 */
export function isAppDomain(hostname: string): boolean {
  return getDomainType(hostname) === 'app';
}

