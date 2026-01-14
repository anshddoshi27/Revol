-- Add launched_at field to businesses table
-- This tracks when the business actually goes live (when onboarding is completed)
-- Trial period is calculated as 7 days from launched_at, not from when trial is selected

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS launched_at timestamptz;

-- For existing businesses that have subscription_status set, set launched_at to created_at
-- This is a reasonable default for businesses that were already launched
UPDATE businesses
SET launched_at = created_at
WHERE subscription_status IS NOT NULL
  AND launched_at IS NULL;

