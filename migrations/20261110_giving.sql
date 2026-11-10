-- Giving (Offering/Tithe/Partner/Seed) donations via Stripe one-time checkout,
-- shop products recommended against catalogue content, "remind me" prompts for
-- those products, and saved delivery details for one-step store checkout.

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id INTEGER,                -- NULL for guest givers
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK(kind IN ('offering','tithe','partner','seed')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 100 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'usd' CHECK(currency = 'usd'),
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS donations_user ON donations(user_id, status);
CREATE INDEX IF NOT EXISTS donations_status ON donations(status, created_at);

-- Maps store products (WooCommerce ids, via the uebertangel.org bridge) onto
-- catalogue content so the player can show "Recommended Resources".
CREATE TABLE IF NOT EXISTS content_products (
  content_type TEXT NOT NULL CHECK(content_type IN ('movie','video','episode','tvshow','teaching')),
  content_id INTEGER NOT NULL CHECK(content_id > 0),
  product_id INTEGER NOT NULL CHECK(product_id > 0),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (content_type, content_id, product_id)
);
CREATE INDEX IF NOT EXISTS content_products_lookup ON content_products(content_type, content_id, sort);

-- "Remind Me" saved from the player; re-prompted when playback ends or the
-- player closes, until the viewer dismisses or buys.
CREATE TABLE IF NOT EXISTS store_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  content_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reminded_at TEXT,
  UNIQUE(user_id, product_id, content_type, content_id)
);
CREATE INDEX IF NOT EXISTS store_reminders_due ON store_reminders(user_id, content_type, content_id, status);

-- Saved delivery details for one-step ("Get Now") store checkout.
CREATE TABLE IF NOT EXISTS store_addresses (
  user_id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address_1 TEXT NOT NULL,
  address_2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,          -- ISO 3166-1 alpha-2
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
