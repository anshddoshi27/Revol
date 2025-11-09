-- Migration: 0032_automation_tables.sql
-- Purpose: Create automation tables for automated reminders and campaigns
-- Dependencies: All previous migrations

BEGIN;

-- Create automation status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'automation_status') THEN
        CREATE TYPE automation_status AS ENUM (
            'active', 'paused', 'cancelled', 'completed'
        );
    END IF;
END
$$;

-- Create automation trigger enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'automation_trigger') THEN
        CREATE TYPE automation_trigger AS ENUM (
            'booking_created', 'booking_confirmed', 'booking_cancelled', 
            'booking_no_show', 'booking_completed', 'customer_registered',
            'payment_received', 'payment_failed', 'scheduled_time', 'custom_event'
        );
    END IF;
END
$$;

-- Create automation action enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'automation_action') THEN
        CREATE TYPE automation_action AS ENUM (
            'send_email', 'send_sms', 'send_push', 'create_booking',
            'update_customer', 'apply_discount', 'add_loyalty_points',
            'webhook_call', 'custom_action'
        );
    END IF;
END
$$;

-- Create automations table
CREATE TABLE IF NOT EXISTS public.automations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Basic automation information
    name text NOT NULL,
    description text,
    status automation_status NOT NULL DEFAULT 'active',
    
    -- Trigger configuration
    trigger_type automation_trigger NOT NULL,
    trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    -- Action configuration
    action_type automation_action NOT NULL,
    action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    -- Scheduling configuration
    schedule_expression text,
    schedule_timezone text NOT NULL DEFAULT 'UTC',
    start_date timestamptz,
    end_date timestamptz,
    
    -- Execution settings
    max_executions integer,
    execution_count integer NOT NULL DEFAULT 0,
    last_executed_at timestamptz,
    next_execution_at timestamptz,
    
    -- Targeting and filtering
    target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,
    conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    -- Rate limiting and throttling
    rate_limit_per_hour integer NOT NULL DEFAULT 100,
    rate_limit_per_day integer NOT NULL DEFAULT 1000,
    
    -- Metadata and tracking
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by text,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    
    -- Audit fields
    is_active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create automation_executions table
CREATE TABLE IF NOT EXISTS public.automation_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Execution details
    trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    action_result jsonb NOT NULL DEFAULT '{}'::jsonb,
    execution_status text NOT NULL DEFAULT 'pending',
    error_message text,
    
    -- Timing information
    started_at timestamptz,
    completed_at timestamptz,
    duration_ms integer,
    
    -- Context information
    user_id uuid,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    
    -- Retry information
    retry_count integer NOT NULL DEFAULT 0,
    max_retries integer NOT NULL DEFAULT 3,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for automations table
CREATE INDEX IF NOT EXISTS idx_automations_tenant_status 
ON public.automations (tenant_id, status) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_automations_trigger_type 
ON public.automations (trigger_type) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_automations_next_execution 
ON public.automations (next_execution_at) 
WHERE is_active = true AND next_execution_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automations_created_at 
ON public.automations (tenant_id, created_at DESC) 
WHERE is_active = true;

-- Create indexes for automation_executions table
CREATE INDEX IF NOT EXISTS idx_automation_executions_automation 
ON public.automation_executions (automation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_tenant 
ON public.automation_executions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_status 
ON public.automation_executions (execution_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_booking 
ON public.automation_executions (booking_id) 
WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_executions_customer 
ON public.automation_executions (customer_id) 
WHERE customer_id IS NOT NULL;

-- Create BRIN index for time-based queries on executions
CREATE INDEX IF NOT EXISTS idx_automation_executions_brin_created_at 
ON public.automation_executions USING BRIN (created_at);

-- Add constraints
ALTER TABLE public.automations 
ADD CONSTRAINT ck_automations_execution_count_positive 
CHECK (execution_count >= 0);

ALTER TABLE public.automations 
ADD CONSTRAINT ck_automations_max_executions_positive 
CHECK (max_executions IS NULL OR max_executions > 0);

ALTER TABLE public.automations 
ADD CONSTRAINT ck_automations_rate_limits_positive 
CHECK (rate_limit_per_hour > 0 AND rate_limit_per_day > 0);

ALTER TABLE public.automations 
ADD CONSTRAINT ck_automations_date_range 
CHECK (end_date IS NULL OR end_date >= start_date);

ALTER TABLE public.automation_executions 
ADD CONSTRAINT ck_automation_executions_retry_count_positive 
CHECK (retry_count >= 0);

ALTER TABLE public.automation_executions 
ADD CONSTRAINT ck_automation_executions_max_retries_positive 
CHECK (max_retries > 0);

ALTER TABLE public.automation_executions 
ADD CONSTRAINT ck_automation_executions_duration_positive 
CHECK (duration_ms IS NULL OR duration_ms >= 0);

ALTER TABLE public.automation_executions 
ADD CONSTRAINT ck_automation_executions_status_valid 
CHECK (execution_status IN ('pending', 'running', 'completed', 'failed'));

-- Add unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_automations_tenant_name_unique 
ON public.automations (tenant_id, name) 
WHERE is_active = true;

-- Add triggers for updated_at
CREATE TRIGGER automations_touch_updated_at
    BEFORE UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER automation_executions_touch_updated_at
    BEFORE UPDATE ON public.automation_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

-- Add audit triggers
CREATE TRIGGER automations_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER automation_executions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.automation_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit();

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for automations
CREATE POLICY "automations_sel" ON public.automations
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "automations_ins" ON public.automations
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "automations_upd" ON public.automations
    FOR UPDATE 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "automations_del" ON public.automations
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Create RLS policies for automation_executions
CREATE POLICY "automation_executions_sel" ON public.automation_executions
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "automation_executions_ins" ON public.automation_executions
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "automation_executions_upd" ON public.automation_executions
    FOR UPDATE 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "automation_executions_del" ON public.automation_executions
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Add relationship to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS automations_count integer DEFAULT 0;

-- Create function to update automation count
CREATE OR REPLACE FUNCTION public.update_tenant_automation_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.tenants 
        SET automations_count = automations_count + 1 
        WHERE id = NEW.tenant_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.tenants 
        SET automations_count = GREATEST(automations_count - 1, 0) 
        WHERE id = OLD.tenant_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update automation count
CREATE TRIGGER update_tenant_automation_count_trigger
    AFTER INSERT OR DELETE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenant_automation_count();

-- Create function to validate automation schedule
CREATE OR REPLACE FUNCTION public.validate_automation_schedule()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate schedule expression if provided
    IF NEW.schedule_expression IS NOT NULL THEN
        BEGIN
            -- This is a simplified validation - in production, you'd use a proper cron parser
            IF NEW.schedule_expression !~ '^[0-9\*\-\,\/\s]+$' THEN
                RAISE EXCEPTION 'Invalid schedule expression format';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid schedule expression: %', NEW.schedule_expression;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate automation schedule
CREATE TRIGGER validate_automation_schedule_trigger
    BEFORE INSERT OR UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_automation_schedule();

-- Insert default automation event types
INSERT INTO public.notification_event_type (code, description) VALUES
('automation_email', 'Automation-triggered email'),
('automation_sms', 'Automation-triggered SMS'),
('automation_push', 'Automation-triggered push notification')
ON CONFLICT (code) DO NOTHING;

COMMIT;
