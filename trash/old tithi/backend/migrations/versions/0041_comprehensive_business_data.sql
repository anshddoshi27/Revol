BEGIN;

-- Migration: 0041_comprehensive_business_data.sql
-- Purpose: Add comprehensive business data structures for complete Tithi functionality
-- Date: 2025-01-27
-- Author: System
-- Note: This migration implements all missing data structures for the complete Tithi platform

-- ============================================================================
-- 1) TEAM MEMBERS & STAFF MANAGEMENT
-- ============================================================================

-- Team members table for business staff
CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid REFERENCES public.users(id), -- Optional: if staff has user account
    name text NOT NULL,
    email text,
    phone text,
    role text NOT NULL DEFAULT 'staff', -- owner, admin, staff
    bio text,
    avatar_url text,
    specialties text[], -- Array of specialties
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Team member availability (replaces generic availability)
CREATE TABLE IF NOT EXISTS public.team_member_availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    team_member_id uuid NOT NULL REFERENCES public.team_members(id),
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Team member service assignments
CREATE TABLE IF NOT EXISTS public.team_member_services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    team_member_id uuid NOT NULL REFERENCES public.team_members(id),
    service_id uuid NOT NULL REFERENCES public.services(id),
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2) SERVICE CATEGORIES & ORGANIZATION
-- ============================================================================

-- Service categories for better organization
CREATE TABLE IF NOT EXISTS public.service_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL,
    description text,
    color text, -- Hex color code
    sort_order integer DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- ============================================================================
-- 3) COMPREHENSIVE BUSINESS POLICIES
-- ============================================================================

-- Business policies table
CREATE TABLE IF NOT EXISTS public.business_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    policy_type text NOT NULL, -- cancellation, no_show, refund, cash_payment
    title text NOT NULL,
    content text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Policy constraints
ALTER TABLE public.business_policies 
ADD CONSTRAINT business_policies_type_check 
CHECK (policy_type IN ('cancellation', 'no_show', 'refund', 'cash_payment'));

-- ============================================================================
-- 4) GIFT CARDS & PROMOTIONS
-- ============================================================================

-- Gift cards table
CREATE TABLE IF NOT EXISTS public.gift_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    code text NOT NULL,
    amount_cents integer NOT NULL,
    balance_cents integer NOT NULL,
    expiry_date date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Gift card transactions
CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id),
    booking_id uuid REFERENCES public.bookings(id),
    transaction_type text NOT NULL, -- purchase, redemption, refund
    amount_cents integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Coupons and promotions
CREATE TABLE IF NOT EXISTS public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    code text NOT NULL,
    discount_type text NOT NULL, -- percentage, fixed_amount
    discount_value numeric(10,2) NOT NULL,
    min_amount_cents integer DEFAULT 0,
    max_discount_cents integer,
    usage_limit integer,
    used_count integer DEFAULT 0,
    expiry_date date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5) NOTIFICATION SYSTEM ENHANCEMENT
-- ============================================================================

-- Notification templates with placeholders
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    name text NOT NULL,
    channel text NOT NULL, -- email, sms, push
    category text NOT NULL, -- confirmation, reminder, follow_up, cancellation, reschedule
    trigger_event text NOT NULL, -- booking_created, booking_confirmed, 24h_reminder, 1h_reminder, etc.
    subject text, -- For email
    content text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Available placeholders for templates
CREATE TABLE IF NOT EXISTS public.notification_placeholders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    template_id uuid NOT NULL REFERENCES public.notification_templates(id),
    placeholder_name text NOT NULL, -- customer_name, service_name, booking_date, etc.
    placeholder_value text, -- The actual value when notification is sent
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6) COMPREHENSIVE BOOKING FLOW SUPPORT
-- ============================================================================

-- Booking flow steps tracking
CREATE TABLE IF NOT EXISTS public.booking_flow_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    step_name text NOT NULL,
    step_order integer NOT NULL,
    is_enabled boolean NOT NULL DEFAULT true,
    configuration jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Customer booking preferences
CREATE TABLE IF NOT EXISTS public.customer_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    preferred_team_member_id uuid REFERENCES public.team_members(id),
    preferred_services uuid[], -- Array of service IDs
    communication_preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7) ANALYTICS & TRACKING INFRASTRUCTURE
-- ============================================================================

-- Business metrics tracking
CREATE TABLE IF NOT EXISTS public.business_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    metric_name text NOT NULL,
    metric_value numeric(15,2) NOT NULL,
    metric_date date NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer analytics
