import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_DOMAINS, CUSTOMER_DOMAIN_SUFFIX } from './domain-utils';

/**
 * CORS configuration for dual-domain architecture
 * 
 * Allows requests from:
 * - revol.app / app.revol.app (app domain)
 * - *.main.tld (customer website domains)
 */

/**
 * Get allowed origins based on the request
 */
export function getAllowedOrigins(request: NextRequest): string[] {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  const origins: string[] = [];

  // Add app domain origins
  APP_DOMAINS.forEach(domain => {
    origins.push(`https://${domain}`);
    origins.push(`http://${domain}`); // For local development
  });

  // Add customer domain pattern
  // In production, this would be the actual domain
  if (hostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
    origins.push(`https://${hostname}`);
    origins.push(`http://${hostname}`); // For local development
  }

  // If we have a specific origin in the request, validate it
  if (origin) {
    const originHostname = new URL(origin).hostname;
    
    // Allow app domains
    if (APP_DOMAINS.some(domain => originHostname === domain || originHostname.endsWith(`.${domain}`))) {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    }
    
    // Allow customer domains
    if (originHostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    }
  }

  return origins;
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string | null, request: NextRequest): boolean {
  if (!origin) return true; // Same-origin requests don't have Origin header
  
  try {
    const originUrl = new URL(origin);
    const originHostname = originUrl.hostname;
    
    // Check app domains
    if (APP_DOMAINS.some(domain => originHostname === domain || originHostname.endsWith(`.${domain}`))) {
      return true;
    }
    
    // Check customer domains
    if (originHostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
      return true;
    }
    
    // Allow localhost for development
    if (originHostname === 'localhost' || originHostname === '127.0.0.1') {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const origin = request.headers.get('origin');
  
  // If origin is allowed, add CORS headers
  if (isOriginAllowed(origin, request)) {
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Slug');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  return response;
}

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  
  if (!isOriginAllowed(origin, request)) {
    return new NextResponse(null, { status: 403 });
  }
  
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, request);
}

