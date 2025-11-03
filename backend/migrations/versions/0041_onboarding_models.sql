BEGIN;

-- Migration: 0041_onboarding_models.sql
-- Purpose: Add comprehensive onboarding models for the Tithi platform
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Create onboarding progress tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    current_step text NOT NULL DEFAULT 'business_info',
    completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    step_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT onboarding_progress_current_step_check 
        CHECK (current_step IN ('business_info', 'team_setup', 'services_categories', 'availability', 'notifications', 'policies', 'gift_cards', 'payment_setup', 'go_live')),
    CONSTRAINT onboarding_progress_completed_after_started 
        CHECK (completed_at IS NULL OR completed_at >= started_at),
    CONSTRAINT onboarding_progress_activity_after_started 
        CHECK (last_activity_at >= started_at),
    
    -- Unique constraint
    UNIQUE (tenant_id)
);

-- ============================================================================
-- 2) Create service categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    color text,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    metadata_json jsonb DEFAULT '{}',
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT service_categories_color_hex_check 
        CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT service_categories_sort_order_non_negative 
        CHECK (sort_order >= 0)
);

-- ============================================================================
-- 3) Create enhanced team members
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    role text NOT NULL,
    bio text,
    specialties jsonb DEFAULT '[]'::jsonb,
    hourly_rate_cents integer,
    is_active boolean NOT NULL DEFAULT true,
    permissions_json jsonb DEFAULT '{}',
    profile_image_url text,
    display_name text,
    max_concurrent_bookings integer DEFAULT 1,
    buffer_time_minutes integer DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT team_members_rate_non_negative 
        CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents >= 0),
    CONSTRAINT team_members_max_bookings_positive 
        CHECK (max_concurrent_bookings > 0),
    CONSTRAINT team_members_buffer_non_negative 
        CHECK (buffer_time_minutes >= 0),
    CONSTRAINT team_members_role_check 
        CHECK (role IN ('owner', 'admin', 'staff'))
);

-- ============================================================================
-- 4) Create team member availability
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_member_availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    max_bookings integer DEFAULT 1,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT team_member_availability_day_of_week_check 
        CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT team_member_availability_start_time_format 
        CHECK (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
    CONSTRAINT team_member_availability_end_time_format 
        CHECK (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
    CONSTRAINT team_member_availability_max_bookings_positive 
        CHECK (max_bookings > 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, team_member_id, service_id, day_of_week, start_time)
);

-- ============================================================================
-- 5) Create service team assignments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.service_team_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    is_primary boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint
    UNIQUE (tenant_id, service_id, team_member_id)
);

-- ============================================================================
-- 6) Create business branding
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_branding (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    primary_color text,
    secondary_color text,
    accent_color text,
    logo_url text,
    favicon_url text,
    font_family text,
    font_size text,
    font_weight text,
    layout_style text DEFAULT 'modern',
    button_style text DEFAULT 'rounded',
    color_scheme text DEFAULT 'light',
    custom_css text,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT business_branding_primary_color_hex 
        CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT business_branding_secondary_color_hex 
        CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT business_branding_accent_color_hex 
        CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT business_branding_layout_style_check 
        CHECK (layout_style IN ('modern', 'classic', 'minimal')),
    CONSTRAINT business_branding_button_style_check 
        CHECK (button_style IN ('rounded', 'square', 'pill')),
    CONSTRAINT business_branding_color_scheme_check 
        CHECK (color_scheme IN ('light', 'dark', 'auto')),
    
    -- Unique constraint
    UNIQUE (tenant_id)
);

-- ============================================================================
-- 7) Create business policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.business_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cancellation_policy text,
    no_show_policy text,
    no_show_fee_percent numeric(5,2) DEFAULT 3.00,
    no_show_fee_flat_cents integer,
    refund_policy text,
    cash_payment_policy text,
    cancellation_hours_required integer DEFAULT 24,
    no_show_fee_type text DEFAULT 'percentage',
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT business_policies_no_show_fee_percent_check 
        CHECK (no_show_fee_percent IS NULL OR (no_show_fee_percent >= 0 AND no_show_fee_percent <= 100)),
    CONSTRAINT business_policies_no_show_fee_flat_check 
        CHECK (no_show_fee_flat_cents IS NULL OR no_show_fee_flat_cents >= 0),
    CONSTRAINT business_policies_cancellation_hours_check 
        CHECK (cancellation_hours_required >= 0),
    CONSTRAINT business_policies_no_show_fee_type_check 
        CHECK (no_show_fee_type IN ('percentage', 'flat')),
    
    -- Unique constraint
    UNIQUE (tenant_id)
);

-- ============================================================================
-- 8) Create gift card templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gift_card_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    amount_cents integer,
    percentage_discount integer,
    is_percentage boolean NOT NULL DEFAULT false,
    expires_days integer DEFAULT 365,
    is_active boolean NOT NULL DEFAULT true,
    usage_limit integer,
    usage_count integer NOT NULL DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT gift_card_templates_amount_check 
        CHECK (amount_cents IS NULL OR amount_cents > 0),
    CONSTRAINT gift_card_templates_percentage_check 
        CHECK (percentage_discount IS NULL OR (percentage_discount BETWEEN 1 AND 100)),
    CONSTRAINT gift_card_templates_discount_type_check 
        CHECK ((is_percentage = true AND percentage_discount IS NOT NULL AND amount_cents IS NULL) OR 
               (is_percentage = false AND amount_cents IS NOT NULL AND percentage_discount IS NULL)),
    CONSTRAINT gift_card_templates_expires_days_check 
        CHECK (expires_days > 0),
    CONSTRAINT gift_card_templates_usage_limit_check 
        CHECK (usage_limit IS NULL OR usage_limit > 0),
    CONSTRAINT gift_card_templates_usage_count_check 
        CHECK (usage_count >= 0)
);

