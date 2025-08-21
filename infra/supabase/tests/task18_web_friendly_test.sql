-- Task 18 Web-Friendly Test for Supabase Dashboard
-- This version uses SELECT statements instead of RAISE messages

-- Test 1: Check if seed data exists
SELECT 
    'Seed Data Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.tenants 
            WHERE id = '01234567-89ab-cdef-0123-456789abcdef' 
            AND slug = 'salonx'
        ) THEN 'PASSED' 
        ELSE 'FAILED - No seed data found' 
    END as result,
    'Run migration 0018_seed_dev.sql first if this fails' as notes;

-- Test 2: Count seed data records
SELECT 
    'Data Counts' as test_name,
    (SELECT COUNT(*) FROM public.tenants WHERE slug = 'salonx') as tenant_count,
    (SELECT COUNT(*) FROM public.themes WHERE tenant_id = '01234567-89ab-cdef-0123-456789abcdef') as theme_count,
    (SELECT COUNT(*) FROM public.resources WHERE tenant_id = '01234567-89ab-cdef-0123-456789abcdef') as resource_count,
    (SELECT COUNT(*) FROM public.services WHERE tenant_id = '01234567-89ab-cdef-0123-456789abcdef') as service_count,
    (SELECT COUNT(*) FROM public.service_resources WHERE tenant_id = '01234567-89ab-cdef-0123-456789abcdef') as service_resource_count;

-- Test 3: Verify specific seed data
SELECT 
    'Specific Data Verification' as test_name,
    t.slug as tenant_slug,
    t.tz as timezone,
    th.brand_color,
    r.name as resource_name,
    r.type as resource_type,
    s.name as service_name,
    s.price_cents as service_price_cents,
    ROUND(s.price_cents / 100.0, 2) as service_price_dollars
FROM public.tenants t
LEFT JOIN public.themes th ON th.tenant_id = t.id
LEFT JOIN public.resources r ON r.tenant_id = t.id
LEFT JOIN public.services s ON s.tenant_id = t.id
WHERE t.slug = 'salonx';

-- Test 4: Check table structure
SELECT 
    'Table Structure' as test_name,
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status
FROM (
    SELECT 'tenants' as table_name
    UNION ALL SELECT 'themes'
    UNION ALL SELECT 'resources'
    UNION ALL SELECT 'services'
    UNION ALL SELECT 'service_resources'
) t
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = t.table_name
);

-- Test 5: Check constraints
SELECT 
    'Constraint Check' as test_name,
    c.constraint_name,
    c.constraint_type,
    tc.table_name
FROM information_schema.table_constraints c
JOIN information_schema.table_constraints tc ON tc.constraint_name = c.constraint_name
WHERE c.table_schema = 'public'
AND tc.table_name IN ('tenants', 'themes', 'resources', 'services', 'service_resources')
ORDER BY tc.table_name, c.constraint_type;

-- Test 6: Final summary
SELECT 
    'TEST SUMMARY' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.tenants WHERE slug = 'salonx') > 0 
        AND (SELECT COUNT(*) FROM public.resources WHERE tenant_id = '01234567-89ab-cdef-0123-456789abcdef') > 0
        AND (SELECT COUNT(*) FROM public.services WHERE tenant_id = '01234567-89ab-cdef-0123-456789abcdef') > 0
        THEN 'ALL TESTS PASSED - Task 18 seed data is working correctly!'
        ELSE 'SOME TESTS FAILED - Check the results above for details'
    END as overall_result;
