-- P0031 — Enhanced Notification System
-- Implements comprehensive notification system with templates, settings, and provider management
-- Creates notification_settings, notification_providers, and related tables

BEGIN;

-- ============================================================================
-- 1. NOTIFICATION SETTINGS TABLE
-- ============================================================================

-- Create notification_settings table for tenant-specific preferences
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Booking notifications
    booking_confirmation_email_enabled boolean NOT NULL DEFAULT true,
    booking_confirmation_sms_enabled boolean NOT NULL DEFAULT false,
    booking_confirmation_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    booking_confirmation_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    -- Reminder notifications
    reminder_24h_email_enabled boolean NOT NULL DEFAULT true,
    reminder_24h_sms_enabled boolean NOT NULL DEFAULT false,
    reminder_24h_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    reminder_24h_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    reminder_12h_email_enabled boolean NOT NULL DEFAULT true,
    reminder_12h_sms_enabled boolean NOT NULL DEFAULT false,
    reminder_12h_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    reminder_12h_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    reminder_1h_email_enabled boolean NOT NULL DEFAULT true,
    reminder_1h_sms_enabled boolean NOT NULL DEFAULT false,
    reminder_1h_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    reminder_1h_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    -- Cancellation notifications
    cancellation_email_enabled boolean NOT NULL DEFAULT true,
    cancellation_sms_enabled boolean NOT NULL DEFAULT false,
    cancellation_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    cancellation_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    -- No-show notifications
    no_show_email_enabled boolean NOT NULL DEFAULT true,
    no_show_sms_enabled boolean NOT NULL DEFAULT false,
    no_show_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    no_show_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    -- Feedback notifications
    feedback_request_email_enabled boolean NOT NULL DEFAULT true,
    feedback_request_sms_enabled boolean NOT NULL DEFAULT false,
    feedback_request_email_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    feedback_request_sms_template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    
    -- General settings
    send_ics_attachment boolean NOT NULL DEFAULT true,
    include_business_branding boolean NOT NULL DEFAULT true,
    allow_unsubscribe boolean NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. NOTIFICATION PROVIDERS TABLE
-- ============================================================================

-- Create notification_providers table for encrypted API credentials
CREATE TABLE IF NOT EXISTS public.notification_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Provider details
    provider_type text NOT NULL CHECK (provider_type IN ('email', 'sms', 'push')),
    provider_name text NOT NULL, -- 'brevo', 'twilio', 'sendgrid', etc.
    
    -- Encrypted credentials
    api_key_encrypted text,
    api_secret_encrypted text,
    
    -- Provider configuration
    from_email text,
    from_phone text,
    webhook_url text,
    webhook_secret text,
    
    -- Status and limits
    is_active boolean NOT NULL DEFAULT true,
    credits_remaining integer,
    monthly_limit integer,
    daily_limit integer,
    
    -- Configuration and metadata
    config jsonb DEFAULT '{}',
    last_used_at timestamptz,
    last_error_at timestamptz,
    last_error_message text,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. ADMIN NOTIFICATION PREFERENCES TABLE
-- ============================================================================

-- Create admin_notification_preferences table for admin-specific settings
CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Notification types
    notification_type text NOT NULL CHECK (notification_type IN (
        'new_booking', 'booking_cancelled', 'booking_rescheduled', 'no_show',
        'payment_failed', 'refund_processed', 'quota_exceeded', 'system_alert'
    )),
    
    -- Channel preferences
    email_enabled boolean NOT NULL DEFAULT true,
    sms_enabled boolean NOT NULL DEFAULT false,
    push_enabled boolean NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint
    UNIQUE(tenant_id, user_id, notification_type)
);

-- ============================================================================
-- 4. CUSTOMER PREFERENCES TABLE
-- ============================================================================

-- Create customer_preferences table for customer-specific notification settings
CREATE TABLE IF NOT EXISTS public.customer_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Preference details
    preference_type text NOT NULL CHECK (preference_type IN (
        'email_notifications', 'sms_notifications', 'marketing_emails',
        'reminder_timing', 'language', 'timezone'
    )),
    preference_value text NOT NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint
    UNIQUE(tenant_id, customer_id, preference_type)
);

