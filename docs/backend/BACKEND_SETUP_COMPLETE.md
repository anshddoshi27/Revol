# Tithi Backend Setup - Complete Guide

This guide covers the complete setup for the Tithi backend after implementation.

## ✅ Implementation Status

All backend endpoints have been implemented:

### Onboarding Endpoints (11 endpoints + Complete)
- ✅ Step 1: Business basics
- ✅ Step 2: Website/subdomain
- ✅ Step 3: Location & contacts
- ✅ Step 4: Team/staff
- ✅ Step 5: Branding
- ✅ Step 6: Services & categories
- ✅ Step 7: Availability
- ✅ Step 8: Notifications
- ✅ Step 9: Policies
- ✅ Step 10: Gift cards
- ✅ Step 11: Payment setup (Stripe Connect + Subscription)
- ✅ Complete/Go Live

### Stripe Integration
- ✅ Stripe helper library (`lib/stripe.ts`)
- ✅ Stripe webhook handler (`api/webhooks/stripe/route.ts`)

### Public Booking Flow
- ✅ Catalog endpoint
- ✅ Availability endpoint
- ✅ Booking creation
- ✅ Gift code preview

### Admin Money Board
- ✅ List bookings
- ✅ Complete action
- ✅ No-show action
- ✅ Cancel action
- ✅ Refund action

### Notifications & Background Jobs
- ✅ Notification library
- ✅ Notification cron job
- ✅ Reminders cron job
- ✅ Cleanup cron job
- ✅ Subscription health cron

---

## Step 1: Environment Variables Setup

### What This Step Does

Environment variables store configuration and secrets (like API keys) outside your code. This keeps sensitive information secure and allows different settings for development vs. production.

### Why It's Important

- **Security**: Secrets are never committed to git
- **Flexibility**: Different values for dev/staging/production
- **Compliance**: Meets security best practices for handling credentials

### How to Complete This Step

#### Step 1.1: Create .env.local File

**Action**: Navigate to `apps/web/` directory and create a file named `.env.local`

**Why**: Next.js automatically loads this file for environment variables. The `.local` extension ensures it's ignored by git (already in `.gitignore`).

**How to do it:**
```bash
cd apps/web
touch .env.local
# or open in your text editor
nano .env.local
```

#### Step 1.2: Add Supabase Configuration

**What**: These connect your backend to Supabase (database and authentication).

**Why**: Supabase is our database and auth provider. All data storage and user authentication happens through Supabase.

**Required Variables:**

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - **What**: Your Supabase project URL
   - **Where to find**: Supabase Dashboard > Settings > API > Project URL
   - **Format**: `https://xxxxx.supabase.co`
   - **Example**: `https://abcdefghijklmnop.supabase.co`

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - **What**: Public anonymous key (safe to expose in client code)
   - **Where to find**: Supabase Dashboard > Settings > API > anon public key
   - **Format**: Starts with `eyJ...`
   - **Security**: This is public - RLS policies protect your data

3. **`SUPABASE_SERVICE_ROLE_KEY`**
   - **What**: Secret service role key (bypasses RLS)
   - **Where to find**: Supabase Dashboard > Settings > API > service_role (secret)
   - **Format**: Starts with `eyJ...`
   - **⚠️ CRITICAL**: Keep this secret! Never expose in client code. Only used server-side.

**Add to .env.local:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

#### Step 1.3: Add Stripe Configuration

**What**: These connect your backend to Stripe for payment processing.

**Why**: Stripe handles payments, subscriptions, and Connect accounts. Without these, payment features won't work.

**Required Variables:**

1. **`STRIPE_SECRET_KEY`**
   - **What**: Your Stripe secret API key
   - **Where to find**: Stripe Dashboard > Developers > API keys > Secret key
   - **Format**: Starts with `sk_test_` (test) or `sk_live_` (production)
   - **⚠️ SECRET**: Keep this secret! Never expose in client code.

2. **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**
   - **What**: Public Stripe key (safe for client code)
   - **Where to find**: Stripe Dashboard > Developers > API keys > Publishable key
   - **Format**: Starts with `pk_test_` or `pk_live_`
   - **Used for**: Stripe Elements in frontend (card collection)

3. **`STRIPE_WEBHOOK_SECRET`** (get this after Step 2.3)
   - **What**: Secret for verifying Stripe webhook signatures
   - **Where to find**: After creating webhook in Stripe Dashboard
   - **Format**: Starts with `whsec_`
   - **⚠️ SECRET**: Keep this secret!

4. **`STRIPE_PLAN_PRICE_ID`** (create this in Step 2.1)
   - **What**: Price ID for $11.99/month subscription
   - **Where to find**: After creating product in Stripe Dashboard
   - **Format**: Starts with `price_`

**Add to .env.local:**
```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret  # Get after Step 2.3
STRIPE_PLAN_PRICE_ID=price_your_price_id          # Get after Step 2.1
```

#### Step 1.4: Add Application Configuration

**What**: Basic application settings.

**Required Variables:**

1. **`NEXT_PUBLIC_APP_URL`**
   - **What**: Your application's base URL
   - **Development**: `http://localhost:3000`
   - **Production**: `https://yourdomain.com`
   - **Used for**: Webhook URLs, redirect URLs, generating absolute URLs

2. **`CRON_SECRET`**
   - **What**: Secret key for protecting cron endpoints
   - **How to generate**: Run `openssl rand -hex 32` in terminal
   - **Purpose**: Prevents unauthorized access to cron endpoints
   - **⚠️ SECRET**: Keep this secret!

**Generate and add:**
```bash
# In terminal, generate secret:
openssl rand -hex 32

# Add to .env.local:
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to production URL later
CRON_SECRET=your_generated_secret_here     # Paste output from openssl
```

#### Step 1.5: Add Optional Notification Providers

**What**: Configuration for sending emails and SMS (optional).

**Why**: These are optional. If not configured, notifications will be queued but not sent.

**Optional Variables:**

