BEGIN;

-- ============================================================================
-- Task 16: Special RLS Policies for Cross-Tenant Tables
-- ============================================================================
-- These policies handle tables with special access patterns that don't follow
-- the standard tenant-scoped model from 0015_policies_standard.sql
--
-- Key patterns:
-- - tenants: member-gated SELECT, service-role writes only
-- - users: self or shared-tenant access
-- - memberships: member reads, owner/admin writes
-- - themes/tenant_billing/quotas: member reads, owner/admin writes
-- - webhook_events_inbox: service-role only
-- - events_outbox: members + service-role delivery reads

-- Drop existing policies if they exist to ensure clean recreation
DROP POLICY IF EXISTS "tenants_sel_members" ON public.tenants;
DROP POLICY IF EXISTS "users_sel_self_or_shared_tenant" ON public.users;
DROP POLICY IF EXISTS "memberships_sel_members" ON public.memberships;
DROP POLICY IF EXISTS "memberships_ins_owner_admin" ON public.memberships;
DROP POLICY IF EXISTS "memberships_upd_owner_admin" ON public.memberships;
DROP POLICY IF EXISTS "memberships_del_owner_admin" ON public.memberships;
DROP POLICY IF EXISTS "themes_sel_members" ON public.themes;
DROP POLICY IF EXISTS "themes_ins_owner_admin" ON public.themes;
DROP POLICY IF EXISTS "themes_upd_owner_admin" ON public.themes;
DROP POLICY IF EXISTS "themes_del_owner_admin" ON public.themes;
DROP POLICY IF EXISTS "tenant_billing_sel_members" ON public.tenant_billing;
DROP POLICY IF EXISTS "tenant_billing_ins_owner_admin" ON public.tenant_billing;
DROP POLICY IF EXISTS "tenant_billing_upd_owner_admin" ON public.tenant_billing;
DROP POLICY IF EXISTS "tenant_billing_del_owner_admin" ON public.tenant_billing;
DROP POLICY IF EXISTS "quotas_sel_members" ON public.quotas;
DROP POLICY IF EXISTS "quotas_ins_owner_admin" ON public.quotas;
DROP POLICY IF EXISTS "quotas_upd_owner_admin" ON public.quotas;
DROP POLICY IF EXISTS "quotas_del_owner_admin" ON public.quotas;
DROP POLICY IF EXISTS "events_outbox_sel_members_and_service" ON public.events_outbox;
DROP POLICY IF EXISTS "events_outbox_ins_members" ON public.events_outbox;
DROP POLICY IF EXISTS "events_outbox_upd_members" ON public.events_outbox;
DROP POLICY IF EXISTS "events_outbox_del_members" ON public.events_outbox;

-- ============================================================================
-- Policies for: tenants
-- ============================================================================

-- SELECT: Only if requester is a member of the tenant
CREATE POLICY "tenants_sel_members"
  ON public.tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = tenants.id
        AND m.user_id = public.current_user_id()
    )
  );

-- No INSERT/UPDATE/DELETE policies for tenants from authenticated users
-- All writes must come through service-role

-- ============================================================================
-- Policies for: users  
-- ============================================================================

-- SELECT: Self or any user in a shared tenant
CREATE POLICY "users_sel_self_or_shared_tenant"
  ON public.users
  FOR SELECT  
  USING (
    -- Allow reading self
    id = public.current_user_id()
    OR
    -- Allow reading users in shared tenants
    EXISTS (
      SELECT 1 FROM public.memberships m1
      JOIN public.memberships m2 ON m1.tenant_id = m2.tenant_id
      WHERE m1.user_id = public.current_user_id()
        AND m2.user_id = users.id
    )
  );

-- No INSERT/UPDATE/DELETE policies for users from authenticated users
-- User management happens through auth system

-- ============================================================================
-- Policies for: memberships
-- ============================================================================

