BEGIN;

-- Migration: 0044_enhanced_notifications.sql
-- Purpose: Add enhanced notification system with placeholder management
-- Date: 2025-01-27
-- Author: System
-- Note: This migration is designed to be re-runnable (idempotent)

-- ============================================================================
-- 1) Create enhanced notification templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_templates_enhanced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    trigger_event text NOT NULL,
    category text NOT NULL,
    subject_template text,
    content_template text NOT NULL,
    content_type text DEFAULT 'text/plain',
    available_placeholders jsonb DEFAULT '[]'::jsonb,
    required_placeholders jsonb DEFAULT '[]'::jsonb,
    placeholder_examples jsonb DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    is_system_template boolean NOT NULL DEFAULT false,
    priority integer DEFAULT 0,
    send_immediately boolean NOT NULL DEFAULT true,
    delay_minutes integer DEFAULT 0,
    send_time_hour integer,
    send_time_minute integer,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT notification_templates_enhanced_trigger_event_check 
        CHECK (trigger_event IN ('booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'booking_completed', 'payment_received', 'payment_failed', 'reminder_24_hour', 'reminder_1_hour', 'no_show', 'follow_up')),
    CONSTRAINT notification_templates_enhanced_category_check 
        CHECK (category IN ('confirmation', 'reminder', 'follow_up', 'cancellation', 'reschedule', 'payment', 'marketing', 'system')),
    CONSTRAINT notification_templates_enhanced_content_type_check 
        CHECK (content_type IN ('text/plain', 'text/html', 'application/json')),
    CONSTRAINT notification_templates_enhanced_priority_check 
        CHECK (priority >= 0),
    CONSTRAINT notification_templates_enhanced_delay_check 
        CHECK (delay_minutes >= 0),
    CONSTRAINT notification_templates_enhanced_send_hour_check 
        CHECK (send_time_hour IS NULL OR (send_time_hour >= 0 AND send_time_hour <= 23)),
    CONSTRAINT notification_templates_enhanced_send_minute_check 
        CHECK (send_time_minute IS NULL OR (send_time_minute >= 0 AND send_time_minute <= 59))
);

-- ============================================================================
-- 2) Create notification placeholders
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_placeholders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    placeholder_name text NOT NULL,
    display_name text NOT NULL,
    description text,
    placeholder_type text NOT NULL,
    data_source text NOT NULL,
    data_field text NOT NULL,
    format_string text,
    default_value text,
    is_required boolean NOT NULL DEFAULT false,
    usage_count integer DEFAULT 0,
    last_used_at timestamptz,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT notification_placeholders_type_check 
        CHECK (placeholder_type IN ('customer', 'booking', 'service', 'business', 'system')),
    CONSTRAINT notification_placeholders_usage_count_check 
        CHECK (usage_count >= 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, placeholder_name)
);

