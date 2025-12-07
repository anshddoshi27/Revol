-- ============================================================================
-- FINAL FIX: businesses.user_id foreign key constraint for TITHI2
-- ============================================================================
-- This script will:
-- 1. Check current state
-- 2. Drop ALL foreign keys on businesses.user_id (in case name is different)
-- 3. Recreate it correctly
-- 4. Verify it worked
-- ============================================================================

-- Step 1: Check what foreign keys exist on businesses.user_id
SELECT 
  'BEFORE: Current foreign keys on businesses.user_id' as step,
  tc.constraint_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- Step 2: Drop ALL foreign key constraints on businesses.user_id
-- (We'll drop them all and recreate the correct one)
DO $$
DECLARE
  constraint_name_var text;
BEGIN
  -- Find all foreign key constraints on businesses.user_id
  FOR constraint_name_var IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'businesses'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id'
  LOOP
    EXECUTE 'ALTER TABLE businesses DROP CONSTRAINT IF EXISTS ' || constraint_name_var;
    RAISE NOTICE 'Dropped constraint: %', constraint_name_var;
  END LOOP;
END $$;

-- Step 3: Recreate the constraint correctly
ALTER TABLE businesses 
  ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Step 4: Verify it was created correctly
SELECT 
  'AFTER: New constraint' as step,
  tc.constraint_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table,
  CASE 
    WHEN ccu.table_schema = 'auth' AND ccu.table_name = 'users' 
    THEN '✅ SUCCESS - Constraint is correct!'
    ELSE '❌ ERROR - Still wrong: ' || ccu.table_schema || '.' || ccu.table_name
  END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- If you see "✅ SUCCESS" above, the fix worked!
-- Try the payment setup again in your app.


