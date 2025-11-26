# Deployment Readiness Checklist

This document verifies that Tithi is ready for production deployment.

## Environment Variables

### Required for Production

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Production Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (public)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only, never expose)
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key (production)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- [ ] `SENDGRID_API_KEY` - SendGrid API key for email
- [ ] `SENDGRID_FROM_EMAIL` - Verified sender email address
- [ ] `TWILIO_ACCOUNT_SID` - Twilio account SID
- [ ] `TWILIO_AUTH_TOKEN` - Twilio auth token
- [ ] `TWILIO_FROM_NUMBER` - Twilio phone number
- [ ] `CRON_SECRET` - Secret for protecting cron endpoints
- [ ] `NEXT_PUBLIC_APP_URL` - Public app URL (e.g., https://tithi.com)

### Optional

- [ ] `SENTRY_DSN` - Sentry error tracking (if using)
- [ ] `ANALYTICS_ID` - Analytics ID (if using)

## Database & RLS

- [ ] All migrations applied to production database
- [ ] RLS policies enabled on all tenant-owned tables
- [ ] RLS policies tested to prevent cross-tenant data access
- [ ] Indexes created for performance
- [ ] Unique constraints in place (e.g., subdomain uniqueness)
- [ ] Soft delete columns (`deleted_at`) working correctly

## Stripe Configuration

- [ ] Stripe Connect Express accounts can be created
- [ ] Stripe webhook endpoint configured: `https://yourdomain.com/api/webhooks/stripe`
- [ ] Webhook events subscribed:
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `charge.refunded`
  - [ ] `charge.dispute.created`
  - [ ] `setup_intent.succeeded`
  - [ ] `customer.subscription.updated`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Webhook secret verified in production
- [ ] Test webhook delivery in Stripe dashboard
- [ ] Platform fee (1%) configured correctly
- [ ] Subscription product/price IDs configured

## Notification System

- [ ] SendGrid account verified and sender authenticated
- [ ] Twilio account active and phone number verified
- [ ] Notification templates can be created in onboarding
- [ ] Placeholders resolve correctly (test with sample booking)
- [ ] Notification jobs process via cron: `/api/cron/notifications`
- [ ] Reminder cron configured: `/api/cron/reminders`
- [ ] Email notifications send successfully
- [ ] SMS notifications send successfully
- [ ] Failed notifications retry with exponential backoff
- [ ] Notification events logged in `notification_events` table

## Cron Jobs

Configure these endpoints to run on a schedule:

- [ ] `/api/cron/notifications` - Every 2 minutes (process notification jobs)
- [ ] `/api/cron/reminders` - Every 5-10 minutes (schedule 24h/1h reminders)
- [ ] `/api/cron/subscription-health` - Daily (verify subscription status)
- [ ] `/api/cron/cleanup` - Daily (expire held slots, clean old data)

**Recommended:** Use Vercel Cron, GitHub Actions, or a service like cron-job.org

## Domain & DNS

- [ ] Main domain configured (tithi.com)
- [ ] Wildcard subdomain DNS configured (*.tithi.com)
- [ ] SSL/TLS certificates configured (automatic with Vercel/Cloudflare)
- [ ] Subdomain validation working (reserved names blocked)

## Testing

### Unit Tests
- [ ] All unit tests pass: `npm test`
- [ ] Slot generation tests pass
- [ ] Pricing/discount tests pass
- [ ] Notification placeholder tests pass
- [ ] Double-booking prevention tests pass

### Integration Tests
- [ ] Public booking flow tests pass
- [ ] Admin money actions tests pass
- [ ] Notification system tests pass

### E2E Tests
- [ ] Full onboarding flow works
- [ ] Booking creation works
- [ ] Payment processing works
- [ ] Notifications send correctly

### Manual Testing
- [ ] Sign up new user → onboarding completes
- [ ] Business goes live → booking site accessible
- [ ] Customer books appointment → card saved, no charge
- [ ] Admin completes booking → charge succeeds
- [ ] Admin marks no-show → fee charged
- [ ] Admin cancels booking → fee charged (if applicable)
- [ ] Admin refunds booking → refund processed
- [ ] Notifications received (email/SMS)
- [ ] Gift cards work (amount and percent)
- [ ] Policies displayed and enforced

## Security

- [ ] RLS policies prevent cross-tenant access
- [ ] API routes require authentication (except public booking)
- [ ] Cron endpoints protected with `CRON_SECRET`
- [ ] Stripe webhooks verified with signature
- [ ] No secrets in code (all in env vars)
- [ ] Service role key never exposed to client
- [ ] Rate limiting configured (if applicable)
- [ ] CORS configured correctly

## Performance

- [ ] Database queries optimized (indexes in place)
- [ ] Availability slots cached appropriately
- [ ] Images optimized and served via CDN
- [ ] API responses fast (< 500ms for most endpoints)
- [ ] Booking site loads quickly

## Monitoring & Observability

- [ ] Error tracking configured (Sentry or similar)
- [ ] Logging configured (structured logs)
- [ ] Metrics tracked (bookings, payments, notifications)
- [ ] Alerts configured for critical failures
- [ ] Uptime monitoring configured

## Documentation

- [ ] API documentation up to date
- [ ] Deployment guide complete
- [ ] Environment variables documented
- [ ] Troubleshooting guide available

## Pre-Launch Checklist

- [ ] Run seed script on staging: `npm run seed`
- [ ] Test full flow on staging environment
- [ ] Verify Stripe test mode works
- [ ] Verify notifications work (use test email/phone)
- [ ] Check all cron jobs run successfully
- [ ] Verify RLS prevents data leakage
- [ ] Test subdomain creation and booking site
- [ ] Verify SSL certificates valid
- [ ] Check error logs for any issues
- [ ] Performance test with realistic load

## Post-Launch

- [ ] Monitor error logs for first 24 hours
- [ ] Verify webhooks are being received
- [ ] Check notification delivery rates
- [ ] Monitor payment success rates
- [ ] Verify cron jobs running on schedule
- [ ] Check database performance
- [ ] Monitor API response times

## Rollback Plan

- [ ] Database backup strategy in place
- [ ] Migration rollback scripts ready
- [ ] Previous version deployment process documented
- [ ] Data export process documented

---

**Last Updated:** 2025-01-20
**Status:** ⚠️ Review before production deployment



