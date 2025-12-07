-- Add missing fields for Task 11: Background Jobs
-- Adds held_expires_at to bookings and next_retry_at to notification_jobs

-- Add held_expires_at to bookings table for temporary holds during checkout
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS held_expires_at timestamptz;

-- Add next_retry_at to notification_jobs for exponential backoff retry scheduling
ALTER TABLE notification_jobs 
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Add index for efficient querying of expired holds
CREATE INDEX IF NOT EXISTS idx_bookings_held_expires 
ON bookings(held_expires_at) 
WHERE status = 'held' AND held_expires_at IS NOT NULL;

-- Add index for efficient querying of jobs ready for retry
CREATE INDEX IF NOT EXISTS idx_notification_jobs_next_retry 
ON notification_jobs(next_retry_at, status) 
WHERE status IN ('failed', 'pending') AND next_retry_at IS NOT NULL;



