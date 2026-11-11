-- Saved delivery addresses: a returning viewer picks a saved address at
-- checkout instead of retyping it. Quoting an order remembers the address.
CREATE TABLE IF NOT EXISTS store_addresses (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  address_1 TEXT NOT NULL DEFAULT '',
  address_2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'GB',
  phone TEXT NOT NULL DEFAULT '',
  last_used_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS store_addresses_user ON store_addresses(user_id, last_used_at);
