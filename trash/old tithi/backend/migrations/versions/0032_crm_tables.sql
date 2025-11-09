-- Migration: 0032_crm_tables.sql
-- Purpose: Add CRM tables for customer management, segmentation, and loyalty programs
-- Phase: Phase 4 - Module K (CRM & Customer Management)

BEGIN;

-- Customer Notes Table
CREATE TABLE IF NOT EXISTS customer_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Customer Segments Table
CREATE TABLE IF NOT EXISTS customer_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text DEFAULT '',
    criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
    customer_count integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Loyalty Accounts Table
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points_balance integer NOT NULL DEFAULT 0,
    total_earned integer NOT NULL DEFAULT 0,
    total_redeemed integer NOT NULL DEFAULT 0,
    tier text DEFAULT 'bronze',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT loyalty_accounts_unique_customer UNIQUE (tenant_id, customer_id)
);

-- Loyalty Transactions Table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    loyalty_account_id uuid NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    transaction_type text NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
    points integer NOT NULL,
    description text NOT NULL,
    reference_type text, -- 'booking', 'referral', 'promotion', etc.
    reference_id uuid,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer Segment Memberships Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS customer_segment_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    segment_id uuid NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT customer_segment_memberships_unique UNIQUE (tenant_id, customer_id, segment_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_notes_tenant_customer ON customer_notes (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at ON customer_notes (created_at);
CREATE INDEX IF NOT EXISTS idx_customer_segments_tenant ON customer_segments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_segments_active ON customer_segments (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_customer ON loyalty_accounts (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_active ON loyalty_accounts (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions (loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant ON loyalty_transactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_segment_memberships_customer ON customer_segment_memberships (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_segment_memberships_segment ON customer_segment_memberships (segment_id);

-- RLS Policies
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segment_memberships ENABLE ROW LEVEL SECURITY;

-- Customer Notes RLS Policies
CREATE POLICY "customer_notes_sel" ON customer_notes
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "customer_notes_ins" ON customer_notes
    FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "customer_notes_upd" ON customer_notes
    FOR UPDATE USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "customer_notes_del" ON customer_notes
    FOR DELETE USING (tenant_id = current_tenant_id());

-- Customer Segments RLS Policies
CREATE POLICY "customer_segments_sel" ON customer_segments
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "customer_segments_ins" ON customer_segments
    FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "customer_segments_upd" ON customer_segments
    FOR UPDATE USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "customer_segments_del" ON customer_segments
    FOR DELETE USING (tenant_id = current_tenant_id());

-- Loyalty Accounts RLS Policies
CREATE POLICY "loyalty_accounts_sel" ON loyalty_accounts
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "loyalty_accounts_ins" ON loyalty_accounts
    FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "loyalty_accounts_upd" ON loyalty_accounts
    FOR UPDATE USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "loyalty_accounts_del" ON loyalty_accounts
    FOR DELETE USING (tenant_id = current_tenant_id());

-- Loyalty Transactions RLS Policies
CREATE POLICY "loyalty_transactions_sel" ON loyalty_transactions
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "loyalty_transactions_ins" ON loyalty_transactions
    FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "loyalty_transactions_upd" ON loyalty_transactions
    FOR UPDATE USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "loyalty_transactions_del" ON loyalty_transactions
    FOR DELETE USING (tenant_id = current_tenant_id());

-- Customer Segment Memberships RLS Policies
CREATE POLICY "customer_segment_memberships_sel" ON customer_segment_memberships
    FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "customer_segment_memberships_ins" ON customer_segment_memberships
    FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "customer_segment_memberships_upd" ON customer_segment_memberships
    FOR UPDATE USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "customer_segment_memberships_del" ON customer_segment_memberships
    FOR DELETE USING (tenant_id = current_tenant_id());

-- Triggers for updated_at
CREATE TRIGGER customer_notes_updated_at
    BEFORE UPDATE ON customer_notes
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER customer_segments_updated_at
    BEFORE UPDATE ON customer_segments
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER loyalty_accounts_updated_at
    BEFORE UPDATE ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Audit triggers
CREATE TRIGGER customer_notes_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customer_notes
    FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER customer_segments_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customer_segments
    FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER loyalty_accounts_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER loyalty_transactions_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON loyalty_transactions
    FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER customer_segment_memberships_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customer_segment_memberships
    FOR EACH ROW EXECUTE FUNCTION log_audit();

COMMIT;
