-- infra/supabase/tests/tenant_isolation.sql
-- pgTAP tests for cross-tenant isolation via RLS policies
-- Tests that switching JWT claims blocks cross-tenant SELECT/DELETE across standard tables

BEGIN;

-- Enable pgTAP extension if not already enabled
SELECT plan(20);

-- Clean up any existing test data
DELETE FROM public.customers WHERE email LIKE '%@isolation-test-p19.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Isolation Test%';
DELETE FROM public.services WHERE name LIKE 'P19 Isolation Test%';
DELETE FROM public.tenants WHERE slug LIKE 'p19-isolation-%';
DELETE FROM public.users WHERE primary_email LIKE '%@isolation-test-p19.com';

-- =================================================================
-- SETUP: Test Data Creation (run as service role / admin)
-- =================================================================

-- Create test tenants
INSERT INTO public.tenants (id, slug, tz) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'p19-isolation-alpha', 'UTC'),
  ('22222222-2222-2222-2222-222222222222', 'p19-isolation-beta', 'UTC');

-- Create test users
INSERT INTO public.users (id, display_name, primary_email) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'Alpha User P19', 'alpha-p19@isolation-test-p19.com'),
  ('b2222222-2222-2222-2222-222222222222', 'Beta User P19', 'beta-p19@isolation-test-p19.com');

-- Create memberships
INSERT INTO public.memberships (tenant_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'owner');

-- Create test customers for Alpha tenant
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('ca111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alpha Customer 1', 'alpha-customer1@isolation-test-p19.com'),
  ('ca111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Alpha Customer 2', 'alpha-customer2@isolation-test-p19.com');

