# Gates: player and live chat

- [x] G1: Supplied Nimbus Waterline design is integrated into mobile player information tabs, with full text labels, deselection, keyboard navigation and safe WebGL cleanup/fallback.
  CHECK: node scripts/gate-liquid-navbar.mjs
  EXPECT: LIQUID_NAVBAR_PASS
  EVIDENCE: Pass. Two simultaneous renderings have unique SVG filter IDs; no reading panel gives no selected lens. Same-tab taps reach the parent, arrows move focus without opening a panel, and Continue Watching is an action rather than a pressed toggle. Actual component lifecycle verifies idle/offscreen/hidden pause, reduced-motion settling, context loss/fallback, restore, resize and all GPU/listener/observer cleanup.
- [x] G2: Speed/quality settings use rounded glass and accessible choices without changing playback behavior.
  CHECK: node scripts/gate-player.mjs
  EXPECT: PLAYER_CONTROLS_OK
  EVIDENCE: Pass. Real player tree retains volume/seek/mute behavior; the shared choice picker changes the actual media playbackRate. Tabs open Bible/Notes, toggle closed and return to video. Settings width is bounded inside phone viewports; inherited rectangular button/filter styling is explicitly removed.
- [x] G3: Public live chat uses compact messages, rounded sheet, collapse/reopen, emoji composer and real reactions while retaining admin queues.
  CHECK: node scripts/gate-experience-glasslive.mjs
  EXPECT: EXPERIENCE_GLASSLIVE_PASS
  EVIDENCE: Pass. Public route has no management tabs, including for administrators. Replies, pinned official messages and public comments stay together. Tests execute composer/reply/report/failure preservation, collapse/reopen, reaction send, emoji append, block confirmation and unblock. Admin-only reports and moderation actions remain intact.
- [x] G4: Block/unblock is account-scoped and server-enforced; reporting, slow mode and administrator moderation remain protected.
  CHECK: node scripts/gate-live-tv.mjs discussion
  EXPECT: LIVE_DISCUSSION_PASS
  EVIDENCE: Pass against SQLite executing production handlers. Tests cover mutual visibility, private block records, idempotency, cross-account unblock denial, cross-channel/self/admin block denial, unauthenticated and CSRF rejection, no blocked-text leak through replies, moderator visibility, unblocking restoration, actual emoji comments with normal rate limits. Existing subscription, profile, report, mute, hidden-comment and settings checks also pass.
- [x] G5: Player and chat focused checks, typecheck and defect review pass.
  CHECK: node scripts/gate-live-tv.mjs playback; node scripts/gate-experience-player.mjs; npx tsc --noEmit; git diff --check
  EVIDENCE: All pass. No dependencies installed, no network mutations, no development processes left running. Manual defect review corrected settings overflow, per-button frost, context cleanup and modal keyboard event propagation. Root owns visual verification across viewports.

## Integration contract
- Apply `migrations/20261108_live_chat_blocks.sql` before releasing this application build. The read handlers require the new table.
- `src/player-chat-refinement.css` is imported by both player/chat components; `liquid-glass-navbar.css` is imported by its component. Root need not add stylesheet imports.
- Blocking hides both viewers' chat messages while signed in; guests still see public channel messages, and administrators retain moderation evidence. The confirmation explains these limits.
- Reactions are real emoji comments, using the existing authenticated, slow-mode/idempotent endpoint. There are no fabricated viewer or reaction counts.
- Browser verification is handed to root: 320/391px tabs and settings, chat message menus/composer/reactions, collapse/reopen, and live moderation panel.

## Follow-up: Catch The Fire playback investigation
- Local SSR `/teaching/catch-the-fire-270` supplies episode 104 (Part 2) and episode 105 (Part 1), library `347005`, CDN `vz-71678b8b-6af.b-cdn.net`. `ShowDetail` chooses the first playable episode and passes its direct HLS URL through `WatchSection` to `ImmersivePlayer`.
- Read-only bounded network checks: both episode master playlists, their 240p playlists, sampled first media segments and AES-128 key requests succeed under both localhost and production Origin/Referer. Every Part 2 rendition (240/360/480/720/1080p) returns HTTP 200; first segments return 206; keys return 200 with 16 bytes. Key contents were neither printed nor persisted. Responses permit CORS `*`.
- Bunny embed pages resolve both episodes under that library and point to the same CDN. No unavailable/forbidden response. Local Vite log has no HLS or playback error.
- A bounded FFprobe read of Part 2 240p successfully identifies H.264 High video and AAC LC stereo audio with no errors (provider `.dts` segment extension explicitly allowed for the probe).
- Root browser confirmation: the inner Play control starts Part 2 successfully, readyState 4, paused false, duration 1744.04, currentTime 11.77, blob currentSrc and no errors. The empty video source observed before that was an unconsumed playback intent, not stale media or a localhost signing/referrer failure.
- Provider-generated seek sheets on this exact CDN return `image/jpeg` and use a 6×6 crop grid. Media leaf confirmed these are excluded from AVIF pruning/conversion; neither source dimensions, signing query nor crop grid is changed.

## Follow-up: one-click playback intent
- `PlaybackDialog` opts into the additive optional `WatchSectionProps.initialAutoPlay`; all other player mount contexts remain idle by default. Existing purchase gates still decide whether the player mounts.
- `ImmersivePlayer` consumes the opening Play intent once per transport after saved progress is available, preserving resume. Direct-player browser policy denial restores the existing paused Play prompt without automatic retry. Provider playback stays visibly paused until an actual play event confirms success, because its command API cannot report autoplay policy denial. Explicit viewer interaction consumes pending automatic intent.
- CHECK: `node scripts/gate-player.mjs` → `PLAYER_INITIAL_PLAY_OK`, plus all existing player gates. Actual component effects cover initial play, saved resume, repeated renders, recreated Strict Mode transport, policy denial, manual retry, cancellation by viewer interaction, provider readiness and play confirmation. Paid-gate tests verify intent never mounts unpurchased media and reaches only authorised players.
- CHECK: `node scripts/gate-experience-player.mjs`, `node scripts/gate-live-tv.mjs playback`, `npx tsc --noEmit`, `git diff --check` → all pass. Root owns the final one-click browser check.
