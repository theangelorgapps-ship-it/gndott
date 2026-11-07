# GoodNews Halobox local update

The latest reader, dashboard, billing, AVIF and readable-URL changes are documented in [ACCOUNT-LIBRARY.md](ACCOUNT-LIBRARY.md). The notes below record the earlier design/migration pass; the final brand is stacked GoodNews / Halobox.

Local preview: http://127.0.0.1:5190/

- Public header, footer, account and sign-in identity now reads GoodNews Halo. The supplied gold WebP logo is used unchanged.
- Sermons has a borderless liquid-glass category row sourced from the catalogue's actual active genre mappings. Selection is reflected in the URL; reset, empty results and browser back are supported.
- Continue Watching and Discover Something Different use actual horizontal thumbnail files in 16:9 cards. Continue Watching retains progress bars and resume links; episode artwork falls back to the show thumbnail when unavailable. This supersedes the earlier portrait request.
- Recently Updated cards display a blue “Recently Uploaded” badge at the bottom of their artwork. The badge wraps neatly on narrow mobile cards; other poster rails retain their portrait layout.
- Desktop catalogue previews open with a delayed fade/scale transition. Bunny HLS video seeks silently to 90 seconds before it appears, then attempts sound. If the browser prevents audible autoplay, the sound button enables it after a click. The title and actions sit on a gradient over the video. Escape, scrolling, resizing, changing tabs and leaving the card release playback. Reduced-motion preferences suppress autoplay and transitions. Clips shorter than 90 seconds start at the beginning.
- The player and title page share a real Bible reader. The original AWS fallback adapter was migrated; see BIBLE-MIGRATION.md for source paths and the old backend outage. KJV, ESV, AMP and NIV can be selected without leaving the player. No Bible credentials are needed or shipped to the browser.

## Verification

The four executable checks in GATES.md cover real SQLite catalogue queries and filtering, media seek/sound/cleanup behavior including denied autoplay, live Bible requests plus failure/input cases, TypeScript, production build, player/access regression checks and 17 recommendation fixtures.

Browser evidence includes:

- Faith selection: 146 sermons → 20; reset and browser back restore 146. Unknown category shows a reset action.
- Actual HLS playback observed at 98.42 seconds, unmuted and not paused; sound toggle then observed at 104.30 seconds muted and 115.17 seconds unmuted without leaving the catalogue.
- Follow-up browser verification: horizontal cards measured 384 × 216 pixels at 1280 pixels wide and 296.40 × 166.72 at 390 pixels wide. Continue Watching loads the original 1280 × 720 and 4000 × 2250 thumbnail files; Discovery loads its separate 1536 × 1024 horizontal image with top alignment to preserve its title.
- All eight Recently Updated badges read “Recently Uploaded” and use RGB(0, 122, 255). No badges appear in other sections. Document width equals viewport width at 390 and 1280 pixels.
- Follow-up checks: `node scripts/gate-playback-data.mjs`, `npx tsc --noEmit` and `npm run build` passed. The SQLite fixture verifies movie/video/episode artwork selection and blank episode artwork fallback. Follow-up screenshots: `verification/halo-horizontal-continue-desktop.png`, `halo-horizontal-continue-mobile.png`, `halo-horizontal-discovery-mobile.png`, `halo-upload-badges-desktop.png`.
- Full-screen Bible tray loads John 3; book/chapter/translation controls load Psalms 23 in KJV and NIV.
- 390-pixel and 320-pixel layouts have no document overflow; mobile category borders measure 0 pixels.
- Desktop and mobile screenshots are in verification/halo-*.png.

Changes remain local on codex/apple-tv-experience. Nothing has been committed, pushed or deployed. The requested Vite preview remains running. The AWS source was inspected read-only; its shell and task-owned tabs were closed. Production Bible availability still depends on the existing Prayer Pulse service; temporary failures show a retry action.
