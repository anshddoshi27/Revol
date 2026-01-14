BEGIN;

-- 0015 — Standard tenant-scoped policies
-- Creates four policies per tenant-scoped table: SELECT, INSERT, UPDATE, DELETE
-- All policies use the predicate: tenant_id = current_tenant_id()
-- Implements deny-by-default RLS with positive policy allowances only

-- Standard policies for tenant-scoped tables follow this pattern:
-- 1. SELECT: USING (tenant_id = current_tenant_id())
-- 2. INSERT: WITH CHECK (tenant_id = current_tenant_id())  
-- 3. UPDATE: USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())
-- 4. DELETE: USING (tenant_id = current_tenant_id())

-- Note: tenants, users, memberships, themes, tenant_billing, and quotas tables
-- require special policies and are handled in migration 0016_policies_special.sql

-- customers table
CREATE POLICY "customers_sel" ON public.customers
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "customers_ins" ON public.customers
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "customers_upd" ON public.customers
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "customers_del" ON public.customers
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- resources table
CREATE POLICY "resources_sel" ON public.resources
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "resources_ins" ON public.resources
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "resources_upd" ON public.resources
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "resources_del" ON public.resources
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- customer_metrics table
CREATE POLICY "customer_metrics_sel" ON public.customer_metrics
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "customer_metrics_ins" ON public.customer_metrics
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "customer_metrics_upd" ON public.customer_metrics
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "customer_metrics_del" ON public.customer_metrics
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- services table
CREATE POLICY "services_sel" ON public.services
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "services_ins" ON public.services
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "services_upd" ON public.services
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "services_del" ON public.services
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- service_resources table
CREATE POLICY "service_resources_sel" ON public.service_resources
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "service_resources_ins" ON public.service_resources
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "service_resources_upd" ON public.service_resources
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "service_resources_del" ON public.service_resources
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- availability_rules table
CREATE POLICY "availability_rules_sel" ON public.availability_rules
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_rules_ins" ON public.availability_rules
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_rules_upd" ON public.availability_rules
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_rules_del" ON public.availability_rules
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- availability_exceptions table
CREATE POLICY "availability_exceptions_sel" ON public.availability_exceptions
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_exceptions_ins" ON public.availability_exceptions
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_exceptions_upd" ON public.availability_exceptions
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "availability_exceptions_del" ON public.availability_exceptions
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- bookings table
CREATE POLICY "bookings_sel" ON public.bookings
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "bookings_ins" ON public.bookings
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "bookings_upd" ON public.bookings
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "bookings_del" ON public.bookings
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- booking_items table
CREATE POLICY "booking_items_sel" ON public.booking_items
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "booking_items_ins" ON public.booking_items
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "booking_items_upd" ON public.booking_items
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "booking_items_del" ON public.booking_items
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- payments table
CREATE POLICY "payments_sel" ON public.payments
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "payments_ins" ON public.payments
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "payments_upd" ON public.payments
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "payments_del" ON public.payments
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- coupons table
CREATE POLICY "coupons_sel" ON public.coupons
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "coupons_ins" ON public.coupons
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "coupons_upd" ON public.coupons
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "coupons_del" ON public.coupons
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- gift_cards table
CREATE POLICY "gift_cards_sel" ON public.gift_cards
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "gift_cards_ins" ON public.gift_cards
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "gift_cards_upd" ON public.gift_cards
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "gift_cards_del" ON public.gift_cards
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- referrals table
CREATE POLICY "referrals_sel" ON public.referrals
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "referrals_ins" ON public.referrals
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "referrals_upd" ON public.referrals
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "referrals_del" ON public.referrals
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- notification_templates table
CREATE POLICY "notification_templates_sel" ON public.notification_templates
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "notification_templates_ins" ON public.notification_templates
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "notification_templates_upd" ON public.notification_templates
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "notification_templates_del" ON public.notification_templates
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- notifications table
CREATE POLICY "notifications_sel" ON public.notifications
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "notifications_ins" ON public.notifications
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "notifications_upd" ON public.notifications
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "notifications_del" ON public.notifications
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- usage_counters table
CREATE POLICY "usage_counters_sel" ON public.usage_counters
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "usage_counters_ins" ON public.usage_counters
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "usage_counters_upd" ON public.usage_counters
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "usage_counters_del" ON public.usage_counters
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- audit_logs table
CREATE POLICY "audit_logs_sel" ON public.audit_logs
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "audit_logs_ins" ON public.audit_logs
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "audit_logs_upd" ON public.audit_logs
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "audit_logs_del" ON public.audit_logs
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- events_outbox table
CREATE POLICY "events_outbox_sel" ON public.events_outbox
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "events_outbox_ins" ON public.events_outbox
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "events_outbox_upd" ON public.events_outbox
  FOR UPDATE 
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "events_outbox_del" ON public.events_outbox
  FOR DELETE USING (tenant_id = public.current_tenant_id());

COMMIT;
