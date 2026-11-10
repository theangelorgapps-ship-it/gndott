-- Partnership frequency: monthly partnerships run as Stripe subscriptions;
-- everything else is a one-time payment.
ALTER TABLE donations ADD COLUMN frequency TEXT NOT NULL DEFAULT 'one_time' CHECK(frequency IN ('one_time','monthly'));
CREATE INDEX IF NOT EXISTS donations_kind ON donations(kind, status, created_at);
