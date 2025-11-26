-- Add policy_hash column to bookings table
-- This stores a SHA-256 hash of the policy snapshot for compliance and dispute resolution
-- Per backend clarifications: "A hash (e.g. SHA-256) of the policy text so you can prove 'this is exactly what was shown.'"

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS policy_hash text;

-- Add comment for clarity
COMMENT ON COLUMN bookings.policy_hash IS 'SHA-256 hash of policy_snapshot JSON for compliance and dispute resolution';

-- Add index for policy hash lookups (useful for compliance queries)
CREATE INDEX IF NOT EXISTS idx_bookings_policy_hash ON bookings(policy_hash);



