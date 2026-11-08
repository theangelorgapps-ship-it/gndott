# November 8 refinement verification

Target: `gndott`, branch `codex/apple-tv-experience`, remote `theangelorgapps-ship-it/gndott`.

## Local checks

- TypeScript and production build pass.
- Authentication: imported Laravel bcrypt, unchanged account/profile/subscription ownership, inactive-account protection, JWT signature/claims, state/nonce/PKCE/replay, safe linking and rate limits pass.
- Catalogue: round filter, category rail, upload-year selection, relevance/date ordering, canonical listing URLs and legacy redirects pass.
- Player: direct HLS, resume, purchase access, volume, controls, fullscreen fallback, single initial Play intent and blocked-autoplay recovery pass.
- Live chat: compact feed, emoji input, reports, viewer blocks and moderator visibility pass.
- Store: product option case, cart handoff and checkout integrity pass.
- Media: AVIF type/decode/hash/readback, private-path isolation, external allowlist, backup and reference guards pass.

## Browser checks

- 320px: sign-in and Watch submenu fit the viewport.
- 391px: catalogue filter and year choices, store tiles, Bible book picker, full-width player tabs and curved settings fit without page overflow.
- 3840×2160: home hero, header and typography fit the screen; no horizontal page overflow.
- Header background remains transparent on scroll; darkening layer is hidden.
- Catch The Fire HLS plays in Chrome (`readyState=4`, duration 1744.04 seconds, advancing currentTime). After refinement, one outer Play click starts playback; no second click required.
- Live chat collapses and reopens; existing real messages render in the compact layout.

## External configuration

Google client credentials recovered from the original private Laravel migration snapshot and stored as Cloudflare secrets. `GOOGLE_AUTH_ENABLED=0` until the current callback is registered and a real consent flow is verified. Apple requires its Services ID/team/key/P8 configuration; no usable Apple signing key was in the source snapshot. Neither provider is falsely presented as available.

Production auth and viewer-block migrations create isolated tables, leaving migrated user IDs, passwords, profiles and subscriptions intact. A full D1 backup exists outside the repository before migration.

## Media release

557 bundled images converted to verified AVIF, from 20,876,068 to 13,155,182 bytes (37% smaller), with originals backed up outside the repository before pruning. Server migration converted and verified 831 owned R2 originals, reducing 405,358,348 bytes to 24,451,261 bytes (94.0% smaller at the 1200px artwork cap). All references were rewritten and reverified before guarded pruning. Cloudflare's explicit AVIF output at 1920px returned WebP; format validation rejected it without pruning. The corrected 1200px artwork cap (512px avatars) produces verified AVIF. Bunny storyboard JPEGs are excluded to preserve the CDN's exact sprite crop grid; upstream WooCommerce/Bunny originals are never deleted.

Final R2 verification passed for all 831 converted, rewritten and pruned originals. Aggregate results are in `media-totals.json`; backups and the full receipt manifest remain outside the repository.

Release version `e3688696-01dc-4940-a776-2126d44cb42b` is live at https://gndott.theangelorgapps.workers.dev. The previously rejected store grid AVIF returns HTTP 200, `image/avif`, 136,804 bytes, and fully decodes at 1600×1986. All visible mobile store images load and the page has no horizontal overflow. The external store fallback validates structure and retains already-AVIF bytes only for Cloudflare decoder error 9516; uploads and migration retain strict decode verification.

The final production build and TypeScript pass. The store AVIF regression fixture fully decodes; 23 malformed/truncated variants are rejected. The task dev server, media probes and migration runners are stopped; the responsive browser override is reset. Google/Apple activation remains the one external handoff described above.

The temporary `gndott-media-avif-migration` Worker was deleted after verification; its migration endpoint and secret binding are no longer deployed. Seven of eight integration gates are met. G8 remains open for actual Google/Apple provider configuration and consent testing.
