# Environment Variables Setup

Create a `.env.local` file in `apps/web/` with the following variables:

```bash
# Supabase Configuration
# Get these from your Supabase project dashboard: https://app.supabase.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (server-side only, never expose to client)
# This key bypasses RLS - keep it secret!
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Stripe Configuration
# Get these from your Stripe dashboard: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Stripe Webhook Secret (for verifying webhook signatures)
# Get this from Stripe dashboard > Developers > Webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Connect & Billing
# Product and Price IDs for the $11.99/month subscription
# Create these in Stripe Dashboard > Products
STRIPE_PLAN_PRODUCT_ID=prod_your_product_id
STRIPE_PLAN_PRICE_ID=price_your_price_id

# Application URL (for webhooks and redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Jobs Security
# Secret key for protecting cron endpoints from unauthorized access
# Generate a random string: openssl rand -hex 32
CRON_SECRET=your_random_cron_secret_here

# Email/SMS Providers (optional, for notifications)
# SendGrid for emails
SENDGRID_API_KEY=your_sendgrid_api_key

# Twilio for SMS
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

## Getting Your Supabase Keys

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** > **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

## Getting Your Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** > **API keys**
3. Copy:
   - **Secret key** → `STRIPE_SECRET_KEY`
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Testing the Connection

Once you've set up your `.env.local` file, you can test the Supabase connection:

```bash
# From apps/web directory
npm run dev
```

Then visit `http://localhost:3000/api/test-db` (we'll create this test endpoint next).

Or use the test script:
```bash
npx tsx src/lib/db-test.ts
```

