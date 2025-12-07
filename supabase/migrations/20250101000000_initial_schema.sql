-- Tithi Database Schema - Initial Migration
-- This migration creates all tables, enums, indexes, and RLS policies
-- Based on baseline-report.md and backend clarifications

-- ============================================================================
-- 1. CREATE ENUM TYPES
-- ============================================================================

CREATE TYPE booking_status AS ENUM (
  'pending',      -- created, card saved, no money moved yet
  'scheduled',    -- same as pending but used if you want semantic diff
  'held',         -- temporary hold during checkout (expires after 5 minutes)
  'completed',
  'no_show',
  'cancelled',
  'refunded'
);

CREATE TYPE payment_status AS ENUM (
  'none',             -- no card saved / no payment expected
  'card_saved',       -- SetupIntent succeeded, card on file
  'charge_pending',   -- we are trying to charge
  'charged',          -- money captured
  'refunded',
  'failed'
);

CREATE TYPE money_action AS ENUM (
  'none',
  'completed_charge',   -- Completed button
  'no_show_fee',
  'cancel_fee',
  'refund'
);

CREATE TYPE notification_channel AS ENUM ('email', 'sms');

CREATE TYPE notification_category AS ENUM (
  'confirmation',
  'reminder',
  'follow_up',
  'cancellation',
  'reschedule',
  'completion'
);

CREATE TYPE notification_trigger AS ENUM (
  'booking_created',
  'booking_confirmed',
  'reminder_24h',
  'reminder_1h',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_completed',
  'fee_charged',
  'refunded'
);

CREATE TYPE discount_type AS ENUM ('amount', 'percent');

-- ============================================================================
-- 2. CREATE TABLES (in dependency order)
-- ============================================================================

-- businesses: Root table - one per owner
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  dba_name text,
  legal_name text,
  industry text,
  subdomain text UNIQUE NOT NULL,
  timezone text NOT NULL,
  phone text,
  support_email text,
  website_url text,
  street text,
  city text,
  state text,
  postal_code text,
  country text,
  brand_primary_color text,
  brand_secondary_color text,
  logo_url text,
  stripe_connect_account_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text DEFAULT 'trial', -- 'trial' | 'active' | 'paused' | 'canceled'
  trial_ends_at timestamptz,
  next_bill_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT unique_user_business UNIQUE (user_id)
);

-- service_categories: Groups of services
CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- services: The actual bookable services
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_min integer NOT NULL,
  price_cents integer NOT NULL,
  pre_appointment_instructions text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- staff: Staff members (data only, no login)
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  color text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- staff_services: Junction table - which staff can perform which services
CREATE TABLE staff_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_staff_service UNIQUE (staff_id, service_id)
);

-- availability_rules: Weekly schedule and exceptions per staff/service
CREATE TABLE availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  rule_type text NOT NULL, -- 'weekly' | 'exception' | 'closure'
  weekday smallint, -- 0-6 (Sunday=0), for weekly rules
  start_time time NOT NULL,
  end_time time NOT NULL,
  date date, -- for exceptions/closures
  capacity integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- blackouts: Time ranges when business/staff is unavailable
CREATE TABLE blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE, -- nullable = whole business
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- customers: People who book appointments
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- gift_cards: Gift card codes (amount or percent) - created before bookings
CREATE TABLE gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type discount_type NOT NULL,
  initial_amount_cents integer NOT NULL, -- for amount type
  current_balance_cents integer NOT NULL, -- for amount type
  percent_off numeric(5,2), -- for percent type
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT unique_business_code UNIQUE (user_id, code)
);

-- bookings: The appointments
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  status booking_status NOT NULL DEFAULT 'pending',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_min integer NOT NULL,
  price_cents integer NOT NULL, -- base price at time of booking
  final_price_cents integer NOT NULL, -- after gift cards/discounts
  gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
  gift_card_amount_applied_cents integer DEFAULT 0,
  notes text,
  source text NOT NULL DEFAULT 'public', -- 'public' | 'admin'
  policy_snapshot jsonb NOT NULL, -- frozen policy text & fees
  consent_at timestamptz,
  consent_ip text,
  consent_user_agent text,
  payment_status payment_status NOT NULL DEFAULT 'card_saved',
  last_money_action money_action NOT NULL DEFAULT 'none',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- booking_payments: Financial transactions per booking
