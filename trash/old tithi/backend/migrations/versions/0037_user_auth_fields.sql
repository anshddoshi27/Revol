-- P0037 — User Authentication Fields
-- Adds authentication fields to the users table for signup functionality
-- This supports the T02A Auth & Sign-Up Flow task requirements

BEGIN;

-- Add authentication fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email citext UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text;

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email 
ON public.users(email) WHERE email IS NOT NULL;

-- Create index on phone for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_phone 
ON public.users(phone) WHERE phone IS NOT NULL;

-- Add constraint to ensure email is not null for new users
ALTER TABLE public.users 
ALTER COLUMN email SET NOT NULL;

-- Update existing users to use primary_email as email if email is null
UPDATE public.users 
SET email = primary_email 
WHERE email IS NULL AND primary_email IS NOT NULL;

COMMIT;
