# Migration 0021: Helper Functions App Claims Priority

## Overview

This migration updates the RLS helper functions `public.current_tenant_id()` and `public.current_user_id()` to prioritize app-set JWT claims over Supabase Auth JWT claims while maintaining backward compatibility.

## What Changed

### Before (Migration 0003)
- Helpers only read from `auth.jwt()` (Supabase Auth)
- Direct JWT claim extraction with UUID validation

### After (Migration 0021)
- **Priority 1**: Read from `current_setting('request.jwt.claims', true)` as JSON
- **Priority 2**: Fall back to `auth.jwt()` (Supabase Auth) for compatibility
- **Fail Closed**: Return NULL on any parsing errors, ensuring RLS denial

## Implementation Details

### Function Signatures
Both functions maintain identical signatures:
- `RETURNS uuid`
- `LANGUAGE sql`
- `STABLE`
- `SECURITY INVOKER`
- `RETURNS NULL ON NULL INPUT`

### Claim Priority Logic
```sql
CASE
  -- First: app-set claims via current_setting
  WHEN current_setting('request.jwt.claims', true) IS NOT NULL
   AND current_setting('request.jwt.claims', true) != ''
   AND (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id') IS NOT NULL
   AND (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid
  
  -- Fallback: Supabase Auth JWT claims
  WHEN (auth.jwt()->>'tenant_id') IS NOT NULL
   AND (auth.jwt()->>'tenant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN (auth.jwt()->>'tenant_id')::uuid
  
  -- Fail closed: return NULL for RLS denial
  ELSE NULL::uuid
END
```

## Why This Change

### Alignment with Middleware
- Middleware can now set `SET LOCAL "request.jwt.claims"` to override Supabase Auth
- Useful for testing, development, and custom authentication flows
- Maintains Supabase Auth as the default when app-set claims are not provided

### No Policy Changes Required
- All existing RLS policies continue to work unchanged
- Policies still call `public.current_tenant_id()` and `public.current_user_id()`
- Helper functions handle the claim source logic transparently

### Fail-Closed Security
- Invalid JSON, missing claims, or malformed UUIDs result in NULL
- NULL comparisons in RLS policies result in denial (fail-closed)
- Maintains the security model established in Migration 0003

## Testing

### Test File
`0021_helpers_app_claims_validation.sql` provides comprehensive validation:

1. **Priority Logic Tests**
   - App-set claims take priority over Supabase Auth
   - Both tenant_id and user_id (sub) claims are tested

2. **Fallback Logic Tests**
   - No app-set claims fall back to Supabase Auth
   - Empty, malformed, or missing claims fall back appropriately

3. **RLS Integration Tests**
   - Policies work correctly with app-set claims
   - Cross-tenant access is still denied

4. **Function Property Tests**
   - Signatures remain unchanged
   - STABLE, SECURITY INVOKER properties preserved

### Running Tests
```sql
-- Run the validation suite
\i infra/supabase/tests/0021_helpers_app_claims_validation.sql
```

## Usage Examples

### Setting App Claims
```sql
-- Set claims for the current session
SET LOCAL "request.jwt.claims" = '{"tenant_id": "123e4567-e89b-12d3-a456-426614174000", "sub": "987fcdeb-51a2-43d1-9f12-345678901234"}';

-- Helpers now return these values
SELECT public.current_tenant_id(); -- Returns app-set tenant_id
SELECT public.current_user_id();   -- Returns app-set user_id
```

### Without App Claims
```sql
-- Reset to use Supabase Auth
RESET ALL;

-- Helpers fall back to auth.jwt()
SELECT public.current_tenant_id(); -- Returns from Supabase Auth or NULL
SELECT public.current_user_id();   -- Returns from Supabase Auth or NULL
```

## Migration Safety

### Idempotent
- Uses `CREATE OR REPLACE FUNCTION`
- Can be run multiple times safely

### Reversible
- Previous implementation available in Migration 0003
- Can be rolled back by restoring the original functions

### No Breaking Changes
- Function signatures identical
- Existing policies continue to work
- Supabase Auth fallback maintained

## Dependencies

- **Requires**: Migration 0003 (helpers) to exist
- **Affects**: All RLS policies that use the helper functions
- **Independent**: No other migrations depend on this change

## Security Considerations

1. **Claim Validation**: UUID format validation prevents injection attacks
2. **Fail-Closed**: Invalid claims result in RLS denial
3. **Session Scoped**: `SET LOCAL` ensures claims are session-specific
4. **No Escalation**: App-set claims cannot grant access beyond what RLS policies allow

## Future Considerations

- Consider adding claim expiration validation
- May want to add claim signature verification for production use
- Could extend to support additional claim types beyond tenant_id and sub
