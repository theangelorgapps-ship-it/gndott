# Approved cleanup implementation

Implemented in `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`, branch `codex/apple-tv-experience`, origin `https://github.com/theangelorgapps-ship-it/gndott.git`. Repository identity was rechecked before `npm uninstall`. The reference is the driver's complete dirty-tree snapshot in `.unlazy/cleanup-baseline`, not Git HEAD.

## Applied changes and measurements

The 19 approved application/configuration paths lose **105,804 bytes and 1,227 physical lines**, with **3 runtime dependencies removed**. These are source/configuration savings, not bundle-size claims. New audit documentation, the new local equivalence script, and the separately authorized schema repair/regression coverage are excluded from these cleanup savings.

| Change | Bytes removed | Physical lines removed |
| --- | ---: | ---: |
| Three unreachable legacy UI modules | 23,541 | 686 |
| Dead frontend declarations, four duplicate CSS rules and two unused imports | 5,578 | 94 |
| Subsequently approved 266 unused CSS rules and empty wrappers | 26,212 | 371 |
| Manifest aliases and compact JSON | 48,119 | 0 |
| Internal unused coupon option | 117 | 0 |
| package.json and package-lock.json | 2,218 | 75 |
| Redundant gitignore rule | 19 | 1 |
| Total | 105,804 | 1,227 |

The frontend declaration total includes six additional orphan comment/blank lines adjacent to the audited 88 lines: the obsolete BunnyPlayer heading, spacing around the removed LiquidGlass import/wrapper, and orphan EOF blank lines in Poster and liquid-glass-logo-reveal. The unused import specifiers remove 17 bytes without removing their lines.

Removed `liquid-glass-button.tsx`, `glass-button.tsx`, and `discrete-tab.tsx`, then ran `npm uninstall --ignore-scripts --no-audit --no-fund lenis motion class-variance-authority`. npm reported exactly three packages removed. `framer-motion`, `clsx`, the editor dependencies and all remaining packages stay intact. The lockfile differs from the snapshot by exactly the three root dependency entries and their three package objects: 2,127 bytes / 72 physical lines. Deep JSON equality and exact serialized byte equality reject unrelated npm churn. A changed Git HEAD numstat does not reflect extra cleanup edits.

Removed unreachable TrailerPlayer/BunnyPlayer, IconShare/IconCalendar/IconClock/ContentCard, the LiquidGlass wrapper, and the unused GlassReveal21st preset. Preserved the full active GlassIconReveal shader/engine.

The driver authorized the exact 266 additional CSS rules only after production HTMLParser evidence showed 31 CMS rows with zero class tokens and no style/script elements, and the frontend audit proved an absent positive top-level class in every selector branch while protecting runtime-generated class families. Applied the guarded AST recipe in audit-frontend.md. All retained selectors, declaration text and media/ancestor conditions are unchanged. Rules were matched by exact baseline signature, avoiding line shifts from the four earlier duplicate-rule removals. Only newly empty wrappers were also removed. Conditional CSS savings: catalogue 109 bytes/2 lines, detail 96/1, player 565/8, styles 25,173/356, tv-theme 269/4.

The image manifest loses 540 redundant extension aliases and keeps every distinct target. Coupon input validation, discount calculation and Stripe coupon metadata remain unchanged; only unused internal argument plumbing is removed.

## Separately authorized schema compatibility repair

The driver's full integration suite found five SQL errors swallowed into empty fallbacks: videos has no `bunny_trailer_url` column. The production schema check confirmed `video_url_input` does exist. Reproduced the problem using actual API handlers, the real DB adapter and an in-memory SQLite video fixture: dashboard video results were empty instead of containing the active fixture.

Changed only the two existing videos query projections to `NULL AS bunny_trailer_url`, preserving that already-declared public response field and `video_url_input`. Entertainment queries and the getVideos public response are unchanged. The regression fixture deliberately has no nonexistent Bunny column; it adds the real `video_url_input` column, active/inactive/deleted video rows, asserts getVideos retains exactly its existing nine fields, checks dashboard/recommendation trailer and full-video sources, and preserves the existing assertion that no SQL error may be swallowed.

