# Task 3: Supabase Setup - Complete ✅

## What Was Created

### 1. Database Client Helper (`apps/web/src/lib/db.ts`)

Three client factory functions:

- **`createServerClient()`** - For API routes and server components
  - Automatically detects user JWT from headers/cookies
  - Respects RLS when user is authenticated
  - Falls back to service role for public operations
  
- **`createAdminClient()`** - For background jobs and admin operations
  - Uses service role key (bypasses RLS)
  - Use only when necessary (webhooks, cron jobs)
  
- **`createClientClient()`** - For client-side React components
  - Uses anon key
  - Relies on Supabase Auth for authentication

### 2. Environment Setup Guide (`apps/web/ENV_SETUP.md`)

Complete guide for setting up environment variables with:
- Supabase keys (URL, anon key, service role key)
- Stripe keys
- Email/SMS provider keys
- Links to where to find each key

### 3. Test Endpoint (`apps/web/src/app/api/test-db/route.ts`)

Simple API endpoint to verify database connection:
- `GET /api/test-db`
- Returns connection status and helpful error messages

### 4. Test Script (`apps/web/src/lib/db-test.ts`)

Standalone script to test connection (can be run with `npx tsx`)

## Next Steps

### 1. Set Up Environment Variables

Create `apps/web/.env.local` with your Supabase keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

See `apps/web/ENV_SETUP.md` for complete list.

### 2. Test the Connection

Start the dev server:
```bash
cd apps/web
npm run dev
```

Visit: `http://localhost:3000/api/test-db`

You should see:
- ✅ Connection successful (even if tables don't exist yet)
- ❌ Error with helpful message if env vars are missing

### 3. Create Database Schema

Next, you'll need to:
1. Create SQL migration files in `supabase/migrations/`
2. Run migrations to create all tables
3. Test the connection again - should show "tables exist"

## Usage Examples

### In an API Route (with RLS)

```typescript
// apps/web/src/app/api/business/route.ts
import { createServerClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createServerClient();
  
  // This query respects RLS - only returns current user's businesses
  const { data, error } = await supabase
    .from('businesses')
    .select('*');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ businesses: data });
}
```

### In a Background Job (bypass RLS)

```typescript
// apps/web/src/app/api/cron/reminders/route.ts
import { createAdminClient } from '@/lib/db';

export async function GET() {
  const supabase = createAdminClient();
  
  // This bypasses RLS - use only for background jobs
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'pending');
  
  // Process reminders...
}
```

## Verification Checklist

- [ ] `@supabase/supabase-js` installed in `apps/web/package.json`
- [ ] `.env.local` file created with Supabase keys
- [ ] Test endpoint `/api/test-db` returns success
- [ ] No TypeScript errors in `apps/web/src/lib/db.ts`
- [ ] Ready to proceed to Task 4 (Onboarding API)

## Notes

- The `createServerClient()` function is async because it needs to await `headers()` and `cookies()` from Next.js
- Always use `createServerClient()` in API routes unless you specifically need to bypass RLS
- The service role key should NEVER be exposed to the client - it's only used server-side
- RLS policies will be set up in the migration files (Task 4+)




