# Tithi

Tithi is a modular, offline-first, white-label booking PWA built with React + Tailwind, Flask, and Supabase/Postgres (RLS enforced). Features include Google Calendar sync, Stripe Connect payments, real-time updates, no-overlap booking, analytics, promotions, notifications, and a 3% new-customer royalty model.

## Quick Start

1. **Install dependencies:**
   ```bash
   cd apps/web
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual values
   ```

3. **Run database migrations:**
   See `supabase/README.md` for migration instructions.

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Environment Variables

See `apps/web/.env.example` for all required environment variables.

**⚠️ Security Note:** Never commit `.env` or `.env.local` files. If you accidentally committed secrets, rotate them immediately.

## Multi-Tenant Architecture

This application uses a multi-tenant architecture with:
- **Tenant identification:** Via `business_id` in database tables and `slug` in URL paths
- **Data isolation:** Enforced through Supabase Row Level Security (RLS) policies
- **Tenant resolution:** Supports both subdomain-based (`{slug}.revolve.app`) and path-based (`/api/public/{slug}/...`) routing

**Tenant Safety Expectations:**
- All API routes must validate tenant context before data access
- Database queries should be scoped to the current tenant via RLS or explicit `business_id` filters
- Public routes use slug-based tenant resolution
- Admin routes require authentication and tenant membership verification

See `apps/web/src/lib/tenant-resolution.ts` for tenant resolution implementation.
