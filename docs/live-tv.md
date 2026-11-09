# Live TV and moderation

The channel route uses the same `PlaybackDialog`, `WatchSection`, direct HLS engine, volume slider and fullscreen surface as on-demand titles. Live playback does not read or write on-demand progress or notes. Bible, information and the live discussion remain available while watching. DVR seeking uses the stream's current seekable window; **Back to live** moves to its edge. Streams without a DVR window have no seek slider. A failed or ended source offers **Reconnect stream**.

## Existing streaming service

Channel playback resolves the existing `live_tv_stream_content_mapping` records, preferring an HLS manifest over thumbnail or landing-page rows. No new streaming provider is introduced. Administrators can override playback using **Account → Live TV administration** (`/admin/live-tv`). An empty HLS override restores the migrated source.

For RTMP, keep broadcasting to the existing service. Save its RTMP/RTMPS ingest address and corresponding HTTPS HLS playback output in admin. The app is a player, not an RTMP transcoder or broadcast controller: saving an ingest address does not start a broadcast. The ingest address never appears in public channel responses. Browser playback requires the provider to serve HLS playlists and segments over HTTPS with the appropriate CORS headers. See [HLS.js](https://github.com/video-dev/hls.js).

The configured Bunny source for channel 34 returned a valid manifest and played in the real browser test. The user supplied a [Castr embed](https://player.castr.com/d_cb5bab303ded11eebc1c4576c3a03e3c) and confirmed its feed for both Kids TV (35) and Miracle TV (37). `migrations/20261108_castr_channels.sql` assigns the HLS output published by that embed to both channels, retaining the original imported Akamai mappings for rollback. At verification, the Castr player itself received HTTP 404 for its stream; a direct request also returned an access error. These two channels require the Castr broadcast/source to become available. No access restriction is bypassed and no unrelated stream is substituted.

## Conversation

The player and channel page offer **Live comments**, **Responses**, **Admin comments**, and **Reports**. Replies quote their original comment; removed parents no longer expose their body. Signed-in viewers with an adult profile can comment. Official badges and announcements are generated from the current server-side administrator role, never from submitted client fields.

Admins can enable/disable comments per channel, set a posting interval, pin/unpin or hide messages, mute viewers and allow comments again, and resolve/dismiss reports. Disabling comments rejects new viewer comments and replies at the database write, even if a stale client still shows a composer. Admin announcements and reporting remain available. Reports are visible only to their reporter and administrators. Open reports sort first. Moderation and settings actions create audit records.

Messages are bounded to 1,000 characters; reports to 500. Plain text is rendered as text, not HTML. Per-account/channel rate limits and idempotent request IDs prevent accidental duplicates. Reads return at most 80 recent/pinned comments and 80 reports; visible clients poll every five seconds, back off after failures, and stop polling while hidden or unmounted. This is near-real-time polling, not a WebSocket service. Large events should use a dedicated real-time fan-out service and distributed abuse controls before scaling beyond this baseline.

## Server setup and rollout

1. Apply `migrations/20261108_live_tv.sql`, then `migrations/20261108_castr_channels.sql` to the same D1 database used by the website. The schema migration is additive. The Castr migration only sets the two explicitly requested playback overrides and preserves comment settings and original mappings.
2. Configure the server-only `SESSION_SECRET` binding with at least 32 random characters (already present in the deployed Worker). For local development, put a separate random value in ignored `.dev.vars`. Never copy a production signing secret into the browser or repository.
3. Build and deploy the current branch. Session signatures now use that secret, constant-time cryptographic verification and a signed 30-day expiry. HTTPS cookies are Secure and HttpOnly. Old cookies signed with the previously embedded key are rejected; existing users must sign in again. There is no insecure compatibility fallback.
4. Visit an accessible channel and verify playback. Use an existing administrator account to configure and moderate it. Stream credentials remain restricted to administrators.

## Verification

- `node scripts/gate-live-tv.mjs playback`: real shared-player behavior with an infinite-duration fixture, DVR bounds, volume-independent VOD safety, HLS overrides, source validation and session forgery/expiry.
- `node scripts/gate-live-tv.mjs discussion`: production server handlers and migration in isolated SQLite; permissions, profile restrictions, rate limits, duplicates, cross-channel rejection, report privacy, moderation and access checks.
- `node scripts/gate-player.mjs` and `node scripts/gate-viewer.mjs`: existing on-demand player and profile/session regressions.
- `node scripts/gate-live-tv-ui.mjs`: local-only browser integration with temporary accounts and cleanup; actual configured Bunny playback, comments/replies/admin messages/report handling, comments switch, admin denial, volume and mobile/tablet/4K layouts. Requires a local server at port 5206, the migration/public catalogue, `.dev.vars`, and an installed Playwright Python runtime (`LIVE_TV_PYTHON` can select it). `LIVE_TV_BASE_URL` only accepts localhost.

No production comments or test accounts are created by these checks.

### Production verification — 8 November 2026

Both migrations and Worker version `34e36c54-f196-4fcd-be2b-927d76b87599` were deployed to the current canonical site. Read-only browser checks confirmed actual Bunny playback, volume changes, the four discussion tabs, anonymous admin denial, and layouts at 390px and 3840px without horizontal overflow or page errors. Both Castr channels request the supplied feed; those requests returned HTTP 403 and the player offered reconnect. Castr's source/access configuration must be restored before those two channels can play.
