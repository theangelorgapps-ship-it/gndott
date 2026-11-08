# Halobox refinement verification

Date: 2026-11-08

- Repository: `/Users/charlesfinney/Documents/Codex/Projects/New project/gndott`
- Branch: `codex/apple-tv-experience`
- Remote: `https://github.com/theangelorgapps-ship-it/gndott.git`
- Implementation commit: `b6b7d4b`
- Live site: https://gndott.theangelorgapps.workers.dev/
- Cloudflare Worker version: `58000eb2-e86c-445a-af60-6ce6811f7ec4`

## Automated checks

Passed `npx tsc --noEmit`, `npm run build`, `git diff --check`, and:

- `scripts/gate-refinements.mjs`
- `scripts/gate-player.mjs`
- `scripts/gate-experience-catalogue.mjs`
- `scripts/gate-experience-glasslive.mjs`
- `scripts/gate-experience-player.mjs`
- `scripts/gate-store-bridge.mjs`
- `scripts/gate-subscription-checkout.mjs`

The new behavior checks cover Bunny seek-sheet boundaries, invalid inputs, retained signed query parameters, and standard/native fullscreen entry and exit.

## Browser checks

- Phone widths 320 and 391, tablet 1024, desktop 3840. Rendered DOM geometry confirmed the checked views fit without page overflow.
- Registration defaults to United States +1; the live country picker changed to United Kingdom +44. No account was created.
- The live Watch submenu exposes Sermons, Teachings, Shows, and Videos.
- The live Store lists 91 physical products; choosing Books returns 39. The picker closes correctly. At 391px the document width is 391px.
- Product variant choices enable Add to cart only after required options are selected. Existing cart and checkout summary reviewed. No payment or order submitted.
- Live title 229 opened in fullscreen, loaded its 5,005-second video with readyState 4, and opened Bible without overlapping the video. Searching the book picker for Psalms and selecting it displayed Psalms 1. Closing the picker retained playback; closing playback dismissed the dialog.
- Bunny scrubber thumbnail loaded at 1800 × 1008 in local browser verification.
- Initial live Store clicks were attempted before the client was ready. Fresh-load checks subsequently passed in Chrome and the in-app browser. All 90 deployed JavaScript assets matched the local build byte-for-byte; no persistent production startup failure was reproduced.

## Evidence and limits

Live screenshots are in `screenshots/live-store-mobile.png`, `live-store-books-mobile.png`, `live-watch-menu.png`, and `live-bible-mobile.png`. Other screenshots document local responsive and control verification.

One independent UI review identified one blocking and five important findings; all six were addressed. The component board covers 24 control families plus product option selection. See `ui-review-report.md` for accepted adaptations.

Physical iPhone Safari was not available. Its native fullscreen path is behavior-tested, not claimed as device-tested. The supplied glass component uses optical refraction on Chromium and its blur fallback on Safari/Firefox. Some in-app browser captures have compositor padding outside the tested CSS viewport.

Temporary development and production-preview servers were stopped after verification.