The compatibility changes are measured separately: **16 application bytes plus 1,574 existing-test bytes / 15 physical test lines**, 1,590 added bytes total. This is not counted as bloat removal. All 70 server-function declarations/signatures remain. No migration or production data write is required by this compatibility correction.

## Preservation and verification

`scripts/gate-cleanup-equivalence.mjs` compares the actual post-cleanup tree to the saved dirty-tree snapshot. It verifies exact approved transformations for 19 cleanup paths and two compatibility paths (api.ts overlaps), proves the other 689 baseline files unchanged, checks removed dependencies/modules have no source imports, and confirms all 70 server functions and 37 route modules remain. All 562 public assets remain byte-identical. Of the 29 pre-existing scripts, only gate-tv-data.mjs changes, adding regression coverage.

The gate extracts the actual unchanged Poster.img function through TypeScript and evaluates old/new manifests against 5,388 cases. All 536 image targets remain and resolve to existing public files. It reconstructs the approved CSS cuts from the original baseline plus the four duplicate removals, asserts all retained rule signatures unchanged, and parses the result. It separately reconstructs the two API aliases and the precise regression-test additions, so they cannot silently inflate cleanup savings. The gate requires the local `.unlazy/cleanup-baseline` fixture and audit-frontend.md specification; it is cleanup evidence, not a replacement for ongoing behavior tests.

Checks on the final combined leaf tree:

- `node scripts/gate-cleanup-equivalence.mjs`: `CSS_EQUIVALENCE_OK`, `MANIFEST_EQUIVALENCE_OK`, `CLEANUP_EQUIVALENCE_OK`; 105,804 bytes / 1,227 physical cleanup lines removed, compatibility delta separate.
- `./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false`: no diagnostics.
- `node scripts/gate-library.mjs`: profile persistence, billing ownership/failure, readable routes, AVIF validation/deduplication and account library checks.
- `node scripts/gate-viewer.mjs`: 13 ownership cases.
- `node scripts/gate-playback-data.mjs`: real in-memory SQLite read/write, typed identities, resume/watchlist and profile isolation.
- `node scripts/gate-recommendation-v2.mjs`: 18 behavioral fixtures.
- `node scripts/gate-tv-motion.mjs`: native wheel/touch scrolling, passive header updates and teardown.
- `node scripts/gate-tv-data.mjs` and `node scripts/gate-halo.mjs categories`: real video/catalogue/dashboard/recommendation projections and no swallowed SQL errors.
- `git diff --check`: clean.

No historical literal assertion was rewritten to force a pass. No server, browser, watcher, deployment, Git mutation or migration was started. All foreground command sessions ended. The driver owns full build, rendered comparison, release validation and generated binding changes.

## Four passes

1. **Implementation:** read all three audit reports and contract; verified the repository; wrote acceptance gates; applied only approved cuts and dependency uninstall with baseline identity assertions. Applied the additional CSS recipe only after explicit driver authorization.
2. **Domain reread:** reviewed every small cleanup hunk, exact full-file deletion, manifest transformation and retained CSS signature. Confirmed active playback, named logo export, public coupon input/metadata, public routes and server boundaries survive.
3. **Defect hunt:** ran strict compiler, current behavioral safeguards, actual resolver equivalence, exact baseline hashes and import checks. Reproduced the driver's real SQL-schema regression, fixed only its two projections, and strengthened the existing SQLite fixture without adding nonexistent schema columns or changing catalogue response shape.
4. **Polish and final falsification:** removed the orphan Poster and liquid-glass-logo-reveal EOF blanks identified by diff checking; remeasured all savings; distinguished schema/test additions from cleanup; reconfirmed unchanged asset bytes and all retained CSS; reran the relevant final checks. No additional safe improvement was found within assigned scope.

Ledger: **4 of 4 gates met** in `gates/cleanup-live/implementation-GATES.md`. Parent integration must independently rerun the equivalence gate and current release checks against its final combined tree.
