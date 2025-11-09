BEGIN;

-- Migration: 0043_analytics_models.sql
-- Purpose: Add comprehensive analytics models for business intelligence
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Create revenue analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.revenue_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date NOT NULL,
    period_type text NOT NULL,
    total_revenue_cents integer DEFAULT 0,
    gross_revenue_cents integer DEFAULT 0,
    net_revenue_cents integer DEFAULT 0,
    refunded_amount_cents integer DEFAULT 0,
    total_transactions integer DEFAULT 0,
    successful_transactions integer DEFAULT 0,
    failed_transactions integer DEFAULT 0,
    refunded_transactions integer DEFAULT 0,
    card_payments_cents integer DEFAULT 0,
    cash_payments_cents integer DEFAULT 0,
    gift_card_payments_cents integer DEFAULT 0,
    other_payments_cents integer DEFAULT 0,
    service_revenue_json jsonb DEFAULT '{}',
    category_revenue_json jsonb DEFAULT '{}',
    team_member_revenue_json jsonb DEFAULT '{}',
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT revenue_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT revenue_analytics_total_revenue_check 
        CHECK (total_revenue_cents >= 0),
    CONSTRAINT revenue_analytics_gross_revenue_check 
        CHECK (gross_revenue_cents >= 0),
    CONSTRAINT revenue_analytics_net_revenue_check 
        CHECK (net_revenue_cents >= 0),
    CONSTRAINT revenue_analytics_refunded_amount_check 
        CHECK (refunded_amount_cents >= 0),
    CONSTRAINT revenue_analytics_total_transactions_check 
        CHECK (total_transactions >= 0),
    CONSTRAINT revenue_analytics_successful_transactions_check 
        CHECK (successful_transactions >= 0),
    CONSTRAINT revenue_analytics_failed_transactions_check 
        CHECK (failed_transactions >= 0),
    CONSTRAINT revenue_analytics_refunded_transactions_check 
        CHECK (refunded_transactions >= 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type)
);

-- ============================================================================
-- 2) Create customer analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date NOT NULL,
    period_type text NOT NULL,
    total_customers integer DEFAULT 0,
    new_customers integer DEFAULT 0,
    returning_customers integer DEFAULT 0,
    active_customers integer DEFAULT 0,
    churned_customers integer DEFAULT 0,
    average_bookings_per_customer numeric(5,2) DEFAULT 0.00,
    average_spend_per_customer_cents integer DEFAULT 0,
    customer_lifetime_value_cents integer DEFAULT 0,
    retention_rate_30_days numeric(5,2) DEFAULT 0.00,
    retention_rate_60_days numeric(5,2) DEFAULT 0.00,
    retention_rate_90_days numeric(5,2) DEFAULT 0.00,
    first_time_customers integer DEFAULT 0,
    repeat_customers integer DEFAULT 0,
    vip_customers integer DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT customer_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT customer_analytics_total_customers_check 
        CHECK (total_customers >= 0),
    CONSTRAINT customer_analytics_new_customers_check 
        CHECK (new_customers >= 0),
    CONSTRAINT customer_analytics_returning_customers_check 
        CHECK (returning_customers >= 0),
    CONSTRAINT customer_analytics_active_customers_check 
        CHECK (active_customers >= 0),
    CONSTRAINT customer_analytics_churned_customers_check 
        CHECK (churned_customers >= 0),
    CONSTRAINT customer_analytics_avg_bookings_check 
        CHECK (average_bookings_per_customer >= 0),
    CONSTRAINT customer_analytics_avg_spend_check 
        CHECK (average_spend_per_customer_cents >= 0),
    CONSTRAINT customer_analytics_ltv_check 
        CHECK (customer_lifetime_value_cents >= 0),
    CONSTRAINT customer_analytics_retention_30_check 
        CHECK (retention_rate_30_days >= 0 AND retention_rate_30_days <= 100),
    CONSTRAINT customer_analytics_retention_60_check 
        CHECK (retention_rate_60_days >= 0 AND retention_rate_60_days <= 100),
    CONSTRAINT customer_analytics_retention_90_check 
        CHECK (retention_rate_90_days >= 0 AND retention_rate_90_days <= 100),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type)
);

