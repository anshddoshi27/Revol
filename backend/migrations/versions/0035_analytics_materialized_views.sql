-- P0028 — Analytics Materialized Views
-- Creates analytics materialized views and aggregated counters
-- Implements comprehensive analytics system for reporting and insights

BEGIN;

-- Create revenue_analytics materialized view
DROP MATERIALIZED VIEW IF EXISTS public.revenue_analytics;
CREATE MATERIALIZED VIEW public.revenue_analytics AS
SELECT 
    b.tenant_id,
    DATE(b.start_at) as date,
    EXTRACT(week FROM b.start_at) as week,
    EXTRACT(month FROM b.start_at) as month,
    EXTRACT(quarter FROM b.start_at) as quarter,
    EXTRACT(year FROM b.start_at) as year,
    
    -- Booking counts
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE b.status = 'completed') as completed_bookings,
    COUNT(*) FILTER (WHERE b.status = 'canceled') as canceled_bookings,
    COUNT(*) FILTER (WHERE b.status = 'no_show') as no_show_bookings,
    
    -- Revenue calculations
    COALESCE(SUM(bi.price_cents), 0) as total_revenue_cents,
    COALESCE(SUM(bi.price_cents) FILTER (WHERE b.status = 'completed'), 0) as completed_revenue_cents,
    COALESCE(SUM(r.amount_cents) FILTER (WHERE r.status = 'succeeded'), 0) as refunded_revenue_cents,
    
    -- Averages
    CASE 
        WHEN COUNT(*) > 0 THEN COALESCE(SUM(bi.price_cents), 0) / COUNT(*)
        ELSE 0 
    END as avg_booking_value_cents,
    CASE 
        WHEN COUNT(*) FILTER (WHERE b.status = 'completed') > 0 
        THEN COALESCE(SUM(bi.price_cents) FILTER (WHERE b.status = 'completed'), 0) / COUNT(*) FILTER (WHERE b.status = 'completed')
        ELSE 0 
    END as avg_completed_booking_value_cents,
    
    -- Unique counts
    COUNT(DISTINCT b.customer_id) as unique_customers,
    COUNT(DISTINCT b.customer_id) FILTER (WHERE b.status = 'completed') as unique_completed_customers,
    COUNT(DISTINCT b.resource_id) as unique_resources,
    
    -- Time ranges
    MIN(b.start_at) as first_booking_at,
    MAX(b.start_at) as last_booking_at,
    now() as last_updated
    
FROM public.bookings b
LEFT JOIN public.booking_items bi ON bi.booking_id = b.id
LEFT JOIN public.refunds r ON r.booking_id = b.id
WHERE b.tenant_id IS NOT NULL
GROUP BY b.tenant_id, DATE(b.start_at), EXTRACT(week FROM b.start_at), 
         EXTRACT(month FROM b.start_at), EXTRACT(quarter FROM b.start_at), EXTRACT(year FROM b.start_at);

-- Create customer_analytics materialized view
DROP MATERIALIZED VIEW IF EXISTS public.customer_analytics;
CREATE MATERIALIZED VIEW public.customer_analytics AS
SELECT 
    c.tenant_id,
    c.id as customer_id,
    c.display_name,
    c.email,
    c.customer_first_booking_at,
    
    -- Booking counts
    COUNT(b.id) as total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'canceled') as canceled_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'no_show') as no_show_bookings,
    
    -- Revenue calculations
    COALESCE(SUM(bi.price_cents), 0) as total_spent_cents,
    COALESCE(SUM(bi.price_cents) FILTER (WHERE b.status = 'completed'), 0) as completed_spent_cents,
    COALESCE(SUM(r.amount_cents) FILTER (WHERE r.status = 'succeeded'), 0) as refunded_cents,
    
    -- Averages
    CASE 
        WHEN COUNT(b.id) > 0 THEN COALESCE(SUM(bi.price_cents), 0) / COUNT(b.id)
        ELSE 0 
    END as avg_booking_value_cents,
    CASE 
        WHEN COUNT(b.id) FILTER (WHERE b.status = 'completed') > 0 
        THEN COALESCE(SUM(bi.price_cents) FILTER (WHERE b.status = 'completed'), 0) / COUNT(b.id) FILTER (WHERE b.status = 'completed')
        ELSE 0 
    END as avg_completed_booking_value_cents,
    
    -- Time analysis
    MIN(b.start_at) as first_booking_at,
    MAX(b.start_at) as last_booking_at,
    CASE 
        WHEN COUNT(b.id) > 1 
        THEN EXTRACT(epoch FROM (MAX(b.start_at) - MIN(b.start_at))) / (COUNT(b.id) - 1) / 86400
        ELSE NULL 
    END as avg_days_between_bookings,
    
    -- Customer status
    CASE 
        WHEN MAX(b.start_at) > now() - interval '30 days' THEN 'active'
        WHEN MAX(b.start_at) > now() - interval '90 days' THEN 'inactive'
        ELSE 'dormant'
    END as customer_status,
    
    now() as last_updated
    
