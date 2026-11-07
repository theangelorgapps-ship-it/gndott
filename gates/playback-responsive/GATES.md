# Gates: player, scrolling and responsive repair

Scope: stable player controls, an actual volume slider, previews from 0:30, predictable scrolling and balanced phone/desktop/4K sizing.

- [x] G1: Playback controls remain usable while seeking, adjusting volume and opening information; the volume range changes actual media volume.
  EVIDENCE: gate-player.mjs → PLAYER_CONTROLS_OK (drag holds its position against stale time updates, actual media volume, mute restoration); browser playback on Money With A Mission reached 852 seconds after seeking, paused at 863.402405 seconds, and volume UI retained 35% after mute/unmute. At 400×843 the volume slider is 120×44 and fully inside the player. See verification/playback-responsive.md.
- [x] G2: Hover previews start at 30 seconds, autoplay with a browser-compatible audio fallback, and stop cleanly when dismissed.
  EVIDENCE: gate-halo.mjs → HALO_PREVIEW_OK verifies exact 30-second start/loop, short-media fallback and teardown. Live recommended Ambassadors preview advanced from 34.039896 to 40.83223 seconds, paused=false and readyState=4; scrolling dismissed it. Recommendation queries now supply the playable source fields.
- [x] G3: Vertical page scrolling and horizontal rails do not trap wheel/touch input; closing overlays restores page scrolling.
  EVIDENCE: gate-tv-motion.mjs → TV_MOTION_OK verifies passive scroll listener only and cleanup; no wheel/touch interception remains in Motion.tsx. Browser PageDown over a rail moved page Y 1120→2232.5; ArrowRight moved rail scrollLeft 0→189.17. Closing playback restored body overflow to an empty string. Navigation restored page Y=0.
- [x] G4: Hero artwork and text are balanced without clipping at phone, desktop and 4K widths.
  EVIDENCE: browser checks at widths 400, 1200, 1283, 1500, 2400 and 3840; document width matched viewport. Hero heights 674.66, 675, 721.88, 843.75, 1215 and 1800 respectively. Final 3840×2160 screenshot: verification/playback-4k.png; phone screenshot: verification/playback-mobile-home.png.
- [x] G5: Header logo/navigation/actions scale coherently without collisions across large-screen breakpoints.
  EVIDENCE: at 1200px brand ends169.71, navigation ends906.59, actions start924.58/end1159.21. At 3840px brand ends384.65, actions start3112.70/end3709.44; header134.40px, nav27.648px, logo80px. Icons, hero arrows and pagination now scale with the layout.
- [x] G6: Catalogue and title-page typography stays readable and proportionate across phone, desktop and 4K sizes.
  EVIDENCE: hero title31.2px at400,42px at1200,45px at1500,72px at2400,104px at3840. Money With A Mission detail heading42px within360px on phone and99.84px within1450px at4K; 4K section headings44px. Both detail checks had no horizontal document overflow.
- [x] G7: TypeScript, production build, new behavioral checks and existing player/library regressions pass.
  CHECK: node scripts/gate-playback-responsive.mjs
  EXPECT: PLAYBACK_RESPONSIVE_OK
  EVIDENCE: RECOMMENDATION_V2_OK (18 behavioral fixtures) | PLAYBACK_RESPONSIVE_OK
