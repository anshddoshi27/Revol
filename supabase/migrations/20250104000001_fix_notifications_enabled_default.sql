-- Fix notifications_enabled default to false (Basic Plan)
-- Basic Plan should be the default, not Pro Plan

-- Update the default value for new businesses
ALTER TABLE businesses
ALTER COLUMN notifications_enabled SET DEFAULT false;

-- Update existing businesses that have notifications_enabled = true but no notification templates
-- These should be Basic plan by default
-- (This is optional - you may want to keep existing businesses as they are)

-- Add comment for clarity
COMMENT ON COLUMN businesses.notifications_enabled IS 'If true, SMS and email notifications are enabled (Pro Plan $21.99/month). If false, only booking confirmation messages are shown (Basic Plan $11.99/month). Default is false (Basic Plan).';

