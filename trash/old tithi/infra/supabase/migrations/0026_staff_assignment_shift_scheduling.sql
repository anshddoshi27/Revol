-- P0026 — Staff Assignment & Shift Scheduling
-- Adds staff assignment and shift scheduling system
-- Creates staff_profiles and staff_assignment_history tables

BEGIN;

-- Create staff_profiles table
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    
    -- Staff details
    display_name text NOT NULL,
    bio text,
    specialties text[],
    hourly_rate_cents integer,
    
    -- Status and limits
    is_active boolean NOT NULL DEFAULT true,
    max_concurrent_bookings integer DEFAULT 1,
    
    -- Metadata and timestamps
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create staff_assignment_history table
CREATE TABLE IF NOT EXISTS public.staff_assignment_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_profile_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    
    -- Change tracking
    change_type assignment_change_type NOT NULL,
    old_values jsonb,
    new_values jsonb,
    reason text,
    changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create work_schedules table
CREATE TABLE IF NOT EXISTS public.work_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_profile_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
    
    -- Schedule details
    schedule_type schedule_type NOT NULL,
    start_date date NOT NULL,
    end_date date,
    work_hours jsonb, -- Store work hours as JSON
    is_time_off boolean NOT NULL DEFAULT false,
    overrides_regular boolean NOT NULL DEFAULT false,
    
    -- Recurrence rule
    rrule text, -- iCalendar RRULE format
    
    -- Additional details
    reason text,
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint for staff profile per resource
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'staff_profiles_resource_uniq'
    ) THEN
        ALTER TABLE public.staff_profiles 
        ADD CONSTRAINT staff_profiles_resource_uniq 
        UNIQUE (tenant_id, resource_id);
    END IF;
END $$;

-- Add touch trigger for staff_profiles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'staff_profiles_touch_updated_at'
    ) THEN
        CREATE TRIGGER staff_profiles_touch_updated_at
            BEFORE UPDATE ON public.staff_profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Add touch trigger for work_schedules table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'work_schedules_touch_updated_at'
    ) THEN
        CREATE TRIGGER work_schedules_touch_updated_at
            BEFORE UPDATE ON public.work_schedules
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_profiles_tenant_id 
ON public.staff_profiles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_membership_id 
ON public.staff_profiles(membership_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_resource_id 
ON public.staff_profiles(resource_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_is_active 
ON public.staff_profiles(is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_staff_assignment_history_tenant_id 
ON public.staff_assignment_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_staff_assignment_history_staff_profile_id 
ON public.staff_assignment_history(staff_profile_id);

CREATE INDEX IF NOT EXISTS idx_staff_assignment_history_change_type 
ON public.staff_assignment_history(change_type);

CREATE INDEX IF NOT EXISTS idx_work_schedules_tenant_id 
ON public.work_schedules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_work_schedules_staff_profile_id 
ON public.work_schedules(staff_profile_id);

CREATE INDEX IF NOT EXISTS idx_work_schedules_schedule_type 
ON public.work_schedules(schedule_type);

CREATE INDEX IF NOT EXISTS idx_work_schedules_date_range 
ON public.work_schedules(start_date, end_date);

-- Add comments for documentation
COMMENT ON TABLE public.staff_profiles IS 'Links staff members (memberships) to resources for team management';
COMMENT ON TABLE public.staff_assignment_history IS 'Tracks changes to staff assignments for audit';
COMMENT ON TABLE public.work_schedules IS 'Manages staff work schedules, time off, and shift overrides';

COMMIT;
