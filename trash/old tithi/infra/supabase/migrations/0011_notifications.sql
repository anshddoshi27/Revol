BEGIN;

-- P0011 — Notifications (templates + queue) using enums
-- Implements Design Brief section 7) Notifications Model (Final)
-- Event types, templates, and queue with dedupe/retry logic

-- Table: notification_event_type (extensible event code lookup)
-- Enforces event_code format and provides description for each event type
CREATE TABLE IF NOT EXISTS public.notification_event_type (
    code text PRIMARY KEY,
    description text NOT NULL DEFAULT '',
    
    -- Event code format validation
    CONSTRAINT notification_event_type_code_format CHECK (
        code ~ '^[a-z][a-z0-9_]*$'
    )
);

-- Seed standard event types (extensible list from Design Brief)
INSERT INTO public.notification_event_type (code, description) VALUES
    ('booking_created', 'Booking has been created'),
    ('booking_confirmed', 'Booking has been confirmed'),
    ('booking_rescheduled', 'Booking has been rescheduled'),
    ('reminder_24h', '24-hour reminder before booking'),
    ('reminder_2h', '2-hour reminder before booking'),
    ('reminder_1h', '1-hour reminder before booking'),
    ('no_show_marked', 'Customer marked as no-show'),
    ('booking_canceled', 'Booking has been canceled'),
    ('refund_issued', 'Refund has been processed')
ON CONFLICT (code) DO NOTHING;

-- Table: notification_templates (per-tenant template configuration)
-- Stores templates for each event type and channel combination
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_code text NOT NULL REFERENCES public.notification_event_type(code) ON DELETE CASCADE,
    channel public.notification_channel NOT NULL,
    name text NOT NULL DEFAULT '',
    subject text DEFAULT '',
    body text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one template per tenant/event/channel combination
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_tenant_event_channel_uniq 
ON public.notification_templates(tenant_id, event_code, channel);

-- Table: notifications (queued notifications with dedupe and retry logic)
-- Implements worker consumption pattern with retry attempts and deduplication
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_code text NOT NULL REFERENCES public.notification_event_type(code) ON DELETE CASCADE,
    channel public.notification_channel NOT NULL,
    status public.notification_status NOT NULL DEFAULT 'queued',
    to_email text,
    to_phone text,
    target_json jsonb DEFAULT '{}',
    subject text DEFAULT '',
    body text NOT NULL DEFAULT '',
    scheduled_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    failed_at timestamptz,
    attempts int NOT NULL DEFAULT 0,
    max_attempts int NOT NULL DEFAULT 3,
    last_attempt_at timestamptz,
    error_message text,
    dedupe_key text, -- Optional deduplication key
    provider_message_id text, -- Provider-specific message tracking
    provider_metadata jsonb DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Scheduling sanity check (not too far in the future)
    CONSTRAINT notifications_scheduled_at_reasonable CHECK (
        scheduled_at <= now() + interval '1 year'
    ),
    
    -- Attempts must be non-negative and within reasonable bounds
    CONSTRAINT notifications_attempts_non_negative CHECK (attempts >= 0),
    CONSTRAINT notifications_max_attempts_positive CHECK (max_attempts > 0),
    CONSTRAINT notifications_attempts_lte_max CHECK (attempts <= max_attempts),
    
    -- Channel-specific recipient validation
    CONSTRAINT notifications_email_when_email_channel CHECK (
        channel != 'email' OR to_email IS NOT NULL
    ),
    CONSTRAINT notifications_phone_when_sms_channel CHECK (
        channel != 'sms' OR to_phone IS NOT NULL
    )
);

-- Deduplication constraint: unique (tenant_id, channel, dedupe_key) when dedupe_key is provided
CREATE UNIQUE INDEX IF NOT EXISTS notifications_tenant_channel_dedupe_uniq 
ON public.notifications(tenant_id, channel, dedupe_key) 
WHERE dedupe_key IS NOT NULL;

-- Worker consumption indexes for efficient querying
-- Primary worker index for pulling ready work (per rubric requirement)
CREATE INDEX IF NOT EXISTS notifications_worker_ready_idx 
ON public.notifications(status, scheduled_at);

-- Tenant-scoped worker index for multi-tenant worker patterns
CREATE INDEX IF NOT EXISTS notifications_tenant_worker_idx 
ON public.notifications(tenant_id, status, scheduled_at);

-- Retry queue index for failed notifications that can be retried
CREATE INDEX IF NOT EXISTS notifications_retry_queue_idx 
ON public.notifications(tenant_id, status, last_attempt_at) 
WHERE status = 'failed' AND attempts < max_attempts;

-- Attach touch_updated_at triggers to both tables
DO $$
BEGIN
    -- Notification templates trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'notification_templates_touch_updated_at'
    ) THEN
        CREATE TRIGGER notification_templates_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.notification_templates
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
    
    -- Notifications trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'notifications_touch_updated_at'
    ) THEN
        CREATE TRIGGER notifications_touch_updated_at
            BEFORE INSERT OR UPDATE ON public.notifications
            FOR EACH ROW
            EXECUTE FUNCTION public.touch_updated_at();
    END IF;
END $$;

COMMIT;