-- Create notification_analytics table for delivery metrics and performance tracking
CREATE TABLE IF NOT EXISTS public.notification_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
    provider_id uuid REFERENCES public.notification_providers(id) ON DELETE SET NULL,
    
    -- Event details
    event_code text NOT NULL,
    channel text NOT NULL,
    
    -- Recipient information
    recipient_email text,
    recipient_phone text,
    
    -- Delivery tracking
    status text NOT NULL DEFAULT 'pending',
    sent_at timestamptz,
    delivered_at timestamptz,
    bounced_at timestamptz,
    failed_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    
    -- Performance metrics
    delivery_time_ms integer,
    open_time_ms integer,
    click_time_ms integer,
    retry_count integer NOT NULL DEFAULT 0,
    
    -- Error tracking
    error_code text,
    error_message text,
    
    -- Metadata and timestamps
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. CALENDAR CONNECTIONS TABLE
-- ============================================================================

-- Create calendar_connections table for staff calendar integration
CREATE TABLE IF NOT EXISTS public.calendar_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
    
    -- Calendar provider details
    provider text NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
    
    -- Encrypted tokens
    access_token_enc text,
    refresh_token_enc text,
    
    -- Token details
    token_scopes text[],
    calendar_id text,
    channel_id text,
    resource_id text,
    resource_uri text,
    
    -- Channel details
    channel_token text,
    channel_expires_at timestamptz,
    state text,
    sync_token text,
    block_mode text,
    
    -- Status
    last_sync_at timestamptz,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. TRIGGERS AND INDEXES
-- ============================================================================

-- Add touch triggers for updated_at columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'notification_settings_touch_updated_at'
    ) THEN
        CREATE TRIGGER notification_settings_touch_updated_at
            BEFORE UPDATE ON public.notification_settings
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'notification_providers_touch_updated_at'
    ) THEN
        CREATE TRIGGER notification_providers_touch_updated_at
            BEFORE UPDATE ON public.notification_providers
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'admin_notification_preferences_touch_updated_at'
    ) THEN
        CREATE TRIGGER admin_notification_preferences_touch_updated_at
            BEFORE UPDATE ON public.admin_notification_preferences
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'customer_preferences_touch_updated_at'
    ) THEN
        CREATE TRIGGER customer_preferences_touch_updated_at
            BEFORE UPDATE ON public.customer_preferences
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'calendar_connections_touch_updated_at'
    ) THEN
        CREATE TRIGGER calendar_connections_touch_updated_at
            BEFORE UPDATE ON public.calendar_connections
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Add touch trigger for notification_analytics table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'notification_analytics_touch_updated_at'
    ) THEN
        CREATE TRIGGER notification_analytics_touch_updated_at
            BEFORE UPDATE ON public.notification_analytics
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_settings_tenant_id 
ON public.notification_settings(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notification_providers_tenant_id 
ON public.notification_providers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notification_providers_type 
ON public.notification_providers(provider_type);

CREATE INDEX IF NOT EXISTS idx_notification_providers_active 
ON public.notification_providers(is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_admin_notification_preferences_tenant_user 
ON public.admin_notification_preferences(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_customer_preferences_tenant_customer 
ON public.customer_preferences(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_tenant_staff 
ON public.calendar_connections(tenant_id, staff_resource_id);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider 
ON public.calendar_connections(provider);

CREATE INDEX IF NOT EXISTS idx_notification_analytics_tenant_id 
ON public.notification_analytics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notification_analytics_notification_id 
ON public.notification_analytics(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_analytics_template_id 
ON public.notification_analytics(template_id) 
WHERE template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_analytics_provider_id 
ON public.notification_analytics(provider_id) 
WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_analytics_status 
ON public.notification_analytics(status);

CREATE INDEX IF NOT EXISTS idx_notification_analytics_channel 
ON public.notification_analytics(channel);

-- ============================================================================
-- 7. COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Add comprehensive comments
COMMENT ON TABLE public.notification_settings IS 'Tenant-specific notification preferences and timing configuration';
COMMENT ON TABLE public.notification_providers IS 'Encrypted API credentials for notification providers (Brevo, Twilio) with tenant isolation';
COMMENT ON TABLE public.admin_notification_preferences IS 'Admin-specific notification preferences for different event types';
COMMENT ON TABLE public.customer_preferences IS 'Customer-specific notification and preference settings';
COMMENT ON TABLE public.notification_analytics IS 'Delivery metrics and performance tracking for notifications';
COMMENT ON TABLE public.calendar_connections IS 'Staff calendar integration with encrypted token storage';

COMMIT;
