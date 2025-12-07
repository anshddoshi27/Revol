-- ============================================================================
-- FIX: businesses.user_id foreign key constraint for TITHI2 project
-- ============================================================================
-- PROBLEM: The constraint references a non-existent "users" table
-- SOLUTION: Drop and recreate it to reference auth.users(id)
-- ============================================================================
-- INSTRUCTIONS: 
-- 1. Make sure you're in the TITHI2 Supabase project (not TITHI)
-- 2. Go to Supabase Dashboard > SQL Editor
-- 3. Copy ALL of this file and paste it
-- 4. Click Run
-- 5. Check the output - it should show: referenced_schema = 'auth', referenced_table = 'users'
-- ============================================================================

-- Step 1: Check current state (for debugging)
SELECT 
  'BEFORE FIX' as status,
  ccu.table_schema as referenced_schema,
  ccu.table_name as referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_name = 'businesses_user_id_fkey'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Step 2: Drop the incorrect constraint
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_fkey;

-- Step 3: Recreate it correctly to reference auth.users(id)
ALTER TABLE businesses 
  ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Step 4: Verify it worked (should show: auth | users)
SELECT 
  'AFTER FIX' as status,
  ccu.table_schema as referenced_schema,
  ccu.table_name as referenced_table,
  CASE 
    WHEN ccu.table_schema = 'auth' AND ccu.table_name = 'users' 
    THEN '✅ SUCCESS - Constraint is now correct!'
    ELSE '❌ ERROR - Constraint is still wrong'
  END as result
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_name = 'businesses_user_id_fkey'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Step 5: Test that it works (this should succeed now)
-- Uncomment the line below to test with your actual user ID:
-- INSERT INTO businesses (user_id, name, subdomain, timezone) 
-- VALUES ('d9d1a8cb-0840-4caf-8864-7dd75928d903', 'Test Business', 'test-fix', 'America/New_York');

-- If you see "✅ SUCCESS" above, the fix worked!
-- You can now try the payment setup again in your app.


