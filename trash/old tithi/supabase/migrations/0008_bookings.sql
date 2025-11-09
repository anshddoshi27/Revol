BEGIN;

-- Create sync_booking_status function for status precedence
CREATE OR REPLACE FUNCTION public.sync_booking_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Enforce status precedence: canceled_at → no_show_flag → (preserve existing status)
    -- This ensures deterministic status based on flags and timestamps
    
    IF NEW.canceled_at IS NOT NULL THEN
        NEW.status = 'canceled';
    ELSIF NEW.no_show_flag = true THEN
        NEW.status = 'no_show';
    -- Otherwise preserve the explicitly set status
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create fill_booking_tz function for timezone resolution
CREATE OR REPLACE FUNCTION public.fill_booking_tz()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Fill booking_tz in priority order: NEW.booking_tz → resource.tz → tenant.tz → error
    -- This ensures every booking has a deterministic timezone for wall-time reconstruction
    
    IF NEW.booking_tz IS NULL THEN
        -- Try resource timezone
        SELECT r.tz INTO NEW.booking_tz
        FROM public.resources r
        WHERE r.id = NEW.resource_id
        AND r.tenant_id = NEW.tenant_id;
        
        -- If still NULL, try tenant timezone
        IF NEW.booking_tz IS NULL THEN
            SELECT t.tz INTO NEW.booking_tz
            FROM public.tenants t
            WHERE t.id = NEW.tenant_id;
            
            -- If still NULL, raise exception
            IF NEW.booking_tz IS NULL THEN
                RAISE EXCEPTION 'booking_tz is required but could not be resolved from resource or tenant';
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    
    -- Idempotency and offline support
    client_generated_id text NOT NULL,
    
    -- Service snapshot for audit/pricing (captured at booking time)
    service_snapshot jsonb NOT NULL DEFAULT '{}',
    
    -- Time and scheduling
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    booking_tz text NOT NULL, -- Filled by trigger; IANA timezone identifier
    
    -- Status and lifecycle
    status public.booking_status NOT NULL DEFAULT 'pending',
    canceled_at timestamptz,
    no_show_flag boolean NOT NULL DEFAULT false,
    
    -- Capacity and rescheduling
    attendee_count int NOT NULL DEFAULT 1,
    rescheduled_from uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    
    -- Standard timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create booking_items table for multi-resource and buffer support
CREATE TABLE IF NOT EXISTS public.booking_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    
    -- Service reference for pricing
    service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
    
    -- Time segment (may differ from booking start/end for multi-resource)
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    
    -- Buffer times (participate in overlap calculations)
    buffer_before_min int NOT NULL DEFAULT 0,
    buffer_after_min int NOT NULL DEFAULT 0,
    
    -- Pricing snapshot
    price_cents int NOT NULL DEFAULT 0,
    
    -- Standard timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency constraint: unique client_generated_id per tenant
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_idempotency_uniq'
    ) THEN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT bookings_idempotency_uniq 
        UNIQUE (tenant_id, client_generated_id);
    END IF;
END $$;

-- Time validation constraint: start_at < end_at for bookings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_time_order_chk'
    ) THEN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT bookings_time_order_chk 
        CHECK (start_at < end_at);
    END IF;
END $$;

-- Time validation constraint: start_at < end_at for booking_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_items_time_order_chk'
    ) THEN
        ALTER TABLE public.booking_items 
        ADD CONSTRAINT booking_items_time_order_chk 
        CHECK (start_at < end_at);
    END IF;
END $$;

-- Attendee count validation: must be positive
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bookings_attendee_count_positive_chk'
    ) THEN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT bookings_attendee_count_positive_chk 
        CHECK (attendee_count > 0);
    END IF;
END $$;

-- Buffer time validation: non-negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_items_buffer_nonneg_chk'
    ) THEN
        ALTER TABLE public.booking_items 
        ADD CONSTRAINT booking_items_buffer_nonneg_chk 
        CHECK (buffer_before_min >= 0 AND buffer_after_min >= 0);
    END IF;
END $$;

-- Price validation: non-negative
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'booking_items_price_nonneg_chk'
    ) THEN
        ALTER TABLE public.booking_items 
        ADD CONSTRAINT booking_items_price_nonneg_chk 
        CHECK (price_cents >= 0);
    END IF;
END $$;

-- No-overlap exclusion constraint for active booking statuses
-- Following Design Brief priority: includes 'completed' in active set
-- Only active statuses (pending, confirmed, checked_in, completed) participate in overlap prevention
-- Historical statuses (canceled, no_show, failed) do not block new bookings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'bookings_excl_resource_time'
        AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.bookings 
        ADD CONSTRAINT bookings_excl_resource_time 
        EXCLUDE USING gist (
            resource_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (status IN ('pending', 'confirmed', 'checked_in', 'completed') AND resource_id IS NOT NULL);
    END IF;
END $$;

-- Attach touch_updated_at trigger to bookings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'bookings_touch_updated_at'
    ) THEN
        CREATE TRIGGER bookings_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Attach touch_updated_at trigger to booking_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'booking_items_touch_updated_at'
    ) THEN
        CREATE TRIGGER booking_items_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.booking_items
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Attach status sync trigger to bookings (BEFORE INSERT/UPDATE)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'bookings_status_sync_biur'
    ) THEN
        CREATE TRIGGER bookings_status_sync_biur
            BEFORE INSERT OR UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.sync_booking_status();
    END IF;
END $$;

-- Attach timezone fill trigger to bookings (BEFORE INSERT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'bookings_fill_tz_bi'
    ) THEN
        CREATE TRIGGER bookings_fill_tz_bi
            BEFORE INSERT ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.fill_booking_tz();
    END IF;
END $$;

COMMIT;
