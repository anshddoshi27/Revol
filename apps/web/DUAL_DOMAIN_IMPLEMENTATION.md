# Dual-Domain Architecture Implementation Summary

## ✅ Implementation Complete

The dual-domain architecture has been successfully implemented. Here's what was changed and what you need to know.

## What Was Changed

### 1. Onboarding Step 2 (Booking URL)
- **UI Updated**: The onboarding step 2 now shows `.main.tld` instead of `.revol.com`
- **API Updated**: The booking URL returned is now `https://{subdomain}.main.tld`
- **Preview Updated**: All preview URLs now show the correct `.main.tld` format

### 2. Domain Routing
- **Middleware**: Already configured to route `*.main.tld` requests to `/tenant` page
- **Domain Utils**: Correctly configured to detect and extract tenant slugs from `*.main.tld` domains
- **Tenant Resolution**: API routes correctly resolve tenants from subdomain in Host header

### 3. Booking URLs Throughout App
All booking URLs have been updated to use `.main.tld`:
- Onboarding completion
- Admin dashboard
- Notification templates
- Booking confirmation emails
- Public booking pages

## How It Works

### Domain Structure

1. **App Domain (`revol.app`)**
   - Marketing site
   - Login/authentication
   - Admin dashboard
   - Billing
   - Onboarding

2. **Customer Website Domain (`*.main.tld`)**
   - Public booking sites
   - Example: `jambox.main.tld`
   - Example: `oakstreet.main.tld`

### Request Flow

1. **User visits `jambox.main.tld`**:
   - Middleware detects `*.main.tld` domain
   - Extracts tenant slug: `jambox`
   - Rewrites to `/tenant` route
   - Tenant page loads business data using slug
   - Booking page is displayed

2. **User completes onboarding Step 2**:
   - User enters business name (e.g., "jambox")
   - System saves to `businesses.subdomain` field
   - Booking URL created: `https://jambox.main.tld`
   - This URL becomes active when business goes live

### Database

The system uses the `businesses.subdomain` field to:
- Store the tenant slug during onboarding
- Look up businesses when requests come to `*.main.tld`
- Generate booking URLs

## What You Need to Do

### DNS Configuration (Required)

You need to set up DNS for `main.tld` (replace with your actual domain):

1. **Add Wildcard DNS Record**:
   ```
   Type: A (or CNAME if using a CDN)
   Name: *
   Value: [Your hosting provider IP or CNAME target]
   TTL: 3600 (or your preference)
   ```

2. **For Vercel** (if using Vercel):
   - Add `main.tld` as a domain in Vercel project settings
   - Add wildcard: `*.main.tld`
   - Vercel will automatically handle SSL certificates

3. **For Other Hosting**:
   - Point wildcard `*.main.tld` to your hosting provider
   - SSL certificates will be automatically provisioned by your hosting provider

### Domain Configuration

**Important**: Replace `.main.tld` with your actual domain in these files:

1. `apps/web/src/lib/domain-utils.ts`:
   ```typescript
   export const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Replace with actual domain
   ```

2. `apps/web/src/middleware.ts`:
   ```typescript
   const CUSTOMER_DOMAIN_SUFFIX = '.main.tld'; // Replace with actual domain
   ```

**Example**: If your domain is `revolbooking.com`, change to:
```typescript
export const CUSTOMER_DOMAIN_SUFFIX = '.revolbooking.com';
```

### Environment Variables

No additional environment variables needed. The domain configuration is in code.

## Testing

### Local Testing

1. **Test onboarding**:
   - Complete onboarding step 2
   - Verify booking URL shows `https://{subdomain}.main.tld`

2. **Test subdomain routing** (requires local DNS or hosts file):
   - Add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
     ```
     127.0.0.1 jambox.main.tld
     ```
   - Visit `http://jambox.main.tld:3000` (or your dev port)
   - Should show booking page for that business

### Production Testing

1. **After DNS is configured**:
   - Complete onboarding for a test business
   - Visit `https://{subdomain}.main.tld`
   - Verify booking page loads correctly

2. **Verify SSL**:
   - SSL certificates should be automatically provisioned
   - No manual certificate purchase needed

## Architecture Verification

✅ **Domain Detection**: Correctly identifies `*.main.tld` vs `revol.app`  
✅ **Tenant Resolution**: Extracts slug from subdomain  
✅ **Routing**: Middleware routes customer domains to `/tenant`  
✅ **API Routes**: Public APIs resolve tenants from Host header  
✅ **Booking URLs**: All booking URLs use `.main.tld` format  
✅ **Database**: Uses `businesses.subdomain` field correctly  

## Important Notes

1. **No SSL Certificate Purchase Needed**: Your hosting provider (Vercel, etc.) will automatically provision SSL certificates for `*.main.tld`

2. **Domain Must Be Configured**: The placeholder `.main.tld` must be replaced with your actual domain before going to production

3. **Wildcard DNS Required**: You must set up wildcard DNS (`*.main.tld`) for this to work

4. **Subdomain Validation**: The system validates subdomains during onboarding (3-63 chars, alphanumeric + hyphens)

5. **Reserved Subdomains**: Certain subdomains are reserved (www, admin, api, etc.) and cannot be used

## Next Steps

1. ✅ Code implementation complete
2. ⏳ Configure DNS (wildcard `*.main.tld`)
3. ⏳ Replace `.main.tld` with actual domain in code
4. ⏳ Test in production environment
5. ⏳ Verify SSL certificates are automatically provisioned

## Questions?

If you need clarification on any part of this implementation, the key files to review are:
- `apps/web/src/lib/domain-utils.ts` - Domain detection logic
- `apps/web/src/middleware.ts` - Request routing
- `apps/web/src/app/tenant/page.tsx` - Customer booking page
- `apps/web/src/components/onboarding/website-step.tsx` - Onboarding UI

