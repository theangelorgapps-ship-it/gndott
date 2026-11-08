-- Isolated from imported Laravel tables; never changes passwords, user IDs or subscription rows.
CREATE TABLE IF NOT EXISTS auth_identities (
 provider TEXT NOT NULL CHECK(provider IN ('google','apple')),
 subject TEXT NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 email_at_link TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(provider,subject),
 UNIQUE(provider,user_id)
);
CREATE TABLE IF NOT EXISTS auth_challenges (
 state_hash TEXT PRIMARY KEY,
 browser_hash TEXT NOT NULL,
 provider TEXT NOT NULL,
 nonce TEXT NOT NULL,
 verifier TEXT,
 expires_at INTEGER NOT NULL,
 used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry ON auth_challenges(expires_at);
CREATE TABLE IF NOT EXISTS auth_pending_links (
 ticket_hash TEXT PRIMARY KEY,
 provider TEXT NOT NULL,
 subject TEXT NOT NULL,
 email TEXT NOT NULL,
 user_id INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_limits (
 bucket TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits(expires_at);
CREATE TABLE IF NOT EXISTS auth_events (
 id INTEGER PRIMARY KEY,
 user_id INTEGER,
 event TEXT NOT NULL,
 provider TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
