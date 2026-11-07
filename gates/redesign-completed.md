# Gates: GNDOTT Apple TV redesign
Scope: HI2026 header and supplied Apple TV control/browsing references in the existing GNDOTT website.

- [x] G1: Exact repository checkout confirmed and existing behavior inspected.
  EVIDENCE: User-approved destination resolves to /Users/charlesfinney/Documents/Codex/Projects/New project/gndott; origin https://github.com/theangelorgapps-ship-it/gndott.git; branch codex/apple-tv-experience. PLAN.md and DESIGN-REFERENCE.md record the source and boundaries.
- [x] G2: Screenshot-derived design system includes tokens, component categories, analysis and rendered demos.
  CHECK: python3 demo/apple-tv/verify-library.py
  EXPECT: exit 0
  EVIDENCE: 24 categories, 51 variants, 88 specimens, 23 exact control samples; final captures under demo/apple-tv/screenshots/.
- [x] G3: Header matches HI2026 open layout with progressive blur, navigation, compact actions and functional menu.
  EVIDENCE: src/header.css and src/routes/__root.tsx; measured 76px height, 0px radius and border in verification/mobile-geometry.json. Browser menu focus wrapping/Escape and desktop navigation checked; home-desktop.png.
- [x] G4: Home hero, rails, mobile dock and search follow Apple TV flow with real catalogue content.
  EVIDENCE: verification/mobile-home-detail.png and search-detail-mobile.png; actual search returned 2 Catch The Fire results and Fire genre filtered 6 to 4 teachings; library action navigated to login. Browse leaf 4/4.
- [x] G5: Detail pages open with artwork and play/watchlist controls; original playback and content features remain usable.
  EVIDENCE: Browser confirmed intent-only playback, correct selected episode source, Escape/focus restoration, volume/empty-state switching, More and Bible/Notes/About. Detail leaf 5/5; verification/README.md records limits.
- [x] G6: Build, type checking and relevant data/motion checks pass.
  CHECK: ./node_modules/.bin/tsc --noEmit && node scripts/gate-tv-data.mjs && node scripts/gate-tv-motion.mjs && node scripts/gate-recommendations.mjs --scoring && node scripts/gate-recommendations.mjs --groups && node scripts/gate-recommendations.mjs --api && node scripts/leaf-metadata.mjs && git diff --check
  EXPECT: exit 0
  EVIDENCE: Final npm run build exit 0; verification/build.log. Historical literal-layout gate limitations documented in verification/README.md.
- [x] G7: Desktop/mobile visual review, reduced motion/overflow checks and single independent control review completed.
  EVIDENCE: 320/390/1440px viewport checks; no page overflow. Real MotionRoot lifecycle test passes. All 10 blocking/important findings fixed; demo/apple-tv/ui-review-report.md. Parent inspected refreshed final captures.
- [x] G8: Reviewable changes and screenshots prepared, task processes stopped and deployment state recorded.
  EVIDENCE: verification/README.md plus PNG previews. Servers 5190/5187 terminated; browser viewport reset and test tabs closed. Local uncommitted branch only; no push or deployment.
