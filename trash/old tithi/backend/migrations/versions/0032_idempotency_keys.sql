-- Migration: 0032_idempotency_keys.sql
-- Purpose: Create idempotency_keys table for critical endpoint idempotency
-- Phase: 11 - Cross-Cutting Utilities (Module N)
-- Task: 11.4 - Idempotency Keys

BEGIN;

-- Create idempotency_keys table for critical endpoint idempotency
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key_hash text NOT NULL, -- SHA-256 hash of the idempotency key
  original_key text NOT NULL, -- Original idempotency key (for debugging)
  endpoint text NOT NULL, -- The endpoint that was called
  method text NOT NULL, -- HTTP method (GET, POST, PUT, DELETE)
  request_hash text NOT NULL, -- SHA-256 hash of request body for validation
  response_status integer NOT NULL, -- HTTP status code of the response
  response_body jsonb NOT NULL DEFAULT '{}'::jsonb, -- Cached response body
  response_headers jsonb NOT NULL DEFAULT '{}'::jsonb, -- Cached response headers
  expires_at timestamptz NOT NULL, -- When this idempotency key expires
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant_key 
ON public.idempotency_keys (tenant_id, key_hash);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at 
ON public.idempotency_keys (expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_endpoint 
ON public.idempotency_keys (tenant_id, endpoint, method);

-- Unique constraint to prevent duplicate idempotency keys per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_keys_unique 
ON public.idempotency_keys (tenant_id, key_hash, endpoint, method);

-- Add updated_at trigger
CREATE TRIGGER idempotency_keys_updated_at_trigger
  BEFORE UPDATE ON public.idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY "idempotency_keys_sel" ON public.idempotency_keys
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "idempotency_keys_ins" ON public.idempotency_keys
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "idempotency_keys_upd" ON public.idempotency_keys
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "idempotency_keys_del" ON public.idempotency_keys
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Add audit trigger
CREATE TRIGGER idempotency_keys_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.idempotency_keys
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Create function to clean up expired idempotency keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.idempotency_keys 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate idempotency key
CREATE OR REPLACE FUNCTION public.validate_idempotency_key(
  p_tenant_id uuid,
  p_key_hash text,
  p_endpoint text,
  p_method text,
  p_request_hash text
)
RETURNS TABLE(
  is_valid boolean,
  cached_response jsonb,
  cached_headers jsonb,
  cached_status integer
) AS $$
DECLARE
  key_record record;
BEGIN
  -- Look for existing idempotency key
  SELECT response_body, response_headers, response_status, expires_at
  INTO key_record
  FROM public.idempotency_keys
  WHERE tenant_id = p_tenant_id
    AND key_hash = p_key_hash
    AND endpoint = p_endpoint
    AND method = p_method
    AND request_hash = p_request_hash
    AND expires_at > now()
  LIMIT 1;
  
  IF key_record IS NOT NULL THEN
    -- Return cached response
    RETURN QUERY SELECT 
      true,
      key_record.response_body,
      key_record.response_headers,
      key_record.response_status;
  ELSE
    -- No valid cached response
    RETURN QUERY SELECT 
      false,
      '{}'::jsonb,
      '{}'::jsonb,
      0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to store idempotency key response
CREATE OR REPLACE FUNCTION public.store_idempotency_response(
  p_tenant_id uuid,
  p_key_hash text,
  p_original_key text,
  p_endpoint text,
  p_method text,
  p_request_hash text,
  p_response_status integer,
  p_response_body jsonb,
  p_response_headers jsonb,
  p_expires_at timestamptz
)
RETURNS uuid AS $$
DECLARE
  key_id uuid;
BEGIN
  INSERT INTO public.idempotency_keys (
    tenant_id, key_hash, original_key, endpoint, method, request_hash,
    response_status, response_body, response_headers, expires_at
  ) VALUES (
    p_tenant_id, p_key_hash, p_original_key, p_endpoint, p_method, p_request_hash,
    p_response_status, p_response_body, p_response_headers, p_expires_at
  )
  ON CONFLICT (tenant_id, key_hash, endpoint, method) 
  DO UPDATE SET
    response_status = EXCLUDED.response_status,
    response_body = EXCLUDED.response_body,
    response_headers = EXCLUDED.response_headers,
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING id INTO key_id;
  
  RETURN key_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
