CREATE TABLE IF NOT EXISTS library_notes (
 user_id INTEGER NOT NULL, profile_id INTEGER NOT NULL, note_key TEXT NOT NULL,
 title TEXT NOT NULL, html TEXT NOT NULL, content_type TEXT, content_id INTEGER,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(user_id,profile_id,note_key)
);
CREATE TABLE IF NOT EXISTS library_verses (
 user_id INTEGER NOT NULL, profile_id INTEGER NOT NULL, version TEXT NOT NULL,
 book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
 book_name TEXT NOT NULL, text TEXT NOT NULL, saved INTEGER NOT NULL DEFAULT 0,
 highlight TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(user_id,profile_id,version,book,chapter,verse)
);
CREATE TABLE IF NOT EXISTS subscription_cancellations (
 subscription_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
 provider_id TEXT, effective_at TEXT, requested_at TEXT NOT NULL DEFAULT (datetime('now'))
);
