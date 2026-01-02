# Fixing Twilio Undelivered SMS (Error Code 30032)

## Problem
SMS messages are being sent to Twilio successfully, but they're showing as "undelivered" with error code 30032. This means Twilio sent the message to the carrier, but the carrier couldn't deliver it to your phone.

## Possible Causes

1. **Phone is off or out of coverage** - Make sure your phone is on and has signal
2. **Carrier blocking** - Your carrier might be filtering messages from Twilio trial accounts
3. **Trial account prefix** - Twilio trial accounts add "Sent from your Twilio trial account" prefix, which some carriers filter
4. **Phone number format** - Though your number looks correct (`+19087237864`)

## Solutions

### 1. Check Your Phone
- Make sure your phone is on and has signal
- Check if you have any carrier message filtering enabled
- Try sending a test message from another phone to verify your number works

### 2. Upgrade Twilio Account (Recommended)
Trial accounts have limitations and the "Sent from your Twilio trial account" prefix can cause delivery issues. Upgrading to a paid account will:
- Remove the trial account prefix
- Improve delivery rates
- Allow sending to any verified number

**To upgrade:**
1. Go to: https://console.twilio.com/billing
2. Click "Upgrade Account"
3. Add payment method
4. Messages will no longer have the trial prefix

### 3. Check Carrier Settings
Some carriers block messages from trial accounts. Contact your carrier to:
- Check if they're blocking messages from Twilio
- Verify your number can receive SMS
- Check if there are any spam filters enabled

### 4. Test with Different Number
Try sending a test SMS to a different phone number to see if the issue is specific to your number or a general Twilio trial account issue.

### 5. Check Twilio Console
1. Go to: https://console.twilio.com/us1/monitor/logs/messages
2. Find the message SID (e.g., `SMb803428205dec8a772a534e1ae001e27`)
3. Check the detailed error message
4. Look for any additional information about why delivery failed

## Current Status
- ✅ Phone number is verified in Twilio
- ✅ Phone number format is correct (`+19087237864`)
- ✅ Messages are being sent to Twilio successfully
- ❌ Messages are not being delivered (error 30032)

## Next Steps
1. **Immediate**: Check your phone is on and has signal
2. **Short-term**: Try upgrading your Twilio account to remove trial limitations
3. **Long-term**: Monitor Twilio logs for delivery patterns

## Testing
Run this to check recent messages:
```bash
npx tsx apps/web/src/lib/__tests__/check-twilio-messages.ts
```

