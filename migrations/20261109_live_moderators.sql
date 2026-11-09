-- A monitoring assignment grants access only to that channel's comments.
-- It never changes users.user_type or grants content/billing administration.
CREATE TABLE IF NOT EXISTS live_chat_moderators (
 channel_id INTEGER NOT NULL REFERENCES live_tv_channel(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 assigned_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(channel_id,user_id)
);
CREATE INDEX IF NOT EXISTS live_chat_moderators_user ON live_chat_moderators(user_id,channel_id);
CREATE INDEX IF NOT EXISTS live_moderation_log_channel ON live_moderation_log(channel_id,id DESC);
