-- Migration: 0032_staff_availability.sql
-- Purpose: Create staff_availability table for Task 4.2
-- Dependencies: Task 4.1 (Services) - Complete

BEGIN;

-- Create staff_availability table for recurring weekly schedules
CREATE TABLE IF NOT EXISTS public.staff_availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_profile_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure end_time > start_time
    CONSTRAINT staff_availability_time_order_chk CHECK (end_time > start_time),
    
    -- Prevent duplicate availability for same staff/weekday
    CONSTRAINT staff_availability_unique_staff_weekday UNIQUE (tenant_id, staff_profile_id, weekday)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_availability_tenant_staff 
ON public.staff_availability (tenant_id, staff_profile_id);

CREATE INDEX IF NOT EXISTS idx_staff_availability_weekday 
ON public.staff_availability (weekday);

CREATE INDEX IF NOT EXISTS idx_staff_availability_active 
ON public.staff_availability (is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE TRIGGER staff_availability_updated_at
    BEFORE UPDATE ON public.staff_availability
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();

-- Add audit trigger
CREATE TRIGGER staff_availability_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.staff_availability
    FOR EACH ROW
    EXECUTE FUNCTION public.log_audit();

-- Enable RLS
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "staff_availability_sel" ON public.staff_availability
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "staff_availability_ins" ON public.staff_availability
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "staff_availability_upd" ON public.staff_availability
    FOR UPDATE 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "staff_availability_del" ON public.staff_availability
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Add comment
COMMENT ON TABLE public.staff_availability IS 'Staff availability for recurring weekly schedules. Supports timezone handling per tenant.';
COMMENT ON COLUMN public.staff_availability.weekday IS 'Day of week: 1=Monday, 2=Tuesday, ..., 7=Sunday';
COMMENT ON COLUMN public.staff_availability.start_time IS 'Start time for availability (in tenant timezone)';
COMMENT ON COLUMN public.staff_availability.end_time IS 'End time for availability (in tenant timezone)';
COMMENT ON COLUMN public.staff_availability.is_active IS 'Whether this availability rule is currently active';

COMMIT;
