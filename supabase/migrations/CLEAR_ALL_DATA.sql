-- ============================================================================
-- CLEAR ALL DATA FROM DATABASE
-- ============================================================================
-- This script deletes all data from all tables to allow fresh testing
-- with the same email addresses.
-- 
-- WARNING: This will delete ALL data from the database!
-- Run this script only in development/testing environments.
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard: https://app.supabase.com
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run" (or press Cmd/Ctrl + Enter)
--
-- NOTE: If auth.users deletion fails due to permissions, you can:
-- - Delete auth users manually via Supabase Dashboard > Authentication > Users
-- - Or use the Supabase Management API
-- ============================================================================

BEGIN;

-- Disable triggers temporarily to speed up deletion
SET session_replication_role = 'replica';

-- Delete in reverse dependency order (children first, then parents)

-- 1. Delete from tables with foreign keys to other application tables
DELETE FROM gift_card_ledger;
DELETE FROM booking_payments;
DELETE FROM notification_events;
DELETE FROM notification_jobs;
DELETE FROM bookings;
DELETE FROM idempotency_keys;

-- 2. Delete from tables that reference other application tables
DELETE FROM staff_services;
DELETE FROM availability_rules;
DELETE FROM blackouts;
DELETE FROM gift_cards;
DELETE FROM notification_templates;

-- 3. Delete from core business tables
DELETE FROM services;
DELETE FROM service_categories;
DELETE FROM staff;
DELETE FROM customers;
DELETE FROM business_policies;

-- 4. Delete from root business table
DELETE FROM businesses;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- 5. Delete from auth.users (this allows reusing email addresses)
-- Note: This may require service role permissions
-- If this fails, delete users manually via Supabase Dashboard > Authentication
DO $$
BEGIN
  DELETE FROM auth.users;
  RAISE NOTICE 'Successfully deleted all auth users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Cannot delete auth.users - insufficient privileges. Please delete users manually via Supabase Dashboard > Authentication > Users';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error deleting auth.users: %', SQLERRM;
    RAISE NOTICE 'Please delete users manually via Supabase Dashboard > Authentication > Users';
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run separately to verify deletion)
-- ============================================================================

-- Uncomment and run these queries to verify all data is deleted:

-- SELECT 'businesses' as table_name, COUNT(*) as row_count FROM businesses
-- UNION ALL
-- SELECT 'customers', COUNT(*) FROM customers
-- UNION ALL
-- SELECT 'bookings', COUNT(*) FROM bookings
-- UNION ALL
-- SELECT 'services', COUNT(*) FROM services
-- UNION ALL
-- SELECT 'staff', COUNT(*) FROM staff
-- UNION ALL
-- SELECT 'gift_cards', COUNT(*) FROM gift_cards
-- UNION ALL
-- SELECT 'booking_payments', COUNT(*) FROM booking_payments
-- UNION ALL
-- SELECT 'auth.users', COUNT(*) FROM auth.users;

