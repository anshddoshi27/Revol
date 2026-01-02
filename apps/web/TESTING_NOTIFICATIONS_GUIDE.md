# Testing Notifications - Quick Guide

## Current Status

Your verification shows:
- ✅ **Placeholder system**: Working correctly
- ⚠️ **SendGrid**: Needs sender verification (403 error)
- ⚠️ **Twilio**: Needs real phone number (using placeholder)

## Quick Fixes

### 1. Fix SendGrid (5 minutes)

**Error**: `The from address does not match a verified Sender Identity`

**Fix**:
1. Go to: https://app.sendgrid.com/settings/sender_auth
2. Click **"Verify a Single Sender"**
3. Use email: `noreply@tithi.com` (or your email)
4. Fill form → Click **"Create"**
5. **Check your email** → Click verification link
6. Add to `.env`:
   ```
   SENDGRID_FROM_EMAIL=noreply@tithi.com
   ```

### 2. Fix Twilio Test Phone (2 minutes)

**Error**: `Invalid 'To' Phone Number: +123456XXXX`

**Fix**:
1. Open `apps/web/.env`
2. Find `TEST_PHONE=+1234567890` (or similar placeholder)
3. Replace with your real phone number:
   ```
   TEST_PHONE=+14155552671
   ```
   (Use E.164 format: `+1` + area code + number)

**For Twilio Trial Accounts**:
- Verify your phone number first: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- Add your number there
- Then use it in `TEST_PHONE`

## Test Again

After fixing both:

```bash
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

You should see:
```
✅ SendGrid email test passed
✅ Twilio SMS test passed
✅ Overall verification: PASSED
```

## Full End-to-End Test

Once verification passes, test the full system:

```bash
npx tsx apps/web/src/lib/__tests__/test-notifications-live.ts
```

This will:
- Create a test booking
- Trigger a real notification
- Send email and SMS
- Clean up after

**Requirements**:
- Business must have `notifications_enabled = true` (Pro Plan)
- SendGrid sender verified
- Real phone number in `TEST_PHONE`

## Troubleshooting

### SendGrid still 403?
- Make sure you clicked the verification link in email
- Wait 2-3 minutes after verification
- Check `SENDGRID_FROM_EMAIL` matches verified email exactly

### Twilio still failing?
- Make sure phone number is in E.164 format: `+1234567890`
- For trial accounts, verify the number in Twilio Console first
- Check for typos in phone number

### Want to skip API tests?
The verification script will pass if:
- Placeholder tests pass ✅
- API tests are skipped (not configured) ⚠️
- But will fail if credentials are wrong ❌

