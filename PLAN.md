# Apple TV experience implementation
## Shared contract
Repo root: /Users/charlesfinney/Documents/Codex/Projects/New project/gndott; origin https://github.com/theangelorgapps-ship-it/gndott.git; branch codex/apple-tv-experience. Preserve real data, all existing URLs and backend semantics.
Read DESIGN-REFERENCE.md for inspected reference details. Global system font/neutral surfaces and --tv-* tokens are integrated by parent in src/tv-theme.css imported AFTER src/styles.css in root. Leaf CSS imports follow tv-theme.css, in order header.css, catalogue.css, detail.css. Each leaf creates only its owned CSS. No editing src/styles.css by leaf workers. Avoid !important unless unavoidable inherited animation rule; prefer scoped selector. Header/nav root owner imports the three CSS paths; empty files are created now by parent.
Parent owns src/tv-theme.css, src/styles.css cleanup, src/components/Motion.tsx, verification, demo assets, root GATES.md. Parent installs dependencies and builds/tests; workers can typecheck after node_modules exists. No worker package installation, git operation, deployment or production data writes.

## Leaves
- browse: src/routes/__root.tsx, src/components/Poster.tsx, src/routes/index.tsx, src/routes/search.tsx, src/header.css, src/catalogue.css; gates/browse.md.
- detail: src/components/Detail.tsx, src/components/ShowDetail.tsx, src/routes/movie.$id.tsx, src/routes/video.$id.tsx, src/detail.css, optional shared src/components/TitleDetail.tsx; gates/detail.md.
- design library: scratch demo/apple-tv/* only (already in progress); copied in by parent.
- Integration: parent verifies leaves and UI behavior, one independent control review, resolves issues and delivers.

## Status
2026-11-07: User approved clone destination. Cloned clean main; created codex/apple-tv-experience. Dependencies installed; all three implementation leaves and integration verification complete. See verification/README.md. No deployment performed.


## Phase 2: player + glass + recommendation + signed-in flow
Confirmed root /Users/charlesfinney/Documents/Codex/Projects/New project/gndott, branch codex/apple-tv-experience, origin https://github.com/theangelorgapps-ship-it/gndott.git. Prior changes stay intact. User explicitly asks Notes/Bible/Info in player's lower overlay (new screenshot confirms).

Ownership:
- player leaf: Detail.tsx, TitleDetail.tsx, ShowDetail.tsx, movie.$id.tsx, video.$id.tsx, detail.css, new ImmersivePlayer.tsx/player.css/usePlaybackProgress.ts if needed, gates/player.md. Implement fullscreen-like modal with accessible central play/10sec seek/progress/Info/Notes/Bible panels using real provider API; preserve paid gates.
- recommendations leaf: src/lib/recommendations.ts, scripts/gate-recommendations.mjs, new scripts/gate-recommendation-v2.mjs, docs/recommendations.md, gates/recommendations-v2.md. Pure ranking only, no API/UI changes.
- auth leaf: login/manage-profile/account routes, Account.tsx, new src/lib/viewer.ts + viewer.server.ts, new auth-flow.css, gates/signed-in.md. Active profile server-validated and stored in existing signed session pid; getActiveViewer returns {userId,profileId,profileName} or null. No api.ts edits.
- parent: src/lib/api.ts, new src/lib/playback.ts, glass component/CSS, root/header/catalogue theme integration, local fixtures and verification. Parent imports CSS and integrates profile-aware recommendation queries/progress.

Contracts: recommendation payload remains forYou/discovery/recent/hasHistory/topGenres plus optional reason metadata. Options may add saved/watchlist signals; coordinate exact interface. Playback server functions getPlaybackProgress({data:{contentType,contentId}}) -> {position:number,duration:number}; recordWatchProgress({data:{contentType,contentId,position,duration}}) -> {ok:boolean}. Auth leaf owns getActiveViewer in viewer.server.ts, selectViewerProfile server function in viewer.ts. Player records only actual playback events (throttled), uses current source and respects access checks. No packages or production writes by leaves. Use existing dependencies. All workers are not alone and must preserve others' edits.

2026-11-07: Phase 2 begun; 15.94s recording inspected at four timestamps. Reference: full-bleed video, central Play and +-10s, bottom title/seek bar, lower information panel over dark gradient. Native provider restrictions must be handled honestly; no fake controls.

2026-11-07: User clarified true full-screen and custom Bunny player. Direct HLS URLs already exist in video_url_input; added official hls.js dependency (lazy loaded on playback) and switched custom player to direct streams with embed fallback. Browser QA exposed the HTMLDialogElement fullscreen restriction; fullscreen must target inner DIV containing media plus all controls. Parent API and UI now profile-scoped with saved/history candidates, typed IDs and actual Continue Watching/episode resume. Isolated local account+two profiles created for QA only; no production user records accessed or changed.

2026-11-07: User requested a further mobile-menu polish pass after player verification. Parent owns root/header/glass changes. Refine both expanded navigation and floating dock: native modal sheet, cleaner account/header actions, grouped catalogue/library/account destinations, borderless glass, stronger active state, safe-area and320px layout, keyboard/tap dismissal. Preserve desktop header reference and all completed player/recommendation/auth work. Processes remain required until this added UI verification completes.

2026-11-07: Integration completed. Real Bunny playback/resume/panels/fullscreen tested, signed-in two-profile isolation shown, all menu/dock destinations exercised at phone widths, final TypeScript/build passed. Nine integration gates recorded. Temporary servers/tabs stopped; all changes local and uncommitted, no deployment. Review artifact: verification/walkthrough.html.
