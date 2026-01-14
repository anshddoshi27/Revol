-- ============================================================================
-- VERIFY: Check if the constraint fix worked
-- ============================================================================
-- Run this AFTER running FIX_CONSTRAINT_TITHI2.sql
-- ============================================================================

-- Check 1: Does the constraint exist at all?
SELECT 
  'Constraint Exists?' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN 'YES ✅'
    ELSE 'NO ❌ - Constraint was dropped but not recreated!'
  END as result,
  COUNT(*) as constraint_count
FROM information_schema.table_constraints 
WHERE table_name = 'businesses'
  AND constraint_name = 'businesses_user_id_fkey'
  AND constraint_type = 'FOREIGN KEY';

-- Check 2: What does it reference? (This is the important one)
SELECT 
  'What it references' as check_type,
  tc.constraint_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table,
  CASE 
    WHEN ccu.table_schema = 'auth' AND ccu.table_name = 'users' 
    THEN '✅ CORRECT - References auth.users'
    ELSE '❌ WRONG - References ' || ccu.table_schema || '.' || ccu.table_name
  END as status
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_name = 'businesses_user_id_fkey'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Check 3: List ALL foreign keys on businesses table (in case name is different)
SELECT 
  'All foreign keys on businesses' as check_type,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'businesses'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- If Check 1 shows "NO", the constraint wasn't recreated. Run this:
-- ALTER TABLE businesses 
--   ADD CONSTRAINT businesses_user_id_fkey 
--   FOREIGN KEY (user_id) 
--   REFERENCES auth.users(id) 
--   ON DELETE CASCADE;



