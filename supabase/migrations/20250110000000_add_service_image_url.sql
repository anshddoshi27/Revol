-- Add image_url column to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS image_url text;

-- Add comment to document the column
COMMENT ON COLUMN services.image_url IS 'URL of the service image (can be blob URL, storage URL, or external URL)';
