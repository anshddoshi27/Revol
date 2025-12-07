-- ============================================================================
-- SIMPLE: Find the constraint that's causing the error
-- ============================================================================
-- The error says: "businesses_user_id_fkey"
-- Let's find it directly
-- ============================================================================

-- Method 1: Direct lookup by constraint name (from error message)
SELECT 
  'Method 1: Direct lookup' as method,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'businesses_user_id_fkey';

-- Method 2: Find ALL constraints with "user_id" in the name
SELECT 
  'Method 2: All user_id constraints' as method,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_name LIKE '%user_id%'
  AND tc.table_name = 'businesses';

-- Method 3: Use pg_constraint directly (PostgreSQL system catalog)
SELECT 
  'Method 3: PostgreSQL system catalog' as method,
  con.conname AS constraint_name,
  con.conrelid::regclass AS table_name,
  con.confrelid::regclass AS referenced_table,
  nsp.nspname AS referenced_schema
FROM pg_constraint con
JOIN pg_namespace nsp ON nsp.oid = con.connamespace
WHERE con.conrelid = 'businesses'::regclass
  AND con.contype = 'f'
  AND con.conname LIKE '%user_id%';

-- Method 4: Get constraint definition directly
SELECT 
  'Method 4: Constraint definition' as method,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'businesses_user_id_fkey';

