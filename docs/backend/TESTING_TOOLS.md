# Testing Tools Documentation

This document describes the testing tools available for the Tithi backend.

## Test Script

### Location

`apps/web/scripts/test-backend.sh`

### What It Does

Automated test script that verifies backend endpoints are working correctly. Tests database connection, public endpoints, and admin endpoints (if authentication is provided).

### Features

- ✅ Tests database connection
- ✅ Tests public catalog endpoint
- ✅ Tests public availability endpoint (optional)
- ✅ Tests admin list bookings endpoint (optional)
- ✅ Tests onboarding Step 1 endpoint (optional)
- ✅ Color-coded output (green/yellow/red)
- ✅ Test summary with pass/warn/fail counts
- ✅ Helpful error messages and tips

### Prerequisites

1. **Server must be running**:
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Environment variables set**:
   - `.env.local` file with all required variables
   - Database connection configured

### Usage

#### Basic Test (No Authentication)

Tests database connection and public endpoints:

```bash
# From project root
./apps/web/scripts/test-backend.sh

# Or from apps/web directory
./scripts/test-backend.sh
```

#### With Authentication

Tests admin endpoints as well:

```bash
# Get access token first (see below)
export ACCESS_TOKEN='your_access_token'
./apps/web/scripts/test-backend.sh
```

#### With Availability Testing

Tests availability endpoint:

```bash
export SERVICE_ID='550e8400-e29b-41d4-a716-446655440000'
export DATE='2025-01-20'
./apps/web/scripts/test-backend.sh
```

#### Custom Configuration

```bash
# Custom base URL (for production testing)
BASE_URL='https://yourdomain.com' ./apps/web/scripts/test-backend.sh

# Custom business subdomain
BUSINESS_SUBDOMAIN='my-business' ./apps/web/scripts/test-backend.sh

# All together
BASE_URL='https://production.com' \
ACCESS_TOKEN='token' \
SERVICE_ID='service-uuid' \
DATE='2025-01-20' \
./apps/web/scripts/test-backend.sh
```

### Environment Variables

The script respects these environment variables:

- `BASE_URL` (default: `http://localhost:3000`): Backend base URL
- `ACCESS_TOKEN` (optional): Supabase auth token for authenticated endpoints
- `BUSINESS_SUBDOMAIN` (default: `test-business`): Business subdomain for public endpoints
- `SERVICE_ID` (optional): Service UUID for availability testing
- `DATE` (optional): Date for availability testing (YYYY-MM-DD format, defaults to today)

### Getting Access Token

To test authenticated endpoints, you need a Supabase access token:

#### Method 1: Via Supabase Auth API

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'
```

Copy the `access_token` from the response.

#### Method 2: Via Frontend

1. Log in via your frontend
2. Check browser DevTools > Application > Local Storage
3. Look for Supabase session token
4. Extract `access_token` from the session

#### Method 3: Via Supabase Dashboard

1. Go to Supabase Dashboard > Authentication > Users
2. Create or find a user
3. Copy the user's ID (this is `user_id`, not the access token)
4. Use Supabase client to get token programmatically

### Expected Output

#### Successful Test Run

```
🚀 Tithi Backend Testing Script

Base URL: http://localhost:3000
Business Subdomain: test-business

1. Checking if server is running...
✅ Server is running at http://localhost:3000

2. Testing database connection...
✅ Database connection OK (connected: true, tablesExist: true)

3. Testing public catalog endpoint...
⚠️  Catalog endpoint returned 404 (business 'test-business' may not exist)
   Tip: Complete onboarding Step 2 to create a business with subdomain

4. Skipping availability endpoint test (SERVICE_ID not provided)
   Tip: export SERVICE_ID='service_uuid' to test availability

5. Skipping authenticated endpoints (ACCESS_TOKEN not provided)
   Tip: export ACCESS_TOKEN='your_access_token' to test admin endpoints

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Summary:
  ✅ Passed: 1
  ⚠️  Warnings: 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ All critical tests passed!
⚠️  Some warnings (business may not exist yet - complete onboarding)
```

#### Failed Test Run

```
🚀 Tithi Backend Testing Script

Base URL: http://localhost:3000

1. Checking if server is running...
❌ Server is not running at http://localhost:3000
   Start the server with: cd apps/web && npm run dev
```

### Exit Codes

- `0`: All tests passed (or warnings only)
- `1`: One or more tests failed

### Troubleshooting

#### Script not executable

**Error**: `Permission denied: ./scripts/test-backend.sh`

**Solution**:
```bash
chmod +x apps/web/scripts/test-backend.sh
```

#### Server not running

**Error**: `Server is not running at http://localhost:3000`

**Solution**:
```bash
cd apps/web
npm run dev
# Keep this terminal open, then run test script in another terminal
```

#### Database connection fails

**Error**: `Database connection failed`

