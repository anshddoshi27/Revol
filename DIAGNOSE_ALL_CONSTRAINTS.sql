-- ============================================================================
-- DIAGNOSE: Find ALL constraints on businesses table
-- ============================================================================
-- This will show us what's actually in the database
-- ============================================================================

-- Check 1: All foreign key constraints on businesses table
SELECT 
  'All Foreign Keys on businesses' as check_type,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- Check 2: All constraints on businesses table (any type)
SELECT 
  'All Constraints on businesses' as check_type,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'businesses'
ORDER BY constraint_type, constraint_name;

-- Check 3: Check if user_id column exists and its type
SELECT 
  'user_id column info' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'businesses'
  AND column_name = 'user_id';

-- Check 4: Try to see what happens when we try to create the constraint
-- (This won't actually create it, just check if it would work)
SELECT 
  'Test: Can we reference auth.users?' as check_type,
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'users'
  ) as auth_users_table_exists;



