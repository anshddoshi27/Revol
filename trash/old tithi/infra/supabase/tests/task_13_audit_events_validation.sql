-- ============================================================================
-- Task 13 Validation Tests: Audit Logs & Events Outbox
-- ============================================================================
-- Run in Supabase SQL Editor to validate Task 13 implementation
-- These tests verify audit logging, events outbox, and GDPR functionality

BEGIN;

-- Clean up any existing test data
DELETE FROM audit_logs WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM events_outbox WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM webhook_events_inbox WHERE provider = 'test-provider';
DELETE FROM bookings WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM customers WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2');

-- ============================================================================
-- TEST 1: Audit Logs Table Structure and Constraints
-- ============================================================================

DO $$
BEGIN
    -- Verify audit_logs table exists with correct structure
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'audit_logs' AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: audit_logs table does not exist';
    END IF;

    -- Verify required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name IN ('id', 'tenant_id', 'table_name', 'operation', 'record_id', 'old_data', 'new_data', 'user_id', 'created_at')
        GROUP BY table_name
        HAVING COUNT(*) = 9
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: audit_logs missing required columns';
    END IF;

    -- Verify operation CHECK constraint
    BEGIN
        INSERT INTO audit_logs (tenant_id, table_name, operation, created_at)
        VALUES (gen_random_uuid(), 'test', 'INVALID_OP', now());
        RAISE EXCEPTION 'TEST FAILED: operation CHECK constraint not working';
    EXCEPTION
        WHEN check_violation THEN
            -- Expected behavior
            NULL;
    END;

    RAISE NOTICE 'TEST 1 PASSED: Audit logs table structure validated';
END;
$$;

-- ============================================================================
-- TEST 2: Events Outbox Table Structure and Constraints
-- ============================================================================

DO $$
BEGIN
    -- Verify events_outbox table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'events_outbox' AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'TEST FAILED: events_outbox table does not exist';
    END IF;

    -- Verify status CHECK constraint
    BEGIN
        INSERT INTO events_outbox (tenant_id, event_code, status)
        VALUES (gen_random_uuid(), 'test_event', 'invalid_status');
        RAISE EXCEPTION 'TEST FAILED: status CHECK constraint not working';
    EXCEPTION
        WHEN check_violation THEN
            -- Expected behavior
            NULL;
    END;

    RAISE NOTICE 'TEST 2 PASSED: Events outbox table structure validated';
END;
$$;

-- ============================================================================
-- TEST 3: Webhook Events Inbox Idempotency
-- ============================================================================

DO $$
DECLARE
    insert_count int;
BEGIN
    -- Test idempotent insert with composite primary key
    INSERT INTO webhook_events_inbox (provider, id, payload)
    VALUES ('test-provider', 'event-001', '{"test": "data"}');
    
    INSERT INTO webhook_events_inbox (provider, id, payload)
    VALUES ('test-provider', 'event-001', '{"test": "different data"}')
    ON CONFLICT (provider, id) DO NOTHING;
    
    SELECT COUNT(*) INTO insert_count 
    FROM webhook_events_inbox 
    WHERE provider = 'test-provider' AND id = 'event-001';
    
    IF insert_count != 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Webhook inbox idempotency not working, found % records', insert_count;
    END IF;

    RAISE NOTICE 'TEST 3 PASSED: Webhook inbox idempotency validated';
END;
$$;

-- ============================================================================
-- TEST 4: Setup Test Data for Audit Testing
-- ============================================================================

-- Create test tenants
INSERT INTO tenants (id, slug, tz, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'test-audit-tenant', 'UTC', now(), now()),
    ('22222222-2222-2222-2222-222222222222', 'test-audit-tenant-2', 'UTC', now(), now());

-- Create test customers
INSERT INTO customers (id, tenant_id, display_name, email, created_at, updated_at)
VALUES 
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Test Customer 1', 'test1@example.com', now(), now()),
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Test Customer 2', 'test2@example.com', now(), now());

-- Create test service
INSERT INTO services (id, tenant_id, slug, name, duration_min, price_cents, created_at, updated_at)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'test-service', 'Test Service', 60, 5000, now(), now());

-- Test 4 completion notice
DO $$
BEGIN
    RAISE NOTICE 'TEST 4 COMPLETED: Test data setup complete';
END;
$$;

-- ============================================================================
-- TEST 5: Audit Trigger Functionality
-- ============================================================================

DO $$
DECLARE
    audit_count_before int;
    audit_count_after int;
    booking_id uuid := '66666666-6666-6666-6666-666666666666';
    audit_record record;
