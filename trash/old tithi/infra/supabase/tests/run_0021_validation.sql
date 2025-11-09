-- =================================================================
-- Test Runner for Migration 0021: Helper Functions App Claims
-- =================================================================
-- 
-- This script runs the comprehensive validation suite for the updated
-- helper functions that prioritize app-set claims over Supabase Auth.
-- =================================================================

-- Set output format for better readability
\pset format expanded
\pset tuples_only off

-- Display test start message
\echo '================================================================='
\echo 'Starting Migration 0021 Validation Tests'
\echo '================================================================='
\echo ''

-- Run the comprehensive validation suite
\i infra/supabase/tests/0021_helpers_app_claims_validation.sql

-- Display completion message
\echo ''
\echo '================================================================='
\echo 'Migration 0021 Validation Complete'
\echo '================================================================='
\echo ''
\echo 'Check the test results above to verify:'
\echo '1. App-set claims take priority over Supabase Auth'
\echo '2. Fallback to Supabase Auth when app-set claims not provided'
\echo '3. RLS policies work correctly with both claim sources'
\echo '4. Cross-tenant access is properly denied'
\echo '5. Helper function signatures remain unchanged'
\echo ''

-- Reset output format
\pset format aligned
\pset tuples_only on
