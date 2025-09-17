-- P0023 — OAuth Providers Support
-- Adds OAuth provider table to support Google login and other OAuth providers
-- This addresses the database review recommendation for OAuth integration

BEGIN;

-- OAuth Providers: Links users to external OAuth providers (Google, etc.)
-- This table is tenant-agnostic as users can exist across multiple tenants
-- Drop table if it exists to ensure clean migration
DROP TABLE IF EXISTS public.oauth_providers CASCADE;
CREATE TABLE public.oauth_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'google', 'facebook', 'apple', etc.
  provider_user_id text NOT NULL, -- External provider's user ID
  provider_email citext, -- Email from provider (may differ from primary_email)
  provider_profile jsonb, -- Full profile data from provider
  access_token_encrypted text, -- Encrypted access token for API calls
  refresh_token_encrypted text, -- Encrypted refresh token for token renewal
  token_expires_at timestamptz, -- When access token expires
  last_sync_at timestamptz DEFAULT now(), -- Last successful sync with provider
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure one provider account per user per provider
  UNIQUE(provider, provider_user_id)
);

-- Indexes for common OAuth queries
CREATE INDEX IF NOT EXISTS idx_oauth_providers_user_id 
  ON public.oauth_providers(user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider_user_id 
  ON public.oauth_providers(provider, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_providers_provider_email 
  ON public.oauth_providers(provider_email) WHERE provider_email IS NOT NULL;

-- Partial unique index: Ensure one primary provider per user for major providers
-- This prevents users from having multiple Google, Facebook, or Apple accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_providers_user_primary_provider 
  ON public.oauth_providers(user_id, provider) 
  WHERE provider IN ('google', 'facebook', 'apple');

-- RLS: OAuth providers are user-scoped, not tenant-scoped
-- Users can only access their own OAuth provider records
ALTER TABLE public.oauth_providers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own OAuth provider records
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Users can access their own OAuth providers" ON public.oauth_providers;
CREATE POLICY "Users can access their own OAuth providers" 
  ON public.oauth_providers
  FOR ALL
  USING (user_id = public.current_user_id());

-- Audit logging for OAuth provider changes
-- Drop existing triggers if they exist, then create new ones
DROP TRIGGER IF EXISTS audit_oauth_providers ON public.oauth_providers;
CREATE TRIGGER audit_oauth_providers
  AFTER INSERT OR UPDATE OR DELETE ON public.oauth_providers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Update trigger for oauth_providers
DROP TRIGGER IF EXISTS touch_oauth_providers_updated_at ON public.oauth_providers;
CREATE TRIGGER touch_oauth_providers_updated_at
  BEFORE UPDATE ON public.oauth_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper function to find user by OAuth provider
CREATE OR REPLACE FUNCTION public.find_user_by_oauth_provider(
  p_provider text,
  p_provider_user_id text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id 
  FROM public.oauth_providers 
  WHERE provider = p_provider 
    AND provider_user_id = p_provider_user_id
  LIMIT 1;
$$;

-- Helper function to get OAuth providers for a user
CREATE OR REPLACE FUNCTION public.get_user_oauth_providers(p_user_id uuid)
RETURNS TABLE(
  provider text,
  provider_email citext,
  last_sync_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    op.provider,
    op.provider_email,
    op.last_sync_at,
    op.created_at
  FROM public.oauth_providers op
  WHERE op.user_id = p_user_id
  ORDER BY op.created_at DESC;
$$;

-- Helper function to check if user has OAuth provider
CREATE OR REPLACE FUNCTION public.user_has_oauth_provider(
  p_user_id uuid,
  p_provider text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 
    FROM public.oauth_providers 
    WHERE user_id = p_user_id 
      AND provider = p_provider
  );
$$;

COMMIT;