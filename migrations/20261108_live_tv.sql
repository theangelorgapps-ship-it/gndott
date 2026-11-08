CREATE TABLE IF NOT EXISTS live_channel_settings (
 channel_id INTEGER PRIMARY KEY REFERENCES live_tv_channel(id),
 source_kind TEXT NOT NULL DEFAULT 'hls' CHECK(source_kind IN ('hls','rtmp')),
 hls_url TEXT, ingest_url TEXT,
 comments_enabled INTEGER NOT NULL DEFAULT 1 CHECK(comments_enabled IN (0,1)),
 slow_mode INTEGER NOT NULL DEFAULT 5 CHECK(slow_mode BETWEEN 0 AND 120),
 updated_by INTEGER, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS live_comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER NOT NULL REFERENCES live_tv_channel(id),
 user_id INTEGER NOT NULL REFERENCES users(id), profile_id INTEGER, author_name TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000), parent_id INTEGER REFERENCES live_comments(id),
 kind TEXT NOT NULL DEFAULT 'comment' CHECK(kind IN ('comment','announcement')),
 official INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0,
 hidden INTEGER NOT NULL DEFAULT 0, request_id TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(channel_id,user_id,request_id)
);
CREATE INDEX IF NOT EXISTS live_comments_channel ON live_comments(channel_id,hidden,id DESC);
CREATE INDEX IF NOT EXISTS live_comments_rate ON live_comments(user_id,channel_id,created_at);
CREATE TABLE IF NOT EXISTS live_comment_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER NOT NULL REFERENCES live_tv_channel(id),
 comment_id INTEGER NOT NULL REFERENCES live_comments(id), user_id INTEGER NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL CHECK(reason IN ('spam','abuse','inappropriate','other')),
 detail TEXT NOT NULL DEFAULT '' CHECK(length(detail)<=500),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_by INTEGER,
 UNIQUE(comment_id,user_id)
);
CREATE INDEX IF NOT EXISTS live_reports_channel ON live_comment_reports(channel_id,status,id DESC);
CREATE TABLE IF NOT EXISTS live_chat_mutes (
 channel_id INTEGER NOT NULL, user_id INTEGER NOT NULL, moderator_id INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(channel_id,user_id)
);
CREATE TABLE IF NOT EXISTS live_moderation_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER NOT NULL, admin_id INTEGER NOT NULL,
 action TEXT NOT NULL, target_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
