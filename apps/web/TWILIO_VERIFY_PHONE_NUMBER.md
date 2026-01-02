# How to Verify Your Phone Number in Twilio (Trial Accounts)

## Problem
If you're using a Twilio **trial account**, you can only send SMS to **verified phone numbers**. This is a security restriction to prevent spam.

## Solution: Verify Your Phone Number

### Step 1: Go to Twilio Console
1. Open: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
2. Or navigate: Twilio Console → Phone Numbers → Manage → Verified Caller IDs

### Step 2: Add Your Phone Number
1. Click **"Add a new number"** or **"Verify a number"**
2. Enter your phone number: `+19087237864` (or `9087237864`)
3. Click **"Verify"**

### Step 3: Verify via SMS
1. Twilio will send you a verification code via SMS
2. Enter the code in the Twilio Console
3. Your number will be marked as "Verified" ✅

### Step 4: Test Again
Once verified, SMS will work for that number!

## Alternative: Upgrade Twilio Account
If you upgrade from trial to paid account, you can send to any number without verification.

## Quick Test
After verifying, test with:
```bash
npx tsx apps/web/src/lib/__tests__/test-sms-direct.ts 9087237864
```

## Note
- Trial accounts: Can only send to verified numbers
- Paid accounts: Can send to any valid phone number
- Verification is free and takes ~1 minute

