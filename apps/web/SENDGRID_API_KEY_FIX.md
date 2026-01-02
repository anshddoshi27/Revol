# Fix SendGrid API Key Error (401)

## Error Message
```
SendGrid API error: 401 {"errors":[{"message":"The provided authorization grant is invalid, expired, or revoked"...
```

This means your SendGrid API key is **invalid, expired, or revoked**.

## How to Fix

### Step 1: Go to SendGrid Dashboard
1. Login to https://app.sendgrid.com/
2. Navigate to **Settings** → **API Keys**
   - Or go directly: https://app.sendgrid.com/settings/api_keys

### Step 2: Create a New API Key
1. Click **"Create API Key"** button
2. Choose **"Full Access"** or **"Restricted Access"** (with Mail Send permissions)
3. Give it a name (e.g., "Tithi Production")
4. Click **"Create & View"**
5. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!

### Step 3: Update Your .env File
Add or update in `apps/web/.env`:
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
(Replace with your actual API key)

### Step 4: Verify
Run the verification script:
```bash
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

You should see:
```
✅ SendGrid email test passed
```

## Optional: Set From Email
You can also set a custom "from" email address:
```
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

If not set, it defaults to `noreply@tithi.com`.

## Troubleshooting

### Still getting 401?
- Make sure you copied the **entire** API key (starts with `SG.`)
- Check for extra spaces or line breaks in your .env file
- Verify the API key has "Mail Send" permissions
- Try creating a new API key

### API Key Format
- ✅ Correct: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- ❌ Wrong: `SG.xxxx...` (truncated)
- ❌ Wrong: `SG. xxxx` (has spaces)

