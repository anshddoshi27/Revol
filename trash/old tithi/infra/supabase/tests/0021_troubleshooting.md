# Troubleshooting Migration 0021

## Common Issues and Solutions

### 1. Column "name" does not exist in tenants table

**Error**: `ERROR: 42703: column "name" of relation "tenants" does not exist`

**Cause**: The test file was using incorrect column names that don't match the actual database schema.

**Solution**: ✅ **FIXED** - The test file has been updated to use the correct column names:
- `tenants` table: `slug`, `tz`, `is_public_directory` (not `name`, `status`)
- `users` table: `display_name`, `primary_email` (not `full_name`, `email`)
- `memberships` table: `role` only (not `status`)

### 2. Column "status" does not exist in memberships table

**Error**: `ERROR: 42703: column "status" of relation "memberships" does not exist`

**Cause**: The `memberships` table doesn't have a `status` column.

**Solution**: ✅ **FIXED** - The test file now only inserts the required columns: `tenant_id`, `user_id`, `role`.

### 3. How to Run the Migration

1. **First, apply the migration**:
   ```sql
   \i infra/supabase/migrations/0021_update_helpers_app_claims.sql
   ```

2. **Then run the simple validation**:
   ```sql
   \i infra/supabase/tests/0021_simple_validation.sql
   ```

3. **For comprehensive testing** (after fixing column issues):
   ```sql
   \i infra/supabase/tests/0021_helpers_app_claims_validation.sql
   ```

### 4. Expected Behavior After Migration

- **App-set claims take priority**: When `SET LOCAL "request.jwt.claims"` is set, helpers return those values
- **Fallback to Supabase Auth**: When app-set claims are not provided, helpers fall back to `auth.jwt()`
- **Fail-closed security**: Invalid claims result in NULL, ensuring RLS denial

### 5. Testing the Migration

#### Quick Test
```sql
-- Set app claims
SET LOCAL "request.jwt.claims" = '{"tenant_id": "11111111-1111-1111-1111-111111111111", "sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Should return app-set values
SELECT public.current_tenant_id(); -- Returns: 11111111-1111-1111-1111-111111111111
SELECT public.current_user_id();   -- Returns: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa

-- Reset to test fallback
RESET ALL;

-- Should return NULL (fail closed)
SELECT public.current_tenant_id(); -- Returns: NULL
SELECT public.current_user_id();   -- Returns: NULL
```

### 6. Rollback if Needed

If you need to revert the migration:
```sql
\i infra/supabase/migrations/0021_rollback_helpers.sql
```

### 7. Verification Commands

Check that the functions exist and have correct signatures:
```sql
SELECT 
  p.proname,
  pg_catalog.format_type(p.prorettype, NULL) as return_type,
  p.provolatile,
  p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN ('current_tenant_id', 'current_user_id')
ORDER BY p.proname;
```

Expected output:
- `current_tenant_id` | `uuid` | `s` (STABLE) | `f` (SECURITY INVOKER)
- `current_user_id` | `uuid` | `s` (STABLE) | `f` (SECURITY INVOKER)

### 8. Still Having Issues?

1. **Check database schema**: Verify the actual table structures match expectations
2. **Run simple validation first**: Use `0021_simple_validation.sql` before the comprehensive tests
3. **Check migration status**: Ensure Migration 0003 (helpers) exists and Migration 0021 was applied
4. **Review error messages**: Look for specific column or constraint violations

### 9. Migration Dependencies

- **Requires**: Migration 0003 (helper functions)
- **Affects**: All RLS policies that use the helper functions
- **Independent**: No other migrations depend on this change
