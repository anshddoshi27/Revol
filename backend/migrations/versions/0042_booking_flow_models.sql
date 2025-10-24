BEGIN;

-- Migration: 0042_booking_flow_models.sql
-- Purpose: Add comprehensive booking flow models for the Tithi platform
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Create booking sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id text NOT NULL UNIQUE,
    current_step text NOT NULL DEFAULT 'service_selection',
    customer_email text,
    customer_phone text,
    customer_first_name text,
    customer_last_name text,
    selected_service_id uuid REFERENCES public.services(id),
    selected_team_member_id uuid REFERENCES public.team_members(id),
    selected_start_time timestamptz,
    selected_end_time timestamptz,
    flow_data jsonb DEFAULT '{}',
    special_requests text,
    started_at timestamptz NOT NULL DEFAULT now(),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT booking_sessions_current_step_check 
        CHECK (current_step IN ('service_selection', 'time_selection', 'customer_info', 'payment', 'confirmation')),
    CONSTRAINT booking_sessions_expires_after_started 
        CHECK (expires_at > started_at),
    CONSTRAINT booking_sessions_time_order 
        CHECK (selected_start_time IS NULL OR selected_end_time IS NULL OR selected_end_time > selected_start_time)
);

-- ============================================================================
-- 2) Create service displays
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_displays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    show_in_booking_flow boolean NOT NULL DEFAULT true,
    display_order integer DEFAULT 0,
    featured boolean NOT NULL DEFAULT false,
    display_name text,
    short_description text,
    display_image_url text,
    requires_team_member_selection boolean NOT NULL DEFAULT true,
    allow_group_booking boolean NOT NULL DEFAULT false,
    max_group_size integer DEFAULT 1,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT service_displays_display_order_check 
        CHECK (display_order >= 0),
    CONSTRAINT service_displays_max_group_size_check 
        CHECK (max_group_size > 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, service_id)
);

-- ============================================================================
-- 3) Create availability slots
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.availability_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    is_booked boolean NOT NULL DEFAULT false,
    booking_id uuid REFERENCES public.bookings(id),
    max_bookings integer DEFAULT 1,
    current_bookings integer DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT availability_slots_time_order 
        CHECK (end_time > start_time),
    CONSTRAINT availability_slots_max_bookings_check 
        CHECK (max_bookings > 0),
    CONSTRAINT availability_slots_current_bookings_check 
        CHECK (current_bookings >= 0),
    CONSTRAINT availability_slots_current_lte_max 
        CHECK (current_bookings <= max_bookings),
    CONSTRAINT availability_slots_booking_consistency 
        CHECK ((is_booked = false AND booking_id IS NULL) OR (is_booked = true AND booking_id IS NOT NULL))
);

-- ============================================================================
-- 4) Create customer booking profiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_booking_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email text NOT NULL,
    phone text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    marketing_opt_in boolean NOT NULL DEFAULT false,
    sms_opt_in boolean NOT NULL DEFAULT false,
    email_opt_in boolean NOT NULL DEFAULT true,
    date_of_birth timestamptz,
    gender text,
    address_json jsonb DEFAULT '{}',
    preferences_json jsonb DEFAULT '{}',
    total_bookings integer DEFAULT 0,
    first_booking_at timestamptz,
    last_booking_at timestamptz,
    is_verified boolean NOT NULL DEFAULT false,
    verification_token text,
    verified_at timestamptz,
    metadata_json jsonb DEFAULT '{}',
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT customer_booking_profiles_total_bookings_check 
        CHECK (total_bookings >= 0),
    CONSTRAINT customer_booking_profiles_gender_check 
        CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    
    -- Unique constraint
    UNIQUE (tenant_id, email)
);

-- ============================================================================
-- 5) Create booking flow analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_flow_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    period_type text NOT NULL,
    sessions_started integer DEFAULT 0,
    sessions_completed integer DEFAULT 0,
    sessions_abandoned integer DEFAULT 0,
    service_selection_completed integer DEFAULT 0,
    time_selection_completed integer DEFAULT 0,
    customer_info_completed integer DEFAULT 0,
    payment_completed integer DEFAULT 0,
    confirmation_completed integer DEFAULT 0,
    conversion_rate numeric(5,2) DEFAULT 0.00,
    average_session_duration_minutes integer DEFAULT 0,
    most_popular_service_id uuid REFERENCES public.services(id),
    most_popular_team_member_id uuid REFERENCES public.team_members(id),
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT booking_flow_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    CONSTRAINT booking_flow_analytics_sessions_started_check 
        CHECK (sessions_started >= 0),
    CONSTRAINT booking_flow_analytics_sessions_completed_check 
        CHECK (sessions_completed >= 0),
    CONSTRAINT booking_flow_analytics_sessions_abandoned_check 
        CHECK (sessions_abandoned >= 0),
    CONSTRAINT booking_flow_analytics_conversion_rate_check 
        CHECK (conversion_rate >= 0 AND conversion_rate <= 100),
    CONSTRAINT booking_flow_analytics_duration_check 
        CHECK (average_session_duration_minutes >= 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type)
);

