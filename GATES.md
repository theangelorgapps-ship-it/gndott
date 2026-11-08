# Gates: GoodNews Halo catalogue and Bible integration
Scope: deliver every browser comment plus the migrated Bible reader and smooth audible previews starting at 90 seconds.

- [x] H1: GoodNews Halo name and supplied circular logo replace the old public-facing identity without clipping at mobile and desktop widths.
  EVIDENCE: Browser screenshots verification/halo-categories-desktop.png, halo-categories-mobile.png and halo-mobile-menu.png. Gold source WebP copied unchanged. Header checked at 1280, 390 and 320 pixels; at 320 the brand ends at x172.45 and actions begin at x210, with document width 320.
- [x] H2: Liquid-glass category filters on Sermons use actual catalogue categories, update results/URL and handle empty/reset states.
  CHECK: node scripts/gate-halo.mjs categories
  EXPECT: HALO_CATEGORIES_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=6861bd11dbd55319c72572ba55013c8d9f29a0ccf2461c70ea98aa4dbfc12233; exit=0; EXPECT=matched; output-sha256=7bb999e9753cebcd056d9ff274382724da77dabc4748ee65a6a7d141d7fa6688; output-bytes=19; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=ca21ac988431/25 entries
- [x] H3: Continue Watching uses actual horizontal thumbnails and keeps progress/resume behavior (updated following the user’s correction).
  EVIDENCE: verification/halo-horizontal-continue-desktop.png and halo-horizontal-continue-mobile.png; artwork measured 384 × 216 desktop and 296.40 × 166.72 mobile. Original landscape source dimensions verified as 1280 × 720 and 4000 × 2250; resume links retain #watch and progress bars. SQLite playback-data check passed including movie/video/episode thumbnail selection and fallback. The previous portrait evidence is superseded.
- [x] H4: Preview opens and closes smoothly, starts actual video at 90 seconds, supports audio with honest autoplay fallback, and overlays title on a gradient.
  CHECK: node scripts/gate-halo.mjs preview
  EXPECT: HALO_PREVIEW_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=cf79e0b2d670fa0018943f0fa078cfdaf8ca3a0cbf10721462a987e9489d3162; exit=0; EXPECT=matched; output-sha256=1a5b23a5abe0201a2c4bb912b5b3a66d31bb59f1b17f85a3f2c38d64d3e6e0a5; output-bytes=16; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=ca21ac988431/25 entries
- [x] H5: Original AWS Bible provider is traced and migrated into a functioning book/chapter reader with protected credentials and recoverable errors.
  CHECK: node scripts/gate-halo.mjs bible
  EXPECT: HALO_BIBLE_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=59b2233177baaabc4c5dc2ad62ddf676c630545d334be2c19fa586a1429a8916; exit=0; EXPECT=matched; output-sha256=918420ab87b933e62eeabfcaa3c62e54ca80647d6e8f5fbe35b0ba8815a1a537; output-bytes=146; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=ca21ac988431/25 entries
- [x] H6: Real browser verification covers filtering, portrait cards, preview media/timing/audio, Bible navigation and responsive layout.
  EVIDENCE: docs/HALO-UPDATE.md records browser observations: 146 to 20 Faith results, empty/reset/back behavior, actual HLS at 98.42 seconds with sound and working mute/unmute, no remaining preview after Escape, John 3 in the full-screen Bible tray, Psalms 23 KJV/NIV navigation, mobile zero-overflow and zero-border checks. See verification/halo-*.png.
- [x] H7: Typecheck, production build and relevant regression checks pass for the final implementation.
  CHECK: node scripts/gate-halo.mjs build
  EXPECT: HALO_BUILD_OK
  EVIDENCE: automatic-evidence=v1; definition-sha256=db4118e39dffee93df0da89698dc456ea09ba4c4a1bd9494b5aea09c1a618573; exit=0; EXPECT=matched; output-sha256=1b5a11be63a0954eb4c2ab9a49d301a04f2793943c9a4a7c02bb979351916424; output-bytes=15532; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/Codex/Projects/New project/gndott; path=ca21ac988431/25 entries
- [x] H8: Review artifacts and local preview are available; source/deployment state and remaining limits are accurately recorded.
  EVIDENCE: Local http://127.0.0.1:5190/ remains running as requested. docs/HALO-UPDATE.md and docs/BIBLE-MIGRATION.md describe outcomes, provider provenance and limitations. Source shell logged out and temporary AWS/QA tabs closed. Changes remain local and uncommitted on codex/apple-tv-experience; no deployment performed.

## Follow-up: horizontal thumbnails and blue upload badges

Continue Watching and Discover Something Different now use horizontal thumbnail sources. Recently Updated retains portrait cards and adds the requested blue “Recently Uploaded” badges. Browser screenshots and measured results are recorded in docs/HALO-UPDATE.md. The checks above document the preceding completed phase; the follow-up passed the playback-data SQLite regression, TypeScript and a fresh production build. No recommendation ranking, Bible or playback-control changes were made in this follow-up.

## November 8 domain, mail and responsive UI

- [ ] NOV08-player: All outcomes in gates/nov08-domain-ui/player.md verified.
  EVIDENCE: Implementation, regressions and responsive browser checks complete. P1 physical-keyboard and authenticated live-chat proof remains open; see docs/qa/nov08-domain-ui/verification.md.
- [x] NOV08-navigation: All outcomes in gates/nov08-domain-ui/navigation.md verified.
  EVIDENCE: Navigation, contrast and AVIF checks passed; live phone/tablet/4K screenshots in docs/qa/nov08-domain-ui.
- [x] NOV08-security: All outcomes in gates/nov08-domain-ui/security.md verified.
  EVIDENCE: Auth/API negative regressions passed; fixed findings and residual risks recorded in docs/security-audit-2026-11-08.md.
- [x] NOV08-cloud: All outcomes in gates/nov08-domain-ui/cloud.md verified.
  EVIDENCE: Canonical domains live, sender enabled with zero setup messages, Google/Apple callbacks saved and four provider initiation checks passed. Actual delivery and completed provider login were not tested.
- [ ] NOV08-integration: All outcomes in gates/nov08-domain-ui/integration.md verified.
  EVIDENCE: Builds, deployment and live checks complete. I2 retains physical keyboard/authenticated chat verification as an explicit limitation.

## November 8 release 2

- [ ] R2-entitlement: All outcomes in gates/nov08-release2/entitlement.md independently verified.
  EVIDENCE: pending
- [ ] R2-experience: All outcomes in gates/nov08-release2/experience.md independently verified.
  EVIDENCE: pending
- [ ] R2-content: All outcomes in gates/nov08-release2/content.md independently verified.
  EVIDENCE: pending
- [ ] R2-visual: All outcomes in gates/nov08-release2/visual.md independently verified.
  EVIDENCE: pending
- [ ] R2-integration: All outcomes in gates/nov08-release2/integration.md independently verified.
  EVIDENCE: pending
