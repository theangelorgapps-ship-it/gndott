-- Release 2: separate email accounts share access, never profiles or billing.
-- Additive and repeatable. No legacy users, subscriptions or devices are rewritten.
CREATE TABLE IF NOT EXISTS subscription_members (
 id TEXT PRIMARY KEY NOT NULL,
 owner_user_id INTEGER NOT NULL REFERENCES users(id),
 seat INTEGER NOT NULL CHECK(seat BETWEEN 1 AND 3),
 invited_email TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 member_user_id INTEGER REFERENCES users(id),
 accepted_at TEXT,
 revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK(member_user_id IS NULL OR member_user_id <> owner_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_member_seat ON subscription_members(owner_user_id,seat) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_member_email ON subscription_members(owner_user_id,invited_email) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_member_account ON subscription_members(member_user_id) WHERE revoked_at IS NULL AND member_user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS subscription_devices (
 id TEXT PRIMARY KEY NOT NULL,
 owner_user_id INTEGER NOT NULL REFERENCES users(id),
 user_id INTEGER NOT NULL REFERENCES users(id),
 session_id TEXT NOT NULL UNIQUE,
 label TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 last_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS subscription_device_pool ON subscription_devices(owner_user_id,revoked_at);
-- Use the subscription's duration snapshot when available. Legacy numeric duration
-- records use their plan duration. Missing or malformed paid-through dates deny access.
CREATE VIEW IF NOT EXISTS r2_active_subscription_owners AS
 SELECT s.id AS subscription_id,s.user_id AS owner_user_id,s.name,s.plan_id,s.level,s.start_date,s.end_date,
 CASE WHEN COALESCE(NULLIF(CASE WHEN s.duration IN ('month','year','week','day') THEN s.duration END,''),p.duration)='year' THEN 4
      WHEN COALESCE(NULLIF(CASE WHEN s.duration IN ('month','year','week','day') THEN s.duration END,''),p.duration)='month' THEN 2 ELSE 1 END AS user_limit,
 CASE WHEN COALESCE(NULLIF(CASE WHEN s.duration IN ('month','year','week','day') THEN s.duration END,''),p.duration)='year' THEN 10 ELSE 5 END AS device_limit
 FROM subscriptions s LEFT JOIN plan p ON p.id=s.plan_id JOIN users u ON u.id=s.user_id
 WHERE s.status='active' AND s.deleted_at IS NULL
 AND julianday(s.end_date)>julianday('now') AND (s.start_date IS NULL OR julianday(s.start_date)<=julianday('now'))
 AND u.status=1 AND COALESCE(u.is_banned,0)=0 AND u.deleted_at IS NULL
 AND s.id=(SELECT MAX(s2.id) FROM subscriptions s2 WHERE s2.user_id=s.user_id AND s2.deleted_at IS NULL);
CREATE VIEW IF NOT EXISTS r2_entitled_users AS
 SELECT o.*,o.owner_user_id AS user_id,NULL AS membership_id FROM r2_active_subscription_owners o
 UNION ALL
 SELECT o.*,m.member_user_id AS user_id,m.id AS membership_id
 FROM r2_active_subscription_owners o JOIN subscription_members m ON m.owner_user_id=o.owner_user_id
 JOIN users u ON u.id=m.member_user_id
 WHERE m.revoked_at IS NULL AND m.accepted_at IS NOT NULL AND m.seat<o.user_limit
 AND LOWER(TRIM(u.email))=m.invited_email AND u.status=1 AND COALESCE(u.is_banned,0)=0 AND u.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM r2_active_subscription_owners own WHERE own.owner_user_id=m.member_user_id);
CREATE VIEW IF NOT EXISTS r2_valid_subscription_devices AS
 SELECT d.*,e.subscription_id,e.device_limit,
 ROW_NUMBER() OVER (PARTITION BY d.owner_user_id ORDER BY d.created_at,d.id) AS device_position
 FROM subscription_devices d JOIN r2_entitled_users e ON e.owner_user_id=d.owner_user_id AND e.user_id=d.user_id
 JOIN ba_viewer_session bs ON bs.id=d.session_id AND bs.userId=d.user_id
 WHERE d.revoked_at IS NULL AND
 (CASE WHEN CAST(bs.expiresAt AS TEXT) NOT GLOB '*[^0-9.]*' THEN CAST(bs.expiresAt AS REAL)/1000.0 ELSE (julianday(bs.expiresAt)-2440587.5)*86400 END)>unixepoch();
CREATE VIEW IF NOT EXISTS r2_active_subscription_devices AS
 SELECT * FROM r2_valid_subscription_devices WHERE device_position<=device_limit;
