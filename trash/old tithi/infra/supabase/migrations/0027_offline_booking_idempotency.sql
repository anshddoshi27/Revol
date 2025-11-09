-- P0027 — Offline Booking Idempotency
-- Adds offline booking support with idempotency enhancement
-- Ensures client_generated_id uniqueness per tenant

BEGIN;

-- Add unique index for client_generated_id to support offline booking idempotency (partial index)
CREATE UNIQUE INDEX IF NOT EXISTS bookings_idempotency_uniq 
ON public.bookings (tenant_id, client_generated_id) 
WHERE client_generated_id IS NOT NULL;

-- Add index for client_generated_id lookups
CREATE INDEX IF NOT EXISTS idx_bookings_client_generated_id 
ON public.bookings(tenant_id, client_generated_id) 
WHERE client_generated_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON INDEX bookings_idempotency_uniq IS 'Ensures client_generated_id uniqueness per tenant for offline booking idempotency';

COMMIT;
