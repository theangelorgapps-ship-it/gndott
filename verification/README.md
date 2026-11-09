# Apple TV experience verification

Verified 7 November 2026 on branch `codex/apple-tv-experience` in `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`.

## Automated checks
- `npm run build`: PASS; Vite client and Cloudflare server output produced. Existing large-chunk advisory remains (client bundle over 500 kB); no build error.
- `./node_modules/.bin/tsc --noEmit`: PASS.
- `node scripts/gate-tv-data.mjs`: PASS. Actual API handlers and DB adapter execute against in-memory SQLite; genre joins, active hero metadata, episode sources/access and purchase user/type/expiry isolation covered.
- `node scripts/gate-tv-motion.mjs`: PASS. Actual MotionRoot lifecycle exercised with media-query/RAF mocks: native mobile and reduced-motion behavior, desktop interpolation, live preference change, modal scroll lock and cleanup.
- Recommendation scoring, groups and API gates: PASS.
- `node scripts/leaf-metadata.mjs`: PASS; preserves the project's existing exclusion of classification/review/language UI.
- `python3 demo/apple-tv/verify-library.py`: PASS: 24 component categories, 51 variants, 88 specimens, 23 exact source samples; CSS tokens are cycle-free and match application tokens.
- `node --check demo/apple-tv/library.js` and `git diff --check`: PASS.

The old aggregate `gate-metadata-search-static.mjs` was attempted. Its preservation checks require former literal JSX (for example `baseFor(hero)`, the previous watchlist label, and the old search-modal button). It is not a valid acceptance test for the requested redesign. Its metadata absence check was run independently and passed; functional replacements were verified below. No claim is made that every historical layout assertion passes.

## Browser verification
The browser used the local app with an isolated public-catalogue fixture; no account or payment rows were copied. See `local-catalogue.json`. Production data was read only.

- Home: portrait art on phones, landscape above the mobile breakpoint, real genres, white Play action, working carousel pause, Top 10 first and snapping poster rails.
- Header: 76 px high, zero outer border/radius, six progressive blur layers, working subscription destination. At 1440 px all desktop navigation fits; no horizontal overflow.
- Mobile: 320 and 390 CSS-pixel widths checked for Home and Search; no horizontal overflow. At 390 px the detail page also has no overflow. Native 390×844 iframe captures avoid the browser viewport tool's screenshot scaling artifact. Both frames show the actual running app. `mobile-geometry.json` records a 48 px Play button, #F7F7F7 fill and 999 px radius; detail hero is 692.08 px high.
- Menu: opens, Shift+Tab wraps to final link, Escape closes and restores focus to Open menu; body scroll lock is released.
- Search: Catch The Fire returned two teaching results; Fire genre returned six results; Teachings narrowed it to four; Back restored the blank category screen. Category and genre routes use real IDs, and the URL reflects filters.
- Details: initial render has no playback iframe. Play loads the correct Catch The Fire episode; Escape removes the iframe, unlocks scrolling and restores Play focus. Theosophy volume selection shows the real empty state for its empty second volume and restores six episodes on Season 1. Selecting Theosophy 2 opens a player titled Theosophy_Part_2.m4v. More expands the actual synopsis.
- Bible, Notes and About panels remain available. Library action redirects an anonymous viewer to the existing login screen. Ctrl+K still opens Spotlight, and Escape closes it.
- Subscription opens existing real plan data; no purchase was initiated. Signed-in purchases and production account mutations were not exercised.
- No app runtime errors observed. The third-party player reported a failed metrics request, which did not prevent player controls loading.

## Review and evidence
Exactly one independent control review: 2 blocking and 8 important findings were fixed; 5 acceptable platform/inference differences are documented in `demo/apple-tv/ui-review-report.md`. The parent visually inspected the corrected library and final app. Motion timing and web glass rendering are documented approximations rather than claims of identical native Apple rendering.

Screenshots:
- `home-desktop.png`: final compact-desktop header and hero.
- `mobile-home-detail.png`: actual Home and detail at 390×844.
- `search-detail-mobile.png`: actual Search and detail at 390×844.
- `demo/apple-tv/screenshots/components-final.png` and `style-guide-final.png`: refreshed final library.

## Handoff
All changes are local and uncommitted on `codex/apple-tv-experience`. Nothing was pushed or deployed. Temporary Vite server (5190) and library server (5187) were stopped and agent-created browser tabs closed. Other pre-existing workspace processes were left untouched.

## Phase 2 — custom Bunny player, profiles and recommendations

Implemented and verified 2026-11-07. `walkthrough.html` collects actual screenshots of the player and signed-in flow. Existing phase1 evidence above remains valid; phase2 supersedes the former iframe-only player and user-wide recommendations.

