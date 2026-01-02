# Dual-Domain Architecture Implementation

## Overview

This document describes the dual-domain architecture refactor that separates the product/app domain from customer-facing business websites.

## Architecture

### Domain Separation

1. **App Domain (`revol.app` / `app.revol.app`)**
   - Marketing site
   - Login / authentication
   - Admin dashboard
   - Billing
   - Internal tools
   - Onboarding
   - ❌ No customer websites or booking pages

2. **Customer Website Domain (`*.main.tld`)**
   - Customer public websites
   - Booking flows
   - Client-facing pages
   - ❌ No marketing or branding pages
   - ❌ No dashboard UI

## Implementation Details

### 1. Middleware (`src/middleware.ts`)

Host-based routing middleware that:
- Detects customer website domains (`*.main.tld`)
- Extracts tenant slug from subdomain
- Rewrites customer domain requests to `/tenant` route
- Blocks `/public/[slug]` routes on app domain
- Adds `x-tenant-slug` header for route handlers

### 2. Domain Utilities (`src/lib/domain-utils.ts`)

Utility functions for:
- Extracting tenant slug from hostname
- Determining domain type (app vs customer)
- Domain validation

### 3. Tenant Resolution (`src/lib/tenant-resolution.ts`)

Resolves tenant slug from:
1. Host header (subdomain-based: `{businessname}.main.tld`)
2. URL parameter (path-based: `/api/public/{slug}/...`)
3. `x-tenant-slug` header (set by middleware)

Priority: Host header > URL parameter > Header

### 4. CORS Configuration (`src/lib/cors.ts`)

CORS utilities that:
- Allow requests from both app domains and customer domains
- Validate origins dynamically
- Add appropriate CORS headers to responses
- Handle OPTIONS preflight requests

### 5. Route Structure

#### App Domain Routes
- `/` - Landing page (marketing)
- `/login` - Authentication
- `/signup` - User registration
- `/onboarding` - Business setup
- `/app/b/[businessId]/*` - Admin dashboard

#### Customer Domain Routes
- `/tenant` - Customer website (accessed via `{businessname}.main.tld`)
  - Extracts tenant slug from hostname
  - Loads business catalog and renders booking experience

### 6. API Routes

All public API routes support both:
- **Subdomain-based**: `{businessname}.main.tld/api/public/...` (resolves from Host header)
- **Path-based**: `/api/public/{slug}/...` (backward compatibility)

Updated routes:
- `/api/public/[slug]/catalog` - Business catalog
- `/api/public/[slug]/bookings` - Create bookings
- `/api/public/[slug]/availability` - Get availability slots

All routes:
- Resolve tenant from Host header or URL parameter
- Include CORS headers
- Handle OPTIONS preflight requests

## Configuration

### Domain Configuration

Update these constants when the actual customer domain is known:

**File: `src/lib/domain-utils.ts`**
```typescript
export const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Replace with actual domain
```

**File: `src/middleware.ts`**
```typescript
const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Replace with actual domain
```

### DNS Setup

1. Create wildcard DNS record:
   ```
   *.main.tld → frontend hosting (e.g. Vercel)
   ```

2. SSL certificates:
   - ✅ Automatically handled by hosting provider (Vercel)
   - ✅ Automatically handled by Cloudflare / Let's Encrypt
   - ❌ Do NOT purchase SSL certificates manually

### Vercel Configuration

The `vercel.json` has been updated with rewrites to support wildcard domains.

## Database

The existing `businesses` table with `subdomain` field is used. No schema changes required.

## Migration Notes

### Backward Compatibility

- Path-based routes (`/public/[slug]`) still work for backward compatibility
- API routes support both subdomain and path-based access
- Existing `/public/[slug]` route remains but is blocked on app domain

### Breaking Changes

- Customer websites can no longer be accessed via `/public/{slug}` on `revol.app`
- All customer sites must use `{businessname}.main.tld` format

## Testing Checklist

- [ ] Test app domain routes (`revol.app`)
  - [ ] Landing page loads
  - [ ] Login/signup works
  - [ ] Dashboard accessible
  - [ ] `/public/[slug]` routes are blocked

- [ ] Test customer domain routes (`{businessname}.main.tld`)
  - [ ] Customer website loads
  - [ ] Booking flow works
  - [ ] API calls resolve tenant correctly
  - [ ] CORS headers are present

- [ ] Test API routes
  - [ ] Subdomain-based access works
  - [ ] Path-based access still works (backward compatibility)
  - [ ] CORS preflight requests work
  - [ ] Tenant resolution from Host header works

- [ ] Test DNS and SSL
  - [ ] Wildcard DNS configured
  - [ ] SSL certificates auto-provisioned
  - [ ] All subdomains accessible

## Next Steps

1. **Update domain configuration** when actual customer domain is known
   - Replace `.main.tld` with actual domain in:
     - `src/lib/domain-utils.ts`
     - `src/middleware.ts`
     - `src/lib/cors.ts`

2. **Configure DNS**
   - Set up wildcard DNS record: `*.main.tld → Vercel`

3. **Test thoroughly**
   - Test both app and customer domains
   - Verify CORS works correctly
   - Test booking flows end-to-end

4. **Update documentation**
   - Update any external documentation referencing old routing
   - Update onboarding flow if needed

5. **Monitor**
   - Watch for any routing issues
   - Monitor CORS errors
   - Check tenant resolution logs

## Files Changed

### New Files
- `src/middleware.ts` - Host-based routing middleware
- `src/lib/domain-utils.ts` - Domain detection utilities
- `src/lib/tenant-resolution.ts` - Tenant slug resolution
- `src/lib/cors.ts` - CORS configuration
- `src/app/tenant/page.tsx` - Customer website page

### Modified Files
- `src/app/page.tsx` - Added domain detection
- `src/app/api/public/[slug]/catalog/route.ts` - Added tenant resolution and CORS
- `src/app/api/public/[slug]/bookings/route.ts` - Added tenant resolution and CORS
- `src/app/api/public/[slug]/availability/route.ts` - Added tenant resolution and CORS
- `vercel.json` - Added rewrites for wildcard domain support

## Security Considerations

1. **Tenant Isolation**: Tenant resolution is based on Host header, ensuring proper isolation
2. **CORS**: Only allows requests from approved domains
3. **Route Protection**: Blocks customer content on app domain
4. **Validation**: Validates tenant slugs before database queries

## Performance

- Middleware runs on edge, minimal latency
- Tenant resolution is cached in headers
- CORS headers added efficiently
- No additional database queries for tenant resolution

