-- Add missing 'payment_issue' trigger to notification_trigger enum
-- Per frontend logistics.txt: triggers include "Payment Issue"

ALTER TYPE notification_trigger ADD VALUE IF NOT EXISTS 'payment_issue';