- Direct Bunny HLS URL from the existing `video_url_input` now plays through a native video element and lazy hls.js on Chromium. Safari/iOS prefers native HLS. HLS manifest levels drive the real quality selector; provider iframe is retained only as a fallback. No API credential is included in player code.
- Actual browser playback observed a `blob:` media source, readyState4, finite5026.433333-second duration and advancing currentTime. Zero player iframes and native controls=false confirm one custom control layer. Quality choices were Auto,240p,360p,480p,720p,1080p for the tested stream;720p selected, actual video.playbackRate changed to1.5.
- Resume fixture at420seconds produced7:04 shortly after play. Ten-second seek, pause and close were exercised; local SQLite showed actual progress updates for profile900001. No network events were fabricated as history. Exact route `/teaching/268#watch-episode-146` opened Theosophy2.
- Browser QA caught ignored pre-ready seeks and fullscreen requests targeting HTMLDialogElement. Fixed with confirmed-position resume and an innerDIV fullscreen surface. Fresh IAB playback changed the real UI to Exit full screen and exiting changed it back to Enter full screen. Chrome automation rejected both DIV and rootHTML requests with `not granted` despite active/focused document, so Chrome-native fullscreen is not claimed as verified. Read-only DOM snapshots omit fullscreen state; the app's fullscreenchange-driven button state is the evidence. Temporary diagnostic logging was removed.
- Notes saved and survived switching to Bible and back. Info/Bible/Notes open in the lower overlay without replacing the media. Real screenshot evidence: player-info.png, player-controls.png, player-notes.png, player-bible.png. Device-local notes are intentionally not represented as server-synced notes.
- Login with the isolated local account opens profile selection. Charles sees StrangeOil in Continue Watching and StatureInTheSpirit in Watchlist; Family sees MoneyWithAMission and a different recommendation row. Logout returns to login; an incorrect password displays a recoverable error. The account was created only in ignored local SQLite fixtures using a reserved example.test email. No production account or payment rows were copied or changed.
- Mobile DOM measurements: home widths320/390 have equal clientWidth/scrollWidth; player390 also has no horizontal overflow. Dock, search circle and player tabs have0px borders. Dock layer width289px equals its container width; fixed a positioning bug that had covered the search circle. Fixed long mobile title/tool shrinkage and centred transport over the video. Physical iPhone/Android hardware was not used.
- Full typecheck passed. Tests rerun by parent: gate-player.mjs (7 markers), gate-viewer.mjs (13 cases), gate-playback-data.mjs (realSQLite read/write with profile/type/episode/account isolation), gate-tv-data.mjs, gate-recommendation-v2.mjs (17 cases), recommendation scoring/groups/API, motion and metadata gates. Production build passed; pre-existing main-bundle size advisory remains, and HLS is a separate lazy chunk.
- Public Bunny delivery documentation: https://github.com/BunnyWay/documentation/blob/main/stream/storage-structure.mdx . HLS implementation reference: https://github.com/video-dev/hls.js . Fullscreen constraints: https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen .

## Mobile menu refinement

- Replaced the expanded menu with a native modal sheet: borderless glass, grouped catalogue/library/account destinations, a persistent close action and a separate membership footer. Phone header now uses compact account/menu controls.
- Verified all 11 menu destinations through actual clicks: Home, Sermons, Teachings, Shows, Videos, Live TV, Continue Watching, Watchlist, Account, Membership and Search. Every navigation closed the sheet. See `mobile-menu-routes.json`.
- Verified all five dock actions and four active-page indicators. See `mobile-dock-routes.json`.
- At390×844 the sheet is370px wide with0px border. At320×568, document clientWidth=scrollWidth=320; the sheet fits x10–310/y18–558. Its350px body scrolls through564px of content; the close control and footer remain visible. Scrolling exposes library/account normally. Safe-area insets are included in CSS; physical notched-device behavior is not claimed as tested.
- Close button, backdrop and Escape dismiss; body overflow restores. Shift+Tab from Close menu focuses Explore membership; Tab returns to Close menu. Native modal makes background content inert.
- Actual screenshots: `mobile-menu.png` (390px), `mobile-menu-320.png` (short-screen scroll), refreshed `mobile-liquid-glass.png`.

- Final responsive pass also corrected Continue Watching: its grid inherited narrow portrait columns despite a flex-basis rule. Resume rails now use landscape grid columns (273px at390px viewport) with two-line titles. Desktop1440px layout has no horizontal overflow; widening an open menu releases the modal/scroll lock.

Final completion: TypeScript and the production rebuild after mobile polish both exited0; git diff --check passed. The existing size advisory remains. Task servers on5190/5187 stopped and closed ports confirmed. Temporary browser tabs closed and viewport override reset. Changes remain local/uncommitted; no push or deployment.
