import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for dual-domain architecture
 * 
 * Routes requests based on Host header:
 * - revol.app / www.revol.app / app.revol.app → App domain (dashboard, auth, marketing)
 * - main.tld / www.main.tld → Redirect to www.revol.app
 * - {businessname}.main.tld → Customer booking sites (public sites, booking flows)
 */

// Domain configuration
const APP_DOMAINS = ['revol.app', 'www.revol.app', 'app.revol.app'];
const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Replace with actual domain when known

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0]; // Remove port if present
  
  // Check if this is a customer website domain (*.main.tld)
  if (hostname.endsWith(CUSTOMER_DOMAIN_SUFFIX)) {
    // Extract tenant slug from subdomain
    const tenantSlug = hostname.replace(CUSTOMER_DOMAIN_SUFFIX, '').toLowerCase();
    
    // Validate tenant slug (must not be empty and should be alphanumeric with hyphens)
    if (!tenantSlug || tenantSlug.length === 0 || hostname === `www${CUSTOMER_DOMAIN_SUFFIX}` || hostname === CUSTOMER_DOMAIN_SUFFIX.replace('.', '')) {
      // If it's exactly "main.tld" or "www.main.tld", redirect to app domain
      return NextResponse.redirect(new URL('https://www.revol.app', request.url));
    }
    
    // For customer website requests, rewrite to /tenant route
    // This allows us to use Next.js routing while maintaining subdomain-based access
    const pathname = request.nextUrl.pathname;
    
    // Rewrite to /tenant for all customer domain requests
    // The tenant page will extract the slug from the hostname
    const url = request.nextUrl.clone();
    url.pathname = '/tenant';
    
    // Add tenant slug to headers for use in route handlers
    const response = NextResponse.rewrite(url);
    response.headers.set('x-tenant-slug', tenantSlug);
    
    return response;
  }
  
  // For app domain (revol.app), ensure we're not serving customer content
  // Block any /public/[slug] routes on app domain (they should only work on *.main.tld)
  if (APP_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) {
    const pathname = request.nextUrl.pathname;
    
    // Block public routes on app domain
    if (pathname.startsWith('/public/')) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    return NextResponse.next();
  }
  
  // Default: allow the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

