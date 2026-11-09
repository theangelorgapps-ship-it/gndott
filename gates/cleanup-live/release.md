# Cleanup release evidence

Target: `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`, branch `codex/apple-tv-experience`, origin `https://github.com/theangelorgapps-ship-it/gndott.git`.

## Before release

- Worker: `gndott`; public URL: https://gndott.theangelorgapps.workers.dev/.
- Previous active version / rollback target: `43226e39-f27b-4898-a201-06184f4003f8`, deployed 2026-11-06T22:40:20.728751Z at 100%.
- Git source before the accumulated feature work: `0337ddacf2bda21c0a3a73acdc043fa7d052e4c6`; remote main matched this commit. Existing user-requested working-tree features are retained in this release.
- Auth: Wrangler OAuth verified. Existing secret name `SESSION_SECRET` retained; no secret values copied into evidence.
- D1: `halobox-migrated-20261105` / `3bc8aa15-6d59-42be-93df-23397c737c56`. Pending migration `20261107_library.sql` creates three tables with `IF NOT EXISTS`; no existing rows are replaced.
- Retained R2 bucket `halobox-migrated-media-20261105`, binding `MEDIA`; Images binding `IMAGES` configured. Generated binding types refreshed to include it.
- Live CMS safety scan: HTMLParser inspected all 31 public HTML rows (6 pages, 25 FAQs), including unquoted attributes. No class tokens, style elements or script elements. Only aggregate evidence retained.
- Existing production settings: Bunny library and payment-method settings present. Stripe secret and Google client ID are absent from the queried active settings; credentials are not altered by this cleanup. Billing provider calls are verified by ownership/failure tests, not by cancelling a real subscription.

## Release result

Production migration applied successfully (4 SQL commands, 1.21 ms). Wrangler reports no outstanding migrations and confirms all three library/cancellation tables. Strict TypeScript, source/image/CSS equivalence, all current behavior gates, live Bible reads and production build pass. Source commit `6444c28` was pushed to `origin/codex/apple-tv-experience` and deployed to the existing Worker. Main was not modified.

Measured cleanup: 105,804 source/config bytes and 1,227 physical lines removed, 3 dependencies removed. Client build: CSS 228,377 → 182,124 bytes; JavaScript 2,708,283 → 2,662,315 bytes. All client assets 26,070,145 → 25,977,924 bytes (92,221 bytes smaller). These are raw file-byte comparisons, not transfer-time claims. The separately tested videos-schema correction retains existing response keys.

Browser comparison before/after CSS removal: all 108 pre-existing desktop style/geometry records and all 87 phone records match exactly; no phone document overflow. The repaired query restores the previously empty video rail. Evidence is saved locally in verification/cleanup-*-dom.json and screenshots.

## Live verification

- All 17 public HTTP checks returned 200 with expected HTML/image/font/CSS content types; no application error pages. Local evidence: `verification/cleanup-live-http.json`.
- Live responsive checks: 400×844 and 3840×2160 CSS viewports have document widths exactly400 and3840. Mobile dock and search both64px high, top770/bottom834. 4K header134.398px and title104px; existing responsive design retained. Screenshots/geometry saved locally.
- Public video51 played successfully. At38seconds, pause held playback and the Volume slider changed1→0.99; fullscreen could be exited without leaving playback. Player screenshot saved. No real customer library writes or subscription cancellations were performed.
- Initial Bible failure: local Node and workerd reads succeeded but deployed fetch returned HTTP525. A temporary diagnostic deployment (`474fbb25-bade-4ffb-9ac5-b21a165ae857`) identified the upstream status in46ms; diagnostics were removed. The exact TLS incompatibility is unconfirmed. See [Cloudflare525 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/).
- Resolved after the user's explicit Bible follow-up: a bounded native Cloudflare TLS connection to the same api.prayerpulse.io provider succeeds. Certificate validation remains enabled; no plaintext fallback, alternate provider, proxy, dependency or API-shape change. Twelve focused transport test groups and strict typecheck/build pass. The client upload contained no changed assets.
- Before rollout, version URL https://6d9cfa0c-gndott.theangelorgapps.workers.dev passed9 real Bible RPC reads covering KJV/ESV/AMP/NIV book lists and chapters. Browser translation/book/next-chapter navigation passed. That exact version was promoted to100% after source892a18d was pushed.
- Live after rollout: the same9 RPC reads passed; browser John3→John4 changed36→54 verses, then selecting Psalms loaded chapter1. Desktop reader and400×844 phone layout verified with no horizontal overflow. Screenshots: `verification/bible-fixed-live-desktop.png`, `verification/bible-fixed-live-mobile.png`. Root cleanup ledger6/6 and Bible follow-up4/4 are now fulfilled.
- The Wrangler log tail has stopped; leaf workerd probes disposed their runtimes. The pre-existing localhost5190 preview remains as previously requested by the user.

Final active Worker version: `6d9cfa0c-a1ed-4425-af3e-645518086a24`, source `892a18d`. Previous cleanup-only version `5e093a38-4beb-45fe-ba86-91edcd075b12` remains a rollback option. Subsequent release-evidence commit is documentation-only.
