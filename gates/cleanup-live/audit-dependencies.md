# Dependency and tooling cleanup audit

Audit-only, 2026-11-07. Target `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`; Git top-level is the same path, branch `codex/apple-tv-experience`, origin `https://github.com/theangelorgapps-ship-it/gndott.git`. Scope and preservation contract: `gates/cleanup-live/PLAN.md`. No application, package, lockfile or script changes were made by this leaf. No install, Git mutation, deployment, browser or development server was started.

## Ranked Ponytail findings

- delete: Remove the unreachable button/metal-button implementation; nothing replaces it. `src/components/ui/liquid-glass-button.tsx:1–342` has no incoming source/config/script import; the active editor button is `src/components/ui/button.tsx:1`. Saves 342 lines, 12,448 bytes.
- delete: Remove the unreachable glass-button implementation and its component-local style string; nothing replaces it. `src/components/ui/glass-button.tsx:1–264` has no incoming source/config/script import; current header controls are ordinary links in `src/routes/__root.tsx`. Saves 264 lines, 8,686 bytes.
- delete: Remove the unreachable animated tab component; nothing replaces it. `src/components/ui/discrete-tab.tsx:1–80` has no incoming source/config/script import; current DetailTabs is defined in `src/components/Detail.tsx`. Saves 80 lines, 2,407 bytes.
- delete: Remove the unused `lenis` dependency; existing native scrolling remains in `src/components/Motion.tsx:5–13`. `package.json:34`, `package-lock.json:31`, and the lock node at `package-lock.json:4432–4462`; zero executable imports and zero non-root lockfile dependants. Saves 33 metadata lines: one manifest entry, one root lock entry, 31 lock-node lines.
- delete: After deleting discrete-tab, remove `motion`; nothing replaces its unused wrapper. `package.json:36`, `package-lock.json:33`, and `package-lock.json:4791–4816`; its only source import is `discrete-tab.tsx:4`, and it has zero non-root lockfile dependants. Keep `framer-motion` because `src/components/ui/apple-spotlight.tsx:2` uses it. Saves 28 metadata lines.
- delete: After deleting both legacy button files, remove `class-variance-authority`; nothing replaces it. `package.json:29`, `package-lock.json:26`, and `package-lock.json:3888–3899`; both source imports are inside the deleted modules and it has zero non-root lockfile dependants. Keep `clsx`, which the active `src/lib/utils.ts:1` uses. Saves 14 metadata lines.
- delete: Remove redundant `verification/*.log`; `.gitignore:4` already ignores every `*.log`, including that directory. `.gitignore:11`; saves one line, 19 bytes.

net: -762 lines, -3 deps possible.

The total is prospective physical text deletion: 686 TSX lines + 3 package.json lines + 72 package-lock.json lines + 1 ignore line. The three TSX files total 23,541 bytes; metadata saves 2,218 bytes and the ignore rule 19 bytes, for 25,778 text bytes. The three installed package directories currently total 1,420,248 regular-file bytes; this is disk inventory, not a claimed client bundle saving. All three are already absent from the reachable JavaScript graph. No extra transitive package deletion is justified: motion's framer-motion/tslib and CVA's clsx remain used elsewhere. Frontend CSS findings are owned and counted by the frontend audit, not here.

## Import and reachability evidence

All 105 files under `src` were read: 93 TS/TSX, 11 CSS, one JSON. The TypeScript compiler parser collected import declarations, re-exports and literal dynamic imports; CSS `@import` edges were included. This yielded 397 source import occurrences and 245 resolved local edges. Traversal starts at `src/router.tsx:2`, which imports the generated route tree; that tree imports all 37 route files, including `src/routes/media/$.ts`. Exactly 102 files are reachable and the three ranked TSX files above are unreachable. There are no unresolved local source imports and no nonliteral dynamic source imports. This is whole-tree coverage, not sampling.

Lazy imports were explicitly preserved: `AccountLibrary.tsx:21` and `LibraryNoteEditor.tsx:13` load notePdf; `LibraryNoteEditor.tsx:4` loads rich-text-editor; `BrandOpener.tsx:39` loads liquid-glass-logo-reveal; `directPlayback.ts:16` loads hls.js. The manifest JSON is reachable through Poster. Every stylesheet is reachable, including `tv-tokens.css` through `tv-theme.css:1`; stylesheet members need a selector-level audit, not wholesale removal.

