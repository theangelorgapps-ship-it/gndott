-- Audited catalogue classification: legacy cast_crew IDs 48–53 are places.
-- Exact IDs AND names protect unrelated installations. Director is NOT a location classifier.
-- Legacy rows/associations remain unchanged. Apply before deploying public/admin code.
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_cast_crew_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  file_url TEXT,
  description TEXT,
  address TEXT,
  status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (source_cast_crew_id) REFERENCES cast_crew(id)
);
CREATE TABLE IF NOT EXISTS content_location_mapping (
  location_id INTEGER NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('entertainment', 'video', 'episode')),
  content_id INTEGER NOT NULL CHECK (content_id > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (location_id, content_type, content_id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);
CREATE INDEX IF NOT EXISTS content_location_title_idx ON content_location_mapping(content_type, content_id);
CREATE TABLE IF NOT EXISTS personality_social_links (
  personality_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('facebook', 'instagram', 'x', 'website')),
  url TEXT NOT NULL,
  PRIMARY KEY (personality_id, provider),
  FOREIGN KEY (personality_id) REFERENCES cast_crew(id)
);
CREATE TABLE IF NOT EXISTS content_migration_audit (
  migration_key TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO locations (source_cast_crew_id, name, file_url, description, status, created_at, updated_at, deleted_at)
SELECT id, name, file_url, bio, status, COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now')), deleted_at
FROM cast_crew
WHERE type = 'director' AND (
  (id = 48 AND name = 'Sri Lanka') OR
  (id = 49 AND name = 'South Africa') OR
  (id = 50 AND name = 'United States Of America') OR
  (id = 51 AND name = 'Dubai') OR
  (id = 52 AND name = 'United Kingdom') OR
  (id = 53 AND name = 'Zimbabwe')
) AND NOT EXISTS (SELECT 1 FROM content_migration_audit WHERE migration_key = '20261108_locations');

INSERT OR IGNORE INTO content_location_mapping (location_id, content_type, content_id)
SELECT l.id, 'entertainment', m.entertainment_id
FROM locations l JOIN entertainment_talent_mapping m ON m.talent_id = l.source_cast_crew_id
WHERE m.entertainment_id > 0 AND m.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM content_migration_audit WHERE migration_key = '20261108_locations');

INSERT OR IGNORE INTO content_migration_audit (migration_key) VALUES ('20261108_locations');
