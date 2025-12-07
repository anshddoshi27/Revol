-- Add social media URL fields to businesses table
-- These fields are optional and referenced in frontend logistics.txt:
-- "social media, which you can add the website to the actual company's website, 
-- Instagram, Facebook, TikTok, YouTube, but this is all optional."

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text,
ADD COLUMN IF NOT EXISTS youtube_url text;

-- Add comments for clarity
COMMENT ON COLUMN businesses.instagram_url IS 'Optional Instagram profile URL';
COMMENT ON COLUMN businesses.facebook_url IS 'Optional Facebook page URL';
COMMENT ON COLUMN businesses.tiktok_url IS 'Optional TikTok profile URL';
COMMENT ON COLUMN businesses.youtube_url IS 'Optional YouTube channel URL';