CREATE TABLE booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_setup_intent_id text,
  stripe_payment_intent_id text UNIQUE,
  stripe_refund_id text,
  amount_cents integer NOT NULL,
  money_action money_action NOT NULL,
  status payment_status NOT NULL,
  application_fee_cents integer, -- platform's 1% fee
  stripe_fee_cents integer,
  net_amount_cents integer, -- net to business
  currency text DEFAULT 'usd',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- business_policies: Versioned policy texts and fees
CREATE TABLE business_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  cancellation_policy_text text,
  no_show_policy_text text,
  refund_policy_text text,
  cash_policy_text text,
  no_show_fee_type discount_type DEFAULT 'amount',
  no_show_fee_amount_cents integer DEFAULT 0,
  no_show_fee_percent numeric(5,2) DEFAULT 0.0,
  cancel_fee_type discount_type DEFAULT 'amount',
  cancel_fee_amount_cents integer DEFAULT 0,
  cancel_fee_percent numeric(5,2) DEFAULT 0.0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- gift_card_ledger: Audit trail for gift card balance changes
CREATE TABLE gift_card_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  gift_card_id uuid NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  delta_cents integer NOT NULL, -- positive = added, negative = consumed
  reason text, -- 'purchase' | 'redemption' | 'refund_restore' | 'admin_adjust'
  created_at timestamptz DEFAULT now()
);

-- notification_templates: Owner-configured notification templates
CREATE TABLE notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel notification_channel NOT NULL,
  category notification_category NOT NULL,
  trigger notification_trigger NOT NULL,
  subject text, -- email only
  body_markdown text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- notification_events: Log of sent notifications
CREATE TABLE notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  channel notification_channel NOT NULL,
  to_address text NOT NULL,
  status text NOT NULL, -- 'queued' | 'sent' | 'failed'
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- notification_jobs: Background job queue for notifications
CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_phone text,
  subject text,
  body text,
  channel notification_channel NOT NULL,
  trigger notification_trigger, -- nullable for system jobs
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'sent' | 'failed' | 'dead'
  attempt_count integer DEFAULT 0,
  last_error text,
  scheduled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_booking_trigger_channel UNIQUE (booking_id, trigger, channel)
);

-- idempotency_keys: Prevent duplicate requests
CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  route text NOT NULL,
  response_json jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_key_route UNIQUE (key, route)
);

-- ============================================================================
-- 3. CREATE INDEXES
-- ============================================================================

-- businesses indexes
CREATE INDEX idx_businesses_user_id ON businesses(user_id);
CREATE INDEX idx_businesses_subdomain ON businesses(subdomain);

-- service_categories indexes
CREATE INDEX idx_service_categories_user_business ON service_categories(user_id, business_id);
CREATE INDEX idx_service_categories_user_sort ON service_categories(user_id, sort_order);

-- services indexes
CREATE INDEX idx_services_user_business_category ON services(user_id, business_id, category_id);
CREATE INDEX idx_services_user_active ON services(user_id, is_active);

-- staff indexes
CREATE INDEX idx_staff_user_business_active ON staff(user_id, business_id, is_active);

-- staff_services indexes
CREATE INDEX idx_staff_services_user_staff ON staff_services(user_id, staff_id);
CREATE INDEX idx_staff_services_user_service ON staff_services(user_id, service_id);

-- availability_rules indexes
CREATE INDEX idx_availability_rules_user_service_staff_weekday ON availability_rules(user_id, service_id, staff_id, weekday);
CREATE INDEX idx_availability_rules_user_staff_date ON availability_rules(user_id, staff_id, date);

-- blackouts indexes
CREATE INDEX idx_blackouts_user_staff ON blackouts(user_id, staff_id);
CREATE INDEX idx_blackouts_dates ON blackouts(start_at, end_at);

-- customers indexes
CREATE INDEX idx_customers_user_email ON customers(user_id, email);
CREATE INDEX idx_customers_user_phone ON customers(user_id, phone);
CREATE INDEX idx_customers_user_name ON customers(user_id, name);

