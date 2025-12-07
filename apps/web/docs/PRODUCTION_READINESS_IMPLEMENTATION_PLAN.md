# Production Readiness Implementation Plan

## Overview

This document outlines the specific implementation steps needed to make Tithi production-ready for real users to sign up, host booking flows, and manage businesses.

**Current Status**: Core functionality works, but 8 critical production infrastructure items need implementation.

**Estimated Time**: 2-3 days for critical items

---

## Phase 1: Critical Infrastructure (Days 1-2)

### 1. Environment Variables Setup & Validation

**File**: `apps/web/src/lib/env.ts` (NEW)

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PLAN_PRODUCT_ID: z.string().startsWith('prod_'),
  STRIPE_PLAN_PRICE_ID: z.string().startsWith('price_'),
  
  // Application
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(32),
  
  // Optional
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    throw new Error('Missing or invalid environment variables. Check .env.local');
  }
}

export const env = validateEnv();
```

**File**: `apps/web/.env.example` (NEW)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe Configuration (Production)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Connect & Billing
STRIPE_PLAN_PRODUCT_ID=prod_your_product_id
STRIPE_PLAN_PRICE_ID=price_your_price_id

# Application URL
NEXT_PUBLIC_APP_URL=https://tithi.com

# Cron Jobs Security
CRON_SECRET=your_random_cron_secret_here

# Email/SMS Providers (Optional)
SENDGRID_API_KEY=your_sendgrid_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Environment
NODE_ENV=production
```

**Update**: `apps/web/src/lib/stripe.ts` to use validated env

```typescript
import { env } from './env';

const stripeSecretKey = env.STRIPE_SECRET_KEY;
```

### 2. Rate Limiting

**Install**: `npm install @upstash/ratelimit @upstash/redis`

**File**: `apps/web/src/lib/rate-limit.ts` (NEW)

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit for money actions (strict)
export const moneyActionRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 requests per hour
  analytics: true,
});

// Rate limit for API endpoints (moderate)
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});

// Rate limit for public booking (generous)
export const publicBookingRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
  analytics: true,
});
```

**File**: `apps/web/src/middleware.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { moneyActionRateLimit, apiRateLimit, publicBookingRateLimit } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = request.ip ?? '127.0.0.1';
  
  // Rate limit money actions
  if (path.match(/\/api\/admin\/bookings\/[^/]+\/(complete|no-show|cancel|refund)/)) {
    const { success } = await moneyActionRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
  }
  
  // Rate limit admin API
  if (path.startsWith('/api/admin/')) {
    const { success } = await apiRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
  }
  
  // Rate limit public booking
  if (path.startsWith('/api/public/')) {
    const { success } = await publicBookingRateLimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
  }
  
  // Subdomain routing
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];
  
  // Reserved subdomains
  const reserved = ['www', 'api', 'admin', 'app', 'staging', 'test'];
  if (reserved.includes(subdomain)) {
    return NextResponse.next();
  }
  
  // If subdomain exists and is not main domain, route to booking flow
  if (subdomain && !hostname.includes('tithi.com') && subdomain !== 'localhost') {
    const url = request.nextUrl.clone();
    url.pathname = `/public/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/public/:path*',
  ],
};
```

### 3. Error Monitoring (Sentry)

**Install**: `npm install @sentry/nextjs`

**Setup**: Run `npx @sentry/wizard@latest -i nextjs`

**File**: `apps/web/sentry.client.config.ts` (NEW - auto-generated by wizard)

**File**: `apps/web/sentry.server.config.ts` (NEW - auto-generated by wizard)

**File**: `apps/web/sentry.edge.config.ts` (NEW - auto-generated by wizard)

**Update**: `apps/web/next.config.mjs`

```javascript
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  experimental: {
    reactCompiler: true
  },
  eslint: {
    dirs: ["src"]
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry options
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
```

### 4. Webhook Idempotency

**File**: `apps/web/src/app/api/webhooks/stripe/route.ts` (UPDATE)

Add idempotency check at the start:

```typescript
// At the start of POST function, after signature verification
const { data: existingEvent } = await supabase
  .from('webhook_events')
  .select('id, processed_at')
  .eq('stripe_event_id', event.id)
  .single();

if (existingEvent?.processed_at) {
  // Already processed, return success
  return NextResponse.json({ received: true, message: 'Event already processed' });
}

// Store event before processing
await supabase
  .from('webhook_events')
  .insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
    status: 'processing',
    created_at: new Date().toISOString(),
  });

// ... existing processing code ...

// Mark as processed
await supabase
  .from('webhook_events')
  .update({
    status: 'processed',
    processed_at: new Date().toISOString(),
  })
  .eq('stripe_event_id', event.id);
```

**Migration**: Add `webhook_events` table

```sql
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
```

### 5. Health Check Endpoint

**File**: `apps/web/src/app/api/health/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getStripeClient } from '@/lib/stripe';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      stripe: 'unknown',
    },
  };

  // Check database
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from('businesses').select('id').limit(1);
    checks.services.database = error ? 'unhealthy' : 'healthy';
  } catch (error) {
    checks.services.database = 'unhealthy';
  }

  // Check Stripe
  try {
    const stripe = getStripeClient();
    await stripe.balance.retrieve();
    checks.services.stripe = 'healthy';
  } catch (error) {
    checks.services.stripe = 'unhealthy';
  }

  // Overall status
  const allHealthy = Object.values(checks.services).every(s => s === 'healthy');
  checks.status = allHealthy ? 'healthy' : 'degraded';

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
```

### 6. Background Jobs Setup

**Option A: Vercel Cron** (Recommended for Vercel deployment)

**File**: `vercel.json` (UPDATE)

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/subscription-health",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**File**: `apps/web/src/app/api/cron/reminders/route.ts` (UPDATE)

Add authentication:

```typescript
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... existing reminder logic ...
}
```

**Option B: Inngest** (For more complex workflows)

Install: `npm install inngest`

### 7. Input Validation

**File**: `apps/web/src/lib/validations/money-board.ts` (NEW)

```typescript
import { z } from 'zod';

export const completeBookingSchema = z.object({
  id: z.string().uuid(),
});

export const noShowBookingSchema = z.object({
  id: z.string().uuid(),
});

export const cancelBookingSchema = z.object({
  id: z.string().uuid(),
});

export const refundBookingSchema = z.object({
  id: z.string().uuid(),
});

export const listBookingsSchema = z.object({
  status: z.enum(['pending', 'completed', 'no_show', 'cancelled', 'refunded']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

**Update**: All route handlers to use validation

```typescript
import { completeBookingSchema } from '@/lib/validations/money-board';

// In route handler
const validation = completeBookingSchema.safeParse({ id: params.id });
if (!validation.success) {
  return NextResponse.json(
    { error: 'Invalid request', details: validation.error },
    { status: 400 }
  );
}
```

### 8. Structured Logging

**File**: `apps/web/src/lib/logger.ts` (NEW)

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  businessId?: string;
  bookingId?: string;
  requestId?: string;
  [key: string]: any;
}

export function log(level: LogLevel, message: string, context?: LogContext) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    // Send to Sentry, LogRocket, or similar
    console.log(JSON.stringify(logEntry));
  } else {
    console[level](message, context);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  debug: (message: string, context?: LogContext) => log('debug', message, context),
};
```

---

## Phase 2: High Priority (Day 3)

### 9. API Response Caching

**File**: `apps/web/src/lib/cache.ts` (NEW)

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 60
): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached) return cached;
  
  const data = await fetcher();
  await redis.setex(key, ttl, data);
  return data;
}

