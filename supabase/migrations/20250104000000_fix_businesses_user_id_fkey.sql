-- Fix businesses.user_id foreign key to reference auth.users instead of users table
-- The constraint might be incorrectly referencing public.users instead of auth.users

-- Drop the existing constraint if it exists (regardless of what it references)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_fkey;

-- Recreate it to correctly reference auth.users
ALTER TABLE businesses 
  ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Verify the constraint was created correctly
DO $$
DECLARE
  ref_table text;
  ref_schema text;
BEGIN
  SELECT 
    ccu.table_schema,
    ccu.table_name
  INTO ref_schema, ref_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'businesses'
    AND tc.constraint_name = 'businesses_user_id_fkey'
    AND tc.constraint_type = 'FOREIGN KEY';
  
  IF ref_schema = 'auth' AND ref_table = 'users' THEN
    RAISE NOTICE 'SUCCESS: businesses_user_id_fkey now correctly references auth.users';
  ELSE
    RAISE WARNING 'WARNING: businesses_user_id_fkey references %.% (expected auth.users)', ref_schema, ref_table;
  END IF;
END $$;

