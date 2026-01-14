-- P0033 — Phase 2 RLS Policies
-- Adds Row Level Security policies for Phase 2 tables
-- Ensures tenant isolation for booking_holds, waitlist_entries, and availability_cache

BEGIN;

-- Enable RLS on new tables
ALTER TABLE public.booking_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_cache ENABLE ROW LEVEL SECURITY;

-- Booking holds policies
CREATE POLICY "booking_holds_sel" ON public.booking_holds
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "booking_holds_ins" ON public.booking_holds
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "booking_holds_upd" ON public.booking_holds
    FOR UPDATE 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "booking_holds_del" ON public.booking_holds
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Waitlist entries policies
CREATE POLICY "waitlist_entries_sel" ON public.waitlist_entries
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "waitlist_entries_ins" ON public.waitlist_entries
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "waitlist_entries_upd" ON public.waitlist_entries
    FOR UPDATE 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "waitlist_entries_del" ON public.waitlist_entries
    FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Availability cache policies
CREATE POLICY "availability_cache_sel" ON public.availability_cache
    FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_cache_ins" ON public.availability_cache
    FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_cache_upd" ON public.availability_cache
    FOR UPDATE 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_cache_del" ON public.availability_cache
    FOR DELETE USING (tenant_id = public.current_tenant_id());

COMMIT;