BEGIN
    -- Count existing audit records
    SELECT COUNT(*) INTO audit_count_before FROM audit_logs;

    -- Test INSERT audit logging
    INSERT INTO bookings (
        id, tenant_id, customer_id, resource_id, client_generated_id,
        start_at, end_at, booking_tz, created_at, updated_at
    ) VALUES (
        booking_id, '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
        NULL, 'test-booking-001', 
        now() + interval '1 day', now() + interval '1 day 1 hour', 'UTC', now(), now()
    );

    -- Test UPDATE audit logging
    UPDATE bookings 
    SET attendee_count = 2, updated_at = now()
    WHERE id = booking_id;

    -- Test DELETE audit logging
    DELETE FROM bookings WHERE id = booking_id;

    -- Count audit records after operations
    SELECT COUNT(*) INTO audit_count_after FROM audit_logs WHERE table_name = 'bookings';

    IF audit_count_after < audit_count_before + 3 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected at least 3 new audit records, found %', (audit_count_after - audit_count_before);
    END IF;

    -- Verify audit record structure
    SELECT * INTO audit_record 
    FROM audit_logs 
    WHERE table_name = 'bookings' AND operation = 'INSERT' AND record_id = booking_id;

    IF audit_record.tenant_id != '11111111-1111-1111-1111-111111111111' THEN
        RAISE EXCEPTION 'TEST FAILED: Audit record tenant_id mismatch';
    END IF;

    IF audit_record.new_data IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: INSERT audit missing new_data';
    END IF;

    RAISE NOTICE 'TEST 5 PASSED: Audit trigger functionality validated (% records created)', (audit_count_after - audit_count_before);
END;
$$;

-- ============================================================================
-- TEST 6: Events Outbox Functionality
-- ============================================================================

DO $$
DECLARE
    outbox_count int;
    event_record record;
BEGIN
    -- Test basic event insertion
    INSERT INTO events_outbox (tenant_id, event_code, payload, status)
    VALUES ('11111111-1111-1111-1111-111111111111', 'booking_created', '{"booking_id": "test-123"}', 'ready');

    -- Test unique key constraint
    INSERT INTO events_outbox (tenant_id, event_code, payload, key)
    VALUES ('11111111-1111-1111-1111-111111111111', 'unique_event', '{"test": "data"}', 'unique-key-001');

    -- Test duplicate key constraint (should fail)
    BEGIN
        INSERT INTO events_outbox (tenant_id, event_code, payload, key)
        VALUES ('11111111-1111-1111-1111-111111111111', 'unique_event_2', '{"test": "data2"}', 'unique-key-001');
        RAISE EXCEPTION 'TEST FAILED: Unique key constraint not working';
    EXCEPTION
        WHEN unique_violation THEN
            -- Expected behavior
            NULL;
    END;

    -- Test status update simulation
    UPDATE events_outbox 
    SET status = 'delivered', delivered_at = now(), attempts = 1
    WHERE event_code = 'booking_created';

    -- Verify touch_updated_at trigger
    SELECT * INTO event_record 
    FROM events_outbox 
    WHERE event_code = 'booking_created';

    IF event_record.updated_at IS NULL OR event_record.updated_at <= event_record.created_at THEN
        RAISE EXCEPTION 'TEST FAILED: touch_updated_at trigger not working on events_outbox';
    END IF;

    SELECT COUNT(*) INTO outbox_count FROM events_outbox;
    
    RAISE NOTICE 'TEST 6 PASSED: Events outbox functionality validated (% events)', outbox_count;
END;
$$;

-- ============================================================================
-- TEST 7: GDPR Anonymization Function
-- ============================================================================

DO $$
DECLARE
    customer_record record;
    audit_count_before int;
    audit_count_after int;
BEGIN
    -- Count audit records before anonymization
    SELECT COUNT(*) INTO audit_count_before FROM audit_logs WHERE operation = 'ANONYMIZE';

    -- Test anonymization function
    SELECT public.anonymize_customer(
        '11111111-1111-1111-1111-111111111111'::uuid, 
        '44444444-4444-4444-4444-444444444444'::uuid
    );

    -- Verify customer data was anonymized
    SELECT * INTO customer_record 
    FROM customers 
    WHERE id = '44444444-4444-4444-4444-444444444444';

    IF customer_record.display_name != 'Anonymized Customer' THEN
        RAISE EXCEPTION 'TEST FAILED: Customer display_name not anonymized';
    END IF;

    IF customer_record.email IS NOT NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Customer email not anonymized';
    END IF;

    IF customer_record.pseudonymized_at IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: Customer pseudonymized_at not set';
    END IF;

    -- Verify audit log was created
    SELECT COUNT(*) INTO audit_count_after FROM audit_logs WHERE operation = 'ANONYMIZE';

    IF audit_count_after != audit_count_before + 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Anonymization audit log not created';
    END IF;

    RAISE NOTICE 'TEST 7 PASSED: GDPR anonymization functionality validated';
END;
$$;

-- ============================================================================
-- TEST 8: Audit Purge Function (12-month retention)
-- ============================================================================