-- ============================================================================
-- 3) Create enhanced notification queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_queue_enhanced (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES public.notification_templates_enhanced(id) ON DELETE CASCADE,
    trigger_event text NOT NULL,
    category text NOT NULL,
    recipient_email text,
    recipient_phone text,
    recipient_name text,
    subject text,
    content text NOT NULL,
    content_type text DEFAULT 'text/plain',
    placeholder_data jsonb DEFAULT '{}',
    scheduled_at timestamptz NOT NULL,
    priority integer DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_attempt_at timestamptz,
    error_message text,
    sent_at timestamptz,
    delivered_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    provider text DEFAULT 'internal',
    provider_message_id text,
    provider_response jsonb DEFAULT '{}',
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT notification_queue_enhanced_trigger_event_check 
        CHECK (trigger_event IN ('booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'booking_completed', 'payment_received', 'payment_failed', 'reminder_24_hour', 'reminder_1_hour', 'no_show', 'follow_up')),
    CONSTRAINT notification_queue_enhanced_category_check 
        CHECK (category IN ('confirmation', 'reminder', 'follow_up', 'cancellation', 'reschedule', 'payment', 'marketing', 'system')),
    CONSTRAINT notification_queue_enhanced_status_check 
        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    CONSTRAINT notification_queue_enhanced_attempts_check 
        CHECK (attempts >= 0),
    CONSTRAINT notification_queue_enhanced_max_attempts_check 
        CHECK (max_attempts > 0),
    CONSTRAINT notification_queue_enhanced_attempts_lte_max_check 
        CHECK (attempts <= max_attempts),
    CONSTRAINT notification_queue_enhanced_priority_check 
        CHECK (priority >= 0),
    CONSTRAINT notification_queue_enhanced_content_type_check 
        CHECK (content_type IN ('text/plain', 'text/html', 'application/json'))
);

-- ============================================================================
-- 4) Create notification automations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_automations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    trigger_event text NOT NULL,
    category text NOT NULL,
    template_id uuid NOT NULL REFERENCES public.notification_templates_enhanced(id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    send_immediately boolean NOT NULL DEFAULT true,
    delay_minutes integer DEFAULT 0,
    send_time_hour integer,
    send_time_minute integer,
    conditions_json jsonb DEFAULT '{}',
    recipient_filters_json jsonb DEFAULT '{}',
    total_sent integer DEFAULT 0,
    last_sent_at timestamptz,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT notification_automations_trigger_event_check 
        CHECK (trigger_event IN ('booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'booking_completed', 'payment_received', 'payment_failed', 'reminder_24_hour', 'reminder_1_hour', 'no_show', 'follow_up')),
    CONSTRAINT notification_automations_category_check 
        CHECK (category IN ('confirmation', 'reminder', 'follow_up', 'cancellation', 'reschedule', 'payment', 'marketing', 'system')),
    CONSTRAINT notification_automations_delay_check 
        CHECK (delay_minutes >= 0),
    CONSTRAINT notification_automations_send_hour_check 
        CHECK (send_time_hour IS NULL OR (send_time_hour >= 0 AND send_time_hour <= 23)),
    CONSTRAINT notification_automations_send_minute_check 
        CHECK (send_time_minute IS NULL OR (send_time_minute >= 0 AND send_time_minute <= 59)),
    CONSTRAINT notification_automations_total_sent_check 
        CHECK (total_sent >= 0)
);

-- ============================================================================
-- 5) Create notification analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    date timestamptz NOT NULL,
    period_type text NOT NULL,
    template_id uuid REFERENCES public.notification_templates_enhanced(id),
    trigger_event text,
    category text,
    total_sent integer DEFAULT 0,
    total_delivered integer DEFAULT 0,
    total_opened integer DEFAULT 0,
    total_clicked integer DEFAULT 0,
    total_failed integer DEFAULT 0,
    delivery_rate numeric(5,2) DEFAULT 0.00,
    open_rate numeric(5,2) DEFAULT 0.00,
    click_rate numeric(5,2) DEFAULT 0.00,
    failure_rate numeric(5,2) DEFAULT 0.00,
    email_sent integer DEFAULT 0,
    sms_sent integer DEFAULT 0,
    push_sent integer DEFAULT 0,
    metadata_json jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT notification_analytics_period_type_check 
        CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    CONSTRAINT notification_analytics_trigger_event_check 
        CHECK (trigger_event IS NULL OR trigger_event IN ('booking_created', 'booking_confirmed', 'booking_cancelled', 'booking_rescheduled', 'booking_completed', 'payment_received', 'payment_failed', 'reminder_24_hour', 'reminder_1_hour', 'no_show', 'follow_up')),
    CONSTRAINT notification_analytics_category_check 
        CHECK (category IS NULL OR category IN ('confirmation', 'reminder', 'follow_up', 'cancellation', 'reschedule', 'payment', 'marketing', 'system')),
    CONSTRAINT notification_analytics_total_sent_check 
        CHECK (total_sent >= 0),
    CONSTRAINT notification_analytics_total_delivered_check 
        CHECK (total_delivered >= 0),
    CONSTRAINT notification_analytics_total_opened_check 
        CHECK (total_opened >= 0),
    CONSTRAINT notification_analytics_total_clicked_check 
        CHECK (total_clicked >= 0),
    CONSTRAINT notification_analytics_total_failed_check 
        CHECK (total_failed >= 0),
    CONSTRAINT notification_analytics_delivery_rate_check 
        CHECK (delivery_rate >= 0 AND delivery_rate <= 100),
    CONSTRAINT notification_analytics_open_rate_check 
        CHECK (open_rate >= 0 AND open_rate <= 100),
    CONSTRAINT notification_analytics_click_rate_check 
        CHECK (click_rate >= 0 AND click_rate <= 100),
    CONSTRAINT notification_analytics_failure_rate_check 
        CHECK (failure_rate >= 0 AND failure_rate <= 100),
    CONSTRAINT notification_analytics_email_sent_check 
        CHECK (email_sent >= 0),
    CONSTRAINT notification_analytics_sms_sent_check 
        CHECK (sms_sent >= 0),
    CONSTRAINT notification_analytics_push_sent_check 
        CHECK (push_sent >= 0),
    
    -- Unique constraint
    UNIQUE (tenant_id, date, period_type, template_id)
);

-- ============================================================================
-- 6) Add indexes for performance
-- ============================================================================

