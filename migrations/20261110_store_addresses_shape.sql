-- Align saved delivery details with the store checkout address shape
-- (first/last name, state). No production rows exist yet; safe to recreate.
DROP TABLE IF EXISTS store_addresses;
CREATE TABLE store_addresses (
  user_id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address_1 TEXT NOT NULL,
  address_2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  postcode TEXT NOT NULL,
  country TEXT NOT NULL,          -- ISO 3166-1 alpha-2
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