-- ============================================================================
-- 3) Create booking analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date NOT NULL,
    period_type text NOT NULL,
    total_bookings integer DEFAULT 0,
    confirmed_bookings integer DEFAULT 0,
    canceled_bookings integer DEFAULT 0,
    no_show_bookings integer DEFAULT 0,
    completed_bookings integer DEFAULT 0,
    booking_conversion_rate numeric(5,2) DEFAULT 0.00,
    cancellation_rate numeric(5,2) DEFAULT 0.00,
    no_show_rate numeric(5,2) DEFAULT 0.00,
    completion_rate numeric(5,2) DEFAULT 0.00,
    average_advance_booking_days numeric(5,2) DEFAULT 0.00,
    average_booking_duration_minutes integer DEFAULT 0,
    peak_booking_hour integer,
    peak_booking_day integer,
    most_popular_service_id uuid REFERENCES public.services(id),
    least_popular_service_id uuid REFERENCES public.services(id),
    most_booked_team_member_id uuid REFERENCES public.team_members(id),
    least_booked_team_member_id uuid REFERENCES public.team_members(id),
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT booking_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT booking_analytics_total_bookings_check 
        CHECK (total_bookings >= 0),
    CONSTRAINT booking_analytics_confirmed_bookings_check 
        CHECK (confirmed_bookings >= 0),
    CONSTRAINT booking_analytics_canceled_bookings_check 
        CHECK (canceled_bookings >= 0),
    CONSTRAINT booking_analytics_no_show_bookings_check 
        CHECK (no_show_bookings >= 0),
    CONSTRAINT booking_analytics_completed_bookings_check 
        CHECK (completed_bookings >= 0),
    CONSTRAINT booking_analytics_conversion_rate_check 
        CHECK (booking_conversion_rate >= 0 AND booking_conversion_rate <= 100),
    CONSTRAINT booking_analytics_cancellation_rate_check 
        CHECK (cancellation_rate >= 0 AND cancellation_rate <= 100),
    CONSTRAINT booking_analytics_no_show_rate_check 
        CHECK (no_show_rate >= 0 AND no_show_rate <= 100),
    CONSTRAINT booking_analytics_completion_rate_check 
        CHECK (completion_rate >= 0 AND completion_rate <= 100),
    CONSTRAINT booking_analytics_advance_booking_check 
        CHECK (average_advance_booking_days >= 0),
    CONSTRAINT booking_analytics_duration_check 
        CHECK (average_booking_duration_minutes >= 0),
    CONSTRAINT booking_analytics_peak_hour_check 
        CHECK (peak_booking_hour IS NULL OR (peak_booking_hour >= 0 AND peak_booking_hour <= 23)),
    CONSTRAINT booking_analytics_peak_day_check 
        CHECK (peak_booking_day IS NULL OR (peak_booking_day >= 1 AND peak_booking_day <= 7)),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type)
);

