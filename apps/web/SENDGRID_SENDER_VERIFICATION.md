# Fix SendGrid Sender Identity (403 Error)

## Error Message
```
SendGrid API error: 403 {"errors":[{"message":"The from address does not match a verified Sender Identity. Mail cannot be sent until this error is resolved.
```

This means your **"from" email address** is not verified in SendGrid.

## How to Fix

### Step 1: Go to SendGrid Sender Authentication
1. Login to https://app.sendgrid.com/
2. Navigate to **Settings** → **Sender Authentication**
   - Or go directly: https://app.sendgrid.com/settings/sender_auth

### Step 2: Verify a Single Sender (Quickest)
1. Click **"Verify a Single Sender"**
2. Fill in the form:
   - **From Email Address**: `noreply@tithi.com` (or your domain email)
   - **From Name**: `Tithi` (or your business name)
   - **Reply To**: Same as from email
   - **Company Address**: Your business address
   - **City, State, Zip**: Your location
   - **Country**: Your country
3. Click **"Create"**
4. **Check your email** - SendGrid will send a verification link
5. Click the verification link in the email

### Step 3: Update Your .env File
After verification, add to `apps/web/.env`:
```
SENDGRID_FROM_EMAIL=noreply@tithi.com
```
(Use the exact email you verified)

### Alternative: Domain Authentication (Recommended for Production)
For production, you should authenticate your entire domain:

1. Go to **Settings** → **Sender Authentication** → **Authenticate Your Domain**
2. Follow the DNS setup instructions
3. This allows you to send from any email on your domain

## Quick Test

After verification, run:
```bash
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

You should see:
```
✅ SendGrid email test passed
```

## Troubleshooting

### Still getting 403?
- Make sure you clicked the verification link in the email
- Check that `SENDGRID_FROM_EMAIL` matches the verified email exactly
- Wait a few minutes after verification (can take up to 5 minutes to propagate)

### Using a Custom Domain?
- Domain authentication is required for custom domains
- Set up DNS records as instructed by SendGrid
- This can take 24-48 hours to fully propagate

