-- Quick fix script for businesses.user_id foreign key constraint
-- Run this in Supabase Dashboard > SQL Editor

-- Drop the existing constraint if it exists (regardless of what it references)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_fkey;

-- Recreate it to correctly reference auth.users
ALTER TABLE businesses 
  ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Verify the constraint was created correctly
SELECT 
  tc.constraint_name,
  ccu.table_schema,
  ccu.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_name = 'businesses_user_id_fkey'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Should show: businesses_user_id_fkey | auth | users