export function invalidateCache(pattern: string) {
  // Implementation depends on Redis client
}
```

**Update**: GET /api/admin/bookings to use caching

```typescript
import { getCached } from '@/lib/cache';

const cacheKey = `bookings:${businessId}:${status}:${from}:${to}:${cursor}`;
const bookings = await getCached(cacheKey, async () => {
  // ... existing query logic ...
}, 30); // 30 second cache
```

### 10. Production Build Optimization

**File**: `apps/web/next.config.mjs` (UPDATE)

```javascript
const nextConfig = {
  experimental: {
    reactCompiler: true
  },
  eslint: {
    dirs: ["src"]
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['your-s3-bucket.s3.amazonaws.com'],
    formats: ['image/avif', 'image/webp'],
  },
  // ... security headers from above ...
};
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in production platform (Vercel/Railway/etc.)
- [ ] Stripe webhook endpoint configured: `https://tithi.com/api/webhooks/stripe`
- [ ] Database migrations run on production database
- [ ] Upstash Redis created and configured
- [ ] Sentry project created and DSN configured
- [ ] DNS configured for wildcard subdomains (*.tithi.com)
- [ ] SSL certificates configured (automatic with Vercel)
- [ ] Stripe production keys obtained and configured
- [ ] Stripe Connect Express accounts tested
- [ ] Health check endpoint tested

### Post-Deployment

- [ ] Test signup flow end-to-end
- [ ] Test booking flow end-to-end
- [ ] Test money board actions (Complete, No-Show, Cancel, Refund)
- [ ] Verify webhook delivery
- [ ] Check error monitoring dashboard
- [ ] Verify rate limiting works
- [ ] Test subdomain routing
- [ ] Load test with 50+ concurrent users

---

## Quick Start: Make It Production Ready

1. **Create environment validation** (30 min)
2. **Add rate limiting** (1 hour)
3. **Set up Sentry** (30 min)
4. **Add webhook idempotency** (1 hour)
5. **Create health check** (15 min)
6. **Set up background jobs** (1 hour)
7. **Add input validation** (2 hours)
8. **Configure security headers** (30 min)

**Total Time**: ~7 hours of focused work

---

## Testing Production Readiness

Run these tests before going live:

```bash
# 1. Environment validation
npm run build  # Should fail if env vars missing

# 2. Health check
curl https://tithi.com/api/health

# 3. Rate limiting
for i in {1..15}; do curl https://tithi.com/api/admin/bookings; done
# Should return 429 after 10 requests

# 4. Error handling
# Trigger an error and verify it appears in Sentry

# 5. Webhook idempotency
# Send same Stripe webhook twice, verify it's only processed once
```

---

## Support & Monitoring

### Required Monitoring

1. **Error Tracking**: Sentry dashboard
2. **Performance**: Vercel Analytics or similar
3. **Uptime**: UptimeRobot or Pingdom
4. **Database**: Supabase dashboard
5. **Stripe**: Stripe dashboard for payments

### Alerting

Set up alerts for:
- Error rate > 1%
- Response time > 2s
- Database connection failures
- Stripe API failures
- Webhook delivery failures

---

## Next Steps

1. **Today**: Implement critical items 1-8
2. **Tomorrow**: Test thoroughly, fix any issues
3. **Day 3**: Deploy to staging, run full test suite
4. **Day 4**: Deploy to production, monitor closely

**You're ready for production once all critical items are implemented and tested!**