-- ============================================================================
-- 9) Create onboarding checklist
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_checklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_name text NOT NULL,
    description text,
    step text NOT NULL,
    is_completed boolean NOT NULL DEFAULT false,
    completed_at timestamptz,
    completed_by uuid REFERENCES public.users(id),
    priority integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT onboarding_checklist_step_check 
        CHECK (step IN ('business_info', 'team_setup', 'services_categories', 'availability', 'notifications', 'policies', 'gift_cards', 'payment_setup', 'go_live')),
    CONSTRAINT onboarding_checklist_priority_check 
        CHECK (priority >= 0),
    CONSTRAINT onboarding_checklist_sort_order_check 
        CHECK (sort_order >= 0)
);

-- ============================================================================
-- 10) Add indexes for performance
-- ============================================================================

-- Onboarding progress indexes
CREATE INDEX IF NOT EXISTS onboarding_progress_tenant_idx ON public.onboarding_progress (tenant_id);
CREATE INDEX IF NOT EXISTS onboarding_progress_current_step_idx ON public.onboarding_progress (current_step);
CREATE INDEX IF NOT EXISTS onboarding_progress_last_activity_idx ON public.onboarding_progress (last_activity_at);

-- Service categories indexes
CREATE INDEX IF NOT EXISTS service_categories_tenant_idx ON public.service_categories (tenant_id);
CREATE INDEX IF NOT EXISTS service_categories_active_idx ON public.service_categories (is_active);
CREATE INDEX IF NOT EXISTS service_categories_sort_order_idx ON public.service_categories (sort_order);

-- Team members indexes
CREATE INDEX IF NOT EXISTS team_members_tenant_idx ON public.team_members (tenant_id);
CREATE INDEX IF NOT EXISTS team_members_email_idx ON public.team_members (email);
CREATE INDEX IF NOT EXISTS team_members_active_idx ON public.team_members (is_active);
CREATE INDEX IF NOT EXISTS team_members_role_idx ON public.team_members (role);

-- Team member availability indexes
CREATE INDEX IF NOT EXISTS team_member_availability_tenant_idx ON public.team_member_availability (tenant_id);
CREATE INDEX IF NOT EXISTS team_member_availability_team_member_idx ON public.team_member_availability (team_member_id);
CREATE INDEX IF NOT EXISTS team_member_availability_service_idx ON public.team_member_availability (service_id);
CREATE INDEX IF NOT EXISTS team_member_availability_day_idx ON public.team_member_availability (day_of_week);

-- Service team assignments indexes
CREATE INDEX IF NOT EXISTS service_team_assignments_tenant_idx ON public.service_team_assignments (tenant_id);
CREATE INDEX IF NOT EXISTS service_team_assignments_service_idx ON public.service_team_assignments (service_id);
CREATE INDEX IF NOT EXISTS service_team_assignments_team_member_idx ON public.service_team_assignments (team_member_id);

-- Business branding indexes
CREATE INDEX IF NOT EXISTS business_branding_tenant_idx ON public.business_branding (tenant_id);

-- Business policies indexes
CREATE INDEX IF NOT EXISTS business_policies_tenant_idx ON public.business_policies (tenant_id);

-- Gift card templates indexes
CREATE INDEX IF NOT EXISTS gift_card_templates_tenant_idx ON public.gift_card_templates (tenant_id);
CREATE INDEX IF NOT EXISTS gift_card_templates_active_idx ON public.gift_card_templates (is_active);

-- Onboarding checklist indexes
CREATE INDEX IF NOT EXISTS onboarding_checklist_tenant_idx ON public.onboarding_checklist (tenant_id);
CREATE INDEX IF NOT EXISTS onboarding_checklist_step_idx ON public.onboarding_checklist (step);
CREATE INDEX IF NOT EXISTS onboarding_checklist_completed_idx ON public.onboarding_checklist (is_completed);

-- ============================================================================
-- 11) Add comments for documentation
-- ============================================================================

COMMENT ON TABLE public.onboarding_progress IS 'Tracks onboarding progress for each tenant';
COMMENT ON TABLE public.service_categories IS 'Service categories for organizing services';
COMMENT ON TABLE public.team_members IS 'Enhanced team member management';
COMMENT ON TABLE public.team_member_availability IS 'Team member availability for specific services';
COMMENT ON TABLE public.service_team_assignments IS 'Assignment of team members to services';
COMMENT ON TABLE public.business_branding IS 'Business branding and customization settings';
COMMENT ON TABLE public.business_policies IS 'Business policies and terms';
COMMENT ON TABLE public.gift_card_templates IS 'Gift card templates for creating gift cards';
COMMENT ON TABLE public.onboarding_checklist IS 'Onboarding checklist items for tracking completion';

COMMIT;


