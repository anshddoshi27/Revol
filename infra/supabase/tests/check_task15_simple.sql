-- Simple check for Task 15 compliance
-- Lists all tables with tenant_id and their current policy count

-- Tables with tenant_id column (excluding Task 16 special tables)
WITH tenant_tables AS (
  SELECT c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r' -- ordinary tables
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attisdropped = false
    )
    AND c.relname NOT IN ('tenants','users','memberships','themes','tenant_billing','quotas')
),
-- Policy counts per table
policy_counts AS (
  SELECT 
    p.tablename,
    count(*) FILTER (WHERE p.cmd = 'SELECT') AS sel_count,
    count(*) FILTER (WHERE p.cmd = 'INSERT') AS ins_count,
    count(*) FILTER (WHERE p.cmd = 'UPDATE') AS upd_count,
    count(*) FILTER (WHERE p.cmd = 'DELETE') AS del_count,
    count(*) AS total_policies
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  GROUP BY p.tablename
)
SELECT 
  t.tablename,
  COALESCE(p.sel_count, 0) as select_policies,
  COALESCE(p.ins_count, 0) as insert_policies, 
  COALESCE(p.upd_count, 0) as update_policies,
  COALESCE(p.del_count, 0) as delete_policies,
  COALESCE(p.total_policies, 0) as total_policies,
  CASE 
    WHEN COALESCE(p.sel_count, 0) = 1 AND 
         COALESCE(p.ins_count, 0) = 1 AND 
         COALESCE(p.upd_count, 0) = 1 AND 
         COALESCE(p.del_count, 0) = 1 THEN 'PASS'
    ELSE 'FAIL'
  END as status
FROM tenant_tables t
LEFT JOIN policy_counts p ON t.tablename = p.tablename
ORDER BY t.tablename;

-- Summary
SELECT 
  COUNT(*) as total_tenant_tables,
  COUNT(*) FILTER (WHERE 
    COALESCE(p.sel_count, 0) = 1 AND 
    COALESCE(p.ins_count, 0) = 1 AND 
    COALESCE(p.upd_count, 0) = 1 AND 
    COALESCE(p.del_count, 0) = 1
  ) as compliant_tables,
  COUNT(*) - COUNT(*) FILTER (WHERE 
    COALESCE(p.sel_count, 0) = 1 AND 
    COALESCE(p.ins_count, 0) = 1 AND 
    COALESCE(p.upd_count, 0) = 1 AND 
    COALESCE(p.del_count, 0) = 1
  ) as non_compliant_tables
FROM tenant_tables t
LEFT JOIN policy_counts p ON t.tablename = p.tablename;