Full-repository literal and symbol searches also covered scripts, configs, demos, and verification text. The three module paths are not consumed through file reads, globs, dynamic loaders or config entries. Documentation mentions the removed former header controls. `scripts/leaf-metadata.mjs:226` contains the string `<DiscreteTabs` as an obsolete assertion against Detail.tsx; it does not load the unreachable module. Lenis references in live JSX are inert `data-lenis-prevent` attributes; styles.css also has legacy Lenis selectors. Those optional CSS/attribute cuts belong to the frontend leaf.

Lockfile evidence: `package-lock.json` contains 404 package entries including the root, with 27 runtime and 11 development declarations at root. Checking every package's dependencies, optionalDependencies and peerDependencies finds no non-root dependant of `lenis`, `motion` or `class-variance-authority`. Local installed `motion/dist/es/react.mjs` re-exports framer-motion; there is no additional used motion implementation to preserve.

## Complete direct dependency disposition

| Dependency | Disposition and executable/config evidence |
| --- | --- |
| @radix-ui/react-popover | Keep; `src/components/ui/popover.tsx:2`, used by rich-text-editor. |
| @radix-ui/react-separator | Keep; `src/components/ui/separator.tsx:2`, used by rich-text-editor. |
| @radix-ui/react-slot | Keep; active editor `src/components/ui/button.tsx:2`. |
| @radix-ui/react-toggle | Keep; `src/components/ui/toggle.tsx:2`, used by rich-text-editor. |
| @radix-ui/react-tooltip | Keep; `src/components/ui/tooltip.tsx:2`, used by rich-text-editor. |
| @tanstack/react-router | Keep; router, generated route tree, every route and navigation. |
| @tanstack/react-start | Keep; server functions, session helpers, Vite plugin, Wrangler server entry. |
| @tiptap/core | Keep; rich-text-editor.tsx:8. |
| @tiptap/extension-highlight | Keep; rich-text-editor.tsx:9. |
| @tiptap/extension-placeholder | Keep; rich-text-editor.tsx:10. |
| @tiptap/extension-text-align | Keep; rich-text-editor.tsx:11. |
| @tiptap/pm | Keep; rich-text-editor.tsx:12–13, state/view imports. |
| @tiptap/react | Keep; rich-text-editor.tsx:14. |
| @tiptap/starter-kit | Keep; rich-text-editor.tsx:15. |
| bcryptjs | Keep; `src/lib/api.ts:4`, existing authentication/password behavior. |
| class-variance-authority | Remove only with both unreachable legacy button modules. |
| clsx | Keep; `src/lib/utils.ts:1`, active UI class composition. |
| framer-motion | Keep; `src/components/ui/apple-spotlight.tsx:2`. |
| hls.js | Keep; type and lazy runtime imports in directPlayback.ts, Chromium HLS and quality controls. |
| jspdf | Keep; `src/lib/notePdf.ts:1`, notes export. |
| lenis | Remove; zero executable imports. |
| lucide-react | Keep; active components, routes and editor icons. |
| motion | Remove only with unreachable discrete-tab module. |
| react | Keep; application components, JSX runtime and gate-player render check. |
| react-dom | Keep; portals and gate-player server-render check. |
| sanitize-html | Keep; `src/lib/library.ts:5`, persisted rich-text cleaning. |
| tailwind-merge | Keep; `src/lib/utils.ts:2`; changing conflict resolution is not a proven equivalent. |
| @cloudflare/vite-plugin | Keep; vite.config.ts:4 and SSR Worker integration. |
| @tailwindcss/vite | Keep; vite.config.ts:5 and CSS compilation. |
| @types/node | Keep; tsconfig.json types plus config/scripts. |
| @types/react | Keep; TSX and explicit React types. |
| @types/react-dom | Keep; React portals and renderer typing. |
| @types/sanitize-html | Keep; strict TypeScript library typing. |
| @vitejs/plugin-react | Keep; vite.config.ts:6. |
| tailwindcss | Keep; src/styles.css:2–3 imports theme/utilities. |
| typescript | Keep; type checking plus ten test/transpilation scripts. |
| vite | Keep; vite.config.ts:1, dev/build/preview scripts. |
| wrangler | Keep; deploy/typegen scripts and Wrangler schema. |

## Build/tooling and pending diff review

