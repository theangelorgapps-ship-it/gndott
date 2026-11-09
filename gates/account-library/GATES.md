# Gates: Halobox reader and account library
Scope: implement all annotated branding, discovery, reading, notes, dashboard, image, account and URL changes locally.

- [x] A1: Stacked GoodNews / Halobox branding and requested email and four phone contacts are correct at desktop and mobile widths.
  EVIDENCE: Browser review confirmed stacked GoodNews / Halobox, Hello@halobox.tv and all four country telephone links; narrow viewport has no horizontal overflow. Screenshot: verification/halobox-library-desktop.png.
- [x] A2: Discovery provides a full row of distinct horizontal recommendations; player tabs have borderless liquid glass and readable selected states.
  EVIDENCE: Live DOM measured eight discovery links with 400 × 225 artwork and readable URLs. Player glass pill reviewed in verification/bible-library-desktop.png; computed borders were 0px.
- [x] A3: Bible supports comfortable responsive reading, two columns on wide displays, saving and highlighting verses, and restoring these per profile on the dashboard.
  EVIDENCE: John 3:1 saved and gold-highlighted in the live reader, then reopened from dashboard. Desktop column count 2; 391px viewport uses one column with document width equal to viewport. SQLite profile isolation and stale-profile rejection are covered by A9.
- [x] A4: Rich text notes retain formatting, save per profile, appear in dashboard folders, and download as a readable PDF; legacy notes remain recoverable.
  EVIDENCE: A formatted linked note was saved inside the player and appeared in My Notes after navigation. Actual PDF download was opened visually and PDFKit extracted its selectable text. Evidence: verification/player-rich-notes.png and verification/A Sound From Heaven  Prophet Uebert Angel.pdf.png. Legacy import and per-profile draft recovery reviewed in LibraryNoteEditor.tsx; persistence/sanitization cases run in A9.
- [x] A5: Glass folders contain actual notes, highlights, saved verses and Watch Later content with working navigation, keyboard support and reduced motion.
  EVIDENCE: Dashboard shows real counts (1 note, 1 highlight/saved verse, 2 Watch Later titles) and opens the saved reader. All-item lists supplement the four-sheet folder fan. Keyboard menu, focus, Escape/dialog isolation and reduced-motion paths reviewed. Screenshot: verification/halobox-library-desktop.png.
- [x] A6: Readable content URLs resolve correctly, legacy numeric links continue to work, and player/resume links use the readable routes.
  EVIDENCE: Readable title links observed in the live discovery row; /movie/229 still resolves and plays. Parser and duplicate-ID suffix cases run in A9. Episode rentals now link through their readable parent show.
- [x] A7: Profile photos upload easily; server conversion produces AVIF before storage, rejects invalid images, and bounds processing and storage costs.
  EVIDENCE: Actual supplied WebP uploaded through Change photo and stored by the local server as a 512 × 512 AVIF, independently decoded as AVIF (25,573 bytes). Artifact: verification/profile-upload.avif. Validation, deduplication and before-storage conversion assertions run in A9. Production and separate legacy-admin boundaries are documented in docs/ACCOUNT-LIBRARY.md.
- [x] A8: Subscription cancellation is easy to reach, accurately reflects the billing provider, preserves entitled access and never claims cancelled billing on a failed provider operation.
  EVIDENCE: Account shows its accurate No active subscription state. Real billing functions tested against controlled provider responses for owned/foreign subscriptions, one-time purchases, external stores, provider failure and confirmed renewal cancellation while retaining access. Confirmation UI reviewed; no real customer subscription cancelled.
- [x] A9: Typecheck, production build and relevant persistence, security and recommendation regressions pass; local preview remains available.
  CHECK: node scripts/gate-account-library.mjs
  EXPECT: HALOBOX_LIBRARY_RELEASE_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=7e5aed5320f9adbd96c5d3f3f9d4a9f095b07678848c73974943cddcdce3c253; exit=0; EXPECT=matched; output-sha256=68b9d200a5e10a9cfd6ad30a12ea22b0690a73dc94f65cbecec18c3d3ddff248; output-bytes=2807; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=ca21ac988431/25 entries
