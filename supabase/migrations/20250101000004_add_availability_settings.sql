-- Add configurable availability settings to businesses table
-- These fields allow businesses to customize lead time and booking window
-- Referenced in frontend logistics.txt: "lead time; max advance window"

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS min_lead_time_minutes integer DEFAULT 120,
ADD COLUMN IF NOT EXISTS max_advance_days integer DEFAULT 60;

-- Add comments for clarity
COMMENT ON COLUMN businesses.min_lead_time_minutes IS 'Minimum lead time in minutes before a booking can be made (default: 120 = 2 hours)';
COMMENT ON COLUMN businesses.max_advance_days IS 'Maximum number of days in advance a booking can be made (default: 60 days)';

-- Add check constraints to ensure valid values
ALTER TABLE businesses
ADD CONSTRAINT check_min_lead_time_positive CHECK (min_lead_time_minutes >= 0),
ADD CONSTRAINT check_max_advance_positive CHECK (max_advance_days > 0);

