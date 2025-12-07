# Notification Engine Test Suite Documentation

## Overview

Comprehensive test suite for the Tithi notification engine covering all functionality from template rendering to actual email/SMS delivery.

## Test Files

### 1. Core Library Tests

#### `apps/web/src/lib/__tests__/notifications.test.ts`
**Purpose**: Tests template rendering and placeholder validation

**Coverage**:
- ✅ All placeholder replacements (customer, service, staff, booking, business)
- ✅ Placeholder validation against allowlist
- ✅ Timezone-aware date/time formatting
- ✅ Price formatting
- ✅ URL generation
- ✅ Edge cases (missing data, empty templates)

**Run**: `npm test -- notifications.test.ts`

#### `apps/web/src/lib/__tests__/notification-senders.test.ts`
**Purpose**: Tests SendGrid and Twilio integration

**Coverage**:
- ✅ SendGrid email sending (success, errors, missing key)
- ✅ Twilio SMS sending (success, errors, missing credentials)
- ✅ Phone number formatting (various formats)
- ✅ Basic Auth encoding for Twilio
- ✅ Form data structure for Twilio
- ✅ HTML/plain text content for SendGrid
- ✅ Network error handling

**Run**: `npm test -- notification-senders.test.ts`

#### `apps/web/src/lib/__tests__/notifications-emit.test.ts`
**Purpose**: Tests event emission and job enqueueing

**Coverage**:
- ✅ `emitNotification` function
  - Business validation
  - Notifications enabled check
  - Booking data loading
  - Template loading
  - Payment amount loading
- ✅ `enqueueNotification` function
  - Idempotency checks
  - Job insertion
  - Unique constraint handling
- ✅ `loadTemplateForTrigger` function
  - Template retrieval
  - Null handling

**Run**: `npm test -- notifications-emit.test.ts`

### 2. API Endpoint Tests

#### `apps/web/src/app/api/admin/notifications/templates/__tests__/route.test.ts`
**Purpose**: Basic template CRUD endpoint tests

**Coverage**:
- ✅ GET templates list
- ✅ POST template creation
- ✅ Placeholder validation
- ✅ Subject requirement for email
- ✅ Trigger enum validation

**Run**: `npm test -- route.test.ts`

#### `apps/web/src/app/api/admin/notifications/templates/__tests__/route-comprehensive.test.ts`
**Purpose**: Comprehensive template CRUD tests

**Coverage**:
- ✅ All CRUD operations (GET, POST, PUT, DELETE)
- ✅ Full validation scenarios
- ✅ Error handling
- ✅ Authorization checks
- ✅ Soft delete functionality

**Run**: `npm test -- route-comprehensive.test.ts`

### 3. Cron Worker Tests

#### `apps/web/src/app/api/cron/__tests__/notifications-cron.test.ts`
**Purpose**: Tests notification job processor

**Coverage**:
- ✅ CRON_SECRET authentication
- ✅ Pending job processing
- ✅ Failed job retry processing
- ✅ Email job handling
- ✅ SMS job handling
- ✅ Exponential backoff (15min, 30min, 45min)
- ✅ Dead job marking (after 3 attempts)
- ✅ Missing recipient handling
- ✅ Error handling per job
- ✅ Audit log creation

**Run**: `npm test -- notifications-cron.test.ts`

#### `apps/web/src/app/api/cron/__tests__/reminders-cron.test.ts`
**Purpose**: Tests reminder scheduler

**Coverage**:
- ✅ CRON_SECRET authentication
- ✅ 24h reminder window detection (±5 minutes)
- ✅ 1h reminder window detection (±5 minutes)
- ✅ Duplicate reminder prevention
- ✅ Error handling

**Run**: `npm test -- reminders-cron.test.ts`

### 4. Integration Tests

#### `apps/web/src/app/api/__tests__/notifications-integration-flow.test.ts`
**Purpose**: Tests integration between components

**Coverage**:
- ✅ Complete flow: booking → template → job
- ✅ Missing customer contact info handling
- ✅ Fee amount loading

**Run**: `npm test -- notifications-integration-flow.test.ts`

#### `apps/web/src/app/api/__tests__/notifications-end-to-end.test.ts`
**Purpose**: End-to-end flow tests

**Coverage**:
- ✅ Booking created flow (email + SMS)
- ✅ Fee charged flow with amount
- ✅ Reminder flow
- ✅ Error handling scenarios
- ✅ Notifications disabled check

