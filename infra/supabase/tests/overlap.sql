-- infra/supabase/tests/overlap.sql
-- pgTAP tests for booking overlap prevention, status sync behavior, and idempotency
-- Tests booking exclusion constraint, status precedence, timezone handling, and constraints

BEGIN;

-- Enable pgTAP extension if not already enabled
SELECT plan(25);

-- Clean up any existing test data
DELETE FROM public.bookings WHERE client_generated_id LIKE 'p19-overlap-%';
DELETE FROM public.customers WHERE email LIKE '%@overlap-test-p19.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Overlap Test%';
DELETE FROM public.services WHERE name LIKE 'P19 Overlap Test%';
DELETE FROM public.tenants WHERE slug = 'p19-overlap-test';
DELETE FROM public.users WHERE primary_email LIKE '%@overlap-test-p19.com';

-- =================================================================
-- SETUP: Test Data Creation
-- =================================================================

-- Create test tenant
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('33333333-3333-3333-3333-333333333333', 'p19-overlap-test', 'America/New_York');

-- Create test user
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('u3333333-3333-3333-3333-333333333333', 'Overlap Test User', 'user@overlap-test-p19.com');

-- Create membership
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('33333333-3333-3333-3333-333333333333', 'u3333333-3333-3333-3333-333333333333', 'owner');

-- Create test customer
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('c3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'Test Customer', 'customer@overlap-test-p19.com');

-- Create test resources with different timezones
INSERT INTO public.resources (id, tenant_id, type, tz, capacity, name) VALUES
  ('r3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'staff', 'UTC', 1, 'P19 Overlap Test Staff UTC'),
  ('r3333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'room', 'America/New_York', 2, 'P19 Overlap Test Room EST');

-- Create availability rules (DOW validation test)
INSERT INTO public.availability_rules (id, tenant_id, resource_id, dow, start_minute, end_minute) VALUES
  ('ar333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 1, 600, 1020), -- Monday 10:00-17:00
  ('ar333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 2, 540, 1080); -- Tuesday 09:00-18:00

-- Mock JWT for RLS context
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_build_object(
        'sub', 'u3333333-3333-3333-3333-333333333333',
        'tenant_id', '33333333-3333-3333-3333-333333333333'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- TEST SECTION 1: Booking Overlap Prevention
-- =================================================================

-- Test 1: First booking should succeed
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333331', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-1', '2024-12-02 14:00:00+00', '2024-12-02 15:00:00+00', 'UTC', 'pending');

SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-1'),
    1,
    'First booking on resource should succeed'
);

-- Test 2: Overlapping booking should fail (exact same time)
SELECT throws_ok(
    $$INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
      ('b3333333-3333-3333-3333-333333333332', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-2', '2024-12-02 14:00:00+00', '2024-12-02 15:00:00+00', 'UTC', 'pending')$$,
    '23P01',
    'Overlapping booking at exact same time should fail'
);

-- Test 3: Overlapping booking should fail (partial overlap)
SELECT throws_ok(
    $$INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
      ('b3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-3', '2024-12-02 14:30:00+00', '2024-12-02 15:30:00+00', 'UTC', 'pending')$$,
    '23P01',
    'Partially overlapping booking should fail'
);

-- Test 4: Non-overlapping booking should succeed (after)
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-4', '2024-12-02 15:00:00+00', '2024-12-02 16:00:00+00', 'UTC', 'confirmed');

SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-4'),
    1,
    'Non-overlapping booking (touching end time) should succeed'
);

-- Test 5: Non-overlapping booking should succeed (before)
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333335', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-5', '2024-12-02 13:00:00+00', '2024-12-02 14:00:00+00', 'UTC', 'checked_in');

SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-5'),
    1,
    'Non-overlapping booking (touching start time) should succeed'
);

-- Test 6: Different resource should allow overlapping time
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333336', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 'p19-overlap-booking-6', '2024-12-02 14:00:00+00', '2024-12-02 15:00:00+00', 'America/New_York', 'pending');

SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-6'),
    1,
    'Same time on different resource should succeed'
);

-- Test 7: Canceled booking should not block overlap
UPDATE public.bookings SET canceled_at = now(), status = 'canceled' WHERE client_generated_id = 'p19-overlap-booking-1';

INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333337', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-7', '2024-12-02 14:00:00+00', '2024-12-02 15:00:00+00', 'UTC', 'pending');

SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-7'),
    1,
    'Booking at same time as canceled booking should succeed'
);

-- =================================================================
-- TEST SECTION 2: Status Synchronization and Precedence
-- =================================================================

