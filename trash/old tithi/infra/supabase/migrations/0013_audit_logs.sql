BEGIN;

-- Enable the necessary extension for audit log trigger functionality
-- (Note: This should already be available from pgcrypto in 0001_extensions.sql)

-- ============================================================================
-- Audit Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    table_name text NOT NULL,
    operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    record_id uuid,
    old_data jsonb,
    new_data jsonb,
    user_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign key constraints
ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ============================================================================
-- Events Outbox Table  
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    event_code text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'delivered', 'failed')),
    ready_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    failed_at timestamptz,
    attempts int NOT NULL DEFAULT 0,
    max_attempts int NOT NULL DEFAULT 3,
    last_attempt_at timestamptz,
    error_message text,
    key text, -- Optional unique key for exactly-once delivery
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign key constraints
ALTER TABLE public.events_outbox
    ADD CONSTRAINT events_outbox_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Unique constraint for optional exactly-once delivery
CREATE UNIQUE INDEX IF NOT EXISTS events_outbox_tenant_key_uniq 
    ON public.events_outbox(tenant_id, key) 
    WHERE key IS NOT NULL;

-- ============================================================================
-- Webhook Events Inbox Table (for idempotent inbound processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events_inbox (
    provider text NOT NULL,
    id text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, id)
);

-- ============================================================================
-- Generic Audit Logging Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_id_val uuid;
    user_id_val uuid;
    record_id_val uuid;
    has_id_column boolean;
BEGIN
    -- Check if the table has an 'id' column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = TG_TABLE_SCHEMA 
        AND table_name = TG_TABLE_NAME 
        AND column_name = 'id'
    ) INTO has_id_column;

    -- Extract tenant_id from the row (OLD for DELETE, NEW for INSERT/UPDATE)
    IF TG_OP = 'DELETE' THEN
        tenant_id_val := (OLD.tenant_id)::uuid;
        -- Only try to extract id if the column exists
        IF has_id_column THEN
            record_id_val := (OLD.id)::uuid;
        ELSE
            record_id_val := NULL;
        END IF;
    ELSE
        tenant_id_val := (NEW.tenant_id)::uuid;
        -- Only try to extract id if the column exists
        IF has_id_column THEN
            record_id_val := (NEW.id)::uuid;
        ELSE
            record_id_val := NULL;
        END IF;
    END IF;

    -- Get current user from JWT helper
    user_id_val := public.current_user_id();

    -- Insert audit record
    INSERT INTO public.audit_logs (
        tenant_id,
        table_name,
        operation,
        record_id,
        old_data,
        new_data,
        user_id,
        created_at
    ) VALUES (
        tenant_id_val,
        TG_TABLE_NAME,
        TG_OP,
        record_id_val,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        user_id_val,
        now()
    );

    -- Return appropriate record based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ============================================================================
-- Audit Purge Function (12-month retention)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purge_audit_older_than_12m()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count int;
BEGIN
    DELETE FROM public.audit_logs 
    WHERE created_at < now() - interval '12 months';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- Customer Anonymization Function (GDPR compliance)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.anonymize_customer(p_tenant_id uuid, p_customer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update customer record to scrub PII while preserving aggregates
    UPDATE public.customers
    SET 
        display_name = 'Anonymized Customer',
        email = NULL,
        phone = NULL,
        marketing_opt_in = false,
        notification_preferences = '{}',
        pseudonymized_at = now(),
        updated_at = now()
    WHERE tenant_id = p_tenant_id 
      AND id = p_customer_id 
      AND deleted_at IS NULL;

    -- Log the anonymization action
    INSERT INTO public.audit_logs (
        tenant_id,
        table_name,
        operation,
        record_id,
        old_data,
        new_data,
        user_id,
        created_at
    ) VALUES (
        p_tenant_id,
        'customers',
        'ANONYMIZE',
        p_customer_id,
        NULL,
        jsonb_build_object('action', 'anonymized', 'timestamp', now()),
        public.current_user_id(),
        now()
    );
END;
$$;

-- ============================================================================
-- Attach Audit Triggers to Key Tables
-- ============================================================================

-- Bookings audit trigger
DROP TRIGGER IF EXISTS bookings_audit_aiud ON public.bookings;
CREATE TRIGGER bookings_audit_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Services audit trigger
DROP TRIGGER IF EXISTS services_audit_aiud ON public.services;
CREATE TRIGGER services_audit_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Payments audit trigger
DROP TRIGGER IF EXISTS payments_audit_aiud ON public.payments;
CREATE TRIGGER payments_audit_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Themes audit trigger
DROP TRIGGER IF EXISTS themes_audit_aiud ON public.themes;
CREATE TRIGGER themes_audit_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.themes
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Quotas audit trigger
DROP TRIGGER IF EXISTS quotas_audit_aiud ON public.quotas;
CREATE TRIGGER quotas_audit_aiud
    AFTER INSERT OR UPDATE OR DELETE ON public.quotas
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============================================================================
-- Attach Updated At Trigger to Events Outbox
-- ============================================================================

DROP TRIGGER IF EXISTS events_outbox_touch_updated_at ON public.events_outbox;
CREATE TRIGGER events_outbox_touch_updated_at
    BEFORE INSERT OR UPDATE ON public.events_outbox
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;
