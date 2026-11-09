# Keep the local header appearance in production

- [x] H1: Identify why the live header has a full-width blur absent from localhost.
  EVIDENCE: Chrome computed backdrop-filter is none locally and blur(22px) saturate(1.5) live. Live index-dNtXXm1v.css contains only -webkit-backdrop-filter:none in the reset; the earlier standard blur survives.
- [x] H2: Fix the production CSS reset without changing the local header design, layout, routes or API.
  CHECK: node scripts/gate-header-css.mjs
  EXPECT: PASS: production header resets both standard and WebKit backdrop filters
  EVIDENCE: src/header.css now places the standard backdrop-filter:none after its WebKit prefix. The production index-DFhOizqo.css retains both resets; the only runtime edit is declaration order.
- [x] H3: Typecheck/build, built CSS regression check, and phone/desktop/4K production browser checks pass.
  EVIDENCE: Strict TypeScript and production build passed. node scripts/gate-header-css.mjs passes on the corrected build and fails on the former live index-dNtXXm1v.css. Preview e896823b-321f-4cfb-a7b6-5b088a1e0975 computed backdrop-filter:none at 400x844, 962x856, and 3840x2160, with no horizontal overflow or browser errors.
- [x] H4: Push and publish the verified fix; confirm live header and save screenshot proof.
  EVIDENCE: Commit a5f1be3 pushed to origin/codex/apple-tv-experience. Worker version e896823b-321f-4cfb-a7b6-5b088a1e0975 deployed at 100%. Live Chrome reports backdrop-filter:none and transparent background, loading index-DFhOizqo.css; the downloaded live asset passes the regression gate. Screenshot: verification/header-fixed-live.png.
