-- Snapshot the shop product onto each mapping row: the player's Recommended
-- Resources then reads D1 only (no WooCommerce round-trip per viewer).
-- Availability and price are always re-verified at checkout.
ALTER TABLE content_products ADD COLUMN product_name TEXT;
ALTER TABLE content_products ADD COLUMN product_slug TEXT;
ALTER TABLE content_products ADD COLUMN product_price TEXT;
ALTER TABLE content_products ADD COLUMN product_currency TEXT;
ALTER TABLE content_products ADD COLUMN product_minor_unit INTEGER;
ALTER TABLE content_products ADD COLUMN product_image TEXT;
ALTER TABLE content_products ADD COLUMN product_in_stock INTEGER;
ALTER TABLE content_products ADD COLUMN snapshot_at TEXT;
