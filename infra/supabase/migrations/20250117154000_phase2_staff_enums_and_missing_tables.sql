-- P0032 — Phase 2 Staff Enums and Missing Tables
-- Adds missing enums and tables for Phase 2 Staff Management & Availability Engine
-- Completes the database schema for staff management, booking holds, and waitlist functionality

BEGIN;

-- Add missing enums for staff management
DO $$
BEGIN
    -- Schedule type enum for work schedules
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_type') THEN
        CREATE TYPE schedule_type AS ENUM (
            'regular',
            'override', 
            'time_off',
            'holiday'
        );
    END IF;

    -- Assignment change type enum for staff assignment history
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_change_type') THEN
        CREATE TYPE assignment_change_type AS ENUM (
            'assigned',
            'unassigned',
            'role_changed',
            'rate_changed'
        );
    END IF;

    -- Waitlist status enum for waitlist entries
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
        CREATE TYPE waitlist_status AS ENUM (
            'waiting',
            'notified',
            'booked',
            'expired',
            'cancelled'
        );
    END IF;
END
$$;

-- Create booking_holds table for temporary booking holds with TTL
CREATE TABLE IF NOT EXISTS public.booking_holds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    
    -- Hold timing
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    hold_until timestamptz NOT NULL,
    
    -- Hold identification
    hold_key text NOT NULL,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create waitlist_entries table for customer waitlist management
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Preferred timing
    preferred_start_at timestamptz,
    preferred_end_at timestamptz,
    
    -- Waitlist management
    priority integer DEFAULT 0,
    status waitlist_status NOT NULL DEFAULT 'waiting',
    notified_at timestamptz,
    expires_at timestamptz,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create availability_cache table for Redis-like caching
CREATE TABLE IF NOT EXISTS public.availability_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    
    -- Cache key components
    date date NOT NULL,
    
    -- Cached data
    availability_slots jsonb NOT NULL,
    
    -- Cache expiration
    expires_at timestamptz NOT NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraints
DO $$
BEGIN
    -- Unique constraint for booking holds per resource and time
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_holds_hold_key_uniq'
    ) THEN
        ALTER TABLE public.booking_holds 
        ADD CONSTRAINT booking_holds_hold_key_uniq 
        UNIQUE (tenant_id, hold_key);
    END IF;

    -- Unique constraint for waitlist entries per customer and resource
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waitlist_entries_customer_resource_uniq'
    ) THEN
        ALTER TABLE public.waitlist_entries 
        ADD CONSTRAINT waitlist_entries_customer_resource_uniq 
        UNIQUE (tenant_id, customer_id, resource_id, service_id);
    END IF;

    -- Unique constraint for availability cache per resource and date
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'availability_cache_resource_date_uniq'
    ) THEN
        ALTER TABLE public.availability_cache 
        ADD CONSTRAINT availability_cache_resource_date_uniq 
        UNIQUE (tenant_id, resource_id, date);
    END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
    -- Booking holds constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_holds_end_after_start_chk'
    ) THEN
        ALTER TABLE public.booking_holds 
        ADD CONSTRAINT booking_holds_end_after_start_chk 
        CHECK (end_at > start_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_holds_hold_until_after_start_chk'
    ) THEN
        ALTER TABLE public.booking_holds 
        ADD CONSTRAINT booking_holds_hold_until_after_start_chk 
        CHECK (hold_until > start_at);
    END IF;

    -- Waitlist entries constraints
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waitlist_entries_priority_nonneg_chk'
    ) THEN
        ALTER TABLE public.waitlist_entries 
        ADD CONSTRAINT waitlist_entries_priority_nonneg_chk 
        CHECK (priority >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'waitlist_entries_end_after_start_chk'
    ) THEN
        ALTER TABLE public.waitlist_entries 
        ADD CONSTRAINT waitlist_entries_end_after_start_chk 
        CHECK (preferred_end_at IS NULL OR preferred_end_at > preferred_start_at);
    END IF;
END $$;

-- Add touch triggers for updated_at columns
DO $$
BEGIN
    -- Booking holds trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'booking_holds_touch_updated_at'
    ) THEN
        CREATE TRIGGER booking_holds_touch_updated_at
            BEFORE UPDATE ON public.booking_holds
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Waitlist entries trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'waitlist_entries_touch_updated_at'
    ) THEN
        CREATE TRIGGER waitlist_entries_touch_updated_at
            BEFORE UPDATE ON public.waitlist_entries
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_holds_tenant_id 
ON public.booking_holds(tenant_id);

CREATE INDEX IF NOT EXISTS idx_booking_holds_resource_id 
ON public.booking_holds(resource_id);

CREATE INDEX IF NOT EXISTS idx_booking_holds_hold_until 
ON public.booking_holds(hold_until) 
WHERE hold_until > now();

CREATE INDEX IF NOT EXISTS idx_booking_holds_time_range 
ON public.booking_holds(start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_tenant_id 
ON public.waitlist_entries(tenant_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_resource_id 
ON public.waitlist_entries(resource_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_customer_id 
ON public.waitlist_entries(customer_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status 
ON public.waitlist_entries(status);

CREATE INDEX IF NOT EXISTS idx_waitlist_entries_priority 
ON public.waitlist_entries(priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_availability_cache_tenant_id 
ON public.availability_cache(tenant_id);

CREATE INDEX IF NOT EXISTS idx_availability_cache_resource_id 
ON public.availability_cache(resource_id);

CREATE INDEX IF NOT EXISTS idx_availability_cache_date 
ON public.availability_cache(date);

CREATE INDEX IF NOT EXISTS idx_availability_cache_expires_at 
ON public.availability_cache(expires_at) 
WHERE expires_at > now();

-- Add comments for documentation
COMMENT ON TABLE public.booking_holds IS 'Temporary booking holds with TTL to prevent double-booking during checkout';
COMMENT ON TABLE public.waitlist_entries IS 'Customer waitlist for unavailable booking slots';
COMMENT ON TABLE public.availability_cache IS 'Cached availability calculations for performance optimization';

COMMENT ON COLUMN public.booking_holds.hold_key IS 'Unique identifier for the hold, used for release operations';
COMMENT ON COLUMN public.booking_holds.hold_until IS 'When the hold expires and becomes invalid';
COMMENT ON COLUMN public.waitlist_entries.priority IS 'Higher numbers = higher priority in waitlist';
COMMENT ON COLUMN public.waitlist_entries.status IS 'Current status of the waitlist entry';
COMMENT ON COLUMN public.availability_cache.availability_slots IS 'JSON array of available time slots for the date';

COMMIT;
