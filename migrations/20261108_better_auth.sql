-- Additive Better Auth migration. Run once, after backing up D1.
-- A normalized duplicate email aborts this migration rather than merging identities.
CREATE UNIQUE INDEX users_auth_email_unique ON users(LOWER(TRIM(email)));
ALTER TABLE users ADD COLUMN auth_email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN auth_image TEXT;
UPDATE users SET email=LOWER(TRIM(email)), auth_email_verified=CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END;

CREATE TABLE ba_account (
 id TEXT PRIMARY KEY NOT NULL,
 accountId TEXT NOT NULL, providerId TEXT NOT NULL,
 userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 accessToken TEXT, refreshToken TEXT, idToken TEXT,
 accessTokenExpiresAt DATE, refreshTokenExpiresAt DATE, scope TEXT, password TEXT,
 createdAt DATE NOT NULL, updatedAt DATE NOT NULL,
 UNIQUE(providerId, accountId)
);
CREATE INDEX ba_account_userId_idx ON ba_account(userId);
INSERT INTO ba_account(id,accountId,providerId,userId,password,createdAt,updatedAt)
 SELECT lower(hex(randomblob(16))),CAST(id AS TEXT),'credential',id,password,COALESCE(created_at,datetime('now')),COALESCE(updated_at,datetime('now'))
 FROM users WHERE password IS NOT NULL AND password<>'';

CREATE TABLE ba_viewer_session (
 id TEXT PRIMARY KEY NOT NULL, expiresAt DATE NOT NULL, token TEXT NOT NULL UNIQUE,
 createdAt DATE NOT NULL, updatedAt DATE NOT NULL, ipAddress TEXT, userAgent TEXT,
 userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, profileId INTEGER
);
CREATE INDEX ba_viewer_session_userId_idx ON ba_viewer_session(userId);
CREATE TABLE ba_admin_session (
 id TEXT PRIMARY KEY NOT NULL, expiresAt DATE NOT NULL, token TEXT NOT NULL UNIQUE,
 createdAt DATE NOT NULL, updatedAt DATE NOT NULL, ipAddress TEXT, userAgent TEXT,
 userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, profileId INTEGER
);
CREATE INDEX ba_admin_session_userId_idx ON ba_admin_session(userId);
CREATE TABLE ba_viewer_verification (
 id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expiresAt DATE NOT NULL, createdAt DATE NOT NULL, updatedAt DATE NOT NULL
);
CREATE INDEX ba_viewer_verification_identifier_idx ON ba_viewer_verification(identifier);
CREATE TABLE ba_admin_verification (
 id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
 expiresAt DATE NOT NULL, createdAt DATE NOT NULL, updatedAt DATE NOT NULL
);
CREATE INDEX ba_admin_verification_identifier_idx ON ba_admin_verification(identifier);
CREATE TABLE ba_viewer_rate_limit (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, lastRequest BIGINT NOT NULL);
CREATE TABLE ba_admin_rate_limit (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, lastRequest BIGINT NOT NULL);

-- Keep the legacy admin's user-management writes compatible while both apps migrate.
CREATE TRIGGER ba_legacy_credential_insert AFTER INSERT ON users WHEN NEW.password<>'' BEGIN
 INSERT INTO ba_account(id,accountId,providerId,userId,password,createdAt,updatedAt)
 VALUES(lower(hex(randomblob(16))),CAST(NEW.id AS TEXT),'credential',NEW.id,NEW.password,datetime('now'),datetime('now'));
END;
CREATE TRIGGER ba_legacy_password_update AFTER UPDATE OF password ON users WHEN NEW.password IS NOT OLD.password BEGIN
 INSERT INTO ba_account(id,accountId,providerId,userId,password,createdAt,updatedAt)
 VALUES(lower(hex(randomblob(16))),CAST(NEW.id AS TEXT),'credential',NEW.id,NEW.password,datetime('now'),datetime('now'))
 ON CONFLICT(providerId,accountId) DO UPDATE SET password=NEW.password,updatedAt=datetime('now');
 DELETE FROM ba_viewer_session WHERE userId=NEW.id;
 DELETE FROM ba_admin_session WHERE userId=NEW.id;
END;
CREATE TRIGGER ba_credential_insert AFTER INSERT ON ba_account WHEN NEW.providerId='credential' BEGIN
 UPDATE users SET password=NEW.password WHERE id=NEW.userId AND password IS NOT NEW.password;
END;
CREATE TRIGGER ba_credential_update AFTER UPDATE OF password ON ba_account WHEN NEW.providerId='credential' AND NEW.password IS NOT OLD.password BEGIN
 UPDATE users SET password=NEW.password,updated_at=datetime('now') WHERE id=NEW.userId AND password IS NOT NEW.password;
END;
CREATE TRIGGER ba_profile_insert AFTER INSERT ON users BEGIN
 INSERT INTO user_multi_profiles(user_id,name,is_child_profile,created_at,updated_at)
 VALUES(NEW.id,COALESCE(NULLIF(TRIM(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'')),''),'Viewer'),0,datetime('now'),datetime('now'));
END;
