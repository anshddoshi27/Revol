# Local vs Production Testing Guide

This guide explains what you can test locally vs what requires production deployment.

---

## ✅ You CAN Test Locally (Recommended First)

You can test most integrations locally before deploying to production. Here's what works:

### 1. Stripe Integration (Test Mode)

**✅ Works Locally:**
- Stripe Connect account creation
- Payment Intent creation
- Subscription creation
- Refunds
- All payment flows

**Setup:**
1. Use Stripe **Test Mode** keys:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_test_...
   ```

2. Use Stripe test cards (e.g., `4242 4242 4242 4242`)

3. **For Webhooks Locally:**
   - Use **Stripe CLI** to forward webhooks to your local server
   - Install: `brew install stripe/stripe-cli/stripe` (Mac) or [download](https://stripe.com/docs/stripe-cli)
   - Login: `stripe login`
   - Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - This gives you a webhook secret starting with `whsec_` - use this as `STRIPE_WEBHOOK_SECRET`

**Benefits:**
- No charges to real cards
- Safe to test all scenarios
- Can test failures, declines, 3D Secure
- Webhooks work via Stripe CLI

### 2. SendGrid Email

**✅ Works Locally:**
- Email sending
- All notification flows

**Setup:**
1. Use your real SendGrid API key (works from anywhere)
   ```bash
   SENDGRID_API_KEY=SG.your-real-key
   SENDGRID_FROM_EMAIL=your-verified-email@domain.com
   ```

2. Run your app: `npm run dev`

3. Emails will be sent to real recipients (use your own email for testing)

**Note:** SendGrid doesn't care where the request comes from, as long as the API key is valid.

### 3. Twilio SMS

**✅ Works Locally:**
- SMS sending
- All notification flows

**Setup:**
1. Use your real Twilio credentials (works from anywhere)
   ```bash
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1234567890
   ```

2. Run your app: `npm run dev`

3. SMS will be sent to real phone numbers (use your own phone for testing)

**Note:** Twilio doesn't care where the request comes from, as long as credentials are valid.

### 4. Database (Supabase)

**✅ Works Locally:**
- All database operations
- Use your Supabase project (dev or production)

**Setup:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

---

## ⚠️ What Requires Production (or Special Setup)

### 1. Stripe Connect Onboarding Flow

**⚠️ Partially Works Locally:**
- You can create Connect accounts
- You can create Account Links
- **BUT:** The return URL from Stripe Connect must be publicly accessible

**Solution for Local Testing:**
1. Use a tunneling service like **ngrok** or **localtunnel**:
   ```bash
   # Install ngrok
   brew install ngrok  # or download from ngrok.com
   
   # Start your app
   npm run dev
   
   # In another terminal, expose localhost
   ngrok http 3000
   # This gives you: https://abc123.ngrok.io
   ```

2. Update your environment:
   ```bash
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```

3. Use this URL in your Account Link return/refresh URLs

**Alternative:** Test Connect onboarding in production, then test payments locally

### 2. Public Booking Page

**⚠️ Partially Works Locally:**
- Works if you access via `localhost:3000/[subdomain]`
- **BUT:** If you need to test from external devices or share links, use ngrok

### 3. Cron Jobs

**⚠️ Requires Production:**
- Cron jobs (notification processing) typically run on a schedule
- Locally, you can manually trigger: `GET /api/cron/notifications`
- Or use a service like Vercel Cron (production) or a local scheduler

---

## 🚀 Recommended Testing Strategy

### Phase 1: Local Testing (Do This First)

1. **Set up local environment:**
   ```bash
   # .env.local
   # Stripe (Test Mode)
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...  # From Stripe CLI
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # SendGrid (Real API Key)
   SENDGRID_API_KEY=SG.your-real-key
   SENDGRID_FROM_EMAIL=your-email@domain.com
   
   # Twilio (Real Credentials)
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_NUMBER=+1234567890
   
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **Start Stripe CLI webhook forwarding:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # Copy the webhook secret and add to .env.local
   ```

3. **Start your app:**
   ```bash
   npm run dev
   ```

4. **Test locally:**
   - ✅ Create bookings
   - ✅ Process payments (test mode)
   - ✅ Send emails (real SendGrid)
   - ✅ Send SMS (real Twilio)
   - ✅ Test webhooks (via Stripe CLI)
   - ✅ Test refunds
   - ✅ Test no-show fees

### Phase 2: Production Testing (After Local Works)

1. **Deploy to production** (Vercel, etc.)

2. **Set production environment variables:**
   - Use **Live Mode** Stripe keys
   - Use same SendGrid/Twilio keys (or separate production keys)
   - Set `NEXT_PUBLIC_APP_URL` to your production domain

3. **Configure Stripe webhook in Dashboard:**
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Copy webhook secret to production env vars

4. **Test in production:**
   - ✅ Complete Connect onboarding flow
   - ✅ Test with real cards (small amounts)
   - ✅ Verify webhooks work
   - ✅ Test end-to-end flow

---

## 📋 Quick Setup for Local Testing

### Step 1: Install Stripe CLI

```bash
# Mac
brew install stripe/stripe-cli/stripe

