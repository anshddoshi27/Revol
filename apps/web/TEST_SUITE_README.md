# Tithi Unit Test Suite

## Overview

This is a comprehensive, executable unit test suite for the Tithi application. All tests are isolated, deterministic, and use mocks for external services (Stripe, SendGrid, Twilio).

## Test Framework

- **Framework**: Vitest
- **Language**: TypeScript
- **Environment**: Node.js

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Structure

### Test Files Created

#### 1. **Data Model & Validation Tests**
- `src/lib/__tests__/validators.test.ts` - Zod schema validation
- `src/lib/__tests__/data-models.test.ts` - Data model business rules

#### 2. **Business Logic Tests**
- `src/lib/__tests__/pricing.test.ts` - Gift card and policy fee calculations
- `src/lib/__tests__/gift-card-ledger.test.ts` - Gift card balance and ledger logic
- `src/lib/__tests__/payment-workflows.test.ts` - Payment workflow logic (complete, no-show, cancel, refund)
- `src/lib/__tests__/notification-template.test.ts` - Notification template rendering and validation
- `src/lib/__tests__/availability.test.ts` - Availability slot generation (existing)
- `src/lib/__tests__/edge-cases.test.ts` - Edge cases and error scenarios

#### 3. **API Handler Tests**
- `src/app/api/__tests__/auth-api.test.ts` - Authentication (signup, login)
- `src/app/api/__tests__/public-booking-api.test.ts` - Public booking API
- `src/app/api/__tests__/booking-flow-integration.test.ts` - Booking flow integration (existing)
- `src/app/api/__tests__/gift-cards-policies.test.ts` - Gift cards and policies (existing)

#### 4. **Test Infrastructure**
- `src/test/setup.ts` - Test environment setup
- `src/test/__mocks__/stripe.ts` - Stripe client mocks
- `src/test/__mocks__/sendgrid.ts` - SendGrid mocks
- `src/test/__mocks__/twilio.ts` - Twilio mocks
- `src/test/factories.ts` - Test data factories

## Test Coverage

### Covered Areas

✅ **Data Models & Validation**
- User and business creation rules
- Service and category validation
- Staff model (no login)
- Customer validation (optional phone, email format)
- Booking model (final_price calculation, code uniqueness)
- Policy validation (fee types and values)

✅ **Business Logic**
- Gift card discount calculation (amount and percent types)
- Gift card ledger (issuance, redemption, balance calculation)
- Payment workflows (complete, no-show, cancel, refund)
- Pricing engine (platform fees, discounts)
- Availability engine (slot generation, lead time, max advance)
- Notification template engine (placeholder merging, validation)

✅ **API Handlers**
- Authentication (signup, login)
- Public booking creation
- Booking actions (complete, no-show, cancel, refund)
- Gift card validation and application

✅ **Edge Cases**
- Slot expiration between UI and API
- Concurrent booking attempts
- Stripe API timeouts
- Gift card partial use and over-redemption prevention
- Tenant isolation (RLS)
- Policy configuration edge cases
- Date/time handling (DST, timezones)

## Mocks

All external services are mocked:

- **Stripe**: Simulates success, decline, requires_action, and timeout scenarios
- **SendGrid**: Simulates email sending success and failure
- **Twilio**: Simulates SMS sending success and failure
- **Supabase**: Mocked via test factories and query builders

## Test Factories

Test factories in `src/test/factories.ts` provide consistent, repeatable test data:

- `createMockBusiness()` - Business records
- `createMockUser()` - User records
- `createMockService()` - Service records
- `createMockCategory()` - Category records
- `createMockStaff()` - Staff records
- `createMockCustomer()` - Customer records
- `createMockBooking()` - Booking records
- `createMockGiftCard()` - Gift card records
- `createMockPolicy()` - Policy records
- `createMockAvailabilityRule()` - Availability rules
- `createMockBookingPayment()` - Payment records
- `createMockGiftCardLedger()` - Ledger entries
- `createMockNotificationTemplate()` - Notification templates

## Key Test Scenarios

### Gift Card Logic
- Amount-type: Balance deduction, partial use, over-redemption prevention
- Percent-type: Discount calculation, no balance tracking
- Ledger: Issuance, redemption, balance restoration

### Payment Workflows
- Complete booking: Full charge, idempotency, gift card deduction
- No-show: Fee calculation from final price, zero fee handling
- Cancel: Fee calculation, zero fee handling
- Refund: Full and partial refunds, gift card restoration

### Availability
- Weekly rule expansion
- Multi-staff overlapping slots
- DST boundaries
- Lead-time cutoff
- Max advance window
- Blackouts

### Notifications
- Placeholder merging (all allowed placeholders)
- Template validation
- Disabled template handling
- Missing data handling

## Notes

- All tests are isolated and don't require a running database
- Tests use mocks for all external services
- Test data is generated using factories for consistency
- Edge cases are thoroughly covered
- RLS/tenant isolation is tested

## Next Steps

1. Run `npm test` to execute all tests
2. Review coverage report with `npm run test:coverage`
3. Fix any failing tests
4. Add additional tests as needed for new features

