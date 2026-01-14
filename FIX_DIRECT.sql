-- ============================================================================
-- DIRECT FIX: Drop and recreate the constraint
-- ============================================================================
-- This is the simplest approach - just drop it and recreate it correctly
-- ============================================================================

-- Step 1: Drop the constraint (it exists, we know from the error message)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_fkey;

-- Step 2: Recreate it correctly
ALTER TABLE businesses 
  ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Step 3: Verify using pg_constraint (most reliable)
SELECT 
  'Constraint fixed!' as status,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'businesses_user_id_fkey';

-- The constraint_definition should show: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- If it shows "users" instead of "auth.users", the fix didn't work



