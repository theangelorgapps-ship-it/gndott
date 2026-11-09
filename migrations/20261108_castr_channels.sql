-- User supplied Castr player and confirmed this feed for BOTH channels.
-- Preserve comment settings and the original imported mappings for rollback.
INSERT INTO live_channel_settings(channel_id,source_kind,hls_url)
SELECT id,'hls','https://stream.castr.com/64dfaae1bf2cb7042d9b8278/live_4780a2203ded11ee8e5c71339e4cc28d/index.m3u8' FROM live_tv_channel WHERE id IN (35,37) AND deleted_at IS NULL
ON CONFLICT(channel_id) DO UPDATE SET source_kind='hls',hls_url=excluded.hls_url,ingest_url=NULL,updated_at=datetime('now');
