# Cron Jobs Setup Guide (Vercel Hobby Plan)

Since Vercel Hobby plan only allows daily cron jobs, we need to use external services for frequent cron jobs (notifications and reminders).

## Quick Setup Options

### Option 1: cron-job.org (Free & Easy) ⭐ Recommended

1. Go to https://cron-job.org and create a free account
2. Create a new cron job:
   - **URL**: `https://your-domain.vercel.app/api/cron/notifications`
   - **Schedule**: Every 2 minutes (`*/2 * * * *`)
   - **Method**: GET
   - **Headers**: 
     - Key: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET` (get this from Vercel environment variables)
   - **Name**: "Process Notifications"
3. Create a second cron job for reminders:
   - **URL**: `https://your-domain.vercel.app/api/cron/reminders`
   - **Schedule**: Every 10 minutes (`*/10 * * * *`)
   - **Method**: GET
   - **Headers**: Same Authorization header as above
   - **Name**: "Process Reminders"

### Option 2: GitHub Actions (Free)

Create `.github/workflows/cron.yml`:

```yaml
name: Cron Jobs

on:
  schedule:
    - cron: '*/2 * * * *'  # Every 2 minutes
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  notifications:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/2 * * * *'
    steps:
      - name: Trigger notifications
        run: |
          curl -X GET "${{ secrets.VERCEL_URL }}/api/cron/notifications" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
  
  reminders:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/10 * * * *'
    steps:
      - name: Trigger reminders
        run: |
          curl -X GET "${{ secrets.VERCEL_URL }}/api/cron/reminders" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets in GitHub repo settings:
- `VERCEL_URL`: Your Vercel deployment URL
- `CRON_SECRET`: Your CRON_SECRET from Vercel

### Option 3: EasyCron (Free Tier)

1. Sign up at https://www.easycron.com
2. Create cron jobs similar to cron-job.org setup
3. Free tier allows up to 1 job (you can combine both endpoints or use 2 accounts)

## What Still Works on Vercel (Daily Jobs)

These are still configured in `vercel.json` and work fine:
- ✅ `/api/cron/cleanup` - Runs daily at 3 AM
- ✅ `/api/cron/subscription-health` - Runs daily at 2 AM

## Testing Your Setup

After setting up external cron:

1. **Test notifications endpoint manually:**
   ```bash
   curl -X GET "https://your-domain.vercel.app/api/cron/notifications" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

2. **Check Vercel logs** to see if cron jobs are being called
3. **Check your database** - `notification_jobs` table should show jobs being processed

## Important Notes

- ⚠️ **Security**: Never expose your `CRON_SECRET` publicly
- ✅ **The endpoints still work** - they just need external triggers
- ✅ **Email notifications will work** once external cron is set up
- 📊 **Monitor**: Check Vercel function logs to ensure cron jobs are running

## Troubleshooting

**Problem**: Cron jobs not running
- Check that the URL is correct (include `https://`)
- Verify `CRON_SECRET` matches what's in Vercel environment variables
- Check Vercel function logs for errors

**Problem**: 401 Unauthorized errors
- Verify the Authorization header format: `Bearer YOUR_SECRET` (with space after "Bearer")
- Make sure `CRON_SECRET` is set in Vercel environment variables