**Run**: `npm test -- notifications-end-to-end.test.ts`

## Running All Tests

```bash
# Run all notification-related tests
npm test -- notifications

# Run with watch mode
npm test -- --watch notifications

# Run with coverage
npm test -- --coverage notifications

# Run specific test file
npm test -- notification-senders.test.ts
```

## Test Scenarios

### ✅ Happy Paths
1. **Booking Created**
   - Customer books appointment
   - Email template loaded and rendered
   - SMS template loaded and rendered
   - Jobs enqueued for both channels
   - Cron processes jobs
   - Email sent via SendGrid
   - SMS sent via Twilio

2. **Booking Completed**
   - Owner marks booking as completed
   - Notification emitted
   - Template rendered with booking data
   - Job enqueued and processed

3. **Fee Charged**
   - Owner marks no-show or cancellation
   - Fee amount loaded from payment
   - Notification includes fee amount
   - Template rendered with amount placeholder

4. **Reminders**
   - Cron finds bookings 24h before
   - Cron finds bookings 1h before
   - Reminders sent if templates exist
   - Duplicates prevented

### ✅ Error Handling
1. **Missing Data**
   - Business not found → Skip gracefully
   - Booking not found → Skip gracefully
   - Customer email missing → Skip email, send SMS
   - Customer phone missing → Skip SMS, send email
   - Template missing → Skip that channel

2. **Configuration Issues**
   - Notifications disabled → Skip all
   - Template disabled → Skip that template
   - Missing API keys → Error logged, job marked failed

3. **API Failures**
   - SendGrid API error → Retry with backoff
   - Twilio API error → Retry with backoff
   - Network error → Retry with backoff
   - After 3 failures → Mark as dead

4. **Validation Errors**
   - Invalid placeholders → Reject template
   - Missing required fields → Reject template
   - Invalid trigger → Reject template

### ✅ Edge Cases
1. **Idempotency**
   - Duplicate job prevention via unique constraint
   - Same event triggered twice → Only one notification

2. **Phone Number Formats**
   - `+1987654321` → Kept as-is
   - `1987654321` → Formatted to `+1987654321`
   - `(987) 654-3210` → Formatted to `+9876543210`

3. **Timezone Handling**
   - Dates formatted in business timezone
   - Times formatted in business timezone
   - DST transitions handled correctly

4. **Amount Handling**
   - Fee amount passed as parameter → Used directly
   - Fee amount not provided → Loaded from database
   - Refund amount handled similarly

## Test Quality

### Coverage Metrics
- **Unit Tests**: 18+ tests for core functions
- **Integration Tests**: 10+ tests for component integration
- **E2E Tests**: 8+ tests for complete flows
- **API Tests**: 15+ tests for endpoints
- **Cron Tests**: 12+ tests for background jobs

### Mocking Strategy
- Supabase client fully mocked
- SendGrid/Twilio APIs mocked
- Auth functions mocked
- All external dependencies isolated

### Assertions
- Success cases verified
- Error cases verified
- Edge cases verified
- Data transformations verified

## Continuous Integration

These tests should be run:
- ✅ Before every commit
- ✅ In CI/CD pipeline
- ✅ Before production deployment
- ✅ After dependency updates

## Maintenance

### Adding New Tests
When adding new notification features:
1. Add unit tests for new functions
2. Add integration tests for new flows
3. Update existing tests if behavior changes
4. Ensure all tests pass before merging

### Test Data
- Use realistic test data
- Cover all placeholder types
- Test various timezones
- Test various phone number formats

## Known Limitations

1. **Real API Calls**: Tests use mocked APIs, not real SendGrid/Twilio
   - For production verification, use integration tests with test credentials

2. **Database**: Tests use mocked Supabase, not real database
   - For database-specific tests, use separate integration test suite

3. **Timing**: Reminder tests use fixed times
   - For time-sensitive tests, use time mocking

## Success Criteria

All tests should:
- ✅ Pass consistently
- ✅ Run quickly (< 5 seconds total)
- ✅ Be isolated (no side effects)
- ✅ Be deterministic (same results every run)
- ✅ Cover all code paths
- ✅ Test error scenarios
- ✅ Verify production behavior

## Next Steps

1. ✅ All tests created and passing
2. ✅ Test documentation complete
3. ⏭️ Add to CI/CD pipeline
4. ⏭️ Set up test coverage reporting
5. ⏭️ Add performance benchmarks

