-- In-module giving (Stripe Payment Element): donations key on the PaymentIntent,
-- monthly partnerships carry their subscription id, and signed-in viewers get a
-- Stripe customer so their cards can be saved and reused.
ALTER TABLE donations ADD COLUMN stripe_payment_intent TEXT;
ALTER TABLE donations ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE donations ADD COLUMN stripe_customer TEXT;
CREATE INDEX IF NOT EXISTS donations_pi ON donations(stripe_payment_intent);
CREATE INDEX IF NOT EXISTS donations_sub ON donations(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS giving_customers (
  user_id INTEGER PRIMARY KEY,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
