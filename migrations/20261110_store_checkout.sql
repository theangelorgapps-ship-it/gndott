-- Store checkout snapshots: one row per Halobox in-site shop checkout.
-- The WooCommerce order is created on uebertangel.org via the bridge only after
-- a verified Stripe payment; order_id links back to it.
CREATE TABLE IF NOT EXISTS store_checkouts (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  quote_id TEXT NOT NULL,
  address TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','pending','paid','failed')),
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_store_checkouts_user ON store_checkouts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_checkouts_session ON store_checkouts(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