-- Create test customers for Beta tenant
INSERT INTO public.customers (id, tenant_id, display_name, email) VALUES
  ('cb222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'Beta Customer 1', 'beta-customer1@isolation-test-p19.com'),
  ('cb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Beta Customer 2', 'beta-customer2@isolation-test-p19.com');

-- Create test resources for each tenant
INSERT INTO public.resources (id, tenant_id, type, tz, capacity, name) VALUES
  ('ra111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'staff', 'UTC', 1, 'P19 Isolation Test Alpha Staff'),
  ('rb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'staff', 'UTC', 1, 'P19 Isolation Test Beta Staff');

-- Create test services for each tenant
INSERT INTO public.services (id, tenant_id, slug, name, duration_min, price_cents) VALUES
  ('sa111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'p19-test-alpha', 'P19 Isolation Test Alpha Service', 60, 5000),
  ('sb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'p19-test-beta', 'P19 Isolation Test Beta Service', 60, 5000);

-- Create test bookings for each tenant (non-overlapping times)
INSERT INTO public.bookings (id, tenant_id, customer_id, resource_id, client_generated_id, start_at, end_at, booking_tz) VALUES
  ('ba111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'ca111111-1111-1111-1111-111111111111', 'ra111111-1111-1111-1111-111111111111', 'alpha-p19-booking-1', '2024-12-01 10:00:00+00', '2024-12-01 11:00:00+00', 'UTC'),
  ('bb222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'cb222222-2222-2222-2222-222222222221', 'rb222222-2222-2222-2222-222222222222', 'beta-p19-booking-1', '2024-12-01 14:00:00+00', '2024-12-01 15:00:00+00', 'UTC');

-- =================================================================
-- TESTS: Tenant Isolation via RLS Policies
-- =================================================================

-- Mock JWT function to return specific claims
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
DECLARE
    mock_claims jsonb;
BEGIN
    -- Return claims for Alpha tenant user
    mock_claims := jsonb_build_object(
        'sub', 'a1111111-1111-1111-1111-111111111111',
        'tenant_id', '11111111-1111-1111-1111-111111111111'
    );
    RETURN mock_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test 1: Alpha user can see own tenant's customers
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    2,
    'Alpha user can see own tenant customers'
);

-- Test 2: Alpha user cannot see Beta tenant's customers
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    0,
    'Alpha user cannot see Beta tenant customers'
);

-- Test 3: Alpha user can see own tenant's resources
SELECT is(
    (SELECT count(*)::int FROM public.resources WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    1,
    'Alpha user can see own tenant resources'
);

-- Test 4: Alpha user cannot see Beta tenant's resources
SELECT is(
    (SELECT count(*)::int FROM public.resources WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    0,
    'Alpha user cannot see Beta tenant resources'
);

-- Test 5: Alpha user can see own tenant's services
SELECT is(
    (SELECT count(*)::int FROM public.services WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    1,
    'Alpha user can see own tenant services'
);

-- Test 6: Alpha user cannot see Beta tenant's services
SELECT is(
    (SELECT count(*)::int FROM public.services WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    0,
    'Alpha user cannot see Beta tenant services'
);

-- Test 7: Alpha user can see own tenant's bookings
SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    1,
    'Alpha user can see own tenant bookings'
);

-- Test 8: Alpha user cannot see Beta tenant's bookings
SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    0,
    'Alpha user cannot see Beta tenant bookings'
);

-- Now switch to Beta tenant context
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
DECLARE
    mock_claims jsonb;
BEGIN
    -- Return claims for Beta tenant user
    mock_claims := jsonb_build_object(
        'sub', 'b2222222-2222-2222-2222-222222222222',
        'tenant_id', '22222222-2222-2222-2222-222222222222'
    );
    RETURN mock_claims;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test 9: Beta user can see own tenant's customers
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    2,
    'Beta user can see own tenant customers'
);

-- Test 10: Beta user cannot see Alpha tenant's customers
SELECT is(
    (SELECT count(*)::int FROM public.customers WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    0,
    'Beta user cannot see Alpha tenant customers'
);

-- Test 11: Beta user can see own tenant's resources
SELECT is(
    (SELECT count(*)::int FROM public.resources WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    1,
    'Beta user can see own tenant resources'
);

-- Test 12: Beta user cannot see Alpha tenant's resources
SELECT is(
    (SELECT count(*)::int FROM public.resources WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    0,
    'Beta user cannot see Alpha tenant resources'
);

-- Test 13: Beta user can see own tenant's services
SELECT is(
    (SELECT count(*)::int FROM public.services WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    1,
    'Beta user can see own tenant services'
);

-- Test 14: Beta user cannot see Alpha tenant's services
SELECT is(
    (SELECT count(*)::int FROM public.services WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    0,
    'Beta user cannot see Alpha tenant services'
);

-- Test 15: Beta user can see own tenant's bookings
SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE tenant_id = '22222222-2222-2222-2222-222222222222'),
    1,
    'Beta user can see own tenant bookings'
);

-- Test 16: Beta user cannot see Alpha tenant's bookings
SELECT is(
    (SELECT count(*)::int FROM public.bookings WHERE tenant_id = '11111111-1111-1111-1111-111111111111'),
    0,
    'Beta user cannot see Alpha tenant bookings'
);

-- Test cross-tenant INSERT blocking (should fail due to RLS)
-- Test 17: Beta user cannot insert into Alpha tenant
SELECT throws_ok(
    $$INSERT INTO public.customers (tenant_id, display_name, email) VALUES ('11111111-1111-1111-1111-111111111111', 'Malicious Customer', 'malicious@test.com')$$,
    'new row violates row-level security policy',
    'Beta user cannot insert customer into Alpha tenant'
);

-- Test cross-tenant UPDATE blocking (should fail due to RLS)
-- Test 18: Beta user cannot update Alpha tenant data
SELECT throws_ok(
    $$UPDATE public.customers SET display_name = 'Hacked' WHERE tenant_id = '11111111-1111-1111-1111-111111111111'$$,
    'new row violates row-level security policy',
    'Beta user cannot update Alpha tenant customers'
);

-- Test cross-tenant DELETE blocking (should fail due to RLS)
-- Test 19: Beta user cannot delete Alpha tenant data
SELECT throws_ok(
    $$DELETE FROM public.customers WHERE tenant_id = '11111111-1111-1111-1111-111111111111'$$,
    NULL,
    'Beta user cannot delete Alpha tenant customers'
);

-- Test NULL claims (should deny all access)
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
BEGIN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test 20: NULL claims deny access to all tenant data
SELECT is(
    (SELECT count(*)::int FROM public.customers),
    0,
    'NULL JWT claims deny access to all customer data'
);

-- =================================================================
-- CLEANUP
-- =================================================================

-- Restore original auth.jwt function behavior (return NULL)
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$
BEGIN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up test data
DELETE FROM public.customers WHERE email LIKE '%@isolation-test-p19.com';
DELETE FROM public.resources WHERE name LIKE 'P19 Isolation Test%';
DELETE FROM public.services WHERE name LIKE 'P19 Isolation Test%';
DELETE FROM public.tenants WHERE slug LIKE 'p19-isolation-%';
DELETE FROM public.users WHERE primary_email LIKE '%@isolation-test-p19.com';

SELECT finish();

ROLLBACK;