All 29 scripts were read for imports. Their JavaScript external dependencies are TypeScript and React/ReactDOM in the player rendering check; other module imports are Node builtins (`assert`, `child_process`, `crypto`, `fs`, `module`, `path`, `sqlite`, `url`, `vm`). Seven nonliteral dynamic require/import sites are test harnesses loading transpiled source: halo, library, playback-data, player, recommendation-v2, recommendations, tv-data. Each harness's file targets were checked; none targets the three dead UI files. Python Playwright is used by four browser verification/capture scripts. Three demo Python scripts use standard-library modules; `demo/apple-tv/sample-controls.py:3` additionally uses Pillow. These are operational/reference tooling, not removable application dependencies.

The demo is a standalone design artifact: components.html loads library.js; both HTML pages load library.css and tokens.css, with build/verify scripts and source evidence. Its absence from the application graph does not prove it is disposable. Verification HTML is evidence, not a production module entry point. Preserve tests, demos, migrations and verification materials.

Reviewed root files: package.json, package-lock.json, vite.config.ts, tsconfig.json, wrangler.jsonc, components.json, worker-configuration.d.ts and .gitignore. Vite's four plugins each have a distinct active job; the alias matches tsconfig. All five npm scripts are valid operational entry points. components.json describes the UI generator aliases and current styling. worker-configuration.d.ts is generated runtime/env typing included by tsconfig, not an unused code module.

The existing diff adds 14 runtime dependencies and one typings dependency, all reachable through the new editor/library/playback work; none of those additions should be removed. Existing lockfile diff is +1,952/-216 lines, package.json +15/-0, .gitignore +4/-0, wrangler.jsonc +1/-0, recommendation gate +55/-36. The Wrangler change adds IMAGES for the active upload implementation; keep it. The Motion diff already replaced Lenis with native scrolling, and the root diff already replaced GlassButton/LiquidButton; these explain the dependency leftovers. The recommendations gate changes track the current profile-aware behavior and preserve API export checks. Do not reverse the requested design or behavior to satisfy old implementation-literal assertions.

## Candidates requiring follow-up; excluded from savings

- Test modernization: `scripts/gate-experience-static.mjs:24–47,66–74` has a historical changed-file allowlist and requires package.json/wrangler.jsonc to equal HEAD byte-for-byte. The authorized current work already violates those assumptions. `scripts/leaf-metadata.mjs:223–246` also requires former JSX and local-note strings. Preserve test intent and use current behavior contracts; do not delete tests just to make a gate pass. `verification/README.md` already documents historical literal-layout gate limitations.
- Duplicate build runners in `scripts/gate-account-library.mjs`, gate-glass-responsive.mjs, and gate-playback-responsive.mjs share orchestration but have different required checks and separate artifacts. No deletion or common runner is justified for this preservation pass.
- Active Radix/Tiptap/HLS/PDF/sanitization packages do more than native shortcuts. A package's single consumer is not evidence that replacing it preserves accessibility, saved formatting, playback compatibility, PDF layout or data cleaning.
- Potential unused exported members inside reachable frontend/backend files are assigned to those audit leaves. Public server functions and routes are not removed by this graph audit, even if they lack a visible UI caller.
- Tailwind scans source text, including unreachable modules. Rebuild and compare the current rendered UI after removal; this leaf claims dead JavaScript/source savings, not an exact CSS bundle reduction.

## Four passes and verification

1. Complete inventory: parsed the full source graph, all script import surfaces, root config/build inputs and pending tooling/dependency diff.
2. Expert re-read: included generated routes, literal lazy imports, CSS imports, test loaders, typings/config/CLI consumers and lockfile peer/optional edges. Retained every active editor/player/library dependency.
3. Defect hunt: confirmed the DiscreteTabs test string is not a consumer; distinguished active liquid-glass.tsx and button.tsx from legacy similarly named modules; checked Tailwind implications and stale aggregate assertions. Existing `node scripts/gate-tv-motion.mjs` passes with `TV_MOTION_OK: native wheel/touch scrolling, passive header updates, teardown`.
4. Final measurement/polish: re-ran graph and byte/line measurements; reconfirmed exactly three unreachable modules and zero reachable imports for the three packages. Verified root lockfile entry line numbers. Full final pass found no additional proven tooling/dependency cuts. A SHA-256 over sorted source/script paths and bytes plus the eight root runtime/build files was identical before/after report creation: `cd75d8037103799028ca5effc694f5bf03153760188d085fe14342dfcb014de1` (142 files). No runtime mutation is part of this audit.

Parent verification after implementation: rerun graph, TypeScript, production build and current behavior gates; confirm removed package nodes do not remain and active dependencies still resolve; compare screenshots/current UI at the same routes and widths. Do not count this report as evidence that post-removal build or visual verification has already run.