CREATE TABLE IF NOT EXISTS public.customer_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    customer_id uuid NOT NULL REFERENCES public.customers(id),
    total_bookings integer DEFAULT 0,
    total_spent_cents integer DEFAULT 0,
    last_booking_date date,
    lifetime_value_cents integer DEFAULT 0,
    retention_score numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8) ADMIN DASHBOARD SUPPORT
-- ============================================================================

-- Admin dashboard widgets configuration
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    widget_type text NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    configuration jsonb DEFAULT '{}'::jsonb,
    is_visible boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9) INDEXES FOR PERFORMANCE
-- ============================================================================

-- Team members indexes
CREATE INDEX IF NOT EXISTS team_members_tenant_id_idx ON public.team_members(tenant_id);
CREATE INDEX IF NOT EXISTS team_members_email_idx ON public.team_members(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_members_active_idx ON public.team_members(tenant_id, is_active) WHERE deleted_at IS NULL;

-- Availability indexes
CREATE INDEX IF NOT EXISTS team_member_availability_tenant_member_idx ON public.team_member_availability(tenant_id, team_member_id);
CREATE INDEX IF NOT EXISTS team_member_availability_day_idx ON public.team_member_availability(day_of_week, is_available);

-- Service categories indexes
CREATE INDEX IF NOT EXISTS service_categories_tenant_id_idx ON public.service_categories(tenant_id);
CREATE INDEX IF NOT EXISTS service_categories_active_idx ON public.service_categories(tenant_id, is_active) WHERE deleted_at IS NULL;

-- Gift cards indexes
CREATE INDEX IF NOT EXISTS gift_cards_tenant_id_idx ON public.gift_cards(tenant_id);
CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON public.gift_cards(code);
CREATE INDEX IF NOT EXISTS gift_cards_active_idx ON public.gift_cards(tenant_id, is_active);

-- Coupons indexes
CREATE INDEX IF NOT EXISTS coupons_tenant_id_idx ON public.coupons(tenant_id);
CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons(code);
CREATE INDEX IF NOT EXISTS coupons_active_idx ON public.coupons(tenant_id, is_active);

-- Notification templates indexes
CREATE INDEX IF NOT EXISTS notification_templates_tenant_id_idx ON public.notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS notification_templates_trigger_idx ON public.notification_templates(tenant_id, trigger_event, is_active);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS business_metrics_tenant_date_idx ON public.business_metrics(tenant_id, metric_date);
CREATE INDEX IF NOT EXISTS customer_analytics_tenant_customer_idx ON public.customer_analytics(tenant_id, customer_id);

-- ============================================================================
-- 10) CONSTRAINTS AND VALIDATIONS
-- ============================================================================

-- Team member role constraint
ALTER TABLE public.team_members 
ADD CONSTRAINT team_members_role_check 
CHECK (role IN ('owner', 'admin', 'staff'));

-- Availability time constraint
ALTER TABLE public.team_member_availability 
ADD CONSTRAINT team_member_availability_time_check 
CHECK (end_time > start_time);

-- Gift card amount constraint
ALTER TABLE public.gift_cards 
ADD CONSTRAINT gift_cards_amount_check 
CHECK (amount_cents > 0 AND balance_cents >= 0 AND balance_cents <= amount_cents);

-- Coupon discount constraint
ALTER TABLE public.coupons 
ADD CONSTRAINT coupons_discount_check 
CHECK (discount_value > 0);

-- Notification channel constraint
ALTER TABLE public.notification_templates 
ADD CONSTRAINT notification_templates_channel_check 
CHECK (channel IN ('email', 'sms', 'push'));

-- Notification category constraint
ALTER TABLE public.notification_templates 
ADD CONSTRAINT notification_templates_category_check 
CHECK (category IN ('confirmation', 'reminder', 'follow_up', 'cancellation', 'reschedule'));

