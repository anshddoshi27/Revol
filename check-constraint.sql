-- Diagnostic query to check what the businesses.user_id foreign key actually references
-- Run this in Supabase Dashboard > SQL Editor to see the current state

SELECT 
  tc.constraint_name,
  tc.table_name,
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
  AND kcu.column_name = 'user_id';

-- This will show you what the constraint currently references
-- If it shows: referenced_schema = 'public' and referenced_table = 'users', that's the problem
-- It should show: referenced_schema = 'auth' and referenced_table = 'users'


