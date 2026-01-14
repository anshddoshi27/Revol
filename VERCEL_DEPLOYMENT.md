# Vercel Deployment Checklist

This checklist is specific to deploying the Tithi application to Vercel.

## Pre-Deployment Setup

### 1. Vercel Project Configuration

**Root Directory:** `apps/web` (monorepo setup)

**Build & Install Commands:**
- **Install Command:** `npm install` (runs from root, installs workspace dependencies)
- **Build Command:** `npm run build` (runs from `apps/web` directory)
- **Output Directory:** `.next` (default Next.js output)

**Framework Preset:** Next.js

### 2. Environment Variables

Add the following environment variables in Vercel Dashboard → Settings → Environment Variables:

#### Required Public Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
NEXT_PUBLIC_APP_URL=https://revolve.app
```

#### Required Server-Side Secrets
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
STRIPE_SECRET_KEY=sk_live_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=price_your-price-id
STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=price_your-price-id
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@revol.com
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

**⚠️ Important:**
- Set all variables for **Production**, **Preview**, and **Development** environments as needed
- Use production Stripe keys (`sk_live_`, `pk_live_`) for production environment
- Use test keys for preview/development environments

### 3. Domain Configuration

#### Primary Domains
1. **revolve.app** (main domain)
   - Add in Vercel Dashboard → Settings → Domains
   - Configure DNS:
     - Type: `CNAME`
     - Name: `@` or `revolve.app`
     - Value: `cname.vercel-dns.com`

2. **www.revolve.app** (www subdomain)
   - Add in Vercel Dashboard → Settings → Domains
   - Configure DNS:
     - Type: `CNAME`
     - Name: `www`
     - Value: `cname.vercel-dns.com`
   - Vercel will automatically redirect `www.revolve.app` → `revolve.app` if configured

#### Wildcard Subdomains (if supported)

**Current Routing:** The application supports subdomain-based tenant routing via middleware (`apps/web/src/middleware.ts`).

**Configuration:**
- If using wildcard subdomains for customer booking sites (`{businessname}.revolve.app`):
  1. Add `*.revolve.app` in Vercel Dashboard → Settings → Domains
  2. Configure DNS:
     - Type: `CNAME`
     - Name: `*`
     - Value: `cname.vercel-dns.com`
  3. Update `CUSTOMER_DOMAIN_SUFFIX` in `apps/web/src/middleware.ts` to `.revolve.app`

**Note:** Currently, the middleware uses `.main.tld` as a placeholder. Update this to your actual customer domain suffix when deploying.

### 4. OAuth Redirect URI Updates

If using OAuth providers (Google, etc.), update redirect URIs:

**Supabase Auth:**
- Go to Supabase Dashboard → Authentication → URL Configuration
- Add to **Redirect URLs:**
  - `https://revolve.app/auth/callback`
  - `https://www.revolve.app/auth/callback`
  - `https://revolve.app/onboarding` (for email confirmation)

**Google OAuth (if applicable):**
- Go to Google Cloud Console → APIs & Services → Credentials
- Add to **Authorized redirect URIs:**
  - `https://revolve.app/api/auth/callback/google`
  - `https://www.revolve.app/api/auth/callback/google`

### 5. Stripe Webhook Endpoint Updates

1. Go to Stripe Dashboard → Developers → Webhooks
2. Update webhook endpoint URL:
   - **Production:** `https://revolve.app/api/webhooks/stripe`
   - **Test:** `https://your-preview-url.vercel.app/api/webhooks/stripe`
3. Ensure webhook secret matches `STRIPE_WEBHOOK_SECRET` environment variable
4. Configure webhook events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - (Add other events as needed)

### 6. Vercel Cron Jobs

The `vercel.json` file already configures cron jobs. Vercel will automatically set these up:

- `/api/cron/notifications` - Every 2 minutes
- `/api/cron/reminders` - Every 10 minutes
- `/api/cron/cleanup` - Daily at 3:00 AM UTC
- `/api/cron/subscription-health` - Daily at 2:00 AM UTC

**Verification:**
- After deployment, check Vercel Dashboard → Cron Jobs
- Ensure all cron jobs are active and running

### 7. Database Migrations

Before first deployment, ensure Supabase migrations are applied:

1. Go to Supabase Dashboard → SQL Editor
2. Run migrations in order from `supabase/migrations/`:
   - Start with `20250101000000_initial_schema.sql`
   - Continue with subsequent migrations in chronological order
3. Verify tables exist via Supabase Dashboard → Table Editor

**Alternative:** Use Supabase CLI:
```bash
supabase db push
```

## Deployment Steps

1. **Connect Repository:**
   - Go to Vercel Dashboard → Add New Project
   - Import from GitHub repository
   - Select the `Tithi` repository

2. **Configure Project:**
   - **Root Directory:** `apps/web`
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build` (Vercel will auto-detect)
   - **Output Directory:** `.next` (Vercel will auto-detect)

3. **Add Environment Variables:**
   - Add all variables from section 2 above
   - Set appropriate values for Production/Preview/Development

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Verify deployment URL

5. **Configure Domains:**
   - Add `revolve.app` and `www.revolve.app` in Settings → Domains
   - Follow DNS configuration instructions

6. **Verify:**
   - Visit `https://revolve.app`
   - Test authentication flow
   - Verify cron jobs are running
   - Test Stripe webhook endpoint

## Post-Deployment Verification

- [ ] Application loads at `https://revolve.app`
- [ ] `www.revolve.app` redirects to `revolve.app` (or loads correctly)
- [ ] Authentication (login/signup) works
- [ ] Database connections work (test via `/api/test-db` if available)
- [ ] Stripe webhook receives test events
- [ ] Cron jobs are active in Vercel Dashboard
- [ ] Environment variables are set correctly
- [ ] OAuth redirects work (if applicable)
- [ ] Public booking routes work (if using subdomain routing)

## Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Verify `apps/web/package.json` has correct build script
- Ensure all dependencies are in `package.json` (not just `package-lock.json`)

### Environment Variables Not Working
- Verify variables are set for correct environment (Production/Preview/Development)
- Check variable names match exactly (case-sensitive)
- Restart deployment after adding new variables

### Cron Jobs Not Running
- Verify `vercel.json` is in root directory (not `apps/web`)
- Check Vercel Dashboard → Cron Jobs for status
- Ensure cron job routes return 200 status codes

### Domain Issues
- Verify DNS records are correct (CNAME to `cname.vercel-dns.com`)
- Wait for DNS propagation (can take up to 48 hours)
- Check Vercel Dashboard → Domains for configuration status

## Monorepo Notes

This is a monorepo with workspaces. Vercel needs to:
- Install from root (`npm install` at root installs workspace dependencies)
- Build from `apps/web` directory
- The `package.json` at root defines workspaces: `["apps/*", "packages/*"]`

Vercel should automatically detect this, but if issues occur, explicitly set:
- **Root Directory:** `apps/web`
- **Install Command:** `cd ../.. && npm install` (if building from `apps/web`)
