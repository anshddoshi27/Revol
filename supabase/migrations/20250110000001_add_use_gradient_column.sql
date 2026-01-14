-- Add use_gradient column to businesses table for branding customization
-- This allows users to choose between gradient and solid color backgrounds

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS use_gradient boolean DEFAULT true;

COMMENT ON COLUMN businesses.use_gradient IS 'Whether to use gradient backgrounds (true) or solid colors (false) for the booking page';
a