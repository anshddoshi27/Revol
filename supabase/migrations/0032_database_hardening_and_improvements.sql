-- P0029 — Database Hardening and Improvements
-- Addresses critical fixes and recommended improvements from database evaluation
-- Implements security hardening, performance optimizations, and compliance features

BEGIN;

-- ============================================================================
-- 1. AUDIT LOG TENANT VALIDATION & IMPROVEMENTS
-- ============================================================================

-- Make tenant_id nullable in audit_logs for user-scoped operations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'tenant_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.audit_logs 
        ALTER COLUMN tenant_id DROP NOT NULL;
    END IF;
END $$;

-- Add validation trigger to ensure tenant_id is provided for tenant-scoped tables
CREATE OR REPLACE FUNCTION public.validate_audit_log_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    table_has_tenant_id boolean;
BEGIN
    -- Check if the table being audited has a tenant_id column
    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = NEW.table_name 
        AND column_name = 'tenant_id'
    ) INTO table_has_tenant_id;
    
    -- If table has tenant_id column, ensure audit log has tenant_id
    IF table_has_tenant_id AND NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'Audit log tenant_id cannot be NULL for tenant-scoped table: %', NEW.table_name;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Add trigger for tenant_id validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'audit_logs_validate_tenant_id'
    ) THEN
        CREATE TRIGGER audit_logs_validate_tenant_id
            BEFORE INSERT ON public.audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION public.validate_audit_log_tenant_id();
    END IF;
END $$;

-- ============================================================================
-- 2. PCI COMPLIANCE & PAYMENT DATA SECURITY
-- ============================================================================

-- Add explicit constraints to prevent raw card data storage
DO $$
BEGIN
-- Add constraint to payment_methods to ensure no sensitive data in metadata
IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'payment_methods'
) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_methods_no_sensitive_data'
) THEN
    ALTER TABLE public.payment_methods 
    ADD CONSTRAINT payment_methods_no_sensitive_data 
    CHECK (
        metadata IS NULL OR 
        NOT (metadata ? 'card_number' OR metadata ? 'cvv' OR metadata ? 'cvc' OR metadata ? 'ssn')
    );
END IF;
END $$;

-- ============================================================================
-- 3. PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Add comprehensive indexes for calendar queries (sub-150ms performance)
CREATE INDEX IF NOT EXISTS idx_bookings_calendar_lookup 
ON public.bookings(tenant_id, resource_id, start_at, end_at, status) 
WHERE status IN ('pending', 'confirmed', 'checked_in');

CREATE INDEX IF NOT EXISTS idx_availability_rules_calendar 
ON public.availability_rules(tenant_id, resource_id, dow, start_minute, end_minute);

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_calendar 
ON public.availability_exceptions(tenant_id, resource_id, date, start_at, end_at);

-- Add full-text search indexes
CREATE INDEX IF NOT EXISTS idx_services_search 
ON public.services USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_customers_search 
ON public.customers USING gin(to_tsvector('english', display_name || ' ' || COALESCE(email, '')));

-- Add trigram indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_services_name_trgm 
ON public.services USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm 
ON public.customers USING gin(display_name gin_trgm_ops);

-- ============================================================================
-- 4. QUOTA ENFORCEMENT HOOKS
-- ============================================================================

-- Create function to check quota limits
CREATE OR REPLACE FUNCTION public.check_quota_limit(
    p_tenant_id uuid,
    p_quota_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    quota_record record;
    current_count integer;
BEGIN
    -- Get quota configuration
    SELECT * INTO quota_record
    FROM public.quotas
    WHERE tenant_id = p_tenant_id
    AND code = p_quota_code
    AND is_active = true;
    
    IF quota_record IS NULL THEN
        RETURN true; -- No quota configured
    END IF;
    
    -- Get current usage
    SELECT COALESCE(current_count, 0) INTO current_count
    FROM public.usage_counters
    WHERE tenant_id = p_tenant_id
    AND code = p_quota_code
    AND period_start <= now()
    AND period_end >= now();
    
    -- Check if limit exceeded
    RETURN current_count < quota_record.limit_value;
END;
$$;

-- ============================================================================
-- 5. ENHANCED BOOKING VALIDATION
-- ============================================================================

-- Create function to validate service-resource compatibility
CREATE OR REPLACE FUNCTION public.validate_service_resource_compatibility(
    p_tenant_id uuid,
    p_service_id uuid,
    p_resource_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    compatibility_count integer;
BEGIN
    -- Check if service is assigned to resource
    SELECT COUNT(*) INTO compatibility_count
    FROM public.service_resources
    WHERE tenant_id = p_tenant_id
    AND service_id = p_service_id
    AND resource_id = p_resource_id;
    
    RETURN compatibility_count > 0;
END;
$$;

-- ============================================================================
-- 6. SYSTEM HEALTH MONITORING
-- ============================================================================

-- Create function for system health checks
CREATE OR REPLACE FUNCTION public.get_system_health_status()
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
END;
$$;

-- ============================================================================
-- 7. COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Add comprehensive comments
COMMENT ON FUNCTION public.validate_audit_log_tenant_id() IS 'Ensures audit logs have tenant_id for tenant-scoped tables';
COMMENT ON FUNCTION public.check_quota_limit(uuid, text) IS 'Checks if tenant has exceeded quota limits';
COMMENT ON FUNCTION public.validate_service_resource_compatibility(uuid, uuid, uuid) IS 'Validates service-resource compatibility for bookings';
COMMENT ON FUNCTION public.get_system_health_status() IS 'Returns system health status for monitoring';

COMMIT;
