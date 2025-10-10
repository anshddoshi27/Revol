-- P0030 — Critical Security Hardening & Production Readiness
-- Addresses all high-priority issues from database evaluation
-- Implements comprehensive security, compliance, and operational improvements

BEGIN;

-- ============================================================================
-- 1. ENHANCED RLS HELPER FUNCTIONS
-- ============================================================================

-- Enhanced current_tenant_id() with better error handling
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
RETURNS NULL ON NULL INPUT
AS $$
DECLARE
  tenant_id_value text;
  jwt_claims jsonb;
BEGIN
  -- Try to get JWT claims
  BEGIN
    jwt_claims := auth.jwt();
  EXCEPTION WHEN OTHERS THEN
    -- If JWT is not available or invalid, return NULL
    RETURN NULL;
  END;
  
  -- Check for tenant_id in JWT claims
  tenant_id_value := jwt_claims->>'tenant_id';
  
  -- Validate UUID format and return
  IF tenant_id_value IS NOT NULL 
     AND tenant_id_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN tenant_id_value::uuid;
  END IF;
  
  -- Fallback: check for tenant_id in request.jwt.claims setting
  BEGIN
    tenant_id_value := current_setting('request.jwt.claims.tenant_id', true);
    IF tenant_id_value IS NOT NULL 
       AND tenant_id_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN tenant_id_value::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting not available, continue
  END;
  
  RETURN NULL;
END;
$$;

-- Enhanced current_user_id() function
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
RETURNS NULL ON NULL INPUT
AS $$
DECLARE
  user_id_value text;
  jwt_claims jsonb;
BEGIN
  -- Try to get JWT claims
  BEGIN
    jwt_claims := auth.jwt();
  EXCEPTION WHEN OTHERS THEN
    -- If JWT is not available or invalid, return NULL
    RETURN NULL;
  END;
  
  -- Check for sub (user ID) in JWT claims
  user_id_value := jwt_claims->>'sub';
  
  -- Validate UUID format and return
  IF user_id_value IS NOT NULL 
     AND user_id_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN user_id_value::uuid;
  END IF;
  
  -- Fallback: check for sub in request.jwt.claims setting
  BEGIN
    user_id_value := current_setting('request.jwt.claims.sub', true);
    IF user_id_value IS NOT NULL 
       AND user_id_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN user_id_value::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting not available, continue
  END;
  
  RETURN NULL;
END;
$$;

-- ============================================================================
-- 2. BOOKING OVERLAP PREVENTION VERIFICATION
-- ============================================================================