-- bookings indexes
CREATE INDEX idx_bookings_user_business_start ON bookings(user_id, business_id, start_at DESC);
CREATE INDEX idx_bookings_user_status_start ON bookings(user_id, status, start_at DESC);
CREATE INDEX idx_bookings_user_customer_start ON bookings(user_id, customer_id, start_at DESC);
-- Partial unique index to prevent double-booking
CREATE UNIQUE INDEX unique_active_slot ON bookings(staff_id, start_at)
  WHERE status IN ('pending', 'scheduled', 'held');

-- booking_payments indexes
CREATE INDEX idx_booking_payments_user_booking ON booking_payments(user_id, booking_id);
CREATE INDEX idx_booking_payments_user_created ON booking_payments(user_id, created_at DESC);

-- business_policies indexes
CREATE INDEX idx_business_policies_user_business_active_version ON business_policies(user_id, business_id, is_active, version DESC);

-- gift_cards indexes
CREATE INDEX idx_gift_cards_user_code ON gift_cards(user_id, code);
CREATE INDEX idx_gift_cards_expires ON gift_cards(expires_at);

-- gift_card_ledger indexes
CREATE INDEX idx_gift_card_ledger_user_card_created ON gift_card_ledger(user_id, gift_card_id, created_at);

-- notification_templates indexes
CREATE INDEX idx_notification_templates_user_trigger_enabled ON notification_templates(user_id, trigger, is_enabled);
CREATE INDEX idx_notification_templates_user_category ON notification_templates(user_id, category);

-- notification_events indexes
CREATE INDEX idx_notification_events_user_booking ON notification_events(user_id, booking_id);
CREATE INDEX idx_notification_events_user_address_created ON notification_events(user_id, to_address, created_at DESC);

-- notification_jobs indexes
CREATE INDEX idx_notification_jobs_status_scheduled ON notification_jobs(status, scheduled_at);
CREATE INDEX idx_notification_jobs_user_business ON notification_jobs(user_id, business_id);

-- idempotency_keys indexes
CREATE INDEX idx_idempotency_keys_user ON idempotency_keys(user_id);
CREATE INDEX idx_idempotency_keys_created ON idempotency_keys(created_at);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

-- businesses policies
CREATE POLICY "user_owns_business" ON businesses
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- service_categories policies
CREATE POLICY "user_owns_category" ON service_categories
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- services policies
CREATE POLICY "user_owns_service" ON services
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- staff policies
CREATE POLICY "user_owns_staff" ON staff
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- staff_services policies
CREATE POLICY "user_owns_staff_service" ON staff_services
  FOR ALL
  USING (user_id = auth.uid());

-- availability_rules policies
CREATE POLICY "user_owns_availability_rule" ON availability_rules
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- blackouts policies
CREATE POLICY "user_owns_blackout" ON blackouts
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- customers policies
CREATE POLICY "user_owns_customer" ON customers
  FOR ALL
  USING (user_id = auth.uid());

-- bookings policies
CREATE POLICY "user_owns_booking" ON bookings
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- booking_payments policies
CREATE POLICY "user_owns_booking_payment" ON booking_payments
  FOR ALL
  USING (user_id = auth.uid());

-- business_policies policies
CREATE POLICY "user_owns_policy" ON business_policies
  FOR ALL
  USING (user_id = auth.uid());

-- gift_cards policies
CREATE POLICY "user_owns_gift_card" ON gift_cards
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- gift_card_ledger policies
CREATE POLICY "user_owns_gift_card_ledger" ON gift_card_ledger
  FOR ALL
  USING (user_id = auth.uid());

-- notification_templates policies
CREATE POLICY "user_owns_notification_template" ON notification_templates
  FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- notification_events policies
CREATE POLICY "user_owns_notification_event" ON notification_events
  FOR ALL
  USING (user_id = auth.uid());

-- notification_jobs policies
CREATE POLICY "user_owns_notification_job" ON notification_jobs
  FOR ALL
  USING (user_id = auth.uid());

-- idempotency_keys policies
CREATE POLICY "user_owns_idempotency_key" ON idempotency_keys
  FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================================
-- 6. CREATE UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_rules_updated_at BEFORE UPDATE ON availability_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blackouts_updated_at BEFORE UPDATE ON blackouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_payments_updated_at BEFORE UPDATE ON booking_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_policies_updated_at BEFORE UPDATE ON business_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON gift_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

