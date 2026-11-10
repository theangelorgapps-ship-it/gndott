-- Widen content_products to cover Live TV channels ('live'). The table was
-- created moments earlier in 20261110_giving.sql and holds no production data,
-- so a drop-and-recreate is safe.
DROP TABLE IF EXISTS content_products;
CREATE TABLE content_products (
  content_type TEXT NOT NULL CHECK(content_type IN ('movie','video','episode','tvshow','teaching','live')),
  content_id INTEGER NOT NULL CHECK(content_id > 0),
  product_id INTEGER NOT NULL CHECK(product_id > 0),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (content_type, content_id, product_id)
);
CREATE INDEX IF NOT EXISTS content_products_lookup ON content_products(content_type, content_id, sort);