**Solution**:
1. Check `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
2. Verify Supabase project is active (not paused)
3. Check `NEXT_PUBLIC_SUPABASE_URL` is correct

#### 401 Unauthorized

**Error**: `List bookings endpoint returned 401`

**Solution**:
1. Get a fresh access token (tokens expire)
2. Verify token is from Supabase Auth
3. Check token format: `eyJhbGc...` (should start with `eyJ`)

#### 404 Business Not Found

**Warning**: `Catalog endpoint returned 404`

**This is normal if**: Business hasn't completed onboarding yet

**To fix**: Complete onboarding Step 2 to create a business with the subdomain

### Integration with CI/CD

The test script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Test Backend
  run: |
    cd apps/web
    npm run dev &
    sleep 5  # Wait for server to start
    ./scripts/test-backend.sh
  env:
    BASE_URL: http://localhost:3000
```

### Making Changes

To modify the test script:

1. Edit `apps/web/scripts/test-backend.sh`
2. Keep it executable: `chmod +x apps/web/scripts/test-backend.sh`
3. Test your changes locally
4. Document new features in this file

---

## Vercel Cron Configuration

### Location

`vercel.json` (project root)

### What It Does

Configures automated cron jobs that Vercel will call periodically to run background tasks.

### Cron Jobs

The configuration includes 4 cron jobs:

#### 1. Notifications Processor

- **Path**: `/api/cron/notifications`
- **Schedule**: `*/2 * * * *` (every 2 minutes)
- **Purpose**: Processes pending email/SMS notifications from the queue

#### 2. Reminders Scheduler

- **Path**: `/api/cron/reminders`
- **Schedule**: `*/10 * * * *` (every 10 minutes)
- **Purpose**: Schedules 24h and 1h reminder notifications before appointments

#### 3. Cleanup Job

- **Path**: `/api/cron/cleanup`
- **Schedule**: `*/1 * * * *` (every 1 minute)
- **Purpose**: Expires held bookings older than 5 minutes

#### 4. Subscription Health Check

- **Path**: `/api/cron/subscription-health`
- **Schedule**: `0 2 * * *` (daily at 2 AM UTC)
- **Purpose**: Syncs Stripe subscription status with database

### Cron Schedule Format

Vercel uses standard cron syntax: `minute hour day month weekday`

- `*/2 * * * *` = Every 2 minutes
- `*/10 * * * *` = Every 10 minutes
- `*/1 * * * *` = Every 1 minute
- `0 2 * * *` = At 2:00 AM every day

### Setup Instructions

1. **Deploy to Vercel**:
   ```bash
   vercel deploy
   ```

2. **Set Environment Variable**:
   - Go to Vercel Dashboard > Your Project > Settings > Environment Variables
   - Add: `CRON_SECRET` = your cron secret (generate with `openssl rand -hex 32`)
   - Select environments: Production, Preview, Development

3. **Verify Cron Jobs**:
   - Go to Vercel Dashboard > Your Project > Functions > Cron Jobs
   - You should see all 4 cron jobs listed with their schedules

### How It Works

1. Vercel reads `vercel.json` on deployment
2. Vercel automatically sets up cron jobs
3. Vercel calls endpoints on schedule
4. Vercel sends `Authorization: Bearer {CRON_SECRET}` header automatically
5. Your backend verifies the header and processes the job

### Testing Cron Jobs Locally

Vercel Cron only works in production. For local testing:

```bash
# Manually trigger a cron endpoint
curl -X GET http://localhost:3000/api/cron/notifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Monitoring

Check Vercel Dashboard > Functions > Cron Jobs for:
- Next execution time
- Execution history
- Success/failure rates
- Response times

### Troubleshooting

#### Cron Jobs Not Running

**Check**:
1. `vercel.json` is in project root (not in `apps/web/`)
2. `CRON_SECRET` is set in Vercel environment variables
3. Project is deployed to Vercel
4. Cron jobs appear in Vercel Dashboard

#### Cron Jobs Returning 401

**Check**:
1. `CRON_SECRET` matches in Vercel and your code
2. Endpoint verifies `Authorization: Bearer {CRON_SECRET}` header
3. Header format is correct

#### Cron Jobs Failing

**Check**:
1. Application logs in Vercel Dashboard
2. Endpoint code for errors
3. Database connection (for database-dependent jobs)
4. External API credentials (for notification jobs)

### Alternative Setup

If not using Vercel, use an external cron service:

1. **cron-job.org** or similar service
2. Create cron jobs pointing to your endpoints
3. Set `Authorization: Bearer {CRON_SECRET}` header
4. Configure schedules matching `vercel.json`

See `BACKEND_SETUP_COMPLETE.md` Step 3 for detailed instructions.

---

## Summary

- ✅ **Test script**: Comprehensive automated testing tool
- ✅ **Vercel config**: Automated cron job setup
- ✅ **Both are production-ready** and documented

Use the test script during development and CI/CD. Use Vercel Cron (or external service) for production background jobs.

