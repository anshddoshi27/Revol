-- P0034 — Standardize Notification Templates
-- Standardizes template field names and enforces {{snake_case}} placeholders
-- Aligns ORM with existing DB schema

BEGIN;

-- ============================================================================
-- 1. STANDARDIZE TEMPLATE FIELDS
-- ============================================================================

-- Rename body column to content for consistency
ALTER TABLE public.notification_templates 
RENAME COLUMN body TO content;

-- Rename event_code column to trigger_event for consistency  
ALTER TABLE public.notification_templates 
RENAME COLUMN event_code TO trigger_event;

-- ============================================================================
-- 2. ADD STANDARDIZED PLACEHOLDER CONSTRAINTS
-- ============================================================================

-- Add constraint to enforce {{snake_case}} placeholder format
-- This ensures templates use consistent placeholder naming
ALTER TABLE public.notification_templates 
ADD CONSTRAINT notification_templates_content_format 
CHECK (
    -- Allow only {{snake_case}} format placeholders
    content ~ '^[^{}]*(\{\{[a-z][a-z0-9_]*\}\}[^{}]*)*$'
    OR content = ''  -- Allow empty content
);

-- Add constraint to enforce {{snake_case}} format in subject
ALTER TABLE public.notification_templates 
ADD CONSTRAINT notification_templates_subject_format 
CHECK (
    -- Allow only {{snake_case}} format placeholders
    subject IS NULL 
    OR subject ~ '^[^{}]*(\{\{[a-z][a-z0-9_]*\}\}[^{}]*)*$'
    OR subject = ''  -- Allow empty subject
);

-- ============================================================================
-- 3. UPDATE INDEXES FOR NEW COLUMN NAMES
-- ============================================================================

-- Drop old indexes
DROP INDEX IF EXISTS notification_templates_tenant_event_channel_idx;

-- Create new index with standardized column names
CREATE INDEX IF NOT EXISTS notification_templates_tenant_trigger_channel_idx 
ON public.notification_templates (tenant_id, trigger_event, channel) 
WHERE is_active = true;

-- ============================================================================
-- 4. ADD DEDUPLICATION SUPPORT
-- ============================================================================

-- Add unique constraint for deduplication
-- Prevents duplicate notifications for same booking/event/channel combination
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_dedupe_unique 
UNIQUE (tenant_id, event_code, channel, dedupe_key) 
WHERE dedupe_key IS NOT NULL;

COMMIT;
