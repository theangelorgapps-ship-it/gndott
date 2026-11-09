-- Viewer-owned account-level blocks. Moderators retain visibility for safety.
CREATE TABLE IF NOT EXISTS live_chat_blocks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id),
 blocked_user_id INTEGER NOT NULL REFERENCES users(id),
 author_name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(user_id <> blocked_user_id),
 UNIQUE(user_id,blocked_user_id)
);
CREATE INDEX IF NOT EXISTS live_chat_blocks_reverse ON live_chat_blocks(blocked_user_id,user_id);
