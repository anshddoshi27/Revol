-- Add new branding columns to businesses table for enhanced booking page customization
-- This migration adds fields for: secondary color, font, button shape, hero image, and booking description

-- Add secondary color (already exists but ensure it's there)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS brand_secondary_color text;

-- Add font family for typography customization
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS brand_font_family text DEFAULT 'Inter';

-- Add button shape for booking page buttons
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS brand_button_shape text DEFAULT 'rounded';

-- Add hero image URL for booking page header background
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hero_image_url text;

-- Add booking page description (displayed under business title)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_page_description text;

-- Create index for quicker lookups when rendering booking pages
CREATE INDEX IF NOT EXISTS idx_businesses_branding ON businesses(subdomain) 
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN businesses.brand_secondary_color IS 'Secondary/accent color for booking page (hex color code)';
COMMENT ON COLUMN businesses.brand_font_family IS 'Font family for booking page text (Inter, Poppins, etc.)';
COMMENT ON COLUMN businesses.brand_button_shape IS 'Button style: rounded, slightly-rounded, or square';
COMMENT ON COLUMN businesses.hero_image_url IS 'Optional hero/header background image for booking page';
COMMENT ON COLUMN businesses.booking_page_description IS 'Description text shown under business title on booking page';