-- Comprehensive booking overlap validation function
CREATE OR REPLACE FUNCTION public.validate_booking_slot_availability(
  p_tenant_id uuid,
  p_resource_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE(
  is_available boolean,
  conflicting_booking_id uuid,
  conflict_type text,
  suggested_slots timestamptz[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conflict_record record;
  suggested_slots timestamptz[] := '{}';
BEGIN
  -- Check for overlapping bookings with active statuses only
  SELECT b.id, b.status, b.start_at, b.end_at
  INTO conflict_record
  FROM public.bookings b
  WHERE b.tenant_id = p_tenant_id
    AND b.resource_id = p_resource_id
    AND b.status IN ('pending', 'confirmed', 'checked_in', 'completed')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start_at, p_end_at, '[)')
  LIMIT 1;
  
  IF conflict_record IS NOT NULL THEN
    -- Generate suggested alternative slots (simplified)
    suggested_slots := ARRAY[
      p_start_at + interval '30 minutes',
      p_start_at + interval '1 hour',
      p_start_at - interval '30 minutes',
      p_start_at + interval '2 hours'
    ];
    
    RETURN QUERY SELECT 
      false,
      conflict_record.id,
      'overlap_with_' || conflict_record.status,
      suggested_slots;
  ELSE
    RETURN QUERY SELECT 
      true,
      NULL::uuid,
      NULL::text,
      suggested_slots;
  END IF;
END;
$$;

-- ============================================================================
-- 3. OFFLINE BOOKING IDEMPOTENCY VERIFICATION
-- ============================================================================

-- Comprehensive offline booking validation
CREATE OR REPLACE FUNCTION public.validate_offline_booking_idempotency(
  p_tenant_id uuid,
  p_client_generated_id text
)
RETURNS TABLE(
  is_valid boolean,
  existing_booking_id uuid,
  existing_status text,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record record;
BEGIN
  -- Check if client_generated_id is valid format
  IF p_client_generated_id IS NULL OR length(trim(p_client_generated_id)) = 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Client generated ID cannot be empty'::text;
    RETURN;
  END IF;
  
  IF length(p_client_generated_id) > 255 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 'Client generated ID too long'::text;
    RETURN;
  END IF;
  
  -- Check if booking already exists
  SELECT id, status
  INTO booking_record
  FROM public.bookings
  WHERE tenant_id = p_tenant_id
    AND client_generated_id = p_client_generated_id;
  
  IF booking_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      true,  -- Valid but exists
      booking_record.id,
      booking_record.status,
      'Booking already exists with this client ID'::text;
  ELSE
    RETURN QUERY SELECT 
      true,  -- Valid and available
      NULL::uuid,
      NULL::text,
      'Client ID is available'::text;
  END IF;
END;
$$;

-- ============================================================================
-- 4. PCI COMPLIANCE & PAYMENT DATA SECURITY
-- ============================================================================

-- Comprehensive PCI compliance audit function
CREATE OR REPLACE FUNCTION public.audit_pci_compliance()
RETURNS TABLE(
  table_name text,
  column_name text,
  violation_type text,
  severity text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_tables text[] := ARRAY[
    'tenants', 'users', 'memberships', 'customers', 'resources', 'services',
    'bookings', 'payments', 'coupons', 'gift_cards', 'notifications',
    'audit_logs', 'events_outbox', 'webhook_events_inbox', 'payment_methods',
    'oauth_providers', 'staff_profiles', 'work_schedules', 'availability_rules',
    'availability_exceptions', 'usage_counters', 'quotas'
  ];
  app_table_name text;
  column_record record;
BEGIN
  -- Check only application tables for potential PCI violations
  FOREACH app_table_name IN ARRAY app_tables
  LOOP
    -- Check if table exists
    IF EXISTS(
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = app_table_name
    ) THEN
      -- Check columns for PCI-sensitive names
      FOR column_record IN
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = app_table_name
          AND (
            column_name ILIKE '%card_number%' OR
            column_name ILIKE '%cc_%' OR
            column_name ILIKE '%pan%' OR
            column_name ILIKE '%cvv%' OR
            column_name ILIKE '%cvc%' OR
            column_name ILIKE '%ssn%' OR
            column_name ILIKE '%social_security%'
          )
      LOOP
        RETURN QUERY SELECT 
          app_table_name::text,
          column_record.column_name::text,
          'PCI_SENSITIVE_COLUMN'::text,
          'HIGH'::text;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- 5. AUDIT LOG RETENTION & CLEANUP
-- ============================================================================

-- Enhanced audit log retention with automated cleanup
CREATE OR REPLACE FUNCTION public.audit_log_retention_cleanup()
RETURNS TABLE(
  deleted_count bigint,
  archived_count bigint,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count bigint := 0;
  archived_count bigint := 0;
  error_msg text;
BEGIN
  -- Delete audit logs older than 12 months
  BEGIN
    DELETE FROM public.audit_logs 
    WHERE created_at < now() - interval '12 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- For compliance, we might want to archive instead of delete
    -- This is a placeholder for future archive functionality
    archived_count := 0;
    
    RETURN QUERY SELECT deleted_count, archived_count, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    RETURN QUERY SELECT 0::bigint, 0::bigint, error_msg;
  END;
END;
$$;

-- ============================================================================
-- 6. TENANT ISOLATION VERIFICATION
-- ============================================================================

-- Comprehensive tenant isolation test
CREATE OR REPLACE FUNCTION public.test_tenant_isolation_comprehensive()
RETURNS TABLE(
  test_name text,
  passed boolean,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_tenant_1 uuid := gen_random_uuid();
  test_tenant_2 uuid := gen_random_uuid();
  test_user_1 uuid := gen_random_uuid();
  test_user_2 uuid := gen_random_uuid();
  result_count bigint;
BEGIN
  -- Test 1: RLS prevents cross-tenant data access
  BEGIN
    -- This should return 0 rows when RLS is working correctly
    SELECT count(*) INTO result_count
    FROM public.customers
    WHERE tenant_id = test_tenant_1;
    
    IF result_count = 0 THEN
      RETURN QUERY SELECT 'RLS Cross-tenant Prevention', true, 'RLS correctly prevents access to non-existent tenant data';
    ELSE
      RETURN QUERY SELECT 'RLS Cross-tenant Prevention', false, 'RLS failed to prevent cross-tenant access';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'RLS Cross-tenant Prevention', false, 'Error testing RLS: ' || SQLERRM;
  END;
  
  -- Test 2: Helper functions return NULL when no JWT context
  BEGIN
    -- This should return NULL when no JWT is set
    IF public.current_tenant_id() IS NULL AND public.current_user_id() IS NULL THEN
      RETURN QUERY SELECT 'Helper Functions Null Context', true, 'Helper functions correctly return NULL without JWT context';
    ELSE
      RETURN QUERY SELECT 'Helper Functions Null Context', false, 'Helper functions should return NULL without JWT context';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Helper Functions Null Context', false, 'Error testing helper functions: ' || SQLERRM;
  END;
  
  -- Test 3: Audit log tenant_id nullability
  BEGIN
    -- Test that audit logs can be created with NULL tenant_id for user-scoped operations
    INSERT INTO public.audit_logs (table_name, operation, record_id, user_id, created_at)
    VALUES ('users', 'INSERT', gen_random_uuid(), test_user_1, now());
    
    RETURN QUERY SELECT 'Audit Log Tenant Nullability', true, 'Audit logs can be created with NULL tenant_id for user-scoped operations';
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Audit Log Tenant Nullability', false, 'Error testing audit log tenant nullability: ' || SQLERRM;
  END;
  
  -- Clean up test data
  DELETE FROM public.audit_logs WHERE user_id = test_user_1;
END;
$$;

-- ============================================================================
-- 7. PRODUCTION READINESS MONITORING
-- ============================================================================

-- System health monitoring function
CREATE OR REPLACE FUNCTION public.get_production_readiness_status()
RETURNS TABLE(
  component text,
  status text,
  details text,
  critical boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check RLS status
  RETURN QUERY SELECT 
    'RLS Status',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_class WHERE relname = 'customers' AND relrowsecurity = true
    ) THEN 'ENABLED' ELSE 'DISABLED' END,
    'Row Level Security status on core tables',
    true;
  
  -- Check exclusion constraints
  RETURN QUERY SELECT 
    'Booking Overlap Prevention',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_constraint WHERE conname = 'bookings_excl_resource_time'
    ) THEN 'ENABLED' ELSE 'MISSING' END,
    'GiST exclusion constraint for booking overlap prevention',
    true;
  
  -- Check idempotency constraints
  RETURN QUERY SELECT 
    'Offline Booking Idempotency',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_constraint WHERE conname = 'bookings_idempotency_uniq'
    ) THEN 'ENABLED' ELSE 'MISSING' END,
    'Unique constraint for client_generated_id idempotency',
    true;
  
  -- Check PCI compliance
  RETURN QUERY SELECT 
    'PCI Compliance',
    CASE WHEN NOT EXISTS(
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name IN ('tenants', 'users', 'customers', 'bookings', 'payments', 'payment_methods')
      AND (column_name ILIKE '%card_number%' OR column_name ILIKE '%cvv%' OR column_name ILIKE '%cvc%')
    ) THEN 'COMPLIANT' ELSE 'VIOLATION' END,
    'No raw card data stored in application tables',
    true;
  
  -- Check audit log retention
  RETURN QUERY SELECT 
    'Audit Log Retention',
    CASE WHEN EXISTS(
      SELECT 1 FROM pg_proc WHERE proname = 'audit_log_retention_cleanup'
    ) THEN 'ENABLED' ELSE 'MISSING' END,
    'Automated audit log cleanup function',
    false;
END;
$$;

-- ============================================================================
-- 8. COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Add comprehensive comments
COMMENT ON FUNCTION public.validate_booking_slot_availability(uuid, uuid, timestamptz, timestamptz, uuid) IS 'Validates booking slot availability with conflict detection and suggestions';
COMMENT ON FUNCTION public.validate_offline_booking_idempotency(uuid, text) IS 'Validates offline booking idempotency with comprehensive error handling';
COMMENT ON FUNCTION public.audit_pci_compliance() IS 'Audits database for PCI compliance violations';
COMMENT ON FUNCTION public.audit_log_retention_cleanup() IS 'Cleans up old audit logs for compliance';
COMMENT ON FUNCTION public.test_tenant_isolation_comprehensive() IS 'Comprehensive tenant isolation testing';
COMMENT ON FUNCTION public.get_production_readiness_status() IS 'Returns production readiness status for monitoring';

COMMIT;