## Exhaustive file inventory

The following paths were inspected for import/build reachability; directory prefixes apply to every name in the corresponding row.

| Directory | Files |
| --- | --- |
| `src/` | `auth-flow.css`, `catalogue.css`, `detail.css`, `header.css`, `library.css`, `liquid-glass.css`, `player.css`, `responsive-glass.css`, `routeTree.gen.ts`, `router.tsx`, `styles.css`, `tv-theme.css`, `tv-tokens.css` |
| `src/routes/` | `__root.tsx`, `account-setting.tsx`, `cast.$id.tsx`, `cast.tsx`, `change-password.tsx`, `channel.$id.tsx`, `coming-soon.tsx`, `continue-watching.tsx`, `faq.tsx`, `forgot-password.tsx`, `genres.tsx`, `index.tsx`, `live-tv.tsx`, `login.tsx`, `manage-profile.tsx`, `movie.$id.tsx`, `movies.tsx`, `notifications.tsx`, `otp-login.tsx`, `page.$slug.tsx`, `pay-per-view-history.tsx`, `pay-per-view.tsx`, `payment-history.tsx`, `payment-success.tsx`, `profile-details.tsx`, `register.tsx`, `search.tsx`, `subscription-plan.tsx`, `teaching.$id.tsx`, `teachings.tsx`, `trending.tsx`, `tv-show.$id.tsx`, `tv-shows.tsx`, `video.$id.tsx`, `videos.tsx`, `watchlist.tsx` |
| `src/routes/media/` | `$.ts` |
| `src/components/` | `Account.tsx`, `AccountLibrary.tsx`, `BibleReader.tsx`, `BrandOpener.tsx`, `Detail.tsx`, `ImmersivePlayer.tsx`, `LibraryNoteEditor.tsx`, `Motion.tsx`, `Poster.tsx`, `ProfilePhoto.tsx`, `ResumeCard.tsx`, `ScrollRail.tsx`, `ShowDetail.tsx`, `SubscriptionControls.tsx`, `TitleDetail.tsx`, `TitlePreview.tsx`, `directPlayback.ts`, `playbackResume.ts`, `playerBridge.ts`, `playerFullscreen.ts`, `previewPlayback.ts` |
| `src/components/ui/` | `apple-spotlight.tsx`, `button.tsx`, `discrete-tab.tsx`, `glass-button.tsx`, `glass-folder-cards.tsx`, `input.tsx`, `liquid-glass-button.tsx`, `liquid-glass-logo-reveal.tsx`, `liquid-glass.tsx`, `popover.tsx`, `rich-text-editor.tsx`, `separator.tsx`, `skeleton.tsx`, `toggle.tsx`, `tooltip.tsx` |
| `src/hooks/` | `usePlaybackProgress.ts` |
| `src/lib/` | `api.ts`, `bible.ts`, `bibleProvider.ts`, `billing.ts`, `catalogueFilters.ts`, `contentRoutes.ts`, `db.ts`, `imageProcessing.server.ts`, `imageUpload.ts`, `img-manifest.json`, `library.ts`, `notePdf.ts`, `playback.ts`, `recommendations.ts`, `session.server.ts`, `utils.ts`, `viewer.server.ts`, `viewer.ts` |
| `scripts/` | `capture-nomenclature-deployed.py`, `gate-account-library.mjs`, `gate-experience-deployed.mjs`, `gate-experience-local.py`, `gate-experience-static.mjs`, `gate-glass-responsive.mjs`, `gate-halo.mjs`, `gate-hero-contract.mjs`, `gate-interface-static.mjs`, `gate-layout-contract.mjs`, `gate-library.mjs`, `gate-metadata-search-deployed.mjs`, `gate-metadata-search-live.py`, `gate-metadata-search-static.mjs`, `gate-nomenclature-deployed.mjs`, `gate-nomenclature-live.py`, `gate-nomenclature-static.mjs`, `gate-playback-data.mjs`, `gate-playback-responsive.mjs`, `gate-player.mjs`, `gate-recommendation-v2.mjs`, `gate-recommendations.mjs`, `gate-tv-data.mjs`, `gate-tv-motion.mjs`, `gate-viewer.mjs`, `leaf-labels.mjs`, `leaf-metadata.mjs`, `leaf-search.mjs`, `leaf-teaching.mjs` |
| `demo/apple-tv/` | `build-library.py`, `components.html`, `library.css`, `library.js`, `sample-controls.py`, `style-guide.html`, `tokens.css`, `verify-library.py` |
