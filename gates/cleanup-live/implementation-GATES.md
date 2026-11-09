# Gates: approved cleanup implementation

Scope: Apply the audited proven removals and subsequently approved exact CSS rules to the current gndott working tree; retain active UI, every route/API boundary, image resolution and behavior. Separately repair only the two authorized videos-query schema aliases and add regression coverage. Generated bindings belong to the driver.

- [x] I1: Only approved dead modules/dependencies/symbols, duplicate CSS declarations, image aliases and unused internal coupon plumbing are removed; active declarations and public assets remain intact.
  CHECK: node scripts/gate-cleanup-equivalence.mjs
  EXPECT: CLEANUP_EQUIVALENCE_OK
  EVIDENCE: CLEANUP_EQUIVALENCE_OK: 19 approved cleanup paths; 689 baseline files unchanged; 70 server functions; 37 routes; -105804 bytes; -1227 physical lines; -3 dependencies. MANIFEST_EQUIVALENCE_OK: 5388 cases; 540 aliases removed; 536 targets retained. CSS_EQUIVALENCE_OK: 266 approved rules; retained selectors/declarations/conditions unchanged. Compatibility delta is reported separately. Exit 0.

- [x] I2: Strict TypeScript including unused-symbol checks, current focused behavioral safeguards and exact cleanup baseline measurements pass.
  CHECK: ./node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false && node scripts/gate-library.mjs && node scripts/gate-viewer.mjs && node scripts/gate-playback-data.mjs && node scripts/gate-recommendation-v2.mjs && node scripts/gate-tv-motion.mjs
  EXPECT: TV_MOTION_OK
  EVIDENCE: RECOMMENDATION_V2_OK (18 behavioral fixtures) | TV_MOTION_OK: native wheel/touch scrolling, passive header updates, teardown

- [x] I3: Four implementation/review/defect/polish passes finish with a complete cleanup diff review and no further safe improvement in assigned scope.
  EVIDENCE: implementation-report.md records all four passes, exact baseline delta review and final approved CSS signature preservation. Lock objects/formatting differ only by three removed dependencies; all assets remain; the sole existing test change adds schema-compatible video fixtures/assertions. No additional safe cut remains in assigned scope.

- [x] I4: Videos queries match the actual schema without altering public response shape; real SQLite fixtures preserve catalogue fields and dashboard/recommendation media sources with no swallowed SQL errors.
  CHECK: node scripts/gate-tv-data.mjs && node scripts/gate-halo.mjs categories && git diff --check
  EXPECT: HALO_CATEGORIES_OK
  EVIDENCE: TV_DATA_API_OK: actual genre join, seven hero projections, video catalogue/dashboard/recommendation sources, episode sources/access, and user/type/expiry isolation | HALO_CATEGORIES_OK
