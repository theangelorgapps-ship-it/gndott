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

## Live verification and limits

- All 17 public HTTP checks returned 200 with expected HTML/image/font/CSS content types; no application error pages. Local evidence: `verification/cleanup-live-http.json`.
- Live responsive checks: 400×844 and 3840×2160 CSS viewports have document widths exactly400 and3840. Mobile dock and search both64px high, top770/bottom834. 4K header134.398px and title104px; existing responsive design retained. Screenshots/geometry saved locally.
- Public video51 played successfully. At38seconds, pause held playback and the Volume slider changed1→0.99; fullscreen could be exited without leaving playback. Player screenshot saved. No real customer library writes or subscription cancellations were performed.
- Bible integration limitation: local Node and actual workerd requests succeed, but deployed Worker RPCs return the existing graceful provider error. A temporary diagnostic deployment (`474fbb25-bade-4ffb-9ac5-b21a165ae857`) identified `Bible upstream HTTP525` in46ms. Diagnostic-only source changes were removed; reviewed source equivalence passes again.
- HTTP525 identifies a Cloudflare-to-provider TLS handshake failure; the specific TLS incompatibility remains unconfirmed. The original backend proxy also returned503. No TLS validation was weakened and no alternate data provider or proxy was added. See [Cloudflare525 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/).
- Therefore gateG6 is explicitly blocked for a fully successful Bible live flow. Cleanup/design/API equivalence and source deployment remain verified; this is not reported as a100% functional live pass.
- The Wrangler log tail has stopped; leaf workerd probes disposed their runtimes. The pre-existing localhost5190 preview remains as previously requested by the user.

Final active Worker version: `5e093a38-4beb-45fe-ba86-91edcd075b12`, deployed from reviewed source `6444c28` after removing all temporary diagnostic changes. Production runtime source matches that commit; subsequent release-evidence commit is documentation-only.
