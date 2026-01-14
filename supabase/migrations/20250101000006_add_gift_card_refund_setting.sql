-- Add restore_gift_card_on_refund setting to businesses table
-- This controls whether gift card balances are restored when a booking is refunded
-- Per backend clarifications: "Add a simple toggle per business: 'Refunds restore gift card balance? yes/no'"

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS restore_gift_card_on_refund boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN businesses.restore_gift_card_on_refund IS 'If true, refunding a booking restores the gift card balance for amount-type gift cards';



