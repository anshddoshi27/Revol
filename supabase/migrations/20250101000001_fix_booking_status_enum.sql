-- Fix: Add 'held' status to booking_status enum
-- Run this if you already ran the initial migration and got the enum error

-- Add 'held' to the enum (if it doesn't already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'held' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'held';
  END IF;
END $$;