-- Test 8: canceled_at should override status to 'canceled'
UPDATE public.bookings SET canceled_at = now() WHERE client_generated_id = 'p19-overlap-booking-4';

SELECT is(
    (SELECT status FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-4'),
    'canceled'::booking_status,
    'Setting canceled_at should sync status to canceled'
);

-- Test 9: no_show_flag should set status to 'no_show' (when not canceled)
UPDATE public.bookings SET no_show_flag = true WHERE client_generated_id = 'p19-overlap-booking-5';

SELECT is(
    (SELECT status FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-5'),
    'no_show'::booking_status,
    'Setting no_show_flag should sync status to no_show'
);

-- Test 10: canceled_at takes precedence over no_show_flag
UPDATE public.bookings SET canceled_at = now(), no_show_flag = true WHERE client_generated_id = 'p19-overlap-booking-6';

SELECT is(
    (SELECT status FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-6'),
    'canceled'::booking_status,
    'canceled_at should take precedence over no_show_flag'
);

-- =================================================================
-- TEST SECTION 3: Idempotency Testing
-- =================================================================

-- Test 11: Duplicate client_generated_id should fail
SELECT throws_ok(
    $$INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
      ('b3333333-3333-3333-3333-333333333338', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 'p19-overlap-booking-7', '2024-12-02 16:00:00+00', '2024-12-02 17:00:00+00', 'UTC', 'pending')$$,
    '23505',
    'Duplicate client_generated_id should fail with unique violation'
);

-- =================================================================
-- TEST SECTION 4: Timezone Handling
-- =================================================================

-- Test 12: booking_tz should be auto-filled from resource
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at) VALUES
  ('b3333333-3333-3333-3333-333333333339', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 'p19-overlap-booking-8', '2024-12-02 17:00:00+00', '2024-12-02 18:00:00+00');

SELECT is(
    (SELECT booking_tz FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-8'),
    'America/New_York',
    'booking_tz should be filled from resource timezone'
);

-- Test 13: booking_tz should be auto-filled from tenant when resource has no timezone
UPDATE public.resources SET tz = NULL WHERE id = 'r3333333-3333-3333-3333-333333333334';

INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at) VALUES
  ('b3333333-3333-3333-3333-333333333340', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 'p19-overlap-booking-9', '2024-12-02 18:00:00+00', '2024-12-02 19:00:00+00');

SELECT is(
    (SELECT booking_tz FROM public.bookings WHERE client_generated_id = 'p19-overlap-booking-9'),
    'America/New_York',
    'booking_tz should be filled from tenant timezone when resource tz is NULL'
);

-- Restore resource timezone for remaining tests
UPDATE public.resources SET tz = 'America/New_York' WHERE id = 'r3333333-3333-3333-3333-333333333334';

-- =================================================================
-- TEST SECTION 5: Time and DOW Constraints
-- =================================================================

-- Test 14: start_at < end_at constraint
SELECT throws_ok(
    $$INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz) VALUES
      ('b3333333-3333-3333-3333-333333333341', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-10', '2024-12-02 19:00:00+00', '2024-12-02 18:00:00+00', 'UTC')$$,
    '23514',
    'Booking with end_at before start_at should fail'
);

-- Test 15: DOW constraint (should accept 1-7)
INSERT INTO public.availability_rules (id, tenant_id, resource_id, dow, start_minute, end_minute) VALUES
  ('ar333333-3333-3333-3333-333333333335', '33333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 7, 600, 1020); -- Sunday

SELECT is(
    (SELECT count(*)::int FROM public.availability_rules WHERE dow = 7),
    1,
    'DOW value 7 (Sunday) should be accepted'
);

-- Test 16: DOW constraint should reject invalid values
SELECT throws_ok(
    $$INSERT INTO public.availability_rules (id, tenant_id, resource_id, dow, start_minute, end_minute) VALUES
      ('ar333333-3333-3333-3333-333333333336', '33333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 0, 600, 1020)$$,
    '23514',
    'DOW value 0 should be rejected'
);

-- Test 17: DOW constraint should reject invalid values
SELECT throws_ok(
    $$INSERT INTO public.availability_rules (id, tenant_id, resource_id, dow, start_minute, end_minute) VALUES
      ('ar333333-3333-3333-3333-333333333337', '33333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 8, 600, 1020)$$,
    '23514',
    'DOW value 8 should be rejected'
);

-- =================================================================
-- TEST SECTION 6: Coupon Constraints (XOR and bounds)
-- =================================================================

-- Create test coupon with percentage discount
INSERT INTO public.coupons (id, tenant_id, code, name, percent_off) VALUES
  ('cp333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'P19TEST10', 'P19 Test 10% Off', 10);

-- Test 18: Coupon with valid percentage should succeed
SELECT is(
    (SELECT percent_off FROM public.coupons WHERE code = 'P19TEST10'),
    10,
    'Coupon with valid percentage (10) should be created'
);

-- Test 19: Coupon with invalid percentage (>100) should fail
SELECT throws_ok(
    $$INSERT INTO public.coupons (id, tenant_id, code, name, percent_off) VALUES
      ('cp333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'P19TESTBAD', 'Bad Coupon', 150)$$,
    '23514',
    'Coupon with percentage > 100 should fail'
);

-- Test 20: Coupon with fixed amount should succeed
INSERT INTO public.coupons (id, tenant_id, code, name, amount_off_cents) VALUES
  ('cp333333-3333-3333-3333-333333333335', '33333333-3333-3333-3333-333333333333', 'P19TEST500', 'P19 Test $5 Off', 500);

SELECT is(
    (SELECT amount_off_cents FROM public.coupons WHERE code = 'P19TEST500'),
    500,
    'Coupon with valid fixed amount should be created'
);

-- Test 21: Coupon with both percentage and amount should fail (XOR constraint)
SELECT throws_ok(
    $$INSERT INTO public.coupons (id, tenant_id, code, name, percent_off, amount_off_cents) VALUES
      ('cp333333-3333-3333-3333-333333333336', '33333333-3333-3333-3333-333333333333', 'P19TESTXOR', 'Bad XOR Coupon', 10, 500)$$,
    '23514',
    'Coupon with both percentage and amount should fail XOR constraint'
);

-- =================================================================
-- TEST SECTION 7: Soft-delete Unique Constraints
-- =================================================================

-- Create customer to test soft-delete unique behavior
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('c3333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 'Soft Delete Test', 'softdelete@overlap-test-p19.com');

-- Test 22: Email should be unique while active
SELECT throws_ok(
    $$INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
      ('c3333333-3333-3333-3333-333333333335', '33333333-3333-3333-3333-333333333333', 'Duplicate Email', 'softdelete@overlap-test-p19.com')$$,
    '23505',
    'Duplicate email should fail while customer is active'
);

-- Test 23: After soft-delete, email should be reusable
UPDATE public.customers SET deleted_at = now() WHERE email = 'softdelete@overlap-test-p19.com';

INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('c3333333-3333-3333-3333-333333333336', '33333333-3333-3333-3333-333333333333', 'Reused Email', 'softdelete@overlap-test-p19.com');

SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE email = 'softdelete@overlap-test-p19.com'),
    2,
    'Email should be reusable after soft-delete'
);

-- =================================================================
-- TEST SECTION 8: DST Edge Cases
-- =================================================================

-- Test 24: Overlapping bookings during DST transition should still be blocked
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
  ('b3333333-3333-3333-3333-333333333342', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 'p19-overlap-booking-dst1', '2024-03-10 06:00:00+00', '2024-03-10 08:00:00+00', 'America/New_York', 'pending'); -- Spring forward

SELECT throws_ok(
    $$INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, status) VALUES
      ('b3333333-3333-3333-3333-333333333343', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333334', 'p19-overlap-booking-dst2', '2024-03-10 07:00:00+00', '2024-03-10 09:00:00+00', 'America/New_York', 'pending')$$,
    '23P01',
    'Overlapping bookings during DST should still be blocked in UTC'
);

-- Test 25: Attendee count must be positive
SELECT throws_ok(
    $$INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz, attendee_count) VALUES
      ('b3333333-3333-3333-3333-333333333344', '33333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'r3333333-3333-3333-3333-333333333333', 'p19-overlap-booking-11', '2024-12-02 20:00:00+00', '2024-12-02 21:00:00+00', 'UTC', 0)$$,
    '23514',
    'Booking with zero attendee_count should fail'
);

-- =================================================================
-- CLEANUP
-- =================================================================

-- Restore original auth.jwt function behavior
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
BEGIN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up test data
DELETE FROM public.bookings WHERE client_generated_id LIKE 'p19-overlap-%';
DELETE FROM public.customers WHERE email LIKE '%@overlap-test-p19.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Overlap Test%';
DELETE FROM public.services WHERE name LIKE 'P19 Overlap Test%';
DELETE FROM public.tenants WHERE slug = 'p19-overlap-test';
DELETE FROM public.users WHERE primary_email LIKE '%@overlap-test-p19.com';

SELECT finish();

ROLLBACK;
