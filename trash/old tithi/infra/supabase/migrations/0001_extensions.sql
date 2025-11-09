-- P0001 — Extensions (pgcrypto, citext, btree_gist, pg_trgm)
-- Idempotent and wrapped in a transaction per Context Pack guardrails

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMIT;