-- SELECT: Members can read memberships in their tenants (including their own)
CREATE POLICY "memberships_sel_members"
  ON public.memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = memberships.tenant_id
        AND m.user_id = public.current_user_id()
    )
  );

-- INSERT: Only owners and admins can add members
CREATE POLICY "memberships_ins_owner_admin"
  ON public.memberships
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = memberships.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only owners and admins can modify memberships
CREATE POLICY "memberships_upd_owner_admin"
  ON public.memberships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = memberships.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = memberships.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- DELETE: Only owners and admins can remove members
CREATE POLICY "memberships_del_owner_admin"
  ON public.memberships
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = memberships.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Policies for: themes (1:1 with tenants)
-- ============================================================================

-- SELECT: Members can read themes for their tenants
CREATE POLICY "themes_sel_members"
  ON public.themes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = themes.tenant_id
        AND m.user_id = public.current_user_id()
    )
  );

-- INSERT: Only owners and admins can create themes
CREATE POLICY "themes_ins_owner_admin"
  ON public.themes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = themes.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only owners and admins can modify themes
CREATE POLICY "themes_upd_owner_admin"
  ON public.themes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = themes.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = themes.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- DELETE: Only owners and admins can delete themes
CREATE POLICY "themes_del_owner_admin"
  ON public.themes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = themes.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Policies for: tenant_billing (1:1 with tenants)
-- ============================================================================

-- SELECT: Members can read billing info for their tenants
CREATE POLICY "tenant_billing_sel_members"
  ON public.tenant_billing
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = tenant_billing.tenant_id
        AND m.user_id = public.current_user_id()
    )
  );

-- INSERT: Only owners and admins can create billing records
CREATE POLICY "tenant_billing_ins_owner_admin"
  ON public.tenant_billing
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = tenant_billing.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only owners and admins can modify billing
CREATE POLICY "tenant_billing_upd_owner_admin"
  ON public.tenant_billing
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = tenant_billing.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = tenant_billing.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- DELETE: Only owners and admins can delete billing records
CREATE POLICY "tenant_billing_del_owner_admin"
  ON public.tenant_billing
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = tenant_billing.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Policies for: quotas
-- ============================================================================

-- SELECT: Members can read quotas for their tenants
CREATE POLICY "quotas_sel_members"
  ON public.quotas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = quotas.tenant_id
        AND m.user_id = public.current_user_id()
    )
  );

-- INSERT: Only owners and admins can create quotas
CREATE POLICY "quotas_ins_owner_admin"
  ON public.quotas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = quotas.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- UPDATE: Only owners and admins can modify quotas
CREATE POLICY "quotas_upd_owner_admin"
  ON public.quotas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = quotas.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = quotas.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- DELETE: Only owners and admins can delete quotas
CREATE POLICY "quotas_del_owner_admin"
  ON public.quotas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = quotas.tenant_id
        AND m.user_id = public.current_user_id()
        AND m.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- Policies for: webhook_events_inbox (service-role only)
-- ============================================================================

-- Service-role only access - no policies for authenticated users
-- All operations on webhook_events_inbox require service-role privileges

-- ============================================================================
-- Policies for: events_outbox
-- ============================================================================

-- SELECT: Members can read events for their tenants + service-role for delivery
CREATE POLICY "events_outbox_sel_members_and_service"
  ON public.events_outbox
  FOR SELECT
  USING (
    -- Allow tenant members to read their events
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = events_outbox.tenant_id
        AND m.user_id = public.current_user_id()
    )
    -- Service-role access is handled separately via GRANT
  );

-- INSERT: Members can create events for their tenants
CREATE POLICY "events_outbox_ins_members"
  ON public.events_outbox
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- UPDATE: Members can update events for their tenants (for status tracking)
CREATE POLICY "events_outbox_upd_members"
  ON public.events_outbox
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- DELETE: Members can delete events for their tenants
CREATE POLICY "events_outbox_del_members"
  ON public.events_outbox
  FOR DELETE
  USING (
    tenant_id = public.current_tenant_id()
  );

COMMIT;