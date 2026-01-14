-- Add image, description, review, and reviewer_name columns to staff table
-- These fields are used in the booking flow to display staff information

ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS review text,
ADD COLUMN IF NOT EXISTS reviewer_name text;

COMMENT ON COLUMN staff.image_url IS 'URL of the staff member image (can be blob URL, storage URL, or external URL)';
COMMENT ON COLUMN staff.description IS 'Brief description of the staff member displayed in booking flow';
COMMENT ON COLUMN staff.review IS 'Customer review or testimonial for the staff member';
COMMENT ON COLUMN staff.reviewer_name IS 'Name of the person who wrote the review';