-- Enhanced notification templates indexes
CREATE INDEX IF NOT EXISTS notification_templates_enhanced_tenant_idx ON public.notification_templates_enhanced (tenant_id);
CREATE INDEX IF NOT EXISTS notification_templates_enhanced_trigger_event_idx ON public.notification_templates_enhanced (trigger_event);
CREATE INDEX IF NOT EXISTS notification_templates_enhanced_category_idx ON public.notification_templates_enhanced (category);
CREATE INDEX IF NOT EXISTS notification_templates_enhanced_is_active_idx ON public.notification_templates_enhanced (is_active);
CREATE INDEX IF NOT EXISTS notification_templates_enhanced_priority_idx ON public.notification_templates_enhanced (priority);

-- Notification placeholders indexes
CREATE INDEX IF NOT EXISTS notification_placeholders_tenant_idx ON public.notification_placeholders (tenant_id);
CREATE INDEX IF NOT EXISTS notification_placeholders_placeholder_name_idx ON public.notification_placeholders (placeholder_name);
CREATE INDEX IF NOT EXISTS notification_placeholders_type_idx ON public.notification_placeholders (placeholder_type);
CREATE INDEX IF NOT EXISTS notification_placeholders_usage_count_idx ON public.notification_placeholders (usage_count);

-- Enhanced notification queue indexes
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_tenant_idx ON public.notification_queue_enhanced (tenant_id);
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_template_idx ON public.notification_queue_enhanced (template_id);
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_status_idx ON public.notification_queue_enhanced (status);
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_scheduled_at_idx ON public.notification_queue_enhanced (scheduled_at);
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_priority_idx ON public.notification_queue_enhanced (priority);
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_recipient_email_idx ON public.notification_queue_enhanced (recipient_email);
CREATE INDEX IF NOT EXISTS notification_queue_enhanced_recipient_phone_idx ON public.notification_queue_enhanced (recipient_phone);

-- Notification automations indexes
CREATE INDEX IF NOT EXISTS notification_automations_tenant_idx ON public.notification_automations (tenant_id);
CREATE INDEX IF NOT EXISTS notification_automations_template_idx ON public.notification_automations (template_id);
CREATE INDEX IF NOT EXISTS notification_automations_trigger_event_idx ON public.notification_automations (trigger_event);
CREATE INDEX IF NOT EXISTS notification_automations_category_idx ON public.notification_automations (category);
CREATE INDEX IF NOT EXISTS notification_automations_is_active_idx ON public.notification_automations (is_active);

-- Notification analytics indexes
CREATE INDEX IF NOT EXISTS notification_analytics_tenant_idx ON public.notification_analytics (tenant_id);
CREATE INDEX IF NOT EXISTS notification_analytics_date_idx ON public.notification_analytics (date);
CREATE INDEX IF NOT EXISTS notification_analytics_period_type_idx ON public.notification_analytics (period_type);
CREATE INDEX IF NOT EXISTS notification_analytics_template_idx ON public.notification_analytics (template_id);
CREATE INDEX IF NOT EXISTS notification_analytics_trigger_event_idx ON public.notification_analytics (trigger_event);
CREATE INDEX IF NOT EXISTS notification_analytics_category_idx ON public.notification_analytics (category);

-- ============================================================================
-- 7) Add comments for documentation
-- ============================================================================

COMMENT ON TABLE public.notification_templates_enhanced IS 'Enhanced notification templates with placeholder management';
COMMENT ON TABLE public.notification_placeholders IS 'Available placeholders for notification templates';
COMMENT ON TABLE public.notification_queue_enhanced IS 'Enhanced notification queue with better processing';
COMMENT ON TABLE public.notification_automations IS 'Automation rules for notification sending';
COMMENT ON TABLE public.notification_analytics IS 'Analytics for notification performance';

COMMIT;


