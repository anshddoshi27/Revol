# Test Running Instructions

## Quick Answer

**You do NOT need the app running** - these are unit tests that run independently.

**Run tests from**: `apps/web` directory (where the test file is located)

## How to Run the Tests

### From the correct directory:
```bash
cd apps/web
npm test notifications-end-to-end-production.test.ts
```

### Or from the root directory:
```bash
npm test --workspace=web notifications-end-to-end-production.test.ts
```

## How to Run the Verification Script

The verification script tests the actual SendGrid/Twilio APIs (requires real credentials):

### From the root directory (Revol/):
```bash
npx tsx apps/web/src/lib/__tests__/verify-notifications.ts
```

### Or from apps/web directory:
```bash
cd apps/web
npx tsx src/lib/__tests__/verify-notifications.ts
```

**Note**: The verification script requires environment variables to be set:
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

If these aren't set, it will fail (which is expected - it's testing real API integration).

## What Was Fixed

The test failures were due to:

1. **Fetch Mocking Issue**: The `global.fetch` mock wasn't being properly intercepted. Fixed by using `vi.stubGlobal('fetch', mockFetch)` instead of `global.fetch = mockFetch`.

2. **Supabase Mock Chain**: The Supabase client mock chain was broken - `.single()` wasn't returning a promise properly. Fixed by creating proper mock objects for each table.

3. **Environment Variables**: Added proper setup/teardown of environment variables in `beforeEach` hooks.

## Test Structure

The tests are **unit tests** that:
- Mock all external dependencies (database, APIs)
- Don't require the app to be running
- Don't require a real database connection
- Don't require real SendGrid/Twilio credentials
- Run completely in isolation

## What Gets Tested

✅ Template configuration and saving  
✅ Placeholder replacement  
✅ Notification job enqueueing  
✅ SendGrid email integration (mocked)  
✅ Twilio SMS integration (mocked)  
✅ Pro Plan vs Basic Plan behavior  
✅ All notification triggers  
✅ Error handling  

## Expected Results

After the fixes, all 30 tests should pass:
- ✅ 25 tests passing (already working)
- ✅ 5 tests now fixed (SendGrid/Twilio integration + Pro Plan test)

## Troubleshooting

If tests still fail:

1. **Make sure you're in the right directory**: `apps/web`
2. **Clear node_modules cache**: `rm -rf node_modules/.vite`
3. **Reinstall dependencies**: `npm install`
4. **Run with verbose output**: `npm test -- --reporter=verbose notifications-end-to-end-production.test.ts`

## Note

These are **unit tests** - they test the logic in isolation. For **integration tests** that test against a real database and APIs, you would:
- Need the app running
- Need real database connection
- Need real API credentials
- Use a different test setup

But for these unit tests, everything is mocked and runs independently.