-- ============================================================================
-- 4) Create staff performance analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_performance_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date NOT NULL,
    period_type text NOT NULL,
    team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    total_bookings integer DEFAULT 0,
    completed_bookings integer DEFAULT 0,
    canceled_bookings integer DEFAULT 0,
    no_show_bookings integer DEFAULT 0,
    total_revenue_cents integer DEFAULT 0,
    average_revenue_per_booking_cents integer DEFAULT 0,
    total_hours_worked numeric(5,2) DEFAULT 0.00,
    bookings_per_hour numeric(5,2) DEFAULT 0.00,
    revenue_per_hour_cents integer DEFAULT 0,
    unique_customers_served integer DEFAULT 0,
    repeat_customer_rate numeric(5,2) DEFAULT 0.00,
    customer_satisfaction_score numeric(3,2),
    total_available_hours numeric(5,2) DEFAULT 0.00,
    utilization_rate numeric(5,2) DEFAULT 0.00,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT staff_performance_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT staff_performance_analytics_total_bookings_check 
        CHECK (total_bookings >= 0),
    CONSTRAINT staff_performance_analytics_completed_bookings_check 
        CHECK (completed_bookings >= 0),
    CONSTRAINT staff_performance_analytics_canceled_bookings_check 
        CHECK (canceled_bookings >= 0),
    CONSTRAINT staff_performance_analytics_no_show_bookings_check 
        CHECK (no_show_bookings >= 0),
    CONSTRAINT staff_performance_analytics_total_revenue_check 
        CHECK (total_revenue_cents >= 0),
    CONSTRAINT staff_performance_analytics_avg_revenue_check 
        CHECK (average_revenue_per_booking_cents >= 0),
    CONSTRAINT staff_performance_analytics_hours_worked_check 
        CHECK (total_hours_worked >= 0),
    CONSTRAINT staff_performance_analytics_bookings_per_hour_check 
        CHECK (bookings_per_hour >= 0),
    CONSTRAINT staff_performance_analytics_revenue_per_hour_check 
        CHECK (revenue_per_hour_cents >= 0),
    CONSTRAINT staff_performance_analytics_unique_customers_check 
        CHECK (unique_customers_served >= 0),
    CONSTRAINT staff_performance_analytics_repeat_rate_check 
        CHECK (repeat_customer_rate >= 0 AND repeat_customer_rate <= 100),
    CONSTRAINT staff_performance_analytics_satisfaction_check 
        CHECK (customer_satisfaction_score IS NULL OR (customer_satisfaction_score >= 1.00 AND customer_satisfaction_score <= 5.00)),
    CONSTRAINT staff_performance_analytics_available_hours_check 
        CHECK (total_available_hours >= 0),
    CONSTRAINT staff_performance_analytics_utilization_check 
        CHECK (utilization_rate >= 0 AND utilization_rate <= 100),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type, team_member_id)
);

-- ============================================================================
-- 5) Create operational analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.operational_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date NOT NULL,
    period_type text NOT NULL,
    total_available_slots integer DEFAULT 0,
    booked_slots integer DEFAULT 0,
    available_slots integer DEFAULT 0,
    capacity_utilization_rate numeric(5,2) DEFAULT 0.00,
    average_wait_time_minutes integer DEFAULT 0,
    maximum_wait_time_minutes integer DEFAULT 0,
    customers_waiting integer DEFAULT 0,
    average_service_duration_minutes integer DEFAULT 0,
    average_setup_time_minutes integer DEFAULT 0,
    average_cleanup_time_minutes integer DEFAULT 0,
    equipment_utilization_rate numeric(5,2) DEFAULT 0.00,
    room_utilization_rate numeric(5,2) DEFAULT 0.00,
    customer_complaints integer DEFAULT 0,
    service_issues integer DEFAULT 0,
    quality_score numeric(3,2),
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT operational_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT operational_analytics_total_slots_check 
        CHECK (total_available_slots >= 0),
    CONSTRAINT operational_analytics_booked_slots_check 
        CHECK (booked_slots >= 0),
    CONSTRAINT operational_analytics_available_slots_check 
        CHECK (available_slots >= 0),
    CONSTRAINT operational_analytics_capacity_rate_check 
        CHECK (capacity_utilization_rate >= 0 AND capacity_utilization_rate <= 100),
    CONSTRAINT operational_analytics_avg_wait_time_check 
        CHECK (average_wait_time_minutes >= 0),
    CONSTRAINT operational_analytics_max_wait_time_check 
        CHECK (maximum_wait_time_minutes >= 0),
    CONSTRAINT operational_analytics_customers_waiting_check 
        CHECK (customers_waiting >= 0),
    CONSTRAINT operational_analytics_service_duration_check 
        CHECK (average_service_duration_minutes >= 0),
    CONSTRAINT operational_analytics_setup_time_check 
        CHECK (average_setup_time_minutes >= 0),
    CONSTRAINT operational_analytics_cleanup_time_check 
        CHECK (average_cleanup_time_minutes >= 0),
    CONSTRAINT operational_analytics_equipment_rate_check 
        CHECK (equipment_utilization_rate >= 0 AND equipment_utilization_rate <= 100),
    CONSTRAINT operational_analytics_room_rate_check 
        CHECK (room_utilization_rate >= 0 AND room_utilization_rate <= 100),
    CONSTRAINT operational_analytics_complaints_check 
        CHECK (customer_complaints >= 0),
    CONSTRAINT operational_analytics_service_issues_check 
        CHECK (service_issues >= 0),
    CONSTRAINT operational_analytics_quality_score_check 
        CHECK (quality_score IS NULL OR (quality_score >= 1.00 AND quality_score <= 5.00)),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type)
);