1. **`SENDGRID_API_KEY`** (for emails)
   - **Where to get**: [SendGrid Dashboard](https://app.sendgrid.com) > Settings > API Keys
   - **Format**: Starts with `SG.`

2. **`TWILIO_ACCOUNT_SID`** and **`TWILIO_AUTH_TOKEN`** (for SMS)
   - **Where to get**: [Twilio Console](https://console.twilio.com) > Account Info
   - **Format**: Account SID starts with `AC`

3. **`TWILIO_PHONE_NUMBER`**
   - **Where to get**: Twilio Console > Phone Numbers
   - **Format**: `+1234567890`

**Add to .env.local (optional):**
```bash
SENDGRID_API_KEY=SG.your_sendgrid_key          # Optional
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx          # Optional
TWILIO_AUTH_TOKEN=your_twilio_auth_token       # Optional
TWILIO_PHONE_NUMBER=+1234567890                # Optional
```

#### Step 1.6: Verify Environment Variables

**Action**: Check that all required variables are set.

**How to verify:**
```bash
# Check file exists and has content:
cat apps/web/.env.local

# Test the connection:
cd apps/web
npm run dev
# Visit http://localhost:3000/api/test-db
# Should return: {"success": true, "connected": true, "tablesExist": true}
```

**Quick Checklist:**
- [ ] `.env.local` file created in `apps/web/` directory
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- [ ] `STRIPE_WEBHOOK_SECRET` - Will get in Step 2.3
- [ ] `STRIPE_PLAN_PRICE_ID` - Will get in Step 2.1
- [ ] `NEXT_PUBLIC_APP_URL` - `http://localhost:3000` for dev
- [ ] `CRON_SECRET` - Generated with `openssl rand -hex 32`
- [ ] Optional: Notification provider keys (if using)

---

## Step 2: Stripe Setup

### What This Step Does

Configures Stripe for payment processing, including:
- Creating a subscription product ($11.99/month)
- Enabling Stripe Connect (for business payouts)
- Setting up webhooks (for payment notifications)

### Why It's Important

- **Subscriptions**: Businesses pay $11.99/month to use Tithi
- **Connect**: Payments go directly to business accounts (not Tithi)
- **Webhooks**: Backend gets notified when payments succeed/fail

---

### 2.1 Create Stripe Product & Price

**What**: We're creating a recurring subscription that businesses will pay monthly.

**Why**: Each business needs a subscription to use the platform. This product represents that subscription.

**Step-by-step:**

1. **Navigate to Stripe Dashboard**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Make sure you're in **Test mode** (toggle in top right) for development

2. **Create New Product**
   - Click **Products** in left sidebar
   - Click **+ Add product** button

3. **Fill in Product Details**
   - **Name**: `Tithi Monthly Subscription`
   - **Description** (optional): "Monthly subscription for Tithi booking platform"
   - **Pricing model**: Select **Recurring**

4. **Set Up Price**
   - **Price**: `11.99`
   - **Currency**: `USD` (default)
   - **Billing period**: Select **Monthly**
   - Leave other fields as default

5. **Save the Product**
   - Click **Save product** or **Add product**
   - Product page opens

6. **Copy the Price ID**
   - Look for **Price ID** (starts with `price_`)
   - Example: `price_1ABCdefGHIjklMNOpqrsTUVw`
   - Click **Copy** next to the Price ID
   - Open `apps/web/.env.local`
   - Add or update: `STRIPE_PLAN_PRICE_ID=price_your_price_id_here`
   - **⚠️ Important**: Don't include quotes

7. **Optionally Copy Product ID**
   - Look for **Product ID** (starts with `prod_`)
   - Add to `.env.local`: `STRIPE_PLAN_PRODUCT_ID=prod_your_product_id` (optional)

**Verification:**
- ✅ Product created in Stripe Dashboard
- ✅ Price ID copied to `.env.local`
- ✅ Value starts with `price_`

---

### 2.2 Enable Stripe Connect

**What**: Enabling Stripe Connect allows businesses to receive payments directly into their Stripe accounts.

**Why**: When customers book appointments, payments go directly to the business (not Tithi first). This is required for compliance and allows businesses to manage their own payouts.

**How Connect Works:**
- Each business gets their own Stripe Express account
- Payments are routed directly to the business's Stripe account
- Tithi takes a platform fee (1%) automatically
- Businesses manage their own payouts and tax information

**Step-by-step:**

1. **Navigate to Connect Settings**
   - In Stripe Dashboard, go to **Settings** (left sidebar)
   - Click **Connect** (under "Platform settings")

2. **Start Connect Setup**
   - Click **Get started** button (or **Activate** if already started)
   - Connect onboarding flow opens

3. **Choose Account Type**
   - Select **Express accounts** (recommended)
   - **Why**: Express accounts let businesses onboard quickly with minimal information
   - **Alternative**: Standard accounts require more info but give more control

4. **Complete Platform Setup Form**
   - **Business information**:
     - **Business name**: "Tithi" (or your platform name)
     - **Business URL**: Your website URL
     - **Support email**: Your support email
   - **Onboarding information**:
     - **Statement descriptor**: What appears on customer credit cards (e.g., "TITHI")
     - **Support phone**: Your support phone (optional)
   - **Payouts**:
     - **Default payout schedule**: Choose when businesses receive money (daily/weekly recommended)
   - **Fees**:
     - **Application fee**: Set to 1% (your platform fee percentage)
   - Click **Save** or **Continue**

5. **Verify Connect is Active**
   - You should see "Connect is active" message
   - **Connected accounts** section should be visible
   - This means Connect is ready to create accounts for businesses

**Verification:**
- ✅ Connect is active in Stripe Dashboard
- ✅ Express accounts option is selected
- ✅ Platform setup form is completed

**What Happens Next:**
- Businesses will be able to onboard during Step 11 of onboarding
- Connect accounts will be created programmatically when they complete payment setup

---

### 2.3 Create Stripe Webhook

**What**: Creating a webhook endpoint that Stripe will call when events happen (payments succeed, subscriptions update, etc.).

**Why**: Webhooks allow Stripe to notify our backend when events happen, so we can update our database automatically.

**How Webhooks Work:**
- Stripe sends HTTP POST requests to your webhook URL when events occur
- The request includes event data and a signature for verification
- Our backend verifies the signature and processes the event
- We update the database and trigger any necessary actions

**Step-by-step:**

1. **Navigate to Webhooks Section**
   - In Stripe Dashboard, go to **Developers** (left sidebar)
   - Click **Webhooks** (under "Developers")

2. **Create New Webhook Endpoint**
   - Click **+ Add endpoint** button (top right)
   - Webhook configuration form opens

3. **Set Endpoint URL**
   - **For Production** (after deployment):
     - Enter: `https://yourdomain.com/api/webhooks/stripe`
     - **⚠️ Important**: Replace `yourdomain.com` with your actual domain
   - **For Local Development** (optional, see Step 2.4):
     - Use Stripe CLI to forward events (can't use localhost directly)

4. **Select Events to Listen To**
   - Click **Select events** button
   - Check these events:
     - ✅ `customer.subscription.created` - When a subscription is created
     - ✅ `customer.subscription.updated` - When subscription changes
     - ✅ `customer.subscription.deleted` - When subscription is canceled
     - ✅ `invoice.payment_succeeded` - When subscription payment succeeds
     - ✅ `invoice.payment_failed` - When subscription payment fails
     - ✅ `payment_intent.succeeded` - When a payment succeeds
     - ✅ `payment_intent.payment_failed` - When a payment fails
     - ✅ `charge.refunded` - When a refund is issued
     - ✅ `setup_intent.succeeded` - When a card is saved successfully
   - Click **Add events** after selecting

5. **Save the Webhook**
   - Click **Add endpoint** button
   - Webhook details page opens

6. **Copy the Signing Secret**
   - On the webhook details page, look for **Signing secret** section
   - Click **Reveal** button to show the secret
   - Copy the secret (starts with `whsec_`)
   - Example: `whsec_ABCdefGHIjklMNOpqrsTUVwxyz1234567890`
   - **⚠️ CRITICAL**: This secret is only shown once! Save it immediately.
   - Open `apps/web/.env.local`
   - Add or update: `STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here`
   - **⚠️ Important**: Don't include quotes

7. **Verify Webhook is Active**
   - Webhook should show as **Enabled** or **Active**
   - Status indicators:
     - ✅ Green dot or "Enabled" = Active
     - ⚠️ Yellow or "Pending" = Set up but hasn't received events yet
     - ❌ Red or "Failed" = Failing (check your endpoint)

**Verification:**
- ✅ Webhook created in Stripe Dashboard
- ✅ Endpoint URL is correct
- ✅ All required events are selected
- ✅ Signing secret copied to `.env.local`
- ✅ Webhook shows as "Enabled"

**What Happens When Events Occur:**
1. Event happens in Stripe (e.g., payment succeeds)
2. Stripe sends POST request to your webhook URL
3. Backend (`/api/webhooks/stripe/route.ts`) receives the request
4. Backend verifies the signature using `STRIPE_WEBHOOK_SECRET`
5. Backend processes the event and updates database
6. Backend returns 200 status to acknowledge receipt
7. Stripe marks the event as delivered

---

### 2.4 Test Stripe Webhooks Locally (Optional)

**What**: Setting up Stripe CLI to forward webhook events to your local development server.

**Why**: You can't use `localhost` URLs directly in Stripe Dashboard. Stripe CLI creates a tunnel that forwards events from Stripe to your local server.

**How Stripe CLI Works:**
- Stripe CLI creates a secure tunnel between Stripe and your local server
- When events happen in Stripe (test mode), CLI forwards them to your local webhook endpoint
- You get a special signing secret for the CLI tunnel
- Your local server receives and processes the events

**Step-by-step:**

1. **Install Stripe CLI**
   - **On macOS (Homebrew)**:
     ```bash
     brew install stripe/stripe-cli/stripe
     ```
   - **On Linux**:
     ```bash
     wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
     tar -xvf stripe_*_linux_x86_64.tar.gz
     sudo mv stripe /usr/local/bin/
     ```
   - **On Windows**: Download from [Stripe CLI releases](https://github.com/stripe/stripe-cli/releases)
   - **Alternative**: See [Stripe CLI docs](https://stripe.com/docs/stripe-cli) for all options

2. **Verify Installation**
   ```bash
   stripe --version
   ```
   - Should show version number (e.g., `stripe version 1.18.0`)

3. **Login to Stripe**
   ```bash
   stripe login
   ```
   - Browser opens for authorization
   - Click **Allow** to authorize CLI
   - CLI shows "Done! The Stripe CLI is configured"

4. **Start Local Development Server**
   ```bash
   cd apps/web
   npm run dev
   ```
   - Server starts on `http://localhost:3000`
   - Keep this terminal window open

5. **Forward Webhooks to Local Server**
   - Open a **new terminal window**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   - CLI starts listening for Stripe events
   - CLI shows a signing secret in the output:
     ```
     > Ready! Your webhook signing secret is whsec_xxxxx...
     > Forwarding events to localhost:3000/api/webhooks/stripe
     ```
   - **⚠️ Important**: Keep this terminal window open while testing

6. **Copy Webhook Signing Secret**
   - Look in CLI output for `whsec_...`
   - Copy this secret
   - Open `apps/web/.env.local`
   - Update `STRIPE_WEBHOOK_SECRET` with the CLI secret:
     ```bash
     STRIPE_WEBHOOK_SECRET=whsec_your_cli_secret_here
     ```
   - **⚠️ Important**: Use CLI secret for local development, switch back to production secret for production

7. **Test Webhook**
   - In another terminal, trigger a test event:
     ```bash
     stripe trigger payment_intent.succeeded
     ```
   - **What happens**:
     - Stripe creates a test `payment_intent.succeeded` event
     - CLI forwards it to your local webhook endpoint
     - Your backend processes it
   - **What you should see**:
     - In CLI terminal: `POST /api/webhooks/stripe - 200 OK`
     - In server logs: Webhook processed successfully
   - **Verification**: Check your database to see if the event was processed

8. **Test Other Events**
   ```bash
   # Test various events:
   stripe trigger payment_intent.succeeded
   stripe trigger payment_intent.payment_failed
   stripe trigger charge.refunded
   stripe trigger setup_intent.succeeded
   stripe trigger customer.subscription.created
   stripe trigger invoice.payment_succeeded
   ```

**Verification:**
- ✅ Stripe CLI is installed and working
- ✅ CLI is logged in to your Stripe account
- ✅ CLI is forwarding events to local webhook endpoint
- ✅ Webhook signing secret from CLI is set in `.env.local`
- ✅ Test events are being received and processed

**Troubleshooting:**
- If CLI doesn't install: Check your system's package manager or download directly
- If login fails: Make sure you have internet connection and Stripe account access
- If events don't forward: Make sure your local server is running on port 3000
- If webhook returns 404: Make sure the endpoint exists at `/api/webhooks/stripe`
- If webhook fails: Check your backend logs for errors
- If signature verification fails: Make sure `STRIPE_WEBHOOK_SECRET` matches the CLI secret

**Important Notes:**
- The CLI secret is different from the production webhook secret
- Switch to production secret when deploying to production
- Keep CLI running while testing webhooks
- CLI only works with Stripe Test mode events

---

## Step 3: Cron Jobs Setup

### What This Step Does

Configures automated background jobs that run periodically to:
- Process email/SMS notifications from the queue
- Schedule reminder notifications before appointments
- Clean up expired held bookings
- Sync Stripe subscription status with database

### Why It's Important

These background jobs keep the system running smoothly:
- **Notifications**: Emails/SMS are queued when events happen, then sent asynchronously so users don't wait
- **Reminders**: Customers get automatic reminders 24h and 1h before appointments
- **Cleanup**: Expires held bookings so time slots become available again
- **Health**: Keeps subscription status accurate even if webhooks fail

### How Cron Jobs Work

1. A cron service calls your endpoints periodically
2. Endpoints require authentication via `CRON_SECRET` header
3. Each job processes pending work and updates the database
4. Jobs run independently and don't block user requests

---

### 3.1 Understanding Cron Endpoints

All cron endpoints require authentication via `Authorization: Bearer {CRON_SECRET}` header to prevent unauthorized access.

**1. Notifications Processor** (`/api/cron/notifications`)
   - **What it does**: Processes pending email and SMS notifications from the queue
   - **Frequency**: Every 1-2 minutes (recommended: 2 minutes)
   - **Purpose**: Send emails/SMS that were queued when events happened
   - **How it works**:
     1. Queries `notification_jobs` table for pending jobs
     2. Marks job as "in_progress"
     3. Sends email via SendGrid or SMS via Twilio
     4. Marks job as "sent" or "failed"
     5. Creates notification event log
   - **What happens if it doesn't run**: Notifications stay in queue and won't be sent

**2. Reminders Scheduler** (`/api/cron/reminders`)
   - **What it does**: Schedules 24-hour and 1-hour reminder notifications before appointments
   - **Frequency**: Every 5-10 minutes (recommended: 10 minutes)
   - **Purpose**: Find bookings happening soon and queue reminder notifications
   - **How it works**:
     1. Finds bookings happening in next 24 hours (not reminded yet)
     2. Creates notification jobs for 24h reminders
     3. Finds bookings happening in next 1 hour (not reminded yet)
     4. Creates notification jobs for 1h reminders
   - **What happens if it doesn't run**: Customers won't receive reminder notifications

**3. Cleanup Job** (`/api/cron/cleanup`)
   - **What it does**: Expires held bookings older than 5 minutes
   - **Frequency**: Every 1 minute (recommended: 1 minute)
   - **Purpose**: Free up time slots that customers abandoned during checkout
   - **How it works**:
     1. Finds bookings with status "held" older than 5 minutes
     2. Deletes or marks them as expired
     3. Makes those time slots available again
   - **What happens if it doesn't run**: Held bookings never expire, blocking time slots indefinitely

**4. Subscription Health Check** (`/api/cron/subscription-health`)
   - **What it does**: Syncs Stripe subscription status with database
   - **Frequency**: Daily (recommended: once per day, e.g., 2 AM)
   - **Purpose**: Keep subscription status accurate even if webhooks fail
   - **How it works**:
     1. Queries all businesses with Stripe subscriptions
     2. Checks subscription status in Stripe for each business
     3. Updates database if status changed
   - **What happens if it doesn't run**: Subscription status might be out of sync (not critical, webhooks handle most cases)

---

### 3.2 Setup Options

You have several options for running cron jobs. Choose the one that best fits your deployment setup.

#### Option A: Vercel Cron (Recommended for Vercel deployment)

**What**: Vercel's built-in cron job system that automatically calls your endpoints on a schedule.

**Why**: If you're deploying to Vercel, this is the simplest and most reliable option. It's built into the platform and automatically handles authentication.

**Pros:**
- ✅ Built into Vercel platform
- ✅ Automatic authentication (Vercel sends `CRON_SECRET` in header)
- ✅ Reliable and monitored by Vercel
- ✅ No additional services needed

**Cons:**
- ❌ Only works if you're using Vercel

**Step-by-step:**

1. **Create `vercel.json` in Project Root**
   - **Action**: Create a file named `vercel.json` in the root of your project (not in `apps/web/`)
   - **Location**: `/Users/3017387smacbookm/Downloads/Career/Tithi/vercel.json`
   - **Why**: This file configures Vercel settings including cron jobs

2. **Add Cron Configuration**
   - **Action**: Add the following JSON to `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/notifications",
         "schedule": "*/2 * * * *"
       },
       {
         "path": "/api/cron/reminders",
         "schedule": "*/10 * * * *"
       },
       {
         "path": "/api/cron/cleanup",
         "schedule": "*/1 * * * *"
       },
       {
         "path": "/api/cron/subscription-health",
         "schedule": "0 2 * * *"
       }
     ]
   }
   ```
   - **Explanation of schedules**:
     - `*/2 * * * *` = Every 2 minutes (notifications)
     - `*/10 * * * *` = Every 10 minutes (reminders)
     - `*/1 * * * *` = Every 1 minute (cleanup)
     - `0 2 * * *` = Daily at 2 AM (subscription health)
   - **Cron format**: `minute hour day month weekday`
     - `*` = any value
     - `*/N` = every N minutes/hours
     - `0 2 * * *` = at minute 0 of hour 2, every day

3. **Set CRON_SECRET in Vercel**
   - **Action**: Go to Vercel Dashboard > Your Project > Settings > Environment Variables
   - **Action**: Add a new environment variable:
     - **Key**: `CRON_SECRET`
     - **Value**: Your cron secret (generate with `openssl rand -hex 32`)
     - **Environment**: Production, Preview, Development (select all)
   - **Action**: Click **Save**
   - **Why**: Vercel automatically sends this in the `Authorization` header when calling cron endpoints

4. **Deploy to Vercel**
   - **Action**: Commit and push your changes
   - **Action**: Vercel will automatically deploy
   - **What happens**: Vercel reads `vercel.json` and sets up cron jobs
   - **Verification**: Go to Vercel Dashboard > Your Project > Functions > Cron Jobs
   - **You should see**: All 4 cron jobs listed with their schedules

5. **Verify Cron Jobs Are Running**
   - **Action**: Check Vercel Dashboard > Functions > Cron Jobs
   - **What you'll see**: Cron jobs with next execution time
   - **Action**: Check your application logs after the first execution
   - **Verification**: Should see successful requests to cron endpoints

**Verification:**
- ✅ `vercel.json` file created with cron configuration
- ✅ `CRON_SECRET` set in Vercel environment variables
- ✅ Project deployed to Vercel
- ✅ Cron jobs appear in Vercel Dashboard
- ✅ Logs show cron jobs are running

**Troubleshooting:**
- If cron jobs don't appear: Make sure `vercel.json` is in the project root (not in `apps/web/`)
- If cron jobs fail: Check `CRON_SECRET` is set correctly in Vercel
- If authentication fails: Verify `CRON_SECRET` matches what's in your code
- If schedules are wrong: Check cron syntax using a [cron expression validator](https://crontab.guru)

---

#### Option B: External Cron Service (e.g., cron-job.org, EasyCron)

**What**: Use a third-party cron service to call your endpoints periodically.

**Why**: If you're not using Vercel or want more control, external cron services work well. They're reliable and easy to set up.

**Pros:**
- ✅ Works with any hosting provider
- ✅ More flexible scheduling options
- ✅ Often have free tiers
- ✅ Good monitoring and logging

**Cons:**
- ❌ Requires additional service
- ❌ Need to manually configure authentication header
- ❌ External dependency

**Popular Services:**
- **cron-job.org** (free, easy to use)
- **EasyCron** (free tier available)
- **Cronitor** (free tier, good monitoring)
- **Pingdom** (free tier, monitoring focus)

**Step-by-step (using cron-job.org as example):**

1. **Sign Up for Service**
   - **Action**: Go to [cron-job.org](https://cron-job.org) and sign up
   - **Action**: Verify your email
   - **Why**: Free accounts are sufficient for basic cron jobs

2. **Create Cron Job for Notifications**
   - **Action**: Click **Create cronjob** or **+ Add cronjob**
   - **Fill in form**:
     - **Title**: "Tithi Notifications Processor"
     - **Address (URL)**: `https://yourdomain.com/api/cron/notifications`
     - **Schedule**: Every 2 minutes
       - Select "Every X minutes" → Enter `2`
     - **Request method**: GET
     - **Request headers**: Click **Add header**
       - **Header name**: `Authorization`
       - **Header value**: `Bearer YOUR_CRON_SECRET`
       - **⚠️ Important**: Replace `YOUR_CRON_SECRET` with your actual secret from `.env.local`
   - **Action**: Click **Create cronjob** or **Save**

3. **Create Cron Job for Reminders**
   - **Action**: Click **Create cronjob** again
   - **Fill in form**:
     - **Title**: "Tithi Reminders Scheduler"
     - **Address (URL)**: `https://yourdomain.com/api/cron/reminders`
     - **Schedule**: Every 10 minutes
     - **Request method**: GET
     - **Request headers**: 
       - `Authorization: Bearer YOUR_CRON_SECRET`
   - **Action**: Click **Create cronjob**

4. **Create Cron Job for Cleanup**
   - **Action**: Click **Create cronjob** again
   - **Fill in form**:
     - **Title**: "Tithi Cleanup Job"
     - **Address (URL)**: `https://yourdomain.com/api/cron/cleanup`
     - **Schedule**: Every 1 minute
     - **Request method**: GET
     - **Request headers**:
       - `Authorization: Bearer YOUR_CRON_SECRET`
   - **Action**: Click **Create cronjob**

5. **Create Cron Job for Subscription Health**
   - **Action**: Click **Create cronjob** again
   - **Fill in form**:
     - **Title**: "Tithi Subscription Health"
     - **Address (URL)**: `https://yourdomain.com/api/cron/subscription-health`
     - **Schedule**: Daily at 2 AM
       - Select "Daily" → Set time to `02:00`
     - **Request method**: GET
     - **Request headers**:
       - `Authorization: Bearer YOUR_CRON_SECRET`
   - **Action**: Click **Create cronjob**

6. **Verify Cron Jobs Are Running**
   - **Action**: Check cron service dashboard for execution history
   - **What you'll see**: Logs of each cron job execution
   - **Verification**: Should see successful requests (200 status codes)
   - **Action**: Check your application logs to verify endpoints are being called

**Verification:**
- ✅ All 4 cron jobs created in external service
- ✅ Each job has correct URL and schedule
- ✅ Authorization header is set correctly
- ✅ Cron jobs show successful executions in logs
- ✅ Application logs show requests are being received

**Troubleshooting:**
- If cron jobs fail: Check authorization header matches `CRON_SECRET`
- If 401 errors: Verify `Authorization: Bearer YOUR_CRON_SECRET` header is correct
- If 404 errors: Make sure URLs are correct and backend is deployed
- If jobs don't run: Check cron schedule is set correctly

---

#### Option C: GitHub Actions (for development/testing only)

**What**: Use GitHub Actions workflows to trigger cron endpoints periodically.

**Why**: Useful for development/testing, but not recommended for production due to reliability concerns.

**Pros:**
- ✅ Free with GitHub
- ✅ Good for development/testing
- ✅ Easy to set up

**Cons:**
- ❌ Not ideal for production (can be delayed or fail)
- ❌ Requires GitHub repository
- ❌ Limited scheduling options

**Step-by-step:**

1. **Create GitHub Workflow File**
   - **Action**: Create `.github/workflows/cron.yml` in your repository
   - **Location**: Repository root (not in `apps/web/`)
   - **Action**: Add the following YAML:
   ```yaml
   name: Cron Jobs

   on:
     schedule:
       # Notifications: Every 2 minutes
       - cron: '*/2 * * * *'
       # Reminders: Every 10 minutes
       - cron: '*/10 * * * *'
       # Cleanup: Every 1 minute
       - cron: '*/1 * * * *'
       # Subscription health: Daily at 2 AM
       - cron: '0 2 * * *'
     workflow_dispatch: # Allow manual triggers

   jobs:
     notifications:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger Notifications Cron
           run: |
             curl -X GET "${{ secrets.APP_URL }}/api/cron/notifications" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
     
     reminders:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger Reminders Cron
           run: |
             curl -X GET "${{ secrets.APP_URL }}/api/cron/reminders" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
     
     cleanup:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger Cleanup Cron
           run: |
             curl -X GET "${{ secrets.APP_URL }}/api/cron/cleanup" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
     
     subscription-health:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger Subscription Health Cron
           run: |
             curl -X GET "${{ secrets.APP_URL }}/api/cron/subscription-health" \
               -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
   ```

2. **Set GitHub Secrets**
   - **Action**: Go to GitHub Repository > Settings > Secrets and variables > Actions
   - **Action**: Click **New repository secret**
   - **Add secrets**:
     - **Name**: `APP_URL`
     - **Value**: `https://yourdomain.com` (your production URL)
   - **Action**: Click **Add secret**
   - **Action**: Add another secret:
     - **Name**: `CRON_SECRET`
     - **Value**: Your cron secret (same as `CRON_SECRET` in `.env.local`)
   - **Action**: Click **Add secret**

3. **Push to GitHub**
   - **Action**: Commit and push the workflow file
   - **What happens**: GitHub Actions will run the workflows on schedule
   - **Verification**: Go to GitHub Repository > Actions tab to see workflow runs

**⚠️ Important**: This option is only recommended for development/testing. For production, use Vercel Cron or an external cron service.

---

## Step 4: Testing the Backend

### What This Step Does

Testing verifies that:
- Database connection works
- Endpoints are accessible
- Authentication works
- Data is being saved correctly
- Errors are handled properly

### Why It's Important

Testing ensures everything works before deploying to production. It catches issues early and verifies the setup is correct.

### How to Test

- Use curl commands for quick tests
- Use the test script (`scripts/test-backend.sh`) for automated testing
- Use Postman for more advanced testing

---

### 4.1 Test Database Connection

**What**: Verifying that the backend can connect to Supabase and that all tables exist.

**Why**: This is the foundation - if database connection doesn't work, nothing else will work.

**Step-by-step:**

1. **Start Development Server**
   ```bash
   cd apps/web
   npm run dev
   ```
   - Server starts on `http://localhost:3000`
   - **⚠️ Important**: Keep this terminal window open

2. **Test Database Connection**
   ```bash
   curl http://localhost:3000/api/test-db
   ```
   - **Expected response:**
     ```json
     {
       "success": true,
       "connected": true,
       "tablesExist": true
     }
     ```
   - **Explanation**:
     - `success: true` = Request succeeded
     - `connected: true` = Database connection works
     - `tablesExist: true` = All required tables exist

3. **Verify Response**
   - **If successful**: You should see the JSON response above
   - **If it fails**: Check error message:
     - `connected: false` = Database connection issue (check `SUPABASE_SERVICE_ROLE_KEY`)
     - `tablesExist: false` = Tables don't exist (run migrations)
     - Connection timeout = Database URL might be wrong

**Verification:**
- ✅ Server is running
- ✅ Test endpoint returns success
- ✅ Database connection works
- ✅ All tables exist

**Troubleshooting:**
- If server doesn't start: Check if port 3000 is available, try `npm install` first
- If connection fails: Verify `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- If tables don't exist: Run database migrations (see database setup)
- If timeout: Check `NEXT_PUBLIC_SUPABASE_URL` is correct

---

### 4.2 Test Onboarding Endpoints

**What**: Testing the onboarding endpoints that businesses use to set up their accounts.

**Why**: These endpoints are critical - they're how businesses configure their services, staff, availability, etc.

**Step-by-step:**

1. **Sign Up a User First**
   - **Action**: Sign up a user via Supabase Auth (using your frontend or Supabase Dashboard)
   - **Where**: Your signup page or Supabase Dashboard > Authentication > Users > Add user
   - **Why**: Onboarding endpoints require authentication - you need a user account

2. **Get Access Token**
   - **Option A: Via Frontend**
     - Sign in using your login page
     - Check browser DevTools > Application > Cookies or Local Storage
     - Look for Supabase auth token (usually in cookies)
   - **Option B: Via API (Recommended for Testing)**
     ```bash
     curl -X POST "https://YOUR_PROJECT.supabase.co/auth/v1/token?grant_type=password" \
       -H "apikey: YOUR_ANON_KEY" \
       -H "Content-Type: application/json" \
       -d '{
         "email": "test@example.com",
         "password": "your_password"
       }'
     ```
     - **What you'll get**: JSON with `access_token` - use this as `YOUR_ACCESS_TOKEN`

3. **Test Step 1: Business Basics**
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
   - **What happens**: Creates or updates business record in database
   - **Expected response:**
     ```json
     {
       "success": true,
       "businessId": "uuid-here",
       "message": "Business information saved successfully"
     }
     ```
   - **Verification**: Check Supabase Dashboard > Table Editor > businesses table - should see new business

4. **Test Step 2: Website/Subdomain**
   ```bash
   curl -X PUT http://localhost:3000/api/business/onboarding/step-2-website \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "subdomain": "test-business",
       "status": "reserved"
     }'
   ```
   - **Expected response:**
     ```json
     {
       "success": true,
       "subdomain": "test-business",
       "bookingUrl": "https://test-business.tithi.com"
     }
     ```
   - **Verification**: Check `businesses` table - `subdomain` field should be updated

5. **Continue with Other Steps**
   - Test steps 3-11 following the same pattern
   - **Pattern**:
     1. Create request body based on endpoint's expected format
     2. Send PUT/POST request with `Authorization` header
     3. Check response for success
     4. Verify data in Supabase Dashboard
   - **See**: `docs/backend/ENDPOINT_REFERENCE.md` for all endpoint details

**Verification:**
- ✅ All onboarding endpoints return success
- ✅ Data is saved to database (verify in Supabase Dashboard)
- ✅ No errors in server logs
- ✅ Business record is created/updated correctly

**Troubleshooting:**
- If 401 Unauthorized: Check `YOUR_ACCESS_TOKEN` is valid and not expired
- If 404 Business not found: Complete Step 1 first
- If 400 Bad Request: Check request body format matches endpoint expectations
- If 500 Internal Server Error: Check server logs for detailed error message

---

### 4.3 Test Public Booking Flow

**What**: Testing the endpoints that customers use to browse services, check availability, and create bookings.

**Why**: This is the customer-facing API - if it doesn't work, customers can't book appointments.

**Step-by-step:**

1. **Prerequisites**
   - Complete onboarding first (steps 1-11) to create test data
   - **What you need**:
     - A business with subdomain (e.g., "test-business")
     - At least one service
     - At least one staff member
     - Availability rules set up
   - **Why**: Public endpoints need this data to work

2. **Get Catalog**
   - **What it does**: Returns business info, categories, services, and staff
   ```bash
   curl http://localhost:3000/api/public/test-business/catalog
   ```
   - **Expected response:**
     ```json
     {
       "business": {
         "id": "uuid",
         "name": "Test Business",
         "subdomain": "test-business",
         "brand_primary_color": "#FF5733"
       },
       "categories": [
         {
           "id": "uuid",
           "name": "Hair Services",
           "services": [...]
         }
       ],
       "staff": [...]
     }
     ```
   - **Verification**:
     - Business info is returned
     - Categories and services are returned
     - Staff list is returned
   - **⚠️ Important**: Replace `test-business` with your actual business subdomain

3. **Get Availability**
   - **What it does**: Returns available time slots for a service on a specific date
   ```bash
   curl "http://localhost:3000/api/public/test-business/availability?service_id=SERVICE_ID&date=2025-01-20"
   ```
   - **What you need**:
     - `service_id` - UUID of a service (get from catalog response)
     - `date` - Date in YYYY-MM-DD format
   - **Expected response:**
     ```json
     {
       "slots": [
         {
           "staff_id": "uuid",
           "staff_name": "John Doe",
           "start_at": "2025-01-20T14:00:00Z",
           "end_at": "2025-01-20T14:30:00Z"
         }
       ],
       "service_id": "uuid",
       "date": "2025-01-20"
     }
     ```
   - **Verification**:
     - Slots are returned for the date
     - Slots respect availability rules
     - Slots exclude blackouts and existing bookings
   - **Troubleshooting**:
     - If no slots returned: Check availability rules are set up, date is in the future, no blackouts for that date
     - If wrong slots: Check business timezone is correct

4. **Preview Gift Code (Optional)**
   - **What it does**: Validates a gift code and computes discount
   ```bash
   curl -X POST http://localhost:3000/api/public/test-business/gift-codes/preview \
     -H "Content-Type: application/json" \
     -d '{
       "code": "WINTER50",
       "base_price_cents": 5000
     }'
   ```
   - **Expected response:**
     ```json
     {
       "discount_cents": 2500,
       "final_price_cents": 2500,
       "type": "percent",
       "gift_card_id": "uuid"
     }
     ```
   - **Verification**: Discount is calculated correctly

5. **Create Booking**
   - **What it does**: Creates a new booking and saves customer's card (no charge yet)
   ```bash
   curl -X POST http://localhost:3000/api/public/test-business/bookings \
     -H "Content-Type: application/json" \
     -d '{
       "service_id": "SERVICE_ID",
       "staff_id": "STAFF_ID",
       "start_at": "2025-01-20T14:00:00Z",
       "customer": {
         "name": "Jane Doe",
         "email": "jane@example.com",
         "phone": "+1234567890"
       },
       "gift_card_code": "WINTER50"
     }'
   ```
   - **What happens**:
     1. Validates slot is still available
     2. Creates/finds customer record
     3. Creates booking with status "pending"
     4. Creates Stripe SetupIntent to save card
     5. Creates booking_payment record
   - **Expected response:**
     ```json
     {
       "booking_id": "uuid",
       "booking_code": "TITHI-1234ABCD",
       "client_secret": "seti_xxx_secret_xxx",
       "setup_intent_id": "seti_xxx",
       "final_price_cents": 2500
     }
     ```
   - **Verification**:
     - Booking is created in database
     - Customer record is created/found
     - SetupIntent is created in Stripe
     - Booking payment record is created
   - **⚠️ Important**: Use the `client_secret` in frontend with Stripe Elements to complete card setup

**Verification:**
- ✅ Catalog returns business data correctly
- ✅ Availability returns slots for valid dates
- ✅ Booking creation succeeds
- ✅ Customer and booking records are created
- ✅ SetupIntent is created in Stripe

**Troubleshooting:**
- If catalog returns 404: Check business subdomain exists and is correct
- If no availability slots: Check availability rules are set up, date is in the future
- If booking fails: Check slot is still available, service/staff IDs are correct
- If SetupIntent fails: Check Stripe keys are set correctly

---

### 4.4 Test Admin Endpoints

**What**: Testing the endpoints that business owners use to manage bookings and process payments.

**Why**: These are critical endpoints - they handle money and booking management. They must work correctly.

**Step-by-step:**

1. **List Bookings**
   - **What it does**: Returns paginated list of bookings with filters
   ```bash
   curl http://localhost:3000/api/admin/bookings \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```
   - **With filters:**
     ```bash
     curl "http://localhost:3000/api/admin/bookings?status=pending&from=2025-01-01&to=2025-01-31&limit=20" \
       -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
     ```
   - **Query parameters**:
     - `status` (optional): Filter by status (pending, completed, no_show, cancelled, refunded)
     - `from` (optional): Start date (YYYY-MM-DD)
     - `to` (optional): End date (YYYY-MM-DD)
     - `cursor` (optional): Pagination cursor
     - `limit` (optional): Page size (default: 20)
   - **Expected response:**
     ```json
     {
       "items": [
         {
           "id": "uuid",
           "code": "TITHI-1234ABCD",
           "status": "pending",
           "service": {"name": "Haircut", "duration_min": 30, "price_cents": 5000},
           "customer": {"name": "Jane Doe", "email": "jane@example.com"},
           "start_at": "2025-01-20T14:00:00Z",
           "final_price_cents": 5000,
           "last_payment_status": "card_saved"
         }
       ],
       "next_page_token": "uuid"
     }
     ```
   - **Verification**:
     - Bookings are returned
     - Filters work correctly
     - Pagination works (if more than limit)

2. **Complete Booking (Charge Full Amount)**
   - **What it does**: Charges the full amount for a completed booking
   ```bash
   curl -X POST http://localhost:3000/api/admin/bookings/BOOKING_ID/complete \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "X-Idempotency-Key: unique-key-123"
   ```
   - **What you need**:
     - `BOOKING_ID` - UUID of a booking (get from list bookings response)
     - `X-Idempotency-Key` - Unique string to prevent duplicate charges (required)
   - **What happens**:
     1. Checks idempotency (returns cached response if key exists)
     2. Looks up booking and business
     3. Gets payment method from SetupIntent
     4. Creates Stripe PaymentIntent with Connect destination
     5. Creates booking_payment record
     6. Updates booking status to "completed"
     7. Handles gift card balance if applicable
   - **Expected response:**
     ```json
     {
       "status": "CHARGED",
       "charge_amount": 5000,
       "currency": "usd",
       "stripe_payment_intent_id": "pi_xxx",
       "receipt_url": "https://dashboard.stripe.com/payments/pi_xxx"
     }
     ```
   - **Verification**:
     - PaymentIntent is created in Stripe
     - Booking status is updated to "completed"
     - Booking payment record is created
     - Gift card balance is deducted (if applicable)
   - **⚠️ Important**: Always include `X-Idempotency-Key` header with a unique value for each request

3. **No-Show Booking (Charge Fee)**
   - **What it does**: Charges no-show fee from policy
   ```bash
   curl -X POST http://localhost:3000/api/admin/bookings/BOOKING_ID/no-show \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "X-Idempotency-Key: unique-key-456"
   ```
   - **Expected response**: Same format as Complete, but `charge_amount` is the no-show fee
   - **Verification**:
     - Fee is calculated from policy_snapshot
     - PaymentIntent is created with correct amount
     - Booking status is updated to "no_show"

4. **Cancel Booking (Charge Fee)**
   - **What it does**: Charges cancellation fee from policy
   ```bash
   curl -X POST http://localhost:3000/api/admin/bookings/BOOKING_ID/cancel \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "X-Idempotency-Key: unique-key-789"
   ```
   - **Expected response**: Same format as Complete, but `charge_amount` is the cancellation fee
   - **Verification**:
     - Fee is calculated from policy_snapshot
     - PaymentIntent is created with correct amount
     - Booking status is updated to "cancelled"

5. **Refund Booking**
   - **What it does**: Refunds a previous charge
   ```bash
   curl -X POST http://localhost:3000/api/admin/bookings/BOOKING_ID/refund \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "X-Idempotency-Key: unique-key-101"
   ```
   - **Expected response:**
     ```json
     {
       "status": "REFUNDED",
       "refund_amount": 5000,
       "currency": "usd",
       "stripe_refund_id": "re_xxx",
       "receipt_url": "https://dashboard.stripe.com/refunds/re_xxx"
     }
     ```
   - **Verification**:
     - Refund is created in Stripe
     - Booking status is updated to "refunded"
     - Refund payment record is created
     - Gift card balance is restored (if applicable)

**Verification:**
- ✅ All admin endpoints return success
- ✅ Money actions create PaymentIntents/Refunds in Stripe
- ✅ Booking statuses are updated correctly
- ✅ Idempotency prevents duplicate charges
- ✅ Gift card balances are handled correctly

**Troubleshooting:**
- If 401 Unauthorized: Check access token is valid
- If 404 Booking not found: Check booking ID is correct and belongs to your business
- If 400 Bad Request: Check `X-Idempotency-Key` header is included
- If PaymentIntent fails: Check Stripe Connect account is active, payment method is valid
- If idempotency returns cached response: This is expected - use a different key for new requests

---

### 4.5 Test Stripe Webhook (Local)

**What**: Testing that Stripe webhooks are received and processed correctly.

**Why**: Webhooks are critical - they update database when events happen in Stripe (payments succeed, subscriptions change, etc.).

**Step-by-step:**

1. **Prerequisites**
   - Complete Step 2.4 (Setup Stripe CLI) first
   - Make sure Stripe CLI is running and forwarding events
   - **Why**: You need Stripe CLI to test webhooks locally

2. **Start Webhook Forwarding**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   - **⚠️ Important**: Keep this terminal window open

3. **Trigger Test Events**
   - In another terminal, trigger test events:
     ```bash
     # Test payment intent succeeded
     stripe trigger payment_intent.succeeded
     
     # Test payment intent failed
     stripe trigger payment_intent.payment_failed
     
     # Test charge refunded
     stripe trigger charge.refunded
     
     # Test setup intent succeeded
     stripe trigger setup_intent.succeeded
     
     # Test subscription created
     stripe trigger customer.subscription.created
     
     # Test invoice payment succeeded
     stripe trigger invoice.payment_succeeded
     ```
   - **What happens**:
     1. Stripe creates a test event
     2. CLI forwards it to your local webhook endpoint
     3. Your backend processes it
     4. Backend updates database

4. **Verify Webhook Processing**
   - **In CLI terminal**: Should see `POST /api/webhooks/stripe - 200 OK`
   - **In server logs**: Should see webhook processed successfully
   - **In database**: Should see data updated (e.g., booking status changed)
   - **Action**: Check Supabase Dashboard to verify data changes

5. **Check Webhook Logs**
   - Check your server logs for webhook processing messages
   - **What you should see**:
     - Webhook received
     - Event type processed
     - Database updated
     - Response 200 OK

**Verification:**
- ✅ Stripe CLI is forwarding events
- ✅ Webhooks are being received (check CLI output)
- ✅ Webhooks are processed successfully (check server logs)
- ✅ Database is updated correctly (check Supabase Dashboard)

**Troubleshooting:**
- If CLI doesn't forward: Make sure CLI is logged in (`stripe login`)
- If webhook returns 400: Check `STRIPE_WEBHOOK_SECRET` matches CLI secret
- If webhook returns 500: Check server logs for error details
- If database doesn't update: Check webhook handler logic, verify metadata contains booking_id/business_id

---

## Step 5: Production Deployment Checklist

### What This Step Does

Ensures everything is configured correctly before deploying to production. This checklist helps prevent issues and ensures a smooth launch.

### Why It's Important

Production deployment requires careful verification. Missing configuration or incorrect settings can cause downtime, payment failures, or data issues.

### Pre-Deployment Checklist

Before deploying to production, verify each item:

#### Environment Variables

- [ ] **All environment variables set in production**
  - **Action**: Set all variables in your hosting platform (Vercel, Railway, etc.)
  - **Where**: Platform dashboard > Settings > Environment Variables
  - **What to check**: Every variable from `.env.local` should be set
  - **Why**: Backend won't work without these

- [ ] **`NEXT_PUBLIC_APP_URL` set to production domain**
  - **Action**: Update `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com`
  - **Why**: Used for webhooks, redirects, generating absolute URLs
  - **Example**: `NEXT_PUBLIC_APP_URL=https://app.tithi.com`

- [ ] **`CRON_SECRET` set in production environment**
  - **Action**: Set `CRON_SECRET` in production (generate new one or use same as dev)
  - **Why**: Protects cron endpoints from unauthorized access
  - **⚠️ Important**: Must match what cron service uses

#### Stripe Configuration

- [ ] **Stripe webhook endpoint configured in production Stripe dashboard**
  - **Action**: Go to Stripe Dashboard > Developers > Webhooks
  - **Action**: Create new endpoint with production URL: `https://yourdomain.com/api/webhooks/stripe`
  - **Action**: Select all required events (see Step 2.3)
  - **Why**: Stripe needs to send events to your production server

- [ ] **`STRIPE_WEBHOOK_SECRET` updated for production webhook**
  - **Action**: Copy signing secret from production webhook
  - **Action**: Update `STRIPE_WEBHOOK_SECRET` in production environment variables
  - **⚠️ Important**: Production webhook secret is different from local/CLI secret
  - **Why**: Used to verify webhook signatures

- [ ] **`STRIPE_PLAN_PRICE_ID` set to production price ID (if using live mode)**
  - **Action**: If using Stripe Live mode, create production product and price
  - **Action**: Update `STRIPE_PLAN_PRICE_ID` to production price ID
  - **Why**: Each mode (test/live) has different IDs

- [ ] **Stripe Connect onboarding tested**
  - **Action**: Test creating a Connect account in production
  - **Action**: Verify account link works and redirects correctly
  - **Why**: Businesses need to complete Connect onboarding

- [ ] **Subscription creation tested**
  - **Action**: Test creating a subscription in production
  - **Action**: Verify subscription appears in Stripe Dashboard
  - **Why**: Businesses need subscriptions to use the platform

- [ ] **Payment flow tested end-to-end**
  - **Action**: Test full flow: Booking → Complete → Charge → Refund
  - **Action**: Verify money goes to correct accounts
  - **Action**: Check platform fee (1%) is calculated correctly
  - **Why**: Payment flow must work correctly in production

- [ ] **Webhook events verified in Stripe Dashboard**
  - **Action**: Check Stripe Dashboard > Developers > Webhooks > Your endpoint
  - **Action**: Verify events are being delivered successfully
  - **Action**: Check webhook logs for any failures
  - **Why**: Webhooks must work to keep database in sync

#### Database & Security

- [ ] **Database migrations applied to production Supabase**
  - **Action**: Run migrations on production Supabase instance
  - **How**: Supabase Dashboard > SQL Editor > Run migration files
  - **Why**: Database schema must exist in production

- [ ] **RLS policies verified**
  - **Action**: Test RLS policies in production
  - **Action**: Verify users can only see their own data
  - **Action**: Test with multiple users to ensure isolation
  - **Why**: RLS prevents data leaks between businesses

#### Background Jobs

- [ ] **Cron jobs configured (Vercel Cron or external service)**
  - **Action**: Set up cron jobs pointing to production URLs
  - **Action**: Verify `CRON_SECRET` is set correctly
  - **Action**: Test cron jobs are running
  - **Why**: Background jobs must run to keep system working

#### Notifications

- [ ] **Notification sending tested (if email/SMS configured)**
  - **Action**: Test sending a notification in production
  - **Action**: Verify email/SMS is received
  - **Action**: Check notification_jobs table for successful sends
  - **Why**: Customers need to receive notifications

#### Monitoring & Logging

- [ ] **Error monitoring set up (Sentry, LogRocket, etc.)**
  - **Action**: Set up error monitoring service
  - **Action**: Configure error tracking for production
  - **Action**: Set up alerts for critical errors
  - **Why**: Need to know when things break in production

- [ ] **Application logs configured**
  - **Action**: Set up logging for production (Vercel logs, LogRocket, etc.)
  - **Action**: Verify logs are being captured
  - **Why**: Need logs to debug issues

#### Security

- [ ] **Environment variables marked as sensitive in platform**
  - **Action**: Mark secrets as sensitive in hosting platform
  - **Why**: Prevents accidental exposure

- [ ] **SSL/HTTPS enabled**
  - **Action**: Verify HTTPS is enabled (usually automatic on Vercel)
  - **Why**: Required for webhooks and security

- [ ] **API rate limiting considered**
  - **Action**: Consider adding rate limiting for public endpoints
  - **Why**: Protects against abuse

#### Testing

- [ ] **Full onboarding flow tested in production**
  - **Action**: Create a test business and complete all onboarding steps
  - **Action**: Verify all data is saved correctly
  - **Why**: Onboarding must work in production

- [ ] **Public booking flow tested in production**
  - **Action**: Test booking a service on production site
  - **Action**: Verify booking is created and card is saved
  - **Why**: Customers need to be able to book

- [ ] **Admin money board actions tested in production**
  - **Action**: Test Complete, No-Show, Cancel, Refund actions
  - **Action**: Verify charges/refunds happen correctly
  - **Why**: Money actions must work correctly

### Deployment Steps

1. **Set Environment Variables**
   - Add all variables to your hosting platform
   - Mark sensitive variables as secret

2. **Deploy Application**
   - Commit and push code
   - Deploy to production
   - Verify deployment succeeds

3. **Configure Stripe Webhook**
   - Create webhook in Stripe Dashboard with production URL
   - Copy webhook secret
   - Update `STRIPE_WEBHOOK_SECRET` in production

4. **Set Up Cron Jobs**
   - Configure Vercel Cron or external service
   - Verify cron jobs are running
   - Check logs for successful executions

5. **Run Database Migrations**
   - Apply migrations to production Supabase
   - Verify all tables exist
   - Test RLS policies

6. **Test Everything**
   - Run through full test checklist above
   - Fix any issues found
   - Verify all features work

7. **Monitor**
   - Set up error monitoring
   - Check logs regularly
   - Monitor Stripe webhook delivery

### Post-Deployment Verification

After deployment, verify:

- ✅ Application is accessible at production URL
- ✅ All endpoints return expected responses
- ✅ Database queries work correctly
- ✅ Stripe webhooks are being received
- ✅ Cron jobs are running successfully
- ✅ No errors in application logs
- ✅ No errors in Stripe Dashboard
- ✅ No errors in Supabase Dashboard

---

## Step 6: Monitoring & Maintenance

### What This Step Does

Sets up ongoing monitoring and maintenance to ensure the system runs smoothly in production.

### Why It's Important

Regular monitoring helps catch issues early, ensures background jobs are running, and maintains system health.

---

### 6.1 Monitor Stripe Webhooks

**What**: Monitoring Stripe webhook delivery to ensure events are being received and processed.

**Why**: Webhooks update the database when events happen. If webhooks fail, the database can get out of sync with Stripe.

**How to Monitor:**

1. **Go to Stripe Dashboard**
   - Navigate to **Developers** > **Webhooks** in Stripe Dashboard
   - Click on your webhook endpoint

2. **Check Webhook Delivery Logs**
   - **What to look for**:
     - ✅ Green status = Successfully delivered
     - ⚠️ Yellow status = Attempting delivery
     - ❌ Red status = Failed delivery
   - **Review recent events**:
     - Check last 24 hours of webhook attempts
     - Look for patterns (repeated failures)
     - Check error messages

3. **Retry Failed Webhooks**
   - **Action**: Click on failed webhook event
   - **Action**: Click **Send again** or **Retry**
   - **Why**: Sometimes webhooks fail due to temporary issues

4. **Check Webhook Response Times**
   - **What to monitor**: Response time should be < 5 seconds
   - **If slow**: Check backend performance, database queries

**What to Look For:**
- ✅ Most webhooks are successfully delivered (200 status)
- ✅ Response times are reasonable (< 5 seconds)
- ⚠️ Occasional failures are retried and succeed
- ❌ Repeated failures need investigation

**Common Issues:**
- **Webhook timeout**: Backend taking too long to process
- **Invalid signature**: `STRIPE_WEBHOOK_SECRET` mismatch
- **404 errors**: Endpoint doesn't exist or wrong URL
- **500 errors**: Backend code error (check logs)

---

### 6.2 Monitor Cron Jobs

**What**: Ensuring background jobs are running on schedule and processing work correctly.

**Why**: Background jobs keep the system running smoothly. If they stop, notifications won't send, reminders won't schedule, etc.

**How to Monitor:**

1. **Check Cron Service Logs**
   - **Vercel**: Go to Vercel Dashboard > Functions > Cron Jobs
   - **External Service**: Check cron service dashboard for execution history
   - **GitHub Actions**: Go to Repository > Actions tab

2. **What to Monitor for Each Job:**

   **Notifications Processor**:
   - ✅ Should run every 1-2 minutes
   - ✅ Should process pending notifications
   - ✅ Should have high success rate
   - ❌ If failing: Check email/SMS provider credentials

   **Reminders Scheduler**:
   - ✅ Should run every 5-10 minutes
   - ✅ Should schedule reminders for upcoming bookings
   - ✅ Should not create duplicate reminders
   - ❌ If failing: Check booking queries, notification templates

   **Cleanup Job**:
   - ✅ Should run every 1 minute
   - ✅ Should expire held bookings older than 5 minutes
   - ✅ Should free up time slots
   - ❌ If failing: Check booking queries

   **Subscription Health**:
   - ✅ Should run daily
   - ✅ Should sync subscription status from Stripe
   - ✅ Should update database correctly
   - ❌ If failing: Check Stripe API access

3. **Check Application Logs**
   - **Action**: Check your application logs after cron job runs
   - **What to look for**:
     - Success messages
     - Error messages
     - Processing counts (e.g., "processed 5 notifications")

4. **Verify Jobs Are Processing Work**
   - **Notifications**: Check `notification_jobs` table - status should change from "pending" to "sent"
   - **Reminders**: Check `notification_jobs` table - should see new reminder jobs created
   - **Cleanup**: Check `bookings` table - held bookings older than 5 minutes should be deleted
   - **Subscription Health**: Check `businesses` table - subscription_status should match Stripe

**What to Look For:**
- ✅ Jobs are running on schedule
- ✅ Jobs are processing work successfully
- ✅ No repeated failures
- ✅ Processing counts are reasonable

**Common Issues:**
- **Jobs not running**: Check cron service configuration, verify `CRON_SECRET` is set
- **Jobs failing**: Check application logs for error details
- **Jobs not processing work**: Check database queries, verify data exists
- **Slow processing**: Optimize queries, check database performance

---

### 6.3 Database Monitoring

**What**: Monitoring Supabase database health, performance, and data integrity.

**Why**: Database issues can cause application failures, slow performance, or data corruption.

**How to Monitor:**

1. **Check Supabase Dashboard**
   - Go to Supabase Dashboard > Your Project
   - Review database health metrics

2. **Monitor Database Performance**
   - **Query Performance**: Check slow queries
   - **Connection Count**: Monitor active connections
   - **Database Size**: Monitor growth over time
   - **Index Usage**: Verify indexes are being used

3. **Check RLS Policy Violations**
   - **What to check**: Users should only see their own data
   - **How to test**: Try querying as different users, verify isolation
   - **Why**: RLS violations indicate security issues

4. **Monitor Failed Queries**
   - **Action**: Check Supabase Dashboard > Logs > Database
   - **What to look for**: Error messages, failed queries
   - **Why**: Failed queries indicate issues with queries or data

5. **Monitor Row Count Growth**
   - **Action**: Check table row counts over time
   - **What to look for**: Normal growth patterns
   - **Why**: Unusual growth might indicate issues (e.g., failed cleanup jobs)

6. **Check Database Health**
   - **Action**: Run test queries regularly
   - **Action**: Verify all tables exist and are accessible
   - **Action**: Check foreign key constraints are working

**What to Look For:**
- ✅ Query response times are reasonable (< 100ms for simple queries)
- ✅ Connection count is within limits
- ✅ No RLS policy violations
- ✅ No repeated query failures
- ✅ Row counts grow at expected rates

**Common Issues:**
- **Slow queries**: Add indexes, optimize queries
- **Connection limit**: Check for connection leaks, increase limit if needed
- **RLS violations**: Review RLS policies, test with different users
- **Query failures**: Check query syntax, verify data types

---

### 6.4 Error Logging

**What**: Setting up error tracking and logging to catch issues early.

**Why**: Errors happen in production. Error logging helps you find and fix issues quickly.

**Recommended Tools:**

1. **Sentry** (Recommended for Error Tracking)
   - **What it does**: Captures errors, exceptions, and stack traces
   - **Why**: Helps identify and fix bugs quickly
   - **How to set up**:
     ```bash
     npm install @sentry/nextjs
     ```
   - **Configuration**: Add Sentry DSN to environment variables
   - **What you get**: Error alerts, stack traces, user context

2. **LogRocket** (Recommended for Session Replay)
   - **What it does**: Records user sessions and replays them
   - **Why**: Helps debug user-reported issues
   - **How to set up**: Install LogRocket SDK
   - **What you get**: Session replays, network logs, console logs

3. **Vercel Analytics** (Recommended for Performance Monitoring)
   - **What it does**: Tracks performance metrics, page views, etc.
   - **Why**: Helps identify performance issues
   - **How to set up**: Enable in Vercel Dashboard
   - **What you get**: Performance metrics, traffic analytics

4. **Custom Logging**
   - **What it does**: Log important events to a service
   - **Options**: CloudWatch, Datadog, LogRocket, etc.
   - **Why**: Custom logs help track specific business events

**What to Monitor:**
- ✅ Error rates (should be low)
- ✅ Error types (common errors need fixing)
- ✅ Performance metrics (response times)
- ✅ User-reported issues

**Common Issues:**
- **High error rate**: Investigate common errors, fix bugs
- **Slow performance**: Optimize queries, add caching
- **User-reported issues**: Check session replays, logs

---

## Troubleshooting

### Common Issues and Solutions

This section covers common issues you might encounter and how to resolve them.

---

### Issue: Stripe Webhook Not Working

**Symptoms:**
- Webhook shows as "Failed" in Stripe Dashboard
- Webhook events are not being processed
- Database not updating when Stripe events occur

**Step-by-step Troubleshooting:**

1. **Verify Webhook URL is Correct**
   - **Action**: Check Stripe Dashboard > Developers > Webhooks > Your endpoint
   - **Verify**: URL matches your production endpoint (e.g., `https://yourdomain.com/api/webhooks/stripe`)
   - **Check**: No typos, correct protocol (https), correct path
   - **Why**: Wrong URL means Stripe can't reach your endpoint

2. **Check `STRIPE_WEBHOOK_SECRET` Matches Stripe Dashboard**
   - **Action**: Compare `STRIPE_WEBHOOK_SECRET` in `.env.local` with Stripe Dashboard
   - **Where to find**: Stripe Dashboard > Developers > Webhooks > Your endpoint > Signing secret
   - **Action**: Click "Reveal" to see the secret
   - **Action**: Compare with your environment variable
   - **Why**: Mismatch means signature verification fails

3. **Verify Webhook Signature Verification in Logs**
   - **Action**: Check your application logs when webhook is received
   - **What to look for**: Error messages about signature verification
   - **Common errors**: "Invalid signature", "Webhook signature verification failed"
   - **Why**: Signature verification ensures webhook came from Stripe

4. **Test with Stripe CLI Locally First**
   - **Action**: Test webhook locally using Stripe CLI (see Step 2.4)
   - **Why**: Local testing isolates issues before production

5. **Check Webhook Response**
   - **Action**: Check Stripe Dashboard > Webhooks > Delivery logs
   - **What to look for**: Response status codes
   - **Expected**: 200 OK
   - **If 404**: Endpoint doesn't exist or wrong URL
   - **If 500**: Backend error (check application logs)

**Additional Checks:**
- ✅ Webhook endpoint exists at `/api/webhooks/stripe`
- ✅ Server is running and accessible
- ✅ No firewall blocking Stripe IPs
- ✅ SSL certificate is valid (for production)

**Solution:**
- Update webhook URL if incorrect
- Update `STRIPE_WEBHOOK_SECRET` if mismatch
- Fix backend errors if 500 status
- Verify endpoint exists if 404 status

---

### Issue: Cron Jobs Not Running

**Symptoms:**
- Cron jobs are not executing
- Notifications are not being sent
- Reminders are not being scheduled
- Held bookings are not expiring

**Step-by-step Troubleshooting:**

1. **Verify `CRON_SECRET` is Set**
   - **Action**: Check environment variables in your hosting platform
   - **Verify**: `CRON_SECRET` exists and has a value
   - **Why**: Cron endpoints require this for authentication

2. **Check Cron Service is Sending `Authorization` Header**
   - **Action**: Check cron service configuration
   - **Verify**: Header `Authorization: Bearer {CRON_SECRET}` is set
   - **For Vercel**: Vercel sends this automatically (verify `CRON_SECRET` is set)
   - **For External Services**: Manually verify header is configured
   - **Why**: Without auth header, endpoints return 401

3. **Verify Endpoint URLs are Correct**
   - **Action**: Check cron service dashboard for configured URLs
   - **Verify**: URLs match your production endpoints
   - **Format**: `https://yourdomain.com/api/cron/{job-name}`
   - **Why**: Wrong URLs result in 404 errors

4. **Check Application Logs for Errors**
   - **Action**: Check application logs when cron job should run
   - **What to look for**: Error messages, stack traces
   - **Why**: Logs show what's failing

5. **Test Cron Endpoint Manually**
   - **Action**: Call cron endpoint manually:
     ```bash
     curl -X GET "https://yourdomain.com/api/cron/notifications" \
       -H "Authorization: Bearer YOUR_CRON_SECRET"
     ```
   - **Expected**: 200 OK with JSON response
   - **Why**: Manual testing verifies endpoint works

6. **Check Cron Service Execution Logs**
   - **Action**: Check cron service dashboard for execution history
   - **What to look for**: Success/failure status, response codes
   - **Why**: Service logs show if requests are being sent

**Additional Checks:**
- ✅ Cron service is configured and active
- ✅ Schedule is set correctly (check cron syntax)
- ✅ Server is running and accessible
- ✅ No rate limiting blocking requests

**Solution:**
- Set `CRON_SECRET` if missing
- Fix authorization header if incorrect
- Update endpoint URLs if wrong
- Fix backend errors if 500 status
- Verify cron service is running

---

### Issue: Payment Intent Fails

**Symptoms:**
- Payment charges fail when clicking Complete/No-Show/Cancel
- Error message: "Payment failed" or "Payment method invalid"
- Booking status doesn't update after money action

**Step-by-step Troubleshooting:**

1. **Verify Stripe Connect Account is Active**
   - **Action**: Check Stripe Dashboard > Connect > Accounts
   - **Verify**: Business's Connect account exists and is active
   - **Check**: Account status should be "Enabled" or "Active"
   - **Why**: Payments require an active Connect account

2. **Check `stripe_connect_account_id` is Set on Business**
   - **Action**: Check `businesses` table in Supabase
   - **Verify**: `stripe_connect_account_id` field has a value
   - **Action**: Verify the account ID is valid in Stripe
   - **Why**: Backend needs this to route payments correctly

3. **Verify Payment Method is Attached to Customer**
   - **Action**: Check Stripe Dashboard > Customers > [Customer]
   - **Verify**: Payment method exists and is valid
   - **Check**: Payment method is not expired or invalid
   - **Why**: Payment requires a valid payment method

4. **Check Stripe Dashboard for Error Details**
   - **Action**: Go to Stripe Dashboard > Payments
   - **Action**: Find the failed payment intent
   - **Action**: Check error message and decline code
   - **Why**: Stripe provides specific error reasons

5. **Verify Setup Intent Succeeded**
   - **Action**: Check `booking_payments` table
   - **Verify**: `stripe_setup_intent_id` exists
   - **Action**: Check Stripe Dashboard for SetupIntent status
   - **Verify**: SetupIntent status is "succeeded"
   - **Why**: Payment requires a successful SetupIntent

6. **Check Payment Method ID**
   - **Action**: Verify `getPaymentMethodFromSetupIntent()` returns a valid ID
   - **Action**: Check Stripe Dashboard > Payment Methods
   - **Verify**: Payment method exists and belongs to customer
   - **Why**: Payment needs a valid payment method ID

**Common Error Codes:**
- `card_declined`: Card was declined (insufficient funds, etc.)
- `expired_card`: Card has expired
- `incorrect_cvc`: CVC code is incorrect
- `processing_error`: Stripe couldn't process the payment
- `insufficient_funds`: Card doesn't have enough funds

**Solution:**
- Activate Connect account if inactive
- Set `stripe_connect_account_id` if missing
- Update payment method if expired or invalid
- Check Stripe error details and fix accordingly
- Retry payment with valid payment method

---

### Issue: Notifications Not Sending

**Symptoms:**
- Notifications are not being sent to customers
- Notification jobs stay in "pending" status
- No emails or SMS are received

**Step-by-step Troubleshooting:**

1. **Verify Notification Templates Exist for the Trigger**
   - **Action**: Check `notification_templates` table in Supabase
   - **Verify**: Template exists for the trigger (e.g., "booking_created")
   - **Check**: Template is enabled (`is_enabled = true`)
   - **Check**: Template is not soft-deleted (`deleted_at IS NULL`)
   - **Why**: Templates are required to send notifications

2. **Check Notification Jobs are Being Created**
   - **Action**: Check `notification_jobs` table in Supabase
   - **Verify**: Jobs are being created when events happen
   - **Check**: Job status should be "pending" initially
   - **Why**: Jobs must be created before they can be processed

3. **Verify Cron Job is Running**
   - **Action**: Check cron service logs (see Step 6.2)
   - **Verify**: Notifications cron job is executing
   - **Check**: Job is processing pending notifications
   - **Why**: Cron job processes notification queue

4. **Check Email/SMS Provider Credentials if Configured**
   - **Action**: Verify environment variables are set:
     - `SENDGRID_API_KEY` (for email)
     - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (for SMS)
   - **Verify**: Credentials are valid and not expired
   - **Why**: Provider credentials are required to send emails/SMS

5. **Check Notification Job Status**
   - **Action**: Check `notification_jobs` table
   - **What to look for**:
     - `status = "pending"` = Not processed yet
     - `status = "failed"` = Failed to send (check `last_error`)
     - `status = "dead"` = Failed too many times
     - `status = "sent"` = Successfully sent
   - **Why**: Status shows what's happening with each job

6. **Check Notification Events Log**
   - **Action**: Check `notification_events` table
   - **Verify**: Events are being created
   - **Check**: Event status and error messages
   - **Why**: Events log shows what was sent/failed

7. **Verify Recipient Information is Valid**
   - **Action**: Check notification job has valid recipient:
     - `recipient_email` for email notifications
     - `recipient_phone` for SMS notifications
   - **Verify**: Email/phone format is correct
   - **Why**: Invalid recipient means notification can't be sent

**Additional Checks:**
- ✅ Email/SMS provider accounts are active
- ✅ Provider API limits not exceeded
- ✅ Email is not marked as spam
- ✅ Phone number is valid format

**Solution:**
- Create notification templates if missing
- Enable templates if disabled
- Configure email/SMS provider credentials
- Fix cron job if not running
- Check provider error messages for details
- Retry failed notification jobs

---

### Issue: Database Connection Fails

**Symptoms:**
- API endpoints return 500 errors
- Error message: "Database connection failed"
- `/api/test-db` returns `connected: false`

**Troubleshooting:**

1. **Verify Supabase Keys are Correct**
   - Check `NEXT_PUBLIC_SUPABASE_URL` matches Supabase Dashboard
   - Check `SUPABASE_SERVICE_ROLE_KEY` matches Supabase Dashboard
   - Verify keys are not expired

2. **Check Supabase Project is Active**
   - Go to Supabase Dashboard
   - Verify project is not paused or deleted

3. **Verify Network Access**
   - Check firewall allows connections to Supabase
   - Verify Supabase IPs are not blocked

4. **Check Database Migrations**
   - Verify migrations have been run
   - Check all tables exist

**Solution:**
- Update Supabase keys if incorrect
- Activate Supabase project if paused
- Check network/firewall settings
- Run database migrations if missing

---

### Issue: Availability Slots Not Showing

**Symptoms:**
- Availability endpoint returns empty slots array
- No available times shown for valid dates

**Troubleshooting:**

1. **Check Availability Rules Exist**
   - Verify `availability_rules` table has rules for the service/staff
   - Check rules are not soft-deleted

2. **Verify Date is in Future**
   - Check date is not in the past
   - Verify date is within max advance days

3. **Check for Blackouts**
   - Verify no blackouts exist for the date
   - Check blackouts are not blocking all slots

4. **Check Existing Bookings**
   - Verify bookings aren't blocking all slots
   - Check booking statuses are correct

**Solution:**
- Create availability rules if missing
- Use future dates for testing
- Remove or adjust blackouts
- Check existing bookings

---

## Support

For issues or questions:
1. Check application logs
2. Review Stripe Dashboard for payment errors
3. Check Supabase Dashboard for database issues
4. Review endpoint error responses

---

## Next Steps

After setup is complete:
1. Test full onboarding flow
2. Test public booking flow
3. Test admin money board actions
4. Verify notifications are working
5. Monitor cron jobs
6. Set up production deployment


