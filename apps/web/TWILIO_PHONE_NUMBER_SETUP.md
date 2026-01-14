# How to Find Your Twilio Phone Number

## Quick Steps

1. **Login to Twilio Console**: https://console.twilio.com/
2. **Navigate to Phone Numbers**:
   - Click **"Phone Numbers"** in the left sidebar
   - Or go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
3. **View Your Numbers**:
   - You'll see a list of all phone numbers in your account
   - Each number shows: Phone Number, Type, Status, Capabilities
4. **Copy the Phone Number**:
   - Format: `+1234567890` (with country code and + prefix)
   - Example: `+14155552671` or `+18335889805`

## Detailed Instructions

### Step 1: Access Twilio Console
- Go to https://console.twilio.com/
- Login with your Twilio account credentials

### Step 2: Navigate to Phone Numbers
- In the left sidebar, click **"Phone Numbers"** → **"Manage"** → **"Active numbers"**
- Or use direct link: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

### Step 3: Find Your Number
- You'll see a table with all your phone numbers
- Look for numbers with status "Active"
- The phone number is displayed in the first column
- Format: `+1 (415) 555-2671` (display format)
- **Use format**: `+14155552671` (no spaces, no parentheses, with + prefix)

### Step 4: Copy to .env File
Add to your `apps/web/.env` file:
```
TWILIO_FROM_NUMBER=+14155552671
```
(Replace with your actual number)

## If You Don't Have a Phone Number

If you don't see any phone numbers, you need to **buy one**:

1. In Twilio Console, go to **Phone Numbers** → **Buy a number**
2. Select:
   - **Country**: United States (or your country)
   - **Capabilities**: SMS (and Voice if needed)
3. Click **Search**
4. Choose a number and click **Buy**
5. Complete the purchase
6. Copy the number to your `.env` file

## Trial Account Limitations

If you're on a **Trial Account**:
- You can only send SMS to **verified phone numbers**
- To verify a number: Console → Phone Numbers → Verified Caller IDs
- Add your test phone number there

## Format Requirements

The phone number in `.env` must be:
- ✅ Format: `+1234567890` (with + prefix)
- ✅ Include country code (1 for US)
- ✅ No spaces, no parentheses, no dashes
- ✅ Example: `+14155552671` ✅
- ❌ Example: `(415) 555-2671` ❌
- ❌ Example: `415-555-2671` ❌
- ❌ Example: `14155552671` ❌ (missing +)

## Verification

After adding to `.env`, run the verification script:
```bash
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

You should see:
```
TWILIO_FROM_NUMBER: ✅ Set
TWILIO_FROM_NUMBER value: +14155552671
```

## Common Issues

### "Invalid phone number" error
- Make sure number starts with `+`
- Make sure country code is included
- No spaces or special characters

### "Not authorized" error
- Check that the number is "Active" in Twilio Console
- Verify your Account SID and Auth Token are correct
- Make sure you're not on a trial account sending to unverified numbers