-- ============================================================================
-- 6) Create marketing analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date date NOT NULL,
    period_type text NOT NULL,
    total_campaigns integer DEFAULT 0,
    active_campaigns integer DEFAULT 0,
    completed_campaigns integer DEFAULT 0,
    total_promotions_sent integer DEFAULT 0,
    promotions_opened integer DEFAULT 0,
    promotions_clicked integer DEFAULT 0,
    promotion_conversion_rate numeric(5,2) DEFAULT 0.00,
    total_referrals integer DEFAULT 0,
    successful_referrals integer DEFAULT 0,
    referral_conversion_rate numeric(5,2) DEFAULT 0.00,
    referral_revenue_cents integer DEFAULT 0,
    social_media_reach integer DEFAULT 0,
    social_media_engagement integer DEFAULT 0,
    social_media_conversions integer DEFAULT 0,
    emails_sent integer DEFAULT 0,
    emails_delivered integer DEFAULT 0,
    emails_opened integer DEFAULT 0,
    emails_clicked integer DEFAULT 0,
    email_unsubscribes integer DEFAULT 0,
    sms_sent integer DEFAULT 0,
    sms_delivered integer DEFAULT 0,
    sms_clicked integer DEFAULT 0,
    sms_unsubscribes integer DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT marketing_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    CONSTRAINT marketing_analytics_total_campaigns_check 
        CHECK (total_campaigns >= 0),
    CONSTRAINT marketing_analytics_active_campaigns_check 
        CHECK (active_campaigns >= 0),
    CONSTRAINT marketing_analytics_completed_campaigns_check 
        CHECK (completed_campaigns >= 0),
    CONSTRAINT marketing_analytics_promotions_sent_check 
        CHECK (total_promotions_sent >= 0),
    CONSTRAINT marketing_analytics_promotions_opened_check 
        CHECK (promotions_opened >= 0),
    CONSTRAINT marketing_analytics_promotions_clicked_check 
        CHECK (promotions_clicked >= 0),
    CONSTRAINT marketing_analytics_promotion_conversion_check 
        CHECK (promotion_conversion_rate >= 0 AND promotion_conversion_rate <= 100),
    CONSTRAINT marketing_analytics_total_referrals_check 
        CHECK (total_referrals >= 0),
    CONSTRAINT marketing_analytics_successful_referrals_check 
        CHECK (successful_referrals >= 0),
    CONSTRAINT marketing_analytics_referral_conversion_check 
        CHECK (referral_conversion_rate >= 0 AND referral_conversion_rate <= 100),
    CONSTRAINT marketing_analytics_referral_revenue_check 
        CHECK (referral_revenue_cents >= 0),
    CONSTRAINT marketing_analytics_social_reach_check 
        CHECK (social_media_reach >= 0),
    CONSTRAINT marketing_analytics_social_engagement_check 
        CHECK (social_media_engagement >= 0),
    CONSTRAINT marketing_analytics_social_conversions_check 
        CHECK (social_media_conversions >= 0),
    CONSTRAINT marketing_analytics_emails_sent_check 
        CHECK (emails_sent >= 0),
    CONSTRAINT marketing_analytics_emails_delivered_check 
        CHECK (emails_delivered >= 0),
    CONSTRAINT marketing_analytics_emails_opened_check 
        CHECK (emails_opened >= 0),
    CONSTRAINT marketing_analytics_emails_clicked_check 
        CHECK (emails_clicked >= 0),
    CONSTRAINT marketing_analytics_email_unsubscribes_check 
        CHECK (email_unsubscribes >= 0),
    CONSTRAINT marketing_analytics_sms_sent_check 
        CHECK (sms_sent >= 0),
    CONSTRAINT marketing_analytics_sms_delivered_check 
        CHECK (sms_delivered >= 0),
    CONSTRAINT marketing_analytics_sms_clicked_check 
        CHECK (sms_clicked >= 0),
    CONSTRAINT marketing_analytics_sms_unsubscribes_check 
        CHECK (sms_unsubscribes >= 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type)
);