-- ============================================================================
-- 6) Create booking flow configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_flow_configurations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    require_customer_info boolean NOT NULL DEFAULT true,
    require_payment boolean NOT NULL DEFAULT true,
    allow_guest_booking boolean NOT NULL DEFAULT false,
    show_service_images boolean NOT NULL DEFAULT true,
    show_team_member_photos boolean NOT NULL DEFAULT true,
    show_pricing boolean NOT NULL DEFAULT true,
    allow_same_day_booking boolean NOT NULL DEFAULT true,
    minimum_advance_booking_hours integer DEFAULT 2,
    maximum_advance_booking_days integer DEFAULT 90,
    session_timeout_minutes integer DEFAULT 30,
    allow_session_extension boolean NOT NULL DEFAULT true,
    send_booking_confirmation boolean NOT NULL DEFAULT true,
    send_reminder_notifications boolean NOT NULL DEFAULT true,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT booking_flow_configurations_min_advance_check 
        CHECK (minimum_advance_booking_hours >= 0),
    CONSTRAINT booking_flow_configurations_max_advance_check 
        CHECK (maximum_advance_booking_days > 0),
    CONSTRAINT booking_flow_configurations_session_timeout_check 
        CHECK (session_timeout_minutes > 0),
    
    -- Unique constraint
    UNIQUE (tenant_id)
);

-- ============================================================================
-- 7) Add indexes for performance
-- ============================================================================

-- Booking sessions indexes
CREATE INDEX IF NOT EXISTS booking_sessions_tenant_idx ON public.booking_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS booking_sessions_session_id_idx ON public.booking_sessions (session_id);
CREATE INDEX IF NOT EXISTS booking_sessions_current_step_idx ON public.booking_sessions (current_step);
CREATE INDEX IF NOT EXISTS booking_sessions_expires_at_idx ON public.booking_sessions (expires_at);
CREATE INDEX IF NOT EXISTS booking_sessions_is_completed_idx ON public.booking_sessions (is_completed);

-- Service displays indexes
CREATE INDEX IF NOT EXISTS service_displays_tenant_idx ON public.service_displays (tenant_id);
CREATE INDEX IF NOT EXISTS service_displays_service_idx ON public.service_displays (service_id);
CREATE INDEX IF NOT EXISTS service_displays_show_in_flow_idx ON public.service_displays (show_in_booking_flow);
CREATE INDEX IF NOT EXISTS service_displays_featured_idx ON public.service_displays (featured);
CREATE INDEX IF NOT EXISTS service_displays_display_order_idx ON public.service_displays (display_order);

-- Availability slots indexes
CREATE INDEX IF NOT EXISTS availability_slots_tenant_idx ON public.availability_slots (tenant_id);
CREATE INDEX IF NOT EXISTS availability_slots_service_idx ON public.availability_slots (service_id);
CREATE INDEX IF NOT EXISTS availability_slots_team_member_idx ON public.availability_slots (team_member_id);
CREATE INDEX IF NOT EXISTS availability_slots_date_idx ON public.availability_slots (date);
CREATE INDEX IF NOT EXISTS availability_slots_start_time_idx ON public.availability_slots (start_time);
CREATE INDEX IF NOT EXISTS availability_slots_is_available_idx ON public.availability_slots (is_available);
CREATE INDEX IF NOT EXISTS availability_slots_is_booked_idx ON public.availability_slots (is_booked);

-- Customer booking profiles indexes
CREATE INDEX IF NOT EXISTS customer_booking_profiles_tenant_idx ON public.customer_booking_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS customer_booking_profiles_email_idx ON public.customer_booking_profiles (email);
CREATE INDEX IF NOT EXISTS customer_booking_profiles_phone_idx ON public.customer_booking_profiles (phone);
CREATE INDEX IF NOT EXISTS customer_booking_profiles_is_verified_idx ON public.customer_booking_profiles (is_verified);

-- Booking flow analytics indexes
CREATE INDEX IF NOT EXISTS booking_flow_analytics_tenant_idx ON public.booking_flow_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS booking_flow_analytics_date_idx ON public.booking_flow_analytics (date);
CREATE INDEX IF NOT EXISTS booking_flow_analytics_period_type_idx ON public.booking_flow_analytics (period_type);

-- Booking flow configurations indexes
CREATE INDEX IF NOT EXISTS booking_flow_configurations_tenant_idx ON public.booking_flow_configurations (tenant_id);

-- ============================================================================
-- 8) Add comments for documentation
-- ============================================================================

COMMENT ON TABLE public.booking_sessions IS 'Tracks customer booking sessions through the flow';
COMMENT ON TABLE public.service_displays IS 'Service display configuration for booking flow';
COMMENT ON TABLE public.availability_slots IS 'Available time slots for booking';
COMMENT ON TABLE public.customer_booking_profiles IS 'Customer profiles created during booking flow';
COMMENT ON TABLE public.booking_flow_analytics IS 'Analytics for booking flow performance';
COMMENT ON TABLE public.booking_flow_configurations IS 'Configuration for booking flow behavior';

COMMIT;
