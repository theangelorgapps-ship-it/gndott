# Gates: Live TV player and moderated discussion

OWNS: src/**, migrations/20261108_live_tv.sql, migrations/20261108_castr_channels.sql, scripts/gate-live-tv.mjs, scripts/gate-live-tv-ui.mjs, scripts/gate-live-tv-ui.py, scripts/gate-viewer.mjs, scripts/gate-player.mjs, .gitignore, docs/live-tv.md, gates/live-tv/**

Scope: repair Live TV with the shared player and HLS delivery, private RTMP-to-HLS configuration, viewer comments/replies/admin messages/reports, and authenticated admin settings/moderation without changing the existing design.

- [x] L1: Live stream source validation and shared-player live behavior handle HLS and distinguish RTMP ingest from playable output.
  CHECK: node scripts/gate-live-tv.mjs playback
  EXPECT: LIVE_PLAYBACK_PASS
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=9d8b259f7d71135034fde453a3b553bf812687320dabb84976f88e9289750809; exit=0; EXPECT=matched; output-sha256=e8e565c6828aba33bb4070ad8648df7abce378d6c4f4913bc5880d177cb0b028; output-bytes=19; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=f1160462bf50/25 entries
- [x] L2: Comments, replies, reports and administrator moderation persist with ownership, permissions and comment-disable enforcement.
  CHECK: node scripts/gate-live-tv.mjs discussion
  EXPECT: LIVE_DISCUSSION_PASS
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=eefcce0c00792a946a49972e609e94de343984e9ab137f9a220192792fce2d2c; exit=0; EXPECT=matched; output-sha256=fa9c9ba8c97b8187a4a424ba8b716c1c6ee0afc55139cc21dddebe0d0d192d42; output-bytes=21; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=f1160462bf50/25 entries
- [x] L3: Channel/admin interfaces expose responsive discussion tabs and stream/comment controls with functional interaction tests.
  CHECK: node scripts/gate-live-tv-ui.mjs
  EXPECT: LIVE_UI_PASS
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=2c000961fd372154296a9136c8e3187a194d1dd803ee0b655bb8d242fde89e99; exit=0; EXPECT=matched; output-sha256=5558b37797c82a57d900078d1b626ce1e87cf8009d712fa125d54381e74515bb; output-bytes=163; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=f1160462bf50/25 entries
- [x] L4: Production build, TypeScript, existing on-demand player and viewer/session checks pass after shared-player changes.
  CHECK: npm run build && ./node_modules/.bin/tsc --noEmit && node scripts/gate-player.mjs && node scripts/gate-viewer.mjs
  EXPECT: VIEWER_OWNERSHIP_OK
  CWD: ../..
  EVIDENCE: automatic-evidence=v1; definition-sha256=d6035dbcecde2d9422788e2270a95ec6930d89b1fa93dbd8757499a01ce448c8; exit=0; EXPECT=matched; output-sha256=0b5a03cd2e59d5aa6ab97e10e3428d820a8d7e48f38f3048e5ed99eac444328b; output-bytes=20988; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=f1160462bf50/25 entries
- [x] L5: Actual configured live media and responsive layouts are verified; any external RTMP delivery dependency is explicit.
  EVIDENCE: Verified real Bunny HLS playback and advancing media time, volume, ongoing discussion while playing, plus mobile 390px, tablet 768px and 3840px screenshots in verification/live-tv/. Reviewed mobile/desktop screenshots after fixing tab overlap and composer clipping. The supplied Castr embed's own player returned stream HTTP 404; both requested channels are configured for that output and require the provider broadcast to become available. RTMP ingest needs the existing provider's HLS output; no transcoding or access bypass is claimed.


- [x] L6: Current production site serves the new shared live player and moderated discussion, with the requested Castr mappings and admin access restriction.
  EVIDENCE: Deployed current canonical site on 2026-11-08, Worker version 34e36c54-f196-4fcd-be2b-927d76b87599. Both additive migrations applied; production D1 read confirms Castr overrides for Kids TV 35 and Miracle TV 37. Read-only Chromium verification returned LIVE_PRODUCTION_PASS: real Bunny media time advances, volume slider works, all four discussion tabs are present, anonymous admin access is denied, 390px/3840px layouts have no horizontal overflow, and no page errors. Both Castr playback requests target the supplied feed and return provider HTTP 403 with reconnect available; provider availability remains an external limitation. Evidence: verification/live-tv/production-check.json and production screenshots. No production test accounts or comments created.