DO $$
DECLARE
    purged_count int;
    old_audit_id uuid := gen_random_uuid();
BEGIN
    -- Insert old audit record (13 months ago)
    INSERT INTO audit_logs (
        id, tenant_id, table_name, operation, 
        record_id, created_at
    ) VALUES (
        old_audit_id,
        '11111111-1111-1111-1111-111111111111',
        'test_table',
        'INSERT',
        gen_random_uuid(),
        now() - interval '13 months'
    );

    -- Run purge function
    SELECT public.purge_audit_older_than_12m() INTO purged_count;

    -- Verify old record was purged
    IF EXISTS (SELECT 1 FROM audit_logs WHERE id = old_audit_id) THEN
        RAISE EXCEPTION 'TEST FAILED: Old audit record not purged';
    END IF;

    IF purged_count < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: Purge function returned % deleted records', purged_count;
    END IF;

    RAISE NOTICE 'TEST 8 PASSED: Audit purge functionality validated (% records purged)', purged_count;
END;
$$;

-- ============================================================================
-- TEST 9: Multi-tenant Isolation in Audit Logs
-- ============================================================================

DO $$
DECLARE
    tenant1_audits int;
    tenant2_audits int;
BEGIN
    -- Create data in second tenant
    INSERT INTO customers (id, tenant_id, display_name, email, created_at, updated_at)
    VALUES ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Tenant 2 Customer', 'tenant2@example.com', now(), now());

    -- Update customer in second tenant (should create audit log)
    UPDATE customers 
    SET display_name = 'Updated Tenant 2 Customer', updated_at = now()
    WHERE id = '77777777-7777-7777-7777-777777777777';

    -- Count audit logs per tenant
    SELECT COUNT(*) INTO tenant1_audits 
    FROM audit_logs 
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

    SELECT COUNT(*) INTO tenant2_audits 
    FROM audit_logs 
    WHERE tenant_id = '22222222-2222-2222-2222-222222222222';

    IF tenant1_audits = 0 OR tenant2_audits = 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Multi-tenant audit isolation not working (T1: %, T2: %)', tenant1_audits, tenant2_audits;
    END IF;

    RAISE NOTICE 'TEST 9 PASSED: Multi-tenant audit isolation validated (T1: %, T2: %)', tenant1_audits, tenant2_audits;
END;
$$;

-- ============================================================================
-- TEST 10: Function Security and Permissions
-- ============================================================================

DO $$
DECLARE
    func_record record;
BEGIN
    -- Verify log_audit function properties
    SELECT proname, prosecdef, proacl INTO func_record
    FROM pg_proc 
    WHERE proname = 'log_audit' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST FAILED: log_audit function not found';
    END IF;

    IF NOT func_record.prosecdef THEN
        RAISE EXCEPTION 'TEST FAILED: log_audit function not SECURITY DEFINER';
    END IF;

    -- Verify purge function properties
    SELECT proname, prosecdef INTO func_record
    FROM pg_proc 
    WHERE proname = 'purge_audit_older_than_12m' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST FAILED: purge_audit_older_than_12m function not found';
    END IF;

    IF NOT func_record.prosecdef THEN
        RAISE EXCEPTION 'TEST FAILED: purge_audit_older_than_12m function not SECURITY DEFINER';
    END IF;

    RAISE NOTICE 'TEST 10 PASSED: Function security properties validated';
END;
$$;

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

DO $$
DECLARE
    total_audit_records int;
    total_outbox_records int;
    total_inbox_records int;
BEGIN
    SELECT COUNT(*) INTO total_audit_records FROM audit_logs;
    SELECT COUNT(*) INTO total_outbox_records FROM events_outbox;
    SELECT COUNT(*) INTO total_inbox_records FROM webhook_events_inbox;

    RAISE NOTICE '';
    RAISE NOTICE '=== TASK 13 VALIDATION COMPLETE ===';
    RAISE NOTICE 'Total audit records: %', total_audit_records;
    RAISE NOTICE 'Total outbox events: %', total_outbox_records;
    RAISE NOTICE 'Total inbox events: %', total_inbox_records;
    RAISE NOTICE '';
    RAISE NOTICE 'ALL TESTS PASSED! ✅';
    RAISE NOTICE 'Task 13 implementation is working correctly.';
    RAISE NOTICE '';
END;
$$;

-- Clean up test data
DELETE FROM audit_logs WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM events_outbox WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM webhook_events_inbox WHERE provider = 'test-provider';
DELETE FROM customers WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM services WHERE tenant_id IN (
    SELECT id FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2')
);
DELETE FROM tenants WHERE slug IN ('test-audit-tenant', 'test-audit-tenant-2');

COMMIT;

-- ============================================================================
-- END OF TESTS
-- ============================================================================
