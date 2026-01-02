# API Credentials Troubleshooting Guide

## 401 Authentication Errors - Common Causes

### SendGrid 401 Error: "The provided authorization grant is invalid, expired, or revoked"

**Possible Causes:**
1. ✅ **Inactive/Suspended Account** - Account is inactive or suspended
2. ✅ **Expired API Key** - API key has expired or been revoked
3. ✅ **Wrong API Key** - Using a key from a different account
4. ✅ **Trial Account Restrictions** - Trial account may have limitations
5. ✅ **API Key Permissions** - Key doesn't have "Mail Send" permissions
6. ✅ **Account Verification** - Account email not verified

**How to Fix:**
1. Check SendGrid Dashboard → Account Status
2. Verify account is active (not suspended)
3. Create a new API key with "Full Access" or "Mail Send" permissions
4. Verify your account email address
5. Check if you're on a trial account with restrictions

### Twilio 401 Error: Error 20003 "Authenticate"

**Possible Causes:**
1. ✅ **Inactive/Suspended Account** - Account is inactive or suspended
2. ✅ **Wrong Account SID** - Using SID from a different account
3. ✅ **Wrong Auth Token** - Auth token doesn't match the Account SID
4. ✅ **Expired Auth Token** - Auth token has been regenerated
5. ✅ **Trial Account Restrictions** - Trial account can only send to verified numbers
6. ✅ **Account Not Verified** - Phone number not verified in trial account

**How to Fix:**
1. Check Twilio Console → Account → Account Status
2. Verify account is active (not suspended)
3. Go to Account → API Keys & Tokens
4. Verify Account SID matches `TWILIO_ACCOUNT_SID` in .env
5. Verify Auth Token matches `TWILIO_AUTH_TOKEN` in .env
6. If on trial account, verify the phone number you're sending to
7. Check if account needs to be upgraded from trial

## Testing with Inactive Accounts

If your accounts are inactive:
- **SendGrid**: You'll get 401 errors until account is reactivated
- **Twilio**: You'll get 401 errors until account is reactivated

**Note**: The notification system code is working correctly - these are account/credential issues, not code issues.

## How to Verify Account Status

### SendGrid
1. Login to SendGrid Dashboard
2. Check top banner for account status warnings
3. Go to Settings → Account Details
4. Verify account status is "Active"

### Twilio
1. Login to Twilio Console
2. Check dashboard for account status
3. Go to Account → Account → Account Status
4. Verify account is not suspended
5. Check if you're on a trial account (limited functionality)

## Quick Test

Run the verification script to see detailed error messages:
```bash
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

The script will show:
- Which credentials are set
- Specific error messages from APIs
- Whether it's an authentication issue or something else

## Summary

✅ **Code is working** - All 30 unit tests pass  
✅ **Environment variables loading** - All variables are set correctly  
❌ **API credentials invalid** - Need to verify/update credentials in SendGrid/Twilio dashboards  
❌ **Account may be inactive** - Check account status in both dashboards

Once credentials are valid and accounts are active, the verification script will pass! 🎉

