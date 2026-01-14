-- Add notifications_enabled field to businesses table
-- This field determines if SMS and email notifications are enabled for the business
-- If false, only booking confirmation messages are shown (no emails/SMS sent)

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN businesses.notifications_enabled IS 'If true, SMS and email notifications are enabled. If false, only booking confirmation messages are shown.';


