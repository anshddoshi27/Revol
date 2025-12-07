-- ============================================================================
-- FIX: businesses.user_id foreign key constraint
-- ============================================================================
-- PROBLEM: The constraint references a non-existent "users" table
-- SOLUTION: Drop and recreate it to reference auth.users(id)
-- ============================================================================
-- INSTRUCTIONS: Copy ALL of this file and paste into Supabase Dashboard > SQL Editor
-- ============================================================================

-- Step 1: Drop the incorrect constraint
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_fkey;

-- Step 2: Recreate it correctly
ALTER TABLE businesses 
  ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Step 3: Verify it worked (this should show: auth | users)
SELECT 
  'Constraint fixed!' as status,
  ccu.table_schema as references_schema,
  ccu.table_name as references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_name = 'businesses_user_id_fkey'
  AND tc.constraint_type = 'FOREIGN KEY';

-- If you see: references_schema = 'auth' and references_table = 'users', you're done! ✅


