BEGIN;

-- P0002 — Enum types (expanded)
-- All enums are defined with CREATE TYPE IF NOT EXISTS per Design Brief §2 and Context Pack §Enums.

CREATE TYPE IF NOT EXISTS booking_status AS ENUM (
  'pending',
  'confirmed',
  'checked_in',
  'completed',
  'canceled',
  'no_show',
  'failed'
);

CREATE TYPE IF NOT EXISTS payment_status AS ENUM (
  'requires_action',
  'authorized',
  'captured',
  'refunded',
  'canceled',
  'failed'
);

CREATE TYPE IF NOT EXISTS membership_role AS ENUM (
  'owner',
  'admin',
  'staff',
  'viewer'
);

CREATE TYPE IF NOT EXISTS resource_type AS ENUM (
  'staff',
  'room'
);

CREATE TYPE IF NOT EXISTS notification_channel AS ENUM (
  'email',
  'sms',
  'push'
);

CREATE TYPE IF NOT EXISTS notification_status AS ENUM (
  'queued',
  'sent',
  'failed'
);

CREATE TYPE IF NOT EXISTS payment_method AS ENUM (
  'card',
  'cash',
  'apple_pay',
  'paypal',
  'other'
);

COMMIT;