FROM public.customers c
LEFT JOIN public.bookings b ON b.customer_id = c.id
LEFT JOIN public.booking_items bi ON bi.booking_id = b.id
LEFT JOIN public.refunds r ON r.booking_id = b.id
WHERE c.tenant_id IS NOT NULL
GROUP BY c.tenant_id, c.id, c.display_name, c.email, c.customer_first_booking_at;

-- Create service_analytics materialized view
DROP MATERIALIZED VIEW IF EXISTS public.service_analytics;
CREATE MATERIALIZED VIEW public.service_analytics AS
SELECT 
    s.tenant_id,
    s.id as service_id,
    s.name as service_name,
    s.category,
    s.price_cents,
    s.duration_min,
    
    -- Booking counts
    COUNT(b.id) as total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'canceled') as canceled_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'no_show') as no_show_bookings,
    
    -- Revenue calculations
    COALESCE(SUM(bi.price_cents), 0) as total_revenue_cents,
    COALESCE(SUM(bi.price_cents) FILTER (WHERE b.status = 'completed'), 0) as completed_revenue_cents,
    
    -- Unique counts
    COUNT(DISTINCT b.customer_id) as unique_customers,
    COUNT(DISTINCT b.customer_id) FILTER (WHERE b.status = 'completed') as unique_completed_customers,
    COUNT(DISTINCT b.resource_id) as unique_resources,
    
    -- Time analysis
    MIN(b.start_at) as first_booking_at,
    MAX(b.start_at) as last_booking_at,
    COUNT(b.id) FILTER (WHERE b.start_at > now() - interval '30 days') as bookings_last_30_days,
    COUNT(b.id) FILTER (WHERE b.start_at > now() - interval '7 days') as bookings_last_7_days,
    
    now() as last_updated
    
FROM public.services s
LEFT JOIN public.bookings b ON (b.service_snapshot->>'id')::uuid = s.id
LEFT JOIN public.booking_items bi ON bi.booking_id = b.id
WHERE s.tenant_id IS NOT NULL
GROUP BY s.tenant_id, s.id, s.name, s.category, s.price_cents, s.duration_min;

-- Create staff_performance_analytics materialized view
DROP MATERIALIZED VIEW IF EXISTS public.staff_performance_analytics;
CREATE MATERIALIZED VIEW public.staff_performance_analytics AS
SELECT 
    sp.tenant_id,
    sp.id as staff_profile_id,
    sp.display_name as staff_name,
    sp.specialties,
    sp.hourly_rate_cents,
    sp.resource_id,
    r.name as resource_name,
    
    -- Booking counts
    COUNT(b.id) as total_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'completed') as completed_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'canceled') as canceled_bookings,
    COUNT(b.id) FILTER (WHERE b.status = 'no_show') as no_show_bookings,
    
    -- Revenue calculations
    COALESCE(SUM(bi.price_cents), 0) as total_revenue_cents,
    COALESCE(SUM(bi.price_cents) FILTER (WHERE b.status = 'completed'), 0) as completed_revenue_cents,
    
    -- Unique counts
    COUNT(DISTINCT b.customer_id) as unique_customers,
    COUNT(DISTINCT b.customer_id) FILTER (WHERE b.status = 'completed') as unique_completed_customers,
    
    -- Time analysis
    MIN(b.start_at) as first_booking_at,
    MAX(b.start_at) as last_booking_at,
    COUNT(b.id) FILTER (WHERE b.start_at > now() - interval '30 days') as bookings_last_30_days,
    COUNT(b.id) FILTER (WHERE b.start_at > now() - interval '7 days') as bookings_last_7_days,
    
    -- Hours worked
    COALESCE(SUM(EXTRACT(epoch FROM (b.end_at - b.start_at)) / 3600), 0) as total_hours_worked,
    COALESCE(SUM(EXTRACT(epoch FROM (b.end_at - b.start_at)) / 3600) FILTER (WHERE b.status = 'completed'), 0) as completed_hours_worked,
    
    now() as last_updated
    
FROM public.staff_profiles sp
LEFT JOIN public.resources r ON r.id = sp.resource_id
LEFT JOIN public.bookings b ON b.resource_id = sp.resource_id
LEFT JOIN public.booking_items bi ON bi.booking_id = b.id
WHERE sp.tenant_id IS NOT NULL
GROUP BY sp.tenant_id, sp.id, sp.display_name, sp.specialties, sp.hourly_rate_cents, 
         sp.resource_id, r.name;

-- Create indexes for materialized views
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_tenant_date 
ON public.revenue_analytics(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_customer_analytics_tenant_customer 
ON public.customer_analytics(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_service_analytics_tenant_service 
ON public.service_analytics(tenant_id, service_id);

CREATE INDEX IF NOT EXISTS idx_staff_performance_analytics_tenant_staff 
ON public.staff_performance_analytics(tenant_id, staff_profile_id);

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW public.revenue_analytics IS 'Aggregated revenue data for charts and reporting';
COMMENT ON MATERIALIZED VIEW public.customer_analytics IS 'Customer behavior and lifetime value analytics';
COMMENT ON MATERIALIZED VIEW public.service_analytics IS 'Service performance and popularity analytics';
COMMENT ON MATERIALIZED VIEW public.staff_performance_analytics IS 'Staff performance and productivity analytics';

COMMIT;
