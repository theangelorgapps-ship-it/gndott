-- Immutable checkout quotes. Unique request/session keys and a transactional claim
-- make browser returns and Stripe webhook retries safe to process concurrently.
CREATE TABLE IF NOT EXISTS subscription_checkouts (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  plan_name TEXT NOT NULL,
  plan_identifier TEXT NOT NULL,
  plan_level INTEGER NOT NULL,
  duration TEXT NOT NULL CHECK(duration IN ('day','week','month','year')),
  duration_value INTEGER NOT NULL CHECK(duration_value BETWEEN 1 AND 120),
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  discount_cents INTEGER NOT NULL CHECK(discount_cents >= 0 AND discount_cents <= price_cents),
  total_cents INTEGER NOT NULL CHECK(total_cents = price_cents - discount_cents),
  currency TEXT NOT NULL CHECK(currency = 'usd'),
  coupon_code TEXT NOT NULL DEFAULT '',
  return_origin TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  checkout_url TEXT,
  expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','activating','paid')),
  activation_token TEXT,
  subscription_id INTEGER,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT,
  UNIQUE(user_id, request_key)
);
CREATE INDEX IF NOT EXISTS subscription_checkout_user ON subscription_checkouts(user_id, created_at);