-- ============================================================================
-- 7) Add indexes for performance
-- ============================================================================

-- Revenue analytics indexes
CREATE INDEX IF NOT EXISTS revenue_analytics_tenant_idx ON public.revenue_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS revenue_analytics_date_idx ON public.revenue_analytics (date);
CREATE INDEX IF NOT EXISTS revenue_analytics_period_type_idx ON public.revenue_analytics (period_type);

-- Customer analytics indexes
CREATE INDEX IF NOT EXISTS customer_analytics_tenant_idx ON public.customer_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS customer_analytics_date_idx ON public.customer_analytics (date);
CREATE INDEX IF NOT EXISTS customer_analytics_period_type_idx ON public.customer_analytics (period_type);

-- Booking analytics indexes
CREATE INDEX IF NOT EXISTS booking_analytics_tenant_idx ON public.booking_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS booking_analytics_date_idx ON public.booking_analytics (date);
CREATE INDEX IF NOT EXISTS booking_analytics_period_type_idx ON public.booking_analytics (period_type);

-- Staff performance analytics indexes
CREATE INDEX IF NOT EXISTS staff_performance_analytics_tenant_idx ON public.staff_performance_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS staff_performance_analytics_date_idx ON public.staff_performance_analytics (date);
CREATE INDEX IF NOT EXISTS staff_performance_analytics_period_type_idx ON public.staff_performance_analytics (period_type);
CREATE INDEX IF NOT EXISTS staff_performance_analytics_team_member_idx ON public.staff_performance_analytics (team_member_id);

-- Operational analytics indexes
CREATE INDEX IF NOT EXISTS operational_analytics_tenant_idx ON public.operational_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS operational_analytics_date_idx ON public.operational_analytics (date);
CREATE INDEX IF NOT EXISTS operational_analytics_period_type_idx ON public.operational_analytics (period_type);

-- Marketing analytics indexes
CREATE INDEX IF NOT EXISTS marketing_analytics_tenant_idx ON public.marketing_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS marketing_analytics_date_idx ON public.marketing_analytics (date);
CREATE INDEX IF NOT EXISTS marketing_analytics_period_type_idx ON public.marketing_analytics (period_type);

-- ============================================================================
-- 8) Add comments for documentation
-- ============================================================================

COMMENT ON TABLE public.revenue_analytics IS 'Revenue analytics and tracking';
COMMENT ON TABLE public.customer_analytics IS 'Customer analytics and behavior tracking';
COMMENT ON TABLE public.booking_analytics IS 'Booking analytics and performance tracking';
COMMENT ON TABLE public.staff_performance_analytics IS 'Staff performance analytics and tracking';
COMMENT ON TABLE public.operational_analytics IS 'Operational analytics and efficiency tracking';
COMMENT ON TABLE public.marketing_analytics IS 'Marketing analytics and campaign tracking';

COMMIT;


