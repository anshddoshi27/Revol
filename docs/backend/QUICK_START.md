# Tithi Backend - Quick Start Guide

This is a quick reference guide to get the Tithi backend up and running in minimal time.

## What This Guide Does

Provides a streamlined path to get the backend running locally for development and testing. For detailed explanations, see `BACKEND_SETUP_COMPLETE.md`.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed (check: `node --version`)
- **Supabase project** created ([supabase.com](https://supabase.com))
- **Stripe account** created ([stripe.com](https://stripe.com))
- **Git** (optional, for version control)

---

## Step 1: Install Dependencies

**What**: Installing all required npm packages for the backend.

**Why**: Backend requires dependencies like Stripe SDK, Supabase client, etc.

**Action**:
```bash
cd apps/web
npm install
```

**Expected output**: Packages installed successfully, no errors.

**Verification**: 
- ✅ `node_modules/` directory created
- ✅ No installation errors
- ✅ Stripe package is installed (`npm list stripe`)

---

## Step 2: Set Up Environment Variables

**What**: Creating `.env.local` file with all required configuration.

**Why**: Backend needs API keys, database URLs, and secrets to function.

**Action**: Create `.env.local` file in `apps/web/` directory:

```bash
# Navigate to apps/web directory
cd apps/web

# Create .env.local file (or use your text editor)
nano .env.local
# or
code .env.local
```

**Copy this template and fill in your values**:

```bash
# Supabase Configuration
# Get from: Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# Stripe Configuration
# Get from: Stripe Dashboard > Developers > API keys
STRIPE_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret  # Get after Step 6
STRIPE_PLAN_PRICE_ID=price_your_price_id          # Get after Step 6

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Jobs Security
# Generate with: openssl rand -hex 32
CRON_SECRET=your_random_secret_here

# Optional: Email/SMS Providers (for notifications)
# SENDGRID_API_KEY=SG.your_sendgrid_key
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=your_twilio_auth_token
# TWILIO_PHONE_NUMBER=+1234567890
```

**Quick checklist:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - From Supabase Dashboard > Settings > API > Project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase Dashboard > Settings > API > anon public key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - From Supabase Dashboard > Settings > API > service_role key (secret!)
- [ ] `STRIPE_SECRET_KEY` - From Stripe Dashboard > Developers > API keys > Secret key
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - From Stripe Dashboard > Developers > API keys > Publishable key
- [ ] `STRIPE_WEBHOOK_SECRET` - Will get in Step 6
- [ ] `STRIPE_PLAN_PRICE_ID` - Will get in Step 6
- [ ] `NEXT_PUBLIC_APP_URL` - `http://localhost:3000` for dev
- [ ] `CRON_SECRET` - Generate with `openssl rand -hex 32`

**⚠️ Important**: 
- Keep secrets secure - never commit `.env.local` to git
- Replace placeholder values with your actual keys
- Some values (webhook secret, price ID) will be added later

**For detailed instructions**: See `apps/web/ENV_SETUP.md`

---

## Step 3: Run Database Migrations

**What**: Applying the database schema to your Supabase instance.

**Why**: Backend needs tables, indexes, and RLS policies to exist.

**Action**: Choose one method:

**Option A: Using Supabase CLI** (if installed):
```bash
# Install Supabase CLI first if needed:
# brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option B: Using Supabase Dashboard** (manual):
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Open migration file: `supabase/migrations/20250101000000_initial_schema.sql`
5. Copy entire contents
6. Paste into SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Verify: Should see "Success. No rows returned"

**Verification**:
- ✅ All tables exist (check Supabase Dashboard > Table Editor)
- ✅ Migration completed without errors
- ✅ Test endpoint works: `curl http://localhost:3000/api/test-db`

**Expected response**:
```json
{
  "success": true,
  "connected": true,
  "tablesExist": true
}
```

---

## Step 4: Start Development Server

**What**: Starting the Next.js development server.

**Why**: Backend endpoints are served by Next.js server.

**Action**:
```bash
# Make sure you're in apps/web directory
cd apps/web

# Start development server
npm run dev
```

**Expected output**:
```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
✓ Ready in 2.3s
```

**What you'll see**:
- Server starts on `http://localhost:3000`
- Compiles successfully
- Ready to accept requests

**Verification**:
- ✅ Server starts without errors
- ✅ Can access `http://localhost:3000` in browser
- ✅ API endpoints are accessible

**Keep server running**: Leave this terminal window open while developing.

---

## Step 5: Test Database Connection

**What**: Verifying backend can connect to Supabase.

**Why**: Confirms environment variables and database are configured correctly.

**Action**:
```bash
# In a new terminal window (keep dev server running)
curl http://localhost:3000/api/test-db
```

**Expected response**:
```json
{
  "success": true,
  "connected": true,
  "tablesExist": true
}
```

**If successful**: ✅ Database connection works, all tables exist

**If failed**:
- `connected: false` → Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- `tablesExist: false` → Run database migrations (Step 3)
- Connection timeout → Check `NEXT_PUBLIC_SUPABASE_URL` is correct

---

## Step 6: Set Up Stripe (First Time Only)

**What**: Configuring Stripe for payments and subscriptions.

**Why**: Backend needs Stripe configured for payment processing.

### 6.1 Create Subscription Product

**Action**:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in top right)
3. Click **Products** (left sidebar)
4. Click **+ Add product**
5. Fill in:
   - **Name**: `Tithi Monthly Subscription`
   - **Pricing model**: Select **Recurring**
   - **Price**: `11.99`
   - **Billing period**: Select **Monthly**
6. Click **Save product**
7. **Copy the Price ID** (starts with `price_`)
8. Update `STRIPE_PLAN_PRICE_ID` in `.env.local`:
   ```bash
   STRIPE_PLAN_PRICE_ID=price_your_copied_price_id
   ```

**Why**: Each business needs a subscription to use the platform.

### 6.2 Create Webhook (For Local Testing)

**Action**:
1. **Install Stripe CLI** (if not installed):
   ```bash
   brew install stripe/stripe-cli/stripe
   # or see: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```
   - Browser opens for authorization
   - Click **Allow**

3. **Forward Webhooks to Local Server**:
   ```bash
   # Make sure dev server is running (Step 4)
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   - **Keep this terminal window open**
   - You'll see output like:
     ```
     > Ready! Your webhook signing secret is whsec_xxxxx...
     > Forwarding events to localhost:3000/api/webhooks/stripe
     ```

4. **Copy Webhook Secret**:
   - Look for `whsec_...` in the CLI output
   - Copy the secret
   - Update `STRIPE_WEBHOOK_SECRET` in `.env.local`:
     ```bash
     STRIPE_WEBHOOK_SECRET=whsec_your_cli_secret_here
     ```

**Why**: Webhooks let Stripe notify your backend when events happen (payments, subscriptions, etc.).

**For production**: Create webhook in Stripe Dashboard pointing to your production URL (see `BACKEND_SETUP_COMPLETE.md` Step 2.3).

---

## Step 7: Test Endpoints

**What**: Verifying endpoints work correctly.

**Why**: Confirms backend is functioning before integrating with frontend.

### Test Public Catalog

**Action**:
```bash
# Replace 'test-business' with your actual business subdomain
curl http://localhost:3000/api/public/test-business/catalog
```

**Expected response**:
```json
{
  "business": {
    "id": "uuid",
    "name": "Test Business",
    ...
  },
  "categories": [...],
  "staff": [...]
}
```

**If 404**: Business doesn't exist - complete onboarding first (Step 8).

---

### Test Onboarding (Requires Authentication)

**Action**:
1. **Sign up a user** (via your frontend or Supabase Dashboard > Authentication > Users > Add user)

2. **Get access token** (see `BACKEND_SETUP_COMPLETE.md` Step 4.2 for methods)

3. **Test Step 1**:
   ```bash
   curl -X PUT http://localhost:3000/api/business/onboarding/step-1-business \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "businessName": "Test Business",
       "description": "A test business",
       "doingBusinessAs": "Test DBA",
       "legalName": "Test Business LLC",
       "industry": "Beauty"
     }'
   ```

**Expected response**:
```json
{
  "success": true,
  "businessId": "uuid",
  "message": "Business information saved successfully"
}
```

**Continue testing**: Test other onboarding steps (see `ENDPOINT_REFERENCE.md` for all endpoints).

---

## Step 8: Set Up Cron Jobs (Production Only)

**What**: Configuring automated background jobs for production.

**Why**: Background jobs process notifications, schedule reminders, and maintain system health.

**When**: Only needed for production deployment. Not required for local development.

### Option A: Vercel Cron (Recommended for Vercel)

**Action**: Create `vercel.json` in project root (not in `apps/web/`):

```json
{
  "crons": [
    {"path": "/api/cron/notifications", "schedule": "*/2 * * * *"},
    {"path": "/api/cron/reminders", "schedule": "*/10 * * * *"},
    {"path": "/api/cron/cleanup", "schedule": "*/1 * * * *"},
    {"path": "/api/cron/subscription-health", "schedule": "0 2 * * *"}
  ]
}
```

**Action**: Set `CRON_SECRET` in Vercel Dashboard > Settings > Environment Variables

**Why**: Vercel automatically calls these endpoints on schedule.

### Option B: External Cron Service

**Action**: Use service like cron-job.org:

1. Create cron job pointing to: `https://yourdomain.com/api/cron/notifications`
2. Set method: `GET`
3. Add header: `Authorization: Bearer YOUR_CRON_SECRET`
4. Repeat for all 4 cron endpoints

**Why**: External services work with any hosting provider.

**For detailed instructions**: See `BACKEND_SETUP_COMPLETE.md` Step 3

---

## Next Steps

After completing the quick start:

1. **Test Full Flow**:
   - Complete onboarding (all 11 steps)
   - Create a booking via public API
   - Test money board actions (Complete, No-Show, Cancel, Refund)

2. **Integrate with Frontend**:
   - Replace mock API calls with real endpoints
   - Test end-to-end user flows

3. **Deploy to Production**:
   - Follow `BACKEND_SETUP_COMPLETE.md` Step 5 (Production Deployment Checklist)
   - Set up production environment variables
   - Configure production Stripe webhook
   - Set up production cron jobs

---

## Common Issues & Quick Fixes

### Issue: Database Connection Fails

**Symptoms**: `/api/test-db` returns `connected: false`

**Quick Fix**:
1. Check `SUPABASE_SERVICE_ROLE_KEY` is correct
2. Verify Supabase project is active (not paused)
3. Check `NEXT_PUBLIC_SUPABASE_URL` matches your project

**Solution**: Update environment variables, verify Supabase project status

---

### Issue: Stripe Webhook Fails

**Symptoms**: Webhook returns 400 or signature verification fails

**Quick Fix**:
1. Verify `STRIPE_WEBHOOK_SECRET` matches CLI secret (for local) or Stripe Dashboard secret (for production)
2. Check webhook URL is correct
3. Ensure Stripe CLI is running (for local testing)

**Solution**: Update `STRIPE_WEBHOOK_SECRET` with correct secret

---

### Issue: Cron Jobs Not Running

**Symptoms**: Notifications not sending, reminders not scheduling

**Quick Fix**:
1. Verify `CRON_SECRET` is set in environment variables
2. Check cron service is sending `Authorization: Bearer {CRON_SECRET}` header
3. Verify endpoint URLs are correct

**Solution**: Configure cron service correctly, verify authentication header

---

### Issue: Payment Intent Fails

**Symptoms**: Money actions fail with payment errors

**Quick Fix**:
1. Check Stripe Connect account is active
2. Verify `stripe_connect_account_id` is set on business
3. Check payment method is valid (not expired)
4. Review Stripe Dashboard > Payments for error details

**Solution**: Activate Connect account, verify payment method, check Stripe error codes

---

## Support & Documentation

**For detailed setup**: See `BACKEND_SETUP_COMPLETE.md` - Complete step-by-step guide with explanations

**For environment variables**: See `apps/web/ENV_SETUP.md` - Complete reference for all variables

**For API reference**: See `ENDPOINT_REFERENCE.md` - All endpoints documented with examples

**For implementation details**: See `SESSION_COMPLETE_SUMMARY.md` - What's been implemented

**For testing**: Use `apps/web/scripts/test-backend.sh` - Automated testing script

---

## Quick Command Reference

```bash
# Install dependencies
cd apps/web && npm install

# Generate cron secret
openssl rand -hex 32

# Start dev server
npm run dev

# Test database
curl http://localhost:3000/api/test-db

# Start Stripe CLI (for webhook testing)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test webhook event
stripe trigger payment_intent.succeeded

# Run test script
./apps/web/scripts/test-backend.sh
```

---

## Success Checklist

You're ready to proceed when:

- ✅ Dependencies installed (`npm install` succeeded)
- ✅ Environment variables set (`.env.local` exists with all required values)
- ✅ Database migrations run (all tables exist)
- ✅ Dev server starts (`npm run dev` works)
- ✅ Database connection works (`/api/test-db` returns success)
- ✅ Stripe product created (Price ID set in `.env.local`)
- ✅ Stripe webhook set up (webhook secret set in `.env.local`)
- ✅ Can test at least one endpoint successfully