# Or download from: https://stripe.com/docs/stripe-cli
```

### Step 2: Login to Stripe CLI

```bash
stripe login
```

### Step 3: Forward Webhooks

In a separate terminal:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

You'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxx
```

Copy this secret to your `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### Step 4: Set Up Environment Variables

Create `.env.local`:
```bash
# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # From Stripe CLI
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SendGrid
SENDGRID_API_KEY=SG.your_key
SENDGRID_FROM_EMAIL=your-email@domain.com

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional: For Connect onboarding testing
# Use ngrok if you need public URL
# NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

### Step 5: Start Your App

```bash
npm run dev
```

### Step 6: Test!

- Navigate to `http://localhost:3000`
- Create bookings
- Process payments
- Check Stripe Dashboard (Test Mode)
- Check SendGrid Dashboard
- Check Twilio Console

---

## 🔄 Stripe CLI Webhook Testing

The Stripe CLI is essential for local webhook testing:

### Listen for All Events:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Trigger Specific Events:
```bash
# Trigger payment_intent.succeeded
stripe trigger payment_intent.succeeded

# Trigger customer.subscription.updated
stripe trigger customer.subscription.updated

# See all available events
stripe trigger --help
```

### View Webhook Logs:
```bash
stripe logs tail
```

---

## 🌐 Using ngrok for Public URLs (Optional)

If you need to test Connect onboarding or public booking pages from external devices:

### Install ngrok:
```bash
brew install ngrok
# Or download from: https://ngrok.com
```

### Start ngrok:
```bash
ngrok http 3000
```

You'll get a public URL like: `https://abc123.ngrok.io`

### Update Environment:
```bash
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
```

**Note:** Free ngrok URLs change each time you restart. For testing Connect onboarding, you may want to use a paid ngrok plan with a fixed domain, or just test that in production.

---

## ✅ Local Testing Checklist

Before moving to production, verify locally:

- [ ] App runs on `localhost:3000`
- [ ] Stripe CLI is forwarding webhooks
- [ ] Can create bookings via public API
- [ ] Can complete bookings (charge payments)
- [ ] Payments appear in Stripe Dashboard (Test Mode)
- [ ] Webhooks are received and processed
- [ ] Emails are sent (check SendGrid Dashboard)
- [ ] SMS are sent (check Twilio Console)
- [ ] Database records are updated correctly
- [ ] Refunds work
- [ ] No-show fees work

---

## 🚨 Important Notes

### Stripe Test vs Live Mode

- **Test Mode:** Use `sk_test_...` keys, test cards, no real charges
- **Live Mode:** Use `sk_live_...` keys, real cards, real charges

**Always test in Test Mode first!**

### SendGrid & Twilio

- These work the same in local and production
- Use real API keys/credentials
- Real emails/SMS will be sent (use your own contact info for testing)

### Database

- You can use the same Supabase project for local and production
- Or use separate projects (dev vs prod)
- Be careful not to pollute production data during testing

---

## 🎯 Summary

**You DON'T need to deploy first!** You can test almost everything locally:

1. ✅ **Stripe:** Use Test Mode + Stripe CLI for webhooks
2. ✅ **SendGrid:** Works locally with real API key
3. ✅ **Twilio:** Works locally with real credentials
4. ✅ **Database:** Use your Supabase project
5. ⚠️ **Connect Onboarding:** May need ngrok for return URLs (or test in production)

**Recommended Flow:**
1. Test everything locally first (Test Mode)
2. Fix any issues
3. Deploy to production
4. Test with Live Mode keys
5. Verify everything works end-to-end

---

## 📚 Additional Resources

- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [ngrok Documentation](https://ngrok.com/docs)
- [SendGrid API Docs](https://docs.sendgrid.com/api-reference)
- [Twilio API Docs](https://www.twilio.com/docs)

---

**Bottom Line:** Start with local testing! It's faster, safer, and you can catch issues before deploying.