-- ============================================================================
-- 11) TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Add updated_at triggers for all new tables
DO $$
BEGIN
    -- Team members
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'team_members_updated_at_trigger') THEN
        CREATE TRIGGER team_members_updated_at_trigger
            BEFORE UPDATE ON public.team_members
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Team member availability
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'team_member_availability_updated_at_trigger') THEN
        CREATE TRIGGER team_member_availability_updated_at_trigger
            BEFORE UPDATE ON public.team_member_availability
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Service categories
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'service_categories_updated_at_trigger') THEN
        CREATE TRIGGER service_categories_updated_at_trigger
            BEFORE UPDATE ON public.service_categories
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Business policies
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'business_policies_updated_at_trigger') THEN
        CREATE TRIGGER business_policies_updated_at_trigger
            BEFORE UPDATE ON public.business_policies
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Gift cards
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gift_cards_updated_at_trigger') THEN
        CREATE TRIGGER gift_cards_updated_at_trigger
            BEFORE UPDATE ON public.gift_cards
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Coupons
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coupons_updated_at_trigger') THEN
        CREATE TRIGGER coupons_updated_at_trigger
            BEFORE UPDATE ON public.coupons
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Notification templates
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notification_templates_updated_at_trigger') THEN
        CREATE TRIGGER notification_templates_updated_at_trigger
            BEFORE UPDATE ON public.notification_templates
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Booking flow steps
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'booking_flow_steps_updated_at_trigger') THEN
        CREATE TRIGGER booking_flow_steps_updated_at_trigger
            BEFORE UPDATE ON public.booking_flow_steps
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Customer preferences
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_preferences_updated_at_trigger') THEN
        CREATE TRIGGER customer_preferences_updated_at_trigger
            BEFORE UPDATE ON public.customer_preferences
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Customer analytics
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'customer_analytics_updated_at_trigger') THEN
        CREATE TRIGGER customer_analytics_updated_at_trigger
            BEFORE UPDATE ON public.customer_analytics
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;

    -- Dashboard widgets
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dashboard_widgets_updated_at_trigger') THEN
        CREATE TRIGGER dashboard_widgets_updated_at_trigger
            BEFORE UPDATE ON public.dashboard_widgets
            FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END$$;

-- ============================================================================
-- 12) ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_placeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
DO $$
BEGIN
    -- Team members policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'team_members' AND policyname = 'team_members_tenant_isolation') THEN
        CREATE POLICY team_members_tenant_isolation ON public.team_members
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Team member availability policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'team_member_availability' AND policyname = 'team_member_availability_tenant_isolation') THEN
        CREATE POLICY team_member_availability_tenant_isolation ON public.team_member_availability
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Team member services policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'team_member_services' AND policyname = 'team_member_services_tenant_isolation') THEN
        CREATE POLICY team_member_services_tenant_isolation ON public.team_member_services
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Service categories policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'service_categories' AND policyname = 'service_categories_tenant_isolation') THEN
        CREATE POLICY service_categories_tenant_isolation ON public.service_categories
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Business policies policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'business_policies' AND policyname = 'business_policies_tenant_isolation') THEN
        CREATE POLICY business_policies_tenant_isolation ON public.business_policies
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Gift cards policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'gift_cards' AND policyname = 'gift_cards_tenant_isolation') THEN
        CREATE POLICY gift_cards_tenant_isolation ON public.gift_cards
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Gift card transactions policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'gift_card_transactions' AND policyname = 'gift_card_transactions_tenant_isolation') THEN
        CREATE POLICY gift_card_transactions_tenant_isolation ON public.gift_card_transactions
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Coupons policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'coupons' AND policyname = 'coupons_tenant_isolation') THEN
        CREATE POLICY coupons_tenant_isolation ON public.coupons
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Notification templates policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'notification_templates' AND policyname = 'notification_templates_tenant_isolation') THEN
        CREATE POLICY notification_templates_tenant_isolation ON public.notification_templates
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Notification placeholders policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'notification_placeholders' AND policyname = 'notification_placeholders_tenant_isolation') THEN
        CREATE POLICY notification_placeholders_tenant_isolation ON public.notification_placeholders
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Booking flow steps policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'booking_flow_steps' AND policyname = 'booking_flow_steps_tenant_isolation') THEN
        CREATE POLICY booking_flow_steps_tenant_isolation ON public.booking_flow_steps
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Customer preferences policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'customer_preferences' AND policyname = 'customer_preferences_tenant_isolation') THEN
        CREATE POLICY customer_preferences_tenant_isolation ON public.customer_preferences
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Business metrics policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'business_metrics' AND policyname = 'business_metrics_tenant_isolation') THEN
        CREATE POLICY business_metrics_tenant_isolation ON public.business_metrics
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Customer analytics policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'customer_analytics' AND policyname = 'customer_analytics_tenant_isolation') THEN
        CREATE POLICY customer_analytics_tenant_isolation ON public.customer_analytics
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;

    -- Dashboard widgets policies
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE tablename = 'dashboard_widgets' AND policyname = 'dashboard_widgets_tenant_isolation') THEN
        CREATE POLICY dashboard_widgets_tenant_isolation ON public.dashboard_widgets
            FOR ALL TO authenticated
            USING (tenant_id IN (
                SELECT tenant_id FROM public.memberships 
                WHERE user_id = auth.uid()
            ));
    END IF;
END$$;

COMMIT;


